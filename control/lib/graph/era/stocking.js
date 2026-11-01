/**
 * STOCKING — what a military base's rooms hold, as a supply chain stocks them (a base's buildings: programs.js
 * BASE_USES). A composed base building's rooms are laid from these tables (compose-dress.js layProps) in place of the
 * register's generic clusters: a bunk room its bunks, footlockers and lockers; an armoury's cage its weapon racks; a
 * magazine its ammunition; a plant's pump room its pumps and fuel. Every other stage is dressed as it was.
 *
 *   STOCK       { <room role>: [[piece, [least, most], where]] }   a room's role is its id without its number
 *               (`bunks-103` → `bunks`); `where` is `wall` (abreast along its walls, backs to them) or `centre` (in rows
 *               in its middle); how many of each by the room's dice, inside the range, as many as the room holds clear
 *   GREAT       { <use>: piece }   the great object a use stands at its landmark's focus, in place of its register's
 *   FUEL, AMMO, WEAPONS, EXTINGUISHER   the pieces the laws read
 *   roleOf(id)  → the room's role
 *   stockLaws(plan, items, openings) → [{ id, ok, says }]   the supply chain's laws, advising:
 *     weapons-in-armoury   a weapon rack stands only in an armoury
 *     fuel-apart           no fuel drum within FUEL_GAP metres of ammunition, in any room
 *     extinguisher-by-exit every doorway of a stocked room has an extinguisher within EXIT_REACH metres of it
 *     stocked              every room the tables stock holds something of its stock
 *
 * Pure data and pure reads; no dice here (compose-dress.js rolls a room's counts).
 */

export const STOCK = Object.freeze({
  // the way in of any base building: a guard post of sandbags, cover in front of the door
  lobby: [['sandbags', [1, 2], 'centre']],
  // hangar bay
  'ready-room': [['locker', [4, 8], 'wall'], ['desk', [1, 2], 'centre']],
  shop: [['bench', [1, 2], 'wall'], ['tool-chest', [2, 3], 'wall'], ['rack', [1, 1], 'wall']],
  parts: [['rack', [2, 4], 'wall'], ['crate', [2, 4], 'wall']],
  'flight-ops': [['radio-console', [1, 2], 'wall'], ['desk', [1, 2], 'centre']],
  hangar: [['container', [1, 2], 'wall'], ['barrier', [2, 4], 'centre'], ['drum', [3, 5], 'wall'], ['tool-chest', [2, 3], 'wall']],
  // barracks
  bunks: [['bunk', [2, 4], 'wall'], ['footlocker', [2, 4], 'wall'], ['locker', [2, 4], 'wall']],
  'day-room': [['mess-table', [1, 2], 'centre'], ['locker', [1, 2], 'wall']],
  latrine: [['sink-row', [1, 1], 'wall']],
  laundry: [['washer', [2, 4], 'wall'], ['rack', [1, 1], 'wall']],
  'nco-office': [['desk', [1, 1], 'centre'], ['filing', [2, 3], 'wall']],
  // armoury: the weapons and their rounds, never the fuel
  issue: [['desk', [1, 1], 'wall'], ['weapon-rack', [1, 2], 'wall']],
  cleaning: [['bench', [1, 2], 'wall'], ['tool-chest', [1, 2], 'wall']],
  cage: [['weapon-rack', [3, 6], 'wall']],
  magazine: [['ammo-crate', [3, 6], 'wall'], ['ammo-can', [2, 4], 'wall']],
  vault: [['weapon-rack', [2, 3], 'wall'], ['ammo-crate', [2, 3], 'wall']],
  // comms
  server: [['instrument-rack', [3, 6], 'wall']],
  radio: [['radio-console', [1, 3], 'wall'], ['filing', [1, 1], 'wall']],
  'cable-vault': [['rack', [1, 2], 'wall'], ['crate', [1, 2], 'wall']],
  crypto: [['radio-console', [1, 2], 'wall'], ['filing', [1, 2], 'wall']],
  // command
  briefing: [['desk', [2, 4], 'centre']],
  staff: [['desk', [1, 2], 'centre'], ['filing', [1, 2], 'wall']],
  planning: [['desk', [1, 2], 'centre'], ['filing', [1, 2], 'wall']],
  'ops-centre': [['radio-console', [2, 4], 'wall']],
  // mess
  scullery: [['sink-row', [1, 2], 'wall'], ['rack', [1, 1], 'wall']],
  store: [['rack', [2, 3], 'wall'], ['crate', [2, 4], 'wall']],
  'cold-store': [['rack', [2, 3], 'wall'], ['crate', [1, 3], 'wall']],
  quartermaster: [['desk', [1, 1], 'centre'], ['filing', [2, 3], 'wall'], ['crate', [1, 2], 'wall']],
  dining: [['mess-table', [4, 8], 'centre']],
  // med-bay
  scrub: [['sink-row', [1, 1], 'wall']],
  triage: [['cot', [2, 3], 'wall'], ['cart', [1, 2], 'wall']],
  ward: [['cot', [2, 4], 'wall'], ['locker', [1, 2], 'wall']],
  theatre: [['cot', [1, 1], 'centre'], ['instrument-rack', [1, 2], 'wall'], ['cart', [1, 1], 'wall']],
  pharmacy: [['rack', [2, 3], 'wall'], ['filing', [1, 2], 'wall']],
  // cell-block
  guard: [['desk', [1, 1], 'centre'], ['locker', [1, 2], 'wall']],
  processing: [['desk', [1, 2], 'centre'], ['filing', [1, 1], 'wall']],
  cell: [['cot', [1, 1], 'wall']],
  interview: [['desk', [1, 1], 'centre']],
  isolation: [['cot', [1, 1], 'wall']],
  // plant: the fuel and the machines, never the ammunition
  control: [['radio-console', [1, 2], 'wall'], ['switchgear', [1, 1], 'wall']],
  switchgear: [['switchgear', [2, 3], 'wall']],
  pump: [['pump', [1, 3], 'centre'], ['drum', [2, 3], 'wall']],
  battery: [['switchgear', [2, 4], 'wall']],
  'plant-control': [['radio-console', [2, 3], 'wall'], ['switchgear', [1, 2], 'wall']],
  'generator-hall': [['drum', [3, 5], 'wall'], ['barrier', [1, 2], 'centre'], ['tool-chest', [1, 2], 'wall']],
});
/** The great object a base use stands at its landmark's focus, in place of its register's. */
export const GREAT = Object.freeze({ command: 'ops-table', plant: 'generator' });
export const FUEL = Object.freeze(['drum']);
export const AMMO = Object.freeze(['ammo-crate', 'ammo-can']);
export const WEAPONS = Object.freeze(['weapon-rack']);
export const EXTINGUISHER = 'extinguisher';
const FUEL_GAP = 3, EXIT_REACH = 2.5;

/** A room's role: its id without its number (`bunks-103` → `bunks`, `corridor-1a` → `corridor`). */
export const roleOf = (id) => id.replace(/-\d+[a-z]?$/, '');

/** The supply chain's laws on a base building's laid things. `openings(room)` its doorways' middles ([x, y]). */
export function stockLaws(plan, items, openings) {
  const out = [], by = new Map();
  for (const it of items) { if (!by.has(it.room)) by.set(it.room, []); by.get(it.room).push(it); }
  const dist = (a, b) => Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]);
  // weapons only in an armoury
  const racks = plan.use === 'armoury' ? [] : items.filter((it) => WEAPONS.includes(it.kind)).map((it) => it.id);
  out.push({ id: 'weapons-in-armoury', ok: !racks.length, says: racks.length ? `${racks.slice(0, 4).join(', ')}: weapons stand only in an armoury` : 'weapons stand only in an armoury' });
  // fuel apart from ammunition
  const near = [];
  for (const list of by.values()) for (const f of list.filter((it) => FUEL.includes(it.kind))) for (const a of list.filter((it) => AMMO.includes(it.kind))) if (dist(f, a) < FUEL_GAP) near.push(`${f.id} by ${a.id}`);
  out.push({ id: 'fuel-apart', ok: !near.length, says: near.length ? `${near.slice(0, 4).join('; ')}: fuel within ${FUEL_GAP} m of ammunition` : `no fuel within ${FUEL_GAP} m of ammunition` });
  // an extinguisher by every exit of a stocked room
  const bare = [];
  for (const [room, list] of by) {
    // (a room is stocked by its stock: a set piece at its focus, a find or a prize, is not stock)
    if (!list.some((it) => !it.set && it.kind !== EXTINGUISHER)) continue;
    const ext = list.filter((it) => it.kind === EXTINGUISHER);
    for (const [k, m] of openings(room).entries()) if (!ext.some((e) => Math.hypot(e.at[0] - m[0], e.at[1] - m[1]) <= EXIT_REACH)) bare.push(`${room} door ${k + 1}`);
  }
  out.push({ id: 'extinguisher-by-exit', ok: !bare.length, says: bare.length ? `${bare.slice(0, 4).join(', ')}${bare.length > 4 ? ` and ${bare.length - 4} more` : ''}: no extinguisher within ${EXIT_REACH} m` : `an extinguisher within ${EXIT_REACH} m of every exit of a stocked room` });
  // every stocked role holds some of its stock
  const empty = plan.rooms.filter((r) => STOCK[roleOf(r.id)] && !(by.get(r.id) ?? []).some((it) => STOCK[roleOf(r.id)].some(([k]) => k === it.kind))).map((r) => r.id);
  out.push({ id: 'stocked', ok: !empty.length, says: empty.length ? `${empty.slice(0, 6).join(', ')}${empty.length > 6 ? ` and ${empty.length - 6} more` : ''}: none of its stock fits` : 'every room holds its stock' });
  return out;
}
