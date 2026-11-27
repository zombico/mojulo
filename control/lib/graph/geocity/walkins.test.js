// THE CITY'S WALK-INS (walkins.js, scene.js `walkinFront`, gameworld/levels.js walkinDoor): civic buildings beside the
// museum's, each walked into on a page of its own. The concepts: each takes a block of its own after the walk's and the
// museum's; its front is built and its door is an anchor facing its street; a city that enters none is built as it was;
// its inside is its program in its own look, looked round and left by its door; an arcade's floor keeps the world's
// inside games.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { pickWalkins, WALKINS, WALKIN_USES } from './walkins.js';
import { assembleGeocityScene } from './scene.js';
import { gameStages, stageEnds, gameLinks, LOOKED_ROUND } from '../gameworld/levels.js';
import { ROOMS_KEPT } from '../gameworld/minigames.js';
import { readGeocity } from './metro.js';

const GEOCITY = { metro: { from: 'lakeshore', rings: { core: 160, frame: 330 } }, extent: [900, 800], water: { sides: ['s'], depth: 100 }, core: [0.5, 0.45], evoke: 'neighbourhood', at: 'core' };
const city = (g) => ({ kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, geocity: g });
const hash = (P) => createHash('sha256').update(JSON.stringify(P.faces)).digest('hex');

describe('the city\'s walk-ins', () => {
  it('each takes a block of its own, after the walk\'s and those taken, wide enough for its front', () => {
    const b = (id, rect, kind = 'midrise') => ({ id, rect, kind });
    const blocks = [b('A', [0, 0, 40, 40]), b('M', [50, 0, 90, 40]), b('N', [0, 50, 22, 90]), b('P', [100, 0, 140, 45]), b('Q', [150, 0, 190, 40])];
    const got = pickWalkins(blocks, ['A', 'M', 'N', 'P', 'Q'], ['arcade', 'library'], [blocks[1]]);
    expect(got.map((x) => x.use)).toEqual(['arcade', 'library']);
    const ids = got.map((x) => x.block.id);
    expect(new Set(ids).size).toBe(2);
    // (the walk's own: the block nearest the middle of those shown; and the museum's, taken)
    const all = blocks.filter((x) => 'AMNPQ'.includes(x.id)), mid = [(Math.min(...all.map((x) => x.rect[0])) + Math.max(...all.map((x) => x.rect[2]))) / 2, (Math.min(...all.map((x) => x.rect[1])) + Math.max(...all.map((x) => x.rect[3]))) / 2];
    const walk = all.slice().sort((p, q) => Math.hypot((p.rect[0] + p.rect[2]) / 2 - mid[0], (p.rect[1] + p.rect[3]) / 2 - mid[1]) - Math.hypot((q.rect[0] + q.rect[2]) / 2 - mid[0], (q.rect[1] + q.rect[3]) / 2 - mid[1]))[0];
    expect(ids).not.toContain(walk.id);
    expect(ids).not.toContain('M');
    // (N is narrower than any walk-in's front)
    expect(ids).not.toContain('N');
    expect(() => readGeocity({ ...GEOCITY, enter: ['casino'] })).toThrow(/enter is a list/);
  });

  const P = assembleGeocityScene(city({ ...GEOCITY, enter: ['arcade', 'library'] }));
  const A = (P.anchors ?? []).filter((a) => a.kind === 'walkin');

  it('builds each front on its block, its door an anchor facing its street', () => {
    expect(A.map((a) => a.use).sort()).toEqual(['arcade', 'library']);
    for (const a of A) { expect(Math.hypot(a.N[0], a.N[1])).toBeCloseTo(1, 6); expect(a.name).toBe(WALKINS[a.use].name); }
    expect(P.faces.some((f) => f.group === 'geocity:sign')).toBe(true);
  }, 120_000);

  it('builds a city that enters none as it was', () => {
    expect(hash(assembleGeocityScene(city({ ...GEOCITY, enter: [] })))).toBe(hash(assembleGeocityScene(city(GEOCITY))));
  }, 120_000);

  it('pairs each door with its inside: its program in its own look, never won, left by its door; an arcade keeps the games', () => {
    expect(ROOMS_KEPT[WALKINS.arcade.program]).toBeTruthy();
    const WORLD = { id: 'walkin-test', name: 'Walk-in test', seed: 2, mode: 'autonomous', style: { kit: 'trail-valley', geocube: { from: 'valley-morning' } },
      levels: { district: { name: 'The district', seed: 2, geocity: { ...GEOCITY, enter: ['arcade'] } } } };
    const S = gameStages(WORLD), E = stageEnds(S[0].manifest), ins = S.filter((s) => s.section === 'interior');
    expect(E.doors.map((d) => d.id)).toEqual(['arcade']);
    expect(ins[0].manifest).toMatchObject({ kit: WALKINS.arcade.kit, compose: WALKINS.arcade.compose, program: { use: WALKINS.arcade.program }, level: { door: 'out', exit: false, mechanics: [LOOKED_ROUND] } });
    expect(gameLinks(S, S.map((_, i) => `r${i}`))).toEqual([{ from: { ref: 'r0', door: 'arcade' }, to: { ref: 'r1', door: 'out' } }]);
    expect(WALKIN_USES.every((u) => WALKINS[u].program && WALKINS[u].kit)).toBe(true);
  }, 180_000);
});
