import { describe, expect, it } from 'vitest';

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
