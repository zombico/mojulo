/**
 * A DUNGEON FROM A PROGRAM — a building's plan by use (era/programs.js PROGRAMS: a crypt, a keep, a temple, a tavern …)
 * read as a table RPG dungeon (table-rpg-kernel.js): its rooms by role and the room each opens off, a loop added so it
 * is not a line, the goal's way locked and its key placed in the deepest room off the way to it and not behind it.
 * The program's use rides on the dungeon (`program`) and each room keeps its size word, so the later lowering to a
 * walkable level lays the same rooms (planProgram) and only the loop needs a layout of its own. A building's program
 * (a corridor and its core: an office, a lab building, a warehouse) is read off the plan it lays, walked from its way in.
 *
 *   dungeonFromProgram({ use, seed?, name?, foes?: { minion?, boss? } }) → { dungeon, items }
 *     foes: foe ids: the boss stands in the goal room, a minion in about half the others
 *     items: the key the lock wants, to merge into the module's items
 *
 * Pure: seeded dice only (city/plan/dice.js's stream convention).
 */
import { PROGRAMS, PROGRAM_IDS, planProgram } from '../era/programs.js';
import { mulberry32, strHash } from '../city/plan/dice.js';

const words = (s) => String(s).replace(/[-_]/g, ' ');
const sizeOf = (w, dd) => { if (!w || !dd) return 'medium'; const a = ((w[0] + w[1]) / 2) * ((dd[0] + dd[1]) / 2); return a < 20 ? 'small' : a < 60 ? 'medium' : 'large'; };

export function dungeonFromProgram({ use, seed = 1, name, foes = {} } = {}) {
  const P = PROGRAMS[use];
  if (!P) throw new Error(`table rpg: no program '${use}' (${PROGRAM_IDS.join(', ')})`);
  const rnd = mulberry32(strHash(`${seed}|dungeon-v1|${use}`));
  // the rooms: each of the program's, its count, its chance; a room opens off the first of its parent's role
  const rooms = [], links = [], firstOf = {}, depth = {};
  let laidGoal = null;
  if (P.shape === 'core') {
    // a building (era/program-core.js): the rooms its program lays, walked from its way in, the stair between storeys;
    // its rooms are its plan's, so the lowering lays the same ones
    const L = planProgram({ use, seed }, P.kit), byId = new Map(L.rooms.map((r) => [r.id, r])), next = new Map(L.rooms.map((r) => [r.id, []]));
    for (const l of L.links) { next.get(l.from).push(l.to); next.get(l.to).push(l.from); }
    const add = (id, parent) => {
      const r = byId.get(id), role = id.replace(/-\d+[a-z]?$/, '');
      rooms.push({ id, name: `the ${words(id)}`, size: sizeOf([r.w, r.w], [r.d, r.d]), role });
      firstOf[role] ??= id;
      depth[id] = parent ? depth[parent] + 1 : 0;
    };
    const seen = new Set([L.entry]), q = [L.entry];
    add(L.entry, null);
    while (q.length) {
      const a = q.shift();
      for (const b of next.get(a)) if (!seen.has(b)) {
        seen.add(b); q.push(b); add(b, a);
        links.push({ a, b, kind: a.startsWith('core-') && b.startsWith('core-') ? 'stair' : rnd() < 0.5 ? 'door' : 'open' });
      }
    }
    laidGoal = L.goal;
  } else for (const R of P.rooms) {
    if (R.p !== undefined && rnd() >= R.p) continue;
    const n = R.n ?? 1;
    for (let k = 1; k <= n; k++) {
      let id = n > 1 ? `${R.role}-${k}` : R.role;
      while (rooms.some((r) => r.id === id)) id += '-b';
      const parent = R.of ? firstOf[R.of] : null;
      if (R.of && !parent) break;   // its parent did not come up
      rooms.push({ id, name: `the ${words(R.role)}${n > 1 ? ` ${k}` : ''}`, size: sizeOf(R.w, R.d), role: R.role });
      firstOf[R.role] ??= id;
      depth[id] = parent ? depth[parent] + 1 : 0;
      if (parent) links.push({ a: parent, b: id, kind: R.over || /stair/.test(R.role) ? 'stair' : rnd() < 0.5 ? 'door' : 'open' });
    }
  }
  const entry = rooms[0].id, goal = laidGoal ?? firstOf[P.goal] ?? rooms[rooms.length - 1].id;
  // the rooms behind the goal (opening off it, at any depth): behind its lock too
  const behind = new Set([goal]);
  for (let grew = true; grew;) { grew = false; for (const l of links) if (behind.has(l.a) && !behind.has(l.b)) { behind.add(l.b); grew = true; } }
  // the loop: two rooms off the entry, neither behind the goal nor joined already, by a hidden way or an open one
  const joined = (a, b) => links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
  const can = rooms.filter((r) => !behind.has(r.id) && r.id !== entry);
  const pairs = [];
  for (let i = 0; i < can.length; i++) for (let j = i + 1; j < can.length; j++) if (!joined(can[i].id, can[j].id)) pairs.push([can[i].id, can[j].id]);
  const tree = [...links];
  if (pairs.length) { const [a, b] = pairs[Math.floor(rnd() * pairs.length)]; links.push({ a, b, kind: rnd() < 0.5 ? 'secret' : 'open' }); }
  // the lock on the goal's way, its key in the deepest room off the goal's own branch
  const key = `${use}-key`, items = { [key]: { name: `the ${words(use)} key`, kind: 'key' } };
  const into = links.find((l) => l.b === goal);
  if (into && goal !== entry) {
    into.kind = 'locked'; into.key = key; into.force = 'hard';
    // not on the way to the goal, and not behind it (the rooms opening off the goal are behind its lock too)
    const goalLine = new Set();
    for (let at = goal; at;) { goalLine.add(at); at = tree.find((l) => l.b === at)?.a; }
    const off = rooms.filter((r) => !goalLine.has(r.id) && !behind.has(r.id)).sort((x, y) => depth[y.id] - depth[x.id] || rooms.indexOf(x) - rooms.indexOf(y));
    const home = off[0] ?? rooms.find((r) => !behind.has(r.id));
    home.items = [key];
  }
  if (foes.boss) rooms.find((r) => r.id === goal).foes = [foes.boss];
  if (foes.minion) for (const r of rooms) if (r.id !== goal && r.id !== entry && rnd() < 0.5) r.foes = [foes.minion];
  const goalRoom = rooms.find((r) => r.id === goal);
  goalRoom.goal = true;
  return { dungeon: { name: name ?? `the ${words(use)}`, entry, goal, program: use, rooms: rooms.map(({ role, ...r }) => r), links }, items };
}
