import { describe, it, expect } from 'vitest';
import { shineKernel, shineOptics, faceShine, inside, refract } from './crystal-shine.js';
import { crystalPolytope } from './crystal-optics.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
const Rz = (deg) => { const a = (deg * Math.PI) / 180; return [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]]; };
const mv = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];
/** A posed stone: world planes and faces (centroid, normal, index). */
function stone(gem, cut = 'natural', R = Rz(0)) {
  const p = crystalPolytope(gem, { size: 2, cut });
  const planes = p.planes.map((pl) => ({ n: mv(R, pl.n), d: pl.d }));
  const faces = p.faces.map((ix, i) => ({ centroid: mv(R, ix.reduce((a, k) => a.map((v, j) => v + p.vertices[k][j] / ix.length), [0, 0, 0])), normal: mv(R, p.normals[i]), index: i }));
  return { planes, faces, optics: shineOptics(gem) };
}
const V = unit([0.1, -1, 0.35]), L = unit([-0.3, -0.6, 0.75]);
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

describe('crystal-shine', () => {
  it('the kernel is self-contained: rebuilt from its source (as a page embeds it), it gives the same numbers', () => {
    const K = new Function(`return (${shineKernel.toString()})()`)(); const s = stone('ruby');
    for (const f of s.faces.slice(0, 6)) expect(JSON.stringify(K.faceShine({ optics: s.optics, planes: s.planes, face: f, V, L }))).toBe(JSON.stringify(faceShine({ optics: s.optics, planes: s.planes, face: f, V, L })));
  });
  it('a facet mirroring the sun toward the eye glints', () => {
    const s = stone('quartz'); const f = s.faces.find((q) => dot(q.normal, V) > 0.3);
    const mirrorL = unit(Array.from({ length: 3 }, (_, k) => 2 * dot(f.normal, V) * f.normal[k] - V[k]));   // V reflected about N
    expect(lum(faceShine({ optics: s.optics, planes: s.planes, face: f, V, L: mirrorL }).rgb)).toBeGreaterThan(5 * lum(faceShine({ optics: s.optics, planes: s.planes, face: f, V, L }).rgb));
  });
  it("fire: through the same brilliant, diamond's red and blue leave a facet about twice as far apart as quartz's (4.2° against 2.1°)", () => {
    const P = crystalPolytope('diamond', { size: 2, cut: 'brilliant' }); const V2 = unit([0.1, -0.5, 0.85]);
    const spread = (gem) => { const o = shineOptics(gem); let s = 0, n = 0;
      for (let i = 0; i < P.faces.length; i++) { const N = P.normals[i]; if (dot(N, V2) <= 0.1) continue; const c = P.faces[i].reduce((a, k) => a.map((v, j) => v + P.vertices[k][j] / P.faces[i].length), [0, 0, 0]);
        const exit = (k) => { const t = refract(V2.map((x) => -x), N, 1 / o.n.o[k]); return t && inside(P.planes, c, t, o.n.o[k], 3).dir; };
        const r = exit(0), b = exit(2); if (r && b) { s += Math.acos(Math.min(1, dot(r, b))); n++; } }
      return s / n; };
    expect(spread('diamond')).toBeGreaterThan(1.6 * spread('quartz'));
  });
  it('tourmaline is dark looking down c and green across it', () => {
    const slab = [{ n: [0, 1, 0], d: 1 }, { n: [0, -1, 0], d: 1 }, { n: [1, 0, 0], d: 5 }, { n: [-1, 0, 0], d: 5 }, { n: [0, 0, 1], d: 5 }, { n: [0, 0, -1], d: 5 }];
    const face = { centroid: [0, -1, 0], normal: [0, -1, 0], index: 0 }; const view = [0, -1, 0], sun = [0, 1, 0];   // looking through at the sun
    const o = shineOptics('tourmaline'); const run = (axis) => faceShine({ optics: o, planes: slab, face, V: view, L: sun, axis, cmPerUnit: 0.15, studio: { sun: 1, halo: 0 } }).rgb;
    const along = run([0, 1, 0]), across = run([1, 0, 0]);
    expect(lum(across)).toBeGreaterThan(5 * lum(along)); expect(across[1]).toBeGreaterThan(across[0]); expect(across[1]).toBeGreaterThan(across[2]);
  });
  it('ruby glows red, more on the side the light reaches', () => {
    const s = stone('ruby'); const lit = s.faces.filter((f) => dot(f.normal, V) > 0.2).map((f) => ({ f, l: dot(f.normal, L) })).sort((a, b) => b.l - a.l);
    const a = faceShine({ optics: s.optics, planes: s.planes, face: lit[0].f, V, L, studio: { sun: 0, halo: 0, sky: [0, 0, 0], floor: [0, 0, 0] } }).rgb;
    const b = faceShine({ optics: s.optics, planes: s.planes, face: lit[lit.length - 1].f, V, L, studio: { sun: 0, halo: 0, sky: [0, 0, 0], floor: [0, 0, 0] } }).rgb;
    expect(a[0]).toBeGreaterThan(5 * a[1]); expect(a[0]).toBeGreaterThan(b[0]);
  });
  it('opal flashes spectral colour, and the colour moves as the stone turns', () => {
    const flashes = (yaw) => { const s = stone('opal', 'natural', Rz(yaw)); return s.faces.map((f) => faceShine({ optics: s.optics, planes: s.planes, face: f, V, L }).rgb).filter((c) => Math.max(...c) > 0.3).map((c) => c.map((v) => v.toFixed(2)).join()); };
    const a = flashes(0), b = flashes(25); expect(a.length + b.length).toBeGreaterThan(0); expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
  it('a facet turned away from the eye contributes nothing', () => {
    const s = stone('quartz'); const back = s.faces.find((f) => dot(f.normal, V) < -0.2); expect(faceShine({ optics: s.optics, planes: s.planes, face: back, V, L }).alpha).toBe(0);
  });
});
