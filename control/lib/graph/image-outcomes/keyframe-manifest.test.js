// keyframe-animation manifest kind — normalization + the render-target
// expansion (body cels first, then per-key face-variant cels for active
// channels). The kind rides the image-outcomes render-handoff seam, so the
// only contract that matters downstream is renderTargets + isImageOutcomesKind.
import { describe, it, expect } from 'vitest';
import {
  normalizeImageOutcomesManifest,
  renderTargets,
  isImageOutcomesKind,
  KIND_KEYFRAME_ANIMATION,
} from './manifest.js';
import { buildCharacterSheetInstructions } from './instructions.js';
import { resolveBlinkTrack } from './pan-cel-spike/sub-cels.js';

const base = {
  kind: KIND_KEYFRAME_ANIMATION,
  title: 'Nera wave',
  motion: 'wave',
  keys: 6,
  characters: [{ id: 'nera', description: 'signal runner, teal jacket, short black hair' }],
};

describe('keyframe-animation normalization', () => {
  it('is an image-outcomes kind', () => {
    expect(isImageOutcomesKind(KIND_KEYFRAME_ANIMATION)).toBe(true);
  });

  it('pins defaults (fps/onTwos/cycles/canvas) and the contract version', () => {
    const m = normalizeImageOutcomesManifest(base);
    expect(m.contractVersion).toBe('keyframe-animation/v1');
    expect(m.fps).toBe(12);
    expect(m.onTwos).toBe(2);
    expect(m.cycles).toBe(3);
    expect(m.canvas).toEqual({ width: 832, height: 1216 });
    expect(m.motionLabel).toBe('wave');
  });

  it('requires a character (identity lock)', () => {
    expect(() => normalizeImageOutcomesManifest({ ...base, characters: [] }))
      .toThrow(/at least one character/);
  });

  it('rejects a non-integer keys', () => {
    expect(() => normalizeImageOutcomesManifest({ ...base, keys: 2.5 })).toThrow(/keys must be an integer/);
  });

  it('accepts a keyframe spec object as motion with an explicit label', () => {
    const m = normalizeImageOutcomesManifest({
      ...base, motion: { keyframes: [{}, {}], loop: true }, motionLabel: 'airfist',
    });
    expect(m.motionLabel).toBe('airfist');
    expect(m.motion.keyframes).toHaveLength(2);
  });

  it('accepts known motion names (walk/wave/stretch/emote)', () => {
    for (const name of ['walk', 'wave', 'stretch', 'point', 'think']) {
      expect(() => normalizeImageOutcomesManifest({ ...base, motion: name })).not.toThrow();
    }
  });

  it('rejects an unknown motion NAME up front with the valid set (D2)', () => {
    expect(() => normalizeImageOutcomesManifest({ ...base, motion: 'custom' }))
      .toThrow(/is not a known motion.*keyframes/s);
  });

  it('rejects top-level poses / keyframes with a pointer to motion (D3)', () => {
    expect(() => normalizeImageOutcomesManifest({ ...base, poses: [{}, {}] }))
      .toThrow(/authored key poses go in motion/);
    expect(() => normalizeImageOutcomesManifest({ ...base, motion: 'wave', keyframes: [{}] }))
      .toThrow(/authored key poses go in motion/);
  });

  it('validates speech spans as ordered pairs', () => {
    expect(() => normalizeImageOutcomesManifest({ ...base, speech: { spans: [[2, 1]] } }))
      .toThrow(/start < end/);
    const ok = normalizeImageOutcomesManifest({ ...base, speech: { spans: [[0.5, 1.5]] } });
    expect(ok.speech.flapsPerSec).toBe(8);
  });
});

describe('keyframe-animation renderTargets', () => {
  it('body-only manifest expands to one cel per key', () => {
    expect(renderTargets(base)).toEqual(['key-0', 'key-1', 'key-2', 'key-3', 'key-4', 'key-5']);
  });

  it('adds blink variant cels per key after the body cels', () => {
    const t = renderTargets({ ...base, keys: 2, blink: { seed: 7 } });
    expect(t).toEqual([
      'key-0', 'key-1',
      'key-0/face/blink-half', 'key-0/face/blink-closed',
      'key-1/face/blink-half', 'key-1/face/blink-closed',
    ]);
  });

  it('adds speech (mouth) variant cels when a speech track is present', () => {
    const t = renderTargets({ ...base, keys: 1, speech: { spans: [[0, 1]] } });
    expect(t).toEqual(['key-0', 'key-0/face/mouth-mid', 'key-0/face/mouth-open']);
  });

  it('body cels always precede face cels (composable before variants exist)', () => {
    const t = renderTargets({ ...base, keys: 2, blink: { seed: 1 }, speech: { spans: [[0, 1]] } });
    expect(t.slice(0, 2)).toEqual(['key-0', 'key-1']);
    expect(t.filter((x) => x.includes('/face/'))).toHaveLength(2 * (2 + 2)); // 2 keys × (2 blink + 2 mouth)
  });
});

describe('inline-character identity brief (the pull-path fix)', () => {
  it('buildCharacterSheetInstructions accepts a keyframe-animation manifest with an INLINE character', () => {
    // Regression pin (mcp-promotion.plan.md "Known bug"): pull_image_render on a
    // keyframe clip with inline characters threw here — the packet's
    // characterSheets block must be buildable for every keyframe manifest.
    const text = buildCharacterSheetInstructions(base, 'nera');
    expect(text).toContain('Character reference sheet');
    expect(text).toContain('signal runner, teal jacket');
    expect(text).toContain('flat cel animation style'); // the keyframe fallback brief
  });
});

describe('blink forcedFrames (the directorial override)', () => {
  it('normalizes forcedFrames on the blink track and rejects non-integers', () => {
    const m = normalizeImageOutcomesManifest({ ...base, blink: { seed: 3, forcedFrames: [31] } });
    expect(m.blink).toEqual({ seed: 3, meanGapSec: 2.2, forcedFrames: [31] });
    expect(() => normalizeImageOutcomesManifest({ ...base, blink: { forcedFrames: [1.5] } }))
      .toThrow(/forcedFrames/);
  });

  it('resolveBlinkTrack guarantees the CLOSED phase on each forced frame, beside the seeded schedule', () => {
    const opts = { fps: 12, frames: 48 };
    const seeded = resolveBlinkTrack({ seed: 5, meanGapSec: 10 }, opts);
    const forced = resolveBlinkTrack({ seed: 5, meanGapSec: 10, forcedFrames: [31] }, opts);
    expect(seeded[31]).toBe('open'); // the seed alone does not blink here
    expect(forced[31]).toBe('closed'); // the override does
    // seeded blinks are untouched (a forced blink is an addition, not a re-roll)
    for (let f = 0; f < 28; f += 1) expect(forced[f]).toBe(seeded[f]);
  });
});
