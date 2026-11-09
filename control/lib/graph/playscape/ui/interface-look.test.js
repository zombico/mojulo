import { describe, it, expect } from 'vitest';
import { interfaceLook, worldLook, readUi, INTENT_LOOKS } from './interface-look.js';
import { THEME_CARDS, THEME_CARD_IDS, cardTheme, cardThemes } from './theme-cards/loader.js';
import { readTheme, THEMES, THEME_FAMILIES } from '../../../mana-ui/theme.js';
import { reviewParts } from '../../gameworld/review.js';
import { chaptersOfPath, chapterOfPart, chapterOfCard } from '../../gameworld/chapters.js';
import { gameworldCards } from '../../gameworld/gameworld-cards.js';

// THE INTERFACE'S LOOK: a look is a card (data, a child theme, the way a WordPress theme is a theme.json); a game's look
// is the interface department's, worked with the art director (the intent's register) and the colour theorist (the
// world's palette); the review says where it came from and what it reads like. One case per procedure.
const W = (more = {}) => ({ id: 'w', seed: 8, levels: { a: { walk: { nodes: { t: { trail: true } } } } }, ...more });
const lively = Object.keys(INTENT_LOOKS).find((g) => THEME_FAMILIES.party.includes(INTENT_LOOKS[g]));
const calm = Object.keys(INTENT_LOOKS).find((g) => INTENT_LOOKS[g] === 'grim');

describe('theme cards: a look is data', () => {
  it('a card says only what it changes over what it comes from, a preset, another card or the world', () => {
    const byKind = (k) => THEME_CARD_IDS.find((id) => (k === 'preset' ? THEMES[THEME_CARDS[id].from] : k === 'world' ? THEME_CARDS[id].from === 'world' : THEME_CARDS[THEME_CARDS[id].from]));
    const p = byKind('preset'), T = readTheme(cardTheme(p)), parent = readTheme(THEME_CARDS[p].from);
    const unsaid = Object.keys(THEMES.greybox).find((k) => !['name', 'tokens', 'type', 'sides'].includes(k) && THEME_CARDS[p][k] === undefined);
    expect(T[unsaid]).toEqual(parent[unsaid]);                                       // what it does not say, it inherits
    const w = byKind('world');
    expect(readTheme(cardTheme(w, { world: { from: 'rebel' } })).from).toBe('rebel'); // from the look it is handed
    expect(() => cardTheme('no-such-card')).toThrow(/no theme card 'no-such-card' \(the cards: /);
    expect(Object.keys(cardThemes())).toEqual(THEME_CARD_IDS);
  });
});

describe('the interface\'s look', () => {
  it('the art director starts the look from the intent\'s register; the colour theorist colours it from the world\'s palette', () => {
    const G = { name: 'x', intent: { from: calm }, style: { palette: { seed: 3 } } }, L = interfaceLook(G);
    expect(L.theme.from).toBe('grim');
    expect(L.from).toEqual({ look: "the world's: grim by its intent", colour: "the world's palette" });
    expect(readTheme(L.theme).tokens.accent).not.toBe(THEMES.grim.tokens.accent);
    expect(interfaceLook({ ...G, ui: { colour: 'theme' } }).theme.tokens).toBeUndefined();   // the look keeps its own
    expect(interfaceLook({ name: 'y' }).theme.from).toBe('console');                         // no intent, no palette
  });
  it('an anime game\'s lively look snaps; a calm look keeps still', () => {
    const anime = { juice: { register: 'anime' } };
    const live = worldLook({ intent: { from: lively }, ...anime }), still = worldLook({ intent: { from: calm }, ...anime });
    if (THEMES[INTENT_LOOKS[lively]].motion === 'ease') expect(live.motion).toBe('snap');
    expect(still.motion).toBeUndefined();
  });
  it('a theme written in the game over a card or the world is a child theme; a ui is read and taught', () => {
    const L = interfaceLook({ intent: { from: calm }, ui: { theme: { from: THEME_CARD_IDS[0], stage: 'band' }, colour: 'theme' } });
    expect(readTheme(L.theme).stage).toBe('band');
    expect(readUi({ theme: 'nope' })[0]).toMatch(/is a preset .*a theme card .*world/);
    expect(readUi({ theme: { from: 'world', frame: 'chunky' } })[0]).toMatch(/frame is one of/);
    expect(readUi({ languages: { ja: { back: 3 } } })[0]).toMatch(/languages.ja.back is a word/);
    expect(readUi({ theme: 'world', colour: 'world', languages: { ja: { back: '戻る' } }, language: 'ja' })).toEqual([]);
  });
});

describe('the interface department in the studio', () => {
  it('the interface chapter owns the look, its review part and its card', () => {
    expect(chaptersOfPath('/ui/theme').map((c) => c.id)).toEqual(['interface']);
    expect(chapterOfPart('interface:look').id).toBe('interface');
    expect(chapterOfCard('gameworld-interface').id).toBe('interface');
    expect(gameworldCards().get('gameworld-interface').body).toMatch(/ART DIRECTOR[\s\S]*COLOUR THEORIST[\s\S]*A NEW LOOK IS A CARD/);
  });
  it('a world with a ui is reviewed for its look: where it came from, its words, its colours, its advice', () => {
    const parts = reviewParts(W({ ui: { theme: 'grim', languages: { ja: { back: '戻る' } } } }));
    const P = parts.find((p) => p.id === 'interface:look');
    expect(P.content.preset).toBe('grim');
    expect(P.content.languages).toEqual(['ja']);
    expect(Array.isArray(P.content.advice)).toBe(true);
    expect(reviewParts(W()).some((p) => p.id === 'interface:look')).toBe(false);      // no ui, no part: nothing changes
    expect(() => reviewParts(W({ ui: { theme: 'nope' } }))).toThrow(/gameworld: ui.theme 'nope'/);
  });
});
