/**
 * glyph-forms.spike-lib — spike-side face transforms + compat wrappers for the
 * game-UI-language harvests (glyph-* spikes). SPIKE SUPPORT, not engine code:
 * nothing imports this outside *.spike.gen.test.js. The form shelf itself is
 * PROMOTED — geometry lives in glyph-forms.js (game-ui-language.plan.md, U1).
 */
import { GLYPH_IDS, glyphFormFaces } from './glyph-forms.js';

// ── face transforms (the effect kernels, Node-side for the harvests) ────────
export const mapCorners = (faces, f) => faces.map((face) => ({ ...face, corners: face.corners.map(f) }));
export const translate = (faces, [dx, dy, dz]) => mapCorners(faces, ([x, y, z]) => [x + dx, y + dy, z + dz]);
export const spinZ = (faces, ang) => {
  const c = Math.cos(ang), s = Math.sin(ang);
  return mapCorners(faces, ([x, y, z]) => [x * c - y * s, x * s + y * c, z]);
};
export const scaleAbout = (faces, k, cz) => mapCorners(faces, ([x, y, z]) => [x * k, y * k, cz + (z - cz) * k]);

const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgb2hex = (r) => `#${r.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')}`;
export const blendHex = (a, b, t) => rgb2hex(hex2rgb(a).map((c, i) => c + (hex2rgb(b)[i] - c) * t));
export const tintFaces = (faces, to, t) =>
  faces.map((f) => ({ ...f, fill: typeof f.fill === 'string' && /^#[0-9a-fA-F]{6}$/.test(f.fill) ? blendHex(f.fill, to, t) : f.fill }));

// ── the form shelf — PROMOTED to glyph-forms.js (game-ui-language.plan.md U1). ──
// The spikes keep their zero-arg `FORMS.gem()` convention; geometry now comes from
// the registry so spike evidence and engine bodies can never drift apart.
export { circlePts } from './glyph-forms.js';
export const FORMS = Object.fromEntries(GLYPH_IDS.map((id) => [id, () => glyphFormFaces(id)]));

/** A uniform ground patch centered at [cx, cy] — identical per filmstrip cell so frames register. */
export function groundPatch(cx, cy, half = 3, tile = 2) {
  const faces = [];
  for (let x = -half; x < half; x += tile) {
    for (let y = -half; y < half; y += tile) {
      faces.push({
        corners: [[cx + x, cy + y, 0], [cx + x + tile, cy + y, 0], [cx + x + tile, cy + y + tile, 0], [cx + x, cy + y + tile, 0]],
        fill: '#39404d',
      });
    }
  }
  return faces;
}
