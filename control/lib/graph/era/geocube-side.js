/**
 * THE SIDE STRIP — a side-scroller's level as the geocube draws it: the course the hero plays (its floors, steps and
 * walls), skinned in the cube's own layers, a little land behind it, the land and the range far behind that, and a few
 * low shapes in front. No valley round it: a side camera sees one band along one line, so that band is all that is built.
 *
 *   the PLAY LAYER   the course's boxes (gameworld/course.js, a straight lane along +y at x 0, the camera on the +x
 *                    side), merged into runs and drawn as columns down out of the frame: a `terrain` run in the cube's
 *                    land bands (a turf cap, a dirt band, the rock's beds and joints, the beds level across the whole
 *                    level so a gap shows the same strata on both sides), a `built` run as the cube's structure (a
 *                    trim cornice over ashlar courses in running bond, the stone and trim ramps). Only what the camera
 *                    sees is made: the top, the face toward it, an end where a gap or a lower neighbour shows it
 *   the TERRACE      a strip of land behind the lane, a little below the floors (where foes wait off the rail)
 *   the LAYERS       hills (with a few round crowns on their crest) and a far range at their own depth behind: the
 *                    side camera's perspective moves each by its depth, the parallax a real one
 *   the FOREGROUND   a few low hummocks between the camera and the lane, held under the hero's feet in the frame (law)
 *   the LIGHT        the cube's outside card (geocube.js lowerGeocube → its look card): the key, its ambient, its fog
 *                    and sky; every face baked under it
 *
 *   SIDE                      the strip's measures
 *   sidePads(boxes, length)   the ground before the first step and after the last, past the lane's ends (terrain runs)
 *   sideRuns(boxes)           the boxes merged into runs: { y0, y1, x0, x1, top, lo, role }
 *   assembleSideStrip(m, ctx) the `geocube` kind's `show: 'side'`: { cube?, seed?, side: { length, boxes } } → payload
 *   sideLaws(m, payload)      what the strip holds to (every run skinned, the foreground under the feet, the budget)
 *
 * Pure: the same recipe makes the same bytes.
 */
import { readGeocube, lowerGeocube, geocubeRamps } from './geocube.js';
import { outTrailStyle } from './out-trail-board.js';
import { sunDir } from './sun.js';
import { hash3, vnoise } from './dirt.js';
import { r5, hexRgb, rgbHex } from './geom.js';

/** The cube a strip is drawn in when its level names none: limestone, red roofs, a green valley (the meadow's). */
export const SIDE_CUBE = 'valley-morning';
/** The side camera's own defaults (worlds/controllable/rules-basic.js side): the foreground's law is read against them. */
export const SIDE_CAMERA = Object.freeze({ dist: 11, tilt: 0.2, lookH: 1.2, vfov: 32.64 });
export const SIDE = Object.freeze({
  under: 8,                              // m a column runs below the lowest top (out of the frame)
  cap: 0.24, dirt: 0.62,                 // the terrain's turf and dirt bands
  bed: [0.34, 0.66], joint: [0.8, 1.7],  // the rock's beds and the joints along them
  course: 0.42, stone: [0.7, 1.35],      // a built run's ashlar: its courses and its stones
  cornice: 0.2,                          // its trim at the top
  dressed: 6,                            // m below a top the bands and joints run; under that one plain face
  pad: 16,                               // m of ground past each end of the lane
  terrace: Object.freeze({ back: -9, front: -2.4, drop: 0.85, step: 1.5 }),
  hills: Object.freeze({ crest: -27, foot: -13, rise: [2.5, 8], period: 28, step: 2, crown: [5, 10], haze: 0.22 }),
  range: Object.freeze({ crest: -115, foot: -70, rise: [14, 36], period: 64, step: 4, haze: 0.5 }),
  fore: Object.freeze({ x: 5.2, every: [14, 24], len: [1.6, 3.2], margin: 3, shade: 0.72 }),
  // the KEY a side-scroller is lit by: from behind the camera and above, a little from the left, so the faces it shows
  // are the lit ones (the cube's key colour, ambient and gains); its exposure brought to the light a lit face takes
  key: Object.freeze([0.52, -0.3, 0.8]),
});

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lerp = (a, b, t) => a + (b - a) * t;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const no = (m) => { throw new Error(`geocube side: ${m}`); };

/** The ground past the lane's ends: from the first step's foot back `pad` metres, from the last step's foot on. */
export function sidePads(boxes, length) {
  const ys = boxes.map((b) => [b.min[1], b.max[1]]), lo = Math.min(...ys.map((y) => y[0])), hi = Math.max(...ys.map((y) => y[1]));
  return [
    { min: [-1.5, r5(-SIDE.pad), -0.5], max: [1.5, r5(lo), 0], role: 'terrain' },
    { min: [-1.5, r5(hi), -0.5], max: [1.5, r5(length + SIDE.pad), 0], role: 'terrain' },
  ];
}

/** Boxes into runs: one run while the boxes touch along the lane at one top and one role. */
export function sideRuns(boxes) {
  const B = [...boxes].sort((a, b) => a.min[1] - b.min[1] || a.max[2] - b.max[2]), runs = [];
  for (const b of B) {
    const role = b.role === 'built' ? 'built' : 'terrain', last = runs[runs.length - 1];
    if (last && last.role === role && Math.abs(last.top - b.max[2]) < 1e-3 && b.min[1] <= last.y1 + 1e-3) {
      last.y1 = Math.max(last.y1, b.max[1]); last.lo = Math.min(last.lo, b.min[2]);
      last.x0 = Math.min(last.x0, b.min[0]); last.x1 = Math.max(last.x1, b.max[0]);
    } else runs.push({ y0: b.min[1], y1: b.max[1], x0: b.min[0], x1: b.max[0], top: b.max[2], lo: b.min[2], role });
  }
  return runs;
}

function readSide(m) {
  const S = m.side;
  if (!isObj(S)) no('side is { length, boxes: [{ min, max, role? }] }: the course a side camera plays, on a lane along +y');
  if (!(Number.isFinite(S.length) && S.length > 0)) no('side.length is the lane\'s metres');
  if (!Array.isArray(S.boxes) || !S.boxes.length) no('side.boxes are the course\'s boxes');
  for (const b of S.boxes) if (!Array.isArray(b.min) || !Array.isArray(b.max) || b.min.length !== 3 || b.max.length !== 3) no('a side box is { min: [x, y, z], max: [x, y, z], role? }');
  return S;
}

/** The cube's outside card and ramps, and its light as a bake. */
function lookOf(m) {
  const cube = readGeocube(m.cube ?? SIDE_CUBE), low = lowerGeocube(cube, 'outside');
  const { st } = outTrailStyle({ kit: low.kit }), R = geocubeRamps(cube), Lt = st.light;
  const L = ((v) => { const l = Math.hypot(...v); return v.map((x) => x / l); })(SIDE.key), amb = hexRgb(Lt.ambient).map((v) => v * (Lt.fill ?? 0.6)), key = hexRgb(Lt.key.color).map((v) => v * (Lt.sunGain ?? 1));
  const expose = 1.05 / ((amb[0] + amb[1] + amb[2]) / 3 + 0.8 * (key[0] + key[1] + key[2]) / 3);
  const hexes = (h) => h.map((x) => hexRgb(x).map((v) => v * 255));
  const ramps = { grass: st.palette.grass, soil: st.palette.soil, rock: st.palette.rock, foliage: st.palette.foliage, far: st.palette.far, sky: st.palette.sky,
    stone: hexes(R.stone), trim: hexes(R.trim), accent: hexes(R.accent) };
  // a ramp at t (0 its dark end, 1 its light)
  const at = (name, t) => { const r = ramps[name], u = Math.max(0, Math.min(1, t)) * (r.length - 1), i = Math.min(r.length - 2, Math.floor(u)); return r[i].map((c, k) => lerp(c, r[i + 1][k], u - i)); };
  const lit = (rgb, n, k = 1) => rgbHex(rgb.map((c, i) => (c / 255) * (amb[i] + key[i] * Math.max(0, dot(n, L))) * expose * k));
  // (a colour seen through the air: toward the horizon by `k`)
  const horizon = st.palette.sky[st.palette.sky.length - 1], hazed = (hex, k) => rgbHex(hexRgb(hex).map((v, i) => lerp(v, horizon[i] / 255, k)));
  return { cube, st, at, lit, hazed, sun: sunDir(Lt.key.elevation, Lt.key.azimuth) };
}

// a quad facing n, its corners turned anticlockwise seen from outside (from its normal's side)
const quad = (out, corners, n, fill, group) => {
  const [a, b, c] = corners, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  out.push({ corners: (dot(w, n) < 0 ? [...corners].reverse() : corners).map((p) => p.map(r5)), normal: n, fill, group });
};
const FACE = { top: [0, 0, 1], px: [1, 0, 0], ny: [0, -1, 0], py: [0, 1, 0] };

// the rock's beds, level across the level: a datum high over it, each bed's thickness its own die
function bedsOf(seed, hi, lo) {
  const out = [];
  let z = Math.ceil(hi) + 2, k = 0;
  while (z > lo) { const t = lerp(SIDE.bed[0], SIDE.bed[1], hash3(k, 3, seed + 11)); out.push([z - t, z, k]); z -= t; k++; }
  return out;
}

/** The face toward the camera of a span [y0, y1] at x, from top down to bottom, in its role's bands. */
function skinFront(out, look, run, { x, y0, y1, top, bottom, n, seed, beds, end = false }) {
  const { at, lit } = look;
  // (an end stands across x at one y; a front along y at one x)
  const plane = (ya, yb, za, zb) => (end ? [[x[0], ya, za], [x[1], ya, za], [x[1], ya, zb], [x[0], ya, zb]] : [[x, ya, za], [x, yb, za], [x, yb, zb], [x, ya, zb]]);
  const band = (za, zb, rgb, g, ya = y0, yb = y1) => { if (zb - za > 1e-4 && (end || yb - ya > 1e-4)) quad(out, plane(ya, yb, za, zb), n, end ? lit(rgb, FACE.px, 0.82) : lit(rgb, n), g); };
  const deep = Math.max(bottom, top - SIDE.dressed);
  if (run.role === 'built') {
    band(top - SIDE.cornice, top, at('trim', 0.72), 'side:trim');
    let k = 0;
    for (let z1 = top - SIDE.cornice; z1 > deep + 1e-4; z1 -= SIDE.course, k++) {
      const z0 = Math.max(deep, z1 - SIDE.course);
      if (end) { band(z0, z1, at('stone', 0.5 + 0.12 * (hash3(k, 7, seed) - 0.5)), 'side:stone'); continue; }
      // stones in running bond: a course's joints offset by half a stone from the course above
      let y = Math.floor(y0 / SIDE.stone[1]) * SIDE.stone[1] - (k % 2 ? SIDE.stone[1] / 2 : 0), j = 0;
      while (y < y1) {
        const len = lerp(SIDE.stone[0], SIDE.stone[1], hash3(Math.round(y * 10), k, seed + 21)), ya = Math.max(y0, y), yb = Math.min(y1, y + len);
        band(z0, z1 - 0.03, at('stone', 0.42 + 0.2 * hash3(j, k, seed + 23)), 'side:stone', ya, yb);
        band(z1 - 0.03, z1, at('stone', 0.22), 'side:mortar', ya, yb);
        y += len; j++;
      }
    }
  } else {
    band(top - SIDE.cap, top, at('grass', 0.62), 'side:turf');
    band(top - SIDE.cap - SIDE.dirt, top - SIDE.cap, at('soil', 0.5), 'side:dirt');
    const z1d = top - SIDE.cap - SIDE.dirt;
    for (const [b0, b1, k] of beds) {
      const za = Math.max(b0, deep), zb = Math.min(b1, z1d);
      if (zb <= za) continue;
      const shade = 0.42 + 0.22 * hash3(k, 5, seed + 31);
      if (end) { band(za, zb, at('rock', shade), 'side:rock'); continue; }
      let y = Math.floor(y0 / SIDE.joint[1]) * SIDE.joint[1] + SIDE.joint[1] * hash3(k, 9, seed + 33), j = 0;
      if (y > y0) y -= SIDE.joint[1];
      while (y < y1) {
        const len = lerp(SIDE.joint[0], SIDE.joint[1], hash3(Math.round(y * 10), k, seed + 35)), ya = Math.max(y0, y), yb = Math.min(y1, y + len);
        band(za, zb, at('rock', shade + 0.1 * (hash3(j, k, seed + 37) - 0.5)), 'side:rock', ya, yb);
        y += len; j++;
      }
    }
  }
  // under the dressed depth: one plain face, out of the frame
  if (deep > bottom) band(bottom, deep, run.role === 'built' ? at('stone', 0.3) : at('rock', 0.3), 'side:under');
}

function skinRun(out, look, run, runs, { seed, beds, bottom }) {
  const { at, lit } = look, { x0, x1, y0, y1, top } = run;
  quad(out, [[x0, y0, top], [x1, y0, top], [x1, y1, top], [x0, y1, top]], FACE.top, lit(run.role === 'built' ? at('trim', 0.62) : at('grass', 0.55), FACE.top), run.role === 'built' ? 'side:top-built' : 'side:top');
  skinFront(out, look, run, { x: x1, y0, y1, top, bottom, n: FACE.px, seed, beds });
  // an end shows where its neighbour stands lower (or none does): from the neighbour's top up
  for (const [y, n, side] of [[y0, FACE.ny, -1], [y1, FACE.py, 1]]) {
    const next = runs.filter((r) => r !== run && (side < 0 ? Math.abs(r.y1 - y) < 0.05 : Math.abs(r.y0 - y) < 0.05) && r.x0 <= x0 + 1e-3 && r.x1 >= x1 - 1e-3);
    const from = next.length ? Math.max(...next.map((r) => r.top)) : bottom;
    if (from < top - 1e-3) skinFront(out, look, run, { x: [x0, x1], y0: y, y1: y, top, bottom: from, n, seed, beds, end: true });
  }
}

// the floor's height along the lane, for what stands behind and before it: the lowest top within `w` metres
const topNear = (runs, y, w) => { let t = Infinity; for (const r of runs) if (r.y1 >= y - w && r.y0 <= y + w) t = Math.min(t, r.top); return Number.isFinite(t) ? t : 0; };

/** The `geocube` kind's side strip: the course skinned in the cube's layers, its land behind, its foreground. */
export function assembleSideStrip(m, ctx = {}) {
  const S = readSide(m), seed = Number.isFinite(m.seed) ? m.seed : 1, look = lookOf(m), { at, lit, st } = look;
  const runs = sideRuns(S.boxes), faces = [];
  const tops = runs.map((r) => r.top), hi = Math.max(...tops), lo = Math.min(...tops), bottom = lo - SIDE.under;
  const beds = bedsOf(seed, hi, bottom);
  for (const r of runs) skinRun(faces, look, r, runs, { seed, beds, bottom });
  const y0 = -SIDE.pad, y1 = S.length + SIDE.pad;

  // the TERRACE behind the lane: a little below the floors near it, its top turf, its face toward the camera dirt and rock
  const T = SIDE.terrace, terrace = [];
  for (let y = y0 - 10; y < y1 + 10 - 1e-6; y += T.step) {
    const h = (yy) => topNear(runs, yy, 3) - T.drop + 0.35 * (vnoise(yy * 0.09, 0.5, seed + 41) - 0.5);
    const ha = h(y), hb = h(y + T.step), yb = y + T.step;
    terrace.push({ y, h: ha });
    quad(faces, [[T.back, y, ha], [T.front, y, ha], [T.front, yb, hb], [T.back, yb, hb]], FACE.top, lit(at('grass', 0.55), FACE.top), 'side:terrace');
    const band = (za, zb, zc, zd, rgb, g) => quad(faces, [[T.front, y, za], [T.front, yb, zc], [T.front, yb, zd], [T.front, y, zb]], FACE.px, lit(rgb, FACE.px), g);
    band(ha - SIDE.cap, ha, hb - SIDE.cap, hb, at('grass', 0.45), 'side:terrace');
    band(ha - 1.2, ha - SIDE.cap, hb - 1.2, hb - SIDE.cap, at('soil', 0.42), 'side:terrace');
    band(bottom, ha - 1.2, bottom, hb - 1.2, at('rock', 0.36), 'side:terrace');
  }

  // the HILLS: a slope from their crest down toward the lane, in the air's first veil, round crowns along the crest
  const Hl = SIDE.hills, base = lo - 3, reachH = (Math.abs(Hl.crest) + SIDE_CAMERA.dist) * 0.6, hillH = (yy) => base + lerp(Hl.rise[0], Hl.rise[1], vnoise(yy / Hl.period, 1.5, seed + 51));
  const slopeN = (dz) => { const v = [dz, 0, Hl.foot - Hl.crest]; const l = Math.hypot(...v); return v.map((x) => x / l); };
  for (let y = y0 - reachH; y < y1 + reachH; y += Hl.step) {
    const ha = hillH(y), hb = hillH(y + Hl.step), yb = y + Hl.step, n = slopeN(ha - (base - 2));
    quad(faces, [[Hl.crest, y, ha], [Hl.foot, y, base - 2], [Hl.foot, yb, base - 2], [Hl.crest, yb, hb]], n, look.hazed(lit(at('grass', 0.5), n), Hl.haze), 'side:hills');
  }
  // (a tree every few metres along the crest: a trunk under a round crown, eight-sided, widening and closing again)
  for (let y = y0 - reachH, k = 0; y < y1 + reachH; k++) {
    y += lerp(Hl.crown[0], Hl.crown[1], hash3(k, 13, seed + 53));
    const gz = hillH(y), r = 1.4 + 0.9 * hash3(k, 14, seed + 53), h = 2.6 + 1.6 * hash3(k, 15, seed + 53), cx = Hl.crest + 2.5, trunk = 0.9 + 0.6 * hash3(k, 16, seed + 53);
    const tn = [1, 0, 0];
    quad(faces, [[cx + 0.3, y - 0.18, gz - 0.4], [cx + 0.3, y + 0.18, gz - 0.4], [cx + 0.3, y + 0.18, gz + trunk + 0.3], [cx + 0.3, y - 0.18, gz + trunk + 0.3]], tn, look.hazed(lit(at('soil', 0.32), tn), Hl.haze), 'side:crowns');
    const ring = (rr, z) => Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * 2 * Math.PI; return [cx + rr * Math.cos(a), y + rr * Math.sin(a), z]; });
    const rings = [ring(r * 0.55, gz + trunk), ring(r, gz + trunk + h * 0.4), ring(r * 0.78, gz + trunk + h * 0.78), ring(r * 0.3, gz + trunk + h)];
    for (let b = 0; b < 3; b++) for (let i = 0; i < 8; i++) {
      const i2 = (i + 1) % 8, a = ((i + 0.5) / 8) * 2 * Math.PI, up = [-0.55, 0.15, 0.7][b], n = ((v) => { const l = Math.hypot(...v); return v.map((x) => x / l); })([Math.cos(a), Math.sin(a), up]);
      if (n[0] < -0.35) continue;   // (its back, never seen)
      quad(faces, [rings[b][i], rings[b][i2], rings[b + 1][i2], rings[b + 1][i]], n, look.hazed(lit(at('foliage', 0.55), n), Hl.haze), 'side:crowns');
    }
    quad(faces, rings[3], FACE.top, look.hazed(lit(at('foliage', 0.68), FACE.top), Hl.haze), 'side:crowns');
  }

  // the RANGE: far, in the far ramp and deep in the air, a slope of peaks
  const Rg = SIDE.range, reachR = (Math.abs(Rg.crest) + SIDE_CAMERA.dist) * 0.62;
  for (let y = y0 - reachR; y < y1 + reachR; y += Rg.step) {
    const h = (yy) => base + lerp(Rg.rise[0], Rg.rise[1], Math.abs(2 * vnoise(yy / Rg.period, 2.5, seed + 61) - 1)), ha = h(y), hb = h(y + Rg.step), n = [0.4, 0, 0.92];
    quad(faces, [[Rg.crest, y, ha], [Rg.foot, y, base - 12], [Rg.foot, y + Rg.step, base - 12], [Rg.crest, y + Rg.step, hb]], n, look.hazed(lit(at('rock', 0.62), n), Rg.haze), 'side:range');
  }

  // the FOREGROUND: a few low hummocks before the lane, each held under the hero's feet line in the frame (foreTop)
  const F = SIDE.fore, fore = [];
  for (let y = y0 + 4, k = 0; y < y1 - 4; k++) {
    y += lerp(F.every[0], F.every[1], hash3(k, 17, seed + 71));
    const len = lerp(F.len[0], F.len[1], hash3(k, 18, seed + 71)), cap = foreTop(topNear(runs, y, len), F.x), peak = cap - 0.25 * hash3(k, 19, seed + 71);
    const pts = Array.from({ length: 5 }, (_, i) => { const u = i / 4; return [y + u * len, lerp(cap - 1.1, peak, Math.sin(u * Math.PI))]; });
    for (let i = 0; i < 4; i++) {
      const [[ya, za], [yb, zb]] = [pts[i], pts[i + 1]];
      quad(faces, [[F.x, ya, bottom], [F.x, yb, bottom], [F.x, yb, zb], [F.x, ya, za]], FACE.px, lit(at('foliage', 0.4), FACE.px, F.shade), 'side:fore');
    }
    fore.push({ y0: r5(y), y1: r5(y + len), top: r5(peak), cap: r5(cap) });
    y += len;
  }

  const sky = st.palette.sky, ground0 = runs.find((r) => r.y0 <= 1 && r.y1 >= 1)?.top ?? 0;
  const payload = {
    faces,
    lights: [],
    cameras: [{ name: 'side', worldFraming: { cameraPosition: [r5(SIDE_CAMERA.dist), 6, r5(ground0 + 3.4)], lookAt: [0, 6, r5(ground0 + SIDE_CAMERA.lookH)], horizontalFov: 55 } }],
    viewBox: m.viewBox || { width: 1120, height: 780 },
    title: ctx.title || m.title || `mojulo geocube · side strip`,
    bg: rgbHex(sky[sky.length - 1].map((v) => v / 255)),
    haze: { color: st.air.fog.color, density: st.air.fog.density },
    sky: { zenith: sky[0], horizon: sky[sky.length - 1], day: 1, stars: 0, seed: 1, ...(st.sun ? { sun: { dir: look.sun.map(r5), size: st.sun.size, glow: st.sun.glow } } : {}) },
    pack: true,
  };
  Object.defineProperty(payload, 'side', { value: { runs, terrace, fore, bottom, cube: look.cube.id }, enumerable: false });
  return payload;
}

/** The highest a foreground shape at `x` may stand over a floor at `top`: under the hero's feet line in the side frame,
 * by SIDE.fore.margin degrees (the camera at its defaults over that floor). */
export function foreTop(top, x) {
  const C = SIDE_CAMERA, H = C.lookH + C.dist * Math.sin(C.tilt), Dc = C.dist * Math.cos(C.tilt), feet = Math.atan2(H, Dc);
  return top + H - (Dc - x) * Math.tan(feet + (SIDE.fore.margin * Math.PI) / 180);
}

/** What a side strip holds to: every run skinned (its top and its face toward the camera), every foreground shape under
 * the feet line, the faces within the budget. → [{ id, holds, says }]. */
export function sideLaws(m, payload, { budget = 12000 } = {}) {
  const P = payload.side, faces = payload.faces;
  const skinned = P.runs.every((r) => faces.some((f) => f.group?.startsWith('side:top') && Math.abs(f.corners[0][2] - r.top) < 1e-3 && f.corners[0][1] >= r.y0 - 1e-3 && f.corners[2][1] <= r.y1 + 1e-3));
  const under = P.fore.every((f) => f.top <= f.cap + 1e-6);
  return [
    { id: 'skinned', holds: skinned, says: `every run of the course wears the cube's layers (${P.runs.length} runs)` },
    { id: 'foreground', holds: under, says: `every foreground shape stands under the hero's feet in the frame (${P.fore.length})` },
    { id: 'budget', holds: faces.length <= budget, says: `${faces.length} faces, ${budget} at most` },
  ];
}
