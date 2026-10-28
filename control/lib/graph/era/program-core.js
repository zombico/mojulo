/**
 * A BUILDING'S PLAN, CORRIDOR AND CORE (era/programs.js `shape: 'core'`): the packer a building's use takes where a
 * house's takes the parent-seated tree. A CORE (its stair, the storeys' one way up) and WINGS off it, each a CORRIDOR
 * with rooms a bay wide along one side (single-loaded: the corridor's other side the outside wall) or both
 * (double-loaded); the wings laid as an I, an L, a T or a U; a LOBBY in front of the core holding the way in; and an
 * ANNEX (a use's tall room: a warehouse's shed, a lab's instrument bay) at the first wing's far end, on the ground
 * storey, nothing over it. Every storey above the ground is the same plate (a typical floor), so each room upstairs
 * stands over its twin below by construction (era/storeys.js).
 *
 *   CORE   the core's size, the corridor's width, a room's depth: a core 10 × 12 (its stair finds a wall clear of the
 *          doorways: the wings meet it along its front band and its back corner), a corridor wide enough for the kit's
 *          doorway at its end, a room 6 m deep and a bay (the kit's, 6 m) wide
 *   planCore(P, program, kit, rnd) → { rooms, links, ways, entry, goal, findings }   rooms with `storey`; ids by
 *          storey and number (`office-203`: storey 2, the third room), corridors `corridor-2a`, cores `core-2`, the goal
 *          its role alone (`boardroom`)
 *
 * Layout in plan: the core at the origin, x to its right, y to its back; the lobby on its front (−y), the way in on the
 * lobby's front. Pure: the dice are the program's.
 */
export const CORE = Object.freeze({ w: 10, d: 12, room: 6, bays: [1, 6], storeys: [1, 6], wings: ['I', 'L', 'T', 'U'], loading: ['single', 'double'], deep: 4 });

// the wings each shape lays: a direction off the core, or an arm turning +y off another wing's far end
const SHAPES = { I: ['+x', '-x'], L: ['+x', '+y'], T: ['+x', '-x', '+y'], U: ['+x', '-x', 'arm:+x', 'arm:-x'] };
const overlaps = (a, b) => a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 && a.y < b.y + b.d - 1e-9 && b.y < a.y + a.d - 1e-9;

export function planCore(P, program, kit, rnd) {
  const C = P.core, g = kit.grid, need = kit.door.width + 2 * kit.door.frame + kit.wall;
  // (every size on the kit's grid: a gothic kit's is not a metre)
  const snap = (v) => +(Math.max(1, Math.round(v / g)) * g).toFixed(6), up = (v) => +(Math.ceil(v / g - 1e-9) * g).toFixed(6);
  const cw = up(Math.max(3, need + 0.4)), D = snap(CORE.room), bay = snap(kit.bay ?? CORE.room), CW = snap(CORE.w), CD = snap(CORE.d), LD = snap(P.lobby.d);
  const storeys = program.storeys ?? C.storeys, wings = program.wings ?? C.wings, loading = program.loading ?? C.loading, bays = program.bays ?? C.bays;
  if (!(Number.isInteger(storeys) && storeys >= CORE.storeys[0] && storeys <= CORE.storeys[1])) throw new Error(`program: storeys is a whole number, ${CORE.storeys.join(' to ')}`);
  if (!SHAPES[wings]) throw new Error(`program: wings is ${CORE.wings.join(', ')} (the plan's shape round its core)`);
  if (!CORE.loading.includes(loading)) throw new Error(`program: loading is single (rooms on one side of the corridor) or double (both)`);
  if (!(Number.isInteger(bays) && bays >= CORE.bays[0] && bays <= CORE.bays[1])) throw new Error(`program: bays is a wing's length in bays, ${CORE.bays.join(' to ')}`);
  const h = C.h, rooms = [], links = [], findings = [];
  const free = (b) => !rooms.some((q) => (q.storey ?? 0) === (b.storey ?? 0) && overlaps(b, q));
  const put = (b) => { rooms.push(b); return b; };
  // the corridors of one storey: their boxes and where their rooms go (a side: the box a bay's room fills)
  const plate = [];
  const wingOf = (dir, letter) => {
    const L = +(bays * bay).toFixed(6);
    if (dir === '+x') return { letter, box: { x: CW, y: 0, w: L, d: cw }, along: 'x', sides: [{ y: cw, d: D }, { y: -D, d: D }], end: { x: CW + L, y: 0, side: '+x' } };
    if (dir === '-x') return { letter, box: { x: -L, y: 0, w: L, d: cw }, along: 'x', sides: [{ y: cw, d: D }, { y: -D, d: D }], end: { x: -L, y: 0, side: '-x' } };
    if (dir === '+y') return { letter, box: { x: 0, y: CD, w: cw, d: L }, along: 'y', sides: [{ x: cw, w: D }, { x: -D, w: D }], end: { x: 0, y: CD + L, side: '+y' } };
    // an arm: up +y off a wing's far end, its corridor against that wing's corridor's back
    const base = plate.find((p) => p.dir === dir.slice(4));
    const x = +(base.dir === '+x' ? base.box.x + base.box.w - cw : base.box.x).toFixed(6);
    return { letter, box: { x, y: cw, w: cw, d: L }, along: 'y', sides: [{ x: x + cw, w: D }, { x: x - D, w: D }], joins: base, end: { x, y: cw + L, side: '+y' } };
  };
  SHAPES[wings].forEach((dir, i) => plate.push({ dir, ...wingOf(dir, 'abcd'[i]) }));
  // the roles along each storey's wings: the near rooms the service ones, the far ones the use's own, the top storey's
  // farthest room the goal
  const R = P.roles;
  let goal = null;
  const flip = rnd() < 0.5;
  for (let s = 0; s < storeys; s++) {
    const n = s + 1, at = (b) => ({ ...b, h, ...(s ? { storey: s } : {}) });
    // (the lobby first: the plan's first room is its way in)
    if (!s) put({ id: 'lobby', x: 0, y: -LD, w: CW, d: LD, h: P.lobby.h ?? h });
    const core = put(at({ id: `core-${n}`, x: 0, y: 0, w: CW, d: CD }));
    links.push({ from: s ? `core-${s}` : 'lobby', to: core.id });
    // the corridors first (an arm claims its corner before the wing's rooms fill it), then each wing's rooms
    const cors = [];
    for (const W of plate) {
      const cor = at({ id: `corridor-${n}${W.letter}`, ...W.box });
      if (!free(cor)) { findings.push({ id: 'unseated', room: cor.id, says: `the ${W.dir} wing's corridor meets another; dropped` }); continue; }
      put(cor); cors.push([W, cor]);
      links.push({ from: W.joins ? `corridor-${n}${W.joins.letter}` : core.id, to: cor.id });
    }
    let k = 0, far = null;
    for (const [W, cor] of cors) {
      const sides = loading === 'double' ? W.sides : W.sides.slice(0, 1);
      for (let b = 0; b < bays; b++) for (const [si, S] of sides.entries()) {
        // (bays counted out from the core: a −x wing's first bay is its last in x)
        const bx = +(W.dir === '-x' ? W.box.x + (bays - 1 - b) * bay : W.box.x + b * bay).toFixed(6);
        const box = W.along === 'x' ? { x: bx, y: S.y, w: bay, d: S.d } : { x: S.x, y: +(W.box.y + b * bay).toFixed(6), w: S.w, d: bay };
        const near = flip ? si === 1 : si === 0, role = b === bays - 1 && si === 0 ? R.far : b === 0 && near ? R.near : b === 0 ? R.second : R.room;
        const r = at({ id: `${role}-${n}${String(++k).padStart(2, '0')}`, ...box });
        if (!free(r)) continue;
        put(r); links.push({ from: cor.id, to: r.id });
        if (role === R.far) far = r;
      }
    }
    // the top storey's farthest room (its last wing's last bay) is the goal
    if (s === storeys - 1 && far) {
      const old = far.id;
      goal = far.id = R.goal;
      for (const l of links) if (l.to === old) l.to = goal;
    }
  }
  if (!goal) findings.push({ id: 'no-goal', says: `no wing reached a ${R.far} on the top storey: the level's goal falls to the deepest room` });
  // the annex: the use's tall room at the first wing's far end, on the ground, nothing over it; its own ways out
  const ways = [{ room: 'lobby', side: '-y' }];
  if (P.annex) {
    const A = { ...P.annex, w: snap(P.annex.w), d: snap(P.annex.d) }, W = plate[0], e = W.end, y = W.along === 'x' ? e.y + cw / 2 - A.d / 2 : e.y;
    const box = { id: A.role, x: +(e.side === '+x' ? e.x : e.side === '-x' ? e.x - A.w : Math.round((e.x + cw / 2 - A.w / 2) / g) * g).toFixed(6), y: +(Math.round(y / g) * g).toFixed(6), w: A.w, d: A.d, h: A.h };
    if (free(box)) {
      put(box); links.push({ from: `corridor-1${W.letter}`, to: box.id });
      for (const side of A.ways ?? []) ways.push({ room: box.id, side });
    } else findings.push({ id: 'unseated', room: A.role, says: `the ${A.role} finds no ground at the ${W.dir} wing's end` });
  }
  // every room reached from the way in, and none too many doors from the core's stair
  const adj = new Map(rooms.map((r) => [r.id, []]));
  for (const l of links) { adj.get(l.from)?.push(l.to); adj.get(l.to)?.push(l.from); }
  const depth = new Map([['lobby', 0]]), q = ['lobby'];
  while (q.length) { const id = q.shift(); for (const o of adj.get(id) ?? []) if (!depth.has(o)) { depth.set(o, depth.get(id) + 1); q.push(o); } }
  for (const r of rooms) if (!depth.has(r.id)) findings.push({ id: 'unreached', room: r.id, says: `no doorway reaches the ${r.id}` });
  const coreDepth = (r) => depth.get(r.id) - depth.get(`core-${(r.storey ?? 0) + 1}`);
  for (const r of rooms) if (depth.has(r.id) && r.id.indexOf('core-') !== 0 && r.id !== 'lobby' && coreDepth(r) > CORE.deep) findings.push({ id: 'deep', room: r.id, says: `the ${r.id} is ${coreDepth(r)} doors from the stair` });
  // (the goal's doorway last: a kit seats its set piece in the walk's last room)
  const ordered = goal ? [...links.filter((l) => l.to !== goal), ...links.filter((l) => l.to === goal)] : links;
  return { rooms, links: ordered, ways, entry: 'lobby', goal, findings, plan: { storeys, wings, loading, bays, corridor: cw } };
}
