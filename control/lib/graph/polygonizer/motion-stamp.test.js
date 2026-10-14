import { describe, it, expect } from 'vitest';
import { gait, sprint, resolveMotion, stampMotion, WALK_DEFAULTS, SPRINT_DEFAULTS, WALK_MINT, SPRINT_MINT, WAVE_MINT, EMOTE_MINT } from './figure-posing.js';
import { stampHeroMotion, motionPlan, validateHeroMotion, MOTION_GAITS } from './hero-motion.js';
import { HERO_WALK } from './hero-gaits.js';
import { stampAuthoredMotion, stampHero, withDefaultWalk } from './motion-stamp.js';

const PHASES = Array.from({ length: 12 }, (_, i) => i / 12);
const same = (a, b) => PHASES.every((u) => JSON.stringify(a(u)) === JSON.stringify(b(u)));

describe('stampMotion — a gait stored by value', () => {
  it("writes every dial of the mint table into 'walk' and 'sprint' / 'run'", () => {
    expect(stampMotion('walk')).toEqual({ walk: { ...WALK_MINT } });
    expect(stampMotion('sprint')).toEqual({ sprint: { ...SPRINT_MINT } });
    expect(stampMotion('run')).toEqual({ sprint: { ...SPRINT_MINT } });
  });

  it('keeps what the author set over the mint table, and the rest of the spec', () => {
    const s = stampMotion({ walk: { armSwing: 30 }, perform: { idle: true } });
    expect(s.walk).toEqual({ ...WALK_MINT, armSwing: 30 });
    expect(s.perform).toEqual({ idle: true });
    expect(stampMotion({ gait: { lean: 0.2 } }).gait).toEqual({ ...WALK_MINT, lean: 0.2 });
    expect(stampMotion({ run: { lean: 0.4 } }).run).toEqual({ ...SPRINT_MINT, lean: 0.4 });
  });

  it('stamps the wave and a timed emote, keeping what the author set', () => {
    expect(stampMotion('wave')).toEqual({ wave: { ...WAVE_MINT } });
    expect(stampMotion({ wave: { waves: 4 } }).wave).toEqual({ ...WAVE_MINT, waves: 4 });
    expect(stampMotion('bow')).toEqual({ emote: 'bow', ...EMOTE_MINT.bow });
    expect(stampMotion({ emote: 'bow', intensity: 1.3, seconds: 5 })).toEqual({ emote: 'bow', intensity: 1.3, seconds: 5, beats: EMOTE_MINT.bow.beats });
  });

  it('passes every other motion through untouched', () => {
    const keys = { keyframes: [{}, { kneeL: 20 }] };
    for (const m of ['nod', 'stretch', { emote: 'nod' }, keys, null, undefined]) expect(stampMotion(m)).toBe(m);
  });

  it('a stamped walk renders the mint table; a bare one renders the frozen defaults', () => {
    expect(same(resolveMotion(stampMotion('walk')), gait(WALK_MINT))).toBe(true);
    expect(same(resolveMotion('walk'), gait(WALK_DEFAULTS))).toBe(true);
    expect(same(resolveMotion(stampMotion('sprint')), sprint(SPRINT_MINT))).toBe(true);
    expect(same(resolveMotion('sprint'), sprint(SPRINT_DEFAULTS))).toBe(true);
  });
});

describe('stampHeroMotion — a hero door gait stored by value', () => {
  it('writes the mint table, the gait base, its seconds and tilt under what the creator set', () => {
    const s = stampHeroMotion({ walk: true, jog: { tilt: 12 }, sprint: { armSwing: 60 } });
    expect(s.walk).toEqual({ ...WALK_MINT, ...HERO_WALK, seconds: MOTION_GAITS.walk.seconds, tilt: MOTION_GAITS.walk.tilt });
    expect(s.jog).toEqual({ ...SPRINT_MINT, ...MOTION_GAITS.jog.base, seconds: MOTION_GAITS.jog.seconds, tilt: 12 });
    expect(s.sprint.armSwing).toBe(60);
    expect(s.sprint.hipDrive).toBe(MOTION_GAITS.sprint.base.hipDrive);
  });

  it('leaves jumps and stops as given, and the hero door still takes the result', () => {
    const s = stampHeroMotion({ walk: true, walkStop: true, leap: { seconds: 1 } });
    expect(s.walkStop).toBe(true);
    expect(s.leap).toEqual({ seconds: 1 });
    expect(validateHeroMotion(stampHeroMotion({ walk: true, jog: true, sprint: true }))).toEqual([]);
  });

  it('a stamped gait plans to the mint table', () => {
    const P = motionPlan(stampHeroMotion({ walk: true, jog: true }));
    expect(same(resolveMotion(P.walk.spec), gait({ ...WALK_MINT, ...HERO_WALK }))).toBe(true);
    expect(same(resolveMotion(P.jog.spec), sprint({ ...SPRINT_MINT, ...MOTION_GAITS.jog.base }))).toBe(true);
  });
});

describe('stampAuthoredMotion — what is written, and what an edit leaves alone', () => {
  it('stamps a figure at mint', () => {
    expect(stampAuthoredMotion({ kind: 'figure', motion: 'walk' }).motion).toEqual({ walk: { ...WALK_MINT } });
  });

  it('an edit that leaves the motion as stored keeps its bytes (the same object back)', () => {
    const prev = { kind: 'figure', motion: 'walk', garment: 'tee' };
    const next = { ...prev, garment: 'tank' };
    expect(stampAuthoredMotion(next, prev)).toBe(next);
  });

  it('an edit that gives a figure a new walk stamps it', () => {
    const prev = { kind: 'figure' };
    expect(stampAuthoredMotion({ kind: 'figure', motion: { walk: { lean: 0.1 } } }, prev).motion.walk).toEqual({ ...WALK_MINT, lean: 0.1 });
  });

  it("stamps a world's figures and inline heroes, entry by entry", () => {
    const prev = { kind: 'room', figures: { old: { motion: 'walk' } } };
    const next = { kind: 'room', figures: { old: { motion: 'walk' }, fresh: { motion: 'walk' }, hero: { hero: { motion: { walk: true } } } } };
    const m = stampAuthoredMotion(next, prev);
    expect(m.figures.old).toBe(next.figures.old);
    expect(m.figures.fresh.motion).toEqual({ walk: { ...WALK_MINT } });
    expect(m.figures.hero.hero.motion.walk).toMatchObject({ ...WALK_MINT, ...HERO_WALK });
  });

  it("stamps a layered hero's motion, and leaves a hero without one alone", () => {
    const m = stampAuthoredMotion({ kind: 'layered', hero: { cast: 'female', motion: { sprint: true } } });
    expect(m.hero.motion.sprint).toMatchObject(MOTION_GAITS.sprint.base);
    const bare = { cast: 'male' };
    expect(stampHero(bare)).toBe(bare);
  });
});

describe('withDefaultWalk — a new hero walks with the calibrated gait', () => {
  it('a hero that says nothing of its walk gets one; its other gaits stay', () => {
    expect(withDefaultWalk({ cast: 'female' }).motion).toEqual({ walk: true });
    expect(withDefaultWalk({ cast: 'male', motion: { sprint: true } }).motion).toEqual({ sprint: true, walk: true });
    expect(stampHero(withDefaultWalk({ cast: 'male' })).motion.walk).toMatchObject({ ...WALK_MINT, ...HERO_WALK });
  });

  it('a creator\'s own walk, a door clip named walk, and a statue are left as they are', () => {
    for (const spec of [{ cast: 'male', motion: { walk: { lean: 0.1 } } }, { cast: 'male', clips: { walk: [{}, {}] } }, { cast: 'male', statue: 'roman' }]) {
      expect(withDefaultWalk(spec)).toBe(spec);
    }
  });
});
