import { describe, it, expect } from 'vitest';
import { shaderPage, shaderPayload, pixelRay } from './shader.js';
import { judge, conformanceGate, runConformance, darkDiskRadius } from './conformance.js';
import { selftestCase } from './conformance-selftest.js';
import { emitThreeWorld } from '@/lib/graph/scene/scene-three';

// The shader rule's machinery without a browser: one GLSL source makes the image and the probe; the probe rides only a
// capture run; the gate's verdict is judged from numbers (a stub browser stands in for Chrome).

describe('science worlds: a shader-drawn page and its conformance gate', () => {
  it('makes the image and the probe from one source, declaring the model\'s numbers once', () => {
    const { layer, probe } = shaderPage({ glsl: 'vec4 sciValue(vec4 a, vec4 b) { return vec4(uM); } vec4 sciImage(vec3 ro, vec3 rd) { return vec4(uC, 1.0); }', uniforms: { uM: 2, uC: [1, 0, 0] } });
    for (const frag of [layer.frag, probe.frag]) expect(frag).toMatch(/uniform float uM;\nuniform vec3 uC;/);
    expect(layer.frag).toContain('sciImage(uCamPos, rd)');
    expect(probe.frag).toContain('sciValue(a, b)');
    expect(layer.customUniforms).toEqual({ uM: 2, uC: [1, 0, 0] });
    expect(() => shaderPage({ glsl: 'vec4 sciImage(vec3 ro, vec3 rd) { return vec4(1.0); }' })).toThrow(/sciValue/);
    expect(() => shaderPage({ glsl: layer.frag, uniforms: { uRes: 1 } })).toThrow(/reserved/);
    expect(() => shaderPage({ glsl: layer.frag, uniforms: { uM: 'two' } })).toThrow(/a number or \[x, y, z\]/);
  });

  it('casts the centre pixel\'s ray straight at the target, as the image shader does', () => {
    const { rd } = pixelRay({ pos: [8, 0, 0], target: [0, 0, 0], vfov: 40 }, 159.5, 119.5, 320, 240);
    expect(rd[0]).toBeCloseTo(-1, 9);
  });

  it('carries the probe only on a capture run: an ordinary page has none of it', () => {
    const { payload } = selftestCase();
    const plain = emitThreeWorld({ ...payload, inline: true });
    const { probe, ...noProbe } = payload.science;
    expect(plain).toBe(emitThreeWorld({ ...payload, science: noProbe, inline: true }));
    expect(plain).not.toContain('__sciProbe');
    expect(emitThreeWorld({ ...payload, inline: true, capture: true })).toContain('window.__sciProbe');
    expect(emitThreeWorld({ ...payload, science: noProbe, inline: true, capture: true })).not.toContain('__sciProbe');
    const bare = shaderPage({ glsl: 'vec4 sciValue(vec4 a, vec4 b) { return vec4(0.0); } vec4 sciImage(vec3 ro, vec3 rd) { return vec4(1.0); }' });
    expect(() => shaderPayload({ shader: bare, points: [[0, 0, 0]] })).toThrow(/science block/);
  });

  it('judges the read-back numbers against the probes, and says "not run" without a browser, never a pass', () => {
    const values = [{ id: 'a', a: [1, 0, 0, 1], expect: [2, 3], tol: 1e-5 }, { id: 'b', a: [0, 1, 0, 1], expect: 4, tol: 0.01, rel: true }];
    const ok = judge({ values }, { values: [2, 3, 0, 0, 4.02, 0, 0, 0] });
    expect(ok.ok).toBe(true);
    const bad = judge({ values }, { values: [2, 3.1, 0, 0, 4, 0, 0, 0] });
    expect(bad.ok).toBe(false);
    expect(conformanceGate({ ran: true, ...bad }).detail).toMatch(/disagrees: a/);
    const none = conformanceGate({ ran: false, why: 'no browser' });
    expect(none.ok).toBeNull();
    expect(none.detail).toMatch(/^not run/);
  });

  it('drives a browser through the seam: the page in capture mode, the probes in, the frames measured', async () => {
    const c = selftestCase();
    const seen = {};
    const browser = {
      values: async (html, pairs) => { seen.html = html; return pairs.flatMap(([a]) => { const r = Math.hypot(a[0], a[1], a[2]); return [r - 1.5, 2 / (r * r), 0, 0]; }); },
      images: async (html, cams) => cams.map(() => ({ width: 2, height: 2, rgba: new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255, 200, 200, 200, 255, 200, 200, 200, 255]) })),
    };
    const r = await runConformance(c.payload, { values: c.probes.values, images: [{ ...c.probes.images[0], expect: Math.sqrt(2 / Math.PI), tol: 1e-9 }] }, { browser });
    expect(seen.html).toContain('window.__sciProbe');
    expect(r.ran).toBe(true);
    expect(r.ok).toBe(true);
    expect(darkDiskRadius({ rgba: new Uint8Array([0, 0, 0, 255]) })).toBeCloseTo(Math.sqrt(1 / Math.PI), 9);
  });
});
