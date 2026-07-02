import { describe, expect, it } from 'vitest';

import { validateSketchManifest, SIGNAGE_VARIANTS, SIGNAGE_SLOTS } from './sketch-manifest.js';

// A minimal one-mark manifest; `signage` is dropped in so each case exercises
// only the signage branch. Signage is an overlay — it does NOT by itself satisfy
// the "at least one drawable" rule, so a base mark is always present.
const withSignage = (signage) => ({
  title: 'signed',
  viewBox: { width: 400, height: 200 },
  marks: [{ kind: 'rect', x: 10, y: 10, w: 80, h: 40 }],
  signage,
});

describe('manifest.signage validation', () => {
  it('accepts a manifest with no signage (back-compat)', () => {
    const { signage, ...m } = withSignage([]);
    expect(validateSketchManifest(m).ok).toBe(true);
  });

  it('accepts each variant with each anchor form', () => {
    expect(validateSketchManifest(withSignage([
      { variant: 'tooltip', text: 'hi', anchor: { object: 'tower-3' } },
      { variant: 'toast', text: '+100', anchor: { slot: 'top' }, after: 0.5, ttl: 2 },
      { variant: 'popup', body: ['p1', 'p2'], anchor: { world: [1, 2, 3] } },
      { variant: 'tooltip', text: 'hi', anchor: { xy: [10, 20] } },
    ])).ok).toBe(true);
  });

  it('accepts every documented variant and slot', () => {
    for (const variant of SIGNAGE_VARIANTS) {
      expect(validateSketchManifest(withSignage([{ variant, text: 't', anchor: { slot: 'top' } }])).ok).toBe(true);
    }
    for (const slot of SIGNAGE_SLOTS) {
      expect(validateSketchManifest(withSignage([{ variant: 'toast', text: 't', anchor: { slot } }])).ok).toBe(true);
    }
  });

  it('rejects a bad variant', () => {
    const r = validateSketchManifest(withSignage([{ variant: 'banner', text: 't', anchor: { slot: 'top' } }]));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('variant'))).toBe(true);
  });

  it('requires text unless a popup carries body', () => {
    expect(validateSketchManifest(withSignage([{ variant: 'tooltip', anchor: { slot: 'top' } }])).ok).toBe(false);
    expect(validateSketchManifest(withSignage([{ variant: 'popup', body: 'long text', anchor: { slot: 'top' } }])).ok).toBe(true);
  });

  it('rejects an anchor that declares more than one form', () => {
    const r = validateSketchManifest(withSignage([{ variant: 'tooltip', text: 't', anchor: { slot: 'top', xy: [1, 2] } }]));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('exactly one'))).toBe(true);
  });

  it('rejects an anchor with no form', () => {
    expect(validateSketchManifest(withSignage([{ variant: 'tooltip', text: 't', anchor: {} }])).ok).toBe(false);
  });

  it('rejects a bad slot and a malformed world triple', () => {
    expect(validateSketchManifest(withSignage([{ variant: 'toast', text: 't', anchor: { slot: 'middle' } }])).ok).toBe(false);
    expect(validateSketchManifest(withSignage([{ variant: 'tooltip', text: 't', anchor: { world: [1, 2] } }])).ok).toBe(false);
  });

  it('rejects negative timing', () => {
    expect(validateSketchManifest(withSignage([{ variant: 'toast', text: 't', anchor: { slot: 'top' }, ttl: -1 }])).ok).toBe(false);
  });

  it('rejects a non-array signage', () => {
    expect(validateSketchManifest(withSignage({ variant: 'toast' })).ok).toBe(false);
  });

  it('does NOT let signage alone satisfy the drawable requirement', () => {
    const r = validateSketchManifest({
      title: 'only signs',
      viewBox: { width: 400, height: 200 },
      signage: [{ variant: 'toast', text: 'x', anchor: { slot: 'top' } }],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('drawable'))).toBe(true);
  });
});
