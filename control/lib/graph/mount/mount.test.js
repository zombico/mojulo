import { describe, it, expect } from 'vitest';
import { resolveMount } from './build.js';
import { gaitCycle, standPose, strideOf, swingPath, bump } from './gait.js';
import { gaitGates } from './gates.js';
import { MOUNT_BONES } from './pose.js';
import { GAITS } from './reference.js';

// The mount's machine gate, one case per procedure: a gait always on the ground (the walk: the girdles' swaying vault),
// a gait with a lead and one suspension (the canter: the constant vault, a flight at g), and the stylized register (the
// same mechanics on other legs, by dynamic similarity). The whole speed bands, both leads and both registers are swept
// in mount.deep.test.js. How it LOOKS is the eyes gate (scripts/mount-study.mjs, the contact sheet), never claimed here.
const DEG = 180 / Math.PI;
const gate = (B, g, o) => gaitGates(B, gaitCycle(B, g, o));
const failures = (r) => r.checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.saw} (want ${c.want})`);

describe('the mount: a horse', () => {
  const B = resolveMount('horse');

  it('stands as a horse stands: cannons plumb, the joints at their standing angles, no clamp', () => {
    const { fore, hind } = B.stand;
    expect(fore.clamped || hind.clamped).toBe(false);
    expect(Math.abs(fore.cannon * DEG + 90)).toBeLessThan(6);
    expect(Math.abs(hind.cannon * DEG + 90)).toBeLessThan(6);
    expect(fore.angles.shoulder * DEG).toBeGreaterThan(95); expect(fore.angles.shoulder * DEG).toBeLessThan(120);
    expect(fore.angles.elbow * DEG).toBeGreaterThan(125); expect(fore.angles.elbow * DEG).toBeLessThan(155);
    expect(hind.angles.stifle * DEG).toBeGreaterThan(130); expect(hind.angles.stifle * DEG).toBeLessThan(155);
    expect(hind.angles.hock * DEG).toBeCloseTo(150, 0);
    expect(B.share.fore).toBeGreaterThan(0.55); expect(B.share.fore).toBeLessThan(0.6);
  });

  it('the rig: parent-first, under the engines\' bone budget, every bone posed in every frame', () => {
    const seen = new Set();
    for (const b of MOUNT_BONES) { if (b.parent) expect(seen.has(b.parent), b.id).toBe(true); seen.add(b.id); }
    expect(MOUNT_BONES.length).toBeLessThanOrEqual(64);
    const f = standPose(B);
    for (const b of MOUNT_BONES) expect(f.bones[b.id].head.concat(f.bones[b.id].tail).every(Number.isFinite), b.id).toBe(true);
    expect(f.bones.saddle && f.bones.bit).toBeTruthy();                // the tack's sockets, there from the start
  });

  it('the walk: four beats, never airborne, the girdles vaulting; every machine check passes', () => {
    const r = gate(B, 'walk');
    expect(failures(r)).toEqual([]);
    expect(r.measured.aerial).toBe(0);
  });

  it('the canter: three beats on a lead, one suspension falling at g; the left lead mirrors the right', () => {
    const right = gate(B, 'canter'), left = gate(B, 'canter', { lead: 'left' });
    expect(failures(right)).toEqual([]);
    expect(failures(left)).toEqual([]);
    for (const [r, l] of [['LH', 'RH'], ['RF', 'LF']]) expect(left.measured.down[l]).toBeCloseTo(right.measured.down[r], 6);
  });

  it('is deterministic: the same stride twice is the same numbers', () => {
    const a = gaitCycle(B, 'trot').poseAt(0.37), b = gaitCycle(resolveMount('horse'), 'trot').poseAt(0.37);
    expect(JSON.stringify(a.bones)).toBe(JSON.stringify(b.bones));
  });
});

describe('the stylized register: the same mechanics on its own legs', () => {
  const R = resolveMount('horse'), S = resolveMount('horse', { register: 'stylized' });

  it('strides by dynamic similarity: at the same Froude number, stride ∝ leg and frequency ∝ 1/√leg', () => {
    const vR = GAITS.trot.preferred, vS = vR * Math.sqrt(S.scale);
    const a = strideOf(R, 'trot', vR), b = strideOf(S, 'trot', vS);
    expect(b.L / a.L).toBeCloseTo(S.scale, 6);
    expect(b.f / a.f).toBeCloseTo(1 / Math.sqrt(S.scale), 6);
    expect(b.duty).toBeCloseTo(a.duty, 9);
  });

  it('its trot passes the same machine checks (its flight exaggerated by design, so not held to g)', () => {
    expect(failures(gate(S, 'trot'))).toEqual([]);
  });
});

describe('the swing\'s pieces', () => {
  it('swingPath leaves and arrives with the given velocities and stays between its ends when they are still', () => {
    const h = 1e-6;
    expect((swingPath(0, 2, 1, -3, h) - swingPath(0, 2, 1, -3, 0)) / h).toBeCloseTo(2, 3);
    expect((swingPath(0, 2, 1, -3, 1) - swingPath(0, 2, 1, -3, 1 - h)) / h).toBeCloseTo(-3, 3);
    for (let v = 0; v <= 1; v += 0.05) { const p = swingPath(0, 0, 1, 0, v); expect(p).toBeGreaterThanOrEqual(-1e-12); expect(p).toBeLessThanOrEqual(1 + 1e-12); }
  });

  it('bump is 0 at its ends and 1 at its peak', () => {
    expect(bump(0, 0.4)).toBe(0); expect(bump(1, 0.4)).toBe(0);
    expect(bump(0.4, 0.4)).toBeCloseTo(1, 9);
  });
});
