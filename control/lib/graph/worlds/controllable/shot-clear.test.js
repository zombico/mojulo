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
    // (and aimed under the tower's middle, so it rides above a scene's talk box)
    expect(look[2]).toBeLessThan(5.5);
  });

  it('a wide shot on big subjects far apart still looks at them: the aim under them no more than half their height', () => {
    const fr = (id, x) => ({ id, rule: { type: 'static' }, body: { type: 'box', size: [5, 4, 10], radius: 4.2, aimH: 6 }, transform: { pos: [x, 0, 0], heading: 0 } });
    const st = E.createWorld({ entities: [fr('a', -40), fr('b', 40), { id: 'cam', isCamera: true, rule: { type: 'follow', target: 'a' }, transform: { pos: [0, 50, 5], heading: 0 } }], pilot: 'a', camera: 'cam' });
    E.castOps(st, [{ op: 'shot', shot: { frame: 'wide', on: ['a', 'b'], move: 'push' } }]);
    E.stepWorld(st, {}, 1 / 60, flat);
    const C = st.camera.transform.pos, look = st.camera.lookAt;
    expect(Math.hypot(C[0], C[1])).toBeGreaterThan(100);                        // (far off, to hold them both)
    expect(look[2]).toBeGreaterThanOrEqual(6 - 3);                              // (at them: under their look point by half their height at most)
  });

  it('a shot told to keep a body away stands off its line: the body is out of the frame', () => {
    // (a candle set down, the pilot 30 m off it to the west; the plain framing would look past the pilot at it)
    const candle = { id: 'c', rule: { type: 'static' }, body: { type: 'box', size: [4, 4, 20], radius: 4 }, transform: { pos: [0, 0, 0], heading: 0 } };
    const pilot = { id: 'p', pilotable: true, rule: { type: 'static' }, body: { type: 'box', size: [5, 4, 10], radius: 4.2 }, transform: { pos: [-30, 0, 0], heading: 0 } };
    const outOfView = (away) => {
      const st = E.createWorld({ entities: [pilot, candle, { id: 'cam', isCamera: true, rule: { type: 'follow', target: 'p' }, transform: { pos: [-40, 0, 5], heading: 0 } }], pilot: 'p', camera: 'cam' });
      E.castOps(st, [{ op: 'shot', shot: { frame: 'low', on: ['c'], ...(away ? { away: 'p' } : {}) } }]);
      E.stepWorld(st, {}, 1 / 60, flat);
      const C = st.camera.transform.pos, L = st.camera.lookAt, a = [L[0] - C[0], L[1] - C[1]], b = [-30 - C[0], 0 - C[1]];
      return Math.acos((a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b)));
    };
    expect(outOfView(true)).toBeGreaterThan((50 / 2) * (Math.PI / 180) * 1.2);   // (past the edge of a 50° frame)
    expect(outOfView(false)).toBeLessThan((50 / 2) * (Math.PI / 180));           // (unasked, it stood in the frame)
  });

  it('a tracking shot looks again as its subject moves: a ridge come between them is gone round', () => {
    // (a walker on open ground, then past a ridge the line from the shot's first place would cross)
    let ridge = false;
    const ground = { ground: ([x, y]) => (ridge && x > 6 && x < 12 && Math.abs(y) < 4 ? 30 : 0) };
    const W = { id: 'w', rule: { type: 'static' }, body: { type: 'box', size: [5, 4, 10], radius: 4.2 }, transform: { pos: [0, 0, 0], heading: 0 } };
    const st = E.createWorld({ entities: [W, { id: 'cam', isCamera: true, rule: { type: 'follow', target: 'w' }, transform: { pos: [20, 0, 5], heading: Math.PI } }], pilot: 'w', camera: 'cam' });
    E.castOps(st, [{ op: 'shot', shot: { frame: 'wide', on: ['w'], move: 'track' } }]);
    E.stepWorld(st, {}, 1 / 60, ground);
    expect(st.camera._shotTry).toEqual([0, 0]);
    ridge = true;
    for (let i = 0; i < 80; i++) E.stepWorld(st, {}, 1 / 60, ground);
    expect(st.camera._shotTry).not.toEqual([0, 0]);                              // (looked again, and moved aside or up)
  });
});
