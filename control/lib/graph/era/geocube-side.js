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
 *   the DRESS        what makes the land behind the lane a place (docs/side-strip-principles.md, lifted from a running
 *                    course's dress): the terrace in slices, A a grove and B open ground, in the walls' order; tufts
 *                    over it; clouds low over the range; a small tower where the lane goes
 *   the SHAPES       (opt-in, a cube's or the strip's own: SHAPE_FAMILIES) one family of silhouettes for the whole
 *                    strip, flat and facing the camera, and a camera nearly level so the sky is in the frame
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
import { rhythmFaults } from './wall-rhythm.js';

/** The cube a strip is drawn in when its level names none: limestone, red roofs, a green valley (the meadow's). */
export const SIDE_CUBE = 'valley-morning';
/** The side camera's own defaults (worlds/controllable/rules-basic.js side): the foreground's law is read against them. */
export const SIDE_CAMERA = Object.freeze({ dist: 11, tilt: 0.2, lookH: 1.2, vfov: 32.64 });
/**
 * THE SHAPE FAMILIES a strip's land is drawn in (docs/side-strip-principles.md, "one family of shapes"): a side level is
 * a stack of silhouettes, and it is one place when every silhouette is the same kind of shape. A family is a row.
 *   scoops   every shape a dome or a circle: scooped hills in three rows, each about 1.6 times the one before it and a
 *            step paler; round crowns; puffed clouds; a domed tower; turf that hangs over a floor's edge in scallops
 * A cube names its family (SIDE_SHAPES), a strip's `side.shapes` says its own, and one with neither is drawn as it was.
 */
export const SHAPE_FAMILIES = Object.freeze({ scoops: 'every shape a dome or a circle: scooped hills, round crowns, puffed clouds, a domed tower, scalloped turf' });
/** The family each cube's side strip is drawn in. */
export const SIDE_SHAPES = Object.freeze({ 'sherbet-orchard': 'scoops' });
const cubeIdOf = (c) => (typeof c === 'string' ? c : isObj(c) ? c.from ?? c.id ?? null : null);
/** A strip's shape family: its own word, else its cube's; null: none (drawn as it was). */
export function sideShapes(cube, own) {
  const f = own ?? SIDE_SHAPES[cubeIdOf(cube)] ?? null;
  if (f !== null && !SHAPE_FAMILIES[f]) no(`side.shapes is one of: ${Object.keys(SHAPE_FAMILIES).join(', ')}`);
  return f;
}
/** The side camera a shaped strip is framed by: nearly level and looking a little over the hero, so the sky and the far
 * rows are in the frame (the default looks down at the lane and shows mostly ground). */
export const SHAPED_CAMERA = Object.freeze({ dist: 11, tilt: 0.08, lookH: 1.8, vfov: 32.64 });
/** The words a level's side camera takes for a shaped strip ({} for none). */
export const sideCameraWords = (cube, own) => (sideShapes(cube, own) ? { tilt: SHAPED_CAMERA.tilt, lookH: SHAPED_CAMERA.lookH } : {});
// the scoops' measures: three rows of domes (their depth, widths and heights over the land's base, how far each is
// taken into the air), the crowns, the clouds, the scallops under a floor's turf
const SCOOPS = Object.freeze({
  // (a STAIR of silhouettes, docs/side-scroll-backgrounds.md: each nearer row's crests stand under the farther row's in
  // the frame, so every row shows its own edge against the one behind it and the sky keeps a quarter of the picture)
  rows: Object.freeze([
    { x: -115, w: [60, 104], h: [9, 15], lap: 0.7, ramp: 'far', t: 0.55, haze: 0.55, group: 'side:range' },
    { x: -44, w: [24, 40], h: [4.5, 7.5], lap: 0.76, ramp: 'grass', t: 0.74, haze: 0.34, group: 'side:hills' },
    { x: -22, w: [12, 20], h: [2.4, 4.2], lap: 0.8, ramp: 'grass', t: 0.62, haze: 0.16, group: 'side:hills' },
  ]),
  // THE LIGHT, as shapes (the seventh generation's principles turned into silhouettes: one key every shape agrees on,
  // the air between the rows, contact where things meet). The key comes from up the lane (+y) and above: each dome
  // wears a lit cap toward it, each crown its light on that side; mist pools at a row's foot; a thing on the ground
  // lays a soft shadow down the lane from the light; the turf's lip shades the dirt under it; a floor's edge catches
  // the light
  light: Object.freeze({ side: 1, cap: 0.62, capLift: 0.3, gain: 0.55, mist: 0.32, mistH: 0.34, shadow: 0.2, lip: 0.14, rim: 0.05 }),
  // (the clouds high in the sky the rows leave, each a few puffs on a flat base that is a step into the shade)
  crown: Object.freeze({ r: [0.5, 1.05] }), cloud: Object.freeze({ every: [26, 50], x: -150, z: [17, 30], w: [12, 24] }),
  // (THE MOTION, channels/ambient.js: the clouds drift a few metres over a minute and more; the blossom breathes in the breeze)
  motion: Object.freeze({ 'side:clouds': Object.freeze({ amp: [0, 7, 0.4], period: 84, spread: 0.02 }), 'side:blossom': Object.freeze({ amp: [0, 0.05, 0.035], period: 3.6, spread: 0.9 }) }),
  scallop: 0.27, bud: [0.1, 0.2],
});

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
  // THE DRESS of the land behind the lane (docs/side-strip-principles.md): the terrace laid in SLICES `cell` metres
  // long, A (a grove: trees of unlike sizes, a bush, a stone) and B (open ground that lets A be seen), ordered by the
  // walls' rule; tufts along its front edge, where the land passes fastest; clouds low over the range; and where the
  // lane goes, a small tower at the terrace's back past its end
  dress: Object.freeze({ cell: 9, trees: [2, 3], tree: Object.freeze({ r: [0.5, 1.05], h: [1.3, 2.4], trunk: [0.6, 1.1], back: [0.8, 3.4], haze: 0.1 }), bush: [0.5, 0.95], stone: [0.35, 0.7], tuft: Object.freeze({ every: [0.5, 1.3], h: [0.28, 0.6], w: 0.17 }), clouds: Object.freeze({ every: [22, 44], x: -150, z: [7, 15], w: [10, 22], h: [1.4, 2.8] }), tower: Object.freeze({ past: 2.5, w: 1.9, h: 3, roof: 1.5 }) }),
  // the KEY a side-scroller is lit by: from behind the camera and above, a little from the left, so the faces it shows
  // are the lit ones (the cube's key colour, ambient and gains); its exposure brought to the light a lit face takes
  key: Object.freeze([0.52, -0.3, 0.8]),
});

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lerp = (a, b, t) => a + (b - a) * t;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const no = (m) => { throw new Error(`geocube side: ${m}`); };
// how far a shaped strip's terrace is taken into the air (toward the sky's own colour)
const TERRACE_AIR = 0.24;

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
  // (AERIAL PERSPECTIVE, a shaped strip's: a far thing goes toward the SKY'S OWN COLOUR, not toward white, so distance
  // is told by hue and the land keeps its chroma; and the key's colour, for what the light touches)
  const air = st.palette.sky[Math.floor((st.palette.sky.length - 1) / 2)], aired = (hex, k) => rgbHex(hexRgb(hex).map((v, i) => lerp(v, air[i] / 255, k)));
  const warm = hexRgb(Lt.key.color), sunlit = (hex, k) => rgbHex(hexRgb(hex).map((v, i) => Math.min(1, lerp(v, Math.min(1, v * 1.18 + 0.1 * warm[i]), k))));
  return { cube, st, at, lit, hazed, aired, sunlit, sun: sunDir(Lt.key.elevation, Lt.key.azimuth) };
}

// a quad facing n, its corners turned anticlockwise seen from outside (from its normal's side)
const quad = (out, corners, n, fill, group) => {
  const [a, b, c] = corners, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  out.push({ corners: (dot(w, n) < 0 ? [...corners].reverse() : corners).map((p) => p.map(r5)), normal: n, fill, group });
};
const FACE = { top: [0, 0, 1], px: [1, 0, 0], ny: [0, -1, 0], py: [0, 1, 0] };
const n_px = FACE.px;

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
    // (scoops: the turf hangs over the dirt in scallops, a row of half discs under the cap)
    if (look.shapes === 'scoops' && !end) {
      // (the lip's shade on the dirt under the scallops, and the light caught along the floor's edge)
      band(top - SIDE.cap - SCOOPS.scallop - SCOOPS.light.lip, top - SIDE.cap - SCOOPS.scallop * 0.35, at('soil', 0.36), 'side:lip');
      quad(out, plane(y0, y1, top - SCOOPS.light.rim, top).map((c) => [c[0] + 0.02, c[1], c[2]]), n, look.sunlit(lit(at('grass', 0.66), FACE.top), 0.5), 'side:rim');
    }
    if (look.shapes === 'scoops' && !end) { const r = SCOOPS.scallop, n = Math.floor((y1 - y0) / (2 * r)), pad = (y1 - y0 - n * 2 * r) / 2; for (let i = 0; i < n; i++) scallop(out, x + 0.012, y0 + pad + r + i * 2 * r, top - SIDE.cap + 0.01, r, lit(at('grass', 0.62), n_px), 'side:scallop'); }
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

// FLAT SHAPES, facing the camera (a shape family's silhouettes): a disc, a half disc (a dome up, or a scallop down)
const arcPts = (x, y, z, r, a0, a1, n, ry = r) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [x, y + r * Math.cos(a), z + ry * Math.sin(a)]; });
const disc = (out, x, y, z, r, fill, group) => out.push({ corners: arcPts(x, y, z, r, 0, 2 * Math.PI * (11 / 12), 11).map((p) => p.map(r5)), normal: FACE.px, fill, group });
// a dome of half-width r and height h standing on z, drawn down to `foot` (its base a rectangle under it)
// (a big dome is cut finer: its arc never shows a facet at the size it is seen)
const dome = (out, x, y, z, r, h, foot, fill, group) => out.push({ corners: [...arcPts(x, y, z, r, 0, Math.PI, Math.max(10, Math.min(28, Math.round(Math.max(r, h) * 0.6))), h), [x, y - r, foot], [x, y + r, foot]].map((p) => p.map(r5)), normal: FACE.px, fill, group });
const scallop = (out, x, y, z, r, fill, group) => out.push({ corners: arcPts(x, y, z, r, Math.PI, 2 * Math.PI, 6).map((p) => p.map(r5)), normal: FACE.px, fill, group });
// a scoop tree: a trunk under three discs (the crown and a smaller one each side), a paler disc for its light
function scoopTree(out, look, { x, y, z, r, trunk, tone = 0, haze = 0, group, crown = group }) {
  const { at, lit } = look, veil = (hex) => (haze ? look.hazed(hex, haze) : hex), tw = Math.max(0.1, r * 0.12), cz = z + trunk + r * 0.8;
  quad(out, [[x, y - tw, z - 0.3], [x, y + tw, z - 0.3], [x, y + tw, cz], [x, y - tw, cz]], FACE.px, veil(lit(at('soil', 0.3), FACE.px)), group);
  const body = veil(lit(at('foliage', 0.44 + tone), FACE.top)), light = veil(lit(at('foliage', 0.58 + tone), FACE.top));
  disc(out, x + 0.02, y - r * 0.62, cz - r * 0.28, r * 0.62, body, crown);
  disc(out, x + 0.02, y + r * 0.66, cz - r * 0.34, r * 0.56, body, crown);
  disc(out, x + 0.04, y, cz, r, body, crown);
  disc(out, x + 0.06, y + SCOOPS.light.side * r * 0.28, cz + r * 0.3, r * 0.42, look.sunlit ? look.sunlit(light, SCOOPS.light.gain * 0.5) : light, crown);
}
// a soft shadow on the ground under a thing, laid down the lane from the light: a flat ellipse, a step darker than the land
function contact(out, look, x, y, z, r) {
  const { at, lit } = look, L = SCOOPS.light, n = 10, cy = y - L.side * r * 0.5;
  out.push({ corners: Array.from({ length: n }, (_, i) => { const a = (i / n) * 2 * Math.PI; return [x + r * 0.55 * Math.cos(a), cy + r * 1.25 * Math.sin(a), z + 0.02].map(r5); }), normal: FACE.top, fill: lit(at('grass', 0.55 - L.shadow), FACE.top), group: 'side:contact' });
}

// a tree: a trunk under a round crown, eight-sided, widening and closing again; its back never drawn. `tone` shifts the
// crown along its ramp (a grove's trees are not one colour), `haze` takes it into the air (0: near)
function tree(out, look, { x, y, z, r, h, trunk, haze = 0, tone = 0, group }) {
  const { at, lit } = look, veil = (hex) => (haze ? look.hazed(hex, haze) : hex), tn = [1, 0, 0], tw = Math.max(0.12, r * 0.13);
  quad(out, [[x + 0.3, y - tw, z - 0.4], [x + 0.3, y + tw, z - 0.4], [x + 0.3, y + tw, z + trunk + 0.3], [x + 0.3, y - tw, z + trunk + 0.3]], tn, veil(lit(at('soil', 0.32), tn)), group);
  const ring = (rr, zz) => Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * 2 * Math.PI; return [x + rr * Math.cos(a), y + rr * Math.sin(a), zz]; });
  const rings = [ring(r * 0.55, z + trunk), ring(r, z + trunk + h * 0.4), ring(r * 0.78, z + trunk + h * 0.78), ring(r * 0.3, z + trunk + h)];
  for (let b = 0; b < 3; b++) for (let i = 0; i < 8; i++) {
    const i2 = (i + 1) % 8, a = ((i + 0.5) / 8) * 2 * Math.PI, up = [-0.55, 0.15, 0.7][b], n = ((v) => { const l = Math.hypot(...v); return v.map((c) => c / l); })([Math.cos(a), Math.sin(a), up]);
    if (n[0] < -0.35) continue;
    quad(out, [rings[b][i], rings[b][i2], rings[b + 1][i2], rings[b + 1][i]], n, veil(lit(at('foliage', 0.55 + tone), n)), group);
  }
  quad(out, rings[3], FACE.top, veil(lit(at('foliage', 0.68 + tone), FACE.top)), group);
}
// a low round shape on the ground (a bush in the foliage ramp, a stone in the rock's): a crown with no trunk
function mound(out, look, { x, y, z, r, ramp, t, group }) {
  const { at, lit } = look, ring = (rr, zz) => Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * 2 * Math.PI; return [x + rr * Math.cos(a), y + rr * Math.sin(a), zz]; });
  const rings = [ring(r, z - 0.05), ring(r * 0.82, z + r * 0.55), ring(r * 0.35, z + r * 0.9)];
  for (let b = 0; b < 2; b++) for (let i = 0; i < 6; i++) {
    const i2 = (i + 1) % 6, a = ((i + 0.5) / 6) * 2 * Math.PI, n = ((v) => { const l = Math.hypot(...v); return v.map((c) => c / l); })([Math.cos(a), Math.sin(a), b ? 0.75 : 0.25]);
    if (n[0] < -0.35) continue;
    quad(out, [rings[b][i], rings[b][i2], rings[b + 1][i2], rings[b + 1][i]], n, lit(at(ramp, t), n), group);
  }
  quad(out, rings[2], FACE.top, lit(at(ramp, t + 0.12), FACE.top), group);
}
/** The order of `n` slices in two kinds by the walls' rule (era/wall-rhythm.js: never three alike, never a pair
 * repeated), walked from a seed: a strip is long, so it is grown slice by slice and never enumerated. */
export function sliceOrder(n, seed) {
  let s = '';
  for (let k = 0; k < n; k++) {
    const want = hash3(k, 91, seed) < 0.5 ? 'A' : 'B', other = want === 'A' ? 'B' : 'A';
    const ok = (c) => { const t = s + c, L = t.length; return !(L >= 3 && t[L - 1] === t[L - 2] && t[L - 2] === t[L - 3]) && !(L >= 4 && t[L - 1] !== t[L - 2] && t[L - 1] === t[L - 3] && t[L - 2] === t[L - 4]); };
    s += ok(want) ? want : ok(other) ? other : want;
  }
  return s;
}

/** The `geocube` kind's side strip: the course skinned in the cube's layers, its land behind, its foreground. */
export function assembleSideStrip(m, ctx = {}) {
  const S = readSide(m), seed = Number.isFinite(m.seed) ? m.seed : 1, look = lookOf(m), { at, lit, st } = look;
  // (the shape family the land is drawn in, and the camera it is framed by)
  const shapes = sideShapes(m.cube ?? SIDE_CUBE, S.shapes), scoops = shapes === 'scoops', cam = shapes ? SHAPED_CAMERA : SIDE_CAMERA;
  look.shapes = shapes;
  const runs = sideRuns(S.boxes), faces = [];
  const tops = runs.map((r) => r.top), hi = Math.max(...tops), lo = Math.min(...tops), bottom = lo - SIDE.under;
  const beds = bedsOf(seed, hi, bottom);
  for (const r of runs) skinRun(faces, look, r, runs, { seed, beds, bottom });
  const y0 = -SIDE.pad, y1 = S.length + SIDE.pad;

  // the TERRACE behind the lane: a little below the floors near it, its top turf, its face toward the camera dirt and rock
  // (a shaped strip's terrace is a step into the air: cooler and quieter than the lane, so the floor the hero runs on is
  // the clearest land on the screen and never one field with the land behind it)
  const T = SIDE.terrace, terrace = [], veil = (hex) => (scoops ? look.aired(hex, TERRACE_AIR) : hex);
  for (let y = y0 - 10; y < y1 + 10 - 1e-6; y += T.step) {
    const h = (yy) => topNear(runs, yy, 3) - T.drop + 0.35 * (vnoise(yy * 0.09, 0.5, seed + 41) - 0.5);
    const ha = h(y), hb = h(y + T.step), yb = y + T.step;
    terrace.push({ y, h: ha });
    quad(faces, [[T.back, y, ha], [T.front, y, ha], [T.front, yb, hb], [T.back, yb, hb]], FACE.top, veil(lit(at('grass', scoops ? 0.5 : 0.55), FACE.top)), 'side:terrace');
    const band = (za, zb, zc, zd, rgb, g) => quad(faces, [[T.front, y, za], [T.front, yb, zc], [T.front, yb, zd], [T.front, y, zb]], FACE.px, veil(lit(rgb, FACE.px)), g);
    band(ha - SIDE.cap, ha, hb - SIDE.cap, hb, at('grass', 0.45), 'side:terrace');
    band(ha - 1.2, ha - SIDE.cap, hb - 1.2, hb - SIDE.cap, at('soil', 0.42), 'side:terrace');
    band(bottom, ha - 1.2, bottom, hb - 1.2, at('rock', 0.36), 'side:terrace');
  }

  // THE DRESS (docs/side-strip-principles.md). The terrace is where a thing behind the lane is seen best, so it is
  // where the designed pieces stand: slices A and B in the walls' order. Nothing here is met: faces only
  const Dr = SIDE.dress, nCells = Math.max(1, Math.round((y1 - y0) / Dr.cell)), cellLen = (y1 - y0) / nCells, order = sliceOrder(nCells, seed + 81);
  const landAt = (yy) => { const k = Math.max(0, Math.min(terrace.length - 2, Math.floor((yy - terrace[0].y) / T.step))), u = Math.max(0, Math.min(1, (yy - terrace[k].y) / T.step)); return lerp(terrace[k].h, terrace[k + 1].h, u); };
  const cells = [];
  for (let c = 0; c < nCells; c++) {
    const ya = y0 + c * cellLen, kind = order[c], rnd = (i) => hash3(c, i, seed + 83);
    cells.push({ y0: r5(ya), y1: r5(ya + cellLen), kind });
    if (kind === 'A') {
      // a GROVE: two or three trees of unlike sizes, the tallest off the middle, each at its own depth on the terrace
      const n = rnd(1) < 0.5 ? Dr.trees[0] : Dr.trees[1], big = Math.floor(rnd(2) * n);
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5 + 0.5 * (rnd(10 + i) - 0.5)) / n, y = ya + (0.12 + 0.76 * u) * cellLen, x = T.back + lerp(Dr.tree.back[0], Dr.tree.back[1], rnd(20 + i)), k = i === big ? 1 : 0.35 + 0.4 * rnd(30 + i);
        if (scoops) contact(faces, look, x, y, landAt(y), lerp(SCOOPS.crown.r[0], SCOOPS.crown.r[1], k));
        if (scoops) scoopTree(faces, look, { x, y, z: landAt(y), r: lerp(SCOOPS.crown.r[0], SCOOPS.crown.r[1], k), trunk: lerp(Dr.tree.trunk[0], Dr.tree.trunk[1], rnd(40 + i)), tone: 0.06 + 0.16 * (rnd(50 + i) - 0.5), haze: Dr.tree.haze, group: 'side:grove', crown: 'side:blossom' });
        else tree(faces, look, { x, y, z: landAt(y), r: lerp(Dr.tree.r[0], Dr.tree.r[1], k), h: lerp(Dr.tree.h[0], Dr.tree.h[1], k), trunk: lerp(Dr.tree.trunk[0], Dr.tree.trunk[1], rnd(40 + i)), tone: 0.08 + 0.14 * (rnd(50 + i) - 0.5), haze: Dr.tree.haze, group: 'side:grove' });
      }
      const yb = ya + (0.2 + 0.6 * rnd(3)) * cellLen, ys = ya + (0.15 + 0.7 * rnd(4)) * cellLen;
      if (scoops) {
        const rb = lerp(Dr.bush[0], Dr.bush[1], rnd(5)), rs = lerp(Dr.stone[0], Dr.stone[1], rnd(6));
        contact(faces, look, T.front - 1.1, yb, landAt(yb), rb * 0.9);
        dome(faces, T.front - 1.1, yb, landAt(yb) - 0.05, rb, rb * 0.85, landAt(yb) - 0.3, lit(at('foliage', 0.46), FACE.top), 'side:grove');
        dome(faces, T.front - 1.08, yb + SCOOPS.light.side * rb * 0.25, landAt(yb) + rb * 0.3, rb * 0.5, rb * 0.42, landAt(yb) + rb * 0.29, look.sunlit(lit(at('foliage', 0.62), FACE.top), SCOOPS.light.gain), 'side:grove');
        dome(faces, T.front - 0.7, ys, landAt(ys) - 0.05, rs, rs * 0.75, landAt(ys) - 0.3, lit(at('stone', 0.62), FACE.top), 'side:grove');
      } else {
        mound(faces, look, { x: T.front - 1.1, y: yb, z: landAt(yb), r: lerp(Dr.bush[0], Dr.bush[1], rnd(5)), ramp: 'foliage', t: 0.42, group: 'side:grove' });
        mound(faces, look, { x: T.front - 0.7, y: ys, z: landAt(ys), r: lerp(Dr.stone[0], Dr.stone[1], rnd(6)), ramp: 'rock', t: 0.6, group: 'side:grove' });
      }
    } else if (rnd(7) < 0.5) {
      // open ground: at most one low bush, so the grove beside it is what is looked at
      const yb = ya + (0.25 + 0.5 * rnd(8)) * cellLen;
      if (scoops) dome(faces, T.front - 1.4, yb, landAt(yb) - 0.05, Dr.bush[0] * 0.8, Dr.bush[0] * 0.65, landAt(yb) - 0.3, lit(at('foliage', 0.44), FACE.top), 'side:open');
      else mound(faces, look, { x: T.front - 1.4, y: yb, z: landAt(yb), r: Dr.bush[0] * 0.8, ramp: 'foliage', t: 0.4, group: 'side:open' });
    }
  }
  // tufts over the terrace, thickest toward its front: the nearest land behind the hero, so it is what passes fastest.
  // (the terrace lies a little under the floors, so its front edge is hidden: a tuft stands on the land the camera sees)
  for (let y = y0, k = 0; y < y1; k++) {
    y += lerp(Dr.tuft.every[0], Dr.tuft.every[1], hash3(k, 21, seed + 85));
    const u = hash3(k, 24, seed + 85), x = lerp(T.front - 0.5, T.back + 1, u * u), h = lerp(Dr.tuft.h[0], Dr.tuft.h[1], hash3(k, 22, seed + 85)), z = landAt(y), lean = Dr.tuft.w * (hash3(k, 23, seed + 85) - 0.5);
    if (scoops) { const rb = lerp(SCOOPS.bud[0], SCOOPS.bud[1], hash3(k, 22, seed + 85)); dome(faces, x, y, z - 0.02, rb, rb, z - 0.1, lit(at('grass', hash3(k, 29, seed + 85) < 0.5 ? 0.64 : 0.52), FACE.top), 'side:tufts'); continue; }
    for (const d of [-1, 1]) quad(faces, [[x, y + d * Dr.tuft.w * 0.2, z], [x, y + d * Dr.tuft.w, z], [x, y + d * Dr.tuft.w * 0.8 + lean, z + h * 0.7], [x, y + d * Dr.tuft.w * 0.25 + lean, z + h]], FACE.px, lit(at('grass', hash3(k, 29, seed + 85) < 0.5 ? 0.66 : 0.44), FACE.top), 'side:tufts');   // (lit as the ground is: a blade a stop lighter or darker than the land it stands on, never grey)
  }

  // SCOOPS: the land beyond the terrace is three rows of domes, far to near, each row about 1.6 times the one before it
  // and a step further into the air; then the clouds, puffed. (The hills, their crowns and the range are the plain strip's)
  if (scoops) {
    const base0 = lo - 3;
    const ramp = (name, t) => { const r = st.palette[name] ?? st.palette.sky, u = Math.max(0, Math.min(1, t)) * (r.length - 1), i = Math.min(r.length - 2, Math.floor(u)); return r[i].map((c, k) => lerp(c, r[i + 1][k], u - i)); };
    SCOOPS.rows.forEach((R, ri) => {
      const Lg = SCOOPS.light, body = lit(ramp(R.ramp, R.t), FACE.top), reach = (Math.abs(R.x) + cam.dist) * 0.62, fill = look.aired(body, R.haze);
      // (the lit cap fades with the row's distance: a far row is quieter than a near one, never busier)
      const capFill = look.aired(look.sunlit(body, Lg.gain * (1 - R.haze)), R.haze), mistFill = look.aired(body, Math.min(0.9, R.haze + Lg.mist));
      for (let y = y0 - reach, k = 0; y < y1 + reach; k++) {
        const w = lerp(R.w[0], R.w[1], hash3(k, 31 + ri, seed + 61)), h = lerp(R.h[0], R.h[1], hash3(k, 41 + ri, seed + 61));
        // (each dome a hair nearer than the last, so where two lap neither flickers)
        const xk = R.x + 0.02 * (k % 7), cy = y + w / 2;
        dome(faces, xk, cy, base0, w / 2, h, base0 - 14, fill, R.group);
        // (its lit cap: a smaller dome inside it toward the key, risen off its foot; and the mist at its foot)
        dome(faces, xk + 0.004, cy + Lg.side * w * 0.11, base0 + h * Lg.capLift, (w / 2) * Lg.cap, h * (1 - Lg.capLift) * 0.86, base0 + h * Lg.capLift - 0.01, capFill, R.group);
        dome(faces, xk + 0.008, cy, base0, w / 2, h * Lg.mistH, base0 - 14, mistFill, R.group);
        y += w * R.lap;
      }
    });
    const Cs = SCOOPS.cloud, reachC = (Math.abs(Cs.x) + cam.dist) * 0.62, cr = st.palette.cloud ?? st.palette.sky, white = look.hazed(rgbHex(cr[cr.length - 1].map((v) => v / 255)), 0.12), shadeC = look.hazed(rgbHex(cr[cr.length - 2].map((v) => v / 255)), 0.12);
    for (let y = y0 - reachC, k = 0; y < y1 + reachC; k++) {
      y += lerp(Cs.every[0], Cs.every[1], hash3(k, 25, seed + 87));
      const w = lerp(Cs.w[0], Cs.w[1], hash3(k, 26, seed + 87)), z = base0 + lerp(Cs.z[0], Cs.z[1], hash3(k, 28, seed + 87));
      // (its underside a step into the shade: each puff over a twin of itself in the cloud's mid tone, a little lower)
      for (const [dy, dz, r] of [[0, 0, 0.22], [0.3, 0.1, 0.3], [0.62, 0, 0.2]]) disc(faces, Cs.x - 0.1, y + w * dy, z + w * (dz - 0.06), w * r, shadeC, 'side:clouds');
      disc(faces, Cs.x, y, z, w * 0.22, white, 'side:clouds'); disc(faces, Cs.x + 0.05, y + w * 0.3, z + w * 0.1, w * 0.3, white, 'side:clouds'); disc(faces, Cs.x, y + w * 0.62, z, w * 0.2, white, 'side:clouds');
    }
  }
  // the HILLS: a slope from their crest down toward the lane, in the air's first veil, round crowns along the crest
  const Hl = SIDE.hills, base = lo - 3, reachH = (Math.abs(Hl.crest) + SIDE_CAMERA.dist) * 0.6, hillH = (yy) => base + lerp(Hl.rise[0], Hl.rise[1], vnoise(yy / Hl.period, 1.5, seed + 51));
  const slopeN = (dz) => { const v = [dz, 0, Hl.foot - Hl.crest]; const l = Math.hypot(...v); return v.map((x) => x / l); };
  if (!scoops) for (let y = y0 - reachH; y < y1 + reachH; y += Hl.step) {
    const ha = hillH(y), hb = hillH(y + Hl.step), yb = y + Hl.step, n = slopeN(ha - (base - 2));
    quad(faces, [[Hl.crest, y, ha], [Hl.foot, y, base - 2], [Hl.foot, yb, base - 2], [Hl.crest, yb, hb]], n, look.hazed(lit(at('grass', 0.5), n), Hl.haze), 'side:hills');
  }
  // (a tree every few metres along the crest, in the hills' veil)
  if (!scoops) for (let y = y0 - reachH, k = 0; y < y1 + reachH; k++) {
    y += lerp(Hl.crown[0], Hl.crown[1], hash3(k, 13, seed + 53));
    tree(faces, look, { x: Hl.crest + 2.5, y, z: hillH(y), r: 1.4 + 0.9 * hash3(k, 14, seed + 53), h: 2.6 + 1.6 * hash3(k, 15, seed + 53), trunk: 0.9 + 0.6 * hash3(k, 16, seed + 53), haze: Hl.haze, group: 'side:crowns' });
  }

  // the RANGE: far, in the far ramp and deep in the air, a slope of peaks
  const Rg = SIDE.range, reachR = (Math.abs(Rg.crest) + SIDE_CAMERA.dist) * 0.62;
  if (!scoops) for (let y = y0 - reachR; y < y1 + reachR; y += Rg.step) {
    const h = (yy) => base + lerp(Rg.rise[0], Rg.rise[1], Math.abs(2 * vnoise(yy / Rg.period, 2.5, seed + 61) - 1)), ha = h(y), hb = h(y + Rg.step), n = [0.4, 0, 0.92];
    quad(faces, [[Rg.crest, y, ha], [Rg.foot, y, base - 12], [Rg.foot, y + Rg.step, base - 12], [Rg.crest, y + Rg.step, hb]], n, look.hazed(lit(at('rock', 0.62), n), Rg.haze), 'side:range');
  }

  // CLOUDS low over the range (the side camera looks a little down: what is high is out of its frame), flat and pale,
  // each a few stacked bars; and WHERE THE LANE GOES: a small tower at the back of the terrace just past the lane's end,
  // the one thing on the land in the cube's accent
  const Cl = Dr.clouds, cloudRamp = st.palette.cloud ?? st.palette.sky, cloudAt = (t) => rgbHex(cloudRamp[Math.min(cloudRamp.length - 1, Math.round(t * (cloudRamp.length - 1)))].map((v) => v / 255));
  if (!scoops) for (let y = y0 - reachR, k = 0; y < y1 + reachR; k++) {
    y += lerp(Cl.every[0], Cl.every[1], hash3(k, 25, seed + 87));
    const w = lerp(Cl.w[0], Cl.w[1], hash3(k, 26, seed + 87)), h = lerp(Cl.h[0], Cl.h[1], hash3(k, 27, seed + 87)), z = base + lerp(Cl.z[0], Cl.z[1], hash3(k, 28, seed + 87));
    for (const [u0, u1, v0, v1, t] of [[0, 1, 0, 0.45, 0.8], [0.14, 0.8, 0.4, 0.78, 1], [0.34, 0.62, 0.72, 1, 1]]) quad(faces, [[Cl.x, y + u0 * w, z + v0 * h], [Cl.x, y + u1 * w, z + v0 * h], [Cl.x, y + u1 * w, z + v1 * h], [Cl.x, y + u0 * w, z + v1 * h]], FACE.px, look.hazed(cloudAt(t), 0.25), 'side:clouds');
  }
  const Tw = Dr.tower, ty = S.length + Tw.past, tz = landAt(ty), tx = T.back + 1.5, twr = { y: r5(ty), z: r5(tz), top: r5(tz + Tw.h + Tw.roof) };
  quad(faces, [[tx, ty - Tw.w / 2, tz - 1], [tx, ty + Tw.w / 2, tz - 1], [tx, ty + Tw.w / 2, tz + Tw.h], [tx, ty - Tw.w / 2, tz + Tw.h]], FACE.px, lit(at('stone', 0.6), FACE.px), 'side:tower');
  quad(faces, [[tx + 0.05, ty - Tw.w * 0.62, tz + Tw.h - 0.5], [tx + 0.05, ty + Tw.w * 0.62, tz + Tw.h - 0.5], [tx + 0.05, ty + Tw.w * 0.62, tz + Tw.h], [tx + 0.05, ty - Tw.w * 0.62, tz + Tw.h]], FACE.px, lit(at('trim', 0.75), FACE.px), 'side:tower');
  if (scoops) dome(faces, tx + 0.05, ty, tz + Tw.h, Tw.w * 0.7, Tw.roof, tz + Tw.h - 0.01, lit(at('accent', 0.5), FACE.px), 'side:tower');
  else quad(faces, [[tx + 0.05, ty - Tw.w * 0.7, tz + Tw.h], [tx + 0.05, ty + Tw.w * 0.7, tz + Tw.h], [tx + 0.05, ty + 0.02, tz + Tw.h + Tw.roof], [tx + 0.05, ty - 0.02, tz + Tw.h + Tw.roof]], FACE.px, lit(at('accent', 0.5), FACE.px), 'side:tower');

  // the FOREGROUND: a few low hummocks before the lane, each held under the hero's feet line in the frame (foreTop)
  const F = SIDE.fore, fore = [];
  for (let y = y0 + 4, k = 0; y < y1 - 4; k++) {
    y += lerp(F.every[0], F.every[1], hash3(k, 17, seed + 71));
    const len = lerp(F.len[0], F.len[1], hash3(k, 18, seed + 71)), cap = foreTop(topNear(runs, y, len), F.x, cam), peak = cap - 0.25 * hash3(k, 19, seed + 71);
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
    // (a shaped strip's backdrop moves: its clouds drift, its blossom breathes; channels/ambient.js)
    ...(scoops ? { ambient: { groups: SCOOPS.motion } } : {}),
  };
  Object.defineProperty(payload, 'side', { value: { runs, terrace, fore, bottom, cube: look.cube.id, cells, order, tower: twr, shapes }, enumerable: false });
  return payload;
}

/** The highest a foreground shape at `x` may stand over a floor at `top`: under the hero's feet line in the side frame,
 * by SIDE.fore.margin degrees (the camera at its defaults over that floor). */
export function foreTop(top, x, C = SIDE_CAMERA) {
  const H = C.lookH + C.dist * Math.sin(C.tilt), Dc = C.dist * Math.cos(C.tilt), feet = Math.atan2(H, Dc);
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
    // (the dress, docs/side-strip-principles.md: its slices in the walls' order; the land behind standing clear of the lane)
    { id: 'rhythm', holds: P.cells.length < 3 || (rhythmFaults(P.order).length === 0 && new Set(P.order).size > 1), says: `the land behind the lane in slices, never three alike and never a pair repeated (${P.order})` },
    { id: 'behind', holds: faces.every((f) => !/^side:(grove|blossom|open|tufts|crowns|clouds|tower)$/.test(f.group ?? '') || f.corners.every((c) => c[0] <= SIDE.terrace.front + 0.05)), says: 'everything that dresses the land stands behind the lane: nothing of it is met, nothing covers the hero' },
    ...(P.shapes === 'scoops' ? [{ id: 'one-family', holds: !faces.some((f) => /^side:(hills|range|clouds)$/.test(f.group ?? '') && f.corners.length < 8), says: 'the land beyond the terrace is one family of shapes: every hill and cloud a dome or a disc, none a slope or a bar' }] : []),
    ...(P.shapes === 'scoops' ? [{ id: 'one-light', holds: faces.some((f) => f.group === 'side:contact') && faces.some((f) => f.group === 'side:rim') && faces.some((f) => f.group === 'side:lip'), says: 'one key every shape agrees on: lit caps toward it, shadows laid away from it, the lip\'s shade and the edge\'s light' }] : []),
    { id: 'quiet', holds: faces.filter((f) => f.group === 'side:grove' || f.group === 'side:blossom').every((f) => f.corners.every((c) => c[0] <= SIDE.terrace.back + SIDE.dress.tree.back[1] + SIDE.dress.tree.r[1] + 0.05 || c[2] <= Math.max(...P.terrace.map((t) => t.h)) + SIDE.dress.bush[1] + 0.2)), says: 'a grove stands at the back of the terrace and only low things at its front: the band the hero runs in is the hero\'s' },
    { id: 'budget', holds: faces.length <= budget, says: `${faces.length} faces, ${budget} at most` },
  ];
}
