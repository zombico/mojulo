// A gameworld level that is a roadway (roads/track.js): `roadway: { form?, course?, dress? }` in place of `walk`, a track
// built for driving on its own ground, played by one stage. The laws: it reads and refuses like any level setting; it
// lays one stage whose anchors are its contract's (the grid's pole, the finish); a race on it takes the contract's
// checkpoints, grid and racing line; its laws are the track's own; its barriers stop a car; the quick race names one;
// the bible, the graph and the story know it.
import { describe, it, expect } from 'vitest';
import { readGameworld, resolveLevel, MEADOWMARK } from './index.js';
import { gameStages, stageLevelOrder, roadwayEnds } from './levels.js';
import { gameworldBibleHtml } from './bible-html.js';
import { gameworldGraph } from './graph.js';
import { quickWorld, goalMechanics, raceCast, readQuick } from './quick.js';
import { rideRule } from './ride.js';
import { assembleRoadwayScene } from '../roads/roadway.js';
import { planTrack, trackSection } from '../roads/track.js';
import { composeMechanics } from '../game/mechanics.js';
import { simLevel } from '../game/level-sim.js';

const withRoadway = (W, roadway = { course: 'kart-oval' }) => ({ ...W, levels: { ...W.levels, track: { name: 'The Track', roadway } } });
const ride = { ref: 'r', rule: rideRule('coupe', 1) };

describe('a roadway level reads like any level', () => {
  it('its settings held to the roadway\'s, never a walk, a building or a city beside it', () => {
    expect(() => readGameworld(withRoadway(MEADOWMARK))).not.toThrow();
    expect(() => readGameworld(withRoadway(MEADOWMARK, { course: 'kart-oval', lanes: 2 }))).toThrow(/roadway.lanes is not a roadway level setting \(form, course, dress\)/);
    expect(() => readGameworld(withRoadway(MEADOWMARK, { form: 'oval' }))).toThrow(/roadway.form is circuit or stage/);
    expect(() => readGameworld(withRoadway(MEADOWMARK, { course: 'monaco' }))).toThrow(/roadway.course is a preset \(kart-oval/);
    expect(() => readGameworld(withRoadway(MEADOWMARK, { dress: 'lots' }))).toThrow(/roadway.dress is true, false or/);
    const both = { ...MEADOWMARK, levels: { ...MEADOWMARK.levels, x: { roadway: {}, walk: { nodes: { a: { trail: true } } } } } };
    expect(() => readGameworld(both)).toThrow(/a walk, a building, a city or a roadway, one of them/);
    const ground = { ...MEADOWMARK, levels: { ...MEADOWMARK.levels, x: { roadway: {}, ground: { edits: [] } } } };
    expect(() => readGameworld(ground)).toThrow(/a roadway lays its own ground/);
  });
  it('resolves to its course and form: a lap unless its course runs end to end', () => {
    expect(resolveLevel(withRoadway(MEADOWMARK), 'track').roadway).toEqual({ form: 'circuit', course: 'kart-oval' });
    expect(resolveLevel(withRoadway(MEADOWMARK, { course: 'rally-stage' }), 'track').roadway.form).toBe('stage');
    expect(resolveLevel(withRoadway(MEADOWMARK, { course: { class: 'rally', length: 900, closed: false, seed: 2 } }), 'track').roadway.form).toBe('stage');
    expect(resolveLevel(withRoadway(MEADOWMARK, {}), 'track').roadway.course).toBe('kart-oval');
    expect(resolveLevel(withRoadway(MEADOWMARK), 'track').level).toBeNull();
  });
});

describe('laid as one stage', () => {
  const W = withRoadway(MEADOWMARK, { course: 'figure-eight', dress: true });
  const st = gameStages(W).find((s) => s.level === 'track');
  it('of the roadway kind, its anchors its contract\'s: the pole to start on, the finish to end at', () => {
    expect(st).toMatchObject({ node: 'roadway', section: 'roadway', index: 0, manifest: { kind: 'roadway', form: 'circuit', course: 'figure-eight', dress: true } });
    const ends = roadwayEnds(st.manifest);
    expect(ends.spawn).toEqual(ends.roadway.grid[0].at);
    expect(ends.exit).toEqual(ends.roadway.finish.at);
    expect(Object.keys(ends)).toEqual(['spawn', 'heading', 'exit', 'exitFrom', 'planar', 'beats', 'hazards']);
    expect(ends.ground(ends.spawn[0], ends.spawn[1])).toBeCloseTo(ends.spawn[2], 2);
    expect(ends.colliders.length).toBeGreaterThan(100);
  });
  it('a race on it: the cars on its grid, rivals on its racing line, its checkpoints the laps\', its laws the track\'s', () => {
    const q = { goal: 'race', ride: 'coupe', rivals: 3 }, G = readGameworld(W);
    const L = stageLevelOrder(G, st, { ref: 'x', goal: (e) => goalMechanics(q, e), ride, extra: (e) => raceCast(q, e, ride) });
    const m = L.args.manifest, T = L.ends.roadway;
    expect(m).toMatchObject({ kind: 'roadway', form: 'circuit', course: 'figure-eight' });
    expect(m.entities.map((e) => e.id)).toEqual(['car', 'rival-1', 'rival-2', 'rival-3']);
    expect(m.entities[0].transform.pos).toEqual(T.grid[3].at);
    expect(m.entities[1].rule).toMatchObject({ type: 'racer', closed: true });
    expect(m.entities[1].rule.line).toHaveLength(T.line.length);
    expect(m.game.mechanics[0]).toMatchObject({ kind: 'laps', checkpoints: T.checkpoints, laps: 3, rivals: ['rival-1', 'rival-2', 'rival-3'] });
    expect(L.laws.map((l) => l.law)).toEqual(['road-width', 'corners', 'grade', 'bank', 'closes', 'on-its-ground', 'clearance', 'nothing-on-the-track']);
    expect(L.laws.filter((l) => !l.holds)).toEqual([]);
    // the world it mints carries the barriers' walls and the dressed land
    const P = assembleRoadwayScene(m);
    expect(P.colliders.length).toBe(L.ends.colliders.length);
    expect(P.roadway.form).toBe('circuit');
  });
});

describe('the barriers', () => {
  it('stop the level\'s car driven flat out straight on: off the road into the first bend, never past the barrier', () => {
    const q = { goal: 'race', ride: 'coupe', roadway: 'kart-oval' }, W = quickWorld({ id: 'k', quick: q }), st = gameStages(W)[0];
    const L = stageLevelOrder(readGameworld(W), st, { ref: 'x', goal: (e) => goalMechanics(q, e), ride, extra: (e) => raceCast(q, e, ride) });
    const car = L.args.manifest.entities[0], X = trackSection('kart'), ground = L.ends.ground;
    expect(car.rule.collideRadius).toBe(0.9);
    const S = simLevel({ entities: [{ ...car, body: { type: 'none' } }], events: {}, colliders: L.ends.colliders }, { ground: (p) => ground(p[0], p[1]) });
    S.input.forward = 1;
    const stations = planTrack({ form: 'circuit', course: 'kart-oval' }).alignment.stations({ fine: 1, coarse: 1 });
    let worst = 0;
    for (let k = 0; k < 30 * 20; k++) {
      S.frame(1 / 30);
      const p = S.world.byId.car.transform.pos;
      let d = Infinity; for (const s of stations) d = Math.min(d, Math.hypot(s.x - p[0], s.y - p[1]));
      worst = Math.max(worst, d);
    }
    expect(worst).toBeGreaterThan(X.road);
    expect(worst).toBeLessThan(X.runoff);
  });
});

describe('the quick race names one', () => {
  it('a roadway preset or spec, dressed, the level the roadway itself; refused off a race or beside a trail', () => {
    const W = quickWorld({ id: 'karts', quick: { goal: 'race', ride: 'coupe', rivals: 3, roadway: 'kart-sprint' } });
    expect(W.levels).toEqual({ run: { name: 'karts', roadway: { course: 'kart-sprint', dress: true } } });
    expect(gameStages(W)[0]).toMatchObject({ section: 'roadway', manifest: { kind: 'roadway', course: 'kart-sprint', dress: true } });
    expect(() => readQuick({ goal: 'reach', roadway: 'kart-oval' })).toThrow(/roadway belongs to the race goal/);
    expect(() => readQuick({ goal: 'race', roadway: 'monaco' })).toThrow(/roadway is a course preset/);
    expect(() => readQuick({ goal: 'race', roadway: 'kart-oval', track: 'loop' })).toThrow(/the race's whole ground/);
  });
  it('rivals race it to the finish through the level\'s own manifest', () => {
    const q = { goal: 'race', ride: 'coupe', rivals: 2, laps: 1, roadway: 'kart-oval' }, W = quickWorld({ id: 'k', quick: q }), st = gameStages(W)[0];
    const L = stageLevelOrder(readGameworld(W), st, { ref: 'x', goal: (e) => goalMechanics(q, e), ride, extra: (e) => raceCast(q, e, ride) });
    const m = L.args.manifest, mech = composeMechanics(m.game.mechanics, { player: 'car' });
    const ground = L.ends.ground;
    const S = simLevel({ entities: m.entities.map((e) => ({ ...e, body: { type: 'none' } })), events: mech.events, colliders: L.ends.colliders }, { ground: (p) => ground(p[0], p[1]) });
    S.run(40);
    expect(S.world.byId['rival-1'].laps).toBeGreaterThanOrEqual(2);
    expect(S.bus.vars.__place_0).toBe(3);
  });
});

describe('the book knows it', () => {
  it('the bible draws its course, the graph its section, the story leaves it unplaced', () => {
    const W = withRoadway(MEADOWMARK, { course: 'kart-sprint' });
    expect(gameworldBibleHtml(W)).toMatch(/The roadway/);
    const g = gameworldGraph(W);
    expect(g.nodes.some((n) => n.id === 'section:track/roadway' && n.section === 'roadway')).toBe(true);
  });
});
