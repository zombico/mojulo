/**
 * THE AUTHORED HAND (the hero's authored body, any form but the realistic): the same hand as the realistic body's (hero-hand.js:
 * the palm `hand<S>`, the digits `thumb<S>` … `little<S>`, the same joints), on the authored forearm, whose rings are few
 * and coarse. The glove's cuff up it is new rings sampled along the forearm's shell between the wrist and the cuff's
 * share (the plating library's fair shell, read round), stood off by the leather, each ring's weights mixed from the
 * forearm's rings either side.
 *
 *   authoredHand(recipe, R) → the adapter (../index.js)
 *   handwearAuthored(recipe, R, spec, { id, group }) → wearHandwear on it
 *
 * Pure and deterministic.
 */
import { wearHandwear } from '../expand.js';
import { rigHandJoints } from './realistic.js';
import { fairShell } from '../../plating/shell.js';
import { mean, unitv } from '../../footwear/parts.js';
import { ringSlots } from '../../polygonizer/body-relational-resample.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6;
/** each segment's `u` at its far end (the palm's and the digits' stations carry none: their index) */
const U_MAX = { foreArm: 2, hand: 3, thumb: 4, index: 4, middle: 4, ring: 4, little: 4 };

/** a cuff up the forearm `P` from `u0` to its wrist (`u` 2): `k` rings sampled round its shell, `n` points each, stood off
 * by `thick`, each ring's weights the forearm's rings' either side, mixed by where it falls */
function cuffOn(P, u0, thick, { n = 12, group }) {
  const F = fairShell(P), U = P.stations.map((st, i) => st.u ?? i), u1 = U[U.length - 1], k = Math.max(3, Math.ceil((u1 - u0) * 4) + 2), names = ringSlots(n), own = { [P.bind.bone]: 1 };
  const weightsAt = (u) => { let i = 0; while (i < U.length - 2 && U[i + 1] < u) i++; const f = Math.min(1, Math.max(0, (u - U[i]) / ((U[i + 1] - U[i]) || 1))), out = {};
    for (const [w, x] of [[P.bind.blend?.[P.stations[i].id] ?? own, 1 - f], [P.bind.blend?.[P.stations[i + 1].id] ?? own, f]]) for (const [b, v] of Object.entries(w)) out[b] = (out[b] ?? 0) + v * x;
    // (the four heaviest, rounded, the heaviest taking what rounding left so they sum to one)
    const top = Object.entries(out).filter(([, v]) => v > 1e-6).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 4), tot = top.reduce((t, [, v]) => t + v, 0);
    const w = top.map(([b, v]) => [b, r6(v / tot)]); w[0][1] = 1 - w.slice(1).reduce((t, [, v]) => t + v, 0);
    return Object.fromEntries(w); };
  const stations = Array.from({ length: k }, (_, i) => {
    const u = u0 + ((u1 - u0) * i) / (k - 1), ring = names.map((_, j) => F.at(u, (P.slots.length * j) / n).p), c = mean(ring);
    return { id: `st${i}`, u, points: Object.fromEntries(names.map((nm, j) => { const d = unitv(ring[j].map((x, q) => x - c[q])); return [nm, ring[j].map((x, q) => r6(x + d[q] * thick))]; })) };
  });
  const mid = (st) => mean(Object.values(st.points)), end = (a, b) => { const c = mid(a), r = names.reduce((t, nm) => t + Math.hypot(...a.points[nm].map((x, q) => x - c[q])), 0) / n, d = unitv(c.map((x, q) => x - mid(b)[q])); return c.map((x, q) => r6(x + d[q] * r / 3)); };
  const blend = Object.fromEntries([...stations.map((st) => [st.id, weightsAt(st.u)]), ['back', weightsAt(u0)], ['tip', weightsAt(u1)]]);
  return { layer: 1, closure: 'closed', garment: true, slots: names, stations, caps: { back: end(stations[0], stations[1]), tip: end(stations[k - 1], stations[k - 2]) }, ...(group ? { group } : {}), bind: { bone: P.bind.bone, blend } };
}

export function authoredHand(recipe, R) {
  return {
    sides: ['R', 'L'],
    seg: (kind, S) => (recipe.parts[`${kind}${S}`] ? `${kind}${S}` : null),
    ...rigHandJoints(recipe, R),
    bare: (name) => recipe.parts[name],
    cuff: (glove, { id, group }) => Object.fromEntries(['R', 'L'].filter((S) => recipe.parts[`foreArm${S}`]).map((S) => [`${id}_foreArm${S}`, cuffOn(recipe.parts[`foreArm${S}`], 2 - 2 * glove.cuff, glove.thick ?? 0.0025, { group })])),
    u: (kind, share) => (U_MAX[kind] ?? 4) * share,
  };
}

/** The handwear on the authored body. */
export const handwearAuthored = (recipe, R, spec = 'gloves', opts = {}) => wearHandwear(authoredHand(recipe, R), spec, opts);
