/**
 * THE STADIUM — a sport's venue composed from the building designer's own parts, so a game is played inside a place,
 * never against a flat dark colour: the field (its surface), a BOWL of stands round it (stadium/bowl.js: a ring that
 * follows a superellipse, raked tiers, a concourse of glass boxes, an outer wall in a facade, a roof), floodlight
 * masts, a city's skyline over the rim, and a sky over all of it at an hour of the day. Each part is a few words; a
 * PRESET (the Mojulo Olympics' venues) is a starting set of them, and any word given over it moves that part alone, so
 * a stadium is recomposed rather than redrawn, and any game's arena may stand in any of them.
 *
 * The parts are the library's, not drawn here:
 *   - the bowl's outer wall wears a facade card (architecture/facade-card.js): glass, brick, metal; or an
 *     amphitheatre's arcades; the crowd is a mosaic of colours on the treads, never figures
 *   - the floodlight tower is the track's set piece (roads/set-pieces.js TRACK_BLOCKS, built by era/blocks.js)
 *   - the field and the land are painted in a kit's terms (roads/track-kit.js): the kit's ramps (a palette) on its
 *     POLE, the degree of realism: `shaded` (polygons lit per corner under a sky and a hard sun), `anime` (banded) or
 *     `voxel` (cubes, flat colour)
 *   - the skyline is the fractal structures' (fractal-structure/), each tower rolled from its seed, hazed into the sky
 *   - the hour is a race's (roads/race-mood.js): its sky dome, its haze, its light; after dark the masts light the field
 *
 *   { kind: 'stadium', field: { w, d, surface?, x?, y? }, preset?, palette?, look?, time?, ground?, livery?,
 *     colours?, bowl?, masts?, skyline?, camera?, viewBox?, title?, seed?, …a world's channel keys (court, pitch, …) }
 *     field     the playing area in the world's metres, x from `x` (−w/2) and y from `y` (0) (a sport's arena's room);
 *               the preset's own when absent, its surface the preset's when the field names none
 *     surface   grass | clay | hard | track | ice | wood | sand | holo
 *     bowl      false, or { shape?: 2..8, rows?: [lower, upper?] (4..30 each), rise?: m, roof?, facade?, crowd?: 0..1,
 *               gap?: m, clear?: m, open?: [n, e, s, w], apron?, screens?: 0..2, landmark? }
 *               roof none | canopy | ring | dome;  facade none | glass | brick | metal | arches
 *               apron the ground between the field and the stands: grass | concrete | sand | track (a running track)
 *               landmark none | cauldron | arch;  clear sets the camera's side (s) back that far
 *     livery    the bowl's colour set (STADIUM_LIVERIES); colours { seat?, wall?, roof?, accent?, … } any of them over it
 *     masts     0..8 floodlight towers round the bowl
 *     skyline   false, or { n?: 0..24, height?: [lo, hi] m, forms?: [SKYLINE_FORMS], seed? }: the fractal structures'
 *               lean forms, their echo off (a far tower is its silhouette)
 *     look      shaded | anime | voxel;  palette a kit's ramps (STADIUM_PALETTES);  time day | golden | dusk | night
 *     ground    grass | concrete: the land round the venue out past the skyline (a park, or a city's paving)
 *
 *   STADIUM_PRESETS, STADIUM_LIVERIES, STADIUM_SURFACES, STADIUM_LOOKS, STADIUM_TIMES, STADIUM_PALETTES
 *   readStadium(m) → S         the words with the preset's under them, checked; throws, teaching (stadium-words.js:
 *                              the words alone, light enough for an arena to import)
 *   stadiumParts(S) → { faces, lamps, … }   the venue's geometry, painted
 *   assembleStadiumScene(m, opts) → the World page's payload (faces, the sky, the haze, cameras)
 *
 * Pure and seeded: the same words are the same stadium to the byte.
 */
import { buildBlock } from '../era/blocks.js';
import { TRACK_BLOCKS, paintPiece } from '../roads/set-pieces.js';
import { trackKit } from '../roads/track-kit.js';
import { MOOD_TIMES, relightFaces } from '../roads/race-mood.js';
import { LIGHT } from '../roads/road-faces.js';
import { structureFaces } from '../fractal-structure/index.js';
import { bowlFaces } from './bowl.js';
import { readStadium, STADIUM_SURFACES, STADIUM_LOOKS, STADIUM_CROWD, STADIUM_APRONS, SKYLINE_FORMS } from './stadium-words.js';

export { readStadium, STADIUM_SURFACES, STADIUM_LOOKS, STADIUM_TIMES, STADIUM_PALETTES, STADIUM_LIVERIES, STADIUM_PRESETS, STADIUM_PRESET_IDS, SKYLINE_FORMS } from './stadium-words.js';

const r3 = (v) => Math.round(v * 1000) / 1000;

// mulberry32: the venue's dice
function dice(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hex = (rgb) => `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mixHex = (a, b, t) => { const A = rgbOf(a), B = rgbOf(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); };

/** The hour: its sky dome, the colour past the world, its haze. Noon is the roadway's own sky. */
function hourOf(time) {
  const T = time === 'day' ? null : MOOD_TIMES[time];
  const sky = T ? { ...T.sky } : { zenith: [96, 138, 190], horizon: [198, 207, 218], day: 1, stars: 0 };
  return { sky: { preset: time === 'day' ? 'day' : time, ...sky, seed: 7 }, bg: hex(sky.horizon), haze: T?.haze ?? '#c6cfda', mood: T ? { ...T, toLight: unitOf(T.sun ? fromSky(T.sun) : fromSky(T.moon)).map((v) => -v) } : null };
}
const unitOf = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const fromSky = ({ u, h }) => { const el = Math.max(0.25, Math.min(0.95, h)) * (Math.PI / 2), az = -Math.PI / 2 + (u - 0.5) * Math.PI; return [-Math.cos(el) * Math.cos(az), -Math.cos(el) * Math.sin(az), -Math.sin(el)]; };

// a quad on the ground, its uv in metres
const groundQuad = (x0, y0, x1, y1, z = 0) => ({ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]].map((p) => p.map(r3)), uv: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map((p) => p.map(r3)) });

/** The bowl's words as bowl.js takes them: the tiers' rows, treads and rises, the colours with the apron's. */
function bowlOf(S) {
  const b = S.bowl, rise = b.rise ?? 0.42;
  const tiers = b.rows.map((rows, i) => ({ rows, tread: 0.82, rise: r3(i === 0 ? rise : Math.min(0.7, rise + 0.12)) }));
  return { shape: b.shape, segs: 96, gap: b.gap, tiers, concourse: 3, boxes: 3.2, roof: b.roof, facade: b.facade, crowd: b.crowd, open: b.open, apron: b.apron, screens: b.screens, landmark: b.landmark, seed: S.seed, colours: { ...S.colours, crowd: STADIUM_CROWD, apron: S.colours.apron ?? STADIUM_APRONS[b.apron] } };
}

/** The venue's geometry: the land, the field, the bowl round it, the masts; the lamps that light the field after dark. */
export function stadiumParts(S) {
  const K = trackKit({ id: S.palette, pole: STADIUM_LOOKS[S.look] });
  const F = S.field, x1 = F.x + F.w, y1 = F.y + F.d, cx = F.x + F.w / 2, cy = F.y + F.d / 2;
  const faces = [], lamps = [];
  const surface = (name, q) => { const s = STADIUM_SURFACES[name]; return s.material ? K.surface(s.material, q.corners, q.uv) : { corners: q.corners, fill: s.colour }; };
  // the bowl: the field's middle pushed back by `clear` on the camera's side, the ring round both
  let bowl = null, reach = Math.max(F.w, F.d) / 2 + 8, top = 0;
  if (S.bowl) {
    const clear = S.bowl.clear ?? 0;
    // (the infield, the ring through the field's corners, is the field's own surface)
    // (a flat-filled surface one colour throughout, so the kites don't show their seams as rays)
    const base = surface(F.surface, groundQuad(F.x, F.y, x1, y1, 0));
    const infield = (corners) => (base.texture ? surface(F.surface, { corners, uv: corners.map((p) => [p[0], p[1]]) }) : { corners, fill: base.fill });
    bowl = bowlFaces(bowlOf(S), { centre: [cx, cy - clear / 2], half: [F.w / 2, F.d / 2 + clear / 2], light: LIGHT, look: S.look, infield });
    reach = Math.max(bowl.half[0], bowl.half[1]) + bowl.reach;
    top = bowl.top;
    for (const l of bowl.lamps) lamps.push(l);
  }
  // the land out past the skyline (it stands on it), the field over the bowl's apron
  const far = (reach + SKYLINE_SET) * 2 + 60;
  faces.push(K.surface(S.ground, ...Object.values(groundQuad(cx - far, cy - far, cx + far, cy + far, -0.4))));
  if (!S.bowl) faces.push(K.surface('concrete', ...Object.values(groundQuad(F.x - 6, F.y - 6, x1 + 6, y1 + 6, -0.05))));
  if (bowl) for (const f of bowl.faces) faces.push(f);
  else faces.push(surface(F.surface, groundQuad(F.x, F.y, x1, y1, 0.02)));

  // the masts: floodlight towers round the bowl, their lamps turned to its middle
  if (S.masts > 0) {
    const r = reach + 4, h = Math.min(40, Math.max(18, top + 14, Math.max(F.w, F.d) * 0.35));
    for (let k = 0; k < S.masts; k++) {
      const a = Math.PI / 4 + (2 * Math.PI * k) / S.masts, px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      const yaw = Math.atan2(cy - py, cx - px) + Math.PI / 2;   // the block's front (−y) toward the middle
      const built = buildBlock(TRACK_BLOCKS['light-tower'], { params: { h: r3(h) }, library: TRACK_BLOCKS, many: 0.5, seed: S.seed + 100 + k, at: [r3(px), r3(py), 0], yaw: (yaw * 180) / Math.PI });
      // (the lamp heads painted apart, and kept bright through the hour's relight)
      for (const f of paintPiece(built.faces.filter((x) => x.group !== 'tech:light'), K)) faces.push(f);
      for (const f of paintPiece(built.faces.filter((x) => x.group === 'tech:light'), K)) faces.push({ ...f, fill: '#fff6e0', glow: true });
      lamps.push({ at: [r3(px), r3(py), r3(h * 1.06)], rgb: [255, 244, 220], intensity: 1.6, reach: r3(Math.max(F.w, F.d) * 0.7), hex: '#fff4dc' });
    }
  }
  return { faces, lamps, reach, far, top, bowl: bowl ? { top: bowl.top, outer: bowl.outer, half: bowl.half, roofZ: bowl.roofZ, inner: bowl.inner } : null, K };
}

const SKYLINE_SET = 90;   // the skyline's nearest towers stand this far past the venue's reach
/** The skyline: towers rolled from the seed on a ring past the stadium, hazed toward the horizon with distance. */
function skylineFaces(S, P, horizon) {
  if (!S.skyline || !S.skyline.n) return [];
  const roll = dice((S.skyline.seed ?? S.seed) * 7919 + 3), F = S.field, cx = F.x + F.w / 2, cy = F.y + F.d / 2;
  const R = P.reach + SKYLINE_SET;
  const [lo, hi] = S.skyline.height, list = [];
  for (let k = 0; k < S.skyline.n; k++) {
    // the towers stand behind the far stands and the sides, not behind the camera
    const a = Math.PI * (0.1 + 0.8 * (k + roll() * 0.6) / S.skyline.n), d = R * (1 + roll() * 0.5);
    const height = lo + (hi - lo) * roll(), size = Math.max(10, height * (0.25 + roll() * 0.2));
    const forms = S.skyline.forms ?? SKYLINE_FORMS, preset = forms[Math.floor(roll() * forms.length)];
    list.push({ preset, seed: (S.skyline.seed ?? S.seed) * 100 + k, at: [r3(cx + Math.cos(a) * d * 1.25), r3(cy + Math.sin(a) * d), 0], size: r3(size), height: r3(height), turn: r3(roll() * 90), echo: false });
  }
  const { faces } = structureFaces(list);
  return faces.map((f) => {
    const mid = f.corners.reduce((s, p) => [s[0] + p[0] / f.corners.length, s[1] + p[1] / f.corners.length], [0, 0]);
    const t = Math.min(0.7, 0.25 + Math.hypot(mid[0] - cx, mid[1] - cy) / (R * 4));
    return { ...f, fill: typeof f.fill === 'string' && f.fill[0] === '#' ? mixHex(f.fill, horizon, t) : f.fill };
  });
}

/** The World page's payload: the venue, the sky at its hour, a camera. */
export function assembleStadiumScene(m = {}, opts = {}) {
  const S = readStadium(m), H = hourOf(S.time), P = stadiumParts(S);
  let faces = [...P.faces, ...skylineFaces(S, P, H.bg)];
  // after noon the venue is relit at its hour; the masts' lamps pool on the field once the light goes
  if (H.mood) faces = relightFaces(faces, H.mood, S.time === 'dusk' || S.time === 'night' ? P.lamps : []);
  const F = S.field, cx = F.x + F.w / 2, cy = F.y + F.d / 2, span = Math.max(F.w, F.d);
  // (the default view from the near stand's lower tier, most of the way up it, on the field's middle)
  let at = [cx, F.y - 8, 10 + span * 0.12];
  if (S.bowl) {
    // (seated in the near stand: up it most of the way, an eye over the tread, and under the canopy's edge)
    const b = S.bowl, into = b.gap + b.rows[0] * 0.82 * 0.8, back = P.bowl.half[1] - F.d / 2 + into + (b.clear ?? 0);
    let eye = 1.1 + b.rows[0] * (b.rise ?? 0.42) * 0.8 + 3.5;
    if (b.roof === 'canopy' || b.roof === 'ring') {
      const { roofZ, inner, outer } = P.bowl, under = roofZ - 1.6 * Math.min(1, Math.max(0, (outer + 0.5 - into) / (outer + 0.5 - inner)));
      eye = Math.min(eye, under - 2.4);
    }
    at = [cx, cy - F.d / 2 - back, eye];
  }
  const camera = m.camera ?? { name: 'stand', worldFraming: { cameraPosition: at.map(r3), lookAt: [r3(cx), r3(cy + span * 0.08), 0.5], horizontalFov: 64, pictureCenter: [640, 360] } };
  return {
    faces,
    cameras: [camera],
    viewBox: m.viewBox ?? { width: 1280, height: 720 },
    title: opts.title || m.title || 'mojulo stadium',
    bg: H.bg,
    sky: H.sky,
    haze: { color: H.haze, density: 1.6 / (P.far * 2.2) },
    metersPerUnit: 1,
    stadium: { preset: S.preset, look: S.look, palette: S.palette, livery: S.livery, time: S.time, masts: S.masts, ...(S.bowl ? { roof: S.bowl.roof, facade: S.bowl.facade, top: r3(P.top) } : {}) },
  };
}
