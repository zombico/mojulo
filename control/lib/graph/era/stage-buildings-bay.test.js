// stage-buildings, a composed building on open ground: a base's building (or one given a look) seated on the land is
// built on its bay kit and composed as a building level is, so its rooms are stocked; its windows open through its shell
// onto the land, the land's sun lays their patches (none under a sky with no sun) and dims their daylight; it wears its
// construction outside (style/bay-exterior.js), a flat roof behind a parapet; a yard before its front is kept clear of
// what grows. Every other building is laid as it was (stage-buildings.test.js).

import { describe, it, expect } from 'vitest';
import { assembleStageScene } from './stage.js';
import { interiorStage } from '../gameworld/levels.js';
import { exteriorOf, EXTERIORS, EXTERIOR_PAINT } from './style/bay-exterior.js';

// an outpost's building: one bay of a single-loaded wing on two storeys, on a valley cube's trail
const OUTPOST = { use: 'barracks', wings: 'I', bays: 1, loading: 'single' };
const at = (hour) => assembleStageScene({ kind: 'stage', geocube: 'valley-morning', trail: true, hour, buildings: [OUTPOST] });
const noon = at('noon'), dusk = at('dusk');
const A = noon.anchors.find((a) => a.kind === 'building'), B = noon.buildings[0];
const g = (P, re) => P.faces.filter((f) => re.test(f.group));
const mid = (f) => [0, 1, 2].map((k) => f.corners.reduce((a, c) => a + c[k], 0) / f.corners.length);

describe('a base building on the land', () => {
  it('is its bay kit composed, its plan its own, its rooms stocked, seated level on flat ground', () => {
    expect(B.look).toEqual({ construction: 'everyday', palette: 'everyday' });
    expect(A.look).toEqual(B.look);
    expect(A.storeys).toBe(2);
    expect(B.into).toBeLessThan(0.5);
    expect(B.rough).toBe(0);
    // stocked (era/stocking.js): its lobby's guard post, an extinguisher by each stocked room's door, its rooms' own stock
    const nodes = [...new Set(noon.faces.map((f) => f.node).filter(Boolean))];
    for (const k of ['sandbags', 'extinguisher']) expect(nodes.some((n) => n.includes(k)), k).toBe(true);
    expect(nodes.filter((n) => n.startsWith(`${B.id}:`) && !/sandbags|extinguisher|sign|landmark/.test(n)).length).toBeGreaterThan(0);
  });

  it('its windows open through its shell: no sky card behind them, no shell wall over a pane seen from outside', () => {
    const panes = g(noon, /^stage:pane$/), shell = g(noon, /^building:wall$/);
    expect(panes.length).toBeGreaterThan(10);
    expect(g(noon, /^stage:sky$/)).toHaveLength(0);
    const covered = panes.filter((p) => {
      const m = mid(p), o = p.normal.map((v) => -v);
      return shell.some((f) => {
        const lo = [0, 1, 2].map((k) => Math.min(...f.corners.map((c) => c[k]))), hi = [0, 1, 2].map((k) => Math.max(...f.corners.map((c) => c[k])));
        for (let t = 0.05; t < 0.8; t += 0.05) { const q = m.map((v, k) => v + o[k] * t); if ([0, 1].every((k) => q[k] >= lo[k] - 0.03 && q[k] <= hi[k] + 0.03) && q[2] > lo[2] && q[2] < hi[2]) return true; }
        return false;
      });
    });
    expect(covered).toHaveLength(0);
  });

  it("the land's sun lays its windows' patches; a sky with no sun lays none and dims their daylight", () => {
    expect(noon.sky.sun).toBeTruthy();
    expect(g(noon, /^stage:sunpatch$/).length).toBeGreaterThan(0);
    expect(dusk.sky.sun).toBeUndefined();
    expect(g(dusk, /^stage:sunpatch$/)).toHaveLength(0);
    // (the building's lights are the same lamps at either hour but for the daylight at its windows)
    const lit = (P) => P.lights.filter((l) => l.name.startsWith(`${B.id}-`)).reduce((a, l) => a + l.intensity, 0);
    expect(lit(dusk)).toBeLessThan(lit(noon));
  });

  it('wears its construction outside: its walls and roof the exterior tiles, its flat roof behind a parapet', () => {
    const X = exteriorOf(B.look);
    expect(new Set(g(noon, /^building:wall$/).map((f) => f.texture))).toEqual(new Set([X.wall.key]));
    expect(new Set(g(noon, /^building:roof$/).map((f) => f.texture))).toEqual(new Set([X.roof.key]));
    expect(X.cap).toBe('flat');
    // the parapet stands over every flat roof: the shell's walls rise past the roof faces
    const roofTop = Math.max(...g(noon, /^building:roof$/).flatMap((f) => f.corners.map((c) => c[2]))), wallTop = Math.max(...g(noon, /^building:wall$/).flatMap((f) => f.corners.map((c) => c[2])));
    expect(wallTop - roofTop).toBeCloseTo(X.parapet, 3);
  });

  it('keeps a yard before its front clear of what grows', () => {
    const N = A.N, S = [-N[1], N[0]];
    const inYard = (p) => { const d = [p[0] - A.at[0], p[1] - A.at[1]], out = d[0] * N[0] + d[1] * N[1], side = d[0] * S[0] + d[1] * S[1]; return out > 0.5 && out < 7 && Math.abs(side) < 3; };
    expect(g(noon, /:(wood|crown|tree|rock|bush|ikebana)$/).filter((f) => inYard(mid(f)))).toHaveLength(0);
  });
});

describe('a look on any bay building', () => {
  it('composes it in that look, and refuses a look that is not one', () => {
    const P = assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', trail: true, buildings: [{ use: 'armoury', bays: 1, look: { construction: 'bunker' } }] });
    expect(P.buildings[0].look).toEqual({ construction: 'bunker', palette: 'military' });
    expect(g(P, /^building:wall$/)[0].texture).toBe(exteriorOf({ construction: 'bunker', palette: 'military' }).wall.key);
    expect(() => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', trail: true, buildings: [{ use: 'armoury', look: { colour: 'red' } }] })).toThrow(/look is \{ construction\?, palette\? \}/);
  });

  it("a base building entered by its door is composed inside as a building level is", () => {
    const S = interiorStage({ use: 'barracks', seed: 2, civilization: 'timber-hall' });
    expect(S).toMatchObject({ kind: 'stage', kit: 'bay-everyday', compose: {}, level: { door: 'out' } });
    expect(interiorStage({ use: 'tavern', seed: 2 }).compose).toBeUndefined();
  });
});

describe('the exterior table', () => {
  it('dresses every construction in any palette, its own material where it keeps one', () => {
    const one = Object.keys(EXTERIORS)[0];
    for (const c of Object.keys(EXTERIORS)) expect(exteriorOf({ construction: c, palette: 'military' }).wall.key).toMatch(/^gen:dressed-[0-9a-f]{8}-a$/);
    // a palette colours a construction that keeps no colour of its own, and leaves one that does
    const painted = Object.keys(EXTERIORS).find((c) => !EXTERIORS[c].own), own = Object.keys(EXTERIORS).find((c) => EXTERIORS[c].own);
    const [p, q] = Object.keys(EXTERIOR_PAINT);
    expect(exteriorOf({ construction: painted, palette: p }).wall.key).not.toBe(exteriorOf({ construction: painted, palette: q }).wall.key);
    expect(exteriorOf({ construction: own, palette: p }).wall.key).toBe(exteriorOf({ construction: own, palette: q }).wall.key);
    expect(exteriorOf({ construction: one })).toEqual(exteriorOf({ construction: one }));
  });
});
