/**
 * The relativistic world's page, one layout per system, each saying plainly what of it is a picture:
 *
 *   light   the shader traces each pixel's light back from the eye (light-shader.js): the shadow, the photon ring,
 *           the disk's direct and lensed images shifted by g, the sky bent round the mass. The first camera is the
 *           model's observer; moving it makes you another observer. Its film: the eye swung toward the disk's plane.
 *   orbit   the mass a black sphere (its horizon), the photon sphere and the innermost stable orbit as rings, each
 *           body a dot leaving its trail, played on the far clock's time.
 *   clocks  each clock a face whose hand turns with its own time, the far clock beside them, a falling clock
 *           sliding in and slowing as it nears the horizon.
 *
 *   dress = { hud?, camera?, background?, playback?, film?, trails?, sky? ('grid' | 'stars'), hottest?, exposure? }
 */

import { solveRelativistic } from './solve.js';
import { RELATIVISTIC_LAWS } from './laws.js';
import { lightShader } from './light-shader.js';
import { PHOTON_SPHERE, ISCO } from './geodesic.js';
import { normalizeFilm, defaultShoot, filmConfig } from '../classical/film.js';
import { isObj, hex, hexRgb, hexInt, esc, sig, times, timeLiberty, bar, framing, honesty, PALETTE } from '../page.js';

const HOLD = 1.2;
const DRESS_KEYS = ['hud', 'camera', 'background', 'playback', 'film', 'trails', 'sky', 'hottest', 'exposure'];
const SUMMARY = Object.fromEntries(RELATIVISTIC_LAWS.map((r) => [r.id, r.summary]));
const fail = (where, msg) => { throw new Error(`science-worlds: ${where}: ${msg}`); };
const constant = (v, n) => Array.from({ length: n }, () => v);

export function normalizeRelativisticDress(dress, system) {
  const base = { hud: true, camera: null, background: '#05060c', playback: null, film: normalizeFilm(undefined, []), trails: true, sky: 'grid', hottest: 6500, exposure: 2.5 };
  if (dress == null) return base;
  if (!isObj(dress)) fail('dress', 'wants an object');
  const extra = Object.keys(dress).filter((k) => !DRESS_KEYS.includes(k));
  if (extra.length) fail('dress', `unknown field '${extra[0]}' (the relativistic dress takes ${DRESS_KEYS.join(', ')})`);
  for (const k of ['hud', 'trails']) if (dress[k] !== undefined && typeof dress[k] !== 'boolean') fail(`dress.${k}`, 'is true or false');
  const cams = system === 'light' ? ['observer', 'face-on', 'edge-on'] : ['side', 'angle', 'top'];
  if (dress.camera !== undefined && !cams.includes(dress.camera)) fail('dress.camera', `is ${cams.map((c) => `'${c}'`).join(', ')}`);
  if (dress.background !== undefined && !hex(dress.background)) fail('dress.background', "wants '#rrggbb'");
  if (dress.playback !== undefined && !(typeof dress.playback === 'number' && dress.playback >= 1 && dress.playback <= 120)) fail('dress.playback', 'is seconds on screen, 1 to 120');
  if (dress.sky !== undefined && !['grid', 'stars'].includes(dress.sky)) fail('dress.sky', "is 'grid' or 'stars'");
  if (dress.hottest !== undefined && !(typeof dress.hottest === 'number' && dress.hottest >= 3000 && dress.hottest <= 40000)) fail('dress.hottest', 'is the colour temperature the hottest ring is drawn at, 3000 to 40000 K');
  if (dress.exposure !== undefined && !(typeof dress.exposure === 'number' && dress.exposure >= 0.1 && dress.exposure <= 10)) fail('dress.exposure', 'is 0.1 to 10');
  return { ...base, ...Object.fromEntries(Object.entries(dress).filter(([k]) => k !== 'film')), film: normalizeFilm(dress.film, []) };
}

const km = (m) => (m >= 1e9 ? `${sig(m / 1.495978707e11, 3)} AU` : m >= 1e3 ? `${sig(m / 1e3, 3).toLocaleString('en-US')} km` : `${sig(m * 1e3, 3)} mm`);
const camAt = (name, pos, lookAt = [0, 0, 0]) => ({ name, worldFraming: { cameraPosition: pos.map((c) => +c.toFixed(6)), lookAt, horizontalFov: 46 } });
const ring = (radius, n, w, fill, group, dashed = false) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (dashed && i % 2) continue;
    const a0 = (2 * Math.PI * i) / n, a1 = (2 * Math.PI * (i + 1)) / n;
    out.push(...bar([radius * Math.cos(a0), radius * Math.sin(a0), 0], [radius * Math.cos(a1), radius * Math.sin(a1), 0], w, fill, group));
  }
  return out;
};

function layLight(solved, dress, drawn) {
  const m = solved.model, D = m.distance, i = m.inclination;
  const disk = m.disk ?? { inner: 0, outer: 0 };
  const shader = lightShader({ inner: disk.inner, outer: disk.outer, sky: dress.sky, hottest: dress.hottest, exposure: dress.exposure });
  const views = {
    observer: camAt('observer', [D * Math.sin(i), 0, D * Math.cos(i)]),
    'face-on': camAt('face-on', [0.0001, 0, D]),
    'edge-on': camAt('edge-on', [D * Math.sin(1.5533), 0, D * Math.cos(1.5533)]),   // 89°: exactly edge-on hides a thin disk
  };
  const lead = dress.camera ?? 'observer';
  const cameras = [views[lead], ...Object.keys(views).filter((k) => k !== lead).map((k) => views[k])];
  drawn.push({ what: `one unit of the scene is one Schwarzschild radius (${km(m.rs)})`, why: 'the shader traces light in those units' });
  drawn.push({ what: 'the picture is traced from wherever the camera is: move it and you are a different observer, held still there', why: 'the model\'s observer is the first camera' });
  drawn.push({ what: dress.sky === 'grid' ? 'the far sky is a grid of lines every 15°, so its bending shows' : 'the far sky is a field of made-up stars', why: 'what lies behind the mass is not in the model' });
  if (m.disk) {
    drawn.push({ what: `the disk's temperatures are stretched into visible colours: its hottest ring is drawn at ${dress.hottest.toLocaleString('en-US')} K, and its brightness is tone-mapped`, why: 'the real disk glows mostly in X-rays' });
  }
  const g = solved.run.gRange;
  const rows = [
    { html: 'Rs', values: [m.rs, m.rs], unit: 'm' },
    { html: 'shadow, seen from here', values: [(solved.run.alpha * 180) / Math.PI, (solved.run.alpha * 180) / Math.PI], unit: '°' },
    { html: 'observer at', values: [D * m.rs, D * m.rs], unit: 'm' },
    ...(g ? [{ html: 'disk light shifted by g', values: [g[0], g[0]], unit: '', plain: true, suffix: ` to ${sig(g[1], 3)}` }] : []),
  ];
  const pts = [[-D, -D, -D], [D, D, D]];
  return { shader, cameras, faces: [], planets: [], movers: [], pts, rows, t: [0, 1], noClock: true, durationS: null, hold: HOLD, labels: [], bounds: { center: [0, 0, 0], radius: Math.max(disk.outer, 6) } };
}

function layOrbit(solved, dress, drawn, playback) {
  const m = solved.model, runs = solved.run.runs;
  const far = Math.max(...runs.flatMap((q) => q.run.r), ISCO * 1.2);
  const w = 0.004 * far;
  const faces = [...ring(PHOTON_SPHERE, 48, w * 0.6, '#c58b38', 'scene', true), ...ring(ISCO, 64, w * 0.6, '#5c7fb0', 'scene', true)];
  const planets = [{ group: 'horizon', center: [0, 0, 0], radius: 1, tint: [0.01, 0.01, 0.012], rough: 0.9 }];
  const movers = [], labels = [{ group: 'horizon', text: 'horizon', lift: 1.4 }];
  runs.forEach((q, k) => {
    const tint = PALETTE[k % PALETTE.length], group = `body:${q.id}`, rDot = Math.max(0.012 * far, 0.15);
    planets.push({ group, center: [0, 0, 0], radius: rDot, tint: hexRgb(tint), rough: 0.5 });
    const path = q.run.x.map((p) => p.map((c) => +c.toFixed(5)));
    while (path.length < solved.run.runs[0].run.t.length) path.push(path[path.length - 1]);
    movers.push({ group, path, basePos: [0, 0, 0], period: playback, loop: false, hold: HOLD, ...(dress.trails ? { track: true, trackColor: hexInt(tint) } : {}) });
    if (runs.length > 1) labels.push({ group, text: q.id, lift: rDot * 2 });
  });
  const scaleNote = { what: `one unit of the scene is one Schwarzschild radius (${km(m.rs)})`, why: 'the geodesics are worked in those units' };
  drawn.push(scaleNote, { what: 'each body is drawn as a dot', why: 'a test body has no size' });
  drawn.push({ what: 'the rings mark the photon sphere (1.5 Rs, gold) and the innermost stable orbit (3 Rs, blue)', why: 'they are radii, not things' });
  drawn.push({ what: 'the motion plays on the far clock\'s time, without the delay light takes to reach a far eye', why: 'one clock for the whole page' });
  const N = solved.run.runs[0].run.t.length;
  const pad = (a) => { const o = a.slice(); while (o.length < N) o.push(o[o.length - 1]); return o; };
  const rows = runs.flatMap((q) => [
    { html: esc(`${q.id}: r`), values: pad(q.run.r.map((r) => r * m.rs)), unit: 'm' },
    { html: esc(`${q.id}: own time`), values: pad(q.run.tau.map((x) => x * m.tUnit)), unit: 's' },
  ]);
  const pts = [[-far, -far, -0.2 * far], [far, far, 0.2 * far]];
  return { faces, planets, movers, pts, rows, t: runs[0].run.t.map((x) => x * m.tUnit), durationS: m.duration, hold: HOLD, labels, scale: 1 / m.rs, scaleNote };
}

function layClocks(solved, dress, drawn, playback) {
  const m = solved.model, { clocks, t } = solved.run;
  const span = Math.max(...m.clocks.map((c) => c.at)), s = 10 / span;   // scene units per Rs
  const rFace = 0.55, w = 0.03;
  const hRad = Math.max(s, 0.25);
  const faces = [], planets = [{ group: 'mass', center: [0, 0, 0], radius: hRad, tint: [0.01, 0.01, 0.012], rough: 0.9 }], movers = [], labels = [];
  drawn.push({ what: 'the clocks stand on one line at their distances from the centre, to scale; their faces are drawn at one size', why: 'a clock\'s size is not the model' });
  if (hRad > s * 1.0001) drawn.push({ what: `the horizon is drawn ${times(hRad / s)} its size`, why: 'at its true size it would be too small to see' });
  drawn.push({ what: 'each hand turns with its clock\'s own time; the far clock makes four turns over the run', why: 'to compare rates by eye' });
  const T = t[t.length - 1];
  const face = (cx, cz, group, tint) => {
    for (let i = 0; i < 24; i++) {
      const a0 = (2 * Math.PI * i) / 24, a1 = (2 * Math.PI * (i + 1)) / 24;
      faces.push(...bar([cx + rFace * Math.cos(a0), 0, cz + rFace * Math.sin(a0)], [cx + rFace * Math.cos(a1), 0, cz + rFace * Math.sin(a1)], w, tint, group));
    }
  };
  const hand = (centres, taus, group, tint) => {
    planets.push({ group, center: [0, 0, 0], radius: 0.09, tint: hexRgb(tint), rough: 0.4, nlat: 6, nlon: 8 });
    const path = taus.map((tau, k) => { const a = Math.PI / 2 - (2 * Math.PI * 4 * tau) / T, c = centres[k]; return [c[0] + 0.85 * rFace * Math.cos(a), c[1], c[2] + 0.85 * rFace * Math.sin(a)].map((x) => +x.toFixed(5)); });
    movers.push({ group, path, basePos: [0, 0, 0], period: playback, loop: false, hold: HOLD });
  };
  const farX = 12.5;
  face(farX, 1.6, 'scene', '#c9d3e6');
  hand(t.map(() => [farX, 0, 1.6]), t, 'hand:far', '#ffffff');
  labels.push({ group: 'face:far', text: 'far clock', lift: 0 });
  planets.push({ group: 'face:far', center: [farX, 0, 1.6 + rFace + 0.35], radius: 0.001, tint: [0, 0, 0], rough: 1 });
  clocks.forEach((c, k) => {
    const tint = PALETTE[k % PALETTE.length];
    const centres = c.r.map((r) => [r * s, 0, 1.6]);
    if (!c.falls) face(c.at * s, 1.6, 'scene', tint);
    else {
      planets.push({ group: `body:${c.id}`, center: [0, 0, 0], radius: 0.18, tint: hexRgb(tint), rough: 0.5 });
      movers.push({ group: `body:${c.id}`, path: c.r.map((r) => [r * s, 0, 0.6].map((x) => +x.toFixed(5))), basePos: [0, 0, 0], period: playback, loop: false, hold: HOLD });
    }
    hand(c.falls ? c.r.map((r) => [r * s, 0, 0.6]) : centres, c.tau, `hand:${c.id}`, tint);
    labels.push({ group: c.falls ? `body:${c.id}` : `label:${c.id}`, text: c.falls ? `falls from ${km(c.at * m.rs)}` : km(c.at * m.rs), lift: c.falls ? 0.5 : 0 });
    if (!c.falls) planets.push({ group: `label:${c.id}`, center: [c.at * s, 0, 1.6 + rFace + 0.35], radius: 0.001, tint: [0, 0, 0], rough: 1 });
  });
  const timed = timeLiberty(m.duration, playback); if (timed) drawn.push(timed);
  const rows = clocks.flatMap((c) => {
    const name = c.falls ? `falls from ${km(c.at * m.rs)}` : `at ${km(c.at * m.rs)}`;
    return [
      { html: esc(`${name}: own time`), values: c.tau.map((x) => x * m.tUnit), unit: 's' },
      { html: esc(`${name}: behind the far clock`), values: c.tau.map((x, k) => (t[k] - x) * m.tUnit), unit: 's' },
    ];
  });
  const pts = [[-1, -1, -1], [farX + 1.5, 1, 3.2]];
  return { faces, planets, movers, pts, rows, t: t.map((x) => x * m.tUnit), durationS: m.duration, hold: HOLD, labels, lead: 'side', scale: s / m.rs, scaleNote: null };
}

/** Solve and lay out a relativistic world. */
export function planRelativisticWorld(manifest) {
  const solved = solveRelativistic({ model: manifest.model, ...(manifest.dress !== undefined ? { dress: manifest.dress } : {}), ...(manifest.liberties !== undefined ? { liberties: manifest.liberties } : {}) });
  const dress = normalizeRelativisticDress(solved.dress, solved.system);
  const drawn = [];
  const sys = solved.system;
  const playback = dress.playback ?? 8;
  const lay = sys === 'light' ? layLight(solved, dress, drawn) : sys === 'orbit' ? layOrbit(solved, dress, drawn, playback) : layClocks(solved, dress, drawn, playback);
  if (sys === 'orbit') { const timed = timeLiberty(lay.durationS, playback); if (timed) drawn.push(timed); }
  const framed = framing(lay.pts, { viewBox: manifest.viewBox, lead: dress.camera ?? lay.lead ?? 'angle' });
  const cameras = lay.cameras ?? framed.cameras;
  const bounds = lay.bounds ?? { center: framed.center, radius: framed.radius };
  const rate = lay.durationS ? lay.durationS / playback : 1;
  return { solved, dress, drawn, ...lay, cameras, bounds, playback, rate, pagePos: () => bounds.center, radiusOf: () => 0.01 * bounds.radius };
}

function scienceConfig(plan, title) {
  const { solved, drawn } = plan;
  const sections = honesty({
    model: [...new Set(solved.model.laws.map((l) => l.law))].map((id) => SUMMARY[id]),
    gates: solved.gates, assumptions: solved.assumptions, liberties: [...drawn, ...solved.liberties], gaps: solved.gaps, held: solved.held,
  });
  if (plan.shader) sections.sections.splice(2, 0, { head: 'Drawn by a shader', color: '#9ad0ff', items: [{ text: 'every pixel is a ray traced back with the same scheme the checks above use; the shader conformance gate holds the two together in the test suite (scripts/science-conformance.mjs)' }] });
  sections.sections.push({ head: `Sources (reviewed ${solved.reviewed})`, color: '#80cbc4', items: solved.sources.map((text) => ({ text })) });
  return {
    t: plan.t, period: plan.playback, hold: plan.hold, titleHtml: esc(title), titleText: title, ...(plan.noClock ? { noClock: true } : {}),
    barWidth: 230, labelWidth: 150, rows: plan.rows, labels: plan.labels, honesty: sections,
  };
}

// a light world's film swings the eye from the observer toward the disk's plane, at the observer's distance
function swingShoot(plan, film) {
  const m = plan.solved.model, D = m.distance, P = plan.playback, keys = [];
  const from = m.inclination, to = Math.min(1.55, Math.max(from + 0.35, 1.4));
  for (let k = 0; k <= 8; k++) {
    const a = from + ((to - from) * k) / 8, az = 0.35 * Math.sin((Math.PI * k) / 8);
    keys.push({ t: +(P * k / 8).toFixed(4), pos: [D * Math.sin(a) * Math.cos(az), D * Math.sin(a) * Math.sin(az), D * Math.cos(a)].map((c) => +c.toFixed(4)), poi: [0, 0, 0], hfov: 46 });
  }
  return { fps: 24, cameras: [{ id: 'eye', name: 'eye', type: 'two_node', keys }], shots: [{ name: 'run', camera: 'eye', span: [0, P] }, ...(film.endCard ? [{ name: 'end', camera: 'eye', span: [P, +(P + 0.95 * plan.hold).toFixed(4)] }] : [])] };
}

export function planRelativisticFilm(manifest, plan) {
  const film = plan.dress.film;
  const proposed = plan.solved.system === 'light' ? swingShoot(plan, film) : defaultShoot(plan, { ...film, replay: false }, null);
  const shoot = manifest.shoot ?? proposed;
  return { shoot, proposed: manifest.shoot ? null : proposed, config: filmConfig({ film, shoot, rate: plan.rate, playback: plan.playback, hold: plan.hold, labels: [] }) };
}

/** The World payload (emitThreeWorld) for a relativistic-view manifest. */
export function assembleRelativisticScene(manifest = {}, { title, plan: given } = {}) {
  const plan = given ?? planRelativisticWorld(manifest);   // a world placing this demo plans it once (science-worlds/setting.js)
  const name = title || manifest.title || 'mojulo relativistic world';
  const film = planRelativisticFilm(manifest, plan);
  const bg = manifest.dress?.background === undefined && hex(manifest.scene?.bg) ? manifest.scene.bg : plan.dress.background;
  const science = plan.dress.hud || plan.shader ? { ...scienceConfig(plan, name), film: film.config, ...(plan.shader ? { probe: plan.shader.probe } : {}) } : null;
  return {
    faces: plan.faces, picks: [], movers: plan.movers, planets: plan.planets, cameras: plan.cameras,
    viewBox: isObj(manifest.viewBox) ? manifest.viewBox : { width: 1120, height: 780 },
    title: name, bg, glow: false,
    ...(plan.shader ? { effects: [plan.shader.layer] } : {}),
    ...(science ? { science: plan.dress.hud ? science : { ...science, rows: [], honesty: { sections: [] } } } : {}),
    ...(film.proposed ? { defaultShoot: film.proposed } : {}),
  };
}

