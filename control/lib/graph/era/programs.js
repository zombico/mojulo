/**
 * PROGRAMS — a game building's plan from its use: rooms by role, packed on a room kit's grid and joined by doorways,
 * with no livability pass. A stage recipe's `program: { use }` lowers to the `rooms` and `links` the stage already
 * builds, so the kit dresses them and the level (structure/level.js) plays them.
 *
 * Who designs a building (three owners):
 *   - the PROGRAM (here): the plan — which rooms, how big, which leads to which, where the way in and the goal are;
 *   - the CIVILIZATION's language (era/out-anchor-structure.js): its storey height sets the rooms' heights, a tall use
 *     (a hall, a temple) promotes it as the town's uses do (out-structures.js STRUCTURE_USES);
 *   - the CUBE (era/geocube.js) or the kit: the materials, the light and the room kit that dresses it.
 *
 * Game plausibility only, said as findings (advisory, never refused): every room joined, a way in on the outside,
 * the goal the room most doorways in, every room inside its role's size, and any room the packer could not seat.
 *
 *   PROGRAMS                      the uses: the town's six, then the game's
 *   planProgram(program, kit)     → { use, rooms, links, entry, goal, front, language, findings }
 *   withProgram(manifest)         a stage recipe's `program` lowered to its rooms and links (the recipe's own win)
 *
 * Pure: seeded dice only. Metres, z-up; rooms are the stage's boxes ({ id, x, y, w, d, h }, x,y the min corner).
 */
import { planCore } from './program-core.js';
import { readLayouts } from './room-layouts.js';
import { readVents } from './vents.js';
import { readInnerWindows } from './inner-windows.js';
import { STAGE_KITS, resolveKitId } from './stage.js';
import { STRUCTURE_USES } from './out-structures.js';
import { ANCHOR_IDS, ANCHOR_STRUCTURES, decompileAnchor } from './out-anchor-structure.js';
import { readGeocube, cubeBuildings } from './geocube.js';
import { readStyle } from './arch-style.js';
import { composeForBuild } from './compose.js';
import { bayKitOf } from './style/bay-kits.js';

// a room: [role, w range, d range, the role it opens off, { h: storeys tall, n: how many, p: the chance it is there,
// s: its storey, over: true when it is the room over the one it opens off (climbed to by a stair, storeys.js), or the
// role of the room it stands over (its twin a storey up, opening off a room of its own storey); end: it opens off its
// parent by its short end (a stair's room: its flights run the long way, clear of the doorway) }]
// sizes are game sizes (metres), a little over life so a camera and a walker fit; a goal room is 6 m across or more,
// since a kit's dressing seats its set piece (a tomb, an altar) there; a stair's room is 7 by 8, a straight steep
// flight up one side, the hole of the one below down the other, and a way between them
const R = (role, w, d, of = null, o = {}) => ({ role, w, d, of, ...o });

/** The uses. `entry` is the first room (the way in), `goal` the room a level ends in, `tall` the town use whose
 *  storey height the main room takes (a hall's, a workshop's), `shape` how it reads. */
export const PROGRAMS = Object.freeze({
  // the town's six (era/out-structures.js STRUCTURE_USES): a town lot's use is its inside's program
  dwelling: { reads: 'a household round a hearth: a hall, the kitchen and hearth room off it, the chambers behind', shape: 'hub', goal: 'chamber',
    rooms: [R('hall', [5, 7], [4, 6]), R('kitchen', [4, 6], [4, 5], 'hall'), R('hearth', [5, 7], [5, 6], 'hall'), R('chamber', [6, 7], [6, 7], 'hearth'), R('pantry', [3, 4], [4, 4], 'kitchen', { p: 0.6 })] },
  shop: { reads: 'a household over a counter: the shop floor on the lane, the back room and the store behind it', shape: 'chain', goal: 'store',
    rooms: [R('shopfloor', [6, 9], [5, 7]), R('backroom', [4, 6], [4, 5], 'shopfloor'), R('store', [6, 7], [6, 7], 'backroom'), R('office', [3, 4], [4, 4], 'backroom', { p: 0.5 })] },
  workshop: { reads: 'a work floor behind a wide door: tall, with a store and a bench room off it', shape: 'hub', tall: 'workshop', goal: 'store',
    rooms: [R('workfloor', [7, 10], [6, 8], null, { h: 'tall' }), R('bench', [4, 5], [4, 5], 'workfloor', { p: 0.7 }), R('store', [6, 7], [6, 7], 'workfloor')] },
  barn: { reads: 'one great floor for carts, stalls along its side', shape: 'hall-and-cells', tall: 'barn', goal: 'stall',
    rooms: [R('floor', [9, 12], [8, 10], null, { h: 'tall' }), R('stall', [6, 6], [6, 7], 'floor', { n: 3 })] },
  hall: { reads: 'where the village gathers: a porch, one tall room, the dais at its end', shape: 'chain', tall: 'hall', goal: 'dais',
    rooms: [R('porch', [4, 6], [4, 4]), R('hall', [10, 14], [8, 12], 'porch', { h: 'tall' }), R('dais', [6, 7], [6, 7], 'hall'), R('vestry', [3, 4], [4, 4], 'hall', { p: 0.5 })] },
  tower: { reads: 'height seen from the trail: three storeys up one stair, the base, the guard room over it, the lookout at the top', shape: 'stack', goal: 'lookout',
    rooms: [R('base', [7, 8], [7, 8]), R('stair', [7, 7], [8, 8], 'base', { end: true }),
      R('landing', null, null, 'stair', { s: 1, over: true }), R('guard', null, null, 'landing', { s: 1, over: 'base' }),
      R('top', null, null, 'landing', { s: 2, over: true }), R('lookout', null, null, 'top', { s: 2, over: 'guard' })] },
  // the game's
  tavern: { reads: 'a taproom on the street, the kitchen behind the bar, a snug off it, the cellar under it all', shape: 'hub', goal: 'cellar',
    rooms: [R('taproom', [8, 11], [6, 9]), R('kitchen', [4, 6], [4, 5], 'taproom'), R('snug', [4, 5], [4, 5], 'taproom', { p: 0.7 }), R('cellar', [6, 7], [6, 7], 'kitchen', { h: 0.85 }), R('store', [3, 4], [4, 4], 'cellar', { p: 0.5 })] },
  keep: { reads: 'a gatehouse, the great hall, the chapel off it; up the stair the lord\'s solar and the treasury behind', shape: 'chain', tall: 'hall', goal: 'treasury',
    rooms: [R('gatehouse', [6, 7], [6, 7]), R('hall', [10, 14], [8, 10], 'gatehouse', { h: 'tall' }), R('chapel', [4, 6], [5, 7], 'hall', { p: 0.6 }), R('armoury', [6, 7], [6, 7], 'gatehouse'),
      R('stair', [7, 7], [8, 8], 'armoury', { end: true }), R('landing', null, null, 'stair', { s: 1, over: true }), R('solar', null, null, 'landing', { s: 1, over: 'armoury' }), R('treasury', null, null, 'solar', { s: 1, over: 'gatehouse' })] },
  temple: { reads: 'a porch, the long tall nave, the sanctuary at its head', shape: 'chain', tall: 'hall', goal: 'sanctuary',
    rooms: [R('narthex', [6, 8], [4, 4]), R('nave', [7, 9], [12, 16], 'narthex', { h: 'tall' }), R('sanctuary', [6, 8], [5, 6], 'nave'), R('vestry', [3, 4], [4, 4], 'sanctuary', { p: 0.6 })] },
  // a building whose rooms are FOUGHT IN (gameroom/fight.js): each sized for a fight of a kind as a hero that plays strings
  // asks it (a ring, the rifts round it, headroom for a launch), one after another to the sanctum: a gate court (a duel's),
  // the great hall (a melee's), the long gallery (a gallery's, its run-up down the spine), the sanctum (a boss's)
  citadel: { reads: 'a gate court, the great hall, the long gallery, the sanctum at its head: each a room to fight in, one after another', shape: 'chain', tall: 'hall', goal: 'sanctum',
    rooms: [R('gate', [14, 14], [14, 14], null, { h: 1.7 }), R('hall', [20, 22], [20, 22], 'gate', { h: 'tall' }), R('gallery', [20, 22], [24, 26], 'hall', { h: 'tall' }), R('sanctum', [24, 26], [24, 26], 'gallery', { h: 'tall' })] },
  crypt: { reads: 'a stair down, a long gallery, chambers off it, the tomb at the end', shape: 'chain', goal: 'tomb',
    rooms: [R('stair', [5, 6], [5, 6]), R('gallery', [4, 4], [10, 14], 'stair'), R('chamber', [6, 8], [6, 7], 'gallery', { n: 2 }), R('tomb', [8, 10], [8, 10], 'chamber', { h: 1.2 })] },
  guardhouse: { reads: 'the guard room on the gate, bunks and the cells off it, the armoury behind', shape: 'hub', goal: 'armoury',
    rooms: [R('guardroom', [6, 8], [5, 6]), R('bunks', [4, 6], [4, 5], 'guardroom'), R('cell', [3, 3], [4, 4], 'guardroom', { n: 2 }), R('armoury', [6, 7], [6, 7], 'bunks')] },
  library: { reads: 'a reading room, the stacks behind it, the archive at the back', shape: 'chain', goal: 'archive',
    rooms: [R('reading', [7, 9], [6, 8], null, { h: 1.3 }), R('stacks', [4, 5], [8, 10], 'reading', { n: 2 }), R('archive', [6, 7], [6, 7], 'stacks')] },
  // an ARCADE (geocity/walkins.js): a foyer off the street, one long games floor of cabinets (its minigames,
  // gameworld/minigames.js ROOMS_KEPT), the prize counter at its end
  arcade: { reads: 'a foyer off the street, the long games floor, the prize counter at its end', shape: 'chain', goal: 'prizes',
    rooms: [R('foyer', [6, 7], [4, 5]), R('floor', [12, 14], [14, 18], 'foyer', { h: 1.3 }), R('prizes', [6, 7], [5, 6], 'floor'), R('office', [3, 4], [4, 4], 'prizes', { p: 0.5 })] },
  lab: { reads: 'a lobby, the lab floor, a store, and the sealed core', shape: 'chain', goal: 'core',
    rooms: [R('lobby', [5, 7], [4, 5]), R('lab', [8, 10], [7, 9], 'lobby', { h: 1.2 }), R('store', [4, 5], [4, 4], 'lab', { p: 0.6 }), R('core', [6, 7], [6, 7], 'lab')] },
  // buildings (era/program-core.js): a core and its wings, the same plate up every storey, a lobby with the way in; each
  // names its bay kit (the recipe's own kit wins), its typical floor's height, the roles along a wing (`near` the first
  // bay's on the service side, `second` the other first bay, `far` a wing's last, `goal` the top storey's farthest)
  office: { reads: 'a lobby and a stair core, wings of offices along corridors, a meeting room at each wing\'s end, the boardroom at the top', shape: 'core', goal: 'boardroom', kit: 'bay-everyday',
    core: { storeys: 4, wings: 'L', loading: 'double', bays: 3, h: 3.5 }, lobby: { d: 8, h: 5 }, roles: { near: 'wc', second: 'kitchen', room: 'office', far: 'meeting', goal: 'boardroom' } },
  'lab-building': { reads: 'a lobby and a stair core, labs both sides of a clean corridor, an instrument bay off the ground floor, the clean room at the top', shape: 'core', goal: 'cleanroom', kit: 'bay-science',
    core: { storeys: 2, wings: 'I', loading: 'double', bays: 3, h: 3.5 }, lobby: { d: 8, h: 4.5 }, roles: { near: 'wc', second: 'store', room: 'lab', far: 'writeup', goal: 'cleanroom' }, annex: { role: 'instrument', w: 12, d: 18, h: 9 } },
  warehouse: { reads: 'a goods-in lobby and a stair, an office block over the lockers, the tall shed off its end with its dock doors, the manager\'s office at the top', shape: 'core', goal: 'manager', kit: 'bay-utility',
    core: { storeys: 2, wings: 'I', loading: 'single', bays: 2, h: 3.5 }, lobby: { d: 8, h: 4 }, roles: { near: 'wc', second: 'locker', room: 'office', far: 'dispatch', goal: 'manager' }, annex: { role: 'shed', w: 18, d: 30, h: 12, ways: ['+x'] } },
  clinic: { reads: 'a waiting room at the front, consult rooms both sides of the corridors, treatment rooms at their ends, the records room last', shape: 'core', goal: 'records', kit: 'bay-everyday',
    core: { storeys: 1, wings: 'T', loading: 'double', bays: 2, h: 3.5 }, lobby: { d: 8, h: 4 }, roles: { near: 'wc', second: 'waiting', room: 'consult', far: 'treatment', goal: 'records' } },
  // a family's HOUSE (a mover's: gameworld/movers.js): a hall at the door with the stair, the kitchen and the dining room off
  // it, bedrooms along the corridor, the living room at its end, the main bedroom upstairs; a basement under it all where
  // it asks (`basement`); furnished as a home is (stocking.js HOME_STOCK), every piece of it a thing to carry out
  house: { reads: 'a hall at the door with the stair, the kitchen and the dining room off it, bedrooms along the corridor, the living room at its end, the main bedroom upstairs', shape: 'core', goal: 'master', kit: 'bay-everyday', home: true,
    look: Object.freeze({ construction: 'everyday', palette: 'everyday', plot: 'everyday', dressing: 'everyday' }),
    core: { storeys: 2, wings: 'I', loading: 'single', bays: 2, h: 3 }, lobby: { d: 6, h: 3.2 }, roles: { near: 'kitchen', second: 'dining', room: 'bedroom', far: 'living', goal: 'master' } },
  // a MUSEUM: a lobby at the front, three wings of galleries in a T off it (a wing a collection, exhibits.js), each
  // wing's end its hall; tall plaster rooms under daylight and track light, nothing to fight in
  museum: { reads: 'a lobby, galleries both sides of three wings in a T, each wing\'s end a hall, the great hall last', shape: 'core', goal: 'great-hall', kit: 'bay-gallery',
    // (its look, compose.js and bay-axes.js `gallery`: plaster walls a room's own colour, oak and pale stone underfoot,
    // daylight through coffers and warm track light, bare; its things its plinths alone)
    look: Object.freeze({ construction: 'gallery', palette: 'gallery', plot: 'gallery', dressing: 'gallery' }),
    core: { storeys: 1, wings: 'T', loading: 'double', bays: 3, h: 5 }, lobby: { d: 10, h: 6 }, roles: { near: 'gallery', second: 'gallery', room: 'gallery', far: 'hall', goal: 'great-hall' } },
  // a military base's buildings (a walled-core dungeon's spaces, wcd/wcd.js), on the same core: each on the bay kit of
  // what it is (a hangar's steel, a barracks' painted block, a comms room's white panels, a plant's concrete), so the
  // layers a base is walked through look unlike each other; the rooms are what a base is stocked for
  'hangar-bay': { reads: 'a crew lobby and a stair, the ready room and the shops along a wing, the hangar off its end with its doors, flight ops at the top', shape: 'core', goal: 'flight-ops', kit: 'bay-military', base: true,
    core: { storeys: 2, wings: 'I', loading: 'single', bays: 3, h: 3.5 }, lobby: { d: 8, h: 4.5 }, roles: { near: 'wc', second: 'ready-room', room: 'shop', far: 'parts', goal: 'flight-ops' }, annex: { role: 'hangar', w: 24, d: 30, h: 12, ways: ['+x'] } },
  barracks: { reads: 'a duty desk and a stair, bunk rooms both sides of the corridors, the latrine and the day room nearest, the first sergeant\'s office at the top', shape: 'core', goal: 'nco-office', kit: 'bay-everyday', base: true,
    core: { storeys: 2, wings: 'L', loading: 'double', bays: 3, h: 3.2 }, lobby: { d: 6, h: 3.5 }, roles: { near: 'latrine', second: 'day-room', room: 'bunks', far: 'laundry', goal: 'nco-office' } },
  armoury: { reads: 'an issue window off the lobby, the cleaning room, the rack cages along one corridor, the vault at its end', shape: 'core', goal: 'vault', kit: 'bay-military', base: true,
    core: { storeys: 1, wings: 'I', loading: 'single', bays: 3, h: 3.5 }, lobby: { d: 6, h: 3.5 }, roles: { near: 'issue', second: 'cleaning', room: 'cage', far: 'magazine', goal: 'vault' } },
  comms: { reads: 'a guarded lobby and a stair, the radio rooms both sides, the server room nearest, the crypto room at the top', shape: 'core', goal: 'crypto', kit: 'bay-science', base: true,
    core: { storeys: 2, wings: 'I', loading: 'double', bays: 2, h: 3.5 }, lobby: { d: 6, h: 4 }, roles: { near: 'wc', second: 'server', room: 'radio', far: 'cable-vault', goal: 'crypto' } },
  command: { reads: 'a reception and a stair, the staff offices along a T of corridors, the briefing room nearest, the operations centre at the top', shape: 'core', goal: 'ops-centre', kit: 'bay-everyday', base: true,
    core: { storeys: 2, wings: 'T', loading: 'double', bays: 2, h: 3.5 }, lobby: { d: 8, h: 4.5 }, roles: { near: 'wc', second: 'briefing', room: 'staff', far: 'planning', goal: 'ops-centre' } },
  mess: { reads: 'a serving lobby, the scullery and the stores along a wing, the cold store at its end, the dining hall off it, the quartermaster at the far end', shape: 'core', goal: 'quartermaster', kit: 'bay-utility', base: true,
    core: { storeys: 1, wings: 'I', loading: 'single', bays: 3, h: 3.5 }, lobby: { d: 8, h: 4 }, roles: { near: 'wc', second: 'scullery', room: 'store', far: 'cold-store', goal: 'quartermaster' }, annex: { role: 'dining', w: 18, d: 20, h: 6, ways: ['+x'] } },
  'med-bay': { reads: 'triage at the front, the wards both sides of a T of corridors, the theatres at their ends, the pharmacy last', shape: 'core', goal: 'pharmacy', kit: 'bay-science', base: true,
    core: { storeys: 1, wings: 'T', loading: 'double', bays: 2, h: 3.5 }, lobby: { d: 8, h: 4 }, roles: { near: 'scrub', second: 'triage', room: 'ward', far: 'theatre', goal: 'pharmacy' } },
  'cell-block': { reads: 'a sally port and processing, the cells both sides of a long corridor, the interview rooms at its end, isolation last', shape: 'core', goal: 'isolation', kit: 'bay-military', base: true,
    core: { storeys: 1, wings: 'I', loading: 'double', bays: 4, h: 3.2 }, lobby: { d: 6, h: 3.5 }, roles: { near: 'guard', second: 'processing', room: 'cell', far: 'interview', goal: 'isolation' } },
  plant: { reads: 'a control lobby and a stair, switchgear and pumps along an L, the battery room at its end, the generator hall off it, the plant control at the top', shape: 'core', goal: 'plant-control', kit: 'bay-utility', base: true,
    core: { storeys: 2, wings: 'L', loading: 'single', bays: 3, h: 3.5 }, lobby: { d: 6, h: 4 }, roles: { near: 'control', second: 'switchgear', room: 'pump', far: 'battery', goal: 'plant-control' }, annex: { role: 'generator-hall', w: 18, d: 24, h: 12, ways: ['+x'] } },
  // a hospital's buildings (a campus, network/campuses.js: joined below grade by a public passage and a service tunnel),
  // on the same core, stocked by their rooms' roles (stocking.js HOSPITAL_STOCK): beds, trolleys, the theatre's lamp
  emergency: { reads: 'triage and resus nearest the way in, the cubicles both sides of the corridors, imaging at their ends, the ambulance bay off the end, the observation ward last', shape: 'core', goal: 'observation', kit: 'bay-science', hospital: true,
    core: { storeys: 1, wings: 'L', loading: 'double', bays: 3, h: 3.5 }, lobby: { d: 8, h: 4.5 }, roles: { near: 'resus', second: 'triage', room: 'cubicle', far: 'imaging', goal: 'observation' }, annex: { role: 'ambulance-bay', w: 14, d: 18, h: 6, ways: ['+x'] } },
  'ward-block': { reads: 'a reception and a stair, the wards both sides of the corridors, the sluice and the nurses\' station nearest, a day room at each wing\'s end, the ward office at the top', shape: 'core', goal: 'ward-office', kit: 'bay-everyday', hospital: true,
    core: { storeys: 3, wings: 'T', loading: 'double', bays: 3, h: 3.5 }, lobby: { d: 8, h: 4.5 }, roles: { near: 'sluice', second: 'nurses-station', room: 'ward', far: 'dayroom', goal: 'ward-office' } },
  theatres: { reads: 'a reception and a stair, the scrub and the anaesthetic rooms nearest, the theatres both sides of a clean corridor, recovery at its end, sterile services at the top', shape: 'core', goal: 'sterile', kit: 'bay-science', hospital: true,
    core: { storeys: 2, wings: 'I', loading: 'double', bays: 3, h: 3.8 }, lobby: { d: 8, h: 4.5 }, roles: { near: 'scrub', second: 'anaesthetic', room: 'theatre', far: 'recovery', goal: 'sterile' } },
});
export const PROGRAM_IDS = Object.freeze(Object.keys(PROGRAMS));
/** A hospital's buildings: the uses a hospital campus is made of (network/campuses.js). */
export const HOSPITAL_USES = Object.freeze(PROGRAM_IDS.filter((id) => PROGRAMS[id].hospital));
/** A use whose rooms are stocked by their roles (stocking.js): a base's building or a hospital's. */
export const stockedUse = (id) => !!(PROGRAMS[id]?.base || PROGRAMS[id]?.hospital);
/** A military base's buildings: the uses a walled-core dungeon's spaces are made of (card gameworld-wcd). */
export const BASE_USES = Object.freeze(PROGRAM_IDS.filter((id) => PROGRAMS[id].base));

/**
 * A BUILDING DESIGNED AS A FIGHTING MAP (`program.fight`, opt-in: absent, the plan is as it always was). The arena's
 * laws (arena-map/laws.js) read a plan's circuit, its lines and its height; each dial is the plan's answer to one of
 * them, where the concept lives:
 *   rings    no room hangs off one doorway: rooms along a wing open onto their neighbours (a house's leaves onto the
 *            room beside them), the lobby has a second door into the core, the first rooms into the lobby (or the core
 *            where no stair stands in it), the last into the annex (program-core.js, and the tree packer here)
 *   stagger  no straight line runs door to door across the core: of two opposite wings one leaves from the core's back,
 *            and a wing off the back takes the lobby's door to the other end of the core's front (program-core.js)
 *   stairs   a second way up: a stair room at the far end of each wing with no annex, on every storey, climbed by the
 *            building's own stair (program-core.js; storeys.js placeStairs lays it)
 *   gallery  the tall annex overlooked: its catwalk moved onto the wall the building stands against, at the upper
 *            storey's floor, opening from that storey's corridor (program-core.js; stage.js opens it; bay.js builds it)
 *   cover    the halls broken: the annex's own stock (stocking.js HALL_COVER) stood in its middle on a seeded lattice, a
 *            baffle off each doorway, its doorways, stairs and a lane round it kept clear (compose-dress.js layCover)
 *   room     room to fight in: every storey a metre taller and the corridors wide (program-core.js ROOMY), the core
 *            given the floor its stair needs up the taller storey
 * `fight: true` asks every dial; `{ rings?, stagger?, stairs?, gallery?, cover?, room? }` the ones named true. A house's plan
 * takes rings and cover; the rest are said (a finding) and laid nowhere.
 */
export const FIGHT = Object.freeze({
  rings: 'a second doorway for every room: no room hangs off one doorway',
  stagger: 'the core\'s doorways offset: no straight line door to door across it',
  stairs: 'a second stair at the far end of each wing, joining the same storeys',
  gallery: 'a gallery round the tall annex at the upper storey\'s floor, open to the hall, entered from the storey and by its stair',
  cover: 'cover in the middle of the halls: their own stock on a seeded lattice, the doorways and a way round clear',
  room: 'room to fight in: every storey a metre taller, the corridors wide enough for two to pass with cover between them',
});
export const FIGHT_DIALS = Object.freeze(Object.keys(FIGHT));
/** A program's `fight`, read: null when absent, else each dial true or false. */
export function readFight(v) {
  if (v === undefined || v === false) return null;
  if (v === true) return Object.fromEntries(FIGHT_DIALS.map((k) => [k, true]));
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.entries(v).some(([k, b]) => !FIGHT_DIALS.includes(k) || typeof b !== 'boolean'))
    throw new Error(`program: fight is true (every dial) or { ${FIGHT_DIALS.map((k) => `${k}?`).join(', ')} } (each true or false): the plan designed as a fighting map`);
  const F = Object.fromEntries(FIGHT_DIALS.map((k) => [k, v[k] === true]));
  return Object.values(F).some(Boolean) ? F : null;
}
// (a house's leaves, rung: each room with one doorway on its storey opened onto the room beside it that shares the most
// wall, never a stair's room; where none stands beside it, a second doorway into the room it opens off, the two at
// either end of the wall they share, where that wall holds two)
function ringHouse(rooms, links, need, overIds, kit) {
  const same = (l, a, b) => (l.from === a && l.to === b) || (l.from === b && l.to === a), stair = new Set(links.filter((l) => { const a = rooms.find((q) => q.id === l.from), b = rooms.find((q) => q.id === l.to); return a && b && (a.s ?? 0) !== (b.s ?? 0); }));
  const deg = (id) => links.filter((l) => !stair.has(l) && (l.from === id || l.to === id)).length + out.filter((l) => l.from === id || l.to === id).length;
  const out = [], m = kit.wall / 2 + kit.door.frame + kit.door.width / 2 + 0.01;
  for (const r of rooms) {
    if (overIds.has(r.id) || deg(r.id) > 1) continue;
    const s = r.s ?? 0, best = rooms.filter((q) => q !== r && (q.s ?? 0) === s && !overIds.has(q.id) && !links.some((l) => same(l, r.id, q.id)) && !out.some((l) => same(l, r.id, q.id)) && shared(r, q) >= need)
      .sort((p, q) => shared(r, q) - shared(r, p) || (p.id < q.id ? -1 : 1))[0];
    if (best) { out.push({ from: r.id, to: best.id }); continue; }
    // (its one doorway's room: a second doorway beside the first, the two at the ends of their wall)
    const l0 = links.find((l) => !stair.has(l) && (l.from === r.id || l.to === r.id)), p = l0 && rooms.find((q) => q.id === (l0.from === r.id ? l0.to : l0.from));
    if (!p || overIds.has(p.id)) continue;
    const alongX = r.y + r.d === p.y || p.y + p.d === r.y, lo = alongX ? Math.max(r.x, p.x) : Math.max(r.y, p.y), hi = alongX ? Math.min(r.x + r.w, p.x + p.w) : Math.min(r.y + r.d, p.y + p.d);
    if (hi - lo - kit.wall < 2 * (kit.door.width + 2 * kit.door.frame)) continue;
    Object.assign(l0, { along: +(lo + m).toFixed(6), alongX });
    out.push({ from: l0.to, to: l0.from, along: +(hi - m).toFixed(6), alongX });
  }
  return out;
}

/** A room kit's language when no civilization names one: the kit's own (outdoor kits carry theirs in STRUCTURE_RAILS). */
const KIT_ANCHOR = { 'gothic-stone': 'tiered', 'gothic-nave': 'tiered', catacomb: 'tiered', 'island-plaza': 'timber-hall', 'research-lab': 'shell' };

/** The language a program speaks: an anchor id, `{ anchor }`, an anchor's elements, or the kit's. */
function languageOf(civ, kitId) {
  const a = civ == null ? KIT_ANCHOR[kitId] ?? 'timber-hall' : typeof civ === 'string' ? civ : civ.anchor ?? civ;
  if (typeof a === 'string' && !ANCHOR_IDS.includes(a)) throw new Error(`program: civilization '${a}' is not an anchor (${ANCHOR_IDS.join(', ')}), nor { anchor } or an anchor's elements`);
  const L = decompileAnchor(typeof a === 'string' ? ANCHOR_STRUCTURES[a] : a, typeof a === 'string' ? a : null);
  return { id: L.id, storeyH: L.proportions.storeyH, entry: L.vocab.entryShape, opening: L.vocab.opening, cap: L.vocab.cap };
}

const GAME = 1.3;   // a game's rooms stand taller than life: the camera rides at the eye and needs air over it
const mid = (r) => (r[0] + r[1]) / 2;
const half = (v) => Math.round(v * 2) / 2;

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const SIDES = ['+x', '-x', '+y', '-y'];
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;
/** The length two touching boxes share along their common wall (0 when they do not touch). */
function shared(a, b) {
  if (a.x + a.w === b.x || b.x + b.w === a.x) return Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y);
  if (a.y + a.d === b.y || b.y + b.d === a.y) return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  return 0;
}

/**
 * The plan: each room seated against the room it opens off, on a side that is free, sharing enough wall for the
 * kit's doorway; the entry keeps its front (-y) clear for the way in. Rooms the packer cannot seat are dropped and
 * said.
 */
export function planProgram(program, kitId = 'gothic-stone', { civilization = null, kit: card = null } = {}) {
  if (!program || typeof program !== 'object') throw new Error(`program: give { use } (${PROGRAM_IDS.join(', ')})`);
  const use = program.use, P = PROGRAMS[use];
  if (!P) throw new Error(`program: use '${use}' is not one (${PROGRAM_IDS.join(', ')})`);
  // (a building's settings are its plan's: storeys, wings, loading, bays; a house's are its rooms')
  const settings = P.shape === 'core' ? ['use', 'seed', 'civilization', 'storeys', 'wings', 'loading', 'bays', 'basement', 'fight', 'layouts', 'scale', 'vents', 'windows'] : ['use', 'seed', 'rooms', 'add', 'civilization', 'scale', 'fight', 'layouts', 'vents', 'windows'];
  for (const k of Object.keys(program)) if (!settings.includes(k)) throw new Error(`program: '${k}' is not a setting (${settings.join(', ')})`);
  // (designed as a fighting map, opt-in: FIGHT)
  const fight = readFight(program.fight);
  // (a room's floor laid in a figure, opt-in: room-layouts.js)
  const layouts = readLayouts(program.layouts);
  // (crawl spaces, opt-in: vents.js; read here so a bad word is refused by name)
  const vents = readVents(program.vents);
  // (glass onto the corridors, opt-in: inner-windows.js)
  const windows = readInnerWindows(program.windows);
  // (a composed interior's card, compose.js, where it is not the kit's own: its doorways set the corridors' widths)
  const kit = card ?? STAGE_KITS[kitId];
  if (!kit || !kit.grid) throw new Error(`program: kit '${kitId}' is open ground; a program is laid in a room kit (${Object.keys(STAGE_KITS).filter((k) => STAGE_KITS[k].grid).join(', ')})`);
  const lang = languageOf(program.civilization ?? civilization, kitId);
  const rnd = mulberry32((program.seed ?? 1) * 2654435761 + use.length * 97);
  // a building: its core and wings (program-core.js), laid from the corner as the tree's plan is
  if (P.shape === 'core') {
    const C = planCore(P, fight ? { ...program, fight } : program, kit, rnd), x0 = Math.min(...C.rooms.map((r) => r.x)), y0 = Math.min(...C.rooms.map((r) => r.y));
    const rooms = C.rooms.map((r) => ({ ...r, x: r.x - x0, y: r.y - y0 }));
    // (a link's doorway set along its wall, `along`, is in the plan's frame too)
    const links = fight ? C.links.map(({ alongX, ...l }) => (l.along === undefined ? l : { ...l, along: +(l.along - (alongX ? x0 : y0)).toFixed(6) })) : C.links;
    return { use, reads: P.reads, rooms, links, ways: C.ways, entry: C.entry, goal: C.goal, front: '-y', language: lang, findings: C.findings, plan: C.plan, ...(C.under ? { under: C.under } : {}), ...(C.lifts ? { lifts: C.lifts } : {}), ...(fight ? { fight } : {}), ...(layouts ? { layouts } : {}), ...(vents ? { vents } : {}), ...(windows ? { windows } : {}) };
  }
  const g = kit.grid, need = kit.door.width + 2 * kit.door.frame + kit.wall;   // the wall a doorway needs (stage.js planStage)
  // (scale: the template's rooms laid larger, the plan scale times, its rooms' heights by its root: a party fights in
  // them under a camera that stands back, gameworld/levels.js; the recipe's own sizes are its own)
  const S = program.scale ?? 1;
  if (!(typeof S === 'number' && S >= 1 && S <= 3)) throw new Error('program: scale is how much larger its rooms are laid than a walker needs, 1 to 3');
  const pick = (r, k = S) => Math.round(((r[0] + rnd() * (r[1] - r[0])) * k) / g) * g;
  // the heights: the language's storey, lifted for a game, a tall use promoted as the town's uses are
  const dwellingH = mid(STRUCTURE_USES.dwelling.storeyH);
  const tallH = P.tall ? mid(STRUCTURE_USES[P.tall].storeyH) / dwellingH : 1;
  const heightOf = (o) => Math.max(2.5, half(lang.storeyH * GAME * (o.h === 'tall' ? tallH : o.h ?? 1) * (S === 1 || o.added ? 1 : Math.sqrt(S))));
  // the rooms in order (the template's, then the recipe's own), each with its id: its role, numbered past the first
  const over = program.rooms ?? {};
  if (typeof over !== 'object' || Array.isArray(over)) throw new Error('program: rooms is { <role or id>: { w?, d?, h?, drop? } }');
  const counts = {}, want = [];
  for (const t of P.rooms) for (let i = 0; i < (t.n ?? 1); i++) {
    const p = t.p ?? 1, there = p >= 1 || rnd() < p;
    counts[t.role] = (counts[t.role] ?? 0) + 1;
    const id = counts[t.role] === 1 ? t.role : `${t.role}-${counts[t.role]}`;
    if (there) want.push({ ...t, id });
  }
  for (const a of program.add ?? []) {
    if (!a || typeof a.id !== 'string' || typeof a.of !== 'string') throw new Error('program: add is [{ id, of, w?, d?, h? }] (of: the room it opens off)');
    want.push({ role: a.role ?? a.id, id: a.id, of: a.of, w: [a.w ?? 4, a.w ?? 5], d: [a.d ?? 4, a.d ?? 5], h: a.h != null ? a.h / (lang.storeyH * GAME) : 1, added: true });
  }
  const findings = [];
  const placed = [], byId = new Map(), links = [];
  const rolesOf = new Map();
  // the storey under s: the rooms a room upstairs may stand over (none taller than the room its stair climbs from)
  const overStorey = (box, s) => {
    const under = placed.filter((q) => (q.s ?? 0) === s - 1), cap = Math.max(...placed.filter((q) => (q.s ?? 0) === s && q.over).map((q) => byId.get(q.over).h));
    for (let x = box.x + 0.5; x < box.x + box.w; x += 1) for (let y = box.y + 0.5; y < box.y + box.d; y += 1)
      if (!under.some((q) => q.h <= cap + 1e-9 && x > q.x && x < q.x + q.w && y > q.y && y < q.y + q.d)) return false;
    return true;
  };
  for (const t of want) {
    const o = over[t.id] ?? over[t.role] ?? {};
    if (o.drop) { findings.push({ id: 'dropped', room: t.id, says: `the recipe dropped the ${t.id}` }); continue; }
    // a room opens off its role's first room, or the room the recipe's `of` names
    const parentId = o.of ?? (t.of == null ? null : byId.has(t.of) ? t.of : rolesOf.get(t.of));
    if (t.of != null && !byId.has(parentId)) { findings.push({ id: 'orphan', room: t.id, says: `the ${t.id} opens off the ${t.of}, which is not there` }); continue; }
    const st = t.s ?? 0, par0 = parentId ? byId.get(parentId) : null, stair = t.over === true;
    // a twin stands over the room its `over` names, on the storey under it
    const under = typeof t.over === 'string' ? byId.get(rolesOf.get(t.over) ?? t.over) : stair ? par0 : null;
    if (st && !(par0 && (stair ? (par0.s ?? 0) === st - 1 : (par0.s ?? 0) === st) && (!t.over || (under && (under.s ?? 0) === st - 1)))) { findings.push({ id: 'orphan', room: t.id, says: `the ${t.id} on storey ${st} opens off the ${t.of}${t.over && !stair ? ` over the ${t.over}` : ''}, which ${stair ? 'is not under it' : 'is not there on its storey'}` }); continue; }
    const w0 = under ? under.w : o.w ?? pick(t.w, t.added ? 1 : S), d0 = under ? under.d : o.d ?? pick(t.d, t.added ? 1 : S), h = o.h ?? heightOf(t);
    let room = null;
    if (!parentId) room = { id: t.id, x: 0, y: 0, w: w0, d: d0, h };
    // the room over another: its twin a storey up (over its parent: climbed to by a stair; else through a doorway)
    else if (under) {
      const box = { id: t.id, x: under.x, y: under.y, w: w0, d: d0, h, s: st };
      if (stair || (shared(box, par0) >= need && !placed.some((q) => (q.s ?? 0) === st && overlaps(box, q)))) room = box;
      if (!room) { findings.push({ id: 'unseated', room: t.id, says: `the ${t.id} over the ${t.over} shares no doorway's wall with the ${parentId}` }); continue; }
      links.push({ from: parentId, to: t.id });
    } else {
      const par = byId.get(parentId), order = SIDES.map((s) => [s, rnd()]).sort((p, q) => p[1] - q[1]).map(([s]) => s);
      // the entry keeps its front clear for the way in (and below, nothing else stands against it)
      const sides = par.id === placed[0].id ? order.filter((s) => s !== '-y') : order;
      for (const [w, d] of [[w0, d0], [d0, w0]]) {
        for (const s of sides) {
          const along = s.endsWith('x') ? 'y' : 'x', span = along === 'x' ? w : d, pSpan = along === 'x' ? par.w : par.d;
          if (t.end && span !== Math.min(w, d)) continue;
          const x = s === '+x' ? par.x + par.w : s === '-x' ? par.x - w : null, y = s === '+y' ? par.y + par.d : s === '-y' ? par.y - d : null;
          // centred on the parent first, then slid toward each end on the grid
          const c = (along === 'x' ? par.x : par.y) + Math.round((pSpan - span) / 2 / g) * g;
          const slides = [0]; for (let k = g; k <= Math.max(span, pSpan); k += g) slides.push(k, -k);
          for (const k of slides) {
            const box = { id: t.id, x: x ?? c + k, y: y ?? c + k, w, d, h, ...(st ? { s: st } : {}) };
            if (shared(box, par) < need) continue;
            if (placed.some((q) => (q.s ?? 0) === st && overlaps(box, q))) continue;
            // nothing is built against the way in's front
            const E = placed[0];
            if (!st && box.y + box.d === E.y && box.x < E.x + E.w && E.x < box.x + box.w) continue;
            // a room upstairs stands wholly over rooms no taller than the stair's (a tall hall rises through it)
            if (st && !overStorey(box, st)) continue;
            room = box; break;
          }
          if (room) break;
        }
        if (room) break;
      }
      if (!room) { findings.push({ id: 'unseated', room: t.id, says: `no free wall of the ${parentId} took the ${t.id}: give it a size (rooms.${t.id}: { w, d }) or let it go` }); continue; }
      links.push({ from: parentId, to: t.id });
    }
    if (stair) room.over = parentId;
    placed.push(room); byId.set(room.id, room);
    if (!rolesOf.has(t.role)) rolesOf.set(t.role, room.id);
    const want0 = P.rooms.find((q) => q.role === t.role);
    if (want0 && want0.w && !o.w && !o.d && (room.w * room.d < want0.w[0] * want0.d[0] - 1e-9)) findings.push({ id: 'small', room: room.id, says: `the ${room.id} is under its role's size` });
  }
  if (!placed.length) throw new Error(`program: no room of the ${use} could be seated`);
  // (designed as a fighting map: a house's leaves rung; the core's dials are not a house's, said)
  if (fight?.rings) {
    const overIds = new Set(placed.filter((q) => q.over).flatMap((q) => [q.id, q.over]));
    links.push(...ringHouse(placed, links, need, overIds, kit));
  }
  if (fight) for (const k of ['stagger', 'stairs', 'gallery']) if (fight[k]) findings.push({ id: 'fight', says: `fight.${k} is a building's on a core (an office, a warehouse, a base): a ${use}'s plan is a tree, and lays none` });
  // the plan from its corner
  const x0 = Math.min(...placed.map((r) => r.x)), y0 = Math.min(...placed.map((r) => r.y));
  const rooms = placed.map(({ s, over, ...r }) => ({ ...r, x: r.x - x0, y: r.y - y0, ...(s ? { storey: s } : {}) }));
  const entry = rooms[0];
  // the way in: the entry's front wall must face out (no room against it)
  if (rooms.some((r) => r !== entry && !r.storey && r.y + r.d === entry.y && r.x < entry.x + entry.w && entry.x < r.x + r.w)) findings.push({ id: 'no-way-in', room: entry.id, says: `the ${entry.id}'s front is built against: the way in has no outside wall` });
  const goal = rooms.find((r) => r.id === P.goal) ?? rooms.find((r) => r.id.startsWith(`${P.goal}-`)) ?? null;
  if (!goal) findings.push({ id: 'no-goal', says: `the ${P.goal} is not there; the level's goal falls to the deepest room` });
  // the goal room's doorway last: a kit's dressing seats its set piece in the walk's last room (crypt.js), so the
  // tomb, the altar or the strongbox stands where the level ends
  const ordered0 = goal ? [...links.filter((l) => l.to !== goal.id), ...links.filter((l) => l.to === goal.id)] : links;
  // (a ring's doorway set along its wall, `along`, in the plan's frame)
  const ordered = fight ? ordered0.map(({ alongX, ...l }) => (l.along === undefined ? l : { ...l, along: +(l.along - (alongX ? x0 : y0)).toFixed(6) })) : ordered0;
  return { use, reads: P.reads, rooms, links: ordered, entry: entry.id, goal: goal?.id ?? null, front: '-y', language: lang, findings, ...(fight ? { fight } : {}), ...(layouts ? { layouts } : {}), ...(vents ? { vents } : {}), ...(windows ? { windows } : {}) };
}

/**
 * A stage recipe's `program` lowered: the kit from the recipe or its cube's bones, the plan laid in it. The recipe's
 * own `rooms` and `links` win (a program then only names the use); its `level.goal` defaults to the program's goal.
 * The summary rides as `_program`, which the stage hands to its payload.
 */
export function withProgram(m) {
  const { program, ...rest } = m;
  const cube = m.geocube !== undefined ? readGeocube(m.geocube) : null, seeds = cube ? cubeBuildings(cube) : null;
  const kitId = resolveKitId(m.kit ?? (cube ? cube.inside.bones : PROGRAMS[program?.use]?.kit ?? 'gothic-stone'));
  // on a cube, the cube's builders speak (its seeds' anchor, else their style's language) unless the program names a
  // civilization
  const S = seeds?.anchor === undefined && seeds?.style !== undefined ? readStyle(seeds.style) : null;
  // (a composed interior is laid for the kit it composes: compose.js)
  const card = m.compose !== undefined && kitId.startsWith('bay-') ? bayKitOf(composeForBuild({ ...m, kit: kitId })) : null;
  const P = planProgram(program, kitId, { civilization: seeds?.anchor ?? (S ? S.language.id ?? S.language.doc : null), ...(card ? { kit: card } : {}) });
  if (seeds && program && !seeds.uses.some((u) => u.use === program.use)) P.findings.push({ id: 'off-cube', says: `the cube '${cube.id}' does not recommend a ${program.use} (it builds ${seeds.uses.map((u) => u.use).join(', ')}); built anyway` });
  const level = rest.level && typeof rest.level === 'object' && rest.level.goal == null && P.goal ? { ...rest.level, goal: P.goal } : rest.level;
  return {
    ...rest,
    rooms: rest.rooms ?? P.rooms,
    links: rest.links ?? P.links,
    ...(P.ways && rest.ways === undefined && rest.rooms === undefined ? { ways: P.ways } : {}),
    ...(P.lifts && rest.lifts === undefined && rest.rooms === undefined ? { lifts: P.lifts } : {}),
    ...(PROGRAMS[program.use]?.kit && m.kit === undefined && !cube ? { kit: kitId } : {}),
    // (a building climbs by a game's stair: construction/circulation.js `game`, a switchback with room at its ends)
    // (laid larger, program-core.js `scale`: the hall's stair, wider, with more floor at its ends)
    ...(PROGRAMS[program.use]?.shape === 'core' && rest.stair === undefined ? { stair: (program.scale ?? 1) > 1 ? 'hall' : 'game' } : {}),
    ...(level !== undefined ? { level } : {}),
    _program: { use: P.use, ...(PROGRAMS[P.use]?.base ? { base: true } : {}), ...(PROGRAMS[P.use]?.hospital ? { hospital: true } : {}), ...(PROGRAMS[P.use]?.home ? { home: true } : {}), reads: P.reads, entry: P.entry, goal: P.goal, front: P.front, language: P.language, rooms: P.rooms.map((r) => r.id),
      // (on storeys, the rooms each holds, the ground first)
      ...(P.rooms.some((r) => r.storey) ? { storeys: [...Array(Math.max(...P.rooms.map((r) => r.storey ?? 0)) + 1)].map((_, s) => P.rooms.filter((r) => (r.storey ?? 0) === s).map((r) => r.id)) } : {}), findings: P.findings,
      // (a basement's walls that face out, where a network's passages may leave it: program-core.js)
      ...(P.under ? { under: P.under } : {}),
      // (designed as a fighting map: the dials asked, which the stage reads for its cover)
      ...(P.fight ? { fight: P.fight } : {}),
      // (its rooms' layouts asked: room-layouts.js, laid by compose-dress.js layProps)
      ...(P.layouts ? { layouts: P.layouts } : {}),
      // (its crawl spaces asked: vents.js, laid by the stage)
      ...(P.vents ? { vents: P.vents } : {}),
      // (its glass onto the corridors asked: inner-windows.js)
      ...(P.windows ? { windows: P.windows } : {}) },
  };
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/**
 * The plan as a plate: each room a box with its name, a gap at each doorway, the way in marked on the entry's front,
 * the goal room ringed. On storeys, each storey its own plan beside the one below (the ground first), a stair's room
 * marked with the way up. Ink only (currentColor), sized to `px` wide.
 */
export function programPlanSvg(P, px = 300) {
  const storeys = [...new Set(P.rooms.map((r) => r.storey ?? 0))].sort((a, b) => a - b), n = storeys.length;
  const W = Math.max(...P.rooms.map((r) => r.x + r.w)), D = Math.max(...P.rooms.map((r) => r.y + r.d)), pad = 1.5;
  const k = px / (n * (W + 2 * pad)), H = (D + 2 * pad) * k, Y = (y) => ((D - y + pad) * k).toFixed(1);
  const o = [], by = new Map(P.rooms.map((r) => [r.id, r]));
  storeys.forEach((s, i) => {
    const X = (x) => ((x + pad + i * (W + 2 * pad)) * k).toFixed(1), on = (r) => (r.storey ?? 0) === s;
    if (n > 1) o.push(`<text x="${X(W / 2)}" y="${(H + 12).toFixed(1)}" font-size="10" text-anchor="middle" fill="currentColor">${s === 0 ? 'ground' : `storey ${s}`}</text>`);
    for (const r of P.rooms.filter(on)) {
      const goal = r.id === P.goal, up = P.links.some((l) => l.from === r.id && by.get(l.to) && (by.get(l.to).storey ?? 0) === s + 1);
      o.push(`<rect x="${X(r.x)}" y="${Y(r.y + r.d)}" width="${(r.w * k).toFixed(1)}" height="${(r.d * k).toFixed(1)}" fill="${goal ? 'currentColor' : 'none'}" fill-opacity="${goal ? 0.12 : 0}" stroke="currentColor" stroke-width="1.6"/>`);
      o.push(`<text x="${X(r.x + r.w / 2)}" y="${Y(r.y + r.d / 2)}" font-size="${Math.max(8, Math.min(12, r.w * k / 6)).toFixed(0)}" text-anchor="middle" dominant-baseline="middle" fill="currentColor">${esc(r.id)}${up ? ' \u2191' : ''}</text>`);
    }
    for (const l of P.links) {
      const a = by.get(l.from), b = by.get(l.to);
      if (!a || !b || !on(a) || !on(b)) continue;
      const vertical = a.x + a.w === b.x || b.x + b.w === a.x;
      const at = vertical ? (a.x + a.w === b.x ? b.x : a.x) : (a.y + a.d === b.y ? b.y : a.y);
      const lo = vertical ? Math.max(a.y, b.y) : Math.max(a.x, b.x), hi = vertical ? Math.min(a.y + a.d, b.y + b.d) : Math.min(a.x + a.w, b.x + b.w), m = (lo + hi) / 2;
      o.push(vertical ? `<line x1="${X(at)}" y1="${Y(m - 1)}" x2="${X(at)}" y2="${Y(m + 1)}" stroke="var(--sheet, #fff)" stroke-width="3"/>` : `<line x1="${X(m - 1)}" y1="${Y(at)}" x2="${X(m + 1)}" y2="${Y(at)}" stroke="var(--sheet, #fff)" stroke-width="3"/>`);
    }
    const e = by.get(P.entry);
    if (e && on(e)) o.push(`<path d="M${X(e.x + e.w / 2)} ${(Number(Y(e.y)) + 14).toFixed(1)} v-12" stroke="currentColor" stroke-width="1.6" marker-end="url(#pp-a)"/>`);
  });
  const Ht = H + (n > 1 ? 30 : 16);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${px} ${Ht.toFixed(0)}" width="${px}" height="${Ht.toFixed(0)}" role="img" aria-label="${esc(P.use)} plan"><defs><marker id="pp-a" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8z" fill="currentColor"/></marker></defs>${o.join('')}</svg>`;
}
