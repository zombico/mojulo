/**
 * The WEATHER as the engine score carries it: what an engine kernel needs to play the sky the web build plays, as data.
 * The web build runs weather/weather.js's pure schedule off its clock; an engine does not run that code, so the score
 * carries what the schedule WOULD say for its first half hour (`timeline`: runs of states, `blend` seconds easing each
 * into the next) and what each state IS in this style's air (`states`: fog factor, colour from the air card, the light taken
 * off, the sky's value, what falls and the lightning, in metres; an array, by `name`): enough for a kernel to ease fog, colour and light through
 * the same sky, and for an author to place falls and lightning by hand. The kernels play the fog, the colour and the light;
 * the falls and lightning stay the web build's (the ledger says so). Absent `weather` ⇒ null, byte-identical.
 */
import { STATES, STATE_NAMES, weatherRuns, readWeather } from '../weather/weather.js';
import { airCard, airFromHaze, airColour } from '../era/air.js';

const r3 = (v) => Math.round(v * 1e3) / 1e3;
export const WEATHER_SCORE_SPAN = 1800;   // seconds of the schedule the score carries

/** payload (resolveWorldScene's: weather { weather, seed, air?, clock?, seasons? }, haze) → the score's `weather` row,
 * or null. A level with a clock (the clock mechanic) carries `clock: true` (the sky reads the bus's minute: night,
 * weather/clock-dial.js) and, with seasons, each season's own `timeline` and `states` in turn (the bus's season swaps
 * the climate the schedule plays). Absent ⇒ no key, byte-identical. */
export function weatherScore(payload, { unitScale = 1, span = WEATHER_SCORE_SPAN } = {}) {
  const P = payload && payload.weather;
  if (!P || !P.weather) return null;
  const row = weatherRow(payload, P.weather, { unitScale, span });
  if (!P.clock) return row;
  const seasons = Array.isArray(P.seasons) ? P.seasons.map((w) => { const s = weatherRow(payload, w, { unitScale, span }); return { now: s.now, blend: s.blend, timeline: s.timeline, states: s.states }; }) : null;
  return { ...row, clock: true, ...(seasons ? { seasons } : {}) };
}

function weatherRow(payload, weather, { unitScale, span }) {
  const P = { ...payload.weather, weather };
  const W = readWeather(P.weather), air = P.air || airFromHaze(payload.haze, W.air), seed = P.seed >>> 0;
  const runs = weatherRuns(W, seed, span).map((r) => ({ is: r.is, from: r3(r.from), to: r3(r.to) }));
  // the states the schedule plays, the climate's, and the ones a cue can force (weather-force:<cue>, set by the bus)
  const forced = ((payload.events && payload.events.reactions) || []).filter((r) => r && r.do === 'set' && typeof r.var === 'string' && r.var.startsWith('weather-force') && typeof r.to === 'string').map((r) => r.to);
  const names = [...new Set([...runs.map((r) => r.is), ...Object.keys(W.climate), ...forced])].filter((n) => STATE_NAMES.includes(n));
  // (an array of { name, … }, not a map: the score is read by engines whose JSON readers have no dictionaries)
  const states = [];
  for (const n of names) {
    const S = STATES[n], F = S.fall;
    states.push({
      name: n, fog: S.fog, color: airColour(air, n, S.veil).map(r3), dim: S.dim, sky: S.sky, wind: S.wind, gust: S.gust,
      ...(F ? { fall: { glyph: F.glyph, rate: F.rate, size: r3(F.size / unitScale), speed: r3(F.speed / unitScale), slant: F.slant, impact: F.impact } } : {}),
      ...(S.flash ? { flash: { every: S.flash.every, near: S.flash.near } } : {}),
    });
  }
  return {
    seed, blend: W.blend, dwell: W.dwell, ...(W.surface ? { surface: W.surface } : {}), now: runs[0].is, timeline: runs,
    // the kit's own fog, per metre (the web page's FogExp2 is per recipe unit); a state's `fog` multiplies it
    fogDensity: (payload.haze && Number.isFinite(payload.haze.density) ? payload.haze.density : air.density) / unitScale,
    air: { hue: air.hue, shade: air.shade, cast: air.cast, body: air.body, steps: air.steps, skyFollow: air.skyFollow },
    states,
  };
}
