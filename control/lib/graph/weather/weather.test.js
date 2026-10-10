import { describe, it, expect } from 'vitest';
import {
  STATES, STATE_NAMES, CLIMATES, FALL_GLYPHS, IMPACTS, FAMILIES, SOUND_BANKS, FALL_BOX, IMPACT_LIFE, buildWeatherLib,
  readWeather, weatherAt, weatherRuns, blendState, fallPoints, fallCount, impactPoints, impactCount, flashesIn, skyAt, dice,
} from './weather.js';

describe('the states are designed in values', () => {
  it('every state is values only: no colour anywhere, each value in 0…1', () => {
    for (const [n, s] of Object.entries(STATES)) {
      expect(JSON.stringify(s), n).not.toMatch(/color|#[0-9a-f]{3}|rgb/i);
      for (const k of ['veil', 'dim', 'sky', 'wind', 'gust']) expect(s[k], `${n}.${k}`).toBeGreaterThanOrEqual(0), expect(s[k], `${n}.${k}`).toBeLessThanOrEqual(1);
      expect(s.fog, n).toBeGreaterThan(0);
      expect(FAMILIES[s.family], n).toBeTruthy();
      expect(SOUND_BANKS, n).toContain(s.sound);
      if (s.fall) {
        expect(FALL_GLYPHS, n).toContain(s.fall.glyph);
        expect(IMPACTS[s.fall.impact], n).toBeTruthy();
        expect(s.fall.value).toBeGreaterThanOrEqual(0), expect(s.fall.value).toBeLessThanOrEqual(1);
      }
    }
  });
  it('heavier rain is more drops, faster, darker sky — the ladder holds', () => {
    const L = ['drizzle', 'rain', 'downpour', 'thunderstorm'].map((n) => STATES[n]);
    for (let i = 1; i < L.length; i++) {
      expect(L[i].fall.rate).toBeGreaterThan(L[i - 1].fall.rate);
      expect(L[i].sky).toBeLessThan(L[i - 1].sky);
    }
    expect(STATES.downpour.fall.impact).toBe('crowns');
    expect(STATES.thunderstorm.flash).toBeTruthy();
  });
  it('every climate weighs only states that exist', () => {
    for (const c of Object.values(CLIMATES)) for (const k of Object.keys(c.climate)) expect(STATE_NAMES).toContain(k);
  });
});

describe('reading a weather', () => {
  it('a preset, a state, or the shape', () => {
    expect(readWeather('monsoon')).toMatchObject({ climate: CLIMATES.monsoon.climate, dwell: [60, 180], blend: 20 });
    expect(readWeather('fog')).toMatchObject({ climate: { fog: 1 } });
    expect(readWeather({ climate: { rain: 2, clear: 0, snow: 1 }, start: 'rain', surface: 'tin' })).toEqual({ climate: { rain: 2, snow: 1 }, dwell: [90, 240], blend: 20, start: 'rain', surface: 'tin' });
  });
  it('says what is wrong', () => {
    const bad = (w, re) => expect(() => readWeather(w)).toThrow(re);
    bad('sleet', /neither a climate .* nor a state/);
    bad({ climate: { sleet: 1 } }, /climate.sleet is not a state/);
    bad({ climate: { rain: 0 } }, /nothing can happen/);
    bad({ climate: 'rain', colour: 1 }, /colour is not a weather setting/);
    bad({ climate: 'tundra' }, /not a climate/);
    bad({ climate: 'temperate', dwell: [100, 50] }, /dwell/);
    bad({ climate: 'temperate', dwell: [30, 60], blend: 40 }, /blend/);
    bad({ climate: 'temperate', surface: 'glass' }, /surface/);
  });
});

describe('the schedule', () => {
  const W = readWeather('temperate');
  it('the same seed is the same sky at every moment; another seed another sky', () => {
    const at = (s) => [0, 33, 400, 1234.5, 7200].map((t) => weatherAt(W, s, t));
    expect(at(7)).toEqual(at(7));
    expect(weatherRuns(W, 7, 3600)).not.toEqual(weatherRuns(W, 8, 3600));
  });
  it('each slot holds within its dwell, and the runs tile time', () => {
    const runs = weatherRuns(W, 3, 20000);
    let t = 0;
    for (const r of runs.slice(0, -1)) {
      expect(r.from).toBeCloseTo(t, 3);
      expect(r.to - r.from).toBeGreaterThanOrEqual(W.dwell[0] - 1e-3);
      expect(r.to - r.from).toBeLessThanOrEqual(W.dwell[1] + 1e-3);
      t = r.to;
    }
  });
  it('over a long run each state shows about as often as its weight says (its family pulls a little)', () => {
    const runs = weatherRuns(W, 11, 400000), n = {};
    for (const r of runs) n[r.is] = (n[r.is] ?? 0) + 1;
    expect(Object.keys(n).sort()).toEqual(Object.keys(W.climate).sort());
    expect(n.clear).toBeGreaterThan(n.thunderstorm * 4);
  });
  it('start opens the level; the blend eases continuously into the next', () => {
    expect(weatherAt(readWeather({ climate: 'temperate', start: 'fog' }), 5, 0).is).toBe('fog');
    const s = weatherAt(W, 2, 0), mid = (s.to - W.blend / 2);
    expect(weatherAt(W, 2, s.to - W.blend - 1).mix).toBe(0);
    if (s.next !== s.is) expect(weatherAt(W, 2, mid).mix).toBeCloseTo(0.5, 2);
    let last = 0;
    for (let t = s.to - W.blend; t < s.to; t += 0.5) { const m = weatherAt(W, 2, t).mix; expect(m).toBeGreaterThanOrEqual(last); last = m; }
  });
});

describe('a state between two', () => {
  it('the ends are the states, the fog eases in its log, falls trade rate', () => {
    const a = blendState('clear', 'fog', 0), b = blendState('clear', 'fog', 1), m = blendState('clear', 'fog', 0.5);
    expect(a.fog).toBeCloseTo(STATES.clear.fog, 4), expect(b.fog).toBeCloseTo(STATES.fog.fog, 4);
    expect(m.fog).toBeCloseTo(Math.sqrt(STATES.clear.fog * STATES.fog.fog), 3);
    const r = blendState('rain', 'snow', 0.25);
    expect(r.falls.map((f) => f.glyph)).toEqual(['streak', 'flake']);
    expect(r.falls[0].rate).toBeCloseTo(STATES.rain.fall.rate * 0.75, 4);
    expect(blendState('rain', 'thunderstorm', 0.4).flash.share).toBeCloseTo(0.4, 4);
    expect(blendState('clear', 'haze', 0.5).flash).toBeUndefined();
  });
});

describe('the fall round the camera', () => {
  const F = STATES.rain.fall, n = fallCount(F);
  it('one pool size, every particle in the camera\'s box, wherever the camera goes', () => {
    expect(n).toBeGreaterThan(500), expect(n).toBeLessThanOrEqual(FALL_BOX.cap);
    for (const cam of [[0, 0, 2], [513.3, -77, 40]]) for (const t of [0, 1.7, 60]) {
      const P = fallPoints(F, cam, t, n);
      expect(P).toHaveLength(n);
      for (const p of P) {
        expect(Math.abs(p.p[0] - cam[0])).toBeLessThanOrEqual(FALL_BOX.half + 1e-6);
        expect(Math.abs(p.p[2] - cam[2])).toBeLessThanOrEqual(FALL_BOX.height / 2 + 1e-6);
        expect(p.w).toBeGreaterThanOrEqual(0), expect(p.w).toBeLessThanOrEqual(1);
      }
    }
  });
  it('it falls: down, leaned by its slant, the same at the same t', () => {
    const a = fallPoints(F, [0, 0, 0], 0.01, 50), b = fallPoints(F, [0, 0, 0], 0.03, 50);
    expect(fallPoints(F, [0, 0, 0], 0.01, 50)).toEqual(a);
    const fell = a.filter((p, i) => b[i].p[2] < p.p[2]).length;
    expect(fell).toBeGreaterThan(45);
    expect(a[0].v[2]).toBeLessThan(0), expect(a[0].v[0]).toBeGreaterThan(0);
    expect(fallPoints(STATES.blizzard.fall, [0, 0, 0], 0, 1)[0].v[0]).toBeGreaterThan(-fallPoints(STATES.blizzard.fall, [0, 0, 0], 0, 1)[0].v[2]);
  });
  it('landings: re-rolled each cycle, within reach, u through 0…1', () => {
    const D = STATES.downpour.fall, m = impactCount(D);
    expect(m).toBeGreaterThan(50), expect(impactCount({ ...D, impact: 'none' })).toBe(0);
    const a = impactPoints(D, [4, 4, 0], 1, m), b = impactPoints(D, [4, 4, 0], 9, m);
    for (const q of a) expect(Math.hypot(q.p[0] - 4, q.p[1] - 4)).toBeLessThanOrEqual(9), expect(q.u).toBeGreaterThanOrEqual(0), expect(q.u).toBeLessThan(1);
    expect(a.map((q) => q.p)).not.toEqual(b.map((q) => q.p));
  });
});

describe('lightning', () => {
  const L = STATES.thunderstorm.flash;
  it('holds its rate, never twice in a slot, the same however the time is cut', () => {
    const all = flashesIn(L, 9, 0, 36000), gap = 36000 / all.length;
    expect(gap).toBeGreaterThan(L.every[0] * 0.8), expect(gap).toBeLessThan(L.every[1] * 1.2);
    const cut = [];
    for (let t = 0; t < 600; t += 0.016) cut.push(...flashesIn(L, 9, t, t + 0.016));
    expect(cut).toEqual(flashesIn(L, 9, 0, 600));
    const near = all.filter((f) => f.near).length / all.length;
    expect(near).toBeGreaterThan(0.2), expect(near).toBeLessThan(0.4);
    for (const f of all) expect(f.dist).toBeGreaterThan(f.near ? 299 : 1499);
  });
  it('a blend thins it: half the share, about half the flashes', () => {
    const full = flashesIn(L, 4, 0, 36000).length, half = flashesIn({ ...L, share: 0.5 }, 4, 0, 36000).length;
    expect(half / full).toBeGreaterThan(0.4), expect(half / full).toBeLessThan(0.6);
  });
});

describe('the dice', () => {
  it('one draw per (seed, n, salt), spread over 0…1', () => {
    expect(dice(1, 2, 3)).toBe(dice(1, 2, 3));
    const xs = Array.from({ length: 4000 }, (_, i) => dice(17, i, 1)), m = xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(m).toBeGreaterThan(0.47), expect(m).toBeLessThan(0.53);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
  it('the sky at t is the blend of the schedule', () => {
    const W = readWeather('monsoon'), s = skyAt(W, 1, 100);
    expect(s.state).toEqual(blendState(s.is, s.next, s.mix));
  });
});

describe('weather review fixes', () => {
  it('only own names are states, climates and settings (constructor is none)', () => {
    expect(() => readWeather({ climate: { constructor: 1 } })).toThrow(/not a state/);
    expect(() => readWeather('constructor')).toThrow(/neither a climate/);
    expect(() => readWeather({ climate: 'temperate', toString: 1 })).toThrow(/not a weather setting/);
    expect(() => readWeather({ climate: 'temperate', start: '__proto__' })).toThrow(/not a state/);
  });
  it('an unset blend never exceeds a short dwell', () => {
    const W = readWeather({ climate: 'temperate', dwell: [5, 10] });
    expect(W.blend).toBe(5);
    expect(() => readWeather({ climate: 'temperate', dwell: [5, 10], blend: 8 })).toThrow(/blend is seconds/);
  });
  it('the page lib is one closure: it runs with nothing but its three arguments, under any names', () => {
    const src = buildWeatherLib.toString(), run = new Function('S', 'B', 'I', `return (${src})(S, B, I);`)(STATES, FALL_BOX, IMPACT_LIFE);
    const W = readWeather({ climate: { rain: 1, snow: 1 }, dwell: [10, 20], blend: 4 });
    expect(run.weatherAt(W, 7, 33)).toEqual(weatherAt(W, 7, 33));
    expect(run.fallPoints(STATES.rain.fall, [0, 0, 1], 2, 10)).toEqual(fallPoints(STATES.rain.fall, [0, 0, 1], 2, 10));
  });
});
