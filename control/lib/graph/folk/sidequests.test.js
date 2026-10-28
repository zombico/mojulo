import { describe, it, expect } from 'vitest';
import { readSidequests, whoOf, sidequestsOn, lowerSidequests, dispatchCues, MAX_STEPS, MAX_ENTRIES } from './sidequests.js';
import { folkOfTown } from './folk.js';
import { speakerOf } from './lines.js';

const lot = (use, s) => ({ use, route: 'lane', side: 'left', s, band: [2, 3] });
const F = folkOfTown({ seed: 8, heartbeat: 'village', lots: [lot('shop', 1), lot('dwelling', 8), lot('dwelling', 15), lot('workshop', 22)] }, { folk: { domicile: 'D + P' } });

describe('sidequests: the words', () => {
  it('reads a checklist and its chain, and teaches what is wrong', () => {
    const Q = readSidequests([
      { id: 'parcel', giver: 'keeper', steps: [{ talk: 'master' }, { reach: 'town-hall-1' }] },
      { id: 'reply', giver: 'master', after: 'parcel', back: false, steps: [{ talk: 'townie-2', say: 'Tell him yes.' }] },
    ]);
    expect(Q.map((q) => [q.id, q.back, q.after])).toEqual([['parcel', true, undefined], ['reply', false, 'parcel']]);
    expect(() => readSidequests([{ id: 'a', giver: 'keeper', steps: [] }])).toThrow(new RegExp(`1 to ${MAX_STEPS} things to do`));
    expect(() => readSidequests([{ id: 'a', giver: 'keeper', steps: [{ talk: 'x', reach: 'town-hall-1' }] }])).toThrow(/talk: who, say\?, log\? } or \{ reach/);
    expect(() => readSidequests([{ id: 'a', giver: 'keeper', steps: [{ reach: 'the-hall' }] }])).toThrow(/one of the town's houses/);
    expect(() => readSidequests([{ id: 'a', giver: 'keeper', after: 'b', steps: [{ talk: 'x' }] }])).toThrow(/another sidequest's id/);
    expect(() => readSidequests([{ id: 'a', giver: 'k', after: 'b', steps: [{ talk: 'x' }] }, { id: 'b', giver: 'k', after: 'a', steps: [{ talk: 'x' }] }])).toThrow(/after itself/);
    expect(() => readSidequests([{ id: 'a', giver: 'keeper', reward: 5, steps: [{ talk: 'x' }] }])).toThrow(/'reward'|reward is not part/);
  });

  it('names a person by role, by role and count, or by path', () => {
    const townies = F.people.filter((p) => p.role === 'townie');
    expect(whoOf(F, 'keeper').role).toBe('keeper');
    expect(whoOf(F, 'townie-2')).toBe(townies[1]);
    expect(whoOf(F, townies[0].path)).toBe(townies[0]);
    expect(whoOf(F, 'captain')).toBeNull();
  });

  it('holds a sidequest in a town only with all its people and houses, and what it is after', () => {
    const Q = readSidequests([
      { id: 'a', giver: 'keeper', steps: [{ talk: 'master' }] },
      { id: 'b', giver: 'keeper', steps: [{ talk: 'captain' }] },
      { id: 'c', giver: 'master', after: 'b', steps: [{ talk: 'keeper' }] },
      { id: 'd', giver: 'keeper', steps: [{ reach: 'town-hall-1' }] },
    ]);
    expect(sidequestsOn(Q, F, new Set(['town-shop-1'])).map((q) => q.id)).toEqual(['a']);
    expect(sidequestsOn(Q, F, new Set(['town-hall-1'])).map((q) => q.id)).toEqual(['a', 'd']);
  });
});

describe('sidequests: lowered onto the journal and the talk', () => {
  const Q = readSidequests([{ id: 'parcel', giver: 'keeper', steps: [{ talk: 'master' }] }, { id: 'reply', giver: 'master', after: 'parcel', steps: [{ talk: 'keeper' }] }]);
  const ids = new Map(F.people.map((p, i) => [p.path, `folk-${i}`]));
  const L = lowerSidequests(Q, F, { idOf: (p) => ids.get(p), houseAt: () => [0, 0], speakerOf });

  it('keeps each in the journal: begun by taking the offer, its steps in order, back to the giver at the end', () => {
    expect(L.quests[0]).toEqual({ id: 'sq-parcel', starts: 'sq-parcel', steps: [{ log: 'Talk to the Master', done: 'sq-parcel-1' }, { log: 'Return to the Keeper', done: 'sq-parcel-back' }] });
    const offer = L.menus.find((m) => m.id === 'sq-parcel-offer');
    expect(offer.lines).toEqual(['[Keeper: the errand]']);
    expect(offer.choices[0].then).toEqual({ emit: 'flag:sq-parcel' });
  });

  it('marks a reach step done on coming near the house, once the step before it is', () => {
    const R = lowerSidequests(readSidequests([{ id: 'walk', giver: 'keeper', steps: [{ talk: 'master' }, { reach: 'town-hall-1' }] }]), F, { idOf: (p) => ids.get(p), houseAt: () => [4, 5], speakerOf });
    expect(R.cues).toEqual([{ id: 'sq-walk-2-reach', when: { near: { at: [4, 5], r: 3 } }, if: [{ var: 'flag-sq-walk', eq: 1 }, { var: 'flag-sq-walk-1', eq: 1 }, { var: 'flag-sq-walk-2', eq: 0 }], then: { emit: 'flag:sq-walk-2' } }]);
    expect(R.quests[0].steps.map((s) => s.log)).toEqual(['Talk to the Master', 'Go to the hall', 'Return to the Keeper']);
  });

  it('offers a chained one only once the one before it is finished', () => {
    const master = ids.get(whoOf(F, 'master').path);
    const offer = L.talks[master].find((t) => t.open === 'sq-reply-offer');
    expect(offer.if).toContainEqual({ var: 'flag-sq-parcel-back', eq: 1 });
  });

  it('dispatches a talk to the first entry whose hold is on, by rank, else the chitchat', () => {
    const keeper = ids.get(whoOf(F, 'keeper').path), { cues, dropped } = dispatchCues(keeper, L.talks[keeper], 'chat', 'k-talk');
    const opens = cues.filter((c) => c.when.on === 'cue:k-talk');
    expect(opens.map((c) => (Array.isArray(c.then) ? c.then[0].open : c.then.open))).toEqual(['sq-parcel-thanks', 'sq-reply-1', 'sq-parcel-offer', 'chat']);
    // the k-th checks its own hold and that every one before it is off: no chain to run
    opens.slice(0, -1).forEach((c, k) => expect(c.if.length).toBe(k + 1));
    expect(opens[opens.length - 1].if.every((x) => x.ne === 1)).toBe(true);
    // the holds are read when the level starts and when a flag they read is set
    expect(cues.filter((c) => c.then?.emit === `folk-re:${keeper}`).map((c) => c.when.start ?? c.when.var)).toContain(true);
    expect(dropped).toEqual([]);
  });

  it('keeps a person to the entries the bus can dispatch, and says which were left out', () => {
    const many = Array.from({ length: MAX_ENTRIES + 2 }, (_, k) => ({ rank: 1, if: [{ var: `flag-x${k}`, eq: 1 }], open: `m${k}` }));
    const { cues, dropped } = dispatchCues('p', many, 'chat', 'p-talk');
    expect(dropped).toEqual([`m${MAX_ENTRIES}`, `m${MAX_ENTRIES + 1}`]);
    expect(cues.filter((c) => c.when.on === 'cue:p-talk').length).toBe(MAX_ENTRIES + 1);
  });
});
