// A home's windows (floorplan-styles.js HOME_WINDOWS, `houseLook: 2`): drawn from the house's tradition and family,
// never a workshop's steel grid; a house without the look rolls as it always did; the Japanese slider draws its two
// meeting stiles side by side.
import { describe, expect, it } from 'vitest';
import { HOME_WINDOWS, WINDOW_REGIONS, HOUSE_STYLE_NAMES, houseStyleOpts, readLook } from './floorplan-styles.js';
import { WINDOW_STYLES } from '../finishes/index.js';
import { DESIGN_TRADITIONS } from './floorplan-design.js';
import { assembleFloorWorldScene } from './floorplan-structure.js';

describe('a home\'s windows', () => {
  it('every tradition reads a region; every region dresses every family in known home windows, no steel grid', () => {
    for (const t of DESIGN_TRADITIONS) expect(HOME_WINDOWS[WINDOW_REGIONS[t]], t).toBeDefined();
    for (const region of Object.values(HOME_WINDOWS)) for (const name of HOUSE_STYLE_NAMES) {
      const w = region[name];
      expect(w.windowStyle.every((s) => WINDOW_STYLES[s])).toBe(true);
      expect(w.windowStyle).not.toContain('crittall');
    }
  });

  it('look 2 draws the tradition\'s windows; absent, the roll as it was', () => {
    const key = 'seed:11';
    expect(houseStyleOpts('modern', key, 'interior', { finishes: true, look: 1 })).toEqual(houseStyleOpts('modern', key, 'interior', { finishes: true }));
    for (const [tradition, region] of [['north-american', 'north-american'], ['metric', 'european'], ['japanese', 'asian']]) {
      const o = houseStyleOpts('modern', key, 'interior', { finishes: true, look: 2, tradition });
      expect(HOME_WINDOWS[region].modern.windowStyle).toContain(o.windowStyle);
      expect(HOME_WINDOWS[region].modern.windowFrameTint).toContain(o.windowFrameTint);
    }
    expect(() => readLook(3)).toThrow(/houseLook: one of 1, 2/);
  });

  it('the slider: two meeting stiles, where a casement has one', () => {
    // (a small generated plan: its perimeter rooms windowed)
    const room = (windowStyle) => { const m = { seed: 3, width: 30, height: 24, windows: true, windowStyle, view: 'interior' }; return assembleFloorWorldScene(m, m).faces.length; };
    const picture = room('picture');
    expect(room('casement')).toBeGreaterThan(picture);
    expect(room('slider') - picture).toBe(2 * (room('casement') - picture));
  });
});
