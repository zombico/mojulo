// Thickets (thickets.js): bushes and shrubs composed in sections, each a tree kind with the trunk taken away; a kind
// blocks a walker or is walked through; an arranged clump's roles cast as bushes.
import { describe, expect, it } from 'vitest';
import { readBush, placeThickets, BUSH_DEFAULTS, SOFT_BRUSH, SECTION_DEFAULTS } from './thickets.js';
import { readBiocube, withFlora } from './biocube.js';
import { ISEKAI_STYLES } from './isekai.js';
import { outTrailSite } from './out-trail.js';
import { assembleStageScene } from './stage.js';
import { harmonyRamps } from './flora-colours.js';

const site = outTrailSite(ISEKAI_STYLES['isekai-meadow'], {}, 1), edge = (x, y) => site.trailDist(x, y) - site.halfWAt(y);

describe('a bush kind and its sections', () => {
  it('is a tree kind with the trunk taken away: low, many thin stems, fine limbs, a wide crown', () => {
    const b = readBush('spray');
    expect(b).toMatchObject({ form: 'spray', walk: 'block' });
    expect(b.stems).toBeGreaterThan(1);
    expect(b.trunk).toBeLessThan(0.3);
    expect(b.branch).toBeLessThan(1);
    expect(b.height[1]).toBeLessThan(3);
    expect(readBush({ form: 'tuft', walk: 'through', height: [0.4, 0.7] })).toMatchObject({ walk: 'through', height: [0.4, 0.7], stems: BUSH_DEFAULTS.stems });
  });

  it('lays its sections off the trail, clear of each other: one kind each, a blocking bush a collider, a walked one none', () => {
    const B = { kinds: [{ form: 'spray', walk: 'block' }, { form: 'tuft', walk: 'through', height: [0.5, 0.9] }] };
    const T = placeThickets(B, site, {}, 1);
    const S = [...new Set(T.items.map((m) => m.section))];
    expect(S.length).toBeGreaterThan(1);
    expect(S.length).toBeLessThanOrEqual(SECTION_DEFAULTS.count);
    expect(T.items.every((m) => edge(m.x, m.y) >= SECTION_DEFAULTS.band[0] * 0.6)).toBe(true);
    for (const s of S) expect(new Set(T.items.filter((m) => m.section === s).map((m) => m.bushIx)).size).toBe(1);
    expect(T.colliders.length).toBe(T.items.filter((m) => !m.soft && m.h > 0.45).length);
    expect(T.items.some((m) => m.soft) && T.items.some((m) => !m.soft)).toBe(true);
    expect(JSON.stringify(placeThickets(B, site, {}, 1))).toBe(JSON.stringify(T));
  });

  it('reads its bushes, refuses what is not one, and leaves a preset as it was', () => {
    expect('bushes' in readBiocube('forest').flora).toBe(false);
    expect(readBiocube({ from: 'meadow', flora: { bushes: { kinds: ['spray'] } } }).flora.bushes.kinds).toEqual(['spray']);
    expect(() => readBiocube({ from: 'meadow', flora: { bushes: { kinds: [{ form: 'spray', walk: 'sometimes' }] } } })).toThrow(/walk is 'block'/);
    expect(() => readBiocube({ from: 'meadow', flora: { bushes: { kinds: ['hedge'] } } })).toThrow(/leaf form/);
    expect(() => readBiocube({ from: 'forest', flora: { trees: { clump: { hikae: { bush: 0 } } } } })).toThrow(/name the bushes/);
    expect(withFlora(ISEKAI_STYLES['isekai-meadow'], readBiocube({ from: 'meadow', flora: { bushes: { kinds: ['spray'] } } })).thickets.kinds).toEqual(['spray']);
  });
});

describe('bushes on a stage', () => {
  const bushes = { kinds: [{ form: 'spray', walk: 'block' }, { form: 'tuft', walk: 'through', height: [0.5, 0.9] }], sections: { count: 4 } };
  const trees = { kinds: ['tuft', 'spray'], clump: { shin: 0, soe: 1, hikae: { bush: 0 }, filler: { bush: 1 } }, harmony: 'value' };

  it('draws its sections and a clump\'s bush roles: the walked-through in soft groups, the blocking as colliders; the grass off their feet', () => {
    const P = assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', trail: {}, shading: { grit: 0.7 }, biocube: { from: 'forest', flora: { trees, bushes } } }, {});
    const groups = new Set(P.faces.map((f) => f.group));
    for (const g of Object.values(SOFT_BRUSH)) { expect(groups.has(g)).toBe(true); expect(P.soft).toContain(g); }
    expect(P.anchors.filter((a) => a.kind === 'thicket').length).toBeGreaterThan(0);
    expect(P.colliders.some((c) => /^thicket:/.test(c.of))).toBe(true);
    // (a clump's anchor a bush now: a blocking one where the hikae stood, its crown in the harmony's anchor colour)
    expect(P.colliders.some((c) => /^clump:\d+:hikae$/.test(c.of))).toBe(true);
    const hikae = harmonyRamps(ISEKAI_STYLES['isekai-meadow'].palette, 'value')['role-hikae'].map((c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''));
    expect(P.faces.some((f) => f.group === 'isekai:core' && hikae.includes(f.fill))).toBe(true);
    // (no working key leaves the stage)
    expect(P.faces.some((f) => f._soft !== undefined || f._ramp !== undefined || f._rind !== undefined || f._lobe !== undefined)).toBe(false);
    // (no grass under a bush: the live carpet's mask clear at each one's foot)
    const L = P.liveGrass, m = Buffer.from(L.grid.m.__b64, 'base64'), CX = L.grid.nx - 1, A = P.anchors.find((a) => a.kind === 'thicket');
    const at = (x, y) => m[Math.floor((y - L.grid.y0) / L.grid.cell) * CX + Math.floor((x - L.grid.x0) / L.grid.cell)];
    expect(at(A.at[0], A.at[1]) & 1).toBe(0);
  }, 120000);

  it('draws on a quiet land too: its lobes the crown\'s masses, no chips', () => {
    const P = assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', trail: {}, shading: true, biocube: { from: 'meadow', flora: { bushes } } }, {});
    expect(P.faces.some((f) => f.group === SOFT_BRUSH.core)).toBe(true);
    expect(P.faces.some((f) => /chips/.test(f.group))).toBe(false);
  }, 120000);
});
