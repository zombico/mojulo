import { describe, expect, it } from 'vitest';

import { emitThreeWorld } from '../scene/scene-three.js';
import { emissionSource } from './controllable/compose.js';

const floor = { corners: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]], fill: '#445566', doubleSided: true };

describe('emitThreeWorld controllable channel', () => {
  it('emits the block only when entities/camera are present', () => {
    expect(emitThreeWorld({ faces: [floor] })).not.toContain('__CW.createWorld');
    const html = emitThreeWorld({ faces: [floor], entities: [{ id: 'd', rule: { type: 'glide' }, body: { type: 'mesh', shape: 'box' } }], camera: { rule: 'follow', target: 'd' } });
    expect(html).toContain('__CW.createWorld');
    expect(html).toContain('window.__mojCtrl');
  });

  it('emits the model source inline (single source of truth — the composed builders)', () => {
    const html = emitThreeWorld({ faces: [floor], entities: [{ id: 'd', rule: { type: 'glide' } }], camera: { rule: 'follow', target: 'd' } });
    expect(html).toContain(emissionSource());
  });

  it('wires stepControllable into the loop and gates camera ownership', () => {
    const html = emitThreeWorld({ faces: [floor], entities: [{ id: 'd', rule: { type: 'glide' } }], camera: { rule: 'follow', target: 'd' } });
    expect(html).toContain('if (__ctrlActive) stepControllable(dt)');
    expect(html).toContain('controls.enabled = false; __ctrlOwnsCamera = true;');
  });

  it('serializes the entities + camera spec', () => {
    const entities = [{ id: 'hero', rule: { type: 'walk', speed: 5 }, body: { type: 'mesh', shape: 'box', size: [1, 1, 2] }, transform: { pos: [0, 0, 1] } }];
    const camera = { rule: 'follow', target: 'hero', dist: 7 };
    const html = emitThreeWorld({ faces: [floor], entities, camera });
    expect(html).toContain(JSON.stringify(entities));
    expect(html).toContain(JSON.stringify(camera));
  });

  it('target lock (lock.js): the bracket, the C / middle-mouse / R3 edge and the spec key ride only with `lock`', () => {
    const ents = [{ id: 'me', pilotable: true, rule: { type: 'platform' }, body: { type: 'figure-rig', hittable: true } }, { id: 'foe', rule: { type: 'static' }, body: { type: 'figure-rig', hittable: true } }];
    const plain = emitThreeWorld({ faces: [floor], entities: ents, camera: { rule: 'follow', target: 'me' } });
    expect(plain).not.toContain('__updateLock');
    expect(plain).not.toContain('__midDown');
    expect(plain).not.toContain(', lock: {'); expect(plain).not.toContain(', lock: true');
    expect(plain).toContain('const lk = false;');            // the edge exists in the input snapshot, never armed
    const locked = emitThreeWorld({ faces: [floor], entities: ents, camera: { rule: 'follow', target: 'me', lockTrack: true }, lock: { range: 80 } });
    expect(locked).toContain(', lock: {"range":80}');
    expect(locked).toContain("__k('lock') || __midDown || !!(__pad && __pad.lock)");
    expect(locked).toContain('function __updateLock()');
    expect(locked).toContain('__updateRadar();\n  __updateLock();');
    expect(locked).toContain('"lockTrack":true');
  });

  it('leaves worlds without entities untouched (OrbitControls stays)', () => {
    const html = emitThreeWorld({ faces: [floor] });
    expect(html).toContain('let __ctrlActive = false;');
    expect(html).not.toContain('controls.enabled = false; __ctrlOwnsCamera = true;');
    expect(html).not.toContain('__CW.createWorld');
  });

  it('a clock-driven figure (no camera entity) steps, with camera ownership runtime-gated on a camera entity', () => {
    const html = emitThreeWorld({ faces: [floor], entities: [{ id: 'turn', rule: { type: 'clock', rate: 1 }, body: { type: 'mesh' } }] });
    expect(html).toContain('__CW.createWorld');                          // the channel is emitted (entity present)
    expect(html).toContain('__ctrlActive = __world.entities.length > 0;'); // entities are stepped
    expect(html).toContain('if (__world.camera) { controls.enabled = false; __ctrlOwnsCamera = true;'); // ownership only when a camera entity exists (none here → OrbitControls stays)
  });
  it('a building\'s stairs give the follow camera its stair rule; a world without stairs carries none of it', () => {
    const ents = [{ id: 'd', rule: { type: 'walk' }, body: { type: 'mesh', shape: 'box' } }], camera = { rule: 'follow', target: 'd' };
    const stair = { kind: 'stair', at: [0, 0, 0], to: [3, 0, 2.8], rect: [-1, -1, 4, 1] };
    const with_ = emitThreeWorld({ faces: [floor], entities: ents, camera, anchors: [stair, { kind: 'lift', at: [0, 0, 0], to: [0, 0, 4] }] });
    expect(with_).toContain('const __STAIRS = [{"rect":[-1,-1,4,1],"z0":0,"z1":2.8}];');
    expect(with_).toContain('THE CLEAR LINE');
    expect(with_).toContain('on = !!q && __STAIRS.some(');                 // on a stair only
    const none = emitThreeWorld({ faces: [floor], entities: ents, camera, anchors: [{ kind: 'lift', at: [0, 0, 0], to: [0, 0, 4] }] });
    expect(none).not.toContain('__STAIRS');
    expect(none).not.toContain('THE CLEAR LINE');
  });
  it('every ray through the world leaves the bodies out, the ground grid takes what is built after the first probe, and the probe reads the ground\'s index', () => {
    const html = emitThreeWorld({ faces: [floor], entities: [{ id: 'd', rule: { type: 'walk' }, body: { type: 'mesh', shape: 'box' } }], camera: { rule: 'follow', target: 'd' } });
    expect(html).not.toContain('intersectObjects(scene.children, true)');
    expect(html).toContain('return __giGround(pos, own);');                 // (the ground probe reads the ground's index)
    expect(html).toContain('if (scene.children.length !== __gridN || ++__gridK % 120 === 0) { __gridN = scene.children.length; __gridMeshes(); __giBake(own); }')
  });
  it('a follow camera that asks for a clear line looks for one at every wall, with no stairs at all', () => {
    const ents = [{ id: 'd', rule: { type: 'walk' }, body: { type: 'mesh', shape: 'box' } }];
    const html = emitThreeWorld({ faces: [floor], entities: ents, camera: { rule: 'follow', target: 'd', clear: true } });
    expect(html).toContain('THE CLEAR LINE');
    expect(html).toContain('on = !!q;');                                    // anywhere, not on a stair alone
    expect(html).not.toContain('__STAIRS');
    expect(html).toContain('function __clearHit(look, d, full, own, c)');
  });
});
