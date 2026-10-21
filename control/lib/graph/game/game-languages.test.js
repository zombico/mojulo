// A game localized into more than one language (game-languages.js): declared once on the game manifest, read with
// teaching errors, its words tabled with what each one is, a localizer briefed with the language's conventions and the
// gamer's words for what it owes, its lines folded in with their placeholders held, and the page's language picked.
import { describe, it, expect } from 'vitest';
import { readLanguages, gameWords, languageTable, coverage, localizationBrief, mergeTranslations, pickLanguage, pageLocale } from './game-languages.js';
import { validateGameManifest } from './game-manifest.js';

const game = (languages) => ({
  kind: 'game', title: 'Coin Run',
  store: { slices: [{ name: 'hero', kind: 'character' }] },
  levels: [{ ref: 'lv-a', title: 'The Docks' }, { ref: 'lv-b', title: 'Rooftops, at night' }],
  links: [{ from: { ref: 'lv-a', door: 'east' }, to: { ref: 'lv-b', door: 'west' } }],
  menu: { tagline: 'Grab every coin', entries: [{ id: 'play', title: 'Play', kind: 'levels' }, { id: 'about', title: 'About', kind: 'about', body: ['Made in a week.', ['See ', { text: 'the site', href: 'https://x.y' }]], links: [{ label: 'Our site', href: 'https://x.y' }] }] },
  difficulty: { options: [{ id: 'easy', name: 'Easy', sub: 'for {name}' }] },
  ...(languages ? { languages } : {}),
});
const LANG = { source: 'en', locales: ['en', 'ja', 'ar'], strings: { ja: { 'Coin Run': 'コインラン', Play: 'プレイ' } } };
// a level's words as level-words.js finds them on its resolved payload
const LEVEL = {
  'lv-a': [
    { text: 'HP', role: 'hud-label', at: 'events.hud[0]' },
    { text: 'Welcome to the hold.', role: 'line', at: 'events.scenes[0].beats[0]', speaker: 'Mayor Ilse' },
    { text: 'Mayor Ilse', role: 'speaker', at: 'events.scenes[0].beats[0]' },
    { text: 'Play', role: 'choice', at: 'events.menus[0].picks[0]' },
  ],
  'lv-b': [{ text: 'Game over', role: 'hud-text', at: 'events.hud[0]' }],
};

describe('the declaration', () => {
  it('reads a good one and says what is wrong with a bad one', () => {
    expect(readLanguages(LANG)).toEqual([]);
    expect(readLanguages({ source: 'en', locales: ['ja', 'es'] })[0]).toMatch(/must include the source/);
    expect(readLanguages({ source: 'en', locales: ['en'] })[0]).toMatch(/two or more/);
    expect(readLanguages({ source: 'en', locales: ['en', 'Japanese'] })[0]).toMatch(/BCP 47/);
    expect(readLanguages({ ...LANG, strings: { fr: {} } })[0]).toMatch(/strings\.fr/);
    expect(readLanguages({ ...LANG, locale: 'x' })[0]).toMatch(/not a languages setting/);
    expect(validateGameManifest(game(LANG)).ok).toBe(true);
    expect(validateGameManifest(game({ source: 'en' })).errors.join()).toMatch(/locales/);
  });
});

describe('the words', () => {
  it('the game\'s own: each place with what it is; never ids, refs, hrefs, door links or people\'s names', () => {
    const W = gameWords({ ...game(LANG), front: { credits: { roll: [{ role: 'Design', names: ['Ada Byron'] }] } } });
    expect(W.map((w) => [w.text, w.role])).toEqual([
      ['Coin Run', 'game-title'], ['The Docks', 'level-title'], ['Rooftops, at night', 'level-title'],
      ['Grab every coin', 'tagline'], ['Play', 'menu-entry'], ['About', 'menu-entry'], ['Made in a week.', 'prose'],
      ['See ', 'prose'], ['the site', 'prose'], ['Our site', 'label'], ['Easy', 'option'], ['for {name}', 'option-sub'], ['Design', 'credit-role'],
    ]);   // 'See ' is never trimmed: the page swaps the exact text it shows
  });

  it('one row per text across the game and its levels, every role and place kept; a missing word is null', () => {
    const T = languageTable(game(LANG), LEVEL);
    const play = T.rows.find((r) => r.text === 'Play');
    expect(play.roles).toEqual(['menu-entry', 'choice']);
    expect(play.where).toEqual(['game: menu.entries[0].title', 'lv-a: events.menus[0].picks[0]']);
    expect(play.values).toEqual({ en: 'Play', ja: 'プレイ', ar: null });
    expect(T.rows.find((r) => r.text === 'Welcome to the hold.').speakers).toEqual(['Mayor Ilse']);
    const C = coverage(game(LANG), LEVEL);
    expect(C.ja).toMatchObject({ done: 2, total: T.rows.length, stale: [] });
    expect(C.ar.missing).toHaveLength(T.rows.length);
  });
});

describe('the brief: localized, not translated', () => {
  it('each word owed with what it is, who says it and its room; the language\'s conventions; the gamer\'s words', () => {
    const B = localizationBrief(game(LANG), LEVEL, 'ja');
    expect(B).toMatchObject({ locale: 'ja', source: 'en', done: 2 });
    expect(B.conventions).toMatchObject({ script: 'Jpan', dir: 'ltr', quotes: ['「', '」'], plural: ['other'] });
    expect(B.conventions.address).toMatch(/です\/ます/);
    expect(B.conventions.names).toMatch(/katakana/);
    const line = B.words.find((w) => w.text === 'Welcome to the hold.');
    expect(line).toMatchObject({ said_by: ['Mayor Ilse'], where: ['lv-a: events.scenes[0].beats[0]'] });
    expect(line.fit).toBeUndefined();   // a line wraps in its box; a label does not
    expect(B.words.find((w) => w.text === 'HP')).toMatchObject({ fit: 3 });
    expect(B.words.find((w) => w.text === 'HP').is[0]).toMatch(/HUD label/);
    expect(B.words.map((w) => w.text)).not.toContain('Play');   // already localized
    expect(B.glossary.map((g) => g.term)).toEqual(expect.arrayContaining(['HP', 'Game over']));
    expect(B.glossary.find((g) => g.term === 'Game over').use).toBe('ゲームオーバー');
    expect(B.rules.join(' ')).toMatch(/placeholder/);
    expect(() => localizationBrief(game(LANG), LEVEL, 'en')).toThrow(/not one of this game's target languages/);
  });

  it('an RTL language reads right to left; a language with no bundled conventions says so', () => {
    expect(localizationBrief(game(LANG), LEVEL, 'ar').conventions).toMatchObject({ dir: 'rtl', script: 'Arab', plural: ['zero', 'one', 'two', 'few', 'many', 'other'] });
    const xx = localizationBrief(game({ source: 'en', locales: ['en', 'mi'] }), {}, 'mi');
    expect(xx.conventions.known).toBe(false);
    expect(xx.conventions.note).toMatch(/no conventions are bundled/);
  });
});

describe('folding a localizer\'s lines in', () => {
  it('holds placeholders equal, sorts for stable bytes, and names the entries a re-wording orphaned', () => {
    const { languages, errors } = mergeTranslations(LANG, 'ja', [
      { source: 'for {name}', translation: '{name}向け' },
      { source: 'Easy', translation: 'かんたん' },
      { source: 'for {name}', translation: 'みんな向け' },   // the hole dropped: refused, the good line kept
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/placeholders differ/);
    expect(Object.keys(languages.strings.ja)).toEqual(['Coin Run', 'Easy', 'Play', 'for {name}']);
    expect(LANG.strings.ja.Easy).toBeUndefined();   // pure
    expect(coverage(game({ ...LANG, strings: { ja: { 'Coin Dash': 'x' } } })).ja.stale).toEqual(['Coin Dash']);
  });
});

describe('the page\'s language', () => {
  it('picked at run time among the declared: exact, then by language, else the fallback', () => {
    expect(pickLanguage(['en', 'ja', 'pt-BR'], ['pt-PT', 'ja-JP'], 'en')).toBe('pt-BR');
    expect(pickLanguage(['en', 'ja'], ['ja_JP'], 'en')).toBe('ja');
    expect(pickLanguage(['en', 'ja'], ['de-DE'], 'en')).toBe('en');
    expect(pickLanguage(['en', 'ja'], undefined, 'en')).toBe('en');
  });

  it('served for a declared language: its tag and its words; the source: its tag alone; anything else: nothing', () => {
    expect(pageLocale(game(LANG), 'ja')).toEqual({ lang: 'ja', strings: LANG.strings.ja });
    expect(pageLocale(game(LANG), 'ar')).toEqual({ lang: 'ar', strings: {} });
    expect(pageLocale(game(LANG), 'en')).toEqual({ lang: 'en', strings: null });
    expect(pageLocale(game(LANG), 'fr')).toBeNull();
    expect(pageLocale(game(), 'ja')).toBeNull();
    expect(pageLocale({ kind: 'world' }, 'ja')).toBeNull();
  });
});
