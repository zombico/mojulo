// creature-light.test.js — a drawn creature (creature-drawn.js, the plan's `style.drawn`) takes the character light the
// anime hero does, its markings stepped as its own colours, and the metal's gloss only when it wears plate.
import { describe, expect, it } from 'vitest';
import { resolveCharacterLight, characterLitPieces, METAL_HIGHLIGHT, CREATURE_KEY, SHADE_STEP, hexLch } from './station-loft-shade.js';

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

describe('a drawn creature shaded as the heroes are', () => {
  const plan = { style: { drawn: true }, segments: [{ group: 'Torso' }], palette: { Torso: '#e6d6b8', OutfitBase: '#00566f', OutfitTrim: '#c9a24a' } };
  const light = resolveCharacterLight({ plan });
  it('the key turned toward the side, the step a little toward it: the shadow line crosses the front', () => {
    const n = Math.hypot(...CREATURE_KEY);
    for (let k = 0; k < 3; k++) expect(light.toLight[k]).toBeCloseTo(CREATURE_KEY[k] / n, 6);
    expect(light.threshold).toBeGreaterThan(0);
  });
  it('the body\'s shade is darker and richer, never a grey; a dark cloth steps by value', () => {
    const [L, C] = hexLch(plan.palette.Torso), [Ls, Cs] = hexLch(light.shade.Torso);
    expect(L - Ls).toBeGreaterThanOrEqual(SHADE_STEP); expect(Cs).toBeGreaterThan(C);
    expect(hexLch(plan.palette.OutfitBase)[0] - hexLch(light.shade.OutfitBase)[0]).toBeGreaterThanOrEqual(SHADE_STEP - 0.5);
    expect(light.shade.OutfitTrim).toBeUndefined();   // a light enough colour keeps the derived shade
  });
});
