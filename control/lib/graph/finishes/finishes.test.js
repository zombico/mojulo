// House finishes: the tables, the style roll that draws them for a new house, and the kernel reading them. One case per
// procedure.
import { describe, it, expect } from 'vitest';
import { DOOR_STYLES, WINDOW_STYLES, WALL_TREATMENTS, FLOOR_PATTERNS, WALLPAPERS, FLOOR_KNOBS, finishKnobErrors, patternFace } from './index.js';
import { patternTile, patternKey } from './patterns.js';
import { surfaceTexture } from '../landscape/surface-textures.js';
import { structurizeFloorplan } from '../polygonizer/floorplan-structure.js';
import { HOUSE_STYLES, houseStyleOpts } from '../polygonizer/floorplan-styles.js';

const HOUSE = {
  kind: 'floorplan', title: 'two rooms', windows: true,
  rooms: [{ x: 0, y: 0, w: 14, h: 12, glyph: 'L' }, { x: 14, y: 0, w: 10, h: 12, glyph: 'K' }],
  doors: [{ x: 14, y: 6, edge: 'W' }, { x: 4, y: 12, edge: 'S', entry: true }],
};

describe('the tables', () => {
  it('every house style’s finish lists name only what the tables hold, and pass the knob check', () => {
    for (const [name, def] of Object.entries(HOUSE_STYLES)) {
      expect(def.finishes, name).toBeTruthy();
      for (const d of def.finishes.doorStyle) expect(DOOR_STYLES[d], d).toBeTruthy();
      for (const w of def.finishes.windowStyle) expect(WINDOW_STYLES[w], w).toBeTruthy();
      for (const t of def.finishes.wallTreatment) expect(WALL_TREATMENTS[t], t).toBeTruthy();
      for (const p of def.finishes.wallpaper) expect(WALLPAPERS[p.pattern], p.pattern).toBeTruthy();
      for (const k of FLOOR_KNOBS) for (const p of def.finishes[k]) expect(FLOOR_PATTERNS[p.pattern], p.pattern).toBeTruthy();
    }
  });
  it('a pattern is a pure function of its key, served through the surface-texture path', () => {
    const key = patternKey('herringbone', ['#b08a5e', '#8a6a48']);
    expect(patternTile(key)).toBe(patternTile(key));
    expect(surfaceTexture(key)).toMatch(/^data:image\/png;base64,/);
    expect(surfaceTexture('finish:no-such:#000000:#ffffff')).toBeNull();
    expect(patternFace({ pattern: 'checkerboard', colours: ['#ffffff', '#000000'] }).tileFt).toBe(FLOOR_PATTERNS.checkerboard.tileFt);
  });
});

describe('the style roll draws them, beside its other picks', () => {
  it('a house without `finishes` draws what it always did; with it, the same roll adds the finish knobs', () => {
    const before = houseStyleOpts('auto', 'seed:4', undefined);
    const after = houseStyleOpts('auto', 'seed:4', undefined, { finishes: true });
    expect(before.doorStyle).toBeUndefined();
    for (const [k, v] of Object.entries(before)) if (!HOUSE_STYLES[before.styleName].finishes[k]) expect(after[k], k).toEqual(v);   // every other pick unmoved
    expect(after.doorStyle && after.livingFloor && after.wallpaper).toBeTruthy();
    expect(houseStyleOpts('auto', 'seed:4', undefined, { finishes: true })).toEqual(after);
    expect(finishKnobErrors(after)).toEqual([]);
  });
  it('names what a malformed knob lacks', () => {
    const e = finishKnobErrors({ finishes: 'yes', doorStyle: 'gothic', livingFloor: { pattern: 'herringbone', colours: ['oak'] }, wallpaper: { pattern: 'paisley', colours: [] } }).join(' ');
    expect(e).toMatch(/finishes: 'auto'/);
    expect(e).toMatch(/doorStyle: one of/);
    expect(e).toMatch(/livingFloor\.colours/);
    expect(e).toMatch(/wallpaper\.pattern/);
  });
});

describe('the kernel reads them', () => {
  it('a styled house without finishes builds as before; with them its floors, doors and walls take theirs; a named knob wins', () => {
    const styled = { ...HOUSE, style: 'modern', seed: 2 };
    const plain = structurizeFloorplan(styled, styled);
    expect(plain.faces.some((f) => typeof f.texture === 'string' && f.texture.startsWith('finish:'))).toBe(false);
    const auto = { ...styled, finishes: 'auto' };
    const dressed = structurizeFloorplan(auto, auto);
    const roll = houseStyleOpts('modern', 'seed:2', undefined, { finishes: true });
    const textures = new Set(dressed.faces.map((f) => f.texture).filter(Boolean));
    expect(textures.has(patternKey(roll.livingFloor.pattern, roll.livingFloor.colours))).toBe(true);
    expect(textures.has(patternKey(roll.wetFloor.pattern, roll.wetFloor.colours))).toBe(true);
    const named = { ...auto, livingFloor: { pattern: 'basketweave', colours: ['#b08a5e', '#8a6a48'] } };
    const own = new Set(structurizeFloorplan(named, named).faces.map((f) => f.texture).filter(Boolean));
    expect(own.has(patternKey('basketweave', ['#b08a5e', '#8a6a48']))).toBe(true);
  });
});
