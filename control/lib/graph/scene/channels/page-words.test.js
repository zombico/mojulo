// The World page's own words in a language (page-words.js): each site an exact snippet of its channel's real code and a
// writer that gives it back from its words; a page without a language never touched; a page with one carrying its words,
// escaped for where they stand (still parseable whatever the words hold), and its HUD numbers in its separators.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITES, PAGE_WORDS, LEGEND_WORDS, localizeChannel, numberFormat } from './page-words.js';
import { questScript } from './quest-channel.js';
import { sceneScript } from './scene-channel.js';
import { reachScript, menuScript } from './interact-channel.js';
import { minigameScript } from './minigame-channel.js';
import { eventsChannelScript } from './events.js';
import { localeProfile } from '../../game/locale-conventions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// each channel's real emitted code: what its sites must be snippets of
const CODE = {
  quest: questScript(),
  scene: sceneScript(),
  reach: reachScript({ z0: { id: 'well', prompt: '' } }),
  menu: menuScript([]),
  minigame: minigameScript({ games: [] }),
};
const count = (hay, needle) => hay.split(needle).length - 1;
const JA = { 'new quest': 'クエスト開始', done: '達成', 'quest complete': 'クエスト完了', journal: '記録', 'hold Space or Esc to skip': 'Space長押し／Escでスキップ',
  'choose: ↑↓ or 1–{n}, then Space': '↑↓か1〜{n}で選んでSpace', use: '調べる', 'Sold out.': '売り切れ', 'accept: {verb}': '決定：{verb}', 'Score {score}': 'スコア {score}', '+{gold} gold': '+{gold}ゴールド' };

describe('each site is its channel\'s code', () => {
  it('written back from its words as written, it is the snippet exactly', () => {
    for (const [ch, sites] of Object.entries(SITES)) for (const s of sites) expect(s.make((w) => w), `${ch}: ${s.code}`).toBe(s.code);
  });

  it('the snippet is in the channel\'s real code as many times as the site says', () => {
    for (const [ch, sites] of Object.entries(SITES)) for (const s of sites) expect(count(CODE[ch], s.code), `${ch}: ${s.code}`).toBe(s.count ?? 1);
  });

  it('the legend\'s words are the ones the page sends the shell', () => {
    const src = fs.readFileSync(path.join(HERE, '..', 'scene-three.js'), 'utf8');
    for (const w of LEGEND_WORDS) expect(src, w).toContain(`'${w}'`);
  });

  it('the words a localizer sees are each channel\'s words once', () => {
    expect(PAGE_WORDS.quest).toEqual(['journal', 'new quest', 'done', 'quest complete', 'nothing yet', 'J journal']);
    expect(PAGE_WORDS.menu).toContain('· {n} left');
    expect(PAGE_WORDS.menu.filter((w) => w === 'close')).toHaveLength(1);
  });
});

describe('a channel in a language', () => {
  it('no language: the code itself', () => {
    for (const [ch, code] of Object.entries(CODE)) expect(localizeChannel(ch, code, null)).toBe(code);
  });

  it('its words, a sentence\'s slot still live code, every channel still parses', () => {
    const L = { words: JA, number: localeProfile('ja').number };
    const out = Object.fromEntries(Object.entries(CODE).map(([ch, c]) => [ch, localizeChannel(ch, c, L)]));
    expect(out.quest).toContain("begun: 'クエスト開始', step: '達成', done: 'クエスト完了'");
    expect(out.quest).toContain('<h3>記録</h3>');
    expect(out.scene).toContain("'\\u2191\\u2193\\u304b1\\u301c' + v.choice.options.length + '\\u3067\\u9078\\u3093\\u3067Space'");
    expect(out.reach).toContain("(top.prompt || '調べる')");
    expect(out.menu).toContain('<span>決定：${e(f.verb)}</span>');
    expect(out.menu).toContain("'売り切れ'");
    expect(out.minigame).toContain("'</div><div>スコア ' + esc(cur.s.score)");
    expect(out.minigame).toContain("(cur.pay ? ' · +' + cur.pay + 'ゴールド' : '')");
    expect(out.quest).toContain("'nothing yet'");   // a word not localized yet: as written
    for (const c of Object.values(out)) expect(() => new Function(c)).not.toThrow();
  });

  it('words holding quotes, backticks, ${, markup or a closing script tag are escaped where they stand', () => {
    const nasty = 'a\'b`c${d}<e>&</script>';
    const L = { words: Object.fromEntries(Object.values(PAGE_WORDS).flat().map((w) => [w, w.replace(/[^{}a-z ]/g, '') + nasty + (w.match(/\{\w+\}/g) || []).join('')])), number: null };
    for (const [ch, c] of Object.entries(CODE)) {
      const o = localizeChannel(ch, c, L);
      expect(() => new Function(o), ch).not.toThrow();
      expect(o.includes('</script'), ch).toBe(c.includes('</script'));
    }
  });
});

describe('the HUD\'s numbers', () => {
  const run = (num, v) => new Function('n', `return ${numberFormat(num)};`)(v);
  it('in the language\'s separators, grouped past four digits as a HUD reads; lakh in Hindi', () => {
    const fr = localeProfile('fr').number, de = localeProfile('de').number, hi = localeProfile('hi').number;
    expect(run(fr, 12345.5)).toBe('12 345,5');
    expect(run(fr, 1234)).toBe('1234');
    expect(run(de, -1234567)).toBe('-1.234.567');
    expect(run(hi, 1234567)).toBe('12,34,567');
    expect(run(fr, 'x')).toBe('x');
  });
  it('the readout draws them; a page without a language, as ever', () => {
    const ev = { hud: [{ var: 'score', label: 'Score' }], vars: { score: 0 } };
    const plain = eventsChannelScript(ev), fr = eventsChannelScript(ev, { locale: { words: {}, number: localeProfile('fr').number } });
    expect(plain).toContain("h.w.as === 'clock' ? __hudClock(n) : String(n)");
    expect(fr).not.toContain(': String(n)');
    expect(fr).toContain("' '");
    expect(eventsChannelScript(ev, {})).toBe(plain);
  });
});
