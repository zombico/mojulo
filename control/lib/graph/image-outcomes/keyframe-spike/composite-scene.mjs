/**
 * Scene compositor (scene-staging.plan.md, S1–S2 — the LOCAL wiring rung). Takes
 * a scene (built-in demo or scene.json), the REAL k1/k2 clips, and a deterministic
 * stand-in plate, and composites the multiplane scene. ZERO character generations
 * — the only asset synthesized here is the throwaway plate (a real staged plate is
 * the Codex rung's job later). Proves: kernel + shot grammar + real clips → a
 * scene that reads. Pure planning lives in scene-compose.js; this does raster only.
 *
 *   cd control && node lib/graph/image-outcomes/keyframe-spike/composite-scene.mjs [still|cut] [outDir]
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import { CANVAS } from '../parts-bank-spike/front.js';
import { floodKey } from '../parts-bank-spike/key.js';
import { encodeGifBuffers } from '../../../motion/encode-gif.js';
import { requiredAssets } from './scene-compose.js';
import { renderSceneFrames } from './scene-composite.js';
import { eyeLevelUnit } from './stage.js';

const ROOT = path.resolve('../lite-template/integration/0712/spike-output/animation-cheats');
const CLIP = { width: 832, height: 1216, cx: 416, groundY: 1037, span: 859 };
const FRAME = { width: 832, height: 1216 };
// unit is FIT to the plate (eye-level camera), NOT the clip's native 859px — else
// the implied camera sits at hip height and everyone reads as a giant.
const STAGE = {
  unit: eyeLevelUnit(1037, 500), dRef: 1, horizonY: 500, groundYRef: 1037,
  plate: { ref: 'plate', width: 3072, height: 1216, depth: 4, originX: 0, originY: 0 },
  floor: [500, 1216],
};

const DEMOS = {
  // S1 — static two-shot, prove multiplane depth (scale + floor height)
  still: {
    fps: 12, frame: FRAME, stage: STAGE,
    cast: [
      { id: 'nera', clipRef: 'k1-nera-wave', clip: CLIP, cels: 6, markX: 300, depth: 1 },
      { id: 'lio', clipRef: 'k2-lio-wave', clip: CLIP, cels: 6, markX: 600, depth: 2, phase: 3 },
    ],
    shots: [{ span: [0, 2], cast: ['nera', 'lio'], camera: [{ t: 0, camX: 0 }] }],
  },
  // S2 — establish pan (empty + fg parallax band) → CUT → two-shot
  cut: {
    fps: 12, frame: FRAME,
    stage: { ...STAGE, bands: [{ ref: 'bush', depth: 0.6, originX: 1200, originY: 700 }] },
    cast: [
      { id: 'nera', clipRef: 'k1-nera-wave', clip: CLIP, cels: 6, markX: 300, depth: 1 },
      { id: 'lio', clipRef: 'k2-lio-wave', clip: CLIP, cels: 6, markX: 600, depth: 2, phase: 3 },
    ],
    shots: [
      { span: [0, 1.5], cast: [], camera: [{ t: 0, camX: 700 }, { t: 1.5, camX: 1000, ease: 'ease-in-out' }] },
      { span: [1.5, 3], cast: ['nera', 'lio'], camera: [{ t: 0, camX: 0 }] },
    ],
  },
  // S3 — a two-shot with a per-actor face track on the one clock (blink variants
  // fall back to base cel.png until the Codex face rung paints them; the SELECTION
  // path is what's exercised here — see requiredAssets in the run report)
  talk: {
    fps: 12, frame: FRAME, stage: STAGE,
    cast: [
      { id: 'nera', clipRef: 'k1-nera-wave', clip: CLIP, cels: 6, markX: 300, depth: 1, face: { blink: { seed: 7, meanGapSec: 1.4 } } },
      { id: 'lio', clipRef: 'k2-lio-wave', clip: CLIP, cels: 6, markX: 600, depth: 2, phase: 3 },
    ],
    shots: [{ span: [0, 3], cast: ['nera', 'lio'], camera: [{ t: 0, camX: 0 }] }],
  },
  // PULL-BACK — the camera pulls back (lens zoom 1.5 → 1.0) over the whole action
  // while both actors animate. Stays zoomed IN (z≥1) so the plate always covers
  // the frame (a wider pull needs a taller plate). Proves push/pull orchestration.
  pull: {
    fps: 12, frame: FRAME, stage: STAGE,
    cast: [
      { id: 'nera', clipRef: 'k1-nera-wave', clip: CLIP, cels: 6, markX: 300, depth: 1 },
      { id: 'lio', clipRef: 'k2-lio-wave', clip: CLIP, cels: 6, markX: 600, depth: 2, phase: 3 },
    ],
    shots: [{
      span: [0, 3], cast: ['nera', 'lio'],
      camera: [{ t: 0, camX: 0, zoom: 1.5 }, { t: 3, camX: 0, zoom: 1.0, ease: 'ease-in-out' }],
    }],
  },
  // ZOOM-APPROACH — the OTHER push/pull: no camera move; Nera walks TOWARD camera
  // via a per-actor DEPTH ramp (d 2.6 → 1.0), Lio holds at d=2. Data-only — the
  // planner's actorDepth already reads depthKeys; proves it composes with no new code.
  approach: {
    fps: 12, frame: FRAME, stage: STAGE,
    cast: [
      { id: 'lio', clipRef: 'k2-lio-wave', clip: CLIP, cels: 6, markX: 620, depth: 2, phase: 3 },
      { id: 'nera', clipRef: 'k1-nera-wave', clip: CLIP, cels: 6, markX: 416, depth: 2.6, depthKeys: [{ t: 0, depth: 2.6 }, { t: 3, depth: 1.0 }] },
    ],
    shots: [{ span: [0, 3], cast: ['nera', 'lio'], camera: [{ t: 0, camX: 0 }] }],
  },
};

// ---- deterministic stand-in plate (no worker) --------------------------------
async function standInPlate(w, h, horizonY) {
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      let r; let g; let b;
      if (y < horizonY) {                       // sky: blue → pale at horizon
        const u = y / horizonY;
        r = 120 + 100 * u; g = 165 + 70 * u; b = 220 + 30 * u;
      } else {                                   // ground: green, darker downward
        const u = (y - horizonY) / (h - horizonY);
        r = 90 - 30 * u; g = 130 - 50 * u; b = 70 - 25 * u;
      }
      const stripe = Math.sin(x / 90) * 10;      // faint columns so the pan/parallax reads
      buf[i] = Math.max(0, Math.min(255, r + stripe));
      buf[i + 1] = Math.max(0, Math.min(255, g + stripe));
      buf[i + 2] = Math.max(0, Math.min(255, b + stripe));
      buf[i + 3] = 255;
    }
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

// The plate: a REAL painted plate (env PLATE=<path>, the Codex-rung output) if
// given, else the deterministic stand-in. A real plate is resized to the declared
// plate dimensions so the kernel's coordinates stay authoritative.
async function loadPlate(w, h, horizonY) {
  if (process.env.PLATE) {
    return sharp(process.env.PLATE).resize({ width: w, height: h, fit: 'fill' }).ensureAlpha().png().toBuffer();
  }
  return standInPlate(w, h, horizonY);
}

// a simple opaque foreground occluder (a dark "bush/pillar") to make parallax visible
async function standInBush(w = 360, h = 520) {
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const i = (y * w + x) * 4;
    const inside = Math.hypot((x - w / 2) / (w / 2), (y - h / 2) / (h / 2)) < 1;
    buf[i] = 30; buf[i + 1] = 55; buf[i + 2] = 35; buf[i + 3] = inside ? 255 : 0;
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

// ---- keyed clip cels (the REAL k1/k2 cels, flood-keyed to transparent) --------
// Resolve a cel on demand by (clipRef, keyDir, celFile), keying it once and
// caching by full path. A face variant that hasn't been painted yet FALLS BACK
// to the base cel.png (variants await the Codex face-subcel rung) so the S3
// selection path is exercised without blocking on assets that don't exist.
const celCache = new Map();
const exists = (p) => fs.access(p).then(() => true, () => false);
async function celBuffer(clipRef, keyDir, celFile) {
  let file = path.join(ROOT, clipRef, 'keys', keyDir, celFile);
  if (celFile !== 'cel.png' && !(await exists(file))) file = path.join(ROOT, clipRef, 'keys', keyDir, 'cel.png');
  if (celCache.has(file)) return celCache.get(file);
  const raw = await sharp(file)
    .resize({ width: CANVAS.width, height: CANVAS.height, fit: 'fill' }).ensureAlpha().raw().toBuffer();
  floodKey(raw, CANVAS);
  const buf = await sharp(raw, { raw: { width: CANVAS.width, height: CANVAS.height, channels: 4 } }).png().toBuffer();
  celCache.set(file, buf);
  return buf;
}

// ---- main --------------------------------------------------------------------
const which = process.argv[2] || 'still';
const scene = DEMOS[which];
if (!scene) { console.error(`unknown demo '${which}' (still | cut | talk | pull | approach)`); process.exit(1); }
if (process.env.SCENE_FPS) scene.fps = Number(process.env.SCENE_FPS); // re-time proof: same assets, new gif
const outDir = path.resolve(process.argv[3] || path.join(ROOT, 'scene-spike', which));
await fs.mkdir(path.join(outDir, 'composite'), { recursive: true });

// CLI providers: stand-in (or env) plate, an occluder band, disk cels. The pure
// renderSceneFrames does the raster; this harness only sources assets.
const plate = await loadPlate(scene.stage.plate.width, scene.stage.plate.height, scene.stage.horizonY);
const bushPng = scene.stage.bands ? await standInBush() : null;
const gifFrames = await renderSceneFrames(scene, {
  plate,
  band: async () => bushPng,
  cel: (clipRef, keyDir, celFile) => celBuffer(clipRef, keyDir, celFile),
  downscale: { width: 416, height: 608 },
});

if (process.env.DUMP) {
  await fs.mkdir(path.join(outDir, 'frames'), { recursive: true });
  for (const idx of process.env.DUMP.split(',').map(Number)) {
    if (gifFrames[idx]) await fs.writeFile(path.join(outDir, 'frames', `f${idx}.png`), gifFrames[idx]);
  }
}
const outGif = path.join(outDir, 'composite', 'scene.gif');
const res = await encodeGifBuffers(gifFrames, outGif, { fps: scene.fps, loop: 0 });
await fs.writeFile(path.join(outDir, 'scene.json'), JSON.stringify(scene, null, 2));
console.log(`scene '${which}': ${res.frames} frames @ ${scene.fps}fps → ${res.outPath}`);
console.log(`  cast: ${scene.cast.map((a) => `${a.id}@d${a.depth}`).join(', ')}  shots: ${scene.shots.length}`);
console.log(`  requiredAssets (zero-gen invariant): ${JSON.stringify(requiredAssets(scene))}`);
