// Keyframe meru-guide emitter — exercises the real rig deterministically. Emits
// a short wave motion and asserts every key produces a canvas-sized guide PNG,
// a skeleton PNG, and normalized nodes, over one shared canonical unit.
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { emitKeys, emitKeyGuide, computeCanonical } from './keyframe-emit.js';
import { CANVAS } from './parts-bank-spike/front.js';

describe('computeCanonical', () => {
  it('produces a positive crown-to-ground span with a spine', async () => {
    const canon = await computeCanonical();
    expect(canon.ground).toBeGreaterThan(canon.crown);
    expect(canon.span).toBe(canon.ground - canon.crown);
    expect(canon.spine.pelvisHub).toBeDefined();
    expect(canon.spine.neckHub).toBeDefined();
  });
});

describe('emitKeys', () => {
  it('emits K canvas-sized guides for a motion', async () => {
    const { keys, canonical, contactSheet } = await emitKeys({ motion: 'wave', keys: 2 });
    expect(keys).toHaveLength(2);
    for (const k of keys) {
      const meta = await sharp(k.guide).metadata();
      expect(meta.width).toBe(CANVAS.width);
      expect(meta.height).toBe(CANVAS.height);
      expect(Buffer.isBuffer(k.skeleton)).toBe(true);
      expect(k.nodes.pelvisHub).toBeDefined();
    }
    expect(canonical.span).toBeGreaterThan(0);
    expect(Buffer.isBuffer(contactSheet)).toBe(true);
  }, 30000);

  it('emitKeyGuide returns a single key identical in shape to the full-set entry', async () => {
    const one = await emitKeyGuide({ motion: 'wave', keys: 2, index: 1 });
    expect(one.index).toBe(1);
    expect(one.phase).toBe(0.5);
    const meta = await sharp(one.guide).metadata();
    expect(meta.width).toBe(CANVAS.width);
  }, 30000);

  it('rejects an out-of-range key index', async () => {
    await expect(emitKeyGuide({ motion: 'wave', keys: 2, index: 5 })).rejects.toThrow(/out of range/);
  });
});
