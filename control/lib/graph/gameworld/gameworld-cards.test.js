import { describe, it, expect } from 'vitest';
import { gameworldCards, GAMEWORLD_CARD_IDS } from './gameworld-cards.js';
import { gameworldSamples, SAMPLE_PAGES, DERIVE } from './samples.js';
import { ELEMENT_WORDS, IDIOMS, SYSTEM_KINDS, VIBES, RAILS, CLASS_SLOTS, TRADITIONS, MEADOWMARK_HERO, HALDEN_REACH, readGameworld } from './index.js';
import { LOOKS } from '../playscape/elements/elements.js';
import { BEAM_NAMES } from '../playscape/elements/beams.js';
import { validateGear } from '../polygonizer/hero-gear.js';

// the words only the test fixtures use: none may reach anything an agent reads while designing
const FIXTURE_WORDS = (() => {
  const H = MEADOWMARK_HERO.characters.hero, A = H.adornment;
  return ['meadowmark', 'halden', HALDEN_REACH.id, MEADOWMARK_HERO.id, MEADOWMARK_HERO.equipment.style.id,
    ...A.items.map((it) => it.id), ...A.items.flatMap((it) => (it.alt ?? []).map((a) => a.id)), ...H.actions.powers.map((p) => p.id),
    ...Object.keys(HALDEN_REACH.civilizations), ...Object.keys(HALDEN_REACH.levels)];
})();
const leaks = (text) => FIXTURE_WORDS.filter((w) => new RegExp(`\\b${w.replace(/[-]/g, '\\-')}\\b`, 'i').test(text));

describe('the rail\'s cards', () => {
  const cards = gameworldCards(), all = [...cards.values()].map((c) => c.body).join('\n');

  it('the guide first, then a card per page in the loop\'s order, each small', () => {
    expect(GAMEWORLD_CARD_IDS[0]).toBe('gameworld-guide');
    expect(GAMEWORLD_CARD_IDS).toEqual(['gameworld-guide', 'gameworld-world', 'gameworld-direction', 'gameworld-looks', 'gameworld-motion', 'gameworld-actions', 'gameworld-adornment', 'gameworld-equipment', 'gameworld-systems']);
    for (const c of cards.values()) expect(Buffer.byteLength(c.body), c.id).toBeLessThan(4096);
  });

  it('their words are the tables\' own: every word the reader reads is on its card', () => {
    const on = (id, ws) => { for (const w of ws) expect(cards.get(id).body, `${id}: ${w}`).toContain(w); };
    on('gameworld-direction', [...Object.keys(TRADITIONS), ...Object.keys(ELEMENT_WORDS)]);
    on('gameworld-motion', Object.keys(VIBES));
    on('gameworld-actions', [...Object.keys(IDIOMS), ...Object.keys(SYSTEM_KINDS), ...Object.keys(LOOKS), ...BEAM_NAMES]);
    on('gameworld-adornment', RAILS.flatMap((r) => r.stems));
    on('gameworld-equipment', Object.keys(CLASS_SLOTS));
  });

  it('no test fixture is shown anywhere: not its name, its items, its powers, its places', () => {
    expect(FIXTURE_WORDS.length).toBeGreaterThan(8);
    expect(leaks(all)).toEqual([]);
  });

  it('a contrast pair holds: each fragment is one the reader takes, and its consequences are the book\'s own', () => {
    const body = cards.get('gameworld-actions').body;
    expect(body.match(/brief: "/g)).toHaveLength(2);
    expect(body).toContain('"system":"unlock"');
    expect(body).toContain('"system":"stamina (stamina)"');
    expect(body).not.toContain('"open"');
  });
});

describe('synthetic samples', () => {
  it('seeded: the same page, seed and count draw the same; another seed draws otherwise', () => {
    for (const page of Object.keys(SAMPLE_PAGES)) {
      expect(JSON.stringify(gameworldSamples(page, { n: 4, seed: 9 })), page).toBe(JSON.stringify(gameworldSamples(page, { n: 4, seed: 9 })));
      expect(JSON.stringify(gameworldSamples(page, { n: 4, seed: 9 }).samples), page).not.toBe(JSON.stringify(gameworldSamples(page, { n: 4, seed: 10 }).samples));
    }
  });

  it('spread, not repeated: a draw cycles its table before it repeats', () => {
    const S = gameworldSamples('direction', { n: 12, seed: 3 }).samples;
    expect(new Set(S.map((s) => s.fragment.primary)).size).toBe(12);
    expect(new Set(S.slice(0, 2).map((s) => s.fragment.tradition)).size).toBe(2);
  });

  it('every fragment is one the reader takes, and shows what it derives; labelled as coverage, never a recommendation', () => {
    for (let seed = 1; seed <= 5; seed += 1) {
      const dir = gameworldSamples('direction', { n: 6, seed });
      for (const s of dir.samples) expect(() => readGameworld({ id: 'x', levels: { a: { walk: { nodes: { t: { trail: true } } } } }, characters: { direction: s.fragment } })).not.toThrow();
      const act = gameworldSamples('actions', { n: 6, seed });
      for (const s of act.samples) {
        expect(s.derives.system).toBeTruthy();
        expect(s.derives.open, JSON.stringify(s.fragment)).toBeUndefined();
        expect(s.fragment.powers.every((p) => !['walk', 'run', 'step', 'jump', 'sprint'].includes(p.verb))).toBe(true);
      }
      for (const s of gameworldSamples('gear', { n: 6, seed }).samples) for (const [cls, read] of Object.entries(s.derives.classes)) expect(read, `${seed} ${cls}`).not.toMatch(/does not hold/);
      expect(dir.note).toMatch(/not what to choose|None is a recommendation/);
    }
  });

  it('no sample shows a fixture word', () => {
    const text = Object.keys(SAMPLE_PAGES).map((p) => JSON.stringify(gameworldSamples(p, { n: 12, seed: 1 }))).join('\n');
    expect(leaks(text)).toEqual([]);
  });

  it('says what is wrong', () => {
    expect(() => gameworldSamples('weather')).toThrow(/'weather' is not a page that can be sampled/);
    expect(() => gameworldSamples('gear', { n: 40 })).toThrow(/n is a whole number from 1 to 12/);
    expect(() => gameworldSamples('gear', { seed: 1.5 })).toThrow(/seed is a whole number/);
  });

  it('a gear card the sampler draws is one the equipment kernel takes for every class', () => {
    const card = gameworldSamples('gear', { n: 1, seed: 2 }).samples[0].fragment;
    for (const [cls, slot] of Object.entries(CLASS_SLOTS)) expect(validateGear({ [slot]: { item: cls, style: card } }), cls).toEqual([]);
    expect(Object.keys(DERIVE)).toEqual(Object.keys(SAMPLE_PAGES));
  });
});
