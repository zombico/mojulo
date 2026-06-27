import { describe, expect, it } from 'vitest';

import { planCherenkovScene, assembleCherenkovScene, CHERENKOV_SCENARIOS, CHERENKOV_FRAG } from './cherenkov-view.js';
import { emitThreeWorld } from './scene-three.js';
import { sketchRenderMode, classifyBucket } from './sketch-manifest.js';

describe('planCherenkovScene — determinism & shape', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planCherenkovScene({ kind: 'cherenkov-view', scenario: 'cone' });
    const b = planCherenkovScene({ kind: 'cherenkov-view', scenario: 'cone' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('falls back to pool on an unknown scenario', () => {
    expect(planCherenkovScene({ scenario: 'sparkle' }).stats.scenario).toBe('pool');
  });

  it('produces a raymarch payload carrying the volume shader + scenario uniforms + camera', () => {
    const plan = planCherenkovScene({ kind: 'cherenkov-view', scenario: 'cone' });
    expect(plan.raymarch.frag).toBe(CHERENKOV_FRAG);
    expect(plan.raymarch.customUniforms).toHaveProperty('uScenario', 1);   // cone = idx 1
    expect(plan.raymarch.customUniforms).toHaveProperty('uRmax');
    expect(plan.raymarch.customUniforms).toHaveProperty('uDens');
    expect(plan.raymarch.readout.length).toBeGreaterThan(3);
  });

  it('the density knob is clamped and overrides the scenario default', () => {
    expect(planCherenkovScene({ scenario: 'pool', density: 999 }).stats.density).toBe(30);
    expect(planCherenkovScene({ scenario: 'pool', density: 0 }).stats.density).toBe(1);
    expect(planCherenkovScene({ scenario: 'pool', density: 14 }).stats.density).toBe(14);
  });
});

describe('cherenkov-view — the light-transport emission field', () => {
  it('rides the reusable volume scaffold (march + transfer-function contract)', () => {
    expect(CHERENKOV_FRAG).toContain('volSample(p, emis, ext)');
    expect(CHERENKOV_FRAG).toContain('col += trans * emis * dt');
  });

  it('evolves in time and carries the Cherenkov physics (n, the cone angle, blue spectrum)', () => {
    expect(CHERENKOV_FRAG).toContain('float t = uTime;');
    expect(CHERENKOV_FRAG).toContain('N_WATER = 1.33');
    expect(CHERENKOV_FRAG).toContain('1.0 / (beta * N_WATER)');   // cos θc = 1/(βn)
    expect(CHERENKOV_FRAG).toContain('vec3(0.28, 0.55, 1.0)');    // Cherenkov blue
  });

  it('carries both scenarios selected by uScenario', () => {
    expect(CHERENKOV_FRAG).toContain('if (uScenario == 1)');      // cone
  });
});

describe('cherenkov-view — raymarch emit + registration', () => {
  it('emitThreeWorld early-returns the full-screen shader World for a raymarch payload', () => {
    const html = emitThreeWorld({ ...assembleCherenkovScene({ kind: 'cherenkov-view' }, {}), inline: true });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('ShaderMaterial');
    expect(html).toContain('OrbitControls');
    expect(html).not.toContain('GROUPS =');   // no mesh pipeline
  });

  it('passes the int uScenario uniform through the emitter', () => {
    const html = emitThreeWorld({ ...assembleCherenkovScene({ kind: 'cherenkov-view', scenario: 'cone' }, {}), inline: true });
    expect(html).toContain('uScenario:{value:1}');
  });

  it('routes to the world renderer and the world concern bucket', () => {
    const m = { kind: 'cherenkov-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('world');
  });

  it('exposes the two scenarios', () => {
    expect(CHERENKOV_SCENARIOS).toEqual(['pool', 'cone']);
  });

  it('the composed shader is brace- and paren-balanced (GLSL sanity)', () => {
    const braces = [...CHERENKOV_FRAG].reduce((n, c) => n + (c === '{' ? 1 : c === '}' ? -1 : 0), 0);
    const parens = [...CHERENKOV_FRAG].reduce((n, c) => n + (c === '(' ? 1 : c === ')' ? -1 : 0), 0);
    expect(braces).toBe(0);
    expect(parens).toBe(0);
  });
});
