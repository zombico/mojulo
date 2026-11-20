import { describe, it, expect } from 'vitest';
import { LAYOUTS, LAYOUT_IDS, readLayouts, layoutOf, layoutLaws } from './room-layouts.js';
import { PIECES, footprintOf } from './compose-dress.js';

// ROOM LAYOUTS (room-layouts.js): a room's floor laid in a figure, held to the laws a sneaking body needs of it.

const piece = (k) => PIECES[k];
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// the smallest hall a figure shows itself in, a doorway in the middle of each short wall
const HALL = Object.freeze({ id: 'hall', x0: 0, y0: 0, x1: 24, y1: 16, h: 6 });
const DOORS = Object.freeze([{ X: true, at: 0, into: 1, lo: 7, hi: 9 }, { X: true, at: 24, into: -1, lo: 7, hi: 9 }]);
const boxesOf = (items) => items.map((it) => { const f = footprintOf(it); return { min: f.min, max: f.max, h: PIECES[it.kind].h }; });
const lay = (id, room = HALL, over = {}, fits) => LAYOUTS[id].lay(room, { ...LAYOUTS[id].dials, ...over }, piece, mulberry32(7), fits);

describe('room layouts', () => {
  it('each lays the dressing\'s own pieces inside its room, facing a wall\'s way, the same for the same dice', () => {
    for (const id of LAYOUT_IDS) {
      const a = lay(id), b = lay(id);
      expect(a.length, id).toBeGreaterThan(0);
      expect(a).toEqual(b);
      for (const it of a) {
        expect(PIECES[it.kind], `${id}: ${it.kind}`).toBeTruthy();
        expect(['+x', '-x', '+y', '-y']).toContain(it.facing);
        const f = footprintOf(it);
        expect(f.min[0] >= HALL.x0 && f.max[0] <= HALL.x1 && f.min[1] >= HALL.y0 && f.max[1] <= HALL.y1, `${id}: ${it.kind} at ${it.at}`).toBe(true);
      }
    }
  });

  it('a hall laid in aisles keeps its doorways joined, a way round, its gaze broken and cover in reach; bare it holds none of the last three', () => {
    const laid = layoutLaws(HALL, boxesOf(lay('aisles')), DOORS), bare = layoutLaws(HALL, [], DOORS);
    expect(Object.fromEntries(laid.map((l) => [l.law, l.holds]))).toEqual({ 'doors-joined': true, 'a-way-round': true, 'sight-broken': true, 'cover-in-reach': true });
    expect(Object.fromEntries(bare.map((l) => [l.law, l.holds]))).toEqual({ 'doors-joined': true, 'a-way-round': false, 'sight-broken': false, 'cover-in-reach': false });
  });

  it('a room smaller than a hall is held to its doorways and its cover alone; a corridor to the gaze down it, never a way round', () => {
    const small = layoutLaws({ x0: 0, y0: 0, x1: 5.5, y1: 5.5 }, [], [{ X: true, at: 0, into: 1, lo: 2, hi: 3.5 }]);
    expect(small.map((l) => l.law)).toEqual(['doors-joined', 'cover-in-reach']);
    const corridor = { x0: 0, y0: 0, x1: 22, y1: 4.5 }, ends = [{ X: true, at: 0, into: 1, lo: 1, hi: 3.5 }, { X: true, at: 22, into: -1, lo: 1, hi: 3.5 }];
    const laws = layoutLaws(corridor, boxesOf(lay('chicane', corridor, { piece: 'shelves', len: 2 })), ends);
    expect(laws.map((l) => l.law)).toEqual(['doors-joined', 'sight-broken', 'cover-in-reach']);
    expect(laws.every((l) => l.holds), JSON.stringify(laws)).toBe(true);
  });

  it('a chicane slides each block along its wall to a stretch the room says is clear, and lays none where none is', () => {
    const corridor = { x0: 0, y0: 0, x1: 18, y1: 3.5 }, taken = (at) => at[0] > 4 && at[0] < 7;
    const B = lay('chicane', corridor, {}, (kind, at) => !taken(at));
    expect(B.length).toBeGreaterThan(0);
    expect(B.some((it) => taken(it.at))).toBe(false);
    expect(lay('chicane', corridor, {}, () => false)).toEqual([]);
  });

  it('a program\'s layouts are read by room or role, their dials checked, a room\'s own over its role\'s', () => {
    const L = readLayouts({ shed: 'aisles', 'shed-2': { layout: 'stockpile', spacing: 5 } }, Object.keys(PIECES));
    expect(layoutOf(L, 'shed-3', 'shed')).toEqual({ ...LAYOUTS.aisles.dials, layout: 'aisles' });
    expect(layoutOf(L, 'shed-2', 'shed').spacing).toBe(5);
    expect(layoutOf(L, 'lobby', 'lobby')).toBeNull();
    expect(() => readLayouts({ shed: 'maze' })).toThrow(/is a layout/);
    expect(() => readLayouts({ shed: { layout: 'aisles', spacing: 4 } })).toThrow(/not a dial of 'aisles'/);
    expect(() => readLayouts({ shed: { layout: 'aisles', aisle: 9 } })).toThrow(/aisle is 1 to 4/);
    expect(() => readLayouts({ shed: { layout: 'aisles', piece: 'throne-of-bees' } }, Object.keys(PIECES))).toThrow(/pieces of the dressing/);
  });

  it('a cage is a whole ring of mesh with a gate, its stock inside; its mesh stops no gaze', () => {
    const items = lay('cage'), mesh = items.filter((it) => it.kind === 'mesh-panel'), stock = items.filter((it) => it.kind !== 'mesh-panel');
    expect(mesh.length).toBeGreaterThan(8);
    expect(stock.length).toBeGreaterThan(0);
    const box = (it) => { const f = footprintOf(it); return { min: f.min, max: f.max, h: PIECES[it.kind].h, ...(PIECES[it.kind].see ? { see: true } : {}) }; };
    const seenAll = layoutLaws(HALL, mesh.map(box), DOORS).find((l) => l.law === 'sight-broken');
    expect(seenAll.holds).toBe(false);
    const asWalls = layoutLaws(HALL, mesh.map((it) => { const { see, ...b } = box(it); return b; }), DOORS).find((l) => l.law === 'sight-broken');
    expect(asWalls.says).not.toEqual(seenAll.says);
  });
});
