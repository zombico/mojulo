import { describe, it, expect } from 'vitest';
import { BRAWL_SWAY, swayAir, swayHang, swayStep, swayRegion, swayBend } from './brawl-sway.js';

// a strand of hair hanging 30 cm straight down the back from a root at z = 1.5, three vertices across it at each depth
function strand() {
  const pts = [];
  for (let d = 0; d <= 6; d++) for (const x of [-0.02, 0, 0.02]) pts.push(x, -0.08, 1.5 - d * 0.05);
  return new Float32Array(pts);
}
const settle = (a, P, float = false) => { const st = { wx: 0, wy: 0, vx: 0, vy: 0 }; swayStep(st, swayHang(a, P), a, { ...P, flutter: 0 }, 600, 600, 0, false); if (float) swayStep(st, swayHang(a, P), a, P, 60, 660, 0, true); return st; };

describe('the air a body feels (swayAir)', () => {
  it('is its own motion turned back on it: running forward into still air is a headwind, whichever way it faces', () => {
    for (const face of [1, -1]) {
      const a = swayAir([5 * face, 0, 0], [0, 0, 0], face);
      expect(a[1]).toBeCloseTo(-5);
      expect(Math.abs(a[0]) + Math.abs(a[2])).toBe(0);
    }
  });
  it('a floater is borne up and glides: the air rises under it and streams back past it even standing still', () => {
    const a = swayAir([0, 0, 0], [0, 0, 0], 1, true);
    expect(a[2]).toBe(BRAWL_SWAY.float.up);
    expect(a[1]).toBe(-BRAWL_SWAY.float.back);
  });
  it("a gale's wind blowing the way the body faces is a tailwind", () => {
    expect(swayAir([0, 0, 0], [20, 0, 0], 1)[1]).toBe(20);
    expect(swayAir([0, 0, 0], [20, 0, 0], -1)[1]).toBe(-20);
  });
});

describe('the hang (swayHang)', () => {
  it('still air bends nothing', () => { expect(swayHang([0, 0, 0], BRAWL_SWAY.hair)).toEqual([0, 0]); });
  it('a headwind streams the hair back, more the faster, and never past its most', () => {
    const at = (v) => swayHang([0, -v, 0], BRAWL_SWAY.hair);
    // (bending back, toward -y, is a negative turn about x)
    expect(at(3)[0]).toBeLessThan(0);
    expect(Math.abs(at(6)[0])).toBeGreaterThan(Math.abs(at(3)[0]));
    expect(Math.abs(at(60)[0])).toBeCloseTo(BRAWL_SWAY.hair.max);
    expect(at(3)[1]).toBeCloseTo(0);
  });
  it('the angle is the drag against the weight: tan θ = drag·v² / g', () => {
    const v = 4, th = Math.abs(swayHang([0, -v, 0], BRAWL_SWAY.hair)[0]);
    expect(Math.tan(th)).toBeCloseTo((BRAWL_SWAY.hair.drag * v * v) / BRAWL_SWAY.G, 6);
  });
  it('cloth is heavier for the air than hair: the same headwind bends it less', () => {
    expect(Math.abs(swayHang([0, -5, 0], BRAWL_SWAY.cloth)[0])).toBeLessThan(Math.abs(swayHang([0, -5, 0], BRAWL_SWAY.hair)[0]));
  });
  it('an updraft under a moving floater lifts what hangs further than the same glide on the ground', () => {
    const ground = Math.abs(swayHang([0, -3, 0], BRAWL_SWAY.hair)[0]), borne = Math.abs(swayHang([0, -3, BRAWL_SWAY.float.up], BRAWL_SWAY.hair)[0]);
    expect(borne).toBeGreaterThan(ground);
  });
});

describe('the spring (swayStep)', () => {
  it('settles on the hang', () => {
    const a = [0, -4, 0], st = settle(a, BRAWL_SWAY.hair), h = swayHang(a, BRAWL_SWAY.hair);
    expect(st.wx).toBeCloseTo(h[0], 3);
  });
  it('the hair swings past its hang and back (underdamped); stepping nothing holds it', () => {
    const a = [0, -6, 0], h = swayHang(a, BRAWL_SWAY.hair), st = { wx: 0, wy: 0, vx: 0, vy: 0 }, P = { ...BRAWL_SWAY.hair, flutter: 0 };
    let most = 0;
    for (let f = 1; f <= 120; f++) { swayStep(st, h, a, P, 1, f, 0); most = Math.max(most, -st.wx); }
    expect(most).toBeGreaterThan(-h[0]);
    const held = { ...st };
    swayStep(st, h, a, P, 0, 120, 0);
    expect(st).toEqual(held);
  });
  it('a floater billows in still air; a body on the ground in still air stays at rest', () => {
    const P = BRAWL_SWAY.hair, still = { wx: 0, wy: 0, vx: 0, vy: 0 }, borne = { wx: 0, wy: 0, vx: 0, vy: 0 };
    swayStep(still, [0, 0], [0, 0, 0], P, 60, 60, 0, false);
    swayStep(borne, [0, 0], [0, 0, 0], P, 60, 60, 0, true);
    expect(still).toEqual({ wx: 0, wy: 0, vx: 0, vy: 0 });
    expect(Math.hypot(borne.wx, borne.wy)).toBeGreaterThan(0.01);
  });
});

describe('the bend (swayRegion, swayBend)', () => {
  const pos = strand(), R = swayRegion(pos, 1.5 - 0.001, [0, -0.08]);
  it('takes what hangs below the root, and nothing that hangs less than the least', () => {
    expect(R.idx.length).toBe(18);
    expect(swayRegion(pos, 1.5 - 0.001, [0, -0.08], () => true, 0.5)).toBe(null);
  });
  it('no turn gives back the rest positions, byte for byte', () => {
    const out = pos.slice();
    out.fill(7);
    swayBend(out, pos, R, 0, 0);
    for (const i of R.idx) for (let c = 0; c < 3; c++) expect(out[i * 3 + c]).toBe(pos[i * 3 + c]);
  });
  it('bends the tip the way the turn says and keeps the strand its length', () => {
    const out = pos.slice();
    swayBend(out, pos, R, -0.8, 0);
    // the tip (the middle vertex at the bottom) swung back (−y) and up
    const tip = 3 * (6 * 3 + 1);
    expect(out[tip + 1]).toBeLessThan(pos[tip + 1] - 0.05);
    expect(out[tip + 2]).toBeGreaterThan(pos[tip + 2]);
    // its axis's length: the sum of the middle column's links, as at rest
    let rest = 0, bent = 0;
    for (let d = 1; d <= 6; d++) {
      const a = 3 * ((d - 1) * 3 + 1), b = 3 * (d * 3 + 1);
      rest += Math.hypot(pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]);
      bent += Math.hypot(out[b] - out[a], out[b + 1] - out[a + 1], out[b + 2] - out[a + 2]);
    }
    expect(bent).toBeCloseTo(rest, 3);
  });
  it('a vertex at the root does not move', () => {
    const R0 = swayRegion(pos, 1.5 + 1e-4, [0, -0.08]), out = pos.slice(), first = R0.idx[0] * 3;
    swayBend(out, pos, R0, 0.9, 0.4);
    expect(Math.hypot(out[first] - pos[first], out[first + 1] - pos[first + 1], out[first + 2] - pos[first + 2])).toBeLessThan(0.001);
  });
});
