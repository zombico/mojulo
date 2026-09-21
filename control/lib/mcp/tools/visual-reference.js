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
import { planWorkbench } from '@/lib/graph/worlds/workbench';
import { planAssembler } from '@/lib/graph/worlds/workbench-assembler';
import { ensureExactKernel } from '@/lib/graph/polygonizer/field-exact';
import { manifestWantsExact } from '@/lib/graph/polygonizer/field-exact-reach';
import {
  REFERENCE_TARGETS,
  DEFAULT_FIDELITY,
  getReferenceProtocol,
  lowerSceneCage,
  lowerPoseCage,
  lowerLandscapeCage,
  lowerObjectCage,
  fuseObjectInsights,
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

/**
 * The object target's next-step. Steers to the EYES GATE first (the machine
 * gates cannot tell you it does not look like the photo), names the warnings
 * that fired, and — because a refining pass now FUSES — says what the pass
 * actually changed and how to send only corrections next time.
 */
function objectNext({ ledger, segments, fusion, cageRef, stashRef, passes, view }) {
  const parts = [];
  if (segments.length) {
    parts.push(
      `Segment-first: ${segments.length} segment(s) minted as their own workbench recipes, composed into an assembler cage. `
      + `Judge each segment ALONE first (${segments.slice(0, 3).map((s) => `${s.id} → ${s.url}`).join(', ')}${segments.length > 3 ? ', …' : ''}), then the composition at world_url.`,
    );
  } else {
    parts.push('Open world_url to SEE the block-out.');
  }
  parts.push(
    'EYES GATE: Read the render beside the ORIGINAL photo'
    + (Number.isFinite(view?.az) ? ` (the cage faces az ${view.az}, the angle you read at)` : '')
    + ' — never against a remembered archetype of the object class, which manufactures defects that are not there.',
  );
  if (ledger?.warnings?.length) {
    parts.push(`The ledger flagged ${ledger.warnings.length} thing(s) — read \`ledger.warnings\`; they are advisory, not gates.`);
  }
  if (fusion?.mode === 'fused') {
    const bits = [];
    if (fusion.updated.length) bits.push(`updated ${fusion.updated.join(', ')}`);
    if (fusion.added.length) bits.push(`added ${fusion.added.join(', ')}`);
    if (fusion.dropped.length) bits.push(`dropped ${fusion.dropped.join(', ')}`);
    if (fusion.carried.length) bits.push(`carried ${fusion.carried.length} unchanged`);
    parts.push(`Pass ${passes} FUSED onto the previous read: ${bits.join('; ') || 'nothing changed'}.`);
  } else if (fusion?.mode === 'replaced') {
    parts.push(`Pass ${passes} did NOT fuse — ${fusion.reason}. The previous cage is still in the stash.`);
  } else {
    parts.push(
      `A single view cannot see depth, the radius-to-height scale, or the back. To GROUND it, capture_reference again with stash_ref:'${stashRef}' from a view rotated ~90° — send ONLY the corrections (a part you omit is carried forward, \`{id, radius}\` fixes one radius, \`drop:['id']\` removes one).`,
    );
  }
  parts.push(`Iterate in place with update_sketch on ${cageRef}; export with export_model when it reads. Anchor a build: bind_stash({ stash_ref:'${stashRef}', role:'reference' }).`);
  return parts.join(' ');
}

export async function captureReferenceHandler(input, _ctx) {
  if (!input || typeof input !== 'object') {
    throw new Error('capture_reference requires { target, insights }');
  }
  const { target, insights, fidelity, label, title, stash_ref, replace } = input;
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
  let priorOfTarget = [];
  if (stash_ref) {
    stash = StashRepository.getByRef(stash_ref);
    if (!stash) throw new Error(`Stash '${stash_ref}' not found.`);
    const full = StashRepository.getFull(stash.stashRef);
    // Cage items of this target already in the stash — the count is the pass
    // number, and the LAST one is what a refining pass fuses onto.
    priorOfTarget = (full?.items || []).filter(
      (it) => it.type === 'sketch' && it.metadata?.reference_target === target && it.metadata?.reference_role !== 'segment',
    );
    passes = priorOfTarget.length + 1;
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
  let objectLedger = null;
  let segmentsOut = null;
  let fusionInfo = null;
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
  } else if (target === 'object') {
    // Part-graph -> workbench recipe (one-shot) or assembler + per-segment
    // workbench recipes (segment-first). The lowering multiplies fractions by
    // unitHeight (no absolute z is ever authored) and returns the advisory
    // ledger; planWorkbench / planAssembler are the same gates the real mint pays.
    //
    // A REFINING pass fuses onto the last cage's insights first, so a second
    // view supplies only its corrections rather than re-authoring the whole read.
    let readInsights = insights;
    const priorInsights = priorOfTarget.length ? priorOfTarget[priorOfTarget.length - 1].metadata?.insights : null;
    if (priorInsights && replace !== true) {
      const f = fuseObjectInsights(priorInsights, insights);
      readInsights = f.insights;
      fusionInfo = f.fusion;
    }
    const lowered = lowerObjectCage(readInsights, cageTitle);
    manifest = lowered.manifest;
    objectLedger = lowered.ledger;
    segmentsOut = lowered.segments || null;
    // an `exact: true` field composes through Manifold (async to load); the plan gates below are sync
    if (manifestWantsExact(manifest) || (segmentsOut || []).some((seg) => manifestWantsExact(seg.manifest))) await ensureExactKernel();
    try {
      if (segmentsOut) {
        // Each segment is a whole workbench recipe judged ALONE, then the
        // composition is judged as a whole — the two altitudes the segment-first
        // path exists to separate.
        for (const seg of segmentsOut) {
          const { stats } = planWorkbench(seg.manifest);
          // A segment is authored at its own origin and SEATED by the assembler,
          // so the workbench's float/sink-on-the-grid warning is meaningless at
          // this altitude — every non-base segment would fire it. The composition
          // gets the same check from planAssembler, where it means something.
          const segWarnings = (stats?.warnings || []).filter((w) => !/\b(floats|sinks)\b/.test(w));
          if (segWarnings.length) objectLedger.warnings.push(...segWarnings.map((w) => `${seg.id}: ${w}`));
          seg.stats = { monomers: stats?.monomers, faces: stats?.faces, size: stats?.size };
        }
        const { stats } = planAssembler(manifest);
        if (stats?.warnings?.length) objectLedger.warnings.push(...stats.warnings);
        objectLedger.stats = { items: stats?.items, placements: stats?.placements, faces: stats?.faces, size: stats?.size, parts: stats?.parts };
        // The whole-assembly height check — the segment ledgers only saw their own.
        const h = stats?.size?.h;
        if (Number.isFinite(h) && objectLedger.unitHeight > 0 && Math.abs(h - objectLedger.unitHeight) / objectLedger.unitHeight > 0.05) {
          objectLedger.warnings.push(`Composed height ${h} differs from the declared unitHeight ${objectLedger.unitHeight} by ${(100 * Math.abs(h - objectLedger.unitHeight) / objectLedger.unitHeight).toFixed(0)}% — check the segment heightFracs and their seating.`);
        }
      } else {
        const { stats } = planWorkbench(manifest);
        if (stats?.warnings?.length) objectLedger.warnings.push(...stats.warnings);
        objectLedger.stats = { monomers: stats?.monomers, faces: stats?.faces, size: stats?.size };
      }
    } catch (err) {
      throw new Error(`object cage failed the ${segmentsOut ? 'assembler' : 'workbench'} gate: ${err.message}`);
    }
    effInsights = { ...readInsights, __ledger: objectLedger };
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
  // 3b. SEGMENT-FIRST: each segment is its own workbench sketch, minted and
  //     filed so it can be rendered and judged ALONE — that isolation is the
  //     whole point of the segment path. They are tagged reference_role:'segment'
  //     so the pass counter and the fusion lookup skip them.
  const segmentRefs = [];
  if (segmentsOut) {
    for (const seg of segmentsOut) {
      const segSketch = SketchRepository.create({ title: seg.manifest.title, manifest: seg.manifest, folderRef: null });
      StashRepository.gather({
        stashRef: stash.stashRef,
        type: 'sketch',
        title: `${labelText} — ${seg.label}`,
        bodyMd: [
          `Segment **${seg.id}** of ${labelText} — ${(seg.ledger.heightFrac * 100).toFixed(0)}% of the whole, seated on \`${seg.seating.on}\`.`,
          ...seg.ledger.warnings.map((w) => `⚠︎ ${w}`),
        ].join('\n\n'),
        metadata: {
          sketch_ref: segSketch.ref,
          label: `${labelText} — ${seg.label}`,
          reference_target: target,
          reference_role: 'segment',
          segment_id: seg.id,
          passes,
          ledger: seg.ledger,
          stats: seg.stats || null,
        },
      });
      segmentRefs.push({
        id: seg.id,
        ref: segSketch.ref,
        url: `/sketches/${encodeURIComponent(segSketch.ref)}`,
        world_url: `/api/sketches/${encodeURIComponent(segSketch.ref)}/world`,
        seating: seg.seating,
        heightFrac: seg.ledger.heightFrac,
        parts: seg.ledger.parts,
      });
    }
  }

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
      ...(segmentRefs.length ? { segment_refs: segmentRefs } : {}),
      ...(fusionInfo ? { fusion: fusionInfo } : {}),
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
    ...(objectLedger ? { ledger: objectLedger, world_url: `/api/sketches/${encodeURIComponent(cage.ref)}/world` } : {}),
    ...(segmentRefs.length ? { mode: 'segments', segments: segmentRefs } : objectLedger ? { mode: 'one-shot' } : {}),
    ...(fusionInfo ? { fusion: fusionInfo } : {}),
    next:
      target === 'object'
        ? objectNext({ ledger: objectLedger, segments: segmentRefs, fusion: fusionInfo, cageRef: cage.ref, stashRef: stash.stashRef, passes, view: effInsights.view })
        : target === 'pose'
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
      "Visual Reference (step 1) — get the EXTRACTION PROTOCOL for turning a photo YOU can see into a mojulo scaffold. You (the harness) are the vision adapter: there is no vision key and no image is sent to mojulo for understanding — you read the image, then map what you see onto the target's dials. Returns the key lines to read, the dial schema, the fidelity contract, the expressive ceiling, the multi-pass hint, and the exact capture_reference call to make next.\n\nTargets:\n  • scene — a room/building photo → recover PERSPECTIVE (horizon, vanishing points, floor convergence, relative scale) into a two-point camera the substrate builds inside.\n  • pose  — a human photo → TRACE the figure's X-manji (its stick-skeleton key lines) as 2D points; the substrate SOLVES the pose dials against the locked armature.\n  • object — an object photo (furniture, vessel, tool, machine, prop, vehicle, building) → read its PART-GRAPH as workbench monomers bonded by named junctions, every height a FRACTION of the total; a complex subject goes SEGMENT-FIRST (sub-objects judged alone, composed by gravity seating).\n  • landscape — a landscape/terrain photo → read its GESTURE, depth, palette and elements, and pick the closed-vocabulary painted-landscape RECIPE that recreates it; the substrate RENDERS your map, so the cage is a candidate recreation, not just a diagram.\n\nReach for this on framing like \"use this photo/image as a reference, match this pose/gesture, rebuild this room's perspective, recreate this landscape, copy the composition/camera, base it on this picture\". Then call capture_reference. (Contrast: \"draw me X\" → create_sketch; \"make X move\" → forge_motion.)",
    inputSchema: {
      type: 'object',
      required: ['target'],
      properties: {
        target: {
          type: 'string',
          enum: REFERENCE_TARGETS,
          description: "'scene' (perspective from a room/building photo) | 'pose' (gesture from a human photo) | 'landscape' (painted-landscape recipe from a terrain photo) | 'object' (part-graph block-out from an object photo).",
        },
      },
    },
    handler: referenceProtocolHandler,
  });

  registerTool({
    name: 'capture_reference',
    description:
      "Visual Reference (step 2) — FILE a reference you extracted from a photo into a stash. Call reference_protocol(target) first; then pass the structured `insights` you decomposed the image into. pose → a traced X-manji, and the substrate SOLVES the dials. landscape → a glyph map, and the substrate RENDERS it. object → a part-graph (`parts`, or `segments` for a complex subject), lowered to a workbench / assembler recipe and gated. Mints a CAGE sketch you can see/preload/re-camera (object also mints one per segment) and gathers it as a `sketch` stash item carrying metadata.insights. Returns { stash_ref, cage_ref, cage_url, svg_url, item_id, passes, ledger?, segments?, fusion? }.\n\nMulti-pass: one photo is degenerate (scene scale relative; pose depth ambiguous; landscape quantized; object depth + radius scale unobservable). Pass `stash_ref` to REFINE with a second viewpoint or detail crop. For OBJECT the refinement FUSES — parts/segments merge BY ID onto the filed read, so pass 2 sends only its corrections (omit a part and it carries forward; `drop:['id']` removes one); scene/pose/landscape do not yet fuse. One-shot is the normalized anchor, multi-pass grounds it.\n\nConsume it: scene → preload cage_ref in create_sketch/create_manji_tree; pose → create_figure({ pose: insights.dials }); landscape → create_painted_landscape({ ...insights }); object → update_sketch the cage in place, then export_model; any → cook the stash into a reference sheet. Anchor a build with bind_stash({ stash_ref, role:'reference' }).",
    inputSchema: {
      type: 'object',
      required: ['target', 'insights'],
      properties: {
        target: { type: 'string', enum: REFERENCE_TARGETS, description: "'scene' | 'pose' | 'landscape' — must match the protocol you read." },
        insights: {
          type: 'object',
          description:
            "The structured read you extracted from the image (the shape comes from reference_protocol). scene → { camera, roomBasis, viewBox?, scale, thematic, caveats }. pose → TRACE an X-manji: { xmanji: { landmarks: { shoulderR:{x,y}, elbowR:{x,y}, hipL:{x,y}, … }, view }, proto?, gesture?, caveats } — the substrate SOLVES the joint dials from your landmarks (you don't supply angles); the solved dials are stored back into metadata.insights.dials. (Escape hatch: pose also accepts insights.dials directly.) object → { identity, unitHeight, view?, and EITHER `parts` OR `segments` (never both), plus `drop`:[id…] on a refining pass } — full shape in the protocol. landscape → a painted-landscape glyph map: { heartbeat, splatch, scene?, structures?, forest?, sky?, camera?, light?, bridges?, city?, cityDensity?, elevation?, renderStyle?, seed?, gesture?, caveats } — heartbeat + splatch required, picked from the catalogues in the protocol; the substrate renders the recipe into the cage. Built form is optional: `bridges:[{from:[x,y],to:[x,y]}]` (arched spans) + `city:true`/`cityDensity` (massed buildings) render in the WORLD/3D view; `elevation:{fields,field,waterLevel}` carves a BAY/inlet and renders in SVG too.",
        },
        fidelity: { type: 'string', description: "How tightly you quantized: scene 'thematic'|'faithful' (default thematic); pose 'gesture'|'faithful' (default gesture); object 'blocky'|'faithful'." },
        label: { type: 'string', description: 'Short label for the reference (the stash item title).' },
        title: { type: 'string', description: 'Title for a newly-minted reference stash (omit when refining via stash_ref).' },
        stash_ref: { type: 'string', description: 'Refine an EXISTING reference stash with another photo pass. Omit to mint a new reference.' },
        replace: { type: 'boolean', description: 'object only — with `stash_ref`, skip FUSION and treat this read as a fresh full authoring.' },
      },
    },
    handler: captureReferenceHandler,
  });
}
