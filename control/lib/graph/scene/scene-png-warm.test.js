import { describe, it, expect } from 'vitest';
import { withoutWarm, warmHeld } from './scene-png-warm.js';

// a run compiles (design_game): the rows it makes are not baked for the gallery as they land; the hold ends with it
describe('the gallery warm held through a compile', () => {
  it('holds while the compile runs, nested or not, and lets go after, even when it throws', async () => {
    expect(warmHeld()).toBe(false);
    await withoutWarm(async () => { expect(warmHeld()).toBe(true); await withoutWarm(async () => expect(warmHeld()).toBe(true)); expect(warmHeld()).toBe(true); });
    expect(warmHeld()).toBe(false);
    await expect(withoutWarm(async () => { throw new Error('a step failed'); })).rejects.toThrow(/a step failed/);
    expect(warmHeld()).toBe(false);
  });
});
