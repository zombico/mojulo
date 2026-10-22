/**
 * The light shell in the player's language (play-shell.js cfg.lang, game-languages.js shellLanguage): picked on the page
 * among the game's by the browser's first that it offers, kept with the settings, chosen again from the options (the
 * front) or the title's link, each language named in itself; the shell's words and the game's in it; the page's tag,
 * direction and typesetting; each level asked for in it. A game without languages: no key, no code.
 */
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import { emitPlayShell } from './play-shell.js';
import { normalizeGameManifest, validateGameManifest } from './game-manifest.js';
import { normalizeLevelContract } from './level-contract.js';
import { shellWords, languageTable, localizationBrief } from './game-languages.js';

const JA = { 'Coin Run': 'コインラン', 'The Trail': '小道', start: 'はじめから', levels: 'ステージ', options: 'オプション', language: '言語', back: 'もどる', 'sound: on': 'サウンド：オン', play: 'プレイ', 'clear {level} first': '{level}をクリアしよう' };
const BASE = {
  kind: 'game', title: 'Coin Run', shell: 'play',
  store: { slices: [{ name: 'bag', kind: 'inventory' }, { name: 'campaign', kind: 'progression' }] },
  levels: [{ ref: 'run-1', title: 'The Trail' }, { ref: 'run-2', title: 'The Ridge', gate: { completed: 'run-1' } }],
  languages: { source: 'en', locales: ['en', 'ja', 'ar'], strings: { ja: JA } },
};
const CONTRACT = normalizeLevelContract({ levelRef: 'run-1', consumes: [{ slice: 'bag' }], produces: { events: [{ type: 'grant', slice: 'bag' }, { type: 'promote', slice: 'campaign', max: 1 }] } });
const LEVELS = [{ ref: 'run-1', contract: CONTRACT, src: '/api/sketches/run-1/world?walk=1&hud=0' }, { ref: 'run-2', contract: { ...CONTRACT, levelRef: 'run-2' } }];
const script = (html) => html.match(/<script>([\s\S]*)<\/script>/)[1];

function page(extra = {}, { languages = ['ja-JP', 'ja'], storage = null } = {}) {
  const html = emitPlayShell(normalizeGameManifest({ ...BASE, ...extra }), LEVELS, { gameRef: 'coin-run' });
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/game.html',
    beforeParse(w) {
      Object.defineProperty(w.navigator, 'languages', { value: languages, configurable: true });
      if (storage) for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
    },
  });
  const d = dom.window.document;
  const buttons = (sel) => [...d.querySelectorAll(sel)];
  const click = (sel, text) => buttons(sel).find((b) => b.textContent === text).click();
  return { dom, d, buttons, click, html };
}

describe('a game with languages', () => {
  it('validates, and its page carries the languages apart from the manifest', () => {
    expect(validateGameManifest(BASE)).toEqual({ ok: true, errors: [] });
    const s = script(emitPlayShell(normalizeGameManifest(BASE), LEVELS, { gameRef: 'coin-run' }));
    expect(s).toContain('"lang":{"game":"coin-run","source":"en","fallback":"en","locales":["en","ja","ar"]');
    expect(s).toContain('"names":{"en":"English","ja":"日本語","ar":"العربية"}');
    expect(s).toContain('const __mojPick = (');
    expect(s).not.toContain('"languages"');   // the table rides cfg.lang alone
    expect(() => new Function(s)).not.toThrow();
  });

  it('a game without: no key, no code, the page in English as written', () => {
    const { languages, ...plain } = BASE;
    const html = emitPlayShell(normalizeGameManifest(plain), LEVELS);
    expect(script(html)).not.toContain('"lang":');
    expect(script(html)).not.toContain('__mojPick = (');
    expect(html).toContain('<html lang="en">');
  });
});

describe('the level list\'s language (no front)', () => {
  it('the browser\'s first language the game offers: the page in it, its words and the game\'s', () => {
    const { d, buttons } = page();
    expect(d.documentElement.lang).toBe('ja');
    expect(d.title).toBe('コインラン');
    expect(d.querySelector('#app h1').textContent).toBe('コインラン');
    expect(buttons('#app .card .name').map((b) => b.textContent)).toEqual(['小道', 'The Ridge']);   // not localized yet: as written
    expect(buttons('#app .card .muted').map((b) => b.textContent)).toContain('小道をクリアしよう');   // a template, its slot filled
    expect(d.querySelector('#app .card button.primary').textContent).toBe('プレイ');
  });

  it('a browser in a language the game lacks gets the game\'s default, as written', () => {
    const { d } = page({}, { languages: ['de-DE', 'de'] });
    expect(d.documentElement.lang).toBe('en');
    expect(d.querySelector('#app h1').textContent).toBe('Coin Run');
    expect(d.querySelector('#app .card button.primary').textContent).toBe('play');
  });

  it('the link names the language in itself; the list, each in its own script; a pick kept and the page turned', () => {
    const { d, dom, buttons, click } = page();
    const link = buttons('#app button.link').find((b) => b.textContent.startsWith('言語'));
    expect(link.textContent).toBe('言語: 日本語');
    link.click();
    expect(buttons('#app button').map((b) => b.textContent)).toEqual(['English', '日本語', 'العربية', 'もどる']);
    expect(buttons('#app button').find((b) => b.textContent === 'العربية').getAttribute('lang')).toBe('ar');
    click('#app button', 'العربية');
    expect(d.documentElement.lang).toBe('ar');
    expect(d.documentElement.dir).toBe('rtl');
    expect([...d.querySelectorAll('style')].map((x) => x.textContent).join()).toContain('letter-spacing:normal');
    expect(JSON.parse(dom.window.localStorage.getItem('moj-play:Coin Run:settings')).lang).toBe('ar');
    // the kept pick wins over the browser's next time
    const again = page({}, { storage: { 'moj-play:Coin Run:settings': JSON.stringify({ sfxOn: true, lang: 'en' }) } });
    expect(again.d.documentElement.lang).toBe('en');
    expect(again.d.documentElement.hasAttribute('dir')).toBe(false);
  });

  it('?lang= opens it in a language (a localizer\'s check, a shared link) without keeping it as the player\'s', () => {
    const html = emitPlayShell(normalizeGameManifest(BASE), LEVELS, { gameRef: 'coin-run' });
    const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/game?lang=ar', beforeParse(w) { Object.defineProperty(w.navigator, 'languages', { value: ['ja'] }); } });
    expect(dom.window.document.documentElement.lang).toBe('ar');
    expect(dom.window.localStorage.getItem('moj-play:Coin Run:settings')).toBeNull();
    const odd = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/game?lang=fr', beforeParse(w) { Object.defineProperty(w.navigator, 'languages', { value: ['ja'] }); } });
    expect(odd.window.document.documentElement.lang).toBe('ja');   // a language the game lacks: as if not asked
  });

  it('a level is asked for in the language, from the game\'s table', () => {
    const { d } = page();
    d.querySelector('#app .card button.primary').click();
    expect(d.getElementById('frame').getAttribute('src')).toBe('/api/sketches/run-1/world?walk=1&hud=0&lang=ja&game=coin-run');
    expect(d.getElementById('veilText').textContent).toBe('小道');
  });
});

describe('the controls panel', () => {
  it('its rows in the language, its key letters as the player\'s keyboard has them (AZERTY: Z Q S D)', () => {
    const FR = { ...BASE, languages: { source: 'en', locales: ['en', 'fr'], strings: { fr: { 'W A S D / arrows': 'W A S D / flèches', move: 'bouger', controls: 'commandes' } } } };
    const html = emitPlayShell(normalizeGameManifest(FR), LEVELS, { gameRef: 'coin-run' });
    const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', beforeParse(w) { Object.defineProperty(w.navigator, 'languages', { value: ['fr-FR'] }); } });
    const d = dom.window.document, btn = (t) => [...d.querySelectorAll('button')].find((b) => b.textContent === t);
    d.querySelector('#app .card button.primary').click();
    d.getElementById('pauseBtn').click();
    btn('commandes').click();
    const rows = [...d.querySelectorAll('#pause dl.keys dt, #pause dl.keys dd')].map((x) => x.textContent);
    expect(rows.slice(0, 2)).toEqual(['Z Q S D / flèches', 'bouger']);
    expect(rows).toContain('Space');   // a key name is not a letter
  });
});

describe('the front\'s language', () => {
  it('the start menu in the language; options carries the language row; the list sets the page and comes back in it', () => {
    const { d, buttons, click } = page({ front: {} });
    expect(buttons('#front .fx-menu button').map((b) => b.textContent)).toEqual(['はじめから', 'ステージ', 'オプション']);
    click('#front .fx-menu button', 'オプション');
    const row = buttons('#front .fx-panel button').find((b) => b.textContent.startsWith('言語'));
    expect(row.textContent).toBe('言語: 日本語');
    expect(buttons('#front .fx-panel button')[0].textContent).toBe('サウンド：オン');
    row.click();
    click('#front .fx-panel button', 'English');
    expect(d.documentElement.lang).toBe('en');
    expect(buttons('#front .fx-panel button').map((b) => b.textContent)).toContain('language: English');
    expect(buttons('#front .fx-menu button').map((b) => b.textContent)).toEqual(['start', 'levels', 'options']);
  });
});

describe('the shell\'s words in the table', () => {
  it('read from the shell\'s own code, each a T(\'…\') it shows; tabled for a light-shell game alone; briefed with the glossary', () => {
    const W = shellWords();
    for (const w of ['continue', 'new game', 'options', 'paused', 'try again', 'press start', 'The end', 'next: {level}', 'clear {level} first']) expect(W).toContain(w);
    expect(W).not.toContain('playtest');   // the author's, not the player's
    const T = languageTable(BASE, {});
    expect(T.rows.find((r) => r.text === 'paused')).toMatchObject({ roles: ['shell'], where: ['shell'] });
    expect(languageTable({ ...BASE, shell: undefined }, {}).rows.some((r) => r.roles.includes('shell'))).toBe(false);
    const B = localizationBrief(BASE, {}, 'ja');
    expect(B.words.find((w) => w.text === 'continue').is[0]).toMatch(/shell/);
    expect(B.glossary.find((g) => g.term === 'Continue (from a save)').use).toBe('つづきから');
    expect(B.glossary.find((g) => g.term === 'New game').use).toBe('はじめから');
  });
});
