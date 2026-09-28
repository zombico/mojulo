import { describe, expect, it } from 'vitest';
import { facesToUsda } from './scene-usd.js';
import { assembleSolidTurntableScene } from '../worlds/solid-turntable.js';

const usd = (recipe) => facesToUsda(assembleSolidTurntableScene(recipe)).text;

describe('crystals leave the USD as their own prim and look', () => {
  it('a ruby: a crystal prim bound to a UsdPreviewSurface with its index, an opacity, a red body and its glow', () => {
    const t = usd({ shape: 'crystal', gem: 'ruby' });
    expect(t).toContain('def Mesh "crystal_crystal"');
    expect(t).toMatch(/rel material:binding = <\/mojulo\/Looks\/crystal_crystal>/);
    expect(t).toContain('float inputs:ior = 1.76');
    expect(t).toContain('float inputs:opacity = 0.3');
    const body = t.match(/color3f inputs:diffuseColor = \(([^)]+)\)/)[1].split(',').map(Number); expect(body[0]).toBeGreaterThan(5 * body[1]);
    expect(t).toContain('color3f inputs:emissiveColor');
  });
  it('an opal: opaque under a clearcoat; a quartz: no emission', () => {
    const o = usd({ shape: 'crystal', gem: 'opal' }); expect(o).toContain('float inputs:clearcoat = 1'); expect(o).not.toContain('inputs:opacity');
    expect(usd({ shape: 'crystal', gem: 'quartz' })).not.toContain('emissiveColor');
  });
  it('no crystal, no crystal look', () => { expect(usd({ shape: 'dodecahedron' })).not.toContain(':crystal'); });
});
