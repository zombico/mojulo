// A trail's land laid in sand dunes (out-dunes.js): the shape real dunes take across the wind (a long back, a steep slip
// face), their crests across it, the walk an inter-dune street through them; the sand cut where they stand. The cube
// names them (`outside.dunes`) and every trail it paints takes them; a scene's words name the cube's.
import { describe, expect, it } from 'vitest';
import { outTrailOf } from './out-trail-board.js';
import { readDunes, duneProfile, duneField, duneMap, DUNES } from './out-dunes.js';
import { formLandScript } from '../scene/channels/form-land.js';
import { withGeocube, readGeocube, assembleGeocubeScene } from './geocube.js';
import { assembleStageScene } from './stage.js';
import { sceneOfWords } from '../gameworld/scene-words.js';

const built = new Map(), once = (k, make) => (built.has(k) ? built.get(k) : built.set(k, make()).get(k));
const trail = (ground) => once(JSON.stringify(ground ?? null), () => outTrailOf({ kit: 'isekai-meadow', seed: 5, trail: { run: 14, ...(ground ? { ground } : {}) } }));
const zOf = (t) => Buffer.from(t.site.grid.z.buffer);
const walkZ = ({ site }) => Array.from({ length: Math.floor(site.D) }, (_, y) => site.ground(site.trailX(y), y));

describe('a dune, across the wind', () => {
  it('rises over its long back to the brink and falls steeply down its slip face', () => {
    const a = 0.8, n = 400, p = Array.from({ length: n + 1 }, (_, i) => duneProfile(i / n, a));
    expect(p[0]).toBeCloseTo(0, 6); expect(duneProfile(a, a)).toBeCloseTo(1, 6); expect(p[n]).toBeCloseTo(0, 6);
    const slope = p.slice(1).map((v, i) => (v - p[i]) * n), back = Math.max(...slope.slice(0, Math.floor(a * n))), face = -Math.min(...slope);
    expect(face).toBeGreaterThan(2 * back);
  });

  it('its slip face stands at the angle of repose, a taller dune\'s longer', () => {
    const steepest = (D) => { const F = duneField({ ...DUNES, sinuous: 0, supply: 1, ...D }, 3); let m = 0; for (let x = 0; x < 120; x += 0.05) m = Math.max(m, F.h(x, 0) - F.h(x + 0.05, 0)); return m / 0.05; };
    expect(steepest({})).toBeGreaterThan(Math.tan(28 * Math.PI / 180));
    expect(steepest({})).toBeLessThan(Math.tan(33 * Math.PI / 180));
    expect(steepest({ repose: 20 })).toBeLessThan(Math.tan(21 * Math.PI / 180));
  });

  it('its crests run across the wind, the same dials and seed the same dunes', () => {
    for (const wind of [0, 90]) {
      const F = duneField({ ...DUNES, wind, sinuous: 0, supply: 1 }, 3), [ux, uy] = F.wind;
      // (the height changes along the wind, barely across it)
      let along = 0, across = 0;
      for (let k = 0; k < 60; k++) { along += Math.abs(F.h(ux * k, uy * k) - F.h(ux * (k + 1), uy * (k + 1))); across += Math.abs(F.h(-uy * k, ux * k) - F.h(-uy * (k + 1), ux * (k + 1))); }
      expect(along).toBeGreaterThan(4 * across);
    }
    const a = duneField(DUNES, 7), b = duneField(DUNES, 7);
    expect([1, 2, 3].map((v) => a.h(v * 9.1, v * 4.3))).toEqual([1, 2, 3].map((v) => b.h(v * 9.1, v * 4.3)));
  });

  it('names what is wrong', () => {
    expect(readDunes(undefined)).toBeNull(); expect(readDunes(false)).toBeNull();
    expect(readDunes(true)).toEqual(DUNES);
    expect(() => readDunes({ tall: 3 })).toThrow(/dunes\.tall is not a dune setting/);
    expect(() => readDunes({ height: 40 })).toThrow(/dunes\.height is metres/);
    expect(() => readDunes('yes')).toThrow(/dunes is true or/);
    expect(() => trail({ dunes: { supply: 2 } })).toThrow(/trail\.ground\.dunes\.supply/);
  });
});

describe('a trail laid in dunes', () => {
  it('absent adds nothing: none or false build the same ground', () => {
    const a = trail();
    expect(zOf(trail({ dunes: false })).equals(zOf(a))).toBe(true);
    expect(a.site.dunes).toBeUndefined();
  });

  it('the walk keeps its street: its line where it was, the dunes standing off it, sand where they stand', () => {
    const base = trail({ cliff: false }), t = trail({ cliff: false, dunes: true }), D = t.site.dunes;
    walkZ(t).forEach((z, i) => expect(z).toBeCloseTo(walkZ(base)[i], 6));
    let tallest = 0, sand = 0, n = 0;
    const g = t.site.grid;
    for (let j = 0; j < g.ny; j += 4) for (let i = 0; i < g.nx; i += 4) {
      const x = g.x0 + i * g.dx, y = g.y0 + j * g.dx;
      tallest = Math.max(tallest, t.site.ground(x, y) - base.site.ground(x, y)); n++;
      if (D.sand(x, y) > 0) { sand++; expect(t.site.trailDist(x, y)).toBeGreaterThan(t.site.halfWAt(y)); expect(t.site.clear(x, y)).toBe(true); }
    }
    expect(tallest).toBeGreaterThan(1.5);
    expect(sand / n).toBeGreaterThan(0.15);
    for (let y = 2; y < t.site.D - 2; y += 3) expect(D.sand(t.site.trailX(y), y)).toBeLessThanOrEqual(0);
  });
});

describe('the form render\'s sand, drawn by the wind', () => {
  it('reads the dunes as a map over the site; a land without them carries none of its sand\'s drawing', () => {
    const t = trail({ cliff: false, dunes: true }), M = duneMap(t.site), px = Buffer.from(M.px, 'base64');
    expect(M.wind).toEqual([1, 0]);
    expect(px.length).toBe(M.size[0] * M.size[1] * 4);
    const red = (x, y) => px[((Math.round((y - M.origin[1]) / M.cell)) * M.size[0] + Math.round((x - M.origin[0]) / M.cell)) * 4];
    for (let y = 4; y < t.site.D - 4; y += 6) expect(red(t.site.trailX(y), y)).toBe(0);
    expect(px.some((v, i) => i % 4 === 0 && v > 200)).toBe(true);
    const land = { light: { sun: [1, 1, 1], ambient: [0.2, 0.2, 0.2] } };
    expect(formLandScript(land)).not.toMatch(/tDune|DUNE_/);
    expect(formLandScript({ ...land, dunes: M })).toContain('uniform sampler2D tDune');
  });
});

describe('the cube\'s dunes, on every trail it paints', () => {
  const ERG = { from: 'island-noon', outside: { dunes: true } };
  it('a trail on the cube takes them; a trail\'s own win; its false refuses them', () => {
    expect(withGeocube({ kind: 'stage', geocube: ERG, trail: { run: 12 } }).trail).toEqual({ run: 12, ground: { dunes: true } });
    expect(withGeocube({ kind: 'stage', geocube: ERG, trail: { ground: { dunes: { height: 5 } } } }).trail.ground.dunes).toEqual({ height: 5 });
    expect(withGeocube({ kind: 'stage', geocube: ERG, trail: { ground: { dunes: false } } }).trail.ground.dunes).toBe(false);
    expect(() => readGeocube({ from: 'island-noon', outside: { dunes: { tall: 1 } } })).toThrow(/outside\.dunes.*not a dune setting/);
  });

  it('a scene\'s words name them, on an open land; desert alone lays none', () => {
    const S = sceneOfWords('sand dunes at noon');
    expect(S.cube.outside).toMatchObject({ dunes: true, cliff: false });
    expect(sceneOfWords('a desert at noon').cube.outside?.dunes).toBeUndefined();
  });

  it('the geocube kind\'s path draws them: their sand cut into its ground', () => {
    const P = assembleGeocubeScene({ kind: 'geocube', cube: { from: 'island-noon', outside: { cliff: false, dunes: true } }, show: 'path', seed: 3 }, {}, assembleStageScene);
    expect(P.faces.filter((f) => f.group === 'isekai:sand').length).toBeGreaterThan(200);
  });
});
