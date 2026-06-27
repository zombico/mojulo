/**
 * Motion — the STITCHER encoder: N already-forged motion clips → one long-form
 * MP4/H.264, the broadly-playable, downloadable container the GIF path can't be.
 *
 * Each source clip is recovered to its own array of self-contained frame SVGs
 * (the same `frameSvgs` the GIF encoder consumes). This module:
 *   1. picks ONE output canvas W×H (letterbox — no clip is cropped or distorted);
 *   2. rasters every clip's frames onto that canvas via the bundled sharp;
 *   3. RESAMPLES each clip to the single output fps (a clip keeps its real-time
 *      duration — frames are repeated/dropped to hit it), since H.264 wants a
 *      constant frame rate;
 *   4. lays the frames down as a numbered PNG sequence and hands it to ffmpeg.
 *
 * SNAPSHOT-AT-BUILD: every frame is baked into the MP4 here, so a stitch survives
 * a source motion being deleted or re-forged afterward (it does not re-render at
 * view time). Transitions are P1-cut-only — pure concatenation.
 */

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import sharp from 'sharp';

import { resolveFfmpeg, runFfmpeg } from './ffmpeg.js';

// Soft thresholds for the large-stitch warning. We WARN, never refuse — the
// operator owns the call (responsibility model). Tuning, not policy.
export const STITCH_WARN_FRAMES = 600;
export const STITCH_WARN_SECONDS = 60;

/**
 * Resample plan for one clip onto the output fps. A clip of `frames` frames at
 * its native `fps` lasts `frames/fps` seconds; at `outFps` that's `outCount`
 * output frames, each mapped back to a source frame by proportional index.
 *
 * @returns {{ outCount:number, indices:number[] }}
 */
export function planClip(frames, fps, outFps) {
  const n = Math.max(1, frames | 0);
  const durationSec = n / Math.max(0.0001, fps);
  const outCount = Math.max(1, Math.round(durationSec * outFps));
  const indices = [];
  for (let j = 0; j < outCount; j++) {
    indices.push(Math.min(n - 1, Math.floor((j * n) / outCount)));
  }
  return { outCount, indices };
}

/** Intrinsic pixel size of an SVG frame (frames within a clip share a viewBox). */
async function svgSize(svg, density) {
  const meta = await sharp(Buffer.from(svg), { density }).metadata();
  return { w: meta.width || 1, h: meta.height || 1 };
}

const even = (n) => (n % 2 ? n + 1 : n);

/**
 * Encode an ordered list of clips into one MP4.
 *
 * @param {Array<{ frameSvgs:string[], fps:number, ref?:string, title?:string }>} clips
 * @param {string} outPath  destination .mp4
 * @param {object} [opts]
 * @param {number} [opts.fps=24]     output (constant) frame rate
 * @param {number} [opts.width=720]  output width in px (height derived, letterbox)
 * @param {string} [opts.bg='#000000']  letterbox background
 * @param {number} [opts.density=160] svg raster density
 * @returns {Promise<{ outPath, totalFrames, width, height, fps, durationSec, bytes, clips, warning:string|null }>}
 */
export async function encodeStitchMp4(clips, outPath, opts = {}) {
  const { fps = 24, width = 720, bg = '#000000', density = 160 } = opts;
  if (!clips.length) throw new Error('encodeStitchMp4: no clips');
  for (const c of clips) {
    if (!c.frameSvgs?.length) throw new Error(`clip ${c.ref || '?'} recovered no frames`);
  }

  // ── output canvas: width fixed, height = tallest clip aspect so nothing is
  // cropped; every clip is letterboxed (fit:contain) into this exact W×H. ──
  const W = even(Math.round(width));
  let maxAspect = 0; // h/w
  for (const c of clips) {
    const { w, h } = await svgSize(c.frameSvgs[0], density);
    maxAspect = Math.max(maxAspect, h / w);
  }
  const H = even(Math.round(W * (maxAspect || 1)));

  const rasterFrame = (svg) =>
    sharp(Buffer.from(svg), { density })
      .resize({ width: W, height: H, fit: 'contain', background: bg })
      .flatten({ background: bg })
      .png()
      .toBuffer();

  // ── plan + raster (raster each unique source frame once, reuse for dups) ──
  const perClip = clips.map((c) => planClip(c.frameSvgs.length, c.fps || fps, fps));
  const totalFrames = perClip.reduce((s, p) => s + p.outCount, 0);
  const durationSec = totalFrames / fps;

  const tmpDir = path.join(os.tmpdir(), `moj-stitch-${randomUUID().slice(0, 8)}`);
  await fs.mkdir(tmpDir, { recursive: true });
  try {
    let seq = 0;
    for (let ci = 0; ci < clips.length; ci++) {
      const clip = clips[ci];
      const plan = perClip[ci];
      const rasters = new Map(); // source-index → PNG buffer (raster-once cache)
      for (const srcIdx of plan.indices) {
        if (!rasters.has(srcIdx)) {
          // eslint-disable-next-line no-await-in-loop -- bounded by frame budget
          rasters.set(srcIdx, await rasterFrame(clip.frameSvgs[srcIdx]));
        }
        seq += 1;
        // eslint-disable-next-line no-await-in-loop
        await fs.writeFile(path.join(tmpDir, `f_${String(seq).padStart(6, '0')}.png`), rasters.get(srcIdx));
      }
    }

    const bin = await resolveFfmpeg();
    await runFfmpeg(bin, [
      '-y',
      '-framerate', String(fps),
      '-i', path.join(tmpDir, 'f_%06d.png'),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-an',
      outPath,
    ]);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }

  const { size } = await fs.stat(outPath);
  const warning =
    totalFrames > STITCH_WARN_FRAMES || durationSec > STITCH_WARN_SECONDS
      ? `Large stitch: ${totalFrames} frames (~${durationSec.toFixed(1)}s, ${(size / 1e6).toFixed(1)} MB). ` +
        `Encoding rasterizes every frame, so build time and output size scale with length — proceeded anyway.`
      : null;

  return {
    outPath,
    totalFrames,
    width: W,
    height: H,
    fps,
    durationSec,
    bytes: size,
    clips: clips.length,
    warning,
  };
}

/**
 * Encode an ordered list of uniform PNG buffers (one clip's worth of frames, e.g.
 * headless three.js World capture) into a single MP4/H.264 — the downloadable,
 * broadly-playable form of a world motion. No letterbox/resample (single source,
 * already uniform W×H); the source frames ARE the timeline at the given fps. The
 * frames are padded to even dimensions for yuv420p. (.mov is the same encode with
 * a container swap; P1 ships .mp4.)
 *
 * @param {Buffer[]} pngBuffers  one PNG per frame (uniform size)
 * @param {string}   outPath     destination .mp4
 * @param {object}   [opts]      { fps }
 * @returns {Promise<{ outPath, totalFrames, fps, durationSec, bytes }>}
 */
export async function encodeFramesMp4(pngBuffers, outPath, opts = {}) {
  const { fps = 24 } = opts;
  if (!pngBuffers.length) throw new Error('encodeFramesMp4: no frames');

  const tmpDir = path.join(os.tmpdir(), `moj-world-${randomUUID().slice(0, 8)}`);
  await fs.mkdir(tmpDir, { recursive: true });
  try {
    for (let i = 0; i < pngBuffers.length; i++) {
      // eslint-disable-next-line no-await-in-loop -- bounded by frame budget
      await fs.writeFile(path.join(tmpDir, `f_${String(i + 1).padStart(6, '0')}.png`), pngBuffers[i]);
    }
    const bin = await resolveFfmpeg();
    await runFfmpeg(bin, [
      '-y',
      '-framerate', String(fps),
      '-i', path.join(tmpDir, 'f_%06d.png'),
      // pad odd-sized captures up to even W×H so yuv420p/libx264 is happy.
      '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-an',
      outPath,
    ]);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }

  const { size } = await fs.stat(outPath);
  const totalFrames = pngBuffers.length;
  return { outPath, totalFrames, fps, durationSec: totalFrames / fps, bytes: size };
}
