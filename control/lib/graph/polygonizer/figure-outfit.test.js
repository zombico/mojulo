// outfit — the tiered authoring form, lowered to the garment array (core tables only).
import { describe, expect, it } from 'vitest';

import { lowerOutfit, manifestGarment, resolveOutfitNames, validateOutfit, OUTFIT_FITS } from './figure-outfit.js';
import { GARMENTS } from './figure-garments.js';
import { renderFigureToSvg, figurePatternReport } from './figure-render.js';

const skirt = {
  id: 'aline', color: { cloth: '#2f4a6d' }, ease_cm: 1.5,
  pieces: [{ id: 'front', fit: 'pattern', sloper: 'skirt-front', dials: { length: 'knee', flare_cm: 6 } }, { id: 'back', fit: 'pattern', sloper: 'skirt-back', dials: { length: 'knee', flare_cm: 6 } }],
  seams: [{ a: { piece: 'front', edge: 'sideR' }, b: { piece: 'back', edge: 'sideL' } }, { a: { piece: 'front', edge: 'sideL' }, b: { piece: 'back', edge: 'sideR' } }],
};
const wardrobe = new Map([
  ['a-line-skirt', { kind: 'garment', spec: skirt, source: 'recipe-book' }],
  ['office', { kind: 'outfit', spec: { fit: 'regular', layers: ['tee', { garment: 'a-line-skirt', dials: { length: 'midi' } }] }, source: 'recipe-book' }],
]);

describe('lowerOutfit', () => {
  it('a bare core name lowers to the name; layers keep their order; null stays null', () => {
    expect(lowerOutfit(null)).toBeNull();
    expect(lowerOutfit({ layers: ['tee', 'trousers'] })).toEqual(['tee', 'trousers']);
    expect(manifestGarment({ garment: 'tee' })).toBe('tee');
    expect(manifestGarment({ outfit: { layers: ['tank'] } })).toEqual(['tank']);
    expect(manifestGarment({})).toBeNull();
  });

  it('fit scales a shell\'s clearance and sets a pattern garment\'s ease; regular leaves a core name a name', () => {
    const relaxed = lowerOutfit({ fit: 'relaxed', layers: ['tee', skirt] });
    expect(relaxed[0]).not.toBe('tee');
    expect(relaxed[0].pieces[0].clearance).toBeCloseTo(GARMENTS.tee.pieces[0].clearance * OUTFIT_FITS.relaxed.clearance, 9);
    expect(relaxed[1].ease_cm).toBe(OUTFIT_FITS.relaxed.ease_cm);
    expect(lowerOutfit({ fit: 'regular', layers: ['tee'] })).toEqual(['tee']);
    const slim = lowerOutfit({ fit: 'slim', layers: [{ garment: skirt, ease_cm: 0.2 }] });
    expect(slim[0].ease_cm).toBe(0.2);   // a layer's own ease wins over fit
  });

  it('dials merge into every sloper piece; a key naming a piece scopes to it; cloth recolours', () => {
    const [g] = lowerOutfit({ layers: [{ garment: skirt, dials: { length: 'midi', back: { flare_cm: 10 } }, cloth: '#abcdef' }] });
    expect(g.color.cloth).toBe('#abcdef');
    expect(g.pieces[0].dials).toEqual({ length: 'midi', flare_cm: 6 });
    expect(g.pieces[1].dials).toEqual({ length: 'midi', flare_cm: 10 });
    expect(skirt.pieces[1].dials.flare_cm).toBe(6);   // the source spec is untouched
  });

  it('is deterministic and refuses an unlowered name or an unknown key', () => {
    const o = { fit: 'slim', layers: ['tee', { garment: skirt, dials: { length: 'mini' } }] };
    expect(JSON.stringify(lowerOutfit(o))).toBe(JSON.stringify(lowerOutfit(o)));
    expect(() => lowerOutfit('office')).toThrow(/resolved by value at mint/);
    expect(() => lowerOutfit({ layers: ['toga'] })).toThrow(/not a wardrobe key/);
  });
});

describe('resolveOutfitNames + validateOutfit (the mint door)', () => {
  it('replaces book names by value with `from`, keeps core names as names, recurses through a named outfit', () => {
    const r = resolveOutfitNames('office', wardrobe);
    expect(r.from).toBe('book:office');
    expect(r.layers[0]).toBe('tee');
    expect(r.layers[1].from).toBe('book:a-line-skirt');
    expect(r.layers[1].garment.id).toBe('aline');
    expect(r.layers[1].dials).toEqual({ length: 'midi' });
    // lowering the resolved outfit needs no book
    const lowered = lowerOutfit(r);
    expect(lowered[1].pieces[0].dials.length).toBe('midi');
    expect(resolveOutfitNames({ layers: ['tee'] }, wardrobe)).toEqual({ layers: ['tee'] });
    expect(resolveOutfitNames('office', null)).toBe('office');
  });

  it('validates: fit names, non-empty layers, unknown names (listing the book), dials on a shell, inline specs', () => {
    expect(validateOutfit(null)).toEqual([]);
    expect(validateOutfit('office', 'outfit', { wardrobe })).toEqual([]);
    expect(validateOutfit('office')[0]).toMatch(/no book outfit is attached/);
    expect(validateOutfit('gala', 'outfit', { wardrobe })[0]).toMatch(/the book has: office/);
    expect(validateOutfit({ fit: 'huge', layers: ['tee'] })[0]).toMatch(/fit: one of/);
    expect(validateOutfit({ layers: [] })[0]).toMatch(/non-empty/);
    expect(validateOutfit({ layers: ['toga'] }, 'outfit', { wardrobe })[0]).toMatch(/or a book garment \(a-line-skirt\)/);
    expect(validateOutfit({ layers: [{ garment: 'tee', dials: { hem: 'hip' } }] })[0]).toMatch(/offset shell/);
    expect(validateOutfit({ layers: [{ garment: 'a-line-skirt', dials: { length: 'midi' } }] }, 'outfit', { wardrobe })).toEqual([]);
    expect(validateOutfit({ layers: [{ id: 'x', pieces: [{ fit: 'toga' }] }] })[0]).toMatch(/fit/);
    expect(validateOutfit({ layers: [{ garment: 'tee', cloth: 7 }] })[0]).toMatch(/cloth/);
  });

  it('a figure manifest with `outfit` renders and reports through the same pipeline as `garment`', () => {
    const resolved = resolveOutfitNames('office', wardrobe);
    const viaOutfit = { kind: 'figure', proto: { sex: 'female' }, outfit: resolved, view: 'three-quarter' };
    const viaGarment = { kind: 'figure', proto: { sex: 'female' }, garment: lowerOutfit(resolved), view: 'three-quarter' };
    expect(renderFigureToSvg(viaOutfit)).toBe(renderFigureToSvg(viaGarment));
    expect(figurePatternReport(viaOutfit).map((g) => g.id)).toEqual(['aline']);
    // the readout wears the layers in order: the skirt over a tee reads the tee's lift on the trunk
    const r = figurePatternReport(viaOutfit)[0];
    expect(r.under.trunk).toBeGreaterThan(1);
    expect(figurePatternReport({ kind: 'figure', proto: { sex: 'female' }, garment: [lowerOutfit(resolved)[1]] })[0].under.trunk).toBe(1);
    // a regular-fit outfit of bare core names is byte-identical to the garment array
    expect(renderFigureToSvg({ kind: 'figure', outfit: { layers: ['tee', 'trousers'] } })).toBe(renderFigureToSvg({ kind: 'figure', garment: ['tee', 'trousers'] }));
  });
});
