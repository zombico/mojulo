/**
 * THE BOX IN GREYBOX (docs/metroidvania-map.md "The greybox"): a laid box (box.js) built in metres, before any dress:
 * each room's floor, ceiling and walls, its doors cut through them (a doorway in a wall, a hole through a floor), the
 * ledges a single jump apart that climb to every door a room is left by upward, each gate's block in its doorway or its
 * hole, each pocket's alcove. A cell is one SCREEN (the side map's, side-map/screen.js, for the hero's stature), so the
 * greybox is seen at the size it is played.
 *
 * No climb asks a wall kick: every rise is a ledge LEDGE_SHARE of a jump up (a stair's step walked), laid as a FIGURE
 * across the screen (climbs.js: a switchback, flights, a stair; a zigzag where none fits or a sill must stand clear); a
 * double-jump gate's last rise is its sill (gates.js SILL_SHARE: more than a jump, less than a double jump).
 *
 *   greyboxOf(L, { hero? }) → {
 *     screen, hero,
 *     solids:  [{ s0, s1, z0, z1, room, role }]   role floor | ceiling | wall | ledge | lip | niche  (the closed parts)
 *     gates:   [{ door?, pocket?, kind, shape, s0, s1, z0, z1 }]   what stands shut until it opens (not in solids)
 *     doorways [{ door, s, z0, z1 }]  a wall's opening;  holes: [{ door, s0, s1, z }]  a floor's
 *     chains:  [{ room, door, figure, from, to, stands: [z], spans: [[s0, s1]], rises: [m], last }]   each climb to a
 *              door: its figure, the heights stood on and where each stand above the floor spans, each rise between them,
 *              its last rise (a gate's sill where it is one)
 *     pockets: [{ room, gate, holds, at: [s, z] }],  marks: [{ room, kind, at: [s, z], label? }]
 *   }
 *   sills:   [{ door, room, s, z, side }]   each double-jump sill's top at its room's side, what `sill-holds` measures
 *   FLOOR, CEIL, WALL, HOLE, LEDGE, BOX_FRAME, boxCameraOf(stature)
 *
 * The frame is the side map's: `s` along the box (+ right), `z` up, a cell [c, r] spanning s c·W…(c+1)·W, z r·H…(r+1)·H, a screen in the
 * box's frame (BOX_FRAME: the hero 0.15 of its height).
 * Pure and deterministic.
 */
import { sideMapCamera, SIDE_MAP_FRAME } from '../side-map/screen.js';
import { GATES, readHero, gateSill, LEDGE_SHARE, SLIT_SHARE } from './gates.js';
import { layClimb, climbDeal } from './climbs.js';

/** THE BOX'S FRAME: the side map's (screen.js SIDE_MAP_FRAME), the hero a fifth larger in it, 0.15 of the frame's height
 * against the run and gun's eighth: a metroidvania is close on its hero, a room a little smaller round her. A screen is a
 * cell, so the whole box is laid in it. */
export const BOX_FRAME = Object.freeze({ ...SIDE_MAP_FRAME, heroShare: 0.15 });
/** The box's camera for a hero of `stature` metres: the side map's, in the box's frame. */
export const boxCameraOf = (stature) => sideMapCamera(stature, BOX_FRAME);
export const FLOOR = 1, CEIL = 0.6, WALL = 0.6, HOLE = 4, LEDGE = 2.5, TH = 0.4;
/** how far a stair's ledges step aside from each other, so the one above is never over the head of the one below */
const ASIDE = 5;
/** a drop's hole stands aside of its cell's middle, off the line a climb comes up */
const DROP_ASIDE = 0.3;
const r3 = (v) => Math.round(v * 1000) / 1000;

const cut = (r, o) => {
  if (!(o.s0 < r.s1 - 1e-3 && o.s1 > r.s0 + 1e-3 && o.z0 < r.z1 - 1e-3 && o.z1 > r.z0 + 1e-3)) return [r];
  const a = Math.max(r.s0, o.s0), b = Math.min(r.s1, o.s1), out = [];
  const add = (s0, s1, z0, z1) => { if (s1 - s0 > 1e-3 && z1 - z0 > 1e-3) out.push({ ...r, s0: r3(s0), s1: r3(s1), z0: r3(z0), z1: r3(z1) }); };
  add(r.s0, a, r.z0, r.z1); add(b, r.s1, r.z0, r.z1); add(a, b, r.z0, Math.min(r.z1, o.z0)); add(a, b, Math.max(r.z0, o.z1), r.z1);
  return out;
};

/** The box in metres. */
export function greyboxOf(L, { hero } = {}) {
  const Hh = readHero(hero), J = Hh.jump, cam = boxCameraOf(Hh.stature), W = cam.screen.width, H = cam.screen.height;
  const DOOR = r3(Hh.stature + J + 0.4), STEP = r3(LEDGE_SHARE * J);
  const solids = [], gates = [], doorways = [], holes = [], chains = [], pockets = [], marks = [], openings = [];
  const R = new Map(L.rooms.map((r) => [r.id, r]));
  const box = (s0, s1, z0, z1, extra) => ({ s0: r3(s0), s1: r3(s1), z0: r3(z0), z1: r3(z1), ...extra });
  const floorAt = (row) => row * H + FLOOR;
  const span = (r) => { const [c, rr, w, h] = r.rect; return { s0: c * W, s1: (c + w) * W, zb: rr * H, zt: (rr + h) * H, floor: floorAt(rr) }; };
  // (a room left through a double-jump SILL keeps its stair and its drops on the far side from it, so nothing to stand
  // on puts the sill in one jump's reach: its side, +1 its right wall, -1 its left, 0 none)
  const sillSide = new Map();
  for (const d of L.doors) if (d.gate === 'double-jump' && d.axis === 'h') for (const [mine, other] of [[d.cells[0], d.cells[1]], [d.cells[1], d.cells[0]]]) {
    const r = L.rooms.find((x) => x.cells.some((c) => c[0] === mine[0] && c[1] === mine[1]));
    if (r) sillSide.set(r.id, Math.sign(other[0] - mine[0]));
  }
  const roomOfCell = (c) => L.rooms.find((x) => x.cells.some((q) => q[0] === c[0] && q[1] === c[1]));
  const holeAt = (d) => {
    const [c] = d.cells[0], mid = c * W + W / 2, side = sillSide.get(roomOfCell(d.cells[0])?.id) || sillSide.get(roomOfCell(d.cells[1])?.id) || 0;
    if (side) return mid - side * DROP_ASIDE * W;
    return d.kind === 'loop' || (d.kind === 'shortcut' && d.oneWay) ? mid + DROP_ASIDE * W : mid;
  };

  // THE SHELLS: each room's floor, ceiling and walls
  for (const r of L.rooms) {
    const S = span(r);
    solids.push(box(S.s0, S.s1, S.zb, S.zb + FLOOR, { room: r.id, role: 'floor' }));
    solids.push(box(S.s0, S.s1, S.zt - CEIL, S.zt, { room: r.id, role: 'ceiling' }));
    solids.push(box(S.s0, S.s0 + WALL, S.zb + FLOOR, S.zt - CEIL, { room: r.id, role: 'wall' }));
    solids.push(box(S.s1 - WALL, S.s1, S.zb + FLOOR, S.zt - CEIL, { room: r.id, role: 'wall' }));
    // (the cells inside a room are open to each other: a shaft's storeys, a hall's: no floor between them)
  }
  // THE DOORS cut through them, and each gate's block in its door
  const gateBlock = (d, kind, s0, s1, z0, z1, axis) => {
    const G = GATES[kind];
    if (G.shape === 'sill' && axis === 'h') gates.push(box(s0, s1, z0, z0 + gateSill(kind, Hh), { door: d.id, kind, shape: G.shape }));
    else if (G.shape === 'sill') { /* a hole's double-jump gate is its climb's last rise: the chain says it */ }
    else if (G.shape === 'grate') gates.push(axis === 'h' ? box(s0, s1, z0 + SLIT_SHARE * Hh.stature, z1, { door: d.id, kind, shape: G.shape }) : box(s0, s1, z0, z1, { door: d.id, kind, shape: G.shape }));
    else gates.push(box(s0, s1, z0, z1, { door: d.id, kind, shape: G.shape }));
  };
  for (const d of L.doors) {
    const [p, q] = d.cells;
    if (d.axis === 'h') {
      const s = Math.max(p[0], q[0]) * W, z0 = floorAt(p[1]), sill = d.gate === 'double-jump' ? gateSill('double-jump', Hh) : 0;
      const o = box(s - WALL, s + WALL, z0, z0 + DOOR + sill);
      openings.push(o); doorways.push({ door: d.id, s: r3(s), z0: r3(z0), z1: r3(z0 + DOOR + sill) });
      if (d.gate) gateBlock(d, d.gate, s - WALL, s + WALL, z0, z0 + DOOR + sill, 'h');
    } else {
      const z = Math.max(p[1], q[1]) * H, mid = holeAt(d);
      const o = box(mid - HOLE / 2, mid + HOLE / 2, z - CEIL, z + FLOOR);
      openings.push(o); holes.push({ door: d.id, s0: o.s0, s1: o.s1, z: r3(z) });
      if (d.gate) gateBlock(d, d.gate, mid - HOLE / 2, mid + HOLE / 2, z - CEIL, z + FLOOR, 'v');
    }
  }
  // the ENTRY: a doorway in the first room's near wall, on the box's side
  {
    const r = R.get(L.entry.room), S = span(r), o = box(S.s0, S.s0 + WALL, S.floor, S.floor + DOOR);
    openings.push(o); marks.push({ room: r.id, kind: 'entry', at: [r3(S.s0), r3(S.floor)], label: 'enter' });
  }

  // THE CLIMBS: a stair of ledges up to every door a room is left by upward (a doorway above its floor, a hole in its
  // ceiling), each a single jump's share up, zigzagging so none is over the head of the one below
  const ledges = [];
  let shaftTurn = 0, storeyTurn = 0;
  const inside = (S, s) => Math.min(S.s1 - WALL - LEDGE / 2 - 0.2, Math.max(S.s0 + WALL + LEDGE / 2 + 0.2, s));
  for (const r of L.rooms) {
    const S = span(r);
    for (const d of L.doors) {
      if (d.a !== r.id && d.b !== r.id) continue;
      const mine = d.cells.find((c) => r.cells.some((x) => x[0] === c[0] && x[1] === c[1])), other = d.cells.find((c) => c !== mine);
      let target, top, toward, last = STEP, gate;
      if (d.axis === 'h') {
        target = floorAt(mine[1]);
        if (target <= S.floor + 1e-3) continue;
        const wallS = Math.max(mine[0], other[0]) * W, right = other[0] > mine[0];
        // (the lip: a ledge against the wall under the doorway, at the next room's floor)
        top = right ? wallS - WALL - LEDGE / 2 : wallS + WALL + LEDGE / 2;
        toward = right ? -1 : 1;
      } else {
        if (other[1] < mine[1]) continue;   // a hole in its floor: dropped through, climbed from the room below
        if (d.oneWay && d.a !== r.id) continue;   // a drop into this room: never climbed back up
        target = Math.max(mine[1], other[1]) * H + FLOOR;
        top = holeAt(d); toward = sillSide.get(r.id) ? -sillSide.get(r.id) : top > (S.s0 + S.s1) / 2 ? -1 : 1;
        if (d.gate === 'double-jump') { last = gateSill('double-jump', Hh); gate = 'double-jump'; }
      }
      // the stands: the floor, the room's FIGURE (climbs.js: dealt by the room, tried in turn, the zigzag last), the
      // door's own height; the last rise the gate's where it is one
      const highest = d.axis === 'h' ? target : target - last, rise = highest - S.floor, n = Math.max(1, Math.ceil(rise / STEP - 1e-9));
      const stands = [r3(S.floor)], mineLedges = ledges.filter((x) => x.room === r.id).map((x) => ({ s0: x.s0, s1: x.s1, z: x.z1, kind: x.role }));
      const as = sillSide.get(r.id) ? 'sill' : r.kind === 'shaft' ? 'shaft' : 'storey', turn = as === 'shaft' ? shaftTurn++ : storeyTurn++;
      const ctx = { a: S.s0 + WALL + 0.2, b: S.s1 - WALL - 0.2, floor: S.floor, rise, n, top, hero: Hh, ledge: LEDGE, existing: mineLedges };
      let figure = 'zigzag', laid = null;
      for (const f of climbDeal(as, turn)) { if (f === 'zigzag') break; laid = layClimb(f, ctx); if (laid) { figure = f; break; } }
      // (the zigzag: aside of the top by ASIDE, toward the room where the wall would fold it back over the one below)
      const zig = Math.abs(inside(S, top + toward * ASIDE) - inside(S, top)) < LEDGE + 0.6 ? -toward : toward;
      if (!laid) laid = Array.from({ length: n }, (_, j) => { const k = j + 1, s = inside(S, top + zig * ((n - k) % 2) * ASIDE); return { s0: s - LEDGE / 2, s1: s + LEDGE / 2, z: S.floor + (rise * k) / n, kind: 'ledge' }; });
      const spans = [];
      laid.forEach((p, j) => {
        const k = j + 1, z = p.z, ledge = box(p.s0, p.s1, z - TH, z, { room: r.id, role: d.axis === 'h' && k === laid.length ? 'lip' : 'ledge', door: d.id, ...(figure !== 'zigzag' ? { figure, piece: p.kind } : {}) });
        if (!ledges.some((x) => Math.abs(x.s0 - ledge.s0) < 0.5 && Math.abs(x.z1 - ledge.z1) < 0.5)) { ledges.push(ledge); solids.push(ledge); }
        stands.push(r3(z)); spans.push([r3(p.s0), r3(p.s1)]);
      });
      if (d.axis === 'v') stands.push(r3(target));
      const rises = stands.slice(1).map((z, k) => r3(z - stands[k]));
      chains.push({ room: r.id, door: d.id, figure, from: r3(S.floor), to: r3(target), stands, spans, rises, last: rises.at(-1), ...(gate ? { gate } : {}) });
    }
  }

  // THE POCKETS: an alcove in its corridor's middle cell, shut by its gate (a double jump's: a shelf a sill up)
  for (const r of L.rooms) r.pockets.forEach((p, k) => {
    const S = span(r), cell = r.cells[Math.floor((r.cells.length - 1) / 2)], cx = cell[0] * W + W / 2 + (k ? ASIDE * 1.6 : -ASIDE * 0.6);
    if (p.gate === 'double-jump') {
      const z = S.floor + gateSill('double-jump', Hh);
      solids.push(box(cx - LEDGE / 2, cx + LEDGE / 2, z - TH, z, { room: r.id, role: 'niche' }));
      pockets.push({ room: r.id, gate: p.gate, holds: p.holds, at: [r3(cx), r3(z)] });
      return;
    }
    const h = Hh.stature + 0.8, z0 = S.floor;
    solids.push(box(cx - 1.5, cx + 2.1, z0 + h, z0 + h + TH, { room: r.id, role: 'niche' }));
    solids.push(box(cx + 1.5, cx + 2.1, z0, z0 + h, { room: r.id, role: 'niche' }));
    const G = GATES[p.gate];
    gates.push(box(cx - 2.1, cx - 1.5, z0 + (G.shape === 'grate' ? SLIT_SHARE * Hh.stature : 0), z0 + h + TH, { pocket: `${r.id}#${k}`, kind: p.gate, shape: G.shape }));
    pockets.push({ room: r.id, gate: p.gate, holds: p.holds, at: [r3(cx), r3(z0)] });
  });

  // THE MARKS: what each room holds, at its floor's middle
  for (const r of L.rooms) {
    const S = span(r), at = [r3((S.s0 + S.s1) / 2), r3(S.floor)];
    if (r.save) marks.push({ room: r.id, kind: 'save', at });
    if (r.boss) marks.push({ room: r.id, kind: 'boss', at, label: r.boss });
    if (r.finds) marks.push({ room: r.id, kind: 'power', at, label: L.powers[r.finds].name ?? r.finds });
    if (r.key) marks.push({ room: r.id, kind: 'key', at, label: 'key' });
  }

  // the doors cut through the shells (a ledge never cut: it stands in the open)
  let cutSolids = solids;
  for (const o of openings) cutSolids = cutSolids.flatMap((x) => (x.role === 'ledge' || x.role === 'lip' || x.role === 'niche' ? [x] : cut(x, o)));
  const sills = gates.filter((g) => g.kind === 'double-jump' && g.door).map((g) => {
    const d = L.doors.find((x) => x.id === g.door), r = [...sillSide.keys()].find((id) => d.a === id || d.b === id);
    return { door: g.door, room: r, s: r3(sillSide.get(r) > 0 ? g.s0 : g.s1), z: g.z1, side: sillSide.get(r) };
  });
  return { screen: cam.screen, hero: Hh, door: DOOR, step: STEP, solids: cutSolids, gates, doorways, holes, chains, pockets, marks, sills };
}
