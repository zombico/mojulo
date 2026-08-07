/**
 * figure-animal-mane — a lion's mane as a FEW bold locks (anime/Boruto hair), not
 * dense fringe. Each lock is a flat, tapered, flicked blade — wide-ish at the scalp,
 * sweeping to a sharp point, curved by a sideways flick — built as a ring-stack so it
 * shades and depth-sorts with the body. A small collar of these around the neck (a
 * longer crest on top, shorter at the throat) frames the face like a mane.
 *
 * Pure: returns STAND-space render parts `{polylines, stroke}`; buildAnimal includes
 * them before planting. Knobs are the lock size/curl/count — turn count DOWN for the
 * chunky stylised look, UP toward a fuller mane.
 */
import { normalize3, sub3, cross3 } from './figure-vajra.js';

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const lerp3 = (a, b, t) => add(a, mul(sub3(b, a), t));
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rnd = (k) => { let x = k >>> 0; x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };

export const MANE_DEFAULT = {
  anchorT: 0.55,    // where along neckHub→headBase the collar sits (higher = nearer the head)
  radius: 0.095,    // collar radius off the neck (STAND) — wide enough to frame the face
  out: 1.0, back: 0.22, rise: 0.12,  // lock aim: RADIATE outward (a ruff), slight back
  hang: 0,          // gravity: downward bias on every lock → the mane DRAPES over the face
  len: 0.19,        // base lock length (STAND)
  width: 0.06, thick: 0.02,          // lock half-width / half-thickness at the belly (bold)
  tip: 0.04,        // tip half-width fraction: ~0 = sharp point, ↑ = blunt rounded lobe
  flick: 0.3,       // sideways curl of the tip (the anime flick)
  crest: 0.35,      // how much longer the top locks are than the throat
  // a few well-placed locks: an outer ring + a smaller offset inner ring
  rings: [{ count: 13, radScale: 1.0, lenScale: 1.0 }, { count: 9, radScale: 0.66, lenScale: 0.72, phase: 0.5 }],
  color: '#9a6a3f', N: 6, M: 8,
};

// One flat, tapered, flicked lock as a ring-stack.
function maneLock(base, dir, len, cfg, seed) {
  const up = { x: 0, y: 0, z: 1 };
  const axis = normalize3(dir);
  let fan = cross3(axis, up); if (Math.hypot(fan.x, fan.y, fan.z) < 1e-6) fan = { x: 1, y: 0, z: 0 };
  fan = normalize3(fan);
  const thin = normalize3(cross3(axis, fan));
  const flick = (rnd(seed) - 0.5) * 2 * cfg.flick;       // sideways curl, random sign
  const rings = [];
  for (let i = 0; i < cfg.N; i++) {
    const t = i / (cfg.N - 1);
    const p = t < 0.2 ? 0.5 + 0.5 * (t / 0.2) : 1 - (1 - cfg.tip) * ((t - 0.2) / 0.8);   // belly then taper toward the tip (cfg.tip = bluntness)
    // flick (sideways) + hang (gravity droop) both grow toward the tip (∝ t²), so the
    // root stays welded to the collar and the lock bends/falls as it extends.
    const c = add(add(add(base, mul(axis, len * t)), mul(fan, flick * len * t * t)), { x: 0, y: 0, z: -cfg.hang * len * t * t });
    const hw = cfg.width * p, ht = cfg.thick * p, poly = [];
    for (let j = 0; j <= cfg.M; j++) { const a = (j / cfg.M) * Math.PI * 2; poly.push(add(c, add(mul(fan, hw * Math.cos(a)), mul(thin, ht * Math.sin(a))))); }
    rings.push(poly);
  }
  return { polylines: rings, stroke: cfg.color };
}

/**
 * Build a lion's mane collar around the neck.
 * @param {object} nodes  armature (needs neckHub, headBase)
 * @param {{anchor,dir}} head  the head frame (unused here but kept for parity)
 * @param {object} [cfg]  MANE_DEFAULT
 */
export function lionMane(nodes, head, cfg = {}) {
  const c = { ...MANE_DEFAULT, ...cfg };
  if (!nodes.neckHub || !nodes.headBase) return [];
  const axis = normalize3(sub3(nodes.headBase, nodes.neckHub));   // neck direction (toward the face)
  const anchor = lerp3(nodes.neckHub, nodes.headBase, c.anchorT);
  const up = { x: 0, y: 0, z: 1 };
  let u = cross3(axis, up); if (Math.hypot(u.x, u.y, u.z) < 1e-6) u = { x: 1, y: 0, z: 0 };
  u = normalize3(u);
  const v = normalize3(cross3(axis, u));
  const parts = [];
  for (let ri = 0; ri < c.rings.length; ri++) {
    const ring = c.rings[ri], phase = (ring.phase || 0) * (Math.PI * 2) / ring.count;
    for (let k = 0; k < ring.count; k++) {
      const theta = (k / ring.count) * Math.PI * 2 + phase;
      const radial = add(mul(u, Math.cos(theta)), mul(v, Math.sin(theta)));
      const upness = dot(radial, up) * 0.5 + 0.5;                 // 0 throat … 1 crest
      const base = add(anchor, mul(radial, c.radius * ring.radScale));
      const dir = normalize3(add(add(mul(radial, c.out), mul(axis, -c.back)), mul(up, c.rise)));   // out + sweep back + up (gravity droop is applied along the lock, see maneLock)
      const seed = hash(`${ri}:${k}:${theta.toFixed(3)}`);
      const len = c.len * ring.lenScale * (1 - c.crest * 0.5 + c.crest * upness) * (0.85 + 0.3 * rnd(seed + 1));
      parts.push(maneLock(base, dir, len, c, seed));
    }
  }
  return parts;
}
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
