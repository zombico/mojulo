import { describe, it, expect } from 'vitest';

import { resolveDisplayModes, pickMode, DISPLAY_MODES } from '@/lib/graph/sketch/display-modes';

const byKey = (resolved) => Object.fromEntries(resolved.modes.map((m) => [m.key, m]));

describe('resolveDisplayModes', () => {
  it('gives a walkable world wire + shaded, and points wire at the ?wire=1 the route already takes', () => {
    const r = resolveDisplayModes({ manifest: { kind: 'fractal-city' }, ref: 'sk_a' });
    const m = byKey(r);
    expect(m.wire.available).toBe(true);
    expect(m.wire.view).toEqual({ kind: 'iframe', src: '/api/sketches/sk_a/world?wire=1' });
    expect(m.shaded.view).toEqual({ kind: 'iframe', src: '/api/sketches/sk_a/world' });
    expect(r.defaultMode).toBe('shaded');
  });

  it('offers a diagram its CreationMap wireframe reading', () => {
    const m = byKey(resolveDisplayModes({ manifest: { title: 'x' }, ref: 'sk_b' }));
    expect(m.wire.view).toEqual({ kind: 'diagram', wireframe: true });
    expect(m.shaded.view).toEqual({ kind: 'diagram', wireframe: false });
  });

  it('reports no wireframe for /scene and /svg kinds rather than inventing one', () => {
    for (const kind of ['css3d-turntable', 'painted-landscape']) {
      const m = byKey(resolveDisplayModes({ manifest: { kind }, ref: 'sk_c' }));
      expect(m.wire.available).toBe(false);
      expect(m.wire.reason).toBe('noWireframe');
    }
  });

  it('disables baked with a reason when nothing has been baked', () => {
    const m = byKey(resolveDisplayModes({ manifest: { kind: 'fractal-city' }, ref: 'sk_d' }));
    expect(m.baked.available).toBe(false);
    expect(m.baked.reason).toBe('noBake');
    expect(m.baked.view).toBeNull();
  });

  it('points baked at the `<ref>_gi` variant the generated-mesh adapter mints', () => {
    const m = byKey(resolveDisplayModes({
      manifest: { kind: 'fractal-city' }, ref: 'sk_e', giVariantRef: 'sk_e_gi',
    }));
    expect(m.baked.available).toBe(true);
    expect(m.baked.view).toEqual({ kind: 'iframe', src: '/api/sketches/sk_e_gi/world' });
    expect(m.shaded.available).toBe(true);
  });

  it('for an inline-faces bake, makes baked the default and says shaded is gone', () => {
    // The inline-faces adapter recolours the world's OWN faces, so there is no
    // unlit reading left to switch back to. Claiming otherwise would be a lie.
    const r = resolveDisplayModes({
      manifest: { kind: 'fractal-city', giBake: { adapter: 'inline-faces' } }, ref: 'sk_f',
    });
    const m = byKey(r);
    expect(r.defaultMode).toBe('baked');
    expect(m.baked.available).toBe(true);
    expect(m.baked.view).toEqual({ kind: 'iframe', src: '/api/sketches/sk_f/world' });
    expect(m.shaded.available).toBe(false);
    expect(m.shaded.reason).toBe('bakedInPlace');
  });

  it('offers painted only to painted kinds that actually have a render bound', () => {
    const none = byKey(resolveDisplayModes({ manifest: { kind: 'image-outcome' }, ref: 'sk_g' }));
    expect(none.painted.available).toBe(false);
    expect(none.painted.reason).toBe('noPaintedRender');

    const bound = byKey(resolveDisplayModes({
      manifest: { kind: 'image-outcome' }, ref: 'sk_g', hasBoundRender: true,
    }));
    expect(bound.painted.available).toBe(true);
    expect(bound.painted.view).toEqual({ kind: 'img', src: '/api/sketches/sk_g/final.png' });

    const world = byKey(resolveDisplayModes({
      manifest: { kind: 'fractal-city' }, ref: 'sk_h', hasBoundRender: true,
    }));
    expect(world.painted.available).toBe(false);
    expect(world.painted.reason).toBe('notPaintable');
  });

  it('always marks painted as external, so the provenance badge can never be dropped', () => {
    const m = byKey(resolveDisplayModes({
      manifest: { kind: 'sequential-art' }, ref: 'sk_i', hasBoundRender: true,
    }));
    expect(m.painted.external).toBe(true);
  });

  it('returns every mode, in order, so the control never reflows between artifacts', () => {
    const r = resolveDisplayModes({ manifest: { kind: 'fractal-city' }, ref: 'sk_j' });
    expect(r.modes.map((m) => m.key)).toEqual(DISPLAY_MODES);
  });

  it('carries no control for heard, spoken, played, or clicked-through kinds', () => {
    for (const kind of ['beats-ambient', 'voice-register', 'game', 'motion-comic']) {
      expect(resolveDisplayModes({ manifest: { kind }, ref: 'sk_k' })).toBeNull();
    }
    expect(resolveDisplayModes({ manifest: null, ref: 'sk_k' })).toBeNull();
  });

  it('answers the same from a list summary\'s facts as from the manifest', () => {
    // The gallery's rows carry renderMode / kind / giAdapter instead of the
    // recipe (sketch-summary.js); the detail page still has the recipe.
    const fromManifest = resolveDisplayModes({
      manifest: { kind: 'fractal-city', giBake: { adapter: 'inline-faces' } }, ref: 'sk_m',
    });
    const fromFacts = resolveDisplayModes({
      renderMode: 'world', kind: 'fractal-city', giAdapter: 'inline-faces', ref: 'sk_m',
    });
    expect(fromFacts).toEqual(fromManifest);
    expect(resolveDisplayModes({ renderMode: 'beats', kind: 'beats-sfx', giAdapter: null, ref: 'sk_n' })).toBeNull();
    expect(resolveDisplayModes({ renderMode: null, kind: null, giAdapter: null, ref: 'sk_o' })).toBeNull();
    const painted = byKey(resolveDisplayModes({
      renderMode: 'svg', kind: 'image-outcome', giAdapter: null, ref: 'sk_p', hasBoundRender: true,
    }));
    expect(painted.painted.available).toBe(true);
  });
});

describe('pickMode', () => {
  const resolved = resolveDisplayModes({ manifest: { kind: 'fractal-city' }, ref: 'sk_l' });

  it('honours an available request', () => {
    expect(pickMode(resolved, 'wire').key).toBe('wire');
  });

  it('falls back to the default when the wanted mode is unavailable or unknown', () => {
    expect(pickMode(resolved, 'baked').key).toBe('shaded');
    expect(pickMode(resolved, 'nonsense').key).toBe('shaded');
  });

  it('is null-safe for kinds with no control', () => {
    expect(pickMode(null, 'wire')).toBeNull();
  });
});
