/**
 * head-relational-eye — the eye rig's concepts: a gaze target converges the eyes as it nears, words compose with
 * channels and a side's own, a spec is checked, and a shut lid leaves no opening.
 */
import { describe, expect, it } from 'vitest';

import { lookAngles, resolveEye, eyeSpecErrors, eyeRig, EYE_CHANNELS } from './head-relational-eye.js';

describe('the gaze target', () => {
  const L = { x: -0.13, y: 0, z: 0 }, R = { x: 0.13, y: 0, z: 0 };   // two globes' centres
  const at = (y) => ({ x: 0, y, z: 0 });
  it('aims each eye from its own centre: a near target converges them, a far one leaves them parallel', () => {
    const far = [lookAngles(L, at(100)), lookAngles(R, at(100))], near = [lookAngles(L, at(1)), lookAngles(R, at(1))];
    expect(Math.abs(far[0].gazeYaw)).toBeLessThan(0.1);
    expect(near[0].gazeYaw).toBeGreaterThan(5);    // the left eye turns right, toward the nose
    expect(near[1].gazeYaw).toBeLessThan(-5);      // the right eye turns left
    expect(lookAngles(L, { x: 0, y: 1, z: 1 }).gazePitch).toBeGreaterThan(40);
  });
});

describe('the channels', () => {
  it('a word, then channels over it, then a side\'s own; clamped to the range', () => {
    const c = resolveEye({ word: 'angry', open: 0.9, R: { open: 0.5 } }, 'R');
    expect(c.open).toBe(0.5);
    expect(c.upperShape).toBeLessThan(0);
    expect(resolveEye({ word: 'angry', open: 0.9, R: { open: 0.5 } }, 'L').open).toBe(0.9);
    expect(resolveEye({ gazeYaw: 90 }, 'L').gazeYaw).toBe(EYE_CHANNELS.gazeYaw[2]);
  });
  it('a spec is checked: words, channels, the target', () => {
    expect(eyeSpecErrors('happy')).toEqual([]);
    expect(eyeSpecErrors('grumpy')).toHaveLength(1);
    expect(eyeSpecErrors({ squint: 1 })).toHaveLength(1);
    expect(eyeSpecErrors({ look: { x: 0, y: 1 } })).toHaveLength(1);
    expect(eyeSpecErrors({ look: { x: 0, y: 1, z: 0 }, L: { open: 0.4 } })).toEqual([]);
  });
});

describe('the rig', () => {
  const P = { enR: { x: 0.05, y: 0.38, z: 0.5 }, exR: { x: 0.2, y: 0.34, z: 0.508 }, eyeR: { x: 0.125, y: 0.36, z: 0.5 } };
  it('an open eye has an opening and paints its pupil on the gaze axis; a shut one has none', () => {
    const open = eyeRig(P, 'R', resolveEye('neutral', 'R'), 0.045);
    expect(open.opening).not.toBeNull();
    expect(open.paint({ x: 0.125, y: 0.36, z: 0.5 })).toBe('pupil');
    expect(eyeRig(P, 'R', resolveEye('closed', 'R'), 0.045).opening).toBeNull();
  });
});
