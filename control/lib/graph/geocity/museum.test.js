// THE CITY'S MUSEUM (museum.js, scene.js `museum`; gameworld/levels.js geocityEnds): an evoked block across a street from
// where the walk starts built as one, its door a level's door into its own building, three wings of galleries. The
// concepts: it takes a built block that is not the walk's own; its front stands on its door's street, the door an anchor
// facing it; a city with none asked is built as it was; and a game's district pairs its door with the museum's inside,
// a level of its own, looked round and left by its door.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { pickMuseum, MUSEUM } from './museum.js';
import { assembleGeocityScene } from './scene.js';
import { gameStages, stageEnds, gameLinks, LOOKED_ROUND } from '../gameworld/levels.js';

const GEOCITY = { metro: { from: 'lakeshore', rings: { core: 160, frame: 330 } }, extent: [900, 800], water: { sides: ['s'], depth: 100 }, core: [0.5, 0.45], evoke: 'neighbourhood', at: 'core' };
const city = (g) => ({ kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, geocity: g });
const hash = (P) => createHash('sha256').update(JSON.stringify(P.faces)).digest('hex');

describe('the city\'s museum', () => {
  it('takes a built block wide enough beside the one the walk starts at; none in a district of one block', () => {
    const b = (id, rect, kind = 'midrise') => ({ id, rect, kind });
    const blocks = [b('A', [0, 0, 40, 40]), b('B', [50, 0, 90, 40], 'park'), b('C', [0, 50, 30, 70]), b('D', [100, 0, 150, 45]), b('E', [200, 200, 260, 260])];
    // (A is nearest the middle of the evoked: the walk's; B a park, C too narrow, so D)
    expect(pickMuseum(blocks, ['A', 'B', 'C', 'D'])?.id).toBe('D');
    expect(pickMuseum(blocks, ['A'])).toBe(null);
    expect(MUSEUM.hosts).not.toContain('park');
  });

  const P = assembleGeocityScene(city({ ...GEOCITY, museum: { name: 'The Museum' } }));
  const A = (P.anchors ?? []).find((a) => a.kind === 'museum');

  it('builds it on its block, its door an anchor on its front facing its street', () => {
    expect(A).toBeTruthy();
    expect(A.name).toBe('The Museum');
    expect(Math.hypot(A.N[0], A.N[1])).toBeCloseTo(1, 6);
    expect(P.faces.some((f) => f.group === 'geocity:museum')).toBe(true);
    expect(P.faces.some((f) => f.group === 'geocity:door')).toBe(true);
    // (no box of its own stands on the portico before its door)
    const zone = [A.at[0] + A.N[0] * 0.9, A.at[1] + A.N[1] * 0.9, A.floor + 1];
    expect((P.colliders ?? []).some((c) => zone.every((v, i) => v > c.min[i] && v < c.max[i]))).toBe(false);
  }, 120_000);

  it('builds a city that asks for none as it was', () => {
    expect(hash(assembleGeocityScene(city({ ...GEOCITY, museum: false })))).toBe(hash(assembleGeocityScene(city(GEOCITY))));
  }, 120_000);

  it('pairs a district\'s museum door with its inside, a level of its own looked round and left by its door', () => {
    const WORLD = { id: 'museum-test', name: 'Museum test', seed: 2, mode: 'autonomous', style: { kit: 'trail-valley', geocube: { from: 'valley-morning' } },
      levels: { district: { name: 'The district', seed: 2, geocity: { ...GEOCITY, museum: { exhibits: [{ title: 'One', pieces: ['sk_one'] }] } } } } };
    const S = gameStages(WORLD), E = stageEnds(S[0].manifest), ins = S.filter((s) => s.section === 'interior');
    expect(E.doors.map((d) => d.id)).toEqual(['museum']);
    expect(ins).toHaveLength(1);
    expect(ins[0].manifest.program.use).toBe('museum');
    expect(ins[0].manifest.level).toEqual({ door: 'out', exit: false, mechanics: [LOOKED_ROUND] });
    expect(ins[0].manifest.exhibits[0].pieces).toEqual(['sk_one']);
    expect(gameLinks(S, S.map((_, i) => `r${i}`))).toEqual([{ from: { ref: 'r0', door: 'museum' }, to: { ref: `r${S.indexOf(ins[0])}`, door: 'out' } }]);
  }, 180_000);
});
