// Real seconds (gait calibration phase 3): a stamped motion names its loop in seconds, and the GIF and the exported clip
// play it in real time; a bare motion keeps the 30-frame, 18 fps loop it always had.
import { describe, it, expect } from 'vitest';
import { stampMotion, motionSeconds, WALK_MINT, WAVE_MINT, EMOTE_MINT } from './figure-posing.js';
import { motionTiming, sampleMotionPose, balancedArmature } from './figure-render.js';
import { assembleFigureScene } from '../figures/figure-world.js';

const CM = 85 / 0.61;   // STAND → cm at an 85 cm standing hip height
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.round(p * (s.length - 1))]; };
const run = (motion) => {
  const { frames, fps } = motionTiming(motion);
  return { dt: 1 / fps, A: Array.from({ length: frames }, (_, i) => balancedArmature(sampleMotionPose(motion, i / frames, frames))) };
};

describe('motionSeconds and motionTiming', () => {
  it('a bare motion names no time and keeps the GIF loop it always had', () => {
    for (const m of ['walk', 'sprint', 'wave', 'bow', { emote: 'nod' }]) {
      expect(motionSeconds(m)).toBe(null);
      expect(motionTiming(m)).toEqual({ frames: 30, fps: 18 });
    }
  });

  it('a stamped motion plays its loop in real seconds', () => {
    expect(motionSeconds(stampMotion('walk'))).toBe(WALK_MINT.seconds);
    expect(motionSeconds({ walk: { ...WALK_MINT, cadence: 2 } })).toBeCloseTo(2 * WALK_MINT.seconds, 9);
    expect(motionSeconds(stampMotion('wave'))).toBe(WAVE_MINT.seconds);
    expect(motionSeconds(stampMotion('bow'))).toBe(EMOTE_MINT.bow.seconds);
    for (const m of ['walk', 'sprint', 'wave', 'bow']) {
      const s = stampMotion(m), t = motionTiming(s);
      expect(t.frames / t.fps).toBeCloseTo(motionSeconds(s), 1);
      expect(t.frames).toBeGreaterThanOrEqual(16);
    }
  });

  it('the walk takes 110 steps a minute, as people walk (a bare walk took 72)', () => {
    const t = motionTiming(stampMotion('walk'));
    expect(Math.round(120 / (t.frames / t.fps))).toBeGreaterThanOrEqual(100);
    expect(Math.round(120 / (t.frames / t.fps))).toBeLessThanOrEqual(120);
  });

  it('an explicit animate { frames, fps } wins', () => {
    expect(motionTiming(stampMotion('walk'), { frames: 12, fps: 10 })).toEqual({ frames: 12, fps: 10 });
  });
});

describe('the wave and the bow as minted now, against measured people', () => {
  it('the wave sweeps 1 … 2.2 times a second, 12 … 24 cm wide (the frozen wave: 4.5 a second, 6 cm)', () => {
    const { A, dt } = run(stampMotion('wave'));
    const idx = A.map((a, i) => (a.wristR.z > a.shoulderR.z ? i : -1)).filter((i) => i >= 0);
    const lat = idx.map((i) => A[i].wristR.x - A[i].neckHub.x); const m0 = lat.reduce((a, b) => a + b, 0) / lat.length;
    let zc = 0; for (let i = 1; i < lat.length; i++) if ((lat[i] - m0) * (lat[i - 1] - m0) < 0) zc++;
    const hz = zc / 2 / (idx.length * dt), width = (pct(lat, 0.97) - pct(lat, 0.03)) * CM;
    expect(hz).toBeGreaterThan(1); expect(hz).toBeLessThan(2.2);
    expect(width).toBeGreaterThan(12); expect(width).toBeLessThan(24);
  });

  it('the bow goes down and comes up in about 0.5 … 0.9 s and holds 1 … 1.6 s (the frozen bow: 0.28 s, 0.5 s held)', () => {
    const { A, dt } = run(stampMotion('bow'));
    const trunk = A.map((a) => Math.atan2(a.neckHub.y - a.pelvisHub.y, a.neckHub.z - a.pelvisHub.z));
    const f = trunk.map((x) => x - trunk[0]); const pk = f.reduce((b, x, i) => (x > f[b] ? i : b), 0);
    const st = f.findIndex((x) => x > 0.1 * f[pk]), en = f.length - 1 - [...f].reverse().findIndex((x) => x > 0.1 * f[pk]);
    const hs = f.findIndex((x) => x > 0.9 * f[pk]), he = f.length - 1 - [...f].reverse().findIndex((x) => x > 0.9 * f[pk]);
    for (const s of [(hs - st) * dt, (en - he) * dt]) { expect(s).toBeGreaterThan(0.5); expect(s).toBeLessThan(0.9); }
    expect((he - hs) * dt).toBeGreaterThan(1); expect((he - hs) * dt).toBeLessThan(1.6);
  });
});

describe('the exported clip', () => {
  it('a stamped motion exports its clip at its seconds; a bare one keeps the runtime\'s one cycle a second', () => {
    const timed = assembleFigureScene({ kind: 'figure', motion: stampMotion('walk') }).figures.figure.clips.forward;
    expect(timed.s).toBe(WALK_MINT.seconds);
    const bare = assembleFigureScene({ kind: 'figure', motion: 'walk' }).figures.figure.clips.forward;
    expect(bare.s).toBeUndefined();
  });
});
