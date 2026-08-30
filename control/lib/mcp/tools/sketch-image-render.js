/**
 * Split out of tools/sketches.js — see
 * lite-template/integration/_0828/mojulo-2.0-pure-creative.plan.md (Phase 1c).
 * sketches.js hosted six unrelated tool families in one 2038-line file; each
 * now owns its own module and sketches.js is the registration surface.
 */
// The IMAGE-RENDER handoff: packet out to an external generator, PNG back in
// (renders and character sheets).


import path from 'node:path';
import { promises as fs } from 'node:fs';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import {
  isImageOutcomesKind,
  normalizeImageOutcomesManifest,
  renderTargets,
  parseKeyframeTarget,
  KIND_IMAGE_OUTCOME,
  KIND_SEQUENTIAL_ART,
  KIND_CHARACTER_SHEET,
  KIND_KEYFRAME_ANIMATION,
  KIND_SCENE_MOTION,
  KIND_SPRITE_SHEET,
} from '@/lib/graph/image-outcomes/manifest';
import {
  buildRenderInstructions,
  buildCharacterSheetInstructions,
} from '@/lib/graph/image-outcomes/instructions';
import { latestBoundSheet, nextSheetPath } from '@/lib/graph/image-outcomes/sheet-store';
import { buildLocalRenderParams } from '@/lib/graph/image-outcomes/local-render-params';
import { nextRenderPath, boundRenderMap } from '@/lib/graph/image-outcomes/render-store';

import { resolveCharacterRefs } from './sketch-mint.js';

/**
 * get_image_render_packet — the read half of the image-outcomes render
 * handoff (image-outcomes.plan.md I3): everything an external image-capable
 * worker (the Codex/GPT agent first) needs to paint a minted
 * image-outcome / sequential-art ref. Returns render instructions (built
 * from the manifest — camera/pose phrasings + Style Lock when a style
 * preset is set), the normalized manifest, and scaffold URLs (page + per-
 * panel crops). Read-only and stateless — the durable request queue and
 * `submit_image_render` are the gated remainder of I3; until they land the
 * worker hands its PNG back to the operator out of band.
 */
export async function getImageRenderPacketHandler(input) {
  const { ref, target } = input || {};
  if (!ref || typeof ref !== 'string') {
    throw new Error('get_image_render_packet requires { ref }');
  }
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`Sketch '${ref}' not found`);
  if (!isImageOutcomesKind(sketch.manifest?.kind)) {
    throw new Error(
      `Sketch '${ref}' is kind '${sketch.manifest?.kind}' — not an image-outcome/sequential-art `
      + 'director packet. Mint one via create_sketch with those kinds (read the sketch_vocab cards).',
    );
  }
  const manifest = normalizeImageOutcomesManifest(sketch.manifest);
  const encoded = encodeURIComponent(sketch.ref || ref);
  const isKeyframe = manifest.kind === KIND_KEYFRAME_ANIMATION;
  const isScene = manifest.kind === KIND_SCENE_MOTION;
  const isSprite = manifest.kind === KIND_SPRITE_SHEET;
  const scaffoldUrls = (panelId) => {
    // A keyframe target's scaffold is that key's meru guide (the posed mannequin
    // between register lines) — the raster the worker paints OVER — plus the
    // per-key OpenPose skeleton as the structural (ControlNet) variant. A face
    // variant re-renders the SAME pose, so it shares the key's guide.
    if (isKeyframe) {
      const { keyIndex } = parseKeyframeTarget(panelId ?? 'key-0');
      return {
        pngUrl: `/api/sketches/${encoded}/png?inline=1&key=${keyIndex}`,
        controlPngUrl: `/api/sketches/${encoded}/png?inline=1&key=${keyIndex}&skeleton=1`,
      };
    }
    // A scene-motion target's scaffold is the STAGE GUIDE — the declared ground
    // plane (horizon + tick figures) the worker paints a background over. A
    // cross-cut shot's plate target serves that shot's OWN stage guide.
    if (isScene) {
      const t = panelId ?? 'plate';
      return { pngUrl: `/api/sketches/${encoded}/png?inline=1&plate=1&target=${encodeURIComponent(t)}` };
    }
    const panel = panelId ? `&panel=${encodeURIComponent(panelId)}` : '';
    return {
      svgUrl: `/api/sketches/${encoded}/svg?inline=1${panel}`,
      pngUrl: `/api/sketches/${encoded}/png?inline=1&scale=2${panel}`,
      // Geometry-only variant for structural conditioners (ControlNet):
      // labels and dashed boxes stripped so they can't be traced into the art.
      controlPngUrl: `/api/sketches/${encoded}/png?inline=1&scale=2&control=1${panel}`,
    };
  };

  // Targets mirror the manifest's render strategy (the I3 expansion rule,
  // shared with bind_image_render and the final composite).
  const targets = renderTargets(manifest);

  const resolvedTarget = target ?? targets[0];
  if (!targets.includes(resolvedTarget)) {
    throw new Error(
      `target '${resolvedTarget}' is not a render target of '${ref}' (targets for its `
      + `${manifest.kind === KIND_SEQUENTIAL_ART ? `'${manifest.renderStrategy}' strategy` : 'kind'}: ${targets.join(', ')})`,
    );
  }
  const panelId = resolvedTarget === 'page' ? undefined : resolvedTarget;

  const response = {
    ok: true,
    ref: sketch.ref || ref,
    kind: manifest.kind,
    title: manifest.title,
    ...(manifest.kind === KIND_SEQUENTIAL_ART ? { renderStrategy: manifest.renderStrategy } : {}),
    target: resolvedTarget,
    targets,
    // The step the spike showed workers skip: actually invoking image
    // generation. The scaffold is conditioning input, never the deliverable —
    // a worker that returns the wireframe has traced, not generated.
    workerProtocol: [
      ...(manifest.kind === KIND_CHARACTER_SHEET
        ? [
            '0. This target IS a character reference sheet — a reusable identity artifact. Generate it from `instructions` conditioned on the scaffold (the strip layout), then SUBMIT the PNG back via `bind_character_sheet { ref, image_path }` so mojulo can serve it as a conditioning reference to every future comic that casts this character.',
          ]
        : []),
      ...(manifest.characters?.length
        ? [
            '0. FIRST — before any panel or shot: for each entry in `characterSheets`, if it carries `boundSheet`, FETCH that PNG (`boundSheet.url` / `boundSheet.path`) and use it as the identity reference — do NOT regenerate that character. Otherwise generate the sheet from its `instructions` (neutral-light turnaround strip, one row per outfit) and, when the entry has a `ref`, submit the PNG via `bind_character_sheet { ref, image_path }` so it is saved for reuse. Condition every panel or shot featuring a character on that character\'s sheet, and return any newly generated sheets alongside the artwork.',
          ]
        : []),
      `1. Fetch the scaffold PNG (scaffold.pngUrl) — it is a wireframe control diagram, NOT the artifact.`,
      '2. INVOKE your image-generation capability, conditioning on the scaffold image with `instructions` as the prompt.',
      '3. Verify the output is a fully painted raster — no wireframe lines, flat colored polygons, stick figures, dashed boxes, or labels from the scaffold. If any survive, regenerate.',
      ...(manifest.kind === KIND_CHARACTER_SHEET
        ? ['4. Submit the sheet via `bind_character_sheet { ref, image_path }`.']
        : [
            `4. SUBMIT the generated PNG back via \`bind_image_render { ref: '${sketch.ref || ref}', target: '<this target>', image_path }\`. Once every target is bound, mojulo composites the finished page — borders, bubbles, and lettering re-imposed deterministically — at \`finalUrl\`, ready to publish (gather + cook comic).`,
          ]),
      ...(targets.length > 1
        ? [`5. Repeat for each remaining target: ${targets.filter((t) => t !== resolvedTarget).join(', ')}.`]
        : []),
    ],
    instructions: buildRenderInstructions(manifest, (isKeyframe || isScene) ? { target: resolvedTarget } : (panelId ? { panelId } : {})),
    // Deterministic head start for a diffusion-backend worker (ComfyUI et
    // al., local-render-worker.plan.md L1): compact prompt fragments,
    // negatives, ControlNet strength, and pixel size. The driving agent
    // appends its own beat/subject distillation before generating.
    localParams: buildLocalRenderParams(manifest, resolvedTarget),
    // Identity metadata: one reference-sheet brief per declared character.
    // A character carrying a `ref` points at a standalone character-sheet
    // sketch; when that sheet has a bound render, the PNG rides along as
    // `boundSheet` — the stored conditioning reference.
    ...(manifest.characters?.length
      ? {
          characterSheets: manifest.characters.map((c) => {
            const bound = c.ref ? latestBoundSheet(c.ref) : null;
            return {
              id: c.id,
              ...(c.name ? { name: c.name } : {}),
              ...(c.ref ? { ref: c.ref } : {}),
              outfits: c.outfits.map((o) => o.id),
              ...(bound
                ? { boundSheet: { n: bound.n, path: bound.path, url: `/api/sketches/${encodeURIComponent(c.ref)}/sheet.png` } }
                : {}),
              instructions: buildCharacterSheetInstructions(manifest, c.id),
            };
          }),
        }
      : {}),
    ...(manifest.kind === KIND_CHARACTER_SHEET
      ? (() => {
          const bound = latestBoundSheet(sketch.ref || ref);
          return bound
            ? { boundSheet: { n: bound.n, path: bound.path, url: `/api/sketches/${encoded}/sheet.png` } }
            : {};
        })()
      : {}),
    scaffold: scaffoldUrls(panelId),
    // Submitted-render bookkeeping: which targets already have a bound PNG
    // (latest n per target), and the composite URL once all are bound.
    ...(manifest.kind !== KIND_CHARACTER_SHEET
      ? (() => {
          const bound = boundRenderMap(sketch.ref || ref, targets);
          const boundTargets = Object.keys(bound);
          return {
            ...(boundTargets.length
              ? { boundRenders: Object.fromEntries(boundTargets.map((t) => [t, bound[t].n])) }
              : {}),
            // A keyframe animation / scene has no still `final.png` — the finished
            // artifact is a forge_motion `mo_` GIF/MP4 (keyframe: stitched from the
            // accepted cels; scene: composited from clips over the accepted plate).
            ...(boundTargets.length === targets.length
              ? (isKeyframe
                  ? { allCelsAccepted: true }
                  : isScene
                    ? { sceneReady: true }
                    // A sprite sheet has no still composite — the finished artifact
                    // is the baked pixelizer sprite payload. Point at the bake tool.
                    : isSprite
                      ? { spritesReady: true, bakeTool: 'bake_sprite_sheet' }
                      : { finalUrl: `/api/sketches/${encoded}/final.png` })
              : {}),
          };
        })()
      : {}),
    manifest,
  };
  if (panelId && !isKeyframe && !isScene) {
    // The page scaffold rides along with every panel target — the page
    // teaches layout and continuity, the crop teaches the local shot.
    response.pageScaffold = scaffoldUrls();
  }
  return response;
}

export const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/**
 * bind_character_sheet — the submit half of the character-sheet loop:
 * the render worker (or the operator) hands back the generated sheet PNG
 * and it is snapshotted, append-only, into the sketch's outcome folder.
 * From then on every render packet for a comic casting this character
 * serves the PNG as `boundSheet` — the stored conditioning reference.
 */
export async function bindCharacterSheetHandler(input) {
  const { ref, image_path: imagePath, image_base64: imageBase64 } = input || {};
  if (!ref || typeof ref !== 'string') throw new Error('bind_character_sheet requires { ref }');
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`Sketch '${ref}' not found`);
  if (sketch.manifest?.kind !== KIND_CHARACTER_SHEET) {
    throw new Error(
      `Sketch '${ref}' is kind '${sketch.manifest?.kind}' — sheet renders bind to the character-sheet ref itself, not to a comic`,
    );
  }
  if ((imagePath ? 1 : 0) + (imageBase64 ? 1 : 0) !== 1) {
    throw new Error('bind_character_sheet requires exactly one of image_path | image_base64');
  }
  const bytes = imagePath ? await fs.readFile(imagePath) : Buffer.from(imageBase64, 'base64');
  if (bytes.length < 8 || !bytes.subarray(0, 4).equals(PNG_MAGIC)) {
    throw new Error('the submitted image is not a PNG (the sheet must be a generated raster, not the SVG scaffold)');
  }
  const slot = nextSheetPath(sketch.ref);
  await fs.writeFile(slot.path, bytes);
  return {
    ok: true,
    ref: sketch.ref,
    n: slot.n,
    path: slot.path,
    url: `/api/sketches/${encodeURIComponent(sketch.ref)}/sheet.png`,
    bytes: bytes.length,
  };
}


/**
 * bind_image_render — the submit half of the page/panel render loop
 * (plan I3's submit surface, minimal like bind_character_sheet): the
 * render worker hands back a generated PNG for one target of an
 * image-outcome / sequential-art sketch. Once every target from
 * `renderTargets` is bound, `/api/sketches/<ref>/final.png` composites
 * the finished page (I5) and the page is publishable via the comic cook.
 */
export async function bindImageRenderHandler(input) {
  const { ref, target, image_path: imagePath, image_base64: imageBase64 } = input || {};
  if (!ref || typeof ref !== 'string') throw new Error('bind_image_render requires { ref }');
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`Sketch '${ref}' not found`);
  const kind = sketch.manifest?.kind;
  if (kind !== KIND_IMAGE_OUTCOME && kind !== KIND_SEQUENTIAL_ART) {
    throw new Error(
      kind === KIND_CHARACTER_SHEET
        ? `Sketch '${ref}' is a character-sheet — submit its render via bind_character_sheet`
        : `Sketch '${ref}' is kind '${kind}' — page/panel renders bind to image-outcome / sequential-art sketches`,
    );
  }
  const manifest = normalizeImageOutcomesManifest(sketch.manifest);
  const targets = renderTargets(manifest);
  const resolvedTarget = target ?? (targets.length === 1 ? targets[0] : null);
  if (!resolvedTarget || !targets.includes(resolvedTarget)) {
    throw new Error(
      `bind_image_render requires a valid target for '${ref}' (targets: ${targets.join(', ')})`,
    );
  }
  if ((imagePath ? 1 : 0) + (imageBase64 ? 1 : 0) !== 1) {
    throw new Error('bind_image_render requires exactly one of image_path | image_base64');
  }
  const bytes = imagePath ? await fs.readFile(imagePath) : Buffer.from(imageBase64, 'base64');
  if (bytes.length < 8 || !bytes.subarray(0, 4).equals(PNG_MAGIC)) {
    throw new Error('the submitted image is not a PNG (submit the generated raster, not the SVG scaffold)');
  }
  const slot = nextRenderPath(sketch.ref, resolvedTarget);
  await fs.writeFile(slot.path, bytes);
  const bound = boundRenderMap(sketch.ref, targets);
  const remaining = targets.filter((t) => !bound[t]);
  return {
    ok: true,
    ref: sketch.ref,
    target: resolvedTarget,
    n: slot.n,
    path: slot.path,
    bytes: bytes.length,
    remaining_targets: remaining,
    ...(remaining.length === 0
      ? { final_url: `/api/sketches/${encodeURIComponent(sketch.ref)}/final.png` }
      : {}),
  };
}
