import { describe, expect, it } from 'vitest';
import { facesToGlb } from './scene-gltf.js';
import { assembleSolidTurntableScene } from '../worlds/solid-turntable.js';

function gltfJson(out) { const buf = out.bytes; const len = buf.readUInt32LE(12); return JSON.parse(buf.slice(20, 20 + len).toString("utf8")); }

describe('crystals leave the GLB as transmissive materials', () => {
  it('a ruby: transmission, ior, volume (its colour after 1 cm), dispersion, and its glow as emissive', () => {
    const j = gltfJson(facesToGlb(assembleSolidTurntableScene({ shape: 'crystal', gem: 'ruby' })));
    for (const e of ['KHR_materials_transmission', 'KHR_materials_ior', 'KHR_materials_volume', 'KHR_materials_dispersion']) expect(j.extensionsUsed).toContain(e);
    const m = j.materials.find((x) => x.name === 'crystal:crystal'); expect(m).toBeTruthy();
    expect(m.extensions.KHR_materials_ior.ior).toBeCloseTo(1.764, 2);
    const att = m.extensions.KHR_materials_volume.attenuationColor; expect(att[0]).toBeGreaterThan(5 * att[1]);   // red
    expect(m.emissiveFactor[0]).toBeGreaterThan(0.3);
    expect(j.nodes.some((n) => n.name === 'crystal:crystal')).toBe(true);
  });
  it('a diamond brilliant: no glow, the dispersion of diamond (20/V ≈ 0.36)', () => {
    const j = gltfJson(facesToGlb(assembleSolidTurntableScene({ shape: 'crystal', gem: 'diamond', cut: 'brilliant' })));
    const m = j.materials.find((x) => x.name === 'crystal:crystal'); expect(m.emissiveFactor).toBeUndefined();
    expect(m.extensions.KHR_materials_dispersion.dispersion).toBeCloseTo(0.36, 1); expect(m.extensions.KHR_materials_ior.ior).toBeCloseTo(2.417, 2);
  });
  it('an opal: an opaque body with iridescence, no transmission', () => {
    const j = gltfJson(facesToGlb(assembleSolidTurntableScene({ shape: 'crystal', gem: 'opal' })));
    const m = j.materials.find((x) => x.name === 'crystal:crystal'); expect(m.extensions.KHR_materials_iridescence).toBeTruthy(); expect(m.extensions.KHR_materials_transmission).toBeUndefined();
  });
  it('no crystal, no crystal extension', () => {
    const j = gltfJson(facesToGlb(assembleSolidTurntableScene({ shape: 'dodecahedron' })));
    expect(j.extensionsUsed || []).not.toContain('KHR_materials_transmission');
  });
});
