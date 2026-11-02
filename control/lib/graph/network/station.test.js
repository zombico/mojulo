// A SUBWAY STATION (network/station.js) laid from its floor plan (station-plans.js): one case a way the plans differ,
// chosen in code from the cards (a way out by a mezzanine and its stair, a way out through each side platform's wall, a
// line's end at buffer stops). Each: its tracks at the card's lines at standard gauge, a portal a track an open end
// (none at a closed one), its ways out, its walks along each platform and up to each way out, walked both ways by the
// page's ground probe over the payload's own faces and boxes (its columns, benches, train and stair all standing). And by
// its ELEVATION, one case a way out a plan takes (by its mezzanine, through its side walls): in a CUT, open to the sky
// under canopies, its way out at the street; ELEVATED on its deck over the street on its piers, its way out down a
// flight to the street; each walked from its platforms to the street and back.
import { describe, it, expect } from 'vitest';
import { assembleStageScene } from '../era/stage.js';
import { stationOf, readStation, STATION, ELEVATIONS } from './station.js';
import { STATION_PLANS, STATION_PLAN_IDS } from './station-plans.js';
import { walker } from './walk-gate.js';

const mezz = STATION_PLAN_IDS.find((id) => STATION_PLANS[id].exit === 'mezzanine' && STATION_PLANS[id].ends.length === 2);
const sides = STATION_PLAN_IDS.find((id) => STATION_PLANS[id].exit === 'sides');
const end = STATION_PLAN_IDS.find((id) => STATION_PLANS[id].ends.length === 1);

for (const plan of [mezz, sides, end]) {
  describe(`a ${plan} station`, () => {
    const C = STATION_PLANS[plan], P = assembleStageScene({ kind: 'stage', station: { plan } }, {}), A = P.anchors[0];
    const of = (g) => P.faces.filter((f) => f.group === `station:${g}`);

    it('lays its tracks on the card\'s lines at standard gauge, a portal to each at an open end, buffer stops at a closed one', () => {
      const heads = [...new Set(of('rail').filter((f) => f.normal[2] > 0.9).map((f) => Math.round(((Math.min(...f.corners.map((c) => c[0])) + Math.max(...f.corners.map((c) => c[0]))) / 2) * 1000) / 1000))].sort((p, q) => p - q);
      expect(heads.length).toBe(2 * C.tracks.length);
      C.tracks.forEach((t, i) => { expect(heads[2 * i + 1] - heads[2 * i]).toBeCloseTo(1.435, 2); expect((heads[2 * i] + heads[2 * i + 1]) / 2).toBeCloseTo(t.x, 2); });
      expect(A.ports.tracks.length).toBe(C.tracks.length * C.ends.length);
      for (const q of A.ports.tracks) { expect(C.ends).toContain(q.end); expect(q.top).toBe(STATION.portal); expect(q.lo[0]).toBeLessThan(q.x); expect(q.hi[0]).toBeGreaterThan(q.x); }
      expect(of('buffer').length > 0).toBe(C.ends.length < 2);
      expect(P.station).toMatchObject({ plan, tracks: C.tracks.length, platforms: C.platforms.length, tunnel: C.tunnel });
    });

    it('dresses its hall in its line\'s colours over white tile and the panelling, its columns tiled, a train at a platform', () => {
      for (const g of ['tile', 'frieze', 'roundel', 'glass', 'steel', 'tactile', 'edge', 'lamp', 'column', 'train', 'furniture']) expect(of(g).length, g).toBeGreaterThan(0);
      expect(of('tile').some((f) => f.texture === 'tile-subway')).toBe(true);
      expect(of('column').some((f) => f.texture === 'tile-white')).toBe(true);
      expect(of('mezzanine').length > 0).toBe(C.exit === 'mezzanine');
    });

    it('is walked along each platform end to end and up to each way out, and back: no step over a riser, no wall, no gap, no box', () => {
      expect(A.ports.walks.length).toBe(C.exit === 'sides' ? C.platforms.length : 1);
      expect(A.routes.up.length).toBe(A.ports.walks.length);
      const walk = walker(P);
      for (const r of [...A.routes.platforms, ...A.routes.up]) for (const pts of [r, r.slice().reverse()]) {
        const w = walk(pts);
        expect({ steepest: w.steepest <= 0.36, crossed: w.crossed, gaps: w.gaps, boxes: w.boxes }).toEqual({ steepest: true, crossed: [], gaps: [], boxes: [] });
      }
      // (each way out at the floor it is walked to: the mezzanine's, or the platform's)
      A.routes.up.forEach((r, i) => expect(r.at(-1)[2]).toBeCloseTo(A.ports.walks[i].z0, 5));
    });
  });
}

describe('a station set into the world', () => {
  it('stands where it is put, its track bed at its depth, the same every time', () => {
    const S = stationOf({ plan: mezz }, { id: 'k', at: [100, -40], z0: -12 }), T = stationOf({ plan: mezz }, { id: 'k', at: [100, -40], z0: -12 });
    expect(S.box.min[1]).toBeCloseTo(-40, 5);
    expect(S.box.min[2]).toBeCloseTo(-12, 5);
    for (const q of S.ports.tracks) expect(q.z0).toBe(-12);
    expect(JSON.stringify(S.faces)).toBe(JSON.stringify(T.faces));
  });

  it('refuses what it cannot build, by name', () => {
    expect(() => readStation({ plan: 'loop' })).toThrow(/plan 'loop' is not a floor plan/);
    expect(() => readStation({ line: 'pink' })).toThrow(/line 'pink' is not a line/);
    expect(() => readStation({ length: 500 })).toThrow(/length is 40 to 200/);
    expect(() => readStation({ train: { track: 9 } })).toThrow(/train is true, false or \{ track/);
    expect(() => readStation({ trains: 1 })).toThrow(/'trains' is not a setting/);
  });
});

for (const elevation of ELEVATIONS.filter((e) => e !== 'deep')) for (const plan of [mezz, sides]) {
  describe(`a ${plan} station, ${elevation}`, () => {
    const P = assembleStageScene({ kind: 'stage', station: { plan, elevation } }, {}), A = P.anchors[0], C = STATION_PLANS[plan];
    const of = (g) => P.faces.filter((f) => f.group === `station:${g}`), street = P.station.street;

    it('is open to the sky: no ceiling, a canopy over each platform on its posts, its street where its elevation puts it', () => {
      expect(P.station.elevation).toBe(elevation);
      for (const g of ['ceiling', 'beam']) expect(of(g), g).toEqual([]);
      for (const g of ['canopy', 'canopy-fascia', 'street']) expect(of(g).length, g).toBeGreaterThan(0);
      // (posts where a column stands on a platform, or along an elevated platform's parapet; a cut's side platform's
      // canopy hangs from its retaining wall)
      const onPlatform = C.columns.some((cx) => C.platforms.some(([a, b]) => cx > a && cx < b));
      expect(of('post').length > 0).toBe(onPlatform || elevation === 'elevated');
      // (nothing over the platforms but their canopies, a cut's mezzanine and its stair: the hall's walls stop at a railing)
      const zc = STATION.platform + STATION.canopy + 0.15, mezzTop = elevation === 'cut' && C.exit === 'mezzanine' ? street + 1.2 : zc;
      for (const f of P.faces.filter((q) => q.group !== 'station:street')) for (const c of f.corners) expect(c[2]).toBeLessThanOrEqual(Math.max(zc, mezzTop, elevation === 'cut' ? street + STATION.rail : zc) + 1e-6);
      if (elevation === 'cut') expect(street).toBeGreaterThan(STATION.platform + 4 - 1e-6);
      else {
        expect(street).toBeLessThan(-STATION.deck - 2);
        // (its piers held from the street up to its deck)
        const piers = P.colliders.filter((c) => /:pier-/.test(c.of));
        expect(piers.length).toBeGreaterThan(0);
        for (const c of piers) expect(c.min[2]).toBeCloseTo(street, 5);
      }
    });

    it('is walked along each platform and out to its street by each way out, and back', () => {
      expect(A.ports.walks.length).toBe(C.exit === 'sides' ? C.platforms.length : 1);
      const walk = walker(P);
      for (const r of [...A.routes.platforms, ...A.routes.up]) for (const pts of [r, r.slice().reverse()]) {
        const w = walk(pts);
        expect({ steepest: w.steepest <= 0.36, crossed: w.crossed, gaps: w.gaps, boxes: w.boxes }).toEqual({ steepest: true, crossed: [], gaps: [], boxes: [] });
      }
      A.routes.up.forEach((r, i) => { expect(r.at(-1)[2]).toBeCloseTo(street, 5); expect(A.ports.walks[i]).toMatchObject({ street: true, z0: street }); });
    });
  });
}

describe('a station\'s elevation', () => {
  it('is deep unless asked: the same station byte for byte; and refuses a street it cannot reach, by name', () => {
    expect(JSON.stringify(stationOf({ plan: sides, elevation: 'deep' }, { id: 'k' }))).toBe(JSON.stringify(stationOf({ plan: sides }, { id: 'k' })));
    expect(stationOf({ plan: mezz }).street).toBeUndefined();
    expect(() => readStation({ elevation: 'high' })).toThrow(/elevation is 'deep' \| 'cut' \| 'elevated'/);
    expect(() => stationOf({ elevation: 'cut' }, { ground: 2 })).toThrow(/a cut station's street is 4 to 12 m over its platforms/);
    expect(() => stationOf({ elevation: 'elevated' }, { ground: -3 })).toThrow(/an elevated station's street is 2.4 to 16 m under its station house/);
  });
});
