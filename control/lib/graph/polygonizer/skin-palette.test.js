/**
 * Unit tests for the skin-palette resolver.
 *
 * Covers:
 *   - Table coverage: every flavor × tone combination has all four
 *     roles populated with well-formed #rrggbb hex strings.
 *   - Default tone fallback: absent `tone` resolves to DEFAULT_TONE.
 *   - Strict error surface: unknown flavor, unknown explicit tone,
 *     unknown role all throw with "available: ..." messages so the
 *     LLM gets a clear retry signal.
 *   - Sanity directional checks: same role under different tones is
 *     not the same hex (i.e. the table actually varies by tone).
 *   - Backwards-compat anchor: the silver-daylight column matches the
 *     hex stops already shipped in the three production skin cards.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TONE,
  SKIN_TONES,
  SKIN_FLAVORS,
  SKIN_ROLES,
  resolveSkinPalette,
  resolveSkinColor,
} from './skin-palette.js';

const HEX_PATTERN = /^#[0-9a-f]{6}$/;

describe('skin-palette resolver', () => {
  it('table covers every flavor × tone × role with valid hex', () => {
    for (const flavor of SKIN_FLAVORS) {
      for (const tone of SKIN_TONES) {
        const palette = resolveSkinPalette(flavor, tone);
        for (const role of SKIN_ROLES) {
          expect(
            palette[role],
            `${flavor}/${tone}/${role}`,
          ).toMatch(HEX_PATTERN);
        }
      }
    }
  });

  it('absent tone falls back to DEFAULT_TONE', () => {
    const explicit = resolveSkinPalette('water', DEFAULT_TONE);
    expect(resolveSkinPalette('water')).toEqual(explicit);
    expect(resolveSkinPalette('water', undefined)).toEqual(explicit);
    expect(resolveSkinPalette('water', null)).toEqual(explicit);
  });

  it('throws on unknown flavor with available list', () => {
    expect(() => resolveSkinPalette('vapor')).toThrow(
      /unknown flavor 'vapor'.*water.*stone/,
    );
  });

  it('throws on explicit unknown tone with available list', () => {
    expect(() => resolveSkinPalette('water', 'gloamy')).toThrow(
      /unknown tone 'gloamy' for flavor 'water'.*moonlight/,
    );
  });

  it('throws on unknown role with available list', () => {
    expect(() => resolveSkinColor('specular', 'water', 'sunset')).toThrow(
      /unknown role 'specular'.*shadow.*highlight/,
    );
  });

  it('same role varies across tones (table is not degenerate)', () => {
    const tones = SKIN_TONES.map((t) => resolveSkinColor('highlight', 'water', t));
    expect(new Set(tones).size).toBe(SKIN_TONES.length);
  });

  it('silver-daylight palette matches existing skin-card hex stops', () => {
    // The three production skin cards hardcode a daylight-leaning
    // palette today. Locking these anchors means rewriting the cards
    // to use role+flavor does not regress under the default tone.
    // water-shimmer card layers → base/mid/highlight:
    expect(resolveSkinColor('base', 'water', 'silver-daylight')).toBe('#526f83');
    expect(resolveSkinColor('mid', 'water', 'silver-daylight')).toBe('#c5d5dc');
    expect(resolveSkinColor('highlight', 'water', 'silver-daylight')).toBe('#f0f5f6');
    // stone-grain card layers → base/shadow:
    expect(resolveSkinColor('base', 'stone', 'silver-daylight')).toBe('#756f67');
    expect(resolveSkinColor('shadow', 'stone', 'silver-daylight')).toBe('#4f4a44');
    // atmospheric-veil card layers → mid/highlight:
    expect(resolveSkinColor('mid', 'atmosphere', 'silver-daylight')).toBe('#c7cbc5');
    expect(resolveSkinColor('highlight', 'atmosphere', 'silver-daylight')).toBe('#eef0eb');
  });
});
