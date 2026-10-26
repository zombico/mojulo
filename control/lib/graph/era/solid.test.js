// No flat building polygons (solid.js): a roof a closed slab, a doorway cut through its wall's depth, on when a recipe
// says `solid: true` (stamped at mint on a world that builds) or when the world is read in gen-7; absent, as it was.
import { describe, expect, it } from 'vitest';
import { slabOf, openEdges, buildsBuildings, stampSolid } from './solid.js';
import { designTown } from './out-town.js';
import { structureStyle, STRUCTURE_KITS } from './out-structures.js';
import { assembleStageScene } from './stage.js';

// a gable: two slopes meeting at the ridge, an overhang all round
const GABLE = [
  [[-1, -3, 2], [5, -3, 2], [5, 0, 4], [-1, 0, 4]],
  [[5, 3, 2], [-1, 3, 2], [-1, 0, 4], [5, 0, 4]],
];
const closed = (polys, T) => { const S = slabOf(polys, T); return openEdges([...polys, ...S.under, ...S.edges.map((e) => e.corners)]); };

describe('a slab from a covering', () => {
  it('a gable and a hip close: the underside a thickness down, a band down every free edge and none on the ridge', () => {
    expect(openEdges(GABLE)).toHaveLength(6);
    const S = slabOf(GABLE, 0.18);
    expect(S.under).toHaveLength(2);
    expect(S.edges).toHaveLength(6);   // two eaves, four verges: the ridge is shared
    expect(closed(GABLE, 0.18)).toEqual([]);
    expect(S.under[0].every((p, i) => p[2] === +(GABLE[0][GABLE[0].length - 1 - i][2] - 0.18).toFixed(3))).toBe(true);
    // each band faces level and out of its slope
    for (const e of S.edges) expect(e.out[2]).toBe(0);
    const hip = [[[0, 0, 0], [6, 0, 0], [4, 2, 1], [2, 2, 1]], [[6, 4, 0], [0, 4, 0], [2, 2, 1], [4, 2, 1]], [[0, 4, 0], [0, 0, 0], [2, 2, 1]], [[6, 0, 0], [6, 4, 0], [4, 2, 1]]];
    expect(closed(hip, 0.15)).toEqual([]);
    expect(() => slabOf(GABLE, 0)).toThrow(/T > 0/);
  });
});

describe('who is solid', () => {
  it('a new world that builds is stamped; one that says, or builds nothing, is left as it came', () => {
    expect(buildsBuildings({ kind: 'stage', town: {} })).toBe(true);
    expect(buildsBuildings({ kind: 'stage', trail: {} })).toBe(false);
    expect(buildsBuildings({ kind: 'geocube', show: 'town' })).toBe(true);
    expect(buildsBuildings({ kind: 'geocube', show: 'path' })).toBe(false);
    expect(stampSolid({ kind: 'stage', buildings: [{ use: 'dwelling' }] }).solid).toBe(true);
    expect(stampSolid({ kind: 'stage', town: {}, solid: false }).solid).toBe(false);
    const bare = { kind: 'stage', trail: {} };
    expect(stampSolid(bare)).toBe(bare);
  });
});

describe('a solid town', () => {
  const style = structureStyle(STRUCTURE_KITS[0], 1), rec = { branches: 0, levels: 0 };
  it('its houses\' pitched roofs close and its law says so; a town not asked is as it was, with no such law', () => {
    const plain = designTown(style, 1, rec), solid = designTown(style, 1, rec, { solid: true });
    expect(plain.laws.find((l) => l.law === 'solid')).toBeUndefined();
    expect(solid.laws.find((l) => l.law === 'solid')).toMatchObject({ ok: true, value: expect.stringMatching(/every pitched roof a closed slab/) });
    expect(JSON.stringify(designTown(style, 1, rec, { solid: false }))).toBe(JSON.stringify(plain));
    // more faces, all of them under the roofs: the walls are the walls they were
    const walls = (t) => t.lots.flatMap((l) => (l.design ? l.design.faces.filter((f) => f.part === 'wall' && !f.gable) : []));
    expect(walls(solid).length).toBeGreaterThanOrEqual(walls(plain).length);
    const roofs = (t) => t.lots.flatMap((l) => (l.design ? l.design.faces.filter((f) => f.part === 'roof' || f.part === 'edge') : []));
    expect(roofs(solid).length).toBeGreaterThan(roofs(plain).length);
  });
});

describe('a solid building on a stage', () => {
  it('its way out is cut through the wall and its roof is a closed slab; not asked, its shell is as it was', () => {
    const m = { kind: 'stage', kit: 'isekai-meadow', seed: 5, trail: { run: 14 }, buildings: [{ use: 'dwelling' }] };
    const plain = assembleStageScene(m, {}), solid = assembleStageScene(m, { solid: true });
    const of = (P, g) => P.faces.filter((f) => f.group === `building:${g}`);
    expect(of(solid, 'wall').length).toBe(of(plain, 'wall').length + 4 * (plain.anchors.filter((a) => a.kind === 'building').length));
    expect(openEdges(of(solid, 'roof').map((f) => f.corners))).toEqual([]);
    expect(openEdges(of(plain, 'roof').map((f) => f.corners)).length).toBeGreaterThan(0);
    // everything but the building's shell is the same
    const rest = (P) => JSON.stringify(P.faces.filter((f) => !String(f.group).startsWith('building:')));
    expect(rest(solid)).toBe(rest(plain));
  }, 60000);
});

describe('a solid world read: the recipe\'s word, or the era', () => {
  it('a geocube town asked solid, or read in gen-7, builds its houses solid; asked nothing at gen-6, as it was', async () => {
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const town = (extra = {}, opts = {}) => resolveWorldScene({ title: 't', manifest: { kind: 'geocube', cube: 'island-noon', show: 'town', seed: 3, ...extra } }, opts).then((r) => r.payload.faces.filter((f) => String(f.group).startsWith('town:')).length);
    const [plain, asked, gen7, refused] = [await town(), await town({ solid: true }), await town({}, { era: 'gen-7' }), await town({ solid: false })];
    expect(asked).toBeGreaterThan(plain);
    expect(gen7).toBe(asked);
    expect(refused).toBe(plain);
    await expect(town({ solid: 'yes' })).rejects.toThrow(/solid is true/);
  }, 120000);
});
