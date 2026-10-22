/**
 * The 7th-gen palette (solve.js `era: 'gen-7'`): the same palette as gen-6 with each ramp's relief added, two deeper
 * shades under it and their light negatives over it, checked by its own laws. One spec per light the procedure turns
 * on: a day key, a moonlit low key, a vacuum.
 */
import { describe, it, expect } from 'vitest';
import { solvePalette, readPaletteSpec, reliefOf, RELIEF_STOPS, RELIEF_LAWS } from './solve.js';
import { lchOf, hexToRgb, oklch } from './oklab.js';

const L = (hex) => lchOf(hexToRgb(hex))[0];
const SPECS = [{ seed: 1 }, { seed: 7, key: 'low', heat: -0.6 }, { seed: 4, air: 'none' }];

describe('the 7th-gen palette', () => {
  it('is the 6th-gen palette, the same identity, with its relief added', () => {
    for (const spec of SPECS) {
      const six = solvePalette(spec), seven = solvePalette({ ...spec, era: 'gen-7' });
      for (const k of ['roles', 'light', 'shadow', 'fog', 'ui', 'read']) expect(seven[k], k).toEqual(six[k]);
      expect(seven.era).toBe('gen-7');
      expect(seven.id).not.toBe(six.id);
      expect('relief' in six || 'era' in six).toBe(false);
      for (const [role, ramp] of Object.entries(six.roles)) {
        expect(seven.relief[role]).toHaveLength(RELIEF_STOPS);
        // the ramp's own five in the middle, untouched: added to, not regrown
        expect(seven.relief[role].slice(2, 7)).toEqual(ramp);
      }
      // the gen-7 laws are stamped beside the palette's own; gen-6 carries none of them
      const ids = RELIEF_LAWS.map((l) => l.law);
      expect(six.checks.some((c) => ids.includes(c.law))).toBe(false);
      expect(seven.checks.filter((c) => ids.includes(c.law)).length).toBeGreaterThan(0);
      expect(seven.checks.slice(0, six.checks.length)).toEqual(six.checks);
    }
  });

  it('climbs: each shade under the ramp\'s darkest, each light over its lightest, the pairs as far off as each other', () => {
    for (const spec of SPECS) {
      const K = solvePalette({ ...spec, era: 'gen-7' });
      for (const role of ['ground', 'soil', 'rock', 'made']) {
        const Ls = K.relief[role].map(L);
        for (let i = 1; i < RELIEF_STOPS; i++) expect(Ls[i], `${role} ${i}`).toBeGreaterThan(Ls[i - 1] - 0.004);
        const down = Ls[2] - Ls[0], up = Ls[8] - Ls[6];
        expect(up / down).toBeGreaterThanOrEqual(0.5 - 1e-9);
        expect(up / down).toBeLessThanOrEqual(2 + 1e-9);
      }
      expect(K.checks.filter((c) => c.law.startsWith('relief-') && !c.ok)).toEqual([]);
    }
  });

  it('keeps its deepest shade a colour, never black, whatever the ramp', () => {
    const dark = [0.2, 0.3, 0.4, 0.5, 0.6].map((l) => oklch(l, 0.12, 300)), R = reliefOf(dark, 80, 260);
    const [L0, C0] = lchOf(R[0]);
    expect(L0).toBeGreaterThanOrEqual(0.12 - 1e-3);
    expect(C0).toBeGreaterThanOrEqual(0.02);
  });

  it('moves with its palette: a shifted gen-7 palette is the shifted gen-6 one, relieved', () => {
    const spec = { seed: 3, shift: { light: -0.5, warm: 0.4 } }, six = solvePalette(spec), seven = solvePalette({ ...spec, era: 'gen-7' });
    expect(seven.roles).toEqual(six.roles);
    expect(seven.relief.rock.slice(2, 7)).toEqual(six.roles.rock);
  });

  it('is asked for by name, on the rails of the eras', () => {
    expect(readPaletteSpec({ seed: 2, era: 'gen-7' }).era).toBe('gen-7');
    expect(() => readPaletteSpec({ seed: 2, era: 'gen-8' })).toThrow(/era is the generation the palette is for: 'gen-6' or 'gen-7'/);
  });
});
