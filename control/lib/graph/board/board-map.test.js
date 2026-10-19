import { describe, it, expect } from 'vitest';
import { layBoard, readBoardSpec } from './board-lay.js';
import { layMap, readMapSpec } from './board-map.js';

const board = layBoard(readBoardSpec({ seed: 'epoch', cols: 12, rows: 10, relief: 0.45 })).board;

describe('the epoch map', () => {
  it('stands each dot on its own walkable spot and lays a road from each to the story dot before it, a skirmish a spur', () => {
    const M = layMap(board, { dots: [{ id: 'gate' }, { id: 'gate-wilds', kind: 'skirmish', gate: 'gate' }, { id: 'keep', gate: 'gate' }, { id: 'tower', kind: 'story', gate: 'keep' }] });
    expect(new Set(M.dots.map((d) => d.at)).size).toBe(4);
    expect(M.dots.every((d) => board.spots[d.at].walk)).toBe(true);
    expect(M.roads.map((r) => [r.from, r.to])).toEqual([['gate', 'gate-wilds'], ['gate', 'keep'], ['keep', 'tower']]);
    for (const r of M.roads) expect([r.path[0], r.path[r.path.length - 1]]).toEqual([M.dots.find((d) => d.id === r.from).at, M.dots.find((d) => d.id === r.to).at]);
    expect(M.start).toBe('gate');
    expect(M.dots[0].name).toBe('Gate');
    expect(layMap(board, { dots: [{ id: 'gate' }, { id: 'keep' }] })).toEqual(layMap(board, { dots: [{ id: 'gate' }, { id: 'keep' }] }));
  });

  it('refuses a map it cannot read, saying why', () => {
    expect(() => readMapSpec({ dots: [] })).toThrow(/dots are 1 to 24/);
    expect(() => readMapSpec({ dots: [{ id: 'a' }, { id: 'a' }] })).toThrow(/two dots are 'a'/);
    expect(() => readMapSpec({ dots: [{ id: 'a', gate: 'b' }] })).toThrow(/waits on 'b', which is no dot/);
    expect(() => readMapSpec({ dots: [{ id: 'a', kind: 'dungeon' }] })).toThrow(/kind is battle, skirmish, town, story/);
  });
});
