import { describe, expect, it } from 'vitest';

import { deriveSignageChrome, inferMood, resolveSignage } from './signage-chrome.js';

describe('inferMood', () => {
  it('honors an explicit mood', () => {
    expect(inferMood({ mood: 'night', bg: '#ffffff' })).toBe('night');
  });
  it('reads a night city (night sky + lamps + low ambient)', () => {
    expect(inferMood({ sky: { preset: 'night' }, lamps: [{ color: '#ffd9a0' }], ambient: 0.26 })).toBe('night');
  });
  it('reads a dark background as night', () => {
    expect(inferMood({ bg: '#0b1018' })).toBe('night');
  });
  it('reads a painted landscape (sky with a horizon)', () => {
    expect(inferMood({ sky: { horizon: '#d9c3a0', zenith: '#7fb0d9' } })).toBe('painted');
  });
  it('reads the flat technical preset (high ambient, neutral tint, no sky)', () => {
    expect(inferMood({ ambient: 0.84, tint: [1, 1, 1] })).toBe('flat');
  });
  it('falls back to day', () => {
    expect(inferMood({})).toBe('day');
  });
});

describe('deriveSignageChrome', () => {
  it('night chrome glows and uses dark glass', () => {
    const c = deriveSignageChrome({ mood: 'night', bg: '#0b1018', lamps: [{ color: '#ffd9a0' }] }, 'popup');
    expect(c.glow).not.toBe('none');
    expect(c.bg).toMatch(/^rgba\(/);
    expect(c.mood).toBe('night');
  });
  it('flat chrome is clean neutral with no glow', () => {
    const c = deriveSignageChrome({ mood: 'flat' }, 'tooltip');
    expect(c.glow).toBe('none');
    expect(c.color).toBe('#1b2330');
  });
  it('painted chrome derives a warm parchment from the horizon', () => {
    const c = deriveSignageChrome({ mood: 'painted', sky: { horizon: '#d9c3a0' } }, 'tooltip');
    expect(c.glow).toBe('none');
    expect(c.color).toBe('#3b3026');
  });
  it('toast nudges: bolder, borderless, and gains a glow even when flat', () => {
    const c = deriveSignageChrome({ mood: 'flat' }, 'toast');
    expect(c.fontWeight).toBe(700);
    expect(c.border).toBe('none');
    expect(c.glow).not.toBe('none');
  });
  it('author palette overrides win last', () => {
    const c = deriveSignageChrome({ mood: 'night' }, 'tooltip', { bg: '#123456', color: '#abcdef' });
    expect(c.bg).toBe('#123456');
    expect(c.color).toBe('#abcdef');
  });
});

describe('resolveSignage', () => {
  it('returns [] for empty / missing input', () => {
    expect(resolveSignage(undefined)).toEqual([]);
    expect(resolveSignage([])).toEqual([]);
  });

  it('normalizes anchors, body, and toast timing', () => {
    const signs = resolveSignage(
      [
        { variant: 'toast', text: '+100', anchor: { slot: 'top' }, after: 0.5, ttl: 2 },
        { variant: 'popup', body: ['page one', 'page two'], anchor: { world: [1, 2, 3] } },
        { variant: 'tooltip', text: 'hi', anchor: { xy: [10, 20] } },
      ],
      { palette: { mood: 'flat' } },
    );
    expect(signs).toHaveLength(3);
    expect(signs[0].anchor).toEqual({ kind: 'slot', slot: 'top' });
    expect(signs[0].after).toBe(0.5);
    expect(signs[1].anchor).toEqual({ kind: 'world', world: [1, 2, 3] });
    expect(signs[1].body).toEqual(['page one', 'page two']);
    expect(signs[1].ttl).toBe(2.5); // default
    expect(signs[2].anchor).toEqual({ kind: 'xy', xy: [10, 20] });
    expect(signs.every((s) => s.chrome && s.chrome.bg)).toBe(true);
  });

  it('resolves an { object } anchor to a world point when a resolver is given', () => {
    const signs = resolveSignage([{ variant: 'tooltip', text: 'x', anchor: { object: 'tower-3' } }], {
      resolveObject: (name) => (name === 'tower-3' ? [5, 6, 7] : null),
    });
    expect(signs[0].anchor).toEqual({ kind: 'world', world: [5, 6, 7], object: 'tower-3' });
  });

  it('passes an { object } anchor through unresolved when no resolver finds it', () => {
    const signs = resolveSignage([{ variant: 'tooltip', text: 'x', anchor: { object: 'tower-3' } }], {});
    expect(signs[0].anchor).toEqual({ kind: 'object', object: 'tower-3' });
  });
});
