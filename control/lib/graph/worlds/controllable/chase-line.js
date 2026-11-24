/**
 * chase-line.js — THE CHASE LINE: a set piece's way through a level, which holds the pilot while it runs it. The stick
 * is read along the line, never the camera: up runs down the line whichever way the camera faces (ahead of the hero
 * looking back at them, beside them, low behind), so a directed camera can turn round without the controls turning with
 * it. The body is kept inside the line's corridor by a soft wall; it is free across it, and may go back along it.
 *
 *   spec.chase: { lines: [{ id, path: [[x, y], …], half?, when?, marks?, cams?, pursuers? }] }
 *     path    the way, a polyline on the ground plane (2 to 64 points, metres)
 *     half    the corridor's half width (metres, 2.5): the body is held within it while the line holds it
 *     when    'enter' (the default): the line takes the pilot as it stands inside the corridor, past its start;
 *             'cue': only `chaseStart(state, id)` starts it (a set piece's beat, the bus, the page)
 *     marks   [{ at, id }]: metres along it where the bus hears `chase:<line>:<mark>` as the pilot passes (a set piece's
 *             beats wait on them); passed again after the pilot is put back behind one
 *     pursuers [{ id, gap?, catch?, pace?, speed?, back? }]: bodies of the level run along the line behind the pilot while it
 *             holds it, `gap` metres back (7) behind a pilot who runs faster than their `pace` (4.5 m/s), closing on one who
 *             does not (no faster than `speed`, 9 m/s); within `catch` (1.2) the pilot is caught: the bus hears `chase:<line>:caught` and the pilot is put
 *             back `back` metres (12) down the line, the pursuers their gap behind it
 *     cams    the track camera's keys [{ s, frame, … }] (below): the camera is directed along the line while it holds the
 *             pilot, and the level's own camera given back, looking down the line, as it ends
 *
 *   state.chase: { lines, on: id | null, s, offset, u, done: [id] }   where the pilot is along the line holding it:
 *            `s` metres along, `offset` across (+ to its left), `u` the share of its length (0 … 1)
 *   chaseStart(state, id) · chaseEnd(state, id)   start or end a line by name (true when it changed)
 *   chaseReset(state)     let the holding line go unended (taken again as the pilot stands in it)
 *
 * The frame: before each step the camera's yaw (`camYaw`, the world's `cameraYaw`) is set to the line's heading where
 * the pilot stands (eased round each joint), and the pilot moves in that frame (`move: 'camera'`: its rule's copy while
 * the line holds it; its own given back as it ends). A camera rule that reads `camYaw` follows the line too; one that
 * places itself (a set piece's `track`) does not read it. The line ends as the pilot reaches its end, or by name.
 *
 * The bus hears it (castFacts, wrapped): `chase:<id>:start`, `chase:<id>:end`, `chase:<id>:<mark>`, `chase:<id>:caught`.
 *
 *   readChase(raw)  → the spec, read (throws naming what it takes); outside the builder, never emitted
 *
 * Wraps stepWorld. Import-free inside the builder (the page runs its source via toString(), compose.js); emitted only
 * into a page whose world has chase lines, so every other page keeps every byte. Pure state: the same input runs the
 * same line.
 */
export const CHASE = Object.freeze({ half: 2.5, maxPoints: 64, maxLines: 8, joint: 2 });

const v2 = (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);

/** A world's chase lines, read (see the header). */
export function readChase(raw) {
  if (raw === undefined || raw === null || raw === false) return null;
  const lines = Array.isArray(raw) ? raw : raw && Array.isArray(raw.lines) ? raw.lines : null;
  if (!lines || !lines.length) throw new Error('chase: { lines: [{ id, path: [[x, y], …], half?, when? }] }');
  if (lines.length > CHASE.maxLines) throw new Error(`chase: at most ${CHASE.maxLines} lines`);
  const ids = new Set();
  return {
    lines: lines.map((L, i) => {
      const at = `chase.lines[${i}]`;
      if (!L || typeof L.id !== 'string' || !L.id) throw new Error(`${at}: an id`);
      if (ids.has(L.id)) throw new Error(`${at}: '${L.id}' twice`);
      ids.add(L.id);
      if (!Array.isArray(L.path) || L.path.length < 2 || L.path.length > CHASE.maxPoints || !L.path.every(v2)) throw new Error(`${at}: a path of 2 to ${CHASE.maxPoints} points [x, y]`);
      if (L.half != null && !(Number.isFinite(L.half) && L.half > 0.2 && L.half <= 50)) throw new Error(`${at}: half is a width 0.2–50 m`);
      if (L.when != null && L.when !== 'enter' && L.when !== 'cue') throw new Error(`${at}: when is 'enter' or 'cue'`);
      const marks = L.marks == null ? null : Array.isArray(L.marks) ? L.marks : 'bad';
      if (marks === 'bad' || (marks && !marks.every((m) => m && typeof m.id === 'string' && m.id && Number.isFinite(m.at) && m.at >= 0))) throw new Error(`${at}: marks are [{ at: metres along, id }]`);
      const cams = L.cams == null ? null : readTrackKeys(L.cams, `${at}.cams`);
      const pursuers = L.pursuers == null ? null : Array.isArray(L.pursuers) ? L.pursuers.map((q, j) => {
        const w = `${at}.pursuers[${j}]`;
        if (!q || typeof q.id !== 'string' || !q.id) throw new Error(`${w}: the id of a body the level stands`);
        for (const [k, lo, hi] of [['gap', 1, 60], ['catch', 0.2, 10], ['pace', 0.5, 30], ['speed', 1, 40], ['back', 0, 200]]) if (q[k] != null && !(Number.isFinite(q[k]) && q[k] >= lo && q[k] <= hi)) throw new Error(`${w}: ${k} is ${lo}–${hi}`);
        return { id: q.id, ...['gap', 'catch', 'pace', 'speed', 'back'].reduce((o, k) => (q[k] != null ? { ...o, [k]: q[k] } : o), {}) };
      }) : 'bad';
      if (pursuers === 'bad') throw new Error(`${at}: pursuers are [{ id, gap?, catch?, pace?, speed?, back? }]`);
      return { id: L.id, path: L.path.map((p) => [p[0], p[1]]), ...(L.half != null ? { half: L.half } : {}), ...(L.when === 'cue' ? { when: 'cue' } : {}),
        ...(marks && marks.length ? { marks: marks.map((m) => ({ at: m.at, id: m.id })).sort((a, b) => a.at - b.at) } : {}), ...(cams ? { cams } : {}), ...(pursuers && pursuers.length ? { pursuers } : {}) };
    }),
  };
}

/** The track camera's frame words (the builder's TRACK_FRAMES, said outside it for the readers). */
export const TRACK_FRAME_WORDS = Object.freeze(['lead', 'chase', 'profile', 'wide', 'low', 'over', 'overhead', 'close']);
const TRACK_DIALS = ['back', 'side', 'up', 'ahead', 'lookUp'];
/** A track camera's keys, read (throws naming what it takes). */
export function readTrackKeys(raw, at = 'keys') {
  if (!Array.isArray(raw) || !raw.length) throw new Error(`${at}: keys [{ s, frame, … }]`);
  return raw.map((k, i) => {
    const w = `${at}[${i}]`;
    if (!k || !Number.isFinite(k.s) || k.s < 0) throw new Error(`${w}: s is metres along the line`);
    if (!TRACK_FRAME_WORDS.includes(k.frame)) throw new Error(`${w}: frame is ${TRACK_FRAME_WORDS.join(' | ')}`);
    const out = { s: k.s, frame: k.frame };
    for (const d of TRACK_DIALS) if (k[d] != null) { if (!Number.isFinite(k[d])) throw new Error(`${w}: ${d} is metres`); out[d] = k[d]; }
    if (k.cut) out.cut = true;
    if (k.blend != null) { if (!(Number.isFinite(k.blend) && k.blend >= 0 && k.blend <= 30)) throw new Error(`${w}: blend is metres 0–30`); out.blend = k.blend; }
    if (k.fov != null) { if (!(Number.isFinite(k.fov) && k.fov >= 20 && k.fov <= 110)) throw new Error(`${w}: fov is degrees 20–110`); out.fov = k.fov; }
    if (k.shake != null) { if (!(Number.isFinite(k.shake) && k.shake >= 0 && k.shake <= 1)) throw new Error(`${w}: shake is 0 … 1`); out.shake = k.shake; }
    return out;
  }).sort((a, b) => a.s - b.s);
}

export function buildChaseLine(E) {
  const HALF = 2.5, JOINT = 2;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  // a line compiled: its segments, their headings and the distance along at each point
  function compile(L) {
    const P = L.path, segs = [];
    let s = 0;
    for (let i = 0; i + 1 < P.length; i++) {
      const ax = P[i][0], ay = P[i][1], dx = P[i + 1][0] - ax, dy = P[i + 1][1] - ay, len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      segs.push({ ax, ay, dx, dy, len, s0: s, yaw: Math.atan2(dy, dx) });
      s += len;
    }
    return { id: L.id, half: L.half || HALF, cue: L.when === 'cue', segs, len: s, marks: Array.isArray(L.marks) ? L.marks : [], cams: Array.isArray(L.cams) && L.cams.length ? L.cams : null, path: L.path, pursuers: Array.isArray(L.pursuers) ? L.pursuers : [] };
  }

  // where a point stands on a line: metres along, metres across (+ left), the nearest segment; `near` the s the body
  // was last at, so a line that doubles back is not jumped across
  function project(C, x, y, near) {
    let best = null;
    for (let i = 0; i < C.segs.length; i++) {
      const g = C.segs[i];
      const t = Math.max(0, Math.min(1, ((x - g.ax) * g.dx + (y - g.ay) * g.dy) / (g.len * g.len)));
      const px = g.ax + g.dx * t, py = g.ay + g.dy * t, d = Math.hypot(x - px, y - py), s = g.s0 + g.len * t;
      const cost = d + (near != null ? Math.max(0, Math.abs(s - near) - 4) * 0.5 : 0);
      if (!best || cost < best.cost - 1e-9) best = { cost, d, s, i, off: (g.dx * (y - g.ay) - g.dy * (x - g.ax)) / g.len };
    }
    return best;
  }

  // the point s metres along a line, `off` to its left
  function pointAt(C, s, off) {
    const S = C.segs;
    let i = 0;
    while (i + 1 < S.length && S[i + 1].s0 <= s) i++;
    const g = S[i], u = Math.max(0, Math.min(g.len, s - g.s0)) + (s < 0 && i === 0 ? s : 0) + (s > C.len && i === S.length - 1 ? s - C.len : 0);
    const tx = g.dx / g.len, ty = g.dy / g.len;
    return [g.ax + tx * u - ty * off, g.ay + ty * u + tx * off];
  }

  // the line's heading at s, eased from one segment's to the next over JOINT metres either side of a joint
  function yawAt(C, s) {
    const S = C.segs;
    let i = 0;
    while (i + 1 < S.length && S[i + 1].s0 <= s) i++;
    const g = S[i], into = s - g.s0, left = g.s0 + g.len - s;
    const r = Math.min(JOINT, g.len / 2);
    if (i + 1 < S.length && left < r) { const u = 0.5 * (1 - left / r); return g.yaw + wrap(S[i + 1].yaw - g.yaw) * u; }
    if (i > 0 && into < r) { const p = S[i - 1], u = 0.5 * (1 - into / r); return g.yaw + wrap(p.yaw - g.yaw) * u; }
    return g.yaw;
  }

  E.registerStateInit((state, spec) => {
    const K = spec && spec.chase;
    const lines = (K && Array.isArray(K.lines) ? K.lines : []).filter((L) => L && L.id && Array.isArray(L.path) && L.path.length >= 2).map(compile).filter((C) => C.len > 0);
    if (!lines.length) return;
    state.chase = { lines, on: null, s: 0, offset: 0, u: 0, done: [], rule: null, cam: null, mk: 0, pur: null, ps: null, ev: [] };
  });

  const lineOf = (K, id) => K.lines.find((C) => C.id === id) || null;

  function begin(state, C, at) {
    const K = state.chase, p = state.pilotId && state.byId[state.pilotId];
    if (!p) return false;
    if (K.on) end(state, K.on);
    K.on = C.id; K.s = at ? at.s : 0; K.offset = at ? at.off : 0; K.u = C.len > 0 ? K.s / C.len : 0;
    if (p.rule && p.rule.move !== 'camera') { K.rule = p.rule; p.rule = { ...p.rule, move: 'camera' }; }
    // its camera: the track along it, the level's own kept to give back (eased over from where it stands)
    const cam = state.camera;
    if (C.cams && cam) { K.cam = cam.rule; cam.rule = { type: 'track', target: p.id, path: C.path, keys: C.cams }; cam._tr = null; }
    K.mk = 0; while (K.mk < C.marks.length && C.marks[K.mk].at <= K.s) K.mk++;
    K.pur = {}; for (const q of C.pursuers) K.pur[q.id] = { s: K.s - (q.gap || 7), off: 0 };
    K.ps = K.s;
    K.ev.push('chase:' + C.id + ':start'); if (K.ev.length > 16) K.ev.shift();   // (read by the bus; a page without one drops the oldest)
    return true;
  }
  function end(state, id) {
    const K = state.chase, p = state.pilotId && state.byId[state.pilotId];
    if (!K || K.on !== id) return false;
    if (p && K.rule) p.rule = K.rule;
    const cam = state.camera, C = lineOf(K, id);
    if (K.cam && cam) { cam.rule = K.cam; cam._tr = null; if (C) cam.camYaw = yawAt(C, Math.min(K.s, C.len)); }
    K.rule = null; K.cam = null; K.on = null;
    if (K.done.indexOf(id) < 0) K.done.push(id);
    K.ev.push('chase:' + id + ':end'); if (K.ev.length > 16) K.ev.shift();
    return true;
  }
  E.chaseStart = (state, id) => { const K = state && state.chase, C = K && lineOf(K, id); return !!C && begin(state, C, null); };
  E.chaseEnd = (state, id) => end(state, id);
  // let the line go without ending it (a prompt missed, the hero put back at its checkpoint): taken again as the hero
  // stands in it, its marks past the hero heard again
  E.chaseReset = (state) => {
    const K = state && state.chase, p = K && state.pilotId && state.byId[state.pilotId];
    if (!K || !K.on) return false;
    if (p && K.rule) p.rule = K.rule;
    if (K.cam && state.camera) { state.camera.rule = K.cam; state.camera._tr = null; }
    K.rule = null; K.cam = null; K.on = null;
    return true;
  };

  const step = E.stepWorld;
  E.stepWorld = function stepWithChase(state, input, dt, hooks) {
    const K = state.chase, p = K && state.pilotId ? state.byId[state.pilotId] : null;
    if (!K || !p || p.gone) return step(state, input, dt, hooks);
    const pos = p.transform.pos;
    // a line takes the pilot standing inside its corridor, past its start and short of its end
    if (!K.on) {
      for (const C of K.lines) {
        if (C.cue || K.done.indexOf(C.id) >= 0) continue;
        const at = project(C, pos[0], pos[1], null);
        if (at && Math.abs(at.off) <= C.half && at.s > 1e-3 && at.s < C.len - 0.5) { begin(state, C, at); break; }
      }
    }
    const C = K.on ? lineOf(K, K.on) : null;
    if (C && state.camera) state.camera.camYaw = yawAt(C, K.s);
    const out = step(state, input, dt, hooks);
    if (C && K.on === C.id) {
      const pos = p.transform.pos;   // (read again: a rule may have stood the body somewhere new)
      const at = project(C, pos[0], pos[1], K.s);
      // the soft wall: past the corridor's edge, the body is set back on it and its way out of it stopped
      if (Math.abs(at.off) > C.half) {
        const g = C.segs[at.i], nx = -g.dy / g.len, ny = g.dx / g.len, over = at.off - Math.sign(at.off) * C.half;
        pos[0] -= nx * over; pos[1] -= ny * over;
        if (p.vel) { const vn = p.vel[0] * nx + p.vel[1] * ny; if (vn * at.off > 0) { p.vel[0] -= nx * vn; p.vel[1] -= ny * vn; } }
        at.off = Math.sign(at.off) * C.half;
      }
      // (its marks: each heard as the pilot passes it; re-armed once the pilot is put back behind it)
      while (K.mk > 0 && C.marks[K.mk - 1].at > at.s + 0.5) K.mk--;
      while (K.mk < C.marks.length && C.marks[K.mk].at <= at.s) { K.ev.push('chase:' + C.id + ':' + C.marks[K.mk].id); if (K.ev.length > 16) K.ev.shift(); K.mk++; }
      K.s = at.s; K.offset = at.off; K.u = C.len > 0 ? at.s / C.len : 0;
      // THE PURSUERS: each runs along the line its gap behind, closing when the pilot slows; within its catch, caught
      if (C.pursuers.length && dt > 0) {
        const vh = Math.max(0, (at.s - (K.ps != null ? K.ps : at.s)) / dt);
        let caught = false;
        for (const q of C.pursuers) {
          const e = state.byId[q.id], P = K.pur && K.pur[q.id];
          if (!e || !P || e.downed || e.gone) continue;
          // (never slower than its own pace: held to its gap behind a pilot who runs faster, closing on one who does not)
          const v = Math.min(q.speed || 9, Math.max(q.pace != null ? q.pace : 4.5, vh + 1.6 * (at.s - (q.gap || 7) - P.s)));
          P.s += v * dt; P.off += (at.off - P.off) * Math.min(1, dt * 2);
          const xy = pointAt(C, P.s, P.off), z0 = e.transform.pos[2], gz = hooks && hooks.ground ? hooks.ground([xy[0], xy[1], pos[2] + 2]) : null;
          e.transform.pos = [xy[0], xy[1], gz != null ? gz + ((e.rule && e.rule.eye) || 0) : z0];
          e.transform.heading = yawAt(C, Math.max(0, P.s));
          e.moving = v > 0.3; e.locomotion = 'forward'; e.gaitPhase = (e.gaitPhase || 0) + (v * dt) / 2.4;
          if (at.s - P.s < (q.catch || 1.2)) caught = q;
        }
        if (caught) {
          K.ev.push('chase:' + C.id + ':caught'); if (K.ev.length > 16) K.ev.shift();
          const back = Math.max(0, at.s - (caught.back != null ? caught.back : 12)), xy = pointAt(C, back, 0);
          pos[0] = xy[0]; pos[1] = xy[1];
          if (p.vel) { p.vel[0] = 0; p.vel[1] = 0; }
          for (const q of C.pursuers) if (K.pur[q.id]) { K.pur[q.id].s = back - (q.gap || 7); K.pur[q.id].off = 0; }
          K.s = back; K.ps = back; K.mk = 0; while (K.mk < C.marks.length && C.marks[K.mk].at <= back) K.mk++;
          return out;
        }
      }
      K.ps = at.s;
      if (at.s >= C.len - 1e-3) end(state, C.id);
    }
    return out;
  };

  // THE TRACK CAMERA (a camera rule: { type: 'track', target, path, keys, lerp?, turn? }): the camera directed by where the
  // target is along a line, while the player keeps the stick. `path` is the line's own (a set piece hands it the chase
  // line's); `keys` [{ s, frame, …dials, cut?, blend?, fov?, shake? }] in metres along it, each frame a place round the
  // target in the line's own frame (along it, across it to the left, up), and a look point ahead of it:
  //   back      metres behind the target along the line (negative: ahead of it, looking back)
  //   side      metres to the line's left (negative: right)
  //   up        metres over the target's feet
  //   ahead     the look point's metres along the line from the target (negative: behind it)
  //   lookUp    the look point's height over the feet
  // A frame word gives the dials (TRACK_FRAMES); a key's own dials override them. Between keys the dials run from one to
  // the next over the `blend` metres (4) before the next key's s; a `cut` key cuts there. The place is eased at `lerp`
  // (6/s) and snapped on a cut. The camera does not set `camYaw`: the stick is the chase line's. It publishes `track`:
  // { key, fov?, shake? } for the page (a key's field of view in degrees, its shake 0 … 1).
  const FR = {
    lead: { back: -6.5, side: 0.8, up: 1.7, ahead: -3, lookUp: 1.3 },     // ahead of the hero, looking back at them and what is behind
    chase: { back: 4.2, side: 0.6, up: 0.9, ahead: 7, lookUp: 1.5 },      // low behind, the hero and what they run at
    profile: { back: 0.5, side: 6, up: 1.4, ahead: 1.5, lookUp: 1.2 },    // beside, tracking with them
    wide: { back: 10, side: 7, up: 6, ahead: 5, lookUp: 1 },              // far and high: the place and the hero in it
    low: { back: -1, side: 3.2, up: 0.3, ahead: 0.5, lookUp: 1.7 },       // under them, looking up as they go over
    over: { back: 3, side: 0.7, up: 2, ahead: 10, lookUp: 1.5 },          // over the shoulder down the way
    overhead: { back: 1.5, side: 0, up: 13, ahead: 1, lookUp: 0 },        // straight down on them
    close: { back: -1.8, side: 0.6, up: 1.6, ahead: 0, lookUp: 1.55 },    // the face, from in front
  };
  const DIALS = ['back', 'side', 'up', 'ahead', 'lookUp'];
  const smooth01 = (u) => u * u * (3 - 2 * u);
  const dialsOf = (k) => { const f = FR[k.frame] || FR.chase, o = {}; for (const d of DIALS) o[d] = typeof k[d] === 'number' ? k[d] : f[d]; return o; };
  function track(e, input, dt, world) {
    const r = e.rule, tgt = world.byId[r.target];
    if (!tgt || !Array.isArray(r.path) || r.path.length < 2 || !Array.isArray(r.keys) || !r.keys.length) return;
    if (!e._tr) e._tr = { C: compile({ id: '_track', path: r.path }), keys: r.keys.slice().sort((a, b) => (a.s || 0) - (b.s || 0)), s: null, key: -1 };
    const T = e._tr, C = T.C, p = tgt.transform.pos, at = project(C, p[0], p[1], T.s);
    T.s = at.s;
    // which key holds, and how far into the run to the next
    let i = 0;
    while (i + 1 < T.keys.length && (T.keys[i + 1].s || 0) <= at.s) i++;
    const K0 = T.keys[i], K1 = T.keys[i + 1], d0 = dialsOf(K0);
    let D = d0;
    if (K1 && !K1.cut) {
      const b = typeof K1.blend === 'number' ? K1.blend : 4, u = b > 0 ? Math.max(0, Math.min(1, (at.s - ((K1.s || 0) - b)) / b)) : 0;
      if (u > 0) {
        // the place swings round the target (its angle and its distance in the line's frame, the short way round), so a
        // chase camera going round to lead orbits the hero and never passes through them; the rest of the dials run
        const d1 = dialsOf(K1), w = smooth01(u), a0 = Math.atan2(d0.side, -d0.back), a1 = Math.atan2(d1.side, -d1.back);
        const r0 = Math.hypot(d0.back, d0.side), r1 = Math.hypot(d1.back, d1.side), a = a0 + wrap(a1 - a0) * w, rr = r0 + (r1 - r0) * w;
        D = {};
        for (const d of DIALS) D[d] = d0[d] + (d1[d] - d0[d]) * w;
        D.back = -Math.cos(a) * rr; D.side = Math.sin(a) * rr;
      }
    }
    const cut = i !== T.key && T.key >= 0 && !!K0.cut;
    T.key = i;
    // the line's frame where the target stands: along it, its left, up
    // (the camera's own heading of the line, eased at `turn` (3/s) round a corner, so a camera far from the hero is not
    // flung round as the line turns; cut to on a cut)
    const yl = yawAt(C, at.s);
    if (T.yaw == null || cut) T.yaw = yl;
    else T.yaw += wrap(yl - T.yaw) * (1 - Math.exp(-(typeof r.turn === 'number' ? r.turn : 3) * (dt || 0)));
    const yaw = T.yaw, tx = Math.cos(yaw), ty = Math.sin(yaw), nx = -ty, ny = tx;
    const want = [p[0] - tx * D.back + nx * D.side, p[1] - ty * D.back + ny * D.side, p[2] + D.up];
    const look = [p[0] + tx * D.ahead, p[1] + ty * D.ahead, p[2] + D.lookUp];
    const snap = cut || !e._trPlaced;
    const k = snap ? 1 : 1 - Math.exp(-(typeof r.lerp === 'number' ? r.lerp : 6) * (dt || 0));
    const cp = e.transform.pos;
    e.transform.pos = [cp[0] + (want[0] - cp[0]) * k, cp[1] + (want[1] - cp[1]) * k, cp[2] + (want[2] - cp[2]) * k];
    e._trPlaced = true;
    e.lookAt = look;
    e.transform.heading = Math.atan2(look[1] - e.transform.pos[1], look[0] - e.transform.pos[0]);
    e.track = { key: i, ...(typeof K0.fov === 'number' ? { fov: K0.fov } : {}), ...(typeof K0.shake === 'number' ? { shake: K0.shake } : {}) };
  }
  Object.assign(E.RULES, { track });
  E.TRACK_FRAMES = FR;

  // the bus hears a line start and end (the castFacts the events channel reads)
  const baseFacts = E.castFacts;
  E.castFacts = function castFacts(state, prev) {
    const out = baseFacts(state, prev), K = state.chase;
    if (!K || !K.ev.length) return out;
    for (const type of K.ev) out.events.push({ type, entity: state.pilotId });
    K.ev.length = 0;
    return out;
  };
}
