// A duel: a Race of Champions' two lanes and their crossover (course.js designDuel). The concepts: the lanes cross once,
// over a deck that clears the lower lane, and nowhere else come near each other; the two cars' laps are equal and the
// second car starts a lane over from the first; the contract's duel (both starts, the grid lane by lane, as many
// checkpoints in each leg, none on the crossover); a race on it, read from the contract alone: the rival in lane two
// on its own checkpoints, round the whole loop without backing off a wall; the words; the stadium round it.
import { describe, it, expect } from 'vitest';
import { designDuel, roadwayCourse } from './course.js';
import { DESIGN_CLASSES } from './classes.js';
import { planTrack } from './track.js';
import { trackContract, trackSurface } from './contract.js';
import { planScapedTrack } from './trackscape-dress.js';
import { composeTrack, readTrackIntent } from './trackscape-compose.js';
import { goalMechanics, raceCast } from '../gameworld/quick.js';
import { rideRule } from '../gameworld/ride.js';
import { composeMechanics } from '../game/mechanics.js';
import { simLevel } from '../game/level-sim.js';

const C = DESIGN_CLASSES.stadium, hd = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const M = { form: 'circuit', course: 'race-of-champions' }, plan = planTrack(M), T = trackContract(plan);

describe('a duel', () => {
  it('crosses once, over a deck that clears the lower lane, and keeps its lanes apart everywhere else', () => {
    for (const twist of [0, 0.8]) {
      const c = designDuel({ twist, seed: 4 });
      expect(c.selfClearance.crossings, `twist ${twist}`).toHaveLength(1);
      expect(c.selfClearance.crossings[0].dz).toBeGreaterThanOrEqual(C.clearance + 0.9 - 0.05);
      expect(c.selfClearance.conflicts, `twist ${twist}`).toEqual([]);
      expect(c.duel.gap).toBeGreaterThanOrEqual(C.footprint + 1);
    }
  });
  it('gives both cars the same lap, the second starting a lane over from the first', () => {
    const c = roadwayCourse('race-of-champions'), a = c.alignment, p0 = a.at(0), p1 = a.at(c.duel.starts[1]);
    expect(c.duel.fair).toBeLessThan(0.5);
    expect(c.duel.lap * 2).toBeCloseTo(c.length, 0);
    expect(hd([p0.x, p0.y], [p1.x, p1.y])).toBeCloseTo(c.duel.gap, 0);
    expect(Math.cos(p1.heading - p0.heading)).toBeGreaterThan(0.95);   // side by side, the same way
  });
  it('writes its contract: both starts, the grid lane by lane, as many checkpoints a leg, none on the crossover', () => {
    const D = T.duel;
    expect(D.starts).toHaveLength(2);
    expect(T.grid).toEqual(D.grid);
    expect(hd(D.grid[1].at, D.starts[0].at)).toBeLessThan(5);
    expect(hd(D.grid[0].at, D.starts[1].at)).toBeLessThan(5);
    expect(D.legs[0].length).toBe(D.legs[1].length);
    expect(T.checkpoints).toEqual(D.legs[0]);
    const x = plan.crossings[0].at;
    for (const cp of [...D.legs[0], ...D.legs[1]]) expect(hd(cp.at, x)).toBeGreaterThanOrEqual(plan.X.outer * 2 - 0.01);
    // each leg ends on the other car's start line
    expect(hd(D.legs[0].at(-1).at, D.starts[1].at)).toBeLessThan(0.5);
    expect(hd(D.legs[1].at(-1).at, D.starts[0].at)).toBeLessThan(0.5);
  });
  it('races a rival in lane two on its own checkpoints, round the whole loop, never backing off a wall', () => {
    const ride = { ref: 'r', rule: rideRule('coupe', 1) }, ground = trackSurface(plan);
    const q = { goal: 'race', ride: 'coupe', rivals: 1, laps: 2 }, ends = { roadway: T };
    const mech = goalMechanics(q, ends), cast = raceCast(q, ends, ride);
    expect(mech[0]).toMatchObject({ kind: 'laps', laps: 1, checkpoints: [...T.duel.legs[0], ...T.duel.legs[1]], rivalCheckpoints: { 'rival-1': [...T.duel.legs[1], ...T.duel.legs[0]] } });
    expect(hd(cast.pilot.transform.pos, T.duel.grid[1].at)).toBeLessThan(0.01);
    expect(hd(cast.entities[0].transform.pos, T.duel.grid[0].at)).toBeLessThan(0.01);
    expect(() => goalMechanics({ ...q, rivals: 2 }, ends)).toThrow(/rivals on a duel is 1/);
    expect(() => goalMechanics({ ...q, laps: 3 }, ends)).toThrow(/laps on a duel is 1, or an even number/);
    const player = { id: 'car', pilotable: true, rule: ride.rule, body: { type: 'none' }, transform: { ...cast.pilot.transform } };
    const m = composeMechanics(mech, { player: 'car' });
    const S = simLevel({ entities: [player, ...cast.entities.map((e) => ({ ...e, body: { type: 'none' } }))], events: m.events }, { ground: (p) => ground(p) });
    let backs = 0, passed = 0, last = 0;
    for (let k = 0; k < 90; k++) {
      S.run(1);
      if (S.world.byId['rival-1'].backT > 0) backs++;
      const now = S.bus.vars['__cp_0_rival-1'];
      if (now !== last) { passed += (now - last + mech[0].checkpoints.length) % mech[0].checkpoints.length; last = now; }
    }
    expect(backs, 'the rival backing off a wall').toBe(0);
    expect(passed, 'the rival\'s own checkpoints passed in order').toBeGreaterThanOrEqual(mech[0].checkpoints.length - 1);
    expect(S.bus.vars.__place_0, 'the player sat on the grid').toBe(2);
  }, 90000);
  it('is a Race of Champions in words, inside the stadium the words name', () => {
    const R = readTrackIntent('a race of champions in the colosseum');
    expect(R.track).toMatchObject({ class: 'stadium', duel: true });
    expect(R.venue).toBe('colosseum');
    const W = composeTrack('a race of champions', { seed: 2 });
    expect(W.course).toMatchObject({ class: 'stadium', duel: true });
    expect(W.scape.venue).toBe('football');
    expect(W.scape.stands).toBeUndefined();
    // (a venue stands only round a duel, and a point-to-point stage is never one)
    const stage = readTrackIntent('a rally stage through a colosseum');
    expect(stage.track.duel).toBeUndefined();
    expect(stage.venue).toBeUndefined();
  });
  it('stands in its stadium: the bowl round the whole footprint, no arena or surrounds, the same words the same bytes', () => {
    const V = planScapedTrack({ ...M, kit: { look: 'realistic', seed: 1 }, scape: { venue: 'football' } });
    expect(V.scape.venue).toMatchObject({ preset: 'football' });
    expect(V.scape.arena).toBeUndefined();
    expect(V.scape.surrounds).toBeUndefined();
    const extra = V.faces.slice(planTrack({ ...M, kit: { look: 'realistic', seed: 1 } }).faces.length);
    expect(extra.length).toBeGreaterThan(500);
    // the bowl stands clear of every station of the track
    const xs = plan.stations.map((s) => s.x), ys = plan.stations.map((s) => s.y);
    const box = [Math.min(...xs) - plan.X.outer, Math.max(...xs) + plan.X.outer, Math.min(...ys) - plan.X.outer, Math.max(...ys) + plan.X.outer];
    const tall = extra.filter((f) => f.corners.some((p) => p[2] > 2));
    for (const f of tall) for (const p of f.corners) expect(p[0] < box[0] || p[0] > box[1] || p[1] < box[2] || p[1] > box[3], `a stand at ${p}`).toBe(true);
    expect(JSON.stringify(planScapedTrack({ ...M, kit: { look: 'realistic', seed: 1 }, scape: { venue: 'football' } }).faces.length)).toBe(JSON.stringify(V.faces.length));
  }, 60000);
});
