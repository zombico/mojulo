process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';

// Skin bindings write real files; point the outcome folder at a scratch dir.
process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-test-skins-'));

import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { getSkinPacketHandler, skinPolygomerHandler } from './sketches.js';
import { renderStoredSketchSvg } from '@/lib/graph/sketch/stored-sketch-svg';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';

// The workbench/assembler leg of the skin seam, end to end: mint → control
// scaffold → "paint" (a hue-shifted rasterization stands in for the image
// worker) → skin_polygomer → the world payload wears the skin.

const LATHE = {
  axisFrom: { x: 0, y: 0, z: 0 },
  axisTo: { x: 0, y: 0, z: 8 },
  profile: [{ t: 0, radius: 2.4 }, { t: 0.6, radius: 3 }, { t: 1, radius: 0.6 }],
  tint: '#8a4a2e',
};

async function paintOver(sketch) {
  // Rasterize the control scaffold and hue-rotate it — a deterministic
  // stand-in for the diffusion painter that keeps silhouette + registration.
  const svg = await renderStoredSketchSvg(sketch, { control: true });
  return sharp(Buffer.from(svg)).modulate({ hue: 150 }).png().toBuffer();
}

describe('workbench/assembler skin seam end-to-end', () => {
  it('a workbench wears a painted skin through packet → bind → world', async () => {
    const sketch = SketchRepository.create({
      ref: 'sk_test_skin_bench',
      title: 'skin bench',
      manifest: { kind: 'workbench', lathes: [LATHE] },
    });

    const packet = await getSkinPacketHandler({ ref: sketch.ref });
    expect(packet.scaffold.url).toContain('control=1');
    expect(packet.then).toContain('model.glb');

    const bound = await skinPolygomerHandler({
      ref: sketch.ref,
      image_base64: (await paintOver(sketch)).toString('base64'),
    });
    expect(bound.ok).toBe(true);
    expect(bound.faces).toBeGreaterThan(0);

    const bare = await resolveWorldScene({ ref: 'sk_other', title: 't', manifest: sketch.manifest });
    const worn = await resolveWorldScene({ ref: sketch.ref, title: 't', manifest: sketch.manifest });
    const fills = (payload) => payload.faces.map((f) => f.fill).join(',');
    expect(worn.payload.faces.length).toBe(bare.payload.faces.length);
    expect(fills(worn.payload)).not.toBe(fills(bare.payload)); // the model wears the skin
  });

  it('an assembler wears a painted skin the same way', async () => {
    const sketch = SketchRepository.create({
      ref: 'sk_test_skin_assembly',
      title: 'skin assembly',
      manifest: {
        kind: 'assembler',
        items: [
          { id: 'base', source: { lathes: [LATHE] }, at: [0, 0, 0] },
          { id: 'cap', source: { lathes: [{ ...LATHE, axisTo: { x: 0, y: 0, z: 3 } }] }, at: [0, 0, 8] },
        ],
      },
    });

    const bound = await skinPolygomerHandler({
      ref: sketch.ref,
      image_base64: (await paintOver(sketch)).toString('base64'),
    });
    expect(bound.ok).toBe(true);

    const bare = await resolveWorldScene({ ref: 'sk_other', title: 't', manifest: sketch.manifest });
    const worn = await resolveWorldScene({ ref: sketch.ref, title: 't', manifest: sketch.manifest });
    expect(worn.payload.faces.map((f) => f.fill).join(','))
      .not.toBe(bare.payload.faces.map((f) => f.fill).join(','));
  });

  it('still refuses unskinnable kinds', async () => {
    SketchRepository.create({ ref: 'sk_test_skin_beats', title: 'b', manifest: { kind: 'beats-ambient' } });
    await expect(getSkinPacketHandler({ ref: 'sk_test_skin_beats' })).rejects.toThrow(/get_skin_packet skins/);
  });
});
