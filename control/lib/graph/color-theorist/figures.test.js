import { describe, it, expect } from 'vitest';
import { solveFigures, measureFigures, seenOn, figureClear, FIGURE_MIN, FIGURE_PAIR, HUE_KEEP, FIGURE_LAWS, AGAINST_GAP } from './figures.js';
import { solvePalette } from './solve.js';
import { hexToRgb, rgbToHex, oklch, lchOf, hueGap, deltaE } from './oklab.js';

// a green land, and a palette whose two accents the solver places itself
const LAND = [{ what: 'ground', hex: '#8a974e' }, { what: 'foliage', hex: '#628741' }];
const K = solvePalette({ seed: 11, hue: 125, scheme: 'complementary', key: 'high' });
const hue = (h) => lchOf(hexToRgb(h))[2], law = (R, id) => R.laws.find((l) => l.law === id);

describe('figures on a ground', () => {
  it('a figure in the land\'s own green sinks, and is said to: measured, nothing moved', () => {
    const R = measureFigures({ against: LAND, figures: [{ id: 'kin', hex: '#7f9148', keep: 'hue' }] });
    expect(R.figures[0]).toMatchObject({ id: 'kin', hex: '#7f9148', moved: 0 });
    expect(R.figures[0].was).toBeUndefined();
    expect(R.figures[0].clear).toBeLessThan(FIGURE_MIN);
    expect(law(R, 'figures-clear').ok).toBe(false);
    expect(law(R, 'figures-clear').value).toMatch(/kin .* from the ground/);
  });

  it('solved, it parts from the land inside its own hue family, by the least it must move', () => {
    const was = '#7f9148', R = solveFigures({ against: LAND, figures: [{ id: 'kin', hex: was, keep: 'hue' }] }), f = R.figures[0];
    expect(f.was).toBe(was);
    expect(f.clear).toBeGreaterThanOrEqual(FIGURE_MIN);
    expect(hueGap(hue(f.hex), hue(was))).toBeLessThanOrEqual(HUE_KEEP + 2);
    expect(f.turned).toBeLessThanOrEqual(HUE_KEEP);
    expect(R.laws.every((l) => l.ok)).toBe(true);
    // (free of its family it could go anywhere; kept in it, it goes no further than a free one must)
    const free = solveFigures({ against: LAND, figures: [{ id: 'kin', hex: was, keep: 'free' }] }).figures[0];
    expect(free.clear).toBeGreaterThanOrEqual(FIGURE_MIN);
    expect(solveFigures({ against: LAND, figures: [{ id: 'kin', hex: was, keep: 'hue' }] })).toEqual(R);
  });

  it('a figure already clear is left as it is, and one kept in its colour is never moved', () => {
    // (a pale cream on a mid green parts by value, for every eye)
    const clear = solveFigures({ against: LAND, figures: [{ id: 'a', hex: '#efe8d4', keep: 'hue' }] }).figures[0];
    expect(clear).toMatchObject({ hex: '#efe8d4', moved: 0 });
    const kept = solveFigures({ against: LAND, figures: [{ id: 'a', hex: '#7f9148', keep: 'colour' }] });
    expect(kept.figures[0]).toMatchObject({ hex: '#7f9148', moved: 0 });
    expect(law(kept, 'figures-clear').ok).toBe(false);
    // a colour named with no `keep` is the creator's: kept
    expect(solveFigures({ against: LAND, figures: [{ id: 'a', hex: '#7f9148' }] }).figures[0].moved).toBe(0);
  });

  it('figures are painted clear of each other, in their order, and none louder than the protagonist', () => {
    const R = solveFigures({ against: LAND, figures: [{ id: 'hero', hex: '#3a80d0', protagonist: true }, { id: 'a', hex: '#3a80d0', keep: 'hue' }, { id: 'b', hex: '#7f9148', keep: 'hue' }, { id: 'c', hex: '#7f9148', keep: 'hue' }] });
    const [hero, a, b, c] = R.figures, d = (x, y) => deltaE(hexToRgb(x.hex), hexToRgb(y.hex));
    expect(hero.moved).toBe(0);
    for (const [x, y] of [[hero, a], [b, c], [a, b]]) expect(d(x, y)).toBeGreaterThanOrEqual(FIGURE_PAIR * 0.99);
    expect(law(R, 'figures-apart').ok).toBe(true);
    expect(law(R, 'protagonist-leads')).toMatchObject({ ok: true, value: 'hero' });
    const C = (f) => lchOf(hexToRgb(f.hex))[1];
    for (const f of [a, b, c]) expect(C(f)).toBeLessThanOrEqual(C(hero) + 0.011);
  });

  it('a figure wears a role: the palette\'s, or the protagonist\'s complement where the two accents are neighbours', () => {
    const mid = (r) => r[Math.floor(r.length / 2)], a2 = mid(K.roles.accent2);
    // far from the protagonist: the second accent's own hue
    const away = rgbToHex(oklch(0.55, 0.12, hue(a2) + 150));
    const far = solveFigures({ palette: K, figures: [{ id: 'hero', hex: away, keep: 'colour', protagonist: true }, { id: 'mark', wear: 'accent2' }] }).figures[1];
    expect(far.wear).toBe('accent2');
    expect(hueGap(hue(far.hex), hue(a2))).toBeLessThanOrEqual(HUE_KEEP + 2);
    // a grey protagonist has no hue to stand against: the second accent is worn, and nothing can be worn against it
    expect(solveFigures({ palette: K, figures: [{ id: 'hero', hex: '#808080', keep: 'colour', protagonist: true }, { id: 'mark', wear: 'accent2' }] }).figures[1].wear).toBe('accent2');
    expect(() => solveFigures({ palette: K, figures: [{ id: 'hero', hex: '#808080', protagonist: true }, { id: 'mark', wear: 'against' }] })).toThrow(/a colour with a hue/);
    // a protagonist in the second accent's own colour: the mark goes opposite it
    const near = solveFigures({ palette: K, figures: [{ id: 'hero', hex: a2, keep: 'colour', protagonist: true }, { id: 'mark', wear: 'accent2' }] }).figures[1];
    expect(near.wear).toBe('against');
    expect(hueGap(hue(near.hex), hue(a2))).toBeGreaterThan(180 - HUE_KEEP - AGAINST_GAP / 2);
    expect(() => solveFigures({ palette: K, figures: [{ id: 'mark', wear: 'against' }] })).toThrow(/against a protagonist/);
    expect(() => solveFigures({ against: LAND, figures: [{ id: 'mark', wear: 'accent2' }] })).toThrow(/give the palette/);
  });

  it('a figure is put in a colour given it, then kept as its keep says', () => {
    const R = solveFigures({ against: LAND, figures: [{ id: 'hero', hex: '#7f9148', wear: '#3A80D0', keep: 'hue', protagonist: true }] }).figures[0];
    expect(R.was).toBe('#7f9148');
    expect(hueGap(hue(R.hex), hue('#3a80d0'))).toBeLessThanOrEqual(HUE_KEEP + 2);
    expect(R.clear).toBeGreaterThanOrEqual(FIGURE_MIN);
    expect(measureFigures({ against: LAND, figures: [{ id: 'hero', hex: '#7f9148', wear: '#3a80d0' }] }).figures[0].hex).toBe('#7f9148');
    expect(() => solveFigures({ against: LAND, figures: [{ id: 'a', wear: 'blue' }] })).toThrow(/a role a figure wears/);
  });

  it('one that names a colour and what it wears is measured in the colour it has and solved into what it wears', () => {
    const order = { palette: K, figures: [{ id: 'mark', hex: '#d9d2bd', wear: 'accent2' }] };
    expect(measureFigures(order).figures[0]).toMatchObject({ hex: '#d9d2bd', moved: 0 });
    const S = solveFigures(order).figures[0];
    expect(S.was).toBe('#d9d2bd');
    expect(S.hex).not.toBe('#d9d2bd');
  });

  it('reads what a figure is seen on off a palette, and says what is wrong with an order', () => {
    const on = seenOn(K);
    expect(on.map((a) => a.what)).toEqual(['ground', 'foliage', 'soil', 'rock']);
    expect(on[0].min).toBeGreaterThan(on[2].min);
    expect(figureClear(on[0].hex, on)).toMatchObject({ clear: 0, nearest: 'ground' });
    expect(FIGURE_LAWS.map((l) => l.law)).toEqual(solveFigures({ against: LAND, figures: [{ id: 'a', hex: '#3a80d0' }] }).laws.map((l) => l.law));
    expect(() => solveFigures({ against: LAND, figures: [] })).toThrow(/figures is a list/);
    expect(() => solveFigures({ against: LAND, figures: [{ id: 'a' }] })).toThrow(/a colour \(hex\) or a role/);
    expect(() => solveFigures({ against: LAND, figures: [{ id: 'a', hex: '#3a80d0' }, { id: 'a', hex: '#3a80d0' }] })).toThrow(/appears twice/);
    expect(() => solveFigures({ against: LAND, figures: [{ id: 'a', hex: '#3a80d0', keep: 'shape' }] })).toThrow(/how much of it may move/);
    expect(() => solveFigures({ figures: [{ id: 'a', hex: '#3a80d0' }] })).toThrow(/against is a list/);
  });
});
