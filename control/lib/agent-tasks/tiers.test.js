import { describe, it, expect } from 'vitest';
import { TIERS, normalizeTier } from './tiers.js';

describe('agent-work tiers', () => {
  it('names four tiers, lightest first', () => {
    expect(TIERS).toEqual(['ride', 'fill', 'judge', 'design']);
  });

  it('normalizes known names and drops everything else', () => {
    expect(normalizeTier('judge')).toBe('judge');
    expect(normalizeTier(' Design ')).toBe('design');
    expect(normalizeTier('opus')).toBeNull();
    expect(normalizeTier('')).toBeNull();
    expect(normalizeTier(undefined)).toBeNull();
    expect(normalizeTier(2)).toBeNull();
  });
});
