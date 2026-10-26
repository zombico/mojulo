// The sports, native: a court's surface the ball plays on, and a sport's presets lowered under the words given. One case
// per procedure: a net game's surface and its preset, a goal game's rules' length, a turn sport's broadcast lean, a meet's
// venue; every preset of every sport is swept in sport-presets.deep.test.js.
import { describe, it, expect } from 'vitest';
import { SPORT_PRESETS, presetWords, presetsOf } from './sport-presets.js';
import { COURT_SURFACES, matchArenaData, readMatch, matchManifest } from './match-arena.js';
import { matchContext, newMatch } from './match-sim.js';
import { quickWorld, readQuick, withSportPreset } from '../gameworld/quick.js';
import { runSteps } from '../gameworld/runner.js';

const floorOf = (spec) => newMatch(matchContext(matchArenaData({ sport: 'tennis', players: 0, ...spec }))).sim.bodies.find((b) => b.id === 'floor');
const levelOf = (quick) => runSteps(quickWorld({ id: 'n', quick: { athletes: false, ...quick } }), { ref: 'gw_n' })[0].order.manifest;

describe('a court\'s surface', () => {
  it('is how the floor meets the ball; absent, the court plays as it always has (the clay\'s)', () => {
    expect(floorOf({})).toMatchObject({ restitution: 1, friction: 1 });
    expect(floorOf({ surface: 'clay' })).toMatchObject({ restitution: 1, friction: 1 });
    const grass = floorOf({ surface: 'grass' }), hard = floorOf({ surface: 'hard' });
    // grass keeps the ball lowest and grips it least, a hard court between
    expect(grass.restitution).toBeLessThan(hard.restitution); expect(grass.friction).toBeLessThan(hard.friction);
    expect(grass).toMatchObject({ restitution: COURT_SURFACES.grass.restitution, friction: COURT_SURFACES.grass.friction });
    expect(matchArenaData({ sport: 'tennis' }).floor).toBeUndefined();
    expect(() => readMatch({ surface: 'ice' })).toThrow(/surface 'ice' is one of clay, hard, grass/);
    // a court in its stadium stands on its surface
    expect(matchManifest({ sport: 'tennis', surface: 'clay', venue: 'centre-court' }).field.surface).toBe('clay');
  });
});

describe('a sport\'s presets', () => {
  const firstOf = (sport) => presetsOf(sport)[0];
  it('lowers a net game\'s preset under the words given: its surface, its venue, its coverage; a word given wins', () => {
    const name = presetsOf('tennis').find((p) => presetWords('tennis', p).surface && presetWords('tennis', p).venue), W = presetWords('tennis', name);
    const L = levelOf({ goal: 'contest', sport: 'tennis', preset: name });
    expect(L).toMatchObject({ kind: 'stadium', preset: W.venue.preset, court: { surface: W.surface, broadcast: W.broadcast } });
    expect(levelOf({ goal: 'contest', sport: 'tennis', preset: name, venue: false }).kind).toBe('stage');
    expect(levelOf({ goal: 'contest', sport: 'tennis', preset: name, surface: 'hard' }).court.surface).toBe('hard');
    expect(withSportPreset({ goal: 'contest', sport: 'tennis' })).toEqual({ goal: 'contest', sport: 'tennis' });   // no preset: nothing laid
  });
  it('a goal game\'s, a turn sport\'s and a meet\'s land on their arenas', () => {
    const team = presetsOf('soccer').find((p) => presetWords('soccer', p).seconds), TW = presetWords('soccer', team);
    expect(levelOf({ goal: 'contest', sport: 'soccer', preset: team }).pitch).toMatchObject({ seconds: TW.seconds, periods: TW.periods });
    const golf = firstOf('golf');
    expect(levelOf({ goal: 'contest', sport: 'golf', preset: golf }).turns.broadcast).toEqual(presetWords('golf', golf).broadcast);
    const meet = presetsOf('meet').find((p) => presetWords('meet', p).venue);
    expect(levelOf({ goal: 'meet', event: 'sprint', lanes: 2, preset: meet })).toMatchObject({ kind: 'stadium', preset: presetWords('meet', meet).venue.preset });
  });
  it('refuses a preset a sport has not, or one before the sport is named, teaching', () => {
    expect(() => readQuick({ goal: 'contest', sport: 'tennis', preset: 'moon' })).toThrow(/tennis has no preset 'moon' \(grass, clay/);
    expect(() => readQuick({ goal: 'contest', preset: 'grass' })).toThrow(/\.preset is a sport's own: name the sport first/);
    expect(() => readQuick({ goal: 'contest', sport: 'soccer', surface: 'grass' })).toThrow(/surface belongs to a net game/);
    expect(() => presetWords('curling', 'x')).toThrow(/'curling' has no presets/);
    expect(Object.keys(SPORT_PRESETS)).toEqual(expect.arrayContaining(['tennis', 'soccer', 'meet']));
  });
});
