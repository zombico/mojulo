import { describe, it, expect } from 'vitest';
import { layCastle } from './castle.js';
import { layBox } from './box.js';
import { mapOf, viewOf, mapLaws, exploredSvg, cellAt, MAP_LAWS } from './explored.js';
import { vampireSonata, vampireSonataCastle } from './vampire-sonata.js';

const keys = (r) => r.cells.map((q) => q.join(','));

describe('the explored map', () => {
  it('maps each tile a screen: its sides walls, open to its own room, or a door; each room\'s marks where its thing stands', () => {
    const L = layBox(vampireSonata()), M = mapOf(L);
    expect(M.cells.length).toBe(L.box[0] * L.box[1]);
    const hall = L.rooms.find((r) => r.cells.length > 1 && r.kind === 'corridor'), [a, b] = hall.cells;
    const side = b[0] > a[0] ? 'right' : 'up', tile = M.cells.find((x) => x.c === a[0] && x.r === a[1]);
    expect(tile.sides[side]).toBe('open');
    expect(Object.values(M.doors).some((d) => d.gate === 'key' && d.token === 'key:0')).toBe(true);
    expect(M.rooms.flatMap((r) => r.marks.map((m) => m.kind))).toEqual(expect.arrayContaining(['save', 'map', 'boss', 'power', 'key', 'prize', 'throne']));
    expect(cellAt(L, 10, 6, 15, 7)).toEqual([1, 1]);
    expect(cellAt(L, 10, 6, -5, 1)).toBeNull();
  });

  it('shows what is walked, what a map room shows, the frontier, and a gate open-able once what opens it is held', () => {
    const L = layBox(vampireSonata()), M = mapOf(L), first = L.rooms.find((r) => r.id === L.entry.room), ring0 = L.rooms.filter((r) => r.ring === 0).flatMap(keys);
    const V = viewOf(M, { visited: keys(first), known: ring0, at: first.cells[0] });
    expect(V.tiles.filter((t) => t.state === 'here').length).toBe(1);
    expect(V.tiles.filter((t) => t.state === 'known').length).toBe(ring0.length - first.cells.length);
    expect(V.doors.some((d) => d.kind === 'frontier')).toBe(true);
    const lock = V.doors.find((d) => d.gate === 'key');
    expect(lock.state).toBe('shut');
    expect(viewOf(M, { visited: keys(first), known: ring0, held: ['key:0'] }).doors.find((d) => d.gate === 'key').state).toBe('open-able');
    // (a thing taken leaves the map; a boss felled is crossed)
    const keyMark = (v) => v.marks.filter((m) => m.kind === 'key').length;
    expect(keyMark(V)).toBe(1);
    expect(keyMark(viewOf(M, { visited: keys(first), known: ring0, taken: ['relic-key-0'] }))).toBe(0);
    const boss = L.rooms.find((r) => r.boss && r.ring === 0);
    expect(viewOf(M, { visited: keys(boss), felled: [boss.id] }).marks.find((m) => m.kind === 'boss').felled).toBe(true);
    expect(V.percent).toBe(Math.round((100 * first.cells.length) / M.cells.length));
  });

  it('holds the castle\'s map to its affordances, and says a door drawn from one side and a first screen with no way on', () => {
    const L = layCastle(vampireSonataCastle());
    expect(mapLaws(L).map((l) => l.id)).toEqual([...MAP_LAWS]);
    expect(mapLaws(L).filter((l) => !l.holds)).toEqual([]);
    const lop = { ...L, doors: L.doors.filter((d) => d.a !== L.entry.room && d.b !== L.entry.room) };
    expect(mapLaws(lop).find((l) => l.id === 'way-on').holds).toBe(false);
    // (drawn as the idiom draws it: a picture of the map, its share walked)
    expect(exploredSvg(viewOf(mapOf(L), { visited: keys(L.rooms[0]) }))).toMatch(/^<svg[\s\S]*% of the castle[\s\S]*<\/svg>$/);
  });
});
