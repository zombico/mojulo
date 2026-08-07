import { describe, it, expect } from 'vitest';
import {
  FIGURE_LANDMARK_IDS,
  FIGURE_LATHE_AXES,
  canonicalTPose,
  landmarkSlots,
} from './figure-landmarks.js';

describe('FIGURE_LANDMARK_IDS', () => {
  it('contains the 23 named landmarks', () => {
    expect(FIGURE_LANDMARK_IDS).toHaveLength(23);
  });

  it('has no duplicates', () => {
    expect(new Set(FIGURE_LANDMARK_IDS).size).toBe(FIGURE_LANDMARK_IDS.length);
  });

  it('pairs every lateral landmark with -l and -r', () => {
    const lefts = FIGURE_LANDMARK_IDS.filter((id) => id.endsWith('-l'));
    for (const l of lefts) {
      const r = l.replace(/-l$/, '-r');
      expect(FIGURE_LANDMARK_IDS).toContain(r);
    }
  });
});

describe('FIGURE_LATHE_AXES', () => {
  it('references landmark ids that exist', () => {
    for (const { from, to } of Object.values(FIGURE_LATHE_AXES)) {
      expect(FIGURE_LANDMARK_IDS).toContain(from);
      expect(FIGURE_LANDMARK_IDS).toContain(to);
    }
  });

  it('declares the three masses (head, torso, pelvis)', () => {
    expect(Object.keys(FIGURE_LATHE_AXES).sort()).toEqual(['head', 'pelvis', 'torso']);
  });
});

describe('canonicalTPose — normalized', () => {
  const pose = canonicalTPose();

  it('returns a position for every landmark id', () => {
    for (const id of FIGURE_LANDMARK_IDS) {
      expect(pose[id]).toBeDefined();
      expect(Number.isFinite(pose[id].x)).toBe(true);
      expect(Number.isFinite(pose[id].y)).toBe(true);
      expect(Number.isFinite(pose[id].z)).toBe(true);
    }
  });

  it('puts head-crown at the top (z=1) at unit scale', () => {
    expect(pose['head-crown'].z).toBe(1);
  });

  it('puts feet (heel/toe) at the bottom (z≈0)', () => {
    expect(pose['heel-l'].z).toBe(0);
    expect(pose['heel-r'].z).toBe(0);
    expect(pose['toe-l'].z).toBe(0);
    expect(pose['toe-r'].z).toBe(0);
  });

  it('mirrors every lateral pair across x=0', () => {
    for (const l of FIGURE_LANDMARK_IDS.filter((id) => id.endsWith('-l'))) {
      const r = l.replace(/-l$/, '-r');
      expect(pose[l].x).toBeCloseTo(-pose[r].x, 6);
      expect(pose[l].y).toBeCloseTo(pose[r].y, 6);
      expect(pose[l].z).toBeCloseTo(pose[r].z, 6);
    }
  });

  it('arms extend laterally at shoulder height (T-pose)', () => {
    const sh = pose['shoulder-l'];
    const el = pose['elbow-l'];
    const wr = pose['wrist-l'];
    expect(el.z).toBeCloseTo(sh.z, 6);
    expect(wr.z).toBeCloseTo(sh.z, 6);
    expect(el.x).toBeLessThan(sh.x);
    expect(wr.x).toBeLessThan(el.x);
  });

  it('legs hang straight (knee and ankle at same lateral x as hip)', () => {
    expect(pose['knee-l'].x).toBeCloseTo(pose['hip-l'].x, 6);
    expect(pose['ankle-l'].x).toBeCloseTo(pose['hip-l'].x, 6);
  });

  it('toes are forward of heels in +y', () => {
    expect(pose['toe-l'].y).toBeGreaterThan(pose['heel-l'].y);
  });

  it('z-order is head-crown > head-base > neck > torso-top > torso-base > pelvis-floor > ankle', () => {
    expect(pose['head-crown'].z).toBeGreaterThan(pose['head-base'].z);
    expect(pose['head-base'].z).toBeGreaterThan(pose['neck-base'].z);
    expect(pose['neck-base'].z).toBeGreaterThan(pose['torso-top'].z);
    expect(pose['torso-top'].z).toBeGreaterThan(pose['torso-base'].z);
    expect(pose['torso-base'].z).toBeGreaterThanOrEqual(pose['pelvis-top'].z);
    expect(pose['pelvis-top'].z).toBeGreaterThan(pose['pelvis-floor'].z);
    expect(pose['pelvis-floor'].z).toBeGreaterThan(pose['ankle-l'].z);
  });
});

describe('canonicalTPose — scaling and anchoring', () => {
  it('scales all coordinates linearly', () => {
    const a = canonicalTPose({ scale: 1 });
    const b = canonicalTPose({ scale: 4 });
    expect(b['head-crown'].z).toBeCloseTo(4 * a['head-crown'].z, 6);
    expect(b['shoulder-l'].x).toBeCloseTo(4 * a['shoulder-l'].x, 6);
  });

  it('translates all coordinates by anchor', () => {
    const offset = { x: 10, y: -5, z: 2 };
    const pose = canonicalTPose({ scale: 1, anchor: offset });
    expect(pose['head-crown']).toEqual({ x: 10, y: -5, z: 3 });
    expect(pose['shoulder-l'].x).toBeCloseTo(10 - 0.18, 6);
  });

  it('composes scale then anchor', () => {
    const pose = canonicalTPose({ scale: 4, anchor: { x: 0, y: 0, z: 1 } });
    expect(pose['head-crown'].z).toBeCloseTo(1 + 4, 6);
    expect(pose['ankle-l'].z).toBeCloseTo(1 + 4 * 0.02, 6);
  });
});

describe('landmarkSlots', () => {
  it('returns one slot per landmark, in FIGURE_LANDMARK_IDS order', () => {
    const slots = landmarkSlots();
    expect(slots.map((s) => s.id)).toEqual([...FIGURE_LANDMARK_IDS]);
  });

  it('honors a custom pose (e.g. scaled)', () => {
    const pose = canonicalTPose({ scale: 4 });
    const slots = landmarkSlots(pose);
    const head = slots.find((s) => s.id === 'head-crown');
    expect(head.position.z).toBe(4);
  });
});
