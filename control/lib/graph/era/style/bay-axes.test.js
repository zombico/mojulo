// The bay axes (bay-axes.js, composed by bay-kits.js): a register is its preset on each axis, and the axes compose apart:
// one register's construction in another's palette, light and dressing.
import { describe, expect, it } from 'vitest';
import { CONSTRUCTIONS, PALETTES, PLOTS, DRESSINGS, REGISTER_PRESETS } from './bay-axes.js';
import { bayKit, bayKitOf, composeRegister } from './bay-kits.js';

const ids = Object.keys(REGISTER_PRESETS);
// (two registers whose constructions differ in their variants' count, so a palette's swatches go round)
const [a, b] = [...ids].sort((x, y) => CONSTRUCTIONS[y].surfaces.floor.length - CONSTRUCTIONS[x].surfaces.floor.length);

describe('the bay axes', () => {
  it('a register is its preset on every axis', () => {
    const r = ids[0];
    expect(JSON.stringify(bayKitOf(REGISTER_PRESETS[r]))).toBe(JSON.stringify(bayKit(r)));
    for (const T of [CONSTRUCTIONS, PALETTES, PLOTS, DRESSINGS]) expect(Object.keys(T)).toEqual(ids);
  });

  it('one register\'s construction in another\'s palette: the materials the first\'s, the colours the second\'s, round again', () => {
    const R = composeRegister({ construction: a, palette: b, plot: b, dressing: b });
    const floors = R.options.floor, sw = PALETTES[b].floor;
    expect(floors.length).toBe(CONSTRUCTIONS[a].surfaces.floor.length);
    expect(floors.length).toBeGreaterThan(sw.length);
    // the variant past the palette's swatches takes the first again: the same colour on its own material
    expect(R.tiles[floors[sw.length]].family).not.toBe(R.tiles[floors[0]].family);
    expect(R.light).toBe(PLOTS[b].light);
    // the kit builds from it
    expect(bayKitOf({ construction: a, palette: b, plot: b, dressing: b }).B.roofs).toEqual(CONSTRUCTIONS[a].roofs);
  });

  it('every palette colours every role a construction paints, so any palette goes on any construction', () => {
    const painted = new Set(Object.values(CONSTRUCTIONS).flatMap((C) => Object.entries(C.surfaces).filter(([, ms]) => ms.some((x) => x.dressed)).map(([role]) => role)));
    for (const [id, P] of Object.entries(PALETTES)) for (const role of painted) {
      expect(P[role]?.length, `${id}.${role}`).toBeGreaterThan(0);
      // (and each swatch gives a dressed cut a face: its own, or the one its catalog material lends)
      for (const sw of P[role]) expect(sw.stone ?? sw.own, `${id}.${role}`).toBeDefined();
    }
  });

  it('an axis left out, or a value its table does not hold, is refused by name', () => {
    expect(() => composeRegister({ construction: a, palette: a, plot: a })).toThrow(/dressing 'undefined' is not one/);
    expect(() => composeRegister({ construction: 'tavern', palette: a, plot: a, dressing: a })).toThrow(/construction 'tavern'/);
  });
});
