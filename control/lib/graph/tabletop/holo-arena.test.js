// The holo arena: a board game lifted into a hologram arena on the World page. Its words read and refused, the board on
// the stage with a podium behind each side, the venue as a stage recipe, the page's data (each kind's body resolved),
// the block that parses, and the duel the minds play: the same seed is the same game.
import { describe, it, expect } from 'vitest';
import { readHolo, holoBoard, holoManifest, holoArenaData, holoClientSource, HOLO_CELL, HOLO_LIFT } from './holo-arena.js';
import { buildTabletop } from './tabletop-kernel.js';
import { islandEconomy } from './fixtures/island-economy.js';
import { buildTabletopMind } from './tabletop-mind.js';
import { holoChannelScript } from '../scene/channels/holo.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const FLOOR = { corners: [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]], fill: '#888' };
// a small game written out: two rooks and a king a side on a 5×5 board (a written game lifts as the book's do)
const MINI = {
  board: { shape: 'square', cols: 5, rows: 5 },
  players: [{ id: 'blue', facing: 'N' }, { id: 'red', facing: 'S' }],
  royal: true,
  pieces: { K: { name: 'king', shape: 'king', royal: true, rules: [{ vec: ['N', 'NE'] }] }, R: { name: 'rook', shape: 'rook', value: 5, rules: [{ vec: 'N', range: 'any' }] } },
  setup: { blue: { K: ['C1'], R: ['A1', 'E1'] }, red: { K: ['C5'], R: ['A5', 'E5'] } },
  cap: 40,
};

/** The duel the minds play on the page, in Node: the same seeds, ply by ply. */
function exhibition(data, plies) {
  const T = buildTabletop(), M = buildTabletopMind(T), K = T.compile(data.L, data.G);
  let S = T.start(K);
  const line = [];
  for (let i = 0; i < plies && !S.over; i++) {
    const legal = T.legal(K, S);
    if (T.outcome(K, S, legal)) break;
    const r = M.think(K, S, Object.assign({}, M.LEVELS[data.level], { seed: data.seed + line.length }));
    if (!r) break;
    S = T.apply(K, S, r.move); line.push(r.move.name);
  }
  return { S, line };
}

describe('the holo arena', () => {
  it('reads a game of moves and its seats; refuses what it cannot lift, teaching', () => {
    expect(readHolo({ game: 'chess' })).toMatchObject({ game: 'chess', players: 1, level: 'fair', seed: 1, kit: 'research-lab' });
    expect(() => readHolo({})).toThrow(/game names the board game/);
    expect(() => readHolo({ game: 'go' })).toThrow(/no game 'go' in the book/);
    expect(() => readHolo({ game: 'chess', players: 3 })).toThrow(/players is 0 \(an exhibition\)/);
    expect(() => readHolo({ game: 'chess', human: 'green' })).toThrow(/human 'green' is not a player/);
    expect(() => readHolo({ game: 'chess', pads: 2 })).toThrow(/has no 'pads'/);
    expect(() => readHolo({ game: 'chess', kit: 'moon' })).toThrow(/kit 'moon' is one of/);
    expect(readHolo({ game: MINI, players: 0 }).players).toBe(0);
    // a euro game is not a game of moves yet: it plays on its own page
    expect(() => readHolo({ game: islandEconomy({ players: 3 }) })).toThrow(/is a euro game: the holo arena lifts a game of moves/);
  });

  it('floats the board over the floor at a cell sized to the arena, a podium behind each side', () => {
    const B = holoBoard(readHolo({ game: 'chess' }));
    expect(B.cell).toBeGreaterThanOrEqual(HOLO_CELL[0]); expect(B.cell).toBeLessThanOrEqual(HOLO_CELL[1]);
    expect(B.centre).toEqual([0, B.room.d / 2, HOLO_LIFT]);
    expect(B.L.size[1]).toBeCloseTo(8 * B.cell, 6);
    expect(B.room.d).toBeGreaterThan(B.L.size[1] + 2 * B.podium);
    expect(B.room.w % 2).toBe(0); expect(B.room.d % 2).toBe(0);
    // a small board's cells are larger, never past the most
    expect(holoBoard(readHolo({ game: MINI })).cell).toBe(HOLO_CELL[1]);
  });

  it('is a stage recipe carrying the arena, its camera behind player 1\'s podium', () => {
    const m = holoManifest({ game: 'checkers', players: 2 });
    expect(m).toMatchObject({ kind: 'stage', kit: 'research-lab', holo: { game: 'checkers', players: 2, title: 'Checkers · holo arena' } });
    expect(m.rooms[0].open).toEqual(['-y']);
    expect(m.camera.worldFraming.cameraPosition[1]).toBeLessThan(m.rooms[0].d / 2);
    expect(holoManifest({ game: 'chess', crowd: false }).stands).toBeUndefined();
  });

  it('carries the game dealt, each kind\'s body resolved and its value, each duelist\'s light', () => {
    const D = holoArenaData({ game: 'chess' });
    expect(D.human).toBe(D.G.players[0].id);
    expect(D.kinds.N).toMatchObject({ name: 'knight', value: 3 }); expect(D.kinds.K.royal).toBe(true);
    for (const k of Object.values(D.kinds)) expect(typeof k.shape.form).toBe('string');
    expect(D.duelists.map((p) => p.facing)).toEqual(['N', 'S']); expect(D.players).toBe(1);
    expect(new Set(D.duelists.map((p) => p.colour)).size).toBe(2);
    expect(D.wire).toMatchObject({ ready: 'game-ready', init: 'game-init', outcome: 'game-outcome' });
    expect(D.L.cells.length).toBe(64);
  });

  it('inlines one block that parses: the kernel and the mind from their closures, the client; a page without the key emits none', () => {
    const D = holoArenaData({ game: MINI, players: 0 });
    expect(holoClientSource()).not.toMatch(/^(import|export) /m);
    const block = holoChannelScript(D);
    expect(block).toContain('const HOLO_ARENA = '); expect(block).toContain('stepHolo = stepHoloArena');
    expect(() => new Function('THREE', 'scene', 'camera', 'controls', 'wrap', 'window', 'document', 'performance', `"use strict"; let __ctrlOwnsCamera = false; let stepHolo; ${block}`)).not.toThrow();
    expect(emitThreeWorld({ faces: [FLOOR], holo: D, inline: true, hud: false })).toContain('const HOLO_ARENA = ');
    const bare = emitThreeWorld({ faces: [FLOOR], inline: true, hud: false });
    expect(bare).not.toContain('HOLO_ARENA'); expect(bare).not.toContain('stepHolo');
  });

  it('the minds\' duel is the same game for the same seed, and another seed may differ', () => {
    const D = holoArenaData({ game: MINI, players: 0, level: 'easy', seed: 4 });
    const a = exhibition(D, 12), b = exhibition(D, 12);
    expect(a.line.length).toBeGreaterThan(0);
    expect(a.line).toEqual(b.line);
  });
});
