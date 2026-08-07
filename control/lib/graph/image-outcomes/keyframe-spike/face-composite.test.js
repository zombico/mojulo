// Face keyframe SELECTION (face-subcels.plan.md, revised). Each frame shows a
// whole meru-locked cel — base pose cel or an expression variant — on a seeded
// schedule. Pins the zero-generation claim: a new blink seed re-selects over
// the SAME rendered cels.
import { describe, it, expect } from 'vitest';
import {
  buildFaceManifest, resolveFaceFrames, faceFrameCount, requiredVariants,
} from './face-composite.js';

const KEYS = ['key-0', 'key-1', 'key-2', 'key-3', 'key-4', 'key-5'];

describe('buildFaceManifest / faceFrameCount', () => {
  it('frame count = keys × onTwos × cycles', () => {
    const m = buildFaceManifest({ keys: KEYS, onTwos: 2, cycles: 3 });
    expect(faceFrameCount(m)).toBe(6 * 2 * 3);
  });
  it('omitting speech leaves only the blink channel', () => {
    const m = buildFaceManifest({ keys: KEYS, speech: null });
    expect(m.subCels.map((s) => s.id)).toEqual(['eyes']);
  });
});

describe('resolveFaceFrames — full-cel selection', () => {
  it('base frames select the pose cel; blink frames select that pose’s variant cel', () => {
    const m = buildFaceManifest({ keys: KEYS, onTwos: 2, cycles: 3, fps: 12, blink: { seed: 3, meanGapSec: 0.4 } });
    const { frames } = resolveFaceFrames(m);
    // every celFile is either the base or a real variant of the frame's own key
    for (const fr of frames) {
      expect(fr.celFile === 'cel.png' || /^face\/blink-(half|closed)\.png$/.test(fr.celFile)).toBe(true);
    }
    // at least one frame blinks (selects a variant), at least one is base
    expect(frames.some((f) => f.celFile.startsWith('face/'))).toBe(true);
    expect(frames.some((f) => f.celFile === 'cel.png')).toBe(true);
    // the variant belongs to the frame's pose key (path is relative to keys/<key>/)
    const blinkFrame = frames.find((f) => f.celFile.startsWith('face/'));
    expect(blinkFrame.key).toMatch(/^key-\d$/);
  });

  it('a calm blink (huge gap) selects the base cel every frame', () => {
    const m = buildFaceManifest({ keys: KEYS, cycles: 1, blink: { seed: 1, meanGapSec: 1000 } });
    const { frames } = resolveFaceFrames(m);
    expect(frames.every((f) => f.celFile === 'cel.png')).toBe(true);
  });

  it('ZERO-GENERATION re-render: a new blink seed re-selects over the SAME variant cels', () => {
    const base = { keys: KEYS, cycles: 4, fps: 12 };
    const a = buildFaceManifest({ ...base, blink: { seed: 11, meanGapSec: 1.0 } });
    const b = buildFaceManifest({ ...base, blink: { seed: 40004, meanGapSec: 1.0 } });
    // the cels that must be RENDERED are identical (zero new generations)...
    expect(requiredVariants(a)).toEqual(requiredVariants(b));
    // ...but the per-frame selection differs (different blink timing)
    const sa = resolveFaceFrames(a).frames.map((f) => f.celFile).join('|');
    const sb = resolveFaceFrames(b).frames.map((f) => f.celFile).join('|');
    expect(sa).not.toBe(sb);
  });

  it('is fully deterministic: same manifest → identical selection', () => {
    const mk = () => buildFaceManifest({ keys: KEYS, cycles: 2, blink: { seed: 42, meanGapSec: 0.5 } });
    expect(JSON.stringify(resolveFaceFrames(mk()).frames)).toBe(JSON.stringify(resolveFaceFrames(mk()).frames));
  });

  it('keyIndex cycles with onTwos and wraps across cycles', () => {
    const m = buildFaceManifest({ keys: ['key-0', 'key-1'], onTwos: 2, cycles: 2, blink: { seed: 1, meanGapSec: 1000 } });
    expect(resolveFaceFrames(m).frames.map((f) => f.keyIndex)).toEqual([0, 0, 1, 1, 0, 0, 1, 1]);
  });
});

describe('requiredVariants', () => {
  it('lists the full-cel expression variants to render (non-base states)', () => {
    const m = buildFaceManifest({ keys: KEYS, speech: { spans: [{ from: 0, to: 1 }] } });
    expect(requiredVariants(m).sort()).toEqual(['blink-closed.png', 'blink-half.png', 'mouth-mid.png', 'mouth-open.png'].sort());
  });
});
