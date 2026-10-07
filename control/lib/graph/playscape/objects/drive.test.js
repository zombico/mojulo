/**
 * Drives: what moves an entry's t. Clock by time; ride by a rider, with a dwell before it comes home; call by a use
 * at a stop; rule by a bus var. Stepped by dt, so a timeline replays exactly.
 */
import { describe, expect, it } from 'vitest';

import { runDrive, stepDrive, initialDrive, driveErrors, DRIVE_TYPES } from './drive.js';

const at = (tl, time) => tl.find((x) => Math.abs(x.time - time) < 1e-6).t;

describe('drives', () => {
  it('a clock ping-pongs over its period, or loops one way round', () => {
    const pp = runDrive({ type: 'clock', period: 4 }, () => ({}), 0.5, 8);
    expect(at(pp, 0)).toBe(0); expect(at(pp, 2)).toBe(1); expect(at(pp, 4)).toBe(0);
    const lp = runDrive({ type: 'clock', period: 4, mode: 'loop' }, () => ({}), 0.5, 8);
    expect(at(lp, 2)).toBe(0.5); expect(at(lp, 3.5)).toBeCloseTo(0.875, 6);
  });

  it('a ride waits for a rider, runs to the end, waits its dwell empty, then comes home', () => {
    const d = { type: 'ride', speed: 0.5, dwell: 2 };
    const tl = runDrive(d, (time) => ({ ridden: time >= 1 && time < 3.5 }), 0.25, 9);
    expect(at(tl, 0.75)).toBe(0);        // nobody on yet
    expect(at(tl, 3)).toBe(1);           // ridden from 1 s at 0.5 t/s: at the end by 3 s
    expect(at(tl, 5)).toBe(1);           // stepped off at 3.5 s: still waiting out its two seconds
    expect(at(tl, 7.75)).toBe(0);        // home
  });

  it('a call sends it to the stop that called', () => {
    const d = { type: 'call', stops: [0, 0.4, 1], speed: 0.5 };
    const tl = runDrive(d, (time) => (time === 0.5 ? { call: 2 } : time === 4 ? { call: 1 } : {}), 0.5, 6);
    expect(at(tl, 2.5)).toBe(1);
    expect(at(tl, 6)).toBeCloseTo(0.4, 6);
  });

  it('a rule follows its var', () => {
    let st = initialDrive({ type: 'rule', var: 'door-open', speed: 1 });
    st = stepDrive({ type: 'rule', var: 'door-open', speed: 1 }, st, 0.5, { value: 1 });
    expect(st.t).toBe(0.5);
  });

  it('names what is wrong with a drive', () => {
    expect(DRIVE_TYPES).toEqual(['clock', 'ride', 'call', 'rule']);
    expect(driveErrors({ type: 'warp' })[0]).toMatch(/clock, ride, call, rule/);
    expect(driveErrors({ type: 'call', speed: 1, stops: [0] })[0]).toMatch(/two stops/);
  });
});
