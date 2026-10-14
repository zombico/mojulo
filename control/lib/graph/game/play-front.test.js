/**
 * The front of a light-shell game: read and taught, absent ⇒ the shell as it was (no CSS, no code, no key), a cover's
 * menu zone carried as fractions, resolved from a cover ref, carried from a gameworld, and — run in a page — a title
 * with its start menu, an attract screen, the options, the credits roll and back.
 */
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import { readFront, frontConfig, FRONT_ENTRIES } from './play-front.js';
import { emitPlayShell } from './play-shell.js';
import { normalizeGameManifest, validateGameManifest } from './game-manifest.js';
import { normalizeLevelContract } from './level-contract.js';
import { resolveGame, coverArt } from './game-resolve.js';
import { normalizeCoverManifest } from '../image-outcomes/cover-manifest.js';
import { readGameworld } from '../gameworld/world.js';

const BASE = {
  kind: 'game', title: 'Lantern Keep', shell: 'play',
  store: { slices: [{ name: 'bag', kind: 'inventory' }, { name: 'campaign', kind: 'progression' }] },
  levels: [{ ref: 'k-1', title: 'The Gate' }, { ref: 'k-2', title: 'The Hall', gate: { completed: 'k-1' } }],
};
const CONTRACT = normalizeLevelContract({ levelRef: 'k-1', consumes: [{ slice: 'bag' }], produces: { events: [{ type: 'grant', slice: 'bag' }, { type: 'promote', slice: 'campaign', max: 1 }] } });
const LEVELS = [{ ref: 'k-1', contract: CONTRACT }, { ref: 'k-2', contract: { ...CONTRACT, levelRef: 'k-2' } }];
const CREDITS = { roll: [{ role: 'Design', names: ['Franz Ombico'] }, { role: 'Levels', names: ['The Gate', 'The Hall'] }], thanks: 'Everyone who played it first.' };
const game = (front) => normalizeGameManifest({ ...BASE, ...(front ? { front } : {}) });
const GAME_COVER = normalizeCoverManifest({ for_kind: 'game', artDirection: { composition: { archetype: 'lower-third' } }, slots: { title: { text: 'Lantern Keep', realizer: 'flat' } } });

describe('reading a front', () => {
  it('a full front reads clean', () => {
    expect(readFront({ cover: 'keep-cover', layout: 'lower-third', tagline: 'The hill remembers', press: true, menu: ['continue', 'play', 'levels', 'options', 'credits'], credits: CREDITS, end: { text: 'Dawn comes.' } }, { levels: 2 })).toEqual([]);
    expect(readFront({ cover: { art: '/outcomes/x/key.png' } })).toEqual([]);
  });
  it('a wrong word teaches', () => {
    const e = (f, o) => readFront(f, o).join('\n');
    expect(e({ colour: 'red' })).toMatch(/not a front setting/);
    expect(e({ cover: 'has space' })).toMatch(/cover sketch's ref/);
    expect(e({ layout: 'top' })).toMatch(/center, lower-third, left, right/);
    expect(e({ menu: ['options'] })).toMatch(/needs play/);
    expect(e({ menu: ['play', 'quit'] })).toMatch(new RegExp(FRONT_ENTRIES.join(', ')));
    expect(e({ menu: ['play', 'levels'] }, { levels: 1 })).toMatch(/this game has one/);
    expect(e({ menu: ['play', 'continue'] }, { run: true })).toMatch(/a run draws its levels anew/);
    expect(e({ menu: ['play', 'credits'] })).toMatch(/give front.credits/);
    expect(e({ credits: { roll: [{ role: 'Art' }] } })).toMatch(/names/);
    expect(e({ end: { text: 'x' } }, { run: true })).toMatch(/a run ends at its own result/);
  });
  it('is the light shell\'s: the arena shell is pointed at its menu', () => {
    const { shell, ...arena } = BASE;
    expect(validateGameManifest({ ...arena, front: { tagline: 'x' } }).errors.join()).toMatch(/add shell: 'play'/);
    expect(validateGameManifest({ ...BASE, front: { credits: CREDITS } }).ok).toBe(true);
  });
});

describe('the page\'s front', () => {
  it('the menu defaults from what the game has', () => {
    expect(frontConfig({}, null, { levels: 2 }).menu).toEqual(['continue', 'play', 'levels', 'options']);
    expect(frontConfig({ credits: {} }, null, { levels: 1 }).menu).toEqual(['continue', 'play', 'options', 'credits']);
    expect(frontConfig({ credits: {} }, null, { levels: 4, run: true })).toMatchObject({ menu: ['play', 'options', 'credits'], end: null });
    expect(frontConfig({ credits: {}, end: { credits: false } }, null).end).toEqual({ text: 'The end', credits: false });
    expect(frontConfig({ press: true }, null).press).toBe('press start');
    expect(frontConfig({ credits: { attribution: false } }, null).credits.attribution).toBe(false);
  });
  it('absent: no front in the page at all', () => {
    const html = emitPlayShell(game(), LEVELS);
    expect(html).not.toContain('id="front"');
    expect(html).not.toContain('__mojFront = ');
    expect(html).not.toContain('fx-stage');
    expect(html).not.toContain('"front":');
  });
  it('present: its root, its sheet, its code and its config', () => {
    const html = emitPlayShell(game({ credits: CREDITS }), LEVELS);
    expect(html).toContain('<div id="front"></div>');
    expect(html).toContain('#front .fx-stage');
    expect(html).toContain('const __mojFront = (function playFrontRuntime');
    expect(html).toContain('"menu":["continue","play","levels","options","credits"]');
  });
});

describe('a cover as the title\'s backdrop', () => {
  it('carries its aspect and its menu zone as fractions of its canvas', () => {
    const a = coverArt(GAME_COVER, '/c.png');
    expect(a).toMatchObject({ src: '/c.png', titled: true });
    expect(a.aspect).toBeCloseTo(16 / 9, 2);
    for (const k of ['x', 'y', 'w', 'h']) expect(a.zone[k]).toBeGreaterThan(0);
    expect(a.zone.x + a.zone.w).toBeLessThanOrEqual(1);
    expect(a.zone.y + a.zone.h).toBeLessThanOrEqual(1);
    expect(coverArt(normalizeCoverManifest({ slots: { title: { text: 'A book' } } }), '/b.png').zone).toBeUndefined();
  });
  it('resolves from a cover ref, and refuses what is not a cover', () => {
    const sketches = {
      'k-1': { ref: 'k-1', manifest: { kind: 'controllable', game: { levelRef: 'k-1', consumes: [{ slice: 'bag' }], produces: { events: [{ type: 'grant', slice: 'bag' }, { type: 'promote', slice: 'campaign', max: 1 }] } } } },
      'k-2': { ref: 'k-2', manifest: { kind: 'controllable', game: { levelRef: 'k-2', consumes: [{ slice: 'bag' }], produces: { events: [{ type: 'grant', slice: 'bag' }, { type: 'promote', slice: 'campaign', max: 1 }] } } } },
      'keep-cover': { ref: 'keep-cover', manifest: GAME_COVER },
    };
    const get = (r) => sketches[r] || null, src = (r) => `/w/${r}`;
    const r = resolveGame({ ...BASE, front: { cover: 'keep-cover' } }, get, src);
    expect(r.frontArt).toMatchObject({ src: '/api/sketches/keep-cover/cover.png', titled: true });
    expect(r.frontArt.zone).toBeDefined();
    expect(resolveGame({ ...BASE }, get, src).frontArt).toBeNull();
    expect(() => resolveGame({ ...BASE, front: { cover: 'k-1' } }, get, src)).toThrow(/not a cover/);
    expect(() => resolveGame({ ...BASE, front: { cover: 'nope' } }, get, src)).toThrow(/no sketch with ref 'nope'/);
  });
});

describe('a gameworld\'s front', () => {
  it('is read on the world and carried whole', () => {
    const W = { id: 'keep', seed: 8, levels: { a: { walk: { nodes: { t: { trail: true } } } } }, front: { credits: CREDITS, layout: 'left' } };
    expect(readGameworld(W).front).toEqual(W.front);
    const { front: _f, ...bare } = W;
    expect('front' in readGameworld(bare)).toBe(false);
    expect(() => readGameworld({ ...W, front: { layout: 'top' } })).toThrow(/gameworld: front.layout/);
  });
});

// ---- the page itself, run: the title, the attract screen, the options, the roll ----
function page(front, levels = LEVELS) {
  const html = emitPlayShell(game(front), levels);
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/game.html' });
  const d = dom.window.document;
  const key = (code) => d.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code, bubbles: true }));
  const menu = () => [...d.querySelectorAll('#front .fx-menu button')].map((b) => b.textContent);
  return { dom, d, key, menu, front: d.getElementById('front') };
}

describe('the front, played', () => {
  it('home is the title: the start menu, no continue before anything is played', () => {
    const { d, menu, front } = page({ credits: CREDITS, tagline: 'The hill remembers' });
    expect(front.style.display).toBe('block');
    expect(d.getElementById('app').style.display).toBe('none');
    expect(d.querySelector('#front h1').textContent).toBe('Lantern Keep');
    expect(d.querySelector('#front .fx-tag').textContent).toBe('The hill remembers');
    expect(menu()).toEqual(['start', 'levels', 'options', 'credits']);
    expect(d.querySelector('#front .fx-menu button.on').textContent).toBe('start');
  });

  it('an attract screen first: any key shows the menu', () => {
    const { d, key, menu } = page({ press: 'Press any key' });
    expect(d.querySelector('#front .fx-press').textContent).toBe('Press any key');
    expect(menu()).toEqual([]);
    key('KeyX');
    expect(menu()).toEqual(['start', 'levels', 'options']);
  });

  it('the keys move the focus and pick', () => {
    const { d, key } = page({ credits: CREDITS });
    key('ArrowDown');
    expect(d.querySelector('#front .fx-menu button.on').textContent).toBe('levels');
    key('ArrowUp'); key('ArrowUp');
    expect(d.querySelector('#front .fx-menu button.on').textContent).toBe('credits');
    key('Enter');
    expect(d.querySelector('#front .fx-roll')).not.toBeNull();
  });

  it('the roll: the title, each role and its names, the thanks, what made it; skip goes back to the title', () => {
    const { d, menu } = page({ credits: CREDITS });
    [...d.querySelectorAll('#front .fx-menu button')].find((b) => b.textContent === 'credits').click();
    const text = d.querySelector('#front .fx-crawl').textContent;
    for (const w of ['Lantern Keep', 'Design', 'Franz Ombico', 'Levels', 'The Hall', 'Everyone who played it first.', 'made with mojulo']) expect(text).toContain(w);
    d.querySelector('#front .fx-skip').click();
    expect(menu()).toEqual(['start', 'levels', 'options', 'credits']);
  });

  it('attribution: false drops the mojulo line', () => {
    const { d } = page({ credits: { ...CREDITS, attribution: false } });
    [...d.querySelectorAll('#front .fx-menu button')].find((b) => b.textContent === 'credits').click();
    expect(d.querySelector('#front .fx-crawl').textContent).not.toContain('mojulo');
  });

  it('options: the sound toggles and is kept; back returns', () => {
    const { d, dom, key, menu } = page({});
    [...d.querySelectorAll('#front .fx-menu button')].find((b) => b.textContent === 'options').click();
    const sound = () => [...d.querySelectorAll('#front .fx-panel button')].find((b) => b.textContent.startsWith('sound'));
    expect(sound().textContent).toBe('sound: on');
    sound().click();
    expect(sound().textContent).toBe('sound: off');
    expect(JSON.parse(dom.window.localStorage.getItem('moj-play:Lantern Keep:settings')).sfxOn).toBe(false);
    key('Escape');
    expect(menu()).toEqual(['start', 'levels', 'options']);
  });

  it('levels opens the list, and the list goes back to the title', () => {
    const { d, menu } = page({});
    [...d.querySelectorAll('#front .fx-menu button')].find((b) => b.textContent === 'levels').click();
    expect(d.getElementById('front').style.display).toBe('none');
    expect(d.getElementById('app').textContent).toContain('The Gate');
    [...d.querySelectorAll('#app button')].find((b) => b.textContent === 'title').click();
    expect(menu()).toEqual(['start', 'levels', 'options']);
  });

  it('start launches the first level, the front put away', () => {
    const { d } = page({});
    d.querySelector('#front .fx-menu button').click();
    expect(d.getElementById('front').style.display).toBe('none');
    expect(d.getElementById('frame').style.display).toBe('block');
  });

  it('a cover with a menu zone: the menu is placed in the zone and the lockup is the cover\'s', () => {
    const html = emitPlayShell(game({ cover: 'keep-cover' }), LEVELS, { frontArt: coverArt(GAME_COVER, '/c.png') });
    const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
    const d = dom.window.document, zone = d.querySelector('#front .fx-zone');
    expect(zone).not.toBeNull();
    expect(zone.querySelector('.fx-menu')).not.toBeNull();
    expect(d.querySelector('#front .fx-stage').style.backgroundImage).toContain('/c.png');
    expect(d.querySelector('#front h1').className).toContain('fx-hide');
  });
});
