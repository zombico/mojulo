import { describe, it, expect } from 'vitest';
import { groundBalance, groundVault } from './figure-balance.js';
import { articulate, basePositions } from './figure-vajra.js';

describe('figure-balance — weighted stance', () => {
  const rest = articulate({});                      // neutral standing armature
  const ankleR = basePositions().ankleR.x;          // +0.10 (figure's right)

  it('neutral two-foot balance is a (near) no-op on the rest pose', () => {
    const b = groundBalance(rest, { feet: ['L', 'R'], weight: 0 });
    expect(Math.abs(b.pelvisHub.x)).toBeLessThan(1e-3);
    expect(Math.abs(b.pelvisHub.x - rest.pelvisHub.x)).toBeLessThan(1e-3);
  });

  it('weight slides the COM toward the loaded foot (and the other way for −)', () => {
    const right = groundBalance(rest, { weight: 1 }).pelvisHub.x;
    const left = groundBalance(rest, { weight: -1 }).pelvisHub.x;
    expect(right).toBeGreaterThan(0.05);            // committed over the right foot
    expect(left).toBeLessThan(-0.05);               // …and the left
    expect(right).toBeCloseTo(ankleR, 1);           // lands ~over the ankle
    expect(left).toBeCloseTo(-ankleR, 1);
  });

  it('single-foot support commits the COM over that foot', () => {
    expect(groundBalance(rest, { feet: ['R'] }).pelvisHub.x).toBeGreaterThan(0.05);
    expect(groundBalance(rest, { feet: ['L'] }).pelvisHub.x).toBeLessThan(-0.05);
  });

  it('feet stay planted through the shift', () => {
    const b = groundBalance(rest, { weight: 1 });
    expect(b.ankleR.x).toBeCloseTo(rest.ankleR.x, 6);
    expect(b.ankleL.x).toBeCloseTo(rest.ankleL.x, 6);
  });
});

describe('figure-balance — ground vault (pelvis-height / inverted pendulum)', () => {
  const base = basePositions();
  const GROUND = base.ankleL.z;

  it('neutral stance (both planted, feet under the hips) is reproduced exactly', () => {
    const v = groundVault(articulate({}), { plant: { L: 1, R: 1 } });
    expect(v.pelvisHub.z).toBeCloseTo(base.pelvisHub.z, 6);
    expect(v.ankleL.z).toBeCloseTo(GROUND, 6);
  });

  it('pins a planted fore-foot to the FLOOR and vaults the pelvis DOWN to reach it', () => {
    const fk = articulate({ hipL: { pitch: 25 }, kneeL: 6 });   // left thigh forward → FK foot floats up
    expect(fk.ankleL.z).toBeGreaterThan(GROUND + 0.01);          // FK foot is off the floor
    const v = groundVault(fk, { plant: { L: 1, R: 0 } });
    expect(v.ankleL.z).toBeCloseTo(GROUND, 4);                   // …vault plants it on the floor
    expect(v.pelvisHub.z).toBeLessThan(base.pelvisHub.z - 0.01); // …by lowering the pelvis over it
  });

  it('a swing foot (plant 0) is NOT pinned — it rides the pelvis (lifts via its FK knee)', () => {
    const fk = articulate({ hipR: { pitch: -20 }, kneeR: 60 });  // right leg swinging, foot lifted
    const v = groundVault(fk, { plant: { L: 1, R: 0 } });
    expect(v.ankleR.z).toBeGreaterThan(GROUND + 0.02);           // swing foot stays up, not planted
  });

  it('carries the COM over the planted foot in single support — the MECHANICAL weight-shift', () => {
    const fk = articulate({});
    // left single support → the pelvis travels over the LEFT foot (x ≈ −0.10), not the spine.
    const left = groundVault(fk, { plant: { L: 1, R: 0 } });
    expect(left.pelvisHub.x).toBeLessThan(-0.05);
    expect(left.pelvisHub.x).toBeCloseTo(base.ankleL.x, 1);      // ~over the stance foot
    expect(left.ankleL.z).toBeCloseTo(GROUND, 4);                // …which stays pinned to the floor
    // right single support → mirror; and the two are symmetric.
    const right = groundVault(fk, { plant: { L: 0, R: 1 } });
    expect(right.pelvisHub.x).toBeGreaterThan(0.05);
    expect(right.pelvisHub.x).toBeCloseTo(-left.pelvisHub.x, 6);
    // carry:0 restores the old sagittal-only vault — no lateral commit.
    expect(groundVault(fk, { plant: { L: 1, R: 0 }, carry: 0 }).pelvisHub.x).toBeCloseTo(0, 6);
  });
});
