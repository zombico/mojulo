// The townhouse traditions, contemporary (floorplan-styles.js brownstone, terrace, canal, kyosho; architecture/roof.js
// cornice, terrace-slate, canal-gable, galvalume-shed; the stone, render and board facades): a London terrace's ridge
// runs with the street and its gables stand on the party walls, a Dutch house's gable faces the street; a house of
// look 2 rolls its family from its form and tradition while a house of the first look rolls as it always did; each new
// material dresses the facade.
import { describe, expect, it } from 'vitest';
import { roofPlanes, buildRoof } from '../architecture/roof.js';
import { houseStyleOpts, houseStyleKey, FAMILY_BY } from './floorplan-styles.js';
import { structurizeFloorplan } from './floorplan-structure.js';
import { makeLight } from './vexar.js';

// a townhouse's deep footprint: the street along its short (x) side
const DEEP = { x: 0, y: 0, w: 20, d: 44, z: 30 };
const gableAxis = (style) => {
  const g = roofPlanes(DEEP, { style }).gables[0];
  // (a gable is a wall: its corners share x on a side wall, y on the street or garden wall)
  return g.every((c) => Math.abs(c[0] - g[0][0]) < 1e-6) ? 'side' : g.every((c) => Math.abs(c[1] - g[0][1]) < 1e-6) ? 'street' : 'neither';
};

describe('the traditions\' roofs', () => {
  it('a terrace\'s gables on its party walls (its ridge with the street); a canal house\'s gable to the street', () => {
    expect(gableAxis('terrace-slate')).toBe('side');
    expect(gableAxis('canal-gable')).toBe('street');
  });

  it('a brownstone\'s cornice crowns a flat roof with no railing', () => {
    const light = makeLight({ direction: [0.3, 0.4, -0.85] });
    const cornice = buildRoof(DEEP, { style: 'cornice', light }).faces, deck = buildRoof(DEEP, { style: 'tofu-deck', light }).faces;
    expect(cornice.length).toBeGreaterThan(0);
    expect(cornice.length).toBeLessThan(deck.length);   // (no posts, rails or pergola)
  });
});

describe('the family a house rolls', () => {
  it('look 2: by form and tradition; the first look: from its five, as always', () => {
    const keys = Array.from({ length: 8 }, (_, i) => houseStyleKey({ seed: i + 1 }));
    for (const [form, byTradition] of Object.entries(FAMILY_BY)) for (const [tradition, list] of Object.entries(byTradition)) {
      for (const key of keys.slice(0, 3)) expect(list).toContain(houseStyleOpts('auto', key, 'interior', { look: 2, form, tradition }).styleName);
    }
    const first = new Set(keys.map((k) => houseStyleOpts('auto', k, 'interior').styleName));
    for (const name of first) expect(['cottage', 'brick', 'modern', 'tofu', 'mission']).toContain(name);
  });
});

describe('the new facades', () => {
  it('stone, render and boards each dress the outside walls', () => {
    const H = { seed: 3, width: 30, height: 24, windows: true };
    const skins = (facadeStyle) => structurizeFloorplan(H, { facadeDecor: true, facadeStyle }).faces.filter((f) => f.group === 'facade:skin');
    const fills = (fs) => new Set(fs.map((f) => f.fill));
    const brick = fills(skins('brick'));
    for (const style of ['stone', 'render', 'boards']) {
      const own = skins(style);
      expect(own.length, style).toBeGreaterThan(0);
      expect([...fills(own)].some((f) => !brick.has(f)), style).toBe(true);
    }
  });
});
