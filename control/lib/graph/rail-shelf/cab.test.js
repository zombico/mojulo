// The rail shelf's cab car (cab-odm.js, cab-surface.js, cab-library.js): a brief solved into one frame held to its laws;
// the body's section continuous and widest at its waist; the front a field over the section that meets the sides
// exactly and stands ahead of its root; the surface's seams shared and its halves mirrored; the screen where the
// driver's eye is; lamps on the front's own surface below it; each coupler where its kind puts it; the wheels on the
// rail and inside the body; the same brief the same bytes. The cases are chosen from the archetypes in code, one per
// front form.
import { describe, it, expect } from 'vitest';
import { solveCabDesign, halfWidthAt, frontAt, frontNormal, CAB_ARCHETYPES, CAB_KINDS, CAB_LIMITS, compileCabSurface, RAIL_MATERIALS, composeCab, CAB_LIBRARY } from './index.js';

const by = (f) => CAB_KINDS.slice().sort((a, b) => f(CAB_ARCHETYPES[a]) - f(CAB_ARCHETYPES[b]));
// (the flattest front, the longest nose, the one with a mullion, the one with buffers)
const FLAT = by((A) => A.nose)[0], LONG = by((A) => -A.nose)[0];
const MULLION = CAB_KINDS.find((k) => CAB_ARCHETYPES[k].screen.mullion), BUFFERS = CAB_KINDS.find((k) => CAB_ARCHETYPES[k].coupler === 'buffers');
const AUTO = CAB_KINDS.find((k) => CAB_ARCHETYPES[k].coupler === 'automatic'), COVERED = CAB_KINDS.find((k) => CAB_ARCHETYPES[k].coupler === 'covered');
const CASES = [...new Set([FLAT, LONG, MULLION, BUFFERS])];
const all = (c) => Object.values(c.faces).flat();
const key = (p) => p.map((v) => v.toFixed(4)).join(',');

describe('a cab car\'s design', () => {
  it('solves each front form within its laws: the gauge, the driver\'s eye in the screen, the coupler, the wheels', () => {
    for (const a of CASES) {
      const d = solveCabDesign({ archetype: a });
      expect(d.valid, a).toBe(true);
      expect(d.laws.map((l) => l.id)).toEqual(expect.arrayContaining(['within-gauge', 'eye-in-screen', 'coupler-height', 'wheels-under-body', 'front-ahead']));
    }
  });
  it('the seed explores a small band, an explicit dimension wins, a number outside its band or an unknown word throws', () => {
    const a = solveCabDesign({ archetype: FLAT, seed: 1 }), b = solveCabDesign({ archetype: FLAT, seed: 2 });
    expect(a.frame.length).not.toBe(b.frame.length);
    expect(Math.abs(a.frame.length - CAB_ARCHETYPES[FLAT].length)).toBeLessThanOrEqual(0.3);
    expect(solveCabDesign({ archetype: FLAT, dimensions: { length: 20 } }).frame.length).toBe(20);
    expect(() => solveCabDesign({ archetype: FLAT, dimensions: { length: CAB_LIMITS.length[1] + 1 } })).toThrow(/length/);
    expect(() => solveCabDesign({ archetype: FLAT, dimensions: { colour: 1 } })).toThrow(/unknown dimension/);
    expect(() => solveCabDesign({ archetype: 'zeppelin' })).toThrow(/unknown archetype/);
  });
  it('its section is continuous, widest at its waist, falling over its roof to nothing at the top', () => {
    const d = solveCabDesign({ archetype: LONG }), S = d.section, W = d.frame.width;
    for (const z of [S.zw, S.zc, S.zc + S.radius]) expect(halfWidthAt(d, z - 1e-9)).toBeCloseTo(halfWidthAt(d, z + 1e-9), 3);
    expect(halfWidthAt(d, S.zw)).toBeCloseTo(W / 2, 6);
    for (let z = S.zw; z < d.frame.height; z += 0.05) expect(halfWidthAt(d, z + 0.05)).toBeLessThanOrEqual(halfWidthAt(d, z) + 1e-9);
    expect(halfWidthAt(d, d.frame.height)).toBeCloseTo(0, 6);
  });
  it('its front meets the sides at the root, stands ahead of it, furthest on the centreline, its normal forward', () => {
    for (const a of [FLAT, LONG]) {
      const d = solveCabDesign({ archetype: a });
      for (let z = d.section.z0; z <= d.frame.height; z += 0.25) {
        const w = halfWidthAt(d, z);
        expect(frontAt(d, w, z), a).toBeCloseTo(d.front.root, 6);
        expect(frontAt(d, 0, z)).toBeGreaterThanOrEqual(frontAt(d, 0.5 * w, z) - 1e-9);
        expect(frontAt(d, 0.5 * w, z)).toBeGreaterThanOrEqual(d.front.root - 1e-9);
      }
      expect(frontNormal(d, 0, d.frame.floor)[1]).toBeGreaterThan(0);
    }
    // (a long nose reaches further ahead of its root than a flat front)
    expect(solveCabDesign({ archetype: LONG }).anchors.tip - solveCabDesign({ archetype: LONG }).front.root).toBeGreaterThan(5 * (solveCabDesign({ archetype: FLAT }).anchors.tip - solveCabDesign({ archetype: FLAT }).front.root));
  });
});

describe('a cab car\'s surface', () => {
  const c = compileCabSurface({ archetype: FLAT }), d = c.design;
  it('its front and its sides share every corner where they meet; its halves mirror each other', () => {
    const side = new Set(c.faces.body.flatMap((f) => f.corners.map(key)));
    const seam = c.faces.front.flatMap((f) => f.corners).filter((p) => Math.abs(Math.abs(p[0]) - halfWidthAt(d, p[2])) < 1e-4 && halfWidthAt(d, p[2]) > 0.05);
    expect(seam.length).toBeGreaterThan(10);
    for (const p of seam) expect(side.has(key(p))).toBe(true);
    const parts = (sx) => { const o = {}; for (const f of all(c)) { const m = f.corners.reduce((t, p) => t + p[0], 0) / f.corners.length; if (m * sx > 0.02) o[f.part] = (o[f.part] || 0) + 1; } return o; };
    expect(parts(1)).toEqual(parts(-1));
  });
  it('its screen where the driver\'s eye is, within its band; lamps on the front\'s own surface, below the screen', () => {
    const glass = c.faces.front.filter((f) => f.part === 'glass.screen');
    expect(glass.length).toBeGreaterThan(0);
    for (const f of glass) for (const p of f.corners) {
      expect(p[2]).toBeGreaterThanOrEqual(d.screen.z0 - 1e-6);
      expect(p[2]).toBeLessThanOrEqual(d.screen.z1 + 1e-6);
      expect(Math.abs(p[0])).toBeLessThanOrEqual(d.screen.half * halfWidthAt(d, p[2]) + 1e-3);
    }
    const eye = d.frame.floor + 1.65;
    expect(glass.some((f) => { const z = f.corners.map((p) => p[2]); return Math.min(...z) <= eye && Math.max(...z) >= eye; })).toBe(true);
    for (const f of c.faces.fittings.filter((x) => x.part === 'headlamp')) {
      const m = [0, 1, 2].map((k) => f.corners.reduce((t, p) => t + p[k], 0) / f.corners.length);
      expect(m[1] - frontAt(d, m[0], m[2])).toBeLessThan(0.06);
      expect(m[1] - frontAt(d, m[0], m[2])).toBeGreaterThan(-0.06);
      if (Math.abs(m[0]) > 0.1) expect(m[2]).toBeLessThan(d.screen.z0);
    }
  });
  it('a mullion parts two panes; each coupler where its kind puts it', () => {
    expect(compileCabSurface({ archetype: MULLION }).faces.front.some((f) => f.part === 'pillar')).toBe(true);
    const B = compileCabSurface({ archetype: BUFFERS }), bx = B.faces.fittings.filter((f) => f.part === 'buffer').flatMap((f) => f.corners);
    expect(Math.max(...bx.map((p) => p[0]))).toBeCloseTo(0.875 + 0.24, 1);
    expect(Math.max(...bx.map((p) => p[1]))).toBeGreaterThan(B.design.anchors.tip);
    const Au = compileCabSurface({ archetype: AUTO }), ax = Au.faces.fittings.filter((f) => f.part === 'coupler').flatMap((f) => f.corners);
    expect(Math.max(...ax.map((p) => p[1]))).toBeGreaterThan(frontAt(Au.design, 0, Au.design.anchors.coupler.z));
    expect(compileCabSurface({ archetype: COVERED }).faces.fittings.some((f) => f.part === 'coupler')).toBe(false);
  });
  it('its wheels on the rail, on the gauge and inside the body; every face a material the shelf names', () => {
    // (the treads' flanges just below the rail's top, the wheels between the body's sides)
    const w = c.faces.bogies.filter((f) => f.part === 'wheel.tread').flatMap((f) => f.corners);
    expect(Math.min(...w.map((p) => p[2]))).toBeCloseTo(-0.028, 2);
    expect(Math.max(...c.faces.bogies.flatMap((f) => f.corners).map((p) => Math.abs(p[0])))).toBeLessThan(d.frame.width / 2);
    for (const f of all(c)) expect(RAIL_MATERIALS, f.part).toHaveProperty(f.material);
    for (const f of all(c).filter((x) => x.material === 'lamp')) expect(f.fill).toBe(f.albedo);
  });
  it('the same brief the same bytes; a finer level more triangles; a card is its brief and its surface', () => {
    expect(JSON.stringify(compileCabSurface({ archetype: FLAT }))).toBe(JSON.stringify(c));
    const t = ['game', 'studio', 'hero'].map((q) => compileCabSurface({ archetype: FLAT }, { quality: q }).census.triangles);
    expect(t[0]).toBeLessThan(t[1]);
    expect(t[1]).toBeLessThan(t[2]);
    const preset = Object.keys(CAB_LIBRARY).find((k) => CAB_LIBRARY[k].brief.archetype === FLAT);
    expect(composeCab({ preset }).design.archetype).toBe(FLAT);
    expect(() => composeCab({ preset: 'nope' })).toThrow(/unknown preset/);
  });
});
