import { describe, it, expect } from 'vitest';
import { crystalPrint, printKernel, printOptics, tracePrint } from './crystal-print.js';
import { crystalPolytope, crystalIndex, CRYSTAL_GEMS } from './crystal-optics.js';

const DEG = Math.PI / 180;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
/** The rotation taking unit `from` onto unit `to` (Rodrigues). */
function rotTo(from, to) {
  const f = unit(from), t = unit(to), c = dot(f, t); if (c > 1 - 1e-12) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const k = c < -1 + 1e-12 ? unit(cross(f, Math.abs(f[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])) : unit(cross(f, t)); const a = Math.acos(Math.max(-1, Math.min(1, c)));
  const [x, y, z] = k, s = Math.sin(a), C = 1 - Math.cos(a), co = Math.cos(a);
  return [[co + x * x * C, x * y * C - z * s, x * z * C + y * s], [y * x * C + z * s, co + y * y * C, y * z * C - x * s], [z * x * C - y * s, z * y * C + x * s, co + z * z * C]];
}
const rest = (poly, n) => { const R = rotTo(n, [0, 0, -1]); const zmin = Math.min(...poly.vertices.map((v) => dot(R[2], v))); return { R, at: [0, 0, -zmin] }; };
const centroid = (P) => P.reduce((a, p) => [a[0] + p[0] / P.length, a[1] + p[1] / P.length], [0, 0]);
const area = (P) => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - a[1] * b[0]; } return Math.abs(s) / 2; };

describe('crystal-print: flux is conserved', () => {
  it('a black opal throws only its shadow', () => {
    const poly = crystalPolytope('opal', { size: 1 }); const r = crystalPrint({ gem: 'opal', poly, pose: rest(poly, [0, 0, -1]), light: { dir: unit([0.5, 0.3, -0.8]) } });
    expect(r.polygons).toHaveLength(0); expect(r.shadow.length).toBeGreaterThan(3);
  });
  it.each(CRYSTAL_GEMS.filter((g) => g !== 'opal'))('%s under an oblique sun: incident = reflected + received + escaped + absorbed + truncated', (gem) => {
    const poly = crystalPolytope(gem, { size: 1 }); const pose = rest(poly, poly.normals[0]);
    const { stats } = crystalPrint({ gem, poly, pose, light: { dir: unit([0.5, 0.3, -0.8]) }, bands: 3 });
    const out = stats.reflectedAtEntry + stats.toReceiver + stats.escaped + stats.absorbed + stats.truncated;
    expect(stats.incident).toBeGreaterThan(0); expect(Math.abs(out - stats.incident) / stats.incident).toBeLessThan(1e-6);
  });
});

describe('crystal-print: the signatures', () => {
  it("calcite's double image: straight down through a cleavage rhomb, the e ray lands t·tan(walk-off) from the o ray", () => {
    const poly = crystalPolytope('calcite', { size: 1 }); const top = poly.normals[0]; const pose = rest(poly, top.map((x) => -x));   // face 0 up
    const t = poly.planes[0].d * 2; const r = crystalPrint({ gem: 'calcite', poly, pose, light: { dir: [0, 0, -1] }, bands: 6, depth: 0 });
    // the top face's corners, as the light sees them: the o ray lands under them, the e ray shifted by the walk-off
    const corners = poly.faces[0].map((i) => { const v = poly.vertices[i]; return [dot(pose.R[0], v), dot(pose.R[1], v)]; });
    const direct = r.polygons.filter((p) => p.via[0] === 0 && p.band === 4);   // entering the top face, the 585–630 nm band
    const no = crystalIndex('calcite', 'o', 607.5), ne = crystalIndex('calcite', 'e', 607.5); const thK = 44.63 * DEG;
    const want = t * Math.tan(Math.atan((no / ne) ** 2 * Math.tan(thK)) - thK);
    const hits = (mode, shift) => direct.filter((p) => p.mode === mode).some((p) => p.corners.some((q) => corners.some((c) => Math.abs(Math.hypot(q[0] - c[0], q[1] - c[1]) - shift) < 2e-4)));
    expect(hits('o', 0)).toBe(true);
    expect(hits('e', want)).toBe(true);
    expect(want).toBeCloseTo(0.0574, 3);
  });
  it('dispersion: through one entry and one exit, violet bends more than red (the prism rule)', () => {
    const poly = crystalPolytope('quartz', { size: 1 }); const L = unit([0.3, -0.5, -0.8]);
    const r = crystalPrint({ gem: 'quartz', poly, pose: { at: [0, 0, 2] }, light: { dir: L }, bands: 6, depth: 0 }); const m = new Map();
    for (const p of r.polygons) { const k = p.via.join('>') + p.mode; (m.get(k) || m.set(k, []).get(k)).push(p); }
    const dev = (p) => Math.acos(Math.min(1, dot(p.dir, L))); let prisms = 0;
    for (const ps of m.values()) { const red = ps.find((p) => p.band === 5), violet = ps.find((p) => p.band === 0); if (!red || !violet || dev(red) < 1e-6) continue;
      expect(dev(violet)).toBeGreaterThan(dev(red)); prisms++; }
    expect(prisms).toBeGreaterThan(4);
  });
  it("diamond traps light: no path leaves through a facet pair (critical angle 24.4°); it leaves only after internal reflections", () => {
    const poly = crystalPolytope('diamond', { size: 1 }); const L = unit([0.3, -0.5, -0.8]);
    const bent = (gem, depth) => crystalPrint({ gem, poly, pose: { at: [0, 0, 2] }, light: { dir: L }, bands: 6, depth }).polygons.filter((p) => Math.acos(Math.min(1, dot(p.dir, L))) > 1e-6);
    expect(bent('diamond', 0)).toHaveLength(0); expect(bent('quartz', 0).length).toBeGreaterThan(0);
    expect(bent('diamond', 2).length).toBeGreaterThan(0);
  });
  it('ruby throws red light; tourmaline across c throws green at about half (the o ray dies)', () => {
    const sum = (gem, n) => { const poly = crystalPolytope(gem, { size: 1 }); const pose = rest(poly, n(poly)); const r = crystalPrint({ gem, poly, pose, light: { dir: [0, 0, -1] }, bands: 6, depth: 1 });
      return r.polygons.reduce((a, p) => a.map((v, k) => v + p.rgb[k] * area(p.corners)), [0, 0, 0]); };
    const ruby = sum('ruby', () => [0, 0, -1]); expect(ruby[0]).toBeGreaterThan(ruby[1] * 5);
    const tour = sum('tourmaline', (p) => p.normals[p.forms.indexOf('11-20')]); expect(tour[1]).toBeGreaterThan(tour[0]); expect(tour[1]).toBeGreaterThan(tour[2]);
    const quartz = sum('quartz', (p) => p.normals[0]);
    expect(tour[1] / quartz[1]).toBeLessThan(0.6);
  });
  it('the shadow is the silhouette on the receiver', () => {
    const poly = crystalPolytope('quartz', { size: 1 }); const pose = rest(poly, poly.normals[0]);
    const r = crystalPrint({ gem: 'quartz', poly, pose, light: { dir: [0, 0, -1] } });
    expect(r.shadow.length).toBeGreaterThanOrEqual(4); for (const p of r.shadow) expect(p[2]).toBe(0); expect(area(r.shadow)).toBeGreaterThan(0.05);
  });
});

describe('crystal-print: budget and determinism', () => {
  it('keeps the brightest pieces within maxPolygons and says what it dropped', () => {
    const poly = crystalPolytope('diamond', { cut: 'brilliant', size: 1 });
    const r = crystalPrint({ gem: 'diamond', poly, pose: { at: [0, 0, 0.6] }, light: { dir: unit([0.3, 0.2, -0.9]) }, bands: 6, depth: 2, maxPolygons: 120 });
    expect(r.polygons).toHaveLength(120); expect(r.stats.dropped).toBeGreaterThan(0);
  });
  it('the kernel is self-contained: rebuilt from its source (as a page embeds it), it traces the same bytes', () => {
    const K = new Function(`return (${printKernel.toString()})()`)(); const poly = crystalPolytope('calcite', { size: 1 });
    const args = { optics: JSON.parse(JSON.stringify(printOptics('calcite', 3))), poly, pose: rest(poly, poly.normals[0]), light: { dir: unit([0.3, 0.4, -0.85]) }, depth: 1 };
    expect(JSON.stringify(K.tracePrint(args))).toBe(JSON.stringify(tracePrint(args)));
  });
  it('same input, same bytes', () => {
    const poly = crystalPolytope('ruby', { size: 1 }); const a = () => JSON.stringify(crystalPrint({ gem: 'ruby', poly, pose: rest(poly, [0, 0, -1]), light: { dir: unit([0.4, -0.2, -0.9]) } }));
    expect(a()).toBe(a());
  });
});
