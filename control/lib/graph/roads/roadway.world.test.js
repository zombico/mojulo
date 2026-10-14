import { describe, it, expect } from 'vitest';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { emitThreeWorld } from '@/lib/graph/scene/scene-three';

// the `roadway` kind through the real /world resolve path: the registry row, the face textures, the
// unit declaration, and an emitted page that instances the fleet.
describe('roadway world kind', () => {
  it('resolves through the registry with textures, metres and instanced traffic', async () => {
    const { payload, kind } = await resolveWorldScene({ manifest: { kind: 'roadway', length: 1500 }, title: 'road' });
    expect(kind).toBe('roadway');
    expect(payload.metersPerUnit).toBe(1);
    expect(Object.keys(payload.textures || {})).toEqual(expect.arrayContaining(['asphalt-aged', 'grass-dry']));
    expect(payload.repeats.length).toBeGreaterThan(0);
    expect(payload.cameras[0].name).toBe('driver');
    const html = emitThreeWorld({ ...payload, inline: false });
    expect(html).toContain('InstancedMesh');
  }, 60000);
});
