import { describe, it, expect } from 'vitest';
import { planRing, radiusAt, turnedInner, PLAN_FORMS, PLAN_DIALS } from './plan.js';
import { readStructure, validateStructures, CURVES } from './read.js';
import { growStructure, tierBreaks, riseScale, coarserPlan } from './grow.js';
import { structureFaces, PRESETS, PRESET_IDS } from './index.js';
import { FLAT_LIGHT } from '../polygonizer/vexar.js';

const area = (ring) => ring.reduce((a, p, i) => { const q = ring[(i + 1) % ring.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
// a preset chosen in code for each procedure the kernel has, not a hand list: the first with an echo, the first stepped
const firstPreset = (pred) => Object.keys(PRESETS).find((id) => pred(PRESETS[id]));
const ECHOED = firstPreset((p) => p.echo && p.echo.depth >= 1);
const STEPPED = firstPreset((p) => p.rise.stepped);

describe('the plan (mandala)', () => {
  it('turning the square: k turned n-gons union into an n·k-point star, notched at cos(π/n) / cos(π/n − π/nk)', () => {
    const ring = planRing({ form: 'turned', sides: 4, k: 2 });
    expect(ring).toHaveLength(16);
    const r = ring.map(([x, y]) => Math.hypot(x, y));
    for (let i = 0; i < 16; i += 1) expect(r[i]).toBeCloseTo(i % 2 ? turnedInner(4, 2) : 1, 5);
    expect(turnedInner(4, 2)).toBeCloseTo(Math.cos(Math.PI / 4) / Math.cos(Math.PI / 8), 12);
    // one square turned by nothing is the square: its notches are the edges' midpoints, at the apothem
    expect(turnedInner(4, 1)).toBeCloseTo(Math.SQRT1_2, 12);
  });

  it('every form is counter-clockwise, reaches the unit circle and is star-shaped about its centre', () => {
    for (const form of PLAN_FORMS) {
      const ring = planRing({ form });
      expect(area(ring), form).toBeGreaterThan(0);
      expect(Math.max(...ring.map(([x, y]) => Math.hypot(x, y))), form).toBeCloseTo(1, 6);
      // a fan from the centre never folds: each edge turns the same way seen from the origin
      ring.forEach((p, i) => { const q = ring[(i + 1) % ring.length]; expect(p[0] * q[1] - q[0] * p[1], `${form} edge ${i}`).toBeGreaterThan(-1e-9); });
    }
  });

  it('a square-born plan fronts the axes: its reach along +x is its apothem, along the diagonal its corner', () => {
    const sq = planRing('square');
    expect(radiusAt(sq, 0)).toBeCloseTo(Math.SQRT1_2, 6);
    expect(radiusAt(sq, Math.PI / 4)).toBeCloseTo(1, 6);
  });

  it('the offset plan is its own fractal: each depth cuts the middle bay again, and is coarsened one cut at a time', () => {
    const d1 = planRing({ form: 'offset', bays: 3, depth: 1 }), d2 = planRing({ form: 'offset', bays: 3, depth: 2 });
    expect(d2.length).toBeGreaterThan(d1.length);
    expect(coarserPlan({ form: 'offset', bays: 3, project: 0.1, depth: 2 })).toMatchObject({ depth: 1 });
    expect(coarserPlan({ form: 'offset', bays: 3, project: 0.1, depth: 1 })).toEqual({ form: 'square' });
  });

  it('refuses a word that does not read, naming the choices', () => {
    expect(() => planRing({ form: 'hexagon' })).toThrow(/one of square, circle, turned/);
    expect(() => planRing({ form: 'offset', bays: 4 })).toThrow(/odd number/);
    expect(() => planRing({ form: 'star', spikes: 5 })).toThrow(/dials are points, inner/);
    expect(Object.keys(PLAN_DIALS)).toEqual(PLAN_FORMS);
  });
});

describe('the rise', () => {
  it('r(f) = top + (1 − top)(1 − f^p): the cone is linear, the parabolic curve holds its width then closes', () => {
    const cone = { top: 0.2, power: CURVES.cone }, rekha = { top: 0.2, power: CURVES.rekha };
    expect(riseScale(cone, 0.5)).toBeCloseTo(0.6, 12);
    expect(riseScale(rekha, 0.5)).toBeCloseTo(0.2 + 0.8 * 0.75, 12);
    expect(riseScale(rekha, 0)).toBe(1);
    expect(riseScale(rekha, 1)).toBeCloseTo(0.2, 12);
  });

  it('tier heights diminish geometrically and fill the body', () => {
    const F = tierBreaks(5, 0.9);
    expect(F[0]).toBe(0); expect(F[5]).toBe(1);
    const h = F.slice(1).map((f, i) => f - F[i]);
    for (let i = 1; i < 5; i += 1) expect(h[i] / h[i - 1]).toBeCloseTo(0.9, 9);
  });

  it('a stepped rise stands each tier back on a terrace: tier i + 1 is narrower than tier i at every height', () => {
    const S = readStructure({ preset: STEPPED, at: [0, 0] });
    const body = growStructure({ ...S, echo: false }).stacks.filter((s) => s.role === 'body');
    for (const b of body) expect(b.stations[0].s).toBe(b.stations[1].s);
    for (let i = 1; i < body.length; i += 1) expect(body[i].stations[0].s).toBeLessThan(body[i - 1].stations[0].s);
  });
});

describe('the echo (the self-similarity)', () => {
  it('stands copies of the whole against its flanks, each the same proportions, smaller', () => {
    const S = readStructure({ preset: ECHOED, at: [0, 0], size: 10 });
    const bare = growStructure({ ...S, echo: false }), grown = growStructure(S);
    expect(grown.stacks.length).toBeGreaterThan(bare.stacks.length);
    const copies = grown.stacks.filter((s) => s.level === 1 && s.role === 'body');
    expect(copies.length).toBeGreaterThan(0);
    for (const c of copies) expect(c.R).toBeLessThan(5);
    // a copy's body is as tall over its width as the tower's (H / R carried, whatever its tiers)
    const span = (stacks) => Math.max(...stacks.map((s) => s.stations[1].z)) - Math.min(...stacks.map((s) => s.stations[0].z));
    const main = grown.stacks.filter((s) => s.level === 0 && s.role === 'body');
    const one = copies.filter((s) => s.c === copies[0].c);
    expect(span(one) / one[0].R).toBeCloseTo(span(main) / main[0].R, 6);
  });

  it('the face budget trims the deepest copies first, never the tower, and says so', () => {
    const S = readStructure({ preset: ECHOED, at: [0, 0], echo: { depth: 2 } });
    const whole = growStructure(S, { maxFaces: Infinity });
    const tight = growStructure(S, { maxFaces: Math.floor(whole.faces * 0.6) });
    expect(whole.depth).toBe(2);
    expect(tight.trimmed).toBe(true);
    expect(tight.depth).toBeLessThan(2);
    const mainOf = (g) => g.stacks.filter((s) => s.level === 0);
    expect(mainOf(tight)).toEqual(mainOf(whole));
  });
});

describe('structureFaces', () => {
  it('is deterministic, and auto rolls the same tower for the same seed', () => {
    const list = [{ preset: 'auto', seed: 11, at: [3, -4] }, { preset: ECHOED, at: [40, 0], turn: 30 }];
    expect(JSON.stringify(structureFaces(list))).toBe(JSON.stringify(structureFaces(list)));
    const rolls = new Set(Array.from({ length: 12 }, (_, s) => structureFaces([{ preset: 'auto', seed: s + 1, at: [0, 0] }]).stats[0].preset));
    expect(rolls.size).toBeGreaterThan(1);
    expect(PRESET_IDS).toContain('auto');
  });

  it('emits closed-looking, lit faces standing on its `at`, the tops capped upward', () => {
    const { faces, stats } = structureFaces([{ preset: ECHOED, at: [10, 20, 2], size: 8 }]);
    expect(stats[0].faces).toBe(faces.length);
    const zs = faces.flatMap((f) => f.corners.map((c) => c[2]));
    expect(Math.min(...zs)).toBeCloseTo(2, 6);
    for (const f of faces) {
      expect(f.corners.every((c) => c.length === 3 && c.every(Number.isFinite))).toBe(true);
      expect(f.fill).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(faces.some((f) => f.outNormal[2] > 0.99)).toBe(true);
  });

  it('shades by the world light and gives raw albedo under the flat light', () => {
    const one = [{ preset: 'drum', at: [0, 0] }];
    const flat = structureFaces(one, { light: FLAT_LIGHT }).faces;
    const fills = new Set(flat.filter((f) => f.group.endsWith(':plinth')).map((f) => f.fill));
    expect([...fills]).toEqual([PRESETS.drum.palette.plinth]);
    expect(new Set(structureFaces(one).faces.map((f) => f.fill)).size).toBeGreaterThan(fills.size);
  });

  it('boxes each tier and plinth step of the tower as a collider whose top a walker stands on', () => {
    const S = readStructure({ preset: STEPPED, at: [0, 0], echo: false });
    const { colliders } = structureFaces([{ preset: STEPPED, at: [0, 0], echo: false }]);
    expect(colliders).toHaveLength(S.rise.tiers + (S.plinth ? S.plinth.steps : 0));
    for (let i = 1; i < colliders.length; i += 1) expect(colliders[i].min[2]).toBeCloseTo(colliders[i - 1].max[2], 6);
    for (const c of colliders) expect(c.of).toMatch(/^structure:/);
  });

  it('teaches: an unknown preset, a bad dial and an unknown word each name what reads', () => {
    expect(validateStructures([{ preset: 'cathedral', at: [0, 0] }])[0]).toMatch(/preset: one of spire, cluster/);
    expect(validateStructures([{ at: [0, 0], rise: { tiers: 40 } }])[0]).toMatch(/rise\.tiers: a whole number from 1 to 24/);
    expect(validateStructures([{ at: [0, 0], echo: { depth: 1, spread: 2 } }])[0]).toMatch(/echo\.spread: not a word here/);
    expect(validateStructures([{ preset: 'spire' }])[0]).toMatch(/\.at: where it stands/);
    expect(validateStructures([{ preset: 'spire', at: [0, 0] }])).toEqual([]);
  });
});
