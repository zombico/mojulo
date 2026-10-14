/**
 * LEVEL EQUIVALENCE — one level played by a script in the web runtime (level-sim.js) and in the Godot kernel
 * (scripts/godot-level-sim.gd), at the same fixed step, compared frame by frame. The hollow-game catcher: a level that
 * imports clean and runs can still not be the game, and only playing it in both says so.
 *
 * The script is INPUT, never outcome. A WIN script is steered once here, in the web runtime, toward the goal's own
 * anchors (the contract's audits: a walkto's via points then its target, round again for laps; an idle's seconds),
 * and recorded as the pilot's held input, frame by frame; the Godot twin replays exactly that input. The STAY-PUT
 * control holds no input at all, for as long. Both engines print one canonical KEY a frame (frameKey here, level.gd
 * sim_key there):
 *
 *   <hashState of the bus> | <pilot> | <each ruled entity>      an entity: id:x,y,z,h in quanta
 *
 * TOLERANCE: positions are quantized to POS_Q (5 cm) and headings to HEAD_Q (0.05 rad), both in the recipe's z-up
 * frame, a position as its FEET (the walk rule's pos stands its eye above them). Two frames are equal when their keys
 * are equal; the bus half is exact (the reducers are held equal by the conformance corpus), the transform half is
 * equal within a quantum. A position on a quantum's edge can flip between engines whose numbers differ in the last
 * bits; the matrix reports the first unequal frame and the field, so such a flip is read for what it is.
 *
 *   SIM_DT, POS_Q, HEAD_Q
 *   faceGround(faces)                 → (pos) => z | null   the page's ground hook (channels/controllable __ground): the
 *                                       nearest face straight below pos + 0.05, over the payload's faces
 *   levelSim(payload)                 → simLevel(...) with the page's ground and colliders
 *   keyEntities(payload)              → [id]   the entities a key carries: the pilot first, then every one with a rule
 *   frameKey(sim, ids)                → string
 *   winScript(payload, { seconds })   → { frames: [input], keys: [key], outcome, at }   steered and recorded
 *   playScript(payload, frames, { onFrame?, params? }) → { keys, outcome, at, envelope, door }   replayed (stay-put:
 *                                       frames of {}); onFrame(sim, i) reads the world after each frame (its camera, say);
 *                                       params: the session's (a door's __entry, an arrive, carried chapters)
 *   gameChannel(contract, params)     → the page's game channel over a run (the envelope it would send, the door taken)
 *   outcomeIn(contract, log, from)    → 'success' | 'fail' | null   the contract's `on` over the bus log's delta, as
 *                                       the page's game channel reads it
 *   compareKeys(a, b)                 → { equal, frames, first: { frame, web, godot, field } | null }
 *   keyDrift(a, b)                    → { busFrames, maxQ, at }   how far apart, at worst, over the whole run
 *
 * Deterministic: a fixed step, the bus's own order, the world's seeded rules, the steering a pure function of state.
 */
import { simLevel } from './level-sim.js';
import { hashState } from '../worlds/event-bus.js';

export const SIM_DT = 1 / 30;
export const POS_Q = 0.05;
export const HEAD_Q = 0.05;
const TAU = Math.PI * 2;

// ── the ground: the page's raycast, over the payload's faces ─────────────────────────────────────────────────────────
const CELL = 4;
export function faceGround(faces = []) {
  const grid = new Map();
  const tris = [];
  for (const f of faces) {
    const c = f && Array.isArray(f.corners) ? f.corners : null;
    if (!c || c.length < 3) continue;
    for (let i = 1; i + 1 < c.length; i++) {
      const t = [c[0], c[i], c[i + 1]];
      if (!t.every((p) => Array.isArray(p) && p.length >= 3 && p.every(Number.isFinite))) continue;
      const k = tris.length;
      tris.push(t);
      const x0 = Math.floor(Math.min(t[0][0], t[1][0], t[2][0]) / CELL), x1 = Math.floor(Math.max(t[0][0], t[1][0], t[2][0]) / CELL);
      const y0 = Math.floor(Math.min(t[0][1], t[1][1], t[2][1]) / CELL), y1 = Math.floor(Math.max(t[0][1], t[1][1], t[2][1]) / CELL);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const key = `${x},${y}`; (grid.get(key) || grid.set(key, []).get(key)).push(k); }
    }
  }
  // the height of triangle t over (x, y), or null when (x, y) is outside it (barycentric, edges included)
  const heightIn = (t, x, y) => {
    const [a, b, c] = t;
    const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(d) < 1e-12) return null;
    const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d;
    const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d;
    const w = 1 - u - v, e = -1e-9;
    if (u < e || v < e || w < e) return null;
    return u * a[2] + v * b[2] + w * c[2];
  };
  return (pos) => {
    const x = pos[0], y = pos[1], top = pos[2] + 0.05;
    const list = grid.get(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`);
    if (!list) return null;
    let best = null;
    for (const k of list) {
      const z = heightIn(tris[k], x, y);
      if (z != null && z <= top && (best == null || z > best)) best = z;
    }
    return best;
  };
}

export function levelSim(payload) {
  return simLevel({ entities: payload.entities || [], events: payload.events || {}, colliders: payload.colliders, camera: payload.camera }, { ground: faceGround(payload.faces), beat: payload.audio?.beat || null, powers: payload.game?.powers || null });
}

// an input frame's `keys` ([the key as the page names it]) are what the page's key listener turns into bus events:
// every events.inputs on 'key' bound to it (or to any key) emits, in the frame it was pressed (kernel/level.gd press_key)
export function keyEvents(payload, keys = []) {
  const inputs = (payload.events && payload.events.inputs) || [];
  const out = [];
  for (const key of keys) for (const i of inputs) if (i && i.on === 'key' && i.emit && (typeof i.key !== 'string' || i.key === '' || i.key === key)) out.push(JSON.parse(JSON.stringify(i.emit)));
  return out;
}

// ── the key ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const pilotOf = (payload) => (payload.entities || []).find((e) => e && e.pilotable === true)?.id
  ?? (payload.entities || []).find((e) => e?.rule?.type === 'walk' || e?.rule?.type === 'platform')?.id ?? null;

export function keyEntities(payload) {
  const pilot = pilotOf(payload);
  const ruled = (payload.entities || []).filter((e) => e && typeof e.id === 'string' && e.id !== pilot && !e.isCamera && e.rule && typeof e.rule.type === 'string').map((e) => e.id).sort();
  return [...(pilot ? [pilot] : []), ...ruled];
}

// half up, as GDScript's floor(x + 0.5) rounds (Math.round agrees for positives, not for negative halves)
const q = (v, k) => Math.floor(v / k + 0.5);
const qh = (h) => q((((h % TAU) + TAU) % TAU), HEAD_Q);
const feetOf = (e) => (e.rule && Number.isFinite(e.rule.eye) ? e.rule.eye : 0);

export function frameKey(sim, ids) {
  const parts = [hashState(sim.bus)];
  for (const id of ids) {
    const e = sim.world.byId[id];
    if (!e) { parts.push(`${id}:none`); continue; }
    const p = e.transform.pos;
    parts.push(`${id}:${q(p[0], POS_Q)},${q(p[1], POS_Q)},${q(p[2] - feetOf(e), POS_Q)},${qh(e.transform.heading || 0)}`);
  }
  return parts.join('|');
}

// ── the outcome, as the page's game channel hears it ─────────────────────────────────────────────────────────────────
const glob = (s, pat) => (pat === '*' ? true : pat.indexOf('*') < 0 ? String(s) === pat
  : new RegExp(`^${pat.split('*').map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(String(s)));
export function outcomeIn(contract, log, from = 0) {
  const on = contract && contract.on ? contract.on : {};
  for (let i = from; i < log.length; i++) {
    const ev = log[i];
    if (!ev || !ev.type) continue;
    for (const pat of Object.keys(on)) {
      if (!glob(ev.type, pat)) continue;
      if (on[pat] && on[pat].end) return on[pat].end;
      break;
    }
  }
  return null;
}

// ── the game channel, as the page runs it (channels/game.js) ────────────────────────────────────────────────────────
/** The level's side of the game shell over a run: at start, the door it was entered by (the pilot at that door's spawn,
 * facing in), the chapters carried in and the level arrived from (heard on the first frame); each frame, the contract's
 * `on` over the bus log's delta (an emit gathered, with `{event}` named; an end with its exit; a door left by, once),
 * nothing more once it has ended. → { start(sim) → [events], hear(log, from), envelope, door } */
export function gameChannel(contract = {}, params = {}) {
  const on = contract.on || {};
  const named = Object.values(on).some((a) => a && a.emit && Object.values(a.emit).includes('{event}'));
  const st = { events: [], ended: false, leaving: false, result: null, exit: null, door: null };
  return {
    start(sim) {
      const e = params.__entry, d = e && (contract.doors || []).find((x) => x.id === e.door);
      const P = sim.world.byId[sim.world.pilotId];
      if (d && P) { P.transform.pos = [d.spawn[0], d.spawn[1], d.spawn[2] + ((P.rule && P.rule.eye) || 0)]; P.transform.heading = d.heading; }
      const out = [];
      if (contract.chapters) { const s = params[contract.chapters.slice], flags = (s && s.flags) || {}; for (const c of contract.chapters.carried || []) if (flags[c.key]) out.push({ type: c.event }); }
      if (typeof params.arrive === 'string' && Array.isArray(contract.arrive) && contract.arrive.includes(params.arrive)) out.push({ type: `arrive:${params.arrive}` });
      return out;
    },
    hear(log, from = 0) {
      for (let i = from; i < log.length; i++) {
        const ev = log[i];
        if (!ev || !ev.type) continue;
        for (const pat of Object.keys(on)) {
          if (!glob(ev.type, pat)) continue;
          const act = on[pat];
          // as the page's: an emit and an end wait on nothing but the end; a door is left once
          if (act.emit) { if (!st.ended) { const o = JSON.parse(JSON.stringify(act.emit)); if (named) for (const k in o) if (o[k] === '{event}') o[k] = ev.type; st.events.push(o); } }
          else if (act.end) { if (!st.ended) { st.ended = true; st.result = act.end; if (typeof act.exit === 'string' && act.exit) st.exit = act.exit; } }
          else if (act.door) { if (!st.ended && !st.leaving) { st.leaving = true; st.door = act.door; } }
          break;
        }
      }
    },
    envelope(vars = {}) {
      if (!st.result) return null;
      const env = { result: st.result, events: st.events.slice(), ...(st.exit ? { exit: st.exit } : {}) };
      if (Array.isArray(contract.keep) && contract.keep.length) env.stats = { kept: contract.keep.map((k) => ({ label: k.label, value: Math.round((Number(vars[k.var]) || 0) * (k.scale || 1) * 1000) / 1000, best: k.best, ...(k.unit ? { unit: k.unit } : {}) })) };
      return env;
    },
    get door() { return st.door ? { door: st.door, events: st.events.slice() } : null; },
  };
}

// ── the win script: steer toward the audit's points, record the input ───────────────────────────────────────────────
const fwd = (h) => [Math.cos(h), Math.sin(h)];
const right = (h) => [Math.sin(h), -Math.cos(h)];
const wrapPi = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

/** The input that heads the pilot toward point p, by its rule's own way of moving. */
export function steer(e, p) {
  const r = e.rule || {}, t = e.transform;
  const dx = p[0] - t.pos[0], dy = p[1] - t.pos[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  if (r.move === 'world') {
    const my = r.moveYaw ?? Math.PI / 2, f = fwd(my), rt = right(my);
    return { forward: ux * f[0] + uy * f[1], strafe: ux * rt[0] + uy * rt[1] };
  }
  if (r.move === 'lane' && Array.isArray(r.lane) && r.lane.length >= 2) {
    const a = r.lane[0], b = r.lane[r.lane.length - 1];
    return { strafe: Math.sign(ux * (b[0] - a[0]) + uy * (b[1] - a[1])) || 1 };
  }
  const diff = wrapPi(Math.atan2(dy, dx) - (t.heading || 0));
  if ((r.turnMode ?? 'tank') !== 'tank') return { lookDX: Math.max(-200, Math.min(200, diff / (r.lookSens ?? 0.0025))), forward: Math.abs(diff) < 0.6 ? 1 : 0.3 };
  return { turn: Math.max(-1, Math.min(1, -diff * 2)), forward: Math.abs(diff) < 0.5 ? 1 : 0.25 };
}

const AXES = ['forward', 'strafe', 'turn', 'lookDX', 'lookDY', 'jump', 'jumpHeld', 'boost', 'fire', 'kneel'];
const r4 = (v) => Math.round(v * 1e4) / 1e4;
/** An input as recorded: its axes rounded to 1e-4 (the JSON both engines read), zeros left out; its keys as pressed. */
const clean = (inp) => ({ ...Object.fromEntries(AXES.filter((k) => inp[k]).map((k) => [k, r4(inp[k])]).filter(([, v]) => v)), ...(inp.keys && inp.keys.length ? { keys: inp.keys } : {}) });

function setInput(sim, inp) {
  for (const k of AXES) sim.input[k] = 0;
  for (const k of AXES) if (inp[k] !== undefined) sim.input[k] = inp[k];
}

/** The waypoints the contract's audits name, in order: a walkto's via then its target; none for an idle. */
export function auditPath(contract) {
  const pts = [];
  let idle = 0;
  for (const a of (contract && contract.audits) || []) {
    if (a.kind === 'walkto' && Array.isArray(a.target)) pts.push(...(Array.isArray(a.via) ? a.via : []), a.target);
    else if (a.kind === 'idle' && Number.isFinite(a.seconds)) idle = Math.max(idle, a.seconds);
  }
  return { points: pts, idle };
}

export function winScript(payload, { seconds = 120 } = {}) {
  const contract = payload.game || {};
  const { points, idle } = auditPath(contract);
  const sim = levelSim(payload), ids = keyEntities(payload), pilot = sim.world.byId[sim.world.pilotId];
  const frames = [], keys = [];
  let next = 0, outcome = null, at = null, best = Infinity, still = 0, hop = 0;
  const n = Math.round((points.length ? seconds : Math.max(idle + 2, 3)) / SIM_DT);
  for (let i = 0; i < n && !outcome; i++) {
    let inp = {};
    if (points.length && pilot) {
      const p = points[next % points.length], t = pilot.transform.pos, d = Math.hypot(p[0] - t[0], p[1] - t[1]);
      if (d < 1.2) { next++; best = Infinity; still = 0; }
      else {
        inp = steer(pilot, points[next % points.length]);
        // no progress for a second: a hop over what stands in the way
        if (d < best - 0.05) { best = d; still = 0; } else if (++still > 30) { hop = 6; still = 0; }
        if (hop > 0) { inp.jump = 1; inp.jumpHeld = 1; hop--; }
      }
    }
    const rec = clean(inp);
    setInput(sim, rec);
    const n0 = sim.bus.log.length;
    sim.frame(SIM_DT, keyEvents(payload, rec.keys));
    frames.push(rec);
    keys.push(frameKey(sim, ids));
    outcome = outcomeIn(contract, sim.bus.log, n0);
    if (outcome) at = i;
  }
  return { frames, keys, outcome, at, waypoints: points.length, idle };
}

export function playScript(payload, frames, { onFrame = null, params = null } = {}) {
  const contract = payload.game || {};
  const sim = levelSim(payload), ids = keyEntities(payload);
  const ch = gameChannel(contract, params || {});
  let first = ch.start(sim);
  const keys = [];
  let outcome = null, at = null;
  for (let i = 0; i < frames.length; i++) {
    setInput(sim, frames[i] || {});
    // a frame's presses to a scene playing (the page's Space, Esc, arrows, digits): { next, held, skip, move, pick }
    if ((frames[i] || {}).scene) sim.scene(frames[i].scene);
    const n0 = sim.bus.log.length;
    // the carried-in events on the first frame, a frame's keys, then its raw events (a menu pick as the page's menu sends
    // it: menu-pick:<menu>:<n>)
    sim.frame(SIM_DT, [...first, ...keyEvents(payload, (frames[i] || {}).keys), ...JSON.parse(JSON.stringify((frames[i] || {}).events || []))]);
    first = [];
    ch.hear(sim.bus.log, n0);
    keys.push(frameKey(sim, ids));
    if (onFrame) onFrame(sim, i);
    const o = outcomeIn(contract, sim.bus.log, n0);
    if (o && !outcome) { outcome = o; at = i; }
  }
  return { keys, outcome, at, envelope: ch.envelope(sim.bus.vars), door: ch.door };
}

/** How far two engines' keys drift over a run: the frames whose bus differs, and the largest gap of any entity's field in
 * quanta (positions in POS_Q, headings in HEAD_Q, a heading's wrap counted short). A run whose bus never parts and whose
 * entities stay within one quantum is equal but for a quantum's edge (the GLB's float32 faces under a float64 ground). */
export function keyDrift(web, godot) {
  const n = Math.min(web.length, godot.length);
  let busFrames = 0, maxQ = 0, at = null;
  const turn = Math.round((2 * Math.PI) / HEAD_Q);
  for (let i = 0; i < n; i++) {
    if (web[i] === godot[i]) continue;
    const a = web[i].split('|'), b = godot[i].split('|');
    if (a[0] !== b[0]) busFrames++;
    for (let j = 1; j < Math.max(a.length, b.length); j++) {
      const x = (a[j] || '').split(':'), y = (b[j] || '').split(':');
      if (x[1] === y[1]) continue;
      const u = (x[1] || '').split(',').map(Number), v = (y[1] || '').split(',').map(Number);
      if (u.length !== 4 || v.length !== 4 || ![...u, ...v].every(Number.isFinite)) { maxQ = Infinity; at ??= i; continue; }
      for (let k = 0; k < 4; k++) {
        let d = Math.abs(u[k] - v[k]);
        if (k === 3) d = Math.min(d, Math.abs(turn - d));
        if (d > maxQ) { maxQ = d; at = i; }
      }
    }
  }
  return { busFrames, maxQ, at };
}

/** Two engines' keys, frame by frame: equal over the shorter run, and the first frame they part with the field. */
export function compareKeys(web, godot) {
  const n = Math.min(web.length, godot.length);
  for (let i = 0; i < n; i++) {
    if (web[i] === godot[i]) continue;
    const a = web[i].split('|'), b = godot[i].split('|');
    const k = a.findIndex((x, j) => x !== b[j]);
    return { equal: false, frames: n, first: { frame: i, field: k === 0 ? 'bus' : (a[k] || b[k] || '').split(':')[0], web: a[k] ?? null, godot: b[k] ?? null } };
  }
  return { equal: n > 0 && web.length === godot.length, frames: n, first: null };
}
