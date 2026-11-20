/**
 * FACILITIES — buildings designed as places to move through, named so a level or a walled-core dungeon's space picks
 * one by its word: a use (era/programs.js), the plan's fighting dials that give it loops, wide corridors and a catwalk
 * (programs.js FIGHT), its rooms' floors laid in figures (era/room-layouts.js) and the look it is built in, a
 * construction and a palette (era/style/bay-axes.js), each one's materials its own. A building of a use alone is a
 * corridor of five-metre rooms, stocked along their walls: a hallway and empty boxes to a sneaking body. A facility
 * keeps the use's rooms and makes them a ground: the hall a maze, the corridors stacked, a second door to every room.
 * A new facility is a row.
 *
 *   FACILITIES   { <id>: { reads, use, scale, look: { construction, palette }, fight, layouts, moves } }
 *     scale      how much larger than a walker needs it is laid (era/program-core.js): a third-person camera's room
 *     vents      its crawl spaces (era/vents.js): a duct behind each row of rooms, a hatch into each, out of the corridors
 *     windows    its glass onto the corridors (era/inner-windows.js): a guard in the corridor sees in, nobody walks through
 *     moves      what a body does there, in a line: the routes its pieces make (a level's design reads it)
 *
 *   facilityBuilding(id) → the building it is ({ use, look, fight, layouts }): a level's `building` or a space's, the
 *                          recipe's own settings laid over it (a look, a fight, a layout of its own win)
 *
 * Pure data. docs/facility-pieces.md.
 */
const row = (o) => Object.freeze({ ...o, look: Object.freeze(o.look), fight: Object.freeze(o.fight), layouts: Object.freeze(o.layouts) });

export const FACILITIES = Object.freeze({
  depot: row({
    reads: 'a goods depot: the shed a maze of rack aisles under a catwalk, crates against its wide corridors\' walls by turns, the dispatch offices desk pods',
    use: 'warehouse', scale: 1.5, vents: true, look: { construction: 'utility', palette: 'utility' },
    fight: { rings: true, gallery: true },
    layouts: {
      shed: { layout: 'aisles', piece: 'rack', cross: 'staggered', run: 3 },
      corridor: { layout: 'chicane' },
      dispatch: { layout: 'islands', per: 1, margin: 1.2 },
      locker: { layout: 'aisles', piece: 'shelves', margin: 1.2 },
    },
    moves: 'down an aisle out of sight of the next, across at the breaks; up to the catwalk over them; along the corridors stack to stack',
  }),
  'power-plant': row({
    reads: 'a power plant in poured concrete: the generator hall a staggered field of sets under the gallery, drums against the corridors\' walls by turns, the pump rooms each a machine to circle',
    use: 'plant', scale: 1.5, vents: true, look: { construction: 'bunker', palette: 'military' },
    fight: { rings: true, gallery: true },
    layouts: {
      'generator-hall': { layout: 'machines', pieces: ['generator', 'switchgear', 'pump', 'generator'], lane: 2.2, fill: 1 },
      corridor: { layout: 'chicane', piece: 'drum', len: 3, cover: 0.55 },
      pump: { layout: 'machines', pieces: ['pump'], margin: 1.2 },
      switchgear: { layout: 'aisles', piece: 'switchgear', pair: false, margin: 1.2 },
    },
    moves: 'set to set across the hall in the lanes, a gaze stopped by every tall machine; under the gallery\'s watcher; drum to drum down a corridor',
  }),
  'motor-pool': row({
    reads: 'a motor pool in steel plate: the hangar a yard of stacked crates, the parts rooms rack aisles, the shops bench islands',
    use: 'hangar-bay', scale: 1.5, vents: true, look: { construction: 'military', palette: 'military' },
    fight: { rings: true, gallery: true },
    layouts: {
      hangar: { layout: 'stockpile', spacing: 5, jitter: 0.8 },
      corridor: { layout: 'chicane', piece: 'ammo-crate', len: 3 },
      parts: { layout: 'aisles', piece: 'shelves', margin: 1.2 },
      shop: { layout: 'islands', piece: 'workbench', end: 'tool-chest', per: 1, margin: 1.2 },
    },
    moves: 'clump to clump across the hangar, a stack to crouch behind or climb; the catwalk over it; the shops ducked between the benches',
  }),
  'research-wing': row({
    reads: 'a research wing in glazed panels and terrazzo: the instrument bay a grid of rack aisles, the labs bench islands, the stores shelved',
    use: 'lab-building', scale: 1.5, vents: true, windows: { roles: ['lab'] }, look: { construction: 'science', palette: 'science' },
    fight: { rings: true, stagger: true },
    layouts: {
      instrument: { layout: 'aisles', piece: 'instrument-rack', cross: 'aligned', run: 4, aisle: 2 },
      lab: { layout: 'islands', piece: 'workbench', end: null, per: 1, margin: 1.2 },
      store: { layout: 'aisles', piece: 'shelves', margin: 1.2 },
    },
    moves: 'room to room through the rung doorways, never back to the clean corridor; the instrument bay a grid crossed aisle by aisle',
  }),
  'field-hq': row({
    reads: 'a headquarters on carpet and gypsum: the staff and planning offices desk pods behind their cabinets, the briefing rooms their desks in rows',
    use: 'command', scale: 1.5, vents: true, windows: { roles: ['staff', 'planning', 'briefing'] }, look: { construction: 'everyday', palette: 'everyday' },
    fight: { rings: true, stagger: true },
    layouts: {
      staff: { layout: 'islands', per: 1, margin: 1.2 },
      planning: { layout: 'islands', per: 1, margin: 1.2 },
      briefing: { layout: 'rows', piece: 'desk', aisle: 2, lane: 1.4, margin: 1.2 },
      corridor: { layout: 'chicane', piece: 'filing', len: 3, cover: 0.5 },
    },
    moves: 'office to office through the side doors, crouched behind a pod\'s cabinet; the corridors crossed, never walked',
  }),
  armoury: row({
    reads: 'an armoury in steel plate: each cage room a ring of mesh round its racks, seen into from its gate; the magazine stacked in clumps; the vault caged at the end; the issue and cleaning rooms windowed onto the corridor',
    use: 'armoury', scale: 1.5, vents: true, windows: { roles: ['issue', 'cleaning'] }, look: { construction: 'military', palette: 'utility' },
    fight: { rings: true, stagger: true },
    layouts: {
      cage: { layout: 'cage', piece: 'weapon-rack' },
      vault: { layout: 'cage', piece: 'weapon-rack', margin: 1.9 },
      magazine: { layout: 'stockpile', piece: 'ammo-crate', spacing: 3.2 },
      corridor: { layout: 'chicane', piece: 'ammo-crate', len: 3 },
    },
    moves: 'round a cage to its gate with a guard\'s gaze coming through the mesh; past the windowed rooms below their sills; behind the rows by the vents',
  }),
});

export const FACILITY_IDS = Object.freeze(Object.keys(FACILITIES));

/** A facility's building, the recipe's own settings over it (its look and its layouts merged, a dial of its own kept). */
export function facilityBuilding(id, own = {}) {
  const F = FACILITIES[id];
  if (!F) throw new Error(`building: facility '${id}' is not one (${FACILITY_IDS.join(', ')})`);
  if (own.use !== undefined && own.use !== F.use) throw new Error(`building: facility '${id}' is a ${F.use}; give its use or none`);
  const { facility: _f, ...rest } = own;
  return {
    ...rest, use: F.use, scale: own.scale ?? F.scale, vents: own.vents ?? F.vents, ...((own.windows ?? F.windows) ? { windows: own.windows ?? F.windows } : {}),
    look: { ...F.look, ...(own.look ?? {}) },
    fight: own.fight === undefined ? { ...F.fight } : own.fight,
    layouts: { ...F.layouts, ...(own.layouts ?? {}) },
  };
}
