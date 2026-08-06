import { describe, expect, it } from 'vitest';

import { emitGameShell } from './game-shell.js';
import { normalizeGameManifest, validateGameManifest } from './game-manifest.js';
import { normalizeLevelContract } from './level-contract.js';

// ── G2: the standalone shell (game-metacontext.plan.md) ─────────────────────────
// game.html owns the store, hosts levels in an iframe, and is dependency-free by
// construction — the kernel is inlined, the inline script parses standalone (no
// imports), and the wire protocol constants match what the level bridge speaks.

const GAME = normalizeGameManifest({
  kind: 'game',
  title: 'Crypt Campaign',
  store: {
    slices: [
      { name: 'hero', kind: 'character', init: { stats: { hp: 100 } } },
      { name: 'bag', kind: 'inventory', init: { items: { potion: 2 } } },
      { name: 'campaign', kind: 'progression' },
    ],
  },
  levels: [
    { ref: 'crypt-1', title: 'The Door' },
    { ref: 'crypt-2', gate: { completed: 'crypt-1' } },
  ],
});

const CONTRACT = normalizeLevelContract({
  levelRef: 'crypt-1',
  consumes: [{ slice: 'bag', pick: { max: 2 } }],
  produces: { events: [{ type: 'grant', slice: 'bag' }, { type: 'promote', slice: 'campaign', max: 1 }] },
});

const LEVELS = [
  { ref: 'crypt-1', contract: CONTRACT },
  { ref: 'crypt-2', contract: { ...CONTRACT, levelRef: 'crypt-2' }, src: 'levels/custom-name.html' },
];

describe('emitGameShell', () => {
  it('the manifest actually validates (fixture honesty)', () => {
    expect(validateGameManifest(GAME)).toEqual({ ok: true, errors: [] });
  });

  it('emits a self-contained page: kernel + manifest + contracts inlined, wire protocol present', () => {
    const html = emitGameShell(GAME, LEVELS);
    expect(html).toContain('buildGameStoreKernel');            // the kernel closure, inlined
    expect(html).toContain('"kind":"game"');
    expect(html).toContain('game-ready');
    expect(html).toContain('game-init');
    expect(html).toContain('game-outcome');
    expect(html).toContain('levels/crypt-1.html');             // default src convention
    expect(html).toContain('levels/custom-name.html');         // explicit src wins
    expect(html).toContain('moj-game:');                       // save key
  });

  it('is dependency-free: no ES module imports, no network reach', () => {
    const script = emitGameShell(GAME, LEVELS).match(/<script>([\s\S]*)<\/script>/)[1];
    expect(script).not.toMatch(/\bimport\s*[({]/);   // no `import {` / `import(`
    expect(script).not.toMatch(/\bfrom\s*['"]/);      // no `from '...'`
    expect(script).not.toMatch(/https?:\/\//);        // no CDN / remote host
  });

  it('the inline script parses standalone (the dependency-free guarantee, mechanically)', () => {
    const html = emitGameShell(GAME, LEVELS);
    const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
    expect(() => new Function(script)).not.toThrow();
  });

  it('refuses to stage a game whose levels lack entries or contracts (promotion discipline)', () => {
    expect(() => emitGameShell(GAME, [LEVELS[0]])).toThrow(/no matching entry/);
    expect(() => emitGameShell(GAME, [LEVELS[0], { ref: 'crypt-2' }])).toThrow(/missing its contract/);
    expect(() => emitGameShell({ kind: 'sketch' }, [])).toThrow(/validated game manifest/);
  });

  it('escapes the title into markup safely', () => {
    const g = { ...GAME, title: 'A <b>game</b> & such', levels: [GAME.levels[0]] };
    const html = emitGameShell(g, [LEVELS[0]]);
    expect(html).toContain('<title>A &lt;b&gt;game&lt;/b&gt; &amp; such</title>');
  });
});

// ── the game frame: Start screen → main menu (opt-in via manifest.menu) ─────────
const MENU_DECL = {
  tagline: 'First to five.',
  entries: [
    { id: 'hangar', title: 'Hangar View', subtitle: 'inspect the suits', kind: 'world', ref: 'sk_hangar' },
    { id: 'battles', title: 'Scenario Battles', kind: 'levels' },
  ],
};
const MENU_RESOLVED = [
  { ...MENU_DECL.entries[0], src: '/api/sketches/sk_hangar/world' },
  { ...MENU_DECL.entries[1] },
];
const GAME_MENU = normalizeGameManifest({ ...GAME, menu: MENU_DECL });

describe('emitGameShell with a menu (Start → main menu)', () => {
  it('the menu manifest validates; malformed menus teach', () => {
    expect(validateGameManifest(GAME_MENU)).toEqual({ ok: true, errors: [] });
    const bad = (menu) => validateGameManifest({ ...GAME, menu });
    expect(bad({ entries: [] }).errors.join()).toMatch(/entries is required/);
    expect(bad({ entries: [{ id: 'w', title: 'W', kind: 'world' }] }).errors.join()).toMatch(/ref is required/);
    // a menu with no way to reach a level (only a world) is rejected...
    expect(bad({ entries: [{ id: 'w', title: 'W', kind: 'world', ref: 'x' }] }).errors.join()).toMatch(/needs a way to reach a level/);
    // ...and more than ONE flat level-list entry is rejected (at most one)
    expect(bad({ entries: [{ id: 'a', title: 'A', kind: 'levels' }, { id: 'b', title: 'B', kind: 'levels' }] }).errors.join()).toMatch(/at most one/);
    // a 'mode' entry needs variants that name real levels; a 'menu' group needs child entries
    expect(bad({ entries: [{ id: 'm', title: 'M', kind: 'mode' }] }).errors.join()).toMatch(/variants is required/);
    expect(bad({ entries: [{ id: 'm', title: 'M', kind: 'mode', variants: [{ ref: 'nope' }] }] }).errors.join()).toMatch(/not one of this game's levels/);
    expect(bad({ entries: [{ id: 'g', title: 'G', kind: 'menu' }] }).errors.join()).toMatch(/entries is required for kind 'menu'/);
    // a nested submenu whose leaf is a valid 'mode' over a real level validates clean
    expect(validateGameManifest({ ...GAME, menu: { entries: [
      { id: 'sp', title: 'Single Player', kind: 'menu', entries: [
        { id: 'duel', title: 'Solo Duel', kind: 'mode', variants: [{ ref: GAME.levels[0].ref, label: 'Ground' }] },
      ] },
    ] } })).toEqual({ ok: true, errors: [] });
  });

  it("supports a 'soon' placeholder entry (inert, no ref)", () => {
    const withSoon = normalizeGameManifest({ ...GAME, menu: {
      entries: [{ id: 'battles', title: 'Battles', kind: 'levels' }, { id: 'later', title: 'Later', kind: 'soon' }],
    } });
    expect(validateGameManifest(withSoon)).toEqual({ ok: true, errors: [] });
    // a soon entry must not carry a ref
    expect(validateGameManifest({ ...GAME, menu: { entries: [{ id: 'b', title: 'B', kind: 'levels' }, { id: 's', title: 'S', kind: 'soon', ref: 'x' }] } }).errors.join()).toMatch(/'soon' entry carries no ref/);
    const resolved = [{ ...withSoon.menu.entries[0] }, { ...withSoon.menu.entries[1] }];
    const html = emitGameShell(withSoon, LEVELS, resolved);
    expect(html).toContain('coming soon');   // the placeholder tag
  });

  it('inlines the resolved menu: entries, tagline, and the world src all reach the page', () => {
    const html = emitGameShell(GAME_MENU, LEVELS, MENU_RESOLVED);
    expect(html).toContain('Hangar View');
    expect(html).toContain('Scenario Battles');
    expect(html).toContain('First to five.');
    expect(html).toContain('/api/sketches/sk_hangar/world');
    expect(html).toContain('renderStart');
  });

  it('the menu shell inline script still parses standalone', () => {
    const script = emitGameShell(GAME_MENU, LEVELS, MENU_RESOLVED).match(/<script>([\s\S]*)<\/script>/)[1];
    expect(() => new Function(script)).not.toThrow();
    expect(script).not.toMatch(/https?:\/\//);
  });

  it('refuses a declared menu without resolved entries, and a world entry without src', () => {
    expect(() => emitGameShell(GAME_MENU, LEVELS)).toThrow(/pass the resolved menu/);
    expect(() => emitGameShell(GAME_MENU, LEVELS, [MENU_DECL.entries[0], MENU_DECL.entries[1]])).toThrow(/no resolved src/);
  });

  it('a menu-less manifest emits no menu machinery boot (MENU is null)', () => {
    const html = emitGameShell(GAME, LEVELS);
    expect(html).toContain('const MENU = null');
  });
});

// ── shell music: menu loop + battle rotation, by resolved beats.wav srcs ────────
const MUSIC_DECL = { menu: 'sk_beats_menu', battle: ['sk_beats_a', 'sk_beats_b'] };
const MUSIC_RESOLVED = {
  menu: '/api/sketches/sk_beats_menu/beats.wav',
  battle: ['/api/sketches/sk_beats_a/beats.wav', '/api/sketches/sk_beats_b/beats.wav'],
};
const GAME_MUSIC = normalizeGameManifest({ ...GAME, music: MUSIC_DECL });

describe('emitGameShell with music', () => {
  it('the music manifest validates; malformed music teaches', () => {
    expect(validateGameManifest(GAME_MUSIC)).toEqual({ ok: true, errors: [] });
    const bad = (music) => validateGameManifest({ ...GAME, music });
    expect(bad({}).errors.join()).toMatch(/at least one of menu \| battle/);
    expect(bad({ battle: [] }).errors.join()).toMatch(/non-empty array/);
    expect(bad({ menu: 7 }).errors.join()).toMatch(/beats sketch ref/);
  });

  it('inlines the resolved srcs and the player machinery; the script parses standalone', () => {
    const html = emitGameShell(GAME_MUSIC, LEVELS, null, MUSIC_RESOLVED);
    expect(html).toContain('/api/sketches/sk_beats_menu/beats.wav');
    expect(html).toContain('/api/sketches/sk_beats_b/beats.wav');
    expect(html).toContain('musicBtn');
    const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
    expect(() => new Function(script)).not.toThrow();
    expect(script).not.toMatch(/https?:\/\//);
  });

  it('refuses declared music without resolved srcs; music-less games pin MUSIC null', () => {
    expect(() => emitGameShell(GAME_MUSIC, LEVELS)).toThrow(/pass the resolved music/);
    expect(emitGameShell(GAME, LEVELS)).toContain('const MUSIC = null');
  });

  it('the score plays at a BED level under the game SFX (volume applied per track, tunable)', () => {
    const html = emitGameShell(GAME_MUSIC, LEVELS, null, MUSIC_RESOLVED);
    expect(html).toContain('musicVolFor');                 // the bed-level resolver
    expect(html).toContain('el.volume = musicVolFor');     // applied on every play
    // manifest volume keys ride the emitted MANIFEST literal for the resolver to read
    const tuned = normalizeGameManifest({ ...GAME, music: { ...MUSIC_DECL, menuVolume: 0.55, battleVolume: 0.35 } });
    expect(emitGameShell(tuned, LEVELS, null, MUSIC_RESOLVED)).toContain('"battleVolume":0.35');
  });
});

// ── theme: the loading overlay is universal; the 'hud' flavor is opt-in ─────────
describe('emitGameShell theme + loading overlay', () => {
  it('every shell carries the loading overlay + progress bar (universal)', () => {
    const html = emitGameShell(GAME, LEVELS);
    expect(html).toContain('id="loading"');
    expect(html).toContain('id="loadBar"');
    expect(html).toContain('id="loadPct"');
    expect(html).toContain('finishLoading');   // completes on the real ready signal
    expect(html).toContain('showLoading');
  });

  it('a theme validates; a bad accent / style teaches', () => {
    const themed = normalizeGameManifest({ ...GAME, theme: { accent: '#5fe6d6', style: 'hud' } });
    expect(validateGameManifest(themed)).toEqual({ ok: true, errors: [] });
    expect(validateGameManifest({ ...GAME, theme: { accent: 'teal' } }).errors.join()).toMatch(/hex color/);
    expect(validateGameManifest({ ...GAME, theme: { style: 'neon' } }).errors.join()).toMatch(/'hud' or 'clean'/);
  });

  it("style:'hud' adds the body class + accent var; a plain game does not", () => {
    const themed = normalizeGameManifest({ ...GAME, theme: { accent: '#5fe6d6', style: 'hud' } });
    const html = emitGameShell(themed, LEVELS);
    expect(html).toContain('<body class="hud">');
    expect(html).toContain('--accent:#5fe6d6');
    const plain = emitGameShell(GAME, LEVELS);
    expect(plain).toContain('<body class="">');
  });

  it('rejects an injected accent color at emit (defense in depth)', () => {
    // an unvalidated hand-poked manifest must not inject into the CSS context: the <style>
    // block ignores the payload and falls back to the safe default (the raw string may still
    // ride inertly inside the JSON MANIFEST literal — a JS string, never a CSS context).
    const evil = { ...GAME, theme: { accent: 'red;} body{display:none' } };
    const html = emitGameShell(evil, LEVELS);
    const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
    expect(style).not.toContain('--accent:red');       // the payload never reaches the CSS var
    expect(style).not.toContain('body{display:none');  // nor breaks out into a new rule
    expect(style).toContain('--accent:#5fb0ff');       // fell back to the safe default
  });

  it('the loading + theme shell still parses standalone (dependency-free)', () => {
    const themed = normalizeGameManifest({ ...GAME, theme: { style: 'hud' }, music: MUSIC_DECL });
    const script = emitGameShell(themed, LEVELS, null, MUSIC_RESOLVED).match(/<script>([\s\S]*)<\/script>/)[1];
    expect(() => new Function(script)).not.toThrow();
    expect(script).not.toMatch(/https?:\/\//);
  });
});

// ── setup presentation (hangar single-pick / count pick) + the score screen ─────
describe('emitGameShell setup presentation + score screen', () => {
  const SETUP_GAME = normalizeGameManifest({
    ...GAME,
    store: {
      slices: [
        ...GAME.store.slices,
        { name: 'suits', kind: 'party', init: { roster: { a: { name: 'ACE' } } } },
      ],
    },
    setup: {
      suits: { style: 'hangar', label: 'select your machine', cards: { a: { portrait: 'sk_head_a', preview: 'sk_prev_a', stats: { hull: 900 } } } },
    },
  });
  const RESOLVED_SETUP = {
    suits: { style: 'hangar', label: 'select your machine', cards: { a: { portrait: '/api/sketches/sk_head_a/png?inline=1', preview: '/api/sketches/sk_prev_a/world?spin=1', stats: { hull: 900 } } } },
  };

  it('a manifest with setup refuses to emit without the resolved presentation', () => {
    expect(() => emitGameShell(SETUP_GAME, LEVELS)).toThrow(/pass the resolved setup/);
  });

  it('emits the styled pickers + resolved srcs; the plain shell omits none of the machinery', () => {
    const html = emitGameShell(SETUP_GAME, LEVELS, null, null, RESOLVED_SETUP);
    expect(html).toContain('renderHangarPick');
    expect(html).toContain('renderCountPick');
    expect(html).toContain('/api/sketches/sk_head_a/png?inline=1');   // portrait src rides SETUP
    expect(html).toContain('/api/sketches/sk_prev_a/world?spin=1');   // preview src rides SETUP
    expect(emitGameShell(GAME, LEVELS)).toContain('const SETUP = null');
  });

  it('every shell carries the score screen + seeded dice (no Math.random)', () => {
    const html = emitGameShell(GAME, LEVELS);
    expect(html).toContain('renderScore');
    expect(html).toContain('score-table');
    expect(html).toContain('mulberry32');
    const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
    expect(script).not.toMatch(/Math\.random\(/);   // doctrine comments may NAME it; no call sites
  });

  it('the setup shell still parses standalone', () => {
    const script = emitGameShell(SETUP_GAME, LEVELS, null, null, RESOLVED_SETUP).match(/<script>([\s\S]*)<\/script>/)[1];
    expect(() => new Function(script)).not.toThrow();
  });
});
