// The rail shelf's current collectors and the line they reach (panto-odm.js, panto-surface.js, catenary.js): each
// kind solved within its laws, its range over its class's roof covering its class's wire band; its kinematics (a
// single arm's knee on both arms' circles and leading, a diamond's sides its arms, a pole's tip its length out, the
// head's height rising with the raise, a wire's height met when it can be and clamped when not); its strips' top at
// its contact; turned end for end by its facing; a catenary's contact wire at its height, staggered mast to mast; a cab
// car's pantographs raised to the wire. One case per kind, chosen in code.
import { describe, it, expect } from 'vitest';
import { solvePantoDesign, pantoPose, PANTO_ARCHETYPES, PANTO_KINDS, compilePantoSurface, compileCatenary, wireAt, compileCabSurface, solveCabDesign, CAB_KINDS, CAB_PANTOGRAPH_ZONE } from './index.js';

const byKind = (k) => PANTO_KINDS.find((a) => PANTO_ARCHETYPES[a].kind === k);
const ARM = byKind('arm'), DIAMOND = byKind('diamond'), POLE = byKind('pole');
const pts = (c, re) => Object.values(c.faces).flat().filter((f) => re.test(f.part)).flatMap((f) => f.corners);

describe('a pantograph\'s design and its kinematics', () => {
  it('each kind within its laws: folded low, its range over its class\'s roof covering its wire band', () => {
    for (const a of [ARM, DIAMOND, POLE]) {
      const d = solvePantoDesign({ archetype: a }), lo = pantoPose(d, { raise: 0 }), hi = pantoPose(d, { raise: 1 });
      expect(d.valid, a).toBe(true);
      expect(lo.contact).toBeLessThanOrEqual(0.7);
      expect(d.roof + lo.contact).toBeLessThanOrEqual(d.band[0]);
      expect(d.roof + hi.contact).toBeGreaterThanOrEqual(d.band[1]);
    }
    expect(() => solvePantoDesign({ archetype: 'broom' })).toThrow(/unknown archetype/);
    expect(() => solvePantoDesign({ archetype: ARM, dimensions: { lower: 99 } })).toThrow(/lower/);
  });
  it('a single arm\'s knee on both its arms\' circles and out ahead of its head; the head rising with the raise', () => {
    const d = solvePantoDesign({ archetype: ARM });
    let last = -1;
    for (const raise of [0, 0.25, 0.5, 0.75, 1]) {
      const P = pantoPose(d, { raise });
      expect(Math.hypot(P.knee[0], P.knee[1])).toBeCloseTo(d.arms.lower, 3);
      expect(Math.hypot(P.knee[0] - P.head[0], P.knee[1] - P.head[1])).toBeCloseTo(d.arms.upper, 3);
      expect(P.knee[0]).toBeGreaterThan(P.head[0]);
      expect(P.height).toBeGreaterThan(last);
      last = P.height;
    }
  });
  it('a diamond\'s sides its arms; a pole\'s tip its length out from its swivel, trailing', () => {
    const D = solvePantoDesign({ archetype: DIAMOND }), P = pantoPose(D, { raise: 0.5 });
    expect(Math.hypot(P.knee[0] - D.base.pivot, P.knee[1])).toBeCloseTo(D.arms.lower, 3);
    const Q = solvePantoDesign({ archetype: POLE }), T = pantoPose(Q, { raise: 0.5 });
    expect(Math.hypot(T.head[0], T.head[1])).toBeCloseTo(Q.arms.lower, 3);
    expect(T.head[0]).toBeLessThan(0);
  });
  it('a wire\'s height met when it is in reach, clamped and said when it is not', () => {
    const d = solvePantoDesign({ archetype: ARM });
    const ok = pantoPose(d, { wire: 1.8 });
    expect(ok.contact).toBeCloseTo(1.8, 6);
    expect(ok.reached).toBe(true);
    const far = pantoPose(d, { wire: 9 });
    expect(far.reached).toBe(false);
    expect(far.raise).toBe(1);
  });
});

describe('a pantograph\'s surface', () => {
  it('its strips\' top at its contact, its insulators under its frame, its facing turning it end for end', () => {
    for (const a of [ARM, DIAMOND]) {
      const c = compilePantoSurface({ archetype: a }, { pose: { raise: 0.6 } });
      expect(Math.max(...pts(c, /^panto\.strip$/).map((p) => p[2]))).toBeCloseTo(c.pose.contact, 3);
      expect(c.hardpoints.contact[2]).toBeCloseTo(c.pose.contact, 3);
      expect(Math.max(...pts(c, /^panto\.insulator$/).map((p) => p[2]))).toBeLessThanOrEqual(c.design.base.insulator + 1e-6);
    }
    const f = compilePantoSurface({ archetype: ARM }, { pose: { raise: 0.6 } }), b = compilePantoSurface({ archetype: ARM }, { pose: { raise: 0.6 }, facing: -1 });
    const ky = (c) => Math.max(...pts(c, /^panto\.arm$/).map((p) => p[1])), kn = (c) => Math.min(...pts(c, /^panto\.arm$/).map((p) => p[1]));
    expect(ky(b)).toBeCloseTo(-kn(f), 3);
  });
  it('folded and raised differ in their arms and head alone; the same pose the same bytes; a finer level more triangles', () => {
    const a = compilePantoSurface({ archetype: ARM }, { pose: { raise: 0 } }), b = compilePantoSurface({ archetype: ARM }, { pose: { raise: 1 } });
    expect(JSON.stringify(a.faces.base)).toBe(JSON.stringify(b.faces.base));
    expect(JSON.stringify(a.faces.arms)).not.toBe(JSON.stringify(b.faces.arms));
    expect(JSON.stringify(compilePantoSurface({ archetype: POLE }))).toBe(JSON.stringify(compilePantoSurface({ archetype: POLE })));
    const t = ['game', 'studio', 'hero'].map((q) => compilePantoSurface({ archetype: ARM }, { quality: q }).census.triangles);
    expect(t[0]).toBeLessThan(t[1]);
    expect(t[1]).toBeLessThan(t[2]);
  });
});

describe('the catenary', () => {
  it('its contact wire at its height, staggered either side mast to mast; a tramway\'s without a messenger', () => {
    const c = compileCatenary({ length: 60, height: 5.4, span: 30, stagger: 0.2 });
    for (const p of pts(c, /^catenary\.wire$/)) expect(Math.abs(p[2] - 5.4)).toBeLessThan(0.01);
    const xs = c.hardpoints.masts.map(([, y]) => wireAt(c, y));
    expect(xs).toEqual([0.2, -0.2, 0.2]);
    expect(pts(c, /^catenary\.messenger$/).length).toBeGreaterThan(0);
    expect(pts(compileCatenary({ kind: 'tram', height: 5.8 }), /^catenary\.messenger$/).length).toBe(0);
    expect(() => compileCatenary({ height: 9 })).toThrow(/height/);
    expect(() => compileCatenary({ kind: 'monorail' })).toThrow(/kind/);
  });
});

describe('a cab car\'s pantographs', () => {
  const kind = CAB_KINDS.find((k) => solveCabDesign({ archetype: k }).pantographs.length > 1), bare = CAB_KINDS.find((k) => !solveCabDesign({ archetype: k }).pantographs.length);
  it('folded inside the pantograph zone, raised to the wire, on its roof; a car without them carries none', () => {
    const d = solveCabDesign({ archetype: kind });
    expect(d.laws.find((l) => l.id === 'pantographs-fold-in-gauge').pass).toBe(true);
    const c = compileCabSurface({ archetype: kind }, { pose: { wire: 5.5 } });
    expect(c.pantographs.length).toBe(d.pantographs.length);
    for (const p of c.pantographs) { expect(p.reached).toBe(true); expect(p.contact).toBeCloseTo(5.5, 3); }
    const folded = compileCabSurface({ archetype: kind });
    for (const p of folded.pantographs) expect(p.contact).toBeLessThanOrEqual(CAB_PANTOGRAPH_ZONE);
    expect(Math.min(...c.faces.roof.flatMap((f) => f.corners).map((p) => p[2]))).toBeGreaterThanOrEqual(d.frame.height - 1e-6);
    const b = compileCabSurface({ archetype: bare });
    expect(b.faces.roof).toBeUndefined();
    expect(b.pantographs).toBeUndefined();
  });
});
