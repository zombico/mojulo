import { describe, it, expect } from 'vitest';
import { suggestScore, levelScoreContext, MOOD_PLANE } from './score-suggest.js';
import { suggestFieldScore } from './field-cue.js';
import { SCORE_MOODS } from './field-score.js';

const mood = (ctx) => suggestScore(ctx)?.mood ?? null;

describe('suggestScore: the place first', () => {
  it('with no play in the context it is the place\'s answer, unchanged', () => {
    const places = [
      { base: 'terrain', theme: 'forest' }, { base: 'terrain', theme: 'desert dunes' }, { base: 'dungeon' },
      { base: 'historic', title: 'the old chapel' }, { base: 'terrain', time: 'night' }, { base: 'terrain', title: 'harbour town' },
      { base: 'city' }, { base: 'math' }, { base: 'controllable', title: 'mountain pass', time: 'night' },
    ];
    for (const p of places) {
      const place = suggestFieldScore(p);
      const s = suggestScore(p);
      if (!place) { expect(s).toBeNull(); continue; }
      const { brief, ...rest } = s;
      expect(rest).toEqual({ ...place, place: place.mood });
      expect(brief.tempo).toEqual(expect.any(Array));
    }
  });

  it('every mood has a point on the plane', () => {
    expect(Object.keys(MOOD_PLANE).sort()).toEqual(Object.keys(SCORE_MOODS).sort());
  });
});

describe('suggestScore: the play moves it', () => {
  const forest = { base: 'terrain', theme: 'forest' };

  it('a fight is battle music, the last fight the boss; danger darkens; a sneak goes to tension; a race drives', () => {
    expect(mood({ ...forest, mechanics: ['hp-pool', 'defeat-all'] })).toBe('battle');
    expect(mood({ base: 'dungeon', title: 'tavern brawl', mechanics: ['hp-pool'] })).toBe('battle');
    for (const goal of ['battle', 'shoot', 'defend']) expect(mood({ ...forest, goal })).toBe('battle');
    expect(mood({ ...forest, mechanics: ['waves'], final: true })).toBe('boss');
    expect(suggestScore({ ...forest, goal: 'battle' }).why).toMatch(/forest for the place; a fight/);
    expect(mood({ base: 'dungeon', mechanics: ['hazard-damage', 'fail-on-death'] })).toBe('tension');
    expect(mood({ ...forest, goal: 'sneak' })).toBe('tension');
    expect(mood({ base: 'terrain', theme: 'meadow', goal: 'race' })).toBe('highlands');
  });

  it('gathering keeps a calm place calm', () => {
    expect(mood({ base: 'terrain', goal: 'collect' })).toBe('plains');
  });

  it('triumph is only for the last level', () => {
    const race = { base: 'terrain', theme: 'meadow', goal: 'race' };
    for (const goal of ['race', 'collect', 'sneak', 'avoid']) expect(mood({ ...race, goal })).not.toBe('triumph');
    expect(suggestScore({ ...race, final: true }).also.concat(mood({ ...race, final: true }))).toContain('triumph');
  });

  it('a place mood is kept by its place and never reached from another', () => {
    expect(mood({ base: 'terrain', theme: 'desert', climate: 'monsoon' })).toBe('desert');
    expect(mood({ base: 'dungeon', title: 'tavern', mechanics: ['hazard-damage'] })).toBe('tavern');
    const placeMoods = ['desert', 'village', 'town', 'tavern', 'shop', 'chapel', 'plains', 'forest'];
    for (const goal of ['sneak', 'race', 'avoid', 'collect']) {
      const m = mood({ base: 'terrain', theme: 'mountain', goal, climate: 'monsoon' });
      expect(placeMoods).not.toContain(m);
    }
  });

  it('says what moved it', () => {
    const s = suggestScore({ ...forest, goal: 'sneak', final: true });
    expect(s.place).toBe('forest');
    expect(s.why).toMatch(/forest for the place, moved to tension; stealth.*; the last level/);
    expect(s.audio).toEqual({ soundtrack: 'field:tension' });
  });

  it('a city block stays quiet whatever its play', () => {
    expect(suggestScore({ base: 'city', mechanics: ['hp-pool'] })).toBeNull();
    for (const m of ['victory', 'defeat']) for (const goal of [null, 'battle', 'sneak', 'race']) for (const final of [false, true]) {
      expect(mood({ base: 'terrain', theme: 'forest', goal, final })).not.toBe(m);   // a stinger is never a level's bed
    }
  });
});

describe('levelScoreContext', () => {
  it('reads the place words, a stage kit, the time, the weather and the mechanic kinds', () => {
    const c = levelScoreContext({ kind: 'stage', kit: 'gothic-stone', title: 'run', time: 'night', weather: { climate: 'storm-coast' }, game: { mechanics: [{ kind: 'hp-pool' }, { kind: 'reach-exit' }] } }, { goal: 'battle', final: true });
    expect(c).toMatchObject({ kind: 'stage', theme: 'dungeon crypt', title: 'run', time: 'night', climate: 'storm-coast', mechanics: ['hp-pool', 'reach-exit'], goal: 'battle', final: true });
    expect(levelScoreContext({ weather: 'alpine' }).climate).toBe('alpine');
    expect(levelScoreContext({ weather: { climate: { rain: 2, clear: 1 } } }).climate).toBe('rain clear');
    expect(levelScoreContext({ kind: 'stage', kit: 'trail-valley' }).theme).toBe('trail-valley');
  });

  it('every stage kit a game level is laid on finds a place', () => {
    for (const kit of ['alien-night', 'gothic-nave', 'gothic-stone', 'isekai-bamboo', 'isekai-garden', 'isekai-meadow', 'isekai-sakura', 'island-plaza', 'jungle-trail', 'research-lab', 'trail-valley']) {
      expect(suggestScore(levelScoreContext({ kind: 'stage', kit, title: 'x · run · path' })), kit).not.toBeNull();
    }
  });
});
