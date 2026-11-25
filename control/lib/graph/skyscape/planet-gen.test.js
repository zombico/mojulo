import { describe, expect, it } from 'vitest';

import { PLANET_KINDS, BLACK_HOLE, generatePlanet, pickKind } from './planet-gen.js';
import { mulberry32 } from '../city/plan/dice.js';

// ── the planet generator (planet-gen.js): a world as knobs, an archetype a row; no two alike, none magenta ────────────
const hue = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255), M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m; if (!d) return null; const x = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: (x * 60 + 360) % 360, s: M ? d / M : 0 }; };
const UNIT = ['ocean', 'veg', 'ice', 'cloud', 'craters', 'lava', 'lights', 'dunes', 'haze', 'atmo', 'glow', 'storm'];

describe('the planet generator', () => {
  it('makes a world of every kind: its knobs in range, its colours hex and never the target\'s magenta', () => {
    for (const kind of Object.keys(PLANET_KINDS)) {
      const w = generatePlanet(kind, mulberry32(7));
      expect(w.kind).toBe(kind);
      if (w.blackHole) { expect(w.disk).toEqual([...BLACK_HOLE.disk]); continue; }
      for (const k of UNIT) expect(w[k], `${kind}.${k}`).toBeGreaterThanOrEqual(0), expect(w[k], `${kind}.${k}`).toBeLessThanOrEqual(1);
      for (const [k, v] of Object.entries(w)) if (typeof v === 'string' && v.startsWith('#')) { expect(v).toMatch(/^#[0-9a-f]{6}$/); const H = hue(v); if (H && H.s > 0.25) expect(H.h > 285 && H.h < 345, `${kind}.${k} ${v}`).toBe(false); }
    }
  });

  it('tells its kinds apart by what they are made of', () => {
    const w = (k) => generatePlanet(k, mulberry32(3));
    expect(w('jovian').gas).toBe(1);
    expect(w('earthlike').gas).toBe(0);
    expect(w('ocean').ocean).toBeGreaterThan(w('earthlike').ocean);
    expect(w('desert').ocean).toBeLessThan(0.1);
    expect(w('molten').lava).toBeGreaterThan(w('volcanic').lava);
    expect(w('city').lights).toBeGreaterThan(0.8);
    expect(w('barren').atmo).toBeLessThan(0.1);
    expect(w('saturnian').rings).toBeTruthy();
    expect(w('arctic').ice).toBeGreaterThan(0.6);
  });

  it('the same dice, the same world; other dice, another of the kind; a word it does not know taught', () => {
    expect(generatePlanet('earthlike', mulberry32(5))).toEqual(generatePlanet('earthlike', mulberry32(5)));
    expect(generatePlanet('earthlike', mulberry32(6))).not.toEqual(generatePlanet('earthlike', mulberry32(5)));
    expect(() => generatePlanet('dyson-sphere', mulberry32(1))).toThrow(/not a kind of world/);
  });

  it('a slot\'s size takes only the kinds that fit it', () => {
    const rnd = mulberry32(11);
    for (let i = 0; i < 40; i++) {
      expect(PLANET_KINDS[pickKind(rnd, 'small')].size).not.toBe('large');
      expect(PLANET_KINDS[pickKind(rnd, 'large')].size).not.toBe('small');
    }
  });
});
