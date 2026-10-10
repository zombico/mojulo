// encodeGifBuffers' preview knobs: `width` scales down keeping the aspect, `maxFps` keeps every k-th frame and holds
// it k ticks so the run keeps its real duration. Absent, the frames pass through at their own size and rate.
import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { loadSharp } from '../sharp-lazy.js';
import { encodeGifBuffers } from './encode-gif.js';

async function frames(n, w = 120, h = 90) {
  const sharp = await loadSharp();
  return Promise.all(Array.from({ length: n }, (_, i) =>
    sharp({ create: { width: w, height: h, channels: 3, background: { r: i * 20, g: 80, b: 160 } } }).png().toBuffer()));
}
const out = () => path.join(mkdtempSync(path.join(os.tmpdir(), 'gif-')), 'm.gif');

describe('encodeGifBuffers', () => {
  it('passes frames through at their own size and rate by default', async () => {
    const r = await encodeGifBuffers(await frames(6), out(), { fps: 24 });
    expect([r.frames, r.width, r.height, r.fps]).toEqual([6, 120, 90, 24]);
  });
  it('scales to `width` and caps the rate at `maxFps`, keeping the duration', async () => {
    const r = await encodeGifBuffers(await frames(6), out(), { fps: 24, width: 60, maxFps: 12 });
    expect([r.frames, r.width, r.height, r.fps]).toEqual([3, 60, 46, 12]);
    expect(r.frames / r.fps).toBe(6 / 24);
  });
  it('never scales up', async () => {
    const r = await encodeGifBuffers(await frames(2), out(), { fps: 12, width: 999, maxFps: 12 });
    expect([r.frames, r.width]).toEqual([2, 120]);
  });
});
