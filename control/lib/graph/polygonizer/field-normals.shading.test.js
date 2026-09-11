/**
 * Smooth shading through the animal pipeline (field-normals.plan.md phase 2).
 * The load-bearing assertion is the FIRST one: with `smooth` off, nothing moves.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { animalWorldFaces } from './figure-render.js';

const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const M = (smooth) => ({ kind: 'animal', archetype: 'canine',
  opts: { skin: 'watertight', coat: { color: '#a8825f' }, fleshCfg: smooth ? { smooth: true } : {} } });

describe('smooth shading is opt-in and additive', () => {
  const flat = animalWorldFaces(M(false)).faces;
  const smooth = animalWorldFaces(M(true)).faces;

  it('smooth OFF carries no cornerFills anywhere', () => {
    expect(flat.some((f) => f.cornerFills)).toBe(false);
  });

  it('smooth ON adds cornerFills to the field-surfaced body', () => {
    const withCF = smooth.filter((f) => f.cornerFills);
    expect(withCF.length).toBeGreaterThan(1000);
    for (const f of withCF) {
      expect(f.cornerFills).toHaveLength(f.corners.length);
      for (const h of f.cornerFills) expect(h).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('the geometry, the flat fill and the normal are all UNCHANGED', () => {
    expect(smooth.length).toBe(flat.length);
    for (let i = 0; i < flat.length; i++) {
      expect(smooth[i].corners).toEqual(flat[i].corners);
      expect(smooth[i].fill).toBe(flat[i].fill);           // the flat fallback survives intact
      expect(smooth[i].outNormal).toEqual(flat[i].outNormal);
    }
  });

  it('stripping cornerFills recovers the flat payload byte for byte', () => {
    const stripped = smooth.map(({ cornerFills, ...rest }) => rest);
    expect(sha(stripped)).toBe(sha(flat));
  });

  it('a corner fill differs from the flat fill on a curved face — else it did nothing', () => {
    const differing = smooth.filter((f) => f.cornerFills && f.cornerFills.some((h) => h !== f.fill));
    expect(differing.length).toBeGreaterThan(smooth.filter((f) => f.cornerFills).length * 0.5);
  });
});
