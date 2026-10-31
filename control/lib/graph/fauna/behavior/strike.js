/**
 * strike — how an animal DEALS a blow: the one-shot a beast plays when it attacks, built from its own posed body
 * (./pose.js) as its reactions are (./react.js), never authored per species. It passes through three poses the behavior
 * solver solves for every body that stands:
 *
 *   stand    the rest it strikes from
 *   windup   gathered to spring: a body on legs (four or two) crouched low and drawn back a twelfth of its length (the
 *            anticipation: the spring then covers more ground than the lunge), the head down, the eyes on its mark;
 *            a legless one reared into its strike coil, the front third up in an S
 *   blow     thrown at the mark: a body on legs sprung out of the crouch and lunged forward a fifth of its own length
 *            (the bite, the swipe, the gore, a raptor's slash); a legless one's reared front darted the way its head
 *            points, three head lengths
 *
 * Its TIMING is the attack's, in the action lab's words (feel/kernel.js SPAR; a foe class's attack, foes/vocab.js):
 * `startup` frames (at 60 Hz) gathering and holding the wind-up (the telegraph), `active` frames on the blow (the
 * contact window, where the hit lands), `recovery` frames back to the stand. `strikeWindow(timing)` is that window as a
 * share of the one-shot, so the runtime's contact (a melee slot's `strikeContact`) lands when the clip shows the blow.
 *
 * A body standing on its legs (four or two) or legless on the ground has one; a swimmer and a body crawling on folded
 * wings have none yet. Opt-in by a minted animal's `motion` (`strike`, fauna/rig.js); absent, every species builds
 * byte-identically. Pure and deterministic.
 *
 *   STRIKE_TIMING                 the default timing (a light blow: the lab's jab)
 *   strikesOf(id)                 → ['strike'] when species `id` can strike, else []
 *   strikeTiming(t?)              → the timing read: { startup, active, recovery }, its frames whole and at least 1
 *   strikeSeconds(t?)             → the one-shot's length (s)
 *   strikeWindow(t?)              → [from, to]: the blow's share of the one-shot
 *   strikeFrames(id, t?, n = 24)  → n frames over the one-shot, 0 … 1 inclusive (a gait frame's shape)
 */
import { prepare, poseStrategy } from './pose.js';
import { capabilitiesOf } from './capabilities.js';
import { blend, smooth, snap } from './react.js';

const FPS = 60;
export const STRIKE_TIMING = Object.freeze({ startup: 30, active: 4, recovery: 20 });

/** The three poses a strike passes through, by how the body stands; `lunge` throws the pose's whole body forward (back,
 * when negative) by that share of its own length (a body on legs springs out of its crouch: the head carriage only tilts the head, the
 * reach is the body's); a legless body's dart reaches from its coil. */
const POSES = Object.freeze({
  four: { stand: { support: 'stand', head: 'level' }, windup: { support: 'crouch', head: 'fixed', lunge: -0.08 }, blow: { support: 'stand', head: 'level', lunge: 0.2 } },
  two: { stand: { support: 'stand', head: 'level' }, windup: { support: 'crouch', head: 'fixed', lunge: -0.08 }, blow: { support: 'stand', head: 'level', lunge: 0.2 } },
  none: { stand: { support: 'coil', head: 'forward' }, windup: { support: 'coil-strike', head: 'high' }, blow: { support: 'coil-strike', head: 'forward', dart: 3 } },
});
const still = ({ lunge, dart, ...p }) => ({ ...p, tail: 'rest', loop: 'stare' });
// a posed frame thrown by `v` (metres, x y z): every bone moved, none turned
const thrown = (F, v) => ({ ...F, bones: Object.fromEntries(Object.entries(F.bones).map(([id, b]) => [id, { ...b, head: b.head.map((c, k) => c + v[k]), tail: b.tail.map((c, k) => c + v[k]) }])) });
const lengthOf = (F) => { const ys = Object.values(F.bones).flatMap((b) => [b.head[1], b.tail[1]]); return Math.max(...ys) - Math.min(...ys); };
const posesFor = (id) => { const c = capabilitiesOf(id); return c && (c.support === 'none' ? (c.legless ? POSES.none : null) : POSES[c.support]) || null; };

const SOLVED = new Map();
// the three poses solved once per species, or null when its body cannot take one of them
function posed(id) {
  if (SOLVED.has(id)) return SOLVED.get(id);
  const P = posesFor(id);
  let out = null;
  if (P) {
    try {
      const ctx = prepare(id);
      out = Object.fromEntries(Object.entries(P).map(([k, p]) => [k, poseStrategy(ctx, still(p), 0)]));
      for (const k of ['windup', 'blow']) if (P[k].lunge) out[k] = thrown(out[k], [0, P[k].lunge * lengthOf(out.stand), 0]);
      // (a legless dart: the reared front thrown the way its head points, `dart` head lengths, level)
      if (P.blow.dart) {
        const h = out.windup.bones.head, d = [h.tail[0] - h.head[0], h.tail[1] - h.head[1]], n = Math.hypot(d[0], d[1]) || 1, L = Math.hypot(...h.tail.map((c, k) => c - h.head[k]));
        out.blow = thrown(out.windup, [(d[0] / n) * L * P.blow.dart, (d[1] / n) * L * P.blow.dart, 0]);
      }
    } catch { out = null; }
  }
  SOLVED.set(id, out);
  return out;
}

export const strikesOf = (id) => (posed(id) ? ['strike'] : []);

export function strikeTiming(t) {
  const T = { ...STRIKE_TIMING, ...(t && typeof t === 'object' ? t : {}) };
  for (const k of ['startup', 'active', 'recovery']) if (!(Number.isInteger(T[k]) && T[k] >= 1 && T[k] <= 600)) throw new Error(`fauna strike: ${k} is whole frames at 60 Hz, 1 to 600 (not ${T[k]})`);
  return { startup: T.startup, active: T.active, recovery: T.recovery };
}
const total = (T) => T.startup + T.active + T.recovery;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
export const strikeSeconds = (t) => r4(total(strikeTiming(t)) / FPS);
export function strikeWindow(t) {
  const T = strikeTiming(t), n = total(T);
  return [r4(T.startup / n), r4((T.startup + T.active) / n)];
}

/** The strike's keys `[t, pose, ease?]`: gathered by most of the startup and held to its end, snapped onto the blow, held
 * through the active frames, eased home over the recovery. */
function keysOf(T) {
  const n = total(T), s = T.startup / n, a = T.active / n;
  return [[0, 'stand'], [s * 0.7, 'windup', smooth], [s, 'windup'], [s + a * 0.5, 'blow', snap], [s + a, 'blow'], [1, 'stand', smooth]];
}

export function strikeFrames(id, t, n = 24) {
  const P = posed(id);
  if (!P) throw new Error(`fauna strike: '${id}' cannot strike yet (a swimmer and a body on folded wings have no strike)`);
  const keys = keysOf(strikeTiming(t));
  const at = (u) => {
    for (let i = 1; i < keys.length; i++) {
      const [t1, to, ease] = keys[i];
      if (u <= t1) {
        const [t0, from] = keys[i - 1], e = t1 > t0 ? (ease ?? smooth)((u - t0) / (t1 - t0)) : 1;
        return e <= 0 ? P[from] : e >= 1 ? P[to] : blend(P[from], P[to], e);
      }
    }
    return P.stand;
  };
  return Array.from({ length: n }, (_, i) => at(i / (n - 1)));
}
