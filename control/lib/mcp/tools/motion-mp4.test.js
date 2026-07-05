process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// export:'mp4' must never resolve/lazy-fetch a real ffmpeg in tests — mock the
// encoder module (the @/lib/motion barrel re-exports it, so the handler's import
// resolves to this mock) and assert the WIRING: what the handler passes the
// encoder, what lands in the outcome folder, and the returned artifact paths.
// planClip stays real (pure).
vi.mock('@/lib/motion/encode-mp4.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    encodeStitchMp4: vi.fn(async (clips, outPath, opts = {}) => {
      await fs.writeFile(outPath, Buffer.from('mp4-stub'));
      const totalFrames = clips.reduce((s, c) => s + c.frameSvgs.length, 0);
      const fps = opts.fps ?? 24;
      return {
        outPath, totalFrames, fps,
        width: opts.width ?? 720, height: 480,
        durationSec: totalFrames / fps, bytes: 8, clips: clips.length, warning: null,
      };
    }),
  };
});

import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { forgeMotionHandler } from './motion.js';
import { encodeStitchMp4 } from '@/lib/motion/encode-mp4.js';

let outDir;

// The same self-contained manji-tree subject the sibling suite uses.
const SUBJECT = {
  kind: 'manji-tree',
  dimensions: '3d',
  physics: { gravity: { x: 0, y: 0, z: -1 }, gravityStrength: 1 },
  showSlotMarkers: false,
  camera: {
    worldFraming: { cameraPosition: [0, -12, 4], lookAt: [0, 0, 2], horizontalFov: 46 },
    viewBox: { width: 480, height: 400 },
  },
  roomBasis: { xRange: [-8, 8], yRange: [-8, 8], worldExtent: { width: 16, depth: 16, height: 10 } },
  tree: {
    id: 'world',
    spine: { bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'open', Nadir: 'open' }, lengthScale: 0.01 } },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [],
    children: [],
  },
  waveFields: [
    {
      corners: [
        { x: -8, y: 8, z: 0 },
        { x: 8, y: 8, z: 0 },
        { x: 8, y: -8, z: 0 },
        { x: -8, y: -8, z: 0 },
      ],
      displacement: { x: 0, y: 0, z: 1 },
      samples: { u: 10, v: 10 },
      waves: [{ amplitude: 2.2, cycles: { u: 1.5, v: 1.5 }, phase: 0.4 }],
      style: { stroke: '#8a744a', width: 0.5 },
    },
  ],
};

beforeAll(async () => {
  outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mojulo-motion-mp4-'));
  process.env.MOJULO_OUTCOMES_DIR = outDir;
});

afterAll(async () => {
  await fs.rm(outDir, { recursive: true, force: true });
});

beforeEach(() => {
  closeDb();
  vi.mocked(encodeStitchMp4).mockClear();
});

describe("forge_motion export:'mp4' — single-clip H.264 for the SVG families", () => {
  it('bakes an mp4 beside the durable svg (no gif) and returns mp4_path', async () => {
    const sketch = SketchRepository.create({ title: 'terrain', manifest: SUBJECT });

    const res = await forgeMotionHandler({
      title: 'terrain clip',
      subject: { sketch_ref: sketch.ref },
      shot: { motion: 'turntable', frames: 6, fps: 10 },
      export: 'mp4',
    });

    expect(res.ok).toBe(true);
    expect(res.svg_path).toBe(`${res.url}motion.svg`);
    expect(res.mp4_path).toBe(`${res.url}motion.mp4`);
    expect(res.gif_path).toBeNull();

    // one clip, all six frames, encoded at the shot's own fps (>= 5 → no resample)
    expect(encodeStitchMp4).toHaveBeenCalledTimes(1);
    const [clips, outPath, opts] = vi.mocked(encodeStitchMp4).mock.calls[0];
    expect(clips).toHaveLength(1);
    expect(clips[0].frameSvgs).toHaveLength(6);
    expect(clips[0].fps).toBe(10);
    expect(opts.fps).toBe(10);
    expect(outPath.endsWith('motion.mp4')).toBe(true);

    const dir = path.join(outDir, res.motion_ref);
    const files = await fs.readdir(dir);
    expect(files).toContain('motion.svg');
    expect(files).toContain('motion.mp4');
    expect(files).not.toContain('motion.gif');

    // the viewer offers the mp4 download beside the flipbook player
    const html = await fs.readFile(path.join(dir, 'index.html'), 'utf8');
    expect(html).toContain('motion.mp4');
  });

  it('resamples a fractional-fps still deck up to 24fps (H.264 wants a sane constant rate)', async () => {
    const slide = (label) => ({
      title: label,
      viewBox: { width: 320, height: 200 },
      marks: [{ kind: 'text', x: 40, y: 100, text: label, size: 24, color: '#e8e8e8' }],
    });

    const res = await forgeMotionHandler({
      title: 'two slides',
      subject: { deck: [slide('one'), slide('two')] },
      shot: { motion: 'deck' },
      export: 'mp4',
    });

    expect(res.ok).toBe(true);
    expect(res.mp4_path).toBe(`${res.url}motion.mp4`);
    const [clips, , opts] = vi.mocked(encodeStitchMp4).mock.calls[0];
    expect(clips[0].fps).toBeLessThan(5);  // the deck's native still cadence
    expect(opts.fps).toBe(24);             // the encode's constant output rate
  });

  it("default export ('both') never touches the mp4 encoder — svg + gif only", async () => {
    const sketch = SketchRepository.create({ title: 'terrain', manifest: SUBJECT });

    const res = await forgeMotionHandler({
      title: 'default forge',
      subject: { sketch_ref: sketch.ref },
      shot: { motion: 'turntable', frames: 4, fps: 10 },
    });

    expect(res.ok).toBe(true);
    expect(res.gif_path).toBe(`${res.url}motion.gif`);
    expect(res.mp4_path).toBeNull();
    expect(encodeStitchMp4).not.toHaveBeenCalled();
  });
});
