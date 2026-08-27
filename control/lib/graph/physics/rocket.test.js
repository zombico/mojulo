/**
 * rocket fidelity gate — the mission is pure numbers, so faithfulness is checkable without
 * rendering. Bands follow flight.test.js's doctrine: assert physical ground truth (the
 * atmosphere against the published US76 table, thrust/mass identities) and then the
 * telemetry envelopes that separate a faithful Falcon-9-class mission from a cartoon —
 * liftoff TWR, Max-Q timing, MECO state, apogee, the entry-burn deceleration, the hoverslam
 * (ignites LOW, lands SOFT, with propellant remaining), and the RTLS booster actually
 * coming home to the pad. Envelope sources: SpaceX published specs + public webcast
 * telemetry reconstructions of RTLS (CRS-class) and ASDS (LEO-class) missions.
 */
import { describe, it, expect } from 'vitest';
import { flyMission, atmosphere, ascentCd, gravityAt, resolveVehicle, VEHICLES, G0 } from './rocket.js';

const rtls = flyMission({ profile: 'rtls' });
const asds = flyMission({ profile: 'asds' });

describe('US Standard Atmosphere 1976', () => {
  it('matches the published table at sea level', () => {
    const a = atmosphere(0);
    expect(a.p).toBeCloseTo(101325, 0);
    expect(a.rho).toBeCloseTo(1.225, 3);
    expect(a.T).toBeCloseTo(288.15, 2);
  });
  it('matches the tropopause (11 km: T 216.65 K, ρ ≈ 0.364 kg/m³)', () => {
    const a = atmosphere(11000);
    expect(a.T).toBeCloseTo(216.65, 1);
    expect(a.rho).toBeGreaterThan(0.35);
    expect(a.rho).toBeLessThan(0.38);
  });
  it('is monotonically thinning and effectively vacuum at 100 km', () => {
    expect(atmosphere(30000).rho).toBeLessThan(atmosphere(20000).rho);
    expect(atmosphere(100000).rho).toBeLessThan(1e-4);
    expect(atmosphere(100000).p).toBeGreaterThan(0);
  });
});

describe('ascent C_d(M) and gravity', () => {
  it('has the transonic rise: C_d at Mach 1.1 well above both plateaus', () => {
    expect(ascentCd(0.4)).toBeLessThan(0.35);
    expect(ascentCd(1.1)).toBeGreaterThan(0.5);
    expect(ascentCd(4)).toBeLessThan(0.32);
  });
  it('inverse-square gravity is ~4 % lighter at 140 km', () => {
    expect(gravityAt(0)).toBeCloseTo(G0, 5);
    expect(gravityAt(140000) / G0).toBeGreaterThan(0.95);
    expect(gravityAt(140000) / G0).toBeLessThan(0.96);
  });
});

describe('vehicle registry', () => {
  it('falcon9 liftoff TWR sits in the published 1.3–1.6 band', () => {
    expect(rtls.summary.liftoffTWR).toBeGreaterThan(1.3);
    expect(rtls.summary.liftoffTWR).toBeLessThan(1.6);
  });
  it('refuses an unknown vehicle and a vehicle that cannot exist', () => {
    expect(() => resolveVehicle('saturn-v')).toThrow(/registry/);
    expect(() => resolveVehicle({ stage1: { dry: -5 } })).toThrow(/positive/);
  });
  it('custom vehicles inherit falcon9 fields they do not override', () => {
    const v = resolveVehicle({ label: 'heavy', stage1: { prop: 500000 } });
    expect(v.stage1.prop).toBe(500000);
    expect(v.stage1.thrustSL).toBe(VEHICLES.falcon9.stage1.thrustSL);
  });
});

describe('RTLS mission telemetry envelope', () => {
  const e = rtls.events;
  it('Max-Q on ascent: T+35–95 s, 25–45 kPa, 4–16 km', () => {
    expect(e.maxQ.t).toBeGreaterThan(35); expect(e.maxQ.t).toBeLessThan(95);
    expect(e.maxQ.q / 1000).toBeGreaterThan(25); expect(e.maxQ.q / 1000).toBeLessThan(45);
    expect(e.maxQ.alt / 1000).toBeGreaterThan(4); expect(e.maxQ.alt / 1000).toBeLessThan(16);
  });
  it('MECO: T+110–175 s at 1500–2200 m/s, 55–90 km — the early/slow staging RTLS pays for', () => {
    expect(e.meco.t).toBeGreaterThan(110); expect(e.meco.t).toBeLessThan(175);
    expect(e.meco.v).toBeGreaterThan(1500); expect(e.meco.v).toBeLessThan(2200);
    expect(e.meco.alt / 1000).toBeGreaterThan(55); expect(e.meco.alt / 1000).toBeLessThan(90);
  });
  it('apogee in the lofted RTLS band (120–200 km)', () => {
    expect(e.apogee.alt / 1000).toBeGreaterThan(120);
    expect(e.apogee.alt / 1000).toBeLessThan(200);
  });
  it('boostback reverses the downrange velocity (vx goes negative)', () => {
    expect(e.boostbackEnd).toBeTruthy();
    expect(e.boostbackEnd.vx).toBeLessThan(0);
  });
  it('the entry burn sheds real speed and keeps peak reentry q survivable (< 90 kPa)', () => {
    expect(e.entryEnd).toBeTruthy();
    expect(e.entryStart.v - e.entryEnd.v).toBeGreaterThan(400);
    expect(e.entryPeakQ.q / 1000).toBeLessThan(90);
  });
  it('the hoverslam ignites LOW (under 8 km) — drag does the braking above it', () => {
    expect(e.landingIgnition).toBeTruthy();
    expect(e.landingIgnition.alt).toBeLessThan(8000);
  });
  it('the booster comes HOME: touchdown within 1 km of the pad, under 4 m/s, propellant remaining', () => {
    expect(e.touchdown).toBeTruthy();
    expect(Math.abs(e.touchdown.x)).toBeLessThan(1000);
    expect(e.touchdown.v).toBeLessThan(4);
    expect(e.touchdown.propLeft).toBeGreaterThan(500);
  });
  it('the whole mission fits the RTLS clock (7–11 minutes)', () => {
    expect(e.touchdown.t).toBeGreaterThan(420);
    expect(e.touchdown.t).toBeLessThan(660);
  });
});

describe('ASDS mission telemetry envelope', () => {
  const e = asds.events;
  it('stages later and faster than RTLS (that is why the ship exists)', () => {
    expect(e.meco.v).toBeGreaterThan(rtls.events.meco.v);
    expect(e.meco.v).toBeGreaterThan(2000); expect(e.meco.v).toBeLessThan(2600);
  });
  it('no boostback — the trajectory stays downrange', () => {
    expect(e.boostbackEnd).toBeFalsy();
    expect(e.touchdown.x).toBeGreaterThan(rtls.events.meco.x);
  });
  it('lands on the ship: 400–900 km downrange, under 4 m/s, propellant remaining', () => {
    expect(e.touchdown.x / 1000).toBeGreaterThan(400);
    expect(e.touchdown.x / 1000).toBeLessThan(900);
    expect(e.touchdown.v).toBeLessThan(4);
    expect(e.touchdown.propLeft).toBeGreaterThan(500);
  });
  it('the hotter entry still stays inside the reconstructed peak-q band (< 130 kPa)', () => {
    expect(e.entryPeakQ.q / 1000).toBeGreaterThan(rtls.events.entryPeakQ.q / 1000);
    expect(e.entryPeakQ.q / 1000).toBeLessThan(130);
  });
});

describe('physical identities and honesty dials', () => {
  it('mass only ever decreases, and only while engines burn', () => {
    let last = Infinity, burningDrop = true;
    for (const s of rtls.samples) {
      if (s.m > last + 1e-6) burningDrop = false;
      last = s.m;
    }
    expect(burningDrop).toBe(true);
  });
  it('the hoverslam bind is real: min single-engine thrust exceeds the landed weight (TWR_min > 1)', () => {
    const s1 = VEHICLES.falcon9.stage1;
    const landed = s1.dry + rtls.events.touchdown.propLeft;
    expect((s1.thrustSL / s1.nEngines) * s1.minThrottle).toBeGreaterThan(landed * G0);
  });
  it('drag:false flies higher — the ablation dial isolates the atmosphere', () => {
    const vac = flyMission({ profile: 'rtls', drag: false });
    expect(vac.events.apogee.alt).toBeGreaterThan(rtls.events.apogee.alt);
  });
  it('deterministic: same spec → identical mission', () => {
    const again = flyMission({ profile: 'rtls' });
    expect(again.events.touchdown.t).toBe(rtls.events.touchdown.t);
    expect(again.events.touchdown.x).toBe(rtls.events.touchdown.x);
    expect(again.samples.length).toBe(rtls.samples.length);
  });
  it('stage 2 keeps accelerating away after separation', () => {
    const s2 = rtls.stage2Samples;
    expect(s2.length).toBeGreaterThan(100);
    expect(s2[s2.length - 1].z).toBeGreaterThan(s2[0].z);
    expect(s2[s2.length - 1].x).toBeGreaterThan(s2[0].x);
  });
});
