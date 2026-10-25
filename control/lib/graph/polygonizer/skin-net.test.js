// skin-net.js: a surface net sampled along the surface, made sound, simplified by quadrics. On a sphere and a capsule
// (the smallest fields with a curve and a straight run): closed, wound outward, on the surface, deterministic; the
// simplifier keeps it closed and near the field, never past a locked point; a hole fanned shut.
import { describe, it, expect } from 'vitest';
import { netSkin, soundMesh, simplifyMesh, boundaryLoops, closeHoles } from './skin-net.js';

const sphere = (p) => Math.hypot(p.x, p.y, p.z) - 0.05;
const capsule = (p) => Math.hypot(p.x, p.y, p.z - Math.max(-0.03, Math.min(0.03, p.z))) - 0.02;
const box = (r) => ({ min: { x: -r, y: -r, z: -r }, max: { x: r, y: r, z: r } });
const edges = (F) => { const m = new Map(); for (const t of F) for (let a = 0; a < 3; a++) { const u = t[a], w = t[(a + 1) % 3], k = u < w ? `${u}|${w}` : `${w}|${u}`; m.set(k, (m.get(k) || 0) + 1); } return [...m.values()]; };
const outward = (V, F) => F.every((t) => { const [a, b, c] = t.map((i) => V[i]), n = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])]; return n[0] * (a[0] + b[0] + c[0]) + n[1] * (a[1] + b[1] + c[1]) + n[2] * (a[2] + b[2] + c[2]) > 0; });
const far = (V, f) => Math.max(...V.map((p) => Math.abs(f({ x: p[0], y: p[1], z: p[2] }))));

describe('the skin net', () => {
  it('nets a field along its surface: closed, outward, on it, the same twice', () => {
    for (const [f, r] of [[sphere, 0.06], [capsule, 0.06]]) {
      const { V, F } = netSkin(f, box(r), { cell: 0.004 });
      const S = soundMesh(V, F, { out: (c) => c });
      expect(edges(S).every((n) => n === 2)).toBe(true);
      expect(outward(V, S)).toBe(true);
      expect(far(V, f)).toBeLessThan(0.0005);
      expect(netSkin(f, box(r), { cell: 0.004 })).toEqual({ V, F });
    }
  });
  it('simplifies by quadrics: closed, near the field, a locked point kept where it was', () => {
    const { V, F } = netSkin(capsule, box(0.06), { cell: 0.003 }), S0 = soundMesh(V, F, { out: (c) => c });
    const locked = new Uint8Array(V.length); locked[S0[0][0]] = 1;
    const S = simplifyMesh(V, S0, { target: Math.round(S0.length / 4), locked });
    expect(S.F.length).toBeLessThanOrEqual(Math.round(S0.length / 4) + 2);
    expect(edges(S.F).every((n) => n === 2)).toBe(true);
    expect(far(S.V, capsule)).toBeLessThan(0.001);
    expect(S.V[S.of[S0[0][0]]]).toEqual(V[S0[0][0]]);
  });
  it('fans a hole shut', () => {
    const { V, F } = netSkin(sphere, box(0.06), { cell: 0.005 }), S = soundMesh(V, F, { out: (c) => c }).slice(3);
    expect(boundaryLoops(S).length).toBe(1);
    const C = closeHoles(V, S, sphere);
    expect(boundaryLoops(C.F)).toEqual([]);
    expect(edges(C.F).every((n) => n === 2)).toBe(true);
  });
});
