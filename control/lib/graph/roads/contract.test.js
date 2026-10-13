// Driving primitives D3 laws: what a track tells a game. The checkpoints come round to the finish, the grid stands on
// the road behind the start, the racing line stays inside the road and is straighter than the centreline, the surface
// hook finds the right pass at a crossing, and rivals race every preset on its own drawn surface through the race's
// own mechanics (laps, place) — the contract is all they read.
import { describe, it, expect } from 'vitest';
import { DESIGN_CLASSES } from './classes.js';
import { planTrack } from './track.js';
import { trackContract, trackSurface, racingLine, LINE_EDGE } from './contract.js';
import { goalMechanics, raceCast, RACE } from '../gameworld/quick.js';
import { rideRule } from '../gameworld/ride.js';
import { composeMechanics } from '../game/mechanics.js';
import { simLevel } from '../game/level-sim.js';

const CASES = [['circuit', 'kart-oval'], ['circuit', 'figure-eight'], ['circuit', 'stunt-park'], ['circuit', 'hillside'], ['stage', 'rally-stage']];
const plans = Object.fromEntries(CASES.map(([form, course]) => [course, planTrack({ form, course })]));
const contracts = Object.fromEntries(Object.entries(plans).map(([k, p]) => [k, trackContract(p)]));
const hd = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
// the road's centre and offset nearest a point (the drawn alignment's)
const offsetOf = (plan, p) => {
  let best = null;
  for (const st of plan.alignment.stations({ fine: 1, coarse: 1 })) { const d = Math.hypot(p[0] - st.x, p[1] - st.y); if (!best || d < best.d) best = { d, st }; }
  return best;
};
// peak curvature of a polyline over 6 m chords
const peakK = (pts, gap = 2) => {
  let m = 0;
  for (let i = gap; i < pts.length - gap; i++) {
    const a = pts[i - gap], b = pts[i], c = pts[i + gap], ab = hd(a, b), bc = hd(b, c), ac = hd(a, c);
    const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
    if (ab > 0 && bc > 0 && ac > 0) m = Math.max(m, (4 * area) / (ab * bc * ac));
  }
  return m;
};

describe('the contract', () => {
  it('carries its form, class, widths and stations; headings in (−π, π]', () => {
    for (const [name, T] of Object.entries(contracts)) {
      const C = DESIGN_CLASSES[T.class];
      expect(T.width, name).toBeCloseTo(C.roadW, 6);
      expect(T.footprint, name).toBeCloseTo(C.footprint, 6);
      expect(T.columns).toEqual(['s', 'x', 'y', 'z', 'heading', 'bank']);
      expect(T.stations.length, name).toBeGreaterThan(T.length / 6);
      for (const st of T.stations) expect(Math.abs(st[4]), name).toBeLessThanOrEqual(Math.PI + 1e-3);
      expect(JSON.stringify(T).length, name).toBeLessThan(60000);
    }
  });
  it('checkpoints every leg come round to the finish (a lap\'s start), none at a crossing', () => {
    for (const [name, T] of Object.entries(contracts)) {
      const last = T.checkpoints[T.checkpoints.length - 1].at;
      expect(hd(last, T.finish.at), name).toBeLessThan(0.01);
      if (T.closed) expect(hd(last, T.start.at), name).toBeLessThan(0.01);
      for (let i = 1; i < T.checkpoints.length; i++) expect(hd(T.checkpoints[i].at, T.checkpoints[i - 1].at), name).toBeGreaterThan(8);
      for (const c of T.crossings) for (const cp of T.checkpoints) expect(hd(cp.at, c.at), name).toBeGreaterThan(T.footprint / 2);
    }
    expect(contracts['rally-stage'].start.s).toBe(30);
  });
  it('the grid stands on the road, two abreast behind the start, the pole first', () => {
    const plan = plans['kart-oval'], T = contracts['kart-oval'];
    for (const [name, C] of Object.entries(contracts)) {
      const p = plans[name];
      C.grid.forEach((g, k) => {
        const n = offsetOf(p, g.at);
        expect(n.d, `${name} slot ${k}`).toBeLessThan(C.width / 2 - 1);
        // behind the line: along the start's heading, back of it
        const back = (C.start.at[0] - g.at[0]) * Math.cos(C.start.heading) + (C.start.at[1] - g.at[1]) * Math.sin(C.start.heading);
        expect(back, `${name} slot ${k}`).toBeGreaterThan(3);
      });
    }
    expect(T.grid).toHaveLength(8);
    expect(hd(T.grid[0].at, T.start.at)).toBeLessThan(hd(T.grid[7].at, T.start.at));
    expect(plan).toBeTruthy();
  });
  it('names its bands one side out, kerbs on the corners, and its ramps with their lips placed', () => {
    expect(contracts['kart-oval'].bands.map((b) => b.kind)).toEqual(['road', 'kerb', 'runoff', 'barrier']);
    expect(contracts['rally-stage'].bands.map((b) => b.kind)).toEqual(['road', 'runoff']);
    expect(contracts['hillside'].bands.find((b) => b.kind === 'runoff')).toMatchObject({ surface: 'grass', outside: 'gravel' });
    const gap = contracts['stunt-park'].ramps.find((r) => r.kind === 'gap');
    expect(gap.lip.at).toHaveLength(3);
    expect(gap.band.lo).toBeGreaterThan(0);
  });
});

describe('the racing line', () => {
  it('stays on the road, a car and a lane in from its edges', () => {
    for (const [name, plan] of Object.entries(plans)) for (const q of racingLine(plan)) expect(Math.abs(q.o), name).toBeLessThanOrEqual(plan.X.road - LINE_EDGE + 1e-9);
  });
  it('is straighter than the centreline: its tightest bend is wider', () => {
    for (const [name, plan] of Object.entries(plans)) {
      const line = racingLine(plan), centre = line.map((q) => { const p = plan.alignment.at(q.s); return [p.x, p.y]; });
      expect(peakK(line.map((q) => [q.x, q.y])), name).toBeLessThan(peakK(centre));
    }
  });
  it('takes the inside at a corner\'s apex', () => {
    const plan = plans['kart-oval'], line = racingLine(plan);
    const apex = line.reduce((b, q) => (Math.abs(plan.alignment.at(q.s).k) > Math.abs(plan.alignment.at(b.s).k) ? q : b));
    const mid = line.filter((q) => Math.abs(plan.alignment.at(q.s).k) > 0.04);
    // inside: the offset's sign is the bend's (k > 0 turns left, the left is +)
    expect(mid.filter((q) => Math.sign(q.o) === Math.sign(plan.alignment.at(q.s).k)).length / mid.length).toBeGreaterThan(0.8);
    expect(apex).toBeTruthy();
  });
});

describe('the surface a car drives on', () => {
  it('is the drawn road (ramps and bank included), and at a crossing the pass under the probe', () => {
    const plan = plans['stunt-park'], ground = trackSurface(plan), gap = plan.course.ramps.find((r) => r.kind === 'gap');
    const lip = plan.alignment.at(gap.lip.s - 0.01);
    expect(ground([lip.x, lip.y, 50])).toBeCloseTo(lip.z, 2);
    const f8 = plans['figure-eight'], g8 = trackSurface(f8), c = f8.crossings[0];
    const up = f8.alignment.at(c.upper === 1 ? c.s1 : c.s2), low = f8.alignment.at(c.upper === 1 ? c.s2 : c.s1);
    expect(g8([up.x, up.y, up.z + 3])).toBeCloseTo(up.z, 1);           // a car on the deck: the deck
    expect(g8([low.x, low.y, low.z + 3])).toBeCloseTo(low.z, 1);        // a car under it: the lower road
    expect(g8([up.x + 400, up.y + 400, 10])).toBeCloseTo(f8.terrain.zFar, 6);
  });
});

describe('rivals race every preset on its drawn surface, reading nothing but the contract', () => {
  const ride = { ref: 'r', rule: rideRule('coupe', 1) };
  for (const [name, secs, laps] of [['kart-oval', 50, 3], ['figure-eight', 80, 3], ['stunt-park', 100, 2], ['hillside', 130, 2], ['rally-stage', 140, 1]]) {
    it(name, () => {
      const plan = plans[name], T = contracts[name], ground = trackSurface(plan);
      const q = { goal: 'race', ride: 'coupe', rivals: 3, laps: 2 }, ends = { roadway: T };
      const mech = goalMechanics(q, ends), cast = raceCast(q, ends, ride);
      expect(mech[0]).toMatchObject({ kind: 'laps', checkpoints: T.checkpoints, rivals: ['rival-1', 'rival-2', 'rival-3'] });
      if (T.closed) expect(mech[0].laps).toBe(2); else expect(mech[0].laps).toBeUndefined();
      expect(cast.entities.map((e) => e.rule.lane)).toEqual([RACE.roadLane, -RACE.roadLane, RACE.roadLane]);
      const player = { id: 'car', pilotable: true, rule: ride.rule, body: { type: 'none' }, transform: { ...cast.pilot.transform } };
      const m = composeMechanics(mech, { player: 'car' });
      const S = simLevel({ entities: [player, ...cast.entities.map((e) => ({ ...e, body: { type: 'none' } }))], events: m.events }, { ground: (p) => ground(p) });
      let backs = 0;
      for (let k = 0; k < secs; k++) { S.run(1); for (const id of ['rival-1', 'rival-2', 'rival-3']) if (S.world.byId[id].backT > 0) backs++; }
      for (const id of ['rival-1', 'rival-2', 'rival-3']) {
        const e = S.world.byId[id];
        if (T.closed) expect(e.laps, `${id} laps`).toBeGreaterThanOrEqual(laps);
        else expect(hd(e.transform.pos, T.finish.at), `${id} to the finish`).toBeLessThan(40);
      }
      expect(backs, 'a rival backing off a wall').toBe(0);
      // the player sat on the grid: last of four
      expect(S.bus.vars.__place_0).toBe(4);
    }, 60000);
  }
});
