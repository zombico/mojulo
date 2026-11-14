import { describe, it, expect } from 'vitest';
import { COLOUR_DIRECTIONS, COLOUR_DIRECTION_IDS, directSpec, QUIET } from './directions.js';
import { readPaletteSpec, solvePalette, PALETTE_SCRIPT_IDS } from './solve.js';
import { lchOf, hexToRgb } from './oklab.js';

const SPEC = { seed: 9, key: 'high', heat: 0.4, activity: 0.3, scheme: 'complementary', hues: { ground: 118, accent: '#3a80d0' } };

describe('the colour directions', () => {
  it('each moves a spec the theorist reads, and keeps the palette\'s own character: its seed, its key, its hues', () => {
    for (const id of COLOUR_DIRECTION_IDS) {
      const moved = directSpec(SPEC, id);
      expect(() => readPaletteSpec(moved, id), id).not.toThrow();
      for (const k of ['seed', 'key', 'heat', 'scheme', 'hues']) expect(moved[k], `${id} ${k}`).toEqual(SPEC[k]);
      expect(moved).not.toEqual(SPEC);
      expect(SPEC.values).toBeUndefined();
      for (const k of ['name', 'says', 'why']) expect(COLOUR_DIRECTIONS[id][k], `${id} ${k}`).toBeTruthy();
    }
  });

  it('a quiet land is grouped in value and low in chroma, the accent left to spend what the land does not', () => {
    const moved = directSpec(SPEC, 'quiet-land'), was = solvePalette(SPEC), now = solvePalette(moved);
    expect(moved.values.groups).toBe(QUIET.groups);
    expect(moved.activity).toBe(QUIET.activity);
    const C = (K, role) => lchOf(hexToRgb(K.roles[role][2]))[1];
    expect(C(now, 'ground')).toBeLessThan(C(was, 'ground'));
    expect(C(now, 'accent')).toBeGreaterThan(C(now, 'ground'));
    // a land already quieter stays as quiet as it was; taken twice, it is the same
    expect(directSpec({ ...SPEC, activity: -0.8 }, 'quiet-land').activity).toBe(-0.8);
    expect(directSpec(moved, 'quiet-land')).toEqual(moved);
  });

  it('a script is one the theorist knows, and says how many levels it travels across', () => {
    const scripted = COLOUR_DIRECTION_IDS.filter((id) => directSpec(SPEC, id).script !== undefined);
    expect(scripted.length).toBeGreaterThan(0);
    for (const id of scripted) { expect(PALETTE_SCRIPT_IDS).toContain(directSpec(SPEC, id).script); expect(COLOUR_DIRECTIONS[id].levels).toBeGreaterThanOrEqual(2); }
    expect(() => directSpec(SPEC, 'loud-land')).toThrow(/is not one/);
    expect(() => directSpec(null, COLOUR_DIRECTION_IDS[0])).toThrow(/moves a palette spec/);
  });
});
