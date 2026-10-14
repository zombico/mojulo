// Adaptive music's LAWS: the meter, the bar line, the hysteresis, and the page that runs them (the emitted closure is
// the same function these tests hold).
import { describe, it, expect, vi } from 'vitest';
import { buildAdaptive, resolveTension, MECHANIC_TENSION, TENSION_DEFAULTS } from './adaptive-music.js';
import { MECHANIC_KINDS } from '../game/mechanics.js';
import { surfaced, globMatch } from './mechanic-events.fixture.js';
import { audioChannelScript } from '../scene/channels/audio.js';
import { resolveWorldAudio } from './beats-world.js';
import { buildBus } from '../worlds/event-bus.js';
import { goalAudio } from '../gameworld/quick.js';
import { suggestScore, levelScoreContext } from './score-suggest.js';
import { STAGE_KITS } from '../era/stage.js';

const A = buildAdaptive();
// a seeded stream (mulberry32), so a failing law replays
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

describe('the meter', () => {
  it('stays in [0, 1]: a raise caps at 1, a leak falls toward 0 and never past it, no time no leak', () => {
    const R = rng(1), on = { 'hit:*': 0.35, spotted: 0.7 };
    let t = 0;
    for (let i = 0; i < 5000; i++) {
      const before = t;
      if (R() < 0.3) { t = A.raise(t, R() < 0.5 ? 'hit:foe' : 'spotted', on); expect(t).toBeGreaterThanOrEqual(before); }
      else { t = A.leak(t, R() * 0.5, 6); expect(t).toBeLessThanOrEqual(before); }
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
    }
    expect(A.leak(0.5, 0, 6)).toBe(0.5);
    expect(A.raise(0.2, 'pickup:coin', on)).toBe(0.2);   // an event it does not listen for adds nothing
  });

  it('every danger row is an event its mechanic can surface', () => {
    for (const [kind, rows] of Object.entries(MECHANIC_TENSION)) {
      expect(MECHANIC_KINDS).toContain(kind);
      const { events } = surfaced(kind);
      for (const g of Object.keys(rows)) expect(events.some((t) => globMatch(g, t)), `${kind}: '${g}'`).toBe(true);
    }
  });

  it("listens to the level's own dangers, else every mechanic's; a written `on` wins; exit sits under enter", () => {
    expect(resolveTension(undefined, ['unseen']).on).toEqual(MECHANIC_TENSION.unseen);
    const all = resolveTension(undefined, ['collect']).on;
    for (const rows of Object.values(MECHANIC_TENSION)) for (const g of Object.keys(rows)) expect(all).toHaveProperty([g]);
    expect(resolveTension({ on: { boom: 1 } }, ['unseen']).on).toEqual({ boom: 1 });
    expect(resolveTension(undefined, [])).toMatchObject(TENSION_DEFAULTS);
    expect(() => resolveTension({ enter: 0.3, exit: 0.4 })).toThrow(/exit/);
  });
});

describe('the bar line', () => {
  it('a change lands on the playing piece\'s bar line, at or after the earliest moment, within one bar of it', () => {
    const R = rng(2);
    for (let i = 0; i < 2000; i++) {
      const t0 = R() * 10, bar = 0.5 + R() * 3, earliest = t0 + R() * 60;
      const at = A.nextBar(earliest, t0, bar), k = (at - t0) / bar;
      expect(at).toBeGreaterThanOrEqual(earliest - 1e-9);
      expect(at - earliest).toBeLessThan(bar + 1e-9);
      expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
    }
  });

  it('a bar is the meter\'s quarters at the tempo', () => {
    expect(A.barSeconds({ bpm: 120 })).toBeCloseTo(2, 9);
    expect(A.barSeconds({ bpm: 90, meter: '3/4' })).toBeCloseTo(2, 9);
    expect(A.barSeconds({ bpm: 60, meter: '6/8' })).toBeCloseTo(3, 9);
  });
});

describe('the change, with hysteresis', () => {
  // play a seeded stream of frames and events through the state machine
  function play(seed, frames, eventRate) {
    const R = rng(seed), cfg = { ...TENSION_DEFAULTS, on: { 'hit:*': 0.35, spotted: 0.7 } }, bar = 2;
    let t = 0, s = { active: 'explore', below: 0 }, now = 0;
    const log = [];
    for (let i = 0; i < frames; i++) {
      const dt = 1 / 60;
      now += dt;
      if (R() < eventRate) t = A.raise(t, R() < 0.7 ? 'hit:foe' : 'spotted', cfg.on);
      t = A.leak(t, dt, cfg.decay);
      const next = A.decide(s, t, dt, cfg, bar);
      log.push({ now, t, from: s.active, to: next.to, below: s.below });
      s = next;
    }
    return { log, cfg, bar };
  }

  it('combat comes in only at enter or above; it leaves only after hold bars at or under exit', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { log, cfg, bar } = play(seed, 60 * 240, 0.004);
      let settled = 0;
      for (const f of log) {
        if (f.to === 'combat') expect(f.t).toBeGreaterThanOrEqual(cfg.enter);
        if (f.from === 'combat') settled = f.t <= cfg.exit ? settled + 1 / 60 : 0;
        if (f.to === 'explore') expect(settled).toBeGreaterThanOrEqual(cfg.hold * bar - 1e-6);
      }
    }
  });

  it('never flaps: a fight lasts at least hold bars of calm, and a quiet level never leaves explore', () => {
    for (const seed of [11, 12, 13, 14]) {
      const { log, cfg, bar } = play(seed, 60 * 240, 0.004);
      let since = null;
      for (const f of log) {
        if (f.to === 'combat') since = f.now;
        if (f.to === 'explore') expect(f.now - since).toBeGreaterThanOrEqual(cfg.hold * bar - 1e-6);
      }
    }
    expect(play(99, 60 * 120, 0).log.every((f) => f.from === 'explore' && !f.to)).toBe(true);
  });
});

describe('the page', () => {
  const SOUNDTRACK = 'field:forest', COMBAT = 'field:battle';

  it('emits the tested closure, and nothing of it without combat or a tension binding', () => {
    const audio = resolveWorldAudio({ soundtrack: SOUNDTRACK, combat: COMBAT }, { ref: 'lv', mechanics: ['hp-pool'] });
    expect(audioChannelScript(audio)).toContain(buildAdaptive.toString());
    const plain = audioChannelScript(resolveWorldAudio({ soundtrack: SOUNDTRACK }, { ref: 'lv' }));
    expect(plain).not.toContain('__tension');
    expect(plain).not.toContain('__engs');
  });

  it('a fight on the bus brings combat in on the bar line, and calm takes it back out', () => {
    vi.useFakeTimers();
    try {
      const audio = resolveWorldAudio({ soundtrack: SOUNDTRACK, combat: COMBAT, tension: { decay: 1 } }, { ref: 'lv', mechanics: ['hp-pool'] });
      const script = audioChannelScript(audio);
      const block = script.slice(script.indexOf('// THE TENSION'), script.indexOf('window.__mojMusic'));
      // stand-ins: an AudioContext clock we drive, engines that record what they were told, frames we pump
      const ctx = { currentTime: 0, state: 'running' }, frames = [];
      const engine = (name) => {
        const gain = { value: name === 'combat' ? 0 : 0.9, ramps: [], cancelScheduledValues() {}, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v, t) { this.ramps.push([v, t]); this.value = v; } };
        return { name, started: [], stopped: 0, master: { gain }, startComposition(r) { this.started.push(ctx.currentTime); }, startPattern() {}, startAmbient() {}, stop() { this.stopped++; } };
      };
      const bus = buildBus();
      const run = new Function('__AUDIO', '__BUS', '__beatsCtx', '__beatsMuted', '__beatsVol', '__BEATS_PATCHES', 'requestAnimationFrame', 'window',
        `${block}; return { get t() { return __tension; }, get music() { return __music; }, set engs(e) { __engs = e; }, set t0(v) { __musicT0 = v; }, start: __startTrack };`);
      const env = run(audio, bus, ctx, false, 1, {}, (f) => frames.push(f), {});
      const engs = { explore: engine('explore'), combat: engine('combat') };
      env.engs = engs; env.t0 = 0.08;
      const pump = (seconds) => { for (let i = 0; i < seconds * 60; i++) { ctx.currentTime += 1 / 60; const f = frames.splice(0); f.forEach((fn) => fn()); vi.advanceTimersByTime(1000 / 60); } };
      const state = bus.createBusState({ reactions: [] }, []);
      pump(1);
      expect(env.music.active).toBe('explore');
      for (let i = 0; i < 3; i++) bus.processEvents(state, [{ type: 'hit:foe' }]);   // three hits: 1.05, capped at 1
      expect(env.t).toBeGreaterThanOrEqual(0.6);
      pump(4);
      expect(env.music.active).toBe('combat');
      expect(engs.combat.started).toHaveLength(1);
      const bar = buildAdaptive().barSeconds(audio.soundtrack), k = (engs.combat.started[0] + 0.08 - 0.08) / bar;
      expect(Math.abs(k - Math.round(k))).toBeLessThan(0.05);   // started on an explore bar line (a frame's slop)
      expect(engs.combat.master.gain.ramps.at(-1)[0]).toBeCloseTo(0.9, 6);   // faded in
      expect(engs.explore.master.gain.ramps.at(-1)[0]).toBe(0);              // and the explore piece out
      pump(60);   // the meter leaks back under exit and holds there
      expect(env.music.active).toBe('explore');
      expect(engs.explore.started).toHaveLength(1);
      expect(engs.combat.stopped).toBeGreaterThanOrEqual(1);
    } finally { vi.useRealTimers(); }
  });
});

describe('the suggestion plays it', () => {
  it("design_game's music 'auto' on a fight writes the scene's score and the fight's, in one identity", () => {
    for (const kit of Object.keys(STAGE_KITS)) for (const goal of ['battle', 'shoot', 'defend']) for (const final of [false, true]) {
      const manifest = { kind: 'stage', kit, title: 'run' };
      const s = suggestScore(levelScoreContext(manifest, { goal, final }));
      const a = goalAudio({ goal, music: 'auto' }, { manifest, final, game: 77 });
      expect(a.soundtrack.score, `${kit} ${goal}`).toMatchObject({ mood: s.explore, game: 77 });
      expect(a.combat.score).toMatchObject({ mood: s.mood, game: 77 });
      expect(resolveWorldAudio(a, { ref: 'lv', mechanics: ['hp-pool'] }).combat).toMatchObject({ loop: true });
    }
  });
});
