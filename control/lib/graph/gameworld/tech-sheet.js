/**
 * TECH SHEET — a crafted thing drawn as the engine will shade it: its faces z-buffered, its light baked per corner
 * from its smoothing (tech-shading.js), so a round reads round and a chamfer reads hard. The bible's plates paint
 * each face flat (era/out-structures-draw.js); this is the preview the depiction is judged on, a contact sheet of
 * things side by side, at one viewpoint. The eyes gate looks at it; nothing here measures.
 *
 *   SHEET_EYES                                  named viewpoints: front (three-quarter from the nose), rear, side
 *   techRaster(faces, { w, h, eye, base })      → Uint8Array (RGB), one thing fitted to its tile
 *   techSheet(tiles, { cols, w, h })            → { width, height, rgb }: tiles of RGB laid in rows
 *   GROUP_TINT                                  the base colour a surface group is drawn in, by its value
 *
 * Pure; no dice, no I/O (a script writes the bytes: scripts/tech-sheet.mjs).
 */
import { bakeCorners } from './tech-shading.js';

/** Viewpoints, as a direction from the thing toward the eye (z up, the thing's nose along +x). */
export const SHEET_EYES = Object.freeze({ front: [1, -0.85, 0.5], rear: [-1, -0.9, 0.62], side: [0.15, -1, 0.12] });
/** The tint a group is drawn in (its value scales it): a neutral grey, the glass dark blue, the accent warm. */
export const GROUP_TINT = Object.freeze({ 'tech:team': [200, 50, 43], 'str:accent': [255, 200, 90], 'tech:glass': [70, 110, 140], 'tech:light': [240, 230, 200] });
const NEUTRAL = [176, 168, 150], BACK = 236;

const hex = (rgb) => '#' + rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** A face's base colour: its group's tint, darkened by its value. */
export const baseOf = (f) => { const t = GROUP_TINT[f.group] ?? NEUTRAL, k = 0.35 + 0.65 * (f.value ?? 0.6); return hex(t.map((c) => c * k)); };
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function techRaster(faces, { w = 420, h = 360, eye = SHEET_EYES.front, base = baseOf } = {}) {
  // a flat face gets its own normal at each corner, so one bake shades both
  const lit = bakeCorners(faces.map((f) => (f.cornerNormals ? f : { ...f, cornerNormals: f.corners.map(() => f.outNormal ?? [0, 0, 1]) })), { base });
  const f = unit(eye.map((x) => -x)), r = unit(cross(f, [0, 0, 1])), u = cross(r, f);
  const dot = (p, a) => p[0] * a[0] + p[1] * a[1] + p[2] * a[2];
  const pts = lit.flatMap((x) => x.corners), xs = pts.map((p) => dot(p, r)), ys = pts.map((p) => dot(p, u));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), s = 0.9 * Math.min(w / (x1 - x0 || 1), h / (y1 - y0 || 1));
  const pr = (p) => [w / 2 + s * (dot(p, r) - (x0 + x1) / 2), h / 2 - s * (dot(p, u) - (y0 + y1) / 2), -dot(p, f)];
  const img = new Uint8Array(w * h * 3).fill(BACK), z = new Float64Array(w * h).fill(-Infinity);
  for (const F of lit) {
    const c = F.corners.map(pr), C = F.cornerFills.map(rgbOf);
    for (let i = 1; i + 1 < c.length; i++) {
      const T = [c[0], c[i], c[i + 1]], K = [C[0], C[i], C[i + 1]];
      const d = (T[1][1] - T[2][1]) * (T[0][0] - T[2][0]) + (T[2][0] - T[1][0]) * (T[0][1] - T[2][1]);
      if (Math.abs(d) < 1e-9) continue;
      const lx = Math.max(0, Math.floor(Math.min(T[0][0], T[1][0], T[2][0]))), hx = Math.min(w - 1, Math.ceil(Math.max(T[0][0], T[1][0], T[2][0])));
      const ly = Math.max(0, Math.floor(Math.min(T[0][1], T[1][1], T[2][1]))), hy = Math.min(h - 1, Math.ceil(Math.max(T[0][1], T[1][1], T[2][1])));
      for (let y = ly; y <= hy; y++) for (let x = lx; x <= hx; x++) {
        const a = ((T[1][1] - T[2][1]) * (x - T[2][0]) + (T[2][0] - T[1][0]) * (y - T[2][1])) / d, b = ((T[2][1] - T[0][1]) * (x - T[2][0]) + (T[0][0] - T[2][0]) * (y - T[2][1])) / d, g = 1 - a - b;
        if (a < 0 || b < 0 || g < 0) continue;
        const zz = a * T[0][2] + b * T[1][2] + g * T[2][2], o = y * w + x;
        if (zz <= z[o]) continue;
        z[o] = zz;
        for (let k = 0; k < 3; k++) img[o * 3 + k] = Math.round(a * K[0][k] + b * K[1][k] + g * K[2][k]);
      }
    }
  }
  return img;
}

/** Tiles (each `w × h` RGB) laid in rows of `cols`, white between them. */
export function techSheet(tiles, { cols = 3, w = 420, h = 360 } = {}) {
  const c = Math.min(cols, Math.max(1, tiles.length)), rows = Math.ceil(tiles.length / c), width = w * c, height = h * rows, rgb = new Uint8Array(width * height * 3).fill(255);
  tiles.forEach((t, i) => { const ox = (i % c) * w, oy = Math.floor(i / c) * h; for (let y = 0; y < h; y++) rgb.set(t.subarray(y * w * 3, (y + 1) * w * 3), ((oy + y) * width + ox) * 3); });
  return { width, height, rgb };
}
