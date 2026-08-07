// The face-variant half of the scene completability gate (the pure helper —
// the store-backed check in resolveSceneForge consumes it). Closes the
// silent-fallback hole the Codex talking-phone run rode: a cast face track
// must be BACKED by accepted variant cels, never quietly degrade to the body cel.
process.env.SQLITE_PATH = ':memory:';

import { describe, it, expect } from 'vitest';
import { requiredFaceTargets } from './scene-forge.js';

describe('requiredFaceTargets', () => {
  it('no face track demands nothing', () => {
    expect(requiredFaceTargets(null, 3)).toEqual([]);
    expect(requiredFaceTargets({}, 3)).toEqual([]);
  });

  it('a blink track demands both blink variants per key', () => {
    expect(requiredFaceTargets({ blink: { seed: 1 } }, 2)).toEqual([
      'key-0/face/blink-half', 'key-1/face/blink-half',
      'key-0/face/blink-closed', 'key-1/face/blink-closed',
    ]);
  });

  it('a speech track demands both mouth variants; empty spans demand nothing', () => {
    expect(requiredFaceTargets({ speech: { spans: [{ from: 0, to: 1 }] } }, 1)).toEqual([
      'key-0/face/mouth-mid', 'key-0/face/mouth-open',
    ]);
    expect(requiredFaceTargets({ speech: { spans: [] } }, 1)).toEqual([]);
  });

  it('blink + speech compose (the talking-head demand set)', () => {
    const t = requiredFaceTargets({ blink: { seed: 1 }, speech: { spans: [{ from: 0, to: 1 }] } }, 1);
    expect(t.sort()).toEqual([
      'key-0/face/blink-closed', 'key-0/face/blink-half',
      'key-0/face/mouth-mid', 'key-0/face/mouth-open',
    ]);
  });
});
