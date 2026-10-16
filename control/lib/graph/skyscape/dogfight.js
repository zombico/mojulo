/**
 * THE DOGFIGHT — the action half of a flight game: guns on the craft, a wing of enemy fighters, every one shot down.
 * Nothing new underneath. The craft fires the weapon system every controllable body has (worlds/controllable/
 * combat-ranged.js: a `weapon` slot, hitscan along its heading and pitch); the foes are the ai rule's space minds
 * (mind.js `rule.space`: they seek in three dimensions, hold a standoff and fire on a 3-D aim cone); the goal is the
 * shooter's (defeat-all on the cast's own `down` facts, fail-on-death on its hits). What this module decides is the
 * numbers for a craft class and where the wing waits:
 *
 *   missiles a craft's lock-on missiles and flares (MISSILE), and its boost and barrel roll (MOVES); a foe's fewer,
 *            slower to lock and slower to turn
 *   guns     cannon a craft carries: a burst rate, a range ~RANGE_S s of its cruise, a forgiving aim cone (a craft is
 *            aimed by flying it, so the assist ring is wide)
 *   the wing WING.n fighters (or the count asked), spread through the far half of the field ahead of the start, each
 *            a little slower than the craft (so it can be caught), its gun slower than the craft's
 *   hulls    a fighter's hit volume (an egg a craft's size) and the hits it takes; the craft's own
 *
 *   dogfightCast(map, field, seat, { foes? }) → { entities, pilot: { weapon, body }, camera }
 *
 * Pure, deterministic.
 */
const r2 = (v) => Math.round(v * 100) / 100;

/** The wing: how many by default (and at most), how many hits a fighter takes, its speed as a share of the craft's
 *  cruise, its standoff (s of its speed), and the craft's own hits (what fail-on-death charges per hit). */
export const WING = Object.freeze({ n: 4, max: 10, hp: 3, speed: 0.85, standoffS: 2.5 });
/** The craft's cannon range in s of cruise. */
export const RANGE_S = 7;

/** A craft's missiles (combat-ranged.js stepMissiles): range MISSILE.rangeS s of cruise, a missile's speed over the
 *  craft's own, its turn, what a hit counts as (hits on fail-on-death), the lock; a foe's carry fewer, lock slower
 *  and turn slower (a missile on the craft can be outturned, rolled from, or flared). */
export const MISSILE = Object.freeze({ count: 6, foeCount: 2, rangeS: 12, speedS: 1.2, turn: 2.2, foeTurn: 1.4, hitsAs: 5, lockTime: 1, foeLockTime: 2.5, flares: 4, foeFlares: 2 });
export function missiles(c, { foe = false } = {}) {
  return {
    count: foe ? MISSILE.foeCount : MISSILE.count, range: r2(MISSILE.rangeS * c.cruise), speed: r2(MISSILE.speedS * c.cruise),
    turn: foe ? MISSILE.foeTurn : MISSILE.turn, cone: foe ? 8 : 12, lockTime: foe ? MISSILE.foeLockTime : MISSILE.lockTime,
    damage: 3, splash: r2(Math.max(8, c.max / 15)), prox: r2(Math.max(6, c.max / 20)), hitsAs: MISSILE.hitsAs,
    flares: foe ? MISSILE.foeFlares : MISSILE.flares, ...(foe ? { cooldown: 10 } : {}),
  };
}
/** A craft's own moves: the boost (twice the thrust for three seconds, refilling) and the barrel roll (a dodge). */
export const MOVES = Object.freeze({ boost: { thrust: 2, time: 3, recharge: 0.5 }, roll: { time: 0.7, side: 30, cooldown: 1.5 } });

/** The cannon for a craft (its cruise sets the range). */
export function guns(c) {
  return { fireClass: 'sight', auto: true, rof: 8, damage: 1, impact: 0, range: r2(RANGE_S * c.cruise), coreAngle: 2, assistAngle: 7, eye: 0 };
}

/** A trench run's targets (trench.js): the port (one hit to win, a small egg) and the rim turrets (space minds that do
 *  not move, firing down into the trench). */
export function trenchCast(map, field) {
  const c = map.craft, P = field.port, s = 6;
  const entities = [{
    id: 'foe-port', team: 'foes', rule: { type: 'static' },
    body: { type: 'mesh', shape: 'box', size: [s, s, 1.2], color: '#ff7a1a', hittable: true, hp: 1, poise: 99, radius: s / 2, egg: { a: s / 2, c: s / 2, cz: 0 } },
    transform: { pos: P, heading: 0 },
  }];
  field.turrets.forEach((t, i) => entities.push({
    id: `turret-${i + 1}`, team: 'foes',
    rule: { type: 'ai', space: true, speed: 0, turn: 2.5, standoff: 0, fireArc: 10, burst: 0.4, pause: 1.2, sightRange: r2(4 * c.cruise), eye: 0 },
    weapon: { ...guns(c), rof: 2, range: r2(3 * c.cruise), assistAngle: 2 },
    body: { type: 'mesh', shape: 'box', size: [5, 5, 6], color: '#9aa3ad', hittable: true, hp: 2, poise: 99, radius: 4, egg: { a: 3, c: 3, cz: 0 } },
    transform: { pos: t, heading: 0 },
  }));
  return entities;
}

/** The craft as a fighter: its cannon, its missiles and flares, its boost and roll, its hull hittable. */
function armedPilot(c, size) {
  return { weapon: guns(c), rule: { missiles: missiles(c), boost: { ...MOVES.boost }, roll: { ...MOVES.roll } }, body: { hittable: true, radius: size, egg: { a: size, c: r2(size * 0.5), cz: 0 } } };
}

/** The ids of each wave's wing: `waves` of `n` (WING.max at most a wave). */
export const waveIds = (waves, n) => Array.from({ length: waves }, (_, k) => ({ foes: Array.from({ length: Math.max(1, Math.min(WING.max, n | 0 || WING.n)) }, (_, j) => `foe-${k * Math.max(1, Math.min(WING.max, n | 0 || WING.n)) + j + 1}`) }));

export function dogfightCast(map, field, seat, { foes = WING.n, waves = 0 } = {}) {
  if (field.port) {
    const sz = r2(Math.max(4, map.craft.max / 25));
    return { entities: trenchCast(map, field), pilot: armedPilot(map.craft, sz), camera: { mouseLook: true } };
  }
  const c = map.craft, F = map.rings.field, per = Math.max(1, Math.min(WING.max, foes | 0 || WING.n)), W = Math.max(1, waves | 0), n = per * W;
  const [sx, sy, sz] = seat.transform.pos, h = seat.transform.heading, ax = Math.cos(h), ay = Math.sin(h);
  const size = r2(Math.max(4, c.max / 25)), egg = { a: size, c: r2(size * 0.6), cz: 0 };
  const entities = [];
  for (let i = 0; i < n; i++) {
    // the far half of the field ahead of the start, fanned across it and up and down (alternating), facing back
    // (in waves: each wing its own band of the far half, a later one further off; all minted asleep, woken by the waves
    // mechanic)
    const k = W > 1 ? i % per : i, m = W > 1 ? per : n, wave = W > 1 ? Math.floor(i / per) : 0;
    const along = 0.35 + 0.5 * ((k + 0.5) / m) * (W > 1 ? 0.6 + 0.4 * (wave / (W - 1)) : 1), across = (k % 2 ? 1 : -1) * (0.15 + 0.6 * ((k * 0.618 + wave * 0.29) % 1));
    const d = along * 2 * Math.min(F.hx, F.hy), w = across * Math.min(F.hx, F.hy);
    let x = sx + ax * d - ay * w, y = sy + ay * d + ax * w, z = sz + (i % 3 - 1) * 0.4 * (F.hz ?? 200);
    // never inside a rock: stepped out along +z until clear
    for (let k = 0; field.hitAt && field.hitAt(x, y, z, size * 3) && k < 40; k++) z += size * 4;
    x = Math.max(-F.hx, Math.min(F.hx, x)); y = Math.max(-F.hy, Math.min(F.hy, y));
    // over ground (air combat): three low passes clear of it (or of a roof), whatever the start's height
    if (map.form !== 'void') z = Math.max(z, (field.topAt ?? field.groundAt)(x, y) + 3 * c.lowPass);
    const speed = r2(WING.speed * c.cruise);
    entities.push({
      id: `foe-${i + 1}`, team: 'foes', ...(waves ? { dormant: true } : {}),
      // (over ground, air combat, it keeps two low passes clear of it: mind.js `clearance`)
      rule: { type: 'ai', space: true, speed, turn: 1.4, standoff: r2(WING.standoffS * speed), fireArc: 6, burst: 0.5, pause: 1.6, sightRange: r2(RANGE_S * c.cruise * 2), eye: 0, missiles: missiles(c, { foe: true }), ...(map.form !== 'void' ? { clearance: 2 * c.lowPass } : {}) },
      weapon: { ...guns(c), rof: 3, range: r2(0.7 * RANGE_S * c.cruise), assistAngle: 2 },
      body: { type: 'mesh', shape: 'box', size: [size, size * 0.8, size * 0.35], color: '#d8483c', hittable: true, hp: WING.hp, poise: 99, radius: size, egg },
      transform: { pos: [r2(x), r2(y), r2(z)], heading: r2(h + Math.PI), pitch: 0 },
    });
  }
  return {
    entities,
    // the craft: its cannon, its hull hittable (an egg its own size), and a mouse that flies it (pointer-locked: the
    // mouse pitches the nose, a click fires)
    pilot: armedPilot(c, size),
    camera: { mouseLook: true },
  };
}
