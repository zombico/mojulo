/**
 * THE ROTORCRAFT ON THE RANGE — the craft shelf's helicopters and multirotor drones flown on the artillery range: each
 * on the hover rule (worlds/controllable/rules-hover.js) at its type's envelope (skyscape/rotor.js ROTOR, its published
 * figures), drawn as its shelf rig (craft-shelf/craft-rig.js: a bone per part, its rotors turning, its disc tilted as it
 * flies), started hovering behind the firing line. aircraft.js dispatches a rotorcraft's word here.
 *
 *   rotorBase(A, base, { reload }) → the range's base (aircraft.js airBase's shape)
 *   ROTOR_ARMS                     how each is armed, as such machines are:
 *     gun     an attack helicopter's chin chain gun, on its turret aimed by the hand (stabilized, its arcs);
 *             a utility or a heavy-lift helicopter's door gun, on its pintle in the right door (the gunner's arcs);
 *             a light helicopter's gun pod (a scout's, along its nose)
 *     stores  rounds fired along its nose from its own pylons (an attack helicopter's rocket pods and missile rails)
 *     drop    rounds a drone lets go below it, by what it lifts (a camera quad one grenade; a heavy lifter mortar bombs and
 *             shaped-charge bomblets)
 *     strike  the drone is itself the munition (a racing quad carrying an RPG warhead): flown into what it strikes
 *
 * Pure; a rig's build is the slow part.
 */
import { craftFigure, craftPieces } from '../../craft-shelf/craft-rig.js';
import { ROTOR, hoverRule } from '../../skyscape/rotor.js';
import { AIR_GUNS, ORDNANCE, ordnanceWeapon } from './ordnance.js';
import { mountOf } from './mount.js';

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
export const ROTOR_ARMS = Object.freeze({
  attackHeli: Object.freeze({ gun: 'gun-heli-chin', chin: true, stores: Object.freeze([['rocket', 'rockets', 38, 4], ['missile', 'missiles', 8, 1]]) }),
  utilityHeli: Object.freeze({ gun: 'door-gun', door: true }),
  tandemHeli: Object.freeze({ gun: 'door-gun', door: true }),
  lightHeli: Object.freeze({ gun: 'gun-heavy-mg', pod: true }),
  cameraQuad: Object.freeze({ drop: Object.freeze([['grenade30', 1]]) }),
  inspectionQuad: Object.freeze({ drop: Object.freeze([['grenade30', 4], ['bomblet', 1]]) }),
  deliveryQuad: Object.freeze({ drop: Object.freeze([['grenade30', 4], ['bomblet', 1]]) }),
  coaxX8: Object.freeze({ drop: Object.freeze([['mortar60', 2], ['bomblet', 1]]) }),
  heavyHex: Object.freeze({ drop: Object.freeze([['mortar60', 4], ['bomblet', 2]]) }),
  cropSprayer: Object.freeze({ drop: Object.freeze([['mortar60', 6], ['bomblet', 4]]) }),
  fpvRacer: Object.freeze({ strike: 'warhead' }),
});
// where each starts (behind the firing line, hovering: a helicopter well back, a drone near the first stands) and the
// reach the bound turns it back at
const START = Object.freeze({ heli: Object.freeze({ x: -400, z: 40 }), drone: Object.freeze({ x: 120, z: 40 }) });
const BOUND = Object.freeze({ heli: Object.freeze({ cx: 1000, hx: 2600, hy: 2000, warn: 5 }), drone: Object.freeze({ cx: 1000, hx: 1600, hy: 1200, warn: 5 }) });

// a part's place on the rig (its pieces' head: the mean of a pair), its reach toward the nose, its soup's bounds
function placeOf(pieces) {
  const mid = (k) => pieces.reduce((a, p) => a + p.head[k], 0) / pieces.length;
  let reach = -Infinity;
  for (const p of pieces) for (let j = 1; j < p.soup.pos.length; j += 3) reach = Math.max(reach, p.soup.pos[j]);
  return { at: [r3(mid(1)), r3(mid(0)), r3(mid(2))], reach };
}
// the hull's side and its middle height at a station along it (m forward)
function sideAt(hull, f) {
  let x = 0, z0 = Infinity, z1 = -Infinity;
  const s = hull.soup.pos;
  for (let j = 0; j < s.length; j += 3) if (Math.abs(s[j + 1] - f) < 0.6) { x = Math.max(x, Math.abs(s[j])); z0 = Math.min(z0, s[j + 2]); z1 = Math.max(z1, s[j + 2]); }
  return { x, z: Number.isFinite(z0) ? (z0 + z1) / 2 : 1 };
}
// (each weapon a store of its own beside the others: turret.js `store`)
const gunRounds = (G, reload, store) => G.rounds.map((w) => { const { cooldown: _c, ...W } = ordnanceWeapon(w, { reload }); return { ...W, auto: true, rof: G.rof, magazine: G.load, reserve: G.load * 2, ...(store ? { store: true } : {}) }; });

/** A rotorcraft (aircraft.js's resolution of its word: { id, archetype, rotor }) as the range's base. */
export function rotorBase(A, base = {}, { reload = 3 } = {}) {
  const R = ROTOR[A.rotor], arms = ROTOR_ARMS[A.archetype], drone = !/Heli$/.test(A.archetype);
  const opts = base.palette ? { palette: base.palette } : {};
  // (its rig, its one form the air: banked and pitched by the rule's tilt, as a fixed wing's)
  const figure = { ...craftFigure(A.archetype, { light: 'form', ...opts }), forms: { base: 'air' } };
  const P = craftPieces(A.archetype, opts), byId = (re) => P.pieces.filter((p) => re.test(p.id));
  const hull = byId(/^(hull|frame)$/)[0], rotor = placeOf(byId(/rotor/i).filter((p) => !/tail/i.test(p.id)));
  const G = arms.gun ? AIR_GUNS[arms.gun] : null;
  let mount, barrel, rounds, label, strike = null;
  if (arms.chin) {
    // the chin gun: on its turret under the nose, slewed by the hand, stabilized (its arcs: wide either side, well down)
    const g = placeOf(byId(/^gun$/));
    mount = { at: g.at, traverse: { rate: 90, accel: 360, min: -110, max: 110 }, elevation: { rate: 60, accel: 240, min: -60, max: 11 }, stabilized: true, look: 0.08 };
    barrel = r3(Math.max(1.2, g.reach - g.at[0]));
  } else if (arms.door) {
    // the door gun: on its pintle in the right door, just ahead of the rotor's mast, swung by its gunner's arms
    const f = rotor.at[0] + 0.6, s = sideAt(hull, f);
    mount = { at: [r3(f), r3(s.x + 0.25), r3(s.z)], traverse: { rate: 150, accel: 600, min: -170, max: -10 }, elevation: { rate: 120, accel: 480, min: -60, max: 15 }, stabilized: true, look: 0.08 };
    barrel = 1.6;
  } else if (arms.pod) {
    // a scout's gun pod: on the left of its cabin, along its nose
    const f = rotor.at[0] + 0.4, s = sideAt(hull, f);
    mount = { fixed: true, at: [r3(f), r3(-(s.x + 0.35)), r3(Math.max(0.5, s.z - 0.4))], traverse: { rate: 0 }, elevation: { rate: 0, min: 0, max: 0 }, stabilized: false };
    barrel = 1.0;
  } else {
    // a drone's: let go below it (its belly), or itself carried in (from its middle, along its path)
    mount = { fixed: true, at: [0, 0, r3(arms.strike ? P.height / 2 : 0)], traverse: { rate: 0 }, elevation: { rate: 0, min: 0, max: 0 }, stabilized: false, ...(arms.drop ? { fixedPitch: -90 } : {}) };
    barrel = 0;
  }
  if (G) { rounds = gunRounds(G, reload, !!arms.stores); label = G.label; }
  // its stores: fired along its nose from its pylons (a pair's from between them)
  for (const [w, part, n, rate] of arms.stores || []) {
    const s = placeOf(byId(new RegExp(`^${part}`)));
    rounds.push({ ...ordnanceWeapon(w, { reload }), fixed: true, at: s.at, barrel: r3(Math.max(0.5, s.reach - s.at[0])), cooldown: r3(1 / rate), magazine: n, reserve: n, store: true, shotSound: 'launcher shot' });
  }
  if (arms.drop) { rounds = arms.drop.map(([w, n]) => ({ ...ordnanceWeapon(w, { reload }), cooldown: 0.4, magazine: n, reserve: n * 2, ...(arms.drop.length > 1 ? { store: true } : {}) })); label = `${ORDNANCE[arms.drop[0][0]].label.replace(/, dropped$/, '')}s, dropped`; }
  if (arms.strike) { rounds = [{ ...ordnanceWeapon(arms.strike, { reload: 2 }), magazine: 1, reserve: 5 }]; label = `${ORDNANCE[arms.strike].label}`; strike = { min: 4 }; }
  const T = { ...mountOf('light-tank', { mount, gun: { barrel } }), ...(strike ? { strike } : {}) };
  const S = START[drone ? 'drone' : 'heli'];
  const rule = { ...hoverRule(A.rotor), bound: { ...BOUND[drone ? 'drone' : 'heli'] }, collideHeight: 3 };
  const size = r3(Math.max(P.height, P.length / 2.6));
  const how = arms.chin || arms.door ? 'mouse  aim the gun' : 'mouse  turn';
  const fire = arms.drop ? 'click  drop' : arms.strike ? 'fly it in · click  release its warhead' : 'click  fire';
  return {
    id: A.id, archetype: A.archetype, rotor: A.rotor, envelope: R, gun: { label, ...(G ? { sku: arms.gun, ...G } : {}) },
    figure, rule, turret: T, rounds, size, transform: { pos: [S.x, 0, S.z], heading: 0, pitch: 0 },
    engine: drone ? 'drone-motors' : 'helicopter', shot: arms.drop || arms.strike ? 'mag out' : 'machine gun', ...(arms.drop ? { drop: true } : {}),
    keys: `W / S  ${R.hold ? 'fly ahead, back' : 'cyclic'} · Q / E  sidestep · A / D  pedals · Space / Shift  climb, descend · ${how} · ${fire}`,
  };
}
