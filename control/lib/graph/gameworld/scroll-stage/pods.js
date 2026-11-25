/**
 * THE PODS (Blaze Gunner's arsenal): a pod is taken from a foe that carries it, and each gives a small, agile ship a
 * different HURTBOX, a shape in time (what it hits, where, for how long), never only a faster bullet. The game is its
 * weapons: offence and dodging over shields. A new weapon is a row.
 *
 * Sizes are in SHIP LENGTHS (L) and speeds in SCREENS ACROSS a second (S/s), so a row reads the same at any scale; the
 * stage lowers them to metres for the runtime (`lowerArsenal`, worlds/controllable/scroll-pods.js plays them).
 *
 *   a pod's FIRE, one of:
 *     shots   { cadence s, shots: [{ angle°, offset? L (across), speed S/s, r L, life s, dmg, pierce?, home? rad/s,
 *              grav? S/s² (across), grow? L (its radius at the end of its life: a wave), still?: true (left in the world:
 *              a mine), burst?: { r L, dmg, time s } (a ring where it ends or meets a foe) }], jitter? ° }
 *     sweep   { cadence s, reach L, from°, to°, time s, dmg }        a blade's arc in front of the nose, once a swing
 *     beam    { length L, width L, dps }                              held: a lance from the muzzle (ammo in seconds)
 *     orbit   { radius L, r L, rate turns/s, dmg, every s }           held: a ball on a chain round the ship
 *   ammo     shots or swings fired (a beam's and an orbit's: seconds held); the BASE gun has none and never runs out
 *   bomb     what it is as it is EJECTED (held, never tapped): launched ahead, a timed bomb that bursts after its fuse,
 *            { r L, dmg }; it never harms the ship
 *   hue      its colour (the round look's: gameworld/feel/round-look.js)
 *
 *   PODS, POD_IDS, BASE_GUN, SLOTS (2), EJECT_HOLD (s), BOMB (the fuse, its flight)
 *   podMeasures(row, { shipShare? })  → { reach (L), cover (L² a second), dps, pierce, seek, splash (L), melee }: what
 *                                        a pod hits, measured; its qualities (it passes through, it finds, it bursts) are
 *                                        measures too, since they are what a pod is taken for
 *   arsenalLaws(rows?)                → [{ id, holds, says }]: no pod better than another on every measure; every pod
 *                                        better than the base gun on one; a short reach pays (a melee pod out-damages the
 *                                        median); the base gun never runs out
 *   lowerArsenal(ids, { L, S })       → the runtime's arsenal in metres: { base, pods: { id: row }, slots, eject, bomb }
 *
 * Pure: data and numbers.
 */
import { SCROLL_FRAME } from './frame.js';

const shot = (o) => Object.freeze(o);
const row = (o) => Object.freeze(o);

/** The base gun: a twin stream from the gun rail, never empty. Weak, and all the ship has before its first pod. */
export const BASE_GUN = row({ label: 'twin gun', hue: '#ffd36a', fire: row({ kind: 'shots', cadence: 0.16, shots: Object.freeze([
  shot({ angle: 0, offset: 0.1, speed: 2.2, r: 0.05, life: 0.7, dmg: 0.6 }), shot({ angle: 0, offset: -0.1, speed: 2.2, r: 0.05, life: 0.7, dmg: 0.6 }),
]) }) });

export const PODS = Object.freeze({
  // a thin, fast stream: long reach, a narrow line
  vulcan: row({ label: 'vulcan', hue: '#ffe27a', ammo: 360, bomb: row({ r: 1.4, dmg: 10 }),
    fire: row({ kind: 'shots', cadence: 0.05, jitter: 3, shots: Object.freeze([shot({ angle: 0, speed: 2.8, r: 0.04, life: 0.8, dmg: 0.6 })]) }) }),
  // a fan of five: the screen covered close in, thin far out
  spread: row({ label: 'spread', hue: '#7affb0', ammo: 70, bomb: row({ r: 1.8, dmg: 9 }),
    fire: row({ kind: 'shots', cadence: 0.24, shots: Object.freeze([-24, -12, 0, 12, 24].map((a) => shot({ angle: a, speed: 1.9, r: 0.06, life: 0.45, dmg: 0.9 }))) }) }),
  // one slow, heavy capsule that passes through what it hits
  cannon: row({ label: 'cannon', hue: '#ff9a4a', ammo: 24, bomb: row({ r: 2.2, dmg: 18 }),
    fire: row({ kind: 'shots', cadence: 0.6, shots: Object.freeze([shot({ angle: 0, speed: 1.1, r: 0.24, life: 1.4, dmg: 6, pierce: 99 })]) }) }),
  // a short sweep in front of the nose: melee, the heaviest hit
  blade: row({ label: 'blade', hue: '#9ad8ff', ammo: 60, bomb: row({ r: 1.5, dmg: 14 }),
    fire: row({ kind: 'sweep', cadence: 0.3, reach: 1.4, from: 70, to: -55, time: 0.16, dmg: 9 }) }),
  // a ball swung round the ship on its chain: a shield that bites, held
  flail: row({ label: 'flail', hue: '#d7a6ff', ammo: 20, bomb: row({ r: 1.6, dmg: 12 }),
    fire: row({ kind: 'orbit', radius: 1.15, r: 0.28, rate: 1.4, dmg: 5, every: 0.25 }) }),
  // small darts that turn toward what they see
  seeker: row({ label: 'seeker', hue: '#ff7ab8', ammo: 50, bomb: row({ r: 1.4, dmg: 9 }),
    fire: row({ kind: 'shots', cadence: 0.36, shots: Object.freeze([35, -35].map((a) => shot({ angle: a, speed: 1.3, r: 0.05, life: 0.9, dmg: 1.2, home: 5 }))) }) }),
  // lobbed, falling, bursting into a ring where it lands
  grenade: row({ label: 'grenade', hue: '#ffb04a', ammo: 20, bomb: row({ r: 2.4, dmg: 16 }),
    fire: row({ kind: 'shots', cadence: 0.7, shots: Object.freeze([shot({ angle: 32, speed: 1.1, r: 0.09, life: 0.8, dmg: 2, grav: -2.4, burst: row({ r: 1.2, dmg: 5, time: 0.25 }) })]) }) }),
  // a widening arc that passes through all it meets
  wave: row({ label: 'wave', hue: '#5ae6ff', ammo: 40, bomb: row({ r: 1.8, dmg: 10 }),
    fire: row({ kind: 'shots', cadence: 0.42, shots: Object.freeze([shot({ angle: 0, speed: 1.2, r: 0.12, grow: 0.7, life: 0.75, dmg: 2.2, pierce: 99 })]) }) }),
  // a held beam from the muzzle across most of the screen
  lance: row({ label: 'lance', hue: '#ff5a5a', ammo: 6, bomb: row({ r: 2, dmg: 15 }),
    fire: row({ kind: 'beam', length: 7, width: 0.09, dps: 22 }) }),
  // left behind in the world as the screen scrolls on, bursting where a foe comes near
  mine: row({ label: 'mine', hue: '#c8ff5a', ammo: 12, bomb: row({ r: 2.6, dmg: 20 }),
    fire: row({ kind: 'shots', cadence: 0.8, shots: Object.freeze([shot({ angle: 180, speed: 0.05, r: 0.5, life: 6, dmg: 0, still: true, burst: row({ r: 1.4, dmg: 7, time: 0.3 }) })]) }) }),
});
export const POD_IDS = Object.freeze(Object.keys(PODS));
/** Two pods at most; a button switches the live one. */
export const SLOTS = 2;
/** Eject is held this long, never tapped: the live slot freed and its pod launched as a timed bomb. */
export const EJECT_HOLD = 0.45;
/** The ejected pod: launched ahead at `speed` S/s, bursting after `fuse` s. */
export const BOMB = Object.freeze({ speed: 0.7, fuse: 0.9, time: 0.35 });

const DEG = Math.PI / 180;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** What a pod hits, in ship lengths: how far it reaches, how much of the screen it covers a second, its damage a second. */
export function podMeasures(P, { shipShare = SCROLL_FRAME.shipShare } = {}) {
  const S = 1 / shipShare, F = P.fire;   // a screen across, in ship lengths
  const Q = { pierce: 0, seek: 0, splash: 0 };
  if (F.kind === 'sweep') return { reach: F.reach, cover: r3((Math.abs(F.from - F.to) * DEG * F.reach * F.reach) / 2 / F.cadence), dps: r3(F.dmg / F.cadence), ...Q, pierce: 1, melee: true };
  if (F.kind === 'orbit') return { reach: r3(F.radius + F.r), cover: r3(2 * Math.PI * F.radius * 2 * F.r * F.rate), dps: r3(F.dmg / F.every), ...Q, pierce: 1, melee: true };
  if (F.kind === 'beam') return { reach: F.length, cover: r3(F.length * F.width), dps: F.dps, ...Q, pierce: 1, melee: false };
  let reach = 0, cover = 0, dps = 0;
  for (const s of F.shots) {
    const run = s.still ? 0 : s.speed * S * s.life, width = 2 * Math.max(s.r, s.grow ?? 0, s.burst ? s.burst.r : 0);
    reach = Math.max(reach, run + (s.burst ? s.burst.r : 0) + (s.still ? s.r : 0));
    cover += (Math.max(run, 2 * s.r) * width) / F.cadence;
    dps += ((s.dmg + (s.burst ? s.burst.dmg : 0)) * (s.pierce ? 1.5 : 1)) / F.cadence;
  }
  const any = (k) => F.shots.some((s) => s[k]);
  return { reach: r3(reach), cover: r3(cover), dps: r3(dps), pierce: any('pierce') ? 1 : 0, seek: any('home') ? 1 : 0, splash: Math.max(0, ...F.shots.map((s) => (s.burst ? s.burst.r : 0))), melee: false };
}

const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

/** The arsenal's laws: they advise, none refuses. */
export function arsenalLaws(rows = PODS) {
  const M = Object.fromEntries(Object.entries(rows).map(([id, P]) => [id, podMeasures(P)])), ids = Object.keys(M), out = [];
  const keys = ['reach', 'cover', 'dps', 'pierce', 'seek', 'splash'], beats = (a, b) => keys.every((k) => M[a][k] >= M[b][k]) && keys.some((k) => M[a][k] > M[b][k]);
  const dominated = ids.flatMap((b) => ids.filter((a) => a !== b && beats(a, b)).map((a) => `${a} over ${b}`));
  out.push({ id: 'no-best-pod', holds: !dominated.length, says: dominated.length ? `a pod is better on every measure: ${dominated.join(', ')}` : 'no pod is better than another on every measure (reach, cover, damage a second, passing through, finding, bursting)' });
  const B = podMeasures(BASE_GUN), weak = ids.filter((id) => !keys.some((k) => M[id][k] > B[k]));
  out.push({ id: 'worth-taking', holds: !weak.length, says: weak.length ? `a pod no better than the base gun on any measure: ${weak.join(', ')}` : 'every pod is better than the base gun on some measure: it is worth taking' });
  const mid = median(ids.map((id) => M[id].dps)), soft = ids.filter((id) => M[id].melee && !(M[id].dps > mid && M[id].reach < 2));
  out.push({ id: 'short-reach-pays', holds: !soft.length, says: soft.length ? `a melee pod that does not pay for its risk: ${soft.join(', ')}` : 'every melee pod reaches under two ship lengths and out-damages the median' });
  out.push({ id: 'base-never-empty', holds: BASE_GUN.ammo === undefined, says: 'the base gun never runs out' });
  return out;
}

/** The runtime's arsenal, in metres: a ship `L` metres long on a screen `S` metres across. Only the pods named are
 * carried (a stage's carriers), so a page holds no row it never meets. */
export function lowerArsenal(ids = POD_IDS, { L, S }) {
  const len = (v) => r3(v * L), spd = (v) => r3(v * S);
  const lowerFire = (F) => {
    if (F.kind === 'sweep') return { kind: 'sweep', cadence: F.cadence, reach: len(F.reach), from: F.from, to: F.to, time: F.time, dmg: F.dmg };
    if (F.kind === 'orbit') return { kind: 'orbit', radius: len(F.radius), r: len(F.r), rate: F.rate, dmg: F.dmg, every: F.every };
    if (F.kind === 'beam') return { kind: 'beam', length: len(F.length), width: len(F.width), dps: F.dps };
    return { kind: 'shots', cadence: F.cadence, ...(F.jitter ? { jitter: F.jitter } : {}), shots: F.shots.map((s) => ({
      angle: s.angle, offset: len(s.offset ?? 0), speed: spd(s.speed), r: len(s.r), life: s.life, dmg: s.dmg,
      ...(s.pierce ? { pierce: s.pierce } : {}), ...(s.home ? { home: s.home } : {}), ...(s.grav ? { grav: spd(s.grav) } : {}),
      ...(s.grow ? { grow: len(s.grow) } : {}), ...(s.still ? { still: true } : {}),
      ...(s.burst ? { burst: { r: len(s.burst.r), dmg: s.burst.dmg, time: s.burst.time } } : {}),
    })) };
  };
  const pods = {};
  for (const id of ids) {
    const P = PODS[id];
    if (!P) throw new Error(`scroll stage: '${id}' is not a pod (${POD_IDS.join(', ')})`);
    pods[id] = { hue: P.hue, ammo: P.ammo, fire: lowerFire(P.fire), bomb: { r: len(P.bomb.r), dmg: P.bomb.dmg } };
  }
  return { base: { hue: BASE_GUN.hue, fire: lowerFire(BASE_GUN.fire) }, pods, slots: SLOTS, eject: EJECT_HOLD, bomb: { speed: spd(BOMB.speed), fuse: BOMB.fuse, time: BOMB.time } };
}
