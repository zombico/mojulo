import { describe, it, expect } from 'vitest';
import { crystalOptics, crystalIndex, crystalPolytope, opticalClass, wavelengthRgb, CRYSTAL_GEMS } from './crystal-optics.js';
import { planeNormal } from './rock-minerals.js';

const DEG = Math.PI / 180;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('crystal-optics: indices (literature Sellmeier sets at the D line)', () => {
  it.each([
    ['quartz', 'o', 1.5442], ['quartz', 'e', 1.5533], ['calcite', 'o', 1.6583], ['calcite', 'e', 1.4861],
    ['diamond', 'o', 2.4173], ['ruby', 'o', 1.7681], ['ruby', 'e', 1.76],
  ])('%s n_%s = %f', (gem, ray, want) => { expect(crystalIndex(gem, ray, 589.3)).toBeCloseTo(want, 3); });
  it("diamond's fire: B–G dispersion 0.044, critical angle 24.4°", () => {
    expect(crystalIndex('diamond', 'o', 430.8) - crystalIndex('diamond', 'o', 686.7)).toBeCloseTo(0.0444, 3);
    expect(Math.asin(1 / crystalIndex('diamond', 'o', 589.3)) / DEG).toBeCloseTo(24.44, 1);
  });
  it('three-band indices are ordered by wavelength (normal dispersion) and the Abbe numbers are the gems\'', () => {
    for (const g of CRYSTAL_GEMS) { const { n } = crystalOptics(g); expect(n.o[0]).toBeLessThan(n.o[2]); }
    expect(crystalOptics('diamond').abbe).toBeCloseTo(55.3, 0);
    expect(crystalOptics('quartz').abbe).toBeCloseTo(69.1, 0);
  });
});

describe("crystal-optics: Neumann's principle — the point group fixes the optical class", () => {
  it.each([['m-3m', 'isotropic'], ['32', 'uniaxial'], ['-3m', 'uniaxial'], ['3m', 'uniaxial'], ['mmm', 'biaxial'], ['2/m', 'biaxial'], ['-1', 'biaxial']])('%s → %s', (g, cls) => {
    expect(opticalClass(g)).toBe(cls);
  });
  it('the gems inherit it', () => {
    expect(crystalOptics('diamond').opticalClass).toBe('isotropic');
    expect(crystalOptics('ruby').opticalClass).toBe('uniaxial');
    expect(crystalOptics('tourmaline').opticalClass).toBe('uniaxial');
  });
});

describe('crystal-optics: the double image is the rhomb angle times the index pair', () => {
  it("calcite's walk-off at normal incidence on its cleavage face is 6.24°", () => {
    const n = planeNormal({ a: 4.99, c: 17.062, gamma: 120 }, [1, 0, -1, 4]); const thK = Math.acos(Math.abs(n[2]));
    const no = crystalIndex('calcite', 'o', 589.3), ne = crystalIndex('calcite', 'e', 589.3);
    expect(thK / DEG).toBeCloseTo(44.63, 1);
    expect((Math.atan((no / ne) ** 2 * Math.tan(thK)) - thK) / DEG).toBeCloseTo(6.24, 1);
  });
});

describe('crystal-optics: shapes are exact polytopes', () => {
  it('diamond: the {111} octahedron', () => {
    const p = crystalPolytope('diamond'); expect(p.faces).toHaveLength(8);
    for (const n of p.normals) expect(Math.abs(n[0] * n[1] * n[2]) * 3 * Math.sqrt(3)).toBeCloseTo(1, 6);
  });
  it("calcite: the cleavage rhomb, faces at 74.95° / 105.05°", () => {
    const p = crystalPolytope('calcite'); expect(p.faces).toHaveLength(6);
    const cos = new Set(); for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) { const c = Math.abs(dot(p.normals[i], p.normals[j])); if (c < 0.99) cos.add(c.toFixed(3)); }
    expect([...cos]).toEqual([Math.cos(74.95 * DEG).toFixed(3)]);
  });
  it('quartz: 18 faces (prism + two rhombs); tourmaline: a trigonal {10‾10} (3 faces)', () => {
    expect(crystalPolytope('quartz').faces).toHaveLength(18);
    expect(crystalPolytope('tourmaline').forms.filter((f) => f === '10-10')).toHaveLength(3);
  });
  it('the round brilliant has 57 facets above and below its girdle', () => {
    expect(crystalPolytope('diamond', { cut: 'brilliant' }).forms.filter((f) => f !== 'girdle')).toHaveLength(57);
  });
  it('opal, with no habit, is cut as a cabochon; every shape is centred and sized', () => {
    const p = crystalPolytope('opal', { size: 2 }); expect(p.cut).toBe('cabochon');
    for (const g of CRYSTAL_GEMS) { const q = crystalPolytope(g, { size: 2 }); const ext = [0, 1, 2].map((k) => Math.max(...q.vertices.map((v) => v[k])) - Math.min(...q.vertices.map((v) => v[k])));
      expect(Math.max(...ext)).toBeCloseTo(2, 9); for (const v of q.vertices) for (const pl of q.planes) expect(dot(pl.n, v)).toBeLessThanOrEqual(pl.d + 1e-6); }
  });
  it('teaches on a bad gem or cut', () => {
    expect(() => crystalPolytope('jade')).toThrow(/unknown gem 'jade' \(have quartz/);
    expect(() => crystalPolytope('ruby', { cut: 'emerald' })).toThrow(/one of natural, brilliant, cabochon/);
  });
});

describe('crystal-optics: colour is a function of path', () => {
  const at = (g, ray, i) => crystalOptics(g).colour[ray][i];
  it('ruby: red when thick; a thin ruby keeps more of its blue window (pink)', () => {
    const thick = at('ruby', 'o', 3), thin = at('ruby', 'o', 0);
    expect(thick[0]).toBeGreaterThan(thick[1] * 5); expect(thick[0]).toBeGreaterThan(thick[2] * 2);
    expect(thin[2] / thin[0]).toBeGreaterThan(thick[2] / thick[0]);
  });
  it('tourmaline: the ordinary ray is dark, the extraordinary green (a natural polarizer)', () => {
    expect(Math.max(...at('tourmaline', 'o', 2))).toBeLessThan(0.02);
    const e = at('tourmaline', 'e', 1); expect(e[1]).toBeGreaterThan(e[0]); expect(e[1]).toBeGreaterThan(e[2]);
  });
  it('amethyst is purple; rock crystal and diamond stay clear', () => {
    const a = at('amethyst', 'o', 2); expect(a[0]).toBeGreaterThan(a[1]); expect(a[2]).toBeGreaterThan(a[1]);
    for (const g of ['quartz', 'diamond']) for (const c of at(g, 'o', 3)) expect(c).toBeCloseTo(1, 6);
  });
});

describe('crystal-optics: glow and structural colour', () => {
  it("ruby glows at its R lines: deep red, a real share of the absorbed light", () => {
    const { glow } = crystalOptics('ruby'); expect(glow.rgb[0]).toBe(1); expect(glow.rgb[1]).toBeLessThan(0.05);
    expect(glow.strength).toBeGreaterThan(0.2); expect(glow.strength).toBeLessThan(0.7);
    expect(crystalOptics('quartz').glow).toBeNull();
  });
  it("opal: a 245 nm sphere lattice reflects 568 nm at normal incidence (λ = 2·d₁₁₁·n_eff)", () => {
    const { photonic } = crystalOptics('opal'); expect(2 * 245 * Math.sqrt(2 / 3) * photonic.nEff).toBeCloseTo(568, 0);
    expect(photonic.d111[0]).toBeCloseTo(163.3, 1);
  });
  it('wavelengthRgb: 694 nm is red, 532 nm green', () => {
    const r = wavelengthRgb(694), g = wavelengthRgb(532); expect(r[0]).toBe(1); expect(r[1]).toBeLessThan(0.05); expect(g[1]).toBe(1);
  });
  it('resolves once and is frozen', () => { expect(crystalOptics('ruby')).toBe(crystalOptics('ruby')); expect(Object.isFrozen(crystalOptics('ruby'))).toBe(true); });
});
