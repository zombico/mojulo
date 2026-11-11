/**
 * ROOM CRAFT — the reasons behind a worked interior, as questions. The craft laws (era/laws.js, `craft: true`) say what
 * a first pass may not be; a kit that only copies another kit's answer to one (a candle ring, a blind arch, a fluted
 * shaft) has placed a thing without the reason for it. Here each law is carried back to its reason and turned into the
 * question a room is asked, so that a lab, a depot and a chapel each give their own answer:
 *
 *   ROOM_CRAFT   one row a question, in the order a room is built (structure, wall, floor, air):
 *     id         its short name
 *     law        the craft law it is the reason for
 *     why        the reason: what the eye reads, and what a real room does that makes it so
 *     ask        the question, put to the place being built
 *     from       what the answer is derived from (the place's use, its structure, its age, its light)
 *     answers    how different places answer it, by setting: the same reason, a different thing. Examples, never a list
 *                to pick from: a new place answers from its own use
 *     not        the answer that is not one
 *   readRoomCraft(kit) → { rows: [{ id, law, ask, why, by }], open: [id] }
 *                which questions a room kit's card answers and by what on the card (`by` null: open). It reads what a
 *                card declares; whether the answer reads on the page is the eyes gate's
 *   roomCraftLedger(kits) → { [kitId]: { answered: [id], open: [id] } }   the room kits read together
 *   craftBrief(kit) → lines for an agent: what the kit answers, and each open question with its reason
 *
 * Data and a reader: nothing here draws, and no builder reads it.
 */
import { LAWS } from './laws.js';
import { generatedSpecOf } from '../landscape/surface-textures.js';

export const ROOM_CRAFT = Object.freeze([
  { id: 'fixture', law: 'no-voxel-first',
    why: 'A fixture is made by a trade (turned, cast, forged, bent, pressed) and its making shows in its outline. A box says nobody made it, and it reads as a placeholder in any light.',
    ask: 'What is each fixture made of, how was it made, and what holds it to the room?',
    from: 'the material and the trade of the place, and how the thing is fixed (an arm, a chain, a bracket, a housing)',
    answers: { crypt: 'a torch: a cone of wood in an iron ring on a forged arm', lab: 'a troffer: a pressed housing hung on chains, a diffuser under it', hangar: 'a high-bay lamp: a spun reflector on a rod', chapel: 'a sconce: a turned cup on a bracket' },
    not: 'the same cone copied into a place that has no fire' },
  { id: 'support', law: 'pillars-are-worked',
    why: 'A support shows how it carries: it spreads at the foot, gathers at the head, and its length is worked the way its material is worked. A flat strip carries nothing and gives light no edge to turn on.',
    ask: 'What carries the roof here, in what material, and how does that material meet the floor and the roof?',
    from: 'the structure and its material: cut stone (a base, a shaft, a capital), rolled steel (a base plate, flanges and a web, a bracket), cast concrete (a chamfer, a corbel), timber (a post, a brace)',
    answers: { crypt: 'a pilaster cut in parts, its shaft fluted', lab: 'a steel column at the bay line, a truss on it', hangar: 'a pilaster with a foot and a strip up it, a beam over it', chapel: 'an engaged round column on a base, a rib continuing it' },
    not: 'flutes on steel: the work of one material copied onto another' },
  { id: 'bays', law: 'wall-rhythm',
    why: 'The eye counts repeats: a wall of identical bays reads as one stamp, and a strict alternation as a pattern. A built wall differs along its length because its use differs, and the plainer bay is the same bay with less on it, so the wall stays one wall.',
    ask: 'What is this wall\'s full bay, what is it for, and what is the same bay with that use taken away?',
    from: 'what the wall holds bay by bay (burials, services, storage, glass), then the rhythm (era/wall-rhythm.js): two kinds, no run of three, no pair repeated, the odd one in the middle of three',
    answers: { crypt: 'a niche with its shelf and candles; the lesser bay the niche alone', lab: 'a panel bay with its service box and conduit; the lesser the panel alone', hangar: 'a bay with a tool board and a hose reel; the lesser the bare field', chapel: 'an arch with its memorial; the lesser the blind arch' },
    not: 'a second kind of bay unrelated to the first; a wall all alike is a stated choice, drawn clean' },
  { id: 'openings', law: 'openings-have-depth',
    why: 'A wall has thickness, and the eye reads it at every opening: the side of the cut, the shadow under its head, the thing standing inside it. A dark shape painted on the wall with a frame round it reads as a sign of a hole, and what is put in front of it floats.',
    ask: 'What is cut into this wall, how deep is the wall there, and what stands inside the cut?',
    from: 'the size of the cut against a hand: bigger, it is built (a back, a floor, a head, sides, as deep as what it holds); smaller, it is relief in the tile. What it holds stands on its floor, inside the wall\'s face',
    answers: { crypt: 'a niche a forearm deep, its urn on its floor', lab: 'a recessed cabinet and a window\'s reveal, the sill deep enough to lean on', hangar: 'a door\'s reveal and a hose reel set in a box in the wall', chapel: 'a piscina and an aumbry cut in beside the altar' },
    not: 'a dark panel on the wall; a shader that fakes a room behind it, which no export carries' },
  { id: 'storeys', law: 'wall-has-storeys',
    why: 'A person reads height by lines: where the hand reaches, where a door ends, and what is over that. A tall wall in one treatment loses its scale, and the wall above reach is used and worn differently from the wall within it.',
    ask: 'Where does reach end on this wall, what line marks it, and what does the wall do above that line, derived from what it does below?',
    from: 'the room\'s height against a person, and the lower wall: the upper register is the lower with less (the same opening, blind; the same panel, plain; the same bay, glazed)',
    answers: { crypt: 'a string course, a blind arch a bay over each niche', lab: 'a kick band, the panel field, a clerestory of windows over it', hangar: 'a dark base, the field, a corrugated crown', chapel: 'an arcade, a string course, a lancet over each arch' },
    not: 'the lower wall stretched; a line with nothing changing across it' },
  { id: 'coat', law: 'layers-stand-proud',
    why: 'A wall has a history: something covers the structure, and the cover fails where something acts on it. The eye reads the age and the damp of a room from where the cover is whole and where it is gone.',
    ask: 'What covers the structure here, what has taken it off, and where does that act (low, high, at the hand, under a leak)?',
    from: 'the cover the place would have (render, paint, panel, tile, plate) and the cause at work (rising damp, hands and trolleys, heat, water from above): the cover is lost where the cause is',
    answers: { crypt: 'lime render, ragged low where damp rises and nearly whole above the string course', lab: 'paint and panel, scuffed and chipped at trolley height', hangar: 'paint worn to the plate along the base, a hazard band repainted over it', chapel: 'limewash, sooted over the candles' },
    not: 'patches placed by dice with no cause; a cover drawn in the same plane as what it covers' },
  { id: 'floor', law: 'floor-is-laid',
    why: 'A floor is laid from the walls in and then used: it has an edge, a way people take, a place the room is for, and it records where feet, fire, water and repair have been. One field of tile says none of that.',
    ask: 'Where is this floor\'s edge, where do people walk, what is the room\'s centre of use, and what has happened to each part?',
    from: 'the plan: the walls (a border), the doors and what they lead to (thresholds, a walk), the set piece (an apron), the structure\'s lines (fields by the bay, in a rhythm); then each part\'s shade by its cause (era/floor-shades.js)',
    answers: { crypt: 'a border course, a worn walk, a threshold inside each door, a sooted apron round the tomb', lab: 'a band along the walls, a trench of grating, a marked zone round the tank', hangar: 'a hazard band at the walls, a pad where the craft stands, lanes between', chapel: 'an aisle of larger slabs to the altar, ledger stones in it' },
    not: 'a shade without a cause; a walk that leads nowhere' },
  { id: 'air', law: 'air-is-furnished',
    why: 'A room is tall for a reason, and what the height is for hangs in it or crosses it. Empty air over a furnished floor reads as a low room scaled up.',
    ask: 'What is this room\'s height for, and what hangs in it, crosses it or climbs it because of that?',
    from: 'the use of the height (to carry smoke off, to lift a load, to run services, to be looked up into), and how the thing gets there and is reached (a chain to lower it, a rail, a hanger, a catwalk)',
    answers: { crypt: 'a ring of candles on chains, low enough to be lit by hand', lab: 'ducts, a cable tray and troffers under the trusses', hangar: 'a crane on its rails, a catwalk, pipes', chapel: 'banners from the string course, a rood beam' },
    not: 'a chandelier because the last tall room had one' },
  { id: 'light-above', law: 'air-is-furnished',
    why: 'Light has a source. The upper room may be lost in the dark, which is a place of its own, but where it is seen something gives the light: a fire raised, a sky let in, a lamp hung. Height lit by nothing is false, and a second colour of light from a second cause gives the room its depth.',
    ask: 'What gives light above head height here, of what colour, and what does it fall on?',
    from: 'the place\'s sources (flame, sky, lamp) and its focus: the light let in from outside is aimed at what the room is for',
    answers: { crypt: 'a slit of cold sky high in the end wall, its pool on the tomb; the candle ring lights the upper wall from below', lab: 'a clerestory\'s daylight and the troffers\' cold white', hangar: 'high-bay lamps and a ribbon of glass', chapel: 'lancets, their colour on the floor' },
    not: 'a brighter ceiling with no cause' },
]);

const specOf = (t) => (t && t.family ? generatedSpecOf(`${t.family}-a`) : null);
const said = (...parts) => parts.filter(Boolean).join(', ') || null;

// What on a kit's card answers each question, in the card's own words; null where nothing does. A probe names fields a
// shell builds from (era/stage.js, nave.js, lab.js, bay.js), never a kit by its name.
const PROBES = {
  fixture: (k) => said(k.torch?.form === 'cone' && 'a turned torch on an arm', k.torch?.form === 'lamp' && 'a clay lamp on a corbel of the rock', k.lab?.troffer && 'troffers hung on chains', k.B?.light?.highbay && 'high-bay lamps on rods'),
  support: (k) => { const P = specOf(k.tiles?.pillar);
    return said(k.pilaster?.bands && 'a pilaster cut in parts', P && ['fluted', 'shaft'].includes(P.cfg.cut) && `its shaft ${P.cfg.cut === 'fluted' ? 'fluted' : 'one stone'}`, k.column && 'engaged round columns on bases',
      k.lab?.column && k.lab?.truss && 'steel columns under trusses', k.B?.pilaster?.foot && 'pilasters with a foot and a strip'); },
  bays: (k) => said(k.dress?.niches?.rhythm && 'niches in a rhythm, the lesser bay the full one with less', k.B?.services?.rhythm && k.B.services.every < 1e8 && 'service boxes in a rhythm, the lesser bay the bare field'),
  openings: (k) => said(k.dress?.niches?.depth && 'niches cut in, a back, a floor and sides', k.lancet?.depth && k.arcade?.depth && 'an arcade and lancets with reveals', k.lab?.window?.depth && 'windows with reveals', k.B?.glass && k.B?.door?.sill && 'glass and doors in reveals'),
  storeys: (k) => said(k.storeys?.arch && 'a string course, blind arches over it', k.storeys?.loculi && 'a ledge at the old floor, sealed slots over it', k.string && k.arcade && k.lancet && 'an arcade, a string course, lancets over it',
    k.lab?.kick && k.lab?.window && 'a kick band, a panel field, a clerestory', k.B?.base && k.B?.crown && 'a base, a field, a crown'),
  coat: (k) => { const W = specOf(k.tiles?.wall), U = specOf(k.tiles?.wallUpper);
    return said(W && W.cfg.cut === 'render' && `a coat of render, ${U && U.cfg.cut === 'render' ? 'lost low and kept above' : k.tiles?.wallUpper ? 'within reach only, bare above' : 'fallen away in patches'}`, k.B?.base && k.B?.floor?.hazard && 'a painted base and hazard band'); },
  floor: (k) => said(k.floorPlan && `a plan: ${Object.keys(k.floorPlan).join(', ')}`, k.dress?.floor && 'zoned by its style card', k.lab?.band && k.dress?.trench && 'a band at the walls, a trench', k.B?.floor?.band && 'a band at the walls, a pad'),
  air: (k) => said(k.dress?.above?.ring && 'a candle ring on chains', k.dress?.above?.span && 'shoring logs across, a lamp hung from each', k.dress?.banners && 'banners', k.lab?.duct && 'ducts, a cable tray, trusses', k.B?.crane && 'a crane, a catwalk, pipes'),
  'light-above': (k) => said(k.dress?.above?.opening && 'an opening to the sky, its pool on the set piece', k.dress?.above?.ring && 'the candle ring', k.dress?.above?.span && 'the hung lamps', k.lancet?.light && 'lancets', k.lab?.window?.light && 'a clerestory', k.lab?.troffer && 'troffers',
    k.B?.light?.highbay && 'high-bay lamps', k.B?.glass && 'glass'),
};

/** Which of the questions a room kit's card answers, and by what. */
export function readRoomCraft(kit) {
  const rows = ROOM_CRAFT.map((Q) => ({ id: Q.id, law: Q.law, ask: Q.ask, why: Q.why, by: PROBES[Q.id](kit) }));
  return { rows, open: rows.filter((r) => !r.by).map((r) => r.id) };
}

/** The room kits read together: `kits` a table of cards by id (era/stage.js STAGE_KITS, its room shells). */
export function roomCraftLedger(kits) {
  return Object.fromEntries(Object.entries(kits).map(([id, kit]) => { const R = readRoomCraft(kit);
    return [id, { answered: R.rows.filter((r) => r.by).map((r) => r.id), open: R.open }]; }));
}

/** A kit's craft for an agent: what it answers, then each open question with its reason, for the agent to answer. */
export function craftBrief(kit) {
  const R = readRoomCraft(kit), lines = [];
  for (const r of R.rows) if (r.by) lines.push(`  - ${r.id}: ${r.by}`);
  for (const r of R.rows) if (!r.by) { const Q = ROOM_CRAFT.find((q) => q.id === r.id); lines.push(`  - ${r.id}: OPEN. ${Q.ask} (${LAWS[Q.law].law.split(':')[0]})`); }
  return lines;
}
