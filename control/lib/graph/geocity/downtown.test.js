// A DOWNTOWN'S DETAIL (geocity/scene.js): its streets' MOUTHS open (where a neighbourhood's own street meets an arterial
// the arterial's walk is opened and the road carried across, nothing stood in it), its roofs dressed (a tower's
// penthouse, a flat roof's bulkhead and air handlers: rooftop.js lotRoofPlan), its shops' blade signs (frontage.js). One
// small evoked city at its core; the concepts on it.
import { describe, it, expect } from 'vitest';
import { assembleGeocityScene, mouthsOf } from './scene.js';
import { designGeocity } from './design.js';
import { lotRoofPlan } from './rooftop.js';
import { frontsOf } from './frontage.js';

const geocity = { metro: { from: 'lakeshore', rings: { core: 160, frame: 330 } }, extent: [900, 800], water: { sides: ['s'], depth: 100 }, core: [0.5, 0.45], evoke: 'neighbourhood', at: 'core' };
const M = { kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, hour: 'noon', geocity };

describe('a downtown\'s detail', () => {
  it('opens each street\'s mouth: no walk across it, the road carried to the arterial\'s, nothing stood in it', () => {
    const P = assembleGeocityScene(M), d = designGeocity(geocity, { seed: 2 }), mouths = mouthsOf(d);
    expect(mouths.size).toBeGreaterThan(0);
    const mid = (f) => [f.corners.reduce((a, c) => a + c[0], 0) / f.corners.length, f.corners.reduce((a, c) => a + c[1], 0) / f.corners.length];
    const boxes = [];
    for (const [id, ms] of mouths) {
      const l = d.lines.find((x) => x.id === id), R2 = l.road / 2;
      for (const m of ms) { const [o0, o1] = m.side > 0 ? [R2 + 0.1, l.half - 0.1] : [-l.half + 0.1, -R2 - 0.1], a = m.lo + 0.2, b = m.hi - 0.2; boxes.push(l.axis === 'ns' ? [l.at + o0, a, l.at + o1, b] : [a, l.at + o0, b, l.at + o1]); }
    }
    const inside = ([x, y]) => boxes.some((q) => x > q[0] && x < q[2] && y > q[1] && y < q[3]);
    expect(P.faces.filter((f) => f.group === 'geocity:walk' && inside(mid(f)))).toEqual([]);
    expect(P.faces.some((f) => f.group === 'geocity:road' && inside(mid(f)))).toBe(true);
    const stood = (P.repeats ?? []).filter((r) => /^geocity:(bench|lamp|bin|hydrant|papers|ring|pit|signal|sign|meter)/.test(r.group)).flatMap((r) => r.transforms.filter((t) => inside(t.pos)));
    expect(stood).toEqual([]);
  }, 120_000);

  it('dresses a tower\'s roof with its penthouse and a flat roof with its bulkhead and air handlers, by its own dice', () => {
    const lots = [{ id: 't', x0: 0, y0: 0, x1: 40, y1: 40, z0: 0, h: 120, tower: true, shape: 'box' }, { id: 'f', x0: 100, y0: 0, x1: 160, y1: 40, z0: 0, h: 30, shape: 'box' }, { id: 's', x0: 200, y0: 0, x1: 230, y1: 30, z0: 0, h: 60, tower: true, shape: 'setback' }];
    const plan = lotRoofPlan(lots, 2), at = (id) => plan.filter((p) => (id === 't' ? p.at[0] < 50 : id === 'f' ? p.at[0] >= 100 && p.at[0] < 170 : p.at[0] >= 200));
    const pt = at('t').find((p) => p.key === 'penthouse');
    expect(pt.at[2]).toBe(120);
    expect(at('t').filter((p) => p.key === 'cooling')).toHaveLength(2);
    // (a narrowing tower's penthouse smaller, and no cooling towers on its narrow top)
    expect(at('s').find((p) => p.key === 'penthouse').scale[0] / 30).toBeLessThan(pt.scale[0] / 40);
    expect(at('s').some((p) => p.key === 'cooling')).toBe(false);
    expect(at('f').filter((p) => p.key === 'hvac').length).toBeGreaterThan(2);
    expect(JSON.stringify(lotRoofPlan(lots, 2))).toBe(JSON.stringify(plan));
  });

  it('hangs blade signs over some of a downtown\'s shops, and none where it is not asked', () => {
    const wall = { facing: 's', a: [0, 0], L: 120, z0: 0 }, spec = { storeys: 4, floorH: 3.2, use: 'mixed', ground: 'shops', palette: { frame: ['#333333'], shop: ['#444444'], sign: ['#aa3322'], awning: ['#225533'], door: ['#222222'], rail: ['#111111'] } };
    const R = () => 0.5, with_ = frontsOf(wall, { ...spec, blades: true }, R), without = frontsOf(wall, spec, R);
    expect(with_.some((p) => p.key.startsWith('blade-board'))).toBe(true);
    expect(without.some((p) => p.key.startsWith('blade-'))).toBe(false);
    // (the rest of the wall as it was)
    expect(with_.filter((p) => !p.key.startsWith('blade-'))).toEqual(without);
  });
});
