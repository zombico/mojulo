// The catalog's glass read as a pane (glazing.js), and the air and floor entries a utilitarian room is built from.
import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog.js';
import { glassLook, GLASSES } from './glazing.js';

describe('glass as a pane', () => {
  it('every glass is well formed: what it lets through and what it reflects leave something for what it absorbs', () => {
    expect(GLASSES.length).toBeGreaterThan(1);
    for (const k of GLASSES) { const g = CATALOG[k]; expect(g.tv + g.rv, k).toBeLessThanOrEqual(1); expect(g.mm, k).toBeGreaterThan(0); }
  });
  it('a pane takes from the view what the glass does: a frosted one most, a low-iron one least and least tinted', () => {
    const clear = glassLook('glass:float-6'), low = glassLook('glass:low-iron-10'), frosted = glassLook('glass:acid-etched-6');
    expect(frosted.alpha).toBeGreaterThan(clear.alpha);
    expect(low.alpha).toBeLessThan(clear.alpha);
    const sat = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return Math.max(...c) - Math.min(...c); };
    expect(sat(low.fill)).toBeLessThan(sat(clear.fill));
    expect(clear.f0).toBeCloseTo(0.04, 2);
    expect(glassLook('board:gypsum-12.7')).toBeNull();
  });
});

describe('air and floors in the catalog', () => {
  it('a duct is round or rectangular, a terminal has a face, a floor unit a size', () => {
    const of = (kind) => Object.entries(CATALOG).filter(([, e]) => e.kind === kind);
    for (const [k, d] of of('duct')) expect(!!d.dia !== !!d.size, k).toBe(true);
    for (const kind of ['diffuser', 'grille', 'louvre']) for (const [k, t] of of(kind)) expect(t.size || t.dia, k).toBeTruthy();
    for (const [k, f] of of('floor')) expect(f.sheet.every((v) => v > 0), k).toBe(true);
  });
});
