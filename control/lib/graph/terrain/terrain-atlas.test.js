/**
 * Composed worlds. Claims under test: the anchor's size band sets the frame (a great river makes a continent, a lake
 * tens of kilometres, a great lake hundreds); a declared river's water never rises from source to mouth and its mouth
 * is as wide as its band says; every traced river's water never rises downstream either; a lake stands flat at one
 * level, no higher than its sill; each finer level sits in its parent and meets it without a step; the page computes
 * the same ground, water and colour as the server from what it carries; the world stands you on dry ground at the
 * anchor, at eye height; a city sites on the finest level and on dry ground; the manifest teaches.
 */
import { describe, expect, it } from 'vitest';

import { atlasFrame, composeAtlas, atlasField, decodeDeep, validateAtlas, clearAtlasMemo, ATLAS_SIZES } from './terrain-atlas.js';
import { atlasKernel } from './atlas-kernel.js';
import { assembleTerrainWorld } from './terrain-world.js';
import { terrainChannelScript } from '../scene/channels/terrain-lod.js';

const RIVER = { features: [{ feature: 'river' }, { feature: 'lake' }, { feature: 'coast', side: 'E' }], seed: 'rhone' };

describe('the anchor sets the scale', () => {
  it('a great river is a continent, a river a region, a lake tens of kilometres, a great lake hundreds', () => {
    const band = (f, s) => ATLAS_SIZES[f][s];
    const g = atlasFrame({ features: [{ feature: 'river', size: 'great' }, { feature: 'coast', side: 'S' }] });
    expect(g.anchor.length).toBeGreaterThanOrEqual(band('river', 'great').length[0]); expect(g.anchor.length).toBeLessThanOrEqual(band('river', 'great').length[1]);
    expect(g.span).toBeGreaterThan(1e6);
    expect(atlasFrame({ features: [{ feature: 'river' }] }).span).toBeLessThan(6e5);
    const l = atlasFrame({ features: [{ feature: 'lake' }] }), gl = atlasFrame({ features: [{ feature: 'lake', size: 'great' }] });
    expect(l.span).toBeGreaterThan(4e4); expect(l.span).toBeLessThan(2e5); expect(gl.span).toBeGreaterThan(4.5e5);
    expect(gl.anchor.length).toBeGreaterThanOrEqual(band('lake', 'great').length[0]);
    expect(atlasFrame({ features: [{ feature: 'range', size: 'cordillera' }] }).span).toBeGreaterThan(1.5e6);
    expect(atlasFrame({ features: [{ feature: 'river', length: 50e3 }] }).anchor.length).toBe(50e3);
  });
});

describe('a river through a lake to the sea', () => {
  const P = composeAtlas(RIVER), R = P.C.placed.rivers[0];
  it('the declared river never rises from source to mouth, reaches the sea, and is as wide at its mouth as its band', () => {
    for (let i = 1; i < R.prof.length; i++) expect(R.prof[i]).toBeLessThanOrEqual(R.prof[i - 1]);
    expect(R.prof[R.prof.length - 1]).toBeLessThanOrEqual(1);
    const [lo, hi] = ATLAS_SIZES.river.river.mouth; expect(2 * R.halfW(1)).toBeGreaterThanOrEqual(lo); expect(2 * R.halfW(1)).toBeLessThanOrEqual(hi);
    const ch = P.declared[0].chan; for (let i = 1; i < ch.lvl.length; i++) expect(ch.lvl[i]).toBeLessThanOrEqual(ch.lvl[i - 1]);
  });
  it('every traced river runs downhill on its water', () => {
    let n = 0; for (const lv of P.levels) for (const c of lv.traced) { n++; for (let i = 1; i < c.lvl.length; i++) expect(c.lvl[i]).toBeLessThanOrEqual(c.lvl[i - 1] + 1e-9); }
    expect(n).toBeGreaterThan(20);
  });
  it('the lake stands flat at one level, no higher than its sill', () => {
    const k = P.C.placed.lakes[0], lv = P.levels[0]; const levels = [];
    for (let j = 0; j < lv.n; j++) for (let i = 0; i < lv.n; i++) { const x = lv.x0 + i * lv.dx, y = lv.y0 + j * lv.dx; if (Math.hypot(x - k.c[0], y - k.c[1]) < 0.4 * k.b && lv.water[j * lv.n + i]) levels.push(lv.wl[j * lv.n + i]); }
    expect(levels.length).toBeGreaterThan(5);
    expect(Math.max(...levels) - Math.min(...levels)).toBeLessThan(1);
    expect(Math.max(...levels)).toBeLessThanOrEqual(k.level + 1e-6);
  });
  it('each finer level sits in its parent, eight times finer, and meets it without a step', () => {
    const K = atlasKernel(P.K);
    for (let l = 1; l < P.levels.length; l++) {
      const a = P.levels[l - 1], b = P.levels[l];
      expect(b.x0).toBeGreaterThanOrEqual(a.x0); expect(b.x0 + b.ext).toBeLessThanOrEqual(a.x0 + a.ext); expect(b.dx).toBeCloseTo(a.dx / 8, 6);
      // walk in across the level's west edge at a metre a step: no jump bigger than the ground's own slope allows
      const y = b.y0 + b.ext * 0.5; let prev = K.groundAt(b.x0 - 200, y), worst = 0, prevG = K.gridAt(b.x0 - 200, y), worstG = 0;
      for (let x = b.x0 - 199; x < b.x0 + b.ext * 0.1; x += 1) {
        const z = K.groundAt(x, y), zg = K.gridAt(x, y); worst = Math.max(worst, Math.abs(z - prev)); worstG = Math.max(worstG, Math.abs(zg - prevG)); prev = z; prevG = zg;
      }
      expect(worstG).toBeLessThan(1); expect(worst).toBeLessThan(2.5);
    }
  });
  it('the page computes the same ground, water and colour from what it carries', () => {
    const f = atlasField({ world: RIVER }), page = atlasKernel(decodeDeep(f.pageConfig()));
    const [fx, fy] = P.focus; const pts = [[fx, fy], [fx + 350, fy - 120], [fx - 900, fy + 40], [0, 0], [P.C.S * 0.3, -P.C.S * 0.2]];
    for (const [X, Y] of pts) {
      const z = f.heightAt(X, Y); expect(page.heightAt(X, Y)).toBe(z); expect(page.waterAt(X, Y)).toBe(f.kernel.waterAt(X, Y));
      expect(page.colorAt(X, Y, z, [0, 0, 1])).toEqual(f.colorAt(X, Y, z, [0, 0, 1]));
    }
  });
});

describe('the world', () => {
  const M = { kind: 'terrain', world: RIVER };
  const live = assembleTerrainWorld(M, { live: true });
  it('stands you on dry ground at the river, at eye height, with bookmarks from the bank to the whole world', () => {
    expect(live.cameras.map((c) => c.name)).toEqual(['ground', 'aerial', 'region', 'world']);
    const f = atlasField({ world: RIVER }), [x, y, z] = live.walk.spawn;
    expect(f.kernel.waterAt(x, y)).toBe(null); expect(z - f.heightAt(x, y)).toBeCloseTo(1.7, 9);
    const r = f.kernel.riverAt(x, y); expect(r[0] - r[1]).toBeLessThan(300);            // on the bank, not somewhere else
    expect(live.meta.world.anchor.feature).toBe('river'); expect(live.meta.world.levels.length).toBeGreaterThan(1);
    expect(live.terrain.kernel).toMatch(/^function atlasKernel\(K\)/); expect(live.terrain.water).toBe(null);
    expect(() => new Function('THREE', 'scene', 'camera', 'walkColliders', terrainChannelScript(live.terrain))).not.toThrow();   // eslint-disable-line no-new-func
  });
  it('a city sites on the finest level, on dry ground, and the page carries its grade', () => {
    const p = assembleTerrainWorld({ ...M, cities: [{ profile: 'town', seed: 3, size: [300, 220] }] }, { live: true });
    const c = p.meta.cities[0], f = atlasField({ world: RIVER }), fin = f.siteBounds;
    expect(c.center[0]).toBeGreaterThan(fin.x[0]); expect(c.center[0]).toBeLessThan(fin.x[1]);
    expect(f.kernel.waterAt(c.center[0], c.center[1])).toBe(null); expect(c.masses).toBeGreaterThan(10);
    expect(p.terrain.K.grade).toHaveLength(1);
  });
  it('exports get the frame at its coarsest and each finer level as a patch', () => {
    const { faces } = assembleTerrainWorld(M); expect(faces.length).toBeGreaterThan(20000); expect(faces.every((q) => q.group === 'terrain-bake')).toBe(true);
  });
});

describe('determinism', () => {
  it('composes the same bytes twice from cold, and the plan reads no clock', () => {
    const W = { features: [{ feature: 'lake', size: 'tarn' }, { feature: 'coast', side: 'W' }], seed: 'twice' };
    clearAtlasMemo(); const a = atlasField({ world: W }); clearAtlasMemo(); const b = atlasField({ world: W });
    expect(b).not.toBe(a); expect(a.atlas).not.toHaveProperty('ms');
    expect(JSON.stringify(b.pageConfig())).toBe(JSON.stringify(a.pageConfig())); expect(JSON.stringify(b.atlas)).toBe(JSON.stringify(a.atlas));
  }, 120_000);
});

describe('validation teaches', () => {
  it('names the mistake', () => {
    expect(validateAtlas(RIVER)).toEqual([]);
    const e = (w) => validateAtlas(w).join(' ');
    expect(e({ features: [] })).toMatch(/non-empty list: the first is the anchor/);
    expect(e({ features: [{ feature: 'coast' }] })).toMatch(/one feature besides coasts/);
    expect(e({ features: [{ feature: 'ocean' }] })).toMatch(/feature must be one of river, range, lake, plateau, volcano, coast/);
    expect(e({ features: [{ feature: 'lake', size: 'huge' }] })).toMatch(/size must be one of lake, tarn, great/);
    expect(e({ features: [{ feature: 'river' }], climate: 'lunar' })).toMatch(/climate must be one of temperate/);
    expect(validateAtlas({ features: [{ feature: 'river' }, ...[...Array(7)].map(() => ({ feature: 'lake', size: 'tarn' }))] })).toEqual([]);
    expect(e({ features: [...Array(9)].map(() => ({ feature: 'lake', size: 'tarn' })) })).toMatch(/features holds at most 8 features \(got 9\)/);
    expect(() => assembleTerrainWorld({ kind: 'terrain', world: RIVER, span: 5000 })).toThrow(/span does not apply to a composed world/);
  });
});
