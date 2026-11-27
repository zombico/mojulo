// A DISTRICT'S CROWD IN SIXES (crowd.js): six different people a six; an area asks for sixes by its walk and its kind;
// sixes stacked where asked, nearest first, to the crowd's most; a played district's walkers in whole sixes.
import { describe, it, expect } from 'vitest';
import { PEOPLE_WORDS, peopleOf, sixesOf, crowdOf, crowdSets, CROWDS, SIX } from './crowd.js';
import { streamOf } from '../city/plan/dice.js';
import { assembleGeocityScene } from './scene.js';

const rand = (id) => streamOf(7, 'people', id);
const areas = (n, length = 240, kind = 'midrise') => Array.from({ length: n }, (_, i) => ({ id: `a${i}`, length, kind, rank: i }));

describe('a crowd in sixes', () => {
  it('makes each six six different people of one set, its pairs side by side, its groups each their own way', () => {
    for (const six of sixesOf(areas(6), { crowd: 'busy', rand })) {
      expect(six.members).toHaveLength(SIX);
      expect(new Set(six.members.map((m) => m.person)).size).toBe(SIX);
      expect(six.members.every((m) => Math.floor(m.person / SIX) === six.set && six.set < CROWDS.busy.sets)).toBe(true);
      // (two pairs: the same pace and way round, a step apart)
      const [a, b] = six.members;
      expect(a.speed).toBe(b.speed);
      expect(a.reverse).toBe(b.reverse);
      expect(Math.abs(a.start - b.start)).toBeLessThan(0.01);
    }
  });

  it('stacks sixes where an area asks for more, nearest first, to the crowd\'s most', () => {
    const busy = sixesOf(areas(3, 600, 'square'), { crowd: 'busy', rand });
    expect(busy.filter((s) => s.area === 'a0').length).toBeGreaterThan(1);
    expect(busy.length).toBeLessThanOrEqual(CROWDS.busy.most);
    expect(sixesOf(areas(20, 600, 'square'), { crowd: 'quiet', rand }).length).toBe(CROWDS.quiet.most);
    expect(sixesOf(areas(20, 600, 'square'), { crowd: 'packed', rand }).length).toBe(CROWDS.packed.most);
    // (a quiet walk asks for less than a square's)
    const ask = (kind) => sixesOf(areas(1, 300, kind), { crowd: 'packed', rand }).length;
    expect(ask('square')).toBeGreaterThanOrEqual(ask('houses'));
  });

  it('is busy in the core and the frame, quiet in the outskirts, unless named', () => {
    expect(crowdOf({ at: 'core' })).toBe('busy');
    expect(crowdOf({ at: 'outskirts' })).toBe('quiet');
    expect(crowdOf({ at: 'outskirts', crowd: 'packed' })).toBe('packed');
    expect(crowdSets({ crowd: 'packed' })).toBe(3);
  });

  it('walks a played district\'s pavements in whole sixes of its rolled people', () => {
    const geocity = { metro: { from: 'lakeshore', rings: { core: 160, frame: 330 } }, extent: [900, 800], water: { sides: ['s'], depth: 100 }, core: [0.5, 0.45], evoke: 'neighbourhood', at: 'core', crowd: 'busy' };
    const P = assembleGeocityScene({ kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, hour: 'noon', geocity }, { play: true });
    const L = P.walkerLoops ?? [];
    expect(L.length).toBeGreaterThan(0);
    expect(L.length % SIX).toBe(0);
    expect(L.every((w) => w.person >= 0 && w.person < CROWDS.busy.sets * SIX)).toBe(true);
    expect(P.geocity.counts.crowd).toMatchObject({ word: 'busy', sixes: L.length / SIX });
  }, 120_000);
  it('names who walks: the quick figures unless a level says realistic people', () => {
    expect(PEOPLE_WORDS).toEqual(['quick', 'realistic']);
    expect(peopleOf({})).toBe('quick');
    expect(peopleOf({ people: 'realistic' })).toBe('realistic');
  });
});
