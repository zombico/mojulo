// hero-servo — the arm read as servos on a real hero rig (the realistic form): the shoulder's swing read where the arm
// went (plane and elevation in the thorax's frame) and held to its cone, its rotation signed external +, the two sides
// reading alike under a mirrored pose, the girdle's turn carried by the thorax and not read as the shoulder's, a pose the
// rig allows and the body cannot flagged, and a clip's frames and speeds counted.
import { describe, expect, it } from 'vitest';
import { validateRig } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { SHOULDER_CONE, SERVOS, coneAt, servoRead, servoReport } from './hero-servo.js';

const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'male', form: 'realistic' }) }).recipe.rig);
const read = (pose) => servoRead(R, { support: 'none', ...pose });

describe('hero-servo', () => {
  it('the cone reads its rows at their planes, between them linearly, and wraps round the back', () => {
    for (const row of SHOULDER_CONE) expect(coneAt(row.plane)).toEqual({ hard: row.hard, ease: row.ease });
    const [a, b] = [SHOULDER_CONE[2], SHOULDER_CONE[3]], mid = coneAt((a.plane + b.plane) / 2);
    expect(mid.hard).toBeCloseTo((a.hard + b.hard) / 2, 6);
    expect(coneAt(190)).toEqual(coneAt(-170));
    for (const row of SHOULDER_CONE) expect(row.ease).toBeLessThanOrEqual(row.hard);
  });

  it('reads the hanging arm, the arm raised forward and the arm raised to the side', () => {
    const rest = read({}).R;
    expect(rest.shoulder.swing.value).toBeLessThan(15);
    expect(rest.elbow.value).toBe(0);
    expect(rest.shoulder.twist, 'a straight arm shows no turn').toBeNull();
    const fwd = read({ shR: { pitch: 90 } }).R.shoulder.swing;
    expect(fwd.value).toBeCloseTo(90, 0); expect(Math.abs(fwd.plane - 90)).toBeLessThan(10);
    const side = read({ armR: 'outward' }).R.shoulder.swing;
    expect(side.value).toBeCloseTo(90, 0); expect(Math.abs(side.plane)).toBeLessThan(5);
  }, 60000);

  it('signs the rotation external + and reads a mirrored pose alike on both sides', () => {
    // the rig's words are not mirrored: the left arm's yaw and roll turn the other way
    const r = read({ shR: { pitch: 40, yaw: 30, roll: 35 }, elbowR: 70, shL: { pitch: 40, yaw: -30, roll: -35 }, elbowL: 70 });
    for (const k of ['value', 'plane']) expect(r.L.shoulder.swing[k]).toBeCloseTo(r.R.shoulder.swing[k], 1);
    expect(r.L.shoulder.twist.value).toBeCloseTo(r.R.shoulder.twist.value, 1);
    const out = read({ shR: { roll: 45 }, elbowR: 90 }).R.shoulder.twist.value, inn = read({ shR: { roll: -45 }, elbowR: 90 }).R.shoulder.twist.value;
    expect(out, 'the forearm swung outward: external').toBeGreaterThan(30);
    expect(inn, 'inward: internal').toBeLessThan(-30);
  }, 60000);

  it('the girdle turn is the thorax’s: an arm carried round by the girdle swings with it', () => {
    // (the rig's girdle turn carries the humerus's line but leaves the elbow's bend plane, so it reads as a rotation at
    // the shoulder, and a raised arm's `sh` pitch is not taken in the girdle's frame: the reader reports both, as it
    // reads any arm; the arm solver compensates)
    const pose = { elbowR: 40 };
    const a = read(pose).R, b = read({ ...pose, shoulders: 20 }).R;
    expect(b.girdle.value).toBe(20);
    for (const k of ['value', 'plane']) expect(Math.abs(b.shoulder.swing[k] - a.shoulder.swing[k]), k).toBeLessThan(0.5);
  }, 60000);

  it('flags what the rig allows and the body cannot: an arm swung level straight across the chest', () => {
    const across = read({ shR: { yaw: 90 } }).R.shoulder.swing;
    expect(Math.abs(across.plane)).toBeGreaterThan(160);
    expect(across.inRange).toBe(false); expect(across.margin).toBeLessThan(0);
    expect(read({ armR: 'outward' }).R.shoulder.swing.inRange).toBe(true);
  }, 60000);

  it('a clip: frames past a stop are counted and a joint’s speed is its change over the clip’s time', () => {
    const top = SERVOS.elbow.range[1] + 10;   // the elbow driven 10° past its stop at the end
    const rep = servoReport(R, { fn: (t) => ({ support: 'none', elbowR: top * t }) }, { seconds: 2, samples: 20 });
    const e = rep.sides.R.elbow;
    expect(e.max).toBe(top); expect(e.worstMargin).toBe(-10);
    expect(e.outOfRange).toBe(2);   // (152° and 160°: the last two of 21 frames, 8° apart)
    expect(e.peakSpeed).toBeCloseTo(top / 2, 1);
    expect(rep.sides.L.elbow.outOfRange).toBe(0);
    expect(JSON.stringify(servoReport(R, { fn: (t) => ({ support: 'none', elbowR: top * t }) }, { seconds: 2, samples: 20 }))).toBe(JSON.stringify(rep));
  }, 60000);
});
