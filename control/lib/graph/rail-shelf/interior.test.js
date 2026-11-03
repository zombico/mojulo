// The rail shelf's interiors (interior-odm.js, interior-surface.js): a car's inside solved from its design and held to its
// laws; the lining the body's own section in from its skin, cut by the body's own openings; no seat in a door's zone,
// nothing outside the skin; the plan shapes what the car carries; a low floor raised over its bogies, its seats on the
// podium; a cab car's driver seated where its screen was drawn for, the desk inside the nose; absent, it adds nothing;
// the same brief the same bytes. The cases are chosen in code, one per seating procedure, one low floor, one cab.
import { describe, it, expect } from 'vitest';
import { solveInterior, compileInteriorSurface, cutAway, INTERIOR_PLANS, INTERIOR_PLAN_KINDS, INTERIOR_FAMILY_PLAN, solveCarDesign, solveCabDesign, compileCarSurface, compileCabSurface,
  CAR_ARCHETYPES, CAR_KINDS, CAB_KINDS, halfWidthAt, frontAt, insideHalfWidth } from './index.js';
import { openings } from './body-shell.js';

// (one design per seating procedure: a car whose family's plan seats that way, else a cab car's)
const SEATINGS = [...new Set(INTERIOR_PLAN_KINDS.map((p) => INTERIOR_PLANS[p].seating))];
const designFor = (plan) => {
  const car = CAR_KINDS.find((k) => CAR_ARCHETYPES[k].kind === 'passenger' && INTERIOR_FAMILY_PLAN[CAR_ARCHETYPES[k].family] === plan);
  if (car) return solveCarDesign({ archetype: car });
  return solveCabDesign({ archetype: CAB_KINDS.find((k) => INTERIOR_FAMILY_PLAN[k] === plan) });
};
const CASES = SEATINGS.map((s) => INTERIOR_PLAN_KINDS.find((p) => INTERIOR_PLANS[p].seating === s && designFor(p)));
// (a low floor: a passenger car whose floor stands under its bogies' tops; a cab car whose screen is its own)
const LOW = CAR_KINDS.map((k) => solveCarDesign({ archetype: k })).find((d) => d.kind === 'passenger' && d.frame.pivot && d.frame.floor < d.frame.pivot - 0.05);
const LOW_CAB = CAB_KINDS.map((k) => solveCabDesign({ archetype: k })).find((d) => d.frame.floor < d.frame.pivot - 0.05);
const CAB = CAB_KINDS.map((k) => solveCabDesign({ archetype: k })).sort((a, b) => b.front.nose - a.front.nose)[0];
const WAGON = CAR_KINDS.find((k) => CAR_ARCHETYPES[k].kind === 'freight');

describe('an interior\'s plan', () => {
  it('solves each seating procedure within its laws', () => {
    for (const p of CASES) {
      const I = solveInterior(designFor(p));
      expect(I.plan, p).toBe(p);
      expect(I.valid, `${p}: ${I.laws.filter((l) => !l.pass).map((l) => l.id)}`).toBe(true);
      expect(I.laws.map((l) => l.id)).toEqual(expect.arrayContaining(['headroom', 'aisle-wide', 'doors-clear', 'inside-lining', 'knee-room', 'passage-through']));
    }
  });
  it('stands no seat, table or cabinet in a door\'s zone, and leaves a passage through every partition', () => {
    for (const p of CASES) {
      const d = designFor(p), I = solveInterior(d), doors = openings(d).doors;
      for (const s of [...I.seats, ...I.tables, ...I.equipment.filter((e) => !e.cab)]) for (const [a, b] of doors) expect(s.y[1] <= a - 0.3 + 1e-6 || s.y[0] >= b + 0.3 - 1e-6, p).toBe(true);
      for (const q of I.partitions.filter((x) => x.opening)) expect(q.opening.x[1] - q.opening.x[0]).toBeGreaterThanOrEqual(0.55);
    }
  });
  it('the plan shapes what the car carries: on a car with long runs between its doors, seats across seat more and stand fewer than benches along the walls', () => {
    const wide = INTERIOR_PLAN_KINDS.filter((p) => INTERIOR_PLANS[p].seating === 'bays').sort((a, b) => INTERIOR_PLANS[b].abreast.reduce((t, n) => t + n) - INTERIOR_PLANS[a].abreast.reduce((t, n) => t + n))[0];
    const d = designFor(wide), across = solveInterior(d), along = solveInterior(d, { plan: CASES.find((p) => INTERIOR_PLANS[p].seating === 'longitudinal') });
    expect(along.valid && across.valid).toBe(true);
    expect(across.capacity.seated).toBeGreaterThan(along.capacity.seated);
    expect(along.capacity.standing).toBeGreaterThan(across.capacity.standing);
    // (and a plan too wide for its body is refused by its laws: two and two airline seats leave a metro car no passage)
    const narrow = designFor(CASES.find((p) => INTERIOR_PLANS[p].seating === 'longitudinal'));
    expect(solveInterior(narrow, { plan: CASES.find((p) => INTERIOR_PLANS[p].seating === 'airline') }).laws.find((l) => l.id === 'passage-through').pass).toBe(false);
  });
  it('a pitch too short for knees fails its law; an unknown plan or a pitch outside its band throws; a wagon has none', () => {
    const p = CASES.find((x) => INTERIOR_PLANS[x].seating === 'airline'), d = designFor(p);
    expect(solveInterior(d, { pitch: 0.75 }).laws.find((l) => l.id === 'knee-room').pass).toBe(false);
    expect(() => compileCarSurface(d, { interior: { pitch: 0.75 } })).toThrow(/knee-room/);
    expect(() => solveInterior(d, { plan: 'ballroom' })).toThrow(/unknown plan/);
    expect(() => solveInterior(d, { pitch: 5 })).toThrow(/pitch/);
    expect(solveInterior(solveCarDesign({ archetype: WAGON }))).toBeNull();
    expect(compileCarSurface({ archetype: WAGON }, { interior: true }).faces.interior).toBeUndefined();
  });
});

describe('an interior\'s surface', () => {
  const p = CASES[0], d = designFor(p), c = d.front ? compileCabSurface(d, { interior: true }) : compileCarSurface(d, { interior: true }), I = c.interior;
  const inner = c.faces.interior, t = I.lining.thickness;
  it('its lining follows the body\'s section in from the skin, and everything inside stands inside the skin', () => {
    const wall = inner.filter((f) => f.part === 'trim.dado');
    expect(wall.length).toBeGreaterThan(0);
    for (const f of wall) for (const [x, , z] of f.corners) expect(Math.abs(x)).toBeCloseTo(halfWidthAt(d, z) - t, 3);
    for (const f of inner) for (const [x, , z] of f.corners) expect(Math.abs(x)).toBeLessThanOrEqual(halfWidthAt(d, z) + 1e-3);
  });
  it('its lining is cut where the body is: no wall across a window light or a door', () => {
    const O = openings(d), wall = inner.filter((f) => (f.part === 'trim.lining' || f.part === 'trim.dado') && f.corners.every(([x, , z]) => Math.abs(Math.abs(x) - (halfWidthAt(d, z) - t)) < 1e-3));
    const covers = (y, z) => wall.some((f) => { const ys = f.corners.map((q) => q[1]), zs = f.corners.map((q) => q[2]); return y > Math.min(...ys) && y < Math.max(...ys) && z > Math.min(...zs) && z < Math.max(...zs); });
    for (const [a, b] of O.lights) expect(covers((a + b) / 2, (O.win[0] + O.win[1]) / 2)).toBe(false);
    for (const [a, b] of O.doors) expect(covers((a + b) / 2, d.frame.floor + 1)).toBe(false);
    expect(covers(O.lights[0][0] - 0.03, (O.win[0] + O.win[1]) / 2) || covers(O.lights[0][1] + 0.03, (O.win[0] + O.win[1]) / 2)).toBe(true);
  });
  it('absent, it adds nothing: the shell the same bytes with or without it, its faces marked inside', () => {
    const bare = d.front ? compileCabSurface(d) : compileCarSurface(d);
    expect(bare.faces.interior).toBeUndefined();
    expect(bare.interior).toBeUndefined();
    for (const k of Object.keys(bare.faces)) expect(JSON.stringify(c.faces[k])).toBe(JSON.stringify(bare.faces[k]));
    expect(inner.every((f) => f.inside === true)).toBe(true);
    expect(Object.keys(c.materials)).toEqual(expect.arrayContaining(Object.keys(bare.materials)));
  });
  it('a cutaway opens the near half: its shell and lining there gone, its seats and the far wall kept', () => {
    const o = cutAway(c, { side: 1, above: d.frame.floor + 0.02 }), near = (f) => f.corners.every((q) => q[0] >= -0.02);
    expect(o.faces.body.filter((f) => near(f) && f.corners.every((q) => q[2] >= d.frame.floor + 0.02))).toEqual([]);
    expect(o.faces.interior.filter((f) => f.part === 'trim.lining' && near(f))).toEqual([]);
    expect(o.faces.interior.filter((f) => f.part === 'trim.lining' && !near(f)).length).toBeGreaterThan(0);
    expect(o.faces.interior.filter((f) => /^seat\./.test(f.part)).length).toBe(inner.filter((f) => /^seat\./.test(f.part)).length);
  });
  it('the same brief compiles to the same bytes', () => {
    expect(JSON.stringify(compileInteriorSurface(d, solveInterior(d), { quality: 'game' }))).toBe(JSON.stringify(compileInteriorSurface(d, solveInterior(d), { quality: 'game' })));
  });
});

describe('a low floor and a cab', () => {
  it('a floor under its bogies is raised over each on a podium, its seats standing on it, a step up to it', () => {
    const I = solveInterior(LOW);
    expect(I.valid).toBe(true);
    expect(I.podiums.length).toBe(LOW.frame.bogies.length);
    for (const q of I.podiums) {
      expect(q.z).toBeGreaterThan(LOW.frame.pivot);
      const on = I.seats.filter((s) => (s.y[0] + s.y[1]) / 2 > q.y[0] && (s.y[0] + s.y[1]) / 2 < q.y[1]);
      expect(on.length).toBeGreaterThan(0);
      for (const s of on) expect(s.floor).toBe(q.z);
      expect(I.zones.some((z) => z.kind === 'step' && (Math.abs(z.y[1] - q.y[0]) < 1e-6 || Math.abs(z.y[0] - q.y[1]) < 1e-6))).toBe(true);
    }
    // (and no door over a bogie on such a floor: its cab car's design puts its doors between them)
    expect(LOW_CAB.laws.find((l) => l.id === 'doors-clear-of-bogies').pass).toBe(true);
    for (const y of LOW_CAB.doors.at) for (const yb of LOW_CAB.frame.bogies) expect(Math.abs(y - yb)).toBeGreaterThan(LOW_CAB.doors.width / 2 + LOW_CAB.frame.axle / 2);
  });
  it('a cab car\'s driver sits with the eye in its screen, the desk inside the nose, the partition behind the seat', () => {
    for (const d of [CAB, LOW_CAB]) {
      const I = solveInterior(d), C = I.cab, [x, y, z] = C.eye;
      expect(I.valid, d.archetype).toBe(true);
      expect(z).toBeGreaterThan(d.screen.z0);
      expect(z).toBeLessThan(d.screen.z1);
      expect(z - C.floor).toBeCloseTo(1.28, 6);
      expect(frontAt(d, x, z) - y).toBeGreaterThan(0.5);
      for (const yd of C.desk.y) for (const zd of [C.floor, ...C.desk.z]) expect(insideHalfWidth(d, yd, zd)).toBeGreaterThanOrEqual(C.desk.half - 1e-6);
      expect(C.partition).toBeLessThan(C.seats[0].y[0]);
    }
    // (a cab over a bogie on a low floor: its floor over the bogie)
    const lowCab = solveInterior(LOW_CAB).cab;
    expect(lowCab.floor).toBeGreaterThan(LOW_CAB.frame.pivot);
  });
});
