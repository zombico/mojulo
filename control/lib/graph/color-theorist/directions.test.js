import { describe, it, expect } from 'vitest';
import { COLOUR_DIRECTIONS, COLOUR_DIRECTION_IDS, directSpec, QUIET, CARD_CHARACTER, cardPaletteSpec } from './directions.js';
import { SWATCHES } from '../era/style/swatches.js';
import { readPaletteSpec, solvePalette, PALETTE_SCRIPT_IDS } from './solve.js';
import { lchOf, hexToRgb, rgbToHex } from './oklab.js';

const SPEC = { seed: 9, key: 'high', heat: 0.4, activity: 0.3, scheme: 'complementary', hues: { ground: 118, accent: '#3a80d0' } };

describe('the colour directions', () => {
  it('each moves a spec the theorist reads, and keeps the palette\'s own character: its seed, its key, its hues', () => {
    // (the directions that move the palette it is given; one that reads a kit's card is below)
    for (const id of COLOUR_DIRECTION_IDS.filter((x) => !COLOUR_DIRECTIONS[x].needs)) {
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

  it('a kit\'s card is given back as a palette the theorist solves to the card and can move; a kit with no row is left', () => {
    const kit = Object.keys(CARD_CHARACTER)[0], card = cardPaletteSpec(kit), L = SWATCHES[kit].land, mid = (r) => rgbToHex(r[Math.floor(r.length / 2)]).toLowerCase();
    const moved = directSpec(SPEC, 'kit-card', { kit });
    expect(moved).toEqual({ seed: SPEC.seed, ...card });
    expect(() => readPaletteSpec(moved, 'kit-card')).not.toThrow();
    // (solved, each locked role's middle stop is the card's own, read from where the card keeps it)
    const K = solvePalette(moved);
    expect(K.roles.ground[2]).toBe(mid(L.grass));
    expect(K.roles.sky[2]).toBe(mid(L.sky));
    // (moved, it is the same palette somewhere else: the ground no longer the card's, and darker toward night)
    const night = solvePalette({ ...moved, shift: { light: -0.5 } });
    expect(night.roles.ground[2]).not.toBe(K.roles.ground[2]);
    expect(lchOf(hexToRgb(night.roles.ground[2]))[0]).toBeLessThan(lchOf(hexToRgb(K.roles.ground[2]))[0]);
    // (no kit, or one with no row: the spec as it was, so the direction is no option there)
    expect(directSpec(SPEC, 'kit-card')).toEqual(SPEC);
    expect(directSpec(SPEC, 'kit-card', { kit: 'no-such-kit' })).toEqual(SPEC);
    expect(cardPaletteSpec('no-such-kit')).toBeNull();
  });

  it('a script is one the theorist knows, and says how many levels it travels across', () => {
    const scripted = COLOUR_DIRECTION_IDS.filter((id) => directSpec(SPEC, id).script !== undefined);
    expect(scripted.length).toBeGreaterThan(0);
    for (const id of scripted) { expect(PALETTE_SCRIPT_IDS).toContain(directSpec(SPEC, id).script); expect(COLOUR_DIRECTIONS[id].levels).toBeGreaterThanOrEqual(2); }
    expect(() => directSpec(SPEC, 'loud-land')).toThrow(/is not one/);
    expect(() => directSpec(null, COLOUR_DIRECTION_IDS[0])).toThrow(/moves a palette spec/);
  });
});
