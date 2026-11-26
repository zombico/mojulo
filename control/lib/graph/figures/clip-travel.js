/**
 * clip-travel — how far one cycle of a gait clip carries its body, measured off the clip itself. A gait is played IN
 * PLACE: the body stands still in its own frame and a planted foot slides back under it exactly as far as the body
 * should move while that foot is down. So a foot's slide over its stance, divided by the share of the cycle the stance
 * lasts, is the cycle's travel (polygonizer/hero-motion.js measures its own gaits so; this reads any packed clip: the
 * hero door's gaits, an outside library's retargeted onto a rig, a beast's own). A body moved that far a cycle plants its
 * feet where the clip does: no skate, no moonwalk.
 *
 *   clipTravel(pack, clip)  → metres a cycle, in the pack's own units (the figure as built, before a body's scale), or
 *                             null where no foot plants (a hover, a flight, a clip of one frame)
 *   feetOf(pack)            → the bones it reads as feet: those nothing hangs from, their rest heads within a sixth of the
 *                             rig's height of its lowest point (a person's ankles and toes, a beast's four)
 *
 * A packed clip is `{ k, b }`: k frames, each bone in the pack's order a rotation and its head (x, y, z), seven numbers
 * a bone a frame, in the figure's native frame (z up, the face to +y). Pure and deterministic.
 */

const N = 7;
// (a foot is planted while its head is within this share of the rig's height of its own lowest point in the cycle)
const PLANT = 0.03;
// (a stance shorter than this share of the cycle is a scuff, not a plant)
const STANCE_MIN = 0.12;

export function feetOf(pack) {
  const B = pack?.bones;
  if (!Array.isArray(B) || !B.length) return [];
  const hasChild = new Set();
  B.forEach((b, i) => { const p = parentOf(B, b, i); if (p >= 0) hasChild.add(p); });
  const zs = B.flatMap((b) => [b.head?.[2] ?? 0, b.tail?.[2] ?? b.head?.[2] ?? 0]);
  const lo = Math.min(...zs), hi = Math.max(...zs), h = Math.max(1e-6, hi - lo);
  return B.map((b, i) => i).filter((i) => !hasChild.has(i) && (B[i].head?.[2] ?? 0) - lo <= h / 6);
}

// a bone's parent: its own index where the pack names it (by id or index), else none
function parentOf(B, b, i) {
  if (Number.isInteger(b.parent)) return b.parent;
  if (typeof b.parent === 'string') return B.findIndex((o) => o.id === b.parent);
  return -1;
}

export function clipTravel(pack, clip) {
  const C = typeof clip === 'string' ? pack?.clips?.[clip] : clip;
  const B = pack?.bones;
  if (!C || !Array.isArray(C.b) || !Array.isArray(B) || !(C.k > 2) || C.b.length < C.k * B.length * N) return null;
  const K = C.k, feet = feetOf(pack);
  if (!feet.length) return null;
  const zs = B.flatMap((b) => [b.head?.[2] ?? 0, b.tail?.[2] ?? 0]), h = Math.max(1e-6, Math.max(...zs) - Math.min(...zs));
  const at = (k, i, c) => C.b[(k * B.length + i) * N + 4 + c];
  const speeds = [];
  for (const i of feet) {
    const z = Array.from({ length: K }, (_, k) => at(k, i, 2)), y = Array.from({ length: K }, (_, k) => at(k, i, 1));
    const floor = Math.min(...z), down = z.map((v) => v - floor <= PLANT * h);
    if (down.every(Boolean) || !down.some(Boolean)) continue;
    // the longest run of planted frames, round the loop's seam
    let best = null;
    for (let s = 0; s < K; s++) {
      if (!down[s] || down[(s - 1 + K) % K]) continue;
      let n = 0;
      while (n < K && down[(s + n) % K]) n++;
      if (!best || n > best.n) best = { s, n };
    }
    if (!best || best.n / K < STANCE_MIN || best.n < 2) continue;
    const y0 = y[best.s], y1 = y[(best.s + best.n - 1) % K];
    const slide = y0 - y1, share = (best.n - 1) / K;
    if (slide > 0 && share > 0) speeds.push(slide / share);
  }
  if (!speeds.length) return null;
  speeds.sort((a, b) => a - b);
  // (the median foot: a toe and its ankle agree; a scuffing toe does not pull the read)
  const m = speeds.length >> 1, v = speeds.length % 2 ? speeds[m] : (speeds[m - 1] + speeds[m]) / 2;
  return Math.round(v * 1e4) / 1e4;
}
