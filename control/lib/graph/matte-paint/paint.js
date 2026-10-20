/**
 * PAINT — the lit relief coloured the way a matte painter lays it in: the value the light gives (light.js, 1 the
 * material's own) picks a stop on the material's ramp, so the lit side takes the ramp's lighter, warmer stops and the
 * shade its darker, cooler ones; then layers of paint sampled from other ramps go over it where the relief says they
 * would gather. Every colour comes from a ramp (five stops, dark to light: a cube's ramps, era/geocube.js geocubeRamps,
 * or a solved palette's); nothing is a flat hex laid on top.
 *
 *   ramp      the material: the value picks its stop, `contrast` how far from the middle the light reaches
 *   mottle    the colour one ramp lacks: large patches (`scale` m) where a second `ramp` shows by up to `amount`, and a
 *             tonal drift of up to `tone` stops
 *   fleck     mineral grains: tiny dots on a `size` m grid at `density`, each a lighter or darker stop of the material
 *   damp      the foot of the face darker by up to `amount` stops, rising a quarter of the way up
 *   dirt      a `ramp` that settles in the hollows (`cavity`) and toward the foot (`foot`), by up to `amount`
 *   moss      a `ramp` on what faces up (lips, the top arris), in patches, by up to `amount` (opt-in)
 *
 * `grit` (0–1) raises the mottle's drift, the dirt and the flecks with the relief. A layer that is absent adds nothing.
 *
 *   paintRelief(field, lit, paint, { grit, seed }) → an RGBA Buffer, W·H·4, cut by the outline (alpha 0 outside)
 */
import { fractal2, smoothstep } from '../noise/noise.js';
import { hash01 } from './relief.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/** A ramp's colour at t (0 its darkest stop, 1 its lightest), straight between stops. */
export function rampAt(ramp, t) {
  const s = clamp(t, 0, 1) * (ramp.length - 1), i = Math.min(ramp.length - 2, Math.floor(s)), f = s - i, a = ramp[i], b = ramp[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
const mix = (a, b, m) => [a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m, a[2] + (b[2] - a[2]) * m];

export function paintRelief({ W, H, px, inside }, { value, up, cavity }, P, { grit, seed }) {
  const out = Buffer.alloc(W * H * 4), Hm = H * px, M = P.mottle, Fk = P.fleck, D = P.dirt, Ms = P.moss;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, d = inside[k];
    if (d <= -px) continue;
    const x = (i + 0.5) * px, y = (j + 0.5) * px, foot = y / Hm;
    const v = d > 0 ? value[k] : 1;
    let t = 0.5 + (v - 1) * P.contrast;
    if (M) t += fractal2(x / M.scale, y / M.scale, { seed: seed + 41, octaves: 3 })[0] * M.tone * (0.5 + 0.5 * grit);
    if (P.damp) t -= P.damp.amount * smoothstep(0.75, 1, foot);
    let c = rampAt(P.ramp, t);
    if (M && M.ramp) {
      const m = smoothstep(0.05, 0.55, fractal2(x / M.scale + 9.3, y / M.scale - 4.1, { seed: seed + 43, octaves: 3 })[0]) * M.amount;
      if (m > 0) c = mix(c, rampAt(M.ramp, t), m);
    }
    if (Fk) {
      const cell = Fk.size, ci = Math.floor(x / cell), cj = Math.floor(y / cell);
      if (hash01(ci, cj, seed + 47) < Fk.density * (0.5 + 0.5 * grit)) {
        const fx = (ci + 0.5) * cell, fy = (cj + 0.5) * cell, r = cell * 0.45;
        if ((x - fx) * (x - fx) + (y - fy) * (y - fy) < r * r) c = rampAt(P.ramp, t + (hash01(ci, cj, seed + 53) < 0.5 ? -0.15 : 0.15));
      }
    }
    if (D) {
      const m = clamp((d > 0 ? cavity[k] : 0) * D.cavity + smoothstep(0.55, 1, foot) * D.foot, 0, 1) * D.amount * (0.3 + 0.7 * grit);
      if (m > 0) c = mix(c, rampAt(D.ramp, t * 0.75), m);
    }
    if (Ms && d > 0) {
      const m = smoothstep(0.25, 0.7, up[k]) * smoothstep(0.1, 0.6, fractal2(x / 0.06, y / 0.06, { seed: seed + 59, octaves: 3 })[0] + 0.3) * Ms.amount;
      if (m > 0) c = mix(c, rampAt(Ms.ramp, t), m);
    }
    const o = k * 4;
    out[o] = clamp(Math.round(c[0]), 0, 255); out[o + 1] = clamp(Math.round(c[1]), 0, 255); out[o + 2] = clamp(Math.round(c[2]), 0, 255);
    out[o + 3] = Math.round(255 * clamp(d / px + 0.5, 0, 1));
  }
  return out;
}
