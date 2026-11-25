import { describe, it, expect } from 'vitest';
import { airspaceOf, assembleAirspace, validateAirspace } from './airspace.js';
import { readCountryAsk, SETTLEMENTS, SKINS } from './country.js';
import { coverKernel } from './cover-kernel.js';
import { coverInputs } from './aerial.js';
import { terrainChannelScript } from '../scene/channels/terrain-lod.js';

// the smallest map a country holds: a trainer's island, its runway, a town and two villages (Pilot School's airfield)
const M = { kind: 'airspace', map: { craft: 'trainer' }, ground: { pads: [{ kind: 'runway', at: [0.5, 0.25] }], country: { towns: 1, villages: 2 } }, seed: 4 };
const { map, field } = airspaceOf(M);
const C = field.country, R = field.report.country;

describe('the country on a pilot\'s map', () => {
  it('reads its ask, and says what it cannot lay', () => {
    expect(readCountryAsk(true)).toEqual([]);
    expect(readCountryAsk({ metro: true, towns: 2 })).toEqual([]);
    expect(readCountryAsk({ towns: 9 }).join()).toMatch(/towns/);
    expect(readCountryAsk({ settlements: [{ kind: 'hamlet' }] }).join()).toMatch(/kind/);
    expect(readCountryAsk({ metro: { metro: 'atlantis' } }).join()).toMatch(/atlantis/);
    expect(validateAirspace({ ...M, ground: { ...M.ground, country: { suburbs: 1 } } }).join()).toMatch(/suburbs/);
    expect(Object.keys(SETTLEMENTS)).toEqual(['metro', 'town', 'village', 'colony']);
  });

  it('is one generator at every grain: each settlement a geocity at its card, on the map\'s land, clear of the pads', () => {
    expect(R.settlements.map((s) => s.kind)).toEqual(['town', 'village', 'village']);
    for (const s of C.settlements) {
      expect(s.d.regions.length).toBeGreaterThan(0);
      // never over the runway or its falloff
      for (const p of field.pads) expect(s.land[2] < p.x0 - p.falloff || s.land[0] > p.x1 + p.falloff || s.land[3] < p.y0 - p.falloff || s.land[1] > p.y1 + p.falloff).toBe(true);
      // and stood on its own streets' ground: the graded ground at its middle is the design's
      const [x, y] = [(s.land[0] + s.land[2]) / 2, (s.land[1] + s.land[3]) / 2];
      expect(Math.abs(field.heightAt(x, y) - s.S(x - s.origin[0], y - s.origin[1]))).toBeLessThan(0.5);
    }
    // a village builds nothing over three storeys; a town keeps its core low
    const tallest = (s) => Math.max(...s.d.regions.flatMap((r) => (r.blocks || []).map((b) => b.storeys?.median ?? 0)));
    expect(tallest(C.settlements.find((s) => s.kind === 'village'))).toBeLessThanOrEqual(3);
    expect(tallest(C.settlements.find((s) => s.kind === 'town'))).toBeLessThanOrEqual(7);
  });

  it('joins its settlements and the airfield by road, across the land', () => {
    // a spanning tree: one road fewer than its nodes (the settlements and the airfield), and one on past the field
    const tree = C.roads.filter((r) => !r.id.endsWith('~beyond'));
    expect(tree.length).toBe(C.settlements.length);
    for (const r of C.roads) for (let k = 0; k < r.pts.length; k += 3) expect(field.kernel.baseAt(...r.pts[k])).toBeGreaterThan(-1);
  });

  it('stands its buildings at flight detail, its roofs something a craft can hit', () => {
    const A = field.aerial;
    expect(A.boxes.length).toBeGreaterThan(100);
    expect(A.gables.length).toBeGreaterThan(50);
    expect(A.boxes.every((b) => b[3] > 0 && b[4] > 0 && b[5] > 0 && Object.values(SKINS).includes(b[8]))).toBe(true);
    const b = A.boxes.reduce((m, x) => (x[5] > m[5] ? x : m));
    expect(field.topAt(b[0], b[1])).toBeGreaterThan(field.groundAt(b[0], b[1]) + 2);
    expect(field.roofs.length).toBeGreaterThan(C.settlements.length - 1);
  });

  it('is deterministic: the same ask lays the same country', () => {
    const again = airspaceOf(M).field;
    expect(JSON.stringify(again.aerial.boxes)).toBe(JSON.stringify(field.aerial.boxes));
    expect(JSON.stringify(again.country.roads)).toBe(JSON.stringify(C.roads));
  });
});

describe('the land\'s cover', () => {
  it('weighs woods, crops, heath and sand within 0…1, nothing under the sea, no woods on a settlement', () => {
    const K = coverKernel(coverInputs(field), { groundAt: field.groundAt }), F = map.rings.reach;
    let sea = 0, land = 0;
    for (let y = -F.hy; y <= F.hy; y += F.hy / 10) for (let x = -F.hx; x <= F.hx; x += F.hx / 10) {
      const w = K.at(x, y);
      expect(w.every((v) => v >= 0 && v <= 1)).toBe(true);
      if (field.groundAt(x, y) < -1) { sea++; expect(w).toEqual([0, 0, 0, 0]); } else land++;
    }
    expect(sea).toBeGreaterThan(0); expect(land).toBeGreaterThan(0);
    const s = C.settlements[0].land;
    expect(K.at((s[0] + s[2]) / 2, (s[1] + s[3]) / 2)[0]).toBe(0);
  });
});

describe('the page', () => {
  it('carries the aerial ground only for a map with a country: one without it is as it was', () => {
    const plain = assembleAirspace({ ...M, ground: { pads: M.ground.pads } }, { live: true });
    expect(plain.terrain.aerial).toBeUndefined();
    expect(terrainChannelScript(plain.terrain)).not.toMatch(/__aVert|aerial/);
    const live = assembleAirspace(M, { live: true }), src = terrainChannelScript(live.terrain);
    expect(live.terrain.aerial.masses.n).toBeGreaterThan(100);
    expect(src).toMatch(/function __aVert/);
    expect(src).toMatch(/aerialAlbedo/);
    // its cover kernel inlined once, as its own source
    expect(src.split('function coverKernel').length).toBe(2);
  });

  it('carries its buildings to exports as faces', () => {
    const baked = assembleAirspace(M, { live: false });
    expect(baked.faces.filter((f) => f.group === 'country').length).toBeGreaterThan(5 * field.aerial.boxes.length);
    expect(baked.terrain.aerial).toBeUndefined();
  });
});
