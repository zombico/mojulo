// forge_motion { cel_set } — the A3 stitch (mcp-promotion.plan.md): a finished
// keyframe-animation clip's ACCEPTED cels become the mo_ GIF, driven cold
// through the same tool handlers a worker uses. Completability-gated: forging
// before every cel is accepted is refused with the handoff pointer.
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, existsSync } from 'node:fs';

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'celset-outcomes-'));

import { describe, it, expect, beforeEach } from 'vitest';
import sharp from 'sharp';
import { getDb } from '@/lib/db/index';
import { createSketchHandler } from '@/lib/mcp/tools/sketches';
import {
  requestImageRenderHandler,
  pullImageRenderHandler,
  submitImageRenderHandler,
  acceptImageRenderHandler,
} from '@/lib/mcp/tools/render-handoff.js';
import { forgeMotionHandler } from '@/lib/mcp/tools/motion';

const KEYS = 2;

async function mintClip() {
  const res = await createSketchHandler({
    title: 'Celset wave',
    manifest: {
      kind: 'keyframe-animation', title: 'Celset wave', motion: 'wave',
      keys: KEYS, fps: 12, onTwos: 2, cycles: 2,
      characters: [{ id: 'n', description: 'stitch test figure' }],
    },
  });
  return res.ref;
}

// A painted-looking cel: solid figure block on a flat bg (survives the meru
// audit's PNG decode; audit numbers are recorded, not blocking at submit).
const celPng = () => sharp({
  create: { width: 64, height: 96, channels: 4, background: { r: 40, g: 60, b: 90, alpha: 1 } },
}).png().toBuffer();

async function driveCelThroughHandoff(ref, target) {
  await requestImageRenderHandler({ ref, target });
  const pulled = await pullImageRenderHandler({ ref, target });
  await submitImageRenderHandler({
    request_id: pulled.request_id,
    image_base64: (await celPng()).toString('base64'),
    source: 'codex-image-worker',
    worker_audit: { invoked_generator: true, conditioned: 'scaffold' },
  });
  await acceptImageRenderHandler({
    request_id: pulled.request_id,
    accept_audit: { register: 'painted register, identity holds' },
    source: 'claude-code',
  });
}

describe('forge_motion { cel_set } — the clip stitch', () => {
  beforeEach(() => {
    getDb().exec('DELETE FROM image_render_requests; DELETE FROM sketches;');
  });

  it('refuses to stitch before every cel is accepted, pointing at the handoff', async () => {
    const ref = await mintClip();
    await expect(forgeMotionHandler({ title: 'too early', subject: { cel_set: { ref } }, shot: {} }))
      .rejects.toThrow(/unaccepted cel target.*request_image_render/s);
  });

  it('refuses non-re-time overrides (pose is baked into the paint)', async () => {
    const ref = await mintClip();
    await expect(forgeMotionHandler({ title: 'bad knob', subject: { cel_set: { ref, keys: 9 } }, shot: {} }))
      .rejects.toThrow(/re-time overrides accept only/);
  });

  it('stitches accepted cels into a mo_ GIF (keys × onTwos × cycles frames, no svg)', async () => {
    const ref = await mintClip();
    for (let i = 0; i < KEYS; i += 1) await driveCelThroughHandoff(ref, `key-${i}`);

    const forged = await forgeMotionHandler({
      title: 'Celset wave', subject: { cel_set: { ref } }, shot: {}, export: 'gif',
    });
    expect(forged.ok).toBe(true);
    expect(forged.motion_ref).toMatch(/^mo_/);
    expect(forged.frames).toBe(KEYS * 2 * 2);
    expect(forged.svg_path).toBeNull(); // raster-native, like world/scene
    expect(forged.gif_path).toMatch(/motion\.gif$/);
    const gifFile = path.join(process.env.MOJULO_OUTCOMES_DIR, forged.motion_ref, 'motion.gif');
    expect(existsSync(gifFile)).toBe(true);
  });

  it('re-times over the SAME accepted cels — zero new generations', async () => {
    const ref = await mintClip();
    for (let i = 0; i < KEYS; i += 1) await driveCelThroughHandoff(ref, `key-${i}`);

    const retimed = await forgeMotionHandler({
      title: 'Celset wave x3', subject: { cel_set: { ref, cycles: 3 } }, shot: {}, export: 'gif',
    });
    expect(retimed.frames).toBe(KEYS * 2 * 3);
  });
});
