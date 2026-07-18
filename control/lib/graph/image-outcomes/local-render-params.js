/**
 * Local render params — the deterministic half of the local-worker prompt
 * (local-render-worker.plan.md L1).
 *
 * A diffusion backend (ComfyUI + SDXL/ControlNet first) wants a compact
 * positive prompt, a negative prompt, conditioning strength, and pixel
 * dimensions — not the prose worker brief instructions.js writes for an
 * agentic renderer. Everything derivable from the closed vocabularies is
 * derived HERE, pure and deterministic (same manifest + target → same
 * params); the freeform remainder (panel beat, subject action, mood
 * nuance) is distilled by the DRIVING AGENT at render time and appended
 * to `promptFragments`. The module emits params, the agent finishes the
 * prompt.
 *
 * Exposed on the render packet as `localParams` so any backend-driving
 * agent gets the head start — not just the ComfyUI stack.
 */

import {
  normalizeImageOutcomesManifest,
  renderTargets,
  KIND_SEQUENTIAL_ART,
  KIND_CHARACTER_SHEET,
  KIND_KEYFRAME_ANIMATION,
  KIND_SCENE_MOTION,
  parseKeyframeTarget,
  parseSceneTarget,
} from './manifest.js';
import { cameraPhrase } from './cameras.js';
import { subCelPhrase } from './pan-cel-spike/sub-cels.js';

// SDXL's native training area; dimensions snap to it at a preserved aspect.
const TARGET_AREA = 1024 * 1024;
const DIM_STEP = 64;
const DIM_MIN = 512;
const DIM_MAX = 2048;

// The scaffold's own graphic language, negative-prompted so a structurally
// conditioned model doesn't reproduce the control diagram (the scaffold-echo
// failure mode, backend edition) — plus the no-text doctrine.
const SCAFFOLD_NEGATIVES = [
  'wireframe lines, flat unshaded polygons, stick figures, dashed boxes',
  'diagram, blueprint, schematic look',
  'text, letters, labels, captions, watermark, signature',
];

// Preserve levels → ControlNet strength. Strict geometry pins composition
// hard; a figure implies at least pose-level conditioning; loose-only
// manifests leave the model room to invent. Live-tuned (first ComfyUI run,
// local-render-worker.plan.md): ≥0.8 traces the scaffold's graphic language
// into the art, ≤0.4 loses staged figures; ~0.55–0.6 held geometry AND
// painted freely against the strict-only control scaffold.
const STRENGTH_STRICT = 0.6;
const STRENGTH_GUIDED = 0.5;
const STRENGTH_LOOSE = 0.35;
// The sheet strip layout IS the instruction — held firmly, short of strict
// scene geometry.
const STRENGTH_SHEET = 0.6;

function snapDimension(value) {
  const snapped = Math.round(value / DIM_STEP) * DIM_STEP;
  return Math.min(DIM_MAX, Math.max(DIM_MIN, snapped));
}

function sizeFromBox(w, h) {
  const scale = Math.sqrt(TARGET_AREA / (w * h));
  return { width: snapDimension(w * scale), height: snapDimension(h * scale) };
}

function strengthFromForms(forms, figureCount) {
  if (forms.some((f) => f.preserve === 'strict')) return STRENGTH_STRICT;
  if (figureCount > 0 || forms.some((f) => f.preserve === 'guided')) return STRENGTH_GUIDED;
  return STRENGTH_LOOSE;
}

function dedupe(list) {
  return [...new Set(list.filter(Boolean))];
}

/**
 * Pure. `buildLocalRenderParams(manifest, target)` →
 *   { target, size, promptFragments, negative, controlnet, identity? }
 *
 * `promptFragments` are joined with ', ' by the driving agent AFTER it
 * appends its own distillation of the beat/subject; `negative` joins the
 * same way. `controlnet.strength` is a starting point, not a law — the
 * agent may nudge it after seeing a drifted or over-traced result.
 */
export function buildLocalRenderParams(rawManifest, target) {
  const manifest = normalizeImageOutcomesManifest(rawManifest);
  const targets = renderTargets(manifest);
  const resolved = target ?? targets[0];
  if (!targets.includes(resolved)) {
    throw new Error(`target '${resolved}' is not a render target (targets: ${targets.join(', ')})`);
  }

  // Keyframe cels have no renderBrief — the meru guide + character sheet ARE the
  // conditioning. Params drive the local diffusion rung (img2img over the guide
  // + OpenPose skeleton + IP-Adapter identity, keyframe-spike/local-render.mjs).
  if (manifest.kind === KIND_KEYFRAME_ANIMATION) {
    const { face } = parseKeyframeTarget(resolved);
    const ch = manifest.characters[0];
    // The clip's declared style (preset / fork / custom) when present, else the
    // historical flat-cel default. The plain-background fragment is a compositing
    // invariant in every style (the scene plate supplies the setting).
    const kb = manifest.renderBrief;
    return {
      target: resolved,
      size: sizeFromBox(manifest.canvas.width, manifest.canvas.height),
      promptFragments: dedupe([
        kb?.style || 'flat cel animation style, clean dark outlines, flat colors, soft daylight',
        ch.description,
        face ? subCelPhrase(face.vocab, face.state) : null,
        'plain uniform pale background, no ground, no shadow, no scenery',
      ]),
      negative: dedupe([
        ...(kb?.negative || []),
        ...SCAFFOLD_NEGATIVES,
        'register lines, mannequin, exposed rig, visible scaffold',
        'the character growing or shrinking, off the ground line',
      ]),
      // The guide (mannequin) carries scale + pose for img2img; the OpenPose
      // skeleton is the ControlNet conditioning (the packet serves both).
      controlnet: { kind: 'openpose', strength: 0.7 },
      identity: { method: 'ip-adapter', characters: manifest.characters.map((c) => c.id) },
    };
  }

  if (manifest.kind === KIND_SCENE_MOTION) {
    const parsed = parseSceneTarget(manifest, resolved);
    const stage = parsed.stage || manifest.stage;
    const width = parsed.band ? manifest.frame.width : stage.plate.width;
    const height = parsed.band ? manifest.frame.height : stage.plate.height;
    // The plate's style = the scene's renderBrief (explicit, or inherited from
    // the cast at mint). Same style token the cels used → cohesive background.
    const pb = manifest.renderBrief;
    return {
      target: resolved,
      size: sizeFromBox(width, height),
      promptFragments: dedupe([
        pb?.style ? `${pb.style} — background plate, no characters` : 'flat cel animation background plate, no characters',
        'paint over the stage guide as a finished background',
        `horizon at y=${stage.horizonY}, ground plane below, background above`,
        'remove all magenta guide marks and tick figures',
      ]),
      negative: dedupe([
        ...(pb?.negative || []),
        ...SCAFFOLD_NEGATIVES,
        'people, faces, bodies, hands, phones, characters',
        'magenta horizon line, magenta tick figures, visible stage guide',
        'readable text, labels, captions, watermark, signature',
      ]),
      controlnet: { kind: 'scribble', strength: STRENGTH_GUIDED },
    };
  }

  const brief = manifest.renderBrief;
  const negative = dedupe([...brief.negative, ...SCAFFOLD_NEGATIVES]);

  if (manifest.kind === KIND_CHARACTER_SHEET) {
    return {
      target: resolved,
      size: sizeFromBox(manifest.viewBox.width, manifest.viewBox.height),
      promptFragments: dedupe([
        brief.style,
        'character model sheet turnaround — front, three-quarter, side, back views on a common ground line',
        brief.lighting,
      ]),
      negative,
      controlnet: { kind: 'scribble', strength: STRENGTH_SHEET },
    };
  }

  const panel =
    manifest.kind === KIND_SEQUENTIAL_ART && resolved !== 'page'
      ? manifest.panels.find((p) => p.id === resolved)
      : null;

  let box;
  let camera;
  let forms;
  let figureCount;
  if (panel) {
    box = [panel.bounds.w, panel.bounds.h];
    camera = panel.camera;
    forms = panel.forms;
    figureCount = panel.figures.length;
  } else if (manifest.kind === KIND_SEQUENTIAL_ART) {
    box = [manifest.viewBox.width, manifest.viewBox.height];
    camera = null; // a whole page has no single camera
    forms = manifest.panels.flatMap((p) => p.forms);
    figureCount = manifest.panels.reduce((n, p) => n + p.figures.length, 0);
  } else {
    box = [manifest.viewBox.width, manifest.viewBox.height];
    camera = manifest.camera;
    forms = manifest.forms;
    figureCount = manifest.figures.length;
  }

  const params = {
    target: resolved,
    size: sizeFromBox(box[0], box[1]),
    promptFragments: dedupe([
      brief.style,
      camera ? cameraPhrase(camera.kind) : null,
      brief.mood,
      brief.lighting,
    ]),
    negative,
    controlnet: { kind: 'scribble', strength: strengthFromForms(forms, figureCount) },
  };

  // Identity pointers only — the packet's `characterSheets[].boundSheet`
  // carries the actual PNG path; this module stays db-free.
  if (manifest.characters?.length) {
    params.identity = {
      method: 'ip-adapter',
      characters: manifest.characters.map((c) => c.id),
    };
  }
  return params;
}
