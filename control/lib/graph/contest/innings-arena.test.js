// The field arena: the venue as a stage recipe carrying the bat-and-ball game, the field in the stage's frame (a diamond
// in front of the plate, an oval round the wicket), the page's data and the modules the page inlines (one script block
// that parses, no name declared twice).
import { describe, it, expect } from 'vitest';
import { readInnings, inningsField, inningsManifest, inningsArenaData, inningsSportDials, INNINGS_PAGE_MODULES } from './innings-arena.js';
import { graphSource } from './match-arena.js';
import { INNINGS_SPORT_IDS } from './sports.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const FLOOR = { corners: [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]], fill: '#888' };

describe('reading a bat-and-ball game', () => {
  it('teaches the shape, fills the defaults; innings for both, overs for a game of overs only', () => {
    expect(INNINGS_SPORT_IDS).toEqual(['baseball', 'cricket']);
    expect(() => readInnings({ sport: 'tennis' })).toThrow(/sport 'tennis' is one of baseball, cricket/);
    expect(() => readInnings({ players: 3 })).toThrow(/players is 0 \(an exhibition\)/);
    expect(() => readInnings({ register: 'arcade' })).toThrow(/register is one of realistic, action/);
    expect(() => readInnings({ innings: 12 })).toThrow(/innings is 1 to 9/);
    expect(() => readInnings({ overs: 2 })).toThrow(/overs belong to a game of overs; baseball counts its innings by outs/);
    expect(() => readInnings({ sets: 2 })).toThrow(/a field has no 'sets'/);
    expect(readInnings({})).toMatchObject({ sport: 'baseball', players: 1, register: 'action', level: 'regular', seed: 1, kit: 'island-plaza', crowd: { rows: 3, fill: 0.8 } });
    expect(readInnings({ sport: 'cricket', overs: 2, crowd: false })).toMatchObject({ sport: 'cricket', overs: 2, crowd: false });
    for (const id of INNINGS_SPORT_IDS) { const d = inningsSportDials(id); expect(d.spec).toBeUndefined(); expect(JSON.parse(JSON.stringify(d))).toEqual(d); }
  });
});

describe('the field and the venue', () => {
  it('a diamond\'s room starts behind the plate and runs past its fence; an oval\'s stands round the wicket', () => {
    const D = inningsField(readInnings({ sport: 'baseball' })), O = inningsField(readInnings({ sport: 'cricket' }));
    expect(D.fair).toBeGreaterThan(0); expect(D.fenceHeight).toBeGreaterThan(0);
    expect(D.originY).toBeLessThan(D.room.d / 2); expect(D.room.d).toBeGreaterThan(D.originY + D.fence);
    expect(O.fair).toBeNull(); expect(O.originY).toBeCloseTo(O.room.d / 2, 6); expect(O.room.w).toBeGreaterThan(2 * O.fence);
  });
  it('the venue is a stage: one open room, the stands beyond the field, the camera behind the batter, the innings key; a venue word stands it in a stadium', () => {
    const m = inningsManifest({ sport: 'cricket', players: 2, seed: 7 });
    expect(m).toMatchObject({ kind: 'stage', title: 'cricket · two players', innings: { sport: 'cricket', players: 2, seed: 7 } });
    expect(m.rooms).toHaveLength(1); expect(m.rooms[0].open).toEqual(['-y']);
    expect(m.camera.worldFraming.cameraPosition[1]).toBeLessThan(m.camera.worldFraming.lookAt[1]);
    expect(inningsManifest({ crowd: false }).stands).toBeUndefined();
    expect(inningsManifest({ venue: 'football' })).toMatchObject({ kind: 'stadium', preset: 'football' });
  });
  it('the page\'s data and the block it inlines: every module import-free once stripped, one script that parses, no name declared twice', () => {
    const D = inningsArenaData({ sport: 'cricket', overs: 1 });
    expect(D.C.shape).toBe('innings'); expect(D.C.innings).toMatchObject({ overs: 1, balls: 6, runs: 'runs' }); expect(D.sport.id).toBe('cricket');
    expect(D.wire).toMatchObject({ ready: 'game-ready', outcome: 'game-outcome' });
    const parts = INNINGS_PAGE_MODULES.map(graphSource);
    for (const [i, src] of parts.entries()) { expect(src, INNINGS_PAGE_MODULES[i]).not.toMatch(/^import /m); expect(src, INNINGS_PAGE_MODULES[i]).not.toMatch(/^export /m); }
    const block = parts.join('\n');
    const names = [...block.matchAll(/^(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
    const page = emitThreeWorld({ faces: [FLOOR], innings: D, inline: true, hud: false });
    expect(page).toContain('const INNINGS_ARENA = '); expect(page).toContain('stepInnings = stepInningsArena');
    const bare = emitThreeWorld({ faces: [FLOOR], inline: true, hud: false });
    expect(bare).not.toContain('INNINGS_ARENA'); expect(bare).not.toContain('stepInnings');
  });
});
