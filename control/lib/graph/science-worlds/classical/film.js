/**
 * The classical world's FILM dress — the same tracks as the page, told over time for a viewer who cannot ask.
 *
 *   dress.film = {
 *     callouts?: [{ at: time | [t0, t1], text, on?: '<body>' }],   captions on the MODEL's clock (what a teacher reads
 *                                                                  off the readout); `on` pins one beside a body
 *     replay?:   false | { at?: time, speed?: 0.1–1 },            the slowed replay of the key moment (default: the
 *                                                                  solver finds the moment; speed 0.25)
 *     end_card?: true,                                             the honesty panel as the last shot
 *   }
 *
 * The film is a SHOOT PLAN (graph/shoot/) on the page's clock: a wide shot of the whole run, a close replay of the key
 * moment at its `speed` (a shot time stretch), and the end card held on the last frame. A recipe with its own
 * `shoot` keeps it; this is the plan a classical world proposes when it has none (`payload.defaultShoot`). Slow
 * motion is a liberty the film declares on screen while it plays and again on the end card.
 *
 * The key moment, when the recipe does not name one: the sharpest change in any body's motion (a bounce, a
 * collision, a snap taut) when one stands well above the run's usual acceleration; else the fastest moment (the
 * bottom of a swing, the closest pass of an orbit).
 */

import { quantity } from '../contract.js';
import { normalizeShoot } from '../../shoot/plan.js';

export const FILM_KEYS = ['callouts', 'replay', 'end_card'];
export const MAX_CALLOUTS = 16;
export const DEFAULT_REPLAY_SPEED = 0.25;
const FILM_HFOV = 46;
const FILM_ASPECT = 540 / 720;   // forge_motion's default film frame (world-motion.js)
const END_OF_HOLD = 0.95;

const fail = (where, msg) => { throw new Error(`science-worlds: ${where}: ${msg}`); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return scl(a, 1 / l); };
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const sig = (v, n = 3) => +(+v).toPrecision(n);

/** The film dress, checked. Times are the model's (seconds, or a quantity with a time unit). */
export function normalizeFilm(film, bodies) {
  if (film === undefined) return { callouts: [], replay: {}, endCard: true };
  if (!isObj(film)) fail('dress.film', 'wants { callouts?, replay?, end_card? }');
  const extra = Object.keys(film).filter((k) => !FILM_KEYS.includes(k));
  if (extra.length) fail('dress.film', `unknown field '${extra[0]}' (the film dress takes ${FILM_KEYS.join(', ')})`);
  const ids = new Set(bodies.map((b) => b.id));
  let callouts = [];
  if (film.callouts !== undefined) {
    if (!Array.isArray(film.callouts)) fail('dress.film.callouts', 'wants [{ at, text, on? }]');
    if (film.callouts.length > MAX_CALLOUTS) fail('dress.film.callouts', `at most ${MAX_CALLOUTS}`);
    callouts = film.callouts.map((c, i) => {
      const where = `dress.film.callouts[${i}]`;
      if (!isObj(c) || typeof c.text !== 'string' || !c.text.trim()) fail(where, 'wants { at, text, on? }');
      // [12, 'ms'] is one time with its unit; [1.2, 2] or ['1.2 s', '2 s'] is a span
      const unitPair = Array.isArray(c.at) && c.at.length === 2 && typeof c.at[0] === 'number' && typeof c.at[1] === 'string' && !/^\s*[-+.\d]/.test(c.at[1]);
      const span = Array.isArray(c.at) && c.at.length === 2 && !unitPair
        ? c.at.map((x, k) => quantity(x, 'time', `${where}.at[${k}]`))
        : [quantity(c.at, 'time', `${where}.at`)];
      if (span.length === 2 && !(span[1] > span[0])) fail(`${where}.at`, 'ends before it starts');
      if (c.on !== undefined && !ids.has(c.on)) fail(`${where}.on`, `no body '${c.on}'`);
      return { at: span, text: c.text.trim().slice(0, 120), ...(c.on !== undefined ? { on: c.on } : {}) };
    });
  }
  let replay = {};
  if (film.replay === false) replay = false;
  else if (film.replay !== undefined) {
    if (!isObj(film.replay)) fail('dress.film.replay', 'is false, or { at?, speed? }');
    const bad = Object.keys(film.replay).filter((k) => !['at', 'speed'].includes(k));
    if (bad.length) fail('dress.film.replay', `unknown field '${bad[0]}'`);
    if (film.replay.at !== undefined) replay.at = quantity(film.replay.at, 'time', 'dress.film.replay.at');
    if (film.replay.speed !== undefined) {
      if (!(typeof film.replay.speed === 'number' && film.replay.speed >= 0.1 && film.replay.speed <= 1)) fail('dress.film.replay.speed', 'is between 0.1 and 1');
      replay.speed = film.replay.speed;
    }
  }
  if (film.end_card !== undefined && typeof film.end_card !== 'boolean') fail('dress.film.end_card', 'is true or false');
  return { callouts, replay, endCard: film.end_card ?? true };
}

/** The moment worth a slowed replay, from the solver's recorded run (model time), and why it was chosen. */
export function keyMoment(solved) {
  const { tracks, model } = solved;
  const t = tracks.t, N = t.length;
  if (N < 5) return null;
  let best = null, bestSpeed = null;
  const accels = [];
  for (const b of model.bodies) {
    if (b.fixed) continue;
    const v = tracks.bodies[b.id].v;
    for (let k = 2; k < N - 2; k++) {
      const a = len(sub(v[k + 1], v[k - 1])) / (t[k + 1] - t[k - 1]);
      accels.push(a);
      if (!best || a > best.a) best = { a, t: t[k], body: b.id };
      const s = len(v[k]);
      if (!bestSpeed || s > bestSpeed.s) bestSpeed = { s, t: t[k], body: b.id };
    }
  }
  if (!best) return null;
  const sorted = accels.slice().sort((x, y) => x - y), median = sorted[Math.floor(sorted.length / 2)];
  if (best.a > 3 * median && best.a > 0) return { t: best.t, body: best.body, why: 'the sharpest change in motion' };
  if (bestSpeed && bestSpeed.s > 0) return { t: bestSpeed.t, body: bestSpeed.body, why: 'the fastest moment' };
  return null;
}

/**
 * The film a classical world proposes: a wide shot of the run, a close slowed replay of the key moment, the end
 * card. Cameras in scene units; every time on the page's clock (the run plays over `playback` seconds, then holds).
 */
export function defaultShoot(plan, film, key) {
  const { bounds, cameras, playback, hold, pagePos } = plan;
  const lead = cameras[0].worldFraming;
  const dir = unit(sub(lead.cameraPosition, lead.lookAt));
  const tanV = Math.tan((FILM_HFOV / 2) * Math.PI / 180) * FILM_ASPECT;
  const d = (bounds.radius / tanV) * 1.12;
  const wide = { pos: add(bounds.center, scl(dir, d)).map(r4), poi: bounds.center.map(r4) };
  const cams = [{ id: 'wide', name: 'wide', type: 'two_node', keys: [{ t: 0, pos: wide.pos, poi: wide.poi, hfov: FILM_HFOV }] }];
  const shots = [{ name: 'run', camera: 'wide', span: [0, playback] }];
  if (film.replay !== false && key) {
    const at = key.page;
    const half = Math.max(0.4, 0.08 * playback);
    const span = [Math.max(0, at - half), Math.min(playback, at + half)];
    if (span[1] > span[0]) {
      const poi = pagePos(key.body, at);
      const close = Math.max(0.35 * d, 12 * plan.radiusOf(key.body));
      cams.push({ id: 'close', name: 'close', type: 'two_node', keys: [{ t: 0, pos: add(poi, scl(dir, Math.min(close, d))).map(r4), poi: poi.map(r4), hfov: FILM_HFOV }] });
      shots.push({ name: 'replay', camera: 'close', span: span.map(r4), speed: film.replay.speed ?? DEFAULT_REPLAY_SPEED });
    }
  }
  // the end card holds on the last frame; it stops short of the hold's end, where the page's clock replays the run
  if (film.endCard) shots.push({ name: 'end', camera: 'wide', span: [r4(playback), r4(playback + END_OF_HOLD * hold)] });
  return { fps: 24, cameras: cams, shots };
}

/**
 * The science channel's film part: callouts on the page clock, the speed of every shot (by its index in the plan,
 * the index a capture frame carries), the end card's window and what it says about the film itself.
 */
export function filmConfig({ film, shoot, rate, playback, hold, labels }) {
  // in the plan's own order: a capture frame names its shot by that index (world-motion.js renderWorldPlan)
  const { plan } = normalizeShoot(shoot);
  const shots = plan ? plan.shots : [];
  const slowed = shots.filter((s) => s.speed && s.speed < 1);
  const liberties = slowed.map((s) => ({ what: `the ${s.name} runs ${sig(1 / s.speed, 2)}× slower than the rest of the film`, why: 'slow motion, to see the moment' }));
  const group = (id) => labels.find((l) => l.group === `body:${id}`)?.group ?? `body:${id}`;
  return {
    callouts: film.callouts.map((c) => {
      const from = c.at[0] / rate, to = c.at.length === 2 ? c.at[1] / rate : from + Math.max(1.5, 0.15 * playback);
      return { from: r4(from), to: r4(to), text: c.text, ...(c.on ? { group: group(c.on) } : {}) };
    }),
    speeds: shots.map((s) => s.speed || 1),
    ...(film.endCard ? { end: { from: r4(playback + Math.min(0.15, hold / 4)), to: r4(playback + END_OF_HOLD * hold) } } : {}),
    liberties,
  };
}
