import { describe, expect, it } from 'vitest';

import { planPlasmaGlobeScene, assemblePlasmaGlobeScene, PLASMA_GLOBE_FRAG, PLASMA_GLOBE_SCENARIOS } from './plasma-globe-view.js';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { sketchRenderMode, classifyBucket } from '../../sketch/sketch-manifest.js';

describe('plasma-globe-view — emissive Tesla-globe arcs', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planPlasmaGlobeScene({ kind: 'plasma-globe-view', scenario: 'neon-argon' });
    const b = planPlasmaGlobeScene({ kind: 'plasma-globe-view', scenario: 'neon-argon' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('falls back to neon-argon on an unknown scenario', () => {
    expect(planPlasmaGlobeScene({ kind: 'plasma-globe-view', scenario: 'mercury' }).stats.scenario).toBe('neon-argon');
  });

  it('produces a raymarch payload with the gas-fill and exposure uniforms', () => {
    const plan = planPlasmaGlobeScene({ kind: 'plasma-globe-view', scenario: 'xenon', exposure: 1.7 });
    expect(plan.raymarch.frag).toBe(PLASMA_GLOBE_FRAG);
    expect(plan.raymarch.customUniforms).toHaveProperty('uGas');
    expect(plan.raymarch.customUniforms.uGas).toBe(1.0);
    expect(plan.raymarch.customUniforms.uExposure).toBe(1.7);
    expect(plan.raymarch.readout.join(' ')).toContain('electrode');
  });

  it('is emissive plasma (no extinction) with discrete arcs, not a cloud', () => {
    expect(PLASMA_GLOBE_FRAG).toContain('void volSample');
    expect(PLASMA_GLOBE_FRAG).toContain('emis += arcCol * glow');
    expect(PLASMA_GLOBE_FRAG).toContain('ext = vec3(0.0)');
    expect(PLASMA_GLOBE_FRAG).toContain('vec3 pgBg(vec3 rd)');
  });

  it('routes through the world renderer and raymarch emitter', () => {
    const html = emitThreeWorld({ ...assemblePlasmaGlobeScene({ kind: 'plasma-globe-view' }, {}), inline: true });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('ShaderMaterial');
    expect(html).toContain('uCamBasis');
    expect(html).not.toContain('GROUPS =');
  });

  it('registers as a world concern', () => {
    const manifest = { kind: 'plasma-globe-view' };
    expect(sketchRenderMode(manifest)).toBe('world');
    expect(classifyBucket(manifest)).toBe('world');
  });

  it('exposes the three gas fills', () => {
    expect(PLASMA_GLOBE_SCENARIOS).toEqual(['neon-argon', 'argon', 'xenon']);
  });
});
