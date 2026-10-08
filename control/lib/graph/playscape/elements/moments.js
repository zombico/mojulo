/**
 * playscape moments — what a PUFF is: a moment at a place or at a character's feet that plays once and is gone (the
 * cast's `puff { is }`, state.moments). Each kind is sprays (elements.js: the same particles a look drifts, here thrown
 * once from t = 0) and at most one of each:
 *
 *   star    a starburst at the middle, swelling and gone ({ size, life, z }): an impact's flash
 *   bolt    lightning from the sky onto the spot, struck again `flicks` times ({ h, life, flicks, width })
 *   ring    a ring on the ground, spreading ({ r, life, dark? }: dark is a scorch)
 *   light   a flash of light ({ k, life, z, delay? })
 *
 * `key` marks the spray (or star) a puff's `color` paints. The page runs strikeBolt's own source.
 *
 *   MOMENTS / PUFFS        the kinds · MOMENT_KEYS: the parts a puff's colour paints
 *   momentSpec(is, color)  a kind with a colour laid on its key parts
 *   strikeBolt(at, h, n)   the n-th strike's nodes from h above the spot down to it: [{ nodes, t, w }] (trunk, 2 forks)
 */
import { readSpray, readColor, colorRGB } from './elements.js';

const S = (o) => readSpray(o, 'moment');
export const MOMENTS = Object.freeze({
  smoke: { dur: 1.2, parts: [S({ glyph: 'soft', count: 16, from: 'shell', r: 0.25, z: [0.1, 0.9], v: 1.3, el: [-10, 40], gravity: -0.5, life: 1.1, grow: 1.7, size: 0.55, env: 'out', color: [0.86, 0.86, 0.88] })] },
  dust: { dur: 1.5, parts: [
    S({ glyph: 'soft', count: 18, from: 'ground', r: 0.3, z: 0.1, v: 1.5, el: [0, 12], life: 1.4, grow: 2.2, size: 0.45, env: 'out', color: [0.66, 0.58, 0.47] }),
    S({ glyph: 'chip', count: 12, from: 'point', z: 0.1, v: 2.6, el: [40, 80], gravity: 9.8, life: 0.9, spin: 2, size: 0.06, env: 'steady', color: [0.45, 0.39, 0.31] }),
  ] },
  splash: { dur: 1.4, ring: { r: 1.1, life: 0.7 }, parts: [
    S({ glyph: 'drop', count: 28, from: 'ground', r: 0.15, z: 0.05, v: 3.8, el: [55, 85], gravity: 9.8, life: 1.1, size: 0.09, env: 'steady', rings: true, color: [0.7, 0.86, 1] }),
    S({ glyph: 'soft', count: 8, from: 'ground', r: 0.2, z: 0.15, v: 0.8, el: [20, 70], life: 0.7, grow: 1.5, size: 0.4, env: 'out', color: [0.9, 0.95, 1] }),
  ] },
  flash: { dur: 0.6, star: { size: 2.2, life: 0.3, z: 1, key: true }, light: { k: 3, life: 0.25, z: 1 }, parts: [
    S({ glyph: 'streak', count: 14, from: 'point', z: 1, v: 11, el: [-25, 45], life: 0.26, size: 0.13, env: 'out', color: [1, 0.97, 0.85] }),
  ] },
  strike: { dur: 1.0, bolt: { h: 14, life: 0.55, flicks: 3, width: 0.045 }, light: { k: 6, life: 0.5, z: 2 }, star: { size: 1.3, life: 0.22, z: 0.2 }, ring: { r: 0.9, life: 0.9, dark: true }, parts: [
    S({ glyph: 'spark', count: 22, from: 'point', z: 0.05, v: 4.5, el: [20, 70], gravity: 9.8, life: 0.75, size: 0.1, env: 'out', color: [0.85, 0.92, 1] }),
    S({ glyph: 'soft', count: 8, from: 'ground', r: 0.2, z: 0.1, v: 1, el: [0, 20], life: 0.9, grow: 1.6, size: 0.4, env: 'out', color: [0.55, 0.53, 0.5] }),
  ] },
  sparks: { dur: 1.0, light: { k: 1.5, life: 0.3, z: 0.6 }, parts: [
    S({ glyph: 'streak', count: 30, from: 'point', z: 0.6, v: 5, el: [-10, 70], gravity: 9.8, life: 0.9, size: 0.09, env: 'out', color: [1, 0.7, 0.3] }),
  ] },
  fireworks: { dur: 3.0, light: { k: 2.5, life: 0.7, z: 5.6, delay: 0.62 }, parts: [
    S({ glyph: 'dot', count: 1, trail: 8, lag: 0.03, from: 'point', z: 0.1, go: [0, 0, 9], life: 0.62, size: 0.3, env: 'steady', color: [1, 0.85, 0.6] }),
    S({ glyph: 'spark', count: 60, trail: 6, lag: 0.022, from: 'point', z: 5.6, v: 5.5, el: [-90, 90], gravity: 2, life: 1.9, size: 0.3, env: 'out', delay: 0.62, color: [1, 0.35, 0.55] }),
    S({ glyph: 'dot', count: 24, trail: 4, lag: 0.02, from: 'point', z: 5.6, v: 2.6, el: [-90, 90], gravity: 2, life: 1.4, size: 0.22, env: 'out', delay: 0.62, color: [1, 0.95, 0.85] }),
  ] },
});
// the parts a puff's colour paints
export const MOMENT_KEYS = Object.freeze({ smoke: [0], dust: [0], splash: [0], flash: [0], strike: [0], sparks: [0], fireworks: [1] });
export const PUFFS = Object.freeze(Object.keys(MOMENTS));

/** A kind with a colour laid on its key parts (no colour: as it is). */
export function momentSpec(is, color) {
  const M = MOMENTS[is];
  if (!M || color === undefined || color === null) return M;
  const c = colorRGB(readColor(color, 'puff.color'));
  return { ...M, parts: M.parts.map((p, i) => (MOMENT_KEYS[is].includes(i) ? { ...p, color: c } : p)), ...(M.star && M.star.key ? { star: { ...M.star, color: c } } : {}) };
}

/** The n-th strike of a bolt from h above `at` down to it: a trunk of 14 kinked nodes, two forks off it. Seeded by n. */
export function strikeBolt(at, h, n) {
  const fr = (x) => x - Math.floor(x), hs = (a, b) => fr(Math.sin(a * 12.9898 + b * 78.233 + n * 37.719) * 43758.5453);
  const N = 14, nodes = [], t = [];
  let x = (hs(1, 1) - 0.5) * 3, y = (hs(1, 2) - 0.5) * 3;
  for (let k = 0; k < N; k++) {
    const u = k / (N - 1);
    if (k) { x += (hs(k, 3) - 0.5) * 1.1 * (1 - u * 0.7); y += (hs(k, 4) - 0.5) * 1.1 * (1 - u * 0.7); }
    const pull = u * u;   // the trunk lands on the spot
    nodes.push([at[0] + x * (1 - pull), at[1] + y * (1 - pull), at[2] + h * (1 - u)]);
    t.push(0.55 + 0.45 * u);
  }
  const out = [{ nodes, t, w: 1 }];
  for (let f = 0; f < 2; f++) {
    const k0 = 3 + Math.floor(hs(f, 5) * 6), o = nodes[k0], a = hs(f, 6) * 6.283185307179586, fn = [], ft = [];
    for (let k = 0; k < 6; k++) { const u = k / 5; fn.push([o[0] + Math.cos(a) * 2.2 * u + (hs(k, 7 + f) - 0.5) * 0.5, o[1] + Math.sin(a) * 2.2 * u + (hs(k, 9 + f) - 0.5) * 0.5, o[2] - h * 0.22 * u]); ft.push(0.45 * (1 - 0.8 * u)); }
    out.push({ nodes: fn, t: ft, w: 0.8 });
  }
  return out;
}
