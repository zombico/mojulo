/**
 * react — how an animal takes a blow: the REACTIONS a beast plays when it is hit, knocked down and back up, built from
 * its own posed body (./pose.js), not authored per species. Each is a one-shot BETWEEN two poses the behavior solver
 * already solves for every legged body, every bone's rotation slerped and its head and tail eased between them:
 *
 *   flinch   the stand, a recoil (dropped low on bent legs, the head thrown up), held through the blow, back to the stand
 *   fall     the stand onto its side, the head to the ground, gathering speed as it goes (a body falling)
 *   rise     the fall played back the other way, slower: from its side up onto its feet
 *
 * A body standing on its legs (four or two: capabilities.js `support`) has them; a legless one (a snake, an octopus)
 * has none yet. Opt-in by a minted animal's `motion` (`reactions`, fauna/rig.js); absent, every species builds
 * byte-identically. Pure and deterministic.
 *
 *   REACTIONS, REACTION_SECONDS
 *   reactsOf(id)                          → the reaction words species `id` has ([] for a legless body)
 *   reactionFrames(id, word, n = 24)      → n frames over the one-shot, 0 … 1 inclusive (a gait frame's shape)
 */
import { prepare, poseStrategy } from './pose.js';
import { capabilitiesOf } from './capabilities.js';

/** The three poses a reaction passes through, by how the body stands. */
const POSES = Object.freeze({
  four: { stand: { support: 'stand', head: 'level' }, recoil: { support: 'crouch', head: 'high' }, down: { support: 'side', head: 'ground' } },
  two: { stand: { support: 'upright', head: 'level' }, recoil: { support: 'crouch', head: 'high' }, down: { support: 'side', head: 'ground' } },
});
const still = (p) => ({ ...p, tail: 'rest', loop: 'stare' });

const smooth = (u) => u * u * (3 - 2 * u);
const snap = (u) => 1 - (1 - u) ** 3;
const fallIn = (u) => u * u;   // a body falling gathers speed

/** The reactions: keys `[t, pose, ease?]` over the one-shot, each span eased by the key it arrives at. */
export const REACTIONS = Object.freeze({
  flinch: [[0, 'stand'], [0.15, 'recoil', snap], [0.45, 'recoil'], [1, 'stand', smooth]],
  fall: [[0, 'stand'], [0.12, 'recoil', snap], [1, 'down', fallIn]],
  rise: [[0, 'down'], [0.55, 'recoil', smooth], [1, 'stand', smooth]],
});
export const REACTION_SECONDS = Object.freeze({ flinch: 0.5, fall: 0.9, rise: 1.3 });

/** The reaction words species `id` has: all of them on legs, none yet without. */
export const reactsOf = (id) => (POSES[capabilitiesOf(id).support] ? Object.keys(REACTIONS) : []);

// ─── blending two posed frames ───────────────────────────────────────────────────────────────────────────────────
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function quatOf(m) {
  const t = m[0][0] + m[1][1] + m[2][2];
  let x, y, z, w;
  if (t > 0) { const s = 0.5 / Math.sqrt(t + 1); w = 0.25 / s; x = (m[2][1] - m[1][2]) * s; y = (m[0][2] - m[2][0]) * s; z = (m[1][0] - m[0][1]) * s; }
  else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = 2 * Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]); w = (m[2][1] - m[1][2]) / s; x = 0.25 * s; y = (m[0][1] + m[1][0]) / s; z = (m[0][2] + m[2][0]) / s; }
  else if (m[1][1] > m[2][2]) { const s = 2 * Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]); w = (m[0][2] - m[2][0]) / s; x = (m[0][1] + m[1][0]) / s; y = 0.25 * s; z = (m[1][2] + m[2][1]) / s; }
  else { const s = 2 * Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]); w = (m[1][0] - m[0][1]) / s; x = (m[0][2] + m[2][0]) / s; y = (m[1][2] + m[2][1]) / s; z = 0.25 * s; }
  const n = Math.hypot(x, y, z, w) || 1;
  return [x / n, y / n, z / n, w / n];
}
function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = d < 0 ? -1 : 1; d *= s;
  if (d > 0.9995) { const q = a.map((v, i) => v + (s * b[i] - v) * t), n = Math.hypot(...q); return q.map((v) => v / n); }
  const th = Math.acos(d), k0 = Math.sin((1 - t) * th) / Math.sin(th), k1 = Math.sin(t * th) / Math.sin(th);
  return a.map((v, i) => k0 * v + k1 * s * b[i]);
}
function rowsOf([x, y, z, w]) {
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
}
/** Two posed frames blended at t: every bone's rotation slerped, its head and tail eased between them. */
function blend(A, B, t) {
  const bones = {};
  for (const [id, a] of Object.entries(A.bones)) {
    const b = B.bones[id];
    bones[id] = { head: lerp3(a.head, b.head, t), tail: lerp3(a.tail, b.tail, t), m: rowsOf(slerp(quatOf(a.m), quatOf(b.m), t)) };
  }
  return { ...A, bones };
}

/** n frames of reaction `word` on species `id`, sampled 0 … 1 inclusive (a one-shot: its last frame is its end). */
export function reactionFrames(id, word, n = 24) {
  const keys = REACTIONS[word];
  if (!keys) throw new Error(`fauna react: no reaction '${word}' (the reactions: ${Object.keys(REACTIONS).join(', ')})`);
  const P = POSES[capabilitiesOf(id).support];
  if (!P) throw new Error(`fauna react: '${id}' has no legs to take a blow on yet (no reactions)`);
  const ctx = prepare(id), posed = Object.fromEntries(Object.entries(P).map(([k, p]) => [k, poseStrategy(ctx, still(p), 0)]));
  const at = (u) => {
    if (u <= keys[0][0]) return posed[keys[0][1]];
    for (let i = 1; i < keys.length; i++) {
      const [t1, to, ease] = keys[i];
      if (u <= t1) {
        // (a span's ends are the solved poses themselves, so a one-shot starts and ends exactly where it says)
        const [t0, from] = keys[i - 1], e = (ease ?? smooth)((u - t0) / (t1 - t0));
        return e <= 0 ? posed[from] : e >= 1 ? posed[to] : blend(posed[from], posed[to], e);
      }
    }
    return posed[keys.at(-1)[1]];
  };
  return Array.from({ length: n }, (_, i) => at(i / (n - 1)));
}
