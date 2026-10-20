/**
 * The quantum world's page — one layout per system, each saying plainly what of it is a picture:
 *
 *   line   |ψ|² drawn above the energy it carries, over the potential on the same energy scale (two quantities on one
 *          picture, as in a textbook figure); optionally Re ψ beside it (`dress.phase`). Its film: the run, its end card.
 *   plane  |ψ|² on a lit sheet, played from the run's frames by a shader (plane-shader.js), the wall a raised slab
 *          open at its slits; beyond it a far screen where detections arrive one at a time, each at the angle it was
 *          drawn from the far field, so the pattern builds up dot by dot.
 *   atom   each orbital a cloud of points sampled from |ψ|², gold where ψ is positive and blue where negative, the
 *          nucleus at its centre, side by side when there are several. Its film: the camera circles the clouds.
 *   spin   atoms leaving a source, splitting at each magnet up or down, stopped where a magnet keeps one beam. Only
 *          which way each comes out, and how often, is the model; the paths are drawn.
 *   decay  the nuclei on a grid, each changing colour at the moment it decays.
 *
 *          With `render: 'volume'` the orbitals are ray-marched as a density instead (volume-shader.js), a second
 *          picture of the same ψ held to it by the shader conformance gate; the points stay the default, since they
 *          are the depiction the χ² checks.
 *
 *   dress = { hud?, camera?, background?, playback?, film?, phase? (line: draw Re ψ too), render? ('points' |
 *             'volume', atom), exposure? (volume) }
 */

import { solveQuantum } from './solve.js';
import { QUANTUM_LAWS, BOHR } from './laws.js';
import { volumeShader, volumeReach } from './volume-shader.js';
import { planeShader } from './plane-shader.js';
import { normalizeFilm, defaultShoot, filmConfig } from '../classical/film.js';
import { scl, add, isObj, hex, hexRgb, esc, drawScale, times, scaleLiberty, timeLiberty, bar, quad, framing, honesty, sig } from '../page.js';

const HOLD = 1.2, LIFE_HOLD = 1.4;   // the period movers hold 1.2 s; the lifetime clock replays 1.4 s after its last track
const DRESS_KEYS = ['hud', 'camera', 'background', 'playback', 'film', 'phase', 'render', 'exposure'];
const GOLD = '#e0b15f', BLUE = '#5fa9e0', GREY = '#8e9bb6', PINK = '#e57cd8', DIM = '#4a5568';
const SUMMARY = Object.fromEntries(QUANTUM_LAWS.map((r) => [r.id, r.summary]));
const fail = (where, msg) => { throw new Error(`science-worlds: ${where}: ${msg}`); };

export function normalizeQuantumDress(dress, system) {
  const base = { hud: true, camera: null, background: '#0b1020', playback: null, film: normalizeFilm(undefined, []), phase: false, render: 'points', exposure: 1 };
  if (dress == null) return base;
  if (!isObj(dress)) fail('dress', 'wants an object');
  const extra = Object.keys(dress).filter((k) => !DRESS_KEYS.includes(k));
  if (extra.length) fail('dress', `unknown field '${extra[0]}' (the quantum dress takes ${DRESS_KEYS.join(', ')})`);
  for (const k of ['hud', 'phase']) if (dress[k] !== undefined && typeof dress[k] !== 'boolean') fail(`dress.${k}`, 'is true or false');
  if (dress.camera !== undefined && !['side', 'angle', 'top'].includes(dress.camera)) fail('dress.camera', "is 'side', 'angle' or 'top'");
  if (dress.background !== undefined && !hex(dress.background)) fail('dress.background', "wants '#rrggbb'");
  if (dress.playback !== undefined && !(typeof dress.playback === 'number' && dress.playback >= 1 && dress.playback <= 120)) fail('dress.playback', 'is seconds on screen, 1 to 120');
  if (dress.render !== undefined && !['points', 'volume'].includes(dress.render)) fail('dress.render', "is 'points' (the sampled cloud) or 'volume' (the density, ray-marched)");
  if (dress.render === 'volume' && system !== 'atom') fail('dress.render', "'volume' draws an atom world's orbitals; this is a " + system + ' world');
  if (dress.exposure !== undefined && !(typeof dress.exposure === 'number' && dress.exposure >= 0.1 && dress.exposure <= 10)) fail('dress.exposure', 'is 0.1 to 10');
  if (dress.exposure !== undefined && dress.render !== 'volume') fail('dress.exposure', "is how strongly a volume glows: it goes with render: 'volume'");
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

function layPlane(solved, dress, drawn, playback) {
  const { run, model } = solved, w = model.wall;
  const s = drawScale(model.L * 1e-9) * 1e-9, half = (model.L / 2) * s, Ls = model.L * s;   // s: scene units per nm
  const scaled = scaleLiberty(s * 1e9); if (scaled) drawn.push(scaled);
  const wallH = 0.05 * Ls, xw = (w ? w.at : 0) * s;
  // the far screen: the far field set at a drawn distance from the slits, covering where all but a 40th lands (to 40°)
  const D = half - xw + 0.2 * Ls, cdf = [], th = run.far.theta, pf = run.far.p;
  let acc = 0; for (let i = 0; i < th.length; i++) { if (i) acc += 0.5 * (pf[i] + pf[i - 1]) * (th[i] - th[i - 1]); cdf.push(acc); }
  const lo = th[cdf.findIndex((c) => c >= 0.0125 * acc)], hi = th[cdf.findIndex((c) => c >= 0.9875 * acc)];
  const reach = Math.min((40 * Math.PI) / 180, Math.max(Math.abs(lo), Math.abs(hi), 0.2));
  const Y = D * Math.tan(reach), Hs = 0.16 * Ls, xs = xw + D;
  const faces = [quad([[xs, -Y, 0], [xs, Y, 0], [xs, Y, Hs], [xs, -Y, Hs]], '#1d2536', 'scene')];
  faces.push(...bar([xs, -Y, Hs], [xs, Y, Hs], 0.004 * Ls, GREY, 'scene'), ...bar([xs, -Y, 0], [xs, Y, 0], 0.004 * Ls, GREY, 'scene'));
  // the dots: each detection at its angle, arriving one at a time over the run's second half
  const planets = [], movers = [], N = run.shots.length;
  let k = 0;
  const shown = [];
  run.shots.forEach((a, i) => { if (Math.abs(a) <= reach && shown.length < 400) shown.push({ a, i }); });
  // the dots' heights on the screen are dress, seeded apart from the model's angles
  let hseed = (model.seed * 2654435761 + 97) >>> 0;
  const rnd = () => { hseed = (hseed + 0x6D2B79F5) >>> 0; let t = hseed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (const { a } of shown) {
    const p = [xs - 0.003 * Ls, D * Math.tan(a), Hs * (0.08 + 0.84 * rnd())].map((c) => +c.toFixed(5));
    const t0 = +(playback * (0.5 + (0.5 * k) / Math.max(1, shown.length))).toFixed(4), group = `dot:${k}`;
    planets.push({ group, center: [0, 0, 0], radius: 0.006 * Ls, tint: hexRgb('#8fd6ff'), rough: 0.3, nlat: 5, nlon: 6 });
    movers.push({ group, path: [p, p], basePos: [0, 0, 0], t0, t1: playback });
    k++;
  }
  drawn.push({ what: '|ψ|² is drawn as light on the sheet, its brightness the square root of the probability against the brightest moment', why: 'so the weak wave past the wall shows beside the strong one that struck it' });
  if (w) drawn.push({ what: `the wall is drawn as a raised slab ${times(wallH / (w.thickness * s))} as tall as it is thick`, why: 'the model\'s wall is a potential in the plane, with no height' });
  drawn.push({ what: 'the far screen shows the far field: each dot stands at the angle its detection left the slits, at a drawn distance', why: 'a real screen stands far off, where the pattern has settled' });
  drawn.push({ what: 'the dots arrive one at a time over the run\'s second half, and their heights on the screen are drawn at random', why: 'the plane is two-dimensional, and when each lands is not the model' });
  if (shown.length < N) drawn.push({ what: `${shown.length} of the ${N} detections are drawn`, why: 'so the page stays quick; the counts are all of them' });
  const sr = run.series, R = sr.t.length;
  const arrive = shown.map((_, q) => playback * (0.5 + (0.5 * q) / Math.max(1, shown.length)));
  const rows = [
    { html: 'on the plane', values: sr.norm.map((v) => v * 100), unit: '%', plain: true },
    ...(w ? [{ html: 'past the wall', values: sr.past.map((v) => v * 100), unit: '%', plain: true }] : []),
    { html: 'detections', bar: true, int: true, color: '#8fd6ff', max: N, values: sr.t.map((_, q) => Math.round(arrive.filter((t) => t <= (q * playback) / (R - 1) + 1e-9).length * (N / Math.max(1, shown.length)))) },
  ];
  const shader = planeShader({ half, s, wall: w, wallH, period: playback, hold: LIFE_HOLD, frames: run.frames });
  const pts = [[-half, -half, 0], [half, half, wallH], [xs, -Y, 0], [xs, Y, Hs]];
  // the page opens behind the source, looking down the plane toward the screen
  const look = [0.5 * (xw + xs), 0, 0].map((c) => +c.toFixed(5)), d = Math.max(half + xs, Y) * 1.3;
  const cam = (name, at) => ({ name, worldFraming: { cameraPosition: at.map((c) => +c.toFixed(5)), lookAt: look, horizontalFov: 46 } });
  const cameras = [cam('source', [look[0] - 1.05 * d, -0.35 * d, 0.75 * d]), cam('top', [look[0], 0.0001, 1.5 * d]), cam('side', [look[0], -1.5 * d, 0.35 * d])];
  return { cameras, faces, planets, movers, pts, rows, t: sr.t.map((x) => x * 1e-15), durationS: model.duration * 1e-15, lead: 'angle', hold: LIFE_HOLD, labels: [], scale: s * 1e9, scaleNote: scaled, shader };
}

function layAtom(solved, dress, drawn) {
  const { run } = solved;
  const reachA = Math.max(...run.clouds.map((c) => 2.6 * c.meanR));
  const gap = 2.4 * reachA, n = run.clouds.length;
  const L = (gap * n) * BOHR, s = drawScale(L) * BOHR, Ls = gap * n * s;   // s: scene units per a₀
  const scaled = scaleLiberty(s / BOHR); if (scaled) drawn.push(scaled);
  const volume = dress.render === 'volume';
  const faces = [], planets = [], labels = [], pts = [], placed = [];
  const w = 0.004 * Ls;
  // the nucleus: a fixed share of the page, or under a volume (where it would hide a small orbital's core) a fifth of
  // the smallest orbital's mean radius at most
  const rNuc = volume ? Math.min(0.008 * Ls, 0.2 * Math.min(...run.clouds.map((c) => c.meanR)) * s) : 0.008 * Ls;
  run.clouds.forEach((c, i) => {
    const center = [(i - (n - 1) / 2) * gap * s, 0, 0];
    if (!volume) c.points.forEach((p, k) => faces.push(...dot3(add(center, scl(p, s)), w, c.signs[k] > 0 ? GOLD : BLUE, `orb:${i}`)));
    // (under a volume the nucleus sphere is the shader's; this one anchors the label)
    planets.push({ group: `nuc:${i}`, center, radius: 0.008 * Ls, tint: hexRgb('#ff7a59'), rough: 0.5 });
    labels.push({ group: `nuc:${i}`, text: c.name, lift: reachA * s * 0.9 });
    pts.push(add(center, [reachA * s, reachA * s, reachA * s]), add(center, [-reachA * s, -reachA * s, -reachA * s]));
    if (volume) placed.push({ n: c.n, l: c.l, m: c.m, center, reach: Math.min(volumeReach(c.n, c.l), 1.15 * reachA) });
  });
  if (volume) {
    drawn.push({ what: '|ψ|² is drawn as a glowing density, ray-marched through each orbital: brighter and more opaque where the probability is higher', why: 'a probability has no picture of its own' });
    drawn.push({ what: 'each orbital\'s glow is scaled to its own brightest point and its own size, and how strongly it glows is the exposure', why: 'so a large orbital and a small one both read' });
    drawn.push({ what: `the density is cut off where a thousandth of the probability is left outside`, why: 'its tail goes on for ever' });
  } else drawn.push({ what: `each point is one sampled position (${solved.model.samples} per orbital): the cloud is |ψ|² drawn as samples, not an electron's path`, why: 'a probability has no picture of its own' });
  drawn.push({ what: 'gold where ψ is positive, blue where it is negative', why: 'the sign is real, the colours are not' });
  drawn.push({ what: `the nucleus drawn ${times(rNuc / (0.84e-15 / BOHR * s))} its size`, why: 'at its true size (under a femtometre) it would be invisible' });
  const N = 61;
  const rows = run.clouds.flatMap((c) => [
    { html: esc(`${c.name}: E`), values: constant(c.energy, N), unit: 'eV' },
    { html: esc(`${c.name}: ⟨r⟩`), values: constant(c.meanR * BOHR, N), unit: 'm' },
  ]);
  const shader = volume ? volumeShader({ orbitals: placed, s, nucleus: rNuc, bg: hexRgb(dress.background), exposure: dress.exposure }) : null;
  return { faces, planets, movers: [], pts, rows, t: constant(0, N), noClock: true, durationS: null, lead: 'angle', hold: HOLD, labels, scale: s / BOHR, scaleNote: scaled, ...(shader ? { shader, placed } : {}) };
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
  const dress = normalizeQuantumDress(solved.dress, solved.system);
  const drawn = [];
  const sys = solved.system;
  const playback = dress.playback ?? (sys === 'decay' ? Math.max(4, Math.min(12, solved.model.duration)) : 8);
  const lay = sys === 'line' ? layLine(solved, dress, drawn) : sys === 'plane' ? layPlane(solved, dress, drawn, playback) : sys === 'atom' ? layAtom(solved, dress, drawn) : sys === 'spin' ? laySpin(solved, dress, drawn, playback) : layDecay(solved, dress, drawn, playback);
  if (sys === 'line') { const timed = timeLiberty(lay.durationS, playback); if (timed) drawn.push(timed); for (const m of lay.movers) m.period = playback; }
  if (sys === 'plane') { const timed = timeLiberty(lay.durationS, playback); if (timed) drawn.push(timed); }
  const { center, radius, cameras: framed } = framing([...lay.pts, ...lay.faces.flatMap((f) => f.corners)], { viewBox: manifest.viewBox, lead: dress.camera ?? lay.lead });
  const rate = lay.durationS ? lay.durationS / playback : 1;
  const cameras = lay.cameras && !dress.camera ? lay.cameras : framed;
  return { solved, dress, drawn, ...lay, cameras, bounds: { center, radius }, playback, rate, pagePos: () => center, radiusOf: () => 0.01 * radius };
}

function scienceConfig(plan, title) {
  const { solved, drawn } = plan;
  const sections = honesty({
    model: [...new Set(solved.model.laws.map((l) => l.law))].map((id) => SUMMARY[id]),
    gates: solved.gates, assumptions: solved.assumptions, liberties: [...drawn, ...solved.liberties], gaps: solved.gaps, held: solved.held,
  });
  if (plan.shader) {
    const text = solved.system === 'plane'
      ? 'the sheet is the solver\'s own frames of |ψ|², looked up by a shader; the shader conformance gate holds what it draws, and its wall, to them in the test suite (scripts/science-conformance.mjs)'
      : 'every pixel is a ray marched through ψ, generated from the orbitals\' own coefficients; the checks above are of the sampled points, and the shader conformance gate holds the shader\'s ψ to the exact function in the test suite (scripts/science-conformance.mjs)';
    sections.sections.splice(2, 0, { head: 'Drawn by a shader', color: '#9ad0ff', items: [{ text }] });
  }
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
  const science = plan.dress.hud || plan.shader ? { ...scienceConfig(plan, name), film: film.config, ...(plan.shader ? { probe: plan.shader.probe } : {}) } : null;
  return {
    faces: plan.faces, picks: [], movers: plan.movers, planets: plan.planets, cameras: plan.cameras,
    viewBox: isObj(manifest.viewBox) ? manifest.viewBox : { width: 1120, height: 780 },
    title: name, bg: manifest.dress?.background === undefined && hex(manifest.scene?.bg) ? manifest.scene.bg : plan.dress.background, glow: false,
    ...(plan.shader ? { effects: [plan.shader.layer] } : {}),
    ...(science ? { science: plan.dress.hud ? science : { ...science, rows: [], honesty: { sections: [] } } } : {}),
    ...(film.proposed ? { defaultShoot: film.proposed } : {}),
  };
}

