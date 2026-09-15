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
    expect(locked).toContain("__held['KeyC'] || __midDown || !!(__pad && __pad.lock)");
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
});
