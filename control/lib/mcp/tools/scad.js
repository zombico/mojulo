/**
 * mint_solid kind 'scad' — the OpenSCAD front door.
 *
 * `spec.source` is an OpenSCAD program and it IS the recipe: stored verbatim, meshed on every
 * read by OpenSCAD running in-process as WASM (lib/graph/scad/scad-render.js), and served on
 * the workbench's measured studio (/world orbit, /scene shots, every export leg) because the
 * mesher hands back the ordinary face list. Parts (`spec.parts`) name render groups so a
 * `movers` hinge can swing one; `color()` is the tint. Edit in place with `update_sketch`
 * (`/source`, `/parts/<name>`, `/movers`); `export_model format:'scad'` returns the source.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planScad, persistedScadLedger, DEFAULT_UNITS } from '@/lib/graph/scad/scad-render';
import { warmScenePng } from '@/lib/graph/scene/scene-png-warm';

export async function mintScad({ title, source, parts, units, fn, viewBox, facing, grid, movers, ref, folderRef } = {}) {
  if (typeof source !== 'string') {
    throw new Error("The scad kind needs `source` — an OpenSCAD program (mm, z up; `color()` is the tint; with `parts: { name: 'module();' }` each part is a render group a `movers` hinge can swing). Read get_solid_vocab({ id: 'scad' }) for the contract.");
  }
  const manifest = {
    kind: 'scad',
    source,
    ...(parts !== undefined ? { parts } : {}),
    units: typeof units === 'string' ? units : DEFAULT_UNITS,
    ...(Number.isFinite(fn) ? { fn } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(typeof facing === 'string' || Number.isFinite(facing) ? { facing } : {}),
    ...(grid === false ? { grid: false } : {}),
    ...(Array.isArray(movers) && movers.length ? { movers } : {}),
    ...(title ? { title } : {}),
  };
  // Render once here to validate (the fence, the parts contract, OpenSCAD's own errors) and to
  // return the readout; the renders that follow hit the geometry memo.
  const { stats } = await planScad(manifest);
  manifest.ledger = persistedScadLedger(stats.ledger);
  const sketch = SketchRepository.create({
    title: title || `scad · ${stats.parts.length} part${stats.parts.length === 1 ? '' : 's'}`,
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

export async function createScadHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('The scad kind needs a spec object with `source`.');
  const { title, source, parts, units, fn, viewBox, facing, grid, movers, ref, folder_ref: folderRef } = input;
  return mintScad({ title, source, parts, units, fn, viewBox, facing, grid, movers, ref, folderRef });
}
