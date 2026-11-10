/**
 * THE AIRCRAFT ON THE RANGE — the craft shelf's fighters flown on the artillery range: each on the fly rule
 * (worlds/controllable/rules-fly.js) at its class's envelope (skyscape/eye.js CRAFT, its type's published figures, lowered
 * by skyscape/craft.js flyRule: its drag from its thrust at its top speed, its stall, its rotation, its bank), drawn as its
 * shelf rig (craft-shelf/craft-rig.js: a bone per part, banked and pitched as it flies), its gun fixed along its nose (the
 * turret runtime's `fixed` mount: the mouse flies it), started aloft at its cruise behind the firing line.
 *
 *   airBase({ aircraft, palette? }) → { id, archetype, craft, figure, rule, turret, rounds, gun, size, transform }
 *   AIRFRAMES                       the shelf's armed aircraft: each its class's envelope (CRAFT) and its gun (AIR_GUNS)
 *
 *   aircraft  a word the vehicle registry knows for one of the shelf's aircraft ('warbird', 'jet fighter', 'attack jet',
 *             'reaper drone', 'loitering munition'), or for a rotorcraft ('attack helicopter', 'helicopter', 'camera
 *             drone', 'fpv drone'): a rotorcraft is flown on the hover rule (rotorcraft.js)
 *
 * Its gun: the shelf's gun part (a heavy machine gun, a 20 mm rotary cannon, a 30 mm revolver or rotary cannon), its
 * rounds and its rate by calibre (ordnance.js AIR_GUNS); a pair of wing guns fires from between them (their convergence).
 * A drone with no gun: its stores fired along its nose (a long-endurance drone's missiles), or itself the munition (a
 * loitering munition, its warhead released on its path when it is flown into what it strikes). An aircraft the shelf
 * builds unarmed (a transport, a stealth strike jet, a recon drone) is refused here, by name.
 *
 * Vehicle space as the shelves' (+y the nose, +x right, metres). Pure; an airframe's build is the slow part.
 */
import { craftFigure, craftPieces } from '../../craft-shelf/craft-rig.js';
import { CRAFT_ARCHETYPES } from '../../craft-shelf/craft-archetypes.js';
import { flyRule } from '../../skyscape/craft.js';
import { CRAFT } from '../../skyscape/eye.js';
import { resolveVehicle, handlesOf } from '../../vehicle-registry/roster.js';
import { AIR_GUNS, ORDNANCE, ordnanceWeapon } from './ordnance.js';
import { mountOf } from './mount.js';
import { rotorBase, ROTOR_ARMS } from './rotorcraft.js';

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
/** The shelf's armed aircraft and the CRAFT envelope each flies on (its type's published figures). */
export const AIRFRAMES = Object.freeze({
  warbird: 'warbird', navalCorsair: 'navalWarbird', jetFighter: 'multirole', deltaInterceptor: 'deltaInterceptor', carrierFighter: 'carrierFighter', attackJet: 'attack',
  maleRecon: 'male', loiterMunition: 'loiter',
});
/** The fixed wings armed with no gun: stores along the nose (`stores`: [round, its parts, how many]), or itself the
 *  munition (`strike`: the round it carries in). */
const AIR_ARMS = Object.freeze({ maleRecon: Object.freeze({ stores: Object.freeze(['missile', 'store', 4]) }), loiterMunition: Object.freeze({ strike: 'grenade30' }) });
// where it starts: aloft over the range's back, at a height its low pass allows, flying at its cruise
const START = Object.freeze({ back: 1200, height: 250 });
// the range's reach the bound turns it back at (m): centred over the range, its far field and its sides
const BOUND = Object.freeze({ cx: 2500, hx: 4500, hy: 3500, warn: 5 });

/** An aircraft's word through the library: its row, its archetype, its gun, or why not. */
export function aircraftOf(word) {
  const hit = typeof word === 'string' ? resolveVehicle(word) : null;
  if (!hit) return { why: `'${word}' is not a vehicle of the library` };
  const a = (handlesOf(hit.id).craft ?? [])[0], A = a && CRAFT_ARCHETYPES[a];
  if (!A || A.realm !== 'earth') return { why: `the ${hit.id} is no aircraft of the craft shelf` };
  const rotor = (handlesOf(hit.id).rotor ?? [])[0];
  if (rotor && ROTOR_ARMS[a]) return { id: hit.id, archetype: a, rotor };
  const gun = A.layout.find((e) => e.id === 'gun');
  if (!AIRFRAMES[a] || ((!gun || !AIR_GUNS[gun.sku]) && !AIR_ARMS[a])) return { why: `the ${hit.id} carries nothing the range fires (the armed: ${[...Object.keys(AIRFRAMES), ...Object.keys(ROTOR_ARMS)].join(', ')})` };
  return { id: hit.id, archetype: a, craft: AIRFRAMES[a], ...(gun && AIR_GUNS[gun.sku] ? { gun: gun.sku } : {}) };
}

/** What is wrong with an aircraft base's words; [] when it can fly the range. */
export function validateAircraft(base = {}) {
  const A = aircraftOf(base.aircraft), errs = A.archetype ? [] : [`base.aircraft: ${A.why}`];
  for (const k of Object.keys(base)) if (!['aircraft', 'palette'].includes(k)) errs.push(`base.${k}: an aircraft base is { aircraft, palette? }`);
  return errs;
}

/** The shelf's aircraft as the range's base: its rig, its rule, its fixed gun and its rounds, where it starts. */
export function airBase(base, { reload = 3 } = {}) {
  const errs = validateAircraft(base);
  if (errs.length) throw new Error(`artillery range: ${errs.join('; ')}`);
  const A = aircraftOf(base.aircraft);
  if (A.rotor) return rotorBase(A, base, { reload });
  const C = CRAFT[A.craft], G = A.gun ? AIR_GUNS[A.gun] : null, X = AIR_ARMS[A.archetype];
  // (its rig in flight: gear up; banked and pitched by the rule as a craft with forms is, its one form the air)
  const opts = { pose: { gear: 1 }, ...(base.palette ? { palette: base.palette } : {}) };
  const figure = { ...craftFigure(A.archetype, { light: 'form', ...opts }), forms: { base: 'air' } };
  // its gun: the gun part's place (a pair's between them, their convergence), its muzzle the part's foremost reach
  const P = craftPieces(A.archetype, opts), guns = P.pieces.filter((p) => (X?.stores ? new RegExp(`^${X.stores[1]}`) : X?.strike ? /^hull$/ : /^gun/).test(p.id));
  const mid = (k) => guns.reduce((a, p) => a + p.head[k], 0) / guns.length;
  let muzzle = -Infinity;
  for (const p of guns) for (let j = 1; j < p.soup.pos.length; j += 3) muzzle = Math.max(muzzle, p.soup.pos[j]);
  const at = X?.strike ? [0, 0, r3(P.height / 2)] : [r3(mid(1)), 0, r3(mid(2))];
  const T = { ...mountOf('light-tank', { mount: { fixed: true, at, traverse: { rate: 0 }, elevation: { rate: 0, min: 0, max: 0 }, stabilized: false }, gun: { barrel: X?.strike ? 0 : r3(muzzle - at[0]) } }), ...(X?.strike ? { strike: { min: 4 } } : {}) };
  // its rounds: its gun's, fired at its rate, a load of them, reloaded on the ground's time (the range's); a drone's
  // stores one by one; a loitering munition's warhead, and the next off its rack
  const rounds = G ? G.rounds.map((w) => { const { cooldown: _c, ...W } = ordnanceWeapon(w, { reload }); return { ...W, auto: true, rof: G.rof, magazine: G.load, reserve: G.load * 2 }; })
    : X.stores ? [{ ...ordnanceWeapon(X.stores[0], { reload }), cooldown: 1, magazine: X.stores[2], reserve: X.stores[2], shotSound: 'launcher shot' }]
      : [{ ...ordnanceWeapon(X.strike, { reload: 2 }), magazine: 1, reserve: 5 }];
  const label = G ? G.label : X.stores ? `${ORDNANCE[X.stores[0]].label}s` : `${ORDNANCE[X.strike].label.replace(/, dropped$/, '')}, carried in`;
  // its rule: its envelope, the throttle a lever set where its cruise holds, flying already, kept to the range
  // (its ground looked for from 30 m over its belly: in a dive it falls metres a frame, and a probe from just above it
  // would start under the ground and miss it)
  const rule = { ...flyRule(A.craft, { lever: true }), launchSpeed: C.cruise, leverStart: r3((C.cruise / C.max) ** 2), bound: { ...BOUND }, collideHeight: 30 };
  const size = r3(Math.max(P.height, P.length / 2.6));
  const prop = /^(warbird|navalWarbird|male|loiter)$/.test(A.craft), small = C.mass < 100;
  // (a small drone starts low and near: its cruise is a car's)
  const pos = small ? [-150, 0, 60] : [-START.back, 0, START.height];
  const fire = X?.strike ? 'fly it in · click  release its warhead' : 'click  fire';
  return {
    id: A.id, archetype: A.archetype, craft: A.craft, envelope: C, gun: { label, ...(G ? { sku: A.gun, ...G } : {}) }, figure, rule, turret: T, rounds, size, prop, transform: { pos, heading: 0, pitch: 0 },
    engine: small ? 'drone-motors' : prop ? 'prop-engine' : 'jet-engine', shot: X?.strike ? 'mag out' : 'machine gun', keys: `mouse  pitch · A / D  bank · W / S  throttle · ${fire}`,
  };
}
