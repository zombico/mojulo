// A game in more than one language (game-languages.js): declared once on the game manifest, read with teaching
// errors, its words gathered, a translator's lines folded in with their placeholders held, and the one table carried
// into each engine's own format. Absent, every export as it was.
import { describe, it, expect } from 'vitest';
import {
  readLanguages, gameSourceText, languageTable, coverage, languageTodo, mergeTranslations, CHROME_WORDS,
  godotTranslationCsv, godotInternationalization, robloxLocalizationCsv, robloxLocale, unrealStringTableCsv, unrealPo,
  unityStringsJson, webStrings, pickLanguage, textKey,
} from './game-languages.js';
import { validateGameManifest } from './game-manifest.js';
import { emitGodotGame } from '../scene/godot-project.js';

const game = (languages) => ({
  kind: 'game', title: 'Coin Run',
  store: { slices: [{ name: 'hero', kind: 'character' }] },
  levels: [{ ref: 'lv-a', title: 'The Docks' }, { ref: 'lv-b', title: 'Rooftops, at night' }],
  menu: { tagline: 'Grab every coin', entries: [{ id: 'play', title: 'Play', kind: 'levels' }, { id: 'about', title: 'About', kind: 'about', body: ['Made in a week.', ['See ', { text: 'the site', href: 'https://x.y' }]] }] },
  difficulty: { options: [{ id: 'easy', name: 'Easy', sub: 'for {name}' }] },
  ...(languages ? { languages } : {}),
});
const LANG = { source: 'en', locales: ['en', 'ja', 'ar'], strings: { ja: { 'Coin Run': 'コインラン', Play: 'プレイ' } } };

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
  it('gathers the authored player-facing words once each, never identifiers, refs or links', () => {
    const W = gameSourceText(game(LANG)).map((r) => r.text);
    expect(W).toEqual(['Coin Run', 'The Docks', 'Rooftops, at night', 'Grab every coin', 'Play', 'About', 'Made in a week.', 'See ', 'the site', 'Easy', 'for {name}']);
    expect(W).not.toContain('hero');            // a store slice's name is an identifier
    expect(W).not.toContain('https://x.y');
  });

  it('the table: authored rows then the chrome words, the source column the text itself, a missing word null', () => {
    const T = languageTable(game(LANG));
    expect(T.rows[0]).toMatchObject({ text: 'Coin Run', values: { en: 'Coin Run', ja: 'コインラン', ar: null } });
    expect(T.rows.slice(-CHROME_WORDS.length).map((r) => r.text)).toEqual([...CHROME_WORDS]);
    const C = coverage(game(LANG));
    expect(C.ja).toMatchObject({ done: 2, total: T.rows.length, stale: [] });
    expect(languageTodo(game(LANG), 'ar')).toHaveLength(T.rows.length);
  });

  it('folds a translator\'s lines in, holds placeholders equal, sorts for stable bytes, and names stale words', () => {
    const { languages, errors } = mergeTranslations(LANG, 'ja', [
      { source: 'for {name}', translation: '{name}向け' },
      { source: 'Easy', translation: 'かんたん' },
      { source: 'for {name}', translation: 'みんな向け' },   // the hole dropped: refused, the good line kept
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/placeholders differ/);
    expect(Object.keys(languages.strings.ja)).toEqual(['Coin Run', 'Easy', 'Play', 'for {name}']);
    expect(LANG.strings.ja.Easy).toBeUndefined();   // pure
    const reworded = { ...game({ ...LANG, strings: { ja: { ...LANG.strings.ja, 'Coin Dash': 'x' } } }) };
    expect(coverage(reworded).ja.stale).toEqual(['Coin Dash']);
  });
});

describe('one table, each engine\'s own format', () => {
  const T = languageTable(game(LANG));
  it('Godot: a CSV keyed by source text (an empty cell is no message) and its [internationalization] section', () => {
    const csv = godotTranslationCsv(T).split('\n');
    expect(csv[0]).toBe('keys,en,ja,ar');
    expect(csv[1]).toBe('Coin Run,Coin Run,コインラン,');
    expect(csv[3]).toBe('"Rooftops, at night","Rooftops, at night",,');
    expect(godotInternationalization(T)).toContain('locale/translations=PackedStringArray("res://i18n/strings.en.translation", "res://i18n/strings.ja.translation", "res://i18n/strings.ar.translation")');
    expect(godotInternationalization({ ...T, locales: ['en', 'pt-BR'] })).toContain('strings.pt_BR.translation');
  });
  it('Roblox: a LocalizationTable CSV that matches by Source; its locale codes', () => {
    const csv = robloxLocalizationCsv(T).split('\n');
    expect(csv[0]).toBe('Key,Context,Example,Source,ja,ar');
    expect(csv[1]).toBe(',,,Coin Run,コインラン,');
    expect([robloxLocale('pt-BR'), robloxLocale('zh-Hant'), robloxLocale('zh-Hans'), robloxLocale('ja')]).toEqual(['pt-br', 'zh-tw', 'zh-cn', 'ja']);
  });
  it('Unreal: a string table by a stable key, and a PO per culture for the Localization Dashboard', () => {
    expect(unrealStringTableCsv(T).split('\n')[1]).toBe(`${textKey('Coin Run')},Coin Run`);
    expect(textKey('Coin Run')).toBe(textKey('Coin Run'));
    expect(unrealPo(T, 'ja')).toContain(`msgctxt "Mojulo,${textKey('Coin Run')}"\nmsgid "Coin Run"\nmsgstr "コインラン"`);
  });
  it('Unity and the web: arrays JsonUtility reads; only translated words baked, right-to-left named', () => {
    expect(JSON.parse(unityStringsJson(T)).rows[0]).toEqual({ text: 'Coin Run', values: ['Coin Run', 'コインラン', ''] });
    const W = webStrings(T);
    expect(W.t.ja).toEqual({ 'Coin Run': 'コインラン', Play: 'プレイ' });
    expect(W.t.ar).toEqual({});
    expect(W.rtl).toEqual(['ar']);
  });
  it('the player\'s language is picked at run time among the declared: exact, then by language, else the fallback', () => {
    expect(pickLanguage(['en', 'ja', 'pt-BR'], ['pt-PT', 'ja-JP'], 'en')).toBe('pt-BR');
    expect(pickLanguage(['en', 'ja'], ['ja_JP'], 'en')).toBe('ja');
    expect(pickLanguage(['en', 'ja'], ['de-DE'], 'en')).toBe('en');
    expect(pickLanguage(['en', 'ja'], undefined, 'en')).toBe('en');
  });
});

describe('the cascade into a Godot project', () => {
  const score = { ref: 'lv-a', title: 'A', kind: 'controllable', frame: 'z-up', spawn: [0, 0, 0], colliders: [], cameras: [], entities: [], mechanics: [{ kind: 'reach-exit' }], ledger: {} };
  const emit = (languages) => emitGodotGame({ ref: 'g', title: 'Coin Run', manifestHash: 'h', levels: [{ ref: 'lv-a', title: 'A', gate: null, score }], kernelVersion: '0.23.0', ...(languages ? { languages } : {}) });
  const file = (out, name) => out.files.find((f) => f.file === name)?.text;
  it('declared: the CSV and the section travel, the ledger says what translates and what stays', () => {
    const T = { ...languageTable(game(LANG)), coverage: coverage(game(LANG)) };
    const out = emit(T);
    expect(file(out, 'i18n/strings.csv')).toBe(godotTranslationCsv(T));
    expect(file(out, 'project.godot')).toContain('[internationalization]');
    expect(out.ledger.languages_carried.kinds).toEqual(['en', 'ja', 'ar']);
    expect(out.ledger.languages_carried.note).toMatch(/ja 2\/\d+, ar 0\/\d+/);
  });
  it('absent: no file, no section, no ledger row: the project as it was', () => {
    const out = emit(null);
    expect(file(out, 'i18n/strings.csv')).toBeUndefined();
    expect(file(out, 'project.godot')).not.toContain('[internationalization]');
    expect(out.ledger.languages_carried).toBeUndefined();
  });
});
