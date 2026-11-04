// The rail shelf's cars behind the cab (car-odm.js, car-surface.js) and the train they make (consist.js): a passenger
// car's section is its family's cab car's, so a train is one section end to end; its doors on its body, its bogies under
// it (two, one or none); a wagon's body by its kind; its ends' gear as deep as their kind; a train laid out nose to tail
// with the gap its ends need, its rear cab turned end for end, its ends coupling only kind to kind; the same brief the
// same bytes. The cases are chosen from the archetypes and the plans in code, one per procedure.
import { describe, it, expect } from 'vitest';
import { solveCarDesign, CAR_ARCHETYPES, CAR_KINDS, CAR_LIMITS, compileCarSurface, END_DEPTH, solveCabDesign, halfWidthAt, composeTrain, planTrain, TRAIN_PLANS } from './index.js';

const A = (k) => CAR_ARCHETYPES[k];
// (one passenger car per bogie count: two, one under its middle, none; one wagon per body)
const PASSENGER = CAR_KINDS.filter((k) => A(k).kind === 'passenger');
const BY_BOGIES = [2, 1, 0].map((n) => PASSENGER.find((k) => A(k).bogies.length === n));
const CAB_FAMILY = PASSENGER.find((k) => A(k).family !== 'coach');
const WAGONS = [...new Set(CAR_KINDS.filter((k) => A(k).kind === 'freight').map((k) => A(k).body))].map((b) => CAR_KINDS.find((k) => A(k).body === b));
// (one train per end kind its first car carries)
const PLANS = Object.keys(TRAIN_PLANS), endOf = (p) => A(TRAIN_PLANS[p].cars[0]).ends;
const BY_ENDS = [...new Set(PLANS.map(endOf))].map((e) => PLANS.find((p) => endOf(p) === e));
const all = (c) => Object.values(c.faces).flat();
const span = (faces, i) => { let lo = Infinity, hi = -Infinity; for (const f of faces) for (const p of f.corners) { lo = Math.min(lo, p[i]); hi = Math.max(hi, p[i]); } return [lo, hi]; };

describe('a car\'s design', () => {
  it('solves each bogie arrangement and each wagon body within its laws', () => {
    for (const k of [...BY_BOGIES, ...WAGONS]) {
      const d = solveCarDesign({ archetype: k });
      expect(d.valid, k).toBe(true);
      expect(d.laws.map((l) => l.id)).toEqual(expect.arrayContaining(['within-gauge', 'doors-on-body', 'bogies-under-body']));
    }
  });
  it('a passenger car takes its section from its family\'s cab car of the same seed', () => {
    for (const seed of [1, 7]) {
      const d = solveCarDesign({ archetype: CAB_FAMILY, seed }), cab = solveCabDesign({ archetype: A(CAB_FAMILY).family, seed });
      expect(d.section).toEqual(cab.section);
      expect(d.frame.width).toBe(cab.frame.width);
      for (let z = d.section.z0; z <= d.frame.height; z += 0.2) expect(halfWidthAt(d, z)).toBeCloseTo(halfWidthAt(cab, z), 9);
    }
  });
  it('its bogies are two at its overhangs, one under its middle, or none (hung between its neighbours)', () => {
    const [two, one, none] = BY_BOGIES.map((k) => solveCarDesign({ archetype: k }));
    expect(two.frame.bogies).toEqual([two.frame.length / 2 - A(BY_BOGIES[0]).overhang, -two.frame.length / 2 + A(BY_BOGIES[0]).overhang].map((v) => Math.round(v * 1e4) / 1e4));
    expect(one.frame.bogies).toEqual([0]);
    expect(none.frame.bogies).toEqual([]);
    expect(none.frame.pivot).toBeNull();
  });
  it('an explicit length wins, a length outside its band or an unknown word throws', () => {
    expect(solveCarDesign({ archetype: BY_BOGIES[0], dimensions: { length: 20 } }).frame.length).toBe(20);
    expect(() => solveCarDesign({ archetype: BY_BOGIES[0], dimensions: { length: CAR_LIMITS.length[1] + 1 } })).toThrow(/length/);
    expect(() => solveCarDesign({ archetype: BY_BOGIES[0], dimensions: { colour: 1 } })).toThrow(/unknown dimension/);
    expect(() => solveCarDesign({ archetype: 'zeppelin' })).toThrow(/unknown archetype/);
  });
});

describe('a car\'s surface', () => {
  it('a passenger car\'s doors and windows lie on its sides, between its ends', () => {
    const c = compileCarSurface({ archetype: BY_BOGIES[0] }), d = c.design, L = d.frame.length;
    const doors = c.faces.body.filter((f) => f.part === 'door' || f.part === 'glass.door'), glass = c.faces.body.filter((f) => f.part === 'glass.side');
    expect(doors.length).toBeGreaterThan(0);
    expect(glass.length).toBeGreaterThan(0);
    for (const f of doors) {
      const y = f.corners.reduce((s, p) => s + p[1], 0) / f.corners.length;
      expect(d.doors.at.some((a) => Math.abs(y - a) <= d.doors.width / 2 + 1e-6)).toBe(true);
    }
    const [lo, hi] = span(glass, 1);
    expect(lo).toBeGreaterThan(-L / 2);
    expect(hi).toBeLessThan(L / 2);
  });
  it('its wheels stand on the rail under its body; a car hung between its neighbours has none', () => {
    for (const k of BY_BOGIES) {
      const c = compileCarSurface({ archetype: k }), d = c.design, tread = c.faces.bogies.filter((f) => f.part === 'wheel.tread');
      if (!d.frame.bogies.length) { expect(c.faces.bogies).toEqual([]); continue; }
      expect(span(tread, 2)[0]).toBeCloseTo(-0.028, 2);
      const [lo, hi] = span(c.faces.bogies, 1);
      expect(lo).toBeGreaterThan(-d.frame.length / 2);
      expect(hi).toBeLessThan(d.frame.length / 2);
    }
  });
  it('each wagon body is drawn by its kind, and its ends\' gear reaches as far as its kind\'s depth', () => {
    for (const k of WAGONS) {
      const c = compileCarSurface({ archetype: k }), d = c.design, L = d.frame.length;
      expect(c.faces.body.length, k).toBeGreaterThan(0);
      expect(c.ends.front.depth).toBe(END_DEPTH[d.ends]);
      const [lo, hi] = span(all(c), 1);
      expect(hi).toBeCloseTo(L / 2 + END_DEPTH[d.ends], 3);
      expect(lo).toBeCloseTo(-L / 2 - END_DEPTH[d.ends], 3);
      for (const f of all(c)) expect(f.fill, `${k} ${f.part}`).toBeTruthy();
    }
  });
  it('the same brief compiles to the same bytes', () => {
    for (const k of [BY_BOGIES[0], WAGONS.at(-1)]) expect(JSON.stringify(compileCarSurface({ archetype: k, seed: 3 }))).toBe(JSON.stringify(compileCarSurface({ archetype: k, seed: 3 })));
  });
});

describe('a train', () => {
  it('composes each end kind valid: its cars nose to tail, the gap between two bodies their ends\' depths', () => {
    for (const p of BY_ENDS) {
      const t = composeTrain({ family: p });
      expect(t.valid, p).toBe(true);
      expect(t.vehicles.length).toBe(1 + t.plan.cars.length + (t.plan.rear ? 1 : 0));
      for (const [i, c] of t.couplings.entries()) {
        const a = t.vehicles[i], b = t.vehicles[i + 1];
        expect(c.meets).toBe(true);
        if (i > 0 && b.kind === 'car') expect(c.gap).toBeCloseTo(2 * END_DEPTH[c.kinds[0]], 6);
        expect(a.y - a.length / 2 - (b.y + b.length / 2)).toBeCloseTo(c.gap, 3);
      }
    }
  });
  it('a unit\'s rear cab is its leading cab turned end for end: its nose the train\'s tail', () => {
    const p = BY_ENDS.find((q) => TRAIN_PLANS[q].rear), t = composeTrain({ family: p });
    const [lo] = span(t.faces.rearCab, 1), [, hi] = span(t.faces.cab, 1);
    expect(hi - lo).toBeGreaterThanOrEqual(t.length - 1e-6);
    const nose = (faces) => faces.filter((f) => f.part === 'glass.screen');
    const [fl, fh] = span(nose(t.faces.cab), 1), [rl, rh] = span(nose(t.faces.rearCab), 1);
    expect(fl).toBeGreaterThan(t.vehicles[0].y);
    expect(rh).toBeLessThan(t.vehicles.at(-1).y);
    // (turned: its screen as far behind its middle as the leading cab's is ahead of its own)
    expect(t.vehicles.at(-1).y - rl).toBeCloseTo(fh - t.vehicles[0].y, 3);
  });
  it('ends of different kinds do not couple, and a unit takes only its own family\'s cars', () => {
    const p = BY_ENDS.find((q) => TRAIN_PLANS[q].rear), other = CAR_KINDS.find((k) => A(k).ends !== endOf(p));
    const t = composeTrain({ family: p, cars: [other] });
    expect(t.valid).toBe(false);
    expect(t.laws.find((l) => l.id === 'ends-couple').pass).toBe(false);
    expect(t.laws.find((l) => l.id === 'one-family').pass).toBe(false);
    expect(() => planTrain({ family: 'zeppelin' })).toThrow(/unknown family/);
    expect(() => planTrain({ family: p, cars: ['zeppelin'] })).toThrow(/car archetypes/);
  });
  it('the same plan composes to the same bytes', () => {
    const p = BY_ENDS[0], cars = TRAIN_PLANS[p].cars.slice(0, 1);
    expect(JSON.stringify(composeTrain({ family: p, cars, seed: 5 }))).toBe(JSON.stringify(composeTrain({ family: p, cars, seed: 5 })));
  });
});
