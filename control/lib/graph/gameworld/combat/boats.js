/**
 * THE BOATS ON THE RANGE — the craft shelf's boats driven on the artillery range's water: each on the boat rule
 * (worlds/controllable/rules-boat.js) at its class's figures (craft-shelf/boat-drive.js: its power, its top speed, its
 * turning circle; where it floats), drawn as its shelf rig (craft-shelf/craft-rig.js) riding the swell, its wake drawn on
 * the live water at its speed (scene/channels/controllable/boat-water.js), started off the shore behind the firing line.
 *
 *   boatBase({ boat, palette? }) → the range's base: { id, archetype, figure, rule, turret, rounds, size, transform,
 *                                  sea, engine, keys, gun }
 *   BOAT_ARMS                      each boat's gun, as such boats are armed:
 *     a military boat's own        the combat RHIB's and the riverine boat's bow machine gun, the landing craft's ring
 *                                  mount, the navy patrol boat's 30 mm cannon, the destroyer's 127 mm gun (its high
 *                                  explosive shell, and its high arc on the far field), the carrier's close-in gun: its
 *                                  mount's bone turned by the hand
 *     fitted                       a boat built unarmed (a skiff, a runabout, a submarine on the surface) is fitted a
 *                                  heavy machine gun on a pintle at its bow (the submarine's on its sail)
 *
 *   boat  a word the vehicle registry knows for one of the shelf's boats ('motor skiff', 'combat rhib', 'patrol boat',
 *         'destroyer'); a boat it builds no drive for is refused by name
 *
 * Vehicle space as the shelves' (+y the bow, +x starboard, metres). Pure; a boat's build at its speeds is the slow part.
 */
import { craftFigure, craftPieces } from '../../craft-shelf/craft-rig.js';
import { boatDrive, BOAT_DRIVE } from '../../craft-shelf/boat-drive.js';
import { CRAFT_ARCHETYPES } from '../../craft-shelf/craft-archetypes.js';
import { resolveVehicle, handlesOf } from '../../vehicle-registry/roster.js';
import { SEAWAY_WATERS } from '../../worlds/seaway-scene.js';
import { resolveAquaLook } from '../../materials/aqua-look.js';
import { ordnanceWeapon } from './ordnance.js';
import { mountOf } from './mount.js';

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
// the mounts by kind: a machine gun swung by its gunner (his arms its stabilizer), a naval cannon's powered mount, a big
// gun's, a close-in gun's
const MG = Object.freeze({ traverse: { rate: 120, accel: 480 }, elevation: { rate: 90, accel: 360, min: -15, max: 60 }, stabilized: true, look: 0.08 });
const KINDS = Object.freeze({
  mg: Object.freeze({ label: '12.7 mm machine gun', mount: MG, rounds: Object.freeze([['ap127', 9, 600]]), barrel: 1.6 }),
  cannon30: Object.freeze({ label: '30 mm naval cannon', mount: { traverse: { rate: 60, accel: 120, min: -150, max: 150 }, elevation: { rate: 50, accel: 100, min: -20, max: 55 }, stabilized: true, look: 0.06 }, rounds: Object.freeze([['apds30', 3, 400], ['he30', 3, 400]]) }),
  gun127: Object.freeze({ label: '127 mm naval gun', mount: { traverse: { rate: 30, accel: 30, min: -170, max: 170 }, elevation: { rate: 20, accel: 30, min: -15, max: 65 }, stabilized: true, look: 0.05 }, rounds: Object.freeze([['he', 0, 20], ['indirect', 0, 20]]), reload: 3 }),
  ciws: Object.freeze({ label: '20 mm close-in gun', mount: { traverse: { rate: 115, accel: 600 }, elevation: { rate: 90, accel: 600, min: -25, max: 85 }, stabilized: true, look: 0.08 }, rounds: Object.freeze([['api20', 25, 1550]]) }),
});
/** Each boat's gun: its mount's bone (its own) or where one is fitted, and its kind. */
export const BOAT_ARMS = Object.freeze({
  combatRhib: Object.freeze({ bone: 'gunBow', kind: 'mg', arc: [-150, 150] }),
  riverinePatrol: Object.freeze({ bone: 'gunBow', kind: 'mg', arc: [-150, 150] }),
  landingCraft: Object.freeze({ bone: 'gunRoof', kind: 'mg' }),
  navalPatrol: Object.freeze({ bone: 'cannon', kind: 'cannon30' }),
  destroyer: Object.freeze({ bone: 'gun', kind: 'gun127' }),
  aircraftCarrier: Object.freeze({ bone: 'ciwsBow', kind: 'ciws' }),
  attackSub: Object.freeze({ fit: 'sail', kind: 'mg' }),
  motorSkiff: Object.freeze({ fit: 'bow', kind: 'mg' }), jonBoat: Object.freeze({ fit: 'bow', kind: 'mg' }), ribTender: Object.freeze({ fit: 'bow', kind: 'mg' }),
  ccRunabout: Object.freeze({ fit: 'bow', kind: 'mg' }), ccTTop: Object.freeze({ fit: 'bow', kind: 'mg' }), cuddyCabin: Object.freeze({ fit: 'bow', kind: 'mg' }),
});
// where the water is: the shore (m along the firing line) the stands stand inland of, and where a boat starts off it
export const SHORE = 150;

/** A boat's word through the library: its row and its archetype, or why not. */
export function boatOf(word) {
  const hit = typeof word === 'string' ? resolveVehicle(word) : null;
  if (!hit) return { why: `'${word}' is not a vehicle of the library` };
  const a = (handlesOf(hit.id).craft ?? [])[0];
  if (!a || CRAFT_ARCHETYPES[a]?.realm !== 'water') return { why: `the ${hit.id} is no boat of the craft shelf` };
  if (!BOAT_DRIVE[a] || !BOAT_ARMS[a]) return { why: `the ${hit.id} has no drive on the range (the boats: ${Object.keys(BOAT_DRIVE).join(', ')})` };
  return { id: hit.id, archetype: a };
}

/** What is wrong with a boat base's words; [] when it can be driven on the range. */
export function validateBoat(base = {}) {
  const B = boatOf(base.boat), errs = B.archetype ? [] : [`base.boat: ${B.why}`];
  for (const k of Object.keys(base)) if (!['boat', 'palette'].includes(k)) errs.push(`base.${k}: a boat base is { boat, palette? }`);
  return errs;
}

// a piece's place (its head) and its soup's reach toward the bow and its top
function extent(p) {
  let fy = -Infinity, tz = -Infinity;
  for (let j = 0; j < p.soup.pos.length; j += 3) { fy = Math.max(fy, p.soup.pos[j + 1]); tz = Math.max(tz, p.soup.pos[j + 2]); }
  return { head: p.head, fore: fy, top: tz };
}
// the top of a hull (its pieces') near a station along it, and the station of its highest point (a submarine's sail)
function topAt(pieces, y, band = 0.6) {
  let z = -Infinity;
  for (const p of pieces) for (let j = 0; j < p.soup.pos.length; j += 3) if (Math.abs(p.soup.pos[j + 1] - y) < band && Math.abs(p.soup.pos[j]) < 0.6) z = Math.max(z, p.soup.pos[j + 2]);
  return z;
}
function highest(pieces) {
  let best = [0, 0, -Infinity];
  for (const p of pieces) for (let j = 0; j < p.soup.pos.length; j += 3) if (p.soup.pos[j + 2] > best[2]) best = [p.soup.pos[j], p.soup.pos[j + 1], p.soup.pos[j + 2]];
  return best;
}

/** The shelf's boat as the range's base: its rig, its rule, its gun and its rounds, its water, where it starts. */
export function boatBase(base, { reload = 6 } = {}) {
  const errs = validateBoat(base);
  if (errs.length) throw new Error(`artillery range: ${errs.join('; ')}`);
  const { id, archetype: a } = boatOf(base.boat), arms = BOAT_ARMS[a], K = KINDS[arms.kind];
  const opts = base.palette ? { palette: base.palette } : {};
  // (its rig, its one form the water: pitched and rolled by the rule's tilt as a craft with forms is)
  const figure = { ...craftFigure(a, { light: 'form', ...opts }), forms: { base: 'water' } };
  const P = craftPieces(a, opts), D = boatDrive(a), wl = D.waterline;
  // its gun: on its own mount's bone, turned by the hand, or fitted on a pintle at its bow (a submarine's on its sail)
  let at, barrel = K.barrel ?? 1.6, bone = null;
  if (arms.bone) {
    const e = extent(P.pieces.find((p) => p.id === arms.bone));
    at = [r3(e.head[1]), r3(e.head[0]), r3(Math.max(e.head[2], e.top - 0.4))];
    barrel = K.barrel ?? r3(Math.max(1, e.fore - e.head[1]));
    bone = arms.bone;
  } else if (arms.fit === 'sail') {
    const h = highest(P.pieces);
    at = [r3(h[1]), 0, r3(h[2] + 0.9)];
  } else {
    const y = wl.fore - 0.3 * wl.length;
    at = [r3(y), 0, r3(topAt(P.pieces, y) + 0.9)];
  }
  const M = K.mount, arc = arms.arc ? { min: arms.arc[0], max: arms.arc[1] } : {};
  const T = mountOf('light-tank', { mount: { ...M, at, traverse: { ...M.traverse, ...arc } }, gun: { barrel } });
  const rounds = K.rounds.map(([w, rof, load]) => {
    const W = ordnanceWeapon(w, { reload: K.reload ?? reload });
    return rof > 0 ? (({ cooldown: _c, ...x }) => ({ ...x, auto: true, rof, magazine: load, reserve: load * 2 }))(W) : { ...W, magazine: load, reserve: load * 2, cooldown: K.reload ?? reload };
  });
  // its water: a lake's ripple for a small boat, the sea's swell for a ship; its wake at each of its speeds
  const kind = wl.length > 30 ? 'ocean' : 'lake', Wt = SEAWAY_WATERS[kind];
  const rule = { ...D.rule, swell: Wt.swell, water: 0 };
  const L = CRAFT_ARCHETYPES[a].reference.length, size = r3(Math.max(P.height, L / 2.6));
  const sea = { kind, color: Wt.color, swell: Wt.swell, look: resolveAquaLook(kind === 'ocean' ? 'ocean' : 'lake'), wakes: D.wakes, waterline: wl, shore: SHORE, sheet: { size: r3(Math.max(240, 14 * L)), n: 150 } };
  const small = BOAT_DRIVE[a].drive === 'outboard';
  return {
    id, archetype: a, figure, rule, turret: T, rounds, size, sea, bone, fitted: !arms.bone,
    gun: { label: K.label, kind: arms.kind }, drive: { ...BOAT_DRIVE[a], top: D.rule.top, planing: D.rule.planing, circle: D.rule.circle },
    transform: { pos: [r3(-200 - 3 * L), 0, 0], heading: 0, pitch: 0 },
    engine: small ? 'boat-engine' : 'diesel-engine',
    keys: 'W / S  throttle (it stays where it is set) · A / D  helm · mouse  aim the gun · click  fire',
  };
}
