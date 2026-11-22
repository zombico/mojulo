// A LEVEL'S RANK (rank.js): three marks and their mean, said as one of the meter's own tier names; on a level's page only
// where its game carries a `rank`.
import { describe, it, expect } from 'vitest';
import { rankOf, levelRank } from './rank.js';
import { gameChannelScript } from '../scene/channels/game.js';

const TIERS = ['D', 'C', 'B', 'A', 'S'];
describe('a level\'s rank', () => {
  it('a clean, fast, stylish run is the top; a slow, hurt, plain one the foot', () => {
    expect(rankOf({ seconds: 60, par: 100, peak: 4, tiers: TIERS, hurt: 0 })).toMatchObject({ rank: 'S', marks: { time: 1, style: 1, clean: 1 } });
    expect(rankOf({ seconds: 220, par: 100, peak: 0, tiers: TIERS, hurt: 10 }).rank).toBe('D');
  });
  it('each mark moves it: slower, plainer or hurt is never better', () => {
    const base = { seconds: 100, par: 100, peak: 3, tiers: TIERS, hurt: 2 }, s = (o) => rankOf({ ...base, ...o }).score;
    expect(s({ seconds: 150 })).toBeLessThan(s({}));
    expect(s({ peak: 1 })).toBeLessThan(s({}));
    expect(s({ hurt: 6 })).toBeLessThan(s({}));
  });
  it('a level with no par is ranked on its style and how clean it was; the rank is one of the game\'s own words', () => {
    const R = rankOf({ seconds: 999, peak: 2, tiers: ['dull', 'cool', 'wild'], hurt: 0 });
    expect(R.marks.time).toBeUndefined();
    expect(R.rank).toBe('wild');
  });
  it('what the envelope carries: the rank, and the time, the style and the combo to keep the best of', () => {
    const R = levelRank({ peak: 2, tiers: TIERS, hurt: 1, earned: 412.4, best: 27 }, 122.04, 184);
    expect(R.rank).toBe('A');
    expect(R.kept).toEqual([{ label: 'Time', value: 122, best: 'low', unit: 's' }, { label: 'Style', value: 412, best: 'high' }, { label: 'Combo', value: 27, best: 'high' }]);
    expect(levelRank(null, 10, 20)).toBeNull();
  });
  it('is on a level\'s page only where its game is ranked: none ⇒ not a byte', () => {
    const game = { levelRef: 'lv', consumes: [], produces: { results: ['success', 'fail'], events: [] }, on: { 'goal:reached': { end: 'success' } } };
    const bare = gameChannelScript(game), ranked = gameChannelScript({ ...game, rank: { par: 60 } });
    expect(bare).not.toContain('rankOf');
    expect(bare).not.toContain('__mojStyle');
    expect(ranked).toContain('function rankOf');
    expect(ranked).toContain('__levelRank(window.__mojStyle.now()');
    expect(gameChannelScript({ ...game, rank: { par: 60 } }).replace(/"rank":\{"par":60\}/, '').length).toBeGreaterThan(bare.length);
  });
});
