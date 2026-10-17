process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// stitch_motion over World clips: a World motion is raster, so its frames come back as PNGs, and the stitch takes
// them as they are. No browser and no ffmpeg in a test: the World render returns stub PNGs and the MP4 encoder is a
// stub; what is asserted is the wiring, the frames each clip hands the encoder.
const png = (shade) => import('sharp').then(({ default: sharp }) => sharp({ create: { width: 16, height: 9, channels: 3, background: { r: shade, g: shade, b: shade } } }).png().toBuffer());

vi.mock('@/lib/motion/world-motion.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    renderWorldMotion: vi.fn(async ({ frames = 3, fps = 12 }) => {
      const framePngs = await Promise.all(Array.from({ length: frames }, (_, i) => png(40 * i)));
      return { framePngs, width: 16, height: 9, viewBox: [0, 0, 16, 9], meta: { motion: 'orbit', frames, fps, loop: true } };
    }),
  };
});
vi.mock('@/lib/motion/encode-mp4.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    // a forge's own MP4 is a stub file; decoding it gives the frames the World render made for it
    encodeFramesMp4: vi.fn(async (pngs, outPath, opts = {}) => { await fs.writeFile(outPath, Buffer.from(`mp4:${pngs.length}`)); return { outPath, totalFrames: pngs.length, fps: opts.fps ?? 12, durationSec: 0, bytes: 8 }; }),
    decodeMp4Frames: vi.fn(async (mp4) => { const n = Number(String(await fs.readFile(mp4)).split(':')[1]); return Promise.all(Array.from({ length: n }, (_, i) => png(40 * i))); }),
    encodeStitchMp4: vi.fn(async (clips, outPath, opts = {}) => {
      await fs.writeFile(outPath, Buffer.from('mp4-stub'));
      const totalFrames = clips.reduce((s, c) => s + (c.frameSvgs?.length || c.framePngs.length), 0);
      const fps = opts.fps ?? 24;
      return { outPath, totalFrames, fps, width: 720, height: 404, durationSec: totalFrames / fps, bytes: 8, clips: clips.length, warning: null };
    }),
  };
});

import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { forgeMotionHandler, stitchMotionHandler } from './motion.js';
import { encodeStitchMp4, decodeMp4Frames } from '@/lib/motion/encode-mp4.js';
import { renderWorldMotion } from '@/lib/motion/world-motion.js';

let outDir;
beforeAll(async () => {
  outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mojulo-stitch-world-'));
  process.env.MOJULO_OUTCOMES_DIR = outDir;
});
afterAll(async () => { await fs.rm(outDir, { recursive: true, force: true }); });
beforeEach(() => { closeDb(); for (const f of [encodeStitchMp4, decodeMp4Frames, renderWorldMotion]) vi.mocked(f).mockClear(); });

describe('stitch_motion over World clips', () => {
  it('joins World clips, each handing the encoder its own frames as PNGs', async () => {
    const room = SketchRepository.create({ title: 'a room', manifest: { kind: 'floorplan', width: 12, height: 10, rooms: [{ x: 1, y: 1, w: 10, h: 8, glyph: 'L' }] } });
    const clip = (frames) => forgeMotionHandler({ title: `orbit ${frames}`, subject: { world_ref: room.ref }, shot: { motion: 'orbit', frames, fps: 12 } });
    const a = await clip(3), b = await clip(4);
    const res = await stitchMotionHandler({ title: 'the tour', clips: [a.motion_ref, b.motion_ref] });
    expect(res.ok).toBe(true);
    const [clips] = vi.mocked(encodeStitchMp4).mock.calls[0];
    expect(clips.map((c) => c.framePngs.length)).toEqual([3, 4]);
    expect(clips.every((c) => !c.frameSvgs && Buffer.isBuffer(c.framePngs[0]))).toBe(true);
    expect(res.frames).toBe(7);
  });
  it('takes a World clip baked to MP4 from its video, not from a second render', async () => {
    const room = SketchRepository.create({ title: 'a room', manifest: { kind: 'floorplan', width: 12, height: 10, rooms: [{ x: 1, y: 1, w: 10, h: 8, glyph: 'L' }] } });
    const clip = (frames) => forgeMotionHandler({ title: `orbit ${frames}`, subject: { world_ref: room.ref }, shot: { motion: 'orbit', frames, fps: 12 }, export: 'mp4' });
    const a = await clip(3), b = await clip(5);
    vi.mocked(renderWorldMotion).mockClear();
    const res = await stitchMotionHandler({ title: 'the tour', clips: [a.motion_ref, b.motion_ref] });
    expect(res.ok).toBe(true);
    expect(renderWorldMotion).not.toHaveBeenCalled();
    expect(decodeMp4Frames).toHaveBeenCalledTimes(2);
    expect(vi.mocked(encodeStitchMp4).mock.calls[0][0].map((c) => c.framePngs.length)).toEqual([3, 5]);
  });
});
