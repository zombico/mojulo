process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
// create-character.pack.test.js — a pack's character by name (create_character { pack }, cosmos/packs/index.js): the
// pack's own orders with the headgear left as the hero door's word are the same hero as the orders with the card worn
// (a cast member, one headgear card per family chosen in code, and a grunt whose crew wears a head); through the door,
// the row keeps the word and the result says what was rolled; a pack, a member and a word it does not have are refused.
import { describe, it, expect } from 'vitest';
import { heroRecord, heroPlanOf } from './layered.js';
import { createCharacterHandler } from './create-character.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { HEADGEAR, HEADGEAR_IDS } from '@/lib/graph/headgear/cards.js';
import { memberOrders } from '@/lib/graph/cosmos/packs/comic-hero/characters.js';
import { gruntOrders, GRUNT_STYLES, GRUNT_STYLE_IDS } from '@/lib/graph/cosmos/packs/comic-hero/grunts.js';
import { packCharacterOrders } from '@/lib/graph/cosmos/packs/index.js';

const LOOK = 'dcau-golden';
const FAMILY_FIRSTS = [...new Set(HEADGEAR_IDS.map((id) => HEADGEAR[id].family))].map((f) => HEADGEAR_IDS.find((id) => HEADGEAR[id].family === f));
// (the hero as the door reads it: its vibe is the door's own key, the same on both sides)
const plan = (spec) => { const { vibe: _v, ...words } = spec; return JSON.stringify(heroPlanOf(heroRecord(words))); };

describe('a pack\'s character by name', () => {
  it('a cast member with its headgear as the word is the member with the card worn, one card per family', () => {
    for (const headgear of FAMILY_FIRSTS) {
      const eager = memberOrders('hero', LOOK, { headgear }).mint.args.spec, word = memberOrders('hero', LOOK, { headgear, words: true }).mint.args.spec;
      expect(word.headgear, headgear).toBe(headgear);
      expect(plan(word), headgear).toBe(plan(eager));
    }
    // (no headgear: the orders exactly as without the option)
    expect(memberOrders('rival', LOOK, { words: true })).toEqual(memberOrders('rival', LOOK));
  });
  it('a grunt whose crew wears a head: the head as the word, the crew\'s colours still over it', () => {
    const style = GRUNT_STYLE_IDS.find((s) => Object.values(GRUNT_STYLES[s].kinds).some((K) => K.heads?.some(Boolean)));
    const index = Array.from({ length: 32 }, (_, i) => i).find((i) => gruntOrders(style, LOOK, { index: i }).grunt.head);
    const eager = gruntOrders(style, LOOK, { index }), word = gruntOrders(style, LOOK, { index, words: true });
    expect(word.mint.args.spec.headgear).toBe(eager.grunt.head);
    expect(plan(word.mint.args.spec)).toBe(plan(eager.mint.args.spec));
  });
  it('refuses a pack, a member or a word it does not have, and a member and a grunt at once', () => {
    expect(() => packCharacterOrders({ id: 'western' })).toThrow(/no pack 'western'/);
    expect(() => packCharacterOrders({ id: 'comic-hero', member: 'hero', grunt: GRUNT_STYLE_IDS[0] })).toThrow(/name one/);
    expect(() => packCharacterOrders({ id: 'comic-hero', member: 'hero', colourway: 'red' })).toThrow(/not colourway/);
    expect(() => packCharacterOrders({ id: 'comic-hero', member: 'nemesis' })).toThrow(/no cast member 'nemesis'/);
    expect(() => packCharacterOrders({ id: 'comic-hero', member: 'hero', look: 'noir' })).toThrow(/no look 'noir'/);
  });
  it('through create_character: minted through the hero door, the word kept on the row, what was rolled said', async () => {
    const headgear = HEADGEAR_IDS.find((id) => HEADGEAR[id].family === 'visor');
    const out = await createCharacterHandler({ pack: { id: 'comic-hero', member: 'sidekick', headgear }, ref: 'pack-sidekick' });
    expect(out.pack).toMatchObject({ id: 'comic-hero', member: 'sidekick', look: LOOK, headgear });
    const row = SketchRepository.getByRef(out.ref);
    expect(row.manifest.hero.headgear).toBe(headgear);
    expect(row.title).toMatch(/sidekick/i);
    await expect(createCharacterHandler({ pack: { id: 'comic-hero', member: 'sidekick' }, years: 3 })).rejects.toThrow(/not years/);
  }, 120_000);
});
