import { describe, expect, it } from 'vitest';

import { planLightningStormScene, assembleLightningStormScene, LIGHTNING_STORM_FRAG, LIGHTNING_STORM_SCENARIOS } from './lightning-storm-view.js';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { sketchRenderMode, classifyBucket } from '../../sketch/sketch-manifest.js';

describe('lightning-storm-view — volumetric storm deck + electric-arc strikes', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planLightningStormScene({ kind: 'lightning-storm-view', scenario: 'cloud-to-ground' });
    const b = planLightningStormScene({ kind: 'lightning-storm-view', scenario: 'cloud-to-ground' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('falls back to cloud-to-ground on an unknown scenario', () => {
    expect(planLightningStormScene({ kind: 'lightning-storm-view', scenario: 'ball' }).stats.scenario).toBe('cloud-to-ground');
  });

  it('switches strike geometry by scenario via uMode', () => {
    const ground = planLightningStormScene({ kind: 'lightning-storm-view', scenario: 'cloud-to-ground' });
    const cloud = planLightningStormScene({ kind: 'lightning-storm-view', scenario: 'cloud-to-cloud' });
    expect(ground.raymarch.customUniforms.uMode).toBe(0);
    expect(cloud.raymarch.customUniforms.uMode).toBe(1);
    expect(cloud.raymarch.readout.join(' ')).toContain('horizontal');
  });

  it('composes the fbm cloud and the electric-arc primitive', () => {
    expect(LIGHTNING_STORM_FRAG).toContain('void volSample');
    expect(LIGHTNING_STORM_FRAG).toContain('float vrArc');
    expect(LIGHTNING_STORM_FRAG).toContain('emis += boltCol * boltGlow');
    expect(LIGHTNING_STORM_FRAG).toContain('ext = vec3(cloud * 1.4)');
  });

  it('routes through the world renderer and raymarch emitter', () => {
    const html = emitThreeWorld({ ...assembleLightningStormScene({ kind: 'lightning-storm-view' }, {}), inline: true });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('ShaderMaterial');
    expect(html).toContain('uCamBasis');
    expect(html).not.toContain('GROUPS =');
  });

  it('registers as an object concern', () => {
    const manifest = { kind: 'lightning-storm-view' };
    expect(sketchRenderMode(manifest)).toBe('world');
    expect(classifyBucket(manifest)).toBe('object');
  });

  it('exposes the two storm scenarios', () => {
    expect(LIGHTNING_STORM_SCENARIOS).toEqual(['cloud-to-ground', 'cloud-to-cloud']);
  });
});
