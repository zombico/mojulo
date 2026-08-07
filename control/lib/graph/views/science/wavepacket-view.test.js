import { describe, expect, it } from 'vitest';

import { planWavepacketScene, assembleWavepacketScene, WAVEPACKET_SCENARIOS, WAVEPACKET_FRAG } from './wavepacket-view.js';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { sketchRenderMode, classifyBucket } from '../../sketch/sketch-manifest.js';

describe('planWavepacketScene — determinism & shape', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planWavepacketScene({ kind: 'wavepacket-view', scenario: 'coherent' });
    const b = planWavepacketScene({ kind: 'wavepacket-view', scenario: 'coherent' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('falls back to free on an unknown scenario', () => {
    expect(planWavepacketScene({ kind: 'wavepacket-view', scenario: 'tunnelling' }).stats.scenario).toBe('free');
  });

  it('produces a raymarch payload carrying the volume shader + scenario uniforms + camera', () => {
    const plan = planWavepacketScene({ kind: 'wavepacket-view', scenario: 'box' });
    expect(plan.raymarch.frag).toBe(WAVEPACKET_FRAG);
    expect(plan.raymarch.customUniforms).toHaveProperty('uScenario', 2);   // box = idx 2
    expect(plan.raymarch.customUniforms).toHaveProperty('uRmax');
    expect(plan.raymarch.customUniforms).toHaveProperty('uDens');
    expect(plan.raymarch.cameraStart.length).toBe(3);
    expect(plan.raymarch.readout.length).toBeGreaterThan(3);
  });

  it('the density knob is clamped and overrides the scenario default', () => {
    expect(planWavepacketScene({ scenario: 'free', density: 999 }).stats.density).toBe(30);
    expect(planWavepacketScene({ scenario: 'free', density: 0 }).stats.density).toBe(1);
    expect(planWavepacketScene({ scenario: 'free', density: 12 }).stats.density).toBe(12);
  });
});

describe('wavepacket-view — closed-form, time-dependent ψ in the shader', () => {
  it('rides the reusable volume scaffold (its march + transfer-function contract)', () => {
    expect(WAVEPACKET_FRAG).toContain('volSample(p, emis, ext)');     // scaffold march
    expect(WAVEPACKET_FRAG).toContain('col += trans * emis * dt');    // scaffold emission/absorption
    expect(WAVEPACKET_FRAG).toContain('vec2 wave(vec3 p)');           // the per-view transfer fn
  });

  it('evolves in time — the field is a function of uTime (volume + time)', () => {
    expect(WAVEPACKET_FRAG).toContain('float t = uTime;');
  });

  it('carries all three closed-form scenarios (free/coherent/box) selected by uScenario', () => {
    expect(WAVEPACKET_FRAG).toContain('if (uScenario == 0)');         // free
    expect(WAVEPACKET_FRAG).toContain('if (uScenario == 1)');         // coherent
    expect(WAVEPACKET_FRAG).toContain('cos((E2 - E1) * t)');          // box → quantum beats
  });

  it('phase-colours like the orbital view (warm +Re ψ / cool −Re ψ)', () => {
    expect(WAVEPACKET_FRAG).toContain('vec3(1.0, 0.5, 0.28)');        // warm (+)
    expect(WAVEPACKET_FRAG).toContain('vec3(0.3, 0.62, 1.0)');        // cool (−)
  });
});

describe('wavepacket-view — raymarch emit + registration', () => {
  it('emitThreeWorld early-returns the full-screen shader World for a raymarch payload', () => {
    const html = emitThreeWorld({ ...assembleWavepacketScene({ kind: 'wavepacket-view' }, {}), inline: true });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('ShaderMaterial');
    expect(html).toContain('uCamBasis');
    expect(html).toContain('OrbitControls');
    expect(html).not.toContain('GROUPS =');   // no mesh pipeline
  });

  it('passes the int uScenario uniform through the emitter', () => {
    const html = emitThreeWorld({ ...assembleWavepacketScene({ kind: 'wavepacket-view', scenario: 'box' }, {}), inline: true });
    expect(html).toContain('uScenario:{value:2}');
  });

  it('routes to the world renderer and the object concern bucket', () => {
    const m = { kind: 'wavepacket-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('object');
  });

  it('exposes the three scenarios', () => {
    expect(WAVEPACKET_SCENARIOS).toEqual(['free', 'coherent', 'box']);
  });

  it('every scenario emits a balanced, full-screen shader World', () => {
    for (const scenario of WAVEPACKET_SCENARIOS) {
      const html = emitThreeWorld({ ...assembleWavepacketScene({ kind: 'wavepacket-view', scenario }, {}), inline: true });
      expect(html.startsWith('<!doctype html>')).toBe(true);
      expect(html).toContain('volSample');
    }
  });

  it('the composed shader is brace- and paren-balanced (GLSL sanity)', () => {
    const braces = [...WAVEPACKET_FRAG].reduce((n, c) => n + (c === '{' ? 1 : c === '}' ? -1 : 0), 0);
    const parens = [...WAVEPACKET_FRAG].reduce((n, c) => n + (c === '(' ? 1 : c === ')' ? -1 : 0), 0);
    expect(braces).toBe(0);
    expect(parens).toBe(0);
  });
});
