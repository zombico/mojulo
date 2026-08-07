// Scene frame planner (scene-staging.plan.md, Axis 2). A scene is a piecewise
// window over one clock; a cut is the absence of a cross-boundary tween. Proven
// on synthetic clips (no raster) — the wiring, before any plate exists.
import { describe, it, expect } from 'vitest';
import { resolveSceneFrames, sceneFrameCount, validateScene, requiredAssets } from './scene-compose.js';

const CLIP = { width: 832, height: 1216, cx: 416, groundY: 1037, span: 859 };
const STAGE = {
  unit: 859, dRef: 1, horizonY: 500, groundYRef: 1037,
  plate: { ref: 'plate.png', width: 3072, height: 1216, depth: 1, originX: 0, originY: 0 },
};
const NERA = { id: 'nera', clipRef: 'k1-nera-wave', clip: CLIP, cels: 6, markX: 400, depth: 1 };
const LIO = { id: 'lio', clipRef: 'k2-lio-wave', clip: CLIP, cels: 6, markX: 620, depth: 2 };

// a two-shot scene: establish (empty) → CUT → both actors, camera holds
const SCENE = {
  fps: 12, frame: { width: 832, height: 1216 }, stage: STAGE, cast: [NERA, LIO],
  shots: [
    { span: [0, 1], cast: [], camera: [{ t: 0, camX: 0 }, { t: 1, camX: 300, ease: 'ease-in-out' }] },
    { span: [1, 2], cast: ['nera', 'lio'], camera: [{ t: 0, camX: 300 }] },
  ],
};

describe('sceneFrameCount + the one clock', () => {
  it('frames = fps × latest tOut', () => {
    expect(sceneFrameCount(SCENE)).toBe(24);
  });
});

describe('resolveSceneFrames — piecewise shots + cuts', () => {
  it('shot 0 is empty (camera-as-subject establish), shot 1 carries the cast', () => {
    const { frames } = resolveSceneFrames(SCENE);
    const actorsIn = (fr) => fr.layers.filter((l) => l.kind === 'actor').length;
    expect(actorsIn(frames[0])).toBe(0);   // establish: only the plate band
    expect(actorsIn(frames[23])).toBe(2);  // after the cut: both actors
  });

  it('the cut is a discontinuity: last frame of shot 0 → first of shot 1 jumps camera+cast', () => {
    const { frames } = resolveSceneFrames(SCENE);
    const last0 = frames.filter((f) => f.shot === 0).at(-1);
    const first1 = frames.filter((f) => f.shot === 1)[0];
    expect(last0.layers.filter((l) => l.kind === 'actor').length).toBe(0);
    expect(first1.layers.filter((l) => l.kind === 'actor').length).toBe(2);
  });

  it('depth-sorts far→near so nearer actors composite last', () => {
    const { frames } = resolveSceneFrames(SCENE);
    const depths = frames[23].layers.map((l) => l.depth);
    expect(depths).toEqual([...depths].sort((a, b) => b - a)); // descending
    // plate (d1) and Lio (d2) both behind Nera (d1)... Lio deepest, Nera+plate tie at 1
    expect(depths[0]).toBe(2); // Lio furthest
  });

  it('actors place by the kernel: Nera native size low, Lio half size and higher', () => {
    const { frames } = resolveSceneFrames(SCENE);
    const nera = frames[23].layers.find((l) => l.id === 'nera');
    const lio = frames[23].layers.find((l) => l.id === 'lio');
    expect(nera.box.scale).toBeCloseTo(1, 5);
    expect(lio.box.scale).toBeCloseTo(0.5, 5);
    expect(lio.box.top).toBeGreaterThan(nera.box.top === undefined ? -1 : -Infinity);
    // Lio's soles sit higher in frame (smaller footSy) than Nera's
    const neraFoot = nera.box.top + CLIP.groundY * nera.box.scale;
    const lioFoot = lio.box.top + CLIP.groundY * lio.box.scale;
    expect(lioFoot).toBeLessThan(neraFoot);
  });

  it('the establish pan eases the plate band across the window', () => {
    const { frames } = resolveSceneFrames(SCENE);
    const plate0 = frames[0].layers.find((l) => l.kind === 'band');
    const plateEnd = frames.filter((f) => f.shot === 0).at(-1).layers.find((l) => l.kind === 'band');
    expect(plate0.left).toBe(0);
    expect(plateEnd.left).toBeLessThan(0); // panned right → plate slid left
  });

  it('cels advance on twos and loop', () => {
    const { frames } = resolveSceneFrames(SCENE);
    const neraCels = frames.filter((f) => f.shot === 1).map((f) => f.layers.find((l) => l.id === 'nera').celIndex);
    // 12 frames on twos over 6 cels: each cel held 2 frames
    expect(neraCels[0]).toBe(neraCels[1]);
    expect(new Set(neraCels).size).toBe(6);
  });

  it('is fully deterministic', () => {
    expect(JSON.stringify(resolveSceneFrames(SCENE))).toBe(JSON.stringify(resolveSceneFrames(SCENE)));
  });
});

describe('validator teeth', () => {
  it('refuses a plate too narrow for the pan (headroom)', () => {
    const bad = { ...SCENE, stage: { ...STAGE, plate: { ...STAGE.plate, width: 900 } } };
    expect(() => validateScene(bad)).toThrow(/too narrow/);
  });
  it('refuses a placement whose sole line leaves the floor', () => {
    const bad = { ...SCENE, cast: [{ ...NERA, depth: 0.4 }, LIO] };
    expect(() => validateScene(bad)).toThrow(/leaves the floor/);
  });
  it('refuses a non-loop actor straddling a cut', () => {
    const bad = {
      ...SCENE,
      cast: [{ ...NERA, loop: false }, LIO],
      shots: [
        { span: [0, 1], cast: ['nera'], camera: [{ t: 0, camX: 0 }] },
        { span: [1, 2], cast: ['nera'], camera: [{ t: 0, camX: 0 }] },
      ],
    };
    expect(() => validateScene(bad)).toThrow(/straddles the cut/);
  });
  it('accepts the well-formed scene', () => {
    expect(validateScene(SCENE)).toBe(true);
  });
});

describe('S3 — face tracks on the one clock', () => {
  const FACE = { ...NERA, face: { blink: { seed: 3, meanGapSec: 0.4 } } };
  const scene = { ...SCENE, cast: [FACE, LIO], shots: [{ span: [0, 3], cast: ['nera', 'lio'], camera: [{ t: 0, camX: 0 }] }] };

  it('an actor with a face track selects blink variant cels on the SCENE clock', () => {
    const { frames } = resolveSceneFrames(scene);
    const neraFiles = frames.map((f) => f.layers.find((l) => l.id === 'nera').celFile);
    expect(neraFiles.some((c) => /^face\/blink-(half|closed)\.png$/.test(c))).toBe(true);
    expect(neraFiles.some((c) => c === 'cel.png')).toBe(true);
    // an actor WITHOUT a face track always shows its base cel
    const lioFiles = frames.map((f) => f.layers.find((l) => l.id === 'lio').celFile);
    expect(lioFiles.every((c) => c === 'cel.png')).toBe(true);
  });

  it('the face variant rides the frame’s own pose key dir', () => {
    const { frames } = resolveSceneFrames(scene);
    const fr = frames.find((f) => f.layers.find((l) => l.id === 'nera').celFile.startsWith('face/'));
    const nera = fr.layers.find((l) => l.id === 'nera');
    expect(nera.keyDir).toBe(`key-${nera.celIndex}`);
  });
});

describe('S3 — the zero-generation re-render proof', () => {
  const withFace = (over) => ({
    ...SCENE,
    cast: [{ ...NERA, face: { blink: { seed: 7, meanGapSec: 1.0 } } }, LIO],
    shots: [{ span: [0, 3], cast: ['nera', 'lio'], camera: [{ t: 0, camX: 0 }] }],
    ...over,
  });
  const base = withFace({});
  const framesStr = (s) => JSON.stringify(resolveSceneFrames(s).frames);

  it('required source assets are independent of fps, seed, cut points, and blocking', () => {
    const reTime = withFace({ fps: 8 });
    const reSeed = { ...base, cast: [{ ...NERA, face: { blink: { seed: 99, meanGapSec: 1.0 } } }, LIO] };
    const reBlock = { ...base, cast: [{ ...NERA, face: { blink: { seed: 7, meanGapSec: 1.0 } }, depth: 1.4 }, LIO] };
    const reCut = { ...base, shots: [
      { span: [0, 1], cast: ['nera'], camera: [{ t: 0, camX: 0 }] },
      { span: [1, 3], cast: ['nera', 'lio'], camera: [{ t: 0, camX: 0 }] },
    ] };
    const assets = JSON.stringify(requiredAssets(base));
    for (const variant of [reTime, reSeed, reBlock, reCut]) {
      expect(JSON.stringify(requiredAssets(variant))).toBe(assets); // ZERO new generations...
    }
    // ...yet each actually changes the composite
    expect(framesStr(withFace({ fps: 8 }))).not.toBe(framesStr(base));           // re-time
    expect(framesStr({ ...base, cast: [{ ...NERA, face: { blink: { seed: 99, meanGapSec: 1.0 } } }, LIO] })).not.toBe(framesStr(base)); // re-seed
    expect(framesStr({ ...base, cast: [{ ...NERA, face: { blink: { seed: 7, meanGapSec: 1.0 } }, depth: 1.4 }, LIO] })).not.toBe(framesStr(base)); // re-block
  });

  it('requiredAssets lists pose count + face variants per clip', () => {
    expect(requiredAssets(base)).toEqual({
      'k1-nera-wave': { poses: 6, variants: ['blink-closed.png', 'blink-half.png'] },
      'k2-lio-wave': { poses: 6, variants: [] },
    });
  });
});
