import { describe, it, expect } from 'vitest';
import { techRaster, techSheet, SHEET_EYES, baseOf } from './tech-sheet.js';
import { smoothCorners } from './tech-shading.js';
import { lowerObjectFaces } from '../worlds/workbench.js';

const drum = (sides) => lowerObjectFaces({ kind: 'workbench', lathes: [{ id: 'd', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 2, y: 0, z: 0 }, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }], crossSections: 2, samples: sides }] }).map((f) => ({ ...f, monomer: 'd', group: 'tech:body', value: 0.7 }));

describe('the tech sheet: drawn as the engine shades it', () => {
  it('draws the thing fitted to its tile, the same bytes every time', () => {
    const img = techRaster(smoothCorners(drum(12)), { w: 80, h: 60 });
    expect(img).toHaveLength(80 * 60 * 3);
    const drawn = [...Array(80 * 60).keys()].filter((i) => img[i * 3] !== 236).length;
    expect(drawn).toBeGreaterThan(80 * 60 * 0.2);
    expect(techRaster(smoothCorners(drum(12)), { w: 80, h: 60 })).toEqual(img);
    expect(Object.keys(SHEET_EYES)).toEqual(['front', 'rear', 'side']);
  });

  it('a smooth round shades in a gradient where a flat one shows bands', () => {
    const shades = (faces) => new Set([...techRaster(faces, { w: 120, h: 90, eye: SHEET_EYES.side })].filter((_, i) => i % 3 === 0)).size;
    expect(shades(smoothCorners(drum(10)))).toBeGreaterThan(shades(drum(10)));
    expect(baseOf({ group: 'tech:glass', value: 0.15 })).not.toBe(baseOf({ group: 'tech:body', value: 0.15 }));
  });

  it('tiles are laid in rows', () => {
    const t = new Uint8Array(2 * 2 * 3).fill(7), S = techSheet([t, t, t], { cols: 2, w: 2, h: 2 });
    expect(S).toMatchObject({ width: 4, height: 4 });
    expect(S.rgb[(2 * 4 + 2) * 3]).toBe(255);
    expect(S.rgb[0]).toBe(7);
  });
});
