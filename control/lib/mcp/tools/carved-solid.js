/**
 * create_carved_solid — mint a CARVED, METALIFIED solid (3D wordmark / logo /
 * icon) as a sketch. The carve-solid render primitive graduated onto the sketch
 * surface: persists with `kind: 'carved-solid'`; the /api/sketches/<ref>/svg
 * route dispatches on that discriminator to renderCarvedSolidToSvg (the same
 * pattern as manji-tree and painted-landscape). No new persistence layer.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import { renderCarvedSolidToSvg, renderCarvedSolidFrames, carvedSolidIsAnimated } from '@/lib/graph/effects/carved-solid';
import { encodeGif } from '@/lib/motion';
import { outcomeDirFor, outcomeUrlFor } from '@/lib/outcomes-paths';

export async function createCarvedSolidHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('mint_solid kind "carved-solid" requires { title, spec: { shape } }');
  }
  const { title, shape, style, material, metal, inner, fx, camera, background, animate, ref, folder_ref: folderRef } = input;
  if (!title || typeof title !== 'string') throw new Error('`title` is required (string)');
  if (!shape || typeof shape !== 'object' || (!shape.path && !shape.text)) {
    throw new Error('`shape` must be { path: "<svg d>" } or { text: "...", font?: "<ttf path>" }');
  }
  if (ref !== undefined && (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ref))) {
    throw new Error('`ref` must be 1-64 chars of [A-Za-z0-9_-] if provided');
  }
  if (folderRef !== undefined && folderRef !== null) {
    if (!SketchFolderRepository.getByRef(folderRef)) throw new Error(`Folder '${folderRef}' not found`);
  }

  const manifest = {
    kind: 'carved-solid',
    shape,
    ...(style !== undefined && style !== null ? { style } : {}),
    ...(material !== undefined && material !== null ? { material } : {}),
    ...(metal !== undefined && metal !== null ? { metal } : {}),
    ...(inner !== undefined && inner !== null ? { inner } : {}),
    ...(fx !== undefined && fx !== null ? { fx } : {}),
    ...(camera !== undefined && camera !== null ? { camera } : {}),
    ...(background !== undefined ? { background } : {}),
    title,
  };

  // Render once to validate (bad path / missing font / bad effect fail here,
  // not at view time).
  try { renderCarvedSolidToSvg(manifest); }
  catch (err) { throw new Error(`carved-solid render failed: ${err.message}`); }

  const sketch = SketchRepository.create({ title, manifest, ref, folderRef: folderRef ?? null });

  // Motion: an animated effect (electric / flame / ice / pulse glow) gets a
  // looping GIF rendered into the sketch's outcome folder for the viewer. Auto
  // when the manifest animates; `animate:false` skips, `animate:{frames,fps}` tunes.
  let gifUrl = null;
  const wantGif = animate === undefined ? carvedSolidIsAnimated(manifest) : (animate !== false);
  if (wantGif) {
    try {
      const frames = (typeof animate === 'object' && animate.frames) || 24;
      const fps = (typeof animate === 'object' && animate.fps) || 14;
      const dir = outcomeDirFor(sketch.ref);
      await fs.mkdir(dir, { recursive: true });
      await encodeGif(renderCarvedSolidFrames(manifest, frames), path.join(dir, 'motion.gif'), { width: 640, fps, bg: '#070a11', loop: 0 });
      gifUrl = `${outcomeUrlFor(sketch.ref)}motion.gif`;
    } catch (err) { /* GIF is a bonus; the still SVG already succeeded */ gifUrl = null; }
  }

  return {
    ok: true,
    ref: sketch.ref,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    svgUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/svg?inline=1`,
    ...(gifUrl ? { gifUrl } : {}),
  };
}
