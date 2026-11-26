import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';

// A DIRECTED SHOT (rules-basic.js `shot`) on a subject bigger than a person (a frame, a tower lowered from a ship) is
// framed by its size, and as it cuts it finds a place whose line to its subject no other body stands in: the pilot's
// own frame never fills the lens.
const E = composeLive();
const flat = { ground: () => 0 };
const segDist = (a, b, c) => { const v = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = v[0] ** 2 + v[1] ** 2 + v[2] ** 2, u = Math.max(0, Math.min(1, ((c[0] - a[0]) * v[0] + (c[1] - a[1]) * v[1] + (c[2] - a[2]) * v[2]) / L2)); return Math.hypot(a[0] + v[0] * u - c[0], a[1] + v[1] * u - c[1], a[2] + v[2] * u - c[2]); };

describe('a shot on a big subject', () => {
  it('stands off it by its size and keeps the pilot\'s frame out of the line', () => {
    // (the tower faces +x; its plain framing would stand some 19 m out along +x, the pilot's frame halfway there)
    const tower = { id: 'tower', rule: { type: 'static' }, body: { type: 'box', size: [4, 4, 40], radius: 5.5 }, transform: { pos: [0, 0, 0], heading: 0 } };
    const pilot = { id: 'p', pilotable: true, rule: { type: 'static' }, body: { type: 'box', size: [5, 4, 10], radius: 4.2 }, transform: { pos: [9, 0, 0], heading: Math.PI } };
    const st = E.createWorld({ entities: [pilot, tower, { id: 'cam', isCamera: true, rule: { type: 'follow', target: 'p' }, transform: { pos: [20, 0, 5], heading: Math.PI } }], pilot: 'p', camera: 'cam' });
    E.castOps(st, [{ op: 'shot', shot: { frame: 'low', on: ['tower'] } }]);
    E.stepWorld(st, {}, 1 / 60, flat);
    const C = st.camera.transform.pos, look = st.camera.lookAt;
    expect(Math.hypot(C[0], C[1])).toBeGreaterThan(12);                         // (off it by its size, not a person's 3 m)
    expect(segDist(C, look, [9, 0, 4.2 * 0.8])).toBeGreaterThan(4.2);          // (the frame out of the line)
  });
});
