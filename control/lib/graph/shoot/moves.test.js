import { describe, it, expect } from 'vitest';
import { moveKeys, moveOf, moveSeconds, MOVES } from './moves.js';
import { readShake, shakeAt, SHAKES, FADE } from './shake.js';
import { normalizeShoot } from './plan.js';
import { applyShootOp } from './ops.js';
import { compileCamera, cameraAt } from './sample.js';
import { readFigure, frameRead } from './frame.js';

const walker = { id: 'walker:0', kind: 'walker', box: { len: 0.6, wid: 0.6, hgt: 1.75 }, at: (t) => ({ pos: [t, 0, 0], heading: 0 }) };
const other = { id: 'walker:1', kind: 'walker', box: { len: 0.6, wid: 0.6, hgt: 1.75 }, at: () => ({ pos: [2, 8, 0], heading: -1.5 }) };
const subjects = new Map([[walker.id, walker], [other.id, other]]);
const plan = (keys, extra = {}) => normalizeShoot({ cameras: [{ id: 'a', keys, ...extra }] }, { subjects });
const sizeAt = (p, t, who = walker) => { const c = cameraAt(compileCamera(p.cameras[0], { subjects }), t), w = who.at(t); return { size: readFigure(c, { pos: w.pos, heading: w.heading, height: 1.75 }).size, cam: c }; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const lens = (c) => Math.round(18 / Math.tan((c.hfov * Math.PI) / 360));

describe('named moves', () => {
  it('a dolly keeps its lens and gets its size by the distance (push in: ms → cu, riding the subject)', () => {
    const { plan: p, warnings } = plan([{ t: 1, move: { kind: 'push in', on: 'walker:0' } }]);
    expect(warnings).toEqual([]);
    const a = sizeAt(p, 1), b = sizeAt(p, 1 + moveSeconds({ kind: 'push_in' }));
    expect([a.size, b.size]).toEqual(['ms', 'cu']);
    expect(lens(a.cam)).toBe(lens(b.cam));
    expect(p.cameras[0].keys.every((k) => k.about === 'walker:0' && k.framing.move === 'push_in')).toBe(true);
  });
  it('a dolly zoom holds the size while the lens changes', () => {
    const p = plan([{ t: 0, move: { kind: 'vertigo', on: 'walker:0', size: 'mcu', from: '24mm', to: '85mm', for: 2 } }]).plan;
    const reads = [0, 0.7, 1.3, 2].map((t) => sizeAt(p, t));
    expect(reads.map((r) => r.size)).toEqual(['mcu', 'mcu', 'mcu', 'mcu']);
    expect(lens(reads[0].cam)).toBeLessThan(lens(reads[3].cam));
  });
  it('an arc turns round the subject by its degrees at one size, a key every 30° at most', () => {
    const p = plan([{ t: 0, move: { kind: 'orbit', on: [0, 0, 0], heading: 0, size: 'ms', side: 'front', by: 120, for: 4 } }]).plan;
    const ks = p.cameras[0].keys, az = (k) => (Math.atan2(k.pos[1] - k.poi[1], k.pos[0] - k.poi[0]) * 180) / Math.PI;   // along the lens (lead room trucks it aside)
    expect(ks).toHaveLength(5);
    expect(az(ks.at(-1)) - az(ks[0])).toBeCloseTo(120, 0);
    expect([0, 2, 4].map((t) => sizeAt(p, t, { at: () => ({ pos: [0, 0, 0], heading: 0 }) }).size)).toEqual(['ms', 'ms', 'ms']);
  });
  it('a crane rises from eye level to a high wide, bowing through a key between', () => {
    const p = plan([{ t: 0, move: { kind: 'crane_up', on: [0, 0, 0] } }]).plan, ks = p.cameras[0].keys;
    expect(ks).toHaveLength(3);
    expect(ks.at(-1).pos[2]).toBeGreaterThan(ks[0].pos[2]);
    expect(ks.at(-1).framing.angle).toBe('high');
  });
  it('a whip pan holds the camera and turns it from one subject to the other; its blur is not lost', () => {
    const p = plan([{ t: 0, move: { kind: 'whip', on: 'walker:0', to: 'walker:1' } }]).plan, ks = p.cameras[0].keys;
    expect(ks[0].pos).toEqual(ks[1].pos);
    expect(ks[1].about).toBe('walker:1');
    expect(frameRead(p, { subjects }).notes.map((n) => n.code)).not.toContain('lost');
  });
  it('a crash zoom stays where it stands and lands its size through a key at each size between', () => {
    const p = plan([{ t: 0, move: { kind: 'snap zoom', on: [0, 0, 0], from: 'ws', to: 'cu' } }]).plan, ks = p.cameras[0].keys;
    expect(new Set(ks.map((k) => k.pos.join())).size).toBe(1);
    expect(ks.map((k) => k.framing.size)).toEqual(['ws', 'fs', 'mls', 'ms', 'mcu', 'cu']);
    expect(ks.at(-1).focal_mm).toBeGreaterThan(ks[0].focal_mm);
  });
  it('a track rides a moving subject; on a still point it trucks across the frame', () => {
    const rides = plan([{ t: 0, move: { kind: 'track', on: 'walker:0' } }]).plan;
    expect(rides.cameras[0].keys[0].pos.follow).toBe('walker:0');
    const truck = plan([{ t: 0, move: { kind: 'truck', on: [0, 0, 0], by: 4 } }]).plan.cameras[0].keys;
    expect(dist(truck[0].pos, truck[1].pos)).toBeCloseTo(4, 3);
  });
  it('a move replaces the keys in its span and keeps the rest', () => {
    const p = plan([{ t: 0, pos: [0, -9, 2], poi: [0, 0, 1] }, { t: 2, pos: [1, -9, 2], poi: [0, 0, 1] }, { t: 9, pos: [2, -9, 2], poi: [0, 0, 1] }, { t: 1, move: { kind: 'push_in', on: 'walker:0', for: 3 } }]).plan;
    expect(p.cameras[0].keys.map((k) => k.t)).toEqual([0, 1, 4, 9]);
  });
  it('words it cannot read are warned', () => {
    expect(moveKeys({ kind: 'barrel roll', on: [0, 0, 0] }, 0).warnings[0]).toMatch(/unknown move/);
    expect(moveKeys({ kind: 'whip_pan', on: [0, 0, 0] }, 0).warnings[0]).toMatch(/needs `to`/);
    expect(moveOf('dolly in').id).toBe('push_in');
  });
  it('a normalized plan of moves normalizes to itself', () => {
    const p = plan([{ t: 0, move: { kind: 'arc', on: 'walker:0' } }, { t: 0, move: { kind: 'handheld' } }]).plan;
    expect(normalizeShoot(p, { subjects }).plan).toEqual(p);
  });
});

describe('shake', () => {
  const base = [{ t: 0, pos: [0, -6, 1.6], poi: [0, 0, 1.4] }, { t: 6, pos: [0, -6, 1.6], poi: [0, 0, 1.4] }];
  it('absent, the camera is the keyed camera; present, it moves off it by about its style\'s measure, the same each time', () => {
    const still = plan(base).plan, shaken = plan([...base, { t: 0, move: { kind: 'handheld', amount: 1 } }]).plan;
    expect(still.cameras[0].shake).toBeUndefined();
    const a = compileCamera(still.cameras[0]), b = compileCamera(shaken.cameras[0]);
    const off = [0.5, 1.7, 3.1, 4.4].map((t) => dist(cameraAt(a, t).pos, cameraAt(b, t).pos));
    expect(Math.max(...off)).toBeGreaterThan(0);
    expect(Math.max(...off)).toBeLessThan(SHAKES.find((s) => s.id === 'handheld').pos * 3);
    expect(cameraAt(b, 2.2)).toEqual(cameraAt(compileCamera(plan([...base, { t: 0, move: { kind: 'handheld', amount: 1 } }]).plan.cameras[0]), 2.2));
  });
  it('a shake over a span is still outside it and fades in at its start', () => {
    const { shake } = readShake({ style: 'run', span: [1, 3] });
    expect(shakeAt(shake, 0.5)).toEqual({ right: 0, up: 0, fwd: 0, yaw: 0, pitch: 0, roll: 0 });
    const near = shakeAt(shake, 1 + FADE * 0.05), inside = shakeAt(shake, 2);
    expect(Math.abs(near.yaw)).toBeLessThan(Math.abs(inside.yaw) + 1e-9 + 0.2);
    expect(Math.abs(near.right)).toBeLessThan(0.01);
  });
  it('a faster style turns the aim further; amount scales it; the seed is its own dice', () => {
    const turn = (style, amount = 1, seed = 'x') => { const { shake } = readShake({ style, amount, seed }); let m = 0; for (let t = 0; t < 8; t += 0.05) m = Math.max(m, Math.abs(shakeAt(shake, t).yaw)); return m; };
    expect(turn('run')).toBeGreaterThan(turn('steadicam'));
    expect(turn('handheld', 2)).toBeCloseTo(2 * turn('handheld'), 9);
    expect(turn('handheld', 1, 'x')).not.toBe(turn('handheld', 1, 'y'));
  });
  it('the shake rides set_camera and the move op; a shake needs a camera to lay over', () => {
    let p = plan(base).plan;
    p = normalizeShoot(applyShootOp(p, { op: 'set_camera', camera: 'a', shake: 'steadicam' }).plan, { subjects }).plan;
    expect(p.cameras[0].shake.style).toBe('steadicam');
    p = normalizeShoot(applyShootOp(p, { op: 'set_camera', camera: 'a', shake: null }).plan, { subjects }).plan;
    expect(p.cameras[0].shake).toBeUndefined();
    expect(() => applyShootOp(p, { op: 'move', camera: 'nope', t: 0, move: 'handheld' })).toThrow(/shake is laid over/);
  });
});

describe('the move op', () => {
  it('adds a camera making the move, with a shot over it', () => {
    const p0 = plan([{ t: 0, pos: [0, -9, 2], poi: [0, 0, 1] }]).plan;
    const { plan: raw, note } = applyShootOp(p0, { op: 'move', camera: 'arc', t: 2, move: 'arc', on: 'walker:0', by: -60 });
    expect(note).toMatch(/added camera arc with a arc from 2s/);
    const p = normalizeShoot(raw, { subjects }).plan;
    expect(p.cameras[1].keys).toHaveLength(3);
    expect(p.shots.find((s) => s.camera === 'arc').span).toEqual([2, 2 + moveSeconds({ kind: 'arc' })]);
  });
  it('names the moves it knows when it is asked for one it does not', () => {
    expect(() => applyShootOp(plan([{ t: 0, pos: [0, -9, 2], poi: [0, 0, 1] }]).plan, { op: 'move', camera: 'a', t: 0, move: 'loop the loop', on: 'walker:0' })).toThrow(new RegExp(MOVES[0].id));
  });
});
