/**
 * A WALKER'S PACE BY ITS OWN WALK — a city's realistic people walk the hero's own walk (a gait each, gameworld/street-cast.js),
 * and a walk clip carries the ground it covers: a planted foot slides back under the body at the walk's pace. So a walker
 * advanced by that stride keeps its feet where they land (no skating), and a group walks at the pace its people's walks
 * make together.
 *
 *   walkStride(fig)              → metres a cycle of its walk (`clips.forward`, or `walk`), measured off its planted feet:
 *                                  each foot's slide back through its stance, keyed; null when the figure has no feet to
 *                                  read or its walk plants none (a step in place)
 *   walkerGroups(walkers)        → [[index…]…]: who walks together, a six's pair or single (one loop, one way, one pace,
 *                                  their starts within a step)
 *   paceWalkers(walkers, figures, { base }) → the walkers, each of a group whose figures measure a stride walked at the
 *                                  group's mean natural pace (each member's stride over its cycle, at its height) times the
 *                                  group's own pace (its speed over `base`, the district's walking pace, at half its spread); others as they were
 *
 * Pure.
 */
export const WALK_FEET = Object.freeze(['footL', 'footR']);
const PLANTED = 0.004, LEAST = 0.2;
const r3 = (v) => Math.round(v * 1000) / 1000;

export function walkStride(fig) {
  const C = fig?.clips?.forward ?? fig?.clips?.walk;
  if (!C || !Array.isArray(C.b) || !(C.k > 1) || !Array.isArray(fig.bones)) return null;
  const nb = fig.bones.length, K = C.k, slides = [];
  for (const id of WALK_FEET) {
    const bi = fig.bones.findIndex((b) => b && b.id === id);
    if (bi < 0) return null;
    const at = (k) => { const o = (k * nb + bi) * 7; return [C.b[o + 5], C.b[o + 6]]; }, P = Array.from({ length: K }, (_, k) => at(k)), low = Math.min(...P.map((p) => p[1]));
    let s = 0, n = 0;
    for (let k = 0; k < K; k++) { const a = P[k], b = P[(k + 1) % K]; if (a[1] - low < PLANTED && b[1] - low < PLANTED) { s += b[0] - a[0]; n++; } }
    if (!n) return null;
    slides.push((-s / n) * K);
  }
  const stride = slides.reduce((a, b) => a + b, 0) / slides.length;
  return stride >= LEAST ? r3(stride) : null;
}

export function walkerGroups(walkers) {
  const key = (w) => `${JSON.stringify(w.path?.slice(0, 2))}|${w.speed}`, by = new Map();
  walkers.forEach((w, i) => { if (w && Array.isArray(w.path)) (by.get(key(w)) ?? by.set(key(w), []).get(key(w))).push(i); });
  const out = [];
  for (const list of by.values()) {
    const sorted = list.slice().sort((a, b) => (walkers[a].startFrac ?? 0) - (walkers[b].startFrac ?? 0));
    let g = [sorted[0]];
    for (let j = 1; j < sorted.length; j++) {
      if ((walkers[sorted[j]].startFrac ?? 0) - (walkers[sorted[j - 1]].startFrac ?? 0) <= 0.02) g.push(sorted[j]);
      else { out.push(g); g = [sorted[j]]; }
    }
    out.push(g);
  }
  return out;
}

export function paceWalkers(walkers, figures, { base = 1.35 } = {}) {
  const out = walkers.slice(), natural = (w) => { const f = figures[w.figure], C = f?.clips?.forward; return C && C.stride > 0 && C.s > 0 ? (C.stride * (w.scale > 0 ? w.scale : 1)) / C.s : null; };
  for (const g of walkerGroups(walkers)) {
    const own = g.map((i) => natural(walkers[i]));
    if (own.some((v) => v === null)) continue;
    // (the group's own pace kept at half its spread, so a walk is never played far off its own cadence)
    const mean = own.reduce((a, b) => a + b, 0) / own.length, pace = walkers[g[0]].speed > 0 ? 1 + (walkers[g[0]].speed / base - 1) / 2 : 1;
    for (const i of g) out[i] = { ...walkers[i], speed: r3(mean * pace) };
  }
  return out;
}
