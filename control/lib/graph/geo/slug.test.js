import { describe, expect, it } from 'vitest';
import { slugifyQuery } from './slug.js';

describe('slugifyQuery', () => {
  it('lowercases and trims', () => {
    expect(slugifyQuery('Sweden')).toBe('sweden');
    expect(slugifyQuery('  Sweden  ')).toBe('sweden');
  });

  it('collapses non-alphanumeric runs', () => {
    expect(slugifyQuery('St. Lucia')).toBe('st-lucia');
    expect(slugifyQuery('São Paulo')).toBe('sao-paulo');
  });

  it('strips diacritics', () => {
    expect(slugifyQuery('Zürich')).toBe('zurich');
    expect(slugifyQuery('Côte d’Ivoire')).toBe('cote-d-ivoire');
  });

  it('is deterministic across casings and spacings', () => {
    expect(slugifyQuery('Söder Stockholm')).toBe(slugifyQuery('söder stockholm'));
    expect(slugifyQuery('united states')).toBe(slugifyQuery('United States'));
  });

  it('throws on empty / unsluggable input', () => {
    expect(() => slugifyQuery('')).toThrow();
    expect(() => slugifyQuery('---')).toThrow();
    expect(() => slugifyQuery(null)).toThrow();
  });
});
