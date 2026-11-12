// What a place sheds, read from what it is made of (era/skandart-derive.js): a room no one wrote an answer for answers
// with its own materials and use; a recipe may give its own answer over it, each piece a shelf row. One case per way a
// tile names its matter, and a room built three ways, hold the concept.
import { describe, it, expect } from 'vitest';
import { MATERIALS, matterOfTile, deriveSkandart } from './skandart-derive.js';
import { readSkandart, resolveSkandartCard } from './skandart.js';
import { DEBRIS } from './debris-shelf.js';
import { STAGE_KITS, assembleStageScene } from './stage.js';

const ROOM = (over = {}) => ({ kind: 'stage', rooms: [{ id: 'a', x: 0, y: 0, w: 10, d: 12, h: 7 }], ...over });

describe('what a place sheds', () => {
  it('reads a tile\'s matter by its generator, its key or its family\'s name, the most particular first', () => {
    // (a generator's settings: dressed stone in render is render; cut stone in courses is stone, not brick)
    expect(matterOfTile(STAGE_KITS['gothic-ashlar'].tiles.wall)).toBe('render');
    expect(matterOfTile(STAGE_KITS['gothic-stone'].tiles.wall)).toBe('stone');
    // (a key; a named family read by its name)
    expect(matterOfTile({ key: 'concrete-board' })).toBe('board');
    expect(matterOfTile({ family: 'stone-wall-bluestone' })).toBe('stone');
    expect(matterOfTile({ key: 'lab:vct' })).toBe(null);
    // (every matter sheds rows the shelf has)
    for (const [m, M] of Object.entries(MATERIALS)) for (const id of [...Object.keys(M.wall), ...Object.keys(M.ceiling)]) expect(DEBRIS[id], `${m}: ${id}`).toBeDefined();
  });

  it('answers for a kit with no card: heavy walls heap at their repose, light ones drift; a use leaves its own; nothing that sheds, no answer', () => {
    const stone = deriveSkandart(STAGE_KITS['gothic-stone']), lab = deriveSkandart(STAGE_KITS['research-lab'], { use: 'office' });
    expect(stone.foot.pieces).toMatchObject({ spall: expect.any(Number), 'fallen-block': expect.any(Number) });
    expect(stone.spread).toBeUndefined();
    expect(lab.derived).toMatchObject({ wall: ['board'], ceiling: 'concrete', use: 'office' });
    expect(lab.foot.pieces.paper).toBeGreaterThan(0);
    expect(lab.spread).toBeGreaterThan(0);
    expect(deriveSkandart({ tiles: { floor: { key: 'carpet' } } })).toBe(null);
  });

  it('takes a recipe\'s own answer over the room\'s, each piece checked against the shelf; a cause set false is none', () => {
    const R = readSkandart({ skandart: { amount: 0.5, foot: { pieces: { brick: 10 } }, corner: false, matters: { brick: '#7a3a2a' } } });
    expect(R.card).toMatchObject({ foot: { pieces: { brick: 10 } }, corner: false, matters: { brick: '#7a3a2a' } });
    const C = resolveSkandartCard(STAGE_KITS['gothic-stone'], R.card);
    expect(C.from).toBe('recipe');
    expect(C.card.corner).toBeUndefined();
    expect(C.card.collapse).toBeDefined();
    expect(() => readSkandart({ skandart: { foot: { pieces: { anvil: 2 } } } })).toThrow(/not on the debris shelf/);
    expect(() => readSkandart({ skandart: { foot: { pieces: { brick: 99 } } } })).toThrow(/0 to 60/);
    expect(() => readSkandart({ skandart: { heights: { foot: [0.5, 0.1] } } })).toThrow(/lowest, highest/);
    expect(resolveSkandartCard({ tiles: {} }, null)).toBe(null);
  });

  it('builds a room with no card from its own materials, and the same room in a recipe\'s own walls from those', () => {
    const P = assembleStageScene(ROOM({ kit: 'gothic-stone', condition: 'derelict' }), {});
    expect(P.skandart).toMatchObject({ from: 'derived', derived: { wall: ['stone'] } });
    expect((P.repeats || []).some((r) => r.group.startsWith('skandart:'))).toBe(true);
    const T = assembleStageScene(ROOM({ kit: 'gothic-stone', tiles: { wall: { gen: 'wood', early: [118, 106, 92], late: [96, 85, 72] } }, skandart: true }), {});
    expect(T.skandart.derived.wall).toEqual(['wood']);
  }, 300_000);
});
