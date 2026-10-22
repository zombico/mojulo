// The isekai stage's polygon land (isekai.js, a stage's `shading`): the land drawn as the local meru's island is, by its
// functions; absent, the stage as it was.
import { describe, expect, it } from 'vitest';
import { assembleStageScene } from './stage.js';
import { assembleGeocubeScene } from './geocube.js';

const M = { kind: 'stage', kit: 'isekai-meadow' };
const LAND = new Set(['isekai:cliff', 'isekai:rock', 'isekai:ground', 'isekai:scree', 'isekai:trail']);
const GRASS = new Set(['isekai:grass', 'isekai:lip', 'isekai:hat']);
const plain = assembleStageScene(M), shaded = assembleStageScene({ ...M, shading: true });

describe('the polygon land', () => {
  it('absent or false, the stage is as it was', () => {
    expect(JSON.stringify(assembleStageScene({ ...M, shading: false }))).toBe(JSON.stringify(plain));
    expect(plain.faces.some((f) => /^isekai:.*:cliff-/.test(f.texture || ''))).toBe(true);
  });

  it('draws the land untiled, the rock flat per facet, and no grass on it; the trees as before', () => {
    const land = shaded.faces.filter((f) => LAND.has(f.group));
    expect(land.length).toBeGreaterThan(0);
    expect(land.every((f) => f.texture === undefined)).toBe(true);
    const rock = land.filter((f) => f.group === 'isekai:cliff' || f.group === 'isekai:rock');
    expect(rock.length).toBeGreaterThan(0);
    // (baked once per facet; the land's rules then move each corner, crease and ridge)
    expect(rock.every((f) => f.aoFlat)).toBe(true);
    const flat = assembleStageScene({ ...M, shading: { crevice: 0, ridge: 0 } }).faces.filter((f) => f.group === 'isekai:cliff');
    expect(flat.every((f) => f.cornerFills.every((c) => c === f.fill))).toBe(true);
    expect(shaded.faces.some((f) => GRASS.has(f.group))).toBe(false);
    expect(assembleStageScene({ ...M, shading: true, wind: true }).liveGrass).toBeUndefined();
    const crowns = (P) => P.faces.filter((f) => f.group === 'isekai:crown').length;
    expect(crowns(shaded)).toBe(crowns(plain));
    expect(shaded.fabric).toBeUndefined();
    expect(() => assembleStageScene({ ...M, shading: { glow: 1 } })).toThrow(/shading/);
  });

  it('a gritty land breaks its rock and strews stones, and draws its rock\'s formation near the eye', () => {
    const G = assembleStageScene({ ...M, shading: { grit: 0.7, skin: 'limestone' } });
    const rocks = (P) => P.faces.filter((f) => f.group === 'isekai:rock').length;
    expect(rocks(G)).toBeGreaterThan(rocks(shaded));
    expect(G.fabric.formation.id).toBe('limestone');
    expect(G.fabric.groups).toEqual(['isekai:cliff', 'isekai:rock']);
    expect(JSON.stringify(assembleStageScene({ ...M, shading: { grit: 0.7, skin: 'limestone' } }))).toBe(JSON.stringify(G));
  });

  it('`facet` draws the rock toward planes on its own faces, what stands on the land unmoved; `valley` darkens the land', () => {
    const F = assembleStageScene({ ...M, shading: { facet: 4 } }), key = (P, g) => P.faces.filter((f) => f.group === g).map((f) => JSON.stringify(f.corners)).sort().join('|');
    expect(key(F, 'isekai:cliff')).not.toBe(key(shaded, 'isekai:cliff'));
    // (on the faces' own heights: what is placed on the land, the trees, stands where it stood)
    expect(key(F, 'isekai:crown')).toBe(key(shaded, 'isekai:crown'));
    const V = assembleStageScene({ ...M, shading: { valley: 0.7 } }), sum = (P) => P.faces.filter((f) => f.group === 'isekai:ground').reduce((a, f) => a + parseInt(f.fill.slice(1, 3), 16), 0);
    expect(sum(V)).toBeLessThan(sum(shaded));
  });

  it('a geocube\'s town stands on its land drawn as its island\'s', () => {
    // (a cube with no biocube of its own: its street's land grows nothing, as its island's)
    const T = assembleGeocubeScene({ kind: 'geocube', cube: 'island-noon', show: 'town', walk: false }, {}, assembleStageScene);
    expect(T.faces.some((f) => GRASS.has(f.group))).toBe(false);
    expect(T.faces.filter((f) => f.group === 'isekai:cliff').every((f) => f.texture === undefined)).toBe(true);
    expect(T.cameras.map((c) => c.name).slice(0, 3)).toEqual(['house', 'street', 'trail']);
  });
});
