import { describe, expect, it } from 'vitest';

import * as THREE from '../../../../public/vendor/three/three.core.min.js';
import { xrConfig, xrFromParam, xrModeScript } from './xr.js';

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
