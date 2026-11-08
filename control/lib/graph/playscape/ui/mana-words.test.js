import { describe, it, expect } from 'vitest';
import { manaWords, MANA_WORD_KEYS } from './mana-words.js';
import { manaUi } from '../../../mana-ui/kernel.js';
import { IDIOMS, withIdioms } from '../../../mana-ui/idioms.js';
import { SAMPLE_STATE } from '../../../mana-ui/samples.js';
import { locales, defaultLocale } from '../../../../i18n/config.js';

// THE GAME UI SPEAKS THE GAME'S LANGUAGE: the runtime's own words are one table (kernel.js WORDS, English), the same
// keys as the catalogs' gameUi namespace, so /sync-locales carries them into every shipped language; a host hands a
// language in and a word it lacks reads in English. One case per procedure.
const other = locales.find((l) => l !== defaultLocale);
const screen = (children, props = {}) => ({ use: 'screen', props, children });

describe('the game UI\'s words', () => {
  it('the runtime\'s English is the catalogs\' English: one table, the same keys and words', () => {
    expect(manaWords(defaultLocale)).toEqual(manaUi.WORDS);
    expect(MANA_WORD_KEYS).toEqual(Object.keys(manaUi.WORDS));
  });
  it('a shipped language has its words; another is named, never guessed', () => {
    const W = manaWords(other);
    expect(Object.keys(W)).toEqual(MANA_WORD_KEYS);
    expect(W.back).not.toBe(manaUi.WORDS.back);
    expect(W.more).toContain('{n}');
    expect(() => manaWords('xx')).toThrow(/not a shipped language/);
  });
  it('a runtime handed a language draws its own words in it, a word it lacks in English, a format\'s {@key} too', () => {
    const W = manaWords(other), rt = manaUi.runtime({ start: 'a', screens: { a: screen([{ use: 'list', props: { rows: [] } }, { use: 'text', props: { value: { format: '{@lv} 7' } } }, { use: 'button', props: { label: { word: 'noSuchWord' } } }]) } }, { read: () => undefined, words: W });
    rt.input('keys');
    const html = rt.view();
    expect(html).toContain(W.nothingHere);
    expect(html).toContain(`${W.lv} 7`);
    expect(html).toContain(`<span>${W.back}</span>`);       // the legend's back, drawn from what the screen holds
    expect(html).toContain('noSuchWord');                   // a game's own key reads as itself
    expect(() => manaUi.runtime({ screens: {} }, { words: 'ja' })).toThrow(/host.words is/);
  });
  it('the idioms say no word of their own in English: each is the runtime\'s, so it is translated', () => {
    const literal = [];
    const walk = (n) => { if (Array.isArray(n)) return n.forEach(walk); if (!n || typeof n !== 'object') return; if (n.props) for (const k of ['value', 'label', 'empty', 'prompt', 'title']) { const v = n.props[k]; if (typeof v === 'string' && /[A-Za-z]/.test(v)) literal.push(v); } for (const k in n) walk(n[k]); };
    for (const I of Object.values(IDIOMS)) walk(I.node);
    expect(literal).toEqual([]);
    const I = IDIOMS['loading-screen'], W = manaWords(other);
    const rt = manaUi.runtime(withIdioms({ start: 's', screens: { s: { use: 'loading-screen', props: I.example } } }), { read: (p) => manaUi.readPath(SAMPLE_STATE, p), words: W });
    expect(rt.view()).toContain(W.loading);
  });
});
