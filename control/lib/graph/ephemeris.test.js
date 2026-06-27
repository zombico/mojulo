import { describe, it, expect } from 'vitest';

import { geoLockState, julianDay } from './ephemeris.js';

// Low-precision geocentric Sun + Moon. These guard the standard anchors (solstices/equinoxes, the
// sub-solar noon longitude, the Moon's physical distance range) — not almanac-grade accuracy.
describe('ephemeris — Sun', () => {
  it('solar declination hits the solstices/equinoxes', () => {
    const dec = (iso) => geoLockState(new Date(iso)).subsolar.lat;
    expect(dec('2026-06-21T00:00:00Z')).toBeGreaterThan(23.0);   // June solstice → +23.4
    expect(dec('2026-12-21T12:00:00Z')).toBeLessThan(-23.0);     // December solstice → −23.4
    expect(Math.abs(dec('2026-03-20T12:00:00Z'))).toBeLessThan(1); // March equinox → ~0
  });

  it('the sub-solar point tracks local solar noon (≈ −15°/hour of UTC)', () => {
    // at 02:30 UTC, solar noon sits near 142°E (≈ 15°·(12 − 2.5)); two hours later it moves ~30° west.
    const a = geoLockState(new Date('2026-06-18T02:30:00Z')).subsolar.lon;
    const b = geoLockState(new Date('2026-06-18T04:30:00Z')).subsolar.lon;
    expect(a).toBeGreaterThan(130);
    expect(a).toBeLessThan(155);
    expect(a - b).toBeCloseTo(30, 0);   // ~30° westward per 2 h
  });
});

describe('ephemeris — Moon', () => {
  it("the Moon's distance stays in the real perigee→apogee band (~56–64 Earth radii)", () => {
    for (const iso of ['2026-06-18T02:30:00Z', '2026-01-01T00:00:00Z', '2026-09-15T18:00:00Z']) {
      const er = geoLockState(new Date(iso)).moonDistEarthRadii;
      expect(er).toBeGreaterThan(55);
      expect(er).toBeLessThan(64);
    }
  });

  it('illuminated fraction is a real 0..1 with a named phase', () => {
    const { illum } = geoLockState(new Date('2026-06-18T02:30:00Z'));
    expect(illum.fraction).toBeGreaterThanOrEqual(0);
    expect(illum.fraction).toBeLessThanOrEqual(1);
    expect(typeof illum.phase).toBe('string');
    expect(typeof illum.waxing).toBe('boolean');
  });

  it('sweeps through a full lunation over a month (new → full → new)', () => {
    // sample illuminated fraction across ~29.5 days; it must reach both near-dark and near-full.
    let lo = 1, hi = 0;
    for (let h = 0; h < 30 * 24; h += 6) {
      const d = new Date(Date.UTC(2026, 0, 1) + h * 3600000);
      const f = geoLockState(d).illum.fraction;
      lo = Math.min(lo, f); hi = Math.max(hi, f);
    }
    expect(lo).toBeLessThan(0.05);   // a new moon happens
    expect(hi).toBeGreaterThan(0.95); // a full moon happens
  });
});

describe('ephemeris — plumbing', () => {
  it('julianDay matches the J2000.0 epoch', () => {
    // 2000-01-01T12:00:00Z is JD 2451545.0 by definition.
    expect(julianDay(new Date('2000-01-01T12:00:00Z'))).toBeCloseTo(2451545.0, 6);
  });

  it('is deterministic (a pure function of the instant)', () => {
    const a = geoLockState(new Date('2026-06-18T02:30:00Z'));
    const b = geoLockState(new Date('2026-06-18T02:30:00Z'));
    expect(a).toEqual(b);
  });
});
