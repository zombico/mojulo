import { describe, expect, it } from 'vitest';

import * as THREE from '../../../public/vendor/three/three.core.min.js';

import { buildControlsKernel } from './controls-kernel.js';
import { DEVICES } from './devices.js';
import { SCHEMES } from './schemes.js';
import { buildXrDriver } from './xr-driver.js';

const X = buildXrDriver();
const K = buildControlsKernel();
const pad = (axes, pressed = []) => ({ axes, buttons: Array.from({ length: 7 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })) });

describe('xr driver', () => {
  it('reads a Quest Touch pair by hand in the xr-standard mapping', () => {
    const rd = X.xrRead([
      { handedness: 'left', gamepad: pad([0, 0, -0.5, -1], [4]) },
      { handedness: 'right', gamepad: pad([0, 0, 0.75, 0], [0]) },
    ], DEVICES);
    expect(rd('left.thumbstickY')).toBe(-1);
    expect(rd('left.thumbstickX')).toBe(-0.5);
    expect(rd('right.thumbstickX')).toBe(0.75);
    expect(rd('right.trigger')).toBe(1);
    expect(rd('left.primary')).toBe(1);     // X
    expect(rd('right.squeeze')).toBe(0);
  });

  it('a two-axis pad carries its thumbstick at 0 and 1; a hand with no gamepad, or no handedness, reads nothing', () => {
    const rd = X.xrRead([{ handedness: 'left', gamepad: { axes: [0.3, -0.9], buttons: [] } }, { handedness: 'none', gamepad: pad([0, 0, 1, 1]) }, { handedness: 'right' }], DEVICES);
    expect(rd('left.thumbstickX')).toBe(0.3);
    expect(rd('left.thumbstickY')).toBe(-0.9);
    expect(rd('right.thumbstickX')).toBe(0);
  });

  it('the kernel reads the pilot scheme through it: forward, strafe and turn on two sticks', () => {
    const B = K.resolve(SCHEMES.pilot, DEVICES);
    const rd = X.xrRead([{ handedness: 'left', gamepad: pad([0, 0, 0.4, -0.8]) }, { handedness: 'right', gamepad: pad([0, 0, -0.6, 0]) }], DEVICES);
    expect(K.axis(B, 'moveForward', 'moveBack', 'xr', rd)).toBeCloseTo(0.8);
    expect(K.axis(B, 'strafeRight', 'strafeLeft', 'xr', rd)).toBeCloseTo(0.4);
    expect(K.axis(B, 'turnRight', 'turnLeft', 'xr', rd)).toBeCloseTo(-0.6);
  });

  it('runs from its own source (the page copy is the same code)', () => {
    const Y = new Function(`return (${buildXrDriver.toString()})();`)();
    expect(Y.stick(0.1, 0.9, 0.2, 0.2)).toEqual(X.stick(0.1, 0.9, 0.2, 0.2));
  });
});

describe('stick shaping', () => {
  it('a radial dead zone: nothing inside it, the travel past it rescaled to 0..1', () => {
    expect(X.stick(0.1, 0.1, 0.2, 0)).toEqual([0, 0]);
    expect(X.stick(0, 1, 0.2, 0)[1]).toBeCloseTo(1);
    expect(X.stick(0, 0.6, 0.2, 0)[1]).toBeCloseTo(0.5);
  });

  it('a push a few degrees off a cardinal lands on it exactly; a diagonal stays a diagonal', () => {
    expect(X.stick(0.12, -1, 0.2, 12 * Math.PI / 180)).toEqual([0, -1]);
    expect(X.stick(-1, 0.1, 0.2, 12 * Math.PI / 180)).toEqual([-1, 0]);
    const [x, y] = X.stick(0.75, 0.75, 0.2, 12 * Math.PI / 180);
    expect(x).toBeCloseTo(y, 9);
    expect(Math.hypot(x, y)).toBeCloseTo(1);
  });

  it('a square dead zone would have leaked the drift; this one does not', () => {
    // the old per-axis 0.15 zone passed 0.16 of sideways drift straight through on a full forward push
    expect(X.stick(0.16, -1, 0.15, 12 * Math.PI / 180)[0]).toBe(0);
  });
});

describe('poses', () => {
  const t = (p, q = [0, 0, 0, 1]) => ({ transform: { position: { x: p[0], y: p[1], z: p[2] }, orientation: { x: q[0], y: q[1], z: q[2], w: q[3] } } });
  it('reads the head and each hand\'s grip and aim as arrays; a hand without a space, or without a handedness, reads null', () => {
    const frame = {
      getViewerPose: () => t([0, 1.6, 0]),
      getPose: (sp) => ({ 'grip:l': t([-0.2, 1, -0.3]), 'aim:l': t([-0.2, 1.02, -0.32]), 'grip:r': t([0.2, 1, -0.3]) })[sp] || null,
    };
    const P = X.xrPoses(frame, {}, [
      { handedness: 'left', gripSpace: 'grip:l', targetRaySpace: 'aim:l' },
      { handedness: 'right', gripSpace: 'grip:r' },
      { handedness: 'none', gripSpace: 'grip:l' },
    ]);
    expect(P.head).toEqual({ p: [0, 1.6, 0], q: [0, 0, 0, 1] });
    expect(P.left.grip.p).toEqual([-0.2, 1, -0.3]);
    expect(P.left.aim.p).toEqual([-0.2, 1.02, -0.32]);
    expect(P.right.grip.p).toEqual([0.2, 1, -0.3]);
    expect(P.right.aim).toBeNull();
    // before the session's first frame: nothing
    expect(X.xrPoses(null, {}, [])).toEqual({ head: null, left: { grip: null, aim: null }, right: { grip: null, aim: null } });
  });

  it('carries a pose into the z-up world exactly as the page\'s rig does (three\'s matrices), for a turned, moved rig', () => {
    const rig = { pos: [3, -2, 0.5], yaw: 0.7 };
    // the page's rig (channels/xr.js __xrSetYaw)
    const R = new THREE.Group();
    R.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), rig.yaw - Math.PI / 2).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
    R.position.set(...rig.pos); R.updateMatrixWorld();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, -0.5, 0.2, 'YXZ'));
    const pose = { p: [0.25, 1.4, -0.6], q: [q.x, q.y, q.z, q.w] };
    const W = X.poseToWorld(pose, rig);
    const C = new THREE.Object3D(); C.position.set(...pose.p); C.quaternion.copy(q); R.add(C); R.updateMatrixWorld();
    const wp = new THREE.Vector3(), wq = new THREE.Quaternion(); C.getWorldPosition(wp); C.getWorldQuaternion(wq);
    W.p.forEach((v, i) => expect(v).toBeCloseTo(wp.toArray()[i], 12));
    const sgn = Math.sign(W.q[3] * wq.w + W.q[0] * wq.x + W.q[1] * wq.y + W.q[2] * wq.z);
    W.q.forEach((v, i) => expect(v * sgn).toBeCloseTo([wq.x, wq.y, wq.z, wq.w][i], 12));
  });

  it('a pose forward: the play space −Z is the rig heading, its +Y the world up', () => {
    const rig = { pos: [0, 0, 0], yaw: Math.PI / 2 };   // facing +Y (north)
    const W = X.poseToWorld({ p: [0, 1.6, 0], q: [0, 0, 0, 1] }, rig);
    expect(W.p[2]).toBeCloseTo(1.6, 12);
    X.turn(W.q, [0, 0, -1]).forEach((v, i) => expect(v).toBeCloseTo([0, 1, 0][i], 12));
    X.turn(W.q, [0, 1, 0]).forEach((v, i) => expect(v).toBeCloseTo([0, 0, 1][i], 12));
  });
});
