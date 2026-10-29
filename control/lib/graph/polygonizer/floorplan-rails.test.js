// A house on its purpose's rail (era/compose-purpose.js): a game's furniture at the readable grain with nothing set on
// a table, its room laid in rank within the allowance and the spend read out; a show's, and a recipe without a
// purpose, built as before, byte for byte.
import { describe, expect, it } from 'vitest';
import { assembleFloorWorldScene } from './floorplan-structure.js';
import { PURPOSES, rankOf } from '../era/compose-purpose.js';
import { FURNISHINGS, pieceOfType } from '../furnishings/roster.js';

// one furnished living room, the smallest house that furnishes
const ROOM = { width: 24, height: 28, rooms: [{ x: 2, y: 2, w: 20, h: 24, glyph: 'L' }], furnish: true, seed: 7, furnishing: 'composed', view: 'interior' };
const build = (extra = {}) => { const m = { ...ROOM, ...extra }; return assembleFloorWorldScene(m, m); };
const pieces = (P) => P.faces.filter((f) => String(f.group || '').startsWith('asset:'));

describe('a house on its rail', () => {
  it('a game: its furniture far lighter, nothing on the table, the spend within the allowance; a show as it was', () => {
    const before = build(), show = build({ purpose: 'show' }), game = build({ purpose: 'game' });
    expect(JSON.stringify(show)).toBe(JSON.stringify(before));
    expect('rails' in before).toBe(false);
    expect(pieces(game).length).toBeLessThan(pieces(before).length / 2);
    const R = game.rails;
    expect(R).toMatchObject({ purpose: 'game', grain: PURPOSES.game.grain, allowance: { room: PURPOSES.game.allowance.room } });
    expect(R.rooms.length).toBe(1);
    expect(R.rooms[0].spent).toBeLessThanOrEqual(R.rooms[0].allowance);
    expect(R.spent).toBe(R.rooms[0].spent);
  });

  it('a tight allowance: what the room is for stands, the rest laid in rank, what it left out said', () => {
    const open = build({ purpose: 'game', allowance: { room: 1e6 } }).rails.rooms[0];
    expect(open.dropped).toEqual([]);
    const tight = build({ purpose: 'game', allowance: { room: 1 } }).rails.rooms[0];
    expect(tight.kept + tight.dropped.length).toBe(open.kept);
    expect(tight.dropped.length).toBeGreaterThan(0);
    // (nothing of the first rank is left out: the room's sofa stands, the room said over)
    const ranks = tight.dropped.map((d) => rankOf(FURNISHINGS[pieceOfType(d.type)]?.role));
    expect(Math.min(...ranks)).toBeGreaterThan(0);
    expect(tight.over).toBe(true);
  });
});
