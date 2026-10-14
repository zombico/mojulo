/**
 * Shoot plan — the recipe. `manifest.shoot` on any world: cameras keyed in After Effects terms and a cut list.
 *
 *   shoot: {
 *     fps: 24,
 *     cameras: [{ id, name?, type: 'two_node'|'one_node', film_mm: 36, path: 'smooth'|'linear',
 *                 keys: [{ t, pos, poi | yaw+pitch, roll, focal_mm, ease }] }],   // t: world-clock seconds
 *     shots: [{ name, camera, span: [t0, t1] }],
 *   }
 *
 * `normalizeShoot` reads the words people use (`lens: '35mm'`, `type: 'two-node'`, `ease: 'easy ease'`, a key's
 * `look_at`) into that canonical form, sorts keys by time, carries a key's missing values from the one before, and
 * returns warnings for anything it had to drop or guess. A key's `pos` / `poi` is a point `[x,y,z]` or a FOLLOW,
 * `{ follow: 'car:2', offset?: [x,y,z], frame?: 'world'|'subject' }` (subjects.js names what can be followed).
 * Key times and shot spans are the world clock's: a shot shows the world as it is over its span, so shots whose
 * spans overlap are coverage of the same action from different cameras. `shootReadout` is the machine gate's numbers: duration,
 * path length, peak speed, lens range. `lowerShoot` is what the World page's channel draws.
 */
import { FILM_MM, parseLens } from './lens.js';
import { compileCamera, cameraAt, programOf, sampleCameraTrack, pathPolyline } from './sample.js';

export const EASES = ['linear', 'easy_ease', 'easy_ease_in', 'easy_ease_out', 'hold'];
export const CAMERA_TYPES = ['two_node', 'one_node'];
export const DEFAULT_FOCAL_MM = 50;   // AE's default camera
export const DEFAULT_FPS = 24;
export const STATIC_SHOT_S = 3;       // a one-key camera's default shot length
const MAX_CAMERAS = 8, MAX_KEYS = 64, MAX_SHOTS = 64, MAX_SECONDS = 600;
const PALETTE = ['#f5a524', '#4fc3f7', '#e57cd8', '#7bd88f', '#ff7a59', '#b39ddb', '#ffd54f', '#80cbc4'];

const v3 = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const isFollow = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && typeof v.follow === 'string' && v.follow.trim().length > 0;
const isPoint = (v) => v3(v) || isFollow(v);
// a point copied, or a follow reduced to its canonical keys
const pointOf = (v) => (v3(v) ? v.slice() : {
  follow: v.follow.trim(), ...(v3(v.offset) ? { offset: v.offset.slice() } : {}), ...(v.frame === 'subject' ? { frame: 'subject' } : {}),
});
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const squash = (s) => String(s).toLowerCase().replace(/[\s_-]+/g, '');

/** `'two-node'`, `'twoNode'`, `'2 node'` → `'two_node'`; null if unknown. */
export function parseCameraType(v) {
  if (v == null) return null;
  const s = squash(v);
  if (s === 'twonode' || s === '2node' || s === 'poi') return 'two_node';
  if (s === 'onenode' || s === '1node' || s === 'free') return 'one_node';
  return null;
}

/** `'easy ease'`, `'easyEaseIn'`, `'ease out'`, `'hold'` → a canonical ease; null if unknown. */
export function parseEase(v) {
  if (v == null) return null;
  const s = squash(v);
  if (s === 'linear') return 'linear';
  if (s === 'easyease' || s === 'ease' || s === 'easeinout' || s === 'smooth') return 'easy_ease';
  if (s === 'easyeasein' || s === 'easein') return 'easy_ease_in';
  if (s === 'easyeaseout' || s === 'easeout') return 'easy_ease_out';
  if (s === 'hold' || s === 'step') return 'hold';
  return null;
}

function normalizeCamera(raw, i, warn, subjects) {
  // with the world's subjects in hand a follow must name one of them; without, it is kept for a later read
  const knows = (v) => !isFollow(v) || !subjects || subjects.has(v.follow.trim());
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 40) : `cam${i + 1}`;
  const film = fin(raw.film_mm) && raw.film_mm > 0 ? raw.film_mm : FILM_MM;
  const camLens = parseLens(raw.focal_mm ?? raw.lens ?? (fin(raw.hfov) ? { hfov: raw.hfov } : null), film);
  const rawKeys = Array.isArray(raw.keys) ? raw.keys.slice(0, MAX_KEYS) : [];
  if (Array.isArray(raw.keys) && raw.keys.length > MAX_KEYS) warn(`${id}: only the first ${MAX_KEYS} keys are kept`);
  let type = parseCameraType(raw.type);
  if (raw.type != null && !type) warn(`${id}: unknown camera type '${raw.type}', reading it from the keys`);
  const hasPoi = rawKeys.some((k) => k && isPoint(k.poi ?? k.look_at ?? k.target));
  const hasAim = rawKeys.some((k) => k && (fin(k.yaw) || fin(k.pitch)));
  if (!type) type = hasPoi || !hasAim ? 'two_node' : 'one_node';

  // keys: a time (missing ⇒ 2 s after the previous), a position; sorted, one per instant
  let lastT = -2;
  const timed = [];
  rawKeys.forEach((k, j) => {
    if (!k || !isPoint(k.pos)) { warn(`${id}: key ${j} has no position [x,y,z] and was dropped`); return; }
    if (!knows(k.pos)) { warn(`${id}: key ${j} follows '${k.pos.follow}', which does not move in this world; key dropped`); return; }
    const t = fin(k.t) && k.t >= 0 ? Math.min(k.t, MAX_SECONDS) : lastT + 2;
    lastT = t;
    timed.push({ k, t, j });
  });
  timed.sort((a, b) => a.t - b.t || a.j - b.j);
  const byT = [];
  for (const row of timed) {
    if (byT.length && byT[byT.length - 1].t === row.t) { warn(`${id}: two keys at ${row.t}s, the later one kept`); byT[byT.length - 1] = row; } else byT.push(row);
  }
  if (!byT.length) { warn(`${id}: no usable keys, camera dropped`); return null; }

  // carry: a key's missing poi / aim / lens / roll comes from the key before; the first key's from the first key that has one
  const poiOf = (k) => { const p = k.poi ?? k.look_at ?? k.target; return isPoint(p) && knows(p) ? p : null; };
  for (const { k, t } of byT) {
    const p = k.poi ?? k.look_at ?? k.target;
    if (isFollow(p) && !knows(p)) warn(`${id}: key at ${t}s aims at '${p.follow}', which does not move in this world; keeping the aim before it`);
  }
  const firstPoi = (byT.find(({ k }) => poiOf(k)) || {}).k;
  let poi = firstPoi ? poiOf(firstPoi) : null;
  if (type === 'two_node' && !poi) { warn(`${id}: a two-node camera with no point of interest; aiming at the world origin`); poi = [0, 0, 0]; }
  let yaw = 0, pitch = 0, roll = 0, focal = camLens ?? DEFAULT_FOCAL_MM;
  const keys = byT.map(({ k, t }) => {
    const p = poiOf(k);
    if (p) poi = p;
    if (fin(k.yaw)) yaw = k.yaw;
    if (fin(k.pitch)) pitch = Math.max(-89.9, Math.min(89.9, k.pitch));
    if (fin(k.roll)) roll = k.roll;
    const lens = parseLens(k.focal_mm ?? k.lens ?? (fin(k.hfov) ? { hfov: k.hfov } : null), film);
    if ((k.focal_mm ?? k.lens ?? k.hfov) != null && lens == null) warn(`${id}: key at ${t}s has an unreadable lens, keeping ${+focal.toFixed(2)}mm`);
    if (lens != null) focal = lens;
    const ease = parseEase(k.ease);
    if (k.ease != null && !ease) warn(`${id}: key at ${t}s has an unknown ease '${k.ease}', using linear`);
    const out = { t, pos: pointOf(k.pos), ...(type === 'two_node' ? { poi: pointOf(poi) } : { yaw, pitch }), roll, focal_mm: focal, ease: ease || 'linear' };
    if (type === 'two_node' && v3(out.pos) && v3(out.poi) && dist0(out.pos, out.poi) < 1e-6) warn(`${id}: key at ${t}s sits on its own point of interest; the view direction is undefined`);
    return out;
  });
  return {
    id,
    ...(typeof raw.name === 'string' && raw.name.trim() ? { name: raw.name.trim().slice(0, 60) } : {}),
    type, film_mm: film, path: raw.path === 'linear' ? 'linear' : 'smooth', keys,
  };
}

const dist0 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

/**
 * Read a shoot plan into its canonical form. Returns `{ plan, warnings }`; `plan` is null when no camera survives.
 * `subjects` (subjects.js `shootSubjects` of the world) checks every follow names something that moves there.
 * Idempotent: a normalized plan normalizes to itself.
 */
export function normalizeShoot(raw, { subjects = null } = {}) {
  const warnings = [];
  const warn = (m) => { if (warnings.length < 40) warnings.push(m); };
  if (!raw || typeof raw !== 'object') return { plan: null, warnings: ['shoot: expected an object { cameras, shots? }'] };
  const rawCams = Array.isArray(raw.cameras) ? raw.cameras : (raw.camera && typeof raw.camera === 'object' ? [raw.camera] : []);
  if (rawCams.length > MAX_CAMERAS) warn(`only the first ${MAX_CAMERAS} cameras are kept`);
  const cameras = [];
  const ids = new Set();
  rawCams.slice(0, MAX_CAMERAS).forEach((c, i) => {
    if (!c || typeof c !== 'object') return;
    const cam = normalizeCamera(c, i, warn, subjects);
    if (!cam) return;
    if (ids.has(cam.id)) { const was = cam.id; cam.id = `${cam.id}-${i + 1}`; warn(`camera id '${was}' is taken, renamed '${cam.id}'`); }
    ids.add(cam.id);
    cameras.push(cam);
  });
  if (!cameras.length) return { plan: null, warnings: warnings.length ? warnings : ['shoot: no camera with a keyed position'] };
  const fps = fin(raw.fps) && raw.fps >= 1 && raw.fps <= 120 ? Math.round(raw.fps) : DEFAULT_FPS;

  const range = (c) => [c.keys[0].t, c.keys[c.keys.length - 1].t];
  const label = (c) => c.name || c.id;
  let shots = [];
  if (Array.isArray(raw.shots) && raw.shots.length) {
    raw.shots.slice(0, MAX_SHOTS).forEach((s, i) => {
      if (!s || typeof s !== 'object') return;
      const cam = cameras.find((c) => c.id === s.camera) || (s.camera == null ? cameras[0] : null);
      if (!cam) { warn(`shot ${i}: no camera '${s.camera}', shot dropped`); return; }
      const [a, b] = range(cam);
      const span = Array.isArray(s.span) && s.span.length === 2 && s.span.every(fin) ? s.span.slice() : [a, b > a ? b : a + STATIC_SHOT_S];
      if (!(span[1] > span[0]) || span[0] < 0) { warn(`shot ${i}: span [${span}] is empty, shot dropped`); return; }
      shots.push({ name: typeof s.name === 'string' && s.name.trim() ? s.name.trim().slice(0, 60) : `${label(cam)} ${i + 1}`, camera: cam.id, span });
    });
  }
  if (!shots.length) {
    shots = cameras.map((c) => { const [a, b] = range(c); return { name: label(c), camera: c.id, span: [a, b > a ? b : a + STATIC_SHOT_S] }; });
  }
  return { plan: { fps, cameras, shots }, warnings };
}

/**
 * The machine gate's numbers for a normalized plan: the program length, and per camera its key count, key range,
 * path length and peak speed (sampled at the fps), its lens range in mm, what it follows, and `jumps`: instants where
 * one frame's move is far beyond the camera's typical step (a followed subject wrapping its route teleports the
 * camera riding it). Lengths are in metres when `metersPerUnit` is given (the world payload's), else in world units
 * and labelled so.
 */
export function shootReadout(plan, { subjects = null, metersPerUnit = null } = {}) {
  const { total, shots } = programOf(plan);
  const mpu = Number.isFinite(metersPerUnit) && metersPerUnit > 0 ? metersPerUnit : null;
  const r2 = (v) => Math.round(v * 100) / 100;
  const cameras = plan.cameras.map((c) => {
    const compiled = compileCamera(c, { subjects });
    const t0 = c.keys[0].t, t1 = c.keys[c.keys.length - 1].t;
    const n = Math.max(1, Math.round((t1 - t0) * plan.fps)), dt = (t1 - t0) / n;
    const steps = [];
    let prev = cameraAt(compiled, t0).pos;
    for (let j = 1; j <= n; j++) {
      const p = cameraAt(compiled, t0 + dt * j).pos;
      steps.push(dist0(prev, p));
      prev = p;
    }
    const path = steps.reduce((a, b) => a + b, 0);
    const sorted = steps.slice().sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)] || 0;
    const jumps = [];
    steps.forEach((d, j) => { if (dt > 0 && d > Math.max(10 * median, 1e-3) && d > 0.5 * path / Math.max(1, Math.sqrt(n))) jumps.push(r2(t0 + dt * (j + 1))); });
    const peak = dt > 0 ? Math.max(0, ...steps.filter((d, j) => !jumps.includes(r2(t0 + dt * (j + 1)))).map((d) => d / dt)) : 0;
    const k = mpu || 1;
    const lenses = c.keys.map((key) => key.focal_mm);
    const follows = followsOf(c);
    return {
      id: c.id, ...(c.name ? { name: c.name } : {}), type: c.type, keys: c.keys.length, range_s: [t0, t1], ...(follows.length ? { follows } : {}),
      [mpu ? 'path_m' : 'path_units']: r2(path * k), [mpu ? 'peak_speed_mps' : 'peak_speed_units_s']: r2(peak * k),
      lens_mm: [r2(Math.min(...lenses)), r2(Math.max(...lenses))],
      ...(jumps.length ? { jumps: jumps.slice(0, 8) } : {}),
    };
  });
  return { duration_s: Math.round(total * 1000) / 1000, fps: plan.fps, ...(mpu ? { meters_per_unit: mpu } : {}), shots: shots.map((s) => ({ name: s.name, camera: s.camera, start_s: s.start, length_s: s.length })), cameras };
}

// the subjects a camera's keys follow, in first-use order
function followsOf(cam) {
  const ids = [];
  for (const k of cam.keys) for (const v of [k.pos, k.poi]) if (isFollow(v) && !ids.includes(v.follow)) ids.push(v.follow);
  return ids;
}

/**
 * What the World page's shoot channel draws: per camera its colour, keys, the path (the curve through fixed keys; the
 * sampled track when the camera follows something, since its path then depends on its timing), the point-of-interest
 * path when it moves, the route each followed subject takes over the camera's keys, and its per-frame track at the
 * plan's fps; plus the cut list on the program clock.
 */
export function lowerShoot(plan, { subjects = null } = {}) {
  const program = programOf(plan);
  const chunk = (flat) => { const out = []; for (let i = 0; i < flat.length; i += 3) out.push(flat.slice(i, i + 3)); return out; };
  return {
    fps: plan.fps,
    total: program.total,
    cameras: plan.cameras.map((c, i) => {
      const compiled = compileCamera(c, { subjects });
      const track = sampleCameraTrack(c, plan.fps, { subjects });
      const followsPos = c.keys.some((k) => isFollow(k.pos)), followsPoi = c.keys.some((k) => isFollow(k.poi));
      const poiMoves = c.type === 'two_node' && (followsPoi || c.keys.some((k) => dist0(k.poi, c.keys[0].poi) > 1e-6));
      const follows = followsOf(c);
      const r4 = (v) => Math.round(v * 1e4) / 1e4;
      return {
        id: c.id, name: c.name || c.id, type: c.type, color: PALETTE[i % PALETTE.length],
        keys: c.keys.map((k, j) => ({ t: k.t, pos: compiled.pos[j].map(r4), ease: k.ease })),
        path: followsPos ? chunk(track.pos) : pathPolyline(c, 'pos', { subjects }),
        ...(poiMoves ? { poiPath: followsPos || followsPoi ? chunk(track.look) : pathPolyline(c, 'poi', { subjects }) } : {}),
        ...(follows.length ? { follows: follows.map((id) => {
          const s = subjects.get(id), path = [];
          for (let j = 0; j < track.n; j++) path.push(s.at(Math.min(track.t1, track.t0 + j / track.fps)).pos.map(r4));
          return { id, path };
        }) } : {}),
        track,
      };
    }),
    shots: program.shots.map((s) => ({ name: s.name, camera: s.camera, start: s.start, length: s.length, span: s.span })),
  };
}
