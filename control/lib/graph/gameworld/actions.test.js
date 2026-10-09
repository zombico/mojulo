import { describe, it, expect } from 'vitest';
import { readActions, resolveActions, readGameworld, IDIOMS, STAGES } from './index.js';
import { LOOKS } from '../playscape/elements/elements.js';
import { BEAM_NAMES } from '../playscape/elements/beams.js';

const look = Object.keys(LOOKS)[0], attack = BEAM_NAMES[0];
const bad = (a, re) => expect(() => readActions(a)).toThrow(re);

describe('the hero\'s actions', () => {
  it('says what is wrong', () => {
    bad([], /is \{ idiom\?, system\?/);
    bad({ mana: 1 }, /\.mana is not part of the actions page/);
    bad({ idiom: 'Dark Souls' }, /read as "x-like"/);
    expect(readActions({ idiom: 'Soulslike' })).toEqual({ idiom: 'soulslike' });
    bad({ system: { kind: 'luck' } }, /system.kind is 'resource'/);
    bad({ system: { kind: 'resource', cost: 3 } }, /system.cost is not part of the system/);
    bad({ powers: {} }, /powers is a list/);
    bad({ powers: [{ id: 'Fire', verb: 'burn' }] }, /lowercase id/);
    bad({ powers: [{ id: 'a', verb: 'x' }, { id: 'a', verb: 'y' }] }, /appears twice/);
    bad({ powers: [{ id: 'a', verb: 'x', damage: 9 }] }, /powers\[0\].damage is not part of a power/);
    bad({ progression: [{ stage: 'end' }] }, /stage is 'early' \| 'mid' \| 'late'/);
    bad({ progression: [{ stage: 'early' }, { stage: 'early' }] }, /appears twice/);
  });

  it('is read through the hero page of a world, which names the same errors', () => {
    const W = (actions) => ({ id: 'w', seed: 8, levels: { a: { walk: { nodes: { t: { trail: true } } } } }, characters: { direction: { tradition: 'anime' }, hero: { actions } } });
    expect(readGameworld(W({ idiom: 'shonen-like' })).characters.hero.actions).toEqual({ idiom: 'shonen-like' });
    expect(() => readGameworld(W({ system: { kind: 'luck' } }))).toThrow(/hero.actions.system.kind/);
  });

  it('an idiom expands to a system and a progression template; what the creator states wins', () => {
    for (const w of Object.keys(IDIOMS)) {
      const R = resolveActions({ idiom: w });
      expect(R.system.kind).toBe(IDIOMS[w].system.kind);
      expect(R.progression.map((s) => s.stage)).toEqual(STAGES);
    }
    const R = resolveActions({ idiom: 'shonen-like', system: { kind: 'resource', resource: 'ki' }, progression: [{ stage: 'early', gains: [], gate: 'the dojo' }] });
    expect(R.system).toEqual({ kind: 'resource', resource: 'ki' });
    expect(R.progression[0].gate).toBe('the dojo');
    expect(R.progression[1].gate).toBe(IDIOMS['shonen-like'].progression[1].gate);
  });

  it('an unknown idiom is not an error: it goes open', () => {
    const R = resolveActions({ idiom: 'rhythm-like' });
    expect(R.idiom).toBe('rhythm-like');
    expect(R.open.join('\n')).toMatch(/idiom 'rhythm-like' is not in the lexicon/);
    expect(R.system).toBeNull();
  });

  it('a power names a real look or attack, or is held as words and listed open', () => {
    const R = resolveActions({
      system: { kind: 'resource', resource: 'ki' },
      powers: [{ id: 'a', verb: 'burn', look }, { id: 'b', verb: 'throw', attack }, { id: 'c', verb: 'glide' }, { id: 'd', verb: 'x', look: 'nope' }],
      progression: [{ stage: 'early', gains: ['a', 'b'] }, { stage: 'mid', gains: ['c', 'd'] }],
    });
    const o = R.open.join('\n');
    expect(o).toMatch(/power 'c' is held as words/);
    expect(o).toMatch(/power 'd': look 'nope' is not an element look/);
    expect(o).not.toMatch(/power 'a'/);
    expect(o).not.toMatch(/power 'b'/);
  });

  it('early and mid must be laid out; late is optional; a gain must be a power', () => {
    const R = resolveActions({ system: { kind: 'unlock' }, powers: [{ id: 'a', verb: 'x', look }], progression: [{ stage: 'early', gains: ['a', 'zz'] }] });
    const o = R.open.join('\n');
    expect(o).toMatch(/the mid stage is not laid out/);
    expect(o).not.toMatch(/late stage/);
    expect(o).toMatch(/gains 'zz', which is not a power id/);
  });

  it('a complete page has nothing open, and seeds mechanics as data only', () => {
    const R = resolveActions({ idiom: 'soulslike', powers: [{ id: 'parry', verb: 'deflect', look }], progression: [{ stage: 'early', gains: ['parry'] }, { stage: 'mid' }] }, { primary: 'flame' });
    expect(R.open).toEqual([]);
    expect(R.mechanicsSeed.verbs).toEqual([{ id: 'parry', verb: 'deflect', element: 'flame' }]);
    expect(R.mechanicsSeed.system.kind).toBe('stamina');
    expect(R.mechanicsSeed.stages.map((s) => s.stage)).toEqual(STAGES);
    expect(JSON.stringify(R.mechanicsSeed)).not.toMatch(/\d/);
  });

  it('pure: the same page resolves to the same bytes', () => {
    const A = { idiom: 'metroidvania-like', powers: [{ id: 'dash', verb: 'cross gaps', look }] };
    expect(JSON.stringify(resolveActions(A))).toBe(JSON.stringify(resolveActions(A)));
  });
});
