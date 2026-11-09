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
 *   aircraft  a word the vehicle registry knows for one of the shelf's aircraft ('warbird', 'jet fighter', 'attack jet')
 *
 * Its gun: the shelf's gun part (a heavy machine gun, a 20 mm rotary cannon, a 30 mm revolver or rotary cannon), its
 * rounds and its rate by calibre (ordnance.js AIR_GUNS); a pair of wing guns fires from between them (their convergence).
 * An aircraft the shelf builds without a gun (a transport, a stealth strike jet) is refused here, by name: its stores are
 * not yet the range's.
 *
 * Vehicle space as the shelves' (+y the nose, +x right, metres). Pure; an airframe's build is the slow part.
 */
import { craftFigure, craftPieces } from '../../craft-shelf/craft-rig.js';
import { CRAFT_ARCHETYPES } from '../../craft-shelf/craft-archetypes.js';
import { flyRule } from '../../skyscape/craft.js';
import { CRAFT } from '../../skyscape/eye.js';
import { resolveVehicle, handlesOf } from '../../vehicle-registry/roster.js';
import { AIR_GUNS, ordnanceWeapon } from './ordnance.js';
import { mountOf } from './mount.js';

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
/** The shelf's armed aircraft and the CRAFT envelope each flies on (its type's published figures). */
export const AIRFRAMES = Object.freeze({
  warbird: 'warbird', navalCorsair: 'navalWarbird', jetFighter: 'multirole', deltaInterceptor: 'deltaInterceptor', carrierFighter: 'carrierFighter', attackJet: 'attack',
});
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
  const gun = A.layout.find((e) => e.id === 'gun');
  if (!AIRFRAMES[a] || !gun || !AIR_GUNS[gun.sku]) return { why: `the ${hit.id} carries no gun the range fires (the armed: ${Object.keys(AIRFRAMES).join(', ')})` };
  return { id: hit.id, archetype: a, craft: AIRFRAMES[a], gun: gun.sku };
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
  const A = aircraftOf(base.aircraft), C = CRAFT[A.craft], G = AIR_GUNS[A.gun];
  // (its rig in flight: gear up; banked and pitched by the rule as a craft with forms is, its one form the air)
  const opts = { pose: { gear: 1 }, ...(base.palette ? { palette: base.palette } : {}) };
  const figure = { ...craftFigure(A.archetype, { light: 'form', ...opts }), forms: { base: 'air' } };
  // its gun: the gun part's place (a pair's between them, their convergence), its muzzle the part's foremost reach
  const P = craftPieces(A.archetype, opts), guns = P.pieces.filter((p) => /^gun/.test(p.id));
  const mid = (k) => guns.reduce((a, p) => a + p.head[k], 0) / guns.length;
  let muzzle = -Infinity;
  for (const p of guns) for (let j = 1; j < p.soup.pos.length; j += 3) muzzle = Math.max(muzzle, p.soup.pos[j]);
  const at = [r3(mid(1)), 0, r3(mid(2))];
  const T = mountOf('light-tank', { mount: { fixed: true, at, traverse: { rate: 0 }, elevation: { rate: 0, min: 0, max: 0 }, stabilized: false }, gun: { barrel: r3(muzzle - at[0]) } });
  // its rounds: its gun's, fired at its rate, a load of them, reloaded on the ground's time (the range's)
  const rounds = G.rounds.map((w) => { const { cooldown: _c, ...W } = ordnanceWeapon(w, { reload }); return { ...W, auto: true, rof: G.rof, magazine: G.load, reserve: G.load * 2 }; });
  // its rule: its envelope, the throttle a lever set where its cruise holds, flying already, kept to the range
  // (its ground looked for from 30 m over its belly: in a dive it falls metres a frame, and a probe from just above it
  // would start under the ground and miss it)
  const rule = { ...flyRule(A.craft, { lever: true }), launchSpeed: C.cruise, leverStart: r3((C.cruise / C.max) ** 2), bound: { ...BOUND }, collideHeight: 30 };
  const size = r3(Math.max(P.height, P.length / 2.6));
  return { id: A.id, archetype: A.archetype, craft: A.craft, envelope: C, gun: { sku: A.gun, ...G }, figure, rule, turret: T, rounds, size, prop: /^(warbird|navalWarbird)$/.test(A.craft), transform: { pos: [-START.back, 0, START.height], heading: 0, pitch: 0 } };
}
