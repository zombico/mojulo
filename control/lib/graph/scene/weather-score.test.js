import { describe, it, expect } from 'vitest';
import { weatherScore, WEATHER_SCORE_SPAN } from './weather-score.js';
import { extractEngineScore } from './engine-score.js';
import { readWeather, STATE_NAMES } from '../weather/weather.js';
import { airOfKit } from '../gameworld/style-guide.js';
import { emitUnityProject } from './unity-project.js';

const payload = (more = {}) => ({ title: 'w', colliders: [], entities: [], walk: { eye: 1.6 }, haze: { color: '#b4d8f0', density: 0.012 }, weather: { weather: readWeather('monsoon'), seed: 4, air: airOfKit('isekai-meadow') }, ...more });

describe('the weather in the engine score', () => {
  it('absent ⇒ no row, no ledger entry', () => {
    expect(weatherScore({})).toBeNull();
    const s = extractEngineScore({ ref: 'sk_x', manifest: { kind: 'floorplan-world' } }, { title: 'w', colliders: [], entities: [], walk: { eye: 1.6 } });
    expect(s.weather).toBeUndefined();
    expect(s.ledger.weather_partial).toBeUndefined();
  });

  it('carries the schedule\'s first half hour and each state in the style\'s air, as arrays an engine JSON reader can take', () => {
    const r = weatherScore(payload());
    expect(r.timeline[0].from).toBe(0);
    expect(r.timeline.at(-1).to).toBeGreaterThanOrEqual(WEATHER_SCORE_SPAN);
    for (let i = 1; i < r.timeline.length; i++) expect(r.timeline[i].from).toBeCloseTo(r.timeline[i - 1].to, 2);   // runs are contiguous
    expect(Array.isArray(r.states)).toBe(true);
    expect(r.states.map((s) => s.name)).toContain(r.now);
    for (const s of r.states) { expect(STATE_NAMES).toContain(s.name); expect(s.color).toHaveLength(3); expect(s.fog).toBeGreaterThan(0); }
    expect(r.fogDensity).toBe(0.012);
    expect(r.air).toMatchObject({ body: 'banded', shade: '#86aede' });
    expect(weatherScore(payload())).toEqual(r);                 // the same seed, the same row
  });

  it('is in metres: a world in other units scales the density down and the fall\'s size and speed up', () => {
    const a = weatherScore(payload()), b = weatherScore(payload(), { unitScale: 0.82 });
    expect(b.fogDensity).toBeCloseTo(a.fogDensity / 0.82, 6);
    const rain = (r) => r.states.find((s) => s.fall);
    expect(rain(b).fall.speed).toBeCloseTo(rain(a).fall.speed / 0.82, 2);
  });

  it('a world with no air card gets one made of its haze', () => {
    const r = weatherScore(payload({ weather: { weather: readWeather('desert'), seed: 1 }, haze: { color: '#445566', density: 0.02 } }));
    expect(r.air.hue).toBe('#445566');
    expect(r.fogDensity).toBe(0.02);
  });

  it('extractEngineScore carries it, and says what stays the web build\'s', () => {
    const s = extractEngineScore({ ref: 'sk_x', manifest: { kind: 'floorplan-world' } }, payload());
    expect(s.weather.now).toBeTypeOf('string');
    expect(s.ledger.weather_partial.note).toMatch(/falling rain.*lightning stay the web build/s);
  });

  it('the Unity leg plays it: a runtime file hooked in by the level', () => {
    const score = extractEngineScore({ ref: 'sk_x', manifest: { kind: 'floorplan-world' } }, payload());
    const u = Object.fromEntries(emitUnityProject({ ref: 'sk_x', score, manifestHash: 'abcd1234abcd1234', audioFile: null }).files.map((f) => [f.file, f.text]));
    expect(u['Runtime/MojuloWeather.cs']).toContain('FogMode.ExponentialSquared');
    expect(u['Runtime/MojuloWeather.cs']).toContain('class Run { public string @is;');
    expect(u['Runtime/MojuloLevel.cs']).toContain('AddComponent<MojuloWeather>()');
  });
});
