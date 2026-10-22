// A level's words, found where its World page reads them (level-words.js): on a really resolved level, the words its play
// block, its mechanics and its signs put in front of the player, each with what it is; swapped for a language with ids,
// vars and code untouched; and the page in that language's tag and typesetting, byte-identical when no language is asked.
import { describe, it, expect, beforeAll } from 'vitest';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { payloadWords, localizePayload, gatherLevelWords } from './level-words.js';

const ENTITIES = [
  { id: 'hero', rule: { type: 'walk' }, transform: { pos: [0, -6, 0], heading: 1.57 }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } },
  { id: 'mayor', rule: { type: 'static' }, transform: { pos: [6, 0, 0], heading: 3.14 }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } },
];
export const LEVEL = {
  kind: 'controllable', title: 'The Docks', entities: ENTITIES, camera: { rule: 'follow', target: 'hero' },
  signage: [{ id: 'gate', text: 'North gate', anchor: { at: [2, 2, 2] } }],
  play: {
    spots: [{ id: 'porch', at: [2, -4], face: -90 }],
    scenes: [{ id: 'arrival', when: { start: true }, names: { mayor: 'Mayor Ilse' }, beats: [
      { line: { who: 'mayor', say: 'Welcome to the hold.' } },
      { choose: { who: 'mayor', say: 'Will you help?', options: [{ say: 'Gladly', sets: ['helps'] }, { say: 'Not now' }] } },
    ] }],
    quests: [{ id: 'q1', name: 'The lost lamp', steps: [{ log: 'Find the lamp', done: 'lamp' }] }],
    items: { tonic: { name: 'Red tonic', about: 'Heals a little', kind: 'consumable', use: { add: 'hp', by: 10 } } },
    menus: [
      { id: 'shop', kind: 'shop', title: 'Apothecary', currency: 'gold', stock: [{ item: 'tonic', price: 12 }] },
      { id: 'keeper', kind: 'talk', who: 'Keeper', lines: ['Buying?'], choices: [{ say: 'Show me', then: { open: 'shop' } }, { say: 'Not today' }] },
    ],
    cues: [{ id: 'door', when: { near: { at: [8, 3], r: 1.2 } }, then: { say: 'The door is locked', as: 'prompt' } }],
  },
  game: { levelRef: 'docks', mechanics: [{ kind: 'reach-exit', at: [5, 5, 0], radius: 2 }, { kind: 'clock', limit: 60 }] },
};

let payload;
beforeAll(async () => { payload = (await resolveWorldScene({ ref: 'docks', title: 'The Docks', manifest: LEVEL }, { live: true })).payload; });

describe('the words a resolved level puts in front of its player', () => {
  it('each with what it is, who says it; the derived phrases whole; never an id', () => {
    const W = payloadWords(payload), role = (t) => W.filter((w) => w.text === t).map((w) => w.role);
    expect(role('Welcome to the hold.')).toEqual(['line']);
    expect(W.find((w) => w.text === 'Welcome to the hold.').speaker).toBe('Mayor Ilse');
    expect(role('Mayor Ilse')).toContain('speaker');
    expect(role('Gladly')).toEqual(['choice']);
    expect(role('Will you help?')).toEqual(['line']);   // the question a choice asks
    expect(role('The lost lamp')).toEqual(['quest']);
    expect(role('Find the lamp')).toEqual(['quest-step']);
    expect(role('Apothecary')).toEqual(['menu-title']);
    expect(role('Red tonic')).toEqual(['item-name']);
    expect(role('Keeper')).toContain('speaker');
    expect(role('The door is locked')).toEqual(['hud-text']);
    expect(role('Not enough gold')).toEqual(['hud-text']);   // derived while lowering: a whole phrase, localized as one
    expect(role('North gate')).toContain('sign');
    expect(role('The Docks')).toEqual(['level-title']);
    expect(W.map((w) => w.text)).not.toContain('mayor');   // a scene beat's `who` is the actor's id
  });

  it('swapped for a language: the words, never the ids, vars or the input', () => {
    const strings = { 'Welcome to the hold.': 'ようこそ。', 'Mayor Ilse': 'イルゼ町長', Keeper: '店主', 'Not today': '今日はいい', 'North gate': '北門', Gladly: '' };
    const L = localizePayload(payload, strings), W = payloadWords(L).map((w) => w.text);
    expect(W).toEqual(expect.arrayContaining(['ようこそ。', 'イルゼ町長', '店主', '今日はいい', '北門']));
    expect(W).toContain('Gladly');   // an empty entry is no entry: the source word stays
    expect(W).toContain('Apothecary');   // no entry: the source word stays
    const beat = L.events.scenes[0].beats.find((b) => b.kind === 'line');
    expect(beat.who).toBe('mayor');
    expect(JSON.stringify(L.events.vars)).toBe(JSON.stringify(payload.events.vars));
    expect(payloadWords(payload).map((w) => w.text)).toContain('Welcome to the hold.');   // the input untouched
    expect(L.faces).toBe(payload.faces);   // geometry shared, not copied
    expect(localizePayload(payload, {})).toBe(payload);
  });

  it('gathers every level of a game the way the World route resolves it; a missing level is named, not fatal', async () => {
    const { words, failed } = await gatherLevelWords({ levels: [{ ref: 'docks' }, { ref: 'gone' }] }, (r) => (r === 'docks' ? { ref: 'docks', title: 'The Docks', manifest: LEVEL } : null));
    expect(words.docks).toEqual(payloadWords(payload));
    expect(failed).toEqual({ gone: 'no sketch with that ref' });
  });
});

describe('the page\'s own words', () => {
  it('only the channels the level has: its quests\', its scenes\', its menus\' words and the legend; no minigame\'s', () => {
    const W = payloadWords(payload), page = W.filter((w) => w.role === 'page').map((w) => w.text);
    expect(page).toEqual(expect.arrayContaining(['new quest', 'hold Space or Esc to skip', 'Sold out.', 'accept: {verb}']));
    expect(page).not.toContain('You win!');
    expect(W.filter((w) => w.role === 'controls').map((w) => w.text)).toContain('W A S D / arrows');
    expect(W.find((w) => w.role === 'verb').text).toBe('buy');
  });

  it('a page in a language says them: the quest toast, the skip hint, the shop\'s verb and footer', () => {
    const words = { 'new quest': 'クエスト開始', 'hold Space or Esc to skip': 'Space長押しでスキップ', buy: '買う', 'back: close': 'もどる：閉じる', 'Welcome to the hold.': 'ようこそ。' };
    const ja = emitThreeWorld({ ...localizePayload(payload, words), lang: { tag: 'ja', words } });
    for (const w of ["begun: 'クエスト開始'", "'Space長押しでスキップ'", '<span>もどる：閉じる</span>', '"verb":"買う"', 'ようこそ。']) expect(ja).toContain(w);
    expect(ja).not.toContain("begun: 'new quest'");
    expect(emitThreeWorld({ ...payload, lang: { tag: 'en', words: {} } })).toBe(emitThreeWorld(payload));
  });
});

describe('the page in a language', () => {
  it('no language, or the default English tag: the page byte for byte as ever', () => {
    const plain = emitThreeWorld(payload);
    expect(emitThreeWorld({ ...payload, lang: null })).toBe(plain);
    expect(emitThreeWorld({ ...payload, lang: 'en' })).toBe(plain);
    expect(plain).toContain('<html lang="en">');
  });

  it('its tag on <html> (the browser picks the script\'s glyphs), its direction, its script\'s typesetting', () => {
    const ja = emitThreeWorld({ ...payload, lang: 'ja' });
    expect(ja).toContain('<html lang="ja">');
    expect(ja).toContain('line-break:strict');
    const ar = emitThreeWorld({ ...payload, lang: 'ar' });
    expect(ar).toContain('<html lang="ar" dir="rtl">');
    expect(ar).toContain('letter-spacing:normal!important');
    expect(emitThreeWorld({ ...payload, lang: 'en"><script>' })).toContain('<html lang="en">');   // not a tag: ignored
  });
});
