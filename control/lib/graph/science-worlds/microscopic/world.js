/**
 * The microscopic world's page — the run drawn: every shown molecule a sphere walking its recorded path, the box a
 * see-through frame, each membrane a lattice, the counts per species in the readout, and the honesty panel.
 *
 *   manifest = { kind: 'microscopic-view', model, dress?, liberties?, title?, viewBox? }
 *
 *   dress (world) = {
 *     species?:  { <id>: { color?: '#rrggbb', label?: string } },   label: the name the readout uses
 *     trails?:   false,           each shown molecule's path as a faint line (busy with many)
 *     hud?, camera?, background?, playback?, film?   as the classical world's
 *   }
 *
 * A molecule that reacts ends one track and starts another in its new species' colour (the mover channel's
 * lifetimes on the page's clock); a molecule used up vanishes. What the drawing changes is declared: the
 * magnification (a cell is micrometres across), molecules drawn far larger than they are, the share of molecules
 * drawn when there are many, the time rate.
 */

import { solveMicroscopic } from './solve.js';
import { MICROSCOPIC_LAWS, AVOGADRO } from './laws.js';
import { normalizeFilm, defaultShoot, filmConfig } from '../classical/film.js';
import {
  PALETTE, scl, len, isObj, hex, hexRgb, hexInt, esc,
  drawScale, times, scaleLiberty, timeLiberty, bar, framing, honesty,
} from '../page.js';

const HOLD = 1.4;   // the mover channel's lifetime clock replays 1.4 s after the last track ends
const DRESS_KEYS = ['species', 'trails', 'hud', 'camera', 'background', 'playback', 'film'];
const BOX_TINT = '#3a4a63', MEMBRANE_TINT = '#b39ddb';
const SUMMARY = Object.fromEntries(MICROSCOPIC_LAWS.map((r) => [r.id, r.summary]));

const fail = (where, msg) => { throw new Error(`science-worlds: ${where}: ${msg}`); };

export function normalizeMicroDress(dress, species) {
  const base = { species: {}, trails: false, hud: true, camera: null, background: '#0b1020', playback: null, film: normalizeFilm(undefined, []) };
  if (dress == null) return base;
  if (!isObj(dress)) fail('dress', 'wants an object');
  const extra = Object.keys(dress).filter((k) => !DRESS_KEYS.includes(k));
  if (extra.length) fail('dress', `unknown field '${extra[0]}' (the microscopic dress takes ${DRESS_KEYS.join(', ')})`);
  const ids = new Set(species.map((s) => s.id)), out = {};
  if (dress.species !== undefined) {
    if (!isObj(dress.species)) fail('dress.species', 'wants { <species id>: { color, label } }');
    for (const [id, d] of Object.entries(dress.species)) {
      if (!ids.has(id)) fail('dress.species', `no species '${id}'`);
      if (!isObj(d)) fail(`dress.species.${id}`, 'wants { color, label }');
      if (d.color !== undefined && !hex(d.color)) fail(`dress.species.${id}.color`, "wants '#rrggbb'");
      if (d.label !== undefined && typeof d.label !== 'string') fail(`dress.species.${id}.label`, 'wants text');
      out[id] = { ...(d.color ? { color: d.color } : {}), ...(d.label ? { label: d.label.slice(0, 40) } : {}) };
    }
  }
  for (const k of ['trails', 'hud']) if (dress[k] !== undefined && typeof dress[k] !== 'boolean') fail(`dress.${k}`, 'is true or false');
  if (dress.camera !== undefined && !['side', 'angle', 'top'].includes(dress.camera)) fail('dress.camera', "is 'side', 'angle' or 'top'");
  if (dress.background !== undefined && !hex(dress.background)) fail('dress.background', "wants '#rrggbb'");
  if (dress.playback !== undefined && !(typeof dress.playback === 'number' && dress.playback >= 1 && dress.playback <= 120)) fail('dress.playback', 'is seconds on screen, 1 to 120');
  return {
    species: out, trails: dress.trails ?? false, hud: dress.hud ?? true, camera: dress.camera ?? null,
    background: dress.background ?? base.background, playback: dress.playback ?? null, film: normalizeFilm(dress.film, []),
  };
}

/** Solve and lay out a microscopic world: the solve result, plus everything the page draws, in scene units. */
export function planMicroscopicWorld(manifest) {
  const solved = solveMicroscopic({ model: manifest.model, ...(manifest.dress !== undefined ? { dress: manifest.dress } : {}), ...(manifest.liberties !== undefined ? { liberties: manifest.liberties } : {}) });
  const { model, tracks } = solved;
  const dress = normalizeMicroDress(solved.dress, model.species);
  const { box, species, duration } = model;
  const interval = duration / solved.samples;
  const drawn = [...solved.shownLiberties];

  const L = len(box.size);
  const s = drawScale(L), Ls = L * s;
  const scaled = scaleLiberty(s);
  if (scaled) drawn.unshift(scaled);
  const minR = 0.008 * Ls;
  const rDraw = species.map((sp) => {
    const r = sp.radius * s;
    if (r >= minR) return r;
    drawn.push({ what: `${sp.id} drawn ${times(minR / r)} its size`, why: 'at its true size it would be invisible' });
    return minR;
  });
  const playback = dress.playback ?? Math.max(4, Math.min(12, duration));
  const rate = duration / playback;
  const timed = timeLiberty(duration, playback);
  if (timed) drawn.push(timed);

  const color = (i) => dress.species[species[i].id]?.color ?? PALETTE[i % PALETTE.length];
  const sIndex = Object.fromEntries(species.map((sp, i) => [sp.id, i]));
  const faces = [], planets = [], movers = [];
  const page = (k) => (k * interval) / rate;

  // the molecules: one sphere per track segment, alive on the page over the samples it covers
  for (const p of tracks.particles) {
    p.segs.forEach((g, k) => {
      if (!g.x.length) return;
      const i = sIndex[g.species], group = `m:${p.id}:${k}`;
      planets.push({ group, center: [0, 0, 0], radius: rDraw[i], tint: hexRgb(color(i)), rough: 0.55, nlat: 10, nlon: 14 });
      const ended = g.k1 < solved.samples;
      movers.push({
        group, path: g.x.map((x) => scl(x, s)), basePos: [0, 0, 0],
        t0: page(g.k0), t1: page(g.k0 + g.x.length - 1), ...(ended ? { vanish: true } : {}),
        ...(dress.trails ? { track: true, trackColor: hexInt(color(i)) } : {}),
      });
    });
  }

  // the box: its twelve edges; each membrane: a lattice across it
  const lo = scl(box.lo, s), hi = scl(box.hi, s), w = 0.0018 * Ls;
  const corner = (a, b, c) => [[lo[0], hi[0]][a], [lo[1], hi[1]][b], [lo[2], hi[2]][c]];
  for (const [a, b] of [[[0, 0, 0], [1, 0, 0]], [[0, 1, 0], [1, 1, 0]], [[0, 0, 1], [1, 0, 1]], [[0, 1, 1], [1, 1, 1]],
    [[0, 0, 0], [0, 1, 0]], [[1, 0, 0], [1, 1, 0]], [[0, 0, 1], [0, 1, 1]], [[1, 0, 1], [1, 1, 1]],
    [[0, 0, 0], [0, 0, 1]], [[1, 0, 0], [1, 0, 1]], [[0, 1, 0], [0, 1, 1]], [[1, 1, 0], [1, 1, 1]]]) faces.push(...bar(corner(...a), corner(...b), w, BOX_TINT, 'scene'));
  for (const m of model.laws.filter((l) => l.law === 'membrane')) {
    const a = { x: 0, y: 1, z: 2 }[m.axis], u = (a + 1) % 3, v = (a + 2) % 3, at = m.at * s, n = 8;
    for (let j = 0; j <= n; j++) {
      const fu = lo[u] + ((hi[u] - lo[u]) * j) / n, fv = lo[v] + ((hi[v] - lo[v]) * j) / n;
      const p = (pu, pv) => { const q = [0, 0, 0]; q[a] = at; q[u] = pu; q[v] = pv; return q; };
      faces.push(...bar(p(fu, lo[v]), p(fu, hi[v]), w * 0.8, MEMBRANE_TINT, 'scene'), ...bar(p(lo[u], fv), p(hi[u], fv), w * 0.8, MEMBRANE_TINT, 'scene'));
    }
  }

  const { center, radius, cameras } = framing([lo, hi], { viewBox: manifest.viewBox, lead: dress.camera ?? 'angle' });

  // where a shown molecule is on the page's clock, for the film's replay camera
  const pagePos = (id, sec) => {
    const p = tracks.particles.find((q) => q.id === id);
    if (!p) return center;
    const k = Math.round((sec * rate) / interval);
    for (const g of p.segs) if (k >= g.k0 && k < g.k0 + g.x.length) return scl(g.x[k - g.k0], s);
    const g = p.segs[p.segs.length - 1];
    return g.x.length ? scl(g.x[g.x.length - 1], s) : center;
  };
  const radiusOf = (id) => {
    const p = tracks.particles.find((q) => q.id === id);
    return p ? rDraw[sIndex[p.segs[0].species]] : minR;
  };
  return { solved, dress, drawn, faces, planets, movers, picks: [], labels: [], cameras, bounds: { center, radius }, playback, hold: HOLD, rate, scale: s, scaleNote: scaled, pagePos, radiusOf, color };
}

function scienceConfig(plan, title) {
  const { solved, drawn, playback, color, dress } = plan;
  const { series, tracks, model, gates } = solved;
  const name = (sp) => esc(dress.species[sp.id]?.label ?? sp.id);
  const peak = Math.max(1, ...Object.values(series.counts).flat());
  const membrane = model.laws.find((l) => l.law === 'membrane');
  const conc = (n) => n / (AVOGADRO * model.V);   // mol/m³, which is mM; the counts already carry `represents`
  return {
    t: tracks.t, period: playback, hold: HOLD, titleHtml: esc(title), titleText: title,
    barWidth: 230, labelWidth: Math.min(90, 8 + 7 * Math.max(...model.species.map((sp) => (dress.species[sp.id]?.label ?? sp.id).length))),
    rows: [
      ...model.species.map((sp, i) => ({ html: name(sp), bar: true, values: series.counts[sp.id], max: peak, int: true, color: color(i) })),
      ...(membrane ? model.species.map((sp) => ({ html: `${name(sp)} on the near side`, values: series.sides[0][sp.id], int: true })) : []),
      ...model.observe.filter((o) => o.quantity === 'concentration').map((o) => ({ html: esc(`[${o.of}]`), values: series.counts[o.of].map(conc), unit: 'mM' })),
    ],
    labels: [],
    honesty: honesty({
      model: [...new Set(model.laws.map((l) => l.law))].map((id) => SUMMARY[id]),
      gates, assumptions: solved.assumptions, liberties: [...drawn, ...solved.liberties], gaps: solved.gaps, held: solved.held,
    }),
  };
}

/** The film this world proposes: the run and its end card, with a slowed replay of the first reaction when there is one. */
export function planMicroscopicFilm(manifest, plan) {
  const film = plan.dress.film, first = plan.solved.firstEvent;
  const shown = first && plan.solved.tracks.particles.some((p) => p.id === first.particle);
  const key = film.replay && film.replay.at !== undefined
    ? { t: film.replay.at, body: shown ? first.particle : plan.solved.tracks.particles[0]?.id, why: 'the moment the recipe chose' }
    : (shown ? { t: first.t, body: first.particle, why: 'the first reaction' } : null);
  const keyed = key ? { ...key, page: key.t / plan.rate } : null;
  const proposed = defaultShoot(plan, film, keyed);
  const shoot = manifest.shoot ?? proposed;
  return { key: keyed, shoot, proposed: manifest.shoot ? null : proposed, config: filmConfig({ film, shoot, rate: plan.rate, playback: plan.playback, hold: plan.hold, labels: [] }) };
}

/** The World payload (emitThreeWorld) for a microscopic-view manifest. */
export function assembleMicroscopicScene(manifest = {}, { title, plan: given } = {}) {
  const plan = given ?? planMicroscopicWorld(manifest);   // a world placing this demo plans it once (science-worlds/setting.js)
  const name = title || manifest.title || 'mojulo microscopic world';
  const film = planMicroscopicFilm(manifest, plan);
  return {
    faces: plan.faces, picks: plan.picks, movers: plan.movers, planets: plan.planets,
    cameras: plan.cameras,
    viewBox: isObj(manifest.viewBox) ? manifest.viewBox : { width: 1120, height: 780 },
    title: name, bg: manifest.dress?.background === undefined && hex(manifest.scene?.bg) ? manifest.scene.bg : plan.dress.background, glow: false,
    ...(plan.dress.hud ? { science: { ...scienceConfig(plan, name), film: film.config } } : {}),
    ...(film.proposed ? { defaultShoot: film.proposed } : {}),
  };
}

