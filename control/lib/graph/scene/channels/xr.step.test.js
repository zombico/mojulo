import { describe, expect, it } from 'vitest';

import * as THREE from '../../../../public/vendor/three/three.core.min.js';
import { xrConfig, xrFromParam, xrModeScript } from './xr.js';
import { composeLive } from '../../worlds/controllable/compose.js';
import { emitThreeWorld } from '../scene-three.js';
import { validateRig, rigNodesAt } from '../../polygonizer/station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../../mcp/tools/layered.js';
import { xrHands } from '../../polygonizer/hero-xr-hands.js';
import { gearMounts } from '../../polygonizer/hero-gear.js';
import { buildSweep } from '../../worlds/controllable/sweep.js';
import { manaUi } from '../../../mana-ui/kernel.js';
import { buildManaHost } from '../../controls/mana-host.js';

// The headset's locomotion, run: the emitted block against the vendored three's math, a fake session whose sticks and
// head the test moves, so "goes straight" and "turns in place" are measured, not read off the source. The eyes gate
// (a person in a Quest) is the operator's.

function rigUp(xr, { headOffset = [0, 0] } = {}) {
  const cfg = xrConfig(xr, null);
  const pads = { left: { axes: [0, 0, 0, 0], buttons: [] }, right: { axes: [0, 0, 0, 0], buttons: [] } };
  const session = {
    inputSources: [{ handedness: 'left', gamepad: pads.left, gripSpace: 'grip:left' }, { handedness: 'right', gamepad: pads.right, gripSpace: 'grip:right' }],
    addEventListener() {}, end() {},
  };
  // the head's yaw INSIDE the play space (what a Quest reports: rig-local, y-up, about +Y), set by the test; the
  // world heading is the body's (the rig's) plus this, which is the composition a right-stick turn must go through
  const head = { yaw: 0 };
  // the controllers, rig-local: `at` null holds them at the sides (their midpoint under the head), a yaw holds them out
  // 0.3 m in front of the head that way, a shoulder's width apart
  const hands = { at: null };
  const grip = (side) => {
    const hx = headOffset[0], hz = -headOffset[1], a = hands.at, k = side === 'left' ? -0.2 : 0.2;
    if (a === null) return { x: hx + k, y: 0.9, z: hz };
    return { x: hx - 0.3 * Math.sin(a) + k * Math.cos(a), y: 1.1, z: hz - 0.3 * Math.cos(a) - k * Math.sin(a) };
  };
  const frame = {
    getViewerPose: () => ({ transform: {
      position: { x: headOffset[0], y: 1.6, z: -headOffset[1] },   // the player stands off the play-space origin
      orientation: { x: 0, y: Math.sin(head.yaw / 2), z: 0, w: Math.cos(head.yaw / 2) },
    } }),
    getPose: (space) => (space === 'grip:left' || space === 'grip:right' ? { transform: { position: grip(space.slice(5)) } } : null),
  };
  const renderer = {
    xr: {
      enabled: false, getSession: () => session, getFrame: () => frame, getReferenceSpace: () => ({}),
      setReferenceSpaceType() {}, async setSession() {},
    },
  };
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 1.6); camera.lookAt(1, 0, 1.6);   // looking down +X
  const scene = new THREE.Scene();
  const btn = () => ({ classList: { add() {}, remove() {} }, hidden: false });
  const env = {
    THREE, renderer, camera, scene, controls: { enabled: true }, hud: { appendChild() {} },
    document: { createElement: btn, pointerLockElement: null },
    navigator: { xr: { requestSession: async () => session, isSessionSupported: () => Promise.resolve(true) } },
  };
  const body = `let walkOn = false;\n${xrModeScript(cfg)}\nreturn { enter: __xrEnter, step: __xrStep, rig: () => __xrRig };`;
  const page = new Function(...Object.keys(env), body)(...Object.values(env));
  return { cfg, pads, head, hands, page };
}

// the head's world XY: the rig carrying the viewer pose
const headWorld = (r, off) => { const v = new THREE.Vector3(off[0], 1.6, -off[1]); r.page.rig().updateMatrixWorld(); return r.page.rig().localToWorld(v); };

describe('xr locomotion, run', () => {
  it('feet, body, head: the head is a pure camera, looking before or during a push never steers it', async () => {
    const r = rigUp(true);
    expect(r.cfg.move).toBe('seated');
    await r.page.enter();
    r.head.yaw = 0.8;                            // looking 45° left before pushing
    r.pads.left.axes = [0, 0, 0.12, -1];         // forward, a worn stick's drift to the right
    for (let i = 0; i < 60; i++) { if (i === 30) r.head.yaw = -0.8; r.page.step(1 / 60); }
    const p = r.page.rig().position;
    expect(p.x).toBeCloseTo(3, 5);               // the body's forward, +X, at 3 m/s
    expect(Math.abs(p.y)).toBeLessThan(1e-9);
  });

  it('latch: walks straight on the heading the push began on, a glance aside mid-walk does not bend it', async () => {
    const r = rigUp({ move: 'latch' });
    await r.page.enter();
    r.pads.left.axes = [0, 0, 0.12, -1];       // forward, a worn stick's drift to the right
    for (let i = 0; i < 60; i++) {
      r.head.yaw = i > 20 ? 0.6 : 0;             // a third of a second in, the player looks 35° left
      r.page.step(1 / 60);
    }
    const p = r.page.rig().position;
    expect(p.x).toBeCloseTo(3, 5);               // a second at 3 m/s down +X
    expect(Math.abs(p.y)).toBeLessThan(1e-9);    // and not a hair off it
  });

  it('the gaze mode steers by the head, the old behaviour, now an opt-in', async () => {
    const r = rigUp({ move: 'head' });
    await r.page.enter();
    r.pads.left.axes = [0, 0, 0, -1];
    for (let i = 0; i < 60; i++) { r.head.yaw = i > 20 ? 0.6 : 0; r.page.step(1 / 60); }
    expect(r.page.rig().position.y).toBeGreaterThan(1);
  });

  it('turns smoothly on the right stick about the head, not the play-space origin', async () => {
    const off = [0.8, 0.5];
    const r = rigUp(true, { headOffset: off });
    await r.page.enter();
    const before = headWorld(r, off).clone();
    r.pads.right.axes = [0, 0, 1, 0];
    for (let i = 0; i < 30; i++) r.page.step(1 / 60);    // half a second at 120°/s: 60° to the right
    const after = headWorld(r, off);
    expect(after.distanceTo(before)).toBeLessThan(1e-9);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(r.page.rig().quaternion);
    expect(Math.atan2(fwd.y, fwd.x)).toBeCloseTo(-Math.PI / 3, 6);
  });

  it('turning mid-walk turns the latched heading with the body', async () => {
    const r = rigUp(true);
    await r.page.enter();
    r.pads.left.axes = [0, 0, 0, -1];
    r.pads.right.axes = [0, 0, -1, 0];                   // walking forward, turning left
    for (let i = 0; i < 45; i++) r.page.step(1 / 60);    // 90° over three quarters of a second
    r.pads.right.axes = [0, 0, 0, 0];
    const p0 = r.page.rig().position.clone();
    for (let i = 0; i < 60; i++) r.page.step(1 / 60);
    const d = r.page.rig().position.clone().sub(p0);
    expect(d.x).toBeCloseTo(0, 6);                       // now walking down +Y
    expect(d.y).toBeCloseTo(3, 6);
  });

  // the operator's report from a Quest 3S: walking north, a right-stick turn to the east, and forward still walked north.
  // Forward is where the body faces after a turn, the convention every controller game keeps.
  it('forward follows the body after a right-stick turn, held through the turn or pushed again after it', async () => {
    for (const [move, regrip] of [['seated', false], ['seated', true], ['standing', false], ['latch', false], ['latch', true]]) {
      const r = rigUp({ move });
      await r.page.enter();
      r.pads.left.axes = [0, 0, 0, -1];
      for (let i = 0; i < 30; i++) r.page.step(1 / 60);          // walking "north" (+X here)
      if (regrip) r.pads.left.axes = [0, 0, 0, 0];
      r.pads.right.axes = [0, 0, 1, 0];
      for (let i = 0; i < 45; i++) r.page.step(1 / 60);          // 90° to the right: now facing -Y
      r.pads.right.axes = [0, 0, 0, 0];
      r.pads.left.axes = [0, 0, 0, -1];
      const p0 = r.page.rig().position.clone();
      for (let i = 0; i < 60; i++) r.page.step(1 / 60);
      const d = r.page.rig().position.clone().sub(p0);
      expect(d.x, `${move}, ${regrip ? 'pushed again' : 'held'}`).toBeCloseTo(0, 6);
      expect(d.y, `${move}, ${regrip ? 'pushed again' : 'held'}`).toBeCloseTo(-3, 6);
    }
  });

  // standing: the body is the player's torso, turned by turning, estimated from the hands and the head
  const walkDir = (r, frames = 60) => {
    r.pads.left.axes = [0, 0, 0, -1];
    const p0 = r.page.rig().position.clone();
    for (let i = 0; i < frames; i++) r.page.step(1 / 60);
    r.pads.left.axes = [0, 0, 0, 0];
    const d = r.page.rig().position.clone().sub(p0);
    return Math.atan2(d.y, d.x);
  };
  const settle = (r, s) => { for (let i = 0; i < s * 60; i++) r.page.step(1 / 60); };

  it('standing: turning the whole body, hands with it, turns forward; snap turning is the right stick’s default', async () => {
    const r = rigUp({ move: 'standing' });
    expect(r.cfg.turn).toBe('snap');
    await r.page.enter();
    r.hands.at = 0; settle(r, 0.2);
    expect(walkDir(r)).toBeCloseTo(0, 3);                     // facing +X
    r.head.yaw = -Math.PI / 2; r.hands.at = -Math.PI / 2;     // the player turns 90° to the right where they stand
    settle(r, 1);
    expect(walkDir(r)).toBeCloseTo(-Math.PI / 2, 2);          // forward is the new way, no stick touched
  });

  it('standing: with the hands out in front, a glance aside walking does not steer', async () => {
    const r = rigUp({ move: 'standing' });
    await r.page.enter();
    r.hands.at = 0; settle(r, 0.2);
    r.pads.left.axes = [0, 0, 0, -1];
    for (let i = 0; i < 60; i++) { r.head.yaw = i >= 15 && i < 45 ? 0.7 : 0; r.page.step(1 / 60); }   // half a second's look
    const p = r.page.rig().position;
    expect(Math.abs(p.y)).toBeLessThan(1e-6);
    expect(p.x).toBeCloseTo(3, 5);
  });

  it('standing: with the hands down, the body catches up to where the head stays; a quick glance barely moves it', async () => {
    const r = rigUp({ move: 'standing' });
    await r.page.enter();
    settle(r, 0.2);
    r.head.yaw = 0.6; settle(r, 0.15); r.head.yaw = 0;      // a glance
    expect(Math.abs(walkDir(r, 1))).toBeLessThan(0.1);
    r.head.yaw = Math.PI / 2; settle(r, 4);                 // turned and stayed turned
    expect(walkDir(r, 1)).toBeCloseTo(Math.PI / 2, 1);
  });

  it('standing: the head never sits more than the neck allows off the body', async () => {
    const r = rigUp({ move: 'standing' });
    await r.page.enter();
    r.hands.at = 0; settle(r, 0.2);
    r.head.yaw = 1.6; r.page.step(1 / 60);                   // ~92° at once, the hands still forward
    expect(walkDir(r, 1)).toBeGreaterThan(1.6 - r.cfg.neck - 0.05);
  });

  it('standing: the right stick still snap-turns on top of the torso, and `off` turns it off', async () => {
    const r = rigUp({ move: 'standing' });
    await r.page.enter();
    r.hands.at = 0; settle(r, 0.2);
    r.pads.right.axes = [0, 0, 1, 0]; r.page.step(1 / 60); r.pads.right.axes = [0, 0, 0, 0];
    expect(walkDir(r, 1)).toBeCloseTo(-r.cfg.snap, 3);
    const q = rigUp({ move: 'standing', turn: 'off' });
    await q.page.enter();
    q.hands.at = 0; settle(q, 0.2);
    q.pads.right.axes = [0, 0, 1, 0]; settle(q, 0.5);
    expect(walkDir(q, 1)).toBeCloseTo(0, 3);
  });

  it('snap turns one step a push, about the head', async () => {
    const off = [0.4, -0.3];
    const r = rigUp({ snap: 45 }, { headOffset: off });
    expect(r.cfg.turn).toBe('snap');
    await r.page.enter();
    const before = headWorld(r, off).clone();
    r.pads.right.axes = [0, 0, 1, 0];
    for (let i = 0; i < 10; i++) r.page.step(1 / 60);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(r.page.rig().quaternion);
    expect(Math.atan2(fwd.y, fwd.x)).toBeCloseTo(-Math.PI / 4, 6);
    expect(headWorld(r, off).distanceTo(before)).toBeLessThan(1e-9);
  });

  it('reads the sticks through the scheme: a remap swaps the hands', async () => {
    const r = rigUp({ bind: { moveForward: ['right.thumbstickY-'], moveBack: ['right.thumbstickY+'], strafeLeft: ['right.thumbstickX-'], strafeRight: ['right.thumbstickX+'], turnLeft: ['left.thumbstickX-'], turnRight: ['left.thumbstickX+'] } });
    await r.page.enter();
    r.pads.right.axes = [0, 0, 0, -1];
    for (let i = 0; i < 60; i++) r.page.step(1 / 60);
    expect(r.page.rig().position.x).toBeCloseTo(3, 5);
  });
});

describe('xr config', () => {
  it('defaults: smooth turn, the body’s heading, a radial dead zone; `snap` alone still means snap turning', () => {
    expect(xrConfig(true, null)).toMatchObject({ turn: 'smooth', move: 'seated', dead: 0.2, speed: 3 });
    expect(xrConfig({ move: 'standing' }, null).turn).toBe('snap');
    expect(xrConfig({ move: 'standing', turn: 'smooth' }, null).turn).toBe('smooth');
    expect(xrConfig({ snap: 45 }, null).turn).toBe('snap');
    expect(xrConfig({ snap: 45, turn: 'smooth' }, null).turn).toBe('smooth');
    expect(xrConfig({ move: 'sideways' }, null).move).toBe('seated');
    expect(xrConfig(null, null)).toBe(null);
  });

  it('?xr= words pick the modes over the manifest’s own', () => {
    expect(xrFromParam(null, null)).toBe(null);
    expect(xrFromParam(null, { eye: 1.7 })).toEqual({ eye: 1.7 });
    expect(xrFromParam('0', { eye: 1.7 })).toBe(null);
    expect(xrFromParam('1', null)).toBe(true);
    expect(xrFromParam('snap,hand', { eye: 1.7 })).toEqual({ eye: 1.7, turn: 'snap', move: 'hand' });
    expect(xrFromParam('standing', { turn: 'smooth' })).toEqual({ move: 'standing' });   // the stance picks its own turn
    expect(xrFromParam('standing,smooth', null)).toEqual({ move: 'standing', turn: 'smooth' });
  });
});

// THE GAME IN THE HEADSET (`ctrl`): the emitted block against a REAL kernel world (composeLive), its input read standing
// in for the page's (a pad's tank-turn shape: the stick's X turns), so what the session hands the kernel is what moves the
// pilot. The head moves in the play space (position, yaw, pitch); the sticks and buttons are the test's.
const K = composeLive();
const FLAT = { ground: () => 0 };
function gameUp(xr, { entities, camera = null, colliders = null, aims = {}, grips = {}, document: doc = null, window: win = null, mana = false } = {}) {
  const cfg = xrConfig(xr, null, { ctrl: true });
  const pad = () => ({ axes: [0, 0, 0, 0], buttons: Array.from({ length: 6 }, () => ({ pressed: false, value: 0 })) });
  const pads = { left: pad(), right: pad() };
  const press = (side, i, on) => { pads[side].buttons[i] = { pressed: on, value: on ? 1 : 0 }; };
  const session = { inputSources: [{ handedness: 'left', gamepad: pads.left, targetRaySpace: 'aim:left', gripSpace: 'grip:left' }, { handedness: 'right', gamepad: pads.right, targetRaySpace: 'aim:right', gripSpace: 'grip:right' }], addEventListener() {}, end() {} };
  const head = { x: 0, z: 0, yaw: 0, pitch: 0 };
  const frame = {
    getViewerPose: () => {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(head.pitch, head.yaw, 0, 'YXZ'));
      return { transform: { position: { x: head.x, y: 1.6, z: head.z }, orientation: { x: q.x, y: q.y, z: q.z, w: q.w } } };
    },
    // a controller's target ray: `aims[side]` = { p, q } (rig-local, y-up), set by the test
    // (and a grip pose: `grips[side]` = { p, q }, the same)
    getPose: (sp) => { const a = String(sp).startsWith('grip:') ? grips[String(sp).slice(5)] : aims[String(sp).slice(4)]; return a ? { transform: { position: { x: a.p[0], y: a.p[1], z: a.p[2] }, orientation: { x: a.q.x, y: a.q.y, z: a.q.z, w: a.q.w } } } : null; },
  };
  const renderer = { xr: { enabled: false, getSession: () => session, getFrame: () => frame, getReferenceSpace: () => ({}), setReferenceSpaceType() {}, async setSession() {} } };
  const camera3 = new THREE.PerspectiveCamera(); camera3.position.set(0, 0, 1.6); camera3.lookAt(1, 0, 1.6);
  const world = K.createWorld({ entities, camera, colliders });
  const inputs = [];
  const env = {
    THREE, renderer, camera: camera3, scene: new THREE.Scene(), controls: { enabled: true }, hud: { appendChild() {} },
    document: doc ?? { createElement: () => ({ classList: { add() {}, remove() {} }, hidden: false }), pointerLockElement: null },
    navigator: { xr: { requestSession: async () => session, isSessionSupported: () => Promise.resolve(true) } },
    __world: world, __K: K, __FLAT: FLAT, __inputs: inputs, ...(win ? { window: win } : {}),
  };
  // the page's input read in miniature: the pad (the headset's while a session plays), a tank-turn world's shape, the
  // jump's press edge; then the headset finishes it on the body
  const body = `let walkOn = false, __xrCtl = null, stepControllable = () => {}, __prevJump = false;
${xrModeScript(cfg, { ctrl: true, mana })}
stepControllable = (dt) => {
  const p = __xrCtl ? __xrCtl.pad() : null;
  const jump = !!(p && p.jump) && !__prevJump ? 1 : 0; __prevJump = !!(p && p.jump);
  let inp = { forward: p ? p.moveY : 0, turn: p ? p.moveX : 0, strafe: 0, lookDX: 0, lookDY: 0, jump, jumpHeld: p && p.jump ? 1 : 0, fire: p && p.fire ? 1 : 0 };
  if (__xrCtl) inp = __xrCtl.input(inp);
  __inputs.push(inp);
  __K.stepWorld(__world, inp, dt, __FLAT);
};
return { enter: __xrEnter, step: __xrStep, rig: () => __xrRig, ctl: () => __xrCtl, panel: () => __xrPanel, exit: __xrExit, menu: () => (typeof __xrMenu !== 'undefined' ? __xrMenu : null) };`;
  const page = new Function(...Object.keys(env), body)(...Object.values(env));
  return { pads, press, head, page, world, inputs, aims, grips, scene: env.scene };
}
const hero = (over = {}, at = [0, 0, 0]) => ({ id: 'hero', pilotable: true, rule: { type: 'platform', eye: 0, speed: 4, collideRadius: 0.3, collideHeight: 1.7, ...over }, transform: { pos: [...at], heading: 0 } });
// the head's world place: the rig carrying the viewer's
const headAt = (g) => { const v = new THREE.Vector3(g.head.x, 1.6, g.head.z); g.page.rig().updateMatrixWorld(); return g.page.rig().localToWorld(v); };
const run = (g, n) => { for (let i = 0; i < n; i++) g.page.step(1 / 60); };

describe('the game in the headset', () => {
  it('the left stick walks the pilot on the body\'s heading, and the head rides over its feet', async () => {
    const g = gameUp(true, { entities: [hero()] });
    await g.page.enter();
    expect(g.page.ctl()).not.toBeNull();
    g.pads.left.axes = [0, 0, 0.12, -1];          // forward, a worn stick's drift to the right
    run(g, 60);
    const p = g.world.byId.hero.transform.pos;
    expect(p[0]).toBeGreaterThan(2);               // walked down +X, the body's heading
    expect(Math.abs(p[1])).toBeLessThan(1e-9);     // and not a hair off it
    expect(g.world.byId.hero.transform.heading).toBe(0);
    const h = headAt(g);
    expect(h.x).toBeCloseTo(p[0], 9); expect(h.y).toBeCloseTo(p[1], 9);
    expect(g.page.rig().position.z).toBeCloseTo(p[2], 9);   // the floor at its feet
  });

  it('the stick\'s X strafes on the body (a tank world\'s turn is the body\'s, never the stick\'s)', async () => {
    const g = gameUp(true, { entities: [hero()] });
    await g.page.enter();
    g.pads.left.axes = [0, 0, 1, 0];
    run(g, 60);
    const e = g.world.byId.hero;
    expect(e.transform.heading).toBe(0);
    expect(e.transform.pos[1]).toBeLessThan(-2);   // to the right of +X is −Y
    expect(Math.abs(e.transform.pos[0])).toBeLessThan(1e-9);
    expect(g.inputs.at(-1).turn).toBe(0);
  });

  it('the right stick turns the body, and the pilot with it; the head looks without steering, its pitch the pilot\'s', async () => {
    const g = gameUp(true, { entities: [hero()] });
    await g.page.enter();
    g.pads.right.axes = [0, 0, 1, 0];
    run(g, 30);                                     // half a second at 120°/s: 60° to the right
    g.pads.right.axes = [0, 0, 0, 0];
    g.head.yaw = 0.9; g.head.pitch = 0.35;          // a look up and to the left
    run(g, 1);
    const e = g.world.byId.hero;
    expect(e.transform.heading).toBeCloseTo(-Math.PI / 3, 6);
    expect(e.transform.pitch).toBeCloseTo(0.35, 9);
    const p0 = [...e.transform.pos];
    g.pads.left.axes = [0, 0, 0, -1];
    run(g, 30);
    const d = [e.transform.pos[0] - p0[0], e.transform.pos[1] - p0[1]];
    expect(Math.atan2(d[1], d[0])).toBeCloseTo(-Math.PI / 3, 6);   // forward is where the body faces, not the gaze
  });

  it('the buttons are the scheme\'s: A jumps, the right trigger fires', async () => {
    const g = gameUp(true, { entities: [hero({ jump: 6 })] });
    await g.page.enter();
    g.press('right', 4, true); g.press('right', 0, true);
    run(g, 1);
    expect(g.inputs.at(-1).jump).toBe(1);
    expect(g.inputs.at(-1).fire).toBe(1);
    run(g, 10);
    expect(g.world.byId.hero.transform.pos[2]).toBeGreaterThan(0.1);   // in the air
  });

  it('a step in the play space moves the pilot; a wall stops it and the view is pushed back', async () => {
    const wall = { min: [-5, -1.2, 0], max: [5, -0.45, 3] };   // a wall just to the hero's right (−Y)
    const g = gameUp(true, { entities: [hero()], colliders: [wall] });
    await g.page.enter();
    run(g, 1);
    g.head.z = -0.4;                                // a step forward in the play space: +X in the world
    run(g, 1);
    const e = g.world.byId.hero;
    expect(e.transform.pos[0]).toBeCloseTo(0.4, 9);
    g.head.x = 0.5;                                 // a step to the right, into the wall
    run(g, 1);
    expect(e.transform.pos[1]).toBeCloseTo(0, 9);   // the body stays out of it
    const h = headAt(g);
    expect(h.x).toBeCloseTo(e.transform.pos[0], 9); expect(h.y).toBeCloseTo(e.transform.pos[1], 9);   // the view with it
  });

  it('without a pilot the headset walks as it always did', async () => {
    const g = gameUp(true, { entities: [{ id: 'turntable', rule: { type: 'clock' }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    await g.page.enter();
    expect(g.page.ctl()).toBeNull();
    g.pads.left.axes = [0, 0, 0, -1];
    run(g, 60);
    expect(g.page.rig().position.x).toBeGreaterThan(1);   // the rig walked; the world's turntable is not the player
  });
});

describe('the game page with a headset', () => {
  const ents = [{ id: 'hero', pilotable: true, rule: { type: 'platform', eye: 0, speed: 4 }, body: { type: 'box', size: [0.5, 0.5, 1.8] }, transform: { pos: [0, 0, 0], heading: 0 } }];
  const cam = { id: 'cam', rule: { type: 'follow', target: 'hero', dist: 5 } };
  const floor = { corners: [[-4, -4, 0], [4, -4, 0], [4, 4, 0], [-4, 4, 0]], fill: '#445566' };
  it('a controllable page with `xr` hands its pad, its input, its camera and its body to the session', () => {
    const page = emitThreeWorld({ faces: [floor], entities: ents, camera: cam, xr: true });
    expect(page).toContain('let __xrCtl = null;');
    expect(page).toContain('const __pad = __xrCtl ? __xrCtl.pad() : __pollPad();');
    expect(page).toContain('return __xrCtl ? __xrCtl.input(inp) : inp;');
    expect(page).toContain('if (__ctrlOwnsCamera && !__xrCtl) __driveCamera(dt);');
    expect(page).toContain('if (__xrCtl) { __xrPlay(dt); return; }');
    expect(page).toContain('"fire":["right.trigger"]');   // the pilot reads every action the scheme binds on the headset
  });
  it('without `xr` the controllable page carries none of it; a world without a pilot channel, no game branch', () => {
    const plain = emitThreeWorld({ faces: [floor], entities: ents, camera: cam });
    expect(plain).not.toContain('__xrCtl');
    expect(plain).toContain('const __pad = __pollPad();');
    const walk = emitThreeWorld({ faces: [floor], xr: true });
    expect(walk).not.toContain('__xrCtl');
    expect(walk).not.toContain('__xrPlay');
  });
});

// THE HANDS (P2): the hero's own hand bones on the controllers, played by the emitted block from the real bake (a realistic
// hero's rig), the body's bone meshes stood in by empty ones (the hands share their geometry, so only their matrices
// matter). A digit's tip, carried by its mesh's matrix, lands where the rig's own kinematics put it for the angle the
// controller asks; the grip's centre lands on the grip pose.
const HR = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'male', form: 'realistic' }) }).recipe.rig);
const HDZ = 0.04, HX = xrHands(HR, { dz: HDZ });
function handsUp({ X = HX, ent = hero(), parts = null, others = [] } = {}) {
  const pad = () => ({ axes: [0, 0, 0, 0], buttons: Array.from({ length: 6 }, () => ({ pressed: false, touched: false, value: 0 })) });
  const pads = { left: pad(), right: pad() };
  const session = { inputSources: [{ handedness: 'left', gamepad: pads.left, gripSpace: 'grip:left' }, { handedness: 'right', gamepad: pads.right, gripSpace: 'grip:right' }], addEventListener() {}, end() {} };
  const grips = {
    right: { p: [0.25, 1.1, -0.35], q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.6, 0.3, 0.2, 'YXZ')) },
    left: { p: [-0.25, 1.05, -0.3], q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.4, -0.2, -0.1, 'YXZ')) },
  };
  const tf = (g) => ({ transform: { position: { x: g.p[0], y: g.p[1], z: g.p[2] }, orientation: { x: g.q.x, y: g.q.y, z: g.q.z, w: g.q.w } } });
  const frame = {
    getViewerPose: () => ({ transform: { position: { x: 0, y: 1.6, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } } }),
    getPose: (sp) => { const g = grips[String(sp).slice(5)]; return g ? tf(g) : null; },
  };
  const renderer = { xr: { enabled: false, getSession: () => session, getFrame: () => frame, getReferenceSpace: () => ({}), setReferenceSpaceType() {}, async setSession() {} } };
  const world = K.createWorld({ entities: [ent, ...others] });
  const bones = HR.bones.map((b) => ({ id: b.id, head: HR.joints[b.head].map((v, i) => (i === 2 ? v + HDZ : v)) }));
  const boneMeshes = bones.map(() => new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()));
  if (parts) for (const [bi, n] of Object.entries(parts)) boneMeshes[bi].geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * n), 3));
  const bodyGroup = new THREE.Group(); bodyGroup.userData.rigFig = { fig: { bones, xrHands: X, parts: parts ? bones.map((b, i) => (parts[i] ? { faces: parts[i] } : null)) : [] }, boneMeshes };
  const env = {
    THREE, renderer, camera: new THREE.PerspectiveCamera(), scene: new THREE.Scene(), controls: { enabled: true }, hud: { appendChild() {} },
    document: { createElement: () => ({ classList: { add() {}, remove() {} }, hidden: false }), pointerLockElement: null },
    navigator: { xr: { requestSession: async () => session, isSessionSupported: () => Promise.resolve(true) } },
    __world: world, __K: K, __FLAT: FLAT, __bodies: { hero: bodyGroup },
  };
  const body = `let walkOn = false, __xrCtl = null, stepControllable = () => {};
${xrModeScript(xrConfig(true, null, { ctrl: true }), { ctrl: true, hands: true })}
stepControllable = (dt) => { const p = __xrCtl ? __xrCtl.pad() : null; __K.stepWorld(__world, __xrCtl ? __xrCtl.input({ forward: 0, turn: 0, strafe: 0, lookDX: 0, lookDY: 0, fire: p && p.fire ? 1 : 0 }) : {}, dt, __FLAT); };
return { enter: __xrEnter, step: __xrStep, rig: () => __xrRig, hands: () => __xrHands, end: __xrExit };`;
  const page = new Function(...Object.keys(env), body)(...Object.values(env));
  return { pads, grips, page, bones, world };
}
// a rest point of the pack carried by a hand mesh's matrix, then the hand's (the grip space's place in the rig)
const carry = (h, id, p) => { const v = new THREE.Vector3(...p); if (id) v.applyMatrix4(h.by[id].m.matrix); return v; };
const tipNow = (u, S, d) => { const h = u.page.hands()[S], D = h.H.digits[d], id = D.bones[D.bones.length - 1], bone = HR.bones[HR.boneIndex[id]]; return carry(h, id, HR.joints[bone.tail].map((v, i) => (i === 2 ? v + HDZ : v))); };
const tipAt = (S, d, a) => { const n = rigNodesAt(HR, { [`fingers${S}`]: { [d]: a } }).nodes[`${d}Tip${S}`]; return new THREE.Vector3(n[0], n[1], n[2] + HDZ); };

describe('the hero’s hands on the controllers', () => {
  it('each hand stands on its grip pose: the grip’s centre on its origin, the grip’s axes its axes', async () => {
    const u = handsUp();
    await u.page.enter(); u.page.step(1 / 60);
    for (const [S, side] of [['R', 'right'], ['L', 'left']]) {
      const h = u.page.hands()[S], G = HX[S].grip;
      expect(h.g.visible).toBe(true);
      expect(h.g.parent).toBe(u.page.rig());
      const o = new THREE.Vector3(...G.o).applyMatrix4(h.g.matrix);
      o.toArray().forEach((v, i) => expect(v).toBeCloseTo(u.grips[side].p[i], 9));
      // the hand's −Z (toward its thumb) is the grip pose's −Z
      const dir = new THREE.Vector3(...G.z).transformDirection(h.g.matrix), want = new THREE.Vector3(0, 0, 1).applyQuaternion(u.grips[side].q);
      expect(dir.distanceTo(want)).toBeLessThan(1e-5);   // (the bake keeps six decimals)
    }
  });

  it('nothing pressed: a relaxed hand; the grip closes three fingers and points the index; the trigger closes the index', async () => {
    const u = handsUp();
    await u.page.enter(); u.page.step(1 / 60);
    const W = HX.R.poses, near = (a, b) => a.distanceTo(b);
    expect(near(tipNow(u, 'R', 'index'), tipAt('R', 'index', W.relaxed.index))).toBeLessThan(0.002);
    expect(near(tipNow(u, 'R', 'middle'), tipAt('R', 'middle', W.relaxed.middle))).toBeLessThan(0.002);
    u.pads.right.buttons[1] = { pressed: true, touched: true, value: 1 };     // the grip
    u.page.step(1 / 60);
    expect(near(tipNow(u, 'R', 'index'), tipAt('R', 'index', W.open.index))).toBeLessThan(0.002);    // pointing
    for (const d of ['middle', 'ring', 'little']) expect(near(tipNow(u, 'R', d), tipAt('R', d, W.fist[d]))).toBeLessThan(0.002);
    u.pads.right.buttons[0] = { pressed: false, touched: true, value: 0.5 };  // the trigger half in
    u.page.step(1 / 60);
    expect(near(tipNow(u, 'R', 'index'), tipAt('R', 'index', (W.open.index + W.fist.index) / 2))).toBeLessThan(0.002);
    // the other hand never moved
    expect(near(tipNow(u, 'L', 'middle'), tipAt('L', 'middle', W.relaxed.middle))).toBeLessThan(0.002);
  });

  it('the thumb comes down onto a thumb button it rests on, eased, and lifts again', async () => {
    const u = handsUp();
    await u.page.enter(); u.page.step(1 / 60);
    const W = HX.R.poses;
    u.pads.right.buttons[4] = { pressed: false, touched: true, value: 0 };   // resting on A
    u.page.step(1 / 60);
    const part = u.page.hands().R.thumb;
    expect(part).toBeGreaterThan(W.relaxed.thumb); expect(part).toBeLessThan(W.fist.thumb);
    run(u, 60);
    expect(tipNow(u, 'R', 'thumb').distanceTo(tipAt('R', 'thumb', W.fist.thumb))).toBeLessThan(0.002);
    u.pads.right.buttons[4] = { pressed: false, touched: false, value: 0 };
    run(u, 60);
    expect(tipNow(u, 'R', 'thumb').distanceTo(tipAt('R', 'thumb', W.relaxed.thumb))).toBeLessThan(0.002);
  });

  it('a hand with no grip pose is hidden; leaving the headset takes the hands away', async () => {
    const u = handsUp();
    await u.page.enter(); u.page.step(1 / 60);
    u.grips.left = null;
    u.page.step(1 / 60);
    expect(u.page.hands().L.g.visible).toBe(false);
    expect(u.page.hands().R.g.visible).toBe(true);
    const rig = u.page.rig();
    u.page.end();
    expect(u.page.hands().R).toBeNull();
    expect(rig.children.some((c) => c.isGroup && c !== rig)).toBe(false);
  });
});

describe('the game page with the hands', () => {
  const floor = { corners: [[-4, -4, 0], [4, -4, 0], [4, 4, 0], [-4, 4, 0]], fill: '#445566' };
  const ents = [{ id: 'hero', pilotable: true, rule: { type: 'platform', eye: 0, speed: 4 }, body: { type: 'box', size: [0.5, 0.5, 1.8] }, transform: { pos: [0, 0, 0], heading: 0 } }];
  const cam = { id: 'cam', rule: { type: 'follow', target: 'hero', dist: 5 } };
  it('the hands are drawn only where a figure carries them and the headset plays the game', () => {
    expect(emitThreeWorld({ faces: [floor], entities: ents, camera: cam, xr: true })).not.toContain('__xrHandsStep');
    expect(emitThreeWorld({ faces: [floor], entities: ents, camera: cam, xr: true, figures: { h: { rig: true, bones: [], parts: [], clips: {}, xrHands: HX } } })).toContain('__xrHandsStep(dt);');
    expect(emitThreeWorld({ faces: [floor], xr: true, figures: { h: { rig: true, bones: [], parts: [], clips: {}, xrHands: HX } } })).not.toContain('__xrHands');
  });
});

// WHAT THE HANDS HOLD (P3), AND A SHOT FROM THEM: the kernel's ranged weapon (combat-ranged.js) takes the headset's aim,
// the controller's ray where the hand holds no gun, the held gun's muzzle along its bore where it does.
const gunner = (over = {}) => hero({ ...over }, [0, 0, 0]);
const armed = (e) => ({ ...e, weapon: { fireClass: 'sight', range: 60, damage: 10, cooldown: 0.2, magazine: 30 } });
const target = (at) => ({ id: 'target', rule: { type: 'clock' }, body: { type: 'box', hittable: true, hp: 100, egg: { a: 0.5, c: 1, cz: 1 } }, transform: { pos: at, heading: 0 } });
const yawQ = (yaw, pitch = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));

describe('a shot from the hand in the headset', () => {
  it('the trigger fires along the controller’s ray, not where the body or the head faces', async () => {
    // a target off to the left (+Y); the body faces +X. The right controller, held at chest height, points at it
    const tgt = [0.3, 6, 1];
    const g = gameUp(true, { entities: [armed(gunner()), target(tgt)] });
    await g.page.enter();
    run(g, 1);
    // rig-local: the body faces −Z (= +X); +Y in the world is the play space's −X: a turn of +90° about its up
    g.aims.right = { p: [0.2, 1.0, -0.3], q: yawQ(Math.PI / 2) };
    g.press('right', 0, true);
    run(g, 2);
    const e = g.world.byId.hero, shot = e.lastShot;
    expect(shot).toBeTruthy();
    expect(shot.targetId).toBe('target');
    expect(e.transform.heading).toBe(0);   // the body never turned
    // from the controller, carried into the world (the rig under the hero, the head over its feet)
    expect(shot.from[2]).toBeCloseTo(1.0, 6);
  });

  it('aimed away, the same trigger misses', async () => {
    const g = gameUp(true, { entities: [armed(gunner()), target([0.3, 6, 1])] });
    await g.page.enter();
    run(g, 1);
    g.aims.right = { p: [0.2, 1.0, -0.3], q: yawQ(-Math.PI / 2) };
    g.press('right', 0, true);
    run(g, 2);
    expect(g.world.byId.hero.lastShot.targetId).toBeUndefined();
  });
});

const HERO_GUN = heroRecord({ cast: 'male', form: 'realistic', gear: { right: { item: 'pistol' } } });
const HXG = xrHands(HR, { dz: HDZ, gear: gearMounts(HERO_GUN, HR) });
describe('the hands holding a gun', () => {
  const hb = HR.boneIndex.handR, bodyTris = 40;
  const gunUp = (ent) => handsUp({ X: HXG, ent, parts: { [hb]: bodyTris + HXG.R.item.tris } });

  it('draws the hand without the gun and the gun apart, re-held; the fingers close round it from the grip word', async () => {
    const u = gunUp(hero());
    await u.page.enter(); u.page.step(1 / 60);
    const h = u.page.hands().R;
    expect(h.by.handR.m.geometry.drawRange).toEqual({ start: 0, count: 3 * bodyTris });
    expect(h.item.geometry.drawRange).toEqual({ start: 3 * bodyTris, count: 3 * HXG.R.item.tris });
    expect(h.item.parent).toBe(h.g);
    const r = HXG.R.item.rehold;
    expect(h.item.matrix.elements[12]).toBeCloseTo(r[3], 9); expect(h.item.matrix.elements[0]).toBeCloseTo(r[0], 9);
    expect(tipNow(u, 'R', 'middle').distanceTo(tipAt('R', 'middle', HXG.R.poses.grip.middle))).toBeLessThan(0.002);
    expect(tipNow(u, 'R', 'index').distanceTo(tipAt('R', 'index', HXG.R.poses.grip.index))).toBeLessThan(0.002);
    // the empty left hand still rests relaxed
    expect(u.page.hands().L.item).toBeNull();
  });

  it('a shot leaves from the held muzzle along its bore', async () => {
    const u = gunUp(armed(hero()));
    await u.page.enter(); u.page.step(1 / 60);
    u.pads.right.buttons[0] = { pressed: true, touched: true, value: 1 };
    u.page.step(1 / 60);
    const h = u.page.hands().R, M = HXG.R.item.muzzle, shot = u.world.byId.hero.lastShot;
    expect(shot).toBeTruthy();
    // the muzzle where the step read it: the hands posed in the rig before the step, the rig not yet moved
    const want = new THREE.Vector3(...M.p).applyMatrix4(h.g.matrixWorld);
    expect(Math.hypot(shot.from[0] - want.x, shot.from[1] - want.y, shot.from[2] - want.z)).toBeLessThan(0.05);
    const d = new THREE.Vector3(...M.d).transformDirection(h.g.matrixWorld), v = new THREE.Vector3(shot.to[0] - shot.from[0], shot.to[1] - shot.from[1], shot.to[2] - shot.from[2]).normalize();
    expect(v.dot(d)).toBeGreaterThan(0.999);
  });
});

// A HIT FROM A SWING IN THE HEADSET (P4): the hands' striking parts handed to the kernel each frame (sweep.js)
const dummy = (id, at) => ({ id, rule: { type: 'clock' }, body: { type: 'box', hittable: true, hp: 100, egg: { a: 0.3, c: 0.9, cz: 0.9 } }, transform: { pos: at, heading: Math.PI } });
describe('a swing in the headset', () => {
  it('a punch with the controller lands where the hands are not drawn: the grip pose is the fist', async () => {
    const g = gameUp(true, { entities: [hero(), dummy('bag', [0.9, -0.2, 0])] });
    await g.page.enter();
    const id = new THREE.Quaternion();
    // the right controller at chest height, punched straight ahead (the play space's −Z is the body's +X) at ~4 m/s
    for (let i = 0; i <= 8; i++) { g.grips.right = { p: [0.2, 1.3, -0.1 - 0.07 * i], q: id }; run(g, 1); }
    const bag = g.world.byId.bag;
    expect(bag.hits).toBe(1);
    expect(bag.lastCut).toMatchObject({ by: 'hero', hand: 'R', kind: 'fist' });
    expect(g.inputs.at(-1).sweeps.hands.map((h) => h.id)).toEqual(['R']);   // the left hand has no pose this frame
  });
});

const HERO_SWORD = heroRecord({ cast: 'male', form: 'realistic', gear: { right: { item: 'sword', style: 'historical' } } });
const HXS = xrHands(HR, { dz: HDZ, gear: gearMounts(HERO_SWORD, HR) });
describe('a sword in the hand', () => {
  it('the held blade is what strikes: swept through a body, its cut reads as the blade moved', async () => {
    const hb = HR.boneIndex.handR;
    const u = handsUp({ X: HXS, parts: { [hb]: 40 + HXS.R.item.tris }, others: [dummy('d', [1.0, -0.3, 0])] });
    // the blade along the play space's −Z (the body's forward, +X) turned by `a`: the grip's −Z is the blade's way out of
    // the fist; swept from the body's left (+Y, the play space's −X) to its right at chest height
    const at = (a) => ({ p: [a * 0.6, 1.3, -0.25], q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a) });
    u.grips.right = at(-0.6);
    await u.page.enter(); run(u, 30);   // held still at the start (a sword resting strikes nothing)
    expect(u.world.byId.d.hits || 0).toBe(0);
    for (let i = 0; i <= 12; i++) { u.grips.right = at(-0.6 + (1.2 * i) / 12); u.page.step(1 / 60); }
    const d = u.world.byId.d;
    expect(d.hits).toBe(1);
    expect(d.lastCut).toMatchObject({ kind: 'blade', hand: 'R', dir: 'right' });
  });
});

describe('the game page with swings', () => {
  const floor = { corners: [[-4, -4, 0], [4, -4, 0], [4, 4, 0], [-4, 4, 0]], fill: '#445566' };
  const ents = [{ id: 'hero', pilotable: true, rule: { type: 'platform', eye: 0, speed: 4 }, body: { type: 'box', size: [0.5, 0.5, 1.8] }, transform: { pos: [0, 0, 0], heading: 0 } }];
  const cam = { id: 'cam', rule: { type: 'follow', target: 'hero', dist: 5 } };
  it('the kernel carries the swing pass only on a game the headset plays', () => {
    const src = buildSweep.toString().slice(0, 200);
    expect(emitThreeWorld({ faces: [floor], entities: ents, camera: cam, xr: true })).toContain(src);
    expect(emitThreeWorld({ faces: [floor], entities: ents, camera: cam })).not.toContain('buildSweep');
  });
});

// THE HUD IN THE HEADSET: the page's own HUD layer (events.js `.moj-hud`), mirrored onto a panel in the play space. A
// small stand-in DOM: columns of widgets as the HUD draws them (a readout's spans, a fading toast, a hidden banner), and
// a canvas whose 2D context records what is written on it.
function hudDom() {
  const node = (text) => ({ textContent: text });
  const el = (cls, kids, style = {}) => ({ className: cls, classList: { contains: (c) => cls.split(' ').includes(c) }, children: kids, childNodes: kids, style });
  const val = node('12'), readout = el('moj-w moj-w-readout moj-w-counter', [val, node('Notes')]);
  const toast = el('moj-w moj-w-toast', [node('miss')], { color: 'var(--moj-harm)', opacity: '0.5' });
  const banner = el('moj-w moj-w-banner moj-hidden', [node('Cleared!')]);
  const best = el('moj-w moj-w-readout moj-w-text', [node('Score'), node('340')]);
  const legend = el('moj-w moj-w-legend', [node('W / S  run · mouse  look')]);
  const layer = el('moj-hud', [el('moj-hud-col moj-hud-top-left', [readout]), el('moj-hud-col moj-hud-center', [toast, banner]), el('moj-hud-col moj-hud-top-right', [best]), el('moj-hud-col moj-hud-bottom', [legend])]);
  const drawn = [], ctx = new Proxy({ fillText: (t, x, y) => drawn.push({ t, x, y, color: ctx.fillStyle, a: ctx.globalAlpha, align: ctx.textAlign }) }, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } });
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  const document = { createElement: (tag) => (tag === 'canvas' ? canvas : { classList: { add() {}, remove() {} }, hidden: false }), querySelector: (q) => (q === '.moj-hud' ? layer : null), documentElement: {}, pointerLockElement: null };
  const window = { getComputedStyle: () => ({ getPropertyValue: (n) => (n === '--moj-harm' ? '#ff4d4d' : '') }) };
  return { document, window, drawn, val, toast, banner };
}

describe('the HUD in the headset', () => {
  it('the game\'s HUD is drawn on a panel in the play space: each side its own column, each widget its text and colour', async () => {
    const D = hudDom(), g = gameUp(true, { entities: [hero()], document: D.document, window: D.window });
    await g.page.enter();
    const P = g.page.panel();
    expect(P.m.parent).toBe(g.page.rig());
    run(g, 1);
    expect(P.m.visible).toBe(true);
    expect(P.tex.version).toBeGreaterThan(0);   // (needsUpdate bumps it)
    const texts = D.drawn.map((d) => d.t);
    expect(texts).toEqual(['12  Notes', 'miss', 'Score  340']);   // the hidden banner is not on it, nor the keyboard's legend
    const at = (t) => D.drawn.find((d) => d.t === t);
    expect(at('12  Notes').align).toBe('left');
    expect(at('Score  340').align).toBe('right');
    expect(at('miss')).toMatchObject({ align: 'center', color: '#ff4d4d', a: 0.5 });   // its own colour, read off the page; its fade
  });

  it('drawn again only when what it says changes', async () => {
    const D = hudDom(), g = gameUp(true, { entities: [hero()], document: D.document, window: D.window });
    await g.page.enter();
    run(g, 1);
    const n = D.drawn.length;
    run(g, 30);
    expect(D.drawn.length).toBe(n);
    D.val.textContent = '13';
    run(g, 7);   // read ten times a second
    expect(D.drawn.length).toBe(2 * n);
    expect(D.drawn.at(-3).t).toBe('13  Notes');
  });

  it('it lies on the floor ahead of the body, tilted up to the eye; it goes with the session; `hud: false` has none', async () => {
    const D = hudDom(), g = gameUp(true, { entities: [hero()], document: D.document, window: D.window });
    await g.page.enter();
    run(g, 1);
    const P = g.page.panel(), w = new THREE.Vector3();
    g.page.rig().updateMatrixWorld(true); P.m.getWorldPosition(w);
    expect(w.x).toBeCloseTo(2.4, 6);                 // ahead: the body faces +X
    expect(Math.abs(w.y)).toBeLessThan(1e-9);
    expect(w.z).toBeCloseTo(0.3, 6);                  // near the floor, under what comes at the player
    const n = new THREE.Vector3(0, 0, 1).transformDirection(P.m.matrixWorld);
    expect(n.z).toBeGreaterThan(0.5); expect(n.x).toBeLessThan(0);   // facing up and back toward the player
    const rig = g.page.rig();
    g.page.exit();
    expect(g.page.panel()).toBeNull();
    expect(rig.children.includes(P.m)).toBe(false);
    const off = gameUp({ hud: false }, { entities: [hero()], document: hudDom().document });
    await off.page.enter();
    expect(off.page.panel()).toBeNull();
  });
});

// MANA-UI IN THE HEADSET: a view registered on the page (a real mana-ui runtime and its input owner, mana-host), its
// snapshot stood in for (the browser's drawing is the transfer gate's, mana-ui/snapshot.chrome.test.js)
function manaUp() {
  const log = [], drawn = [];
  const rt = manaUi.runtime({ screens: { menu: { use: 'screen', children: [{ use: 'list', props: { rows: [{ id: 'a', label: 'Attack' }, { id: 'b', label: 'Guard' }] }, on: { accept: { emit: 'pick', id: { item: 'id' } } } }, { use: 'tabs', children: [{ use: 'tab', props: { label: 'One' } }, { use: 'tab', props: { label: 'Two' } }] }] } } }, { read: () => undefined, act: (e) => log.push(e) });
  const host = buildManaHost().connect(rt, { paint() {} }, { keys: {}, pad: null, listen: false, loop: false });
  let left = 0;
  const drive = host.drive;
  host.drive = (fn) => { const leave = drive(fn); return () => { left++; leave(); }; };
  const img = { drawn: true }, shots = [];
  // (one anchor that says its world point: a bar over a fighter's head at [5, 0, 2])
  const mark = { getBoundingClientRect: () => ({ x: 400, y: 300, width: 80, height: 30 }), querySelectorAll: () => [], getAttribute: (k) => (k === 'data-world' ? '5,0,2' : 'aayla') };
  const root = { querySelector: () => null, getBoundingClientRect: () => ({ x: 0, y: 0, width: 1280, height: 720 }), querySelectorAll: (q) => (q.includes('[data-world]') ? [mark] : []) };
  const view = { root, rt, css: '', host, shot: (extra) => { shots.push(extra); return Promise.resolve(img); } };
  const ctx = { clearRect() {}, drawImage: (i, x, y, w, h) => drawn.push({ i, w, h }) };
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  const document = { createElement: (tag) => (tag === 'canvas' ? canvas : { classList: { add() {}, remove() {} }, hidden: false }), querySelector: () => null, pointerLockElement: null };
  const window = { __manaViews: [view] };
  return { rt, host, view, log, drawn, document, window, left: () => left, img, shots };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('mana-ui in the headset', () => {
  it('a screen up: its view on a panel at eye height ahead, square to the player, drawn from its snapshot', async () => {
    const M = manaUp(), g = gameUp(true, { entities: [hero()], document: M.document, window: M.window, mana: true });
    await g.page.enter();
    run(g, 1);
    expect(g.page.menu()).toBeNull();          // no screen: no panel, the game has the controllers
    M.rt.open('menu');
    run(g, 1); await settle();
    const P = g.page.menu(), w = new THREE.Vector3();
    expect(P.m.parent).toBe(g.page.rig());
    expect(P.m.visible).toBe(true);
    expect(M.drawn.at(-1)).toMatchObject({ i: M.img, w: 2048, h: 1152 });   // the snapshot, at the panel's resolution
    g.page.rig().updateMatrixWorld(true); P.m.getWorldPosition(w);
    expect(w.x).toBeCloseTo(1.4, 6);             // ahead: the head faces +X
    expect(w.z).toBeCloseTo(1.6 - 0.12, 6);      // a little under the eye
    const n = new THREE.Vector3(0, 0, 1).transformDirection(P.m.matrixWorld);
    expect(n.x).toBeCloseTo(-1, 6);              // facing the player
  });

  it('the controllers are its game controllers: a stick moves, A accepts, the grips turn the tabs; the world and the turn hold', async () => {
    const M = manaUp(), g = gameUp(true, { entities: [hero()], document: M.document, window: M.window, mana: true });
    await g.page.enter();
    M.rt.open('menu');
    const tick = () => { g.page.step(1 / 60); M.host.poll(); };
    tick();
    const yaw = g.page.rig().quaternion.clone(), at = [...g.world.byId.hero.transform.pos];
    g.pads.right.axes = [0, 0, 1, 1]; tick();          // the right stick: down (and across: no turn while a screen is up)
    g.pads.right.axes = [0, 0, 0, 0]; tick();
    expect(M.rt.state()).toMatchObject({ input: 'xr', focus: 1 });
    expect(g.page.rig().quaternion.equals(yaw)).toBe(true);
    g.pads.left.axes = [0, 0, 0, -1]; tick(); tick();  // the left stick moves the menu too, and walks nobody
    g.pads.left.axes = [0, 0, 0, 0]; tick();
    expect(M.rt.state().focus).toBe(0);
    expect(g.world.byId.hero.transform.pos).toEqual(at);
    g.press('right', 4, true); tick(); g.press('right', 4, false); tick();   // A
    expect(M.log).toEqual([{ emit: 'pick', id: 'a' }]);
    g.press('right', 1, true); tick(); g.press('right', 1, false); tick();   // the right grip: the next tab
    expect(M.rt.state().tabs).toEqual([1]);
    // the screen closed (B): the panel goes, the sticks are the game's again
    g.press('right', 5, true); tick(); g.press('right', 5, false); tick();
    expect(M.rt.state().screen).toBeNull();
    tick();
    expect(g.page.menu()).toBeNull();
    g.pads.left.axes = [0, 0, 0, -1]; run(g, 30);
    expect(g.world.byId.hero.transform.pos[0]).toBeGreaterThan(at[0] + 0.5);
  });

  it('what the view stands over the world (an anchor with its world point) is a card there, not on the panel', async () => {
    const M = manaUp(), g = gameUp(true, { entities: [hero()], document: M.document, window: M.window, mana: true });
    await g.page.enter();
    M.rt.open('menu');
    run(g, 1); await settle(); run(g, 1);
    expect(M.shots[0]).toContain('.mana-anchor[data-world]{visibility:hidden!important}');   // the panel leaves it out
    expect(M.shots[1]).toContain('.mana-anchor[data-key="aayla"]{left:');                     // the atlas lays it apart
    const cards = g.scene.children.filter((c) => c.renderOrder === 994);
    expect(cards).toHaveLength(1);
    const c = cards[0], d = Math.hypot(5, 0, 2 - 1.6), s = 0.0011 * d;
    expect(c.scale.x).toBeCloseTo(80 * s, 6); expect(c.scale.y).toBeCloseTo(30 * s, 6);   // as large to the eye as on the screen
    expect(c.position.x).toBeCloseTo(5, 6);
    expect(c.position.z).toBeGreaterThan(2);                                               // its foot on the point: it stands over it
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(c.quaternion);
    expect(n.x).toBeLessThan(-0.99);                                                       // square to the eye
    g.page.exit();
    expect(g.scene.children.filter((c) => c.renderOrder === 994)).toHaveLength(0);
  });
  it('the controllers leave the view with the session; a page without mana-ui has none of it', async () => {
    const M = manaUp(), g = gameUp(true, { entities: [hero()], document: M.document, window: M.window, mana: true });
    await g.page.enter();
    M.rt.open('menu'); run(g, 1);
    g.page.exit();
    expect(M.left()).toBe(1);
    expect(g.page.menu()).toBeNull();
    expect(xrModeScript(xrConfig(true, null, { ctrl: true }), { ctrl: true })).not.toContain('__xrMenu');
    expect(xrModeScript(xrConfig(true, null, { ctrl: true }), { ctrl: true, mana: true })).toContain('__xrMenuStep');
  });
});
