/**
 * skinDirection — a game's art direction (its palette and its shading) read into a character's skin and light: a dermis
 * the map takes, deeper in a low key than a high one, banded by the shading, none where the engine shades for itself.
 */
import { describe, it, expect } from 'vitest';
import { solvePalette } from './solve.js';
import { skinDirection, SKIN_SHADINGS } from './adapters.js';
import { readDermis } from '../epidermis/dermal-map.js';

describe('the skin in a game\'s art direction', () => {
  const low = solvePalette({ seed: 7, key: 'low', weight: 0.6 }), high = solvePalette({ seed: 7, key: 'high', weight: -0.4 });
  it('paints a shade the dermis reads, deeper in a low key, banded by the shading, absent for none', () => {
    for (const s of Object.keys(SKIN_SHADINGS)) {
      const A = skinDirection(low, s);
      expect(() => readDermis({ from: 'male', ...(A.shade ? { shade: A.shade } : {}) })).not.toThrow();
      expect(A.shade?.steps ?? null).toBe(SKIN_SHADINGS[s]?.steps ?? null);
      for (const k of ['key', 'fill', 'rim']) expect(A.light[k]).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(skinDirection(low).shade.amount).toBeGreaterThan(skinDirection(high).shade.amount);
    expect(skinDirection(low).light.exposure).toBeLessThan(skinDirection(high).light.exposure);
    expect(skinDirection(low, 'none').shade).toBeUndefined();
    expect(() => skinDirection(low, 'oil')).toThrow(/shading/);
  });
  it('is the same every time for the same palette', () => {
    expect(skinDirection(solvePalette({ seed: 7, key: 'low', weight: 0.6 }), 'cel')).toEqual(skinDirection(low, 'cel'));
  });
});
