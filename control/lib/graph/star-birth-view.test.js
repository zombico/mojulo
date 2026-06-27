import { describe, expect, it } from 'vitest';

import { planStarBirthScene, assembleStarBirthScene, STAR_BIRTH_FRAG, STAR_BIRTH_SCENARIOS } from './star-birth-view.js';
import { emitThreeWorld } from './scene-three.js';
import { sketchRenderMode, classifyBucket } from './sketch-manifest.js';

describe('star-birth-view — volumetric single-star nursery', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planStarBirthScene({ kind: 'star-birth-view', scenario: 'protostar' });
    const b = planStarBirthScene({ kind: 'star-birth-view', scenario: 'protostar' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('falls back to protostar on an unknown scenario', () => {
    expect(planStarBirthScene({ kind: 'star-birth-view', scenario: 'supernova' }).stats.scenario).toBe('protostar');
  });

  it('produces a raymarch payload with core, disk, outflow, and exposure uniforms', () => {
    const plan = planStarBirthScene({ kind: 'star-birth-view', scenario: 'outflow', exposure: 2.1 });
    expect(plan.raymarch.frag).toBe(STAR_BIRTH_FRAG);
    expect(plan.raymarch.customUniforms).toHaveProperty('uCore');
    expect(plan.raymarch.customUniforms).toHaveProperty('uDisk');
    expect(plan.raymarch.customUniforms).toHaveProperty('uOutflow');
    expect(plan.raymarch.customUniforms.uExposure).toBe(2.1);
    expect(plan.raymarch.readout.join(' ')).toContain('protostar');
  });

  it('uses emission/absorption dust transport, not a mesh point cloud', () => {
    expect(STAR_BIRTH_FRAG).toContain('void volSample');
    expect(STAR_BIRTH_FRAG).toContain('emis += hotCore * core');
    expect(STAR_BIRTH_FRAG).toContain('ext = dust * vec3(2.15, 1.42, 0.82)');
    expect(STAR_BIRTH_FRAG).toContain('col += trans * emis * dt');
  });

  it('routes through the world renderer and raymarch emitter', () => {
    const html = emitThreeWorld({ ...assembleStarBirthScene({ kind: 'star-birth-view' }, {}), inline: true });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('ShaderMaterial');
    expect(html).toContain('uCamBasis');
    expect(html).not.toContain('GROUPS =');
  });

  it('registers as a world concern', () => {
    const manifest = { kind: 'star-birth-view' };
    expect(sketchRenderMode(manifest)).toBe('world');
    expect(classifyBucket(manifest)).toBe('world');
  });

  it('exposes the three star-birth looks', () => {
    expect(STAR_BIRTH_SCENARIOS).toEqual(['collapse', 'protostar', 'outflow']);
  });
});
