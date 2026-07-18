// Scene raster core (scene-promotion.plan.md SP0). The pure frame producer
// forge_motion needs: scene + injected providers → framePngs[]. Tiny synthetic
// assets — no disk, no demo config.
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { renderSceneFrames } from './scene-composite.js';
import { sceneFrameCount } from './scene-compose.js';

const CLIP = { width: 40, height: 60, cx: 20, groundY: 52, span: 44 };
const solid = (w, h, rgb) => sharp({ create: { width: w, height: h, channels: 4, background: { r: rgb[0], g: rgb[1], b: rgb[2], alpha: 1 } } }).png().toBuffer();

const scene = {
  fps: 6, frame: { width: 60, height: 60 },
  stage: {
    unit: 44, dRef: 1, horizonY: 24, groundYRef: 52,
    plate: { ref: 'plate', width: 120, height: 60, depth: 4, originX: 0, originY: 0 },
    floor: [24, 60],
  },
  cast: [{ id: 'a', clipRef: 'clipA', clip: CLIP, cels: 2, markX: 30, depth: 1 }],
  shots: [{ span: [0, 1], cast: ['a'], camera: [{ t: 0, camX: 0 }] }],
};

describe('renderSceneFrames', () => {
  it('produces one PNG buffer per output frame, sourcing assets from the providers', async () => {
    const seen = [];
    const frames = await renderSceneFrames(scene, {
      plate: await solid(120, 60, [40, 80, 120]),
      band: async () => null,
      cel: async (clipRef, keyDir, celFile) => { seen.push(`${clipRef}/${keyDir}/${celFile}`); return solid(40, 60, [200, 60, 60]); },
    });
    expect(frames.length).toBe(sceneFrameCount(scene)); // fps 6 × 1s = 6
    for (const f of frames) expect(Buffer.isBuffer(f)).toBe(true);
    // the cel provider was asked for this clip's cels via keyDir/celFile (the injected source)
    expect(seen.some((s) => s.startsWith('clipA/key-'))).toBe(true);
    expect(seen.every((s) => s.endsWith('/cel.png'))).toBe(true);
    // each frame is a real PNG at the frame size
    const m = await sharp(frames[0]).metadata();
    expect(m.width).toBe(60); expect(m.height).toBe(60);
  });

  it('honors downscale', async () => {
    const frames = await renderSceneFrames(scene, {
      plate: await solid(120, 60, [40, 80, 120]),
      cel: async () => solid(40, 60, [200, 60, 60]),
      downscale: { width: 30, height: 30 },
    });
    const m = await sharp(frames[0]).metadata();
    expect(m.width).toBe(30); expect(m.height).toBe(30);
  });

  it('is deterministic: identical scene + providers → byte-identical frames', async () => {
    const providers = () => ({ plate: solid(120, 60, [40, 80, 120]), cel: async () => solid(40, 60, [200, 60, 60]) });
    const p1 = providers(); const a = await renderSceneFrames(scene, { plate: await p1.plate, cel: p1.cel });
    const p2 = providers(); const b = await renderSceneFrames(scene, { plate: await p2.plate, cel: p2.cel });
    expect(Buffer.compare(a[0], b[0])).toBe(0);
    expect(Buffer.compare(a[a.length - 1], b[b.length - 1])).toBe(0);
  });

  it('a cross-cut shot plays on its own stage plate (the by-ref plate provider)', async () => {
    const crossCut = {
      ...scene,
      shots: [
        { span: [0, 1], cast: ['a'], camera: [{ t: 0, camX: 0 }] },
        {
          span: [1, 2], cast: [], camera: [{ t: 0, camX: 0 }],
          stage: {
            unit: 44, dRef: 1, horizonY: 20, groundYRef: 50,
            plate: { ref: 'plate-shot-1', width: 80, height: 60, depth: 4, originX: 0, originY: 0 },
            floor: [20, 60],
          },
        },
      ],
    };
    const asked = [];
    const plates = { plate: await solid(120, 60, [40, 80, 120]), 'plate-shot-1': await solid(80, 60, [120, 40, 40]) };
    const frames = await renderSceneFrames(crossCut, {
      plate: async (ref) => { asked.push(ref); return plates[ref]; },
      cel: async () => solid(40, 60, [200, 60, 60]),
    });
    expect(frames.length).toBe(sceneFrameCount(crossCut)); // fps 6 × 2s = 12
    expect(asked.slice(0, 6).every((r) => r === 'plate')).toBe(true); // shot 0 frames
    expect(asked.slice(6).every((r) => r === 'plate-shot-1')).toBe(true); // the cut
    // the cut is visible: shot-0 and shot-1 frames differ
    expect(Buffer.compare(frames[0], frames[11])).not.toBe(0);
  });
});
