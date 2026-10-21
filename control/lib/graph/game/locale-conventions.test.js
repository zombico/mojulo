// What localizing into a language means beyond its words (locale-conventions.js): the script's direction, case and
// line breaking, the language's typography and register, and the words its players already use in games. One case per
// distinct procedure: a cased Latin language, a region over its language, a script variant, a caseless CJK script, a
// joined right-to-left script, an unknown tag.
import { describe, it, expect } from 'vitest';
import { localeProfile, glossaryFor, localeCss } from './locale-conventions.js';

describe('a language\'s own conventions', () => {
  it('Latin, cased, spaced: its typography, register and keyboard; no typesetting needed', () => {
    const fr = localeProfile('fr');
    expect(fr).toMatchObject({ known: true, script: 'Latn', dir: 'ltr', caseless: false, joined: false, wrap: 'spaces', keys: 'azerty', units: 'metric' });
    expect(fr.number).toEqual({ group: ' ', decimal: ',' });
    expect(fr.punct).toMatch(/before ; : ! \?/);
    expect(fr.address).toMatch(/vous/);
    expect(localeCss('fr')).toBe('');
  });

  it('a region over its language: US units, Latin American Spanish\'s quotes and vocabulary, Taiwan\'s script', () => {
    expect(localeProfile('en-US').units).toBe('imperial');
    expect(localeProfile('en-GB').units).toBe('metric');
    const mx = localeProfile('es-MX');
    expect(mx.quotes).toEqual(['“', '”']);
    expect(mx.glossary.Score.use).toBe('Puntaje');
    expect(localeProfile('es').glossary.Score.use).toBe('Puntuación');
    const tw = localeProfile('zh-TW');
    expect(tw).toMatchObject({ script: 'Hant', quotes: ['「', '」'] });
    expect(tw.glossary.Save.use).toBe('存檔');
    expect(localeProfile('zh-Hans').glossary.Save.use).toBe('存档');
  });

  it('CJK: no case, its own line breaking, its full-width punctuation; Korean breaks between words', () => {
    const ja = localeProfile('ja');
    expect(ja).toMatchObject({ script: 'Jpan', caseless: true, wrap: 'cjk', plural: ['other'] });
    expect(ja.punct).toMatch(/……/);
    expect(localeCss('ja')).toContain('text-transform:none');
    expect(localeCss('ja')).toContain('line-break:strict');
    expect(localeCss('ko')).toContain('word-break:keep-all');
  });

  it('Arabic: right to left, joined (no letter-spacing), six plural forms', () => {
    const ar = localeProfile('ar');
    expect(ar).toMatchObject({ dir: 'rtl', joined: true, caseless: true, plural: ['zero', 'one', 'two', 'few', 'many', 'other'] });
    expect(localeCss('ar')).toContain('letter-spacing:normal');
    expect(localeProfile('he')).toMatchObject({ dir: 'rtl', joined: false });
  });

  it('an unknown tag reads as plain Latin left to right, with no glossary, and says it is unknown', () => {
    expect(localeProfile('mi')).toMatchObject({ known: false, script: 'Latn', dir: 'ltr', glossary: {} });
  });
});

describe('the gamer\'s words', () => {
  it('only the entries the words say, with their tradition: what stays English, what English says twice', () => {
    const G = glossaryFor('ja', ['HP', 'Continue', 'GAME OVER', 'Level 2']);
    const by = Object.fromEntries(G.map((g) => [g.term, g]));
    expect(by.HP.use).toBe('HP');
    expect(by['Game over'].use).toBe('ゲームオーバー');
    expect(by['Continue (from a save)']).toMatchObject({ use: 'つづきから', note: expect.stringMatching(/コンティニュー/) });
    expect(by['Stage (a level of the game)'].use).toBe('ステージ');
    expect(by['Level (a character\'s)'].note).toMatch(/two things/);
    expect(by.Boss).toBeUndefined();
    expect(glossaryFor('de', ['Game Over'])[0]).toMatchObject({ use: 'Game Over', note: expect.stringMatching(/kept in English/) });
    expect(glossaryFor('fr', ['HP'])[0].use).toBe('PV');
  });
});
