import { describe, expect, it } from 'vitest';

import { TITLE_KEYS, SHIPPED_LOCALES, hasTitleWords, localizeHudRows, readTitleLocale, titleKeyOf, titleWords } from './title-words.js';

// ── the words a title card says, in the world's language (the dashboard's own catalogs) ──
// The concept: a row's '@key' text is spelled out in the world's locale, placeholders kept, from the same files
// next-intl serves; a key or a locale that is not there teaches. One locale per distinct case (the default, a
// translated one, an RTL one), never the catalog.

describe('title-words', () => {
  it('the words are en.json\'s gameTitles keys, and every shipped language carries each of them', () => {
    expect(TITLE_KEYS).toEqual(expect.arrayContaining(['round', 'fight', 'ko', 'victory', 'gameOver', 'levelClear']));
    for (const loc of SHIPPED_LOCALES) {
      const w = titleWords(loc);
      for (const k of TITLE_KEYS) expect(typeof w[k] === 'string' && w[k].length > 0, `${loc}.${k}`).toBe(true);
    }
  });

  it('a placeholder survives translation: Round {round} keeps {round} in every language', () => {
    for (const loc of SHIPPED_LOCALES) expect(titleWords(loc).round, loc).toContain('{round}');
  });

  it('@key reads, and the default is English', () => {
    expect(titleKeyOf('@fight')).toBe('fight'); expect(titleKeyOf('FIGHT!')).toBeNull(); expect(titleKeyOf('@')).toBeNull();
    expect(hasTitleWords([{ on: 'x', text: 'Y' }, { on: 'f', text: '@fight' }])).toBe(true);
    expect(hasTitleWords([{ on: 'x', text: 'Y' }])).toBe(false);
    expect(readTitleLocale(undefined)).toBe('en');
    expect(readTitleLocale('ja')).toBe('ja');
    expect(() => readTitleLocale('klingon')).toThrow(/not a shipped language — one of: en, /);
  });

  it('localizeHudRows spells the words out in the locale and passes the other rows through as the same objects', () => {
    const plain = { var: 'hp' }, rows = [plain, { on: 'fight', text: '@fight', as: 'title' }, { on: 'r', text: '@round' }];
    const en = localizeHudRows(rows, 'en');
    expect(en[0]).toBe(plain);
    expect(en[1]).toEqual({ on: 'fight', text: 'Fight!', as: 'title' });
    expect(en[2].text).toBe('Round {round}');
    const ja = localizeHudRows(rows, 'ja');
    expect(ja[1].text).toBe('ファイト！');
    expect(ja[2].text).toContain('{round}');
    expect(localizeHudRows(rows, 'ar')[1].text).not.toBe('Fight!');   // an RTL language has its own word
    const none = [plain, { on: 'x', text: 'Y' }];
    expect(localizeHudRows(none, 'ja')).toBe(none);   // nothing to spell ⇒ the same array
    expect(() => localizeHudRows([{ on: 'x', text: '@winning' }], 'en')).toThrow(/names no title word — the words: @round, /);
  });
});
