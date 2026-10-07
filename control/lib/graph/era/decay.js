/**
 * DECAY — a level gone derelict, by cause. A stage whose style card carries `decay` takes `decay` on its recipe: a
 * number 0–1 (every event at that strength) or { collapse?, leak?, breach?, blackout?, abandon?, seed? } (each 0–1,
 * absent = 0). Each event is a cause, and everything messy it leaves has a place it came from:
 *
 *   collapse  a bay of roof came down        abandon   time, and the evacuation
 *   leak      a pipe burst at a wall          blackout  the power failed
 *   breach    the set piece broke
 *
 * `resolveDecay` → plan.decay = { k, seed, picks }: how hard each event hit, and WHERE (picks) — chosen here from the
 * rooms and the kit's bays alone, so the shell, the dressing and the dirt all read the same story. Dice are hash3.
 */
import { hash3 } from './dirt.js';

export const DECAY_EVENTS = Object.freeze(['collapse', 'leak', 'breach', 'blackout', 'abandon']);

/** The recipe's `decay` → { k: { event: 0–1 }, seed } | null. Throws on a shape it can't read. */
export function readDecay(decay) {
  if (decay === undefined || decay === null || decay === false || decay === 0) return null;
  const bad = () => new Error(`stage: decay must be a number 0–1 or { ${DECAY_EVENTS.join(', ')}, seed } each 0–1`);
  if (typeof decay === 'number') {
    if (!(decay >= 0 && decay <= 1)) throw bad();
    return { k: Object.fromEntries(DECAY_EVENTS.map((e) => [e, decay])), seed: 1 };
  }
  if (typeof decay !== 'object' || Array.isArray(decay)) throw bad();
  for (const key of Object.keys(decay)) if (key !== 'seed' && !DECAY_EVENTS.includes(key)) throw bad();
  const k = Object.fromEntries(DECAY_EVENTS.map((e) => [e, decay[e] ?? 0]));
  if (!Object.values(k).every((v) => typeof v === 'number' && v >= 0 && v <= 1)) throw bad();
  if (decay.seed !== undefined && !Number.isInteger(decay.seed)) throw bad();
  return Object.values(k).some((v) => v > 0) ? { k, seed: decay.seed ?? 1 } : null;
}

/**
 * WHERE each event happened, per room: the collapse's bay (along the room's long run, never the way-in's bay nor the
 * set piece's), the leak's wall and the point along it (never the portal's wall), and the breach's crack (the side
 * the tank split toward).
 */
export function pickDecay(plan, D, seed) {
  return plan.rooms.map((r, ri) => {
    const w = r.x1 - r.x0, d = r.y1 - r.y0, alongY = d >= w, run = alongY ? d : w, n = Math.max(1, Math.round(run / plan.kit.bay));
    const mid = Math.floor(n / 2), ok = [...Array(n).keys()].filter((k) => k > 0 && k !== mid && !(n % 2 === 0 && k === mid - 1));
    const bay = ok.length ? ok[Math.floor(hash3(seed, ri, 8101) * ok.length)] : 0;
    const walls = ['-y', '+x', '+y', '-x'].filter((s) => !r.open.includes(s) && !(D.portal && D.portal.side === s));
    const wall = walls[Math.floor(hash3(seed, ri, 8103) * walls.length)];
    const along = 0.2 + 0.6 * hash3(seed, ri, 8105);
    return { collapse: { bay, n, alongY }, leak: { wall, along }, breach: { toward: hash3(seed, ri, 8107) * 2 * Math.PI } };
  });
}
