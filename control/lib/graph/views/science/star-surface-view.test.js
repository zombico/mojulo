import { describe, expect, it } from 'vitest';

import { planStarSurfaceScene, assembleStarSurfaceScene, STAR_SURFACE_SCENARIOS } from './star-surface-view.js';

describe('planStarSurfaceScene — determinism & payload', () => {
  it('is deterministic — same recipe yields byte-identical output (seeded spots)', () => {
    expect(JSON.stringify(planStarSurfaceScene({ scenario: 'sun' }))).toBe(JSON.stringify(planStarSurfaceScene({ scenario: 'sun' })));
  });

  it('falls back to sun on an unknown scenario', () => {
    expect(planStarSurfaceScene({ scenario: 'quasar' }).stats.scenario).toBe('sun');
  });

  it('exposes the four star types', () => {
    expect(STAR_SURFACE_SCENARIOS).toEqual(['sun', 'red-dwarf', 'blue-giant', 'spotted']);
  });

  it('emits one star-surface spec with a temperature + granulation + limb + spots', () => {
    const st = planStarSurfaceScene({ scenario: 'sun' }).starSurfaces[0];
    expect(st.radius).toBeGreaterThan(0);
    expect(st.Tbase).toBe(5772);
    expect(st.granFreq).toBeGreaterThan(0);
    expect(st.limb).toHaveLength(3);
    expect(Array.isArray(st.spots)).toBe(true);
  });
});

describe('the physics — temperature drives the star', () => {
  it('star class sets a physically ordered surface temperature (M < G < O)', () => {
    const T = (s) => planStarSurfaceScene({ scenario: s }).stats.Tbase;
    expect(T('red-dwarf')).toBeLessThan(T('sun'));
    expect(T('sun')).toBeLessThan(T('blue-giant'));
  });

  it('the hot blue giant is spotless; cool active stars are heavily spotted', () => {
    expect(planStarSurfaceScene({ scenario: 'blue-giant' }).stats.spots).toBe(0);
    expect(planStarSurfaceScene({ scenario: 'spotted' }).stats.spots).toBeGreaterThan(planStarSurfaceScene({ scenario: 'sun' }).stats.spots);
  });

  it('sun spots land in the active latitude bands (|lat| ≲ 30°, i.e. |z| ≲ 0.5)', () => {
    const spots = planStarSurfaceScene({ scenario: 'sun' }).starSurfaces[0].spots;
    expect(spots.length).toBeGreaterThan(0);
    for (const sp of spots) {
      const z = sp.c[2];                          // z = sin(latitude) on the z-up sphere
      expect(Math.abs(z)).toBeLessThan(0.55);     // stays inside the ±~33° band
      const r = Math.hypot(sp.c[0], sp.c[1], sp.c[2]);
      expect(r).toBeCloseTo(1, 3);                // spot centres are unit vectors
    }
  });

  it('spot umbra is cooler (a larger cos-threshold = tighter core) than its penumbra ring', () => {
    const sp = planStarSurfaceScene({ scenario: 'sun' }).starSurfaces[0].spots[0];
    expect(sp.cosUmbra).toBeGreaterThan(sp.cosPenu);   // umbra cone is narrower than the penumbra cone
    expect(sp.dTumbra).toBeLessThan(0);                // umbra is below the base temperature
    expect(sp.dTumbra).toBeLessThan(sp.dTpenu);        // umbra is the coolest part
  });

  it('cool stars have bigger, fewer granules than hot stars (lower cell frequency)', () => {
    expect(planStarSurfaceScene({ scenario: 'red-dwarf' }).stats.granuleCells)
      .toBeLessThan(planStarSurfaceScene({ scenario: 'blue-giant' }).stats.granuleCells);
  });
});

describe('assembleStarSurfaceScene — render payload', () => {
  it('returns the starSurfaces channel, no faces, and orbit cameras; scales the radius', () => {
    const p = assembleStarSurfaceScene({ scenario: 'sun', scale: 2 });
    expect(p.starSurfaces).toHaveLength(1);
    expect(p.faces).toEqual([]);
    expect(p.cameras.length).toBeGreaterThanOrEqual(1);
    const base = planStarSurfaceScene({ scenario: 'sun' }).starSurfaces[0].radius;
    expect(p.starSurfaces[0].radius).toBeCloseTo(base * 2, 5);
  });

  it('honors a custom background', () => {
    expect(assembleStarSurfaceScene({ scene: { bg: '#101020' } }).bg).toBe('#101020');
  });
});
