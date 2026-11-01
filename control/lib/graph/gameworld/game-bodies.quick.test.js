// the body rails on a quick game (quick.body): the rail's hero under the hero spec's own words, its henchman under the
// figures the run rolls. The concepts: absent, every step as before; 'game' reads the rail off the goal; the hero's own
// words win (a cast word names the pole); a farmhand stands as rolled; the lowered specs mint through the door; a body
// that is not a rail is refused.
import { describe, it, expect } from 'vitest';
import { runSteps } from './runner.js';
import { quickWorld } from './quick.js';
import { lowerBody, gameBody, railOfWord } from './game-bodies.js';
import { heroRecord } from '../../mcp/tools/layered.js';
import { withDefaultForm } from '../polygonizer/motion-stamp.js';

const steps = (quick, more = {}) => runSteps(quickWorld({ id: 'qb', quick, ...more }), { ref: 'gw' });
const specOf = (S, key) => S.find((s) => s.key === key)?.order?.spec;

describe('the body rails on a quick game', () => {
  it('lays the rail\'s hero under the hero spec, the spec\'s own words winning; absent, as before', () => {
    const plain = steps({ goal: 'reach', hero: { cast: 'female', head: 'anime' } });
    const worn = steps({ goal: 'reach', hero: { cast: 'female', head: 'anime' }, body: 'muscular' });
    expect(specOf(plain, 'hero').animeBody).toBeUndefined();
    expect(specOf(worn, 'hero')).toMatchObject({ cast: 'female', head: 'anime', animeBody: 'mizuki' });
    expect(specOf(steps({ goal: 'reach', hero: { cast: 'female', head: 'anime', animeBody: 'maki' }, body: 'muscular' }), 'hero').animeBody).toBe('maki');
    // (the other steps as they were: the body reaches only the people)
    expect(worn.filter((s) => s.key !== 'hero').map((s) => s.print)).toEqual(plain.filter((s) => s.key !== 'hero').map((s) => s.print));
  });
  it('reads the rail off the goal for \'game\', and none from a goal that names none', () => {
    expect(railOfWord('game', { goal: 'fight' })).toMatchObject({ rail: 'muscular' });
    expect(railOfWord('game', { goal: 'farm' })).toBeNull();
    expect(railOfWord({ rail: 'comic', muscle: true })).toMatchObject({ rail: 'comic', muscle: true });
    const S = steps({ goal: 'collect', hero: { cast: 'male' }, body: 'game' });
    expect(specOf(S, 'hero').cast).toEqual({ pole: 'male', build: 'chibi' });
  });
  it('lays the henchman under the foes the run rolls, and leaves a farmhand as rolled', () => {
    const plain = steps({ goal: 'defend' }), worn = steps({ goal: 'defend', body: 'comic' });
    const foe = (S) => S.find((s) => /^foe/.test(s.key) && s.order?.spec);
    expect(foe(worn).order.spec).not.toEqual(foe(plain).order.spec);
    const farm = (S) => S.find((s) => /^farmhand/.test(s.key) && s.order?.spec)?.order.spec;
    const P = steps({ goal: 'farm' }), W = steps({ goal: 'farm', body: 'comic' });
    if (farm(P)) expect(farm(W)).toEqual(farm(P));
  });
  it('mints what it lays: the anime frame, the realistic body, a mascot', () => {
    for (const [rail, tradition] of [['comic', 'anime'], ['muscular', 'western'], ['mascot', 'western']]) for (const role of ['hero', 'henchman']) {
      const spec = lowerBody({ cast: 'female', ...(tradition === 'anime' ? {} : { head: 'landmark' }) }, gameBody(rail, role, { tradition, pole: 'female' }));
      expect(() => heroRecord(withDefaultForm(spec)), `${rail} ${role}`).not.toThrow();
    }
    // (a spec on another head keeps it: the codename is the anime frame's, left off)
    expect(lowerBody({ head: 'landmark' }, gameBody('comic', 'hero', { tradition: 'anime' })).animeBody).toBeUndefined();
  }, 120000);
  it('refuses a body that is not a rail', () => {
    expect(() => quickWorld({ id: 'q', quick: { goal: 'reach', body: 'hulk' } })).toThrow(/body/);
  });
});
