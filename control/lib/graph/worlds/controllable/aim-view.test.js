import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { SHOULDER } from '../../gameworld/quick.js';

// THE AIM HELD (aim-view.js): a body under a free orbit camera; with the aim held the camera stands behind its shoulder
// and the body turns with the look; from there, its eye; let go, the orbit again, looking where the aim left it.

const E = composeLive();
const hooks = { ground: () => 0 };
const AIM = { shoulder: { ...SHOULDER }, eye: 1.6 };
const world = (aimView = AIM) => E.createWorld({
  camera: { rule: 'follow', target: 'p', dist: 6, height: 3, lead: 4, lookH: 1.5, steer: 'orbit', mouseLook: true },
  entities: [
    { id: 'p', pilotable: true, rule: { type: 'platform', speed: 4, move: 'camera', eye: 0, ...(aimView ? { aimView } : {}) },
      weapon: { fireClass: 'sight', auto: false, cooldown: 0.2, magazine: 99, damage: 1, range: 80, coreAngle: 0.4, eye: 1.5 }, body: { type: 'mesh', hittable: true }, transform: { pos: [0, 0, 0], heading: 0 } },
    { id: 't', rule: { type: 'walk', speed: 0, eye: 0 }, body: { type: 'mesh', hittable: true, hp: 1e6, egg: { a: 0.35, c: 0.9, cz: 0.9 } }, transform: { pos: [0, 12, 0], heading: 0 } },
  ],
});
const run = (w, input, n = 30) => { for (let k = 0; k < n; k++) E.stepWorld(w, input, 1 / 60, hooks); return w; };

describe('the aim held', () => {
  it('is emitted only into a world that asks for it', () => {
    expect(emissionSource({})).not.toContain('stepWithAimView');
    expect(emissionSource({ aimView: true })).toContain('stepWithAimView');
  });
  it('a body without it steps as it did', () => {
    const a = run(world(null), { forward: 1, aim: 1, lookDX: 4 }), b = run(world(null), { forward: 1, lookDX: 4 });
    expect(a.camera.rule.steer).toBe('orbit');
    expect(a.byId.p.transform.pos).toEqual(b.byId.p.transform.pos);
  });
  it('the aim comes up: the body faces where the camera looked, the camera behind its shoulder; let go, the orbit where the aim left it', () => {
    const w = world();
    run(w, { lookDX: 10 }, 45);                      // the look turns the orbit; the body does not turn
    const yaw = w.camera.camYaw;
    expect(Math.abs(yaw)).toBeGreaterThan(0.5);
    expect(w.byId.p.transform.heading).toBeCloseTo(0, 6);
    run(w, { aim: 1 }, 1);
    expect(w.byId.p.transform.heading).toBeCloseTo(yaw, 6);
    expect(w.camera.rule.steer).toBeUndefined();
    expect(w.camera.rule.shoulder).toBeCloseTo(SHOULDER.shoulder, 6);
    expect(w.byId.p.rule.turnMode).toBe('look');
    expect(w.byId.p.rule.move).toBeUndefined();
    run(w, { aim: 1, lookDX: 10 }, 30);              // aiming, the look turns the body
    const h = w.byId.p.transform.heading;
    expect(Math.abs(h - yaw)).toBeGreaterThan(0.3);
    run(w, {}, 1);
    expect(w.camera.rule.steer).toBe('orbit');
    expect(w.camera.camYaw).toBeCloseTo(h, 6);
    expect(w.byId.p.rule.move).toBe('camera');
    expect(w.byId.p.rule.turnMode).toBeUndefined();
    expect(w.byId.p.transform.pitch).toBe(0);
  });
  it('the eye, on an edge while aiming, and the other shoulder; the aim let go leaves the eye', () => {
    const w = run(world(), { aim: 1 }, 2);
    run(w, { aim: 1, shoulder: 1 }, 3);              // held: one swap, not three
    expect(w.camera.rule.shoulder).toBeCloseTo(-SHOULDER.shoulder, 6);
    run(w, { aim: 1 }, 1); run(w, { aim: 1, view: 1 }, 3);
    expect(w.camera.rule.type).toBe('eye');
    expect(w.camera.rule.hideTarget).toBe(true);
    expect(w.camera.transform.pos[2]).toBeCloseTo(1.6, 6);
    run(w, { aim: 1 }, 1); run(w, { aim: 1, view: 1 }, 1);
    expect(w.camera.rule.type).toBe('follow');
    run(w, { aim: 1 }, 1); run(w, { aim: 1, view: 1 }, 1); run(w, {}, 1);
    expect(w.camera.rule.steer).toBe('orbit');
    expect(w.byId.p.av.fp).toBe(false);
  });
  it('the trigger is the aim\'s: no round with the aim down, a round with it up; with `hip`, either way', () => {
    const shots = (w, input) => { run(w, input, 20); return w.byId.p.lastShot ? 1 : 0; };
    expect(shots(world(), { fire: 1 })).toBe(0);
    expect(shots(world(), { fire: 1, aim: 1 })).toBe(1);
    expect(shots(world({ ...AIM, hip: true }), { fire: 1 })).toBe(1);
  });
});
