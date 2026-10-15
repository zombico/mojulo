/**
 * Shoot plan — the edits `forge_motion`'s `shoot: { ops }` applies, in the words of a camera operator and an After Effects user.
 * Each op works on the NORMALIZED plan (plan.js) and returns a new one; the caller normalizes the result again, so an
 * op only has to say what changed. Ops address cameras by id, keys by time (seconds, the world clock) and shots by
 * name or index. Pure.
 *
 *   add_camera { camera }                       remove_camera { camera }
 *   set_camera { camera, name?, type?, lens?, path?, film_mm? }   type flips one-node ↔ two-node keeping the view
 *   add_key { camera, key }                     a key at an existing time replaces it
 *   set_key { camera, t, to?, pos?, poi?, yaw?, pitch?, roll?, lens?, ease? }   `to` moves the key in time
 *   remove_key { camera, t }
 *   ease { camera, t? | times?, ease }          every key when no time is given (AE: select all, F9)
 *   retime { camera?, scale?, shift? }          key times and that camera's shot spans; every camera when omitted
 *   add_shot { shot, at? }   set_shot { shot, name?, camera?, span?, in?, on? }   remove_shot { shot }   move_shot { shot, to }
 *     (`on` is the event pattern that cuts to the shot in a live world: 'goal:*'; null takes it back into the running order)
 *     (`in` is the transition into the shot: 'cut' | 'fade' | 'wipe' | 'iris' | 'pipe', or { type, duration, … })
 *   add_piece { piece }   set_piece { piece, …fields }   piece_key { piece, key }   remove_piece { piece }
 *   set { fps }
 */
import { parseLens } from './lens.js';

export const SHOOT_OPS = ['add_camera', 'remove_camera', 'set_camera', 'add_key', 'set_key', 'remove_key', 'ease', 'retime',
  'add_shot', 'set_shot', 'remove_shot', 'move_shot', 'add_piece', 'set_piece', 'piece_key', 'remove_piece', 'set'];

const AIM_M = 10;   // where a one-node camera's new point of interest goes: this far down its view axis (sample.js)
const sameT = (a, b) => Math.abs(a - b) < 1e-6;
const v3 = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

function cameraOf(plan, id) {
  const cam = plan.cameras.find((c) => c.id === id);
  if (!cam) throw new Error(`no camera '${id}' (cameras: ${plan.cameras.map((c) => c.id).join(', ') || 'none'})`);
  return cam;
}
function keyIndex(cam, t) {
  if (!Number.isFinite(t)) throw new Error(`${cam.id}: a key is addressed by its time \`t\` in seconds`);
  const i = cam.keys.findIndex((k) => sameT(k.t, t));
  if (i < 0) throw new Error(`${cam.id}: no key at ${t}s (keys at ${cam.keys.map((k) => k.t).join(', ')}s)`);
  return i;
}
function pieceIndex(plan, id) {
  const i = (plan.pieces || []).findIndex((p) => p.id === id);
  if (i < 0) throw new Error(`no piece '${id}' (pieces: ${(plan.pieces || []).map((p) => p.id).join(', ') || 'none'})`);
  return i;
}
function shotIndex(plan, ref) {
  const i = typeof ref === 'number' ? ref : plan.shots.findIndex((s) => s.name === ref);
  if (!(i >= 0 && i < plan.shots.length)) throw new Error(`no shot '${ref}' (shots: ${plan.shots.map((s) => s.name).join(', ')})`);
  return i;
}

// one-node ↔ two-node, keeping what each key sees (AE does the same when the auto-orient switches)
function convertType(cam, to) {
  if (to === cam.type) return cam;
  if (to === 'one_node') {
    return { ...cam, type: 'one_node', keys: cam.keys.map(({ poi, ...k }) => {
      if (!v3(k.pos) || !v3(poi)) throw new Error(`${cam.id}: a key at ${k.t}s follows a subject, so it has no fixed direction to keep as a one-node camera`);
      const d = [poi[0] - k.pos[0], poi[1] - k.pos[1], poi[2] - k.pos[2]];
      return { ...k, yaw: Math.atan2(d[1], d[0]) * 180 / Math.PI, pitch: Math.atan2(d[2], Math.hypot(d[0], d[1])) * 180 / Math.PI };
    }) };
  }
  return { ...cam, type: 'two_node', keys: cam.keys.map(({ yaw, pitch, ...k }) => {
    if (!v3(k.pos)) return { ...k, poi: { follow: k.pos.follow, ...(k.pos.offset ? { offset: k.pos.offset } : {}) } };
    const y = yaw * Math.PI / 180, p = pitch * Math.PI / 180;
    return { ...k, poi: [k.pos[0] + AIM_M * Math.cos(p) * Math.cos(y), k.pos[1] + AIM_M * Math.cos(p) * Math.sin(y), k.pos[2] + AIM_M * Math.sin(p)] };
  }) };
}

function keyPatch(k, f) {
  const out = { ...k };
  for (const name of ['pos', 'poi', 'yaw', 'pitch', 'roll', 'ease']) if (f[name] !== undefined) out[name] = f[name];
  const lens = f.lens ?? f.focal_mm;
  if (lens !== undefined) {
    const mm = parseLens(lens);
    if (mm == null) throw new Error(`unreadable lens '${lens}' (say '35mm' or a number of mm)`);
    out.focal_mm = mm;
  }
  if (f.hfov !== undefined) out.hfov = f.hfov, delete out.focal_mm;
  return out;
}

/** Apply one op to a normalized plan; returns the next (un-normalized) plan and a short note of what it did. */
export function applyShootOp(plan, op) {
  if (!op || typeof op !== 'object' || !SHOOT_OPS.includes(op.op)) throw new Error(`unknown op '${op && op.op}' (ops: ${SHOOT_OPS.join(', ')})`);
  const next = { ...plan, cameras: plan.cameras.map((c) => ({ ...c, keys: c.keys.map((k) => ({ ...k })) })), shots: plan.shots.map((s) => ({ ...s })),
    ...(plan.pieces ? { pieces: plan.pieces.map((p) => ({ ...p, keys: p.keys.map((k) => ({ ...k })) })) } : {}) };
  const put = (cam) => { next.cameras = next.cameras.map((c) => (c.id === cam.id ? cam : c)); };
  switch (op.op) {
    case 'add_camera': {
      if (!op.camera || typeof op.camera !== 'object') throw new Error('add_camera needs { camera: { id?, type?, lens?, keys } }');
      if (op.camera.id && next.cameras.some((c) => c.id === op.camera.id)) throw new Error(`a camera '${op.camera.id}' exists; set_camera edits it`);
      let id = op.camera.id, n = next.cameras.length + 1;
      while (!id || next.cameras.some((c) => c.id === id)) id = `cam${n++}`;
      next.cameras.push({ ...op.camera, id });
      // the new camera gets a shot over its keys at the end of the cut, unless told not to (`shot: false`)
      if (op.shot !== false) next.shots.push({ name: op.camera.name || id, camera: id });
      return { plan: next, note: `added camera ${id}${op.shot !== false ? ' and a shot for it' : ''}` };
    }
    case 'remove_camera': {
      cameraOf(next, op.camera);
      next.cameras = next.cameras.filter((c) => c.id !== op.camera);
      const before = next.shots.length;
      next.shots = next.shots.filter((s) => s.camera !== op.camera);
      if (next.pieces) next.pieces = next.pieces.filter((p) => p.attach !== op.camera);
      return { plan: next, note: `removed camera ${op.camera}${before > next.shots.length ? ` and its ${before - next.shots.length} shot(s)` : ''}` };
    }
    case 'set_camera': {
      let cam = { ...cameraOf(next, op.camera) };
      if (op.name !== undefined) cam.name = op.name;
      if (op.path !== undefined) cam.path = op.path;
      if (op.film_mm !== undefined) cam.film_mm = op.film_mm;
      if (op.lens !== undefined || op.focal_mm !== undefined) cam.keys = cam.keys.map((k) => keyPatch(k, { lens: op.lens ?? op.focal_mm }));
      if (op.type !== undefined) {
        const to = String(op.type).toLowerCase().replace(/[\s-]+/g, '_').replace(/^(\d)_?node$/, (m, d) => (d === '1' ? 'one_node' : 'two_node')).replace(/^twonode$/, 'two_node').replace(/^onenode$/, 'one_node');
        if (to !== 'one_node' && to !== 'two_node') throw new Error(`camera type is 'one-node' or 'two-node', not '${op.type}'`);
        cam = convertType(cam, to);
      }
      put(cam);
      return { plan: next, note: `set camera ${cam.id}` };
    }
    case 'add_key': {
      const cam = cameraOf(next, op.camera);
      if (!op.key || typeof op.key !== 'object') throw new Error('add_key needs { camera, key: { t, pos, poi?, lens?, ease? } }');
      const keys = cam.keys.filter((k) => !(Number.isFinite(op.key.t) && sameT(k.t, op.key.t)));
      const replaced = keys.length < cam.keys.length;
      put({ ...cam, keys: [...keys, op.key] });
      return { plan: next, note: `${replaced ? 'replaced' : 'added'} the ${cam.id} key at ${op.key.t ?? '?'}s` };
    }
    case 'set_key': {
      const cam = cameraOf(next, op.camera);
      const i = keyIndex(cam, op.t);
      const keys = cam.keys.slice();
      keys[i] = keyPatch(keys[i], op);
      if (op.to !== undefined) {
        if (!(Number.isFinite(op.to) && op.to >= 0)) throw new Error('`to` is the key\'s new time in seconds');
        if (keys.some((k, j) => j !== i && sameT(k.t, op.to))) throw new Error(`${cam.id}: a key already sits at ${op.to}s`);
        keys[i].t = op.to;
      }
      put({ ...cam, keys });
      return { plan: next, note: `set the ${cam.id} key at ${op.t}s${op.to !== undefined ? ` (moved to ${op.to}s)` : ''}` };
    }
    case 'remove_key': {
      const cam = cameraOf(next, op.camera);
      const i = keyIndex(cam, op.t);
      if (cam.keys.length === 1) throw new Error(`${cam.id}: its last key; remove_camera removes the camera`);
      put({ ...cam, keys: cam.keys.filter((_, j) => j !== i) });
      return { plan: next, note: `removed the ${cam.id} key at ${op.t}s` };
    }
    case 'ease': {
      const cam = cameraOf(next, op.camera);
      const times = op.times ?? (op.t !== undefined ? [op.t] : null);
      const idx = times ? times.map((t) => keyIndex(cam, t)) : cam.keys.map((_, i) => i);
      put({ ...cam, keys: cam.keys.map((k, i) => (idx.includes(i) ? { ...k, ease: op.ease } : k)) });
      return { plan: next, note: `${op.ease} on ${idx.length} ${cam.id} key(s)` };
    }
    case 'retime': {
      const scale = op.scale ?? 1, shift = op.shift ?? 0;
      if (!(Number.isFinite(scale) && scale > 0) || !Number.isFinite(shift)) throw new Error('retime takes scale (> 0) and/or shift (seconds)');
      const ids = op.camera ? [cameraOf(next, op.camera).id] : next.cameras.map((c) => c.id);
      const at = (t) => Math.max(0, t * scale + shift);
      next.cameras = next.cameras.map((c) => (ids.includes(c.id) ? { ...c, keys: c.keys.map((k) => ({ ...k, t: at(k.t) })) } : c));
      next.shots = next.shots.map((s) => (ids.includes(s.camera) ? { ...s, span: [at(s.span[0]), at(s.span[1])] } : s));
      return { plan: next, note: `retimed ${op.camera || 'every camera'} ×${scale}${shift ? ` ${shift > 0 ? '+' : ''}${shift}s` : ''}` };
    }
    case 'add_shot': {
      if (!op.shot || typeof op.shot !== 'object') throw new Error('add_shot needs { shot: { name?, camera, span: [t0, t1] }, at? }');
      cameraOf(next, op.shot.camera);
      const at = Number.isInteger(op.at) ? Math.max(0, Math.min(next.shots.length, op.at)) : next.shots.length;
      next.shots.splice(at, 0, op.shot);
      return { plan: next, note: `added shot ${op.shot.name || '#' + (at + 1)}` };
    }
    case 'set_shot': {
      const i = shotIndex(next, op.shot);
      const s = { ...next.shots[i] };
      if (op.name !== undefined) s.name = op.name;
      if (op.camera !== undefined) { cameraOf(next, op.camera); s.camera = op.camera; }
      if (op.span !== undefined) s.span = op.span;
      if (op.in !== undefined) { if (op.in === null || op.in === 'cut') delete s.in; else s.in = op.in; }
      if (op.on !== undefined) { if (op.on === null || (Array.isArray(op.on) && !op.on.length)) delete s.cue; else s.cue = op.on; }
      next.shots[i] = s;
      return { plan: next, note: `set shot ${s.name}` };
    }
    case 'remove_shot': {
      const i = shotIndex(next, op.shot);
      const [gone] = next.shots.splice(i, 1);
      return { plan: next, note: `removed shot ${gone.name}` };
    }
    case 'move_shot': {
      const i = shotIndex(next, op.shot);
      const [s] = next.shots.splice(i, 1);
      next.shots.splice(Math.max(0, Math.min(next.shots.length, op.to | 0)), 0, s);
      return { plan: next, note: `moved shot ${s.name} to ${op.to | 0}` };
    }
    case 'add_piece': {
      if (!op.piece || typeof op.piece !== 'object') throw new Error("add_piece needs { piece: { kind: 'wall' | 'floor' | 'ceiling' | 'pipe' | 'frame', attach?, keys } }");
      if (op.piece.attach && op.piece.attach !== 'world') cameraOf(next, op.piece.attach);
      if (op.piece.id && (next.pieces || []).some((p) => p.id === op.piece.id)) throw new Error(`a piece '${op.piece.id}' exists; set_piece edits it`);
      next.pieces = [...(next.pieces || []), op.piece];
      return { plan: next, note: `added ${op.piece.kind} ${op.piece.id || ''}`.trim() };
    }
    case 'set_piece': {
      const i = pieceIndex(next, op.piece);
      const { op: _op, piece, ...fields } = op;
      if (fields.attach && fields.attach !== 'world') cameraOf(next, fields.attach);
      next.pieces[i] = { ...next.pieces[i], ...fields };
      return { plan: next, note: `set piece ${op.piece}` };
    }
    case 'piece_key': {
      const i = pieceIndex(next, op.piece);
      if (!op.key || typeof op.key !== 'object') throw new Error('piece_key needs { piece, key: { t, at?, rot?, scale?, opacity?, open?, ease? } }');
      const p = next.pieces[i];
      const at = Number.isFinite(op.key.t) ? p.keys.findIndex((k) => sameT(k.t, op.key.t)) : -1;
      const keys = p.keys.slice();
      if (at >= 0) keys[at] = { ...keys[at], ...op.key }; else keys.push(op.key);
      next.pieces[i] = { ...p, keys };
      return { plan: next, note: `${at >= 0 ? 'set' : 'added'} the ${p.id} key at ${op.key.t ?? '?'}s` };
    }
    case 'remove_piece': {
      const i = pieceIndex(next, op.piece);
      next.pieces = next.pieces.filter((_, j) => j !== i);
      return { plan: next, note: `removed piece ${op.piece}` };
    }
    case 'set': {
      if (op.fps !== undefined) next.fps = op.fps;
      return { plan: next, note: `set fps ${next.fps}` };
    }
    default: throw new Error(`unknown op '${op.op}'`);
  }
}
