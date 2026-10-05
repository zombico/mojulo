/**
 * LAB TILES — the research lab's own painted surfaces (RGB, seamless both ways), registered as the `lab:` resolver.
 *
 *   lab:vct     vinyl composition tile: 4 × 4 tiles per repeat, pale grey with a few of a second, bluer grey laid at
 *               random, each speckled with chips, a thin dark joint, scuffed
 *   lab:panel   a painted steel wall panel: off-white, a faint mottle and horizontal brushing, a recessed seam round
 *               its edge (a dark line and a lit bevel), a screw in each corner
 *   lab:deck    the roof deck over the trusses: corrugated steel, ribs lit on one flank and dark on the other
 *   lab:grate   floor grating: a lattice of steel bars over the dark of the trench under it
 *   lab:hazard  hazard stripes: yellow and black at 45°, the paint worn through to steel at the edges and in patches
 *   lab:screen  a monitor's picture: a dark blue field, a header bar, columns of text lines, a graph trace
 *   lab:rack    a server rack's face: dark units stacked, each with a vent grille, drive bays and a few status lights
 *   lab:board   a whiteboard: white, a ruled frame of marker diagrams — boxes and arrows, a curve, lines of notes
 *
 * `labTexture(key)` → data:image/png. Deterministic: mulberry32 from the key.
 */
import { encodePng, registerTextureResolver } from '../landscape/surface-textures.js';
import { mulberry32 } from '../vegetation/grow.js';

const SIZE = 256;
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const wrap = (v) => ((v % SIZE) + SIZE) % SIZE;
function put(rgb, x, y, c, k = 1) { const o = (wrap(y) * SIZE + wrap(x)) * 3; for (let q = 0; q < 3; q++) rgb[o + q] = clamp(c[q] * k); }
function get(rgb, x, y) { const o = (wrap(y) * SIZE + wrap(x)) * 3; return [rgb[o], rgb[o + 1], rgb[o + 2]]; }
function shade(rgb, x, y, k) { put(rgb, x, y, get(rgb, x, y), k); }
// a smooth seamless value noise at `cells` per side
function noise(R, cells) {
  const g = Array.from({ length: cells * cells }, () => R());
  return (x, y) => {
    const u = (x / SIZE) * cells, v = (y / SIZE) * cells, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const at = (a, b) => g[(((b % cells) + cells) % cells) * cells + (((a % cells) + cells) % cells)];
    const s = (t) => t * t * (3 - 2 * t);
    return (at(i, j) * (1 - s(fu)) + at(i + 1, j) * s(fu)) * (1 - s(fv)) + (at(i, j + 1) * (1 - s(fu)) + at(i + 1, j + 1) * s(fu)) * s(fv);
  };
}

const PAINTERS = {
  vct(rgb, R) {
    const T = SIZE / 4, A = [196, 198, 196], B = [168, 178, 190], n = noise(R, 8);
    for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
      const base = R() < 0.22 ? B : A, tone = 0.94 + 0.1 * R();
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        const X = tx * T + x, Y = ty * T + y, edge = x === 0 || y === 0 ? 0.62 : x === 1 || y === 1 ? 0.9 : 1;
        put(rgb, X, Y, base, tone * edge * (0.95 + 0.08 * n(X, Y)));
      }
    }
    for (let i = 0; i < 5200; i++) { const x = (R() * SIZE) | 0, y = (R() * SIZE) | 0, k = R() < 0.6 ? 0.72 : 1.12; shade(rgb, x, y, k); }   // the chips
    for (let i = 0; i < 26; i++) {   // scuffs: short dark arcs where a shoe turned
      const cx = R() * SIZE, cy = R() * SIZE, r = 4 + 10 * R(), a0 = R() * 6.28, len = 0.6 + R();
      for (let t = 0; t < len; t += 0.04) shade(rgb, Math.round(cx + r * Math.cos(a0 + t)), Math.round(cy + r * Math.sin(a0 + t)), 0.82);
    }
  },
  panel(rgb, R) {
    const n = noise(R, 6), C = [214, 216, 212];
    for (let y = 0; y < SIZE; y++) {
      const brush = 0.985 + 0.03 * R();
      for (let x = 0; x < SIZE; x++) put(rgb, x, y, C, brush * (0.93 + 0.1 * n(x, y)) * (0.99 + 0.02 * R()));
    }
    for (let i = 0; i < SIZE; i++) {   // the seam: a dark line at the edge, a lit bevel inside it, a soft shadow beyond
      for (const [x, y, k] of [[i, 0, 0.42], [0, i, 0.42], [i, 1, 0.7], [1, i, 0.7], [i, 2, 1.1], [2, i, 1.1], [i, SIZE - 1, 0.8], [SIZE - 1, i, 0.8]]) shade(rgb, x, y, k);
    }
    for (const [cx, cy] of [[10, 10], [SIZE - 10, 10], [10, SIZE - 10], [SIZE - 10, SIZE - 10]]) {   // the screws
      for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const d = x * x + y * y; if (d <= 9) shade(rgb, cx + x, cy + y, d > 5 ? 0.6 : 0.9 + 0.08 * (-x - y) / 3); }
      for (let t = -2; t <= 2; t++) shade(rgb, cx + t, cy, 0.55);
    }
  },
  deck(rgb, R) {
    const n = noise(R, 5), P = 32;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const p = (x % P) / P, rib = p < 0.35 ? 1.0 : p < 0.5 ? 0.62 : p < 0.85 ? 0.82 : 1.12;
      put(rgb, x, y, [118, 122, 126], rib * (0.9 + 0.14 * n(x, y)));
    }
  },
  grate(rgb, R) {
    for (let i = 0; i < SIZE * SIZE; i++) { const k = 0.8 + 0.4 * R(); rgb[i * 3] = 22 * k; rgb[i * 3 + 1] = 24 * k; rgb[i * 3 + 2] = 26 * k; }   // the dark under it
    const S = 16;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const bx = x % S, by = y % (S * 2);
      if (bx < 3) put(rgb, x, y, [136, 140, 144], bx === 0 ? 1.15 : bx === 2 ? 0.7 : 1);          // bearing bars
      else if (by < 2) put(rgb, x, y, [120, 124, 128], by === 0 ? 1.1 : 0.75);                   // cross bars
    }
  },
  hazard(rgb, R) {
    const n = noise(R, 10), W = 32;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const yellow = Math.floor((x + y) / W) % 2 === 0, worn = n(x, y) > 0.86 && R() < 0.55;
      const c = worn ? [120, 118, 112] : yellow ? [226, 182, 38] : [34, 32, 30];
      put(rgb, x, y, c, 0.9 + 0.12 * R());
    }
  },
  screen(rgb, R) {
    for (let i = 0; i < SIZE * SIZE; i++) { rgb[i * 3] = 10; rgb[i * 3 + 1] = 28; rgb[i * 3 + 2] = 54; }
    const box = (x0, y0, x1, y1, c) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) put(rgb, x, y, c); };
    box(0, 0, SIZE, 22, [40, 110, 170]);                                            // the header bar
    for (let col = 0; col < 2; col++) for (let ln = 0; ln < 14; ln++) {              // text lines
      const x0 = 12 + col * 120, y0 = 34 + ln * 10, w = 30 + R() * 70;
      box(x0, y0, x0 + w, y0 + 4, R() < 0.15 ? [230, 190, 80] : [120, 200, 230]);
    }
    let py = 210;                                                                     // a graph trace along the foot
    for (let x = 10; x < SIZE - 10; x++) { py = Math.max(184, Math.min(240, py + (R() - 0.5) * 8)); box(x, py, x + 1, py + 2, [110, 240, 160]); }
  },
  rack(rgb, R) {
    for (let i = 0; i < SIZE * SIZE; i++) { rgb[i * 3] = 30; rgb[i * 3 + 1] = 32; rgb[i * 3 + 2] = 36; }
    const box = (x0, y0, x1, y1, c, k = 1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) put(rgb, x, y, c, k); };
    for (let u = 0; u < 8; u++) {   // eight units, each 32 px: a lit top edge, a grille, drive bays, lights
      const y0 = u * 32;
      box(4, y0 + 1, SIZE - 4, y0 + 31, [48, 50, 56]); box(4, y0 + 1, SIZE - 4, y0 + 2, [86, 90, 98]);
      for (let x = 10; x < 120; x += 4) box(x, y0 + 8, x + 2, y0 + 26, [18, 18, 20]);
      for (let b = 0; b < 6; b++) box(130 + b * 19, y0 + 7, 130 + b * 19 + 16, y0 + 27, [62, 64, 70]);
      for (let l = 0; l < 3; l++) box(242, y0 + 8 + l * 7, 248, y0 + 12 + l * 7, R() < 0.7 ? [90, 230, 110] : [240, 180, 60]);
    }
  },
  board(rgb, R) {
    for (let i = 0; i < SIZE * SIZE; i++) { const k = 0.97 + 0.03 * R(); rgb[i * 3] = 236 * k; rgb[i * 3 + 1] = 238 * k; rgb[i * 3 + 2] = 236 * k; }
    const ink = [[40, 60, 160], [30, 30, 34], [170, 40, 40]];
    const line = (x0, y0, x1, y1, c) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let t = 0; t <= n; t++) { const x = Math.round(x0 + ((x1 - x0) * t) / n), y = Math.round(y0 + ((y1 - y0) * t) / n); put(rgb, x, y, c); put(rgb, x + 1, y, c); } };
    for (let i = 0; i < 4; i++) {   // boxes joined by arrows
      const x = 16 + i * 60, y = 30 + ((R() * 30) | 0), c = ink[i % 2];
      line(x, y, x + 40, y, c); line(x + 40, y, x + 40, y + 24, c); line(x + 40, y + 24, x, y + 24, c); line(x, y + 24, x, y, c);
      if (i < 3) { line(x + 40, y + 12, x + 60, y + 12, c); line(x + 54, y + 7, x + 60, y + 12, c); line(x + 54, y + 17, x + 60, y + 12, c); }
    }
    let py = 180; for (let x = 20; x < 140; x++) { const ny = 200 - 60 * Math.exp(-(((x - 80) / 22) ** 2)) + (R() - 0.5) * 2; line(x - 1, py, x, ny | 0, ink[2]); py = ny | 0; }   // a peak
    line(20, 210, 140, 210, ink[1]); line(20, 130, 20, 210, ink[1]);
    for (let l = 0; l < 9; l++) { const y = 120 + l * 12, w = 30 + R() * 60; for (let x = 160; x < 160 + w; x += 3) line(x, y + ((R() * 3) | 0), x + 2, y + ((R() * 3) | 0), ink[1]); }
  },
};

export const LAB_KEYS = Object.freeze(Object.keys(PAINTERS).map((k) => `lab:${k}`));
const built = {};
export function labTexture(key) {
  if (built[key]) return built[key];
  const paint = PAINTERS[key.slice(4)]; if (!paint) return null;
  let h = 2166136261; for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rgb = Buffer.alloc(SIZE * SIZE * 3); paint(rgb, mulberry32(h >>> 0));
  return (built[key] = `data:image/png;base64,${encodePng(rgb, SIZE, SIZE).toString('base64')}`);
}

registerTextureResolver('lab:', labTexture);
