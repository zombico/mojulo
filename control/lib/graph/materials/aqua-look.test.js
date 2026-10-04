import { describe, expect, it } from 'vitest';

import { AQUA_KINDS, AQUA_PRESETS, gerstnerJacobian, resolveAquaLook, withAqua } from './aqua-look.js';
import { planOceanScene } from '../landscape/ocean-view.js';
import { surfaceChannelScript } from '../scene/channels/surface.js';

describe('resolveAquaLook', () => {
  it('resolves every preset to finite, rounded numbers', () => {
    for (const kind of AQUA_KINDS) {
      const L = resolveAquaLook(kind);
      expect(L.kind).toBe(kind);
      for (const v of [L.rough, L.nScale, L.nAmp, L.nSpeed, L.froth, L.foamThr, L.refl, ...L.flow, ...L.zen, ...L.hor, ...L.gnd, ...L.sigma]) {
        expect(Number.isFinite(v)).toBe(true);
        expect(+v.toFixed(4)).toBe(v);
      }
      expect(Math.hypot(...L.flow)).toBeCloseTo(1, 3);
    }
  });

  it('is pure: the same arguments give the same bytes', () => {
    const a = JSON.stringify(resolveAquaLook({ kind: 'river', nAmp: 0.3 }, { bg: '#cfe6f2', unit: 2 }));
    expect(JSON.stringify(resolveAquaLook({ kind: 'river', nAmp: 0.3 }, { bg: '#cfe6f2', unit: 2 }))).toBe(a);
  });

  it('returns null for an unknown kind or no spec', () => {
    expect(resolveAquaLook('lava')).toBeNull();
    expect(resolveAquaLook(null)).toBeNull();
    expect(resolveAquaLook({ nAmp: 0.2 })).toBeNull();
  });

  it('clamps overrides into the shader-safe range and ignores junk', () => {
    const L = resolveAquaLook({ kind: 'lake', rough: 9, nAmp: -1, refl: 'x', flow: [0, 0] });
    expect(L.rough).toBe(0.5);
    expect(L.nAmp).toBe(0);
    expect(L.refl).toBe(AQUA_PRESETS.lake.refl);
    expect(L.flow).toEqual(resolveAquaLook('lake').flow);
  });

  it('scales ripple frequency, drift and absorption by the scene unit', () => {
    const a = resolveAquaLook('ocean'), b = resolveAquaLook('ocean', { unit: 2 });
    expect(b.nScale).toBeCloseTo(a.nScale / 2, 3);
    expect(b.nSpeed).toBeCloseTo(a.nSpeed * 2, 3);
    expect(b.sigma[0]).toBeCloseTo(a.sigma[0] / 2, 3);
  });

  it('reflects the scene sky when it has one, else the background, else an overcast default', () => {
    const sky = resolveAquaLook('lake', { sky: { zenith: [40, 80, 140], horizon: [200, 160, 120] } });
    const bg = resolveAquaLook('lake', { bg: '#0a1a2e' });
    const none = resolveAquaLook('lake');
    expect(sky.hor[0]).toBeGreaterThan(sky.hor[2]);   // the warm horizon came through
    expect(bg.zen[2]).toBeLessThan(0.05);              // a dark background stays dark
    expect(none.hor[2]).toBeGreaterThan(none.zen[2]);
  });
});

describe('withAqua', () => {
  const sfs = [{ grid: {} }, { grid: {}, aqua: { kind: 'pool' } }];
  it('attaches the fallback look, keeps a surface that already has one', () => {
    const out = withAqua(sfs, undefined, 'ocean');
    expect(out[0].aqua.kind).toBe('ocean');
    expect(out[1].aqua.kind).toBe('pool');
  });
  it('honours a recipe kind, falls back on an unknown one, and opts out with false', () => {
    expect(withAqua(sfs, 'lagoon', 'ocean')[0].aqua.kind).toBe('lagoon');
    expect(withAqua(sfs, 'nonsense', 'ocean')[0].aqua.kind).toBe('ocean');
    expect(withAqua(sfs, false, 'ocean')).toBe(sfs);
  });
});

describe('gerstnerJacobian (whitecaps)', () => {
  it('is 1 on still water', () => {
    expect(gerstnerJacobian([], 3, 4, 1)).toBe(1);
    expect(gerstnerJacobian([{ dx: 1, dy: 0, A: 1, k: 1, om: 1, ph: 0, Q: 0 }], 3, 4, 1)).toBe(1);
  });

  it('pinches below the ocean threshold on a steep sea and stays calm on a long swell', () => {
    const minJ = (scenario) => {
      const { waves } = planOceanScene({ scenario }).surfaces[0];
      let m = 9;
      for (let t = 0; t < 20; t += 2.5) for (let x = -65; x < 65; x += 1.7) for (let y = -65; y < 65; y += 1.7) m = Math.min(m, gerstnerJacobian(waves, x, y, t));
      return m;
    };
    const thr = resolveAquaLook('ocean').foamThr;
    expect(minJ('storm')).toBeLessThan(thr);
    expect(minJ('chop')).toBeLessThan(thr);
    expect(minJ('swell')).toBeGreaterThan(thr);
  });

  it('matches the page-side copy in the surface channel', () => {
    const src = surfaceChannelScript([{ grid: { nx: 2, ny: 2, w: 1, d: 1 }, waves: [], aqua: resolveAquaLook('ocean') }]);
    const body = src.slice(src.indexOf('function _gjac'), src.indexOf('\n}\n', src.indexOf('function _gjac')) + 2);
    const pageJac = new Function(`${body}; return _gjac;`)();
    const { waves } = planOceanScene({ scenario: 'storm' }).surfaces[0];
    for (const [x, y, t] of [[0, 0, 0], [12.5, -3, 4.2], [-40, 22, 9.9]]) expect(pageJac(waves, x, y, t)).toBeCloseTo(gerstnerJacobian(waves, x, y, t), 12);
  });

  it('splices no aqua code into a page whose surfaces have no look', () => {
    const src = surfaceChannelScript([{ grid: { nx: 2, ny: 2, w: 1, d: 1 }, waves: [] }]);
    expect(src).not.toMatch(/__aqPatch|_gjac|aAqFoam/);
  });
});
