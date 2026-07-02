import { describe, expect, it } from 'vitest';

import { planPulsarScene, assemblePulsarScene, PULSAR_FRAG, PULSAR_SCENARIOS } from './pulsar-view.js';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { sketchRenderMode, classifyBucket } from '../../sketch/sketch-manifest.js';

describe('pulsar-view — rotating magnetised neutron star', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planPulsarScene({ kind: 'pulsar-view', scenario: 'oblique' });
    const b = planPulsarScene({ kind: 'pulsar-view', scenario: 'oblique' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('falls back to oblique on an unknown scenario', () => {
    expect(planPulsarScene({ kind: 'pulsar-view', scenario: 'magnetar' }).stats.scenario).toBe('oblique');
  });

  it('produces a raymarch payload with obliquity, spin, and exposure uniforms', () => {
    const plan = planPulsarScene({ kind: 'pulsar-view', scenario: 'orthogonal', exposure: 2.2 });
    expect(plan.raymarch.frag).toBe(PULSAR_FRAG);
    expect(plan.raymarch.customUniforms).toHaveProperty('uObliquity');
    expect(plan.raymarch.customUniforms).toHaveProperty('uSpin');
    expect(plan.raymarch.customUniforms.uExposure).toBe(2.2);
    expect(plan.raymarch.readout.join(' ')).toContain('lighthouse');
  });

  it('uses emission/absorption transport with sweeping beams, not a mesh', () => {
    expect(PULSAR_FRAG).toContain('void volSample');
    expect(PULSAR_FRAG).toContain('emis  = nsBlue * ns');
    expect(PULSAR_FRAG).toContain('vec3 mhat');
    expect(PULSAR_FRAG).toContain('col += trans * emis * dt');
  });

  it('routes through the world renderer and raymarch emitter', () => {
    const html = emitThreeWorld({ ...assemblePulsarScene({ kind: 'pulsar-view' }, {}), inline: true });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('ShaderMaterial');
    expect(html).toContain('uCamBasis');
    expect(html).not.toContain('GROUPS =');
  });

  it('registers as a world concern', () => {
    const manifest = { kind: 'pulsar-view' };
    expect(sketchRenderMode(manifest)).toBe('world');
    expect(classifyBucket(manifest)).toBe('world');
  });

  it('exposes the three pulsar looks', () => {
    expect(PULSAR_SCENARIOS).toEqual(['oblique', 'orthogonal', 'aligned']);
  });
});
