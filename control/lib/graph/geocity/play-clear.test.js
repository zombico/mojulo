// A PLAYED DISTRICT'S ROADS ARE CLEAR: a road is driven on there, so nothing the street stands (a signal, a lamp, a pole,
// a hydrant, a bin, a bench, a sign) and no tree stands on road surface with no other ground under it; the same district
// not played keeps its trees off the road too: a street's ground is its carriageway and its walks, and its trees stand
// on the walk, behind the kerb and clear of its crossings.
import { describe, it, expect } from 'vitest';
import { assembleGeocityScene } from './scene.js';

const M = { kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, geocity: { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2], evoke: 'neighbourhood', at: 'B4' } };
const ROADS = ['geocity:road', 'geocity:streetcar-row', 'geocity:bike'], STOOD = /^geocity:(signal|lamp|hydro|can|pole|hydrant|bin|bench|sign|ring|papers|tree-)/;
const inside = (x, y, c) => { let k = false; for (let i = 0, j = c.length - 1; i < c.length; j = i++) if ((c[i][1] > y) !== (c[j][1] > y) && x < ((c[j][0] - c[i][0]) * (y - c[i][1])) / (c[j][1] - c[i][1]) + c[i][0]) k = !k; return k; };
function onRoad(P) {
  const flat = P.faces.filter((f) => f.normal[2] > 0.9);
  const road = (p) => { let r = false; for (const f of flat) { if (Math.abs(f.corners[0][2] - p[2]) > 3 || !inside(p[0], p[1], f.corners)) continue; if (!ROADS.includes(f.group)) return false; r = true; } return r; };
  return P.repeats.filter((r) => STOOD.test(r.group)).flatMap((r) => r.transforms.filter((t) => road(t.pos)).map(() => r.group.split('-L')[0]));
}

describe('a played district\'s roads', () => {
  it('stand nothing and grow nothing, played or shown: a street\'s trees are on its walk, and what was left on the road is left out', () => {
    const played = assembleGeocityScene(M, { play: true }), shown = assembleGeocityScene(M);
    expect(onRoad(played)).toEqual([]);
    // (and the district as it is shown: its trees on the walks, as played)
    expect(onRoad(shown).filter((g) => g.startsWith('geocity:tree'))).toEqual([]);
    expect(shown.geocity.laws.find((l) => l.law === 'trees-clear')).toMatchObject({ ok: true });
    // (and none felled for it: as many trees stand)
    const trees = (P) => P.repeats.filter((r) => /^geocity:tree-/.test(r.group)).reduce((n, r) => n + r.transforms.length, 0);
    expect(trees(played)).toBeGreaterThan(trees(shown) * 0.9);
  });
}, 300000);
