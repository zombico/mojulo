/**
 * THE ASSEMBLY — a build (a part in every slot, a weapon in each of the four or none) read into the frame it makes: its
 * weight, its armour, how it moves and how it fights, and the laws a build is held to (advice, never a refusal: an
 * overweight frame is slow, it is not forbidden).
 *
 *   readBuild(build, at?)        → the build, its stock's parts under the ones it names; throws, teaching
 *                                  build: a STOCK name, or { from?: <stock>, head?, core?, …, armR?, armL?, backR?, backL? }
 *                                  (a weapon slot null: none in it; the head null where the core carries its own sensors)
 *   assembleFrame(build)         → { build, parts, weight, ap, load, over, move, en, fcs, stab, kick, weapons, laws }
 *     weight    kg, every part and weapon
 *     over      how far over the legs' load (0 within it; 0.2 a fifth over)
 *     move      { walk, boost, qb, qbTime, qbCool, jump, lift, land, height, ab } m/s, s, m/s² (over the load: slower;
 *               ab the assault boost's charge)
 *     en        { max, regen, delay, out, cost { boost, qb, ascend, abStart, ab } }
 *     kick      { damage, impact, range, speed, time, cool, en }: the boost kick, a lunge onto the locked target
 *     fcs       { lock, range, cone, locks }
 *     stab      { max, regen, stagger, bonus }: its stability, the bar a hit's impact breaks (in standard bars: a weapon's
 *               `stagger` is its share of one), heavier frames the steadier; regen bars a second; stagger the seconds
 *               it reels when broken, bonus how much harder a hit lands on a frame reeling (the fight's loop:
 *               pressure a frame until it breaks, then punish it)
 *     weapons   { armR?, armL?, backR?, backL? } each its row with its id
 *     laws      [{ law, ok, says }]: within the load, the booster carries its mass, the generator feeds a quick boost,
 *               an energy weapon's shot within the generator, a pair of hands armed
 *
 * Pure: the same build, the same frame.
 */
import { PARTS, SLOTS, WEAPON_SLOTS, STOCK, partOf } from './parts.js';

const r2 = (v) => Math.round(v * 100) / 100;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const KEYS = ['from', ...SLOTS, ...WEAPON_SLOTS];

export function readBuild(build, at = 'frame.build') {
  if (typeof build === 'string') {
    if (!STOCK[build]) throw new Error(`${at} is a stock frame (${Object.keys(STOCK).join(', ')}) or { from?, ${[...SLOTS, ...WEAPON_SLOTS].join(', ')} }`);
    return { ...STOCK[build] };
  }
  if (!isObj(build)) throw new Error(`${at} is a stock frame's name or { from?, <slot>: <part id> }`);
  for (const k of Object.keys(build)) if (!KEYS.includes(k)) throw new Error(`${at}.${k} is not a slot (${KEYS.join(', ')})`);
  const from = build.from ?? 'vanguard';
  if (!STOCK[from]) throw new Error(`${at}.from is a stock frame (${Object.keys(STOCK).join(', ')})`);
  const B = { ...STOCK[from] };
  for (const s of SLOTS) if (build[s] !== undefined) { if (!(s === 'head' && build[s] === null)) partOf(s, build[s]); B[s] = build[s]; }
  // (a headless core takes no head; a head on it is left off, said by its law)
  if (partOf('core', B.core).headless) B.head = null;
  for (const s of WEAPON_SLOTS) if (build[s] !== undefined) { if (build[s] !== null) partOf(s, build[s]); B[s] = build[s]; }
  return B;
}

export function assembleFrame(build) {
  const B = readBuild(build);
  const parts = Object.fromEntries(SLOTS.filter((s) => B[s] !== null).map((s) => [s, partOf(s, B[s])]));
  const weapons = Object.fromEntries(WEAPON_SLOTS.filter((s) => B[s]).map((s) => [s, partOf(s, B[s])]));
  const weight = [...Object.values(parts), ...Object.values(weapons)].reduce((a, p) => a + p.weight, 0);
  const ap = ['head', 'core', 'arms', 'legs'].reduce((a, s) => a + (parts[s]?.ap ?? 0), 0);
  const L = parts.legs, Bs = parts.booster, G = parts.generator, F = parts.fcs;
  // carried above the legs: everything but the legs themselves
  const carried = weight - L.weight, over = Math.max(0, r2(carried / L.load - 1));
  // (over the load the frame is slower: its boost by the square root of its mass against the booster's rating, and a
  // fifth again for each tenth it is over; its walk a half again)
  const massK = Math.sqrt(Bs.rated / weight), slow = 1 / (1 + 2 * over);
  const move = {
    walk: r2(L.walk * (1 / (1 + 5 * over))),
    boost: r2(Bs.boost * Math.min(1.15, massK) * slow),
    qb: r2(Bs.qb * Math.min(1.1, massK) * slow), qbTime: Bs.qbTime, qbCool: Bs.qbCool,
    jump: r2(L.jump * slow), lift: r2(Bs.lift * Math.min(1.1, massK) * slow), land: r2(L.land * (1 + over)), height: L.height,
    // (the assault boost: a charge along the aim, two thirds again the boost's speed, held at its height)
    ab: r2(Bs.boost * 1.65 * Math.min(1.15, massK) * slow),
  };
  // (the assault boost burns hard: a light-up of most of a quick boost, then nearly twice the boost's draw a second)
  const en = { max: G.en, regen: G.regen, delay: G.delay, out: G.out, cost: { ...Bs.cost, abStart: Math.round(Bs.cost.qb * 0.6), ab: Math.round(Bs.cost.boost * 1.7) } };
  // (the boost kick: a lunge onto the target, the frame's own mass its blow; hard on a bar, so it is how a reel is opened
  // or punished)
  const kick = { damage: Math.round(weight / 45), impact: 0.55, range: 80, speed: r2(Math.max(90, Bs.qb * 1.05)), time: 0.5, cool: 2.2, en: Math.round(Bs.cost.qb * 0.5) };
  const fcs = { lock: F.lock, range: F.range + ((parts.head ?? parts.core).sensor || 0), cone: F.cone, locks: F.locks };
  // (stability by mass: a medium frame of some 70 t is one standard bar, a light one less, a heavy one more; it comes back
  // a third of a bar a second, a light frame's a little faster)
  const stab = { max: r2(Math.min(1.8, Math.max(0.6, weight / 70000))), regen: r2(0.34 * Math.min(1.3, Math.max(0.8, 70000 / weight))), stagger: 1.6, bonus: 1.5 };
  const energyShot = Math.max(0, ...Object.values(weapons).map((w) => w.energy || 0));
  const laws = [
    { law: 'load', ok: over === 0, says: over === 0 ? `within the legs' load (${Math.round(carried / 1000)} of ${Math.round(L.load / 1000)} t)` : `${Math.round(over * 100)}% over the legs' load: slower on its feet and its boost` },
    { law: 'booster', ok: weight <= Bs.rated * 1.15, says: weight <= Bs.rated * 1.15 ? 'the booster carries its mass' : `the booster is rated for ${Math.round(Bs.rated / 1000)} t and carries ${Math.round(weight / 1000)} t` },
    { law: 'quick boost', ok: G.en >= Bs.cost.qb * 3, says: G.en >= Bs.cost.qb * 3 ? 'three quick boosts in the generator at least' : 'the generator holds fewer than three quick boosts' },
    { law: 'energy weapon', ok: energyShot <= G.en * 0.35, says: energyShot <= G.en * 0.35 ? 'its energy weapons\' shots within the generator' : 'an energy weapon\'s shot takes over a third of the generator' },
    { law: 'armed', ok: !!(weapons.armR || weapons.armL), says: weapons.armR || weapons.armL ? 'a hand armed at least' : 'no arm weapon: a frame fights with its hands' },
  ];
  return { build: B, parts, weight, ap, load: L.load, over, move, en, fcs, stab, kick, weapons, laws };
}

export { PARTS, SLOTS, WEAPON_SLOTS, STOCK };
