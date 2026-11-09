import { describe, it, expect } from 'vitest';
import { readGameworld } from './world.js';
import { battlesPage } from './battles-page.js';
import { HOLLIN_VALE, MEADOWMARK_HERO } from './examples.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// the book reads the party battles back (battles-page.js): what the run lays, in the words a person reads
describe('the battles page', () => {
  it('a world with no party battles has none', () => {
    expect(battlesPage(readGameworld(MEADOWMARK_HERO), { esc })).toBeNull();
  });

  it('a hub world: the party, every pack in the order met with the boss last, each foe\'s look, the hub\'s market and its people', () => {
    const P = battlesPage(readGameworld(HOLLIN_VALE), { esc }), T = text(P.section);
    expect(P.tab).toMatch(/#battles/);
    // the road: the book's packs in order, numbered across the game, the boss the last and marked
    const met = [...P.section.matchAll(/<li><i>(\d+)<\/i> ([^<]+)/g)].map((m) => m[2].trim());
    expect(met.slice(0, 2)).toEqual(['wolf, wolf', 'wolf, bandit']);
    expect(met.at(-1)).toBe(HOLLIN_VALE.battles.boss.join(', '));
    expect(T).toMatch(/the boss: no escape/);
    // none in the hub: the town is where the party comes back to
    expect(P.section).not.toMatch(/href="#level-hollin">Hollin<\/a> · square<ol/);
    // each foe as it stands: the book's own look said as the book's
    expect(T).toMatch(/Bandit a people: lupine the book's/);
    expect(T).toMatch(/Wolf a beast: wolf/);
    // the market in the hub, kept by its people
    expect(T).toMatch(/the hub: the merchant sells Potion/);
    expect(T).toMatch(/talking to them opens the shop and the inn/);
    expect(T).toMatch(/walled in its builders' own fortification/);
  });

  it('a world that fights with no hub: a merchant and an inn on each fighting stage, by tier', () => {
    const T = text(battlesPage(readGameworld({ ...MEADOWMARK_HERO, battles: {} }), { esc }).section);
    expect(T).toMatch(/The default packs/);
    expect(T).toMatch(/tier 1/);
    expect(T).toMatch(/No hub/);
  });
});
