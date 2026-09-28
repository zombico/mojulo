/**
 * terrain field. Claims under test: deterministic; at the painting's grid nodes the ground
 * (detail off) is the painted scene's height × the scale, to one quantisation step; the detail follows its Hurst law
 * (variogram slope ≈ 2H in its band) and is bounded; the kernel inlined from its source text, fed the page's base64
 * grids, computes the same ground bit for bit; past the painting the ground eases to the horizon's base; the spec teaches.
 */
import { describe, expect, it } from 'vitest';

import { terrainField, validateTerrainSpec } from './terrain-field.js';
import { terrainKernel } from './terrain-kernel.js';
import { paintedTerrainState } from '../polygonizer/painted-landscape.js';

const FROM = { heartbeat: 'rocky-irregular', splatch: 'verdure-trio', seed: 'field',
  landform: [{ op: 'scarp', path: [[-16, -6], [16, -9]], throw: 3, side: 'right' }, { op: 'strata', thickness: 0.6 }, { op: 'talus', retreat: 0.3 }] };

describe('terrain field', () => {
  it('is deterministic', () => {
    const a = terrainField({ from: FROM }), b = terrainField({ from: FROM });
    expect(JSON.stringify(a.pageConfig())).toBe(JSON.stringify(b.pageConfig()));
    for (const p of [[0, 0], [300, -700], [-900, 1200]]) expect(a.heightAt(...p)).toBe(b.heightAt(...p));
  });
  it('at the grid nodes it is the painted height × the scale, to one quantisation step', () => {
    const f = terrainField({ from: FROM, span: 1200, relief: 1.5, detail: false }); const st = paintedTerrainState({ kind: 'painted-landscape', ...FROM }).state;
    const tol = f.K.hStep * f.K.zs * 0.51;
    for (let j = 3; j < st.ny; j += 37) for (let i = 5; i < st.nx; i += 29) {
      const [X, Y] = f.kernel.toWorld(st.x0 + i * st.dx, st.y0 + j * st.dx);
      expect(Math.abs(f.heightAt(X, Y) - st.z[j * st.nx + i] * f.K.zs)).toBeLessThanOrEqual(tol);
    }
    expect(f.K.s).toBe(1200 / 24); expect(f.K.zs).toBe(75);
  });
  it('the detail follows its Hurst law and is bounded', () => {
    const f = terrainField({ from: FROM, detail: { hurst: 0.8, crossover: 64, min: 0.5 } });
    const gamma = (h) => { let a = 0, n = 0; for (let x = 0; x < 4000; x += 1.37) { const d = f.kernel.detail(x, 11.3 * Math.sin(x)) - f.kernel.detail(x + h, 11.3 * Math.sin(x)); a += d * d; n++; } return a / n; };
    const hs = [1, 2, 4, 8], lg = hs.map((h) => Math.log(gamma(h))); const lx = hs.map(Math.log);
    const mx = lx.reduce((a, b) => a + b) / 4, my = lg.reduce((a, b) => a + b) / 4;
    const slope = lx.reduce((a, x, i) => a + (x - mx) * (lg[i] - my), 0) / lx.reduce((a, x) => a + (x - mx) ** 2, 0);
    expect(slope).toBeGreaterThan(2 * 0.8 - 0.35); expect(slope).toBeLessThan(2 * 0.8 + 0.35);
    for (let x = 0; x < 2000; x += 3.1) expect(Math.abs(f.kernel.detail(x, x * 0.7))).toBeLessThanOrEqual(1.5);
  });
  it('the page kernel — its source text on the base64 grids — computes the same ground bit for bit', () => {
    const f = terrainField({ from: FROM }); const cfg = JSON.parse(JSON.stringify(f.pageConfig()));
    const dec = (b, T) => { const u = Uint8Array.from(Buffer.from(b, 'base64')); return new T(u.buffer, 0, u.byteLength / T.BYTES_PER_ELEMENT); };
    const K = { ...cfg, hq: dec(cfg.grids.hq, Uint16Array), hard: dec(cfg.grids.hard, Uint8Array), apron: dec(cfg.grids.apron, Uint8Array) };
    const page = new Function(`return (${terrainKernel.toString()})`)()(K);   // eslint-disable-line no-new-func
    for (let X = -1500; X <= 1500; X += 97.3) for (let Y = -1800; Y <= 1800; Y += 131.1) {
      expect(page.heightAt(X, Y)).toBe(f.heightAt(X, Y));
      const n = f.normalAt(X, Y, 2); expect(page.colorAt(X, Y, f.heightAt(X, Y), n)).toEqual(f.colorAt(X, Y, f.heightAt(X, Y), n));
    }
  });
  it('past the painting the ground eases to the horizon', () => {
    const plain = terrainField({ from: FROM, detail: false }), none = terrainField({ from: FROM, horizon: 'none', detail: false }), sea = terrainField({ from: FROM, horizon: 'sea', detail: false });
    const far = 20000; const base = plain.K.horizon.base * plain.K.zs, amp = plain.K.horizon.amp * plain.K.zs;
    expect(Math.abs(plain.heightAt(far, 0) - base)).toBeLessThanOrEqual(amp + 1e-9);
    expect(none.heightAt(far, 0)).toBe(none.heightAt(1400, 0));          // beyond the grid's last column: the edge, clamped
    expect(sea.heightAt(far, 0)).toBeLessThan(sea.meta.sea);
  });
  it('the spec teaches', () => {
    expect(validateTerrainSpec({ from: FROM })).toEqual([]);
    const e = (s) => validateTerrainSpec(s).join(' ');
    expect(e({})).toMatch(/from must be a painted-landscape recipe/);
    expect(e({ from: FROM, span: 5 })).toMatch(/span must be/);
    expect(e({ from: FROM, horizon: 'lava' })).toMatch(/horizon must be one of plain, sea, none/);
    expect(e({ from: FROM, detail: { hurst: 3 } })).toMatch(/hurst/);
    expect(() => terrainField({ from: { heartbeat: 'nope', splatch: 'verdure-trio' } })).toThrow(/painted-landscape/i);
  });
});
