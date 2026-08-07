/**
 * Visual Reference — `reference_protocol` + `capture_reference`.
 *
 * A vision-capable harness reads a photo it ALREADY sees and turns it into a
 * mojulo-native scaffold: it pulls the extraction protocol (reference_protocol)
 * for a target, decomposes what it sees into that target's dials, and files the
 * result as a "reference + insights" artifact in a stash (capture_reference).
 *
 * No vision key, no vision API call, no pixels-for-understanding over the wire —
 * the harness IS the vision adapter. The substrate hands the model HOW to look
 * and SINKS what it extracts into a durable, re-usable anchor.
 *
 * Extraction-target-polymorphic. Two targets ship in v0:
 *   - scene → a two-point camera/roomBasis → a perspective-frame cage (sketch)
 *   - pose  → figure pose dials            → a posed figure dummy (kind:'figure')
 *
 * The artifact is a conventionally-shaped stash (zero migration): a `sketch`
 * item carries metadata.{sketch_ref, label, insights}. Consumers (sketch via
 * preload, motion via a camera-shot over the cage / pose keyframes, cook via a
 * stash slice) read metadata.insights. Bind it to a build with the existing
 * bind_stash({ role:'reference' }).
 *
 * See lite-template/integration/0612/visual-reference.plan.md.
 */

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { StashRepository } from '@/lib/db/repositories/stashes';
import { renderFigureToSvg } from '@/lib/graph/polygonizer/figure-render';
import {
  REFERENCE_TARGETS,
  DEFAULT_FIDELITY,
  getReferenceProtocol,
  lowerSceneCage,
  lowerPoseCage,
  lowerLandscapeCage,
  resolvePoseDials,
  summarizeReference,
} from '@/lib/reference';

// ---------------------------------------------------------------------------
// handlers
// ---------------------------------------------------------------------------

export async function referenceProtocolHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('reference_protocol requires { target }');
  }
  const { target } = input;
  if (!target || typeof target !== 'string') {
    throw new Error(`target is required (one of: ${REFERENCE_TARGETS.join(', ')})`);
  }
  const protocol = getReferenceProtocol(target);
  return {
    ok: true,
    ...protocol,
    next: `Having read the image, fill the dials above and call: ${protocol.capture_call}`,
  };
}

export async function captureReferenceHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('capture_reference requires { target, insights }');
  }
  const { target, insights, fidelity, label, title, stash_ref } = input;
  if (!target || !REFERENCE_TARGETS.includes(target)) {
    throw new Error(`target must be one of ${REFERENCE_TARGETS.join(' | ')} (got '${target}')`);
  }
  if (!insights || typeof insights !== 'object' || Array.isArray(insights)) {
    throw new Error('`insights` is required (the structured read the harness extracted from the image)');
  }
  const fid = fidelity || DEFAULT_FIDELITY[target];
  const labelText = label || title || `${target} reference`;

  // 1. Resolve the stash — mint a new reference stash, or refine an existing one
  //    (a later photo pass). passes = how many cage items of this target already
  //    live in the stash, +1.
  let stash;
  let passes = 1;
  if (stash_ref) {
    stash = StashRepository.getByRef(stash_ref);
    if (!stash) throw new Error(`Stash '${stash_ref}' not found.`);
    const full = StashRepository.getFull(stash.stashRef);
    const priorPasses = (full?.items || []).filter(
      (it) => it.type === 'sketch' && it.metadata?.reference_target === target,
    ).length;
    passes = priorPasses + 1;
  } else {
    stash = StashRepository.mint({ title: title || labelText });
  }

  // 2. Lower insights → cage manifest. For POSE, SOLVE the dials from the traced
  //    X-manji (direction B): the model places a stick-skeleton, the substrate
  //    fits the joint dials against the locked armature. `effInsights` stores the
  //    solved dials beside the trace so consumers (create_figure) read them.
  const cageTitle = `${labelText} — ${target} (pass ${passes})`;
  let manifest;
  let effInsights = insights;
  let solveInfo = null;
  if (target === 'pose') {
    const resolved = resolvePoseDials(insights); // throws on missing xmanji/dials
    solveInfo = resolved.solve;
    effInsights = { ...insights, dials: resolved.dials };
    manifest = lowerPoseCage(effInsights, cageTitle);
    try {
      renderFigureToSvg(manifest);
    } catch (err) {
      throw new Error(`pose cage render failed (check the X-manji / dials): ${err.message}`);
    }
  } else if (target === 'landscape') {
    manifest = lowerLandscapeCage(insights, cageTitle); // validates against the closed vocab
  } else {
    manifest = lowerSceneCage(insights, cageTitle); // validates internally
  }

  // 3. Mint the cage sketch (renders/preloads/re-cameras like any sketch).
  const cage = SketchRepository.create({ title: cageTitle, manifest, folderRef: null });

  // 4. Gather the cage as a `sketch` stash item carrying the insights. The
  //    sketch-item contract requires metadata.{sketch_ref, label}; insights +
  //    target/fidelity ride alongside as freeform metadata.
  const item = StashRepository.gather({
    stashRef: stash.stashRef,
    type: 'sketch',
    title: labelText,
    bodyMd: summarizeReference(target, effInsights, fid, passes),
    metadata: {
      sketch_ref: cage.ref,
      label: labelText,
      reference_target: target,
      fidelity: fid,
      passes,
      ...(solveInfo ? { solve: solveInfo } : {}),
      insights: effInsights,
    },
  });

  const frozen = solveInfo?.frozen || [];
  // Built form (bridges / city massing / farmland) renders in the WORLD/3D view,
  // not the flat SVG; surface a world_url and steer the next-step toward it.
  const hasBuiltForm =
    target === 'landscape' &&
    !!(effInsights.bridges || effInsights.city || effInsights.farmland || effInsights.elevation);
  return {
    ok: true,
    stash_ref: stash.stashRef,
    item_id: item.id,
    cage_ref: cage.ref,
    cage_url: `/sketches/${encodeURIComponent(cage.ref)}`,
    svg_url: `/api/sketches/${encodeURIComponent(cage.ref)}/svg?inline=1`,
    ...(target === 'landscape' ? { world_url: `/api/sketches/${encodeURIComponent(cage.ref)}/world` } : {}),
    target,
    fidelity: fid,
    passes,
    ...(solveInfo ? { solve: solveInfo } : {}),
    next:
      target === 'pose'
        ? `Solved the dials from your X-manji (fit error ${solveInfo?.error != null ? solveInfo.error.toFixed(3) : 'n/a'}${frozen.length ? `; depth-frozen: ${frozen.join(', ')}` : ''}). Open cage_url to SEE the figure. ${frozen.length ? `Those frozen DOFs are unobservable at this view — if the pose needs them, trace a SIDE X-manji and call again with stash_ref:'${stash.stashRef}'. ` : ''}Build from it: create_figure({ pose: insights.dials }) (the solved dials are stored), or forge_motion a pose keyframe over the figure cage.`
        : target === 'landscape'
          ? `Built your landscape map into a real render — open cage_url to SEE it and compare against the photo (the gesture is right when the silhouette + depth + mood match, even though no pixel does). ${hasBuiltForm ? `Your map has BUILT FORM (bridges / city / bay) — those render in the WORLD/3D view: open world_url (${`/api/sketches/${encodeURIComponent(cage.ref)}/world`}), the flat SVG cage won't show them. Note: create_painted_landscape can't author bridges/city/elevation, so re-mint from these stored insights, not the tool. ` : `The recipe is stored in insights; replay or tune it with create_painted_landscape({ heartbeat:'${effInsights.heartbeat}', splatch:'${effInsights.splatch}'${effInsights.scene ? `, scene:'${effInsights.scene}'` : ''}, ... }). `}Refine with a DETAIL CROP via capture_reference again with stash_ref:'${stash.stashRef}' to adjust element density / palette / built form. Bind to a build: bind_stash({ stash_ref, role:'reference' }).`
          : passes === 1
            ? `Open cage_url to SEE the extracted scene frame. To GROUND it, capture_reference again with stash_ref:'${stash.stashRef}' and a second view. Build from it: preload the cage_ref for visual context and read insights.camera + insights.roomBasis to author a create_manji_tree scene in that frame. Bind to a build: bind_stash({ stash_ref, role:'reference' }).`
            : `Pass ${passes} refined the reference (now triangulated across views). Latest cage: ${cage.ref}.`,
  };
}

// ---------------------------------------------------------------------------
// registration
// ---------------------------------------------------------------------------

export function registerVisualReferenceTools() {
  registerTool({
    name: 'reference_protocol',
    description:
      "Visual Reference (step 1) — get the EXTRACTION PROTOCOL for turning a photo YOU can see into a mojulo scaffold. You (the harness) are the vision adapter: there is no vision key and no image is sent to mojulo for understanding — you read the image, then map what you see onto the target's dials. Returns the key lines to read, the dial schema to write into (landscape also ships the glyph CATALOGUES to pick from), the fidelity contract (thematic/gesture default vs faithful), the expressive ceiling (what this target CANNOT represent), the multi-pass hint (which second view resolves which single-photo ambiguity), and the exact capture_reference call to make next.\n\nTargets:\n  • scene — a room/building/scene photo → recover PERSPECTIVE (horizon, vanishing points, floor convergence, relative scale) into a two-point camera the substrate builds inside.\n  • pose  — a human photo → TRACE the figure's X-manji (its stick-skeleton key lines) as 2D points; the substrate SOLVES the pose dials from your trace against the locked armature (you place a skeleton, you don't guess joint angles).\n  • landscape — a landscape/terrain photo → read its GESTURE (dominant landform rhythm), depth, palette, and elements, and pick the closed-vocabulary painted-landscape RECIPE (the \"mandala map\") that recreates it; the substrate RENDERS your map, so the cage is a candidate recreation, not just a diagram.\n\nReach for this on framing like \"use this photo/image as a reference, match this pose/gesture, rebuild this room's perspective, recreate this landscape/scenery, copy the composition/camera, base it on this picture\". Then call capture_reference. (Contrast: \"draw me X\" → create_sketch; \"make X move\" → forge_motion.)",
    inputSchema: {
      type: 'object',
      required: ['target'],
      properties: {
        target: {
          type: 'string',
          enum: REFERENCE_TARGETS,
          description: "'scene' (perspective from a room/building photo) | 'pose' (gesture from a human photo) | 'landscape' (painted-landscape recipe from a terrain/scenery photo).",
        },
      },
    },
    handler: referenceProtocolHandler,
  });

  registerTool({
    name: 'capture_reference',
    description:
      "Visual Reference (step 2) — FILE a reference you extracted from a photo into a stash. Call reference_protocol(target) first; then, having read the image, pass the structured `insights` you decomposed it into. For pose, pass a traced X-manji (insights.xmanji.landmarks) and the substrate SOLVES the dials. For landscape, pass the glyph map (heartbeat + splatch + optional scene/structures/sky/camera/…) and the substrate RENDERS it. Mints a CAGE sketch you can see/preload/re-camera (scene → a perspective-frame diagram; pose → the solved figure dummy; landscape → the recreated painted landscape) and gathers it as a `sketch` stash item carrying metadata.insights. Returns { stash_ref, cage_ref, cage_url, svg_url, item_id, passes }.\n\nMulti-pass: a single photo is degenerate (scene depth/scale relative; pose depth/roll ambiguous; landscape elements quantized coarsely). Pass `stash_ref` to REFINE the same reference with a second viewpoint or detail crop — the pass grounds what one view couldn't. We never expect one photo to drive creation; one-shot is the normalized anchor, multi-pass grounds it.\n\nConsume it: scene → preload cage_ref in create_sketch/create_manji_tree or forge_motion a turntable over it; pose → create_figure({ pose: insights.dials }) or a forge_motion pose keyframe; landscape → create_painted_landscape({ ...insights }) to replay/tune the recipe, or forge_motion a fly-over the terrain; any → cook the stash into a reference sheet. Anchor a build with bind_stash({ stash_ref, role:'reference' }).",
    inputSchema: {
      type: 'object',
      required: ['target', 'insights'],
      properties: {
        target: { type: 'string', enum: REFERENCE_TARGETS, description: "'scene' | 'pose' | 'landscape' — must match the protocol you read." },
        insights: {
          type: 'object',
          description:
            "The structured read you extracted from the image (the shape comes from reference_protocol). scene → { camera, roomBasis, viewBox?, scale, thematic, caveats }. pose → TRACE an X-manji: { xmanji: { landmarks: { shoulderR:{x,y}, elbowR:{x,y}, hipL:{x,y}, … }, view }, proto?, gesture?, caveats } — the substrate SOLVES the joint dials from your landmarks (you don't supply angles); the solved dials are stored back into metadata.insights.dials. (Escape hatch: pose also accepts insights.dials directly.) landscape → a painted-landscape glyph map: { heartbeat, splatch, scene?, structures?, forest?, sky?, camera?, light?, bridges?, city?, cityDensity?, elevation?, renderStyle?, seed?, gesture?, caveats } — heartbeat + splatch required, picked from the catalogues in the protocol; the substrate renders the recipe into the cage. Built form is optional: `bridges:[{from:[x,y],to:[x,y]}]` (arched spans) + `city:true`/`cityDensity` (massed buildings) render in the WORLD/3D view; `elevation:{fields,field,waterLevel}` carves a BAY/inlet and renders in SVG too.",
        },
        fidelity: { type: 'string', description: "How tightly you quantized: scene 'thematic'|'faithful' (default thematic); pose 'gesture'|'faithful' (default gesture)." },
        label: { type: 'string', description: 'Short label for the reference (the stash item title).' },
        title: { type: 'string', description: 'Title for a newly-minted reference stash (omit when refining via stash_ref).' },
        stash_ref: { type: 'string', description: 'Refine an EXISTING reference stash with another photo pass. Omit to mint a new reference.' },
      },
    },
    handler: captureReferenceHandler,
  });
}
