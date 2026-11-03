// the time map: a shot shows the world's clock on the screen's — stretched, ramped, held, its camera on the screen's
// clock, its world on twos — and a shot without one plays as it always did
import { describe, it, expect } from 'vitest';
import { normalizeShoot, shootReadout } from './plan.js';
import { programOf, shotAt, sampleProgram } from './sample.js';
import { timeline, clocksAt, normalizeTime, MIN_SPEED } from './time.js';

const CAM = { id: 'c', keys: [{ t: 0, pos: [0, -5, 1], poi: [0, 0, 0] }, { t: 4, pos: [5, 0, 1], poi: [0, 0, 0] }] };
const shotOf = (s) => normalizeShoot({ cameras: [CAM], shots: [{ name: 'a', camera: 'c', span: [0, 4], ...s }] });
const tlOf = (s) => { const { plan } = shotOf(s); return { s: plan.shots[0], tl: timeline(plan.shots[0], plan.fps) }; };
const worlds = (tl, span, n = 400) => Array.from({ length: n + 1 }, (_, j) => clocksAt(tl, span, (tl.length * j) / n).t);

describe('the time map', () => {
  it('absent adds nothing: no field, no compiled map on the running order, no camera clock on a frame', () => {
    const { plan } = shotOf({});
    expect(plan.shots[0]).toEqual({ name: 'a', camera: 'c', span: [0, 4] });
    expect(programOf(plan).shots[0]).not.toHaveProperty('tl');
    expect(sampleProgram(plan, { fps: 4 }).some((f) => 'camera_t' in f)).toBe(false);
    expect(shootReadout(plan).shots[0]).not.toHaveProperty('time');
  });

  it('a stretch over the whole span plays as the shot\'s constant speed', () => {
    const { s, tl } = tlOf({ time: [{ span: [0, 4], speed: 0.25 }] });
    expect(tl.length).toBeCloseTo((s.span[1] - s.span[0]) / 0.25, 12);
    for (const u of [0, 1, 7.5, 16]) expect(clocksAt(tl, s.span, u).t).toBeCloseTo(0.25 * u, 12);
  });

  it('every map runs forward and lands on the span\'s end; a hold holds its instant and adds its length', () => {
    const { s, tl } = tlOf({ time: [{ span: [1, 3], speed: 0.2, ramp: 0.5 }, { at: 2, hold: 1.5 }, { at: 3.5, frames: 12 }] });
    const W = worlds(tl, s.span);
    for (let j = 1; j < W.length; j++) expect(W[j]).toBeGreaterThanOrEqual(W[j - 1] - 1e-12);
    expect(W.at(-1)).toBe(s.span[1]);
    const held = tl.pieces.filter((p) => p.s0 + p.s1 === 0);
    expect(held.map((p) => [p.t0, p.len])).toEqual([[2, 1.5], [3.5, 12 / 24]]);
    for (const p of held) for (const f of [0, 0.5, 1]) expect(clocksAt(tl, s.span, p.u0 + p.len * f).t).toBeCloseTo(p.t0, 9);
  });

  it('a ramp eases the speed: continuous on the screen\'s clock, down to the stretch\'s speed and back', () => {
    const { s, tl } = tlOf({ time: [{ span: [1, 3], speed: 0.2, ramp: 0.5 }] });
    for (let k = 1; k < tl.pieces.length; k++) expect(tl.pieces[k].s0).toBeCloseTo(tl.pieces[k - 1].s1, 12);
    expect(Math.min(...tl.pieces.map((p) => p.s1))).toBe(0.2);
    // the world covered equals the span, piece by piece
    const covered = tl.pieces.reduce((n, p) => n + (p.len * (p.s0 + p.s1)) / 2, 0);
    expect(covered).toBeCloseTo(s.span[1] - s.span[0], 12);
    // a hold inside the ramp splits it at its instant, speed unbroken across the hold
    const cut = tlOf({ time: [{ span: [1, 3], speed: 0.2, ramp: 0.5 }, { at: 1.2, hold: 0.5 }] }).tl;
    const i = cut.pieces.findIndex((p) => p.s0 + p.s1 === 0);
    expect(cut.pieces[i].t0).toBe(1.2);
    expect(cut.pieces[i + 1].s0).toBeCloseTo(cut.pieces[i - 1].s1, 12);
    expect(clocksAt(cut, s.span, cut.pieces[i].u0).t).toBeCloseTo(1.2, 9);
  });

  it('bullet time: the camera on the screen\'s clock moves while the world holds', () => {
    const { plan } = shotOf({ span: [1, 2], time: [{ at: 1.5, hold: 2 }], clock: 'screen' });
    const frames = sampleProgram(plan, { fps: 4 });
    const during = frames.filter((f) => f.world_t === 1.5);
    expect(during.length).toBeGreaterThan(6);
    expect(new Set(during.map((f) => f.camera_t)).size).toBe(during.length);
    expect(new Set(during.map((f) => f.worldFraming.cameraPosition.join())).size).toBe(during.length);
    expect(frames.at(-1).camera_t).toBe(1 + programOf(plan).total);
  });

  it('on twos: the world steps every other frame, the camera on ones', () => {
    const { plan } = shotOf({ grain: 'twos' });
    expect(plan.shots[0].grain).toBe(2);
    const f = sampleProgram(plan, { fps: 24 }).slice(0, 9);
    expect(f.map((x) => x.world_t)).toEqual([0, 0, 2, 2, 4, 4, 6, 6, 8].map((n) => Math.round((n / 24) * 1e4) / 1e4));
    expect(new Set(f.map((x) => x.camera_t ?? x.world_t)).size).toBe(9);   // (a frame names the camera's clock only where it parts)
  });

  it('reads the words people use, warns on what it drops, and normalizes to itself', () => {
    const warn = [];
    const got = normalizeTime({ span: [0, 4], time: [{ slow: [1, 2], speed: 0.5 }, { freeze: 3, for: 0.4 }, { from: 1.5, to: 2.5, speed: 0.3 }, { at: 1, hold: 0 }, { span: [1, 2], speed: MIN_SPEED / 2 }], clock: 'program', grain: 'threes' }, { warn: (m) => warn.push(m) });
    expect(got).toEqual({ time: [{ span: [1, 2], speed: 0.5 }, { at: 3, hold: 0.4 }], clock: 'screen', grain: 3 });
    expect(warn.join(' ')).toMatch(/overlaps/);
    expect(warn.join(' ')).toMatch(/no time/);
    expect(warn.join(' ')).toMatch(/needs a speed/);
    const once = shotOf({ time: [{ slow: [1, 2], speed: 0.5, ramp: 0.2 }, { freeze: 3, frames: 6 }], clock: 'screen', grain: 2 }).plan;
    expect(normalizeShoot(once).plan).toEqual(once);
    expect(shotAt(programOf(once), 0)).toMatchObject({ t: 0 });
  });

  it('the readout says how a warped shot plays', () => {
    const { plan } = shotOf({ time: [{ span: [1, 3], speed: 0.2, ramp: 0.5 }, { at: 2, hold: 1 }], grain: 2 });
    expect(shootReadout(plan).shots[0].time).toEqual({ world_s: 4, slowest: 0.2, held_s: 1, grain: 2 });
  });
});

describe('the time map on the page and in the edit', () => {
  const WARPED = { span: [0, 4], time: [{ span: [1, 3], speed: 0.2, ramp: 0.5 }, { at: 2, hold: 1 }], clock: 'screen', grain: 2 };

  it('the World page plays the kernel\'s own clock, and a plan without a map emits none of it', async () => {
    const { lowerShoot } = await import('./plan.js');
    const { shootChannelScript } = await import('../scene/channels/shoot.js');
    const { plan } = shotOf(WARPED);
    const low = lowerShoot(plan);
    expect(low.shots[0].tl.length).toBeCloseTo(programOf(plan).total, 12);
    const src = shootChannelScript(low);
    const fn = src.slice(src.indexOf('const __shWarp = ') + 'const __shWarp = '.length, src.indexOf(';\n  const __shShot'));
    const page = new Function(`return (${fn});`)();
    for (const tau of [0, 0.7, 2.3, 4.1, 9.9, programOf(plan).total]) {
      const k = shotAt(programOf(plan), tau), p = page(low.shots[0].tl, low.shots[0].span, tau - low.shots[0].start);
      expect(p.t).toBe(k.t);
      expect(p.camera_t).toBe(k.camera_t ?? k.t);
    }
    expect(src).toContain('live ? (at.ct ?? at.t) : r.rest');
    const plain = shootChannelScript(lowerShoot(shotOf({}).plan));
    expect(plain).not.toContain('__shWarp');
    expect(plain).not.toContain('at.ct');
    expect(shootChannelScript({ ...low, live: true })).not.toContain('__shWarp');
  });

  it('a live world says it plays the map in real time', async () => {
    const { liveNotes } = await import('./plan.js');
    expect(liveNotes(shotOf(WARPED).plan, new Map()).join(' ')).toMatch(/time map/);
    expect(liveNotes(shotOf({}).plan, new Map()).join(' ')).not.toMatch(/time map/);
  });

  it('the edits: set_shot sets and takes away a map; retime moves its world instants and keeps its holds', async () => {
    const { applyShootOp } = await import('./ops.js');
    const base = shotOf({}).plan;
    const set = normalizeShoot(applyShootOp(base, { op: 'set_shot', shot: 'a', time: [{ slow: [1, 2], speed: 0.5 }, { freeze: 3, for: 1 }], grain: 'twos' }).plan).plan;
    expect(set.shots[0]).toMatchObject({ time: [{ span: [1, 2], speed: 0.5 }, { at: 3, hold: 1 }], grain: 2 });
    const re = normalizeShoot(applyShootOp(set, { op: 'retime', scale: 2 }).plan).plan;
    expect(re.shots[0].time).toEqual([{ span: [2, 4], speed: 0.5 }, { at: 6, hold: 1 }]);
    const off = normalizeShoot(applyShootOp(set, { op: 'set_shot', shot: 'a', time: null, grain: null }).plan).plan;
    expect(off.shots[0]).toEqual(base.shots[0]);
  });
});
