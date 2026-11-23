/**
 * THE RIDDEN MACHINE — a vehicle of the mecha shelf parked in a level for its hero to get into, drive and fight from
 * (worlds/controllable/board.js): a transforming walker's armoured cabin (the rover walker: it walks on its gait, or
 * folds its legs onto its wheels and drives as an armoured car, forms.js; its backpack's autocannon and rocket pod turned
 * by its turret, turret.js). The frame is the artillery range's (combat/frames.js frameBase: its rig, its gait, its tank
 * form, its fold, its mounts); its guns are given a fight's numbers here, where the range gives them a gunnery's.
 *
 *   rideVehicle(word, { id?, at?, heading?, hp?, base? }) → { id, figure (the figures-map entry: { frame }), entity, keys }
 *     word     a frame the vehicle library knows that walks and rolls ('rover walker', 'transforming walker')
 *     at       where it is parked ([x, y, z]); heading its facing (radians, counter-clockwise from +x)
 *     hp       what it takes before it is downed (RIDE.hp); its rider is thrown out where it stands
 *     base     the round its numbers are scaled to ({ damage }: a level's base round, what drops a body of 100 in RIDE's
 *              multiples), absent 25
 *   RIDE       the ridden machine's fight: its autocannon's and its rockets' numbers, its hit points, its boarding
 *
 * Parked in its tank form, low on its wheels (it is boarded collapsed, mecha-archetypes.js its `board` stance), and left
 * in it. Its camera the turret's chase: behind it and over it, the gun's aim a pip (turret-view.js). Pure but for the
 * frame's assembly (a second or two).
 */
import { frameBase, frameOf } from './combat/frames.js';
import { MECHA_ARCHETYPES } from '../mecha-shelf/index.js';

const r2 = (v) => Math.round(v * 100) / 100;
/**
 * THE RIDE'S NUMBERS: the autocannon automatic (`rof` rounds a second, its belt `magazine`, a shell bursting `splash` m
 * round where it strikes), the rockets a salvo of six at the pull's pace, slower in flight so they are seen and led, each
 * a wide burst; damage as multiples of the base round. The machine's `hp`; its boarding `reach` and `climb` (s).
 */
export const RIDE = Object.freeze({
  hp: 1200, reach: 3.5, climb: 0.6,
  cannon: Object.freeze({ rof: 4, magazine: 40, reserve: 160, reload: 3.5, speed: 220, splash: 1.8, dmg: 1.8 }),
  rockets: Object.freeze({ magazine: 6, reserve: 12, reload: 5, cooldown: 0.3, speed: 60, splash: 4, dmg: 6 }),
});

/** A machine of the mecha shelf parked to be ridden (see the head). */
export function rideVehicle(word, { id = 'ride', at = [0, 0, 0], heading = 0, hp = RIDE.hp, base = { damage: 25 } } = {}) {
  const A = frameOf(word);
  if (!A.archetype) throw new Error(`ride: ${A.why}`);
  const row = MECHA_ARCHETYPES[A.archetype];
  if (!(row.wheels && row.stances && row.stances.roll)) throw new Error(`ride: the ${A.id} does not walk and roll (a transforming walker does: 'rover walker')`);
  const F = frameBase({ frame: word, stance: 'roll' });
  const d0 = base.damage ?? 25, C = RIDE.cannon, K = RIDE.rockets;
  // its guns: the backpack's autocannon firing its high explosive automatic, its rocket pod a salvo (the range's rounds,
  // their mounts and their places in each form kept)
  const he = F.rounds.find((r) => r.ordnance === 'he30') ?? F.rounds.find((r) => r.splashRadius > 0) ?? F.rounds[0];
  const rk = F.rounds.find((r) => r.ordnance === 'rocket');
  const rounds = [
    { ...he, name: 'autocannon', auto: true, rof: C.rof, magazine: C.magazine, reserve: C.reserve, reload: C.reload, cooldown: 1 / C.rof, projectileSpeed: C.speed, projectileGravity: 9.81, splashRadius: C.splash, damage: r2(C.dmg * d0), impact: 1, smokeTrail: false, round: { speed: C.speed, flash: 0.5, look: 'grenade' } },
    ...(rk ? [{ ...rk, name: 'rockets', auto: false, magazine: K.magazine, reserve: K.reserve, reload: K.reload, cooldown: K.cooldown, projectileSpeed: K.speed, projectileGravity: 0, splashRadius: K.splash, damage: r2(K.dmg * d0), impact: 1, smokeTrail: false, round: { speed: 120, flash: 0.6, look: 'rocket' } }] : []),
  ];
  // (it walks at its gait's pace, its stride the clip's cycle; in its tank form it drives on its wheels, steered: the
  // artillery range's rules, combat/artillery.js)
  const walkRule = { type: 'walk', speed: F.gait.speed, turn: F.gait.turn, stride: F.gait.stride, eye: 0, collideRadius: Math.max(1, F.gait.track || F.gait.L / 2), collideHeight: F.height };
  const driveRule = { type: 'walk', speed: F.drive.speed, turn: F.drive.turn, stride: F.drive.stride, steer: F.drive.steer, eye: 0, collideRadius: Math.max(1, F.drive.track / 2 + 0.5), collideHeight: F.height };
  const look = { base: 'hull', back: Math.max(7, Math.round(F.height * 2.2)), up: Math.max(2, Math.round(F.height * 0.5)), size: F.height, view: 'chase' };
  const entity = {
    id, pilotable: true, rule: driveRule, ambient: { type: 'static' },
    forms: { walker: { rule: walkRule }, tank: { rule: driveRule } }, form: 'tank', transformDur: r2(1 + 0.25 * F.gait.L),
    turret: { ...F.turret, rounds, look }, weapon: rounds[0],
    body: { type: 'figure-rig', figure: id, hittable: true, hp, radius: Math.max(1.2, F.drive.track / 2 + 0.3) },
    board: { reach: RIDE.reach, climb: RIDE.climb, form: 'tank' },
    transform: { pos: at.slice(), heading, pitch: 0 },
  };
  const keys = `E  get in · get out · W / S  drive or walk · A / D  steer or turn · B  walk or roll · mouse  lay the guns · click  fire · 1-${rounds.length}  ${rounds.map((r) => r.name).join(', ')} · O  view`;
  // (its figure a recipe the world's resolve rigs, worlds/world-scene.js: the manifest carries the words, never the bodies)
  return { id, frame: F.id, figure: { frame: { frame: word, stance: 'roll' } }, entity, keys, height: F.height };
}
