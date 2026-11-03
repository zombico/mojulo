/**
 * create_assembler — compose several finished workbench PARTS into one worldspace.
 *
 *   Assembler makes a chariot. Workbench makes chariot parts.
 *
 * The ring above create_workbench: where the workbench mints ONE measured object (its invariant is
 * single-subject), the assembler places SEVERAL whole workbench parts in a shared, meru-scaled
 * worldspace. The MAIN move is REPOSITION (`at`) — each part was authored alone at its own origin,
 * so without it they pile at [0,0,0]. `repeat` arrays a part (one spindle → a banister) and
 * `rotate`/`flip`/`scale` adjust a placement (peg → spindle).
 *
 * Source policy — FROZEN at import. Each item's `source` is stored inline. A `{ ref }` is resolved
 * to the stored workbench's monomers and COPIED in at mint time (mint-at-import), so the assembler
 * is self-contained: no binding, no live refs, no staleness. Re-mint = re-import + redo.
 *
 * Stored manifest: { kind:'assembler', items:[ { source:{lathes?,extrudes?,sweeps?}, at?, rotate?, flip?, scale?, repeat? } … ], units?, viewBox?, title? }.
 *
 * Design: control/lib/graph/workbench-assembler.plan.md.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planAssembler } from '@/lib/graph/worlds/workbench-assembler';
import { MONOMER_KEYS, hasProgram } from '@/lib/graph/worlds/workbench-program';
import { hasEquipment } from '@/lib/graph/equipment/expand';
import { hasFurnitureAsset } from '@/lib/graph/furnishings/asset';
import { warmScenePng } from '@/lib/graph/scene/scene-png-warm';

// Pull the renderable monomer arrays off a workbench-shaped manifest (the frozen part). Every
// family `lowerObjectFaces` renders is kept (MONOMER_KEYS) — this used to keep only lathes /
// extrudes / sweeps / reliefs and SILENTLY drop a part's lofts, fields, shells and drapes at the
// freeze, so a curved lofted panel entered the assembly as nothing (chariot.plan.md, 2026-09-08).
function monomersOf(manifest) {
  if (!manifest || typeof manifest !== 'object') return null;
  const out = {};
  for (const k of MONOMER_KEYS) {
    if (Array.isArray(manifest[k]) && manifest[k].length) out[k] = manifest[k];
  }
  // The code kind stores a PROGRAM instead of arrays. It is frozen the same way — copied inline —
  // and the assembler's lowering expands it on every render exactly as the workbench does
  // (seeded, memoised), so a crankshaft written as a loop enters an engine as itself.
  if (hasProgram(manifest)) out.program = manifest.program;
  // An equipment build freezes the same way: its words (laws stamp included) ride inline and expand in the lowering.
  if (hasEquipment(manifest)) out.build = manifest.build;
  // so does a furniture asset: its lock rides inline and is drawn in the lowering
  if (hasFurnitureAsset(manifest)) out.build = manifest.build;
  return Object.keys(out).length ? out : null;
}

// Resolve an item's `source` to a FROZEN inline part. Accepts an inline workbench manifest
// ({ lathes?, extrudes?, sweeps? }) or a { ref } to a stored workbench sketch (copied in here).
function freezeSource(source, index) {
  if (!source || typeof source !== 'object') {
    throw new Error(`Item ${index}: \`source\` must be a workbench part — an inline { lathes/extrudes/sweeps } or a { ref } to a stored workbench.`);
  }
  if (typeof source.ref === 'string') {
    const sketch = SketchRepository.getByRef(source.ref);
    if (!sketch || !sketch.manifest) throw new Error(`Item ${index}: source ref '${source.ref}' not found.`);
    if (sketch.manifest.kind === 'scad') {
      // The fabricate door mints scad rows, and "assemble" is the word people reach for next: say where a scad object assembles.
      throw new Error(`Item ${index}: source ref '${source.ref}' is a scad row — the assembler composes workbench parts only. A scad object assembles inside its own source: each piece a \`parts\` entry, what moves a \`mechanism\`, its bought parts the \`fabricate\` plan's \`bom\` (update_sketch on '${source.ref}', or fabricate_solid for new needs).`);
    }
    if (sketch.manifest.kind !== 'workbench') throw new Error(`Item ${index}: source ref '${source.ref}' is a '${sketch.manifest.kind}', not a workbench — the assembler composes workbench parts.`);
    const frozen = monomersOf(sketch.manifest);
    if (!frozen) throw new Error(`Item ${index}: workbench '${source.ref}' has no renderable monomers.`);
    return frozen;
  }
  const inline = monomersOf(source);
  if (!inline) throw new Error(`Item ${index}: \`source\` has no renderable monomers (need a non-empty lathes/extrudes/sweeps, or a { ref }).`);
  return inline;
}

export function mintAssembler({ title, items, units, viewBox, facing, model, rig, ref, folderRef } = {}) {
  if (!Array.isArray(items) || !items.length) {
    throw new Error('Provide a non-empty `items` array — each item places one workbench part in the shared worldspace.');
  }
  const frozenItems = items.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Item ${index} must be an object.`);
    return {
      source: freezeSource(item.source, index),
      ...(typeof item.id === 'string' && item.id ? { id: item.id } : {}),
      ...(Array.isArray(item.at) ? { at: item.at } : {}),
      ...(item.on != null ? { on: item.on } : {}),
      ...(Number.isFinite(item.gap) ? { gap: item.gap } : {}),
      ...(Array.isArray(item.rotate) ? { rotate: item.rotate } : {}),
      ...(typeof item.flip === 'string' ? { flip: item.flip } : {}),
      ...(Number.isFinite(item.scale) ? { scale: item.scale } : {}),
      ...(item.repeat && typeof item.repeat === 'object' ? { repeat: item.repeat } : {}),
    };
  });

  const manifest = {
    kind: 'assembler',
    items: frozenItems,
    ...(typeof units === 'string' ? { units } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(typeof facing === 'string' || Number.isFinite(facing) ? { facing } : {}),
    ...(typeof model === 'string' ? { model } : {}),
    ...(rig && typeof rig === 'object' ? { rig } : {}),
    ...(title ? { title } : {}),
  };

  // Lower once to validate every part renders + return a placement/size readout (no geometry stored).
  const { stats } = planAssembler(manifest);

  const sketch = SketchRepository.create({
      title: title || `assembler · ${stats.items} part${stats.items === 1 ? '' : 's'}`,
      manifest, ref, folderRef: folderRef ?? null,
    });

  warmScenePng(sketch);

  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    sceneUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/scene`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    stats,
  };
}

export async function createAssemblerHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('mint_solid kind "assembler" requires a spec with an `items` array');
  }
  const { title, items, units, viewBox, facing, model, rig, ref, folder_ref: folderRef } = input;
  return mintAssembler({ title, items, units, viewBox, facing, model, rig, ref, folderRef });
}
