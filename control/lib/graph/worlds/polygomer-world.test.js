import { describe, it, expect } from 'vitest';
import { resolveManjiTreeLathes, assembleManjiTreeWorld, bakeSkinOntoFaces } from './polygomer-world.js';
import { facesToGlb } from '../scene/scene-gltf.js';

const PHYSICS = { gravity: { x: 0, y: 0, z: -1 }, gravityStrength: 1, defaultSagFactor: 0.12 };

function polygomer() {
  return {
    kind: 'manji-tree',
    dimensions: '3d',
    physics: PHYSICS,
    tree: {
      id: 'world',
      spine: { bar1: { axis: 'Zenith-Nadir', tails: { Zenith: 'closed', Nadir: 'closed' }, lengthScale: 0.1 } },
      anchor: { x: 0, y: 0, z: 0 },
      slots: [
        { id: 'top', position: { x: 0, y: 0, z: 4 } },
        { id: 'base', position: { x: 0, y: 0, z: 0 } },
      ],
    },
    lathes: [
      {
        axisFrom: 'world/slot/top',
        axisTo: 'world/slot/base',
        profile: [{ t: 0, radius: 0.4 }, { t: 0.5, radius: 0.9 }, { t: 1, radius: 0.4 }],
        crossSections: 16,
        samples: 24,
        style: { stroke: '#5a6b6a', width: 0.5 },
      },
    ],
    title: 'test',
  };
}

describe('polygomer-world', () => {
  it('resolves slot-bonded lathes to absolute world coordinates', () => {
    const resolved = resolveManjiTreeLathes(polygomer());
    expect(resolved).toHaveLength(1);
    expect(resolved[0].axisFrom).toMatchObject({ x: 0, y: 0, z: 4 });
    expect(resolved[0].axisTo).toMatchObject({ x: 0, y: 0, z: 0 });
  });

  it('assembles a turnable scene that exports as a .glb', () => {
    const payload = assembleManjiTreeWorld(polygomer(), { title: 'test' });
    expect(payload.faces.length).toBeGreaterThan(0);
    expect(payload.cameras.length).toBeGreaterThan(1); // turntable
    const glb = facesToGlb(payload, { generator: 'test' });
    expect(glb.byteLength).toBeGreaterThan(0);
    expect(glb.vertexCount).toBeGreaterThan(0);
  });

  it('bakes a skin onto the object faces (albedo × the Lambert factor)', () => {
    // a 1×1 pure-red skin → object faces become shades of red (studio-floor faces don't)
    const skin = { data: Uint8Array.from([255, 0, 0, 255]), width: 1, height: 1, channels: 4 };
    const withSkin = assembleManjiTreeWorld(polygomer(), { title: 'test', skin });
    const reds = withSkin.faces.filter((f) => /^#[0-9a-f]{2}0000$/.test(f.fill));
    expect(reds.length).toBeGreaterThan(10);
    // SHADED — the red channel varies with the face normal (not flat)
    expect(new Set(reds).size).toBeGreaterThan(1);
  });
});
