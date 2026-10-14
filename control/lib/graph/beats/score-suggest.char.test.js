// CHARACTERIZATION (the repo's *.char.test.js convention): worked examples of what the suggestion answers today, for
// readers and for noticing a retune. They pin the TUNING (the plane's points, the offsets, the word lists), not a
// principle: a commit that moves the tuning on purpose updates them and says so. The laws live in
// score-suggest.test.js.
import { describe, it, expect } from 'vitest';
import { sceneStyle } from './score-suggest.js';
import { CLUB_MOODS } from './club-score.js';
import { suggestScore, levelScoreContext, MOOD_PLANE } from './score-suggest.js';
import { suggestFieldScore } from './field-cue.js';
import { SCORE_MOODS } from './field-score.js';

const mood = (ctx) => suggestScore(ctx)?.mood ?? null;

describe('suggestScore: the play moves it', () => {
  const forest = { base: 'terrain', theme: 'forest' };

  it('a fight is battle music, the last fight the boss; danger darkens; a sneak goes to tension; a race drives', () => {
    expect(mood({ ...forest, mechanics: ['hp-pool', 'defeat-all'] })).toBe('battle');
    expect(mood({ base: 'dungeon', title: 'tavern brawl', mechanics: ['hp-pool'] })).toBe('battle');
    for (const goal of ['battle', 'shoot', 'defend']) expect(mood({ ...forest, goal })).toBe('battle');
    expect(mood({ ...forest, mechanics: ['waves'], final: true })).toBe('boss');
    // a fight level explores to the forest's music and changes to battle (retuned with adaptive music: the explore reason first)
    expect(suggestScore({ ...forest, goal: 'battle' })).toMatchObject({ explore: 'forest', audio: { soundtrack: 'field:forest', combat: 'field:battle' } });
    expect(suggestScore({ ...forest, goal: 'battle' }).why).toMatch(/under a canopy.*; a fight: battle music/);
    expect(mood({ base: 'dungeon', mechanics: ['hazard-damage', 'fail-on-death'] })).toBe('tension');
    expect(mood({ ...forest, goal: 'sneak' })).toBe('tension');
    expect(mood({ base: 'terrain', theme: 'meadow', goal: 'race' })).toBe('highlands');
  });

  it('gathering keeps a calm place calm', () => {
    expect(mood({ base: 'terrain', goal: 'collect' })).toBe('plains');
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



describe('the electronic scenes', () => {
  it('the scene picks them: a cafe or rain is lo-fi, underwater or the cosmos ambient, a lab at rest drifts', () => {
    const at = (manifest, opts) => suggestScore(levelScoreContext(manifest, opts)).mood;
    expect(at({ base: 'floorplan-world', title: 'corner cafe' })).toBe('chill');
    expect(at({ base: 'floorplan-world', title: 'rainy apartment' })).toBe('chill');
    expect(at({ base: 'terrain', title: 'cozy town' }, { goal: 'race' })).toBe('drive');
    expect(at({ base: 'terrain', title: 'underwater reef' })).toBe('ambient');
    expect(at({ base: 'controllable', title: 'the cosmos' })).toBe('ambient');
    expect(at({ kind: 'stage', kit: 'research-lab', title: 'x' })).toBe('drift');
    expect(at({ base: 'controllable', title: 'space station' })).toBe('ambient');
  });
  it('the scene picks the style; asked for, it wins', () => {
    expect(sceneStyle({ kind: 'stage', theme: 'abandoned research lab' })).toBe('club');
    expect(sceneStyle({ base: 'terrain', theme: 'forest' })).toBe('field');
    const lab = levelScoreContext({ kind: 'stage', kit: 'research-lab', title: 'x' });
    expect(suggestScore(lab)).toMatchObject({ style: 'club', audio: { soundtrack: expect.stringMatching(/^club:/) } });
    expect(suggestScore({ ...lab, goal: 'battle' }).mood).toBe('rave');
    expect(suggestScore({ ...lab, goal: 'battle', final: true }).mood).toBe('peak');
    expect(suggestScore({ ...lab, goal: 'race' }).mood).toBe('drive');
    expect(suggestScore({ ...lab, style: 'field' }).style).toBeUndefined();
    expect(suggestScore({ base: 'terrain', theme: 'forest', style: 'club' }).mood).toBe('chill');
    expect(suggestScore(lab).brief).toMatchObject({ style: 'club', energy: 'club', tempo: CLUB_MOODS[suggestScore(lab).mood].tempo });
  });
});
