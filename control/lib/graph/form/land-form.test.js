// The land read as material (land-form.js): a face's base colour comes from what it is (its group), never from its
// fill, which holds gen-6's light; the sand at the water's line is wet, under it lost by depth into deep water's colour.
import { describe, expect, it } from 'vitest';
import { landForm, WET_ROUGH, LAND_CLASSES } from './land-form.js';

const COLOUR = { stone: '#e2cba0', floor: '#c4875a', grass: '#7cbf48', water: '#3a9cc6', sand: '#e6d3a4' };
const quad = (group, x, z, fill = '#808080') => ({ group, fill, corners: [[x, 0, z], [x + 1, 0, z], [x + 1, 1, z], [x, 1, z]] });
// a sea at 0, a beach rising out of it, a cliff behind
const SHORE = [quad('isekai:water', 0, 0), quad('isekai:sand', 0, -2), quad('isekai:sand', 1, -0.5), quad('isekai:sand', 2, 0.1), quad('isekai:sand', 3, 1), quad('isekai:cliff', 4, 3)];

describe('the land as material', () => {
  it('a face\'s colour is its class\'s and its place\'s, whatever its fill: the light the fill held is not read', () => {
    const lit = landForm(SHORE, COLOUR), dark = landForm(SHORE.map((f) => ({ ...f, fill: '#101010' })), COLOUR);
    expect(dark).toEqual(lit);
    expect(landForm(SHORE, COLOUR)).toEqual(lit);   // (seeded: the same land, the same material)
    expect(lit.faces.map((f) => f.cls)).toEqual(['water', 'sand', 'sand', 'sand', 'sand', 'cliff']);
    expect(lit.faces[5].rough).toBe(LAND_CLASSES.cliff.rough);
    // the cliff takes the stone's hue: its channels in the stone's order
    const [r, g, b] = lit.faces[5].base; expect(r > g && g > b).toBe(true);
  });

  it('sand under the sea is lost by depth, at its line it is wet (darker, glossy), above the band dry', () => {
    const { faces, waterZ, deep } = landForm(SHORE, COLOUR);
    expect(waterZ).toBe(0);
    const [, deepest, shallow, line, dry] = faces;
    expect([deepest.under, shallow.under, line.under, dry.under]).toEqual([true, true, false, false]);
    expect([line.wet, dry.wet]).toEqual([true, false]);
    expect(line.rough).toBe(WET_ROUGH);
    expect(line.base[0]).toBeLessThan(dry.base[0]);
    // two metres down is nearer deep water's colour than half a metre
    const off = (f) => Math.hypot(...f.base.map((v, k) => v - deep[k]));
    expect(off(deepest)).toBeLessThan(off(shallow));
  });

  it('a group it has no class for keeps its fill and is counted; the cube\'s colours are asked for', () => {
    const R = landForm([...SHORE, { group: 'town:roof', fill: '#aa3322', corners: [[0, 0, 5], [1, 0, 5], [1, 1, 5]] }], COLOUR);
    expect(R.unread).toBe(1);
    expect(R.faces[6]).toEqual({ cls: null });
    expect(() => landForm(SHORE, { ...COLOUR, sand: 'beige' })).toThrow(/colour\.sand is a #rrggbb/);
  });
});
