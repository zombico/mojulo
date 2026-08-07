/**
 * drape-faces — the `drape` form primitive: a hanging cloth SHEET over a workbench object.
 *
 * The cloth sibling of `lathe` (revolution), `extrude` (straight prism), and `sweep` (bent tube).
 * Where those make SOLID parts, a drape is an OPEN two-sided sheet — a cape, robe, tabard, cloak,
 * shroud, banner, or covering. It is the wave-field specialized into cloth (see drapeSheet in
 * wave-field.js): a top edge pinned to two anchor points, hem corners flared + dropped (sag baked
 * in, no solver), rest folds, and a pin→free envelope (folds grow 0 at the pinned edge → 1 at the
 * free hem). The geometry is the SAME body-agnostic kernel the human wardrobe uses, so it drapes
 * over anything with two pinnable points.
 *
 * Emits the engine-agnostic baked face list (`{ corners, fill, doubleSided:true }`) the World
 * renderers consume, vexar-shaded (camera-independent), exactly like sweepToFaces / latheToFaces.
 * Because a sheet has no interior, it lights BOTH faces by |Lambert| (normal flipped into the light
 * hemisphere) and shades with SMOOTHED vertex normals so the folds read as gradients, not facets.
 *
 * Pure: no three.js, no DOM. The caller supplies resolved anchor points (no endpoint resolution).
 *
 * Design: control/lib/graph/workbench.plan.md. Sibling: sweep-faces.js, extrude-faces.js.
 */

import { shadeHexMat, DEFAULT_LIGHT, newellNormal, dot3 } from './vexar.js';
import { resolveMaterial, tagFacesWithMaterial } from './materials.js';
import { drapeSheet } from './wave-field.js';

const asPoint = (p) => (Array.isArray(p) ? { x: p[0], y: p[1], z: p[2] } : p);
const isPt = (p) => (Array.isArray(p) && p.length === 3 && p.every(Number.isFinite))
  || (p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));

/**
 * drapeToFaces(spec, opts) → [{ corners, fill, doubleSided }]
 *
 * spec: { anchor:[ptL, ptR], hang?, back?, drop?, flare?, hemZ?, spread?, waves?, pinToFree?,
 *         samples?, tint?, material?, style? }.  Points are [x,y,z] or {x,y,z}.
 */
export function drapeToFaces(spec = {}, opts = {}) {
  const light = opts.light || DEFAULT_LIGHT;
  const mat = (opts.material || spec.material) ? resolveMaterial(opts.material || spec.material) : null;
  const tint = spec.tint || (spec.style && spec.style.fill) || (mat && mat.base) || '#6d6f75';
  const anchor = Array.isArray(spec.anchor) ? spec.anchor : null;
  if (!anchor || anchor.length !== 2 || !isPt(anchor[0]) || !isPt(anchor[1])) return [];
  let sheet;
  try {
    sheet = drapeSheet({
      cL: asPoint(anchor[0]), cR: asPoint(anchor[1]),
      hang: spec.hang, back: spec.back, drop: spec.drop, flare: spec.flare, hemZ: spec.hemZ,
      spread: spec.spread, waves: spec.waves, pinToFree: spec.pinToFree, samples: spec.samples,
      displacement: spec.displacement, physics: spec.physics,
    });
  } catch { return []; }
  const R = sheet.rings;
  const Ni = R.length, Nj = Math.min(...R.map((r) => r.polyline.length));
  if (Ni < 2 || Nj < 2) return [];
  const P = R.map((r) => r.polyline.slice(0, Nj).map((p) => [p.x, p.y, p.z]));
  // face normals (consistent grid winding), then vertex normals = mean of incident faces
  const FN = [];
  for (let i = 0; i < Ni - 1; i++) { FN[i] = []; for (let j = 0; j < Nj - 1; j++) FN[i][j] = newellNormal([P[i][j], P[i][j + 1], P[i + 1][j + 1], P[i + 1][j]]); }
  const VN = [];
  for (let i = 0; i < Ni; i++) {
    VN[i] = [];
    for (let j = 0; j < Nj; j++) {
      let x = 0, y = 0, z = 0;
      for (const [di, dj] of [[-1, -1], [-1, 0], [0, -1], [0, 0]]) {
        const fi = i + di, fj = j + dj;
        if (fi >= 0 && fi < Ni - 1 && fj >= 0 && fj < Nj - 1) { const n = FN[fi][fj]; x += n[0]; y += n[1]; z += n[2]; }
      }
      const l = Math.hypot(x, y, z) || 1; VN[i][j] = [x / l, y / l, z / l];
    }
  }
  const toLight = light.toLight || [-light.dir?.[0], -light.dir?.[1], -light.dir?.[2]];
  const faces = [];
  for (let i = 0; i < Ni - 1; i++) {
    for (let j = 0; j < Nj - 1; j++) {
      const corners = [P[i][j], P[i][j + 1], P[i + 1][j + 1], P[i + 1][j]];
      const vn = [VN[i][j], VN[i][j + 1], VN[i + 1][j + 1], VN[i + 1][j]];
      let nx = 0, ny = 0, nz = 0; for (const n of vn) { nx += n[0]; ny += n[1]; nz += n[2]; }
      const l = Math.hypot(nx, ny, nz) || 1; let no = [nx / l, ny / l, nz / l];
      if (dot3(no, toLight) < 0) no = [-no[0], -no[1], -no[2]];        // two-sided |Lambert|
      faces.push({ corners, fill: shadeHexMat(tint, no, mat, { light }), doubleSided: true });
    }
  }
  return tagFacesWithMaterial(faces, mat);
}

/** Validate drape specs (mirrors validateSweeps). Returns an array of error strings. */
export function validateDrapes(drapes, _emittedNodes) {
  const errors = [];
  if (!Array.isArray(drapes)) return errors;
  drapes.forEach((spec, i) => {
    const at = `drapes[${i}]`;
    if (!spec || typeof spec !== 'object') { errors.push(`${at}: must be an object`); return; }
    if (!Array.isArray(spec.anchor) || spec.anchor.length !== 2 || !spec.anchor.every(isPt)) {
      errors.push(`${at}.anchor must be exactly two [x,y,z] or {x,y,z} points — the pinned top edge`);
    }
  });
  return errors;
}
