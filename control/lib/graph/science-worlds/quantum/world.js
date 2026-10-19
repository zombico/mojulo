/**
 * The quantum world's page — one layout per system, each saying plainly what of it is a picture:
 *
 *   line   |ψ|² drawn above the energy it carries, over the potential on the same energy scale (two quantities on one
 *          picture, as in a textbook figure); optionally Re ψ beside it (`dress.phase`). Its film: the run, its end card.
 *   atom   each orbital a cloud of points sampled from |ψ|², gold where ψ is positive and blue where negative, the
 *          nucleus at its centre, side by side when there are several. Its film: the camera circles the clouds.
 *   spin   atoms leaving a source, splitting at each magnet up or down, stopped where a magnet keeps one beam. Only
 *          which way each comes out, and how often, is the model; the paths are drawn.
 *   decay  the nuclei on a grid, each changing colour at the moment it decays.
 *
 *   dress = { hud?, camera?, background?, playback?, film?, phase? (line: draw Re ψ too) }
 */

import { solveQuantum } from './solve.js';
import { QUANTUM_LAWS, BOHR } from './laws.js';
import { normalizeFilm, defaultShoot, filmConfig } from '../classical/film.js';
import { scl, add, isObj, hex, hexRgb, esc, drawScale, times, scaleLiberty, timeLiberty, bar, quad, framing, honesty, sig } from '../page.js';

const HOLD = 1.2, LIFE_HOLD = 1.4;   // the period movers hold 1.2 s; the lifetime clock replays 1.4 s after its last track
const DRESS_KEYS = ['hud', 'camera', 'background', 'playback', 'film', 'phase'];
const GOLD = '#e0b15f', BLUE = '#5fa9e0', GREY = '#8e9bb6', PINK = '#e57cd8', DIM = '#4a5568';
const SUMMARY = Object.fromEntries(QUANTUM_LAWS.map((r) => [r.id, r.summary]));
const fail = (where, msg) => { throw new Error(`science-worlds: ${where}: ${msg}`); };

export function normalizeQuantumDress(dress) {
  const base = { hud: true, camera: null, background: '#0b1020', playback: null, film: normalizeFilm(undefined, []), phase: false };
  if (dress == null) return base;
  if (!isObj(dress)) fail('dress', 'wants an object');
  const extra = Object.keys(dress).filter((k) => !DRESS_KEYS.includes(k));
  if (extra.length) fail('dress', `unknown field '${extra[0]}' (the quantum dress takes ${DRESS_KEYS.join(', ')})`);
  for (const k of ['hud', 'phase']) if (dress[k] !== undefined && typeof dress[k] !== 'boolean') fail(`dress.${k}`, 'is true or false');
  if (dress.camera !== undefined && !['side', 'angle', 'top'].includes(dress.camera)) fail('dress.camera', "is 'side', 'angle' or 'top'");
  if (dress.background !== undefined && !hex(dress.background)) fail('dress.background', "wants '#rrggbb'");
  if (dress.playback !== undefined && !(typeof dress.playback === 'number' && dress.playback >= 1 && dress.playback <= 120)) fail('dress.playback', 'is seconds on screen, 1 to 120');
  return { ...base, ...Object.fromEntries(Object.entries(dress).filter(([k]) => k !== 'film')), film: normalizeFilm(dress.film, []) };
}

const dot3 = (c, w, fill, group) => {
  // a small tetrahedron: a point of a cloud that reads from every side
  const p = [add(c, [w, w, w]), add(c, [-w, -w, w]), add(c, [-w, w, -w]), add(c, [w, -w, -w])];
  return [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]].map((f) => quad(f.map((k) => p[k]), fill, group));
};
const constant = (v, n) => Array.from({ length: n }, () => v);

function layLine(solved, dress, drawn) {
  const { run, model } = solved, s0 = run.series;
  const L = model.length * 1e-9, s = drawScale(L) * 1e-9, Ls = model.length * s;   // s: scene units per nm
  const scaled = scaleLiberty(s * 1e9); if (scaled) drawn.push(scaled);
  const H = 0.45 * Ls;
  const finiteV = [...run.V].filter((v) => v < 1e5);
  const Escale = 1.2 * Math.max(run.Ehi, Math.max(...s0.E), Math.max(0, ...finiteV), 1e-6);
  const zE = (E) => (H * Math.min(E, 1.15 * Escale)) / Escale;
  const dmax = Math.max(...s0.density.flat(), 1e-300), rmax = Math.max(...s0.real.flat().map(Math.abs), 1e-300);
  const A = (0.35 * Ls) / dmax, Ar = (0.25 * Ls) / rmax, base = zE(s0.E[0]);
  const xs = run.pick.map((j) => run.g.x[j] * s);
  const r = 0.005 * Ls, faces = [], planets = [], movers = [];
  const common = (path, group, tint) => { planets.push({ group, center: [0, 0, 0], radius: r, tint: hexRgb(tint), rough: 0.4, nlat: 6, nlon: 8 }); movers.push({ group, path, basePos: [0, 0, 0], period: 0, loop: false, hold: HOLD }); };
  xs.forEach((x, i) => {
    common(s0.density.map((d) => [x, 0, base + d[i] * A]), `psi:${i}`, GOLD);
    if (dress.phase) common(s0.real.map((d) => [x, 0, base + d[i] * Ar]), `re:${i}`, BLUE);
  });
  // the potential and the energy, on the same energy scale
  for (let i = 1; i < xs.length; i++) faces.push(...bar([xs[i - 1], 0, zE(run.V[run.pick[i - 1]])], [xs[i], 0, zE(run.V[run.pick[i]])], 0.004 * Ls, GREY, 'scene'));
  faces.push(...bar([xs[0], 0, base], [xs[xs.length - 1], 0, base], 0.0015 * Ls, '#55e08a', 'scene'));
  for (const E of (run.levels ?? []).filter((e) => e <= Escale)) faces.push(...bar([xs[0], 0.01 * Ls, zE(E)], [xs[xs.length - 1], 0.01 * Ls, zE(E)], 0.001 * Ls, '#3a4a63', 'scene'));
  drawn.push({ what: 'the gold curve is |ψ|² (probability per length), drawn above the energy it carries; the grey line is the potential on the energy scale', why: 'two quantities on one picture, as in a textbook figure' });
  if (dress.phase) drawn.push({ what: 'the blue curve is the real part of ψ, on its own scale', why: 'to show the phase turning' });
  const pts = [[xs[0], 0, 0], [xs[xs.length - 1], 0, H * 1.2], [0, 0, -0.05 * Ls]];
  const rows = [
    { html: '⟨E⟩', values: s0.E.map((e) => e), unit: 'eV' },
    { html: '⟨x⟩', values: s0.x.map((x) => x * 1e-9), unit: 'm' },
    { html: 'spread', values: s0.sigma.map((x) => x * 1e-9), unit: 'm' },
    ...(run.cut !== null ? [{ html: model.laws.some((l) => l.law === 'step') ? 'beyond the step' : 'beyond the barrier', values: s0.right.map((v) => v * 100), unit: '%' }] : []),
  ];
  return { faces, planets, movers, pts, rows, t: s0.t.map((t) => t * 1e-15), durationS: model.duration * 1e-15, lead: 'side', hold: HOLD, labels: [], scale: s * 1e9, scaleNote: scaled };
}

function layAtom(solved, dress, drawn) {
  const { run } = solved;
  const reachA = Math.max(...run.clouds.map((c) => 2.6 * c.meanR));
  const gap = 2.4 * reachA, n = run.clouds.length;
  const L = (gap * n) * BOHR, s = drawScale(L) * BOHR, Ls = gap * n * s;   // s: scene units per a₀
  const scaled = scaleLiberty(s / BOHR); if (scaled) drawn.push(scaled);
  const faces = [], planets = [], labels = [], pts = [];
  const w = 0.004 * Ls;
  run.clouds.forEach((c, i) => {
    const center = [(i - (n - 1) / 2) * gap * s, 0, 0];
    c.points.forEach((p, k) => faces.push(...dot3(add(center, scl(p, s)), w, c.signs[k] > 0 ? GOLD : BLUE, `orb:${i}`)));
    planets.push({ group: `nuc:${i}`, center, radius: 0.008 * Ls, tint: hexRgb('#ff7a59'), rough: 0.5 });
    labels.push({ group: `nuc:${i}`, text: c.name, lift: reachA * s * 0.9 });
    pts.push(add(center, [reachA * s, reachA * s, reachA * s]), add(center, [-reachA * s, -reachA * s, -reachA * s]));
  });
  drawn.push({ what: `each point is one sampled position (${solved.model.samples} per orbital): the cloud is |ψ|² drawn as samples, not an electron's path`, why: 'a probability has no picture of its own' });
  drawn.push({ what: 'gold where ψ is positive, blue where it is negative', why: 'the sign is real, the colours are not' });
  drawn.push({ what: `the nucleus drawn ${times((0.008 * Ls) / (0.84e-15 / BOHR * s))} its size`, why: 'at its true size (under a femtometre) it would be invisible' });
  const N = 61;
  const rows = run.clouds.flatMap((c) => [
    { html: esc(`${c.name}: E`), values: constant(c.energy, N), unit: 'eV' },
    { html: esc(`${c.name}: ⟨r⟩`), values: constant(c.meanR * BOHR, N), unit: 'm' },
  ]);
  return { faces, planets, movers: [], pts, rows, t: constant(0, N), noClock: true, durationS: null, lead: 'angle', hold: HOLD, labels, scale: s / BOHR, scaleNote: scaled };
}

function laySpin(solved, dress, drawn, playback) {
  const { run, model } = solved;
  const K = model.magnets.length, gapX = 6, d0 = 1.2;
  const faces = [], planets = [], movers = [];
  model.magnets.forEach((M, k) => {
    const x = (k + 1) * gapX;
    faces.push(...bar([x - 1.2, 0, 1.2 + k * 0.4], [x + 1.2, 0, 1.2 + k * 0.4], 0.45, '#c0504a', 'scene'), ...bar([x - 1.2, 0, -1.2 - k * 0.4], [x + 1.2, 0, -1.2 - k * 0.4], 0.45, '#4a6fc0', 'scene'));
    if (M.keep !== 'both') faces.push(...bar([x + 2, 0, M.keep === 'up' ? -0.2 : 0.2], [x + 2, 0, M.keep === 'up' ? -3 : 3], 0.15, GREY, 'scene'));
  });
  faces.push(...bar([-1, 0, 0], [0, 0, 0], 0.35, GREY, 'scene'));
  const shown = run.runs.slice(0, 200);
  shown.forEach((r, i) => {
    const pts = [[0, 0, 0]];
    let z = 0;
    r.outcomes.forEach((o, k) => {
      const x = (k + 1) * gapX;
      pts.push([x - 1.2, 0, z]);
      z += (o === 'up' ? 1 : -1) * d0 / (k + 1);
      pts.push([x + 1.2, 0, z]);
      if (r.stopped === k) pts.push([x + 2, 0, z]);
    });
    if (r.stopped === null) pts.push([(K + 1) * gapX, 0, z]);
    const t0 = (0.7 * playback * i) / shown.length, t1 = t0 + 0.3 * playback * (pts.length / (2 * K + 2));
    const group = `atom:${i}`;
    planets.push({ group, center: [0, 0, 0], radius: 0.12, tint: hexRgb(GOLD), rough: 0.4, nlat: 6, nlon: 8 });
    // walk the polyline at an even pace: resample it to points equally spaced along its length
    const seg = []; let total = 0;
    for (let k = 1; k < pts.length; k++) { const l = Math.hypot(...pts[k].map((c, j) => c - pts[k - 1][j])); seg.push(l); total += l; }
    const path = [];
    for (let q = 0; q <= 30; q++) {
      let at = (total * q) / 30, k = 0;
      while (k < seg.length - 1 && at > seg[k]) { at -= seg[k]; k++; }
      const f = seg[k] > 0 ? at / seg[k] : 0;
      path.push(pts[k].map((c, j) => c + f * (pts[k + 1][j] - c)));
    }
    movers.push({ group, path, basePos: [0, 0, 0], t0, t1, ...(r.stopped !== null ? { vanish: true } : {}) });
  });
  if (run.runs.length > shown.length) drawn.push({ what: `${shown.length} of the ${run.runs.length} atoms are drawn`, why: 'so the page stays quick; the counts are all of them' });
  drawn.push({ what: 'the beams\' paths and how far they bend are drawn', why: 'only which way each atom comes out, and how often, is the model' });
  // the readout counts each magnet's outcomes as the drawn atoms arrive, on the page's clock
  const N = 121, T = playback, rows = [];
  model.magnets.forEach((M, k) => {
    const name = esc(`magnet ${k + 1} (${M.name})`);
    const arrive = shown.map((r, i) => ({ r, t: (0.7 * playback * i) / shown.length + 0.3 * playback * ((2 * k + 2) / (2 * K + 2)) }));
    const scaleUp = run.stages[k].up / Math.max(1, shown.filter((r) => r.outcomes[k] === 'up').length);
    const scaleDown = (run.stages[k].reached - run.stages[k].up) / Math.max(1, shown.filter((r) => r.outcomes[k] === 'down').length);
    const at = (j) => (j * T) / (N - 1);
    rows.push({ html: `${name} up`, bar: true, int: true, color: '#c0504a', max: Math.max(1, run.stages[k].reached), values: Array.from({ length: N }, (_, j) => Math.round(arrive.filter((a) => a.t <= at(j) && a.r.outcomes[k] === 'up').length * scaleUp)) });
    rows.push({ html: `${name} down`, bar: true, int: true, color: '#4a6fc0', max: Math.max(1, run.stages[k].reached), values: Array.from({ length: N }, (_, j) => Math.round(arrive.filter((a) => a.t <= at(j) && a.r.outcomes[k] === 'down').length * scaleDown)) });
  });
  const pts = [[-1, 0, -3], [(K + 1) * gapX, 0, 3]];
  return { faces, planets, movers, pts, rows, t: constant(0, N), noClock: true, durationS: null, lead: 'side', hold: LIFE_HOLD, labels: [] };
}

function layDecay(solved, dress, drawn, playback) {
  const { run, model } = solved;
  const shown = run.times.slice(0, 400), side = Math.ceil(Math.sqrt(shown.length)), gapG = 1;
  const faces = [], planets = [], movers = [];
  const page = (t) => (t / model.duration) * playback;
  shown.forEach((t, i) => {
    const p = [((i % side) - (side - 1) / 2) * gapG, 0, (Math.floor(i / side) - (side - 1) / 2) * gapG];
    const decays = t <= model.duration;
    planets.push({ group: `n:${i}`, center: [0, 0, 0], radius: 0.32, tint: hexRgb(PINK), rough: 0.5, nlat: 8, nlon: 10 });
    movers.push({ group: `n:${i}`, path: [p, p], basePos: [0, 0, 0], t0: 0, t1: decays ? page(t) : playback, ...(decays ? { vanish: true } : {}) });
    if (decays) {
      planets.push({ group: `d:${i}`, center: [0, 0, 0], radius: 0.24, tint: hexRgb(DIM), rough: 0.6, nlat: 8, nlon: 10 });
      movers.push({ group: `d:${i}`, path: [p, p], basePos: [0, 0, 0], t0: page(t), t1: playback });
    }
  });
  if (run.times.length > shown.length) drawn.push({ what: `${shown.length} of the ${run.times.length} nuclei are drawn`, why: 'so the page stays quick; the counts are all of them' });
  drawn.push({ what: 'the nuclei sit on a grid, far apart and far larger than they are', why: 'so each can be seen to change' });
  const timed = timeLiberty(model.duration, playback); if (timed) drawn.push(timed);
  const rows = [
    { html: 'undecayed', bar: true, int: true, color: PINK, max: model.nuclei, values: run.left },
    { html: 'decayed', bar: true, int: true, color: DIM, max: model.nuclei, values: run.left.map((n) => model.nuclei - n) },
  ];
  const h = (side / 2) * gapG + 1;
  return { faces, planets, movers, pts: [[-h, 0, -h], [h, 0, h]], rows, t: run.t, durationS: model.duration, lead: 'side', hold: LIFE_HOLD, labels: [] };
}

/** Solve and lay out a quantum world. */
export function planQuantumWorld(manifest) {
  const solved = solveQuantum({ model: manifest.model, ...(manifest.dress !== undefined ? { dress: manifest.dress } : {}), ...(manifest.liberties !== undefined ? { liberties: manifest.liberties } : {}) });
  const dress = normalizeQuantumDress(solved.dress);
  const drawn = [];
  const sys = solved.system;
  const playback = dress.playback ?? (sys === 'decay' ? Math.max(4, Math.min(12, solved.model.duration)) : 8);
  const lay = sys === 'line' ? layLine(solved, dress, drawn) : sys === 'atom' ? layAtom(solved, dress, drawn) : sys === 'spin' ? laySpin(solved, dress, drawn, playback) : layDecay(solved, dress, drawn, playback);
  if (sys === 'line') { const timed = timeLiberty(lay.durationS, playback); if (timed) drawn.push(timed); for (const m of lay.movers) m.period = playback; }
  const { center, radius, cameras } = framing([...lay.pts, ...lay.faces.flatMap((f) => f.corners)], { viewBox: manifest.viewBox, lead: dress.camera ?? lay.lead });
  const rate = lay.durationS ? lay.durationS / playback : 1;
  return { solved, dress, drawn, ...lay, cameras, bounds: { center, radius }, playback, rate, pagePos: () => center, radiusOf: () => 0.01 * radius };
}

function scienceConfig(plan, title) {
  const { solved, drawn } = plan;
  const sections = honesty({
    model: [...new Set(solved.model.laws.map((l) => l.law))].map((id) => SUMMARY[id]),
    gates: solved.gates, assumptions: solved.assumptions, liberties: [...drawn, ...solved.liberties], gaps: solved.gaps, held: solved.held,
  });
  sections.sections.push({ head: `Sources (reviewed ${solved.reviewed})`, color: '#80cbc4', items: solved.sources.map((text) => ({ text })) });
  return {
    t: plan.t, period: plan.playback, hold: plan.hold, titleHtml: esc(title), titleText: title, ...(plan.noClock ? { noClock: true } : {}),
    barWidth: 230, labelWidth: 120, rows: plan.rows, labels: plan.labels, honesty: sections,
  };
}

// an atom's film turns round its clouds over the playback, then the end card: a full circle round one orbital; with
// several side by side, a sway across their front, so they never line up behind each other
function circleShoot(plan, film) {
  const { center, radius } = plan.bounds, d = radius * 2.3, P = plan.playback, keys = [];
  const several = plan.solved.run.clouds.length > 1;
  for (let k = 0; k <= 8; k++) {
    const a = -Math.PI / 2 + (several ? 0.6 * Math.sin((2 * Math.PI * k) / 8) : (2 * Math.PI * k) / 8);
    keys.push({ t: +(P * k / 8).toFixed(4), pos: [center[0] + d * Math.cos(a), center[1] + d * Math.sin(a), center[2] + d * 0.35].map((c) => +c.toFixed(4)), poi: center.map((c) => +c.toFixed(4)), hfov: 46 });
  }
  return { fps: 24, cameras: [{ id: 'orbit', name: 'orbit', type: 'two_node', keys }], shots: [{ name: 'run', camera: 'orbit', span: [0, P] }, ...(film.endCard ? [{ name: 'end', camera: 'orbit', span: [P, +(P + 0.95 * plan.hold).toFixed(4)] }] : [])] };
}

export function planQuantumFilm(manifest, plan) {
  const film = plan.dress.film;
  const proposed = plan.solved.system === 'atom' ? circleShoot(plan, film) : defaultShoot(plan, { ...film, replay: false }, null);
  const shoot = manifest.shoot ?? proposed;
  return { shoot, proposed: manifest.shoot ? null : proposed, config: filmConfig({ film, shoot, rate: plan.rate, playback: plan.playback, hold: plan.hold, labels: [] }) };
}

/** The World payload (emitThreeWorld) for a quantum-view manifest. */
export function assembleQuantumScene(manifest = {}, { title, plan: given } = {}) {
  const plan = given ?? planQuantumWorld(manifest);   // a world placing this demo plans it once (science-worlds/setting.js)
  const name = title || manifest.title || 'mojulo quantum world';
  const film = planQuantumFilm(manifest, plan);
  return {
    faces: plan.faces, picks: [], movers: plan.movers, planets: plan.planets, cameras: plan.cameras,
    viewBox: isObj(manifest.viewBox) ? manifest.viewBox : { width: 1120, height: 780 },
    title: name, bg: manifest.dress?.background === undefined && hex(manifest.scene?.bg) ? manifest.scene.bg : plan.dress.background, glow: false,
    ...(plan.dress.hud ? { science: { ...scienceConfig(plan, name), film: film.config } } : {}),
    ...(film.proposed ? { defaultShoot: film.proposed } : {}),
  };
}

