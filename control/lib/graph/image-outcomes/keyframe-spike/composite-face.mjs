/**
 * Face-layer compositor (face-subcels.plan.md, revised) — composites the wave
 * cycle where each frame shows a WHOLE meru-locked cel selected on a seeded
 * blink / speech schedule: the base pose cel (eyes open) or that pose's
 * expression variant (eyes closed, etc.). No decals, no overlay — full raster
 * per frame, so the eyes never drift. Zero generations: a new seed / new spans
 * re-selects over the SAME rendered cels.
 *
 *   node composite-face.mjs <dir> [--blink-seed 7] [--speech "0.5-1.5,2.0-3.0"]
 *                                 [--cycles 3] [--fps 12] [--out motion-face.gif]
 *
 * Reads keys/key-<i>/cel.png and keys/key-<i>/face/<vocab>-<state>.png. A
 * missing variant falls back to the base cel (and is reported).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import { CANVAS } from '../parts-bank-spike/front.js';
import { floodKey } from '../parts-bank-spike/key.js';
import { encodeGifBuffers } from '../../../motion/encode-gif.js';
import { buildFaceManifest, resolveFaceFrames, requiredVariants } from './face-composite.js';

const DIR = path.resolve(process.argv[2] || '.');
const rest = process.argv.slice(3);
const flag = (n, d) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : d; };
const BLINK_SEED = Number(flag('blink-seed', 7));
const SPEECH = flag('speech', '');
const CYCLES = Number(flag('cycles', 3));
const FPS = Number(flag('fps', 12));
const OUT = flag('out', 'motion-face.gif');
const { width: W, height: H } = CANVAS;
const exists = (p) => fs.access(p).then(() => true, () => false);

const spans = SPEECH
  ? SPEECH.split(',').map((s) => { const [from, to] = s.split('-').map(Number); return { from, to }; })
  : [];

const keys = (await fs.readdir(path.join(DIR, 'keys'), { withFileTypes: true }))
  .filter((d) => d.isDirectory() && d.name.startsWith('key-')).map((d) => d.name)
  .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));

const manifest = buildFaceManifest({
  keys, fps: FPS, onTwos: 2, cycles: CYCLES,
  blink: { seed: BLINK_SEED, meanGapSec: 2.2 },
  speech: spans.length ? { spans } : null,
});
const { frames: schedule } = resolveFaceFrames(manifest);

// Key each distinct cel once (base + any present variant), matted over the flat
// background at full res, cached by relative path.
const keyedCache = new Map();
const missing = new Set();
async function keyedFrame(key, celFile) {
  const rel = `${key}/${celFile}`;
  if (keyedCache.has(rel)) return keyedCache.get(rel);
  let file = path.join(DIR, 'keys', key, celFile);
  if (celFile !== 'cel.png' && !(await exists(file))) {
    missing.add(rel);
    file = path.join(DIR, 'keys', key, 'cel.png'); // fall back to base
  }
  const rgba = await sharp(file).resize({ width: W, height: H, fit: 'fill' }).ensureAlpha().raw().toBuffer();
  floodKey(rgba, CANVAS);
  const png = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .flatten({ background: '#add0eb' }).resize({ width: 416, height: 608 }).png().toBuffer();
  keyedCache.set(rel, png);
  return png;
}

const framesOut = [];
for (const step of schedule) framesOut.push(await keyedFrame(step.key, step.celFile));

await fs.mkdir(path.join(DIR, 'composite'), { recursive: true });
const outPath = path.join(DIR, 'composite', OUT);
const res = await encodeGifBuffers(framesOut, outPath, { fps: FPS, loop: 0 });
console.log(`face GIF: ${res.outPath} (${res.frames} frames @ ${FPS}fps, ${CYCLES} cycles, blink seed ${BLINK_SEED}${spans.length ? `, speech ${SPEECH}` : ''})`);
console.log(`variant cels needed per key: ${requiredVariants(manifest).join(', ') || '(none)'}`);
if (missing.size) console.log(`MISSING variant cels (fell back to base): ${[...missing].slice(0, 8).join(', ')}${missing.size > 8 ? ` +${missing.size - 8} more` : ''}\n  → render them full over each pose's guide (F2 / bicycle face), then re-run.`);
else console.log('all needed variant cels present — the face layer is fully composited.');
