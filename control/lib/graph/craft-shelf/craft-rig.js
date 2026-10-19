/**
 * craft-rig.js — an archetype off the craft shelf as a rig figure: one bone per assembled item (the hull, each wing,
 * the stabilisers, the fin, the engine, the canopy, the gear, the stores), so a body that plays the craft can move
 * its parts apart (the transformation's jet form) and the World page draws it as it draws every rig: one rigid mesh
 * per bone. Flying attitude by default (level, gear up); `pose` and `attitude` are assembleCraft's own.
 *
 * Frame: the shelf's craft frame (+y the nose, +z up, metres), centred on x and y, its lowest point on z = 0, the
 * figure's yaw −π/2 turning the nose onto the world's heading like every vehicle rig. One clip, `idle`.
 * Server-side only; deterministic like the shelf it reads.
 */

import { faceListToMesh } from '../figures/face-mesh.js';
import { packRigMesh } from '../figures/rig-bake.js';
import { lowerAssemblerBuild } from '../worlds/workbench-assembler.js';
import { assembleCraft } from './index.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;

/**
 * craftPieces(archetype, opts) → { pieces: [{ id, soup, head }], length, span, height, readout } — the craft lowered
 * once and split by item: each piece a triangle soup (rig-parts.js's shape) in the normalized craft frame, its head
 * the centre of its bounds.
 */
export function craftPieces(archetype, { palette, colors, pose = { gear: 1 }, attitude = 'level', finish = true } = {}) {
  const { manifest, readout } = assembleCraft(archetype, { palette, colors, pose, attitude, finish });
  const { faces, placements } = lowerAssemblerBuild(manifest);
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) { if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k]; }
  const cx = (mn[0] + mx[0]) / 2, cy = (mn[1] + mx[1]) / 2, z0 = mn[2];
  const N = (c) => [c[0] - cx, c[1] - cy, c[2] - z0];
  const pieces = [];
  placements.forEach((p, i) => {
    const fs = faces.slice(p.faceStart, p.faceStart + p.faceCount).map((f) => ({ ...f, corners: f.corners.map(N) }));
    if (!fs.length) return;
    const gm = faceListToMesh(fs);
    if (!gm.positions.length) return;
    const soup = { pos: Array.from(gm.positions), col: Array.from(gm.colors), spec: gm.specs ? Array.from(gm.specs) : null };
    const b = [[Infinity, -Infinity], [Infinity, -Infinity], [Infinity, -Infinity]];
    for (let j = 0; j < soup.pos.length; j += 3) for (let k = 0; k < 3; k++) { const v = soup.pos[j + k]; if (v < b[k][0]) b[k][0] = v; if (v > b[k][1]) b[k][1] = v; }
    pieces.push({ id: p.id || `item${i}`, soup, faces: fs.length, head: b.map(([a, c]) => r4((a + c) / 2)) });
  });
  return { pieces, length: r4(mx[1] - mn[1]), span: r4(mx[0] - mn[0]), height: r4(mx[2] - mn[2]), readout };
}

/** craftFigure(archetype, opts) → the packed rig figure (rig: true, one bone per item, the `idle` clip). */
export function craftFigure(archetype, opts = {}) {
  const { pieces, length, span, height } = craftPieces(archetype, opts);
  const bones = pieces.map((p) => ({ id: p.id, head: p.head }));
  const parts = pieces.map((p) => packRigMesh({ positions: p.soup.pos, colors: p.soup.col, specs: p.soup.spec }, p.faces));
  const b = [];
  for (const bn of bones) b.push(0, 0, 0, 1, ...bn.head);
  return {
    rig: true, model: 'craft', facing: '+y', yaw: -Math.PI / 2,
    bones, parts, clips: { idle: { k: 1, b } },
    figH: height, length, span,
  };
}
