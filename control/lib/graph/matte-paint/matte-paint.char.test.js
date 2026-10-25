import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { paintSurface } from './index.js';

// CHARACTERIZATION PIN: an element stores its surface's spec and the build paints it on every read, so the bytes a spec
// paints are a promise. A change here is legitimate only when the step says the painting changes.
const RAMP = ['#202428', '#40464e', '#666d76', '#9aa0a8', '#d4d8dc'], DIRT = ['#2a2018', '#4a3a2a', '#6e5a44', '#94806a', '#bcaa94'];
const base = { outline: { shape: 'block', w: 0.4, h: 0.2 }, ppm: 128, seed: 3 };
const PINS = [
  ['every relief layer, every default paint layer', { ...base, grit: 0.8, paint: { ramp: RAMP, dirt: { ramp: DIRT } } }, '70d1e2fb0839'],
  ['tooled, a low sun, moss', { ...base, grit: 0.3, light: { az: 20, el: 15 }, relief: { tool: { kind: 'tooled' } }, paint: { ramp: RAMP, moss: { ramp: DIRT, amount: 0.5 } } }, 'ceb23fc915df'],
  ['pitched', { ...base, relief: { tool: { kind: 'pitched' } }, paint: { ramp: RAMP } }, '1c017b6b6259'],
];

describe('the matte painter is pinned', () => {
  it.each(PINS)('%s', (_, spec, print) => {
    expect(createHash('sha1').update(paintSurface(spec).png).digest('hex').slice(0, 12)).toBe(print);
  });
});
