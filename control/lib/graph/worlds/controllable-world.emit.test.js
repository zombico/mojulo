import { describe, expect, it } from 'vitest';

import { emitThreeWorld } from '../scene/scene-three.js';
import { buildControllable } from './controllable-world.js';

const floor = { corners: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]], fill: '#445566', doubleSided: true };

describe('emitThreeWorld controllable channel', () => {
  it('emits the block only when entities/camera are present', () => {
    expect(emitThreeWorld({ faces: [floor] })).not.toContain('__CW.createWorld');
    const html = emitThreeWorld({ faces: [floor], entities: [{ id: 'd', rule: { type: 'glide' }, body: { type: 'mesh', shape: 'box' } }], camera: { rule: 'follow', target: 'd' } });
    expect(html).toContain('__CW.createWorld');
    expect(html).toContain('window.__mojCtrl');
  });

  it('emits the model source inline (single source of truth)', () => {
    const html = emitThreeWorld({ faces: [floor], entities: [{ id: 'd', rule: { type: 'glide' } }], camera: { rule: 'follow', target: 'd' } });
    expect(html).toContain(buildControllable.toString());
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
