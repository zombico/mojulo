import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '@/lib/graph/worlds/controllable-world';
import { readGameworld, MEADOWMARK_HERO } from '@/lib/graph/gameworld/index.js';
import { gameStages, stageLevelOrder } from '@/lib/graph/gameworld/levels.js';
import { HERO_CHASE } from '@/lib/graph/playscape/hero-chase.js';

// THE STEERED CHASE (rules-basic.js follow `steer`) and CAMERA MOVEMENT (rules-platform.js `move: 'camera'`): a 3D
// platformer's two cameras, the one that follows by itself (trail) and the one the player turns (orbit), the hero running
// the way the camera looks, the view held still through a jump. Absent `steer`, the chase behind the heading.

const DT = 1 / 60;
const FLAT = { ground: () => 0 };
const mk = (steer, move = 'camera', world = {}) => createWorld({ ...world, entities: [{ id: 'h', pilotable: true, rule: { type: 'platform', eye: 0, speed: 6, ...(move ? { move } : {}) }, transform: { pos: [0, 0, 0], heading: 0 } }], camera: { rule: 'follow', target: 'h', ...HERO_CHASE, ...(steer ? { steer } : {}) } });
const steps = (w, inputs, n, hooks = FLAT) => { for (let f = 0; f < n; f++) stepWorld(w, inputs(f) ?? {}, DT, hooks); return w; };
const yawOf = (w) => w.camera.camYaw;
const wrap = (a) => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;

describe('the orbit: the player turns the camera; the hero runs the way it looks', () => {
  it('the look turns the yaw, and W runs along it however it has turned', () => {
    const w = mk('orbit');
    steps(w, () => ({}), 5);
    expect(yawOf(w)).toBeCloseTo(0, 9);
    steps(w, () => ({ lookDX: 15 }), 30);   // turn it round a quarter
    const y = yawOf(w);
    expect(Math.abs(y)).toBeGreaterThan(1.2);
    const p0 = [...w.byId.h.transform.pos];
    steps(w, () => ({ forward: 1 }), 30);
    const d = [w.byId.h.transform.pos[0] - p0[0], w.byId.h.transform.pos[1] - p0[1]];
    expect(Math.abs(wrap(Math.atan2(d[1], d[0]) - yawOf(w)))).toBeLessThan(0.05);
    // the yaw is the world's to read
    expect(yawOf(w)).toBeCloseTo(y, 9);
  });
});

describe('the trail: the camera follows by itself', () => {
  it('eases behind the run as the hero turns, holds while it stands, and holds when it runs back at the camera', () => {
    const w = mk('trail');
    steps(w, () => ({}), 5);
    // run to the right (D): the hero turns toward its run, the camera eases round behind it
    steps(w, () => ({ forward: 1, strafe: 1 }), 120);
    const run = Math.atan2(w.byId.h.transform.pos[1], w.byId.h.transform.pos[0]);
    expect(Math.abs(wrap(yawOf(w)))).toBeGreaterThan(0.3);
    // stood still, it holds
    const held = yawOf(w); steps(w, () => ({}), 60); expect(yawOf(w)).toBeCloseTo(held, 9);
    // running straight back at the camera (S): the yaw holds, never spinning round
    steps(w, () => ({ forward: -1 }), 30);
    expect(Math.abs(wrap(yawOf(w) - held))).toBeLessThan(0.2);
    expect(Number.isFinite(run)).toBe(true);
  });
});

describe('the deadzone: a jump does not bob the view', () => {
  it('the camera holds its height through a jump, follows a drop past its band, and eases back on landing', () => {
    const w = mk('trail'); w.byId.h.rule.jumpSpeed = 7;
    steps(w, () => ({}), 150);   // (the chase eased into place)
    const z0 = w.camera.transform.pos[2], heights = [];
    steps(w, (f) => { if (f > 0) heights.push(w.camera.transform.pos[2]); return { jump: f === 0, jumpHeld: true }; }, 60);
    expect(Math.max(...heights) - z0).toBeLessThan(0.02);
    // the plain chase follows the jump up
    const plain = mk(null, null); steps(plain, () => ({}), 150); plain.byId.h.rule.jumpSpeed = 7;
    const p0 = plain.camera.transform.pos[2], ph = [];
    steps(plain, (f) => { ph.push(plain.camera.transform.pos[2]); return { jump: f === 0, jumpHeld: true }; }, 40);
    expect(Math.max(...ph) - p0).toBeGreaterThan(0.5);
    // off a ledge three metres down: past the band, it follows the fall
    const drop = mk('trail'), LEDGE = { ground: (p) => (p[0] < 2 ? 0 : -3) };
    steps(drop, () => ({}), 150, LEDGE);
    const d0 = drop.camera.transform.pos[2];
    steps(drop, () => ({ forward: 1 }), 120, LEDGE);
    expect(drop.camera.transform.pos[2]).toBeLessThan(d0 - 2);
  });
});

describe('a gameworld\'s 3D platformer cameras', () => {
  const order = (camera) => { const W = { ...MEADOWMARK_HERO, camera }, G = readGameworld(W); return stageLevelOrder(G, gameStages(W)[0], { ref: 'lv_0', heroRef: 'gw-hero' }).args.manifest; };
  it('follow and orbit lay the steered chase and the camera\'s movement, the legend saying the look', () => {
    const F = order('follow'), O = order('orbit');
    expect(F.camera).toMatchObject({ rule: 'follow', steer: 'trail' });
    expect(O.camera).toMatchObject({ rule: 'follow', steer: 'orbit' });
    expect(F.entities[0].rule.move).toBe('camera');
    expect(JSON.stringify(O.events)).toContain('right stick  look');
    expect(JSON.stringify(F.events)).not.toContain('look');
    // the third-person chase is the one it was
    const T = order('third-person');
    expect(T.camera.steer).toBeUndefined();
    expect(T.entities[0].rule.move).toBeUndefined();
  });
});
