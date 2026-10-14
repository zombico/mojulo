import { describe, it, expect } from 'vitest';
import { applyShootOp } from './ops.js';
import { normalizeShoot, shootReadout } from './plan.js';
import { compileCamera, cameraAt } from './sample.js';
import { shootClearance } from './clearance.js';
import { shootSubjects } from './subjects.js';

const PLAN = normalizeShoot({ cameras: [{ id: 'a', keys: [
  { t: 0, pos: [-5, -5, 2], poi: [0, 0, 1], lens: '35mm' },
  { t: 2, pos: [5, -5, 2], poi: [0, 0, 1] },
] }] }).plan;
const run = (plan, ...ops) => ops.reduce((p, op) => normalizeShoot(applyShootOp(p, op).plan).plan, plan);
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

describe('the edits', () => {
  it('keys: add, set by time, move in time, ease all, remove', () => {
    const p = run(PLAN,
      { op: 'add_key', camera: 'a', key: { t: 1, pos: [0, -7, 3] } },
      { op: 'set_key', camera: 'a', t: 2, lens: '85mm', to: 3 },
      { op: 'ease', camera: 'a', ease: 'easy ease' },
      { op: 'remove_key', camera: 'a', t: 1 });
    const k = p.cameras[0].keys;
    expect(k.map((x) => x.t)).toEqual([0, 3]);
    expect(k[1].focal_mm).toBe(85);
    expect(k.every((x) => x.ease === 'easy_ease')).toBe(true);
  });

  it('one-node ↔ two-node keeps what the camera sees', () => {
    const one = run(PLAN, { op: 'set_camera', camera: 'a', type: 'one-node' });
    expect(one.cameras[0].type).toBe('one_node');
    const before = cameraAt(compileCamera(PLAN.cameras[0]), 0), after = cameraAt(compileCamera(one.cameras[0]), 0);
    const dir = (c) => { const d = c.look.map((v, i) => v - c.pos[i]); const n = Math.hypot(...d); return d.map((v) => v / n); };
    expect(dist(dir(before), dir(after))).toBeLessThan(1e-9);
    const back = run(one, { op: 'set_camera', camera: 'a', type: 'two_node' });
    expect(dist(dir(cameraAt(compileCamera(back.cameras[0]), 0)), dir(before))).toBeLessThan(1e-9);
  });

  it('a new camera gets a shot; removing it takes its shots with it', () => {
    const p = run(PLAN, { op: 'add_camera', camera: { keys: [{ t: 0, pos: [0, -9, 1], poi: [0, 0, 1] }] } });
    expect(p.cameras.map((c) => c.id)).toEqual(['a', 'cam2']);
    expect(p.shots.map((s) => s.camera)).toEqual(['a', 'cam2']);
    const q = run(p, { op: 'remove_camera', camera: 'cam2' });
    expect(q.shots.map((s) => s.camera)).toEqual(['a']);
  });

  it('shots: add, rename, reorder; retime moves keys and spans together', () => {
    const p = run(PLAN,
      { op: 'add_shot', shot: { name: 'tail', camera: 'a', span: [1, 2] } },
      { op: 'set_shot', shot: 0, name: 'head' },
      { op: 'move_shot', shot: 'tail', to: 0 },
      { op: 'retime', scale: 2 });
    expect(p.shots.map((s) => [s.name, s.span])).toEqual([['tail', [2, 4]], ['head', [0, 4]]]);
    expect(p.cameras[0].keys.map((k) => k.t)).toEqual([0, 4]);
  });

  it('says what is wrong in the words of the plan', () => {
    expect(() => applyShootOp(PLAN, { op: 'set_key', camera: 'a', t: 7 })).toThrow(/keys at 0, 2s/);
    expect(() => applyShootOp(PLAN, { op: 'set_key', camera: 'b', t: 0 })).toThrow(/cameras: a/);
    expect(() => applyShootOp(PLAN, { op: 'zoom' })).toThrow(/ops: /);
  });
});

describe('the gates the tools report', () => {
  // a wall across the x axis at y = 0, from x -10 to 10, 4 high; the camera dollies from y -5 to y +5 through it
  const WALL = [{ corners: [[-10, 0, 0], [10, 0, 0], [10, 0, 4], [-10, 0, 4]], fill: '#888888' }];
  const THROUGH = normalizeShoot({ cameras: [{ id: 'push', keys: [{ t: 0, pos: [0, -5, 1.5], poi: [0, 10, 1.5] }, { t: 2, pos: [0, 5, 1.5], poi: [0, 10, 1.5] }] }] }).plan;

  it('clearance: a move through a wall is reported once, where and when', () => {
    const hits = shootClearance(THROUGH, WALL);
    expect(hits).toHaveLength(1);
    expect(hits[0].camera).toBe('push');
    expect(hits[0].t).toBeCloseTo(1, 1);
    expect(hits[0].at[1]).toBeCloseTo(0, 6);
    expect(shootClearance(PLAN, WALL)).toEqual([]);
  });

  it('the readout flags a camera teleported by the subject it rides', () => {
    // a car on a 10-unit lane at 4 units/s wraps at 2.5 s
    const subjects = shootSubjects({ cars: [{ car: 's', path: [[0, 0, 0], [10, 0, 0]], speed: 4 }], carMeshes: { s: {} } });
    const ride = normalizeShoot({ cameras: [{ keys: [{ t: 0, pos: { follow: 'car:0', offset: [-2, 0, 1] }, poi: { follow: 'car:0' } }, { t: 4, pos: { follow: 'car:0', offset: [-2, 0, 1] }, poi: { follow: 'car:0' } }] }] }, { subjects }).plan;
    const r = shootReadout(ride, { subjects });
    expect(r.cameras[0].jumps).toHaveLength(1);
    expect(r.cameras[0].jumps[0]).toBeCloseTo(2.5, 1);
    expect(r.cameras[0].peak_speed_units_s).toBeCloseTo(4, 1);   // the jump is not a speed
  });
});

describe('pieces and transitions by op', () => {
  it('add a piece, key it, re-skin it, put a transition on a shot, take both away', () => {
    const two = run(PLAN, { op: 'add_shot', shot: { name: 'again', camera: 'a', span: [1, 2] } });
    const p = run(two,
      { op: 'add_piece', piece: { id: 'gate', kind: 'frame', attach: 'a', keys: [{ t: 0, at: [2, 0, 0], open: 1 }] } },
      { op: 'piece_key', piece: 'gate', key: { t: 1, open: 0, ease: 'easy ease' } },
      { op: 'set_piece', piece: 'gate', color: '#ff0000', shape: 'square' },
      { op: 'set_shot', shot: 'again', in: { type: 'wipe', dir: 'right' } });
    const gate = p.pieces[0];
    expect(gate.keys.map((k) => [k.t, k.open])).toEqual([[0, 1], [1, 0]]);
    expect([gate.color, gate.shape]).toEqual(['#ff0000', 'square']);
    expect(p.shots[1].in).toEqual({ type: 'wipe', duration: 0.8, dir: 'right' });
    const q = run(p, { op: 'remove_piece', piece: 'gate' }, { op: 'set_shot', shot: 'again', in: 'cut' });
    expect(q.pieces).toBeUndefined();
    expect(q.shots[1].in).toBeUndefined();
  });

  it('a camera taken away takes the pieces riding it', () => {
    const p = run(PLAN, { op: 'add_camera', camera: { id: 'b', keys: [{ t: 0, pos: [0, -9, 1], poi: [0, 0, 1] }] } },
      { op: 'add_piece', piece: { kind: 'wall', attach: 'b' } }, { op: 'remove_camera', camera: 'b' });
    expect(p.pieces).toBeUndefined();
  });
});

describe('clearance against what moves', async () => {
  const { shootTraffic } = await import('./clearance.js');
  // a car 2 long, 1 wide, 1 high (its mesh: two vertices, the top one at z = 1) driving +x at 2/s along y = 0
  const f = new Float32Array([0, 0, 0, 0, 0, 1]);
  const mesh = { pos: Buffer.from(f.buffer).toString('base64'), len: 2, wid: 1 };
  const subjects = shootSubjects({ cars: [{ car: 'm', path: [[0, 0, 0], [40, 0, 0]], speed: 2 }], carMeshes: { m: mesh } });
  // a camera standing in the lane, low, looking down it: the car reaches it at 5 s
  const STAND = (z, span = [0, 8]) => normalizeShoot({ fps: 10, cameras: [{ id: 'cam', keys: [{ t: 0, pos: [10, 0, z], poi: [20, 0, z] }, { t: 8, pos: [10, 0, z], poi: [20, 0, z] }] }],
    shots: [{ camera: 'cam', span }] }, { subjects }).plan;

  it('measures the car off its mesh', () => {
    expect(subjects.get('car:0').box).toEqual({ len: 2, wid: 1, hgt: 1 });
  });

  it('a camera the car drives through is reported once, when the car reaches it', () => {
    const hits = shootTraffic(STAND(0.5), subjects);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ camera: 'cam', subject: 'car:0' });
    expect(hits[0].t).toBeCloseTo(4.5, 6);   // the first frame (10 fps) after its front (x = 2t + 1) reaches x = 10 − margin (4.44 s)
  });

  it('a camera above the car, or not on screen then, is clear', () => {
    expect(shootTraffic(STAND(1.5), subjects)).toEqual([]);
    expect(shootTraffic(STAND(0.5, [0, 3]), subjects)).toEqual([]);   // its shot ends before the car arrives
  });
});
