// The character target's looks (character-looks.js) and protocol (character-protocol.js): a look is the hero door's own
// words, its menus are read off the tables that own them, and what it says the door refuses, the door refuses.
import { describe, expect, it } from 'vitest';

import { CHARACTER_LOOKS, CHARACTER_LOOK_IDS, CHARACTER_MENUS, REGISTER_READS, characterLookTable, characterRegisterTable } from './character-looks.js';
import { CHARACTER_PROTOCOL } from './character-protocol.js';
import { REGISTERS } from '../graph/polygonizer/hero-form.js';
import { ANIME_STYLES } from '../graph/polygonizer/anime-styles.js';
import { STATUE_STYLES } from '../graph/statue/styles.js';
import { HERO_FIELDS, validateHeroSpec } from '../mcp/tools/layered.js';

const menuIds = (name) => CHARACTER_MENUS[name].map((m) => (typeof m === 'string' ? m : m.id));
/** a look's words with each choice at the door's default, a pole beside a build-only cast */
const lookSpec = (id) => {
  const L = CHARACTER_LOOKS[id];
  const chosen = Object.fromEntries(Object.entries(L.choose).filter(([, c]) => c.default !== undefined).map(([w, c]) => [w, c.default]));
  const spec = { ...L.words, ...chosen };
  if (spec.cast && typeof spec.cast === 'object' && spec.cast.pole === undefined) spec.cast = { pole: 'female', ...spec.cast };
  return spec;
};
/** the procedure a look runs through on the door: its head family, or its form */
const procedureOf = (id) => { const s = lookSpec(id); return s.form ?? (s.statue ? 'statue' : s.head ?? 'landmark'); };

describe('the character looks', () => {
  it('says what calls for every register the door has, and no other', () => {
    expect(Object.keys(REGISTER_READS).sort()).toEqual(Object.keys(REGISTERS).sort());
    expect(characterRegisterTable().filter((r) => r.default)).toHaveLength(1);
  });

  it('sets and chooses only hero words, each choice against a menu that holds its default', () => {
    for (const id of CHARACTER_LOOK_IDS) {
      const L = CHARACTER_LOOKS[id];
      for (const w of Object.keys(L.words)) expect(HERO_FIELDS, `${id} sets ${w}`).toContain(w);
      for (const [w, c] of Object.entries(L.choose)) {
        expect(HERO_FIELDS, `${id} chooses ${w}`).toContain(w);
        expect(CHARACTER_MENUS, `${id}.${w} menu`).toHaveProperty(c.from);
        if (c.default !== undefined) expect(menuIds(c.from), `${id}.${w} default`).toContain(c.default);
      }
      expect(Object.keys(REGISTERS), `${id} register`).toContain(L.register);
    }
  });

  it('reads its menus off the tables that own them', () => {
    expect(menuIds('animeStyles')).toEqual(Object.keys(ANIME_STYLES));
    expect(menuIds('statues')).toEqual([...STATUE_STYLES]);
  });

  it('makes a spec the hero door takes, one look per procedure (a head family or a form)', () => {
    const one = new Map();
    for (const id of CHARACTER_LOOK_IDS) if (!one.has(procedureOf(id))) one.set(procedureOf(id), id);
    expect([...one.keys()].sort()).toEqual(['anime', 'landmark', 'realistic', 'statue']);
    for (const id of one.values()) expect(validateHeroSpec(lookSpec(id)), id).toEqual([]);
  });

  it('refuses what the door refuses, and says so up front', () => {
    const statue = CHARACTER_LOOKS.statue;
    expect(statue.refuses.join(' ')).toMatch(/anime head/);
    expect(validateHeroSpec({ ...lookSpec('statue'), head: 'anime' }).join(' ')).toMatch(/statue/);
  });
});

describe('the character protocol', () => {
  it('shows the looks and the registers as the tables say, and mints through the hero door until its capture lands', () => {
    expect(CHARACTER_PROTOCOL.target).toBe('character');
    expect(CHARACTER_PROTOCOL.looks).toEqual(characterLookTable());
    expect(CHARACTER_PROTOCOL.registers).toEqual(characterRegisterTable());
    expect(CHARACTER_PROTOCOL.fidelity_contract.likeness).toBeTruthy();
    expect(CHARACTER_PROTOCOL.capture_call).toMatch(/create_character\(\{ as: 'hero'/);
    expect(CHARACTER_PROTOCOL.next).toMatch(/update_character/);
  });

  it('leaves likeness to the model: an X-like offer for trademarked work, and nothing that gates the sculpting after', () => {
    const text = CHARACTER_PROTOCOL.likeness.join('\n');
    expect(text).toMatch(/YOUR judgment/);
    expect(text).toMatch(/x-like/);
    expect(text).toMatch(/refuses nothing/);
    expect(text).toMatch(/update_character/);
  });
});
