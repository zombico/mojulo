/**
 * THE BOX, SOLVED (docs/metroidvania-map.md "What holds it"): a laid box (box.js) walked as a player first walks it,
 * through every door its holdings open, picking up what each room holds as it is reached: a key, a boss felled and its
 * prize, a relic, a pocket's prize where the pocket's gate opens. Walked again whenever something new is held, until
 * nothing more is. What it says is what the laws read: whether the box is finished, in what order its powers come, how
 * far the way in is and how short the way back.
 *
 *   opens(door, from, held, L)  → whether a door lets the hero from `from` through, holding `held`
 *   solveBox(L) → {
 *     got:      [{ what, kind: power | key | boss | pocket, room, order }]   in the order the walk picks them up
 *     reached:  room ids, in the order first reached; unreached: those never
 *     pockets:  { got, left }: the pockets opened and those left shut
 *     done:     the core's boss felled (or, with none, its last hall reached)
 *     heldAt:   { <room>: [what was held as it was first reached] }
 *     wayIn:    cells walked from the gate to the core, the spiral's own walk
 *     wayBack:  cells on the shortest way from the core back to the gate, everything held (the shortcuts taken)
 *     traps:    [door id]: one-way doors whose landing has no way back to where they dropped from, with what was held
 *   }
 *   pathCells(L, from, to, held) → the fewest cells walked from one room to another through open doors (null: none)
 *
 * Pure.
 */
import { GATES } from './gates.js';

const tokenOf = (L, door) => {
  const g = door.gate;
  if (!g) return null;
  if (g === 'boss') return `boss:${door.a}`;
  if (g === 'key') return `key:${L.rooms.find((r) => r.id === door.a).ring}`;
  return `gate:${g}`;
};

/** Whether `door` lets the hero through from `from`, holding `held` (a Set of tokens). */
export function opens(door, from, held, L) {
  if (door.oneWay && from !== door.a) return false;
  const t = tokenOf(L, door);
  return !t || held.has(t);
}

const roomsBy = (L) => new Map(L.rooms.map((r) => [r.id, r]));
const cellsOf = (r) => r.rect[2] * r.rect[3];

/** The fewest cells walked from room `a` to room `b` through open doors (each room entered counted at its size). */
export function pathCells(L, a, b, held) {
  const R = roomsBy(L), dist = new Map([[a, 0]]), todo = [a];
  while (todo.length) {
    todo.sort((x, y) => dist.get(x) - dist.get(y));
    const at = todo.shift();
    if (at === b) return dist.get(at);
    for (const d of L.doors) {
      if (d.a !== at && d.b !== at) continue;
      const to = d.a === at ? d.b : d.a;
      if (!opens(d, at, held, L)) continue;
      const nd = dist.get(at) + cellsOf(R.get(to));
      if (!dist.has(to) || nd < dist.get(to)) { if (!dist.has(to)) todo.push(to); dist.set(to, nd); }
    }
  }
  return null;
}

/** The box walked to the end of what it opens. */
export function solveBox(L) {
  const R = roomsBy(L), held = new Set(), got = [], reached = [], seen = new Set(), heldAt = {}, pocketsGot = new Set();
  const take = (what, kind, room, token) => { if (held.has(token)) return false; held.add(token); got.push({ what, kind, room, order: got.length }); return true; };
  const collect = (r) => {
    let more = false;
    if (r.key) more = take(`${L.rings[r.ring].place}'s key`, 'key', r.id, `key:${r.ring}`) || more;
    if (r.boss) more = take(r.boss, 'boss', r.id, `boss:${r.id}`) || more;
    if (r.finds) more = take(L.powers[r.finds].name ?? r.finds, 'power', r.id, `gate:${L.powers[r.finds].opens}`) || more;
    r.pockets.forEach((p, k) => {
      const id = `${r.id}#${k}`;
      if (!pocketsGot.has(id) && (held.has(`gate:${p.gate}`) || GATES[p.gate]?.by === 'blows')) { pocketsGot.add(id); got.push({ what: p.holds, kind: 'pocket', room: r.id, order: got.length }); }
    });
    return more;
  };
  // walked again while anything new is held
  for (let changed = true; changed;) {
    changed = false;
    const todo = [L.entry.room], here = new Set(todo);
    while (todo.length) {
      const at = todo.shift(), r = R.get(at);
      if (!seen.has(at)) { seen.add(at); reached.push(at); heldAt[at] = [...held].sort(); }
      if (collect(r)) changed = true;
      for (const d of L.doors) {
        if (d.a !== at && d.b !== at) continue;
        const to = d.a === at ? d.b : d.a;
        if (!here.has(to) && opens(d, at, held, L)) { here.add(to); todo.push(to); }
      }
    }
  }
  const core = L.rooms.filter((r) => L.rings[r.ring].core), throne = core.at(-1);
  const done = throne ? (throne.boss ? held.has(`boss:${throne.id}`) : seen.has(throne.id)) : false;
  // the one-way doors: from where each lands, holding what was held as its top was first reached, a way back up to it
  const traps = [];
  for (const d of L.doors.filter((x) => x.oneWay)) {
    if (!seen.has(d.a)) continue;
    const h = new Set(heldAt[d.a].filter((t) => t)), back = pathCells(L, d.b, d.a, h);
    if (back === null) traps.push(d.id);
  }
  const wayIn = core.length ? L.walk.slice(0, L.walk.indexOf(core[0].id) + 1).reduce((n, id) => n + cellsOf(R.get(id)), 0) - cellsOf(R.get(L.entry.room)) : null;
  const wayBack = core.length ? pathCells(L, core[0].id, L.entry.room, held) : null;
  const pockets = L.rooms.flatMap((r) => r.pockets.map((p, k) => ({ room: r.id, ...p, got: pocketsGot.has(`${r.id}#${k}`) })));
  return {
    got, reached, unreached: L.rooms.map((r) => r.id).filter((id) => !seen.has(id)),
    pockets: { got: pockets.filter((p) => p.got), left: pockets.filter((p) => !p.got) },
    done, heldAt, wayIn, wayBack, traps,
    held: [...held].sort(), gates: [...new Set(L.doors.map((d) => d.gate).filter(Boolean))].filter((g) => GATES[g]),
  };
}
