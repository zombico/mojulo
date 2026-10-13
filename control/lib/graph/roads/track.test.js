// Driving primitives D2 laws: the roadway's circuit and stage forms, measured from what was drawn (trackCensus) —
// the road as wide as its class, banked within it, its corners and grades held, the ground under every footprint, a
// crossing's deck at the class clearance over the lower road, the ramps standing on walls, the far ground never under
// the terrain. The corridor stays the freeway (roadway.char.test.js pins it).
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { DESIGN_CLASSES } from './classes.js';
import { planTrack, trackCensus, trackLaws, trackSection, trackCourse, terrainAt, TRACK_TEMPLATES, SURFACES } from './track.js';
import { assembleRoadwayScene } from './roadway.js';

const CASES = [['circuit', 'kart-oval'], ['circuit', 'kart-sprint'], ['circuit', 'figure-eight'], ['circuit', 'hillside'], ['circuit', 'stunt-park'], ['stage', 'rally-stage']];
const plans = Object.fromEntries(CASES.map(([form, course]) => [course, planTrack({ form, course })]));
const census = Object.fromEntries(Object.entries(plans).map(([k, p]) => [k, trackCensus(p)]));

describe('the track templates', () => {
  it('sum each class\'s cross-section to its footprint, barrier to barrier', () => {
    for (const k of Object.keys(TRACK_TEMPLATES)) expect(trackSection(k).outer * 2, k).toBeCloseTo(DESIGN_CLASSES[k].footprint, 9);
    expect(() => trackSection('freeway')).toThrow(/no track template/);
    for (const T of Object.values(TRACK_TEMPLATES)) for (const s of [T.road, T.runoffSurface, T.outside]) expect(SURFACES[s]).toBeTruthy();
  });
});

describe('forms', () => {
  it('a circuit is a lap and a stage runs end to end; each refuses the other\'s course, and an unknown form', () => {
    expect(trackCourse({ form: 'circuit' }).preset).toBe('kart-oval');
    expect(trackCourse({ form: 'stage' }).preset).toBe('rally-stage');
    expect(() => trackCourse({ form: 'circuit', course: 'rally-stage' })).toThrow(/a circuit is a lap/);
    expect(() => trackCourse({ form: 'stage', course: 'kart-oval' })).toThrow(/a stage runs end to end/);
    expect(() => assembleRoadwayScene({ form: 'oval' })).toThrow(/form 'oval' is not one of circuit, stage, corridor/);
    expect(trackCourse({ form: 'stage', course: { class: 'rally', length: 800, seed: 4 } }).closed).toBe(false);
    expect(trackCourse({ form: 'circuit', course: { class: 'kart', length: 500, seed: 4 } }).closed).toBe(true);
  });
  it('the roadway kind draws a track for a circuit or a stage, and the freeway without a form', () => {
    const t = assembleRoadwayScene({ form: 'circuit', course: 'kart-oval' });
    expect(t.roadway).toMatchObject({ form: 'circuit', class: 'kart', course: 'kart-oval', closed: true });
    expect(t.metersPerUnit).toBe(1);
    expect(t.cameras.map((c) => c.name)).toEqual(['chase', 'aerial']);
    expect(assembleRoadwayScene({ form: 'circuit', course: 'kart-oval' }, { view: 's100' }).cameras[0].name).toBe('here:100');
    expect(assembleRoadwayScene({ form: 'corridor', traffic: false }).roadway.lanes.length).toBeGreaterThan(0);
  });
});

describe('the census of every preset', () => {
  it('road as wide as its class, banked no more than its e_max, corners and grades (off the ramps) in class', () => {
    for (const [name, c] of Object.entries(census)) {
      const C = DESIGN_CLASSES[c.class];
      expect(c.roadWidth[0], name).toBeCloseTo(C.roadW, 2);
      expect(c.roadWidth[1], name).toBeCloseTo(C.roadW, 2);
      expect(c.bankMax, name).toBeLessThanOrEqual(C.emax + 1e-3);
      expect(c.radiusMin, name).toBeGreaterThanOrEqual(C.rmin - 1e-3);
      expect(c.gradeMax, name).toBeLessThanOrEqual(C.gradeMax + 1e-3);
      if (c.closed) expect(c.closure.residual, name).toBeLessThan(0.01);
    }
  });
  it('the ground stands under every point of every footprint, never above the drawn surface', () => {
    for (const [name, c] of Object.entries(census)) expect(c.terrainOverRoad.max, `${name} at ${JSON.stringify(c.terrainOverRoad.at)}`).toBeLessThan(-0.02);
  });
  it('the figure of eight\'s deck clears the lower road by the class clearance over its whole width', () => {
    const c = census['figure-eight'];
    expect(c.crossings).toHaveLength(1);
    expect(c.crossings[0].clearance).toBeGreaterThanOrEqual(DESIGN_CLASSES.kart.clearance - 0.01);
    for (const [name, x] of Object.entries(census)) if (name !== 'figure-eight') expect(x.crossings, name).toEqual([]);
  });
  it('the stunt park\'s gap and tabletop each land a band of speeds; its ramps stand on walls down to the ground', () => {
    const c = census['stunt-park'];
    for (const k of ['gap', 'tabletop']) expect(c.ramps.find((r) => r.kind === k).band).not.toBeNull();
    // the same rally lap without its ramps (a rally track has no barrier: every tall untextured face is a wall)
    const walls = (p) => p.faces.filter((f) => !f.texture && Math.max(...f.corners.map((q) => q[2])) - Math.min(...f.corners.map((q) => q[2])) > 0.3).length;
    const bare = planTrack({ form: 'circuit', course: { class: 'rally', length: 1100, twist: 0.3, elevation: { amplitude: 5, hills: 2, crest: 'sharp' }, seed: 5 } });
    expect(walls(bare)).toBe(0);
    expect(walls(plans['stunt-park'])).toBeGreaterThan(20);
  });
});

describe('the laws', () => {
  it('every preset holds every law, in the gameworld\'s shape; a lap says it closes, a crossing its clearance, a ramp its speeds', () => {
    for (const [name, c] of Object.entries(census)) {
      const laws = trackLaws(c);
      expect(laws.filter((l) => !l.holds), name).toEqual([]);
      for (const l of laws) expect(l).toEqual({ concern: 'roadway', law: expect.any(String), holds: true, says: expect.any(String) });
    }
    expect(trackLaws(census['figure-eight']).map((l) => l.law)).toEqual(['road-width', 'corners', 'grade', 'bank', 'closes', 'on-its-ground', 'clearance']);
    expect(trackLaws(census['rally-stage']).some((l) => l.law === 'closes')).toBe(false);
    expect(trackLaws(census['stunt-park']).filter((l) => l.law === 'ramp-lands').map((l) => l.says)).toEqual([expect.stringMatching(/^the gap at .* lands at 40–43 km\/h$/), expect.stringMatching(/^the tabletop at .* lands at 39–43 km\/h$/)]);
    const bad = { ...census['kart-oval'], terrainOverRoad: { max: 0.3, at: { s: 1, o: 2 } } };
    expect(trackLaws(bad).find((l) => l.law === 'on-its-ground')).toMatchObject({ holds: false, says: 'the ground stands 0.3 m over the track at {"s":1,"o":2}' });
  });
});

describe('the ground', () => {
  it('is never under the far ground: the far tiles stop at the terrain grid\'s edge', () => {
    for (const [name, p] of Object.entries(plans)) {
      const T = p.terrain, bx0 = T.x0, by0 = T.y0, bx1 = T.x0 + T.nx * T.cell, by1 = T.y0 + T.ny * T.cell;
      const far = p.faces.filter((f) => f.corners.every((q) => q[2] === T.zFar) && Math.abs(f.corners[0][0] - f.corners[1][0]) + Math.abs(f.corners[0][1] - f.corners[1][1]) > T.cell * 1.5);
      expect(far.length, name).toBeGreaterThan(0);
      for (const f of far) {
        const xs = f.corners.map((q) => q[0]), ys = f.corners.map((q) => q[1]);
        const overlap = Math.min(...xs) < bx1 - 1e-6 && Math.max(...xs) > bx0 + 1e-6 && Math.min(...ys) < by1 - 1e-6 && Math.max(...ys) > by0 + 1e-6;
        expect(overlap, name).toBe(false);
      }
      expect(terrainAt(T, bx1 + 100, by1 + 100)).toBe(T.zFar);
    }
  });
  it('a crossing keeps the lower road\'s ground under the deck', () => {
    const p = plans['figure-eight'], c = p.crossings[0], lower = p.alignment.at(c.upper === 1 ? c.s2 : c.s1);
    expect(terrainAt(p.terrain, lower.x, lower.y)).toBeLessThan(lower.z);
    expect(terrainAt(p.terrain, lower.x, lower.y)).toBeGreaterThan(lower.z - 0.3);
  });
});

describe('determinism', () => {
  it('the same manifest draws byte-identical faces', () => {
    const h = (m) => createHash('sha256').update(JSON.stringify(planTrack(m).faces)).digest('hex');
    expect(h({ form: 'circuit', course: 'stunt-park' })).toBe(h({ form: 'circuit', course: 'stunt-park' }));
  });
});
