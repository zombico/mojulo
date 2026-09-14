import { describe, expect, it } from 'vitest';

import { EMIT_FIXTURES } from '../emit-fixtures.js';
import { emitThreeWorld } from '../scene-three.js';
import { resolveWorldScene } from '../../worlds/world-scene.js';

// ── the HUD widget layer (hud-widgets.js) — the screen-space UI language over events.hud ──
// The layer is emitted ONLY when a world carries hud rows (zero bytes otherwise), the in-page
// script must parse standalone (the dependency-free guarantee, mechanically), and the mint-time
// gate refuses a bad slot / kind / token with a teaching message pointing at the cards.

const fixture = (name) => EMIT_FIXTURES.find(([n]) => n === name)[1];
// inline scripts only: the importmap (JSON) and src= loads are not page code
const pageScripts = (html) => [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*importmap)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

describe('events channel — the HUD widget layer', () => {
  it('a world with hud rows emits the layer: normalized widgets, slot columns, the stylesheet, banners + legends', () => {
    const html = emitThreeWorld(fixture('events-hud'));
    expect(html).toContain('const __HUD = [');
    const widgets = JSON.parse(html.match(/const __HUD = (\[[\s\S]*?\]);\n/)[1]);
    expect(widgets.map((w) => [w.kind, w.slot, w.as || w.on || w.text])).toEqual([
      ['readout', 'top-right', 'counter'],
      ['readout', 'bottom-left', 'bar'],
      ['readout', 'top', 'clock'],
      ['banner', 'center', 'game-over'],
      ['legend', 'bottom', 'click to whack'],
    ]);
    expect(widgets[1]).toMatchObject({ var: 'hp', label: 'HP', max: 100, color: 'harm', css: 'var(--moj-harm)' });   // the duplicate { var:'hp' } merged in
    expect(html).toContain('.moj-hud-col{position:absolute');
    expect(html).toContain('--moj-accent:#5fe6d6');                 // the world's own events.style
    expect(html).toContain('--moj-font:ui-monospace');
    expect(html).not.toContain('top:12px;left:12px;font:600 18px');  // the legacy pill is gone
  });

  it('without hud rows the layer contributes nothing (a hud-less events world carries no widget code)', () => {
    const html = emitThreeWorld(fixture('events'));
    expect(html).not.toContain('moj-hud');
    expect(html).not.toContain('const __HUD');
    expect(html).toContain('function __syncHud() {}');
  });

  it('the emitted page scripts parse standalone (hud world + a themed game level)', () => {
    for (const name of ['events-hud', 'game', 'kitchen-sink']) {
      for (const src of pageScripts(emitThreeWorld(fixture(name)))) {
        if (!src.trim()) continue;
        // the page is an ES module (three via the importmap): drop the import lines, parse the rest
        expect(() => new Function(src.replace(/^\s*import[^\n]*\n/gm, '')), name).not.toThrow();
      }
    }
  });

  it('the result card reads the tokens with the old literals as fallbacks, and game.complete shapes it', () => {
    const html = emitThreeWorld(fixture('game'));
    expect(html).toContain('var(--moj-panel-a,rgba(12,16,26,.92))');
    expect(html).toContain('__applyStyle(d.theme)');
    expect(html).toContain("__GAME.complete !== false");
  });
});

describe('world-scene — the mint-time gate over events.hud + events.style', () => {
  const world = (events) => ({ manifest: { kind: 'orbit-view', scenario: 'circular', events }, title: 'test' });
  const live = { reactions: [{ on: 'x', do: 'emit', type: 'y' }] };

  it('valid rows pass through untouched (the channel normalizes at emit)', async () => {
    const out = await resolveWorldScene(world({ ...live, hud: [{ var: 'score', as: 'counter', slot: 'top-right' }, { on: 'y', text: 'HIT' }], style: { accent: '#5fe6d6' } }));
    expect(out.payload.events.hud).toEqual([{ var: 'score', as: 'counter', slot: 'top-right' }, { on: 'y', text: 'HIT' }]);
    expect(out.payload.events.style).toEqual({ accent: '#5fe6d6' });
  });

  it('a bad slot / kind refuses the mint with a pointer at the guide card', async () => {
    await expect(resolveWorldScene(world({ ...live, hud: [{ var: 'score', slot: 'left' }, { var: 'hp', as: 'gauge' }] })))
      .rejects.toThrow(/events\.hud is invalid — see get_game_vocab\(\{ id: 'hud-guide' \}\)[\s\S]*hud\[0\]\.slot[\s\S]*hud\[1\]\.as/);
  });

  it('a bad style token refuses the mint with a pointer at the style card', async () => {
    await expect(resolveWorldScene(world({ ...live, hud: [{ var: 'score' }], style: { accent: 'teal', font: 'comic' } })))
      .rejects.toThrow(/events\.style is invalid — see get_game_vocab\(\{ id: 'hud-style' \}\)[\s\S]*accent must be a hex color[\s\S]*font must be one of/);
  });
});
