/**
 * THE CLOSED PARTS, PAINTED (docs/side-map-principles.md "The closed parts are painted"): what Jumping Giuseppe's strip
 * never did. Every closed part the camera sees is drawn as its place's FILL (fills.js), designed at the size it is seen
 * at, as MARKS on its face toward the camera: data the build draws and the drawing shows, never geometry of its own.
 *
 *   the FILL        rock: beds level across the whole level (one datum, so a gap shows the same strata either side),
 *                   joints along them, roots near an outdoor top. Built: courses in running bond, a trim under every
 *                   lip. Machine: panels and their seams on one grid. Padded: blocks in a frame, each with its light
 *   the SLICES      a zone's closed parts cut along the way in slices a quarter screen wide, A and B by the walls' rule
 *                   (era/wall-rhythm.js): an A slice carries its fill's motif (a pocket, a niche, a lamp panel, a bolt
 *                   plate), a B slice only the fill, so no stretch repeats
 *   the MIDDLE      a big mass something toward its middle, so it is a mass and not a texture: a vein of ore, a recessed
 *                   panel, a window into the works behind, a great block
 *   the EDGES       a solid's end toward open space lit; its end at a pit the place's own break (teeth bitten out)
 *   the THREADS     the dress's thread (pipes, cables, roots, a channel) carried through the closed parts from one zone into
 *                   the next under the way, up a shaft's wall and down a chute's, drawn wherever it passes behind a face
 *
 *   paintSideMap(layout, dress, { seed? }) → { marks: [{ zone, s0, s1, z0, z1, fill, layer, what }], slices: [{ zone,
 *                     s0, s1, ab }], threads: [{ kind, path: [[s, z], …] }] }   (layer: 1 the fill, 2 a motif or the
 *                     middle, 3 a thread, 4 an edge; drawn over each other in that order)
 *   SLICE            a slice's width, a share of the screen's
 *
 * Pure and deterministic: seeded dice (city/plan/dice.js streamOf).
 */
import { wallRhythm } from '../../era/wall-rhythm.js';
import { streamOf } from '../../city/plan/dice.js';

export const SLICE = 0.25;
const r3 = (v) => Math.round(v * 1000) / 1000;
const BIG = 5, LINE = 0.07, THREAD = 0.32, UNDER = 2.2, BESIDE = 1.3;
const mix = (hex, to, k) => {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16), c = [16, 8, 0].map((s) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};
const THREAD_TONE = { pipes: ['#9aa6b2', 0.35], cables: ['#141418', 0.6], roots: ['#3b2a1e', 0.55], channels: ['#c8d6e0', 0.3] };

/** The closed parts' paint over a laid, dressed map. */
export function paintSideMap(layout, dress, { seed = 1 } = {}) {
  const L = layout, W = L.screen.width, SL = W * SLICE, marks = [], dice = (k) => streamOf(seed, 'side-map-paint', k);
  const mark = (zone, s0, s1, z0, z1, fill, layer, what, r) => {
    const a = Math.max(s0, r.s0), b = Math.min(s1, r.s1), c = Math.max(z0, r.z0), d = Math.min(z1, r.z1);
    if (b - a > 1e-3 && d - c > 1e-3) marks.push({ zone, s0: r3(a), s1: r3(b), z0: r3(c), z1: r3(d), fill, layer, what });
  };
  // the datum: beds, courses and panels level across the whole level
  const zTop = Math.max(...L.swept.map((r) => r.z1)), zLo = Math.min(...L.swept.map((r) => r.z0));
  const beds = [], bd = dice('beds');
  for (let z = Math.ceil(zTop) + 1, k = 0; z > zLo; k++) { const t = 0.6 + 0.7 * bd(); beds.push([z - t, z, k]); z -= t; }
  // the slices, A and B by the walls' rule, a zone at a time
  const slices = [];
  for (const Z of L.zones) {
    const k0 = Math.floor(Z.rect[0] / SL), k1 = Math.ceil(Z.rect[1] / SL), n = Math.max(1, k1 - k0), order = wallRhythm(n, { pick: dice(`slices-${Z.i}`)() }) ?? 'A'.repeat(n);
    for (let k = 0; k < n; k++) slices.push({ zone: Z.i, s0: r3((k0 + k) * SL), s1: r3((k0 + k + 1) * SL), ab: order[k] });
  }
  const pits = L.gaps.filter((g) => g.kind !== 'wall');
  const touches = (r, s) => L.solids.some((o) => o !== r && Math.abs((s === r.s0 ? o.s1 : o.s0) - s) < 1e-3 && o.z0 < r.z1 - 0.5 && o.z1 > r.z0 + 0.5);
  L.solids.forEach((r, i) => {
    const z = dress.zones[r.zone], fam = z.family, d = dice(`solid-${i}`), dark = mix(z.key, '#000000', 0.32), deep = mix(z.key, '#000000', 0.58), light = mix(z.key, '#ffffff', 0.22);
    const M = (s0, s1, z0, z1, fill, layer, what) => mark(r.zone, s0, s1, z0, z1, fill, layer, what, r);
    // the fill
    if (fam === 'rock') {
      for (const [b0, b1, k] of beds) {
        if (b1 < r.z0 || b0 > r.z1) continue;
        if (k % 2) M(r.s0, r.s1, b0, b1, mix(z.key, '#000000', 0.12), 1, 'bed');
        for (let s = Math.floor(r.s0 / 3.5) * 3.5 + 1.5 * ((k * 7) % 3) / 2; s < r.s1; s += 1.5 + 2 * bd()) M(s, s + LINE, b0, b1, dark, 1, 'joint');
      }
      if (!z.indoor) for (let s = r.s0 + 0.4; s < r.s1 - 0.3; s += 0.8 + 0.8 * d()) M(s, s + 0.09, r.z1 - 0.3 - 0.7 * d(), r.z1, deep, 1, 'root');
    } else if (fam === 'built') {
      let k = 0;
      for (let z1 = Math.floor(r.z1 * 2) / 2; z1 > r.z0; z1 -= 0.5, k++) {
        M(r.s0, r.s1, z1 - 0.05, z1, dark, 1, 'course');
        for (let s = Math.floor(r.s0 / 1.3) * 1.3 + (k % 2) * 0.65; s < r.s1; s += 1.3) M(s, s + 0.05, z1 - 0.5, z1, dark, 1, 'stone');
      }
      M(r.s0, r.s1, r.z1 - 0.42, r.z1 - 0.14, light, 1, 'trim');
    } else if (fam === 'machine') {
      for (let s = Math.ceil(r.s0 / 2.4) * 2.4; s < r.s1; s += 2.4) M(s - LINE / 2, s + LINE / 2, r.z0, r.z1, deep, 1, 'seam');
      for (let zz = Math.ceil(r.z0 / 1.6) * 1.6; zz < r.z1; zz += 1.6) M(r.s0, r.s1, zz - LINE / 2, zz + LINE / 2, deep, 1, 'seam');
    } else {
      for (let s = Math.ceil(r.s0 / 1.2) * 1.2; s < r.s1; s += 1.2) M(s - 0.06, s + 0.06, r.z0, r.z1, deep, 1, 'frame');
      for (let zz = Math.ceil(r.z0 / 1.2) * 1.2; zz < r.z1; zz += 1.2) { M(r.s0, r.s1, zz - 0.06, zz + 0.06, deep, 1, 'frame'); M(r.s0, r.s1, zz + 0.06, zz + 0.14, light, 1, 'cushion'); }
    }
    // the A slices' motif, where the solid is tall enough to carry one
    if (r.z1 - r.z0 >= 2.5) for (const sl of slices.filter((x) => x.zone === r.zone && x.ab === 'A' && x.s0 < r.s1 && x.s1 > r.s0)) {
      const a = Math.max(sl.s0, r.s0), b = Math.min(sl.s1, r.s1), c = (a + b) / 2, h = r.z0 + (r.z1 - r.z0) * (0.35 + 0.3 * d());
      if (b - a < 1.6) continue;
      if (fam === 'rock') { M(c - 0.7, c + 0.7, h - 0.4, h + 0.4, deep, 2, 'pocket'); M(c - 0.7, c + 0.7, h - 0.5, h - 0.4, light, 2, 'pocket'); }
      else if (fam === 'built') { M(c - 0.6, c + 0.6, h - 0.9, h + 0.9, deep, 2, 'niche'); M(c - 0.6, c + 0.6, h + 0.9, h + 1.05, light, 2, 'niche'); }
      else if (fam === 'machine') { M(c - 0.8, c + 0.8, h - 0.5, h + 0.5, deep, 2, 'lamp-panel'); M(c - 0.5, c + 0.5, h - 0.2, h + 0.2, z.edge, 2, 'lamp-panel'); }
      else M(c - 0.45, c + 0.45, h - 0.45, h + 0.45, light, 2, 'plate');
    }
    // the middle of a big mass
    const w = r.s1 - r.s0, t = r.z1 - r.z0;
    if (w >= BIG && t >= BIG) {
      const cs = (r.s0 + r.s1) / 2, cz = (r.z0 + r.z1) / 2, m = 0.35 * Math.min(w, t);
      if (fam === 'rock') for (let k = 0; k < 7; k++) M(cs - m / 2 + (k * m) / 7, cs - m / 2 + ((k + 1) * m) / 7, cz - m / 4 + (k * m) / 14, cz - m / 4 + (k * m) / 14 + 0.35, mix(z.edge, '#ffd890', 0.3), 2, 'vein');
      else if (fam === 'built') { M(cs - m / 2, cs + m / 2, cz - m / 2, cz + m / 2, deep, 2, 'recess'); M(cs - m / 2, cs + m / 2, cz + m / 2, cz + m / 2 + 0.18, light, 2, 'recess'); }
      else if (fam === 'machine') {
        M(cs - m / 2 - 0.2, cs + m / 2 + 0.2, cz - m / 3 - 0.2, cz + m / 3 + 0.2, deep, 2, 'window');
        M(cs - m / 2, cs + m / 2, cz - m / 3, cz + m / 3, mix('#ffcf73', z.key, 0.25), 2, 'window');
        M(cs - m / 4, cs - m / 4 + m / 5, cz - m / 3, cz + m / 8, dark, 2, 'works'); M(cs + m / 8, cs + m / 8 + m / 6, cz - m / 3, cz, dark, 2, 'works');
      } else { M(cs - m / 2, cs + m / 2, cz - m / 2, cz + m / 2, deep, 2, 'great-block'); M(cs - m / 2 + 0.15, cs + m / 2 - 0.15, cz - m / 2 + 0.15, cz + m / 2 - 0.15, light, 2, 'great-block'); }
    }
    // the edges: an end toward open space lit; an end at a pit bitten out
    for (const s of [r.s0, r.s1]) {
      const inward = s === r.s0 ? 1 : -1, atPit = pits.some((g) => g.zone === r.zone && Math.abs((inward > 0 ? g.s1 : g.s0) - s) < 1e-3);
      if (atPit) for (let zz = r.z1 - 0.15, k = 0; zz > Math.max(r.z0, r.z1 - 2.4); zz -= 0.3, k++) { if (k % 2) M(Math.min(s, s + inward * 0.28), Math.max(s, s + inward * 0.28), zz - 0.3, zz, deep, 4, 'break'); }
      else if (!touches(r, s)) M(Math.min(s, s + inward * 0.12), Math.max(s, s + inward * 0.12), r.z0, r.z1 - 0.14, mix(z.key, '#ffffff', 0.35), 4, 'edge');
    }
  });
  // the threads: under each run's way, up a shaft's far wall, down a chute's near wall, joined zone to zone
  const kind = dress.threads[0]?.kind ?? 'pipes', path = [];
  for (const Z of L.zones) {
    const [es, ez] = Z.i ? L.zones[Z.i - 1].exit : [0, 0], [xs, xz] = Z.exit, o = L.open.find((r) => r.zone === Z.i);
    if (Z.run === 'up') path.push([es - BESIDE, ez - UNDER], [o ? o.s1 + BESIDE : xs + BESIDE, ez - UNDER], [o ? o.s1 + BESIDE : xs + BESIDE, xz - UNDER]);
    else if (Z.drop === 'chute' && o) path.push([o.s0 - BESIDE, ez - UNDER], [o.s0 - BESIDE, xz - UNDER]);
    else path.push([es, Math.min(ez, xz) - UNDER], [xs, Math.min(ez, xz) - UNDER]);
  }
  const P = path.filter((p, k) => !k || p[0] !== path[k - 1][0] || p[1] !== path[k - 1][1]).map((p) => p.map(r3));
  const [tone, k] = THREAD_TONE[kind] ?? THREAD_TONE.pipes;
  for (let n = 1; n < P.length; n++) {
    const [a, b] = [P[n - 1], P[n]], horiz = Math.abs(a[1] - b[1]) < 1e-6;
    const seg = horiz ? [Math.min(a[0], b[0]), Math.max(a[0], b[0]), a[1] - THREAD / 2, a[1] + THREAD / 2] : [a[0] - THREAD / 2, a[0] + THREAD / 2, Math.min(a[1], b[1]), Math.max(a[1], b[1])];
    // (a step from one height to the next joined by a riser at its end)
    const parts = horiz || Math.abs(a[0] - b[0]) < 1e-6 ? [seg] : [[Math.min(a[0], b[0]), Math.max(a[0], b[0]), a[1] - THREAD / 2, a[1] + THREAD / 2], [b[0] - THREAD / 2, b[0] + THREAD / 2, Math.min(a[1], b[1]), Math.max(a[1], b[1])]];
    for (const [s0, s1, z0, z1] of parts) L.solids.forEach((r) => mark(r.zone, s0, s1, z0, z1, mix(tone, dress.zones[r.zone].key, k), 3, kind, r));
  }
  return { marks, slices, threads: [{ kind, path: P }] };
}

/**
 * THE BACKDROP an outdoor zone stands in front of, by the height it stands at on the map (dress `backdrop`): at the
 * foot the near hills and the far range in the frame, higher up the hills fallen out of it and the range lower, at the
 * top only sky over a low horizon. Each layer stands at its depth (`x`, behind the lane) and is sized so the side map's
 * camera sees it where the frame should (a far thing is drawn as big as it must be to be seen at that share of the
 * frame), and wide enough to fill the frame wherever along the zone the camera stands.
 *   backdropOf(layout, dress, { seed? }) → [{ zone, layer: 'hills' | 'range', x, rects: [{ s0, s1, z0, z1 }], haze }]
 */
export const BACKDROP = Object.freeze({
  hills: Object.freeze({ x: -28, haze: 0.45, crest: { land: 0.22 }, bump: [5, 11], rise: 0.07 }),
  range: Object.freeze({ x: -95, haze: 0.7, crest: { land: 0.5, hills: 0.16, sky: -0.18 }, bump: [12, 26], rise: 0.12 }),
});
export function backdropOf(layout, dress, { seed = 1 } = {}) {
  const L = layout, W = L.screen.width, H = L.screen.height, C = L.camera, out = [];
  for (const z of dress.zones) {
    if (z.indoor || !z.backdrop) continue;
    const Z = L.zones[z.zone], lane = (Z.i ? L.zones[Z.i - 1].exit : [0, 0])[1], zc = lane + C.lookH;
    for (const [layer, B] of Object.entries(BACKDROP)) {
      const u = B.crest[z.backdrop];
      if (u === undefined) continue;
      const f = (C.dist - B.x) / C.dist, d = streamOf(seed, 'side-map-backdrop', `${z.zone}-${layer}`);
      const s0 = Z.rect[0] + W / 2 - (W / 2) * f - 2, s1 = Z.rect[1] - W / 2 + (W / 2) * f + 2, foot = zc - H * f;
      const at = (v) => zc + (lane + v * H - zc) * f, rects = [];
      for (let s = s0; s < s1; ) { const w = (B.bump[0] + (B.bump[1] - B.bump[0]) * d()) * f, top = at(u + B.rise * (d() - 0.5)); rects.push({ s0: r3(s), s1: r3(Math.min(s1, s + w)), z0: r3(foot), z1: r3(top) }); s += w; }
      out.push({ zone: z.zone, layer, x: B.x, rects, haze: B.haze });
    }
  }
  return out;
}
