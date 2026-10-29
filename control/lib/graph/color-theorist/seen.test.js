// Seen laws (seen.js): the color theorist reads a render against the palette that asked for it: the swatches on their
// targets, the roles in the palette's order of lightness, the accent the most chromatic, shade a colour toward the sky.
import { describe, expect, it } from 'vitest';
import { seenLaws } from './seen.js';

const PALETTE = { sky: '#a6ccff', accent: 'accent',
  targets: { sand: { lit: '#e6d3a4', shade: '#76847c' }, grass: { lit: '#7cbf48', shade: '#2d762a' }, accent: { lit: '#d0402a', shade: '#5a2a40' } } };
const law = (L, name) => L.find((l) => l.law === name);

describe('seen laws', () => {
  it('a render that honours the palette passes every law it can read', () => {
    const L = seenLaws({ roles: { sand: { lit: '#d8c69a', shade: '#70807a' }, grass: { lit: '#74b444', shade: '#2a7030' }, accent: { lit: '#c83c28', shade: '#56304a' } },
      swatches: { sand: { lit: '#e7d4a5', shade: '#76847c' } } }, PALETTE);
    expect(L.map((l) => l.law)).toEqual(['targets', 'value-order', 'accent', 'shade-is-a-colour']);
    expect(L.every((l) => l.ok), JSON.stringify(L)).toBe(true);
  });

  it('a render that loses the palette is named, law by law', () => {
    const L = seenLaws({ roles: { sand: { lit: '#606060', shade: '#030303' }, grass: { lit: '#7cbf48', shade: '#3a5a20' }, accent: { lit: '#806860', shade: '#403030' } },
      swatches: { sand: { lit: '#f0e0b0', shade: '#76847c' } } }, PALETTE);
    expect(law(L, 'targets')).toMatchObject({ ok: false, value: expect.stringMatching(/sand lit/) });
    expect(law(L, 'value-order')).toMatchObject({ ok: false, value: expect.stringMatching(/sand under grass/) });
    expect(law(L, 'accent')).toMatchObject({ ok: false, value: expect.stringMatching(/grass/) });
    // sand's shade black; grass's darkened toward its own hue (yellower), away from the sky's blue
    expect(law(L, 'shade-is-a-colour').value).toMatch(/sand's shade black.*grass's shade not toward the sky/);
  });

  it('a law with nothing to read is left out', () => {
    expect(seenLaws({ roles: { sand: { lit: '#e6d3a4' } } }, { targets: PALETTE.targets })).toEqual([]);
  });
});
