// sprite-sheet tools driven COLD through the real handoff loop: mint a sheet →
// request → (pull → submit → accept) per frame → bake. Asserts the bake gates on
// accepted-only frames and writes a sovereign pixelizer sprite payload back onto
// the manifest. Uses real (sharp-generated) PNGs so the quantize path runs for
// real.
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'sprite-outcomes-'));

import { describe, it, expect, beforeEach } from 'vitest';
import sharp from 'sharp';
import { getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createSpriteSheetHandler, bakeSpriteSheetHandler } from './sprite-sheet.js';
import {
  requestImageRenderHandler,
  pullImageRenderHandler,
  submitImageRenderHandler,
  acceptImageRenderHandler,
} from './render-handoff.js';

// A distinct solid-color sprite per frame id (so joint palette spans 3 colors).
const COLORS = {
  idle: { r: 200, g: 40, b: 40, alpha: 1 },
  'walk-1': { r: 40, g: 200, b: 40, alpha: 1 },
  'walk-2': { r: 40, g: 40, b: 200, alpha: 1 },
};
async function spritePngB64(frameId) {
  const buf = await sharp({ create: { width: 8, height: 8, channels: 4, background: COLORS[frameId] } }).png().toBuffer();
  return buf.toString('base64');
}

const sheetInput = {
  title: 'Hero walk',
  frames: [{ action: 'idle' }, { action: 'walk-1' }, { action: 'walk-2' }],
  cell: { width: 8, height: 8 },
  bake: { grid: [4, 4] },
  register: '16bit',
  characters: [{ id: 'hero', description: 'red-caped knight' }],
};

// Park → pull each frame, submit its color, accept it.
async function paintAndAccept(ref, { skip = [] } = {}) {
  await requestImageRenderHandler({ ref });
  let pulled = await pullImageRenderHandler({ ref });
  while (pulled && pulled.request_id) {
    const frameId = pulled.target.replace(/^frame-/, '');
    if (!skip.includes(frameId)) {
      await submitImageRenderHandler({
        request_id: pulled.request_id,
        image_base64: await spritePngB64(frameId),
        worker_audit: { conditioned: 'scaffold', invoked_generator: true },
      });
      await acceptImageRenderHandler({ request_id: pulled.request_id, accept_audit: { on_model: true } });
    }
    pulled = await pullImageRenderHandler({ ref });
  }
}

describe('create_sprite_sheet + bake_sprite_sheet', () => {
  beforeEach(() => {
    getDb().exec('DELETE FROM image_render_requests; DELETE FROM sketches;');
  });

  it('mints a sprite-sheet sketch with per-frame targets and a next-step hint', async () => {
    const res = await createSpriteSheetHandler(sheetInput);
    expect(res.ok).toBe(true);
    expect(res.kind).toBe('sprite-sheet');
    expect(res.frames).toEqual(['idle', 'walk-1', 'walk-2']);
    expect(res.targets[0]).toBe('frame-idle'); // base first
    expect(res.next).toMatch(/request_image_render/);
    expect(res.next).toMatch(/bake_sprite_sheet/);
    const row = SketchRepository.getByRef(res.ref);
    expect(row.manifest.kind).toBe('sprite-sheet');
  });

  it('refuses to bake before every frame is accepted', async () => {
    const { ref } = await createSpriteSheetHandler(sheetInput);
    await paintAndAccept(ref, { skip: ['walk-2'] }); // leave one unaccepted
    await expect(bakeSpriteSheetHandler({ ref })).rejects.toThrow(/not yet accepted/);
    await expect(bakeSpriteSheetHandler({ ref })).rejects.toThrow(/frame-walk-2/);
  });

  it('bakes accepted frames into a sovereign pixelizer sprite payload', async () => {
    const { ref } = await createSpriteSheetHandler(sheetInput);
    await paintAndAccept(ref);
    const baked = await bakeSpriteSheetHandler({ ref });

    expect(baked.ok).toBe(true);
    expect(baked.base).toBe('idle');
    expect(baked.frames).toEqual(['idle', 'walk-1', 'walk-2']);
    // joint palette spans the three distinct colors
    expect(baked.paletteSize).toBe(3);
    // alignment health recorded for every non-base frame
    expect(Object.keys(baked.changedRatios).sort()).toEqual(['walk-1', 'walk-2']);

    // The payload is written back onto the manifest, re-derivable and inspectable.
    const m = SketchRepository.getByRef(ref).manifest;
    expect(m.baked.base).toBe('idle');
    expect(Object.keys(m.baked.sprites).sort()).toEqual(['idle', 'walk-1', 'walk-2']);
    // Each sprite is a validateRaster-shaped {size,palette,cells} at the bake grid.
    const idle = m.baked.sprites.idle;
    expect(idle.size).toEqual([4, 4]);
    expect(idle.cells).toHaveLength(4);
    expect(idle.cells[0]).toHaveLength(4);
    // provenance links each sprite back to its accepted render slot
    expect(m.baked.provenance.idle.target).toBe('frame-idle');
    expect(m.baked.provenance.idle.n).toBeGreaterThanOrEqual(1);
  });

  it('rejects baking a non-sprite-sheet sketch', async () => {
    const row = SketchRepository.create({ title: 'x', manifest: { kind: 'image-outcome' } });
    await expect(bakeSpriteSheetHandler({ ref: row.ref })).rejects.toThrow(/not a sprite-sheet/);
  });
});
