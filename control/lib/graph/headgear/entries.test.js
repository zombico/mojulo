// entries.test.js — the generated headgear and pack cards (headgear/entries.js, cosmos/packs/entries.js): in the solid
// vocabulary by id, generated (so the bare listing leaves them out), naming the door they are worn and made through, a
// word of each headgear family with the bodies it fits, and the pack's cast and crews by the ids its orders take.
import { describe, it, expect } from 'vitest';
import { getSolidVocabCatalog } from '../solid-vocab/loader.js';
import { HEADGEAR, HEADGEAR_IDS } from './cards.js';
import { HELMET_WORDS } from './helmets.js';
import { CAST } from '../cosmos/packs/comic-hero/cast.js';
import { GRUNT_STYLE_IDS } from '../cosmos/packs/comic-hero/grunts.js';

describe('the generated headgear and pack cards', () => {
  const catalog = getSolidVocabCatalog();
  it('headgear: a word of each family, the realistic body\'s words said, a helmet by tradition among them', () => {
    const C = catalog.get('headgear');
    expect(C).toMatchObject({ generated: true, entry: 'create_character', family: 'figure' });
    for (const f of new Set(HEADGEAR_IDS.map((id) => HEADGEAR[id].family))) {
      expect(C.body, f).toContain(`## ${f}`);
      expect(C.body).toContain(`\`${HEADGEAR_IDS.find((id) => HEADGEAR[id].family === f)}\``);
    }
    expect(C.body).toContain('(both bodies)');
    expect(C.body).toContain(`\`${HELMET_WORDS[0]}\``);
  });
  it('the comic hero pack: its cast and its crews by the ids the orders take', () => {
    const C = catalog.get('comic-hero');
    expect(C).toMatchObject({ generated: true, entry: 'create_character' });
    expect(C.body).toContain(`\`${CAST[0].id}\``);
    expect(C.body).toContain(`\`${GRUNT_STYLE_IDS[0]}\``);
    expect(C.body).toMatch(/pack: \{ id: 'comic-hero', member/);
  });
});
