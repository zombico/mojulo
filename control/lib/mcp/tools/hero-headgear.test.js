process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
// hero-headgear.test.js — the hero door's `headgear` word (headgear/wear.js) through the door: the word stored alone and
// lowered on every read, so a hero wearing it is the hero with the card applied by hand (one card per family, chosen in
// code, and a helmet by tradition as its outfit's language head); refused at the door by name; absent, nothing added;
// update_character swaps the word and null takes it off.
import { describe, it, expect } from 'vitest';
import { heroRecord, heroPlanOf, wornHero } from './layered.js';
import { createCharacterHandler, updateCharacterHandler } from './create-character.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { HEADGEAR, HEADGEAR_IDS, withHeadgear } from '@/lib/graph/headgear/cards.js';
import { HELMET_WORDS } from '@/lib/graph/headgear/helmets.js';

const OUTFIT = { type: 'outfit', style: 'streetwear' };
const BASE = { cast: 'male', form: 'tiered', hair: 'swept', outfit: OUTFIT };
const FAMILY_FIRSTS = [...new Set(HEADGEAR_IDS.map((id) => HEADGEAR[id].family))].map((f) => HEADGEAR_IDS.find((id) => HEADGEAR[id].family === f));
const BOTH = HEADGEAR_IDS.find((id) => typeof HEADGEAR[id].at.realistic === 'function');
const plan = (spec) => JSON.stringify(heroPlanOf(heroRecord(spec)));

describe('the hero door\'s headgear word', () => {
  it('a hero wearing a word is the hero with the card applied by hand, one card per family, on the game body', () => {
    for (const id of FAMILY_FIRSTS) expect(plan({ ...BASE, headgear: id }), id).toBe(plan(withHeadgear({ ...BASE }, 'tiered', id)));
  });
  it('on the realistic body, a card fitted to it; a helmet by tradition as the outfit\'s language head', () => {
    const real = { ...BASE, form: 'realistic' };
    expect(plan({ ...real, headgear: BOTH })).toBe(plan(withHeadgear({ ...real }, 'realistic', BOTH)));
    const w = HELMET_WORDS[0];
    expect(plan({ ...BASE, headgear: w })).toBe(plan({ ...BASE, outfit: { ...OUTFIT, language: { head: w } } }));
  });
  it('the record keeps the word alone; absent, no key and the hero as it was', () => {
    const r = heroRecord({ ...BASE, headgear: FAMILY_FIRSTS[0] });
    expect(r.headgear).toBe(FAMILY_FIRSTS[0]);
    expect(r.adorn).toBeUndefined();
    const bare = heroRecord(BASE);
    expect('headgear' in bare).toBe(false);
    expect(wornHero(bare)).toEqual(bare);
  });
  it('the door refuses a word by name', () => {
    expect(() => heroRecord({ ...BASE, headgear: `${FAMILY_FIRSTS[0]}x` })).toThrow(/did you mean/);
    const tieredOnly = HEADGEAR_IDS.find((id) => typeof HEADGEAR[id].at.realistic !== 'function');
    expect(() => heroRecord({ ...BASE, form: 'realistic', headgear: tieredOnly })).toThrow(/not fitted to the realistic body/);
    expect(() => heroRecord({ cast: 'male', form: 'tiered', headgear: HELMET_WORDS[0] })).toThrow(/helmet by tradition/);
  });
  it('update_character swaps the word in place and null takes it off', async () => {
    // (the light families, painted or a plate over the eyes, on a body with no outfit: three mints)
    const [a, b] = ['mask', 'visor'].map((f) => HEADGEAR_IDS.find((id) => HEADGEAR[id].family === f));
    const BARE = { cast: 'male', form: 'tiered', hair: 'swept' };
    const made = await createCharacterHandler({ as: 'hero', spec: { ...BARE, headgear: a }, ref: 'headgear-swap' });
    // (the door stamps its own words at mint, a face and a walk: the stored record without the word is the bare hero)
    const { headgear: first, ...bare } = SketchRepository.getByRef(made.ref).manifest.hero;
    expect(first).toBe(a);
    await updateCharacterHandler({ ref: made.ref, spec: { headgear: b } });
    const swapped = SketchRepository.getByRef(made.ref).manifest;
    expect(swapped.hero.headgear).toBe(b);
    expect(JSON.stringify(swapped.plan)).toBe(JSON.stringify(heroPlanOf(withHeadgear({ ...bare }, 'tiered', b))));
    await updateCharacterHandler({ ref: made.ref, spec: { headgear: null } });
    const off = SketchRepository.getByRef(made.ref).manifest;
    expect('headgear' in off.hero).toBe(false);
    expect(JSON.stringify(off.plan)).toBe(JSON.stringify(heroPlanOf(bare)));
    expect(off.plan).not.toEqual(swapped.plan);
  }, 120_000);
});
