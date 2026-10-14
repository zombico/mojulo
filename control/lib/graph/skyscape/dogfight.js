/**
 * THE DOGFIGHT — the action half of a flight game: guns on the craft, a wing of enemy fighters, every one shot down.
 * Nothing new underneath. The craft fires the weapon system every controllable body has (worlds/controllable/
 * combat-ranged.js: a `weapon` slot, hitscan along its heading and pitch); the foes are the ai rule's space minds
 * (mind.js `rule.space`: they seek in three dimensions, hold a standoff and fire on a 3-D aim cone); the goal is the
 * shooter's (defeat-all on the cast's own `down` facts, fail-on-death on its hits). What this module decides is the
 * numbers for a craft class and where the wing waits:
 *
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

/** The cannon for a craft (its cruise sets the range). */
export function guns(c) {
  return { fireClass: 'sight', auto: true, rof: 8, damage: 1, impact: 0, range: r2(RANGE_S * c.cruise), coreAngle: 2, assistAngle: 7, eye: 0 };
}

export function dogfightCast(map, field, seat, { foes = WING.n } = {}) {
  const c = map.craft, F = map.rings.field, n = Math.max(1, Math.min(WING.max, foes | 0 || WING.n));
  const [sx, sy, sz] = seat.transform.pos, h = seat.transform.heading, ax = Math.cos(h), ay = Math.sin(h);
  const size = r2(Math.max(4, c.max / 25)), egg = { a: size, c: r2(size * 0.6), cz: 0 };
  const entities = [];
  for (let i = 0; i < n; i++) {
    // the far half of the field ahead of the start, fanned across it and up and down (alternating), facing back
    const along = 0.35 + 0.5 * ((i + 0.5) / n), across = (i % 2 ? 1 : -1) * (0.15 + 0.6 * ((i * 0.618) % 1));
    const d = along * 2 * Math.min(F.hx, F.hy), w = across * Math.min(F.hx, F.hy);
    let x = sx + ax * d - ay * w, y = sy + ay * d + ax * w, z = sz + (i % 3 - 1) * 0.4 * (F.hz ?? 200);
    // never inside a rock: stepped out along +z until clear
    for (let k = 0; field.hitAt && field.hitAt(x, y, z, size * 3) && k < 40; k++) z += size * 4;
    x = Math.max(-F.hx, Math.min(F.hx, x)); y = Math.max(-F.hy, Math.min(F.hy, y));
    const speed = r2(WING.speed * c.cruise);
    entities.push({
      id: `foe-${i + 1}`, team: 'foes',
      rule: { type: 'ai', space: true, speed, turn: 1.4, standoff: r2(WING.standoffS * speed), fireArc: 6, burst: 0.5, pause: 1.6, sightRange: r2(RANGE_S * c.cruise * 2), eye: 0 },
      weapon: { ...guns(c), rof: 3, range: r2(0.7 * RANGE_S * c.cruise), assistAngle: 2 },
      body: { type: 'mesh', shape: 'box', size: [size, size * 0.8, size * 0.35], color: '#d8483c', hittable: true, hp: WING.hp, poise: 99, radius: size, egg },
      transform: { pos: [r2(x), r2(y), r2(z)], heading: r2(h + Math.PI), pitch: 0 },
    });
  }
  return {
    entities,
    // the craft: its cannon, its hull hittable (an egg its own size), and a mouse that flies it (pointer-locked: the
    // mouse pitches the nose, a click fires)
    pilot: { weapon: guns(c), body: { hittable: true, radius: size, egg: { a: size, c: r2(size * 0.5), cz: 0 } } },
    camera: { mouseLook: true },
  };
}
