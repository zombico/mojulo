/**
 * Shoot plan — set pieces: flats and shapes placed for the camera, not for the world. A wall a camera pushes through,
 * a floor and a ceiling that close a shot down, a pipe it flies into, a frame whose hole irises shut. They are
 * PICTURE (they render in captures) but not world: no face, no mesh export, no collision.
 *
 *   pieces: [{ id, kind: 'wall' | 'floor' | 'ceiling' | 'pipe' | 'frame',
 *              attach: '<camera id>' | 'world', shots?: [name | index],
 *              size?: [a, b] (wall / frame: width, height; floor / ceiling: length, width),
 *              radius?, length?, rings? (pipe), shape?: 'round' | 'square', border? (frame),
 *              along?: '<camera id>', span?: [t0, t1], extend?: [before, after] (pipe: built along a camera's path),
 *              portal?: '<shot>' | { shot } | { camera, t? } (frame: its hole looks out of that camera),
 *              color, color2? (pipe rings), opacity?,
 *              visible?: [t0, t1] (world seconds; default: whenever its shots play),
 *              keys: [{ t, at: [x,y,z], rot?: [yaw, pitch, roll], scale?, opacity?, open?, ease? }] }]
 *
 * A piece's own frame is x forward, y left, z up. Attached to a camera its `at` is in the camera's frame (x down the
 * lens, y to the left of frame, z up, turned with the camera's roll), so it rides the camera, as an AE layer parented
 * to it; attached to the world, `at` is a world point and `rot` turns it from the world axes. A wall faces back along
 * its x (toward a camera behind it), a floor and a ceiling lie in their x–y plane, a pipe runs along x, a frame faces
 * like a wall. Keys use the camera keys' timing (ease, hold) and their times are the world clock's.
 *
 * A pipe `along` a camera is world geometry swept along the path that camera travels over `span` (world seconds;
 * default its keys), `extend` straight past either end and capped by `cap`: a tunnel the camera really flies through,
 * bending where it bends, visible from any camera. Its `profile` is `'round'` (a tube of `radius`) or `'box'` (a
 * corridor `size: [width, height]` with the `sides` it has: floor, ceiling, left, right). A wall, a floor or a ceiling
 * given `along` is that box with one side (a wall: `side: 'left' | 'right' | 'both'`), so the flats along a path and
 * the tube are one piece.
 *
 * A frame with a `portal` is a window into another camera's view: its hole shows what that camera sees, rendered
 * from where the viewer stands relative to the frame (move and the view through it shifts, as through a doorway),
 * so a camera that flies through the hole arrives exactly in the other camera's frame. `{ shot }` looks out of that
 * shot's camera at its first instant (the frame after the cut); `{ camera, t }` out of a camera at a fixed time;
 * `{ camera }` out of it live, at the world time showing. Anything behind the far camera is clipped away.
 *
 * Visibility: a piece shows during its `shots`; by default a camera's piece during that camera's shots and a world
 * piece during every shot, so two cameras covering one span never see each other's flats.
 */
import { easeFraction, compileCamera, cameraAt } from './sample.js';
import { parseEase } from './plan.js';

export const PIECE_KINDS = ['wall', 'floor', 'ceiling', 'pipe', 'frame'];
export const BOX_SIDES = ['floor', 'ceiling', 'left', 'right'];
const PALETTE_DARK = '#0b0c10';
const v3 = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const hex = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

const DEFAULTS = {
  wall: { size: [4, 3] },
  floor: { size: [8, 4] },
  ceiling: { size: [8, 4] },
  pipe: { radius: 1, length: 10, rings: 12 },
  frame: { size: [4, 3], shape: 'round', border: 0 },
};

/** Read `shoot.pieces` against a normalized plan's cameras and shots; returns `{ pieces, warnings }`. Idempotent. */
export function normalizePieces(raw, plan, warn = () => {}) {
  if (!Array.isArray(raw)) return [];
  const camIds = new Set(plan.cameras.map((c) => c.id));
  const ids = new Set();
  const out = [];
  raw.slice(0, 64).forEach((p, i) => {
    if (!p || typeof p !== 'object') return;
    const kind = PIECE_KINDS.includes(p.kind) ? p.kind : null;
    if (!kind) { warn(`piece ${i}: kind '${p.kind}' is not one of ${PIECE_KINDS.join(', ')}; dropped`); return; }
    let id = typeof p.id === 'string' && p.id.trim() ? p.id.trim().slice(0, 40) : `${kind}${i + 1}`;
    while (ids.has(id)) id = `${id}-${i + 1}`;
    ids.add(id);
    // a wall / floor / ceiling laid along a path is the box pipe with that side
    if (p.along != null && kind !== 'pipe' && kind !== 'frame') {
      const sides = kind === 'wall' ? ({ left: ['left'], right: ['right'] }[p.side] || ['left', 'right']) : [kind];
      const { side, ...rest } = p;
      return normalizePieces([{ ...rest, id, kind: 'pipe', profile: 'box', sides }], plan, warn).forEach((q) => { out.push(q); });
    }
    const along = kind === 'pipe' && p.along != null ? String(p.along) : null;
    if (along && !camIds.has(along)) { warn(`piece ${id}: no camera '${along}' to run along; dropped`); return; }
    const attach = along || p.attach == null || p.attach === 'world' ? 'world' : String(p.attach);
    if (attach !== 'world' && !camIds.has(attach)) { warn(`piece ${id}: no camera '${attach}' to ride; dropped`); return; }
    // keys: time + place; missing values carry from the key before
    let at = [attach === 'world' ? 0 : 2, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], opacity = fin(p.opacity) ? clamp01(p.opacity) : 1, open = 1;
    const keys = (Array.isArray(p.keys) && p.keys.length ? p.keys : [{ t: 0 }])
      .filter((k) => k && typeof k === 'object')
      .map((k, j) => ({ k, t: fin(k.t) && k.t >= 0 ? k.t : j * 2 }))
      .sort((a, b) => a.t - b.t)
      .map(({ k, t }) => {
        if (v3(k.at)) at = k.at.slice();
        if (v3(k.rot)) rot = k.rot.slice();
        if (fin(k.scale) && k.scale > 0) scale = [k.scale, k.scale, k.scale];
        else if (v3(k.scale) && k.scale.every((s) => s > 0)) scale = k.scale.slice();
        if (fin(k.opacity)) opacity = clamp01(k.opacity);
        if (fin(k.open)) open = clamp01(k.open);
        return { t, at: at.slice(), rot: rot.slice(), scale: scale.slice(), opacity, open, ease: parseEase(k.ease) || 'linear' };
      });
    const d = DEFAULTS[kind];
    const pos2 = (v, dflt) => (Array.isArray(v) && v.length === 2 && v.every((x) => fin(x) && x > 0) ? v.slice() : dflt.slice());
    const shots = Array.isArray(p.shots) ? p.shots.map((s) => (typeof s === 'number' ? plan.shots[s]?.name : s)).filter((s) => plan.shots.some((x) => x.name === s)) : null;
    out.push({
      id, kind, attach,
      ...(shots && shots.length ? { shots } : {}),
      ...(Array.isArray(p.visible) && p.visible.length === 2 && p.visible.every(fin) && p.visible[1] > p.visible[0] ? { visible: p.visible.slice() } : {}),
      ...(kind === 'pipe'
        ? { radius: fin(p.radius) && p.radius > 0 ? p.radius : d.radius, length: fin(p.length) && p.length > 0 ? p.length : d.length,
          ...(Number.isInteger(p.rings) && p.rings >= 0 ? { rings: Math.min(p.rings, 256) } : along ? {} : { rings: d.rings }),
          ...(p.cap === 'far' || p.cap === 'near' || p.cap === 'both' ? { cap: p.cap } : {}),
          ...(along ? {
            along,
            ...(p.profile === 'box' ? {
              profile: 'box',
              size: pos2(p.size, [3, 2.4]),
              sides: Array.isArray(p.sides) && p.sides.some((x) => BOX_SIDES.includes(x)) ? BOX_SIDES.filter((x) => p.sides.includes(x)) : BOX_SIDES.slice(),
            } : {}),
            ...(Array.isArray(p.span) && p.span.length === 2 && p.span.every(fin) && p.span[1] > p.span[0] ? { span: p.span.slice() } : {}),
            ...(Array.isArray(p.extend) && p.extend.length === 2 && p.extend.every((x) => fin(x) && x >= 0) ? { extend: p.extend.slice() } : {}),
          } : {}) }
        : { size: pos2(p.size, d.size) }),
      ...(kind === 'frame' ? { shape: p.shape === 'square' ? 'square' : 'round', border: fin(p.border) && p.border > 0 ? p.border : 0 } : {}),
      ...(kind === 'frame' && portalOf(p.portal, plan, id, warn) ? { portal: portalOf(p.portal, plan, id, () => {}) } : {}),
      color: hex(p.color, PALETTE_DARK),
      ...(kind === 'pipe' ? { color2: hex(p.color2, '#f5a524') } : {}),
      keys,
      ...(p.generated ? { generated: p.generated } : {}),
    });
  });
  return out;
}

const DEG = Math.PI / 180;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
const add3 = (p, a, s) => [p[0] + a[0] * s, p[1] + a[1] * s, p[2] + a[2] * s];

/** A camera's frame at an instant: its eye and its forward / left / up axes, banked by its roll. */
export function cameraBasis(cam) {
  const f = norm(sub(cam.look, cam.pos));
  let l = cross([0, 0, 1], f);
  l = Math.hypot(...l) < 1e-9 ? [0, 1, 0] : norm(l);
  let u = cross(f, l);
  const r = (cam.roll || 0) * DEG, c = Math.cos(r), s = Math.sin(r);
  // + roll banks the camera clockwise as seen from behind it: up swings toward frame right (−left)
  [u, l] = [[c * u[0] - s * l[0], c * u[1] - s * l[1], c * u[2] - s * l[2]], [c * l[0] + s * u[0], c * l[1] + s * u[1], c * l[2] + s * u[2]]];
  return { pos: cam.pos, f, l, u };
}

// rotate the triad (f, l, u) by yaw about u, then pitch about the new l, then roll about the new f
function turn({ f, l, u }, [yaw, pitch, roll]) {
  const rot = (a, axis, ang) => {   // Rodrigues
    const c = Math.cos(ang), s = Math.sin(ang), k = axis, d = k[0] * a[0] + k[1] * a[1] + k[2] * a[2], x = cross(k, a);
    return [a[0] * c + x[0] * s + k[0] * d * (1 - c), a[1] * c + x[1] * s + k[1] * d * (1 - c), a[2] * c + x[2] * s + k[2] * d * (1 - c)];
  };
  if (yaw) { f = rot(f, u, yaw * DEG); l = rot(l, u, yaw * DEG); }
  if (pitch) { f = rot(f, l, -pitch * DEG); u = rot(u, l, -pitch * DEG); }
  if (roll) { l = rot(l, f, roll * DEG); u = rot(u, f, roll * DEG); }   // + clockwise from behind, as camera roll
  return { f, l, u };
}

// a rotation matrix with columns (f, l, u) as a quaternion [x, y, z, w]
function quatOf({ f, l, u }) {
  const m00 = f[0], m01 = l[0], m02 = u[0], m10 = f[1], m11 = l[1], m12 = u[1], m20 = f[2], m21 = l[2], m22 = u[2];
  const tr = m00 + m11 + m22;
  let x, y, z, w;
  if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); w = 0.25 / s; x = (m21 - m12) * s; y = (m02 - m20) * s; z = (m10 - m01) * s; }
  else if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s; }
  else if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s; }
  else { const s = 2 * Math.sqrt(1 + m22 - m00 - m11); w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s; }
  return [x, y, z, w];
}

// the piece's own keyed values at t (clamped to its keys; hold freezes; AE timing)
function pieceValues(piece, t) {
  const ks = piece.keys;
  if (ks.length === 1 || t <= ks[0].t) return ks[0];
  const last = ks[ks.length - 1];
  if (t >= last.t) return last;
  let i = 0;
  while (i + 2 < ks.length && ks[i + 1].t <= t) i++;
  const a = ks[i], b = ks[i + 1];
  if (a.ease === 'hold') return a;
  const f = easeFraction((t - a.t) / (b.t - a.t), a.ease === 'easy_ease' || a.ease === 'easy_ease_out', b.ease === 'easy_ease' || b.ease === 'easy_ease_in');
  const L = (x, y) => x + (y - x) * f;
  const L3 = (x, y) => [L(x[0], y[0]), L(x[1], y[1]), L(x[2], y[2])];
  return { at: L3(a.at, b.at), rot: L3(a.rot, b.rot), scale: L3(a.scale, b.scale), opacity: L(a.opacity, b.opacity), open: L(a.open, b.open) };
}

/** Where a piece is at world time t: `{ pos, quat, scale, opacity, open }`, given its camera compiled (if attached). */
export function posePiece(piece, t, compiledCamera = null) {
  const v = pieceValues(piece, t);
  const base = compiledCamera ? cameraBasis(cameraAt(compiledCamera, t)) : { pos: [0, 0, 0], f: [1, 0, 0], l: [0, 1, 0], u: [0, 0, 1] };
  const pos = add3(add3(add3(base.pos, base.f, v.at[0]), base.l, v.at[1]), base.u, v.at[2]);
  return { pos, quat: quatOf(turn(base, v.rot)), scale: v.scale, opacity: v.opacity, open: v.open };
}

const r4 = (v) => Math.round(v * 1e4) / 1e4;

/**
 * What the page draws: per piece its geometry, the shots it shows in (indices into the cut), and a per-frame track
 * over the span it can be seen (its keys and its shots), at the plan's fps.
 */
export function lowerPieces(plan, pieces, { subjects = null } = {}) {
  const compiled = new Map();
  const camOf = (id) => {
    if (!compiled.has(id)) compiled.set(id, compileCamera(plan.cameras.find((c) => c.id === id), { subjects }));
    return compiled.get(id);
  };
  return pieces.map((p) => {
    const names = p.shots || plan.shots.filter((s) => p.attach === 'world' || s.camera === p.attach).map((s) => s.name);
    const shotIdx = plan.shots.map((s, i) => (names.includes(s.name) ? i : -1)).filter((i) => i >= 0);
    const spans = shotIdx.map((i) => plan.shots[i].span);
    const [t0, t1] = p.visible || [Math.min(p.keys[0].t, ...spans.map((s) => s[0])), Math.max(p.keys[p.keys.length - 1].t, ...spans.map((s) => s[1]))];
    const n = Math.max(1, Math.round((t1 - t0) * plan.fps) + 1);
    const pos = [], quat = [], scale = [], opacity = [], open = [];
    const cam = p.attach === 'world' ? null : camOf(p.attach);
    for (let j = 0; j < n; j++) {
      const s = posePiece(p, Math.min(t1, t0 + j / plan.fps), cam);
      pos.push(...s.pos.map(r4)); quat.push(...s.quat.map(r4)); scale.push(...s.scale.map(r4)); opacity.push(r4(s.opacity)); open.push(r4(s.open));
    }
    const { keys, shots, attach, generated, visible, along, span, extend, portal, ...look } = p;
    const swept = along ? alongPath(p, camOf(along), plan.fps) : null;
    let dest = null;
    if (portal) {   // the far side: where the portal looks out from, per frame of the piece's track
      const far = portal.shot ? plan.shots.find((x) => x.name === portal.shot) : null;
      const fc = camOf(far ? far.camera : portal.camera), fixedT = far ? far.span[0] : portal.t;
      dest = { pos: [], quat: [] };
      for (let j = 0; j < n; j++) {
        const b = cameraBasis(cameraAt(fc, Number.isFinite(fixedT) ? fixedT : Math.min(t1, t0 + j / plan.fps)));
        dest.pos.push(...b.pos.map(r4)); dest.quat.push(...quatOf(b).map(r4));
      }
    }
    return { ...look, ...(dest ? { portal: dest } : {}), ...(swept ? { path: swept.path, rings: p.rings ?? swept.rings, ...(swept.rails ? { rails: swept.rails } : {}) } : {}), shots: shotIdx, track: { t0, t1, fps: plan.fps, n, pos, quat, scale, opacity, open } };
  });
}

// a pipe's centre line along a camera's path: the eye sampled densely over `span`, repeats dropped, then carried
// straight past each end by `extend`. A camera that does not move over the span gets a straight pipe down its lens.
function alongPath(p, cam, fps) {
  const keys = cam.cam.keys;
  const [t0, t1] = p.span || [keys[0].t, keys[keys.length - 1].t];
  const n = Math.max(24, Math.ceil((t1 - t0) * fps * 3));
  const pts = [];
  for (let j = 0; j <= n; j++) {
    const q = cameraAt(cam, t0 + (t1 - t0) * j / n).pos;
    if (!pts.length || Math.hypot(...sub(q, pts[pts.length - 1])) > p.radius * 0.05) pts.push(q);
  }
  if (pts.length < 2) {
    const b = cameraBasis(cameraAt(cam, t0));
    pts.length = 0;
    pts.push(add3(b.pos, b.f, -p.length / 2), add3(b.pos, b.f, p.length / 2));
  }
  const [before, after] = p.extend || [0, 0];
  const head = norm(sub(pts[1], pts[0])), tail = norm(sub(pts[pts.length - 1], pts[pts.length - 2]));
  const steps = (len) => Math.max(1, Math.ceil(len / (p.radius * 2)));
  const lead = [], trail = [];
  for (let k = steps(before); k >= 1 && before > 0; k--) lead.push(add3(pts[0], head, -before * k / steps(before)));
  for (let k = 1; k <= steps(after) && after > 0; k++) trail.push(add3(pts[pts.length - 1], tail, after * k / steps(after)));
  const path = [...lead, ...pts, ...trail].map((q) => q.map(r4));
  let len = 0;
  for (let i = 1; i < path.length; i++) len += Math.hypot(...sub(path[i], path[i - 1]));
  const across = p.profile === 'box' ? Math.max(p.size[0], p.size[1]) / 2 : p.radius;
  return { path, rings: Math.max(4, Math.min(256, Math.round(len / (across * 1.5)))), ...(p.profile === 'box' ? { rails: boxRails(path) } : {}) };
}

// a box corridor's cross-section frame at each path point: `right` level with the ground (the floor stays flat as
// the path climbs or turns) and `up` square to it and the path; a vertical stretch keeps the last level right
function boxRails(path) {
  const right = [], up = [];
  let prev = [0, -1, 0];
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    const t = norm(sub(b, a));
    let r = cross(t, [0, 0, 1]);
    r = Math.hypot(...r) < 1e-6 ? prev : norm(r);
    prev = r;
    right.push(r.map(r4)); up.push(norm(cross(r, t)).map(r4));
  }
  return { right, up };
}

// a frame's `portal`: a shot name, { shot }, or { camera, t? }, checked against the plan; null when it names nothing
function portalOf(v, plan, id, warn) {
  if (v == null) return null;
  const o = typeof v === 'string' ? { shot: v } : v;
  if (o && typeof o.shot === 'string') {
    if (plan.shots.some((x) => x.name === o.shot)) return { shot: o.shot };
    warn(`piece ${id}: its portal looks into shot '${o.shot}', which is not in the cut; no portal`);
    return null;
  }
  if (o && typeof o.camera === 'string') {
    if (plan.cameras.some((c) => c.id === o.camera)) return { camera: o.camera, ...(fin(o.t) && o.t >= 0 ? { t: o.t } : {}) };
    warn(`piece ${id}: its portal looks out of camera '${o.camera}', which is not in the plan; no portal`);
    return null;
  }
  warn(`piece ${id}: a portal is a shot name, { shot } or { camera, t? }; no portal`);
  return null;
}
