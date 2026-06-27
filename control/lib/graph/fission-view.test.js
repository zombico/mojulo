import { describe, expect, it } from 'vitest';

import { planFissionScene, assembleFissionScene, FISSION_FRAG } from './fission-view.js';
import { emitThreeWorld } from './scene-three.js';
import { sketchRenderMode, classifyBucket } from './sketch-manifest.js';

describe('planFissionScene — determinism & shape', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planFissionScene({ kind: 'fission-view', asymmetry: 1 });
    const b = planFissionScene({ kind: 'fission-view', asymmetry: 1 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces a raymarch payload carrying the volume shader + uniforms + camera', () => {
    const plan = planFissionScene({ kind: 'fission-view' });
    expect(plan.raymarch.frag).toBe(FISSION_FRAG);
    expect(plan.raymarch.customUniforms).toHaveProperty('uRmax');
    expect(plan.raymarch.customUniforms).toHaveProperty('uDens');
    expect(plan.raymarch.customUniforms).toHaveProperty('uAsym');
    expect(plan.raymarch.cameraStart.length).toBe(3);
    expect(plan.raymarch.readout.length).toBeGreaterThan(3);
  });

  it('clamps the asymmetry knob to [0,1] (default 1 = realistic asymmetric split)', () => {
    expect(planFissionScene({}).stats.asymmetry).toBe(1);
    expect(planFissionScene({ asymmetry: 9 }).stats.asymmetry).toBe(1);
    expect(planFissionScene({ asymmetry: -2 }).stats.asymmetry).toBe(0);
    expect(planFissionScene({ asymmetry: 0.5 }).stats.asymmetry).toBe(0.5);
  });

  it('clamps the density knob and overrides the default', () => {
    expect(planFissionScene({ density: 999 }).stats.density).toBe(30);
    expect(planFissionScene({ density: 0 }).stats.density).toBe(1);
    expect(planFissionScene({ density: 12 }).stats.density).toBe(12);
  });
});

describe('fission-view — the time-dependent liquid-drop field in the shader', () => {
  it('rides the reusable volume scaffold (its march + transfer-function contract)', () => {
    expect(FISSION_FRAG).toContain('volSample(p, emis, ext)');     // scaffold march
    expect(FISSION_FRAG).toContain('col += trans * emis * dt');    // scaffold emission/absorption
  });

  it('reuses the shared SDF snippets (the topology-change enabler)', () => {
    expect(FISSION_FRAG).toContain('float sdfEllipsoid(vec3 p, vec3 r)');
    expect(FISSION_FRAG).toContain('float sdfSmin(float a, float b, float k)');
    expect(FISSION_FRAG).toContain('sdfSmin(dH, dL, kb)');          // the neck = smin of two fragments
  });

  it('evolves in time — the fission coordinate ξ is a function of uTime (volume + time)', () => {
    expect(FISSION_FRAG).toContain('fract(uTime / P_FISS)');
    expect(FISSION_FRAG).toContain('XI_SCISSION');
  });

  it('carries the event beats: neck strain, prompt neutrons, gamma flash', () => {
    expect(FISSION_FRAG).toContain('strain');                       // neck heat
    expect(FISSION_FRAG).toContain('float flash');                  // scission flash
    expect(FISSION_FRAG).toContain('vec3(0.6, 0.8, 1.0)');          // fast blue neutron sparks
  });
});

describe('fission-view — raymarch emit + registration', () => {
  it('emitThreeWorld early-returns the full-screen shader World for a raymarch payload', () => {
    const html = emitThreeWorld({ ...assembleFissionScene({ kind: 'fission-view' }, {}), inline: true });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('ShaderMaterial');
    expect(html).toContain('uCamBasis');
    expect(html).toContain('OrbitControls');
    expect(html).not.toContain('GROUPS =');   // no mesh pipeline
  });

  it('passes the float uAsym uniform through the emitter', () => {
    const html = emitThreeWorld({ ...assembleFissionScene({ kind: 'fission-view', asymmetry: 0 }, {}), inline: true });
    expect(html).toContain('uAsym:{value:0}');
  });

  it('routes to the world renderer and the world concern bucket', () => {
    const m = { kind: 'fission-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('world');
  });

  it('the composed shader is brace- and paren-balanced (GLSL sanity)', () => {
    const braces = [...FISSION_FRAG].reduce((n, c) => n + (c === '{' ? 1 : c === '}' ? -1 : 0), 0);
    const parens = [...FISSION_FRAG].reduce((n, c) => n + (c === '(' ? 1 : c === ')' ? -1 : 0), 0);
    expect(braces).toBe(0);
    expect(parens).toBe(0);
  });
});
