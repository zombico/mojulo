// creature-light.test.js — a drawn creature (creature-drawn.js, the plan's `style.drawn`) takes the character light the
// anime hero does, its markings stepped as its own colours, and the metal's gloss only when it wears plate.
import { describe, expect, it } from 'vitest';
import { resolveCharacterLight, characterLitPieces, METAL_HIGHLIGHT } from './station-loft-shade.js';

describe('a drawn creature under the character light', () => {
  it('takes the light; a creature not drawn, and a landmark hero, do not; plate brings the gloss', () => {
    expect(resolveCharacterLight({ plan: { style: { drawn: true } } })).toBeTruthy();
    expect(resolveCharacterLight({ plan: { style: {} } })).toBeNull();
    expect(resolveCharacterLight({ hero: { head: 'landmark' } })).toBeNull();
    const plate = resolveCharacterLight({ plan: { style: { drawn: true }, outfit: { pieces: [{ kind: 'pauldron', colour: 'metal' }] } } });
    expect(plate.highlight).toMatchObject(METAL_HIGHLIGHT);
    expect(resolveCharacterLight({ plan: { style: { drawn: true } } }).highlight?.OutfitMetal).toBeUndefined();
  });
  it('a marking is stepped as its own colour: the tinted face is lit from the tinted base', () => {
    const mesh = { vertices: [[0, 0, 0], [1, 0, 0], [0, 0, 1]], faces: [[0, 1, 2]], groups: ['Skin'], parts: { torso: {} }, provenance: [{ part: 'torso' }, { part: 'torso' }, { part: 'torso' }] };
    const light = resolveCharacterLight({ plan: { style: { drawn: true } } }), palette = { Skin: '#c08040' };
    const plain = characterLitPieces(mesh, { light, palette }), half = characterLitPieces(mesh, { light, palette, tint: [[[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]]] });
    const fill = (P) => P.find((p) => p?.fill)?.fill ?? P.flatMap((p) => p?.pieces ?? []).find((p) => p.fill)?.fill;
    expect(fill(half)).not.toBe(fill(plain));
  });
});
