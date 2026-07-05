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
