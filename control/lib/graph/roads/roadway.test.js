import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { buildAlignment, curve, superelevationFor } from './alignment.js';
import { planRoadway, roadwayCensus, crossSection, assembleRoadwayScene, cameraPlan } from './roadway.js';

// road-affordances R0–R2 machine gate: the census measures the DRAWN geometry (band-edge vertices,
// dash ends) against the Ontario 401 reference bands.
const plan = planRoadway({});
const census = roadwayCensus(plan);

describe('alignment kernel', () => {
  it('integrates a clothoid–arc–clothoid curve to the stated radius and deflection', () => {
    const a = buildAlignment({ elements: [{ type: 'tangent', length: 100 }, ...curve({ radius: 1000, deflection: Math.PI / 6 }), { type: 'tangent', length: 100 }] });
    expect(a.at(a.length).heading).toBeCloseTo(Math.PI / 6, 6);
    const mid = a.at(100 + a.elements[1].length + a.elements[2].length / 2);
    expect(1 / mid.k).toBeCloseTo(1000, 6);
  });
  it('joins grades with K-sized parabolic vertical curves, continuous in z and grade', () => {
    const a = buildAlignment({ elements: [{ type: 'tangent', length: 2000 }], profile: { z0: 0, pvis: [{ s: 1000, z: 20, K: 95 }, { s: 1999, z: 0 }] } });
    const c = a.profile.curves[0];
    expect(c.L).toBeCloseTo(95 * Math.abs(c.A), 6);
    for (const s of [c.s0, c.s1]) {
      expect(a.at(s - 1e-3).z).toBeCloseTo(a.at(s + 1e-3).z, 3);
      expect(a.at(s - 1e-3).grade).toBeCloseTo(a.at(s + 1e-3).grade, 4);
    }
  });
  it('superelevation follows the method-5 parabola, capped at e_max at R_min', () => {
    expect(superelevationFor(750)).toBeCloseTo(0.06, 9);
    expect(superelevationFor(1500)).toBeCloseTo(0.045, 9);
    expect(superelevationFor(Infinity)).toBe(0);
  });
});

describe('roadway census — the 401 by Pearson', () => {
  it('lanes are 3.75 m, 9 per direction (4 express + 5 collector)', () => {
    expect(census.lanesPerDirection).toBe(9);
    expect(census.laneWidth[0]).toBeGreaterThan(3.74);
    expect(census.laneWidth[1]).toBeLessThan(3.76);
  });
  it('the paved cross-section is the sum of its template, ~91 m barrier to shoulder edge', () => {
    const { width } = crossSection();
    expect(census.crossSectionPaved[0]).toBeCloseTo(2 * width, 3);
    expect(census.crossSectionPaved[1]).toBeCloseTo(2 * width, 3);
  });
  it('broken lines are 3 m dashes on a 9 m cycle, measured along each line (curve included)', () => {
    expect(census.dashLength[0]).toBeGreaterThan(2.97);
    expect(census.dashLength[1]).toBeLessThan(3.03);
    expect(census.dashCycle[0]).toBeGreaterThan(8.95);
    expect(census.dashCycle[1]).toBeLessThan(9.05);
  });
  it('geometry stays inside the design envelope: e ≤ 0.06, grade ≤ 5 %, R ≥ 750 m', () => {
    expect(census.crossSlopeMax).toBeLessThanOrEqual(0.06);
    expect(census.gradeMax).toBeLessThanOrEqual(0.05);
    expect(census.radiusMin).toBeGreaterThanOrEqual(750);
    expect(census.radiusMeasured).toBeCloseTo(1500, 0);
  });
  it('out-of-band dials are clamped and reported, never refused', () => {
    const p = planRoadway({ laneW: 2.2, curveR: 200 });
    expect(p.opts.laneW).toBe(3.0);
    expect(p.advisories.join(' ')).toMatch(/laneW/);
    expect(p.advisories.join(' ')).toMatch(/curveR/);
  });
});

describe('structures — clearance is an input and a measured output', () => {
  it('every default structure clears the MTO 5.0 m minimum, measured from its drawn soffits', () => {
    expect(census.structures.map((x) => x.kind).sort()).toEqual(['gantry', 'gantry', 'overpass']);
    for (const x of census.structures) {
      expect(x.clearanceMin).toBeGreaterThanOrEqual(5.0);
      expect(x.clearanceMin).toBeGreaterThanOrEqual(x.clearanceTarget - 1e-6);
      expect(x.clearanceMin).toBeLessThan(x.clearanceTarget + 0.15);
    }
  });
  it('a 4.15 m tractor-trailer has ≥ 0.85 m of air under the overpass', () => {
    const ov = census.structures.find((x) => x.kind === 'overpass');
    expect(ov.clearanceMin - 4.15).toBeGreaterThanOrEqual(0.85);
  });
  it('a clearance dial moves the measured deck; under 5.0 m it advises, never refuses', () => {
    const hi = roadwayCensus(planRoadway({ structures: [{ kind: 'overpass', s: 2200, clearance: 6.5 }] }));
    expect(hi.structures[0].clearanceMin).toBeGreaterThanOrEqual(6.5 - 1e-6);
    const lo = planRoadway({ structures: [{ kind: 'overpass', s: 2200, clearance: 4.6 }] });
    expect(lo.advisories.join(' ')).toMatch(/under the MTO 5.0 m minimum/);
    expect(roadwayCensus(lo).structures[0].clearanceMin).toBeCloseTo(4.6, 1);
  });
});

describe('fleet — vehicles at true dimensions', () => {
  it('every class is drawn within ±3 % of its reference L × W × H', () => {
    for (const [cls, r] of Object.entries(census.fleet.dimRatio)) for (const k of ['L', 'W', 'H']) {
      expect(r[k], `${cls}.${k}`).toBeGreaterThan(0.97);
      expect(r[k], `${cls}.${k}`).toBeLessThan(1.03);
    }
    expect(Object.keys(census.fleet.dimRatio)).toContain('tractorTrailer');
  });
  it('a free-flow corridor carries hundreds of vehicles, trucks in the Pearson band, none overlapping', () => {
    expect(census.fleet.vehicles).toBeGreaterThan(300);
    expect(census.fleet.truckShare).toBeGreaterThan(0.06);
    expect(census.fleet.truckShare).toBeLessThan(0.16);
    expect(census.fleet.minGap).toBeGreaterThanOrEqual(8);
  });
  it('the cars are instanced: one repeat per class × part × heading family, tinted paint only', () => {
    const s = assembleRoadwayScene({});
    expect(s.repeats.length).toBeLessThanOrEqual(8 * 3 * 2);
    expect(s.repeats.filter((r) => r.group.endsWith(':trim')).every((r) => r.transforms.every((t) => !t.tint))).toBe(true);
    expect(s.roadway.vehicles.length).toBe(census.fleet.vehicles);
  });
  it('no vehicle sits where a preset camera is the driver', () => {
    const { reserved } = cameraPlan(plan);
    expect(reserved.length).toBeGreaterThan(0);
    for (const r of reserved) expect(plan.traffic.vehicles.some((v) => v.lane === r.lane && Math.abs(v.s - r.s) < 12)).toBe(false);
  });
});

describe('roadway affordance contract', () => {
  it('emits a lane graph: 18 lanes, stationed centrelines in travel order, neighbour line types', () => {
    expect(plan.lanes).toHaveLength(18);
    const eb = plan.lanes.find((l) => l.id === 'eb:express:1'), wb = plan.lanes.find((l) => l.id === 'wb:express:1');
    expect(eb.centreline[0][0]).toBe(0);
    expect(wb.centreline[0][0]).toBe(plan.length);
    expect(eb.left).toEqual({ lane: 'eb:express:0', line: 'broken-white' });
    expect(plan.lanes.find((l) => l.id === 'eb:collector:0').left.line).toBe('solid-yellow');
    // adjacent lane centrelines sit one lane width apart
    const l0 = plan.lanes.find((l) => l.id === 'eb:express:0').centreline[40], l1 = eb.centreline[40];
    expect(Math.hypot(l0[1] - l1[1], l0[2] - l1[2])).toBeCloseTo(3.75, 2);
  });
  it('the payload declares metres and carries the contract', () => {
    const s = assembleRoadwayScene({});
    expect(s.metersPerUnit).toBe(1);
    expect(s.roadway.lanes).toHaveLength(18);
    expect(s.roadway.structures.every((x) => Number.isFinite(x.clearanceMin) && !x.soffits)).toBe(true);
  });
  it('is deterministic: the same recipe gives byte-identical faces', () => {
    const h = (p) => createHash('sha256').update(JSON.stringify(p.faces)).digest('hex');
    expect(h(planRoadway({ seed: 3 }))).toBe(h(planRoadway({ seed: 3 })));
  });
});
