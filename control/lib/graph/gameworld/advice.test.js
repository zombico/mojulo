import { describe, it, expect } from 'vitest';
import { signature, sameness, grounding, authorship, compareWorlds, REFERENCES } from './advice.js';
import { gameworldSamples } from './samples.js';
import { MEADOWMARK, MEADOWMARK_HERO } from './index.js';

const GROUND = { id: 'own', levels: { a: { walk: { nodes: { t: { trail: true } } } } } };
// a world designed from its own brief: nothing in it is the fixture's
const OWN = {
  ...GROUND,
  brief: 'a sullen witch of a drowned city under a winter moon, who freezes the tide to cross it',
  characters: {
    direction: { tradition: 'anime', primary: 'ice', secondary: 'moon', motif: ['wave'] },
    hero: {
      motion: { vibe: ['stoic', 'graceful'] },
      actions: { idiom: 'metroidvania-like', powers: [{ id: 'tide-freeze', verb: 'freeze the tide', look: 'frost' }], progression: [{ stage: 'early', gains: ['tide-freeze'] }] },
    },
  },
};

describe('the rail\'s advice', () => {
  it('a world that reads as the fixture is told so, with the choices it shares; a world of its own is not', () => {
    const copy = { ...MEADOWMARK_HERO, id: 'mine' };
    expect(sameness(copy).join('\n')).toMatch(/reads as the test fixture 'meadowmark' on \d+ of \d+ distinctive choices \(.*; and its tradition, idiom, kit\)/);
    expect(sameness(OWN)).toEqual([]);
    // the fixture's direction alone (and a common idiom), in a world otherwise its own: below the threshold
    expect(sameness({ ...OWN, characters: { ...OWN.characters, direction: MEADOWMARK_HERO.characters.direction } })).toEqual([]);
  });

  it('a page that is a served sample verbatim is told so, with its seed', () => {
    const s = gameworldSamples('direction', { n: 12, seed: 3 }).samples[4].fragment;
    const lifted = { ...OWN, characters: { ...OWN.characters, direction: s } };
    expect(sameness(lifted).join('\n')).toMatch(/the direction page is synthetic sample 5 of seed 3, verbatim/);
    const m = gameworldSamples('motion', { n: 12, seed: 2 }).samples[0].fragment;
    expect(sameness({ ...OWN, characters: { ...OWN.characters, hero: { ...OWN.characters.hero, motion: m } } }).join('\n')).toMatch(/the motion page is synthetic sample 1 of seed 2/);
  });

  it('grounding asks about the choices the brief does not explain, and only where there is a brief', () => {
    // 'ice' is asked about: the brief says "freezes", and a words-only reading does not know they meet
    expect(grounding(OWN)).toEqual([
      "the leading element 'ice': nothing in the brief says so; where does it come from? (record it: brief.why.ice)",
      "the motif 'wave': nothing in the brief says so; where does it come from? (record it: brief.why.wave)",
      "the feel 'graceful': nothing in the brief says so; where does it come from? (record it: brief.why.graceful)",
      "the feel 'stoic': nothing in the brief says so; where does it come from? (record it: brief.why.stoic)",
    ]);
    expect(grounding({ ...OWN, brief: undefined })).toEqual([]);
    // a reason recorded closes the question; the composer's { prompt } and a creator's { text } read the same
    expect(grounding({ ...OWN, brief: { text: OWN.brief, why: { ice: 'freezes the tide', wave: 'a drowned city', stoic: 'sullen', graceful: 'a witch' } } })).toEqual([]);
    expect(grounding({ ...OWN, brief: { prompt: OWN.brief } })).toHaveLength(4);
  });

  it('authorship says how much is the creator\'s and what was left to the book', () => {
    const A = authorship(OWN);
    expect(A.written).toEqual(['levels', 'direction', 'motion', 'actions']);
    expect(A.derived).toEqual(expect.arrayContaining(['intent', 'world', 'feel', 'juice', 'looks.body', 'adornment', 'equipment', 'foes']));
    expect(A.line).toMatch(/^4 of 16 pages written; left to the book's first reading: /);
    const M = authorship(MEADOWMARK);
    expect(M.written).toEqual(expect.arrayContaining(['world', 'levels']));
    expect(M.derived).not.toContain('foes');   // no characters, no foes: no bestiary to write
  });

  it('authorship counts what game it is, the feel, the juice and the foes, and the systems only by their own settings (2026-11-02)', () => {
    const W = { ...OWN, name: 'Drowned', intent: { from: 'metroidvania' }, feel: 'steel-serpents', juice: { register: 'anime' }, foes: { grunt: { class: 'guard' } } };
    expect(authorship(W).written).toEqual(expect.arrayContaining(['intent', 'world', 'feel', 'juice', 'foes']));
    expect(authorship({ ...W, juice: 'auto' }).derived).toContain('juice');
    // the levels' destruction, or a ui left to propose, is not the systems written; a stat is
    expect(authorship({ ...W, mechanics: { destruction: 'objects' } }).derived).toContain('systems');
    expect(authorship({ ...W, mechanics: { ui: 'propose' } }).derived).toContain('systems');
    expect(authorship({ ...W, mechanics: { stats: { hp: 30 } } }).written).toContain('systems');
  });

  it('grounding reads a negation as the brief ruling a choice out, never grounding it (2026-11-02)', () => {
    const W = { ...OWN, brief: 'a sullen witch, never floaty, who freezes the tide; ice and moon, waves, stoic', characters: { ...OWN.characters, hero: { ...OWN.characters.hero, motion: { vibe: ['floaty', 'stoic'] } } } };
    expect(grounding(W)).toEqual(["the feel 'floaty': the brief says not; why is it here? (record it: brief.why.floaty)"]);
    expect(grounding({ ...W, brief: W.brief.replace('never floaty', "isn't floaty") })).toHaveLength(1);
    expect(grounding({ ...W, brief: W.brief.replace('never floaty', 'floaty') })).toEqual([]);
  });

  it('the comparison: where the world and the reference differ, and what the reference wrote that the world left', () => {
    const C = compareWorlds(OWN, REFERENCES.meadowmark);
    expect(C.differs.find((r) => r.choice === 'primary')).toEqual({ choice: 'primary', reference: signature(MEADOWMARK_HERO).primary, world: 'ice' });
    expect(C.writtenInReferenceOnly).toEqual(expect.arrayContaining(['looks.body', 'adornment', 'equipment']));
    expect(C.authorship.reference).toMatch(/pages written/);
  });
});
