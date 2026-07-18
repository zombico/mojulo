// scene-motion manifest kind (scene-promotion.plan.md SP1). The layer above
// keyframe clips: stages cast clip refs over a plate; the only render target is
// the plate. unit is the eye-level fit derived from the ground plane.
import { describe, it, expect } from 'vitest';
import {
  normalizeSceneMotionManifest, normalizeImageOutcomesManifest, isImageOutcomesKind,
  renderTargets, parseSceneTarget, KIND_SCENE_MOTION, SCENE_MOTION_CONTRACT,
} from './manifest.js';

const base = {
  kind: 'scene-motion', title: 'Nera & Lio plaza',
  fps: 12, frame: { width: 832, height: 1216 },
  stage: { horizonY: 500, groundYRef: 1037, plate: { width: 3072, height: 1216, depth: 4 } },
  cast: [
    { id: 'nera', clipRef: 'sk_abc', markX: 300, depth: 1, face: { blink: { seed: 7, meanGapSec: 1.4 } } },
    { id: 'lio', clipRef: 'sk_def', markX: 600, depth: 2, phase: 3 },
  ],
  shots: [
    { span: [0, 1.5], cast: [], camera: [{ t: 0, camX: 700 }, { t: 1.5, camX: 1000, ease: 'ease-in-out' }] },
    { span: [1.5, 3], cast: ['nera', 'lio'], camera: [{ t: 0, camX: 0, zoom: 1.0 }] },
  ],
};

describe('normalizeSceneMotionManifest', () => {
  it('normalizes to the scene-motion contract and derives the eye-level unit', () => {
    const n = normalizeSceneMotionManifest(base);
    expect(n.kind).toBe(KIND_SCENE_MOTION);
    expect(n.contractVersion).toBe(SCENE_MOTION_CONTRACT);
    expect(Math.round(n.stage.unit)).toBe(577); // (1037-500)/0.93
    expect(n.cast.map((c) => c.id)).toEqual(['nera', 'lio']);
    expect(n.cast[0].clipRef).toBe('sk_abc');
    expect(n.cast[0].face.blink).toEqual({ seed: 7, meanGapSec: 1.4 });
    expect(n.shots).toHaveLength(2);
  });
  it('routes through isImageOutcomesKind and the normalize router', () => {
    expect(isImageOutcomesKind('scene-motion')).toBe(true);
    expect(normalizeImageOutcomesManifest(base).kind).toBe('scene-motion');
  });
  it('the only render target is the plate (bands are compositor-only in v1)', () => {
    expect(renderTargets(base)).toEqual(['plate']);
    const withBand = { ...base, stage: { ...base.stage, bands: [{ ref: 'bush', depth: 0.6 }] } };
    expect(renderTargets(withBand)).toEqual(['plate']);
    expect(parseSceneTarget(normalizeSceneMotionManifest(withBand), 'plate').plate).toBe(true);
    expect(parseSceneTarget(normalizeSceneMotionManifest(withBand), 'bush').band.depth).toBe(0.6);
  });
  it('normalizes speech spans to { from, to } (what resolveMouthTrack wants)', () => {
    const withSpeech = { ...base, cast: [{ ...base.cast[0], face: { speech: { spans: [[0.5, 1.5]], flapsPerSec: 8 } } }, base.cast[1]] };
    const n = normalizeSceneMotionManifest(withSpeech);
    expect(n.cast[0].face.speech.spans).toEqual([{ from: 0.5, to: 1.5 }]);
  });
  it('rejects malformed scenes', () => {
    expect(() => normalizeSceneMotionManifest({ ...base, stage: { horizonY: 1037, groundYRef: 500, plate: { width: 10, height: 10 } } })).toThrow(/horizonY/);
    expect(() => normalizeSceneMotionManifest({ ...base, cast: [] })).toThrow(/at least one cast/);
    expect(() => normalizeSceneMotionManifest({ ...base, cast: [{ id: 'x', markX: 0 }] })).toThrow(/clipRef/);
    expect(() => normalizeSceneMotionManifest({ ...base, shots: [{ span: [0, 1], cast: ['ghost'], camera: [] }] })).toThrow(/unknown cast/);
    expect(() => normalizeSceneMotionManifest({ ...base, shots: [] })).toThrow(/at least one shot/);
  });
});

// The CROSS-CUT: a shot with its own stage (the two-setting phone call — the
// cut GPT's talking-phone run needed and mojulo could not express).
describe('shots[].stage (the cross-cut)', () => {
  const shotStage = { horizonY: 300, groundYRef: 900, plate: { width: 2000, height: 1216, depth: 4 } };
  const crossCut = { ...base, shots: [base.shots[0], { ...base.shots[1], stage: shotStage }] };

  it('normalizes the shot stage with its own plate ref', () => {
    const n = normalizeSceneMotionManifest(crossCut);
    expect(n.shots[0].stage).toBeUndefined();
    expect(n.shots[1].stage.plate.ref).toBe('plate-shot-1');
    expect(n.shots[1].stage.plate.width).toBe(2000);
  });

  it('each cross-cut shot adds its own plate render target', () => {
    expect(renderTargets(crossCut)).toEqual(['plate', 'plate-shot-1']);
  });

  it('parseSceneTarget resolves a shot plate to that shot\'s stage', () => {
    const n = normalizeSceneMotionManifest(crossCut);
    const parsed = parseSceneTarget(n, 'plate-shot-1');
    expect(parsed.plate).toBe(true);
    expect(parsed.shotIndex).toBe(1);
    expect(parsed.stage.horizonY).toBe(300);
    expect(parseSceneTarget(n, 'plate').stage.horizonY).toBe(500);
    expect(() => parseSceneTarget(n, 'plate-shot-0')).toThrow(/no stage of its own/);
  });

  it('reserves plate-shot-* band refs', () => {
    const bad = { ...base, stage: { ...base.stage, bands: [{ ref: 'plate-shot-0', depth: 1 }] } };
    expect(() => normalizeSceneMotionManifest(bad)).toThrow(/reserved for plates/);
  });

  it('refuses camera keyframes outside SHOT-LOCAL time (the absolute-t footgun)', () => {
    // Codex authored shot [4.5, 9.5] with camera keys at t=4.5→9.5 (scene-absolute):
    // the sampler clamps and the camera freezes. Refuse at mint.
    const bad = {
      ...base,
      shots: [base.shots[0], { span: [1.5, 3], cast: ['nera'], camera: [{ t: 1.5, camX: 0 }, { t: 3, camX: 50 }] }],
    };
    expect(() => normalizeSceneMotionManifest(bad)).toThrow(/LOCAL time/);
    // the same move in shot-local seconds is fine
    const good = {
      ...base,
      shots: [base.shots[0], { span: [1.5, 3], cast: ['nera'], camera: [{ t: 0, camX: 0 }, { t: 1.5, camX: 50 }] }],
    };
    expect(normalizeSceneMotionManifest(good).shots[1].camera[1].t).toBe(1.5);
  });
});
