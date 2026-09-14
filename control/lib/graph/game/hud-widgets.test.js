import { describe, expect, it } from 'vitest';

import { HUD_SLOTS, HUD_KINDS, FONTS, colorCss, hudSlotsUsed, normalizeHud, styleTokens, styleVars, validateHudStyle } from './hud-widgets.js';

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
