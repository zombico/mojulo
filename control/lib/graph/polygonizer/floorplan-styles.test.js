/**
 * House styles — the machine gate: a style is a seeded bundle of existing knobs (floorplan-
 * styles.js). No style is the same bytes; 'auto' spreads new houses across the families and is
 * deterministic per seed; the manifest's own keys win; the roof is the exterior's; the furniture
 * wears the style's palette; new mints are stamped 'auto' and old rows are not touched.
 */
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { mintSketch } from '@/lib/mcp/tools/sketch-mint.js';
import { houseStyleOpts, houseStyleKey, HOUSE_STYLE_NAMES } from './floorplan-styles.js';
import { structurizeFloorplan, structurizeHouse } from './floorplan-structure.js';
import { recolorManifest } from '../architecture/room-assets.js';

const sha = (faces) => createHash('sha256').update(JSON.stringify(faces)).digest('hex');
const HOUSE = { seed: 7, width: 40, height: 30 };
const fills = (s) => new Set(s.faces.map((f) => f.fill).filter(Boolean));

describe('house styles', () => {
  it('no style (absent or null) is the same bytes as before styles', () => {
    const plain = structurizeFloorplan(HOUSE, { furnish: true });
    expect(sha(structurizeFloorplan({ ...HOUSE, style: null }, { furnish: true }).faces)).toBe(sha(plain.faces));
    expect(houseStyleOpts(undefined, 'k')).toEqual({});
  });

  it("'auto' spreads seeds across the families, and one seed is always the same house", () => {
    const names = new Set();
    for (let seed = 1; seed <= 40; seed += 1) names.add(houseStyleOpts('auto', houseStyleKey({ seed })).styleName);
    expect(names.size).toBeGreaterThanOrEqual(4);
    const a = structurizeFloorplan({ ...HOUSE, style: 'auto' }, { furnish: true });
    const b = structurizeFloorplan({ ...HOUSE, style: 'auto' }, { furnish: true });
    expect(sha(a.faces)).toBe(sha(b.faces));
  });

  it('variants within a family differ by seed', () => {
    const tints = new Set();
    for (let seed = 1; seed <= 12; seed += 1) tints.add(houseStyleOpts('brick', houseStyleKey({ seed })).brickBodyTint);
    expect(tints.size).toBeGreaterThan(1);
  });

  it('every family dresses the house: facade, walls, floors and furniture change', () => {
    const plain = fills(structurizeFloorplan(HOUSE, { furnish: true }));
    for (const style of HOUSE_STYLE_NAMES) {
      const styled = structurizeFloorplan({ ...HOUSE, style }, { furnish: true });
      const fresh = [...fills(styled)].filter((f) => !plain.has(f));
      expect(fresh.length, style).toBeGreaterThan(10);
    }
  });

  it("the manifest's own keys win over the style's", () => {
    const o = { ...houseStyleOpts('brick', 'k'), brickBodyTint: '#123456' };
    expect(o.facadeStyle).toBe('brick');
    const s = structurizeFloorplan({ ...HOUSE, style: 'brick' }, { furnish: true, brickBodyTint: '#123456', facadeStyle: 'siding' });
    const t = structurizeFloorplan({ ...HOUSE, style: 'brick' }, { furnish: true });
    expect(sha(s.faces)).not.toBe(sha(t.faces));                    // siding, as the manifest says
  });

  it('a style roofs the exterior view only; the cutaway stays open', () => {
    expect(houseStyleOpts('tofu', 'k', 'cutaway').roof).toBeUndefined();
    expect(['tofu-deck', 'tofu-stacked']).toContain(houseStyleOpts('tofu', 'k', 'exterior').roof);
  });

  it('an unknown style refuses, naming the families', () => {
    expect(() => houseStyleOpts('gothic', 'k')).toThrow(/unknown house style 'gothic'.*brick/);
  });

  it('a stacked house resolves its style once, for every storey', () => {
    const input = { seed: 5, style: 'modern', levels: [{ role: 'ground' }, { role: 'upper' }], stairs: true };
    const h = structurizeHouse(input, { ...input, furnish: true });
    const plain = structurizeHouse({ ...input, style: undefined }, { ...input, style: undefined, furnish: true });
    expect(sha(h.faces)).not.toBe(sha(plain.faces));
    const again = structurizeHouse(input, { ...input, furnish: true });
    expect(sha(again.faces)).toBe(sha(h.faces));
  });
});

describe('furnishing finish', () => {
  it('recolors by family and keeps the light and dark parts', () => {
    const m = { lathes: [{ tint: '#9a6a3d' }, { tint: '#5e3d26' }], extrudes: [{ tint: '#2b2724' }, { tint: '#6b7f8e' }] };
    const r = recolorManifest(m, { wood: '#c2a67c', upholstery: '#3a3d42' });
    expect(r.lathes[0].tint).toBe('#c2a67c');                        // the reference tint maps onto the finish
    expect(r.lathes[1].tint).not.toBe('#5e3d26');                    // a darker wood stays darker
    expect(parseInt(r.lathes[1].tint.slice(1, 3), 16)).toBeLessThan(0xc2);
    expect(r.extrudes[0].tint).toBe('#2b2724');                      // black metal is not a family
    expect(r.extrudes[1].tint).toBe('#3a3d42');
    expect(recolorManifest(m, {})).toEqual(m);
  });

  it("a styled house's furniture meshes wear the style's palette", () => {
    const meshFills = (s) => new Set(s.faces.filter((f) => (f.group || '').startsWith('asset:')).map((f) => f.fill));
    const share = { furnish: true, furnishScale: 'share' };
    const plain = meshFills(structurizeFloorplan(HOUSE, share));
    const styled = meshFills(structurizeFloorplan({ ...HOUSE, style: 'tofu' }, share));
    expect(plain.size).toBeGreaterThan(0);
    expect([...styled].filter((f) => !plain.has(f)).length).toBeGreaterThan(20);
  });
});

describe('minting', () => {
  it("a new house is stamped style 'auto'; null opts out; an unknown style refuses", () => {
    const a = mintSketch({ title: 'h1', manifest: { kind: 'floorplan', title: 'h', seed: 3 } });
    expect(SketchRepository.getByRef(a.ref).manifest.style).toBe('auto');
    const b = mintSketch({ title: 'h2', manifest: { kind: 'floorplan', title: 'h', seed: 3, style: null } });
    expect(SketchRepository.getByRef(b.ref).manifest.style).toBeNull();
    expect(() => mintSketch({ title: 'h3', manifest: { kind: 'floorplan', title: 'h', seed: 3, style: 'gothic' } })).toThrow(/unknown house style/);
  });
});
