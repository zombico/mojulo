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
 *   strikeFrames(id, t?, n = 24, way?)  → n frames over the one-shot, 0 … 1 inclusive (a gait frame's shape)
 *
 * THE WAYS a beast goes at a foe (a party battle's beast, egocube/moves.js beastMovesOf): the same three poses and the
 * same keys, each way its own poses and its own timing, so a fight is not one blow over and over. Each is a clip of its
 * own name, opt-in by the motion's `strikes` (fauna/rig.js); absent, nothing:
 *
 *   strike   the lunge (above): crouched and drawn back, sprung forward a fifth of its length
 *   snap     the quick bite: barely gathered, the eyes on the mark, thrown forward an eighth; a legless one's short dart
 *   maul     the heavy blow: reared up and drawn back (a four-footed body on its hind legs, a two-footed one tall),
 *            brought down low and forward a quarter of its length; a legless body has none
 *   roar     the display: gathered low, then up tall with the head high and held there (the blow held long), no reach;
 *            a legless one reared in its coil, its head high
 *   channel  the gathering before a power goes off: drawn in, then hunkered low, the head down and still, held long; a
 *            legless one reared slowly in its coil, its head forward
 *
 *   STRIKE_WAYS                   the ways, 'strike' first; WAY_TIMING each one's default timing
 *   strikeWaysOf(id)              → the ways species `id` can take (none for a body that cannot strike)
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
// (the other ways: snap, maul and roar, by how the body stands; null where the body has no such way)
const WAY_POSES = Object.freeze({
  snap: {
    four: { stand: POSES.four.stand, windup: { support: 'stand', head: 'fixed', lunge: -0.03 }, blow: { support: 'stand', head: 'level', lunge: 0.12 } },
    two: { stand: POSES.two.stand, windup: { support: 'stand', head: 'fixed', lunge: -0.03 }, blow: { support: 'stand', head: 'level', lunge: 0.12 } },
    none: { stand: POSES.none.stand, windup: { support: 'coil-strike', head: 'forward' }, blow: { support: 'coil-strike', head: 'forward', dart: 1.5 } },
  },
  maul: {
    four: { stand: POSES.four.stand, windup: { support: 'rear', head: 'high', lunge: -0.06 }, blow: { support: 'crouch', head: 'low', lunge: 0.25 } },
    two: { stand: POSES.two.stand, windup: { support: 'stand', head: 'high', lunge: -0.08 }, blow: { support: 'crouch', head: 'low', lunge: 0.25 } },
    none: null,
  },
  roar: {
    four: { stand: POSES.four.stand, windup: { support: 'crouch', head: 'low', lunge: -0.04 }, blow: { support: 'stand', head: 'high', lunge: 0.02 } },
    two: { stand: POSES.two.stand, windup: { support: 'crouch', head: 'low', lunge: -0.04 }, blow: { support: 'stand', head: 'high', lunge: 0.02 } },
    none: { stand: POSES.none.stand, windup: { support: 'coil', head: 'forward' }, blow: { support: 'coil-strike', head: 'high' } },
  },
  channel: {
    four: { stand: POSES.four.stand, windup: { support: 'stand', head: 'fixed', lunge: -0.03 }, blow: { support: 'crouch', head: 'low', lunge: -0.05 } },
    two: { stand: POSES.two.stand, windup: { support: 'stand', head: 'fixed', lunge: -0.03 }, blow: { support: 'crouch', head: 'low', lunge: -0.05 } },
    none: { stand: POSES.none.stand, windup: { support: 'coil', head: 'forward' }, blow: { support: 'coil-strike', head: 'forward' } },
  },
});
export const STRIKE_WAYS = Object.freeze(['strike', 'snap', 'maul', 'roar', 'channel']);
export const WAY_TIMING = Object.freeze({
  strike: STRIKE_TIMING,
  snap: Object.freeze({ startup: 12, active: 3, recovery: 14 }),
  maul: Object.freeze({ startup: 40, active: 6, recovery: 28 }),
  roar: Object.freeze({ startup: 16, active: 48, recovery: 18 }),
  channel: Object.freeze({ startup: 20, active: 60, recovery: 16 }),
});
const still = ({ lunge, dart, ...p }) => ({ ...p, tail: 'rest', loop: 'stare' });
// a posed frame thrown by `v` (metres, x y z): every bone moved, none turned
const thrown = (F, v) => ({ ...F, bones: Object.fromEntries(Object.entries(F.bones).map(([id, b]) => [id, { ...b, head: b.head.map((c, k) => c + v[k]), tail: b.tail.map((c, k) => c + v[k]) }])) });
const lengthOf = (F) => { const ys = Object.values(F.bones).flatMap((b) => [b.head[1], b.tail[1]]); return Math.max(...ys) - Math.min(...ys); };
const posesFor = (id, way = 'strike') => {
  const c = capabilitiesOf(id), T = way === 'strike' ? POSES : WAY_POSES[way];
  return c && T && (c.support === 'none' ? (c.legless ? T.none : null) : T[c.support]) || null;
};

const SOLVED = new Map();
// the three poses solved once per species and way, or null when its body cannot take one of them
function posed(id, way = 'strike') {
  const key = way === 'strike' ? id : `${id}:${way}`;
  if (SOLVED.has(key)) return SOLVED.get(key);
  // (a way beside the strike only for a body that strikes)
  const P = way === 'strike' || posed(id) ? posesFor(id, way) : null;
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
  SOLVED.set(key, out);
  return out;
}

export const strikesOf = (id) => (posed(id) ? ['strike'] : []);
export const strikeWaysOf = (id) => STRIKE_WAYS.filter((w) => posed(id, w));

export function strikeTiming(t, way = 'strike') {
  const T = { ...(WAY_TIMING[way] ?? STRIKE_TIMING), ...(t && typeof t === 'object' ? t : {}) };
  for (const k of ['startup', 'active', 'recovery']) if (!(Number.isInteger(T[k]) && T[k] >= 1 && T[k] <= 600)) throw new Error(`fauna strike: ${k} is whole frames at 60 Hz, 1 to 600 (not ${T[k]})`);
  return { startup: T.startup, active: T.active, recovery: T.recovery };
}
const total = (T) => T.startup + T.active + T.recovery;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
export const strikeSeconds = (t, way) => r4(total(strikeTiming(t, way)) / FPS);
export function strikeWindow(t, way) {
  const T = strikeTiming(t, way), n = total(T);
  return [r4(T.startup / n), r4((T.startup + T.active) / n)];
}

/** The strike's keys `[t, pose, ease?]`: gathered by most of the startup and held to its end, snapped onto the blow, held
 * through the active frames, eased home over the recovery. */
function keysOf(T) {
  const n = total(T), s = T.startup / n, a = T.active / n;
  return [[0, 'stand'], [s * 0.7, 'windup', smooth], [s, 'windup'], [s + a * 0.5, 'blow', snap], [s + a, 'blow'], [1, 'stand', smooth]];
}

export function strikeFrames(id, t, n = 24, way = 'strike') {
  if (!STRIKE_WAYS.includes(way)) throw new Error(`fauna strike: no way '${way}' (the ways: ${STRIKE_WAYS.join(', ')})`);
  const P = posed(id, way);
  if (!P) throw new Error(way === 'strike' || !posed(id) ? `fauna strike: '${id}' cannot strike yet (a swimmer and a body on folded wings have no strike)` : `fauna strike: '${id}' has no ${way} (it can: ${strikeWaysOf(id).join(', ')})`);
  const keys = keysOf(strikeTiming(t, way));
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
