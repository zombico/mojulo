// Blaze Gunner's rail (blaze-gunner.js, rails.js): the scrolling shooter as a designed game. The concepts: its starter lays
// its stages as levels whose airspace is the stage and whose goal is the scroll goal, under what the creator wrote; the
// sentence door lays it from a shmup's own words, and a run and gun's words stay the run and gun's; its flight goal is
// lost with the ship and won with the boss its track holds for.
import { describe, it, expect } from 'vitest';
import { blazeGunnerStart, stageLevel, BLAZE_GUNNER_FRONT, BLAZE_GUNNER_LOOK } from './blaze-gunner.js';
import { STAGE_IDS, stageManifest, bossOf, STAGES } from './scroll-stage/stages.js';
import { starterRailOf } from './compose.js';
import { readGenre } from './intent.js';
import { readFlightGoal, defaultFlightGoal, flightGoalMechanics, flightLegend, SCROLL_LEGEND } from './flight-goal.js';
import { railOf } from './rails.js';
import { scrollStageOf } from './scroll-stage/stage-scene.js';

describe('Blaze Gunner\'s rail', () => {
  it('its starter lays its stages as levels: the stage as the airspace, flown for the scroll goal, under what the creator wrote', () => {
    const { world } = blazeGunnerStart({ name: 'Mine', mode: 'designed' });
    expect(Object.keys(world.levels)).toEqual(STAGE_IDS);
    expect(world).toMatchObject({ name: 'Mine', mode: 'designed', start: STAGE_IDS[0] });
    const L = world.levels[STAGE_IDS[0]], { kind: _k, title: _t, ...airspace } = stageManifest(STAGE_IDS[0]);
    expect(L).toEqual(stageLevel(STAGE_IDS[0]));
    expect(L.airspace).toEqual(airspace);
    expect(L.goal).toEqual({ flight: 'scroll' });
    expect(blazeGunnerStart({}, { stages: 1 }).world.levels).toHaveProperty(STAGE_IDS[0]);
  });

  it('its starter writes its front (a press-start, the end card) and its look (orbit in its own colours, no overlay), under what the creator wrote', () => {
    const W = blazeGunnerStart({}).world;
    expect(W.front).toEqual(BLAZE_GUNNER_FRONT);
    expect(W.ui).toEqual({ theme: { from: BLAZE_GUNNER_LOOK, overlay: 'none' }, colour: 'theme' });
    expect(Object.keys(W.levels)).toEqual(STAGE_IDS);
    expect(blazeGunnerStart({ front: { tagline: 'mine' } }).world.front).toEqual({ tagline: 'mine' });
  });

  it('the sentence door lays it from a shmup\'s words; a run and gun\'s stay the run and gun\'s', () => {
    const shmup = 'a shmup with gunpods and a capital ship boss', G = readGenre(shmup)?.id ?? null;
    expect(starterRailOf(shmup, G)?.id).toBe('blaze-gunner');
    expect(railOf('blaze-gunner').handles.genres).toContain('co-op-scroller');
    const rng = 'a side-scrolling shooter', G2 = readGenre(rng)?.id ?? null;
    expect(G2).toBe('run-and-gun');
    expect(starterRailOf(rng, G2)).toBeNull();
  });

  it('its goal is lost with the ship and won with the boss its track holds for', () => {
    const id = STAGE_IDS[0], m = stageManifest(id), G = scrollStageOf(m);
    expect(readFlightGoal('scroll')).toEqual({ kind: 'scroll' });
    expect(defaultFlightGoal(m)).toEqual({ kind: 'scroll' });
    const M = flightGoalMechanics({ kind: 'scroll' }, { scroll: { ...G, track: G.track } });
    expect(M).toEqual([{ kind: 'fail-on-death', of: 'body' }, { kind: 'defeat-all', who: bossOf(STAGES[id]), count: 1, label: 'Boss' }]);
    expect(flightLegend({ kind: 'scroll' })).toBe(SCROLL_LEGEND);
    expect(() => flightGoalMechanics({ kind: 'scroll' }, {})).toThrow(/airspace's scroll/);
  });
});
