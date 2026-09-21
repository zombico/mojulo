/**
 * Split out of tools/sketches.js — see
 * lite-template/integration/_0828/mojulo-2.0-pure-creative.plan.md (Phase 1c).
 * sketches.js hosted six unrelated tool families in one 2038-line file; each
 * now owns its own module and sketches.js is the registration surface.
 */
// The POLYGONIZER + SKIN handoff: prompt-to-manifest (keyed and key-free
// halves) plus the reskin loop.


import path from 'node:path';
import { promises as fs } from 'node:fs';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { loadSharp } from '@/lib/sharp-lazy';
import { renderStoredSketchSvg } from '@/lib/graph/sketch/stored-sketch-svg';
import { reskinManjiSvg, rasterSampler, analyzeSkin } from '@/lib/graph/polygonizer/skin-projection';
import { nextSkinPath, skinInputPath, latestSkin, nextAtlasPath, latestAtlas } from '@/lib/graph/polygonizer/skin-store';
import {
  atlasLayout, auditAtlasCoverage, auditSeamContinuity, holeInpaintViews, paintAtlas,
  projectorFromCamera, skinAtlasViewPlan,
} from '@/lib/graph/polygonizer/skin-atlas';
import { figureRigSamples, animalWorldFaces } from '@/lib/graph/polygonizer/figure-render';
import { encodePng } from '@/lib/graph/landscape/surface-textures';
import {
  classifyPromptForCards,
  polygonizePrompt,
  resolvePolygonizerModelConfig,
  withConstellationGrid,
  lowerRecipeManifest,
  recipeFamilyAllowlist,
  buildPolygonizerSystemPrompt,
  buildPolygonizerUserPrompt,
  buildPolygonizerPlanningSystemPrompt,
  buildPolygonizerSkinSystemPrompt,
  buildSkinTurnUserPrompt,
  POLYGONIZER_SCHEMA,
  POLYGONIZER_PLANNING_SCHEMA,
  finalizeAgentManifest,
  finalizePlanningManifest,
} from '@/lib/graph/polygonizer/index.js';

import { mintSketch, resolvePreloads, PRELOAD_MAX_ITEMS } from './sketch-mint.js';
import { PNG_MAGIC } from './sketch-image-render.js';

export async function createPolygonizedSketchHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_polygonized_sketch requires { prompt }');
  }
  const {
    prompt,
    provider,
    model,
    apiKey,
    apiKeyId,
    repair = 'auto',
    ref,
    title,
    mint = true,
    mode = 'one-trip',
    preload,
    preloadMetadata,
  } = input;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('`prompt` is required');
  }
  if (repair !== 'off' && repair !== 'auto') {
    throw new Error('`repair` must be "off" or "auto"');
  }
  if (mode !== 'one-trip' && mode !== 'plan-then-skin') {
    throw new Error('`mode` must be "one-trip" or "plan-then-skin"');
  }
  const priors = resolvePreloads(preload);
  const config = await resolvePolygonizerModelConfig({ provider, apiKey, apiKeyId, model });

  // Pre-pass: pick the render-primitive / recipe cards the prompt is likely
  // to need so the manifest system prompt only ships the relevant grammar.
  // Defaults to a local-embedding similarity lookup (one CPU call, no
  // network — see polygonizer/card-router.js); the previous Haiku-class
  // LLM round-trip is now reachable only by explicit override. Cached by
  // prompt hash. On router failure the helper falls back to 'all' cards —
  // the same safety net repair uses — so the manifest call still has full
  // grammar.
  const classification = await classifyPromptForCards({ prompt });

  const result = await polygonizePrompt({
    prompt,
    provider: config.provider,
    apiKey: config.apiKey,
    model: config.model,
    maxRepairs: repair === 'auto' ? 1 : 0,
    cards: classification.cards,
    mode,
    preloadManifests: priors,
  });

  // Mirror create_sketch's echo policy: single-string input → object echo
  // with top-level metadata; array input → array echo with per-item `as` +
  // `note`. The polygonizer already received the manifest, so we don't
  // re-include it in the echo (just the handles the agent passed in).
  let preloadEcho = null;
  if (priors) {
    if (!Array.isArray(preload)) {
      const [only] = priors;
      preloadEcho = { ref: only.ref, title: only.title, metadata: preloadMetadata ?? null };
    } else {
      preloadEcho = priors.map((p) => ({ ref: p.ref, title: p.title, as: p.as, note: p.note }));
    }
  }

  if (!result.ok) {
    const errorResponse = {
      ok: false,
      attempts: result.attempts,
      mode,
      provider: config.provider,
      model: config.model,
      classification,
      errors: result.errors,
      repairPrompt: result.repairPrompt,
      manifest: result.manifest,
    };
    if (result.phase !== undefined) errorResponse.phase = result.phase;
    if (Array.isArray(result.turns)) errorResponse.turns = result.turns;
    if (result.authorshipPreview) errorResponse.authorshipPreview = result.authorshipPreview;
    if (result.scaffold) errorResponse.scaffold = result.scaffold;
    if (preloadEcho) errorResponse.preload = preloadEcho;
    return errorResponse;
  }

  const response = {
    ok: true,
    attempts: result.attempts,
    mode,
    provider: config.provider,
    model: config.model,
    classification,
    manifest: result.manifest,
    expandedManifest: result.expandedManifest,
  };
  if (Array.isArray(result.turns)) response.turns = result.turns;
  if (result.authorshipPreview) response.authorshipPreview = result.authorshipPreview;
  if (result.scaffold) response.scaffold = result.scaffold;
  if (preloadEcho) response.preload = preloadEcho;
  if (mint) {
    response.sketch = mintSketch({
      title: title || result.manifest?.title || prompt,
      manifest: result.manifest,
      ref,
    });
  }
  return response;
}

/**
 * get_polygonizer_packet / submit_polygonizer_manifest — the KEY-FREE twin of
 * create_polygonized_sketch. The calling agent (Claude Code / Codex) is
 * itself the generative model: the packet hands it the same system/user
 * prompts + schema the keyed path would send a provider, and the submit runs
 * the model-independent finalize (validate → deterministic repairs → lower →
 * mint). The server-side maxRepairs loop becomes conversational — a failed
 * submit returns `repairPrompt` for the agent to apply and resubmit.
 * Stateless between calls: plan-then-skin passes the planning manifest back
 * into submit, and the scaffold is recomputed server-side (never trusted
 * from the agent). The polygonizer analogue of get_skin_packet.
 */
export async function getPolygonizerPacketHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('get_polygonizer_packet requires { prompt }');
  }
  const { prompt, mode = 'one-trip', preload } = input;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('`prompt` is required');
  }
  if (mode !== 'one-trip' && mode !== 'plan-then-skin') {
    throw new Error('`mode` must be "one-trip" or "plan-then-skin"');
  }
  const priors = resolvePreloads(preload);
  let preloadEcho = null;
  if (priors) {
    if (!Array.isArray(preload)) {
      const [only] = priors;
      preloadEcho = { ref: only.ref, title: only.title };
    } else {
      preloadEcho = priors.map((p) => ({ ref: p.ref, title: p.title, as: p.as, note: p.note }));
    }
  }
  const classification = await classifyPromptForCards({ prompt });
  const userPrompt = buildPolygonizerUserPrompt(prompt, { preloadManifests: priors });

  if (mode === 'one-trip') {
    return {
      ok: true,
      mode,
      classification,
      brief:
        'YOU are the polygonizer model — no provider call happens. Adopt `instructions` as your working discipline and answer `userPrompt` with ONE JSON object matching `schema`. JSON only (a fenced ```json block is accepted).',
      instructions: buildPolygonizerSystemPrompt({ cards: classification.cards }),
      userPrompt,
      schema: POLYGONIZER_SCHEMA,
      submit:
        'submit_polygonizer_manifest({ prompt: <the SAME prompt string>, manifest, mode: "one-trip", title?, ref? }) — mojulo validates, applies deterministic repairs, lowers, and mints. On { ok: false } fix your manifest per `repairPrompt` and resubmit.',
      ...(preloadEcho ? { preload: preloadEcho } : {}),
    };
  }

  return {
    ok: true,
    mode,
    phase: 'planning',
    classification,
    brief:
      'YOU are the polygonizer model — turn 1 is PLANNING ONLY: no `marks` field. Adopt `instructions` as your working discipline and answer `userPrompt` with ONE JSON object matching `schema`. JSON only (a fenced ```json block is accepted).',
    instructions: buildPolygonizerPlanningSystemPrompt(),
    userPrompt,
    schema: POLYGONIZER_PLANNING_SCHEMA,
    submit:
      'submit_polygonizer_manifest({ prompt: <the SAME prompt string>, manifest, mode: "plan-then-skin", phase: "planning" }) — mojulo solves + gates the scaffold and returns `skinPacket` for your second (marks) turn.',
    ...(preloadEcho ? { preload: preloadEcho } : {}),
  };
}

export async function submitPolygonizerManifestHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('submit_polygonizer_manifest requires { prompt, manifest }');
  }
  const { prompt, manifest, mode = 'one-trip', phase, ref, title, mint = true } = input;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('`prompt` is required (the SAME prompt the packet was pulled for)');
  }
  if (manifest === undefined || manifest === null) {
    throw new Error('`manifest` is required (object, or raw/fenced JSON string)');
  }
  if (mode !== 'one-trip' && mode !== 'plan-then-skin') {
    throw new Error('`mode` must be "one-trip" or "plan-then-skin"');
  }
  if (mode === 'one-trip' && phase !== undefined) {
    throw new Error('`phase` applies to plan-then-skin only');
  }
  if (mode === 'plan-then-skin' && phase !== 'planning' && phase !== 'skin') {
    throw new Error('plan-then-skin submits require `phase`: "planning" or "skin"');
  }

  if (phase === 'planning') {
    const result = finalizePlanningManifest({ prompt, manifest });
    if (!result.ok) {
      return {
        ok: false,
        mode,
        phase,
        errors: result.errors,
        authorshipPreview: result.authorshipPreview,
        repairPrompt: result.repairPrompt,
        manifest: result.manifest,
        patchesApplied: result.patchesApplied,
        next: 'Fix the planning manifest (no marks) per `repairPrompt` and resubmit with phase: "planning".',
      };
    }
    // Same card set the keyed orchestrator would give the skin turn — cache
    // hit when the packet was pulled in this process; falls back to 'all'.
    const classification = await classifyPromptForCards({ prompt });
    return {
      ok: true,
      mode,
      phase,
      scaffold: result.scaffold,
      authorshipPreview: result.authorshipPreview,
      patchesApplied: result.patchesApplied,
      skinPacket: {
        brief:
          'Turn 2 — author `marks` against the solved scaffold. Adopt `instructions`, answer `userPrompt` with ONE JSON object matching `schema`. Do not redo planning.',
        instructions: buildPolygonizerSkinSystemPrompt({ cards: classification.cards }),
        userPrompt: buildSkinTurnUserPrompt(buildPolygonizerUserPrompt(prompt), result.scaffold),
        schema: POLYGONIZER_SCHEMA,
        submit:
          'submit_polygonizer_manifest({ prompt: <the SAME prompt string>, manifest, mode: "plan-then-skin", phase: "skin", title?, ref? })',
      },
    };
  }

  const result = finalizeAgentManifest({ prompt, manifest });
  if (!result.ok) {
    return {
      ok: false,
      mode,
      ...(phase ? { phase } : {}),
      errors: result.errors,
      repairPrompt: result.repairPrompt,
      manifest: result.manifest,
      patchesApplied: result.patchesApplied,
      next: 'Fix the manifest per `repairPrompt` and re-call submit_polygonizer_manifest with the SAME prompt.',
    };
  }
  const response = {
    ok: true,
    mode,
    ...(phase ? { phase } : {}),
    manifest: result.manifest,
    expandedManifest: result.expandedManifest,
    patchesApplied: result.patchesApplied,
  };
  if (mint) {
    response.sketch = mintSketch({
      title: title || result.manifest?.title || prompt,
      manifest: result.manifest,
      ref,
    });
  }
  return response;
}


/**
 * get_skin_packet — the conversational skin handoff for a skinnable polygomer.
 * Carries the render-worker discipline as DATA (which scaffold to paint over,
 * the paint brief, how to submit, what comes next) so the driving agent needs
 * no memorized procedure — pull, paint what it asks, submit. The polygomer
 * analogue of get_image_render_packet.
 */
// Kinds whose control scaffold + skin projection ride the shared polygon
// contract (renderStoredSketchSvg control mode → reskinManjiSvg / world bake).
const SKINNABLE_KINDS = new Set(['manji-tree', 'figure', 'workbench', 'assembler']);
export async function getSkinPacketHandler(input) {
  const { ref } = input || {};
  if (!ref || typeof ref !== 'string') throw new Error('get_skin_packet requires { ref }');
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`Sketch '${ref}' not found`);
  if (!SKINNABLE_KINDS.has(sketch.manifest?.kind)) {
    throw new Error(
      `Sketch '${ref}' is kind '${sketch.manifest?.kind}' — get_skin_packet skins manji-tree polygomers (sketch_polygomer / create_manji_tree), workbench/assembler polygomers (create_workbench / create_assembler), or figures (create_figure)`,
    );
  }
  const encoded = encodeURIComponent(sketch.ref);
  const title = sketch.title || sketch.manifest.title || 'this polygomer';
  const bound = latestSkin(sketch.ref);
  return {
    ref: sketch.ref,
    kind: sketch.manifest.kind,
    title,
    scaffold: {
      url: `/api/sketches/${encoded}/png?control=1&inline=1&scale=2`,
      note: 'The FILLED lit-solid silhouette — paint your finished creature directly OVER this, matching its silhouette, proportions, and part layout. NOT the wireframe /svg (a wireframe fragments a diffusion skin into many objects).',
    },
    brief: `Paint a finished "${title}" over the scaffold: ONE coherent subject that keeps the scaffold's silhouette and massing. No wireframe / ring / dot / diagram language, no text.`,
    submit: `skin_polygomer({ ref: "${sketch.ref}", image_path })  — hand back the painted PNG; it projects onto the model's faces.`,
    then: sketch.manifest.kind === 'figure'
      ? `/api/sketches/${encoded}/skin.png — the figure wearing the skin deterministically (albedo × its own form shading). export_model({ ref }) exports the figure's 3D form (recipe colours; \`clips\` animates its motion) — baking the painted skin into that GLB is a follow-up.`
      : `export_model({ ref: "${sketch.ref}" }) → /api/sketches/${encoded}/model.glb (portable turnable GLB, skin baked into the vertex colours). Live turntable: /api/sketches/${encoded}/world`,
    ...(bound ? { alreadySkinned: { n: bound.n, url: `/api/sketches/${encoded}/skin.png` } } : {}),
  };
}

/**
 * skin_polygomer — the polygomer WEARS a diffusion skin (skin-projection.js).
 * A `manji-tree` polygomer is built, its filled control scaffold
 * (`?control=1`) is painted over by the render worker, and the painted PNG is
 * handed back here. Because the skin was painted over the scaffold from a fixed
 * camera, it is already registered to the render in screen space: every filled
 * face samples the skin at its screen centroid → a DETERMINISTIC render that
 * wears the skin's colours, snapshotted append-only into the outcome folder.
 * The manji-tree recipe stays sovereign; the skin is a bound render.
 */
export async function skinPolygomerHandler(input) {
  const { ref, image_path: imagePath, image_base64: imageBase64 } = input || {};
  if (!ref || typeof ref !== 'string') throw new Error('skin_polygomer requires { ref }');
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`Sketch '${ref}' not found`);
  if (input.mode === 'atlas') return skinAtlasModeHandler(input, sketch);
  if (!SKINNABLE_KINDS.has(sketch.manifest?.kind)) {
    throw new Error(
      `Sketch '${ref}' is kind '${sketch.manifest?.kind}' — skin_polygomer wears a skin on a manji-tree/workbench/assembler polygomer or a figure`,
    );
  }
  if ((imagePath ? 1 : 0) + (imageBase64 ? 1 : 0) !== 1) {
    throw new Error('skin_polygomer requires exactly one of image_path | image_base64');
  }
  const skinBytes = imagePath ? await fs.readFile(imagePath) : Buffer.from(imageBase64, 'base64');
  if (skinBytes.length < 8 || !skinBytes.subarray(0, 4).equals(PNG_MAGIC)) {
    throw new Error('the skin must be a PNG (the painted render over the ?control=1 scaffold, not the SVG)');
  }
  // The filled control scaffold the skin was painted over — the shared camera IS
  // the registration, so no UV unwrap is needed. The stored-sketch dispatcher
  // renders each kind's own control scaffold (manji-svg, figure-render, or the
  // workbench/assembler faces-scaffold) through the same polygon contract.
  const controlSvg = await renderStoredSketchSvg(sketch, { control: true });
  const sharp = await loadSharp();
  const { data, info } = await sharp(skinBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const raster = { data, width: info.width, height: info.height, channels: info.channels };
  // Background clamp: faces whose centroid misses the creature take the mean
  // skin colour instead of a stray background pixel (kills pale-edge dots).
  const { background, fallback } = analyzeSkin(raster);
  const sampler = rasterSampler({ ...raster, background, fallback });
  const { svg, faces } = reskinManjiSvg(controlSvg, sampler);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const slot = nextSkinPath(sketch.ref);
  await fs.writeFile(slot.path, png);
  // Keep the INPUT painted skin too, so the turnable /world + .glb model can
  // bake the same skin onto its 3D faces (export_model / the manji-tree world kind).
  await fs.writeFile(skinInputPath(sketch.ref, slot.n), skinBytes);
  return {
    ok: true,
    ref: sketch.ref,
    n: slot.n,
    faces,
    url: `/api/sketches/${encodeURIComponent(sketch.ref)}/skin.png`,
    path: slot.path,
    bytes: png.length,
  };
}


/**
 * skin_polygomer `mode: 'atlas'` — the UV-space sibling of the screen-space
 * projection above (skin-over-mesh.plan.md phase 2b). The wrap loop's tool
 * seam, three calls of one tool:
 *
 *   1. PLAN   — `{ ref, mode:'atlas' }` (no views): returns the deterministic
 *      view plan (fixed deck over the body's own bbox) + how to paint each
 *      view (the image worker's job — request_image_render with the world
 *      render as the img2img base — or any painter, the loop doesn't care).
 *   2. PAINT  — `{ ref, mode:'atlas', views:[{ image_path|image_base64,
 *      camera:{pos,target,vfov} }] }`: reprojects the paintings into the
 *      atlas (facing + depth registration), runs the coverage gate, writes
 *      the append-only `atlas-<n>.png`, stamps `manifest.skin.atlas` so the
 *      figure WEARS it at resolve (figure-world), and returns the audit —
 *      holes come back as ready-made close-up inpaint cameras for round 2.
 *   3. LOOP   — repeat 2 with the inpaint views until the audit runs dry.
 *
 * Scope: kinds 'figure' and 'animal' (the ring-stack bodies phase 1 tags with
 * islands). The recipe stays sovereign; the atlas page is a numbered bound render.
 */
const ATLAS_KEY = 'skin-atlas';

function bodyAtlasFaces(manifest) {
  // atlas mode needs uv+island tags; a body with no phase-1 skin opt-in gets
  // the default key synthesized — the atlas IS the skin.
  const skinSpec = manifest.skin && typeof manifest.skin.texture === 'string'
    ? manifest.skin : { ...(manifest.skin || {}), texture: ATLAS_KEY };
  const skinned = { ...manifest, skin: skinSpec };
  return manifest.kind === 'animal'
    ? animalWorldFaces(skinned).faces
    : figureRigSamples(skinned).restFaces;
}

async function skinAtlasModeHandler(input, sketch) {
  const manifest = sketch.manifest || {};
  if (manifest.kind !== 'figure' && manifest.kind !== 'animal') {
    throw new Error(
      `skin_polygomer mode:'atlas' covers kinds 'figure' and 'animal' today (ring-stack islands) — '${manifest.kind}' still uses the screen-space projection mode (omit \`mode\`)`,
    );
  }
  const page = Number.isInteger(input.page) ? input.page : 1024;
  const gutter = Number.isInteger(input.gutter) ? input.gutter : 8;
  const faces = bodyAtlasFaces(manifest);
  const layout = atlasLayout(faces, { page, gutter });

  if (!Array.isArray(input.views) || !input.views.length) {
    const plan = skinAtlasViewPlan(faces);
    const bound = latestAtlas(sketch.ref);
    return {
      ref: sketch.ref,
      mode: 'atlas',
      islands: Object.keys(layout.islands).length,
      page,
      gutter,
      viewPlan: plan.views,
      paint: 'Paint each view as ONE coherent subject over a render of this figure from that exact camera '
        + '(request_image_render img2img over the world render, or any painter). Keep the camera parameters '
        + 'verbatim — they ARE the registration.',
      submit: `skin_polygomer({ ref: "${sketch.ref}", mode: "atlas", views: [{ image_path, camera: { pos, target, vfov } }, …] })`,
      ...(bound ? { alreadyBound: { n: bound.n, path: bound.path } } : {}),
    };
  }

  // PAINT: decode each view, reproject, audit, bind.
  const sharp = await loadSharp();
  const views = [];
  for (const v of input.views) {
    const cam = v && v.camera;
    if (!cam || !Array.isArray(cam.pos) || !Array.isArray(cam.target)) {
      throw new Error('each atlas view needs { image_path|image_base64, camera: { pos:[x,y,z], target:[x,y,z], vfov } } — the camera the painting was made from');
    }
    if ((v.image_path ? 1 : 0) + (v.image_base64 ? 1 : 0) !== 1) {
      throw new Error('each atlas view needs exactly one of image_path | image_base64');
    }
    const bytes = v.image_path ? await fs.readFile(v.image_path) : Buffer.from(v.image_base64, 'base64');
    if (bytes.length < 8 || !bytes.subarray(0, 4).equals(PNG_MAGIC)) {
      throw new Error(`atlas view '${v.label || cam.pos}' must be a PNG`);
    }
    const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    views.push({
      projector: projectorFromCamera({
        pos: cam.pos, target: cam.target, vfov: Number.isFinite(cam.vfov) ? cam.vfov : 40,
        width: info.width, height: info.height,
      }),
      raster: { data, width: info.width, height: info.height, channels: info.channels },
    });
  }
  const painted = paintAtlas(faces, layout, views, { size: page });
  const audit = auditAtlasCoverage(faces, layout, painted);
  const seams = auditSeamContinuity(faces, layout, painted);
  const slot = nextAtlasPath(sketch.ref);
  await fs.writeFile(slot.path, encodePng(painted.rgb, page, page));
  // Bind: the manifest carries the slot; figure-world remaps + loads it at
  // resolve. Advisory gate — the operator ships or reloops, never blocked.
  SketchRepository.update({
    ref: sketch.ref,
    manifest: { ...manifest, skin: { ...(manifest.skin || {}), atlas: { n: slot.n, page, gutter } } },
  });
  return {
    ok: true,
    ref: sketch.ref,
    mode: 'atlas',
    n: slot.n,
    path: slot.path,
    coverage: Number(audit.coverage.toFixed(4)),
    holes: audit.holes,
    // advisory seam report (never a refusal — intentional transitions flag too)
    seam_continuity: { overall: seams.overall, threshold: seams.threshold, flagged: seams.flagged },
    // loop-until-dry: ready-made close-up cameras aimed at each hole island
    ...(audit.holes.length ? {
      inpaintViews: holeInpaintViews(faces, audit.holes),
      next: 'Paint these close-up views and submit them the same way — each new atlas slot repaints from ALL views you pass, so include the originals or accept the close-ups as touch-ups over the bound page.',
    } : {}),
    world: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
  };
}

// Shared by create_polygonized_sketch and get_polygonizer_packet — the two
// entry halves of the keyed and key-free polygonizer paths take identical
// preload input.
export const POLYGONIZER_PRELOAD_SCHEMA = {
  oneOf: [
    { type: 'string' },
    {
      type: 'array',
      maxItems: PRELOAD_MAX_ITEMS,
      items: {
        oneOf: [
          { type: 'string' },
          {
            type: 'object',
            properties: {
              ref: { type: 'string', description: 'Prior sketch ref (`sk_…`).' },
              as: {
                type: 'string',
                description:
                  "Free-form role label for this prior — e.g. 'character', 'setting', 'palette', 'composition'. Becomes the section heading in the prior-context prefix the polygonizer model sees, so it knows which prior plays which role in the new scene.",
              },
              note: {
                type: 'string',
                description:
                  'Optional per-prior note (e.g. "the fox\'s pose"). Surfaced to the model alongside the prior manifest and round-tripped in the response.',
              },
            },
            required: ['ref'],
          },
        ],
      },
    },
  ],
  description:
    "Optional prior sketch ref (`sk_…`) — or an array of refs / labeled-ref objects — to seed the polygonizer turn with as advisory context. The single-string form prefixes the resolved prior manifest under a 'Prior scene' header. The array-of-labeled-objects form prefixes each prior under its own 'Prior {as}' header (one labeled section per item), so the model can compose a new page from, e.g., a recurring character + a recurring setting carried from earlier sketches. Advisory only — no enforcement, no role-pinning, no validation that prior elements survive the new turn; the model may extend, modify, or ignore any prior. In plan-then-skin mode the preload is fed to the planning turn only; the skin turn sees the solved scaffold instead. Errors if any ref doesn't resolve. Capped at " +
    PRELOAD_MAX_ITEMS +
    ' priors per call.',
};
