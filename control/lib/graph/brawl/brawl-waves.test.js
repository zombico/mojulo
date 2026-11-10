import { describe, it, expect } from 'vitest';
import { readRangeWaves, stationsOf, entryOf, volleyAt, FORMATION_IDS, PATTERN_IDS, WAVE_RULES } from './brawl-waves.js';
import { practiceOf, stepYard, resetYard, yardRead } from './brawl-practice.js';
import { brawlPreset } from './brawl-levels.js';
import { brawlHash } from './brawl-core.js';
import { solveFighter } from '../versus/versus-solver.js';

// THE WAVE TESTER (the range's waves): a group of the crowd's types comes in together, from the view's edges or the
// street's back, to its formation's stations round the player, and its shooters fire to its attack pattern (together,
// one after another, by halves, by sides); its brawlers fight as the street's crowd; cleared when its last falls, the
// next after a breath, the set over again; each clear's time and the rounds taken kept.
const { belt } = brawlPreset('yard');
const recipe = { ...solveFighter({ id: 'hero', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder' };
const range = (waves, o = {}) => practiceOf({ belt, players: [{ recipe }], dummies: [], range: { guns: ['machine-gun'], waves, ...o } });
function run(r, n, fn = () => ({})) {
  const ev = [];
  for (let k = 0; k < n; k++) { r = stepYard(r, [fn(r)]); ev.push(...r.s.events.map((e) => ({ ...e, f: r.s.f }))); }
  return { r, ev };
}
// (a player that clears a wave: onto the nearest standing body's line across the street, then the stream along it)
const clearer = (r) => {
  const me = r.s.bodies[0], foes = r.s.bodies.filter((b) => b.side === 'crowd' && !b.gone && !b.ko);
  if (!foes.length) return {};
  const t = foes.reduce((a, b) => (Math.abs(b.z - me.z) < Math.abs(a.z - me.z) ? b : a));
  return Math.abs(t.z - me.z) > 150 ? { z: Math.sign(t.z - me.z) } : { a: true, x: Math.sign(t.x - me.x), h: true };
};
const band = belt.depth.map((v) => Math.round(v * 1000)), view = [0, 24000], at = [8000, 0];

describe('brawl waves: its words', () => {
  it('a wave\'s crowd, formation and pattern are read; one it does not know refused', () => {
    const [w] = readRangeWaves([{ crowd: [{ type: 'rifleman', n: 3 }] }]);
    expect(w).toMatchObject({ formation: 'line', pattern: 'tokens', beat: WAVE_RULES.beat, after: WAVE_RULES.after });
    expect(() => readRangeWaves([{ crowd: [{ type: 'ninja', n: 1 }] }])).toThrow(/type/);
    expect(() => readRangeWaves([{ crowd: [{ type: 'thug', n: 1 }], formation: 'wedge' }])).toThrow(/formation/);
    expect(() => readRangeWaves([{ crowd: [{ type: 'thug', n: 1 }], pattern: 'spiral' }])).toThrow(/pattern/);
    expect(() => readRangeWaves([{ crowd: [{ type: 'thug', n: 8 }, { type: 'thug', n: 8 }] }])).toThrow(/12/);
  });
});

describe('brawl waves: the formations', () => {
  const st = (f, n = 4) => stationsOf(f, n, at, band, view);
  it('every formation\'s stations on the street, in its band and the view', () => {
    for (const f of FORMATION_IDS) for (const [x, z] of st(f)) {
      expect(x, f).toBeGreaterThan(view[0]); expect(x, f).toBeLessThan(view[1]);
      expect(z, f).toBeGreaterThanOrEqual(band[0]); expect(z, f).toBeLessThanOrEqual(band[1]);
    }
  });
  it('a line across the street ahead; a column on the player\'s line; a pincer both sides; a surround all round; the back the far side', () => {
    const line = st('line'), col = st('column'), pin = st('pincer'), sur = st('surround'), back = st('back');
    expect(new Set(line.map((p) => p[0])).size).toBe(1);
    expect(new Set(line.map((p) => p[1])).size).toBe(4);
    expect(col.every((p) => p[1] === at[1])).toBe(true);
    expect(col.map((p) => p[0])).toEqual([...col.map((p) => p[0])].sort((a, b) => a - b));
    expect(pin.some((p) => p[0] < at[0]) && pin.some((p) => p[0] > at[0])).toBe(true);
    expect(sur.some((p) => p[0] < at[0]) && sur.some((p) => p[0] > at[0]) && sur.some((p) => p[1] > at[1]) && sur.some((p) => p[1] < at[1])).toBe(true);
    expect(back.every((p) => p[1] >= band[1] - 300)).toBe(true);
    // (each comes in from the view's edge on its side, a back from the street's back)
    expect(entryOf(pin.find((p) => p[0] < at[0]), at, band, view, 'pincer')[0]).toBeLessThan(view[0]);
    expect(entryOf(back[0], at, band, view, 'back')[1]).toBe(band[1]);
  });
});

describe('brawl waves: the attack patterns', () => {
  it('when in each beat each shooter starts: together, one after another, by halves, by sides', () => {
    const at4 = (p, side = () => 1) => [0, 1, 2, 3].map((k) => volleyAt(p, k, 4, side(k), 120));
    expect(at4('volley')).toEqual([0, 0, 0, 0]);
    expect(at4('sweep')).toEqual([0, 1, 2, 3].map((k) => k * WAVE_RULES.gap));
    expect(at4('alternate')).toEqual([0, 60, 0, 60]);
    expect(at4('pincer', (k) => (k % 2 ? -1 : 1))).toEqual([0, 60, 0, 60]);
    expect(PATTERN_IDS).toContain('tokens');
  });
  const fires = (pattern, formation = 'line', n = 3) => {
    const { ev } = run(range([{ crowd: [{ type: 'rifleman', n, hp: 9999 }], formation, pattern, beat: 120 }]), 600);
    return ev.filter((e) => e.t === 'fire' && e.p > 0);
  };
  it('a volley: all its shooters\' rounds on one frame', () => {
    const f = fires('volley');
    const byFrame = new Map(); for (const e of f) byFrame.set(e.f, [...(byFrame.get(e.f) ?? []), e.p]);
    expect([...byFrame.values()].some((ps) => ps.length === 3)).toBe(true);
  });
  it('a sweep: one after another, the gap apart', () => {
    const f = fires('sweep');
    const first = [1, 2, 3].map((p) => f.find((e) => e.p === p).f).sort((a, b) => a - b);
    expect(first[1] - first[0]).toBe(WAVE_RULES.gap);
    expect(first[2] - first[1]).toBe(WAVE_RULES.gap);
  });
  it('by halves: the two halves half a beat apart, so one is always firing', () => {
    const f = fires('alternate', 'line', 4);
    const frames = [...new Set(f.map((e) => e.f))].sort((a, b) => a - b);
    expect(frames[1] - frames[0]).toBe(60);
  });
});

describe('brawl waves: a run', () => {
  const two = [{ crowd: [{ type: 'rifleman', n: 2, hp: 30 }], formation: 'line', pattern: 'volley', after: 40 }, { crowd: [{ type: 'gunner', n: 2, hp: 30 }], formation: 'column', pattern: 'sweep', after: 40 }];
  it('a wave comes in after its breath from the view\'s edge, to its stations; nothing of the next until it is cleared', () => {
    const { r, ev } = run(range(two), 60);
    const w = ev.find((e) => e.t === 'wave');
    expect(w).toMatchObject({ k: 0, of: 2, n: 2 });
    expect(r.s.bodies.slice(1).filter((b) => !b.gone).length).toBe(2);
    expect(yardRead(r).wave).toMatchObject({ n: 1, of: 2, pattern: 'volley', formation: 'line', state: 'on', left: 2 });
  });
  it('cleared as its last falls (its time kept), the next after it, the set over again', () => {
    const { r, ev } = run(range(two), 2400, clearer);
    const cleared = ev.filter((e) => e.t === 'waveCleared');
    expect(cleared.slice(0, 2).map((e) => e.k)).toEqual([0, 1]);
    expect(cleared[0].frames).toBeGreaterThan(0);
    expect(ev.filter((e) => e.t === 'wave').map((e) => e.k).slice(0, 3)).toEqual([0, 1, 0]);
    expect(yardRead(r).wave.rounds).toBeGreaterThanOrEqual(1);
  });
  it('a wave of brawlers fights as the street\'s crowd: its blows on the player', () => {
    const { ev } = run(range([{ crowd: [{ type: 'thug', n: 3 }], formation: 'surround' }]), 900);
    expect(ev.some((e) => e.t === 'hit' && e.d === 0 && e.kind !== 'round')).toBe(true);
  });
  it('a reset: the run from its first wave again; the same range and buttons, the same yard', () => {
    const { r } = run(range(two), 300, clearer);
    const back = resetYard(r);
    expect(yardRead(back).wave).toMatchObject({ n: 1, state: 'wait', cleared: [] });
    expect(back.s.bodies.slice(1).every((b) => b.gone)).toBe(true);
    const go = () => brawlHash(run(range(two), 600, clearer).r.s);
    expect(go()).toBe(go());
  });
});
