// A world's mounts (mount-units.js): the key read (a count beside the spawn, or each horse's place, heading and coat),
// the horses laid after the world's own entities on the `ride` rule with their `mount`, a figure a coat, the rider who
// rides them marked; with no one to ride them they stand loose (reach 0). The World page emits the mount code (the
// runtime's builder, the reach prompt, the skinned rig) only for a world that has one.
import { describe, it, expect } from 'vitest';
import { readMounts, lowerMounts } from './mount-units.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const b64 = (T, a) => Buffer.from(T.from(a).buffer).toString('base64');
// a stand-in for the solve (mount/game.js mountRide): one bone, one triangle, one clip
const fig = { rig: true, skin: true, figH: 1.6, bones: [{ id: 'spine', head: [0, 0, 1], tail: [0, 1, 1] }], parts: [{ pos: b64(Float32Array, [0, 0, 1, 1, 0, 1, 0, 1, 1]), col: b64(Uint8Array, [200, 120, 80, 200, 120, 80, 200, 120, 80]), faces: 1, jnt: b64(Uint8Array, Array(12).fill(0)), wgt: b64(Float32Array, [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]) }], clips: { idle: { k: 2, b: [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1], s: 4 } } };
const SOL = { figures: { bay: fig, grey: fig }, rule: { type: 'ride', gaits: [{ clip: 'ride_walk', v: 1.6, stride: 1.8 }], idle: { clip: 'ride_idle', loose: 'idle', s: 4 } }, mount: { reach: 2.6, stand: [-0.58, 0.16], facing: -Math.PI / 2, mount: { clip: 'mount', s: 3.4 }, dismount: { clip: 'dismount', s: 2.8 } } };
const payload = () => ({ faces: [{ corners: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]], fill: '#556' }], entities: [{ id: 'hero', pilotable: true, rule: { type: 'platform' }, body: { type: 'mesh', shape: 'box', size: [0.5, 0.5, 1.7] }, transform: { pos: [1, 2, 0], heading: Math.PI / 2 } }], camera: { rule: 'follow', target: 'hero' }, inline: true });

describe('a world\'s mounts', () => {
  it('reads a count, or each horse; says what is wrong', () => {
    expect(readMounts(null)).toBeNull();
    expect(readMounts(2)).toEqual([{ beside: 0 }, { beside: 1 }]);
    expect(readMounts([{ at: [3, 4], heading: 1, coat: 'grey' }, {}])).toEqual([{ at: [3, 4], heading: 1, coat: 'grey' }, { beside: 1 }]);
    expect(() => readMounts(0)).toThrow(/1 to 8/);
    expect(() => readMounts([{ coat: 'zebra' }])).toThrow(/coat is one of bay/);
    expect(() => readMounts([{ at: [1] }])).toThrow(/\[x, y\]/);
  });

  it('lays the horses after the world\'s entities, a figure a coat, the rider marked', async () => {
    const P = await lowerMounts(payload(), readMounts([{ at: [3, 4], coat: 'grey' }, {}]), SOL, { riderId: 'hero' });
    const [hero, a, b] = P.entities;
    expect(hero.rides).toBe(true);
    expect(a).toMatchObject({ id: 'mount-1', rule: { type: 'ride' }, mount: { reach: 2.6 }, body: { type: 'figure-rig', figure: 'mount:grey' }, transform: { pos: [3, 4, 0] } });
    expect(b.body.figure).toBe('mount:bay');
    // (the second beside the spawn: three metres and two more to the hero's right, a little ahead, facing as it faces)
    expect(b.transform.pos[0]).toBeCloseTo(1 + 3 + 2, 6);
    expect(b.transform.pos[1]).toBeCloseTo(2 + 1.5, 6);
    expect(b.transform.heading).toBe(Math.PI / 2);
    expect(Object.keys(P.figures).sort()).toEqual(['mount:bay', 'mount:grey']);
  });

  it('with no one to ride them, they stand loose and are never offered', async () => {
    const P = await lowerMounts(payload(), readMounts(1), { ...SOL, mount: null }, {});
    expect(P.entities[0].rides).toBeUndefined();
    expect(P.entities[1].mount).toEqual({ reach: 0 });
  });

  it('the World page carries the mount code only for a world with one', async () => {
    const bare = emitThreeWorld(payload());
    for (const s of ['stepWithMounts', '__makeSkinGroup', 'get off']) expect(bare).not.toContain(s);
    const P = await lowerMounts(payload(), readMounts(1), SOL, { riderId: 'hero' });
    const html = emitThreeWorld(P);
    for (const s of ['stepWithMounts', '__makeSkinGroup', 'get off', 'THREE.SkinnedMesh']) expect(html).toContain(s);
  });
});
