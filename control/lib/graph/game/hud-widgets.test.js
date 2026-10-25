import { describe, expect, it } from 'vitest';

import { HUD_SLOTS, HUD_KINDS, FONTS, colorCss, hudSlotsUsed, normalizeHud, styleTokens, styleVars, validateHudStyle, MOMENT_KINDS, TOAST_TTL, hudSubst, fmtDelta, TITLE_THEMES, TITLE_THEME_IDS, TITLE_LOOKS, TITLE_STYLES, TITLE_EDGES, titleThemeFor, titleDials } from './hud-widgets.js';

describe('normalizeHud — the widget language over events.hud', () => {
  it('a legacy { var, label } row is a text readout at top-left (every existing world means what it meant)', () => {
    const { widgets, errors } = normalizeHud([{ var: 'score', label: 'Score' }, { var: 'time' }]);
    expect(errors).toEqual([]);
    expect(widgets).toEqual([
      { kind: 'readout', var: 'score', label: 'Score', slot: 'top-left', as: 'text' },
      { kind: 'readout', var: 'time', label: 'time', slot: 'top-left', as: 'text' },
    ]);
  });

  it('readout kinds, slots, max and color pass through; a bar without max teaches', () => {
    const { widgets, errors } = normalizeHud([
      { var: 'hp', label: 'HP', as: 'bar', max: 100, slot: 'bottom-left', color: 'harm' },
      { var: 'boost', as: 'bar', max: 'boostMax', slot: 'bottom-right' },
      { var: 'time', as: 'clock', slot: 'top' },
      { var: 'score', as: 'counter', slot: 'top-right', color: '#ffd700' },
    ]);
    expect(errors).toEqual([]);
    expect(widgets.map((w) => [w.as, w.slot, w.max])).toEqual([['bar', 'bottom-left', 100], ['bar', 'bottom-right', 'boostMax'], ['clock', 'top', undefined], ['counter', 'top-right', undefined]]);
    expect(widgets[0].color).toBe('harm');
    expect(normalizeHud([{ var: 'hp', as: 'bar' }]).errors.join()).toMatch(/needs max/);
  });

  it('same-var rows MERGE, first declared winning per field (a hand row restyles a mechanic default)', () => {
    // hand row first (mergeEventManifests order), the mechanic's { var:'hp', label:'HP' } after
    const { widgets } = normalizeHud([{ var: 'hp', as: 'bar', max: 100, slot: 'bottom-left' }, { var: 'hp', label: 'HP' }, { var: 'time', label: 'Time' }]);
    expect(widgets).toEqual([
      { kind: 'readout', var: 'hp', label: 'HP', slot: 'bottom-left', as: 'bar', max: 100 },
      { kind: 'readout', var: 'time', label: 'Time', slot: 'top-left', as: 'text' },
    ]);
    // and the other way round: the mechanic's label stands when the hand row also names one
    expect(normalizeHud([{ var: 'hp', label: 'Health' }, { var: 'hp', label: 'HP' }]).widgets[0].label).toBe('Health');
  });

  it('banners and legends: event-driven vs static, centre-line defaults, ttl', () => {
    const { widgets, errors } = normalizeHud([
      { on: 'game-over', text: 'TIME! {score}' },
      { on: 'goal:*', text: 'CLEAR', slot: 'top', ttl: 3.5, color: 'goal' },
      { text: 'WASD to move · click to whack' },
      { text: 'press E', slot: 'center', ttl: 4 },
    ]);
    expect(errors).toEqual([]);
    expect(widgets).toEqual([
      { kind: 'banner', on: 'game-over', text: 'TIME! {score}', slot: 'center', ttl: 2 },
      { kind: 'banner', on: 'goal:*', text: 'CLEAR', slot: 'top', ttl: 3.5, color: 'goal' },
      { kind: 'legend', text: 'WASD to move · click to whack', slot: 'bottom' },
      { kind: 'legend', text: 'press E', slot: 'center', ttl: 4 },
    ]);
    expect(normalizeHud([{ on: 'x' }]).errors.join()).toMatch(/needs text/);
    expect(normalizeHud([{ text: 'hi', ttl: -1 }]).errors.join()).toMatch(/ttl/);
  });

  it('toasts: an on-row as:toast stacks per firing; a var-row as:toast is the change popup, never merged with the readout', () => {
    const { widgets, errors } = normalizeHud([
      { var: 'hp', label: 'HP', as: 'bar', max: 100, slot: 'bottom-left' },
      { on: 'shot', text: '-{event.damage}', as: 'toast' },
      { var: 'hp', as: 'toast', slot: 'bottom-left', ttl: 1.2, color: 'harm' },
      { var: 'score', as: 'toast', text: '{delta} pts' },
      { var: 'hp' },   // merges into the BAR (the first var row), not the toast
    ]);
    expect(errors).toEqual([]);
    expect(widgets).toEqual([
      { kind: 'readout', var: 'hp', label: 'HP', slot: 'bottom-left', as: 'bar', max: 100 },
      { kind: 'toast', on: 'shot', text: '-{event.damage}', slot: 'center', ttl: TOAST_TTL },
      { kind: 'toast', var: 'hp', text: '{delta}', slot: 'bottom-left', ttl: 1.2, color: 'harm' },
      { kind: 'toast', var: 'score', text: '{delta} pts', slot: 'center', ttl: TOAST_TTL },
    ]);
    expect(normalizeHud([{ on: 'shot', as: 'toast' }]).errors.join()).toMatch(/a toast needs text/);
    expect(normalizeHud([{ on: 'shot', text: 'x', as: 'popup' }]).errors.join()).toMatch(/as must be one of: banner, toast/);
    expect(normalizeHud([{ var: 'hp', as: 'toast', text: 3 }]).errors.join()).toMatch(/text must be a string/);
    expect(normalizeHud([{ var: 'hp', as: 'toast', ttl: 0 }]).errors.join()).toMatch(/ttl/);
  });

  it('hudSubst: {var} reads the bus (unknown stays literal, as before); {event.*} / {delta} / {value} read the firing context or empty', () => {
    const vars = { score: 12, hp: 80 };
    expect(hudSubst('TIME! {score}', vars)).toBe('TIME! 12');
    expect(hudSubst('{nope}', vars)).toBe('{nope}');
    expect(hudSubst('-{event.damage} on {event.target}', vars, { event: { type: 'shot', damage: 12, target: 'mole-3' } })).toBe('-12 on mole-3');
    expect(hudSubst('-{event.damage}', vars, { event: {} })).toBe('-');
    expect(hudSubst('{delta} → {value}', vars, { delta: '-20', value: 80 })).toBe('-20 → 80');
    expect(hudSubst('{delta}', vars)).toBe('');
    expect(hudSubst('open {brace', vars)).toBe('open {brace');
    expect(fmtDelta(-20)).toBe('-20'); expect(fmtDelta(5)).toBe('+5'); expect(fmtDelta(0)).toBe('0'); expect(fmtDelta(-0.333)).toBe('-0.33');
    // the page ships these verbatim: no closures over module scope, so toString() is the whole rule
    expect(hudSubst.toString()).not.toMatch(/HEX|isStr|SEMANTIC/);
    expect(fmtDelta.toString()).not.toMatch(/HEX|isStr/);
  });

  it('teaches on a bad slot / kind / color / shape, naming the row', () => {
    const { errors } = normalizeHud([{ var: 'a', slot: 'left' }, { var: 'b', as: 'gauge' }, { var: 'c', color: 'red' }, { nope: 1 }, null]);
    expect(errors.length).toBe(5);
    expect(errors[0]).toMatch(/hud\[0\]\.slot must be one of: top-left/);
    expect(errors[1]).toMatch(/hud\[1\]\.as must be one of: text, counter, bar, clock/);
    expect(errors[2]).toMatch(/hud\[2\]\.color/);
    expect(errors[3]).toMatch(/hud\[3\] must be a readout/);
  });

  it('the closed lists are what the cards say', () => {
    expect(HUD_SLOTS).toEqual(['top-left', 'top', 'top-right', 'center', 'bottom-left', 'bottom', 'bottom-right']);
    expect(HUD_KINDS).toEqual(['text', 'counter', 'bar', 'clock']);
    expect(MOMENT_KINDS).toEqual(['banner', 'toast', 'title']);
    expect(TITLE_THEME_IDS).toEqual(['arcade', 'pixel', 'cel', 'cartoon', 'cinematic', 'speed']);
    // every theme is whole: a carve, an entrance, an edge, a colour and a time from the closed lists
    for (const [id, T] of Object.entries(TITLE_THEMES)) {
      expect(TITLE_STYLES, id).toContain(T.style); expect(TITLE_LOOKS, id).toContain(T.look); expect(TITLE_EDGES, id).toContain(T.edge);
      expect(typeof T.caps, id).toBe('boolean'); expect(T.ttl, id).toBeGreaterThan(0); expect(T.flash, id).toBeGreaterThanOrEqual(0); expect(T.about, id).toMatch(/\S/);
    }
    expect(hudSlotsUsed(normalizeHud([{ var: 'a', slot: 'bottom' }, { var: 'b' }, { on: 'x', text: 'y' }]).widgets)).toEqual(['top-left', 'center', 'bottom']);
  });
});

describe('style tokens — one shape for the shell theme and a world\'s events.style', () => {
  it('validates hex tokens + a font from the closed list; unknown keys are ignored', () => {
    expect(validateHudStyle({ accent: '#5fe6d6', ink: '#fff', font: 'mono', style: 'hud' })).toEqual([]);
    expect(validateHudStyle({ accent: 'teal' }).join()).toMatch(/accent must be a hex color/);
    expect(validateHudStyle({ font: 'comic' }).join()).toMatch(/font must be one of: system, mono, serif, display/);
    expect(validateHudStyle(null, 'theme')[0]).toMatch(/^theme must be/);
  });

  it('resolves tokens with defaults and REFUSES an injected value (defense in depth)', () => {
    const t = styleTokens({ accent: '#123456', font: 'serif', panel: 'red;} body{display:none' });
    expect(t.accent).toBe('#123456');
    expect(t.panel).toBe('#0c101a');   // fell back to the default, never reached a CSS context
    expect(t.font).toBe(FONTS.serif);
    const vars = styleVars({ accent: '#123456', font: 'mono' });
    expect(vars).toContain('--moj-accent:#123456');
    expect(vars).toContain('--moj-font:ui-monospace');
    expect(vars).toContain('--moj-harm:');
    expect(vars).not.toContain('display:none');
  });

  it('colorCss maps hex through, semantic names to vars, junk to the fallback', () => {
    expect(colorCss('#abc')).toBe('#abc');
    expect(colorCss('harm')).toBe('var(--moj-harm)');
    expect(colorCss('accent2')).toBe('var(--moj-accent2)');
    expect(colorCss('url(x)', 'inherit')).toBe('inherit');
  });
});

describe('title themes — the game implies one, a row\'s own dial wins', () => {
  it('titleThemeFor reads the juice floor; titleDials lays a row\'s dials over its theme', () => {
    expect(titleThemeFor(null)).toBe('arcade');
    expect(titleThemeFor({ register: 'anime', flavor: 'action' })).toBe('cel');
    expect(titleThemeFor({ register: 'western', flavor: 'action' })).toBe('arcade');
    expect(titleThemeFor({ register: 'anime', flavor: 'platformer' })).toBe('cartoon');
    expect(titleThemeFor({ register: 'western', flavor: 'realistic' })).toBe('cinematic');
    expect(titleThemeFor({ register: 'western', flavor: 'pinball' })).toBe('speed');
    expect(titleThemeFor({ register: 'anime', flavor: 'pinball' })).toBe('arcade');
    expect(titleDials({ theme: 'pixel' })).toMatchObject({ theme: 'pixel', style: 'blocky', look: 'rise', caps: true, edge: 'ink', color: 'accent', ttl: 2 });
    expect(titleDials({ theme: 'pixel', look: 'slam', color: 'harm', ttl: 3 })).toMatchObject({ style: 'blocky', look: 'slam', color: 'harm', ttl: 3 });
    expect(titleDials({})).toMatchObject({ theme: 'arcade', edge: 'both', caps: true });
    const { widgets, errors } = normalizeHud([{ on: 'x', text: 'go', as: 'title', theme: 'cel', caps: false }, { on: 'y', text: 'y', as: 'title', theme: 'disco', edge: 'halo', caps: 'yes' }]);
    expect(widgets[0]).toMatchObject({ kind: 'title', theme: 'cel', style: 'italic', look: 'stamp', caps: false, edge: 'ink', tilt: -0.1, ring: true });
    expect(errors).toEqual(['hud[1].theme must be one of: arcade, pixel, cel, cartoon, cinematic, speed (a title\'s design style)', 'hud[1].edge must be one of: ink, shadow, both, glow, none (what stands behind a title\'s letters)', 'hud[1].caps is true (the words in capitals) or false']);
  });
});
