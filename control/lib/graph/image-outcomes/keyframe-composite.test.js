// The clip compositor (mcp-promotion A3), pure half: frame selection over a
// normalized keyframe-animation manifest, and cel loading/caching.
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';

import { clipFrameSelections, compositeCels } from './keyframe-composite.js';
import { normalizeImageOutcomesManifest } from './manifest.js';

const baseManifest = (extra = {}) => normalizeImageOutcomesManifest({
  kind: 'keyframe-animation',
  title: 'test clip',
  motion: 'wave',
  keys: 3,
  fps: 12,
  onTwos: 2,
  cycles: 2,
  characters: [{ id: 'n', description: 'test figure' }],
  ...extra,
});

describe('clipFrameSelections', () => {
  it('frame count = keys × onTwos × cycles; no channels → every frame is the body cel', () => {
    const frames = clipFrameSelections(baseManifest());
    expect(frames).toHaveLength(3 * 2 * 2);
    expect(frames.every((f) => f.celFile === 'cel.png')).toBe(true);
    // on twos: consecutive frame pairs share a key, keys cycle in order
    expect(frames.slice(0, 6).map((f) => f.key)).toEqual(['key-0', 'key-0', 'key-1', 'key-1', 'key-2', 'key-2']);
  });

  it('a blink channel selects variant cels, and forcedFrames pins the closed phase', () => {
    const frames = clipFrameSelections(baseManifest({
      cycles: 4,
      blink: { seed: 1, meanGapSec: 0.5, forcedFrames: [4] },
    }));
    expect(frames[4].celFile).toBe('face/blink-closed.png');
    expect(frames.some((f) => f.celFile !== 'cel.png')).toBe(true);
  });

  it('is deterministic: same manifest → same selections', () => {
    const m = baseManifest({ blink: { seed: 7, meanGapSec: 1 } });
    expect(clipFrameSelections(m)).toEqual(clipFrameSelections(m));
  });
});

describe('compositeCels', () => {
  const solidPng = (rgb) => sharp({
    create: { width: 8, height: 12, channels: 4, background: { r: rgb[0], g: rgb[1], b: rgb[2], alpha: 1 } },
  }).png().toBuffer();

  it('loads each distinct cel once and emits one frame buffer per selection', async () => {
    const calls = [];
    const cel = async (keyDir, celFile) => {
      calls.push(`${keyDir}/${celFile}`);
      return solidPng([10, 20, 30]);
    };
    const selections = clipFrameSelections(baseManifest());
    const framePngs = await compositeCels({ selections, cel });
    expect(framePngs).toHaveLength(selections.length);
    expect(new Set(calls).size).toBe(calls.length); // no duplicate loads
    expect(calls).toHaveLength(3); // one per key
  });

  it('downscales frames to the requested size', async () => {
    const selections = clipFrameSelections(baseManifest({ keys: 1, cycles: 1 }));
    const framePngs = await compositeCels({
      selections,
      cel: async () => solidPng([200, 0, 0]),
      downscale: { width: 4, height: 6 },
    });
    const meta = await sharp(framePngs[0]).metadata();
    expect([meta.width, meta.height]).toEqual([4, 6]);
  });

  it('throws when a selected cel has no stored render', async () => {
    const selections = clipFrameSelections(baseManifest({ keys: 1, cycles: 1 }));
    await expect(compositeCels({ selections, cel: async () => null }))
      .rejects.toThrow(/no stored render/);
  });
});
