import { describe, it, expect } from 'vitest';
import { readGameworld, resolveLevel } from './world.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { readLevel } from '../level/graph.js';
import { assembleStageScene } from '../era/stage.js';
import { composeGameworld } from './compose.js';

// A world's and a level's `style.hour` (era/geocube-hours.js readHour): the geocube's outside lit at that hour, lowered
// onto each stage the level's cube paints as its `hour` (era/geocube.js withGeocube), a level's over the world's. A
// stage no cube paints is lit as before and says so as advice; a world with no hour lays every stage as it did.
const LEVELS = {
  vale: { walk: { nodes: { path: { trail: { run: 12 } }, top: { meru: true } } } },
  den: { style: { hour: 'dusk' }, walk: { nodes: { a: { trail: { run: 12 } } } } },
};
const world = (style, levels = LEVELS) => ({ id: 'hours', seed: 3, style, levels });
const NIGHT = world({ geocube: 'island-noon', hour: 'night' });

describe('style.hour', () => {
  it('is read as the cube reads it, a word or 0 to 24, on the world and on a level', () => {
    expect(readGameworld(world({ geocube: 'island-noon', hour: 20.5 })).style.hour).toBe(20.5);
    expect(() => readGameworld(world({ geocube: 'island-noon', hour: 'midnight' }))).toThrow(/gameworld: style\.hour is a number from 0 up to 24, or one of dawn, morning, noon/);
    expect(() => readGameworld(world({ geocube: 'island-noon' }, { vale: { ...LEVELS.vale, style: { hour: 24 } } }))).toThrow(/gameworld: levels\.vale\.style\.hour is a number/);
    // the level recipe takes it with its cube only
    expect(() => readLevel({ nodes: { a: { trail: true } }, hour: 'night' })).toThrow(/hour lights a geocube's outside: name the level's geocube/);
  });

  it('lowers onto every stage the cube paints, the trail and the climb; a level\'s hour over the world\'s, in the ledger', () => {
    const stages = gameStages(NIGHT);
    const vale = stages.filter((s) => s.level === 'vale'), den = stages.filter((s) => s.level === 'den');
    expect(vale.map((s) => [s.section, s.manifest.hour])).toEqual([['trail', 'night'], ['meru', 'night']]);
    expect(den.map((s) => s.manifest.hour)).toEqual(['dusk']);
    expect(stages.every((s) => s.unlit === undefined)).toBe(true);
    expect(resolveLevel(NIGHT, 'den').ledger).toContainEqual({ scope: 'level', at: 'den', key: 'hour', world: 'night', local: 'dusk' });
  });

  it('the stage is lit at the hour and says it got it', () => {
    const [trail] = gameStages(NIGHT);
    const lit = assembleStageScene(trail.manifest), plain = assembleStageScene((({ hour: _h, ...m }) => m)(trail.manifest));
    expect(lit.painted).toMatchObject({ geocube: 'island-noon', hour: 'night' });
    expect(plain.painted.hour).toBeUndefined();
    const fills = (p) => [...new Set(p.faces.filter((f) => typeof f.fill === 'string').map((f) => f.fill))].join();
    expect(fills(lit)).not.toBe(fills(plain));
    expect(assembleStageScene(gameStages(NIGHT)[1].manifest).painted).toMatchObject({ hour: 'night' });
  });

  it('a stage no cube paints is lit as before, and its order says so as advice', () => {
    // no cube in the world; and a section in its own kit inside a painted level
    const kitOnly = world({ kit: 'isekai-meadow', hour: 'night' }, { vale: LEVELS.vale });
    const own = world({ geocube: 'island-noon', hour: 'night' }, { vale: { walk: { nodes: { path: { trail: { run: 12 }, kit: 'isekai-meadow' } } } } });
    for (const W of [kitOnly, own]) {
      const [s] = gameStages(W);
      expect(s.manifest.hour).toBeUndefined();
      expect(s.unlit).toBe('night');
      const L = stageLevelOrder(readGameworld(W), s, { ref: 'lv' });
      expect(L.laws).toContainEqual(expect.objectContaining({ concern: 'hour', holds: false, says: expect.stringMatching(/style\.hour 'night' lights a stage the level's geocube paints; this trail stage is not on one/) }));
      expect(L.args.manifest.hour).toBeUndefined();
    }
  });

  it('a world with no hour lays every stage as it did: no hour, no advice', () => {
    const W = world({ geocube: 'island-noon' }, { vale: LEVELS.vale });
    const stages = gameStages(W);
    expect(stages.every((s) => s.manifest.hour === undefined && s.unlit === undefined)).toBe(true);
    expect(stageLevelOrder(readGameworld(W), stages[0], { ref: 'lv' }).laws ?? []).not.toContainEqual(expect.objectContaining({ concern: 'hour' }));
  });

  it('compose reads an hour word into style.hour, unless the cube is lit at it already', () => {
    const dusk = composeGameworld({ prompt: 'a misty river valley at dusk', levels: 1, seed: 3 });
    expect(dusk.style.hour).toBe('dusk');
    expect(dusk.brief.read).toContainEqual({ word: 'dusk', decides: ['hour'] });
    expect(dusk.brief.unread).not.toContain('dusk');
    expect(gameStages(dusk).filter((s) => s.manifest.geocube !== undefined).every((s) => s.manifest.hour === 'dusk')).toBe(true);
    // night on another cube lights it at night; on the night cube it adds nothing; no hour word, none
    expect(composeGameworld({ prompt: 'a sunny island at night', levels: 1, seed: 3 }).style.hour).toBe('night');
    const gothic = composeGameworld({ prompt: 'a gothic night', levels: 1, seed: 3 });
    expect(gothic.style.hour).toBeUndefined();
    expect(gothic.brief.read.flatMap((r) => r.decides)).not.toContain('hour');
    expect(composeGameworld({ prompt: 'a misty river valley', levels: 1, seed: 3 }).style.hour).toBeUndefined();
  });
});
