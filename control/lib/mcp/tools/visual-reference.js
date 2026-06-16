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
  return {
    ok: true,
    stash_ref: stash.stashRef,
    item_id: item.id,
    cage_ref: cage.ref,
    cage_url: `/sketches/${encodeURIComponent(cage.ref)}`,
    svg_url: `/api/sketches/${encodeURIComponent(cage.ref)}/svg?inline=1`,
    target,
    fidelity: fid,
    passes,
    ...(solveInfo ? { solve: solveInfo } : {}),
    next:
      target === 'pose'
        ? `Solved the dials from your X-manji (fit error ${solveInfo?.error != null ? solveInfo.error.toFixed(3) : 'n/a'}${frozen.length ? `; depth-frozen: ${frozen.join(', ')}` : ''}). Open cage_url to SEE the figure. ${frozen.length ? `Those frozen DOFs are unobservable at this view — if the pose needs them, trace a SIDE X-manji and call again with stash_ref:'${stash.stashRef}'. ` : ''}Build from it: create_figure({ pose: insights.dials }) (the solved dials are stored), or forge_motion a pose keyframe over the figure cage.`
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
      "Visual Reference (step 1) — get the EXTRACTION PROTOCOL for turning a photo YOU can see into a mojulo scaffold. You (the harness) are the vision adapter: there is no vision key and no image is sent to mojulo for understanding — you read the image, then map what you see onto the target's dials. Returns the key lines to read, the dial schema to write into, the fidelity contract (thematic/gesture default vs faithful), the expressive ceiling (what this target CANNOT represent), the multi-pass hint (which second view resolves which single-photo ambiguity), and the exact capture_reference call to make next.\n\nTargets:\n  • scene — a room/building/scene photo → recover PERSPECTIVE (horizon, vanishing points, floor convergence, relative scale) into a two-point camera the substrate builds inside.\n  • pose  — a human photo → TRACE the figure's X-manji (its stick-skeleton key lines) as 2D points; the substrate SOLVES the pose dials from your trace against the locked armature (you place a skeleton, you don't guess joint angles).\n\nReach for this on framing like \"use this photo/image as a reference, match this pose/gesture, rebuild this room's perspective, copy the composition/camera, base it on this picture\". Then call capture_reference. (Contrast: \"draw me X\" → create_sketch; \"make X move\" → forge_motion.)",
    inputSchema: {
      type: 'object',
      required: ['target'],
      properties: {
        target: {
          type: 'string',
          enum: REFERENCE_TARGETS,
          description: "'scene' (perspective from a room/building photo) | 'pose' (gesture from a human photo).",
        },
      },
    },
    handler: referenceProtocolHandler,
  });

  registerTool({
    name: 'capture_reference',
    description:
      "Visual Reference (step 2) — FILE a reference you extracted from a photo into a stash. Call reference_protocol(target) first; then, having read the image, pass the structured `insights` you decomposed it into. For pose, pass a traced X-manji (insights.xmanji.landmarks) and the substrate SOLVES the dials. Mints a CAGE sketch you can see/preload/re-camera (scene → a perspective-frame diagram; pose → the solved figure dummy) and gathers it as a `sketch` stash item carrying metadata.insights (with the solved dials). Returns { stash_ref, cage_ref, cage_url, svg_url, item_id, passes }.\n\nMulti-pass: a single photo is degenerate (scene depth/scale relative; pose depth/roll ambiguous). Pass `stash_ref` to REFINE the same reference with a second viewpoint — the pass triangulates what one view couldn't. We never expect one photo to drive creation; one-shot is the normalized anchor, multi-pass grounds it.\n\nConsume it: scene → preload cage_ref in create_sketch/create_manji_tree or forge_motion a turntable over it; pose → create_figure({ pose: insights.dials }) or a forge_motion pose keyframe; either → cook the stash into a reference sheet. Anchor a build with bind_stash({ stash_ref, role:'reference' }).",
    inputSchema: {
      type: 'object',
      required: ['target', 'insights'],
      properties: {
        target: { type: 'string', enum: REFERENCE_TARGETS, description: "'scene' | 'pose' — must match the protocol you read." },
        insights: {
          type: 'object',
          description:
            "The structured read you extracted from the image (the shape comes from reference_protocol). scene → { camera, roomBasis, viewBox?, scale, thematic, caveats }. pose → TRACE an X-manji: { xmanji: { landmarks: { shoulderR:{x,y}, elbowR:{x,y}, hipL:{x,y}, … }, view }, proto?, gesture?, caveats } — the substrate SOLVES the joint dials from your landmarks (you don't supply angles); the solved dials are stored back into metadata.insights.dials. (Escape hatch: pose also accepts insights.dials directly.)",
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
