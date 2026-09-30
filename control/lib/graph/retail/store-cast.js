// CAST archetypes — the dressed dummies. Optional channel: a card with no `cast`
// contributes zero faces (the interpreter only calls castBuilder for cast entries).
//
// A mannequin is a posed, dressed figure (renderFigureWorldFrames: the production mesher)
// planted statically on a low plinth. The figure's native frame is measured once per build
// and normalised by ONE scale constant to a target stature in feet (feet at the plinth top,
// body centred on the spot) — the units open question answered by measurement, not by a
// hard-coded conversion. Flesh-hued faces are remapped by luminance onto the form tint, so it
// reads as a display form, not a shopper; garment faces keep their colour.

import { renderFigureWorldFrames } from '../polygonizer/figure-render.js';
import { box } from './store-box.js';
import { mathKey } from '../../util/math-scope.js';

export const CAST_ARCHETYPES = {
  mannequin: { footprint: 2.2, clearance: 1.5 },
};

const STANCES = {
  display: { kneeL: 4, kneeR: 8, elbowL: 18, elbowR: 30, spine: { lateral: 0.1, axial: 0.04 }, hipL: { roll: 4 }, head: { yaw: -6 } },
  hipHand: { kneeL: 4, kneeR: 10, elbowL: 12, elbowR: 95, shR: { roll: 30, pitch: -10 }, spine: { lateral: -0.1 }, hipR: { roll: 4 }, head: { yaw: 8 } },
};
const OUTFITS = {
  female: { layers: ['fittedShirt', 'skirt'] },
  male: { layers: ['tee', 'trousersSlim'] },
};
const STATURE = { female: 5.8, male: 6.1 };          // display-form height in feet, heel to crown
const PLINTH = 0.45;

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbHex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const FLESH = hexRgb('#c8836a');
const isFlesh = (hex) => {
  if (typeof hex !== 'string' || hex[0] !== '#') return false;
  const [r, g, b] = hexRgb(hex);
  if (!g || !b) return false;
  return Math.abs(r / g - FLESH[0] / FLESH[1]) < 0.07 && Math.abs(g / b - FLESH[1] / FLESH[2]) < 0.07;
};

const memo = new Map();
/** The normalised figure: feet at z = 0, centred at x = y = 0, facing −y, height = stature ft. */
function formFaces(spec) {
  const sex = spec.sex === 'male' ? 'male' : 'female';
  const manifest = {
    pose: typeof spec.pose === 'string' ? STANCES[spec.pose] : (spec.pose || STANCES.display),
    proto: { sex, ...(spec.proto || {}) },
    ...(spec.cast ? { cast: spec.cast } : {}),
    outfit: spec.outfit || OUTFITS[sex],
    ...(spec.hair ? { hair: spec.hair } : {}),
  };
  const key = JSON.stringify([manifest, spec.form || null, spec.stature || null]) + mathKey();
  if (memo.has(key)) return memo.get(key);
  const raw = renderFigureWorldFrames(manifest).frames[0].faces;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const f of raw) for (const [x, y, z] of f.corners) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const stature = spec.stature || STATURE[sex];
  const s = stature / (z1 - z0);                        // the ONE scale constant, measured
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const [fr, fg, fb] = hexRgb(spec.form || '#e6e2da');
  const lumF = (FLESH[0] * 0.3 + FLESH[1] * 0.59 + FLESH[2] * 0.11) / 255;
  const faces = raw.map((f) => {
    let fill = f.fill;
    if (isFlesh(fill)) { const [r, g, b] = hexRgb(fill); const k = ((0.3 * r + 0.59 * g + 0.11 * b) / 255) / lumF; fill = rgbHex([fr * k, fg * k, fb * k]); }
    // the figure faces +y in its own frame; turn it 180° so it faces the customer (−y)
    return { corners: f.corners.map(([x, y, z]) => [-(x - cx) * s, -(y - cy) * s, (z - z0) * s]), fill, doubleSided: true };
  });
  const out = { faces, stature, scale: s, native: { height: z1 - z0, width: x1 - x0, depth: y1 - y0 } };
  memo.set(key, out);
  return out;
}

/** castBuilder for fitOutFromConcept: plant one cast entry at local (x, y). */
export function buildMannequin(entry, { x, y, z, frame }) {
  const form = formFaces(entry);
  const local = [];
  const L = frame.localLight, hw = CAST_ARCHETYPES.mannequin.footprint / 2;
  box(local, x - hw, x + hw, y - hw, y + hw, z, z + PLINTH, entry.plinth || '#2f3136', L);
  for (const f of form.faces) local.push({ ...f, corners: f.corners.map(([a, b, c]) => [x + a, y + b, z + PLINTH + c]) });
  return { faces: local.map(frame.xf), footprint: CAST_ARCHETYPES.mannequin.footprint, height: PLINTH + form.stature, scale: form.scale, native: form.native };
}
