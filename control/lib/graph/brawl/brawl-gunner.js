/**
 * brawl gunner — the run & gun's buttons, the brawl scheme's four and the stick, read into the core's command (a body
 * with a gun, brawl-core.js): no melee.
 *
 *   the stick       walks along the street and across it, and AIMS (eight ways) while it fires
 *   attack (A)      FIRES, held: at its gun's rate, the way the stick points (or the way the body faces)
 *   strong (St)     PLANTS, held: the body stands its ground and the stick only aims
 *   jump (J)        a jump the way the stick points; it fires in the air too
 *   special (S)     a GRENADE, lobbed the way the stick points (or ahead), while it has one
 *   the stick tapped twice the same way (along or across): the ROLL that way, untouchable as it goes
 *
 *   newGunReader() / readGunButtons(reader, buttons, body) → [pad, reader']
 *   gunMoveList(guns, grenades?) → the gunner's moves and its guns as its player reads them (the command list's kinds)
 *
 * Pure: no clock, no dice.
 */
import { DASH_WAIT } from './brawl-moves.js';

export const newGunReader = () => ({ px: 0, pz: 0, tk: null, tt: 99, pj: 0, ps: 0 });

/** A seat's buttons this frame (`{ x, z, a, h, j, s }`, held) → [the core's pad, the reader after]. */
export function readGunButtons(reader, buttons, body) {
  const r = { ...reader };
  const x = Math.sign(buttons.x ?? 0), z = Math.sign(buttons.z ?? 0);
  // (a tap: the stick pushed one way along, or across, from not that way; twice within DASH_WAIT the same way, a roll)
  let roll = false;
  const tapX = x && x !== r.px, tapZ = z && z !== r.pz;
  r.tt = Math.min(99, r.tt + 1);
  if (tapX || tapZ) {
    const key = tapX ? `x${x}` : `z${z}`;
    if (key === r.tk && r.tt <= DASH_WAIT) { roll = true; r.tk = null; r.tt = 99; } else { r.tk = key; r.tt = 0; }
  }
  r.px = x; r.pz = z;
  const plant = !!buttons.h, aim = x || z ? [x, z] : [body.face, 0];
  const pad = { x: plant ? 0 : x, z: plant ? 0 : z };
  if (roll) Object.assign(pad, { dash: 'roll', x, z });
  if (buttons.a) pad.fire = aim;
  const jP = !!buttons.j && !r.pj, sP = !!buttons.s && !r.ps;
  r.pj = buttons.j ? 1 : 0; r.ps = buttons.s ? 1 : 0;
  if (jP) pad.jump = true;
  if (sP) pad.lob = aim;
  return [pad, r];
}

const perSecond = (frames) => Math.round((600 / frames)) / 10;
const ms = (mm) => Math.round((mm * 60) / 100) / 10;
/** The gunner's moves and its guns (each its numbers), by kind. */
export function gunMoveList(guns, grenades = null) {
  const gunData = (g) => [
    { what: 'round speed (m/s)', value: String(ms(g.speed)) }, { what: 'shots a second', value: String(perSecond(g.rate)) },
    { what: 'rounds a shot', value: String(g.pellets) }, { what: 'damage a round', value: String(g.damage) },
    { what: 'passes through', value: String(g.pierce) }, { what: 'reach (m)', value: String(Math.round((g.speed * g.life) / 100) / 10) },
    ...(g.area ? [{ what: 'burst (m)', value: String(g.area / 1000) }] : []),
    { what: 'ammo', value: g.ammo === null ? 'never out' : String(g.ammo) },
  ];
  return [
    { label: 'Guns', moves: guns.map((g) => ({ name: g.name ?? g.id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), input: 'A', about: g.says, data: gunData(g) })) },
    { label: 'Moves', moves: [
      { name: 'Fire', input: 'A (held)', about: 'at the gun\'s rate, the way the stick points; walking, slower', data: [] },
      { name: 'Aim', input: 'stick + A', about: 'eight ways: along the street, across it, and the four between (shallow across)', data: [] },
      { name: 'Plant', input: 'St (held)', about: 'stand your ground: the stick only aims', data: [] },
      { name: 'Roll', input: '→ → / ↑ ↑', about: 'tapped twice any way: a roll, untouchable as it starts; a round passes through', data: [] },
      { name: 'Jump', input: 'J', about: 'the way the stick points; fire in the air too', data: [] },
      { name: 'Grenade', input: 'S', about: 'lobbed over the crowd, it bursts where it lands', data: grenades === null ? [] : [{ what: 'grenades', value: String(grenades) }] },
    ] },
  ];
}
