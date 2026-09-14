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
      ['toast', 'top', 'shot'],
      ['toast', 'bottom-left', '{delta}'],
      ['legend', 'bottom', 'click to whack'],
    ]);
    expect(widgets[4]).toMatchObject({ on: 'shot', text: '-{event.damage}', ttl: 0.8, css: 'var(--moj-accent)' });   // event toast: accent
    expect(widgets[5]).toMatchObject({ var: 'hp', ttl: 0.8, css: '' });                                                // var toast: sign picks harm / goal in-page
    expect(html).toContain('.moj-w-toast{');
    expect(html).toContain('function hudSubst(text, vars, ctx)');   // the shared rule, shipped verbatim
    expect(html).toContain('__syncHud(t, incoming)');               // the frame's incoming list carries event fields
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
    expect(html).not.toContain('hudSubst');
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

// ── the toast at runtime: the emitted HUD block against a DOM shim, driven by frames ──
// The block is page code (no imports; the events channel's own globals), so it runs under
// `new Function` with `document` / `wrap` / `__busState` supplied — the same bytes a browser gets.
function domShim() {
  const mk = (tag) => {
    const el = {
      tag, children: [], style: {}, cls: new Set(), textContent: '', parent: null,
      get className() { return [...this.cls].join(' '); },
      set className(v) { this.cls = new Set(v.split(' ').filter(Boolean)); },
      appendChild(c) { c.parent = el; el.children.push(c); return c; },
      remove() { if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1); el.parent = null; },
    };
    el.classList = { add: (c) => el.cls.add(c), remove: (c) => el.cls.delete(c), contains: (c) => el.cls.has(c) };
    return el;
  };
  return { document: { head: mk('head'), createElement: mk, documentElement: mk('html') }, wrap: mk('wrap') };
}
function mountHud(vars) {
  const html = emitThreeWorld(fixture('events-hud'));
  const a = html.indexOf('// HUD: the screen-space widget layer'), b = html.indexOf('\n// Read-only projection of bus ENTITY state', a);
  const { document, wrap } = domShim();
  const bus = { vars, log: [] };
  const h = new Function('document', 'wrap', '__busState', html.slice(a, b) + '\nreturn { sync: __syncHud, live: () => __hudLive, cols: __hudCols };')(document, wrap, bus);
  const toasts = (slot) => h.cols[slot].children.filter((c) => c.cls.has('moj-w-toast')).map((c) => c.textContent);
  return { ...h, bus, toasts };
}

describe('the toast at runtime (frame-clock driven, deterministic)', () => {
  it('an event toast reads the firing event\'s fields from the frame\'s incoming list and STACKS per firing', () => {
    const h = mountHud({ score: 0, hp: 100, time: 30 });
    h.sync(0, []);
    expect(h.toasts('top')).toEqual([]);
    h.bus.log.push({ type: 'shot' }); h.sync(16, [{ type: 'shot', damage: 12, target: 'mole-3' }]);
    h.bus.log.push({ type: 'shot' }); h.sync(32, [{ type: 'shot', damage: 7, target: 'mole-1' }]);
    expect(h.toasts('top')).toEqual(['-12', '-7']);                       // two elements, not one replaced
    expect(h.live().map((l) => l.el.style.color)).toEqual(['var(--moj-accent)', 'var(--moj-accent)']);
    h.bus.log.push({ type: 'shot' }); h.sync(40, []);                     // a cascaded shot: type only ⇒ empty field
    expect(h.toasts('top')).toEqual(['-12', '-7', '-']);
    h.bus.log.push({ type: 'game-over' }); h.sync(41, []);                // a banner event never spawns a toast
    expect(h.toasts('top').length).toBe(3);
  });

  it('a var toast seeds silently, fires on change with a signed delta, and picks harm / goal by sign when uncolored', () => {
    const h = mountHud({ score: 0, hp: 100, time: 30 });
    h.sync(0, []); h.sync(16, []);
    expect(h.toasts('bottom-left')).toEqual([]);                          // hp=100 at seed is not a "+100"
    h.bus.vars.hp = 80; h.sync(32, []);
    h.bus.vars.hp = 85; h.sync(48, []);
    h.bus.vars.hp = 85; h.sync(64, []);                                   // no change ⇒ no toast
    expect(h.toasts('bottom-left')).toEqual(['-20', '+5']);
    expect(h.live().map((l) => l.el.style.color)).toEqual(['var(--moj-harm)', 'var(--moj-goal)']);
  });

  it('rises + fades on the frame clock, reaps past ttl, and the oldest goes past the per-row cap', () => {
    const h = mountHud({ score: 0, hp: 100, time: 30 });
    h.sync(0, []);
    h.bus.log.push({ type: 'shot' }); h.sync(100, [{ type: 'shot', damage: 12 }]);
    h.sync(500, []);                                                       // half of ttl 0.8s
    const l = h.live()[0];
    expect(Number(l.el.style.opacity)).toBeCloseTo(0.75, 2);                // 1 - p² at p=.5
    expect(l.el.style.transform).toBe('translateY(-14.0px)');              // 28px rise × .5
    h.sync(901, []);
    expect(h.toasts('top')).toEqual([]); expect(h.live().length).toBe(0);  // reaped, DOM clean
    for (let i = 0; i < 12; i++) { h.bus.log.push({ type: 'shot' }); h.sync(1000 + i, [{ type: 'shot', damage: i }]); }
    expect(h.toasts('top')).toEqual(['-4', '-5', '-6', '-7', '-8', '-9', '-10', '-11']);   // cap 8: the first four went
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
