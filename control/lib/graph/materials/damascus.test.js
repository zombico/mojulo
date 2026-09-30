// damascus — the pattern-welded field holds the forge's facts (layers = L0 · 2^folds, a twist repeats at its pitch, a
// ladder's rungs at its groove spacing), a metal spec takes `pattern` without moving any existing key, and the billet
// coordinates reach the page only when a face is pattern-welded.
import { describe, expect, it } from 'vitest';
import { damascusOptions, damascusQ, brightFraction, damascusError } from './damascus.js';
import { resolveMetalSurface, metalSurfaceError } from './metal-surface.js';
import { tagFacesWithMetal } from '../polygonizer/materials.js';
import { faceListToMesh } from '../figures/face-mesh.js';
import { metalChannelInputs } from '../scene/channels/metal.js';

describe('the field', () => {
  it('layers across the plain stack = L0 · 2^folds', () => {
    for (const folds of [3, 5]) {
      const o = { ...damascusOptions({ folds }), wave: 0 }; let flips = 0, prev = null; const n = 20000;
      for (let i = 0; i <= n; i++) { const y = -o.stock / 2 + o.stock * i / n; const par = Math.floor(damascusQ('random', 0, y, 0, o) / o.spacing) & 1; if (prev !== null && par !== prev) flips++; prev = par; }
      expect(Math.abs(flips + 1 - o.N)).toBeLessThanOrEqual(1);
    }
  });
  it('a twist repeats at its pitch (40 mm × scale)', () => {
    for (const scale of [1, 2]) {
      const o = damascusOptions({ folds: 3, scale }); const n = 4000, L = 0.16 * scale;
      const sig = Array.from({ length: n }, (_, i) => (Math.floor(damascusQ('twist', L * i / n, 0.0015 * scale, 0.002 * scale, o) / o.spacing) & 1 ? 1 : -1));
      let best = [-2, 0]; for (let lag = 200; lag < n / 2; lag++) { let c = 0; for (let i = 0; i + lag < n; i++) c += sig[i] * sig[i + lag]; c /= n - lag; if (c > best[0]) best = [c, lag]; }
      expect(Math.abs(L * best[1] / n - o.pitch)).toBeLessThan(0.002 * scale);
    }
  });
  it('a ladder rungs at its groove spacing (6 mm)', () => {
    const o = damascusOptions(); const n = 4000, L = 0.12; const sig = Array.from({ length: n }, (_, i) => damascusQ('ladder', L * i / n, 0.0017, 0.02, o));
    const m = sig.reduce((a, b) => a + b) / n; let best = [0, 0];
    for (let k = 3; k < 80; k++) { let re = 0, im = 0; sig.forEach((v, i) => { re += (v - m) * Math.cos(2 * Math.PI * k * i / n); im += (v - m) * Math.sin(2 * Math.PI * k * i / n); }); if (re * re + im * im > best[0]) best = [re * re + im * im, k]; }
    expect(Math.abs(L / best[1] - o.rung)).toBeLessThan(0.0003);
  });
  it('the etch is a filtered square wave: crisp at a point, its mean grey over many layers', () => {
    const s = 1e-5;
    expect([brightFraction(0.5 * s, 0, s), brightFraction(1.5 * s, 0, s)]).toEqual([0, 1]);
    expect(brightFraction(0.001, 40 * s, s)).toBeCloseTo(0.5, 2);
  });
});

describe('the spec', () => {
  it('a pattern joins the key only when present; every existing key is unchanged', () => {
    expect(resolveMetalSurface({ metal: 'stainless', finish: 'brushed', along: 'x' }).key).toBe('{"metal":"stainless","finish":"brushed","along":"x","seed":0}');
    const d = resolveMetalSurface({ metal: 'steel', pattern: { kind: 'damascus', type: 'twist' } });
    expect(d.fig).toBe(8); expect(d.finish).toBe('polished'); expect(d.along).toBe('z');
    expect(JSON.parse(d.key).pattern).toEqual({ kind: 'damascus', type: 'twist', folds: 4, scale: 1, layers: 'y' });
  });
  it('bad patterns name the choices', () => {
    expect(metalSurfaceError({ metal: 'steel', pattern: { kind: 'damascus', type: 'wavy' } })).toMatch(/random, ladder, raindrop, twist/);
    expect(metalSurfaceError({ metal: 'gold', pattern: { kind: 'damascus' } })).toMatch(/steel or stainless/);
    expect(metalSurfaceError({ metal: 'steel', finish: 'brushed', pattern: { kind: 'damascus' } })).toMatch(/etched/);
    expect(damascusError({ kind: 'damascus', folds: 12 })).toMatch(/1–8/);
  });
});

describe('to the page', () => {
  const quad = () => [{ corners: [[0, 0.3, 0], [1, 0.3, 0], [1, 0.3, 10], [0, 0.3, 10]], fill: '#888888' }];
  it('a pattern-welded face carries its corners\' place in the billet; the mesh packs it; the channel gets its dials', () => {
    const s = resolveMetalSurface({ metal: 'steel', pattern: { kind: 'damascus', type: 'ladder', folds: 3 } });
    const faces = tagFacesWithMetal(quad(), s);
    expect(faces[0].metal.p.map(([y]) => y)).toEqual([0.3, 0.3, 0.3, 0.3]);   // depth: through y
    const mesh = faceListToMesh(faces);
    expect(mesh.metP.length).toBe(mesh.vertexCount * 3);
    expect(metalChannelInputs([s.key]).surfaces[0].D).toEqual([1, 3, 1, 0]);
  });
  it('a plain metal packs no billet buffer and no pattern dials (byte-identical)', () => {
    const s = resolveMetalSurface({ metal: 'steel', finish: 'polished' });
    const mesh = faceListToMesh(tagFacesWithMetal(quad(), s));
    expect(mesh.metP).toBeUndefined();
    expect(metalChannelInputs([s.key]).surfaces[0].D).toBeUndefined();
  });
});
