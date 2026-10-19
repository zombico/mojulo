/**
 * The classical world's page — a solved model drawn, with the WORLD dress profile: light, explorable, the
 * viewer drives the camera and asks the questions. (The film profile, with its shoot plan and timed callouts,
 * is a separate dress over the same tracks.)
 *
 *   manifest = { kind: 'classical-view', model, dress?, liberties?, title?, viewBox? }   the recipe, stored as given
 *
 *   dress (world) = {
 *     bodies?:   { <id>: { color?: '#rrggbb', label?: string | false } },
 *     trails?:   true,            the path each body takes, drawn as a faint line
 *     vectors?:  false,           velocity (green) and acceleration (orange) arrows on every moving body
 *     hud?:      true,            the system readout, the honesty panel and the body labels
 *     camera?:   'side' | 'angle' | 'top',   the view the page opens on (default: top for motion in a plane
 *                                            seen from above, side otherwise)
 *     background?: '#rrggbb',
 *     playback?: seconds          how long one run lasts on screen (default: the model's own duration, kept
 *                                 between 3 and 12 s); a run that is not real time is a declared liberty
 *   }
 *
 * What the drawing changes is declared, never hidden: a scale other than 1 m per unit is noted; a body too small
 * to see is drawn larger and says so (a body that touches things keeps its true size, since contact is part of
 * the model); time sped up or slowed down says by how much. Those join the recipe's own liberties on the page.
 *
 * Bodies ride the mover channel on equal-time samples (the speed on screen is the speed in the model); links ride
 * it as bars between moving ends; the system readout and the honesty panel are the science channel.
 */

import { solveClassical } from './solve.js';
import { CLASSICAL_LAWS, planeNormal } from './laws.js';
import { normalizeFilm, keyMoment, defaultShoot, filmConfig } from './film.js';
import {
  PALETTE, sub, add, scl, len, dot, cross, unit, sig, isObj, hex, hexRgb, hexInt, esc,
  drawScale, times, scaleLiberty, timeLiberty, quad, unitBar, framing, honesty,
} from '../page.js';
const LINK_TINT = { rod: '#9aa3b5', rope: '#c8a46a', spring: '#cf8a4a' };
const PLANE_FILL = '#222a3b', ANCHOR_TINT = '#8e9bb6';
const HOLD = 1.2;
const DRESS_KEYS = ['bodies', 'trails', 'vectors', 'hud', 'camera', 'background', 'playback', 'film'];

const fail = (where, msg) => { throw new Error(`science-worlds: ${where}: ${msg}`); };

/** The world dress, checked: unknown keys are errors (a typo would otherwise vanish silently). */
export function normalizeWorldDress(dress, bodies) {
  if (dress == null) return { bodies: {}, trails: true, vectors: false, hud: true, camera: null, background: '#0b1020', playback: null, film: normalizeFilm(undefined, bodies) };
  if (!isObj(dress)) fail('dress', 'wants an object');
  const extra = Object.keys(dress).filter((k) => !DRESS_KEYS.includes(k));
  if (extra.length) fail('dress', `unknown field '${extra[0]}' (the world dress takes ${DRESS_KEYS.join(', ')})`);
  const ids = new Set(bodies.map((b) => b.id)), out = {};
  if (dress.bodies !== undefined) {
    if (!isObj(dress.bodies)) fail('dress.bodies', 'wants { <body id>: { color, label } }');
    for (const [id, d] of Object.entries(dress.bodies)) {
      if (!ids.has(id)) fail('dress.bodies', `no body '${id}'`);
      if (!isObj(d)) fail(`dress.bodies.${id}`, 'wants { color, label }');
      if (d.color !== undefined && !hex(d.color)) fail(`dress.bodies.${id}.color`, "wants '#rrggbb'");
      if (d.label !== undefined && d.label !== false && typeof d.label !== 'string') fail(`dress.bodies.${id}.label`, 'wants text, or false for none');
      out[id] = { ...(d.color ? { color: d.color } : {}), ...(d.label !== undefined ? { label: d.label === false ? false : d.label.slice(0, 40) } : {}) };
    }
  }
  for (const k of ['trails', 'vectors', 'hud']) if (dress[k] !== undefined && typeof dress[k] !== 'boolean') fail(`dress.${k}`, 'is true or false');
  if (dress.camera !== undefined && !['side', 'angle', 'top'].includes(dress.camera)) fail('dress.camera', "is 'side', 'angle' or 'top'");
  if (dress.background !== undefined && !hex(dress.background)) fail('dress.background', "wants '#rrggbb'");
  if (dress.playback !== undefined && !(typeof dress.playback === 'number' && dress.playback >= 1 && dress.playback <= 120)) fail('dress.playback', 'is seconds on screen, 1 to 120');
  return {
    bodies: out, trails: dress.trails ?? true, vectors: dress.vectors ?? false, hud: dress.hud ?? true,
    camera: dress.camera ?? null, background: dress.background ?? '#0b1020', playback: dress.playback ?? null,
    film: normalizeFilm(dress.film, bodies),
  };
}

/**
 * Solve and lay out a classical world: the solve result, plus everything the page draws, in scene units.
 */
export function planClassicalWorld(manifest) {
  const solved = solveClassical({ model: manifest.model, ...(manifest.dress !== undefined ? { dress: manifest.dress } : {}), ...(manifest.liberties !== undefined ? { liberties: manifest.liberties } : {}) });
  const { model, tracks } = solved;
  const dress = normalizeWorldDress(solved.dress, model.bodies);
  const bodies = model.bodies, N = tracks.t.length, duration = model.duration;
  const drawn = [];   // liberties the drawing takes

  // extent of everything that moves or holds: tracks, fixed bodies, anchors
  const pts = [];
  for (const b of bodies) for (const x of tracks.bodies[b.id].x) pts.push(x);
  for (const l of model.laws) if (l.between && typeof l.between[1] !== 'string') pts.push(l.between[1]);
  const lo = [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k]))), hi = [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])));
  const L = Math.max(len(sub(hi, lo)), ...bodies.map((b) => 4 * b.radius), 1e-30);
  const s = drawScale(L), Ls = L * s;
  const scaled = scaleLiberty(s);
  if (scaled) drawn.push(scaled);

  // drawn radii: true size when the body touches things (contact is part of the model), else at least visible
  const touching = new Set(model.laws.filter((l) => l.law === 'plane' || l.law === 'collision').flatMap((l) => (l.on || l.among || bodies.map((b) => b.id))));
  const minR = 0.012 * Ls;
  const rDraw = bodies.map((b) => {
    const r = b.radius * s;
    if (touching.has(b.id) && b.radius > 0) return r;
    if (r >= minR) return r;
    drawn.push(b.radius > 0
      ? { what: `${b.id} drawn ${times(minR / r)} its size`, why: 'at its true size it would be invisible' }
      : { what: `${b.id} is a point mass, drawn as a ball`, why: 'a point has no size to draw' });
    return minR;
  });

  // time on screen
  const playback = dress.playback ?? Math.max(3, Math.min(12, duration));
  const rate = duration / playback;
  const timed = timeLiberty(duration, playback);
  if (timed) drawn.push(timed);

  const faces = [], planets = [], movers = [], picks = [], labels = [];
  const color = (b, i) => dress.bodies[b.id]?.color ?? PALETTE[i % PALETTE.length];
  const free = bodies.map((b, i) => i).filter((i) => !bodies[i].fixed);
  const multiple = free.length > 1;
  const path = (id) => tracks.bodies[id].x.map((p) => scl(p, s));
  const arrowLen = 0.12 * Ls;
  const dtS = N > 1 ? tracks.t[1] - tracks.t[0] : 1;

  bodies.forEach((b, i) => {
    const group = `body:${b.id}`, tint = color(b, i);
    const facts = [['mass', b.mass !== undefined ? `${sig(b.mass, 4)} kg` : null], ['radius', b.radius ? `${sig(b.radius, 4)} m` : 'a point'],
      ['charge', b.charge ? `${sig(b.charge, 4)} C` : null], ['fixed', b.fixed ? 'never moves' : null]];
    picks.push({ name: group, kind: 'body', label: b.id, fields: facts.filter(([, v]) => v != null).map(([k, v]) => ({ k, v })) });
    const label = dress.bodies[b.id]?.label ?? (multiple || b.fixed ? b.id : false);
    if (label) labels.push({ group, text: label, lift: rDraw[i] * 1.6 });
    if (b.fixed) { planets.push({ group, center: scl(b.at, s), radius: rDraw[i], tint: hexRgb(tint), rough: 0.5 }); return; }
    planets.push({ group, center: [0, 0, 0], radius: rDraw[i], tint: hexRgb(tint), rough: 0.5 });
    const v = tracks.bodies[b.id].v;
    const speed = v.map((q) => len(q));
    const acc = v.map((q, k) => scl(sub(v[Math.min(k + 1, N - 1)], v[Math.max(k - 1, 0)]), 1 / (dtS * (Math.min(k + 1, N - 1) - Math.max(k - 1, 0)) || 1)));
    movers.push({
      group, path: path(b.id), basePos: [0, 0, 0], period: playback, loop: false, hold: HOLD, duration, label: b.id,
      g: model.frame.gravity, footer: ' ',
      ...(dress.trails ? { track: true, trackColor: hexInt(tint) } : {}),
      ...(dress.vectors ? {
        vectors: true, arrowLen,
        vdir: v.map((q) => (len(q) > 0 ? unit(q) : [1, 0, 0])), speed, maxSpeed: Math.max(...speed, 1e-30),
        avec: acc.map((q) => (len(q) > 0 ? unit(q) : [0, 0, -1])), accel: acc.map((q) => len(q)), maxAccel: Math.max(...acc.map((q) => len(q)), 1e-30),
      } : {}),
    });
  });

  // links: rods, ropes and springs, as bars between their ends (an anchor is a fixed end with a pivot marker)
  model.laws.forEach((l, k) => {
    if (!l.between) return;
    const [a, b] = l.between, kind = l.law === 'spring' ? 'spring' : l.law;
    const ia = bodies.findIndex((x) => x.id === a), ib = typeof b === 'string' ? bodies.findIndex((x) => x.id === b) : -1;
    const w = 0.22 * Math.min(rDraw[ia], ib >= 0 ? rDraw[ib] : Infinity);
    const from = path(a), to = ib >= 0 ? path(b) : Array.from({ length: N }, () => scl(b, s));
    const group = `link:${k}`;
    faces.push(...unitBar(Math.max(w, 1e-6 * Ls), LINK_TINT[kind] || LINK_TINT.rod, group));
    movers.push({ group, link: true, from, to, basePos: [0, 0, 0], period: playback, loop: false, hold: HOLD });
    if (ib < 0) planets.push({ group: `anchor:${k}`, center: scl(b, s), radius: Math.max(w * 2, 0.006 * Ls), tint: hexRgb(ANCHOR_TINT), rough: 0.6 });
  });

  // planes: a patch of each surface under the motion
  const mid = scl(add(lo, hi), 0.5 * s);
  for (const l of model.laws) {
    if (l.law !== 'plane') continue;
    const n = planeNormal(l, { frame: { up: [0, 0, 1] } });
    const p = scl(l.point ?? [0, 0, 0], s);
    const c = sub(mid, scl(n, dot(sub(mid, p), n)));
    const u = unit(len(cross(n, [0, 1, 0])) > 1e-6 ? cross(n, [0, 1, 0]) : cross(n, [1, 0, 0])), w = cross(n, u);
    const h = 0.75 * Ls + Math.max(...rDraw);
    const corner = (a, b) => add(c, add(scl(u, a * h), scl(w, b * h)));
    faces.push(quad([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], PLANE_FILL, 'scene'));
  }

  // bounds and cameras
  const span = sub(hi, lo);
  const flat = span[2] <= 0.1 * Math.max(span[0], span[1]);
  const lead = dress.camera ?? (flat && !model.laws.some((l) => l.law === 'gravity-uniform') ? 'top' : 'side');
  const { center, radius, cameras } = framing([...pts.map((p) => scl(p, s)), ...faces.flatMap((f) => f.corners)], { viewBox: manifest.viewBox, minRadius: Math.max(...rDraw.map((r) => r * 3), 1e-6), lead });

  // where a body is on the page's clock (scene units), for the film's cameras
  const pagePos = (id, sec) => {
    const k = Math.max(0, Math.min(N - 1, Math.round((sec * rate) / (duration / Math.max(1, N - 1)))));
    return scl(tracks.bodies[id].x[k], s);
  };
  const radiusOf = (id) => rDraw[bodies.findIndex((b) => b.id === id)];
  return { solved, dress, drawn, faces, planets, movers, picks, labels, cameras, bounds: { center, radius }, playback, hold: HOLD, rate, scale: s, pagePos, radiusOf };
}

/** The science channel's config: the readout's series, the honesty panel, the labels. */
function scienceConfig(plan, title) {
  const { solved, drawn, labels, playback } = plan;
  const { series, tracks, model, gates } = solved;
  const observe = new Set(model.observe.map((o) => o.quantity));
  const peMin = Math.min(...series.pe);
  const emax = Math.max(...series.ke, ...series.pe.map((p) => p - peMin), 1e-300);
  // momentum is shown when it is the system's headline: several moving bodies and nothing outside acting
  const pShown = gates.some((g) => g.id === 'momentum-conserved') && model.bodies.filter((b) => !b.fixed).length > 1;
  return {
    t: tracks.t, period: playback, hold: HOLD, titleHtml: esc(title), titleText: title,
    barWidth: 200, labelWidth: 18,
    rows: [
      ...(observe.has('energy') ? [
        { html: 'KE', bar: true, values: series.ke, max: emax, unit: 'J', color: '#55e08a' },
        { html: 'PE', bar: true, values: series.pe.map((p) => p - peMin), max: emax, unit: 'J', color: '#5fa9e0' },
        { html: 'E', values: series.e, unit: 'J', suffix: gates.some((g) => g.id === 'energy-conserved') ? ' · holds' : ' · leaving' },
      ] : []),
      ...(pShown ? [{ html: '|p|', values: series.p.map((p) => len(p)), unit: 'kg·m/s', suffix: ' · conserved' }] : []),
      ...model.observe.filter((o) => o.quantity === 'speed').map((o) => ({ html: esc(`v(${o.of})`), values: tracks.bodies[o.of].v.map((q) => len(q)), unit: 'm/s', cls: 'v' })),
    ],
    labels,
    honesty: honesty({
      model: [...new Set(model.laws.map((l) => l.law))].map((id) => SUMMARY[id]),
      gates, assumptions: solved.assumptions, liberties: [...drawn, ...solved.liberties], gaps: solved.gaps, held: solved.held,
    }),
  };
}

const SUMMARY = Object.fromEntries(CLASSICAL_LAWS.map((r) => [r.id, r.summary]));

/** The film this world proposes, and what the page needs to tell it: the key moment, the shoot plan, the film config. */
export function planClassicalFilm(manifest, plan) {
  const film = plan.dress.film, solved = plan.solved;
  const found = keyMoment(solved);
  const firstFree = solved.model.bodies.find((b) => !b.fixed)?.id;
  const key = film.replay && film.replay.at !== undefined
    ? { t: film.replay.at, body: found?.body ?? firstFree, why: 'the moment the recipe chose' }
    : found;
  const keyed = key ? { ...key, page: key.t / plan.rate } : null;
  const proposed = defaultShoot(plan, film, keyed);
  const shoot = manifest.shoot ?? proposed;
  return {
    key: keyed, shoot, proposed: manifest.shoot ? null : proposed,
    config: filmConfig({ film, shoot, rate: plan.rate, playback: plan.playback, hold: plan.hold, labels: plan.labels }),
  };
}

/** The World payload (emitThreeWorld) for a classical-view manifest. */
export function assembleClassicalScene(manifest = {}, { title } = {}) {
  const plan = planClassicalWorld(manifest);
  const name = title || manifest.title || 'mojulo classical world';
  const film = planClassicalFilm(manifest, plan);
  return {
    faces: plan.faces, picks: plan.picks, movers: plan.movers, planets: plan.planets,
    cameras: plan.cameras,
    viewBox: isObj(manifest.viewBox) ? manifest.viewBox : { width: 1120, height: 780 },
    title: name, bg: manifest.dress?.background === undefined && hex(manifest.scene?.bg) ? manifest.scene.bg : plan.dress.background, glow: false,
    ...(plan.dress.hud ? { science: { ...scienceConfig(plan, name), film: film.config } } : {}),
    // the film this world proposes when its recipe has no shoot plan of its own (forge_motion's shot.motion 'plan')
    ...(film.proposed ? { defaultShoot: film.proposed } : {}),
  };
}
