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
import { STAGE_KITS, resolveKitId } from './stage.js';
import { STRUCTURE_USES } from './out-structures.js';
import { ANCHOR_IDS, ANCHOR_STRUCTURES, decompileAnchor } from './out-anchor-structure.js';
import { readGeocube, cubeBuildings } from './geocube.js';

// a room: [role, w range, d range, the role it opens off, { h: storeys tall, n: how many, p: the chance it is there }]
// sizes are game sizes (metres), a little over life so a camera and a walker fit; a goal room is 6 m across or more,
// since a kit's dressing seats its set piece (a tomb, an altar) there
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
  tower: { reads: 'height seen from the trail: its base, the guard room and the stair foot (one storey until storeys come)', shape: 'hub', goal: 'guard',
    rooms: [R('base', [5, 6], [5, 6]), R('stair', [4, 4], [4, 5], 'base'), R('guard', [6, 7], [6, 7], 'base')] },
  // the game's
  tavern: { reads: 'a taproom on the street, the kitchen behind the bar, a snug off it, the cellar under it all', shape: 'hub', goal: 'cellar',
    rooms: [R('taproom', [8, 11], [6, 9]), R('kitchen', [4, 6], [4, 5], 'taproom'), R('snug', [4, 5], [4, 5], 'taproom', { p: 0.7 }), R('cellar', [6, 7], [6, 7], 'kitchen', { h: 0.85 }), R('store', [3, 4], [4, 4], 'cellar', { p: 0.5 })] },
  keep: { reads: 'a gatehouse, the great hall, the lord\'s solar off it, the treasury behind', shape: 'chain', tall: 'hall', goal: 'treasury',
    rooms: [R('gatehouse', [5, 6], [4, 5]), R('hall', [10, 14], [8, 10], 'gatehouse', { h: 'tall' }), R('solar', [5, 7], [5, 6], 'hall'), R('chapel', [4, 6], [5, 7], 'hall', { p: 0.6 }), R('armoury', [4, 5], [4, 5], 'gatehouse', { p: 0.6 }), R('treasury', [6, 7], [6, 7], 'solar')] },
  temple: { reads: 'a porch, the long tall nave, the sanctuary at its head', shape: 'chain', tall: 'hall', goal: 'sanctuary',
    rooms: [R('narthex', [6, 8], [4, 4]), R('nave', [7, 9], [12, 16], 'narthex', { h: 'tall' }), R('sanctuary', [6, 8], [5, 6], 'nave'), R('vestry', [3, 4], [4, 4], 'sanctuary', { p: 0.6 })] },
  crypt: { reads: 'a stair down, a long gallery, chambers off it, the tomb at the end', shape: 'chain', goal: 'tomb',
    rooms: [R('stair', [5, 6], [5, 6]), R('gallery', [4, 4], [10, 14], 'stair'), R('chamber', [6, 8], [6, 7], 'gallery', { n: 2 }), R('tomb', [8, 10], [8, 10], 'chamber', { h: 1.2 })] },
  guardhouse: { reads: 'the guard room on the gate, bunks and the cells off it, the armoury behind', shape: 'hub', goal: 'armoury',
    rooms: [R('guardroom', [6, 8], [5, 6]), R('bunks', [4, 6], [4, 5], 'guardroom'), R('cell', [3, 3], [4, 4], 'guardroom', { n: 2 }), R('armoury', [6, 7], [6, 7], 'bunks')] },
  library: { reads: 'a reading room, the stacks behind it, the archive at the back', shape: 'chain', goal: 'archive',
    rooms: [R('reading', [7, 9], [6, 8], null, { h: 1.3 }), R('stacks', [4, 5], [8, 10], 'reading', { n: 2 }), R('archive', [6, 7], [6, 7], 'stacks')] },
  lab: { reads: 'a lobby, the lab floor, a store, and the sealed core', shape: 'chain', goal: 'core',
    rooms: [R('lobby', [5, 7], [4, 5]), R('lab', [8, 10], [7, 9], 'lobby', { h: 1.2 }), R('store', [4, 5], [4, 4], 'lab', { p: 0.6 }), R('core', [6, 7], [6, 7], 'lab')] },
});
export const PROGRAM_IDS = Object.freeze(Object.keys(PROGRAMS));

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
export function planProgram(program, kitId = 'gothic-stone', { civilization = null } = {}) {
  if (!program || typeof program !== 'object') throw new Error(`program: give { use } (${PROGRAM_IDS.join(', ')})`);
  const use = program.use, P = PROGRAMS[use];
  if (!P) throw new Error(`program: use '${use}' is not one (${PROGRAM_IDS.join(', ')})`);
  for (const k of Object.keys(program)) if (!['use', 'seed', 'rooms', 'add', 'civilization'].includes(k)) throw new Error(`program: '${k}' is not a setting (use, seed, rooms, add, civilization)`);
  const kit = STAGE_KITS[kitId];
  if (!kit || !kit.grid) throw new Error(`program: kit '${kitId}' is open ground; a program is laid in a room kit (${Object.keys(STAGE_KITS).filter((k) => STAGE_KITS[k].grid).join(', ')})`);
  const lang = languageOf(program.civilization ?? civilization, kitId);
  const rnd = mulberry32((program.seed ?? 1) * 2654435761 + use.length * 97);
  const g = kit.grid, need = kit.door.width + 2 * kit.door.frame + kit.wall;   // the wall a doorway needs (stage.js planStage)
  const pick = (r) => Math.round((r[0] + rnd() * (r[1] - r[0])) / g) * g;
  // the heights: the language's storey, lifted for a game, a tall use promoted as the town's uses are
  const dwellingH = mid(STRUCTURE_USES.dwelling.storeyH);
  const tallH = P.tall ? mid(STRUCTURE_USES[P.tall].storeyH) / dwellingH : 1;
  const heightOf = (o) => Math.max(2.5, half(lang.storeyH * GAME * (o.h === 'tall' ? tallH : o.h ?? 1)));
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
  for (const t of want) {
    const o = over[t.id] ?? over[t.role] ?? {};
    if (o.drop) { findings.push({ id: 'dropped', room: t.id, says: `the recipe dropped the ${t.id}` }); continue; }
    // a room opens off its role's first room, or the room the recipe's `of` names
    const parentId = o.of ?? (t.of == null ? null : byId.has(t.of) ? t.of : rolesOf.get(t.of));
    if (t.of != null && !byId.has(parentId)) { findings.push({ id: 'orphan', room: t.id, says: `the ${t.id} opens off the ${t.of}, which is not there` }); continue; }
    const w0 = o.w ?? pick(t.w), d0 = o.d ?? pick(t.d), h = o.h ?? heightOf(t);
    let room = null;
    if (!parentId) room = { id: t.id, x: 0, y: 0, w: w0, d: d0, h };
    else {
      const par = byId.get(parentId), order = SIDES.map((s) => [s, rnd()]).sort((p, q) => p[1] - q[1]).map(([s]) => s);
      // the entry keeps its front clear for the way in (and below, nothing else stands against it)
      const sides = par.id === placed[0].id ? order.filter((s) => s !== '-y') : order;
      for (const [w, d] of [[w0, d0], [d0, w0]]) {
        for (const s of sides) {
          const along = s.endsWith('x') ? 'y' : 'x', span = along === 'x' ? w : d, pSpan = along === 'x' ? par.w : par.d;
          const x = s === '+x' ? par.x + par.w : s === '-x' ? par.x - w : null, y = s === '+y' ? par.y + par.d : s === '-y' ? par.y - d : null;
          // centred on the parent first, then slid toward each end on the grid
          const c = (along === 'x' ? par.x : par.y) + Math.round((pSpan - span) / 2 / g) * g;
          const slides = [0]; for (let k = g; k <= Math.max(span, pSpan); k += g) slides.push(k, -k);
          for (const k of slides) {
            const box = { id: t.id, x: x ?? c + k, y: y ?? c + k, w, d, h };
            if (shared(box, par) < need) continue;
            if (placed.some((q) => overlaps(box, q))) continue;
            // nothing is built against the way in's front
            const E = placed[0];
            if (box.y + box.d === E.y && box.x < E.x + E.w && E.x < box.x + box.w) continue;
            room = box; break;
          }
          if (room) break;
        }
        if (room) break;
      }
      if (!room) { findings.push({ id: 'unseated', room: t.id, says: `no free wall of the ${parentId} took the ${t.id}: give it a size (rooms.${t.id}: { w, d }) or let it go` }); continue; }
      links.push({ from: parentId, to: t.id });
    }
    placed.push(room); byId.set(room.id, room);
    if (!rolesOf.has(t.role)) rolesOf.set(t.role, room.id);
    const want0 = P.rooms.find((q) => q.role === t.role);
    if (want0 && !o.w && !o.d && (room.w * room.d < want0.w[0] * want0.d[0] - 1e-9)) findings.push({ id: 'small', room: room.id, says: `the ${room.id} is under its role's size` });
  }
  if (!placed.length) throw new Error(`program: no room of the ${use} could be seated`);
  // the plan from its corner
  const x0 = Math.min(...placed.map((r) => r.x)), y0 = Math.min(...placed.map((r) => r.y));
  const rooms = placed.map((r) => ({ ...r, x: r.x - x0, y: r.y - y0 }));
  const entry = rooms[0];
  // the way in: the entry's front wall must face out (no room against it)
  if (rooms.some((r) => r !== entry && r.y + r.d === entry.y && r.x < entry.x + entry.w && entry.x < r.x + r.w)) findings.push({ id: 'no-way-in', room: entry.id, says: `the ${entry.id}'s front is built against: the way in has no outside wall` });
  const goal = rooms.find((r) => r.id === P.goal) ?? rooms.find((r) => r.id.startsWith(`${P.goal}-`)) ?? null;
  if (!goal) findings.push({ id: 'no-goal', says: `the ${P.goal} is not there; the level's goal falls to the deepest room` });
  // the goal room's doorway last: a kit's dressing seats its set piece in the walk's last room (crypt.js), so the
  // tomb, the altar or the strongbox stands where the level ends
  const ordered = goal ? [...links.filter((l) => l.to !== goal.id), ...links.filter((l) => l.to === goal.id)] : links;
  return { use, reads: P.reads, rooms, links: ordered, entry: entry.id, goal: goal?.id ?? null, front: '-y', language: lang, findings };
}

/**
 * A stage recipe's `program` lowered: the kit from the recipe or its cube's bones, the plan laid in it. The recipe's
 * own `rooms` and `links` win (a program then only names the use); its `level.goal` defaults to the program's goal.
 * The summary rides as `_program`, which the stage hands to its payload.
 */
export function withProgram(m) {
  const { program, ...rest } = m;
  const cube = m.geocube !== undefined ? readGeocube(m.geocube) : null, seeds = cube ? cubeBuildings(cube) : null;
  const kitId = resolveKitId(m.kit ?? (cube ? cube.inside.bones : 'gothic-stone'));
  // on a cube, the cube's builders speak (its seeds' anchor) unless the program names a civilization
  const P = planProgram(program, kitId, { civilization: seeds?.anchor ?? null });
  if (seeds && program && !seeds.uses.some((u) => u.use === program.use)) P.findings.push({ id: 'off-cube', says: `the cube '${cube.id}' does not recommend a ${program.use} (it builds ${seeds.uses.map((u) => u.use).join(', ')}); built anyway` });
  const level = rest.level && typeof rest.level === 'object' && rest.level.goal == null && P.goal ? { ...rest.level, goal: P.goal } : rest.level;
  return {
    ...rest,
    rooms: rest.rooms ?? P.rooms,
    links: rest.links ?? P.links,
    ...(level !== undefined ? { level } : {}),
    _program: { use: P.use, reads: P.reads, entry: P.entry, goal: P.goal, front: P.front, language: P.language, rooms: P.rooms.map((r) => r.id), findings: P.findings },
  };
}
