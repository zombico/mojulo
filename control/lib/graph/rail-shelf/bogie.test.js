// The rail shelf's bogies (bogie-odm.js, bogie-surface.js): a brief solved within its laws; the wheels on the gauge
// (their back to back, the tread's contact at the gauge's half, the flange inboard); the axles spaced on the wheelbase;
// the frame clear of the wheels and of the rail; each kind of spring, drive and brake where its archetype puts it; the
// lifeguards on a leading bogie alone; the wheels' spin and the bogie's yaw as poses; the cab car standing on its
// bogies under its floor; the same brief the same bytes. One case per frame kind, axle count and drive, chosen in code.
import { describe, it, expect } from 'vitest';
import { solveBogieDesign, axlesOf, BOGIE_ARCHETYPES, BOGIE_KINDS, BOGIE_LIMITS, WHEEL_PROFILE, compileBogieSurface, compileCabSurface, solveCabDesign, CAB_KINDS } from './index.js';

const find = (f) => BOGIE_KINDS.find((k) => f(BOGIE_ARCHETYPES[k]));
const H2 = find((A) => A.frame === 'h' && A.axles === 2 && A.secondary === 'air' && A.motors > 0), THREE = find((A) => A.frame === 'threePiece');
const AX3 = find((A) => A.axles === 3), CHEVRON = find((A) => A.primary === 'chevron'), DISCS = find((A) => A.brakes === 'disc' && A.discs > 1);
const CASES = [...new Set([H2, THREE, AX3, CHEVRON])];
const all = (c) => Object.values(c.faces).flat();
const of = (c, part) => all(c).filter((f) => f.part === part);
const pts = (fs) => fs.flatMap((f) => f.corners);

describe('a bogie\'s design', () => {
  it('solves each frame, axle count and drive within its laws; its axles spaced on its wheelbase, about its centre', () => {
    for (const a of CASES) {
      const d = solveBogieDesign({ archetype: a }), ys = axlesOf(d);
      expect(d.valid, a).toBe(true);
      expect(ys.length).toBe(d.axles);
      expect(ys.at(-1) - ys[0]).toBeCloseTo(d.base, 4);
      expect(ys[0] + ys.at(-1)).toBeCloseTo(0, 3);
    }
  });
  it('its wheels on the gauge: their back to back, the tread\'s contact between the flange\'s root and the outer face', () => {
    for (const gauge of [1.435, 1.0]) {
      const d = solveBogieDesign({ archetype: H2, dimensions: { gauge } }), P = d.profile;
      expect(2 * P.inner).toBeCloseTo((WHEEL_PROFILE.backToBack * gauge) / 1.435, 3);
      expect(gauge / 2).toBeGreaterThan(P.inner + P.flangeThickness - 0.02);
      expect(gauge / 2).toBeLessThan(P.outer);
    }
  });
  it('an explicit dimension wins; a number outside its band or an unknown word throws', () => {
    expect(solveBogieDesign({ archetype: H2, dimensions: { wheel: 0.9 } }).wheel).toBe(0.9);
    expect(() => solveBogieDesign({ archetype: H2, dimensions: { wheel: BOGIE_LIMITS.wheel[1] + 0.1 } })).toThrow(/wheel/);
    expect(() => solveBogieDesign({ archetype: H2, dimensions: { colour: 1 } })).toThrow(/unknown dimension/);
    expect(() => solveBogieDesign({ archetype: 'hovercraft' })).toThrow(/unknown archetype/);
  });
});

describe('a bogie\'s surface', () => {
  it('its treads meet the rail at the gauge\'s half, its flanges inboard of it and below the rail\'s top', () => {
    const c = compileBogieSurface({ archetype: H2 }), d = c.design, P = d.profile, g = d.gauge / 2;
    for (const p of c.hardpoints.contacts) { expect(Math.abs(p[0])).toBeCloseTo(g, 6); expect(p[2]).toBe(0); }
    const tread = pts(of(c, 'wheel.tread')), low = Math.min(...tread.map((p) => p[2]));
    expect(low).toBeCloseTo(-P.flange, 2);
    for (const p of tread.filter((q) => q[2] < -0.01)) expect(Math.abs(p[0])).toBeLessThan(g);
    const onTread = tread.filter((p) => Math.abs(p[0]) > P.inner + P.flangeThickness + 0.007 && p[2] < 0.05);
    expect(Math.min(...onTread.map((p) => p[2]))).toBeGreaterThan(-0.01);
  });
  it('its frame clear of every wheel and of the rail', () => {
    for (const a of CASES) {
      const c = compileBogieSurface({ archetype: a }), d = c.design, r = d.wheel / 2, ys = axlesOf(d);
      for (const p of pts(of(c, 'bogie.frame'))) {
        expect(p[2], a).toBeGreaterThan(0.08);
        for (const ya of ys) if (Math.abs(p[0]) > d.profile.inner - 0.04 && Math.abs(p[0]) < d.profile.outer) expect(Math.hypot(p[1] - ya, p[2] - r), a).toBeGreaterThan(r + d.profile.flange - 0.005);
      }
    }
  });
  it('each archetype\'s springs, drive and brakes: coils or chevrons, air springs or nests, motors, discs, blocks, track shoes', () => {
    const h = compileBogieSurface({ archetype: H2 }), t = compileBogieSurface({ archetype: THREE }), ch = compileBogieSurface({ archetype: CHEVRON });
    expect(of(h, 'bogie.spring').length).toBeGreaterThan(0);
    expect(of(h, 'bogie.air').length).toBeGreaterThan(0);
    expect(of(h, 'drive.motor').length).toBeGreaterThan(0);
    expect(of(ch, 'bogie.chevron').length).toBeGreaterThan(0);
    expect(of(t, 'drive.motor').length).toBe(0);
    expect(of(t, 'bogie.air').length).toBe(0);
    // (a three-piece truck's springs under its bolster, between its side frames' members)
    const bol = pts(of(t, 'bogie.spring')), r = t.design.wheel / 2;
    expect(Math.max(...bol.map((p) => p[2]))).toBeLessThan(r + 0.01);
    if (BOGIE_ARCHETYPES[CHEVRON].track) expect(of(ch, 'bogie.trackbrake').length).toBeGreaterThan(0);
    const dd = compileBogieSurface({ archetype: DISCS }), A = BOGIE_ARCHETYPES[DISCS], round = 14;
    expect(of(dd, 'brake.disc').length).toBe(A.axles * A.discs * 4 * round);
    const tread = find((B) => B.brakes === 'tread');
    expect(of(compileBogieSurface({ archetype: tread }), 'bogie.shoe').length).toBe(BOGIE_ARCHETYPES[tread].axles * 2 * 6);
  });
  it('a leading bogie\'s lifeguards; its wheels turned and the bogie swung as poses about the pivot', () => {
    expect(of(compileBogieSurface({ archetype: H2 }), 'bogie.lifeguard').length).toBe(0);
    expect(of(compileBogieSurface({ archetype: H2 }, { lead: true }), 'bogie.lifeguard').length).toBe(12);
    const a = compileBogieSurface({ archetype: H2 }), s = compileBogieSurface({ archetype: H2 }, { pose: { spin: 90 } }), y = compileBogieSurface({ archetype: H2 }, { pose: { yaw: 10 } });
    expect(JSON.stringify(pts(of(s, 'wheel.mark')))).not.toBe(JSON.stringify(pts(of(a, 'wheel.mark'))));
    expect(JSON.stringify(pts(of(s, 'bogie.frame')))).toBe(JSON.stringify(pts(of(a, 'bogie.frame'))));
    expect(y.hardpoints.pivot).toEqual(a.hardpoints.pivot);
    for (const [i, p] of y.hardpoints.contacts.entries()) {
      const q = a.hardpoints.contacts[i];
      expect(Math.hypot(p[0], p[1])).toBeCloseTo(Math.hypot(q[0], q[1]), 3);
      expect(Math.atan2(p[1], p[0]) - Math.atan2(q[1], q[0])).toBeCloseTo((10 * Math.PI) / 180, 3);
    }
  });
  it('the same brief the same bytes; a finer level more triangles', () => {
    expect(JSON.stringify(compileBogieSurface({ archetype: AX3 }))).toBe(JSON.stringify(compileBogieSurface({ archetype: AX3 })));
    const t = ['game', 'studio', 'hero'].map((q) => compileBogieSurface({ archetype: AX3 }, { quality: q }).census.triangles);
    expect(t[0]).toBeLessThan(t[1]);
    expect(t[1]).toBeLessThan(t[2]);
  });
});

describe('a cab car on its bogies', () => {
  it('its bogies the shelf\'s, under its floor (or a low floor\'s raised ends), their wheels on the rail', () => {
    const kind = CAB_KINDS.find((k) => solveCabDesign({ archetype: k }).frame.floor > 1), c = compileCabSurface({ archetype: kind }), d = c.design;
    expect(d.laws.find((l) => l.id === 'bogies-under-floor').pass).toBe(true);
    expect(d.frame.pivot).toBeLessThan(d.frame.floor);
    const w = c.faces.bogies.filter((f) => f.part === 'wheel.tread').flatMap((f) => f.corners);
    expect(Math.min(...w.map((p) => p[2]))).toBeCloseTo(-0.028, 2);
    for (const yB of d.frame.bogies) expect(w.some((p) => Math.abs(p[1] - yB) < d.frame.axle)).toBe(true);
    expect(c.faces.bogies.some((f) => f.part === 'bogie.lifeguard' && f.corners.every((p) => p[1] > 0))).toBe(true);
  });
});
