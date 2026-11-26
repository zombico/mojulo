import { describe, expect, it } from 'vitest';

import { clipTravel, feetOf } from './clip-travel.js';
import { faunaSkeleton } from '../fauna/skeleton.js';
import { gaitFrames } from '../fauna/gait.js';
import { gaitStride, quatOfRows, motionGaits } from '../fauna/rig.js';
import { capabilitiesOf } from '../fauna/behavior/capabilities.js';
import { FOE_CLASSES } from '../foes/index.js';

// a beast's skeleton and one gait packed as a page's clip (fauna/rig.js packFaunaRig's layout, without its mesh)
function beastClip(id, gait, k = 24) {
  const S = faunaSkeleton(id), flat = [];
  for (const f of gaitFrames(id, gait, k)) for (const b of S.bones) { const p = f.bones[b.id]; flat.push(...quatOfRows(p.m), ...p.head); }
  return { pack: { bones: S.bones.map((b) => ({ id: b.id, parent: b.parent, head: b.head, tail: b.tail })) }, clip: { k, b: flat } };
}
// (one stand-in a support, picked in code from the classes': the procedure each runs through)
const bySupport = {};
for (const c of Object.values(FOE_CLASSES)) { const s = capabilitiesOf(c.standIn).support; if (s === 'four' || s === 'two') bySupport[s] ??= c.standIn; }

describe('a gait clip\'s travel, read off its planted feet', () => {
  it('a beast\'s gaits, on four legs and on two: the clip\'s travel is the stride its gait was built to', () => {
    for (const [support, id] of Object.entries(bySupport)) {
      for (const g of motionGaits(id).filter((w) => gaitStride(id, w))) {
        const { pack, clip } = beastClip(id, g), t = clipTravel(pack, clip), want = gaitStride(id, g).length;
        expect(t, `${id} (${support}) ${g}`).toBeGreaterThan(want * 0.75);
        expect(t, `${id} (${support}) ${g}`).toBeLessThan(want * 1.1);
      }
    }
  });

  it('its feet: the bones nothing hangs from, at the bottom of the rig', () => {
    const id = bySupport.four, { pack } = beastClip(id, motionGaits(id)[0]);
    expect(feetOf(pack).length).toBeGreaterThanOrEqual(4);
  });

  it('a foot that slides a known way over a known stance; a clip whose feet never plant, none', () => {
    // two feet, each planted half the cycle, sliding back 0.5 m over it: a metre a cycle
    const k = 20, bones = [{ id: 'hip', head: [0, 0, 1], tail: [0, 0, 0.6] }, { id: 'footL', parent: 0, head: [-0.1, 0, 0], tail: [-0.1, 0.2, 0] }, { id: 'footR', parent: 0, head: [0.1, 0, 0], tail: [0.1, 0.2, 0] }];
    const foot = (u) => { const w = ((u % 1) + 1) % 1; return w < 0.5 ? [0.25 - w, 0] : [-0.25 + (w - 0.5), 0.2]; };
    const b = [];
    for (let f = 0; f < k; f++) {
      const u = f / k, L = foot(u), R = foot(u + 0.5);
      b.push(0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, -0.1, L[0], L[1], 0, 0, 0, 1, 0.1, R[0], R[1]);
    }
    expect(clipTravel({ bones }, { k, b })).toBeCloseTo(1, 1);
    const hover = b.map((v, i) => (i % 7 === 6 && i >= 7 ? 0.5 + 0.1 * Math.sin(i) : v));
    expect(clipTravel({ bones }, { k, b: hover.map((v, i) => (i % 21 >= 7 && i % 7 === 6 ? 0.5 : v)) })).toBeNull();
  });
});
