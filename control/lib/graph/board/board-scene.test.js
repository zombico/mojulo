import { describe, it, expect } from 'vitest';
import { assembleBoardScene } from './board-scene.js';
import { boardCentre } from './board-kernel.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const units = [{ id: 'a', side: 'party', at: 'B2' }, { id: 'b', side: 'foe', at: 'E5' }];

describe('the board world kind', () => {
  it('is a world kind: a diorama, its board for the page, a camera at the tactical view\'s rest, and no walking', async () => {
    const { payload, kind } = await resolveWorldScene({ manifest: { kind: 'board', board: { seed: 'fft', cols: 6, rows: 6 }, units, cursor: 'C3' }, title: null });
    expect(kind).toBe('board');
    expect(payload.faces.length).toBeGreaterThan(36);
    expect(payload.walk).toBeFalsy();
    expect(payload.board.units).toEqual(units);
    expect(payload.board.cursor).toBe(2 * 6 + 2);
    expect(Object.keys(payload.board.colours)).toEqual(['party', 'foe']);
    const f = payload.cameras[0].worldFraming;
    expect(f.lookAt.slice(0, 2)).toEqual([6, 6]);
    expect(f.cameraPosition[2]).toBeGreaterThan(f.lookAt[2]);
  });

  it('puts the board on the page only when the world has one: its block, its frame step, its probe', () => {
    const P = assembleBoardScene({ board: { seed: 'fft', cols: 5, rows: 5 }, units });
    const html = emitThreeWorld(P), bare = emitThreeWorld({ ...P, board: null });
    for (const k of ['stepBoard = (', 'let stepBoard', ' stepBoard(t);', '__mojBoard']) {
      expect(html).toContain(k);
      expect(bare).not.toContain(k);
    }
    expect(emitThreeWorld({ ...P, capture: true })).not.toContain('stepBoard');
  });

  it('shows a room from above as a dollhouse: no ceiling, its walls cut at the waist, no haze, the overlay held to its floor', () => {
    const P = assembleBoardScene({ board: { side: 'inside', from: 'stage', stage: { rooms: [{ id: 'a', x: 0, y: 0, w: 8, d: 8, h: 6 }] } } });
    expect(P.faces.some((f) => /:ceiling$/.test(f.group))).toBe(false);
    expect(P.faces.every((f) => Math.min(...f.corners.map((c) => c[2])) < 1.5)).toBe(true);
    expect(P.haze).toBeUndefined();
    expect(P.board.clip).toEqual([[0.25, 0.25, 7.75, 7.75]]);
    const B = P.board.B;
    for (let i = 0; i < B.spots.length; i++) {
      const [x, y] = boardCentre(B, i);
      expect(x > 0.25 && x < 7.75 && y > 0.25 && y < 7.75).toBe(true);
    }
  });

  it('carries a battle to the page: its rules and fielded units, the player\'s sides (the party, unless told)', () => {
    const battle = { party: [{ id: 'ayla', class: 'fighter', at: 'A1' }], foes: [{ id: 'g', foe: 'goblin', at: 'D4' }] };
    const P = assembleBoardScene({ board: { seed: 'fft', cols: 5, rows: 5 }, battle });
    expect(P.board.battle.players).toEqual(['party']);
    expect(P.board.battle.units.map((u) => [u.id, u.side])).toEqual([['ayla', 'party'], ['g', 'foe']]);
    expect(Object.keys(P.board.battle.cfg.skills)).toContain('power-strike');
    expect(P.board.colours).toEqual({ party: expect.any(String), foe: expect.any(String) });
    expect(assembleBoardScene({ board: { seed: 'fft', cols: 5, rows: 5 }, battle: { ...battle, players: [] } }).board.battle.players).toEqual([]);
    expect(() => assembleBoardScene({ board: { seed: 'fft', cols: 5, rows: 5 }, battle, units })).toThrow(/units or battle/);
    expect(() => assembleBoardScene({ board: { seed: 'fft', cols: 5, rows: 5 }, battle: { ...battle, players: 'party' } })).toThrow(/battle.players are the sides the player moves/);
  });

  it('puts a party with no spots on its deploy spots, in order, and says which the player may place', () => {
    const battle = { party: [{ id: 'a', class: 'fighter' }, { id: 'b', class: 'mage', at: 'B1' }, { id: 'c', class: 'cleric' }], deploy: ['A1:C1'], foes: [{ id: 'g', foe: 'goblin', at: 'D4' }] };
    const P = assembleBoardScene({ board: { seed: 'fft', cols: 5, rows: 5 }, battle });
    expect(P.board.battle.units.filter((u) => u.side === 'party').map((u) => [u.id, u.at])).toEqual([['a', 'A1'], ['b', 'B1'], ['c', 'C1']]);
    expect(P.board.battle.placed).toEqual(['a', 'c']);
    expect(P.board.battle.deploy).toEqual([0, 1, 2]);
    expect(() => assembleBoardScene({ board: { seed: 'fft', cols: 5, rows: 5 }, battle: { ...battle, deploy: ['A1'] } })).toThrow(/spots for more of the party than fit/);
  });

  it('refuses what it cannot make, saying why', () => {
    expect(() => assembleBoardScene({ size: 3 })).toThrow(/'size' is not a setting of the board kind/);
    expect(() => assembleBoardScene({ camera: { spin: true } })).toThrow(/camera.spin is not a camera setting/);
    expect(() => assembleBoardScene({ camera: { yaw: 5 } })).toThrow(/camera.yaw is 0 to 3/);
    expect(() => assembleBoardScene({ board: { seed: 'fft', holes: ['B2'] }, units })).toThrow(/stands at B2, which is not a spot/);
  });
});
