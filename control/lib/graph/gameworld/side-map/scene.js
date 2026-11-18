/**
 * THE SIDE MAP, BUILT — the geocube kind's `show: 'sidemap'` (docs/side-map-principles.md "Who makes it"): a zone chain
 * (zones.js) laid in the hero's screens and reach (layout.js), dressed (dress.js, the place's hue the cube's stone) and
 * held to its laws (laws.js), built as the level the camera sees, lit by the cube. The map is the level's final output;
 * the same recipe is drawn as an elevation (drawing.js).
 *
 *   the CLOSED PARTS   every solid of the layout, its face toward the camera and its ends in its zone's key, its top a
 *                      lit edge (a band down the face and the top itself), painted over by its fill (paint.js: the
 *                      fill, its slices' motifs, a big mass's middle, the edges and breaks, the threads)
 *   the BACK           an indoor zone's back wall in its void across what the camera sees, and on it the dress: its bays'
 *                      pillars and seams, a lamp an A bay, a hatch at each spawner, the next place's key at the edge,
 *                      a shaft's railings, a chute's stripes, the boss's mark; an outdoor zone's back is the cube's sky
 *   the PLAY           shutters, ladders and pickups in the play's colour, on the other side of the wheel from the place
 *   the LIGHT          lit (`light: 'lit'`, the default: light.js): each face's colour its base, lit per corner by its
 *                      zone's lamps or the cube's sun and sky, contact under tops, a climb's light at its top; flat
 *                      (`light: 'flat'`): the cube's outside card (its key colour and ambient), one key from behind the
 *                      camera baked into each face's colour, as it was
 *
 *   SIDE_MAP_SCENE_KEYS   the manifest's words
 *   SIDE_MAP_STATURE      the hero a map is laid for when its manifest names none: the toy hero robot's height (Galaxy Boy)
 *   readSideMapScene(m)   → { map, cube, seed, reach, stature } (throws, teaching)
 *   sideMapOf(m)          → { layout, dress, paint, laws, reach, stature, cube }: the map as data, no faces
 *   assembleSideMap(m, ctx) the `geocube` kind's `show: 'sidemap'`: { cube?, seed?, sidemap, feel?, stature? } → payload,
 *                         its `sidemap` (not enumerable) the layout, dress and laws
 *
 * Pure: the same recipe makes the same bytes.
 */
import { readGeocube, lowerGeocube } from '../../era/geocube.js';
import { outTrailStyle } from '../../era/out-trail-board.js';
import { SIDE, SIDE_CUBE } from '../../era/geocube-side.js';
import { r5, hexRgb, rgbHex } from '../../era/geom.js';
import { readFeel } from '../feel/lower.js';
import { reachOf } from '../feel/reach.js';
import { readSideMap } from './zones.js';
import { layoutSideMap } from './layout.js';
import { dressSideMap } from './dress.js';
import { sideMapLaws } from './laws.js';
import { paintSideMap, backdropOf } from './paint.js';
import { lightSideMap, sideMapTextures } from './light.js';

export const SIDE_MAP_SCENE_KEYS = Object.freeze(['kind', 'show', 'cube', 'seed', 'sidemap', 'feel', 'stature', 'light', 'title', 'viewBox']);
/** How the map is lit: 'lit' (light.js: lamps, the cube's sun and sky, contact, a climb's light) or 'flat' (one baked key). */
export const SIDE_MAP_LIGHTS = Object.freeze(['lit', 'flat']);
export const SIDE_MAP_STATURE = 1.67;
const HALF = 1.5, BACK = -3, LIT = 0.14, DOOR_W = 0.6;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const no = (m) => { throw new Error(`geocube sidemap: ${m}`); };

/** The manifest read: the chain, the cube, the hero it is laid for. */
export function readSideMapScene(m) {
  if (!isObj(m)) no('a side map is { kind: \'geocube\', show: \'sidemap\', cube?, seed?, sidemap: { premise?, fill?, zones }, feel?, stature? }');
  for (const k of Object.keys(m)) if (!SIDE_MAP_SCENE_KEYS.includes(k)) no(`${k} is not a side map's word (${SIDE_MAP_SCENE_KEYS.join(', ')})`);
  if (m.sidemap === undefined) no('sidemap is the zone chain the map is laid from: { premise?, fill?, zones: [ … ] }');
  const map = readSideMap(m.sidemap);
  if (m.stature !== undefined && !(Number.isFinite(m.stature) && m.stature > 0.3 && m.stature < 5)) no('stature is the hero\'s height in metres (the screen is sized from it)');
  if (m.seed !== undefined && !Number.isInteger(m.seed)) no('seed is an integer');
  const feel = readFeel(m.feel === undefined ? { pole: 'galaxy-boy', takes: true } : typeof m.feel === 'string' ? { pole: m.feel, takes: true } : m.feel);
  if (m.light !== undefined && !SIDE_MAP_LIGHTS.includes(m.light)) no(`light is ${SIDE_MAP_LIGHTS.join(' | ')} (its lamps, sun and sky, or one baked key)`);
  return { map: m.sidemap, read: map, cube: readGeocube(m.cube ?? SIDE_CUBE), seed: m.seed ?? 1, reach: reachOf(feel), stature: m.stature ?? SIDE_MAP_STATURE, light: m.light ?? 'lit' };
}

/** The map as data: laid, dressed in the cube's hue, held to its laws. */
export function sideMapOf(m) {
  // (a played level's manifest carries its pilot, camera and game beside the scene's words: read the scene's only)
  const R = readSideMapScene(Object.fromEntries(Object.entries(m).filter(([k]) => SIDE_MAP_SCENE_KEYS.includes(k)))), layout = layoutSideMap(R.map, { reach: R.reach, stature: R.stature });
  const dress = dressSideMap(layout, R.map, { seed: R.seed, cube: R.cube }), paint = paintSideMap(layout, dress, { seed: R.seed });
  return { layout, dress, paint, laws: sideMapLaws(layout, R.reach, { dress, paint }), reach: R.reach, stature: R.stature, cube: R.cube, light: R.light };
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const FACE = { top: [0, 0, 1], px: [1, 0, 0], ny: [0, -1, 0], py: [0, 1, 0] };
// a quad facing n, its corners anticlockwise seen from its normal's side
const quad = (out, corners, n, fill, group) => {
  const [a, b, c] = corners, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  out.push({ corners: (dot(w, n) < 0 ? [...corners].reverse() : corners).map((p) => p.map(r5)), normal: n, fill, group });
};
// a rectangle on a plane facing +x at x, from (s0, z0) to (s1, z1)
const face = (out, x, s0, s1, z0, z1, fill, group) => { if (s1 - s0 > 1e-4 && z1 - z0 > 1e-4) quad(out, [[x, s0, z0], [x, s1, z0], [x, s1, z1], [x, s0, z1]], FACE.px, fill, group); };

const mixHex = (a, b, k) => rgbHex(hexRgb(a).map((v, i) => v + (hexRgb(b)[i] - v) * k));
/** The cube's light: its key and ambient as a bake, the key from behind the camera (the side strip's). */
function lightOf(cube) {
  const low = lowerGeocube(cube, 'outside'), { st } = outTrailStyle({ kit: low.kit }), Lt = st.light;
  const L = ((v) => { const l = Math.hypot(...v); return v.map((x) => x / l); })(SIDE.key), amb = hexRgb(Lt.ambient).map((v) => v * (Lt.fill ?? 0.6)), key = hexRgb(Lt.key.color).map((v) => v * (Lt.sunGain ?? 1));
  const expose = 1.05 / ((amb[0] + amb[1] + amb[2]) / 3 + 0.8 * (key[0] + key[1] + key[2]) / 3);
  const lit = (hex, n, k = 1) => rgbHex(hexRgb(hex).map((c, i) => Math.min(1, c * (amb[i] + key[i] * Math.max(0, dot(n, L))) * expose * k)));
  return { st, lit };
}

/** The `geocube` kind's `show: 'sidemap'`. */
export function assembleSideMap(m, ctx = {}) {
  const D0 = sideMapOf(m), { layout: L, dress: D } = D0, flat = D0.light === 'flat', L0 = lightOf(D0.cube), st = L0.st, faces = [];
  // (lit, the faces are built in their own colours, each a base the light pass multiplies: light.js; flat, as it was)
  const lit = flat ? L0.lit : (hex, n, k = 1) => (k === 1 ? hex : rgbHex(hexRgb(hex).map((v) => Math.min(1, v * k))));
  const Z = D.zones, play = D.palette.play;
  // the back: an indoor zone's wall in its void, behind everything the camera sees of it
  // (widened by what a frame sees at the wall's depth past the lane's: the camera's perspective shows more of it)
  const ms = (L.screen.width / 2) * (-BACK / L.camera.dist), mz = (L.screen.height / 2) * (-BACK / L.camera.dist);
  for (const r of L.swept) if (Z[r.zone]?.indoor) face(faces, BACK - 0.01 * (r.zone % 2), r.s0 - ms, r.s1 + ms, r.z0 - mz, r.z1 + mz, lit(Z[r.zone].void, FACE.px), 'sidemap:back');
  // the closed parts: the face toward the camera and the ends in the zone's key, the top a lit edge
  for (const r of L.solids) {
    const z = Z[r.zone], g = `sidemap:${z.family}`;
    face(faces, HALF, r.s0, r.s1, r.z0, Math.max(r.z0, r.z1 - LIT), lit(z.key, FACE.px), g);
    face(faces, HALF, r.s0, r.s1, Math.max(r.z0, r.z1 - LIT), r.z1, lit(z.edge, FACE.px), 'sidemap:edge');
    quad(faces, [[-HALF, r.s0, r.z1], [HALF, r.s0, r.z1], [HALF, r.s1, r.z1], [-HALF, r.s1, r.z1]], FACE.top, lit(z.edge, FACE.top), 'sidemap:edge');
    for (const [s, n] of [[r.s0, FACE.ny], [r.s1, FACE.py]]) quad(faces, [[-HALF, s, r.z0], [HALF, s, r.z0], [HALF, s, r.z1], [-HALF, s, r.z1]], n, lit(z.key, FACE.px, 0.78), g);
  }
  // an outdoor zone's backdrop (paint.js backdropOf): its layers at their depth, hazed toward the cube's horizon
  const horizon = rgbHex(st.palette.sky[st.palette.sky.length - 1].map((v) => v / 255));
  for (const B of backdropOf(L, D, { seed: m.seed ?? 1 })) for (const r of B.rects) face(faces, B.x, r.s0, r.s1, r.z0, r.z1, mixHex(lit(Z[B.zone].key, FACE.px), horizon, B.haze), `sidemap:${B.layer}`);
  // the closed parts painted (paint.js): each mark on the face, a layer over the last
  // (a cap's mark on the walking surface itself: level on the top, a hair over it)
  for (const k of D0.paint.marks) {
    if (k.top) { const zt = k.z1 + 0.003 * k.layer; quad(faces, [[-HALF, k.s0, zt], [HALF, k.s0, zt], [HALF, k.s1, zt], [-HALF, k.s1, zt]], FACE.top, lit(k.fill, FACE.top), `sidemap:paint-${k.what}`); continue; }
    // (a jamb's mark on a wall's face into the open, the surface the hero kicks off: a hair proud of it)
    if (k.side) { const n = FACE[k.side], ss = k.s0 + n[1] * 0.003 * k.layer; quad(faces, [[-HALF, ss, k.z0], [HALF, ss, k.z0], [HALF, ss, k.z1], [-HALF, ss, k.z1]], n, lit(k.fill, FACE.px, 0.85), `sidemap:paint-${k.what}`); continue; }
    face(faces, HALF + 0.004 * k.layer, k.s0, k.s1, k.z0, k.z1, lit(k.fill, FACE.px), `sidemap:paint-${k.what}`);
  }
  // the dress on an indoor zone's back wall
  const zoneOf = (i) => L.zones[i], at = (x) => BACK + 0.02 * x;
  for (const z of Z) {
    if (!z.indoor) continue;
    const LZ = zoneOf(z.zone), [s0, s1, zb, zt] = LZ.rect, open = L.open.filter((o) => o.zone === z.zone), o0 = open[0];
    const darker = lit(z.key, FACE.px, 0.55);
    for (const p of z.pillars ?? []) face(faces, at(1), p - 0.45, p + 0.45, zb, zt, darker, 'sidemap:pillar');
    for (const p of z.seams ?? []) face(faces, at(1), p - 0.06, p + 0.06, zb, zt, lit(z.key, FACE.px, 0.35), 'sidemap:seam');
    if (o0) for (const p of z.lamps ?? []) face(faces, at(2), p - 0.5, p + 0.5, o0.z1 - 1.6, o0.z1 - 1.2, lit(z.edge, FACE.px, 1.25), 'sidemap:lamp');
    for (const [hs, hz] of z.hatches ?? []) face(faces, at(2), hs - 0.8, hs + 0.8, hz + 0.4, hz + 2, lit(play, FACE.px, 0.7), 'sidemap:hatch');
    if (z.peek) {
      const P = z.peek.at, c = lit(z.peek.key, FACE.px, 0.8);
      if (P.s0 !== undefined) face(faces, at(1.5), P.s0, P.s1, zb, zb + (zt - zb) * 0.18, c, 'sidemap:peek');
      else face(faces, at(1.5), s0, s0 + (s1 - s0) * 0.12, P.z0, P.z1, c, 'sidemap:peek');
    }
    // (the rails a shaft's back wall climbs by: a guide behind the lane, quieter than it, the benchmark's `lane-sharpest`)
    if (o0 && z.mark?.kind === 'climbs') for (let y = o0.z0 + 1, k = 0; y < o0.z1 - 1; y += 1.2, k++) face(faces, at(2), o0.s0 + 0.2, o0.s1 - 0.2, y, y + 0.12, lit(z.key, FACE.px, 0.4), 'sidemap:rails');
    if (o0 && z.mark?.kind === 'stripes') for (let y = o0.z0, k = 0; y < o0.z1; y += 0.9, k++) face(faces, at(2), o0.s0 + 0.3, o0.s1 - 0.3, y, y + 0.45, k % 2 ? lit('#1a1a1a', FACE.px) : lit(play, FACE.px, 0.9), 'sidemap:stripes');
    if (o0 && z.mark?.kind === 'emblem') {
      const cs = (o0.s0 + o0.s1) / 2, cz = (o0.z0 + o0.z1) / 2, r = Math.min(o0.s1 - o0.s0, o0.z1 - o0.z0) * 0.18;
      quad(faces, [[at(2), cs, cz - r], [at(2), cs + r, cz], [at(2), cs, cz + r], [at(2), cs - r, cz]], FACE.px, lit(D.palette.boss, FACE.px, 1.1), 'sidemap:emblem');
    }
  }
  // the play: shutters, ladders, pickups
  for (const d of L.doors) face(faces, HALF + 0.03, d.at[0] - DOOR_W / 2, d.at[0] + DOOR_W / 2, d.at[1], d.at[1] + 3.6, lit(play, FACE.px), 'sidemap:door');
  for (const l of L.ladders) {
    const sa = l.foot[0] - 0.3, sb = l.foot[0] + 0.3;
    face(faces, 0.2, sa - 0.06, sa + 0.06, l.foot[1], l.lip[1] + 1, lit(play, FACE.px), 'sidemap:ladder');
    face(faces, 0.2, sb - 0.06, sb + 0.06, l.foot[1], l.lip[1] + 1, lit(play, FACE.px), 'sidemap:ladder');
    for (let y = l.foot[1] + 0.3; y < l.lip[1] + 0.9; y += 0.35) face(faces, 0.19, sa, sb, y, y + 0.06, lit(play, FACE.px, 0.85), 'sidemap:ladder');
  }
  for (const p of L.pickups) face(faces, 0.3, p.at[0] - 0.22, p.at[0] + 0.22, p.at[1] - 0.22, p.at[1] + 0.22, lit(play, FACE.px, 1.2), 'sidemap:pickup');

  // the camera at the first checkpoint, framed as the side map frames the hero (screen.js)
  const C = L.camera, cp = L.checkpoints[0]?.at ?? [0, 0], hfov = (2 * Math.atan(Math.tan((C.vfov * Math.PI) / 360) * (L.screen.width / L.screen.height)) * 180) / Math.PI;
  const s0 = cp[0] + L.screen.width / 2 - 2, look = cp[1] + C.lookH, sky = st.palette.sky;
  // (lit, the material baked and textured: light.js; the horizon the sky a metal and the snow reflect)
  const litFaces = flat ? faces : lightSideMap(faces, L, D, D0.cube, { sky: rgbHex(st.palette.sky[st.palette.sky.length - 1].map((v) => v / 255)) });
  const payload = {
    faces: litFaces,
    ...(litFaces !== faces ? { textures: sideMapTextures(litFaces) } : {}),
    lights: [],
    cameras: [{ name: 'side-map', worldFraming: { cameraPosition: [r5(C.dist), r5(s0), r5(look + C.dist * C.tilt)], lookAt: [0, r5(s0), r5(look)], horizontalFov: r5(hfov) } }],
    viewBox: m.viewBox || { width: 1280, height: 720 },
    title: ctx.title || m.title || 'mojulo geocube · side map',
    bg: rgbHex(sky[sky.length - 1].map((v) => v / 255)),
    sky: { zenith: sky[0], horizon: sky[sky.length - 1], day: 1, stars: 0, seed: 1 },
    pack: true,
  };
  Object.defineProperty(payload, 'sidemap', { value: { layout: L, dress: D, paint: D0.paint, laws: D0.laws, cube: D0.cube.id, stature: D0.stature }, enumerable: false });
  return payload;
}
