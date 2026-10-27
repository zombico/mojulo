import { describe, expect, it } from 'vitest';

import { titleMaterial, titleMaterialName } from './title-material.js';
import { METALS } from '../materials/metal-surface.js';
import { MATERIALS } from '../polygonizer/materials.js';

// ── title-material: what a carved title's letters are made of ──
// The concept: a word resolves to a measured metal (its own name or an alias, or the shelf's metal row it reads as) or
// to a shelf finish (an alias of one too); a metal bakes as the studio sweep's stops, three hard bands when cel; a finish
// as its shelf row's shade and colour; anything else is no material at all. One case per path, picked from the tables.

const metal = Object.keys(METALS).find((m) => !Object.hasOwn(MATERIALS, m));   // a metal only the measured table holds
const finish = Object.keys(MATERIALS).find((k) => !MATERIALS[k].metal && MATERIALS[k].cel);

describe('title-material — the word', () => {
  it('a measured metal by name or alias, a shelf metal row by the metal it reads as, a shelf finish by name or alias', () => {
    expect(titleMaterialName(metal)).toBe(metal);
    expect(titleMaterialName(' Chromium ')).toBe('chrome');   // a metal alias, any case
    expect(titleMaterialName('gunmetal')).toBe('steel');      // the shelf's metal the measured table lacks
    expect(titleMaterialName(finish)).toBe(finish);
    expect(titleMaterialName('marble')).toBe('stone');        // a finish alias
  });
  it('anything else is no material', () => {
    for (const w of ['plasma', '', '   ', 'constructor', null, 7, {}]) expect(titleMaterialName(w)).toBeNull();
    expect(titleMaterial('plasma')).toBeNull();
  });
});

describe('title-material — what the page bakes', () => {
  it('a metal is its sweep top to bottom, its middle the hex its edges darken from; cel stops it in three hard bands', () => {
    const m = titleMaterial(metal);
    expect(m.metal).toBe(metal);
    expect(m.stops[0][0]).toBe(0); expect(m.stops.at(-1)[0]).toBe(1);
    expect(new Set(m.stops.map(([, h]) => h)).size).toBeGreaterThan(3);   // a sweep, not a flat colour
    expect(m.hex).toMatch(/^#[0-9a-f]{6}$/);
    const cel = titleMaterial(metal, { cel: true });
    expect(new Set(cel.stops.map(([, h]) => h)).size).toBe(3);
    const hard = cel.stops.filter(([o], i) => i > 0 && cel.stops[i - 1][0] === o);
    expect(hard).toHaveLength(2);   // two offsets carry two colours each: the bands' edges are hard
  });
  it('a finish is its shelf row\'s shade and colour, nothing the row lacks', () => {
    const f = titleMaterial(finish);
    expect(f.base).toBe(MATERIALS[finish].base);
    expect(f.shade.cel).toBe(MATERIALS[finish].cel);
    expect(Object.values(f.shade).every((v) => v !== undefined && v !== 0)).toBe(true);
    expect(titleMaterial('glass').shade.opacity).toBe(MATERIALS.glass.opacity);
  });
  it('the same word bakes the same bytes', () => {
    expect(JSON.stringify(titleMaterial('gold', { cel: true }))).toBe(JSON.stringify(titleMaterial('gold', { cel: true })));
  });
});
