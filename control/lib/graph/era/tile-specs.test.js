import { describe, it, expect } from 'vitest';
import { normalizeTileSpec, tileFamilyOf, TILE_RAILS } from './tile-specs.js';
import { planStage, assembleStageScene } from './stage.js';
import { resolveWorldScene } from '../worlds/world-scene.js';

const WALL = { gen: 'stone-brick', stone: [182, 170, 148], mortar: [96, 90, 80], rows: 5, cols: 3, bevel: 0.24 };
const FLOOR = { gen: 'flagstone', stone: [120, 110, 96], mortar: [50, 46, 40], cells: 4, cracked: 0.35 };
const ROOM = { kind: 'stage', kit: 'gothic-stone', rooms: [{ id: 'a', x: 0, y: 0, w: 8, d: 8, h: 5 }] };
const world = (manifest) => resolveWorldScene({ ref: 'sk_tiles_test', title: 'tiles', manifest }).then((r) => r.payload);

describe('tile specs: the rails', () => {
  it('refuses what is outside them, naming the range or the list', () => {
    expect(() => normalizeTileSpec({ ...WALL, rows: 40 })).toThrow(/rows: an integer from 3 to 12/);
    expect(() => normalizeTileSpec({ ...WALL, rows: 4.5 })).toThrow(/integer/);
    expect(() => normalizeTileSpec({ ...WALL, stone: [300, 0, 0] })).toThrow(/0–255/);
    expect(() => normalizeTileSpec({ ...WALL, shine: 1 })).toThrow(/not a stone-brick setting/);
    expect(() => normalizeTileSpec({ gen: 'stone-brick', stone: [1, 2, 3] })).toThrow(/mortar: required/);
    expect(() => normalizeTileSpec({ gen: 'plasma' })).toThrow(/one of stone-brick, flagstone, wood, rock/);
    expect(() => normalizeTileSpec({ gen: 'rock', base: [90, 90, 90], style: 'chalk' })).toThrow(/one of cave/);
  });

  it('names a family from its numbers: same numbers, same tiles; any number changed, new tiles', () => {
    const shuffled = Object.fromEntries(Object.entries(WALL).reverse());
    expect(tileFamilyOf(shuffled)).toBe(tileFamilyOf(WALL));
    expect(tileFamilyOf({ ...WALL, rows: 6 })).not.toBe(tileFamilyOf(WALL));
    expect(tileFamilyOf({ ...WALL, scale: 3 })).toBe(tileFamilyOf(WALL));   // placement is not painting
    for (const gen of Object.keys(TILE_RAILS)) expect(TILE_RAILS[gen].required.length).toBeGreaterThan(0);
  });
});

describe('tile specs: wood', () => {
  it('a wood spec takes quiet grain by default and paints a muted, low-contrast tile (the props\' timber)', async () => {
    const { surfaceTexture } = await import('../landscape/surface-textures.js');
    const { tileMean } = await import('./law-checks.js');
    const { PROP_WOOD } = await import('./props.js');
    const quiet = tileFamilyOf(PROP_WOOD.light), loud = tileFamilyOf({ ...PROP_WOOD.light, ringWarp: 0.9, cathedral: 0.9 });
    expect(quiet).not.toBe(loud);
    expect(surfaceTexture(`${quiet}-a`)).toMatch(/^data:image\/png;base64,/);
    // muted: its mean sits well under the preset oak's, and its channels close together (a grey-brown, not an orange)
    const m = tileMean(`${quiet}-a`), oak = tileMean('wood-oak');
    expect(m.reduce((a, b) => a + b) / 3).toBeLessThan(oak.reduce((a, b) => a + b) / 3);
    expect(m[0] - m[2]).toBeLessThan(oak[0] - oak[2]);
    expect(() => normalizeTileSpec({ gen: 'wood', early: [1, 2, 3], late: [4, 5, 6], ringFreq: 2.5 })).toThrow(/integer/);
  });
});

describe('tile specs: on a stage', () => {
  it('a recipe\'s tiles replace the kit\'s, surface by surface, and an unknown surface is refused with the list', () => {
    const p = planStage({ ...ROOM, tiles: { wall: WALL } });
    expect(new Set(p.kit.tint.wall).size).toBe(1);   // the kit's value band, not its colour cast: the recipe's stone is the hue
    expect(p.kit.tiles.wall.family).toBe(tileFamilyOf(WALL));
    expect(p.kit.tiles.floor.family).toBe('flagstone');   // untouched
    expect(() => planStage({ ...ROOM, tiles: { roof: WALL } })).toThrow(/no roof surface \(surfaces: wall, floor/);
    expect(() => assembleStageScene({ kind: 'stage', kit: 'trail-valley', tiles: { wall: WALL } })).toThrow(/open ground/);
  });

  it('the page carries every generated tile, painted from the recipe', async () => {
    const p = await world({ ...ROOM, tiles: { wall: WALL, floor: FLOOR } });
    const used = [...new Set(p.faces.map((f) => f.texture).filter((k) => typeof k === 'string' && k.startsWith('gen:')))];
    expect(used.some((k) => k.startsWith(`${tileFamilyOf(WALL)}-`))).toBe(true);
    expect(used.some((k) => k.startsWith(`${tileFamilyOf(FLOOR)}-`))).toBe(true);
    for (const k of used) expect(p.textures[k], k).toMatch(/^data:image\/png;base64,/);
  });

  it('is the recipe and only the recipe: an edit to one number repaints, and the same recipe is the same page', async () => {
    const a = await world({ ...ROOM, tiles: { wall: WALL } }), b = await world({ ...ROOM, tiles: { wall: { ...WALL, rows: 8 } } });
    const wallTex = (p) => Object.entries(p.textures).filter(([k]) => k.startsWith('gen:stone-brick')).map(([, v]) => v);
    expect(wallTex(a)[0]).not.toBe(wallTex(b)[0]);
    expect(JSON.stringify(await world({ ...ROOM, tiles: { wall: WALL } }))).toBe(JSON.stringify(a));
  });
});

import { PROPORTION_RAILS } from './tile-specs.js';
import { STAGE_KITS, STAGE_KIT_PROPORTIONS } from './stage.js';

// every proportion a kit has, all at one end of its rail
const extreme = (kitId, end) => Object.fromEntries(Object.entries(PROPORTION_RAILS).filter(([k]) => STAGE_KIT_PROPORTIONS[kitId].includes(k)).map(([k, r]) => [k, r.lo !== undefined ? r[end] : Object.fromEntries(Object.entries(r).map(([q, rr]) => [q, rr[end]]))]));
const ROOMS = {
  'gothic-stone': { rooms: [{ id: 'nave', x: 0, y: 0, w: 12, d: 20, h: 9 }, { id: 'gallery', x: 12, y: 6, w: 10, d: 8, h: 5 }], links: [{ from: 'nave', to: 'gallery' }] },
  'gothic-nave': { rooms: [{ id: 'nave', x: 0, y: 0, w: 12, d: 24, h: 13 }] },
  'island-plaza': { reference: 'island-noon', rooms: [{ id: 'plaza', x: 0, y: 0, w: 26, d: 22, h: 12, open: ['-y', '+x'] }] },
  'research-lab': { rooms: [{ id: 'lab', x: 0, y: 0, w: 16, d: 24, h: 9 }] },
};

describe('proportions: the rails over a room kit', () => {
  it('refuses a number outside its rail, a part the kit lacks, and a number the part lacks', () => {
    const R = { kind: 'stage', kit: 'gothic-stone', ...ROOMS['gothic-stone'] };
    expect(() => planStage({ ...R, proportions: { plinth: { h: 3 } } })).toThrow(/plinth.h: a number from 0.25 to 1.1/);
    expect(() => planStage({ ...R, proportions: { column: { r: 0.3 } } })).toThrow(/has no column \(its parts: bay, plinth/);
    expect(() => planStage({ kind: 'stage', kit: 'island-plaza', ...ROOMS['island-plaza'], proportions: { pilaster: { w: 0.5 } } })).toThrow(/has no pilaster \(its parts: bay\)/);
    expect(() => planStage({ ...R, proportions: { plinth: { colour: 1 } } })).toThrow(/not a plinth number/);
    expect(() => planStage({ kind: 'stage', kit: 'island-plaza', rooms: ROOMS['island-plaza'].rooms })).toThrow(/lit by the sun; give it a look with one \(desert-dusk, island-noon, jungle-haze\)/);
    expect(planStage({ ...R, proportions: { bay: 5, plinth: { h: 0.9 } } }).kit.plinth).toEqual({ ...STAGE_KITS['gothic-stone'].plinth, h: 0.9 });
  });

  for (const kitId of Object.keys(ROOMS)) {
    it(`${kitId}: builds at both ends of every rail, every corner finite`, () => {
      for (const end of ['lo', 'hi']) {
        const m = { kind: 'stage', kit: kitId, ...ROOMS[kitId], proportions: extreme(kitId, end) };
        const p = assembleStageScene(m);
        expect(p.faces.length, `${kitId} ${end}`).toBeGreaterThan(100);
        if (m.proportions.torch) expect(p.lights.length, `${kitId} ${end}: every torch rail still seats torches`).toBeGreaterThan(0);
        for (const f of p.faces) for (const c of f.corners) expect(c.every(Number.isFinite), `${kitId} ${end}`).toBe(true);
      }
    }, 120000);
  }
});

describe('proportions: each kit offers only what it draws', () => {
  const sig = (p) => JSON.stringify([p.faces.length, (p.lights || []).length, p.faces.map((f) => f.corners)]);
  for (const kitId of Object.keys(ROOMS)) {
    it(`${kitId}: every part it offers changes what it builds`, () => {
      const base = sig(assembleStageScene({ kind: 'stage', kit: kitId, ...ROOMS[kitId] }));
      for (const part of STAGE_KIT_PROPORTIONS[kitId]) {
        const rail = PROPORTION_RAILS[part];
        const moved = ['lo', 'hi'].some((end) => sig(assembleStageScene({ kind: 'stage', kit: kitId, ...ROOMS[kitId], proportions: { [part]: rail.lo !== undefined ? rail[end] : Object.fromEntries(Object.entries(rail).map(([q, r]) => [q, r[end]])) } })) !== base);
        expect(moved, `${kitId}.${part}`).toBe(true);
      }
    }, 120000);
  }
});
