import { describe, it, expect } from 'vitest';
import { BANKS, SURFACE_VOICES, voiceFor, sliceCues, thunderCues, SLICE, weatherAudioScript, buildWeatherAudio } from './weather-audio.js';
import { buildBeatsKernel } from './beats-kernel.js';
import { STATES, SOUND_BANKS, SURFACES } from '../weather/weather.js';
import { resolveWorldAudio } from './beats-world.js';
import { audioFeatures } from './beats-features.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const K = buildBeatsKernel();
const count = (cues, type) => cues.filter((g) => g.type === type).reduce((a, g) => a + (g.grains || 1), 0);

describe('weather audio', () => {
  it('every sound bank the states name has a voice, and every surface the weather names has a resonance', () => {
    for (const s of Object.values(STATES)) expect(BANKS[s.sound], s.sound).toBeTruthy();
    expect(Object.keys(BANKS).sort()).toEqual([...SOUND_BANKS].sort());
    expect(Object.keys(SURFACE_VOICES).sort()).toEqual(Object.keys(SURFACES).sort());
  });

  it('is rolled, not recorded: the same seeds give the same plan, and the plan lowers to kernel ops', () => {
    const v = voiceFor(7, 'rain'), a = sliceCues('rain', 1, v, 'tin', 12, 3, 7), b = sliceCues('rain', 1, v, 'tin', 12, 3, 7);
    expect(a).toEqual(b);
    const ops = K.cuePlan(a, 4);
    expect(ops.length).toBeGreaterThan(10);
    expect(ops.every((o) => Number.isFinite(o.at) && o.at >= 0)).toBe(true);
    expect(K.cuePlan(a, 4)).toEqual(ops);
  });

  it('intensity is rate: a heavier share is more events, each at the same volume', () => {
    const v = voiceFor(7, 'rain'), light = sliceCues('rain', 0.25, v, 'stone', 0, 1, 7), heavy = sliceCues('rain', 1, v, 'stone', 0, 1, 7);
    expect(count(heavy, 'grain')).toBeGreaterThan(count(light, 'grain') * 2);
    expect(heavy.map((g) => g.vol)).toEqual(light.map((g) => g.vol));
  });

  it('size is band: a downpour sits lower than a drizzle', () => {
    const lo = (bank) => sliceCues(bank, 1, voiceFor(7, bank), 'stone', 0, 1, 7).filter((g) => g.type === 'grain').pop().band.lo;
    expect(lo('downpour')).toBeLessThan(lo('drizzle'));
  });

  it('the surface is resonance: tin and water ring, snow is hush', () => {
    const v = voiceFor(7, 'rain'), by = (s) => sliceCues('rain', 1, v, s, 0, 1, 7);
    expect(by('tin').some((g) => g.type === 'ring' && g.material === 'metal')).toBe(true);
    expect(by('water').some((g) => g.type === 'ring' && g.material === 'glass')).toBe(true);
    expect(by('stone').some((g) => g.type === 'ring')).toBe(false);
    const snow = by('snow');
    expect(snow.filter((g) => g.type === 'grain').length).toBe(1);   // the bed alone, no drops
    expect(snow[0].band.hi).toBeLessThanOrEqual(1500);
  });

  it('distance is lowpass, delay and length: far thunder is later, darker and longer', () => {
    const near = thunderCues({ near: true, dist: 400, seed: 9 }, 7), far = thunderCues({ near: false, dist: 6000, seed: 9 }, 7);
    expect(far.delay).toBeGreaterThan(near.delay);
    expect(near.delay).toBeCloseTo(400 / 343, 5);
    const rumble = (t) => t.gestures.filter((g) => g.type === 'burst' && g.lowpass);
    expect(Math.max(...rumble(far).map((g) => g.lowpass))).toBeLessThan(Math.min(...rumble(near).map((g) => g.lowpass)) + 1);
    expect(Math.max(...rumble(far).map((g) => g.decay))).toBeGreaterThan(Math.max(...rumble(near).map((g) => g.decay)));
    expect(near.gestures.some((g) => g.type === 'burst' && g.highpass)).toBe(true);    // the crack
    expect(far.gestures.some((g) => g.type === 'burst' && g.highpass)).toBe(false);
    expect(K.cuePlan(far.gestures, 2).length).toBeGreaterThan(3);
  });

  it('two dice: two worlds differ in centre, two events differ in jitter', () => {
    const a = voiceFor(7, 'rain'), b = voiceFor(8, 'rain');
    expect(a).not.toEqual(b);
    expect(sliceCues('rain', 1, a, 'stone', 0, 1, 7)).not.toEqual(sliceCues('rain', 1, a, 'stone', 0, 2, 7));
    expect(K.cuePlan(sliceCues('rain', 1, a, 'stone', 0, 1, 7), 1)).not.toEqual(K.cuePlan(sliceCues('rain', 1, a, 'stone', 0, 1, 7), 2));
  });

  it('gusts are two incommensurate slow swells, always in 0…1', () => {
    const v = voiceFor(7, 'gale');
    for (let t = 0; t < 600; t += 1.3) { const g = buildWeatherAudio().gustAt(v, t); expect(g).toBeGreaterThanOrEqual(0); expect(g).toBeLessThanOrEqual(1); }
    expect(v.gustA / v.gustB).not.toBeCloseTo(Math.round(v.gustA / v.gustB), 2);
  });

  it('the world audio channel carries it: resolved, validated, the kernel gets its sfx region, and the page script runs', () => {
    expect(resolveWorldAudio({ weather: true }).weather).toEqual({});
    expect(resolveWorldAudio({ weather: { level: 0.5, surface: 'tin' } }).weather).toEqual({ level: 0.5, surface: 'tin' });
    expect(() => resolveWorldAudio({ weather: { surface: 'mud' } })).toThrow(/surface is one of/);
    expect(() => resolveWorldAudio({ weather: { volume: 1 } })).toThrow(/not a weather sound setting/);
    expect(audioFeatures({ weather: {} })).toContain('sfx');
    expect(() => new Function(weatherAudioScript().replace('if (__AUDIO.weather)', 'if (false)'))).not.toThrow();
    const html = emitThreeWorld({ faces: [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#445566' }], audio: { weather: {} } });
    expect(html).toContain('weather sound: beds, drops and thunder');
    expect(emitThreeWorld({ faces: [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#445566' }], audio: { wind: { level: -30, freq: 300 } } })).not.toContain('weather sound');
    expect(SLICE).toBe(0.5);
  });

  it('the page schedules a slice each tick, and thunder once when its delay is up', () => {
    const played = [], ticks = [];
    const S = { ...STATES.thunderstorm, flash: { every: [6, 22], near: 0.3, bright: 1, share: 1 } };
    let t = 100;
    const MW = { seed: 5, W: { surface: 'tin' }, states: STATES, clock: () => t, cur: () => ({ sh: { thunderstorm: 1 }, S }),
      flashes: () => [{ at: 99, near: true, dist: 343 * 2, seed: 3 }] };   // thunder due at 101
    const g = { __mojWeather: MW };
    new Function('window', '__AUDIO', '__beatsEng', '__beatsMuted', '__beatsCtx', 'setInterval', weatherAudioScript())(g, { weather: {} }, { playCue: (...a) => played.push(a) }, false, { currentTime: 1 }, (f) => ticks.push(f));
    ticks[0]();                                   // t = 100: the first tick only plays the slice (thunder is not due)
    const first = played.length;
    expect(first).toBeGreaterThan(0);
    t = 101.2; ticks[0]();                        // thunder falls due between the ticks
    t = 101.7; ticks[0]();                        // and is not played twice
    const thunders = played.filter((a) => a[0].some((x) => x.type === 'burst' && x.lowpass));
    expect(thunders.length).toBe(1);
  });
});
