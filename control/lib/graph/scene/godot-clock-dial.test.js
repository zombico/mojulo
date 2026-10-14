// THE CLOCK DIAL (II6): a level's clock darkens the sky at night and swaps its climate by season, on the page
// (channels/weather.js) and in Godot (kernel/weather.gd clock(), since 0.22.0), one dial (weather/clock-dial.js). A
// clock level played in both: its bus equal frame by frame, and the sky Godot shows at the end the dial's for the
// minute and season the bus holds.
import { describe, it, expect } from 'vitest';
import { composeMechanics } from '../game/mechanics.js';
import { readWeather } from '../weather/weather.js';
import { extractEngineScore } from './engine-score.js';
import { playBoth } from './godot-harness.js';
import { nightAt, nightLook } from '../weather/clock-dial.js';
import { capabilityRegistry } from '../cosmos/registry.js';

const GODOT = process.env.MOJULO_GODOT;
const quad = { corners: [[-20, -20, 0], [20, -20, 0], [20, 20, 0], [-20, 20, 0]] };
const HERO = { id: 'hero', pilotable: true, rule: { type: 'walk', eye: 1.7 }, transform: { pos: [0, 0, 1.7], heading: Math.PI / 2 } };
const SEASONS = ['spring-blossom', 'storm-coast', 'autumn', 'alpine'];
export function clockLevel({ start, seasons = 0 }) {
  const m = composeMechanics([{ kind: 'clock', start, rate: 60, ...(seasons ? { seasons } : {}) }, { kind: 'survive', seconds: 600 }], { player: 'hero', spawn: [0, 0, 0] });
  return {
    faces: [quad], entities: [HERO], events: m.events, game: { on: m.on },
    weather: { weather: readWeather({ climate: 'temperate' }), seed: 3, clock: true, ...(seasons ? { seasons: SEASONS.map((c) => readWeather({ climate: c })) } : {}) },
  };
}
const still = (n) => Array.from({ length: n }, () => ({}));

describe('the clock dial', () => {
  it('rides the weather row: the clock, and each season\'s schedule', () => {
    const w = extractEngineScore({ ref: 'r', manifest: {} }, clockLevel({ start: 18.5, seasons: 1 })).weather;
    expect(w.clock).toBe(true);
    expect(w.seasons.map((s) => s.states.length > 0 && s.timeline.length > 0)).toEqual([true, true, true, true]);
    expect(extractEngineScore({ ref: 'r', manifest: {} }, { ...clockLevel({ start: 8 }), weather: { weather: readWeather({ climate: 'temperate' }), seed: 3 } }).weather).not.toHaveProperty('clock');
    const reg = capabilityRegistry();
    for (const v of ['day-night', 'seasons']) expect(reg.time.passage.values[v].godot, v).toBe('approximated');
  });

  it.skipIf(!GODOT)('a headless Godot darkens at dusk and turns the season at midnight, as the dial says (MOJULO_GODOT)', () => {
    const dial = (text) => { const m = /\[mojulo-dial\] night=([\d.]+) dim=([\d.]+) season=(\d+) state=(\S*)/.exec(text); return m && { night: +m[1], dim: +m[2], season: +m[3], state: m[4] }; };
    const bus = (keys) => keys.map((k) => k.split('|')[0]);
    // dusk: 18:30, a tick a second of 60 game minutes: 19:30 by the end, deep in the dusk
    const dusk = playBoth(clockLevel({ start: 18.5 }), still(45), { godot: GODOT });
    expect(dusk.godot.error).toBe(null);
    expect(bus(dusk.godot.keys)).toEqual(bus(dusk.web.keys));
    const vars = JSON.parse(dusk.web.keys.at(-1).split('|')[0]).vars, d = dial(dusk.godot.text);
    expect(vars.minute).toBe(1170);
    expect(nightAt(vars.minute)).toBeGreaterThan(0.5);
    expect(d.night).toBeCloseTo(nightAt(vars.minute), 4);
    const score = extractEngineScore({ ref: 'r', manifest: {} }, clockLevel({ start: 18.5 })).weather;
    const S = score.states.find((s) => s.name === d.state);
    expect(d.dim).toBeCloseTo(nightLook({ dim: S.dim, sky: S.sky }, d.night).dim, 3);
    // midnight with a season a day: the season turns, and the sky plays the next season's climate
    const year = playBoth(clockLevel({ start: 23.5, seasons: 1 }), still(45), { godot: GODOT });
    expect(year.godot.error).toBe(null);
    expect(bus(year.godot.keys)).toEqual(bus(year.web.keys));
    const yv = JSON.parse(year.web.keys.at(-1).split('|')[0]).vars, y = dial(year.godot.text);
    expect(yv.season).toBe(1);
    expect(y.season).toBe(1);
    const next = extractEngineScore({ ref: 'r', manifest: {} }, clockLevel({ start: 23.5, seasons: 1 })).weather.seasons[1];
    expect(next.states.map((s) => s.name)).toContain(y.state);
    expect(y.night).toBe(1);
  }, 600000);

  const PLANTS = [
    { name: 'the dusk an hour early', from: 'return _smooth((h - 18.0) / 2.0)', to: 'return _smooth((h - 17.0) / 2.0)' },
    { name: 'the night not on the dim', from: '\t\tL["dim"] = float(L["dim"]) + (0.78 - float(L["dim"])) * night\n', to: '' },
    { name: 'the season never turns', from: '\t\tseason = k\n', to: '' },
  ];
  it.skipIf(!GODOT)('every planted bug in the dial is caught (MOJULO_GODOT)', () => {
    const dial = (text) => { const m = /\[mojulo-dial\] night=([\d.]+) dim=([\d.]+) season=(\d+) state=(\S*)/.exec(text); return m && { night: +m[1], dim: +m[2], season: +m[3] }; };
    const truth = (level, frames) => { const r = playBoth(level, frames, { godot: GODOT }); return dial(r.godot.text); };
    const want = [truth(clockLevel({ start: 18.5 }), still(45)), truth(clockLevel({ start: 23.5, seasons: 1 }), still(45))];
    for (const p of PLANTS) {
      const mutate = [{ file: 'weather.gd', from: p.from, to: p.to }];
      const got = [dial(playBoth(clockLevel({ start: 18.5 }), still(45), { godot: GODOT, mutate }).godot.text), dial(playBoth(clockLevel({ start: 23.5, seasons: 1 }), still(45), { godot: GODOT, mutate }).godot.text)];
      expect(JSON.stringify(got), p.name).not.toBe(JSON.stringify(want));
    }
  }, 900000);
});
