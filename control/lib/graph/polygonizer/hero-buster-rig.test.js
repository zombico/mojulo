// The arm cannon's bone (hero-buster-rig.js). The concepts: a figure wearing the cannon gains a bone of its own after every
// other, from the wrist to the knuckles of that hand and riding it; every point of the cannon is weighed wholly to it and
// every other point keeps its skin; the rig and the skin it was given are not changed; a figure with none gains nothing.
import { describe, it, expect } from 'vitest';
import { busterRig, HAND_BONE } from './hero-buster-rig.js';

const R = Object.freeze({ joints: { elbowR: [0.3, 0, 1.1], wristR: [0.3, 0, 0.85], knucklesR: [0.3, 0, 0.75] }, rides: {},
  bones: [{ id: 'foreArmR', head: 'elbowR', tail: 'wristR' }, { id: 'handR', head: 'wristR', tail: 'knucklesR' }], boneIndex: { foreArmR: 0, handR: 1 } });
const skin = () => ({ joints: [[1, 0, 0, 0], [0, 1, 0, 0], [1, 0, 0, 0]], weights: [[1, 0, 0, 0], [0.6, 0.4, 0, 0], [1, 0, 0, 0]], dominant: [1, 0, 1] });
const mesh = (parts) => ({ provenance: parts.map((part) => ({ part })) });

describe('the arm cannon\'s bone', () => {
  it('a bone of its own after every other, wrist to knuckles, riding the hand', () => {
    const B = busterRig(mesh(['handR', 'foreArmR', 'adorn.busterR.sig0']), R, skin());
    const n = R.bones.length, bone = B.R.bones[n];
    expect(bone).toMatchObject({ id: 'busterR' });
    expect(B.R.boneIndex.busterR).toBe(n);
    expect(B.R.joints[bone.head]).toEqual(R.joints.wristR);
    expect(B.R.joints[bone.tail]).toEqual(R.joints.knucklesR);
    expect(B.R.rides[bone.head]).toBe('handR');
    expect(B.R.rides[bone.tail]).toBe('handR');
  });
  it('weighs the cannon\'s points wholly to it, every other point as it was, and changes neither input', () => {
    const S = skin(), B = busterRig(mesh(['handR', 'foreArmR', 'adorn.busterR']), R, S);
    expect(B.skin.joints[2]).toEqual([2, 0, 0, 0]);
    expect(B.skin.weights[2]).toEqual([1, 0, 0, 0]);
    expect(B.skin.dominant[2]).toBe(2);
    expect(B.skin.joints[1]).toEqual(S.joints[1]);
    expect(S.dominant[2]).toBe(1);
    expect(R.bones).toHaveLength(2);
  });
  it('a figure wearing no cannon gains nothing', () => {
    expect(busterRig(mesh(['handR', 'foreArmR', 'adorn.forearmR']), R, skin())).toBeNull();
  });
  it('knows a hand\'s bones by side: the palm, the wrist\'s bridge, the fingers in segments; never the forearm', () => {
    const H = HAND_BONE('R');
    expect(['handR', 'wristBridgeR', 'thumb1R', 'index2R', 'little3R'].every((b) => H.test(b))).toBe(true);
    expect(['foreArmR', 'handL', 'index2L', 'adorn.busterR', 'busterR'].some((b) => H.test(b))).toBe(false);
  });
});
