import { describe, it, expect } from 'vitest';
import { runSteps } from './index.js';
import { quickWorld, readQuick } from './quick.js';

const steps = (quick) => runSteps(quickWorld({ id: 'qc', quick }), { ref: 'gw' });
const level = (S) => S.find((s) => s.key.startsWith('level-'));

describe('a quick game\'s cast: the casting page beside a hero on foot', () => {
  it('a shooter\'s squad: the cast row and each member by path; the party and the familiar beside you, the rival the first foe', () => {
    const S = steps({ goal: 'shoot', cast: { scale: 'party', n: 1, cast: { rival: { relation: 'rival', body: 'person' }, pet: { relation: 'familiar', body: 'beast', species: 'wolf' } } } });
    expect(S.find((s) => s.key === 'casting').order.manifest).toMatchObject({ kind: 'egocube', cast: { cast: { party: { relation: 'party', n: 1 } } } });
    expect(S.find((s) => s.key === 'cast-pet').order).toMatchObject({ egocube: 'gw-casting', member: 'hero/pet' });
    const L = level(S), M = L.order.manifest;
    expect(M.play.party).toEqual([{ who: 'party-1' }, { who: 'pet' }]);
    for (const who of ['party-1', 'pet']) {
      const e = M.entities.find((x) => x.id === who);
      expect(e.rule).toMatchObject({ type: 'ai', mind: { motivation: 'escort' }, escort: M.entities[0].id });
      expect(M.figures[who].heroRef).toBe(`gw-cast-${who}`);
    }
    // the wolf walks on its own gaits
    expect(M.figures.pet).toMatchObject({ walker: true });
    expect(M.figures['foe-1'].heroRef).toBe('gw-cast-rival');
    expect(L.laws.find((l) => l.law === 'placed').says).toMatch(/beside you.*the first foe/);
  });

  it('true: a party of one, rolled in the game\'s setting; in a team deathmatch on your side', () => {
    const S = steps({ goal: 'reach', cast: true });
    expect(S.filter((s) => s.key.startsWith('cast-')).map((s) => s.key)).toEqual(['cast-party-1']);
    expect(level(S).order.manifest.play.party).toEqual([{ who: 'party-1' }]);
    const D = level(steps({ goal: 'deathmatch', mode: 'team', cast: { scale: 'party', n: 1, bodies: { person: 9 } } })).order.manifest;
    const pilot = D.entities[0], mate = D.entities.find((e) => e.id === 'party-1');
    expect(pilot.team).toBeTruthy();
    expect(mate.team).toBe(pilot.team);
  });

  it('a turn-based battle: companions walk beside you, and the readout says the fights are the hero\'s', () => {
    const L = level(steps({ goal: 'battle', cast: true }));
    expect(L.order.manifest.play.party).toEqual([{ who: 'party-1' }]);
    expect(L.laws.find((l) => l.law === 'placed').says).toMatch(/the hero's alone/);
  });

  it('teaches what a quick cast is not', () => {
    expect(() => readQuick({ goal: 'race', cast: true })).toThrow(/on foot: a race has none/);
    expect(() => readQuick({ goal: 'reach', cast: { scale: 'journey' } })).toThrow(/journey's cast is the book's/);
    expect(() => readQuick({ goal: 'reach', cast: { n: 9 } })).toThrow(/1 to 4/);
    expect(() => readQuick({ goal: 'reach', cast: 'friends' })).toThrow(/is true .* or \{/);
  });

  it('a quick game without a cast makes the steps it did', () => {
    const S = steps({ goal: 'shoot' });
    expect(S.some((s) => s.key === 'casting' || s.key.startsWith('cast-'))).toBe(false);
    expect(level(S).order.manifest.play?.party).toBeUndefined();
  });
});
