/**
 * Rock takes pixels when the style is gritty (shading `grit`): at GRIT_PIXELS or over, the land's faces are the quiet
 * style's byte for byte and the page is handed the rock's own fabric (matte-paint/fabric.js) to draw on the near cliffs;
 * under it, or absent, the land is as it was. On one small island.
 */
import { describe, expect, it } from 'vitest';

import { readLocalMeru, GRIT_PIXELS } from './plan.js';
import { assembleStageScene } from '../era/stage.js';
import { readGeocube, lowerGeocube } from '../era/geocube.js';
import { ISEKAI_STYLES } from '../era/isekai-tiles.js';

const TWO_BASES = [{ form: 'mound', height: 6, foot: 11, summit: 6.5 }, { form: 'mound', height: 5, foot: 4.8, summit: 2.2, up: { turns: 1 } }];
const build = (shading) => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', meru: { tiers: TWO_BASES, island: { geology: true, walk: 'base' }, shading } }, {});
const base = build(true), quiet = build({ grit: GRIT_PIXELS - 0.1 }), gritty = build({ grit: 0.7 });

describe('rock takes pixels in a gritty style', () => {
  it('a quiet style\'s land is as it was, and is handed no fabric', () => {
    expect(JSON.stringify(quiet)).toBe(JSON.stringify(base));
    expect(base.fabric).toBeUndefined();
  });

  it('a gritty style\'s faces are the quiet style\'s: the far view is the polygons\'', () => {
    expect(JSON.stringify(gritty.faces)).toBe(JSON.stringify(base.faces));
  });

  it('and the page is handed the island\'s own joint fabric for its cliffs', () => {
    const F = gritty.fabric, joint = ISEKAI_STYLES['isekai-meadow'].landform.joint;
    expect(F.groups).toEqual(['isekai:cliff']);
    // the island's landform joints granite on the card's spacing at strike 0: the master sets lie along x and y
    expect(F.sets[0]).toMatchObject({ n: [1, 0, 0], s: joint });
    expect(F.sets[1].n).toEqual([-0, 1, 0]);
    expect(F.sets[2].s).toBeCloseTo(joint / 3, 3);
    expect(F.sun[2]).toBeGreaterThan(0);
  });

  it('a geocube carries its grit into the land, and the land checks it', () => {
    expect(lowerGeocube(readGeocube({ from: 'valley-morning', grit: 0.7 }), 'outside').meru.shading.grit).toBe(0.7);
    expect(lowerGeocube(readGeocube('valley-morning'), 'outside').meru.shading.grit).toBeUndefined();
    expect(() => readGeocube({ from: 'valley-morning', grit: 2 })).toThrow(/grit is how gritty the style is/);
    expect(() => readLocalMeru({ shading: { grit: -1 } })).toThrow(/shading\.grit is 0\.\.1/);
  });
});
