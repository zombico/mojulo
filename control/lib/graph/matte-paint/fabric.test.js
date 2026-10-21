import { describe, it, expect } from 'vitest';
import { rockFabric } from './fabric.js';
import { emitThreeWorld } from '../scene/scene-three.js';

// ROCK FABRIC: the rock's own 3D structure as world planes, from its pattern; and the page's channel that draws it.
const sun = [0, -0.6, 0.8];
const len = (v) => Math.hypot(...v);
const angle = (a, b) => (Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180) / Math.PI;

describe('a rock\'s fabric', () => {
  it('granite (blocky): two vertical sets at right angles along the strike, each with its minor joints', () => {
    const F = rockFabric({ joints: { pattern: 'blocky', strike: 30, spacing: 3, cell: [1, 0.8] }, sun });
    expect(F.sets).toHaveLength(4);
    const [a, b, c] = F.sets;
    expect(a.n[2]).toBe(0); expect(b.n[2]).toBe(0);
    expect(angle(a.n, b.n)).toBeCloseTo(90, 1);
    expect(angle(a.n, [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6), 0])).toBeLessThan(0.5);   // (normals kept to 1e-4; acos near 1 magnifies it)
    expect([a.s, b.s]).toEqual([3, 2.4]);
    expect(c.n).toEqual(a.n); expect(c.s).toBeCloseTo(1, 3); expect(c.hold).toBeLessThan(a.hold);
  });

  it('basalt (columnar): three vertical sets sixty degrees apart; slate (slabby): a dipping cleavage', () => {
    const col = rockFabric({ joints: { pattern: 'columnar', strike: 0, spacing: 1 }, sun });
    expect(col.sets.slice(0, 3).map((s) => Math.round(angle(col.sets[0].n, s.n)))).toEqual([0, 60, 120]);
    const slab = rockFabric({ joints: { pattern: 'slabby', strike: 0, spacing: 1, dip: 50 }, sun });
    expect(Math.round(angle(slab.sets[0].n, [0, 0, 1]))).toBe(50);
  });

  it('the rock\'s own pattern when no landform laid one, and beds when the land has strata', () => {
    expect(rockFabric({ rock: 'basalt', sun }).sets.length).toBe(6);
    const F = rockFabric({ rock: 'granite', sun, strata: { layers: [{ b: 0, t: 2, hard: true }, { b: 2, t: 1.5, hard: false }], tanD: 0 } });
    expect(F.beds).toMatchObject({ b: [0, 2], t: [2, 1.5], hard: [1, 0] });
    expect(rockFabric({ rock: 'granite', sun }).beds).toBeUndefined();
  });

  it('every normal is a unit, and the far edge of the detail is where the widest groove first reads', () => {
    const F = rockFabric({ joints: { pattern: 'blocky', strike: 10, spacing: 3.2 }, sun });
    for (const s of F.sets) expect(len(s.n)).toBeCloseTo(1, 3);
    expect(F.maxFoot).toBeCloseTo(Math.max(...F.sets.map((s) => s.w)) / F.px, 3);
    expect(() => rockFabric({ rock: 'granite' })).toThrow(/sun/);
  });
});

describe('a rock\'s skin', () => {
  it('is the rock\'s own by its pattern, framed along its fabric, and absent unless asked', () => {
    expect(rockFabric({ joints: { pattern: 'blocky', strike: 30, spacing: 3 }, sun }).skin).toBeUndefined();
    const S = rockFabric({ joints: { pattern: 'blocky', strike: 30, spacing: 3 }, sun, skin: true }).skin;
    expect(S.id).toBe('sculpted');
    expect(angle(S.frame[0], [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6), 0])).toBeLessThan(0.5);
    expect(S.frame[2]).toEqual([0, 0, 1]);
    expect(rockFabric({ rock: 'basalt', sun, skin: true }).skin.id).toBe('fluted');
    expect(rockFabric({ rock: 'granite', sun, skin: true, strata: { layers: [{ b: 0, t: 1, hard: true }], tanD: 0 } }).skin.id).toBe('bedded');
    expect(rockFabric({ rock: 'granite', sun, skin: 'slabs' }).skin.id).toBe('slabs');
    expect(() => rockFabric({ rock: 'granite', sun, skin: 'moss' })).toThrow(/skin is true/);
  });
  it('reads from farther than a groove: the sphere grows to the chunks', () => {
    const F = rockFabric({ rock: 'granite', sun, skin: true }), G = rockFabric({ rock: 'granite', sun });
    expect(F.maxFoot).toBeGreaterThan(G.maxFoot);
  });
});

describe('a rock formation', () => {
  it('is named on skin, carries the landform\'s strike, takes the boulders, and is absent unless named', () => {
    const J = { pattern: 'blocky', strike: 30, spacing: 3, cell: [1, 0.8] };
    const F = rockFabric({ joints: J, sun, skin: 'limestone' });
    expect(F.formation.id).toBe('limestone');
    expect(F.skin).toBeUndefined();
    expect(angle(F.formation.joints[0].slice(0, 3), [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6), 0])).toBeLessThan(0.5);
    expect(F.groups).toContain('isekai:rock');
    expect(rockFabric({ joints: J, sun }).formation).toBeUndefined();
    expect(rockFabric({ joints: J, sun }).groups).not.toContain('isekai:rock');
    expect(rockFabric({ joints: J, sun, skin: 'sculpted' }).formation).toBeUndefined();
  });
  it('hangs green over its ledges only when it grows it and the land has a grass to give', () => {
    const J = { pattern: 'blocky', strike: 0, spacing: 3 };
    expect(rockFabric({ joints: J, sun, skin: 'flagstone', rockColour: '#808080', green: '#507030' }).formation.colour.greenRgb).toHaveLength(3);
    expect(rockFabric({ joints: J, sun, skin: 'flagstone' }).formation.colour.greenRgb).toBeUndefined();
    expect(rockFabric({ joints: J, sun, skin: 'limestone', rockColour: '#808080', green: '#507030' }).formation.colour.greenRgb).toBeUndefined();
  });
});

describe('the page\'s fabric channel', () => {
  const face = { corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], fill: '#808080', group: 'isekai:cliff' };
  it('is emitted with a fabric and not one byte without', () => {
    const plain = emitThreeWorld({ faces: [face] }), withF = emitThreeWorld({ faces: [face], fabric: rockFabric({ rock: 'granite', sun }) });
    expect(plain).not.toMatch(/rock fabric/);
    expect(withF).toMatch(/rock fabric/);
    expect(withF).toMatch(/uFabMaxFoot/);
    expect(emitThreeWorld({ faces: [face], fabric: { groups: [], sets: [] } })).toBe(plain);
    expect(withF).not.toMatch(/skinH/);
    expect(emitThreeWorld({ faces: [face], fabric: rockFabric({ rock: 'granite', sun, skin: true }) })).toMatch(/skinH/);
    const form = emitThreeWorld({ faces: [face], fabric: rockFabric({ rock: 'granite', sun, skin: 'sandstone' }) });
    expect(form).toMatch(/fmR/); expect(form).not.toMatch(/skinH/);
    expect(withF).not.toMatch(/fmR/);
    // a second rock: its own program (another cache key), the first's left as it is
    const two = { ...rockFabric({ rock: 'granite', sun, skin: 'limestone', groups: ['isekai:cliff'] }), also: rockFabric({ rock: 'granite', sun, skin: 'sculpted', groups: ['isekai:rock'], key: 'rock-fabric-rocks' }) };
    const page = emitThreeWorld({ faces: [face], fabric: two });
    expect(page).toMatch(/'rock-fabric'/); expect(page).toMatch(/"rock-fabric-rocks"/);
    expect(page).toMatch(/fmR/); expect(page).toMatch(/skinH/);
  });
});
