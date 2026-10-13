// Driving primitives D1 laws: a roadway's line at every scale. Measured on the alignment's own stations, never on the
// params that asked for it: a lap closes, its corners and grades hold their class, its hills and ramps are where the
// dials said, it keeps clear of itself (a figure of eight crosses once, over a bridge).
import { describe, it, expect } from 'vitest';
import { DESIGN_CLASSES, designClass, crestFlightSpeed } from './classes.js';
import { fromPIs, designRoadway, designStage, roadwayCourse, selfClearance, elevationPVIs, COURSE_PRESETS } from './course.js';
import { ramp, rampReach, lipSpeedBand } from './ramps.js';
import { buildAlignment } from './alignment.js';

const measure = (c) => {
  const a = c.alignment, st = a.stations({ fine: 2, coarse: 5 });
  const inRamp = (s) => (a.profile.features || []).some((f) => s >= f.s0 - 0.5 && s <= f.s1 + 0.5);
  let rmin = Infinity, gmax = 0, emax = 0;
  for (const p of st) {
    if (Math.abs(p.k) > 1e-9) rmin = Math.min(rmin, 1 / Math.abs(p.k));
    if (!inRamp(p.s)) gmax = Math.max(gmax, Math.abs(p.grade));
    emax = Math.max(emax, p.e);
  }
  return { rmin, gmax, emax };
};
const all = Object.fromEntries(Object.keys(COURSE_PRESETS).map((k) => [k, roadwayCourse(k)]));
const presets = Object.fromEntries(Object.entries(all).filter(([, c]) => c.closed));

describe('design classes', () => {
  it('keep the freeway at the spike\'s numbers and size the rest so their crests hold a car at design speed', () => {
    expect(DESIGN_CLASSES.freeway).toMatchObject({ designSpeed: 120, rmin: 750, emax: 0.06, crestK: 95, sagK: 63 });
    for (const k of ['kart', 'circuit', 'rally']) {
      const c = DESIGN_CLASSES[k];
      expect(crestFlightSpeed(c.crestK)).toBeGreaterThanOrEqual(c.designSpeed / 3.6);
      expect(c.rmin).toBeLessThan(c.rmax);
    }
    expect(() => designClass('hovercraft')).toThrow(/not one of kart, circuit, rally, freeway/);
  });
});

describe('a lap from its points', () => {
  it('closes: the integrated end lands within a centimetre and a tenth of a degree of the start, then is snapped on', () => {
    for (const [name, c] of Object.entries(presets)) {
      const a = c.alignment;
      expect(a.closed, name).toBe(true);
      expect(a.closure.residual, name).toBeLessThan(0.01);
      expect(Math.abs(a.closure.heading), name).toBeLessThan((0.1 * Math.PI) / 180);
      const end = a.at(a.length - 1e-3), s0 = a.at(0);
      expect(Math.hypot(end.x - s0.x, end.y - s0.y), name).toBeLessThan(0.01);
      expect(end.z, name).toBeCloseTo(s0.z, 2);
    }
  });
  it('turns once round (a figure of eight not at all), and its stations wrap', () => {
    expect(presets['kart-oval'].alignment.closure.turns).toBe(1);
    expect(presets['figure-eight'].alignment.closure.turns).toBe(0);
    const a = presets['kart-oval'].alignment;
    expect(a.at(a.length + 10).x).toBeCloseTo(a.at(10).x, 9);
    expect(a.stations().every((p) => p.s < a.length)).toBe(true);
  });
  it('holds every preset inside its class: corners no tighter than R_min, grades (off the ramps) and banks within', () => {
    for (const [name, c] of Object.entries(all)) {
      const cls = DESIGN_CLASSES[c.class], m = measure(c);
      expect(m.rmin, name).toBeGreaterThanOrEqual(cls.rmin - 1e-6);
      expect(m.gmax, name).toBeLessThanOrEqual(cls.gradeMax + 1e-9);
      expect(m.emax, name).toBeLessThanOrEqual(cls.emax + 1e-9);
    }
  });
  it('a stage runs from its first point to its last, its ends no corner', () => {
    const c = fromPIs({ class: 'rally', closed: false, pis: [[0, 0], [300, 0, 60], [500, 200, 60], [500, 500]] });
    const a = c.alignment, e = a.at(a.length);
    expect(a.closed).toBe(false);
    expect(a.at(0).x).toBeCloseTo(0, 6);
    expect(Math.hypot(e.x - 500, e.y - 500)).toBeLessThan(0.05);
    expect(c.pis[0]).toHaveLength(2);
  });
  it('opens a corner down to the class\'s tightest to fit its legs, says so, and refuses a leg no corner fits', () => {
    const c = fromPIs({ class: 'kart', pis: [[0, 0, 40], [60, 0, 40], [60, 60, 40], [0, 60, 40]] });
    expect(c.advisories.some((a) => /tightened from R 40/.test(a))).toBe(true);
    expect(() => fromPIs({ class: 'kart', pis: [[0, 0], [10, 0], [10, 10], [0, 10]] })).toThrow(/too short for its corners/);
    expect(() => fromPIs({ class: 'kart', pis: [[0, 0], [10, 0]] })).toThrow(/needs 3 points/);
  });
});

describe('a closed profile and hills', () => {
  it('comes back to its start with a vertical curve across the seam: z and grade continuous', () => {
    const c = presets.hillside, a = c.alignment;
    for (const s of [a.length - 0.01, 0.01]) expect(a.at(s).z).toBeCloseTo(a.at(0).z, 1);
    expect(a.at(a.length - 0.01).grade).toBeCloseTo(a.at(0.01).grade, 3);
  });
  it('lays `hills` crests `amplitude` metres over the sags, held to the class grade (and advised when held)', () => {
    const cls = designClass('circuit');
    const asked = elevationPVIs({ length: 1800, cls, closed: true, amplitude: 10, hills: 3, seed: 2 });
    expect(asked.pvis.filter((p) => p.z > 0)).toHaveLength(3);
    expect(Math.max(...asked.pvis.map((p) => p.z))).toBe(10);
    expect(asked.advisories).toEqual([]);
    const steep = elevationPVIs({ length: 600, cls, closed: true, amplitude: 80, hills: 3, seed: 2 });
    expect(Math.max(...steep.pvis.map((p) => p.z))).toBeLessThan(80);
    expect(steep.advisories[0]).toMatch(/hills held to .* the class climbs 12% at most/);
    const z = presets.hillside.alignment.stations().map((p) => p.z);
    expect(Math.max(...z) - Math.min(...z)).toBeGreaterThan(10);
  });
  it('a sharp crest flies at three quarters of the design speed; a smooth one holds the car down at it', () => {
    const cls = designClass('rally');
    const sharp = elevationPVIs({ length: 1200, cls, closed: true, amplitude: 4, hills: 2, crest: 'sharp' });
    const K = sharp.pvis.find((p) => p.z > 0).K;
    expect(crestFlightSpeed(K)).toBeLessThanOrEqual((cls.designSpeed / 3.6) * 0.76);
    expect(elevationPVIs({ length: 1200, cls, closed: true, amplitude: 4, hills: 2 }).pvis.every((p) => p.K === undefined)).toBe(true);
  });
});

describe('ramps', () => {
  const flat = (features) => buildAlignment({ elements: [{ type: 'tangent', length: 300 }], profile: { z0: 0, pvis: [], features } });
  it('a kicker rises on a circle to its lip angle and drops behind it', () => {
    const k = ramp({ kind: 'kicker', at: 100, h: 1.2, angle: 24 }), a = flat([k]);
    expect(a.at(k.lip.s - 0.01).z).toBeCloseTo(1.2, 1);
    expect(Math.atan(a.at(k.lip.s - 0.01).grade) * 180 / Math.PI).toBeCloseTo(24, 0);
    expect(a.at(100).grade).toBeCloseTo(0, 6);
    expect(a.at(k.s1 + 0.01).z).toBeCloseTo(0, 6);
  });
  it('a car off a kicker over flat ground flies the ballistic range (within its sampling step)', () => {
    const k = ramp({ kind: 'kicker', at: 100, h: 1.2, angle: 24 }), a = flat([k]);
    for (const v of [8, 14, 20]) {
      const p = a.at(k.lip.s - 0.01), th = Math.atan(p.grade), vz = v * Math.sin(th), g = 9.81;
      const t = (vz + Math.sqrt(vz * vz + 2 * g * p.z)) / g;
      expect(rampReach(k, a, v).x).toBeCloseTo(v * Math.cos(th) * t, 0);
    }
  });
  it('a tabletop and a gap land a band of speeds on their landing slopes; too slow cases the gap', () => {
    const t = ramp({ kind: 'tabletop', at: 50 }), gp = ramp({ kind: 'gap', at: 150 }), a = flat([t, gp]);
    for (const f of [t, gp]) {
      const band = lipSpeedBand(f, a, 30);
      expect(band.lo).toBeLessThan(band.hi);
      expect(rampReach(f, a, (band.lo + band.hi) / 2).onLanding).toBe(true);
      expect(rampReach(f, a, band.hi + 3).onLanding).toBe(false);
    }
    expect(rampReach(gp, a, 4).s).toBeLessThan(gp.landing.s0);
  });
  it('the stunt park lays all four on its straights, clear of the start', () => {
    const c = presets['stunt-park'];
    expect(c.ramps.map((r) => r.kind).sort()).toEqual(['gap', 'kicker', 'tabletop', 'whoops']);
    for (const r of c.ramps) {
      expect(r.s0).toBeGreaterThan(15);
      for (let s = r.s0; s <= r.s1; s += 1) expect(Math.abs(c.alignment.at(s).k)).toBeLessThan(1e-9);
    }
    expect(c.ramps.find((r) => r.kind === 'gap').band).not.toBeNull();
    expect(() => fromPIs({ class: 'kart', pis: [[0, 0], [200, 0], [100, 150]], ramps: ['loop-de-loop'] })).toThrow(/not one of kicker/);
  });
});

describe('a line that keeps clear of itself', () => {
  it('finds a lap that dents back onto itself (a straight 6 m from another, the road 8 m wide)', () => {
    const fold = fromPIs({ class: 'kart', pis: [[0, 0, 10], [200, 0, 10], [200, 100, 10], [130, 100, 8], [130, 6, 8], [70, 6, 8], [70, 100, 8], [0, 100, 10]] });
    const sc = selfClearance(fold.alignment, { width: fold.width, margin: 3 });
    expect(sc.conflicts.length).toBeGreaterThan(0);
  });
  it('every preset keeps its footprint clear; the figure of eight crosses once, its upper pass a deck over the class clearance', () => {
    for (const [name, c] of Object.entries(all)) {
      const sc = selfClearance(c.alignment, { width: c.footprint, margin: 1 });
      expect(sc.conflicts, name).toEqual([]);
      if (name === 'figure-eight') {
        expect(sc.crossings).toHaveLength(1);
        expect(sc.crossings[0].dz).toBeGreaterThanOrEqual(DESIGN_CLASSES.kart.clearance);
      } else expect(sc.crossings, name).toEqual([]);
    }
  });
});

describe('a stage', () => {
  it('runs one end to the other near its asked length, never folding back, its crests cut to fly where asked', () => {
    const c = all['rally-stage'], a = c.alignment;
    expect(a.closed).toBe(false);
    expect(Math.abs(c.length - 2000)).toBeLessThan(20);
    // its heading never turns more than 70° off the way on (+x): every station still makes way along it
    for (const p of a.stations({ fine: 4, coarse: 10 })) expect(Math.cos(p.heading)).toBeGreaterThan(Math.cos((71 * Math.PI) / 180));
    const z = a.stations().map((p) => p.z);
    expect(Math.max(...z)).toBeGreaterThan(8);
    expect(JSON.stringify(designStage({ length: 1200, seed: 3 }).pis)).toBe(JSON.stringify(designStage({ length: 1200, seed: 3 }).pis));
    expect(roadwayCourse({ class: 'rally', closed: false, length: 900, seed: 2 }).design.form).toBe('stage');
  });
});

describe('the designer', () => {
  it('is deterministic per seed, varies across seeds, and lands near the asked length', () => {
    const a = designRoadway({ class: 'kart', length: 700, twist: 0.7, seed: 4 }), b = designRoadway({ class: 'kart', length: 700, twist: 0.7, seed: 4 });
    expect(JSON.stringify(a.pis)).toBe(JSON.stringify(b.pis));
    expect(JSON.stringify(designRoadway({ class: 'kart', length: 700, twist: 0.7, seed: 5 }).pis)).not.toBe(JSON.stringify(a.pis));
    expect(Math.abs(a.length - 700)).toBeLessThan(7);
  });
  it('reads a preset, a PI spec or a designer spec; refuses an unknown preset with the list', () => {
    expect(roadwayCourse('kart-oval').preset).toBe('kart-oval');
    expect(roadwayCourse({ class: 'kart', pis: [[0, 0], [200, 0], [100, 150]] }).closed).toBe(true);
    expect(roadwayCourse({ class: 'rally', length: 900, seed: 2 }).design.length).toBe(900);
    expect(() => roadwayCourse('monaco')).toThrow(/not one of kart-oval/);
  });
});
