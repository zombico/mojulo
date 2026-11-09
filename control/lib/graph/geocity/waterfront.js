/**
 * THE METRO'S WATERFRONT — its shores RECLAIMED: a strip of new ground laid out into the water along each shore, so the
 * water does not stop at a wall at the city's edge but is met by a harbourfront. On its main shore (the one its land
 * falls toward) a waterfront boulevard runs along the strip's back under the lakeshore expressway; out past it the strip
 * is cut along its length into SEGMENTS, each its own way of meeting the water, a promenade along the whole of its edge:
 *
 *   quay       a granite plaza to a quay wall, bollards on its coping, trees in rows, a terminal pavilion, a tour boat moored
 *   pier       the quay's plaza, and finger piers out over the water on piles, a pier shed or a restaurant on each, boats
 *              moored along them
 *   dining     restaurant pavilions along the promenade, their patios out front (tables under parasols), planters, a kiosk
 *   park       a lawn under trees, its paths, benches, the edge a rock revetment down into the water, a lookout
 *   beach      sand under pink parasols and loungers, a boardwalk behind it, the sand running down into the water
 *   marina     a clubhouse and its lot, pontoons combed out into the water at the water's level, boats in their slips
 *   steps      timber terraces stepping down to the water (to sit by it), a lawn and its trees behind, chairs on it
 *
 * Its ELEVATION: the boulevard at the land's edge on the land's own ground, the strip falling (or stepping, in terraces
 * walled between) to its promenade a little over the water, its edges down to the water by its kind: a wall, rocks,
 * sand, steps, pontoons at the water's own level, piers on piles at the promenade's.
 *
 *   WATERFRONT      the numbers: the strip's depth (main and other shores), the boulevard, the promenade, the quay's
 *                   height over the water, the segments' lengths and weights
 *   waterfrontOf(d) → [{ side, main, edge, a0, a1, boulevard?: { t0, t1, lanes }, segments: [{ kind, a0, a1, depth,
 *                   piers?: [{ a, w, len }] }] }]: each water side's strip, `t` metres out from the land's edge
 *   frameOf(W)      → { P(a, t) → [x, y], along: 'x' | 'y', out: [dx, dy] }: a strip's frame in the design's
 *   waterfrontTemplates(L) → { parasol, patio, lounger, bollard, rail: { x, y }, pile, planter, boat: { sail, motor,
 *                   ferry } each { x, y } }: its kit under the scene's light (a parasol's canopy and a lounger pale for a
 *                   tint, a boat's hull too)
 *   waterfrontLaws(d) → [{ law, ok, value }]: its strips cover their shores, a promenade over the water
 *
 * Metres, the design's frame. Pure; the metro's dice.
 */
import { streamOf } from '../city/plan/dice.js';
import { litFactor, scaleHex } from '../polygonizer/vexar.js';

const r2 = (v) => Math.round(v * 100) / 100 + 0, r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
export const WATERFRONT = Object.freeze({
  depth: { main: [170, 230], other: [70, 110] }, boulevard: { t0: 8, t1: 36, road: 16, lanes: 2 }, promenade: 10, quay: 1.8,
  length: [150, 270],
  kinds: { main: { quay: 2, pier: 2, dining: 2, park: 2, beach: 1, marina: 1.5, steps: 1 }, other: { park: 3, beach: 2, steps: 1, marina: 1, dining: 1 } },
  pier: { w: [16, 22], len: [70, 130] }, marina: 90,
});
export const WATERFRONT_KINDS = Object.freeze(['quay', 'pier', 'dining', 'park', 'beach', 'marina', 'steps']);

/** A strip's frame: `a` along its shore, `t` out from the land's edge into the water. */
export function frameOf(W) {
  const s = W.side, e = W.edge;
  if (s === 's') return { along: 'x', out: [0, -1], P: (a, t) => [a, e - t] };
  if (s === 'n') return { along: 'x', out: [0, 1], P: (a, t) => [a, e + t] };
  if (s === 'w') return { along: 'y', out: [-1, 0], P: (a, t) => [e - t, a] };
  return { along: 'y', out: [1, 0], P: (a, t) => [e + t, a] };
}

const pick = (R, w) => { const ks = Object.keys(w), sum = ks.reduce((a, k) => a + w[k], 0); let u = R() * sum; for (const k of ks) { u -= w[k]; if (u <= 0) return k; } return ks[ks.length - 1]; };

/** Each water side's reclaimed strip: its boulevard on the main shore, its segments along it. */
export function waterfrontOf(d) {
  const Wf = d.metro.waterfront;
  if (Wf === false || !d.water.length) return [];
  const [lx0, ly0, lx1, ly1] = d.land.rect, sides = d.water.map((w) => w.side), main = sides.includes(d.metro.fall?.toward) ? d.metro.fall.toward : sides[0];
  return sides.map((side) => {
    const isMain = side === main, R = streamOf(d.seed, 'waterfront', side), edge = side === 's' ? ly0 : side === 'n' ? ly1 : side === 'w' ? lx0 : lx1;
    const [a0, a1] = side === 's' || side === 'n' ? [lx0, lx1] : [ly0, ly1], D = WATERFRONT.depth[isMain ? 'main' : 'other'], K = WATERFRONT.kinds[isMain ? 'main' : 'other'];
    // its segments: lengths by the dice, a kind each (never the same twice running), a depth each about its shore's
    const segments = [];
    let a = a0, last = null;
    while (a < a1 - 1) {
      let len = WATERFRONT.length[0] + (WATERFRONT.length[1] - WATERFRONT.length[0]) * R();
      if (a1 - (a + len) < WATERFRONT.length[0] * 0.6) len = a1 - a;
      let kind = pick(R, K);
      for (let k = 0; k < 4 && kind === last; k++) kind = pick(R, K);
      const depth = r2(D[0] + (D[1] - D[0]) * R()), seg = { kind, a0: r2(a), a1: r2(a + len), depth };
      // (a pier segment's piers out over the water: one or two, each its width and length)
      if (kind === 'pier') {
        const n = len > 200 ? 2 : 1, P = WATERFRONT.pier;
        seg.piers = Array.from({ length: n }, (_, k) => ({ a: r2(a + (len * (k + 1)) / (n + 1)), w: r2(P.w[0] + (P.w[1] - P.w[0]) * R()), len: r2(P.len[0] + (P.len[1] - P.len[0]) * R()) }));
      }
      segments.push(seg);
      a += len; last = kind;
    }
    return { side, main: isMain, edge, a0, a1, ...(isMain ? { boulevard: { ...WATERFRONT.boulevard } } : {}), segments };
  });
}

/** The waterfront's laws: each strip's segments cover its shore end to end, its kinds more than one, its promenade
 *  over the water. */
export function waterfrontLaws(d) {
  const Ws = d.waterfront ?? [];
  if (!Ws.length) return [];
  const gaps = Ws.filter((W) => W.segments.some((s, k) => k && Math.abs(s.a0 - W.segments[k - 1].a1) > 0.01) || Math.abs(W.segments[0].a0 - W.a0) > 0.01 || Math.abs(W.segments.at(-1).a1 - W.a1) > 0.01);
  const kinds = new Set(Ws.flatMap((W) => W.segments.map((s) => s.kind))), area = Ws.reduce((s, W) => s + W.segments.reduce((b, g) => b + (g.a1 - g.a0) * g.depth, 0), 0);
  return [{ law: 'waterfront', ok: !gaps.length && kinds.size >= Math.min(3, Ws.reduce((a, W) => a + W.segments.length, 0)), value: `${Ws.length} shore${Ws.length === 1 ? '' : 's'} reclaimed, ${Math.round(area / 1e4)} ha: ${[...kinds].join(', ')}${gaps.length ? `; a gap along ${gaps.map((W) => W.side).join(', ')}` : ''}`, want: 'each shore met end to end, its ways of meeting the water more than one' }];
}

// ── its kit, lit: each piece about its foot, `x` lying along x ──────────────────────────────────────────────────────
const F = (corners, normal, hex) => ({ corners, normal, hex });
function boxU(x0, y0, z0, x1, y1, z1, hex) {
  return [
    F([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], hex),
    F([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], hex), F([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0], hex),
    F([[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], [0, 1, 0], hex), F([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], [-1, 0, 0], hex),
  ];
}
function cylU(cx, cy, r, z0, z1, n, hex) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, b = ((i + 1) / n) * Math.PI * 2, m = (a + b) / 2; out.push(F([[cx + r * Math.cos(a), cy + r * Math.sin(a), z0], [cx + r * Math.cos(b), cy + r * Math.sin(b), z0], [cx + r * Math.cos(b), cy + r * Math.sin(b), z1], [cx + r * Math.cos(a), cy + r * Math.sin(a), z1]], [Math.cos(m), Math.sin(m), 0], hex)); }
  out.push(F(Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * Math.PI * 2), cy + r * Math.sin((i / n) * Math.PI * 2), z1]), [0, 0, 1], hex));
  return out;
}
const lit = (faces, L) => faces.map((f) => ({ corners: f.corners.map((c) => c.map(r4)), normal: f.normal.map(r4), fill: scaleHex(f.hex, litFactor(f.normal, L)) }));
const turn = (faces) => faces.map((f) => ({ corners: f.corners.map(([x, y, z]) => [-y, x, z]), normal: [-f.normal[1], f.normal[0], f.normal[2]], hex: f.hex }));
const both = (u, L) => ({ x: lit(u, L), y: lit(turn(u), L) });

const PALE = '#f4f4f2', WOOD = '#8a6a48', DARK = '#2b2d2f', STEEL = '#8d9398';
/** A parasol: its pole, its canopy an eight-sided cone (pale, for its tint). */
function parasol() {
  const out = [...cylU(0, 0, 0.04, 0, 2.4, 6, '#d9d6cf')], r = 1.5, n = 8;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, b = ((i + 1) / n) * Math.PI * 2, m = (a + b) / 2; out.push(F([[r * Math.cos(a), r * Math.sin(a), 2.1], [r * Math.cos(b), r * Math.sin(b), 2.1], [0, 0, 2.6]], [Math.cos(m) * 0.32, Math.sin(m) * 0.32, 0.95], PALE)); }
  return out;
}
/** A patio set: a round table, four chairs. */
function patio() {
  const out = [...cylU(0, 0, 0.45, 0.72, 0.76, 10, '#e9e5dc'), ...cylU(0, 0, 0.05, 0, 0.72, 6, DARK)];
  // (each chair its seat, its back on its far side from the table)
  for (const [x, y] of [[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]]) {
    out.push(...boxU(x - 0.22, y - 0.22, 0.42, x + 0.22, y + 0.22, 0.46, '#5a5e63'));
    const sx = Math.sign(x), sy = Math.sign(y);
    out.push(...(sx ? boxU(x + sx * 0.18 - 0.02, y - 0.22, 0.46, x + sx * 0.18 + 0.02, y + 0.22, 0.9, '#5a5e63') : boxU(x - 0.22, y + sy * 0.18 - 0.02, 0.46, x + 0.22, y + sy * 0.18 + 0.02, 0.9, '#5a5e63')));
  }
  return out;
}
/** A lounger, a Muskoka chair's slant (pale, for its tint). */
function lounger() {
  return [...boxU(-0.35, -0.9, 0.3, 0.35, 0.3, 0.38, PALE), F([[-0.35, 0.3, 0.38], [0.35, 0.3, 0.38], [0.35, 0.75, 1.05], [-0.35, 0.75, 1.05]], [0, -0.83, 0.55], PALE), ...boxU(-0.42, -0.9, 0, -0.35, 0.6, 0.62, PALE), ...boxU(0.35, -0.9, 0, 0.42, 0.6, 0.62, PALE)];
}
/** A mooring bollard: a squat iron post, its cap. */
const bollard = () => [...cylU(0, 0, 0.18, 0, 0.5, 8, DARK), ...cylU(0, 0, 0.26, 0.5, 0.6, 8, DARK)];
/** A railing's 3 m along x: two posts, a top rail, two wires. */
function rail() {
  return [...boxU(-0.03, -0.03, 0, 0.03, 0.03, 1.1, STEEL), ...boxU(2.97, -0.03, 0, 3.03, 0.03, 1.1, STEEL), ...boxU(0, -0.04, 1.05, 3, 0.04, 1.12, STEEL), ...boxU(0, -0.01, 0.4, 3, 0.01, 0.42, STEEL), ...boxU(0, -0.01, 0.75, 3, 0.01, 0.77, STEEL)];
}
/** A timber pile: a metre of it (an instance's scale stretches it up). */
const pile = () => cylU(0, 0, 0.2, 0, 1, 8, '#5b4a38');
/** A planter: its box, its shrub. */
const planter = () => [...boxU(-0.6, -0.6, 0, 0.6, 0.6, 0.6, '#7c776e'), ...boxU(-0.5, -0.5, 0.6, 0.5, 0.5, 1.2, '#4f6b3a')];
/** A boat along x: its hull (pale, for its tint) tapered at its bow, its cabin; a sailboat its mast, a ferry its decks. */
function boat(kind) {
  const L = kind === 'ferry' ? 30 : kind === 'sail' ? 10 : 8, W = kind === 'ferry' ? 8 : kind === 'sail' ? 3.2 : 2.8, H = kind === 'ferry' ? 2.4 : 1.2, h = L / 2, w = W / 2, bow = L * 0.18;
  const out = [
    F([[-h, -w, H], [h - bow, -w, H], [h, 0, H], [h - bow, w, H], [-h, w, H]], [0, 0, 1], '#e8e2d2'),
    F([[-h, -w, -0.4], [h - bow, -w, -0.4], [h - bow, -w, H], [-h, -w, H]], [0, -1, 0], PALE), F([[h - bow, w, -0.4], [-h, w, -0.4], [-h, w, H], [h - bow, w, H]], [0, 1, 0], PALE),
    F([[h - bow, -w, -0.4], [h, 0, -0.1], [h, 0, H], [h - bow, -w, H]], [0.8, -0.6, 0], PALE), F([[h, 0, -0.1], [h - bow, w, -0.4], [h - bow, w, H], [h, 0, H]], [0.8, 0.6, 0], PALE),
    F([[-h, w, -0.4], [-h, -w, -0.4], [-h, -w, H], [-h, w, H]], [-1, 0, 0], PALE),
  ];
  if (kind === 'ferry') out.push(...boxU(-h + 2, -w + 0.6, H, h - bow - 1, w - 0.6, H + 2.6, '#f1f1ee'), ...boxU(-h + 6, -w + 1.2, H + 2.6, h - bow - 4, w - 1.2, H + 4.6, '#e9e9e4'), ...boxU(h - bow - 7, -1.2, H + 4.6, h - bow - 4, 1.2, H + 6, '#3d4a57'));
  else out.push(...boxU(-h * 0.5, -w * 0.6, H, h * 0.25, w * 0.6, H + (kind === 'sail' ? 0.9 : 1.3), '#f1f1ee'), ...boxU(-h * 0.1, -w * 0.62, H + 0.5, h * 0.22, w * 0.62, H + 0.8, '#3d4a57'));
  if (kind === 'sail') out.push(...cylU(h * 0.1, 0, 0.07, H, H + 12, 6, '#d6d6d6'), ...boxU(-h * 0.7, -0.05, H + 1.6, h * 0.1, 0.05, H + 1.75, '#d6d6d6'));
  return out;
}

const MEMO = new WeakMap();
/** The waterfront's kit under a scene's light, once a light. */
export function waterfrontTemplates(L) {
  let T = MEMO.get(L);
  if (T) return T;
  T = { parasol: lit(parasol(), L), patio: lit(patio(), L), lounger: lit(lounger(), L), bollard: lit(bollard(), L), pile: lit(pile(), L), planter: lit(planter(), L), rail: both(rail(), L), boat: { sail: both(boat('sail'), L), motor: both(boat('motor'), L), ferry: both(boat('ferry'), L) } };
  MEMO.set(L, T);
  return T;
}
// the parasols' colours (a beach's pink, a patio's), the loungers' and the boats' hulls
export const WATERFRONT_PAINT = Object.freeze({ beach: ['#e78fb3', '#f2a7c3'], patio: ['#2f5d8a', '#c4362c', '#e9e2cf', '#3d7a4a', '#c98b2b'], lounger: ['#c4362c', '#2f5d8a', '#e3b13a', '#3d7a4a', '#f2efe6'], hull: ['#f4f4f2', '#2a3f6a', '#c4362c', '#e9e2cf'] });
