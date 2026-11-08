import { describe, it, expect } from 'vitest';
import { manaUi } from './kernel.js';
import { IDIOMS, withIdioms } from './idioms.js';

// A GAME IN SEVERAL LANGUAGES: its words, and the runtime's own, in each language its spec ships; the player changes
// language and every word the screen says is said again in it. A word a language lacks reads in English, a key no table
// holds as itself. The idioms say no word of their own in English, so a game's languages reach them too.
const screen = (children, props = {}) => ({ use: 'screen', props, children });
const game = (extra = {}) => ({
  start: 'a',
  languages: { en: { newGame: 'New game', lives: 'Lives left' }, ja: { newGame: 'ニューゲーム', back: '戻る', more: 'ほか{n}件' } },
  screens: { a: screen([
    { use: 'list', id: 'menu', props: { rows: [{ label: 'x' }, { label: 'y' }, { label: 'z' }], visible: 1 } },
    { use: 'text', props: { value: { word: 'newGame' } } },
    { use: 'text', props: { value: { format: '{@lives}: 3' } } },
    { use: 'text', props: { value: { word: 'select' } } },
  ], { layer: 'modal' }) },
  ...extra,
});

describe('mana-ui: a game in several languages', () => {
  it('the game\'s words and the runtime\'s are said in its language; changing it says them again', () => {
    const rt = manaUi.runtime(game(), {});
    rt.input('keys');
    expect(rt.state().language).toBe('en');
    expect(rt.languages()).toEqual(['en', 'ja']);
    expect(rt.view()).toContain('New game');
    expect(rt.view()).toContain('Lives left: 3');           // a format's {@key}: the game's own English over the runtime's
    rt.language('ja');
    const ja = rt.view();
    expect(ja).toContain('ニューゲーム');
    expect(ja).toContain('<span>戻る</span>');               // the legend the screen drew for itself
    expect(ja).toContain('ほか2件');                         // the runtime's word, with its count
    expect(ja).toContain('Lives left: 3');                  // a word Japanese lacks reads in English
    expect(ja).toContain('Select');                         // and the runtime's English under it
    expect(() => rt.language('fr')).toThrow(/one of the game's languages: en, ja/);
  });
  it('a game starts in the language it says; a host can still say words over it; a key no table holds reads as itself', () => {
    const rt = manaUi.runtime(game({ language: 'ja', screens: { a: screen([{ use: 'text', props: { value: { word: 'newGame' } } }, { use: 'text', props: { value: { word: 'unheard' } } }]) } }), { words: { newGame: 'NEW!' } });
    expect(rt.state().language).toBe('ja');
    expect(rt.view()).toContain('NEW!');
    expect(rt.view()).toContain('unheard');
  });
  it('a spec\'s languages are read and taught', () => {
    const bad = (extra) => () => manaUi.readSpec(game(extra));
    expect(bad({ languages: { Japanese: {} } })).toThrow(/a language is a code like en, ja, pt-BR/);
    expect(bad({ languages: { ja: { back: 3 } } })).toThrow(/languages.ja.back is a word/);
    expect(bad({ language: 'fr' })).toThrow(/language 'fr' is one of the game's languages: en, ja/);
  });
  it('the idioms say no word of their own in English, legends included: a game\'s languages reach every one', () => {
    const literal = [];
    const walk = (n) => {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== 'object') return;
      if (n.props) for (const k of ['value', 'label', 'empty', 'prompt', 'title']) { const v = n.props[k]; if (typeof v === 'string' && /[A-Za-z]/.test(v)) literal.push(v); }
      if (n.use === 'legend' && Array.isArray(n.props && n.props.rows)) for (const r of n.props.rows) if (r && typeof r.label === 'string') literal.push(r.label);
      for (const k in n) walk(n[k]);
    };
    for (const I of Object.values(IDIOMS)) walk(I.node);
    expect(literal).toEqual([]);
    const rt = manaUi.runtime(withIdioms({ start: 's', languages: { ja: { resume: '再開' } }, language: 'ja', screens: { s: { use: 'pause-menu', props: IDIOMS['pause-menu'].example } } }), { read: () => undefined });
    rt.input('keys');
    expect(rt.view()).toContain('<span>再開</span>');        // an idiom's own legend, in the game's language
  });
});

describe('mana-ui: the language picker', () => {
  it('the options screen picks among the game\'s languages, by their own names; turning it says every word again and tells the game', () => {
    const log = [], I = IDIOMS['options-screen'];
    const rt = manaUi.runtime(withIdioms({ start: 's', languages: { en: {}, ja: { languageName: '日本語', back: '戻る' } }, screens: { s: { use: 'options-screen', props: I.example } } }), { read: () => undefined, act: (e) => log.push(e), cues: 'full' });
    rt.input('keys');
    expect(rt.view()).toMatch(/class="mana-cycler mana-language"[^>]*>.*<span class="mana-now" lang="en">English</);
    const k = Number(rt.view().match(/class="mana-cycler mana-language" data-k="(\d+)"/)[1]);
    rt.focusAt(k); rt.press('right');
    expect(rt.state().language).toBe('ja');
    expect(rt.view()).toContain('<span class="mana-now" lang="ja">日本語</span>');
    expect(rt.view()).toContain('<span>戻る</span>');
    expect(log).toEqual(expect.arrayContaining([{ sound: 'change', step: 1 }, { emit: 'language', to: 'ja' }]));
    rt.press('right');
    expect(rt.state().language).toBe('en');                  // it wraps
  });
  it('a game in one language draws no picker', () => {
    const I = IDIOMS['options-screen'], rt = manaUi.runtime(withIdioms({ start: 's', screens: { s: { use: 'options-screen', props: I.example } } }), { read: () => undefined });
    expect(rt.view()).not.toContain('mana-language');
  });
});
