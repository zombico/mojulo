import { describe, expect, it } from 'vitest';

import { planFusionScene, assembleFusionScene, FUSION_FRAG } from './fusion-view.js';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { sketchRenderMode, classifyBucket } from '../../sketch/sketch-manifest.js';

describe('planFusionScene — determinism & shape', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planFusionScene({ kind: 'fusion-view', density: 6 });
    const b = planFusionScene({ kind: 'fusion-view', density: 6 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces a raymarch payload carrying the volume shader + uniforms + camera', () => {
    const plan = planFusionScene({ kind: 'fusion-view' });
    expect(plan.raymarch.frag).toBe(FUSION_FRAG);
    expect(plan.raymarch.customUniforms).toHaveProperty('uRmax');
    expect(plan.raymarch.customUniforms).toHaveProperty('uDens');
    expect(plan.raymarch.cameraStart.length).toBe(3);
    expect(plan.raymarch.readout.length).toBeGreaterThan(3);
  });

  it('clamps the density knob and overrides the default', () => {
    expect(planFusionScene({ density: 999 }).stats.density).toBe(30);
    expect(planFusionScene({ density: 0 }).stats.density).toBe(1);
    expect(planFusionScene({ density: 12 }).stats.density).toBe(12);
  });
});

describe('fusion-view — the time-dependent merge field in the shader', () => {
  it('rides the reusable volume scaffold + shared SDF snippets', () => {
    expect(FUSION_FRAG).toContain('volSample(p, emis, ext)');     // scaffold march
    expect(FUSION_FRAG).toContain('col += trans * emis * dt');    // scaffold emission/absorption
    expect(FUSION_FRAG).toContain('float sdfEllipsoid(vec3 p, vec3 r)');
    expect(FUSION_FRAG).toContain('sdfSmin(dD, dT, kb)');         // the merge = smin of the two reactants
  });

  it('evolves in time — the reaction coordinate ξ is a function of uTime (volume + time)', () => {
    expect(FUSION_FRAG).toContain('fract(uTime / P_FUSE)');
    expect(FUSION_FRAG).toContain('XI_FUSE');
  });

  it('carries the event beats: approach→merge, the alpha product, a fast neutron, a fusion flash', () => {
    expect(FUSION_FRAG).toContain('bool products = xi >= XI_FUSE');
    expect(FUSION_FRAG).toContain('alphaCol');                    // the He-4 product
    expect(FUSION_FRAG).toContain('vec3(0.6, 0.8, 1.0)');         // the ejected fast neutron spark
    expect(FUSION_FRAG).toContain('float flash');                // the fusion flash
  });
});

describe('fusion-view — raymarch emit + registration', () => {
  it('emitThreeWorld early-returns the full-screen shader World for a raymarch payload', () => {
    const html = emitThreeWorld({ ...assembleFusionScene({ kind: 'fusion-view' }, {}), inline: true });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('ShaderMaterial');
    expect(html).toContain('uCamBasis');
    expect(html).toContain('OrbitControls');
    expect(html).not.toContain('GROUPS =');   // no mesh pipeline
  });

  it('routes to the world renderer and the world concern bucket', () => {
    const m = { kind: 'fusion-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('world');
  });

  it('the composed shader is brace- and paren-balanced (GLSL sanity)', () => {
    const braces = [...FUSION_FRAG].reduce((n, c) => n + (c === '{' ? 1 : c === '}' ? -1 : 0), 0);
    const parens = [...FUSION_FRAG].reduce((n, c) => n + (c === '(' ? 1 : c === ')' ? -1 : 0), 0);
    expect(braces).toBe(0);
    expect(parens).toBe(0);
  });
});
