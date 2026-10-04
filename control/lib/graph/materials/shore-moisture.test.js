import { describe, expect, it } from 'vitest';

import { DETAIL_TIERS, detailAtLeast, normalizeDetail } from './detail-tier.js';
import { WS_GLSL, shoreMoisture, wsDryTime } from './shore-moisture.js';
import { assembleBeachScene } from '../landscape/beach-view.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const shore = { edgeY: 59, swashRange: 12, omSwash: 0.6 };
const period = (2 * Math.PI) / shore.omSwash;

describe('shore moisture (the wet band that follows the swash)', () => {
  it('is wet under the sea, dry where the swash never reaches', () => {
    expect(wsDryTime(shore, 40, 3.3)).toBe(0);
    expect(wsDryTime(shore, 70, 3.3)).toBe(1e4);
    expect(shoreMoisture(shore, 40, 3.3)).toEqual({ film: 1, dark: 1 });
  });

  it('is periodic, and dries monotonically between two visits of the swash', () => {
    const y = 55;
    for (const t of [0.4, 2.2, 7.9]) expect(wsDryTime(shore, y, t + period)).toBeCloseTo(wsDryTime(shore, y, t), 9);
    let last = -1, rising = 0;
    for (let t = 0; t < period; t += 0.05) {
      const d = wsDryTime(shore, y, t);
      if (d > 0 && last > 0) { expect(d).toBeGreaterThan(last); rising++; }
      last = d;
    }
    expect(rising).toBeGreaterThan(10);
  });

  it('keeps a damp capillary band above the swash, fading up the beach', () => {
    const a = shoreMoisture(shore, 60, 0).dark, b = shoreMoisture(shore, 66, 0).dark, c = shoreMoisture(shore, 80, 0).dark;
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
    expect(c).toBeLessThan(0.05);
  });

  it('the shader twin computes the same dry time as the builder', () => {
    const js = WS_GLSL.replace(/float (\w+)\(([^)]*)\)/g, (_, n, args) => `function ${n}(${args.replace(/float /g, '')})`).replace(/float /g, 'let ');
    const twin = new Function('uWsEdge', 'uWsRange', 'uWsOm', 'y', 't', `const { sin, asin, floor } = Math; ${js}; return wsDryTime(y, t);`);
    for (const y of [44, 50, 53.5, 57, 59.5, 63]) for (const t of [0, 1.1, 3.7, 6.2, 9.9, 14.4]) {
      expect(twin(shore.edgeY, shore.swashRange, shore.omSwash, y, t)).toBeCloseTo(wsDryTime(shore, y, t), 5);
    }
  });
});

describe('the detail tier', () => {
  it('names the four tiers in order and falls back on junk', () => {
    expect(DETAIL_TIERS).toEqual(['still', 'animated', 'touch', 'showpiece']);
    expect(normalizeDetail('touch')).toBe('touch');
    expect(normalizeDetail('loud', 'still')).toBe('still');
    expect(detailAtLeast('showpiece', 'touch')).toBe(true);
    expect(detailAtLeast('animated', 'touch')).toBe(false);
  });

  it('gives an aqua beach the live wet band by default; still and aqua:false keep the baked band', () => {
    const live = assembleBeachScene({}), still = assembleBeachScene({ detail: 'still' }), old = assembleBeachScene({ aqua: false });
    expect(live.wetSand).toMatchObject({ group: 'sand' });
    expect(still.wetSand).toBeUndefined();
    expect(old.wetSand).toBeUndefined();
    expect(emitThreeWorld({ ...live, inline: false })).toMatch(/stepWetSand\(t\);/);
    expect(emitThreeWorld({ ...still, inline: false })).not.toMatch(/stepWetSand/);
    // the live beach bakes its sand dry above and below the sea; the swash darkens it on the page
    const sandFills = (p) => new Set(p.faces.filter((f) => f.group === 'sand').map((f) => f.fill)).size;
    expect(sandFills(live)).toBeLessThanOrEqual(sandFills(still));
  });
});

describe('the beach touch tier', () => {
  it('adds a footprint bed on the sand surface, walk mode facing the sea, and the beach unit', () => {
    const p = assembleBeachScene({ detail: 'touch' }), s2 = assembleBeachScene({ detail: 'touch', scale: 2 });
    expect(p.metersPerUnit).toBe(1);
    expect(s2.metersPerUnit).toBe(0.5);
    expect(s2.softGround.cell).toBeCloseTo(2 * p.softGround.cell, 9);                  // 3 cm cells, in world units
    const { surface } = p.softGround;
    expect(surface.z).toHaveLength((surface.sx + 1) * (surface.sy + 1));
    expect(p.walk.spawn[1]).toBeGreaterThan(surface.y0);
    expect(p.wetSand.hole).toBe(true);
    expect(assembleBeachScene({}).softGround).toBeUndefined();
    expect(assembleBeachScene({ detail: 'touch', aqua: false }).softGround).toBeUndefined();
    const page = emitThreeWorld({ ...p, inline: false });
    expect(page).toMatch(/stepSoftGround\(t\);/);
    expect(page).toMatch(/function buildSandBed/);                                       // the kernel the tests run, inlined
    expect(emitThreeWorld({ ...assembleBeachScene({}), inline: false })).not.toMatch(/stepSoftGround/);
  });
});
