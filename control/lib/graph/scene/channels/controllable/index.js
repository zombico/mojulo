import { b64, safeJson } from '../../emit-util.js';
import { packRigMesh } from '../../../figures/rig-bake.js';
import { emissionSource } from '../../../worlds/controllable/compose.js';
import { surfaceAt } from '../../../roads/surface.js';
import { commanderSource } from '../../../worlds/controllable/commander.js';
import { MSG_GAMEPAD as GAME_MSG_GAMEPAD, MSG_AI as GAME_MSG_AI, MSG_SEATS as GAME_MSG_SEATS } from '../../../game/level-contract.js';
import { hangarStepperBlock } from './hangar-menu.js';
import { projectileSmokeBlock } from './projectile-smoke.js';
import { suitShadowBlock } from './suit-shadows.js';
import { buildControlsKernel } from '../../../controls/controls-kernel.js';
import { vayoTrailScript } from '../vayo-trail.js';
import { knockFxScript } from '../knock-fx.js';
import { SCHEMES } from '../../../controls/schemes.js';
import { DEVICES } from '../../../controls/devices.js';
import { buildSeatsKernel } from '../../../controls/seats-kernel.js';
import { touchLayout, touchScript } from './touch.js';
import { runnerViewScript } from './runner-view.js';
import { followPullIn } from './follow-pull-in.js';
import { gunplayScript } from './gunplay-view.js';
import { specialsPaletteScript } from './specials-palette.js';
import { mergeableFigure, mergedFigureScript } from './merged-figure.js';
import { groundGridScript } from './ground-grid.js';
import { turretScript } from './turret-view.js';
import { boatWaterScript } from './boat-water.js';
import { castKitSource } from '../cast-rig.js';
import { MORPH_DECODE } from '../../../figures/morph-sparse.js';

// In-page script: the CONTROLLABLE channel — the unified "control a thing in a world" primitive
// (controllable-world.plan.md). One model (entities = transform + rule + body; the camera is an
// entity), one input snapshot, one per-frame step — superseding the bespoke walk/over-shoulder/orbit
// controllers. The model is the SAME code as the node engine, emitted via the composed builder
// sources (worlds/controllable/compose.js#emissionSource() — single source of truth, per-system
// since the S0 split, controllable-split.plan.md). When a camera entity is present it OWNS the
// camera (OrbitControls disabled), driven from the camera entity's transform each frame.
//
// Bodies (Phase 3): `mesh` (sphere/box, optional front marker so heading reads) and `none`. Input is
// mapped once here from keys/pointer to the normalized axes the pure rules consume. The `ground` hook
// raycasts the scene so `walk` entities follow terrain; `window.__mojCtrl` is exposed for headless
// verification (it can push input frames).

// figure-buffer pool: livery variants bake byte-identical part GEOMETRY (only the colour buffers
// differ) and identical pose curves, so a roster page serializes every pos/clip buffer twice —
// ~half the __FIG payload on an arena level. Emit each duplicated base64 string ONCE in __FIGPOOL
// and mark its uses `{__p:i}`; the page rehydrates the markers before any consumer runs. A figures
// map with no duplicated buffers pools nothing and the emission stays byte-identical to the
// unpooled form (the char-net contract).
function poolFigureBuffers(figures) {
  const counts = new Map();
  const scan = (v) => {
    if (typeof v === 'string') { if (v.length >= 256) counts.set(v, (counts.get(v) || 0) + 1); return; }
    if (v && typeof v === 'object') for (const k in v) scan(v[k]);
  };
  scan(figures);
  const idx = new Map();
  for (const [s, n] of counts) if (n >= 2) idx.set(s, idx.size);
  if (!idx.size) return { fig: figures, pool: [] };
  const rewrite = (v) => {
    if (typeof v === 'string') { const i = idx.get(v); return i === undefined ? v : { __p: i }; }
    if (Array.isArray(v)) return v.map(rewrite);
    if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = rewrite(v[k]); return o; }
    return v;
  };
  return { fig: rewrite(figures), pool: [...idx.keys()] };
}

// the page's figure bank, as the page reads it. A LAYERED figure (station-loft-rig packLayeredRig) is drawn part by
// part, each part carried by its bone: its skin's joints and weights (`jnt`, `wgt`, a quarter or more of a party's
// bank) are the engine exports' (scene-gltf.js reads them from the figure's own row), never read by the page, so they
// are left out of it; and its parts, packed as a triangle soup of float32 corners (a hero's body past 100,000 triangles),
// go to the page as unit rigs' do (rig-bake.js packRigMesh: the corners shared, the positions on a uint16 grid, read by
// __makeRigGroup's q branch), each part that carries nothing laid per corner the page reads (paint, a face's morphs,
// correctives, normals, metal). A skinned figure (`skin: true`, one mesh skinned in the page: __makeSkinGroup) keeps it
// all. And a figure byte-identical to one before it (a battle's foe slots, one sheet each) is emitted once and named
// again (`same`). A bank with none of these is returned as it came, so its page is byte for byte as before.
const PER_CORNER = ['uv', 'morph', 'corrective', 'nrm', 'tan', 'metal', 'q', 'spec', 'spec8'];
// A PART WITH ITS PAINT, ITS NORMALS AND ITS FACE (a realistic hero's: a corner a triangle, every number a float32), as
// the page reads it (`full: 1`): the corners that are the same corner are one (its place, its colour, its paint's place,
// its normal and its face's row all the same), the places on a uint16 grid over the part's own box as a unit rig's are
// (`q`, `o`, `s`, `idx`, `n`), the paint's places on one over their own range (`uq`, `uo`, `us`), the normals as signed
// bytes (`nq`), and the face's rows (figures/morph-sparse.js) named by the welded corners. Read by __makeRigGroup's q
// branch. What cannot be welded so (a face's rows not sparse, a count that does not agree) is returned as it came.
const FULL_KEYS = ['uv', 'nrm', 'morph'], FULL_ONLY = ['corrective', 'tan', 'metal', 'q', 'spec', 'spec8'];
function pageFullPart(rest) {
  const raw = (str) => { const b = Buffer.from(str, 'base64'); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
  const pos = new Float32Array(raw(rest.pos)), col = new Uint8Array(raw(rest.col)), nV = (pos.length / 3) | 0;
  const uv = rest.uv ? new Float32Array(raw(rest.uv)) : null, nrm = rest.nrm ? new Float32Array(raw(rest.nrm)) : null, M = rest.morph || null;
  if (!nV || col.length !== nV * 3 || (uv && uv.length !== nV * 2) || (nrm && nrm.length !== nV * 3) || (M && !M.z)) return rest;
  // each corner's face row (its unique row's number), or -1: two corners with different rows are never one
  const rowOf = new Int32Array(nV).fill(-1);
  let mI = null, mU = null;
  if (M) {
    mI = new Uint32Array(raw(M.i)); mU = M.z.wide ? new Uint32Array(raw(M.z.u)) : new Uint16Array(raw(M.z.u));
    if (mI.length !== M.z.r || mU.length !== M.z.r) return rest;
    for (let r = 0; r < mI.length; r++) { if (mI[r] >= nV) return rest; rowOf[mI[r]] = mU[r]; }
  }
  const box = (a, n, k) => { let lo = Infinity, hi = -Infinity; for (let i = k; i < a.length; i += n) { if (a[i] < lo) lo = a[i]; if (a[i] > hi) hi = a[i]; } return [lo, hi]; };
  const grid = (lo, hi) => Number((((hi - lo) / 65535) || 0).toPrecision(8)), r6 = (v) => Math.round(v * 1e6) / 1e6;
  const pb = [0, 1, 2].map((k) => box(pos, 3, k)), o = pb.map((b) => r6(b[0])), sp = pb.map((b) => grid(b[0], b[1]));
  const ub = uv ? [0, 1].map((k) => box(uv, 2, k)) : null, uo = ub ? ub.map((b) => r6(b[0])) : null, us = ub ? ub.map((b) => grid(b[0], b[1])) : null;
  const qz = (v, lo, st) => { if (!st) return 0; const q = Math.round((v - lo) / st); return q <= 0 ? 0 : q >= 65535 ? 65535 : q; };
  const n8 = (v) => { const q = Math.round(v * 127); return q < -127 ? -127 : q > 127 ? 127 : q; };
  const seen = new Map(), idx = new (nV > 65535 ? Uint32Array : Uint16Array)(nV), Q = [], C = [], UQ = [], NQ = [], rows = [];
  for (let i = 0; i < nV; i++) {
    const a = [qz(pos[3 * i], o[0], sp[0]), qz(pos[3 * i + 1], o[1], sp[1]), qz(pos[3 * i + 2], o[2], sp[2]), col[3 * i], col[3 * i + 1], col[3 * i + 2]];
    if (uv) a.push(qz(uv[2 * i], uo[0], us[0]), qz(uv[2 * i + 1], uo[1], us[1]));
    if (nrm) a.push(n8(nrm[3 * i]), n8(nrm[3 * i + 1]), n8(nrm[3 * i + 2]));
    a.push(rowOf[i]);
    const key = a.join(',');
    let u = seen.get(key);
    if (u === undefined) {
      u = seen.size; seen.set(key, u);
      Q.push(a[0], a[1], a[2]); C.push(a[3], a[4], a[5]);
      let k = 6; if (uv) { UQ.push(a[k], a[k + 1]); k += 2; } if (nrm) NQ.push(a[k], a[k + 1], a[k + 2]);
      rows.push(rowOf[i]);
    }
    idx[i] = u;
  }
  const n = seen.size;
  if (n > 65535 && !(idx instanceof Uint32Array)) return rest;
  const b64 = (t) => Buffer.from(t.buffer, t.byteOffset, t.byteLength).toString('base64');
  const { pos: _p, col: _c, uv: _u, nrm: _n, morph: _m, ...keep } = rest;
  const out = { ...keep, full: 1, q: b64(Uint16Array.from(Q)), o, s: sp, n, idx: b64(n > 65535 ? Uint32Array.from(idx) : (idx instanceof Uint16Array ? idx : Uint16Array.from(idx))), col: b64(Uint8Array.from(C)) };
  if (uv) Object.assign(out, { uq: b64(Uint16Array.from(UQ)), uo, us });
  if (nrm) out.nq = b64(Int8Array.from(NQ));
  if (M) {
    const at = [], ur = [];
    for (let u = 0; u < n; u++) if (rows[u] >= 0) { at.push(u); ur.push(rows[u]); }
    out.morph = { i: b64(Uint32Array.from(at)), s: M.s, z: { ...M.z, r: at.length, u: b64(M.z.wide ? Uint32Array.from(ur) : Uint16Array.from(ur)) } };
  }
  return out;
}
function pagePart(p) {
  if (!p || (p.jnt === undefined && p.wgt === undefined)) return p;
  const { jnt: _j, wgt: _w, ...rest } = p;
  // (a part that carries its paint's place, its normals or a face's rows and nothing else laid per corner: welded and
  // on a grid as well, pageFullPart below; one with a corrective, a tangent, a metal or a specular stays as it came)
  if (typeof rest.pos === 'string' && typeof rest.col === 'string' && FULL_ONLY.every((k) => rest[k] === undefined) && FULL_KEYS.some((k) => rest[k] !== undefined)) return pageFullPart(rest);
  if (typeof rest.pos !== 'string' || typeof rest.col !== 'string' || PER_CORNER.some((k) => rest[k] !== undefined)) return rest;
  const buf = (s) => Buffer.from(s, 'base64');
  const P = buf(rest.pos), C = buf(rest.col);
  // (the packer takes colours on [0, 1], as a bake hands them, and writes them back as bytes: k/255 returns k exactly)
  const positions = new Float32Array(P.buffer, P.byteOffset, P.byteLength / 4), bytes = new Uint8Array(C.buffer, C.byteOffset, C.byteLength);
  if (bytes.length !== positions.length) return rest;
  const colors = Float32Array.from(bytes, (k) => k / 255);
  const { pos: _p, col: _c, ...keep } = rest;
  return { ...keep, ...packRigMesh({ positions, colors }, rest.faces) };
}
// a layered figure's clip as the page reads it: its frames (`b`: per key, per bone, a quaternion and a head) on 16 bits,
// the quaternions over ±1 and the heads over the clip's own reach (its step about a tenth of a millimetre on a figure's
// clips, the decimals' own grain), the page decoding them to a Float32Array once (__unclip16) and indexing it as before.
// Identical clips (a figure's `leap` and `boost`) are then identical strings, and the bank's pool keeps one of each.
function pageClip(c) {
  if (!c || !Array.isArray(c.b) || !c.b.length || !c.b.every((v) => typeof v === 'number' && Number.isFinite(v))) return c;
  let reach = 0;
  for (let i = 0; i < c.b.length; i++) if (i % 7 >= 4) reach = Math.max(reach, Math.abs(c.b[i]));
  const step = Number(((reach || 1) / 32767).toPrecision(8));
  const q = new Int16Array(c.b.length);
  for (let i = 0; i < c.b.length; i++) {
    const v = i % 7 < 4 ? Math.round(c.b[i] * 32767) : Math.round(c.b[i] / step);
    q[i] = v > 32767 ? 32767 : v < -32767 ? -32767 : v;
  }
  return { ...c, b: { q16: Buffer.from(q.buffer).toString('base64'), s: step } };
}
const pageClips = (C) => (C && typeof C === 'object' ? Object.fromEntries(Object.entries(C).map(([n, c]) => [n, pageClip(c)])) : C);
export function pageFigures(figures) {
  const drop = (f) => !!f && f.rig === true && f.skin !== true && Array.isArray(f.parts) && f.parts.some((p) => p && (p.jnt !== undefined || p.wgt !== undefined));
  const out = {}, same = {}, seen = new Map();
  let changed = false;
  for (const [name, f] of Object.entries(figures)) {
    const g = drop(f) ? { ...f, parts: f.parts.map(pagePart), ...(f.clips ? { clips: pageClips(f.clips) } : {}), ...(f.acts ? { acts: pageClips(f.acts) } : {}) } : f;
    if (g !== f) changed = true;
    const key = g && typeof g === 'object' ? JSON.stringify(g) : null;
    if (key && key.length >= 4096 && seen.has(key)) { same[name] = seen.get(key); changed = true; continue; }
    if (key) seen.set(key, name);
    out[name] = g;
  }
  return changed ? { figs: out, same } : { figs: figures, same };
}

/** The page's seats (a world's `seats: { bodies, max?, join?, drop? }`): seat 1 is the player the world
 * already has, read through its own controller once it has one; seats 2 to N each a compact read of their own controller
 * through the pilot scheme, riding the frame's input as `input.seats` (worlds/controllable/core.js). A controller sits down
 * with any press (start is the shell's pause): the first to press is seat 1. A ring in the seat's colour stands under each
 * seated body, and a strip names who is in. Emitted only for a world with seats. */
function seatsScript(seats) {
  const bodies = Array.isArray(seats.bodies) ? seats.bodies.slice(0, 3) : [];
  const max = Math.max(1, Math.min(4, seats.max ?? bodies.length + 1, bodies.length + 1));
  return `// ── SEATS ──
const __SK = (${buildSeatsKernel.toString()})();
let __SEATS = __SK.newSeats({ max: ${max}, join: ${safeJson(seats.join === 'lobby' ? 'lobby' : 'drop-in')} });
const __SEAT_BODY = ${safeJson(bodies)};   // seat n's body: __SEAT_BODY[n - 2]; seat 1's is the world's pilot
const __seatPrev = {};
// any press of a controller sits it down: a key, a button, a stick pushed past half
function __seatFrame() {
  const f = { keyboard: { join: Object.keys(__held).some((k) => __held[k]) } }, ps = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]; if (!p || !p.connected) continue;
    f['pad:' + p.index] = { connected: true, join: p.buttons.some((b) => b && b.pressed) || p.axes.some((v) => Math.abs(v) > 0.5) };
  }
  for (const x of __SEATS.seats) if (!f[x.controller]) f[x.controller] = { connected: false };
  return f;
}
// a seat's input: its own controller through the pilot scheme (move, jump, fire, boost, kneel, tackle)
function __seatSnap(x) {
  const kb = x.controller === 'keyboard';
  let rd, g = null;
  if (kb) rd = (c) => __held[c];
  else { const ps = navigator.getGamepads ? navigator.getGamepads() : []; g = ps[+x.controller.slice(4)]; if (!g || !g.connected) return null; rd = __CTL.gamepadRead(g, __DEV); }
  const fam = kb ? 'keyboard' : 'gamepad', h = (a) => __CTL.held(__BIND, a, fam, rd);
  let mx, my;
  if (kb) { mx = __CTL.axis(__BIND, 'turnRight', 'turnLeft', 'keyboard', rd); my = __CTL.axis(__BIND, 'moveForward', 'moveBack', 'keyboard', rd); }
  else { const st = __padStick(g.axes[0] || 0, g.axes[1] || 0); mx = st[0]; my = -st[1]; }
  const P = __seatPrev[x.n] || (__seatPrev[x.n] = {}), jh = h('jump'), tk = h('tackle');
  const out = { forward: my, turn: __MOUSELOOK ? 0 : mx, strafe: __MOUSELOOK ? mx : 0, lift: (jh ? 1 : 0) - (h('kneel') ? 1 : 0), jump: jh && !P.jump ? 1 : 0, jumpHeld: jh ? 1 : 0, fire: h('fire') ? 1 : 0, boost: h('boost') ? 1 : 0, walk: h('walk') ? 1 : 0, kneel: h('kneel') ? 1 : 0, tackle: tk && !P.tackle ? 1 : 0 };
  P.jump = jh; P.tackle = tk;
  return out;
}
// the strip: who is in, in their colours; an empty seat says how to sit down
const __seatEl = document.createElement('div');
__seatEl.style.cssText = 'position:fixed;top:calc(8px + env(safe-area-inset-top, 0px));left:50%;transform:translateX(-50%);display:flex;gap:6px;font:600 12px system-ui,sans-serif;pointer-events:none;z-index:5';
document.body.appendChild(__seatEl);
let __seatSaid = '';
function __seatStrip() {
  const L = __world.seatLives, lives = (n) => (L ? (__world.seatPool === 'shared' ? L.shared : L[n]) : null);
  const said = __SEATS.seats.map((x) => x.n + (x.away ? 'a' : '') + ':' + lives(x.n)).join(',') + (L && __world.seatPool === 'shared' ? '/' + L.shared : '');
  if (said === __seatSaid) return;
  __seatSaid = said;
  // the shell (game-seats): who sits where, so its pause names the seat that opened it
  if (window.parent !== window) { try { window.parent.postMessage({ moj: '${GAME_MSG_SEATS}', seats: __SEATS.seats.map((x) => ({ n: x.n, label: x.label, color: x.color, controller: x.controller, away: x.away })) }, '*'); } catch (err) { /* opaque parent */ } }
  __seatEl.textContent = '';
  for (let n = 1; n <= __SEATS.max; n++) {
    const x = __SK.seat(__SEATS, n), c = document.createElement('span'), col = __SK.SEAT_COLORS[n - 1];
    c.style.cssText = 'padding:2px 8px;border-radius:10px;border:2px solid ' + col + ';color:' + (x ? '#fff' : col) + ';background:' + (x && !x.away ? col : 'rgba(0,0,0,.45)');
    const out = __world.seatOut && __world.seatOut[n];
    c.textContent = __SK.SEAT_LABELS[n - 1] + (x ? (out ? ' out' : x.away ? ' away' : '') + (L && !out && __world.seatPool !== 'shared' ? ' \u2665' + lives(n) : '') : ' press to join');
    __seatEl.appendChild(c);
  }
  // a shared pool: one count for every seat, after the chips
  if (L && __world.seatPool === 'shared') { const c = document.createElement('span'); c.style.cssText = 'padding:2px 8px;color:#fff'; c.textContent = '\u2665' + L.shared; __seatEl.appendChild(c); }
}
__seatStrip();
// the rings: a seat's colour under its body, on the ground it stands on
const __seatRing = {};
function __seatRings() {
  for (const x of __SEATS.seats) {
    const id = x.n === 1 ? __world.pilotId : __SEAT_BODY[x.n - 2], e = id && __world.byId[id];
    if (!e) continue;
    let r = __seatRing[x.n];
    if (!r) { r = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 40), new THREE.MeshBasicMaterial({ color: x.color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })); r.renderOrder = 2; scene.add(r); __seatRing[x.n] = r; }
    r.visible = !x.away && !e.gone;
    r.position.set(e.transform.pos[0], e.transform.pos[1], e.transform.pos[2] + 0.04);
  }
  for (const n in __seatRing) if (!__SK.seat(__SEATS, +n)) __seatRing[n].visible = false;
}
// no seat left playing (every seat out of lives): the level is lost, once
let __seatsEnded = false;
function __seatsOver() {
  if (__seatsEnded || !__world.seatsOver) return;
  __seatsEnded = true;
  if (window.__mojGame) window.__mojGame.end('fail', { pilot: __world.pilotId, seats: 'out of lives' });
}
function __withSeats(inp) {
  __SEATS = __SK.step(__SEATS, __seatFrame());
  const s1 = __SK.seat(__SEATS, 1);
  __seat1 = s1 ? s1.controller : null;
  const seats = {};
  for (const x of __SEATS.seats) if (x.n > 1 && !x.away) { const snap = __seatSnap(x); if (snap) seats[x.n] = snap; }
  __seatStrip();
  return { ...inp, seats };
}
window.__mojSeats = () => __SEATS;
window.__mojSeatRings = () => Object.keys(__seatRing).map((n) => ({ n: +n, color: '#' + __seatRing[n].material.color.getHexString(), visible: __seatRing[n].visible }));
`;
}

/**
 * The page's side of distortion (rupa, controllable/rupa.js): a block that keeps its shape (a plastic or cuttable
 * matter) and has taken a blow is drawn as its box (the runtime's, squashed or cut or not) subdivided where its marks
 * are. A dent is the law's own bowl, depth d·(1 − r²/a²), its rim d / 3 high out to 2a, no higher than half its radius
 * (a deep narrow channel pushes its volume aside along its length, not up at its mouth); a hole is dark through to the
 * far face, which petals out; a dish moves both faces, cos² across, no rim; a cut is a dark groove along its plane, a
 * slit through when it is through. The halves of a cut block wear its skin; a stripped plate rides its body down,
 * tipping away from the wall; a felling turns what it fells about its hinge (`state.rupa.fells`) until it lies. Rebuilt only when a block's `form` count moves, from state the runtime owns, so a
 * capture stays byte-identical.
 */
/**
 * The page's side of SCARS (rupa, controllable/rupa.js): cosmetic damage on a map that may not change. Each of the
 * runtime's marks (state.rupa.scars.marks) is painted once: a crater as a decal on the floor (a scorched bowl, the ring
 * of thrown soil out to three radii), a scorch, a chip or a dent on a wall's face, a round's pock; and the debris it
 * carries flies (a crater's clumps, spray and dust; a wall's spalled chips and dust), stepped on sim dt and seeded by
 * the mark, so a capture stays byte-identical. Nothing a walker meets changes. Emitted only when the world is scarred.
 */
export function scarsViewScript() {
  return `// scars (rupa): what blows would do, painted on a map that may not change
const __scarTex = (() => {
  const make = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); draw(g); const t = new THREE.CanvasTexture(c); return t; };
  const radial = (g, stops) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); for (const [o, col] of stops) r.addColorStop(o, col); g.fillStyle = r; g.fillRect(0, 0, 128, 128); };
  const rng = __clashRng(0x5ca7);
  return {
    crater: make((g) => radial(g, [[0, 'rgba(18,14,10,0.92)'], [0.22, 'rgba(40,30,20,0.85)'], [0.33, 'rgba(92,72,48,0.7)'], [0.6, 'rgba(120,96,66,0.35)'], [1, 'rgba(120,96,66,0)']])),
    scorch: make((g) => radial(g, [[0, 'rgba(10,9,8,0.85)'], [0.5, 'rgba(25,22,20,0.5)'], [1, 'rgba(30,28,26,0)']])),
    chip: make((g) => { radial(g, [[0, 'rgba(214,208,196,0.85)'], [0.35, 'rgba(160,154,144,0.5)'], [1, 'rgba(160,154,144,0)']]); g.fillStyle = 'rgba(60,56,50,0.6)'; for (let i = 0; i < 14; i++) { const a = rng() * 6.283, d = rng() * 46; g.fillRect(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 3, 3); } }),
    dent: make((g) => radial(g, [[0, 'rgba(255,255,255,0.25)'], [0.55, 'rgba(0,0,0,0.05)'], [0.8, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']])),
    pock: make((g) => radial(g, [[0, 'rgba(15,12,10,0.9)'], [0.4, 'rgba(60,52,44,0.5)'], [1, 'rgba(60,52,44,0)']])),
    puff: make((g) => radial(g, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']])),
  };
})();
const __scarDecals = [], __scarBits = [];
let __scarSeen = -1;
function __scarDecal(kind, at, normal, radius) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: __scarTex[kind] || __scarTex.scorch, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  const n = new THREE.Vector3(normal[0], normal[1], normal[2]);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  m.position.set(at[0] + n.x * 0.015, at[1] + n.y * 0.015, at[2] + n.z * 0.015); m.scale.setScalar(radius); m.raycast = function () {}; scene.add(m);
  __scarDecals.push(m);
  if (__scarDecals.length > 96) { const old = __scarDecals.shift(); scene.remove(old); old.geometry.dispose(); old.material.dispose(); }
}
// a bit of debris: a small box that falls; a dust billow (opts.dust) a soft sprite that rises, swells and thins
function __scarBit(at, vel, size, color, opts) {
  const dust = !!(opts && opts.dust);
  const m = dust ? new THREE.Sprite(new THREE.SpriteMaterial({ map: __scarTex.puff, color, transparent: true, opacity: 0.4, depthWrite: false }))
    : new THREE.Mesh(new THREE.BoxGeometry(size, size, size * 0.7), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
  if (dust) m.scale.setScalar(size);
  m.position.set(at[0], at[1], at[2]); m.raycast = function () {}; scene.add(m);
  __scarBits.push({ m, v: [...vel], born: __world.time, drag: opts && opts.drag || 0, dust, size, half: dust ? 0 : size / 2 });
}
function __updateScars(dt) {
  const S = __world.rupa && __world.rupa.scars;
  if (!S) return;
  const floor = __world.breakFloor || 0;
  for (const k of S.marks) {
    if (k.seq <= __scarSeen) continue;
    __scarSeen = k.seq;
    const ground = k.kind === 'crater' || k.kind === 'pock';
    __scarDecal(k.kind, ground ? [k.at[0], k.at[1], floor] : k.at, ground ? [0, 0, 1] : k.normal, ground ? (k.rim || k.radius) : k.radius);
    const d = k.debris;
    if (!d) continue;
    if (d.clumps) for (const c of d.clumps.slice(0, 30)) __scarBit(c.at, c.vel, Math.max(0.04, c.size * 0.6), 0x4a3a2a);
    if (d.spray) for (const p of d.spray.parcels.slice(0, 40)) __scarBit(p.at, p.vel, 0.05, 0x8a7458, { drag: d.spray.drag });
    if (d.pieces) for (const p of d.pieces) __scarBit(p.at, p.vel, Math.max(0.02, Math.min(...p.size)), 0x9a948a);
    const dust = d.cloud || d.dust;
    if (dust && dust.radius > 0.3) for (let i = 0; i < 5; i++) __scarBit([dust.at[0], dust.at[1], dust.at[2]], [(i - 2) * 0.3, ((i * 7) % 5 - 2) * 0.3, 0.4], Math.min(2.5, dust.radius) * 0.6, 0xb8b0a2, { dust: true, drag: 3 });
  }
  for (let i = __scarBits.length - 1; i >= 0; i--) {
    const q = __scarBits[i], age = __world.time - q.born;
    if (age > 5) { scene.remove(q.m); q.m.geometry.dispose(); q.m.material.dispose(); __scarBits.splice(i, 1); continue; }
    const k = 1 / (1 + q.drag * dt);
    q.v[0] *= k; q.v[1] *= k; q.v[2] = q.dust ? q.v[2] * k + 0.05 * dt : (q.v[2] - 9.8 * dt) * (q.drag ? k : 1);
    q.m.position.x += q.v[0] * dt; q.m.position.y += q.v[1] * dt; q.m.position.z += q.v[2] * dt;
    if (q.dust) { q.m.material.opacity = Math.max(0, 0.4 * (1 - age / 5)); q.m.scale.setScalar(q.size * (1 + age * 0.4)); continue; }
    if (q.m.position.z < floor + q.half) { q.m.position.z = floor + q.half; q.v[2] *= -0.2; q.v[0] *= 0.5; q.v[1] *= 0.5; }
    if (age > 3.5) q.m.material.opacity = Math.max(0, 1 - (age - 3.5) / 1.5);
  }
}
`;
}

/**
 * The page's side of GROUND (rupa, controllable/rupa.js: the land as a soil grid the physics digs). What the stage lays on
 * its land (every isekai group but its sky, water and trees: ground, trail, scree, cliff, its tufts and stones), and the
 * live grass on it (each blade by its root), sink and rise with the grid: the dug depth at each grid
 * point is a texture (two bytes a point, ±8 m), read in the land's vertex shader at the vertex's place and added to its
 * height, bilinear over the four points round it, so a crater opens in the very land drawn. The ground probe adds the
 * same depth where it lands on the land, so a walker stands in the crater. Read from the state the runtime owns: a
 * capture stays byte-identical. Emitted only when the world has ground.
 */
export function groundViewScript() {
  return `// ground (rupa): the land sinks and rises with the soil grid the physics digs
// (what the stage lays on its land rides it: every isekai group but its sky, its water and its trees' wood and leaves)
const __GND_OFF = ['isekai:cloud', 'isekai:water', 'isekai:wood', 'isekai:crown', 'isekai:blossom', 'isekai:core', 'isekai:chips', 'isekai:culm', 'isekai:leaves', 'isekai:petals'];
const __gndLand = (name) => name.indexOf('isekai:') === 0 && !__GND_OFF.some((g) => name === g || name.indexOf(g + '#') === 0 || name.indexOf(g + ':') === 0);
const __gndU = { uGround: { value: null }, uGroundBox: { value: new THREE.Vector3() }, uGroundSize: { value: new THREE.Vector2() } };
let __gndTex = null, __gndSeen = -1, __gndN = 0;
window.__mojGround = { patched: () => __gndN };
const __gndVS = 'uniform sampler2D uGround; uniform vec3 uGroundBox; uniform vec2 uGroundSize;\\n' +
  'float rupaGroundAt(vec2 ij) { vec4 t = texture2D(uGround, (ij + 0.5) / uGroundSize); return (t.r * 65280.0 + t.g * 255.0) / 65535.0 * 16.0 - 8.0; }\\n';
const __gndBody = '{\\n#ifdef USE_INSTANCING\\n vec2 gxy = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xy; float gs = max(length(instanceMatrix[2].xyz), 1e-4);\\n#else\\n vec2 gxy = (modelMatrix * vec4(transformed, 1.0)).xy; float gs = 1.0;\\n#endif\\n vec2 g = (gxy - uGroundBox.xy) / uGroundBox.z;\\n' +
  ' if (g.x >= 0.0 && g.y >= 0.0 && g.x <= uGroundSize.x - 1.0 && g.y <= uGroundSize.y - 1.0) { vec2 i0 = min(floor(g), uGroundSize - 2.0), f = g - i0;\\n' +
  ' transformed.z += mix(mix(rupaGroundAt(i0), rupaGroundAt(i0 + vec2(1.0, 0.0)), f.x), mix(rupaGroundAt(i0 + vec2(0.0, 1.0)), rupaGroundAt(i0 + vec2(1.0, 1.0)), f.x), f.y) / gs; } }';
function __gndPatch(mat) {
  if (!mat || mat.userData.__gnd) return;
  mat.userData.__gnd = true; __gndN++;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = function (sh, r) { if (prev) prev.call(this, sh, r); Object.assign(sh.uniforms, __gndU); sh.vertexShader = __gndVS + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\n' + __gndBody); };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.customProgramCacheKey = () => key() + '|rupa-ground';
  mat.needsUpdate = true;
}
function __updateGround() {
  const Gd = __world.rupa && __world.rupa.ground;
  if (!Gd) return;
  if (!__gndTex) {
    __gndTex = new THREE.DataTexture(new Uint8Array(Gd.nx * Gd.ny * 4), Gd.nx, Gd.ny, THREE.RGBAFormat);
    __gndTex.magFilter = __gndTex.minFilter = THREE.NearestFilter; __gndTex.needsUpdate = true;
    __gndU.uGround.value = __gndTex; __gndU.uGroundBox.value.set(Gd.x0, Gd.y0, Gd.dx); __gndU.uGroundSize.value.set(Gd.nx, Gd.ny);
    for (const name of Object.keys(meshes)) if (__gndLand(name)) { const m = meshes[name]; for (const mat of Array.isArray(m.material) ? m.material : [m.material]) __gndPatch(mat); }
  }
  // rain on the land: the weather's state now (its rate, mm/h, the physics' table), blended as the sky blends
  if (Gd.w && window.__mojWeather) { const a = window.__mojWeather.at(__world.time), RN = __CW.rupaRain || {}; __world.rupa.rain = (RN[a.is] || 0) * (1 - (a.mix || 0)) + (RN[a.next] || 0) * (a.mix || 0); }
  if (Gd.w) __updateWater(Gd);
  __updateDirt(Gd);
  if (Gd.version === __gndSeen) return;
  __gndSeen = Gd.version;
  // what grows on the land rides it: the live grass, its flowers and a carpet of petals (instanced: each blade by its root;
  // a tile laid since is patched as it comes)
  scene.traverse((o) => { if (o.isInstancedMesh && o.userData && /grass|flowers|carpet/.test(String(o.userData.g || ''))) for (const mat of Array.isArray(o.material) ? o.material : [o.material]) __gndPatch(mat); });
  const D = __gndTex.image.data;
  for (let k = 0; k < Gd.z.length; k++) { const u = Math.max(0, Math.min(65535, Math.round(((Gd.z[k] - Gd.z0[k] + 8) / 16) * 65535))); D[k * 4] = u >> 8; D[k * 4 + 1] = u & 255; }
  __gndTex.needsUpdate = true;
}
// the DIRT a crater throws (the runtime's dirt law on its own soil: clumps, spray and dust), flown on the world's clock
// and landing on the dug ground; the dust hangs, swells and thins
const __dirtBits = [], __dirtTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
let __dirtSeen = -1, __dirtT = null;
function __dirtBit(at, vel, size, color, dust, drag) {
  const m = dust ? new THREE.Sprite(new THREE.SpriteMaterial({ map: __dirtTex, color, transparent: true, opacity: 0.45, depthWrite: false }))
    : new THREE.Mesh(new THREE.BoxGeometry(size, size, size * 0.75), new THREE.MeshLambertMaterial({ color }));
  if (dust) m.scale.setScalar(size);
  m.position.set(at[0], at[1], at[2]); m.raycast = function () {}; scene.add(m);
  __dirtBits.push({ m, v: vel.slice(), born: __world.time, dust, size, drag: drag || 0, half: dust ? 0 : size / 2, landed: false });
}
function __updateDirt(Gd) {
  const P = __CW.rupaPhysics, R = __world.rupa;
  for (const c of R.craters || []) {
    if (c.seq <= __dirtSeen) continue;
    __dirtSeen = c.seq;
    const d = c.debris; if (!d) continue;
    for (const k of d.clumps.slice(0, 40)) __dirtBit(k.at, k.vel, Math.max(0.05, Math.min(0.5, k.size)), 0x5a4330, false, 0);
    for (const q of d.spray.parcels.slice(0, 48)) __dirtBit(q.at, q.vel, 0.06, 0x7a6248, false, d.spray.drag);
    if (d.cloud) for (let i = 0; i < 6; i++) __dirtBit([d.cloud.at[0] + (i - 2.5) * 0.4, d.cloud.at[1] + ((i * 7) % 5 - 2) * 0.4, d.cloud.at[2]], [((i * 3) % 5 - 2) * 0.2, ((i * 5) % 5 - 2) * 0.2, 0.3], Math.min(4, d.cloud.radius), 0xb3a58e, true, 1.5);
  }
  const t = __world.time, dt = __dirtT === null ? 0 : Math.max(0, Math.min(0.1, t - __dirtT));
  __dirtT = t;
  for (let i = __dirtBits.length - 1; i >= 0; i--) {
    const q = __dirtBits[i], age = t - q.born;
    if (age > 6) { scene.remove(q.m); q.m.geometry && q.m.geometry.dispose(); q.m.material.dispose(); __dirtBits.splice(i, 1); continue; }
    if (q.dust) { const k = 1 / (1 + q.drag * dt); q.v[0] *= k; q.v[1] *= k; q.v[2] *= k; q.m.position.x += q.v[0] * dt; q.m.position.y += q.v[1] * dt; q.m.position.z += q.v[2] * dt; q.m.scale.setScalar(q.size * (1 + age * 0.3)); q.m.material.opacity = Math.max(0, 0.45 * (1 - age / 6)); continue; }
    if (q.landed) { if (age > 4.5) q.m.material.transparent = true, q.m.material.opacity = Math.max(0, 1 - (age - 4.5) / 1.5); continue; }
    const k = 1 / (1 + q.drag * dt);
    q.v[0] *= k; q.v[1] *= k; q.v[2] = (q.v[2] - 9.81 * dt) * (q.drag ? k : 1);
    q.m.position.x += q.v[0] * dt; q.m.position.y += q.v[1] * dt; q.m.position.z += q.v[2] * dt;
    const g = P.groundZ(Gd, q.m.position.x, q.m.position.y);
    if (q.m.position.z < g + q.half) { q.m.position.z = g + q.half; q.landed = true; }
  }
}
// the WATER the physics moves (its lake and sea, rain, a flood through a broken levee): one mesh over the grid, its
// points lifted by the ground's dug depth and the water's own (the texture's last two bytes, 0 to 16 m), drawn only where
// the water is not as the stage drew it (new water, or the lake's or a running river's own where it moved 5 cm or more)
let __wMesh = null, __wSeen = -1;
function __updateWater(Gd) {
  if (!__wMesh) {
    const nx = Gd.nx, ny = Gd.ny, pos = new Float32Array(nx * ny * 3), idx = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; pos[k * 3] = Gd.x0 + i * Gd.dx; pos[k * 3 + 1] = Gd.y0 + j * Gd.dx; pos[k * 3 + 2] = Gd.z0[k]; }
    for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) { const a = j * nx + i; idx.push(a, a + 1, a + nx + 1, a, a + nx + 1, a + nx); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ color: 0x3f7896, transparent: true, opacity: 0.74, depthWrite: false });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, __gndU);
      sh.vertexShader = __gndVS + 'float rupaWaterAt(vec2 ij) { vec4 t = texture2D(uGround, (ij + 0.5) / uGroundSize); return (t.b * 65280.0 + t.a * 255.0) / 65535.0 * 16.0; }\\nvarying float vWater;\\n' +
        sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\n{ vec2 ij = floor((position.xy - uGroundBox.xy) / uGroundBox.z + 0.5); vWater = rupaWaterAt(ij); transformed.z += rupaGroundAt(ij) + vWater; }');
      sh.fragmentShader = 'varying float vWater;\\n' + sh.fragmentShader.replace('void main() {', 'void main() {\\n  if (vWater < 0.01) discard;');
    };
    __wMesh = new THREE.Mesh(geo, mat); __wMesh.renderOrder = 2; __wMesh.raycast = function () {}; __wMesh.frustumCulled = false; scene.add(__wMesh);
  }
  if (Gd.wVersion === __wSeen) return;
  __wSeen = Gd.wVersion;
  const D = __gndTex.image.data;
  for (let k = 0; k < Gd.w.length; k++) { const w = Gd.w[k], w0 = Gd.w0[k], show = Math.abs(w - w0) > 0.05 || (w0 <= 0 && w > 0.02) ? w : 0, u = Math.max(0, Math.min(65535, Math.round((show / 16) * 65535))); D[k * 4 + 2] = u >> 8; D[k * 4 + 3] = u & 255; }
  __gndTex.needsUpdate = true;
}
// the probe: where it lands on the land as drawn (the grid's first heights), the depth dug there
const __ground0 = __ground;
__ground = function (pos) {   // eslint-disable-line no-func-assign
  const g = __ground0(pos), Gd = __world.rupa && __world.rupa.ground;
  if (g === null || !Gd) return g;
  const P = __CW.rupaPhysics, base = P.groundZ(Gd, pos[0], pos[1], 'z0');
  return Math.abs(g - base) > 0.35 ? g : g + (P.groundZ(Gd, pos[0], pos[1]) - base);
};
`;
}

export function distortViewScript() {
  return `// distortion: blocks keep the shape their blows leave
const __dentDraw = {}, __dentLight = [0.35, -0.55, 0.76];
function __dentAt(b, ax, side, p, thick, hw) {
  let z = 0, hole = false, slot = false;
  const u = (ax + 1) % 3, v = (ax + 2) % 3, shell = !!b.rupa.wall;
  for (const q of b.rupa.dents) {
    if (q.ax !== ax) continue;
    const r = Math.hypot(p[u] - q.at[u], p[v] - q.at[v]);
    if (q.dish) {   // the panel moves: in on the struck face, out on the far one
      if (r < q.a) { const c = Math.cos((Math.PI * r) / (2 * q.a)); z += (q.side === side ? 1 : -1) * q.d * c * c; }
    } else if (q.side === side) {
      if (r < q.a) { z += q.d * (1 - (r * r) / (q.a * q.a)); if (q.hole && r < 0.7 * q.a) hole = true; }
      else if (r < 2 * q.a) { const s = Math.sin((Math.PI * (r - q.a)) / q.a); z -= Math.min(q.d / 3, q.a / 2) * s * s; }
    } else if (q.hole && !shell) {   // the far face of a hole: through in the core, petalled out round it
      if (r < 0.7 * q.a) hole = true;
      else if (r < 1.6 * q.a) z -= Math.min(q.d / 3, q.a / 2) * (1 - (r - 0.7 * q.a) / (0.9 * q.a));
    }
  }
  for (const c of b.rupa.cuts || []) {
    if (c.ax !== ax || Math.abs(p[c.n] - c.at) > hw) continue;
    if (c.side === side) { z = Math.max(z, Math.min(c.depth, 0.95 * thick)); slot = true; if (c.through) hole = true; }
    else if (c.through && !shell) hole = true;
  }
  if (hole) return { z: shell ? Math.min(thick / 2, 0.05) : thick / 2, hole };
  return { z: Math.min(z, 0.95 * thick), hole: slot };
}
function __dentMesh(b) {
  const id = b.skin || b.id, show = __breakPieces[id], own = meshes['break:' + id], tm = own && own.userData.tex && own.userData.tex[0], map = tm && tm.material.map;
  const skin = new THREE.Color(show ? show.fill : '#8a8f96').multiplyScalar(show && show.tex && !map ? 0.72 : 1);
  const c = [0, 1, 2].map((k) => (b.min[k] + b.max[k]) / 2), ext = [0, 1, 2].map((k) => b.max[k] - b.min[k]);
  const pos = [], col = [], uv = [];
  for (let ax = 0; ax < 3; ax++) for (const side of [-1, 1]) {
    const u = (ax + 1) % 3, v = (ax + 2) % 3, mine = b.rupa.dents.filter((q) => q.ax === ax && (q.side === side || q.hole || q.dish));
    const cuts = (b.rupa.cuts || []).filter((q) => q.ax === ax), floor = Math.max(Math.min(ext[u], ext[v]) / 48, 0.004);
    const fine = cuts.length ? floor : mine.length ? Math.max(floor, Math.min(...mine.map((q) => q.a)) / 3) : Infinity;
    const nu = Math.max(1, Math.min(48, Math.ceil(ext[u] / fine))), nv = Math.max(1, Math.min(48, Math.ceil(ext[v] / fine)));
    const hw = Math.max(0.002, ext[u] / nu, ext[v] / nv) * 0.75, dmax = Math.max(1e-3, ...mine.map((q) => q.d), ...cuts.map((q) => q.depth)), grid = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const p = [0, 0, 0];
      p[u] = b.min[u] + (ext[u] * i) / nu; p[v] = b.min[v] + (ext[v] * j) / nv; p[ax] = side > 0 ? b.max[ax] : b.min[ax];
      const t = [p[0], p[1], p[2]], D = mine.length || cuts.length ? __dentAt(b, ax, side, p, ext[ax], hw) : { z: 0, hole: false };
      p[ax] -= side * D.z;
      grid.push({ p: [p[0] - c[0], p[1] - c[1], p[2] - c[2]], uv: [t[u] / 1.2, t[v] / 1.2], z: D.z, hole: D.hole });
    }
    const at = (i, j) => grid[j * (nu + 1) + i];
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) for (const tri of [[at(i, j), at(i + 1, j), at(i + 1, j + 1)], [at(i, j), at(i + 1, j + 1), at(i, j + 1)]]) {
      const [A, B, C] = tri, e1 = [B.p[0] - A.p[0], B.p[1] - A.p[1], B.p[2] - A.p[2]], e2 = [C.p[0] - A.p[0], C.p[1] - A.p[1], C.p[2] - A.p[2]];
      let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const nl = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map((x) => x / nl);
      if (n[ax] * side < 0) n = n.map((x) => -x);
      // lit as the flat face is, its slopes by how far they turn from it (so an unmarked face reads as before and a
      // bowl reads by its walls), and darker toward the bottom of a bowl
      const flat = side * __dentLight[ax], turn = n[0] * __dentLight[0] + n[1] * __dentLight[1] + n[2] * __dentLight[2] - flat;
      const lit = Math.max(0.2, (map ? 0.95 : 0.55) + (map ? 0.3 : 0.45) * Math.max(0, flat) + 1.4 * turn);
      const deep = (A.z + B.z + C.z) / 3, k = (A.hole || B.hole || C.hole ? 0.18 : 1 - 0.45 * Math.min(1, Math.max(0, deep) / dmax)) * lit;
      for (const q of tri) { pos.push(q.p[0], q.p[1], q.p[2]); col.push(skin.r * k, skin.g * k, skin.b * k); uv.push(q.uv[0], q.uv[1]); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (map) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, ...(map ? { map } : {}) }));
  m.position.set(c[0], c[1], c[2]); m.raycast = function () {};
  if (own) { own.visible = false; for (const x of (own.userData.tex || [])) x.visible = false; }
  return { mesh: m, c, ext };
}
function __dentDrop(D) { scene.remove(D.mesh); D.mesh.geometry.dispose(); D.mesh.material.dispose(); }
function __updateDents() {
  for (const b of (__world.breakables || [])) {
    if (!b.rupa || !b.rupa.dents) continue;
    const id = b.id;
    let D = __dentDraw[id];
    if (b.broken && b.broken.how !== 'strip') { if (D && D.mesh.visible) D.mesh.visible = false; continue; }
    if (!b.broken && b.rupa.form && (!D || D.form !== b.rupa.form)) {
      if (D) __dentDrop(D);
      D = __dentDraw[id] = { ...__dentMesh(b), form: b.rupa.form };
      scene.add(D.mesh);
    }
    if (!b.broken) { if (D && b.fell == null) D.mesh.position.set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2); continue; }   // it rides its box: a falling half, a settling block
    // stripped: the plate rides its body, tipping away from the wall as it goes
    if (!D) { D = __dentDraw[id] = { ...__dentMesh(b), form: b.rupa.form }; scene.add(D.mesh); }
    if (!D.strip) { const br = (__world.breaks || []).find((x) => x.id === id && x.how === 'strip'); D.strip = { body: br && br.body, away: (br && br.away) || [0, 0, 0], t0: b.broken.t }; }
    const body = ((__world.rupa && __world.rupa.bodies) || []).find((x) => x.id === D.strip.body);
    if (!body) continue;
    const a = D.strip.away, th = Math.hypot(a[0], a[1]) > 0 ? Math.min(Math.PI / 2, (__world.time - D.strip.t0) * 3) : 0;
    const hz = D.ext[2] / 2, ht = (Math.abs(a[0]) * D.ext[0] + Math.abs(a[1]) * D.ext[1]) / 2;
    const floor = __world.breakFloor || 0, bottom = Math.max(floor, body.pos[2] - hz);
    D.mesh.position.set(body.pos[0], body.pos[1], bottom + hz * Math.cos(th) + ht * Math.sin(th));
    if (th > 0) D.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(-a[1], a[0], 0).normalize(), th);
  }
  // a felling: what is above the cut turns about its hinge as one body (its drawing, or the thing's own mesh)
  for (const f of ((__world.rupa && __world.rupa.fells) || [])) {
    if (f.done) continue;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-f.dir[1], f.dir[0], 0), f.theta), P = new THREE.Vector3(f.pivot[0], f.pivot[1], f.pivot[2]);
    for (const id of f.ids) {
      const D = __dentDraw[id];
      if (D) { D.mesh.position.set(D.c[0], D.c[1], D.c[2]).sub(P).applyQuaternion(q).add(P); D.mesh.quaternion.copy(q); continue; }
      const b = (__world.breakables || []).find((x) => x.id === id), own = meshes['break:' + ((b && b.skin) || id)];
      for (const m of own ? [own, ...(own.userData.tex || [])] : []) { m.position.copy(P).sub(P.clone().applyQuaternion(q)); m.quaternion.copy(q); }
    }
  }
}
`;
}

/**
 * The page's metal panels (rupa, rupa/panels.js; controllable/rupa.js PANELS): each plate on an object drawn as the
 * sheet the runtime keeps (`state.rupa.panels`), a hair proud of the body it skins, riding its entity (its heading, a
 * flyer's roll and pitch). A sheet bends as one, so both its faces go with the blow: a dish (cos² across it) in where it
 * was struck from outside and out where from inside; a dent the law's bowl, d·(1 − r²/a²), its rim d / 3 out to 2a; an
 * opening where a hole is wider than the sheet's grid, a slit along a cut through. Lit as the dented blocks are: as
 * the flat face, its slopes by how far they turn from it, darker toward the bottom of a bowl. A round's hole finer than
 * the grid shows as its bore, dark, and the petals round it, on both faces. A plate off its object rides the body it
 * became, tipping away from the blow. A box body plated on every face but its floor is drawn by its plates alone (any
 * other body is drawn as well, and a dent deeper than the plate stands proud of it goes behind it). Read from state the
 * runtime owns, at its time, so a capture stays byte-identical. Emitted only when an object carries panels.
 */
export function panelsViewScript() {
  return `// panels: an object's metal plates, each a sheet riding its entity, bent by its blows
const __panelDraw = {}, __PANEL_PROUD = 0.002, __panelLight = [0.35, -0.55, 0.76];
const __PANEL_FACE = { front: [0, 1], back: [0, -1], left: [1, 1], right: [1, -1], top: [2, 1], bottom: [2, -1] };
// the bend at a point of the sheet (m, inward positive) and whether it is open there
function __panelAt(P, ax, out, p, hw) {
  let z = 0, hole = false;
  const u = (ax + 1) % 3, v = (ax + 2) % 3;
  for (const q of P.rupa.dents) {
    const r = Math.hypot(p[u] - q.at[u], p[v] - q.at[v]), s = q.side === out ? 1 : -1;
    if (q.dish) { if (r < q.a) { const c = Math.cos((Math.PI * r) / (2 * q.a)); z += s * q.d * c * c; } continue; }
    if (q.hole && r < 0.7 * q.a) hole = true;
    if (r < q.a) z += s * q.d * (1 - (r * r) / (q.a * q.a));
    else if (r < 2 * q.a) { const k = Math.sin((Math.PI * (r - q.a)) / q.a); z -= s * Math.min(q.d / 3, q.a / 2) * k * k; }
  }
  for (const c of P.rupa.cuts || []) if (c.through && Math.abs(p[c.n] - c.at) <= hw) hole = true;
  return { z, hole };
}
function __panelMesh(P) {
  const [ax, out] = __PANEL_FACE[P.face], u = (ax + 1) % 3, v = (ax + 2) % 3, skin = new THREE.Color(P.color || '#8a8f96');
  const face = out > 0 ? P.max[ax] + __PANEL_PROUD : P.min[ax] - __PANEL_PROUD;
  const ext = [0, 1, 2].map((k) => P.max[k] - P.min[k]), c = [0, 1, 2].map((k) => (P.min[k] + P.max[k]) / 2);
  c[ax] = face;
  const marks = P.rupa.dents, floor = Math.max(Math.min(ext[u], ext[v]) / 64, 0.004);
  const fine = (P.rupa.cuts || []).length ? floor : marks.length ? Math.max(floor, Math.min(...marks.map((q) => q.a)) / 6) : Infinity;
  const nu = Math.max(1, Math.min(64, Math.ceil(ext[u] / fine))), nv = Math.max(1, Math.min(64, Math.ceil(ext[v] / fine)));
  const hw = Math.max(0.002, ext[u] / nu, ext[v] / nv) * 0.75, dmax = Math.max(1e-3, ...marks.map((q) => q.d)), grid = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const p = [0, 0, 0];
    p[u] = P.min[u] + (ext[u] * i) / nu; p[v] = P.min[v] + (ext[v] * j) / nv; p[ax] = face;
    const D = marks.length || (P.rupa.cuts || []).length ? __panelAt(P, ax, out, p, hw) : { z: 0, hole: false };
    p[ax] -= out * D.z;
    grid.push({ p: [p[0] - c[0], p[1] - c[1], p[2] - c[2]], z: D.z, hole: D.hole });
  }
  const pos = [], col = [], at = (i, j) => grid[j * (nu + 1) + i], flat = out * __panelLight[ax];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) for (const tri of [[at(i, j), at(i + 1, j), at(i + 1, j + 1)], [at(i, j), at(i + 1, j + 1), at(i, j + 1)]]) {
    const [A, B, C] = tri;
    if (A.hole && B.hole && C.hole) continue;   // open: the hole is wider than the grid
    const e1 = [B.p[0] - A.p[0], B.p[1] - A.p[1], B.p[2] - A.p[2]], e2 = [C.p[0] - A.p[0], C.p[1] - A.p[1], C.p[2] - A.p[2]];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const nl = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map((x) => x / nl);
    if (n[ax] * out < 0) n = n.map((x) => -x);
    const turn = n[0] * __panelLight[0] + n[1] * __panelLight[1] + n[2] * __panelLight[2] - flat;
    const lit = Math.max(0.2, 0.55 + 0.45 * Math.max(0, flat) + 1.4 * turn), deep = (A.z + B.z + C.z) / 3;
    const k = (A.hole || B.hole || C.hole ? 0.18 : 1 - 0.45 * Math.min(1, Math.max(0, deep) / dmax)) * lit;
    for (const q of tri) { pos.push(q.p[0], q.p[1], q.p[2]); col.push(skin.r * k, skin.g * k, skin.b * k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  m.position.set(c[0], c[1], c[2]); m.raycast = function () {};
  // a round's hole finer than the grid: its bore, dark, and the petals round it, on both faces
  const bore = new THREE.MeshBasicMaterial({ color: 0x0b0b0c, side: THREE.DoubleSide }), petal = new THREE.MeshBasicMaterial({ color: skin.clone().multiplyScalar(0.55), side: THREE.DoubleSide });
  for (const q of marks) {
    if (!q.hole || q.a * 1.4 > hw * 2) continue;
    const D = __panelAt(P, ax, out, q.at, hw);
    for (const sd of [-1, 1]) for (const [geo, mat, lift] of [[new THREE.CircleGeometry(q.a, 14), bore, 0.0006], [new THREE.RingGeometry(q.a, 1.8 * q.a, 14), petal, 0.0004]]) {
      const d = new THREE.Mesh(geo, mat), w = q.at.slice();
      w[ax] = face - out * D.z + sd * lift;
      d.position.set(w[0] - c[0], w[1] - c[1], w[2] - c[2]);
      if (ax === 0) d.rotation.y = sd * Math.PI / 2; else if (ax === 1) d.rotation.x = -sd * Math.PI / 2; else if (sd < 0) d.rotation.x = Math.PI;
      d.raycast = function () {};
      m.add(d);
    }
  }
  return m;
}
function __updatePanels() {
  const R = __world.rupa;
  if (!R || !R.panels) return;
  for (const P of R.panels) {
    let D = __panelDraw[P.id];
    if (!D) {
      const g = new THREE.Group(); scene.add(g); D = __panelDraw[P.id] = { g, form: -1, mesh: null };
      // a box body plated on every face but its floor is drawn by its plates alone (they are its skin: a dent goes in)
      const e = __world.byId[P.of], b = e && e.body, faces = new Set(R.panels.filter((q) => q.of === P.of).map((q) => q.face));
      if (b && b.type === 'mesh' && b.shape === 'box' && ['front', 'back', 'left', 'right', 'top'].every((f) => faces.has(f)) && __bodies[P.of]) __bodies[P.of].traverse((x) => { if (x.material) x.material.visible = false; });
    }
    if (D.form !== P.rupa.form) {
      if (D.mesh) { D.g.remove(D.mesh); D.mesh.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); }); }
      D.mesh = __panelMesh(P); D.g.add(D.mesh); D.form = P.rupa.form;
      if (D.loose) D.mesh.position.set(0, 0, 0);
    }
    if (!P.off) {
      const e = __world.byId[P.of];
      if (!e) continue;
      D.g.visible = !e.gone;
      D.g.position.set(e.transform.pos[0], e.transform.pos[1], e.transform.pos[2]);
      if (e.tilt) D.g.rotation.set(e.tilt.roll || 0, -(e.tilt.pitch || 0), e.transform.heading, 'ZYX'); else D.g.rotation.set(0, 0, e.transform.heading);
      continue;
    }
    // off: the plate rides the body it became, turned as it was, tipping away from the blow
    const body = (R.bodies || []).find((x) => x.id === P.off.body);
    if (!body) continue;
    if (!D.loose) { D.loose = true; D.mesh.position.set(0, 0, 0); }
    const a = P.off.away, th = Math.hypot(a[0], a[1]) > 0 ? Math.min(Math.PI / 2, (__world.time - P.off.t) * 3) : 0;
    D.g.position.set(body.pos[0], body.pos[1], body.pos[2]);
    D.g.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), P.off.heading);
    if (th > 0) D.g.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-a[1], a[0], 0).normalize(), th));
  }
}
`;
}

/**
 * The page's dust and smoke (rupa, controllable/rupa.js SMOKE): each source on `state.rupa.smoke` is solved once by the
 * runtime's own smokeOf (a fire's plume, a break's dust in the sizes that hang, a douse's steam) and its puffs placed
 * every frame by the same formula of time (puffAt, plumePuffs), carried by the level's wind: soft sprites from one
 * pool, as wide as a puff has spread and as opaque as its optical depth. Dust takes the colour of what broke as the
 * scene lights it, greyed as powder is; wood smoke is grey and paler as it thins; steam paler still. Read from state the runtime owns, at
 * its time, so a capture stays byte-identical.
 */
export function smokeViewScript() {
  return `// dust and smoke: puffs on the wind
const __smokeSolved = {}, __smokePool = [], __SMOKE_MAX = 480;
const __smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (let i = 0; i <= 8; i++) { const r = i / 8; gr.addColorStop(r, 'rgba(255,255,255,' + Math.exp(-4.5 * r * r).toFixed(3) + ')'); }   // a Gaussian puff
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); return t; })();
function __smokeSprite(i) {
  if (!__smokePool[i]) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: __smokeTex, transparent: true, depthWrite: false, fog: true })); m.raycast = function () {}; scene.add(m); __smokePool[i] = m; }
  return __smokePool[i];
}
// wood smoke is grey (its tar and water droplets scatter light; black smoke is an oil's or a tyre's), paler as it
// thins; steam paler still. Mid tones: a sprite is unlit
const __smokeSoot = new THREE.Color('#77746f'), __smokeGrey = new THREE.Color('#9c9994'), __smokeSteam = new THREE.Color('#b8bcc1');
function __updateSmoke() {
  const R = __world.rupa, P = __CW.rupaPhysics;
  if (!R || !R.smoke || !P) return;
  const t = __world.time, wind = R.wind;
  let n = 0;
  for (const src of R.smoke) {
    let S = __smokeSolved[src.seq];
    if (!S) {
      S = __smokeSolved[src.seq] = P.smokeOf(src, wind);
      const show = src.skin && __breakPieces[src.skin];
      // dust in the colour of what broke as the scene lights it (its faces' baked fill), a little greyed as powder is
      if (src.kind === 'dust') { const c = new THREE.Color(show ? show.fill : '#8a8070'), l = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b; S.color = c.lerp(new THREE.Color(l, l, l), 0.3); }
      else S.color = src.kind === 'steam' ? __smokeSteam : null;
    }
    const list = S.plume ? P.plumePuffs({ ...S.plume, t1: src.t1 }, wind, t) : S.puffs.map((p) => (t - p.t0 <= p.life ? P.puffAt(p, wind, t) : null)).filter(Boolean);
    for (const q of list) {
      if (n >= __SMOKE_MAX) break;
      const m = __smokeSprite(n++), k = Math.min(1, q.alpha);
      m.visible = true; m.position.set(q.pos[0], q.pos[1], q.pos[2]); m.scale.setScalar(3 * q.sigma);
      m.material.opacity = Math.min(0.85, k);
      if (S.plume) m.material.color.copy(__smokeSoot).lerp(__smokeGrey, Math.min(1, q.age / 6)); else m.material.color.copy(S.color);
    }
  }
  for (let i = n; i < __smokePool.length; i++) __smokePool[i].visible = false;
}
`;
}

export function controllableChannelScript(entities, camera, figures0, { exposeBodies = false, pilot = null, spectate = null, ai = null, colliders = null, breakables = null, breakPieces = null, loose = null, rupa = null, hangar = null, match = null, shadows = null, smoke = null, wreckExplodes = null, tutorial = null, aiDifficulty = null, lock = null, commander = null, key = null, toonInk = null, driveSurface = null, touch = false, runner = null, gearGranted = false, seats = null, formSun = null, formLand = false, acts = false, tempo = null, xr = false, trigger = false, backdrop = false, flow = false, gusts = false, vayoGranted = false, knock = null, stills = false, place = null } = {}) {
  // the bank as the page reads it (pageFigures): every flag below reads it, so the branches it needs are emitted
  const PAGE = pageFigures(figures0 || {}), figures = PAGE.figs;
  // distortion (rupa): drawn only when a block's matter has a yield, so every other page keeps its bytes
  const distort = !!(rupa && Array.isArray(breakables) && breakables.some((b) => b && (b.yield > 0 || b.kerfWork > 0)));
  // metal panels on objects (rupa/panels.js): drawn only when an object carries resolved panels, so every other page keeps its bytes
  const panelsOn = !!(rupa && Array.isArray(entities) && entities.some((e) => e && Array.isArray(e.panels) && e.panels.some((p) => p && p.yield > 0)));
  // scars (rupa, cosmetic damage): painted only when the world is scarred, so every other page keeps its bytes
  const scarsOn = !!(rupa && rupa.scars);
  // ground (rupa, the land as a soil grid): drawn and probed only when the world has ground, so every other page keeps its bytes
  const groundOn = !!(rupa && rupa.ground);
  // per-vertex specular (material-response): inject the aSpec wiring into the rig-figure
  // builder ONLY when some packed figure carries a spec buffer (a material-finished suit).
  // Absent → the emitted controllable channel is byte-identical (the char-net pin holds),
  // matching how specularChannelScript itself is gated in scene-three.js.
  // the TOUCH layer (touch.js): a game made for a screen draws a virtual pad, laid out for its pilot and camera
  const touchLayer = touch ? touchLayout(entities, camera, { runner: !!runner }) : null;
  // a shooter's carried arms (gunplay.js, gunplay-view.js): a body whose rule says gunplay; absent, nothing is emitted
  const gunplay = entities.some((e) => e && e.rule && e.rule.gunplay);
  // a gun on a mount aimed by hand (worlds/controllable/turret.js, turret-view.js): an entity with a turret; absent, nothing
  const turretOn = entities.some((e) => e && e.turret);
  // a body steered on its wheels (worlds/controllable/steer.js), its rule's or a form's: absent, nothing
  const hoverOn = entities.some((e) => e && e.rule && e.rule.type === 'hover');
  const boatOn = entities.some((e) => e && e.rule && e.rule.type === 'boat');
  const steerOn = entities.some((e) => e && ((e.rule && e.rule.steer) || (e.forms && Object.values(e.forms).some((f) => f && f.rule && f.rule.steer))));
  // a person's sprint (rules-platform.js sprintSpeed): Shift held, read only where a body has one; absent, nothing emitted
  const sprint = entities.some((e) => e && e.rule && e.rule.sprintSpeed > 0);
  // a level whose only minds are its fauna (era/biocube-fauna.js: each `fauna: true`, passive) has nothing to attack:
  // no AI-attack button. Any other mind ⇒ the button, byte-identical.
  const ais = (entities || []).filter((e) => e && ((e.ambientRule && e.ambientRule.type === 'ai') || (e.rule && e.rule.type === 'ai')));
  const faunaOnly = ais.length > 0 && ais.every((e) => e.fauna === true);
  const figHasSpec = Object.values(figures || {}).some((f) => f && f.rig
    && Array.isArray(f.parts) && f.parts.some((p) => p && (p.spec || p.spec8)));
  // first person (an `eye` camera with `hideTarget`): the body it rides is never drawn, or the view would sit inside
  // its own head. Absent → the emitted channel is byte-identical.
  const hideId = camera && camera.rule === 'eye' && camera.hideTarget && typeof camera.target === 'string' ? camera.target : null;
  // indexed+quantized parts present (unit rigs since the level-load perf batch) — gates the
  // __makeRigGroup q branch below so rig pages without them stay byte-identical.
  const figHasQ = Object.values(figures || {}).some((f) => f && f.rig
    && Array.isArray(f.parts) && f.parts.some((p) => p && p.q));
  // a body in the FORM render (era/eras.js gen-7: vehicle-rig.js packFormMesh, a supercar's `form`): its bones' material
  // slots drawn with physical materials, lit by the world's sun and an environment of its sky. No form body → the
  // emitted channel is byte-identical.
  const figHasForm = Object.values(figures || {}).some((f) => f && f.rig && f.form && Array.isArray(f.parts) && f.parts.some((p) => p && p.form));
  // a rig body drawn at a scale of its own (`body.scale`: a hero in a world authored in other units, a city level's 3.66 m
  // to the unit): the group scales once at build. No body carries one → the emitted channel is byte-identical
  const bodyScaled = (entities || []).some((e) => e && e.body && Number.isFinite(e.body.scale) && e.body.scale > 0 && e.body.scale !== 1);
  // a FOE's hp bar (`body.hpBar: 'target'`, gameworld/foes.js): shown only over the one foe the pilot targets (its lock,
  // else the nearest its aim crosses), never over the body: above the drawn model's top, or under its feet when the top
  // leaves the screen. No body asks for one → the emitted channel is byte-identical
  const foeBars = (entities || []).some((e) => e && e.body && e.body.hpBar === 'target');
  // a TARGET RIM (`body.targetRim`: an rgb, gameworld/foes.js): the foe the pilot targets (the bar's own pick) lit at its
  // edges, a fresnel shell on the bone meshes of whatever body it now wears (a mode swapped in is lit as it comes). No body
  // asks for one → the emitted channel is byte-identical
  const foeRim = foeBars && (entities || []).some((e) => e && e.body && Array.isArray(e.body.targetRim));
  // the gear's line (worlds/controllable/swing.js): drawn from the hand to the anchor while a body swings or zips. No
  // entity carries a gear → the emitted channel is byte-identical
  // (or one a power grants later: a map game's game.powers, scene-three.js reads its grants)
  const gearUsed = gearGranted || (entities || []).some((e) => e && e.rule && e.rule.gear);
  // vayo moves (special abilities on the hero's own air: worlds/controllable/vayo-move.js): a hero that carries one, or a
  // power that grants one. None ⇒ no byte of it
  const vayoOn = vayoGranted || (entities || []).some((e) => e && ((e.rule && e.rule.vayo) || (e.pilotRule && e.pilotRule.vayo)));
  const gearBlock = gearUsed ? `
// ---- the gear's line (swing.js): hand to anchor while a body swings or zips ----
const __gearLines = {};
function __updateGearLines() {
  for (const e of __world.entities) {
    const S = e.swinging || (e.zipping ? { anchor: e.zipping.anchor } : null);
    let ln = __gearLines[e.id];
    if (!S) { if (ln) ln.visible = false; continue; }
    if (!ln) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      ln = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xf2f2f2 })); ln.frustumCulled = false; ln.raycast = function () {};
      scene.add(ln); __gearLines[e.id] = ln;
    }
    const r = e.rule, H = r.collideHeight != null ? r.collideHeight : 1.7 * (r.metre || 1), a = ln.geometry.attributes.position.array;
    a[0] = e.transform.pos[0]; a[1] = e.transform.pos[1]; a[2] = e.transform.pos[2] - (r.eye || 0) + H * 0.9;
    a[3] = S.anchor[0]; a[4] = S.anchor[1]; a[5] = S.anchor[2];
    ln.geometry.attributes.position.needsUpdate = true; ln.visible = true;
  }
}` : '';
  const gearHook = gearUsed ? `
    __updateGearLines();` : '';
  // a bone part carrying metal (a hero wearing its cube's materials, rig-bake.js `metal`): the metal channel's patch on
  // its mesh. Soup parts only (the hero's encoding); no metal part → the emitted channel is byte-identical
  const rigMetalHook = Object.values(figures || {}).some((f) => f && f.rig && Array.isArray(f.parts) && f.parts.some((p) => p && p.metal))
    ? `\n    if (part.metal && !part.q && typeof __metPatch === 'function') __metPatch(mesh, part);` : '';
  // a vehicle rig that LIVES (car-designer/racer.js `live`: steer, lean, squat, dive, bounce, a mast's wobble) —
  // the overlay below is emitted only when some figure carries one, so every other page stays byte-identical.
  const figHasLive = Object.values(figures || {}).some((f) => f && f.rig && f.live);
  // a machine RIDDEN astride (cycle-shelf/cycle-figure.js cycleRideFigure, its live.ridden): its front turned about the
  // steering axis and orbiting the head, the whole machine leaning with its front by the drive rule's own lean (wheels in
  // line), a three-wheeler's inner wheel lifting about the edge it would tip over. None ridden → byte-identical.
  const figHasRide = figHasLive && Object.values(figures || {}).some((f) => f && f.rig && f.live && f.live.ridden);
  // a FACED body (the realistic hero, relational-face-rig.js: `face` and its parts' `morph`): morph targets on its bone
  // meshes, driven per frame by the state's facial track, the ambient blink over the states that hold the face. No
  // faced body → the emitted channel is byte-identical.
  // a SCENE'S TAKES (playscape/ui/scene-takes.js: a script's acts packed as clips, scene:<id>:<k>): the figures that carry
  // one play it while the scene channel names it (world.take), at the line's phase. None ⇒ not a byte of it
  const takes = Object.values(figures || {}).some((f) => f && f.rig && f.clips && Object.keys(f.clips).some((k) => k.indexOf('scene:') === 0));
  const figHasFace = Object.values(figures || {}).some((f) => f && f.rig && f.face && Array.isArray(f.face.targets) && Array.isArray(f.parts) && f.parts.some((p) => p && p.morph));
  // a PAINTED body (the realistic hero's skin, dermal-hero.js heroSkinPaint, packed as station-loft-rig.js `paintTex` and
  // each part's `uv`): its bone meshes drawn on the atlas (texel × the part's lit colour), as the World page draws it.
  // No painted body → the emitted channel is byte-identical.
  const figHasPaint = Object.values(figures || {}).some((f) => f && f.rig && f.paintTex && Array.isArray(f.parts) && f.parts.some((p) => p && (p.uv || p.uq)));
  // a SKINNED body (the mount, lib/graph/mount/game.js: one welded skin, `skin` and its parts' joints and weights): its bones
  // drive ONE skinned mesh (a rigid part a bone would tear the skin at every joint). None ⇒ not a byte of it
  const figHasSkin = Object.values(figures || {}).some((f) => f && f.rig && f.skin === true && Array.isArray(f.parts) && f.parts.some((p) => p && p.jnt && p.wgt));
  // a body with MODES (worlds/controllable/vanish.js): each mode's figure built up front as a loadout's are, the sync's
  // variant swap showing the one it is in. None ⇒ the body as it was, byte for byte
  const hasModes = (entities || []).some((e) => e && e.body && Array.isArray(e.body.modes) && e.body.modes.length > 1);
  // a body that sheathes its weapon out of combat (rules-platform.js `combat.drawn` / `combat.sheathed`): both figures built,
  // the rule's choice shown; and a body's POSE LAYERS (\`body.layers\`): none, not a byte
  const hasSheath = (entities || []).some((e) => e && e.rule && e.rule.combat && e.rule.combat.sheathed);
  const figHasLayers = (entities || []).some((e) => e && e.body && e.body.layers);
  // (and one whose atlas has edges, the hero's hair cards: its material alpha tested; none ⇒ not a byte of it)
  const figHasMask = figHasPaint && Object.values(figures || {}).some((f) => f?.paintTex?.alphaMask);
  // ONE DRAW A FIGURE (merged-figure.js): a plain rigid rig drawn as one skinned mesh, a draw a pass instead of one a part;
  // off where a part's own mesh is read (the toon ink's hulls, a headset's hands). None mergeable ⇒ byte-identical
  const figMerge = !xr && !toonInk && Object.values(figures || {}).some(mergeableFigure);
  // (a figure with a pose twin, figure-grades.js: cut in while a close shot is on it; none, not a byte)
  const figPose = figMerge && Object.values(figures || {}).some((f) => f && typeof f.pose === 'string' && mergeableFigure(f));
  // a racer's JUICE (car-designer/juice.js: flames, puffs, smoke, dust, sparks, a landing ring at its anchors) —
  // emitted only when some figure carries one.
  const figHasJuice = Object.values(figures || {}).some((f) => f && f.rig && f.juice);
  // and its FIDELITY (car-designer/juice.js RIG_FIDELITIES: a voxel venue's cubes, a banded one's cel discs, the seventh
  // generation's bloom) — emitted only when some figure's juice names one.
  const figHasJuiceFid = figHasJuice && Object.values(figures || {}).some((f) => f && f.rig && f.juice && f.juice.fidelity);
  // and a HERO's movement juice (gameworld/feel/hero-juice.js: the platformer's and pinball's), read off the platform
  // rule's facts — emitted only when some figure's juice is a hero's.
  const figHasHeroJuice = figHasJuice && Object.values(figures || {}).some((f) => f && f.rig && f.juice && f.juice.hero);
  // a body with FORMS (controllable/forms.js) and a figure baked to be both (transformation/compose.js): the transform
  // press, the clip each form plays, a flying form's attitude. Emitted only when some entity or figure carries forms.
  const hasForms = (entities || []).some((e) => e && e.forms);
  // a moveset's beats (gameworld/combos.js): the heavy and special presses read, only where a body carries one
  const moveset = (entities || []).some((e) => e && e.rule && e.rule.moveset);
  // a guard (combat-melee.js stepGuard, a feel card's lowered): the guard held, read only where a body carries one
  const guards = (entities || []).some((e) => e && e.rule && e.rule.guard);
  // a hero's SQUASH AND STRETCH on its own jumps (rules-platform.js takes: `takes.squash`, a feel card's look): the rig
  // scaled about its feet by the rule's `e.squash`. No rule carries one ⇒ not a byte of it
  const figHasSquash = (entities || []).some((e) => e && e.rule && e.rule.takes && e.rule.takes.squash > 0);
  const figHasForms = Object.values(figures || {}).some((f) => f && f.rig && f.forms);
  // a car's own light in a dark mood (car-designer/supercar-figure.js: the headlamps' pool on the road, the tail lamps'
  // ribbons) — emitted only when some figure's juice carries them.
  const figHasLights = figHasJuice && Object.values(figures || {}).some((f) => f && f.rig && f.juice && (f.juice.beams || f.juice.trails));
  // spec rides two encodings: legacy float32 pairs (`spec`, vehicle/protoform rigs) and the
  // unit rigs' u8 pairs (`spec8` — [strength×255, shininess], dequantized to the same float
  // attribute here so the shared spec patch shader is unchanged).
  const rigSpecHook = figHasSpec
    ? `\n    if ((part.spec || part.spec8) && typeof __specPatch === 'function') { let sa; if (part.spec8) { const su = decodeU8(part.spec8); sa = new Float32Array(su.length); for (let i = 0; i < su.length; i += 2) { sa[i] = su[i] / 255; sa[i + 1] = su[i + 1]; } } else sa = decodeF32(part.spec); geo.setAttribute('aSpec', new THREE.BufferAttribute(sa, 2)); __specPatch(mesh); }`
    : '';
  // rim (ms-contrast.plan.md SPIKE): additive fresnel edge light — injected ONLY when a
  // packed figure carries a `rim` spec ([r,g,b,strength,power], baked by unit-rig's
  // `contrast` opt-in). Absent → the emitted channel is byte-identical (the char-net
  // pin holds), same gating pattern as figHasSpec above.
  const figHasRim = Object.values(figures || {}).some((f) => f && f.rig && Array.isArray(f.rim));
  // THE CAST RIG ON A BODY (color-theorist/cast-rig.js, a figure's `cast`; the kit: ../cast-rig.js): a figure read lit (its
  // parts carry their normals where its form writes them, else its mesh's own) and carrying a rig is drawn with the cast
  // material, lit by the page's one sun, its sky and its rim its own; no baked rim over it. Absent, the page carries none
  const figHasCast = Object.values(figures || {}).some((f) => f && f.rig && f.cast && Array.isArray(f.parts));
  // (a body that carries its relief, a realistic hero's: its normal map and its occlusion, roughness and metal, on its
  // paint's own atlas; the cast material reads them. None carries one: nothing emitted)
  const figHasRelief = figHasCast && Object.values(figures || {}).some((f) => f && f.cast && f.paintTex && (f.normalTex || f.ormTex));
  const figHasResp = figHasCast && Object.values(figures || {}).some((f) => f && f.cast && Array.isArray(f.response) && f.response.length);
  const rigRimHook = figHasRim ? `\n    if (Array.isArray(fig.rim)${figHasCast ? ' && !fig.cast' : ''}) __rimPatch(mesh, fig.rim);` : '';
  // toon ink (toon-shading Phase 4b): outline every rig PART when the world's toon dial asks for
  // ink — the hull + crease lines are children of the bone mesh, so they pose with the bone and
  // every loadout / livery rebuild gets them for free. Built with the toon setup channel's
  // \`__inkBuild\` (typeof-guarded: the channel is spliced earlier in the page). Parts carry no
  // authored normals, so the geometric fallback orients each triangle away from the part centroid.
  // Gated on the emit-site cfg: a world without toon.ink emits byte-identical controllable text; `lines: false`
  // (silhouette only) leaves the part's line segments unattached, as the toon setup block does.
  const rigInkHook = toonInk ? `\n    if (typeof __inkBuild === 'function') __inkRigPart(mesh, geo, fig);` : '';
  const rigInkBlock = toonInk ? `
// toon ink on rig parts (Phase 4b): de-index the part, orient normals off its centroid, ink it.
const __INKRIG = ${safeJson(toonInk)};
function __inkFigRadius(fig) {   // the figure's scale, for a width every part agrees on
  if (fig.__inkR) return fig.__inkR;
  let r = 0;
  for (const part of fig.parts) {
    if (!part) continue;
    if (part.q && part.s) r = Math.max(r, 0.5 * Math.hypot(part.s[0] * 65535, part.s[1] * 65535, part.s[2] * 65535));
    else if (part.pos) { const p = decodeF32(part.pos); let mx = -1e9, mn = 1e9; for (let i = 2; i < p.length; i += 3) { if (p[i] > mx) mx = p[i]; if (p[i] < mn) mn = p[i]; } r = Math.max(r, (mx - mn) / 2); }
  }
  return (fig.__inkR = r || 1);
}
function __inkRigPart(mesh, geo, fig) {
  const pa = geo.getAttribute('position').array, idx = geo.index ? geo.index.array : null;
  let pos = pa;
  if (idx) { pos = new Float32Array(idx.length * 3); for (let i = 0; i < idx.length; i++) { const k = idx[i] * 3; pos[i * 3] = pa[k]; pos[i * 3 + 1] = pa[k + 1]; pos[i * 3 + 2] = pa[k + 2]; } }
  if (pos.length < 9) return;
  const r = __inkFigRadius(fig), q = Math.max(r * 1.5e-3, 1e-6);
  const width = __INKRIG.widthAbs != null ? __INKRIG.widthAbs : __INKRIG.width * r;
  const e = __inkBuild(pos, __inkGeoNormals(pos, __inkCentroid(pos)), width, __INKRIG.crease, q, __INKRIG.color);
  mesh.add(e.hull);${toonInk.lines === false ? '' : ' mesh.add(e.lines);'}
  mesh.material.polygonOffset = true; mesh.material.polygonOffsetFactor = 1; mesh.material.polygonOffsetUnits = 1; mesh.material.needsUpdate = true;
}` : '';
  const rimPatchBlock = figHasRim ? `
// rim (ms-contrast SPIKE): fresnel edge term for contrast-treated rigs. Chains AFTER any
// spec patch on the same material — both replacements preserve their include markers, so
// the two terms compose on one onBeforeCompile pass.
const __rimPatch = (m, rim) => {
  const prev = m.material.onBeforeCompile;
  m.material.onBeforeCompile = (sh) => {
    if (prev) prev(sh);
    sh.uniforms.uRim = { value: new THREE.Vector4(rim[0], rim[1], rim[2], rim[3]) };
    sh.uniforms.uRimP = { value: rim[4] };
    sh.vertexShader = 'varying vec3 vRimWp;\\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\\nvRimWp = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = 'uniform vec4 uRim;\\nuniform float uRimP;\\nvarying vec3 vRimWp;\\n' + sh.fragmentShader.replace(
      '#include <dithering_fragment>',
      'vec3 rN = normalize(cross(dFdx(vRimWp), dFdy(vRimWp)));\\n' +
      'vec3 rV = normalize(cameraPosition - vRimWp);\\n' +
      'if (dot(rN, rV) < 0.0) rN = -rN;\\n' +
      'float rF = pow(1.0 - max(dot(rN, rV), 0.0), uRimP);\\n' +
      'gl_FragColor.rgb += uRim.rgb * (uRim.a * rF);\\n' +
      '#include <dithering_fragment>');
  };
  m.material.needsUpdate = true;
};` : '';
  // suit contact shadows: `true` or a tuning object { r, alpha, fade, color } over the defaults
  // (r = blob radius at contact, world units; fade = the altitude where the blob dies). The
  // defaults match the static dusk spawn pools' read (r 14 · alpha 0.5 in mint-relit-variant)
  // scaled to ride under a live suit on busy terrain textures.
  const sh = shadows ? { r: 12, alpha: 0.45, fade: 55, color: [0, 0, 0], ...(typeof shadows === 'object' ? shadows : {}) } : null;
  // directional key (see suitShadowBlock): only folded in when the emit call site derived one
  // from the payload's baked light — absent, cfg and the emitted template are byte-identical.
  if (sh && key) sh.key = key;
  // figure-shaped cast shadows (`shadows.cast`): the scene-level cast-shadow channel owns the
  // whole rig — light, receiver twins, fit/follow box (channels/cast-shadows.js). Here the
  // controllable channel is only an INTEGRATION: suppress the blob (the real silhouette
  // replaces it), flag every body mesh as a caster at CONSTRUCTION (a traverse after the fact
  // loses to hangar/loadout rebuilds, and frame()-driven captures never step to restore it),
  // and steer the shadow box to the pilot each frame. Gated on the explicit cast key so every
  // existing shadows world (true / { occlude } / tuning objects) emits its byte-identical
  // blob template.
  // The live light's ACTOR shadows (`shadows.actors`, scene/live-light.js) integrate the same way; their box follows the
  // pilot, or with seats the centre of the seated pilots, grown to their spread (the group frame's centre). It is handed
  // over once as the live light's FOCUS, which the pass before every render asks: captures never step, and the box is
  // tight round the pilot from the first frame.
  const actors = !!(sh && typeof shadows === 'object' && shadows.actors);
  const cast = !!(sh && typeof shadows === 'object' && shadows.cast) || actors;
  const shadowBlock = cast ? '' : sh ? suitShadowBlock(sh) : '';
  const focusHook = actors
    ? 'if (window.__mojCast && window.__mojCast.focus) window.__mojCast.focus(() => { const __pe = (__world.pilotId && __world.byId[__world.pilotId]) || __world.entities[0], __ps = __pe && __pe.transform ? [__pe] : []; if (__world.seatOf) for (const id in __world.seatOf) { const e = __world.byId[id]; if (e && e.transform && !e.gone && e !== __pe) __ps.push(e); } if (!__ps.length) return null; const __c = [0, 0, 0]; for (const e of __ps) for (let k = 0; k < 3; k++) __c[k] += e.transform.pos[k] / __ps.length; let __r = 0; for (const e of __ps) __r = Math.max(__r, Math.hypot(e.transform.pos[0] - __c[0], e.transform.pos[1] - __c[1])); return [__c[0], __c[1], __c[2], __r]; });   // the live light\'s box follows the pilot (or the seats\' centre)\n'
    : '';
  const shadowHook = actors
    ? ''
    : cast
      ? '\n    if (window.__mojCast) { const __pe = (__world.pilotId && __world.byId[__world.pilotId]) || __world.entities[0]; if (__pe && __pe.transform) window.__mojCast.follow(__pe.transform.pos[0], __pe.transform.pos[1], __pe.transform.pos[2]); }'
      : sh ? '\n    __updateSuitShadows();' : '';
  const castHook = cast ? '\n    mesh.castShadow = true;' : '';
  // projectile smoke: `true` or a tuning object over the defaults (max = sprite pool cap ·
  // spacing = trail puff spacing in TRAVEL units · alpha = peak puff opacity · burstCount =
  // puffs per detonation · trailTint/burstTint = light propellant gray / dark detonation gray).
  const sm = smoke ? { max: 150, spacing: 5.5, alpha: 0.55, burstCount: 13, trailTint: 0x9ba1a8, burstTint: 0x565b62, ...(typeof smoke === 'object' ? smoke : {}) } : null;
  if (sm) {
    const d = typeof smoke === 'object' ? smoke.dust : undefined;
    // boost/dodge ground dust: bumped for a more prominent cloud (bigger puffs r0/r1, denser spacing,
    // wider wake, more opaque, rises a touch more). Dodge/topple keep their own r0/r1/width/alpha keys,
    // so this beefs up BOOST most; a per-world `smoke.dust` still overrides via the spread below.
    sm.dust = d === false ? false : { enabled: true, spacing: 3.6, alpha: 0.5, r0: 3.4, r1: 13, width: 11, back: 6.5, rise: 0.7, tint: 0xb8aa8f, ...(d && typeof d === 'object' ? d : {}) };
  }
  const smokeBlock = sm ? projectileSmokeBlock(sm) : '';
  const smokeHook = sm ? '\n    __updateSmoke();' : '';
  const hangarBlock = hangar ? hangarStepperBlock(hangar) : '';
  const hangarHook = hangar ? '  window.__mojHangar.sync();\n  if (inputOverride) { if (inputOverride.hangarStep) window.__mojHangar.step(inputOverride.hangarStep); if (inputOverride.liverySet != null) window.__mojHangar.livery(inputOverride.liverySet); if (inputOverride.equipSlot != null) window.__mojHangar.equip(inputOverride.equipSlot); }\n' : '';
  // COMMANDER (worlds/controllable/commander.js): a body marked `rule.commanded` is driven at strategy rate by
  // a commander port (builtin | hook | http; the world's `commander` picks it), with one HUD line showing its
  // current intent. No commanded body ⇒ both blocks are '' (byte-identical).
  const commandedIds = (entities || []).filter((e) => e && e.id && e.rule && e.rule.commanded).map((e) => e.id);
  const cmdCfg = commander && typeof commander === 'object' ? commander : {};
  const commanderBlock = commandedIds.length ? `const __mojCmd = (function () {
${commanderSource()}
  var ports = ${safeJson(commandedIds)}.map(function (id) { return createCommanderPort({ commandedId: id, foeId: ${safeJson(cmdCfg.foe || null)}, port: ${safeJson(cmdCfg.port || 'builtin')}, period: ${Number(cmdCfg.period) || 5}, url: ${safeJson(cmdCfg.url || null)}, hook: ${safeJson(cmdCfg.hook || null)} }); });
  var hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:80;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#9cc4ff;background:rgba(11,18,32,.72);border:1px solid #24324a;border-radius:6px;padding:6px 10px;max-width:62vw;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  var label = document.createElement('div'); label.style.cssText = 'color:#5f7fb0;letter-spacing:1px'; label.textContent = 'COMMANDER · ' + ${safeJson(commandedIds.join(', '))} + ' · ' + ${safeJson(cmdCfg.port || 'builtin')};
  var line = document.createElement('div'); line.textContent = 'awaiting first read';
  hud.appendChild(label); hud.appendChild(line); document.body.appendChild(hud);
  return { ports: ports, step: function (w) { for (var i = 0; i < ports.length; i++) ports[i].onFrame(w); line.textContent = ports.map(function (p) { return p.currentNote(); }).join(' | '); } };
})();
window.__mojCommanderPorts = __mojCmd;   // headless verification: ports + current notes
` : '';
  const commanderStep = commandedIds.length ? '__mojCmd.step(__world);\n    ' : '';
  // FLIGHT HUD (skyscape): a body on the fly rule gets the instruments a pilot reads (airspeed in knots, height over the
  // ground and over the datum, climb, heading, the throttle) and the warnings (STALL, the map's bound). Read off the
  // piloted body's facts each frame. No flying body ⇒ '' (byte-identical).
  const flyHudBlock = (entities || []).some((e) => e && ((e.rule && e.rule.type === 'fly') || (e.forms && Object.values(e.forms).some((f) => f && f.rule && f.rule.type === 'fly')))) ? `(function () {
  var el = document.createElement('div');
  el.style.cssText = 'position:absolute;left:16px;bottom:16px;min-width:210px;padding:8px 12px;border-radius:8px;background:rgba(8,14,22,0.5);box-shadow:inset 0 0 0 1px rgba(120,200,255,0.22);pointer-events:none;z-index:9;font:600 12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#cfe3ff;white-space:pre';
  document.body.appendChild(el);
  var pad = function (v, n) { v = String(v); while (v.length < n) v = ' ' + v; return v; };
  // a flight's game (the laps mechanic's land / respawn): each touchdown told to the bus with whether it sank harder
  // than the gear takes (rule.sinkMax), and its respawn carried out; a city's roofs (rule.roofs) counted as ground, so a
  // tower is hit, not flown through
  // a touchdown counts once the craft has flown (over ARM m above the ground): not the first frames' settling on the pad
  var roofs = null, wasAir = null, lastVs = 0, hooked = false, armed = false, ARM = 3;
  function roofAt(x, y) {
    for (var k = 0; k < roofs.length; k++) {
      var r = roofs[k], i = Math.floor((x - r.x0) / r.cell), j = Math.floor((y - r.y0) / r.cell);
      if (i >= 0 && j >= 0 && i < r.nx && j < r.ny) { var v = r.h[j * r.nx + i]; if (v) return r.base + v / 10; }
    }
    return null;
  }
  // space (rule.space): no ground under the craft but a roof grid's (a station's), the view out to the stars, and its
  // rocks (rule.obstacles: x, y, z, r flat) a crash when flown into
  var spaced = false, rocks = null, clearOfRocks = true;
  function rockHit(q) { for (var k = 0; k < rocks.length; k += 4) { var dx = q[0] - rocks[k], dy = q[1] - rocks[k + 1], dz = q[2] - rocks[k + 2], r = rocks[k + 3] + 2; if (dx * dx + dy * dy + dz * dz <= r * r) return true; } return false; }
  // an armed craft fires its guns on Z as well as the (pointer-locked) left mouse, its missile on the right mouse (R is
  // the scheme's); F is its boost
  var fireKeyed = false;
  function hook(p) {
    if (!fireKeyed) {
      fireKeyed = true;
      window.addEventListener('keydown', function (ev) { if (ev.code === 'KeyZ') __fireDown = true; });
      window.addEventListener('keyup', function (ev) { if (ev.code === 'KeyZ') __fireDown = false; });
      renderer.domElement.addEventListener('mousedown', function (ev) { if (ev.button === 2 && document.pointerLockElement === renderer.domElement) window.__mojAltFire = true; });
      window.addEventListener('mouseup', function (ev) { if (ev.button === 2) window.__mojAltFire = false; });
      renderer.domElement.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
    }
    if (p.rule.space && !spaced) {
      spaced = true; rocks = p.rule.obstacles || null;
      __ground = function (pos) { return roofs ? roofAt(pos[0], pos[1]) : null; };   // eslint-disable-line no-func-assign
      if (camera.far < 40000) { camera.far = 40000; camera.updateProjectionMatrix(); }
    }
    if (p.rule.roofs && !roofs) {
      roofs = p.rule.roofs.map(function (r) { var b = atob(r.q), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return { x0: r.x0, y0: r.y0, cell: r.cell, nx: r.nx, ny: r.ny, base: r.base, h: new Uint16Array(u.buffer) }; });
      var g0 = __ground;
      if (!p.rule.space) __ground = function (pos) { var g = g0(pos), t = roofAt(pos[0], pos[1]); return t !== null && (g === null || t > g) ? t : g; };   // eslint-disable-line no-func-assign
    }
    var B = window.__mojBus; if (hooked || !B || !B.bus) return; hooked = true;
    var prev = B.bus.processEvents;
    B.bus.processEvents = function (state, events) {
      var n0 = state.log.length, out = prev(state, events);
      for (var i = n0; i < state.log.length; i++) {
        var ev = state.log[i]; if (!ev || typeof ev.type !== 'string' || ev.type.indexOf('respawn:') !== 0) continue;
        // the point rides on the reaction that emitted it (the log keeps the type)
        var R = (state.reactions || []).find(function (r) { return r.do === 'emit' && r.type === ev.type; });
        var c = __world.byId[__world.pilotId]; if (!c || !R || !Array.isArray(R.spot)) continue;
        ev = R;
        c.transform.pos = ev.spot.slice(); c.transform.heading = ev.heading || 0; c.transform.pitch = 0; c.bank = 0;
        c.airborne = !!ev.aloft; c.stalled = false; c.airspeed = ev.aloft ? (c.rule.cruise || c.rule.launchSpeed || c.rule.stallSpeed * 1.6) : 0;
        if (c.rule.lever) c.lever = ev.aloft ? (c.rule.leverStart || 0.75) : 0;
        wasAir = !!ev.aloft; lastVs = 0; armed = !!ev.aloft;
      }
      return out;
    };
  }
  // the course's guidance (rule.course): the next gate bracketed on screen (an arrow at the edge when it is off it), a
  // gate flown past outside its ring called out, and on the way to the runway the glide-slope lights (PAPI-like: four,
  // white above the slope, red below) and the centreline
  // the missile lock's bracket: round the body the lock is building on, its ring filling, red when locked
  var lk = document.createElement('div'), LV = new THREE.Vector3();
  lk.style.cssText = 'position:absolute;pointer-events:none;z-index:9;display:none;transform:translate(-50%,-50%);font:600 10px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-align:center;white-space:nowrap';
  document.body.appendChild(lk);
  function lockMark(p) {
    var L = p.mlock, tg = L && __world.byId[L.target];
    if (!tg) { lk.style.display = 'none'; return; }
    var r = renderer.domElement.getBoundingClientRect(), q = tg.transform.pos;
    LV.set(q[0], q[1], q[2]).project(camera);
    if (LV.z > 1 || Math.abs(LV.x) > 1 || Math.abs(LV.y) > 1) { lk.style.display = 'none'; return; }
    var need = (p.rule.missiles && p.rule.missiles.lockTime) || 1.2, f = Math.min(1, L.t / need), col = L.locked ? '#ff4d4d' : '#9fe3ff';
    lk.style.display = ''; lk.style.left = (r.left + (LV.x + 1) / 2 * r.width) + 'px'; lk.style.top = (r.top + (1 - LV.y) / 2 * r.height) + 'px';
    lk.innerHTML = '<div style="width:44px;height:44px;margin:0 auto 2px;border:2px solid ' + col + ';border-radius:4px;transform:rotate(45deg) scale(' + (1.6 - 0.6 * f) + ')"></div><span style="color:' + col + '">' + (L.locked ? 'LOCK' : Math.round(100 * f) + '%') + '</span>';
  }
  // the weapons' line: missiles and flares left, the boost's charge, a homing round's warning
  function arms(p) {
    var m = p.rule.missiles, out = '';
    if (m) out += '\\nMSL ' + (p.missilesLeft == null ? (m.count || 4) : p.missilesLeft) + '  FLR ' + (p.flaresLeft == null ? (m.flares || 0) : p.flaresLeft) + (p.flareT > 0 ? ' <span style="color:#ffd166">FLARE</span>' : '');
    if (p.rule.boost) { var full = p.rule.boost.time || 3, e2 = p.boostE == null ? full : p.boostE, n = Math.round(8 * e2 / full); out += (m ? '  ' : '\\n') + 'BST ' + '▮'.repeat(n) + '▯'.repeat(8 - n); }
    if (p.incoming != null) out += '\\n<span style="color:#ff4d4d">INCOMING · ' + Math.round(p.incoming) + ' m</span>';
    return out;
  }
  var mk = document.createElement('div'), miss = 0, missN = 0, prevSide = null, prevNext = -1, ownNext = 0, cpVar = null, V3 = new THREE.Vector3();
  mk.style.cssText = 'position:absolute;pointer-events:none;z-index:9;display:none;font:600 11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:#ffd166;text-align:center;transform:translate(-50%,-50%);white-space:nowrap';
  document.body.appendChild(mk);
  function nextOf(C, q) {
    var B = window.__mojBus, v = B && B.state && B.state.vars;
    if (v && cpVar === null) { cpVar = ''; for (var k in v) if (/^__cp_\\d+$/.test(k)) { cpVar = k; break; } }
    if (v && cpVar) return v[cpVar];
    // no game on the page: counted here, each gate when the craft is inside its ring
    var G = C.gates[ownNext];
    if (G && Math.hypot(q[0] - G[0], q[1] - G[1], q[2] - G[2]) <= G[3]) ownNext++;
    return ownNext;
  }
  function guide(p) {
    var C = p.rule.course; if (!C) { mk.style.display = 'none'; return ''; }
    var q = p.transform.pos, n = nextOf(C, q), G = C.gates[n], L = C.land, out = '';
    if (n !== prevNext) { prevNext = n; prevSide = null; }
    var tgt = G ? [G[0], G[1], G[2]] : L ? L.aim : null;
    if (G) {
      // flown past: the gate's plane crossed (its heading the way through) outside its ring
      var side = (q[0] - G[0]) * Math.cos(G[4]) + (q[1] - G[1]) * Math.sin(G[4]);
      if (prevSide !== null && prevSide < 0 && side >= 0 && Math.hypot(q[0] - G[0], q[1] - G[1], q[2] - G[2]) > G[3]) { miss = performance.now(); missN = n + 1; }
      prevSide = side;
    }
    if (tgt) {
      var d = Math.hypot(tgt[0] - q[0], tgt[1] - q[1], tgt[2] - q[2]), r = renderer.domElement.getBoundingClientRect();
      V3.set(tgt[0], tgt[1], tgt[2]).project(camera);
      var label = (G ? 'GATE ' + (n + 1) : 'RUNWAY') + ' ' + (d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m');
      var behind = V3.z > 1, on = !behind && Math.abs(V3.x) < 0.92 && Math.abs(V3.y) < 0.88;
      mk.style.display = '';
      if (on) {
        mk.style.left = (r.left + (V3.x + 1) / 2 * r.width) + 'px'; mk.style.top = (r.top + (1 - V3.y) / 2 * r.height) + 'px';
        mk.innerHTML = '<div style="width:34px;height:34px;margin:0 auto 3px;border:2px solid #ffd166;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,.5)"></div>' + label;
      } else {
        // off the screen: an arrow at its edge, pointing the way to turn
        var ax = behind ? -V3.x : V3.x, ay = behind ? -V3.y : V3.y, m = Math.max(Math.abs(ax) / 0.9, Math.abs(ay) / 0.85) || 1;
        ax /= m; ay /= m;
        mk.style.left = (r.left + (ax + 1) / 2 * r.width) + 'px'; mk.style.top = (r.top + (1 - ay) / 2 * r.height) + 'px';
        mk.innerHTML = '<div style="font-size:22px;transform:rotate(' + (90 - Math.atan2(ay, ax) * 180 / Math.PI) + 'deg)">▲</div>' + label;
      }
    } else mk.style.display = 'none';
    if (performance.now() - miss < 3000) out += '\\n<span style="color:#ff6b6b">MISSED GATE ' + missN + ' · turn back</span>';
    if (!G && L) {
      // the approach: the angle over the aim point against the slope, and the side of the centreline
      var ax2 = Math.cos(L.heading), ay2 = Math.sin(L.heading), along = (q[0] - L.aim[0]) * ax2 + (q[1] - L.aim[1]) * ay2;
      var dist = Math.max(1, -along), ang = Math.atan2(q[2] - L.aim[2], dist) * 180 / Math.PI, gs = Math.atan(L.glide) * 180 / Math.PI;
      var lights = '';
      for (var i = 0; i < 4; i++) lights += '<span style="color:' + (ang > gs - 0.5 + i / 3 ? '#ffffff' : '#ff4d4d') + '">●</span>';
      var xte = (q[0] - L.aim[0]) * -ay2 + (q[1] - L.aim[1]) * ax2;
      var loc = Math.abs(xte) < 12 ? 'on the centreline' : (xte > 0 ? 'centreline ▶' : '◀ centreline') + ' ' + Math.round(Math.abs(xte)) + ' m';
      out += '\\nGS ' + lights + '  ' + (along < 0 ? loc : '');
    }
    return out;
  }
  function tick() {
    var p = __world.pilotId && __world.byId[__world.pilotId];
    if (p && p.rule && p.rule.type === 'fly') {
      hook(p);
      if (rocks && window.__mojBus && window.__mojBus.bus) {
        var hit = rockHit(p.transform.pos);
        if (hit && clearOfRocks) { var Bk = window.__mojBus; Bk.bus.processEvents(Bk.state, [{ type: 'crash', entity: p.id, why: 'rock' }]); }
        clearOfRocks = !hit;
      }
      var q0 = p.transform.pos, g0 = __ground([q0[0], q0[1], q0[2]]);
      if (p.airborne && g0 !== null && q0[2] - g0 > ARM) armed = true;
      if (wasAir === null) wasAir = !!p.airborne;
      if (p.airborne) lastVs = p.climbRate || 0;
      else if (wasAir && armed && window.__mojBus && window.__mojBus.bus) {
        armed = false;
        var sink = Math.max(0, -lastVs), B = window.__mojBus;
        // in space there is nothing to land on: a station's surface or a trench wall met is a crash
        B.bus.processEvents(B.state, [p.rule.space ? { type: 'crash', entity: p.id, why: 'surface' } : { type: 'touchdown', entity: p.id, hard: sink > (p.rule.sinkMax || 3) ? 1 : 0, sink: Math.round(sink * 10) / 10 }]);
      }
      wasAir = !!p.airborne;
      var q = p.transform.pos, g = __ground([q[0], q[1], q[2]]), agl = g === null ? null : q[2] - g;
      var brg = ((90 - p.transform.heading * 180 / Math.PI) % 360 + 360) % 360;
      var warn = p.stalled ? '\\n<span style="color:#ff6b6b">STALL</span>' : p.outOfBounds ? '\\n<span style="color:#ffb347">LEAVING THE AREA · turn back</span>' : '';
      el.style.display = '';
      el.innerHTML = 'SPD ' + pad(Math.round((p.airspeed || 0) * 1.94384), 4) + ' kt   HDG ' + pad(Math.round(brg), 3) + '\\n'
        + 'ALT ' + pad(Math.round(q[2]), 5) + ' m    AGL ' + (agl === null ? '   --' : pad(Math.round(agl), 5)) + ' m\\n'
        + 'V/S ' + pad((p.climbRate || 0).toFixed(1), 5) + ' m/s  THR ' + pad(Math.round((p.throttle || 0) * 100), 3) + '%' + warn + guide(p) + arms(p);
      lockMark(p);
    } else { el.style.display = 'none'; mk.style.display = 'none'; lk.style.display = 'none'; }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
` : '';
  // (a tempo whose moments carry a look: the page lays it over the grade)
  const tempoLook = !!(tempo && Array.isArray(tempo.moments) && tempo.moments.some((m) => m && m.look));
  return `
const __CW = ${emissionSource({ ...(runner ? { runner: true } : {}), ...(entities.some((e) => e && e.rule && e.rule.hitstop) ? { hitstop: true } : {}), ...(entities.some((e) => e && e.rule && e.rule.foe) ? { foe: true } : {}), ...(entities.some((e) => e && e.body && e.body.vanish) ? { vanish: true } : {}), ...(entities.some((e) => e && e.rule && e.rule.summon) ? { summon: true } : {}), ...(entities.some((e) => e && e.rule && e.rule.pair) ? { pair: true } : {}), ...(xr ? { sweep: true } : {}), ...(entities.some((e) => e && e.mount) ? { mount: true } : {}), ...(tempo ? { clock: true } : {}) , ...(gunplay ? { gunplay: true } : {}), ...(turretOn ? { turret: true } : {}), ...(steerOn ? { steer: true } : {}), ...(hoverOn ? { hover: true } : {}), ...(boatOn ? { boat: true } : {}), ...(rupa && (breakables || rupa.scars || rupa.ground || panelsOn) ? { rupa: true } : {}), ...(trigger ? { trigger: true } : {}), ...(gusts ? { vayoAir: true } : {}), ...(vayoOn ? { vayoMove: true } : {}), ...(knock ? { knock: true } : {}), ...(loose ? { loose: true } : {}) })};
const __world = __CW.createWorld({ entities: ${safeJson(entities)}, camera: ${safeJson(camera)}, pilot: ${safeJson(pilot)}${spectate ? ', spectate: true' : ''}${seats ? `, seats: ${safeJson(seats)}` : ''}, ai: ${safeJson(ai)}, colliders: ${safeJson(colliders)}${breakables ? `, breakables: ${safeJson(breakables)}` : ''}${loose ? `, loose: ${safeJson(loose)}` : ''}${rupa && (breakables || rupa.scars || rupa.ground || panelsOn) ? `, rupa: ${safeJson(rupa)}` : ''}, match: ${safeJson(match)}${wreckExplodes ? `, wreckExplodes: ${safeJson(wreckExplodes)}` : ''}${tutorial ? `, tutorial: ${safeJson(tutorial)}` : ''}${aiDifficulty ? `, aiDifficulty: ${safeJson(aiDifficulty)}` : ''}${lock ? `, lock: ${safeJson(lock)}` : ''}${runner ? `, runner: ${safeJson(runner)}` : ''}${tempo ? `, tempo: ${safeJson(tempo)}` : ''}${gusts ? ', vayoAir: true' : ''}${knock ? `, knock: ${safeJson(knock)}` : ''} });
${xr ? `// the headset (channels/xr.js): set while a session plays the game, { pad, input, hides }; null, the page's own devices
let __xrCtl = null;
` : ''}${commanderBlock}${flyHudBlock}${(() => {
    const { figs, same } = PAGE;
    // (clips on 16 bits: decoded once, after the bank and its pool, before any consumer reads a frame)
    const q16 = Object.values(figs).some((f) => f && ['clips', 'acts'].some((k) => f[k] && Object.values(f[k]).some((c) => c && c.b && c.b.q16 !== undefined)));
    const unclip = q16 ? `
(function __unclip16(F) { for (const n in F) { const f = F[n]; if (!f) continue; for (const k of ['clips', 'acts']) { const C = f[k]; if (!C) continue; for (const c in C) { const b = C[c] && C[c].b; if (!b || b.q16 === undefined) continue; const bin = atob(b.q16), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); const q = new Int16Array(u.buffer), out = new Float32Array(q.length); for (let i = 0; i < q.length; i++) out[i] = i % 7 < 4 ? q[i] / 32767 : q[i] * b.s; C[c] = { ...C[c], b: out }; } } } })(__FIG);` : '';
    // (a figure named again: the one it is byte for byte, after the bank, so the export's hoist of the bank keeps it)
    const again = Object.keys(same).length ? `
const __FIGSAME = ${safeJson(same)};   // name → the figure it is byte for byte (emitted once)
for (const k in __FIGSAME) __FIG[k] = __FIG[__FIGSAME[k]];` : '';
    const pooled = poolFigureBuffers(figs);
    if (!pooled.pool.length) return `const __FIG = ${safeJson(figs)};   // name → packed baked figure frames (pos/col b64, origin, invScale, foot)${unclip}${again}`;
    return `const __FIGPOOL = ${safeJson(pooled.pool)};   // shared packed buffers (deduped across figures — livery variants)
const __FIG = ${safeJson(pooled.fig)};   // name → packed baked figure frames (pos/col b64 or {__p:i} into __FIGPOOL)
(function __unpool(o) { for (const k in o) { const v = o[k]; if (v && typeof v === 'object') { if (v.__p != null) o[k] = __FIGPOOL[v.__p]; else __unpool(v); } } })(__FIG);${unclip}${again}`;
  })()}
const __bodies = {};
// figure-frames body: re-expand baked frames (Uint16 corners + Uint8 colour) into raw Float32
// position arrays, feet planted at the body's local z=0 (FOOT subtracted) — packFigureFrames'
// compact encoding. The body owns ONE live BufferGeometry; each sync writes an INTERPOLATED pose
// into it (frame-pair lerp within a clip + crossfade between locomotion modes — renderer-ladder
// P2 rung 1, math from __CW.gaitFramePair/advanceGaitMix) instead of snapping whole geometries.
// Fixed topology across a figure's frames is the packing invariant that makes the lerp valid;
// a figure whose clips disagree on face count falls back to legacy frame-snapping.
const __FTRI = [0, 1, 2, 0, 2, 3];
function __figBytes(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function __decodeFigFrame(posB64, colB64, origin, inv, foot) {
  const q = new Uint16Array(__figBytes(posB64).buffer), col8 = __figBytes(colB64), nFace = col8.length / 3;
  const pos = new Float32Array(nFace * 6 * 3), col = new Float32Array(nFace * 6 * 3);
  let o = 0;
  for (let f = 0; f < nFace; f++) {
    const cb = f * 4 * 3, r = col8[f*3]/255, g = col8[f*3+1]/255, b = col8[f*3+2]/255;
    for (let t = 0; t < 6; t++) { const k = __FTRI[t] * 3;
      pos[o] = origin[0] + q[cb+k]*inv - foot[0]; pos[o+1] = origin[1] + q[cb+k+1]*inv - foot[1]; pos[o+2] = origin[2] + q[cb+k+2]*inv - foot[2];
      col[o] = r; col[o+1] = g; col[o+2] = b; o += 3; }
  }
  return { pos, col };
}${rimPatchBlock}${rigInkBlock}
// build one figure-rig group (rigid parts, one mesh per bone) for a baked fig — shared by the
// single-figure body below and the loadout variant builder (weapon switching). Two part
// encodings: unit rigs pack INDEXED + QUANTIZED (part.q: uint16 grid positions dequantized by
// origin o + per-axis step s, triangles as an index — uint32 when n tops 65535; rig-bake
// packRigMesh); vehicle/protoform rigs still pack legacy float32 triangle soup (part.pos).
// The q branch is emitted only when some figure carries it (figHasQ, same gating pattern as
// figHasSpec) so a page without unit rigs stays byte-identical.${figHasQ ? `
function __decodeU16(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Uint16Array(u.buffer); }
function __decodeU32(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Uint32Array(u.buffer); }` : ''}${figHasForm ? `
// ---- the form render (gen-7): a body's material slots (paint under clearcoat, glass, alloy, rubber, carbon, the lamps)
// drawn with physical materials, lit by the world's own sun, its sky over its ground (the cast rig, in the body's own
// shader), and reflecting an environment made of that sky; the body casts and takes the live shadows. Over a painted
// world it is tone-mapped in its own shader (the paint is not); on a form page the renderer tones it with the land ----
const castKit = ${castKitSource()};
const __FORM_SUN = ${JSON.stringify(formSun || [0.55, 0.4, 0.72])};
function __formBytes(s, T) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); }
const __formSrgb = (c) => new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
let __formEnvTex = null, __formLit = false;
function __formEnv(F) {
  if (__formEnvTex) return __formEnvTex;
  // the sky as a room: zenith over horizon over the ground, and the sun a hot disc where it stands
  const room = new THREE.Scene(), z = __formSrgb(F.sky.zenith), h = __formSrgb(F.sky.horizon), g = __formSrgb(F.sky.ground);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    uniforms: { uZ: { value: new THREE.Vector3(z.r, z.g, z.b) }, uH: { value: new THREE.Vector3(h.r, h.g, h.b) }, uG: { value: new THREE.Vector3(g.r, g.g, g.b) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uZ; uniform vec3 uH; uniform vec3 uG; varying vec3 vD; void main(){ float e = vD.z; vec3 c = e > 0.0 ? mix(uH, uZ, pow(e, 0.6)) : mix(uH * 0.9, uG, pow(min(1.0, -e * 4.0), 0.7)); gl_FragColor = vec4(c, 1.0); }' }));
  dome.rotation.x = 0; room.add(dome);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(F.key[0], F.key[1], F.key[2]).multiplyScalar(14 * F.keyIntensity) }));
  sun.position.fromArray(F.toLight || __FORM_SUN).normalize().multiplyScalar(44); room.add(sun);
  const pm = new THREE.PMREMGenerator(renderer); __formEnvTex = pm.fromScene(room, 0.015).texture; pm.dispose();
  return __formEnvTex;
}
// THE BODY'S LIGHT is the cast rig's (../cast-rig.js, color-theorist/cast-rig.js): one key, and the sky over the ground
// in the body's own shader, where it lights nothing else. The rig is read off the body's own setting (its sky, its
// ground, its ambient: what its hemisphere light was), its key's gain 1 and no rim (a body's rim is its sky, reflected).
function __formRig(F) {
  ${place ? 'if (__castNow && __castNow.U) return __castNow.U;\n  if (!__castNow && F.__rig) return F.__rig;' : 'if (F.__rig) return F.__rig;'}
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }, a = (F.ambient * 1.6) / Math.PI;
  const U = castKit.uniforms({ key: { linear: F.key, gain: 1 }, hemi: { sky: F.sky.zenith.map((c) => lin(c) * a), ground: F.sky.ground.map((c) => lin(c) * a), gain: 1 }, rim: { linear: [0, 0, 0], strength: 0, power: 3 }, tone: { exposure: 1 } });
  ${place ? 'if (__castNow) return (__castNow.U = U);\n  ' : ''}return (F.__rig = U);
}
// the key: ${formLand ? "the land's own sun (channels/form-land.js): a body on a form page asks for no light of its own" : "the shadow lights the page already casts with take the key's colour and strength (they were white and seen by\n// nothing lit: the world is painted); with none, a key of its own along the sun"}
function __formLights(F) {
  if (__formLit) return; __formLit = true;${formLand ? '' : `
  setTimeout(() => {
    const key = new THREE.Color(F.key[0], F.key[1], F.key[2]), casters = [];
    scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) casters.push(o); });
    // (and a normal bias on each for the physical body: a flat plate turned from the sun would wear its own shadow's
    // stripes, the map's depth steps laid on it; a big body, a craft, asks for more by its own normalBias)
    if (casters.length) for (const l of casters) { l.color.copy(key); l.intensity = F.keyIntensity / casters.length; l.shadow.normalBias = Math.max(l.shadow.normalBias, F.normalBias || 0.05); }
    else { const l = new THREE.DirectionalLight(key, F.keyIntensity); l.position.fromArray(F.toLight || __FORM_SUN).normalize().multiplyScalar(100); scene.add(l); scene.add(l.target); }
  }, 0);`}
}
// how much of the sky each slot throws back: polished metal most, the clearcoat and the glass, then the rest
const ENV_GAIN = { alloy: 1.6, paint: 0.95, glass: 1.2, carbon: 0.8, brake: 1.1 };
// (a material each bone: the status tints its own uniforms on it; the program is shared)
function __formMat(F, name) {
  const P = F.materials[name] || {}, ex = F.exposure || 1;
  const m = new THREE.MeshPhysicalMaterial({ ...P, vertexColors: true, side: THREE.DoubleSide, envMap: __formEnv(F), envMapIntensity: ENV_GAIN[name] ?? 0.85 });${formLand ? `
  // (on a form page the renderer's curve tones it with the land: no curve of its own)
  m.userData.cast = true;` : `
  // (a filmic curve on the lit colour, before it is encoded: the world's paint is drawn as it is)
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <tonemapping_fragment>', '{ vec3 x = gl_FragColor.rgb * ' + ex.toFixed(3) + '; gl_FragColor.rgb = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }\\n#include <tonemapping_fragment>'); };`}
  // (the rig: its sky over its ground in the body's own shader; the kit adds no tone of its own here)
${place ? `  if (__castNow) { m.userData.env0 = m.envMapIntensity; (__castNow.mats || (__castNow.mats = [])).push(m); }
` : ''}  return castKit.patch(m, __formRig(F), { register: 'western', surface: 'form' });
}
function __formBone(fig, P) {
  const F = fig.form, geo = new THREE.BufferGeometry(), q = __formBytes(P.q, Uint16Array), p = new Float32Array(P.n * 3);
  for (let i = 0; i < p.length; i += 3) { p[i] = P.o[0] + q[i] * P.s[0]; p[i + 1] = P.o[1] + q[i + 1] * P.s[1]; p[i + 2] = P.o[2] + q[i + 2] * P.s[2]; }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(__formBytes(P.nrm, Int8Array), 3, true));
  geo.setAttribute('color', new THREE.BufferAttribute(decodeU8(P.col), 3, true));
  geo.setIndex(new THREE.BufferAttribute(P.n > 65535 ? __formBytes(P.idx, Uint32Array) : __formBytes(P.idx, Uint16Array), 1));
  for (const [start, count, mi] of P.groups) geo.addGroup(start, count, mi);
  geo.computeBoundingSphere();
  __formLights(F);
  const mesh = new THREE.Mesh(geo, P.mats.map((name) => __formMat(F, name)));
  mesh.receiveShadow = true;
  return mesh;
}` : ''}
${figHasFace ? `function __rigU32(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new Uint32Array(u.buffer); }
// the face's targets on one bone mesh: its corners at the neutral face, each target's offsets (as the GLB writes them)
${MORPH_DECODE}
function __mq(m) { const b = atob(m.q), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); const q = new Int16Array(u.buffer), f = new Float32Array(q.length); for (let i = 0; i < q.length; i++) f[i] = q[i] * m.s; return f; }   // the page's 16-bit rows
function __rigMorph(fig, part, geo) {
  const T = fig.face.targets.length, W = (1 + T) * 3, I = __rigU32(part.morph.i), D = part.morph.z ? __mz(part.morph) : part.morph.q ? __mq(part.morph) : decodeF32(part.morph.d);
  const pos = geo.getAttribute('position').array, tg = Array.from({ length: T }, () => new Float32Array(pos.length));
  for (let k = 0; k < I.length; k++) {
    const v = I[k] * 3, o = k * W;
    for (let c = 0; c < 3; c++) { pos[v + c] -= D[o + c]; for (let t = 0; t < T; t++) tg[t][v + c] = D[o + 3 + t * 3 + c]; }
  }
  geo.morphAttributes.position = tg.map((a) => new THREE.BufferAttribute(a, 3));
  geo.morphTargetsRelative = true;
}
// a facial track's weights at a time (each drawn frame held to the next), then the state's on every faced bone mesh
function __rigTrack(tr, at) { if (!tr || !tr.t || !tr.t.length) return null; let i = 0; while (i + 1 < tr.t.length && tr.t[i + 1] <= at) i++; return tr.w[i]; }
function __rigFace(rig, clipName, phase) {
  const F = rig.fig.face, tr = F.tracks && F.tracks[clipName];
  // (the ambient blink on the world's own clock, as a live vehicle's shiver is)
  const now = __world.time || 0;
  const over = F.ambient && (!tr || (F.ambientOver || []).includes(clipName));
  const w = over ? __rigTrack(F.ambient, now % F.ambient.seconds) : __rigTrack(tr, phase * tr.t[tr.t.length - 1]);
  const ws = w || F.weights; if (!ws) return;
  for (const mesh of rig.boneMeshes) if (mesh && mesh.morphTargetInfluences) for (let t = 0; t < ws.length; t++) mesh.morphTargetInfluences[t] = ws[t];
}
` : ''}${figHasPaint ? `// the painted body's atlas, once per figure (shared by every entity wearing it)
function __rigTex(fig) { if (!fig.__tex) { fig.__tex = new THREE.TextureLoader().load(fig.paintTex.url); fig.__tex.colorSpace = THREE.SRGBColorSpace; } return fig.__tex; }
` : ''}${figHasSkin ? `// a SKINNED rig: its bones (posed by the sync as a rigid rig's bone meshes are) drive one skinned mesh bound at the rest,
// every part's corners in it with their joints and weights; it never raycasts (no footing, no target)
function __makeSkinGroup(fig, b, group) {
  const bones = fig.bones.map(() => { const o = new THREE.Bone(); o.matrixAutoUpdate = false; group.add(o); return o; });
  let n = 0; for (const P of fig.parts) if (P) n += P.faces * 3;
  const pos = new Float32Array(n * 3), col = new Uint8Array(n * 3), jnt = new Uint16Array(n * 4), wgt = new Float32Array(n * 4);
  let o = 0;
  for (const P of fig.parts) {
    if (!P) continue;
    const p = decodeF32(P.pos), c = decodeU8(P.col), j = decodeU8(P.jnt), w = decodeF32(P.wgt), m = p.length / 3;
    pos.set(p, o * 3); col.set(c, o * 3); jnt.set(j, o * 4); wgt.set(w, o * 4); o += m;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(jnt, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(wgt, 4));
  geo.computeBoundingSphere();
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh.frustumCulled = false; mesh.raycast = function () {};
  group.add(mesh); scene.add(group);
  group.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4())));
  group.userData.rigFig = { fig, boneMeshes: bones, mix: {}, blendTime: b.blendTime, lookA: 0, yaw: b.yawOffset != null ? b.yawOffset : -Math.PI / 2, headTrack: b.headTrack || null, skin: mesh };
  return group;
}
` : ''}${figHasCast ? `// the cast rig's material for a figure's parts: one set of the rig's uniforms a figure (../cast-rig.js)
${figHasForm ? '' : `const castKit = ${castKitSource()};
`}const __castU = new Map();
${figHasRelief ? `// a body's relief on its paint's atlas (epidermis/dermal-relief.js, cloth-relief.js): the normal map, and its roughness
// (the green of its occlusion-roughness-metal texture, as glTF reads it); once a figure
function __castRelief(fig) {
  if (fig.__relief) return fig.__relief;
  const tex = (t) => { const x = new THREE.TextureLoader().load(t.url); x.colorSpace = THREE.NoColorSpace; return x; }, o = {};
  if (fig.normalTex) o.normalMap = tex(fig.normalTex);
  // (its roughness alone of the three: a body under the land's sun already holds the page's shadow maps, and a material
  // has only so many textures; a hero's cloth and skin are no metal, and its hollows are in its albedo's cavity)
  if (fig.ormTex) { o.roughnessMap = tex(fig.ormTex); o.roughness = 1; }
  return (fig.__relief = o);
}
` : ''}${figHasResp ? `// how each of a body's materials answers the light (color-theorist/cast-response.js, a figure's \`response\`): a corner's
// class read off its own colour, the nearest of the figure's palette, as two bytes a corner (its roughness, its metal)
function __castMR(fig, c, n) {
  // (a corner's colour is linear light and may stand a shade under its group's, in a fold or a hollow: so the class is
  // the palette colour nearest in HUE, each compared as its share of its own sum, the level a tie's breaker)
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const R = fig.__resp || (fig.__resp = fig.response.map((p) => { const a = lin(p[0]), b = lin(p[1]), d = lin(p[2]), t = a + b + d + 1e-4; return [a / t, b / t, d / t, t, p[3], p[4]]; }));
  const out = new Uint8Array(n * 2); let last = 0, lr = -1, lg = -1, lb = -1;
  for (let i = 0; i < n; i++) {
    const r = c[i * 3], g = c[i * 3 + 1], b = c[i * 3 + 2];
    if (r !== lr || g !== lg || b !== lb) {
      lr = r; lg = g; lb = b;
      const t = (r + g + b) / 255 + 1e-4, x = r / 255 / t, y = g / 255 / t, z = b / 255 / t; let best = 1e9;
      for (let k = 0; k < R.length; k++) { const p = R[k], d = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y) + (p[2] - z) * (p[2] - z) + 0.02 * (p[3] - t) * (p[3] - t); if (d < best) { best = d; last = k; } }
    }
    out[i * 2] = R[last][4]; out[i * 2 + 1] = R[last][5];
  }
  return out;
}
` : ''}function __castMat(fig, o) {
  let U = ${place ? '__castNow ? (__castNow.U || (__castNow.U = castKit.uniforms(fig.cast))) : ' : ''}__castU.get(fig); if (!U) { U = castKit.uniforms(fig.cast); __castU.set(fig, U); }
  const m = castKit.material(fig.cast, Object.assign({ surface: fig.cast.surface || 'paint', uniforms: U${figHasResp ? ', response: Array.isArray(fig.response)' : ''} }, o));
  m.userData.cast = true;
  return m;
}
` : ''}${figMerge ? mergedFigureScript({ cast: !!cast, scaled: bodyScaled, pose: figPose, rig: figHasCast, resp: figHasResp }) : ''}function __makeRigGroup(fig, b) {
  const group = new THREE.Group();${figHasSkin ? `
  if (fig.skin) return __makeSkinGroup(fig, b, group);` : ''}${figMerge ? `
  if (__mergeable(fig)) return __makeMergedGroup(fig, b, group);` : ''}
  const boneMeshes = fig.bones.map((bn, bi) => {
    const part = fig.parts[bi];
    if (!part) return null;${figHasForm ? `
    if (part.form && fig.form) {
      const mesh = __formBone(fig, part.form);${castHook}
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      group.add(mesh);
      return mesh;
    }` : ''}
    const geo = new THREE.BufferGeometry();${figHasQ ? `
    if (part.q) {
      const q = __decodeU16(part.q), o = part.o, s = part.s, p = new Float32Array(part.n * 3);
      for (let i = 0; i < p.length; i += 3) { p[i] = o[0] + q[i] * s[0]; p[i + 1] = o[1] + q[i + 1] * s[1]; p[i + 2] = o[2] + q[i + 2] * s[2]; }
      geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
      geo.setIndex(new THREE.BufferAttribute(part.n > 65535 ? __decodeU32(part.idx) : __decodeU16(part.idx), 1));
    } else geo.setAttribute('position', new THREE.BufferAttribute(decodeF32(part.pos), 3));` : `
    geo.setAttribute('position', new THREE.BufferAttribute(decodeF32(part.pos), 3));`}
    // rig-part colour is packed as normalized uint8 (rig-bake b64u8, 4× smaller than float32) →
    // read it back as a NORMALIZED uint8 attribute so the GPU dequantizes ÷255 to the same [0,1].
    geo.setAttribute('color', new THREE.BufferAttribute(decodeU8(part.col), 3, true));${figHasPaint ? `
    const map = fig.paintTex && ((part.uv && !part.q) || part.uq) ? __rigTex(fig) : null;
    if (map) { if (part.uq) { const u = __decodeU16(part.uq), f = new Float32Array(u.length); for (let i = 0; i < u.length; i += 2) { f[i] = part.uo[0] + u[i] * part.us[0]; f[i + 1] = part.uo[1] + u[i + 1] * part.us[1]; } geo.setAttribute('uv', new THREE.BufferAttribute(f, 2)); } else geo.setAttribute('uv', new THREE.BufferAttribute(decodeF32(part.uv), 2)); }` : ''}${figHasFace ? `
    if (fig.face && part.morph && (!part.q || part.full)) __rigMorph(fig, part, geo);` : ''}${figHasCast ? `
    // (a body under the cast rig: each corner's normal as the lit read wrote it, else its mesh's own)
    if (fig.cast) { if (part.nq) geo.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(decodeU8(part.nq).buffer), 3, true)); else if (part.nrm) geo.setAttribute('normal', new THREE.BufferAttribute(decodeF32(part.nrm), 3)); else geo.computeVertexNormals(); }${figHasResp ? `
    if (fig.cast && Array.isArray(fig.response)) { const cc = geo.getAttribute('color'); geo.setAttribute('aMR', new THREE.BufferAttribute(__castMR(fig, cc.array, cc.count), 2, true)); }` : ''}` : ''}
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, ${figHasCast ? `fig.cast ? __castMat(fig, { vertexColors: true, side: THREE.DoubleSide${figHasPaint ? (figHasMask ? ', ...(map ? { map, ...(fig.paintTex.alphaMask ? { alphaTest: 0.4 } : {}) } : {})' : ', ...(map ? { map } : {})') : ''}${figHasRelief ? ', ...(map ? __castRelief(fig) : {})' : ''} }) : ` : ''}new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide${figHasPaint ? (figHasMask ? ', ...(map ? { map, ...(fig.paintTex.alphaMask ? { alphaTest: 0.4 } : {}) } : {})' : ', ...(map ? { map } : {})') : ''} }));${figHasCast ? `
    if (fig.cast) mesh.receiveShadow = true;` : ''}${figHasFace ? `
    if (geo.morphAttributes.position) mesh.updateMorphTargets();` : ''}${rigSpecHook}${rigMetalHook}${rigRimHook}${rigInkHook}${castHook}
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;   // matrices mutate per frame
    group.add(mesh);
    return mesh;
  });
  scene.add(group);${bodyScaled ? `
  if (b.scale > 0) group.scale.setScalar(b.scale);` : ''}
  group.userData.rigFig = { fig, boneMeshes, mix: {}, blendTime: b.blendTime, lookA: 0,
    yaw: b.yawOffset != null ? b.yawOffset : -Math.PI / 2, headTrack: b.headTrack || null };
  // muzzle locator: an empty child of the weapon bone mesh at the muzzle's bone-local rest point,
  // so its world position IS the live weapon tip (rides every clip). Shot fx originate here.
  if (fig.muzzle) {
    const mbi = fig.bones.findIndex((bn) => bn.id === fig.muzzle.bone);
    if (mbi >= 0 && boneMeshes[mbi]) {
      const loc = new THREE.Object3D();
      loc.position.set(fig.muzzle.local[0], fig.muzzle.local[1], fig.muzzle.local[2]);
      boneMeshes[mbi].add(loc);
      group.userData.rigFig.muzzle = loc;
    }
  }
  // thruster jets (nozzle jet fx — any figure declaring nozzles: boosting mechs,
  // jetpacks, rockets): one additive flame per declared nozzle
  // (fig.thrusters, baked in unit-rig.js). Each flame is a child of a nozzle
  // LOCATOR that is itself a child of the bone mesh, so it rides the posed bone
  // and leans with the body through every clip — no per-frame world math. Hidden
  // until the entity thrusts; __updateThrusters scales/fades them by e.thrust.
  // Two nested open cones (cool outer + hot inner) point out along the exhaust
  // dir, base at the nozzle mouth, PLUS a radial fan of flat triangular blue shards
  // that flare out past the cone tip (the anime boost-flare read). Non-raycasting so a
  // jet never reads as footing. __updateThrusters fades cones + shards by e.thrust.
  if (Array.isArray(fig.thrusters) && fig.thrusters.length) {
    const jets = [];
    const __jUp = new THREE.Vector3(0, 1, 0);
    // a ring of flat triangular shards around the exhaust axis (+Y), each rooted on the cone
    // rim and shooting out PAST the flame tip — deterministic per-shard length variation (no dice,
    // so muted capture stays byte-identical). One additive-blue mesh per jet, faded with thrust.
    const __shardFan = (rad, len) => {
      const M = 8, pos = new Float32Array(M * 9);
      for (let s = 0; s < M; s++) {
        const a = (s / M) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), tc = -sn, ts = c;
        const grow = 1 + 0.5 * ((s % 3) / 2);                    // per-shard length: 1.0 / 1.25 / 1.5
        const rimR = rad * (1.02 + 0.16 * (s % 2)), bw = rad * 0.18;
        const bx = c * rimR, bz = sn * rimR, tipR = rimR * 1.45, tipY = len * (1.15 + 0.7 * (grow - 1));
        const o = s * 9;
        pos[o] = bx + tc * bw; pos[o + 1] = 0; pos[o + 2] = bz + ts * bw;       // base A (on the cone rim)
        pos[o + 3] = bx - tc * bw; pos[o + 4] = 0; pos[o + 5] = bz - ts * bw;   // base B (on the cone rim)
        pos[o + 6] = c * tipR; pos[o + 7] = tipY; pos[o + 8] = sn * tipR;       // tip (splayed out + past the flame)
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fc4ff), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      mesh.raycast = function () {}; mesh.frustumCulled = false;
      return mesh;
    };
    for (const th of fig.thrusters) {
      const bi = fig.bones.findIndex((bn) => bn.id === th.bone);
      if (bi < 0 || !boneMeshes[bi]) continue;
      const loc = new THREE.Object3D();
      loc.position.set(th.local[0], th.local[1], th.local[2]);
      boneMeshes[bi].add(loc);
      const holder = new THREE.Object3D();
      holder.quaternion.setFromUnitVectors(__jUp, new THREE.Vector3(th.dir[0], th.dir[1], th.dir[2]).normalize());
      holder.visible = false;
      loc.add(holder);
      const len = th.len || th.size * 4, rad = th.size;
      const coneG = new THREE.ConeGeometry(rad, len, 10, 1, true);
      coneG.translate(0, len / 2, 0);
      const core = new THREE.Mesh(coneG, new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8fd0ff), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      core.raycast = function () {}; core.frustumCulled = false;
      holder.add(core);
      const innG = new THREE.ConeGeometry(rad * 0.5, len * 0.62, 8, 1, true);
      innG.translate(0, len * 0.31, 0);
      const inner = new THREE.Mesh(innG, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xeaf6ff), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      inner.raycast = function () {}; inner.frustumCulled = false;
      holder.add(inner);
      const shards = __shardFan(rad, len);
      holder.add(shards);
      jets.push({ holder, core, inner, shards, kind: th.kind, baseQ: holder.quaternion.clone() });
    }
    if (jets.length) group.userData.rigFig.jets = jets;
  }${figHasJuice ? `
  if (fig.juice) __rjBuild(fig, group, boneMeshes);` : ''}
  return group;
}
${place ? 'let __castNow = null;   // (the body being made: its own set of the rig\'s uniforms, below)\n' : ''}function __makeBody(e) {
  const b = e.body || {};
  // LOADOUT body (weapon cycling): the platform rule's loadout lists one baked figure per weapon
  // config — build a rig group for EACH up front, show only the active one; a switch (R / 1-N)
  // changes e.body.figure and the sync swaps visibility. Variant meshes never raycast (a hidden
  // sibling body must not read as footing to the ground probe, nor an active one as a target).
  // An UNPILOTED pilotable suit runs its ambient rule at build time, so its loadout lives on
  // pilotRule — check both, or its weapons could never swap after a T take-over.
  const lo = (e.rule && Array.isArray(e.rule.loadout) && e.rule.loadout.length ? e.rule.loadout : null)
    || (e.pilotRule && Array.isArray(e.pilotRule.loadout) && e.pilotRule.loadout.length ? e.pilotRule.loadout : null)${hasModes ? `
    || (Array.isArray(b.modes) && b.modes.length > 1 ? b.modes : null)` : ''}${hasSheath ? `
    || (e.rule && e.rule.combat && e.rule.combat.sheathed ? [{ figure: e.rule.combat.drawn }, { figure: e.rule.combat.sheathed }] : null)` : ''};
  // (a loadout whose slots name no figure, a carried kit's guns: arms-kit.js, has no variant bodies to build; the body is
  // its own figure, below. Without this a hero carrying a kit was never drawn)
  if (lo && lo.some((c) => c && c.figure) && (b.type === 'figure-rig' || b.type === 'figure-frames')) {
    const variants = {};
    const buildVariant = (fname) => {
      if (!fname || variants[fname] || !(__FIG[fname] && __FIG[fname].rig)) return;
      const g = __makeRigGroup(__FIG[fname], b);
      for (const bm of g.userData.rigFig.boneMeshes) { if (bm) bm.raycast = function () {}; }
      g.visible = fname === b.figure;
      g.userData.loadout = { variants: null, figName: fname };
      variants[fname] = g;
    };
    for (const cfg of lo) buildVariant(cfg && cfg.figure);
    // LIVERY variants (livery-ingame.plan.md): pre-build each livery's baked body so a setup-screen
    // livery pick has a warm mesh to reveal — __applyMatchParams sets body.figure + loadout figures to
    // the chosen livery, the sync's variant-swap shows it, and __applyWeaponShow re-applies the weapon.
    if (Array.isArray(e.liveries)) for (const lv of e.liveries) buildVariant(lv && lv.figure);
    for (const k in variants) variants[k].userData.loadout.variants = variants;
    return variants[b.figure] || variants[lo[0].figure] || null;
  }
  // figure-rig body (renderer-ladder P2 rung 2): rigid PARTS bound once at rest + per-clip pose
  // CURVES ([qx,qy,qz,qw,hx,hy,hz] per bone per key). One THREE.Mesh per bone; each sync slerps
  // the bracketing keys and sets one matrix per bone — no vertex writes, no frame stacks.
  if ((b.type === 'figure-rig' || b.type === 'figure-frames') && __FIG[b.figure] && __FIG[b.figure].rig) {
    return __makeRigGroup(__FIG[b.figure], b);
  }
  if (b.type === 'figure-frames' && __FIG[b.figure]) {
    const fig = __FIG[b.figure];
    const clips = {};   // clip name → array of per-frame { pos, col } (one clip per locomotion mode)
    for (const cn in fig.clips) { const cd = fig.clips[cn]; clips[cn] = cd.pos.map((p, i) => __decodeFigFrame(p, cd.col[i], cd.origin, cd.invScale, cd.foot)); }
    const first = clips.forward || clips[Object.keys(clips)[0]];
    const len = first[0].pos.length;
    // lerp only when the pack said the clip's face ordering is frame-stable AND every frame
    // shares the live buffer's size; otherwise the sync falls back to frame snapping.
    // body.lerp:false forces the legacy flipbook path (authoring/debug A-B knob).
    let lerpable = b.lerp !== false;
    for (const cn in fig.clips) { if (fig.clips[cn].lerp === false) lerpable = false; }
    for (const cn in clips) for (const fr of clips[cn]) { if (fr.pos.length !== len) lerpable = false; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(first[0].pos.slice(), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(first[0].col, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));${castHook}
    mesh.frustumCulled = false;   // positions mutate per frame; skip stale-bound culling
    const group = new THREE.Group(); group.add(mesh); scene.add(group);
    group.userData.fig = { clips, mesh, lerpable, mix: {}, blendTime: b.blendTime, yaw: b.yawOffset != null ? b.yawOffset : -Math.PI / 2 };   // figure faces +y → forward
    return group;
  }
  // POLYGOMER body (platformer.plan.md P2): a dreamed manji-tree baked server-side to b64 pos/col.
  // A static mesh (no gait — it animates by squash/stretch in __syncEntity). Round Kirby-style hero.
  if (b.type === 'polygomer' && __FIG[b.figure] && __FIG[b.figure].polygomer) {
    const P = __FIG[b.figure];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(decodeF32(P.pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(decodeF32(P.col), 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));${castHook}
    mesh.frustumCulled = false;
    mesh.userData.polygomer = true;   // → the squash/stretch + facing branch in __syncEntity
    scene.add(mesh);
    return mesh;
  }
  if (b.type !== 'mesh') return null;
  const geo = b.shape === 'box' ? new THREE.BoxGeometry((b.size||[1,1,1])[0], (b.size||[1,1,1])[1], (b.size||[1,1,1])[2]) : new THREE.SphereGeometry(b.radius || 0.5, 24, 16);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(b.color != null ? b.color : 0xff7a59) }));${castHook}
  if (b.marker !== false) {   // a dark nub on local +X so heading/yaw is visible
    const s = (b.radius || ((b.size||[1])[0]) || 1) * 0.22;
    const nub = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), new THREE.MeshBasicMaterial({ color: 0x10141c }));
    nub.position.set((b.radius || ((b.size||[1,1])[0] / 2) || 0.6) * 1.05, 0, 0);
    mesh.add(nub);
  }
  scene.add(mesh);
  return mesh;
}
// graceful clip degrade: the directional side-dash clips (boost_left / boost_right) fall back
// to the older symmetric boost_side, and the directional SWINGS (swing_forward/left/right/back)
// fall back to swing_neutral, on bodies baked before those splits — then both to forward.
// A NAMED swing set (a melee slot's swingSet, e.g. whip_<dir>) degrades the same way: first
// to its own <set>_neutral, then to the classic swing_neutral.
function __clipLookup(clips, name) {
  if (!name) return null;
  const dir = /_(neutral|forward|left|right|back)$/.test(name) ? name.slice(0, name.lastIndexOf('_')) : null;
  const alt = (name === 'boost_left' || name === 'boost_right') ? clips.boost_side
    : (name.indexOf('swing_') === 0) ? clips.swing_neutral
    : dir ? (clips[dir + '_neutral'] || clips.swing_neutral) : null;
  return clips[name] || alt || null;
}
// resolve a locomotion MODE to (clip, phase): 'idle' holds the current clip's frame 0.
function __figClipOf(fig, e, mode) {
  const name = mode === 'idle' ? e.locomotion : mode;
  return __clipLookup(fig.clips, name) || fig.clips.forward || fig.clips[Object.keys(fig.clips)[0]];
}
// accumulate a clip pose (frame-pair lerp) into out with weight w.
function __figAccum(out, clip, phase, statik, w) {
  const pair = statik ? { i0: 0, i1: 0, t: 0 } : __CW.gaitFramePair(clip.length, phase);
  const a = clip[pair.i0].pos, b = clip[pair.i1].pos, t = pair.t;
  for (let i = 0; i < out.length; i++) out[i] += (a[i] + (b[i] - a[i]) * t) * w;
}
// one bone's [q, head] from a rig clip at a phase (frame-pair nlerp over the sparse keys);
// statik (idle) = the rest pose: identity rotation, rest head.
function __rigBone(fig, clipName, phase, statik, bi, outQ, outP) {
  const bone = fig.bones[bi];
  const clip = __clipLookup(fig.clips, clipName) || fig.clips.forward || fig.clips[Object.keys(fig.clips)[0]];
  if (statik || !clip) { outQ.set(0, 0, 0, 1); outP[0] = bone.head[0]; outP[1] = bone.head[1]; outP[2] = bone.head[2]; return; }
  const nb = fig.bones.length, K = clip.k, B = clip.b;
  // ONE-SHOT clips (clip.once — stagger/topple/getup, baked 0..1 inclusive) CLAMP at the final
  // key instead of wrapping: the cyclic tail segment used to interpolate the near-stand getup
  // back toward key 0 (flat on the ground) — the "sits down again" glitch — and a downed wreck
  // held at phase 1 sampled the upright hit pose. Loops keep the wrap (it closes the cycle).
  let i0, i1, t;
  if (clip.once) {
    const kf = Math.min(1, Math.max(0, phase)) * (K - 1);
    i0 = Math.min(K - 1, Math.floor(kf)); i1 = Math.min(K - 1, i0 + 1); t = kf - i0;
  } else {
    const kf = (((phase % 1) + 1) % 1) * K;
    i0 = Math.floor(kf) % K; i1 = (i0 + 1) % K; t = kf - Math.floor(kf);
  }
  const o0 = (i0 * nb + bi) * 7, o1 = (i1 * nb + bi) * 7;
  const s = (B[o0] * B[o1] + B[o0 + 1] * B[o1 + 1] + B[o0 + 2] * B[o1 + 2] + B[o0 + 3] * B[o1 + 3]) < 0 ? -1 : 1;
  outQ.set(B[o0] + (s * B[o1] - B[o0]) * t, B[o0 + 1] + (s * B[o1 + 1] - B[o0 + 1]) * t,
           B[o0 + 2] + (s * B[o1 + 2] - B[o0 + 2]) * t, B[o0 + 3] + (s * B[o1 + 3] - B[o0 + 3]) * t).normalize();
  outP[0] = B[o0 + 4] + (B[o1 + 4] - B[o0 + 4]) * t;
  outP[1] = B[o0 + 5] + (B[o1 + 5] - B[o0 + 5]) * t;
  outP[2] = B[o0 + 6] + (B[o1 + 6] - B[o0 + 6]) * t;
}
const __rigQA = new THREE.Quaternion(), __rigQB = new THREE.Quaternion(), __rigQL = new THREE.Quaternion();
const __rigPA = [0, 0, 0], __rigPB = [0, 0, 0];
const __rigV = new THREE.Vector3(), __rigH = new THREE.Vector3(), __rigT = new THREE.Vector3();
const __RIG_Z = new THREE.Vector3(0, 0, 1), __RIG_ONE = new THREE.Vector3(1, 1, 1);
const __rigQT = new THREE.Quaternion(), __rigQZ = new THREE.Quaternion();
const __rigAxis = new THREE.Vector3(), __rigPivot = new THREE.Vector3();
// look-pitch aim scratch: rotate the weapon arm about the shoulder to follow vertical look.
const __RIG_X = new THREE.Vector3(1, 0, 0), __apQ = new THREE.Quaternion(), __apH = new THREE.Vector3();
// PER-SLOT ARM OVERLAY (R17): read one overlay bone's [q, head] from an armOverlays curve (same
// frame-pair nlerp as __rigBone, but indexed by the overlay's own small bone list). Returns false
// when the clip has no overlay (swing/dodge/knockdown) so the caller keeps the base arm.
function __rigOverlay(ov, clipName, phase, j, outQ, outP) {
  const clip = ov.clips[clipName];
  if (!clip) return false;
  const nb = ov.bones.length, K = clip.k, B = clip.b;
  const kf = (((phase % 1) + 1) % 1) * K;
  const i0 = Math.floor(kf) % K, i1 = (i0 + 1) % K, t = kf - Math.floor(kf);
  const o0 = (i0 * nb + j) * 7, o1 = (i1 * nb + j) * 7;
  const s = (B[o0] * B[o1] + B[o0 + 1] * B[o1 + 1] + B[o0 + 2] * B[o1 + 2] + B[o0 + 3] * B[o1 + 3]) < 0 ? -1 : 1;
  outQ.set(B[o0] + (s * B[o1] - B[o0]) * t, B[o0 + 1] + (s * B[o1 + 1] - B[o0 + 1]) * t,
           B[o0 + 2] + (s * B[o1 + 2] - B[o0 + 2]) * t, B[o0 + 3] + (s * B[o1 + 3] - B[o0 + 3]) * t).normalize();
  outP[0] = B[o0 + 4] + (B[o1 + 4] - B[o0 + 4]) * t;
  outP[1] = B[o0 + 5] + (B[o1 + 5] - B[o0 + 5]) * t;
  outP[2] = B[o0 + 6] + (B[o1 + 6] - B[o0 + 6]) * t;
  return true;
}
${figHasJuice ? `// A RACER'S JUICE (car-designer/juice.js): each row a trigger over the facts, read each frame (a compiled tree, never
// code), at the anchors the machine has. Flames are additive cones on their anchor (they ride the body); puffs, smoke,
// dust and sparks are pooled sprites in the world; a landing is a ring on the ground. Jitter from a seeded LCG.
let __rjSeed = 12345;
const __rjRnd = () => { __rjSeed = (Math.imul(__rjSeed, 1103515245) + 12345) >>> 0; return __rjSeed / 4294967296; };
const __rjUp = new THREE.Vector3(0, 1, 0), __rjV = new THREE.Vector3(), __rjD = new THREE.Vector3(), __rjQ = new THREE.Quaternion();
let __rjTex = null, __rjParts = [], __rjRings = [];
function __rjTexture() {
  if (__rjTex) return __rjTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); __rjTex = new THREE.CanvasTexture(c); return __rjTex;
}
function __rjWhen(n, F) {
  switch (n[0]) {
    case 'or': return __rjWhen(n[1], F) || __rjWhen(n[2], F);
    case 'and': return __rjWhen(n[1], F) && __rjWhen(n[2], F);
    case 'not': return !__rjWhen(n[1], F);
    case 'mul': return __rjWhen(n[1], F) * __rjWhen(n[2], F);
    case 'abs': return Math.abs(__rjWhen(n[1], F));
    case 'num': return n[1];
    case 'fact': return F[n[1]] || 0;
    case 'cmp': { const a = __rjWhen(n[2], F), b = __rjWhen(n[3], F); return n[1] === '<' ? a < b : n[1] === '>' ? a > b : n[1] === '<=' ? a <= b : n[1] === '>=' ? a >= b : n[1] === '==' ? a === b : a !== b; }
  }
  return 0;
}
const __rjMatch = (at, kind) => at === kind || (at.indexOf('.') < 0 && kind.split('.')[0] === at);${figHasJuiceFid ? `
// a particle at its juice's fidelity: a voxel venue's a tumbling block, a banded one's a flat cel disc (three hard bands),
// the seventh generation's spark a hot core in a wide bloom; the soft sprite otherwise
const __rjFidTex = {};
function __rjTexOf(fid, spark) {
  const key = fid === 'form' ? (spark ? 'bloom' : null) : fid === 'voxel' || fid === 'banded' ? fid : null;
  if (!key) return __rjTexture();
  if (__rjFidTex[key]) return __rjFidTex[key];
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const face = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach(([a, b]) => g.lineTo(a, b)); g.closePath(); g.fill(); };
  const disc = (r, col) => { g.fillStyle = col; g.beginPath(); g.arc(32, 32, r, 0, 7); g.fill(); };
  if (key === 'voxel') { face([[32, 6], [58, 19], [32, 32], [6, 19]], '#ffffff'); face([[6, 19], [32, 32], [32, 60], [6, 46]], '#c4c4c4'); face([[32, 32], [58, 19], [58, 46], [32, 60]], '#8c8c8c'); }
  else if (key === 'banded') { disc(30, 'rgba(255,255,255,0.35)'); disc(22, 'rgba(255,255,255,0.7)'); disc(12, '#ffffff'); }
  else { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
  return (__rjFidTex[key] = new THREE.CanvasTexture(c));
}` : ''}
function __rjBuild(fig, group, boneMeshes) {
  const J = fig.juice, anchors = J.anchors.map((a) => {
    const loc = new THREE.Object3D(); loc.position.set(a.at[0], a.at[1], a.at[2]);
    const bi = a.bone ? fig.bones.findIndex((b) => b.id === a.bone) : -1;
    (bi >= 0 && boneMeshes[bi] ? boneMeshes[bi] : group).add(loc);
    return { kind: a.kind, loc, dir: new THREE.Vector3(a.dir[0], a.dir[1], a.dir[2]).normalize() };
  });
  const flames = [];
  for (const row of J.rows) if (row.look === 'flame') for (const a of anchors) if (__rjMatch(row.at, a.kind)) {
    const holder = new THREE.Object3D(); holder.quaternion.setFromUnitVectors(__rjUp, a.dir); holder.visible = false; a.loc.add(holder);
    const len = row.size * J.D * 1.6, rad = Math.max(0.03, row.size * J.D * 0.32), cols = row.colours;
    const mk = (r, l, col, o) => { const g = new THREE.ConeGeometry(r, l, 10, 1, true); g.translate(0, l / 2, 0); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(col), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.raycast = function () {}; m.frustumCulled = false; m.userData.o = o; holder.add(m); return m; };
    const outer = mk(rad, len, cols[cols.length - 1], 0.75), inner = mk(rad * 0.55, len * 0.6, cols[0], 0.95);
    flames.push({ row, holder, outer, inner, amt: 0 });
  }
  // R4's status: every bone mesh's material tinted by uniforms chained after any patch it has (multiply, mix toward a
  // colour, add a glow); the slots the machine has (head and brake lamps, the accent: its hero piece) are bone meshes
  const st = boneMeshes.map((m) => {
    if (!m) return null;
    const u = { uTint: { value: new THREE.Vector3(1, 1, 1) }, uMix: { value: 0 }, uMixCol: { value: new THREE.Color(1, 1, 1) }, uAdd: { value: new THREE.Vector3() } };
${figHasForm ? `
    for (const mt of [].concat(m.material)) {
      const prev = mt.onBeforeCompile;
      mt.onBeforeCompile = (sh) => {
        if (prev) prev(sh);
        Object.assign(sh.uniforms, u);
        sh.fragmentShader = 'uniform vec3 uTint;\\nuniform float uMix;\\nuniform vec3 uMixCol;\\nuniform vec3 uAdd;\\n' + sh.fragmentShader.replace('#include <dithering_fragment>', 'gl_FragColor.rgb = mix(gl_FragColor.rgb * uTint, uMixCol, uMix) + uAdd;\\n#include <dithering_fragment>');
      };
      mt.needsUpdate = true;
    }` : `
    const prev = m.material.onBeforeCompile;
    m.material.onBeforeCompile = (sh) => {
      if (prev) prev(sh);
      Object.assign(sh.uniforms, u);
      sh.fragmentShader = 'uniform vec3 uTint;\\nuniform float uMix;\\nuniform vec3 uMixCol;\\nuniform vec3 uAdd;\\n' + sh.fragmentShader.replace('#include <dithering_fragment>', 'gl_FragColor.rgb = mix(gl_FragColor.rgb * uTint, uMixCol, uMix) + uAdd;\\n#include <dithering_fragment>');
    };
    m.material.needsUpdate = true;`}
    return u;
  });
  const boneOf = (id) => fig.bones.findIndex((b) => b.id === id), slot = {};
  for (const [k, id] of Object.entries(J.slots || {})) { const i = boneOf(id); if (i >= 0 && st[i]) slot[k] = [st[i]]; }
  slot.all = st.filter(Boolean);
  const halos = [];
  for (const row of J.status || []) if (row.halo) for (const sl of row.slots) for (const a of anchors) if (a.kind === sl) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: __rjTexture(), color: new THREE.Color(row.colours[row.colours.length - 1]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const s0 = J.D * 0.55 * row.halo; spr.scale.set(s0, s0, s0); spr.raycast = function () {}; a.loc.add(spr); halos.push({ row, spr });
  }
  let bubble = null;
  if ((J.status || []).some((r) => r.look === 'bubble')) {
    const body = anchors.find((a) => a.kind === 'body'), rad = J.D * 1.9;
    bubble = new THREE.Mesh(new THREE.SphereGeometry(rad, 24, 16), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uCol: { value: new THREE.Color(1, 1, 1) }, uA: { value: 0 } },
      // (the page draws with a logarithmic depth buffer: a shader of its own carries the log-depth chunks, as fire's do)
      vertexShader: '#include <common>\\n#include <logdepthbuf_pars_vertex>\\nvarying vec3 vN; varying vec3 vV; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp;\\n#include <logdepthbuf_vertex>\\n}',
      fragmentShader: '#include <logdepthbuf_pars_fragment>\\nuniform vec3 uCol; uniform float uA; varying vec3 vN; varying vec3 vV; void main() {\\n#include <logdepthbuf_fragment>\\n float f = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(uCol * (0.18 + 1.4 * f), uA * (0.25 + 0.9 * f)); }' }));
    bubble.raycast = function () {}; bubble.visible = false; bubble.position.z = rad * 0.45; (body ? body.loc : group).add(bubble);
  }
  group.userData.rigFig.rj = { J, anchors, flames, acc: {}, alive: {}, skidT: 0, st, slot, halos, bubble, on: {}, flashT: {}, prevV: 0, accel: 0, impactCD: 0, wasBoost: false, group, fired: {}, screen: 0 };${figHasLights ? `
  if (J.beams || J.trails) __rjLightsBuild(group.userData.rigFig.rj, fig, group, boneMeshes);` : ''}
}${figHasLights ? `
// A CAR'S OWN LIGHT: the headlamps' pool on the road ahead (a soft cone in the machine's frame, so it follows the
// heading and not the body's lean, drawn additively a hair over the road), and from each tail lamp a ribbon the car
// leaves behind (world points, the newest at the lamp, each fading as it ages, turned to face the camera).
const __rlBeamV = '#include <common>\\n#include <logdepthbuf_pars_vertex>\\nvarying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\\n#include <logdepthbuf_vertex>\\n}';
const __rlBeamF = '#include <logdepthbuf_pars_fragment>\\nuniform vec3 uCol; uniform float uA, uSp; varying vec2 vUv; void main() {\\n#include <logdepthbuf_fragment>\\n float v = vUv.y, u = vUv.x * 2.0 - 1.0, w = 0.3 + 0.7 * v, c = uSp * (1.0 - v);\\n float lobes = exp(-pow((u - c) / (0.34 * w), 2.0)) + exp(-pow((u + c) / (0.34 * w), 2.0));\\n float k = smoothstep(0.0, 0.3, v) * pow(1.0 - v, 1.2) * min(1.0, lobes) * 1.6;\\n gl_FragColor = vec4(uCol * k * uA, 1.0); }';
function __rjLightsBuild(rj, fig, group, boneMeshes) {
  const J = rj.J, L = { beam: null, trails: [] };
  if (J.beams) {
    const B = J.beams, g = new THREE.PlaneGeometry(B.width, B.len); g.translate(0, B.from + B.len / 2, 0.06);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(B.colour) }, uA: { value: 0 }, uSp: { value: B.spread } }, vertexShader: __rlBeamV, fragmentShader: __rlBeamF, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.raycast = function () {}; m.frustumCulled = false; m.renderOrder = 0.9; group.add(m); L.beam = { m, B };
  }
  if (J.trails) for (const at of J.trails.at) {
    const bi = J.trails.bone ? fig.bones.findIndex((b) => b.id === J.trails.bone) : -1, loc = new THREE.Object3D();
    loc.position.set(at[0], at[1], at[2]); (bi >= 0 && boneMeshes[bi] ? boneMeshes[bi] : group).add(loc);
    const N = J.trails.points, pos = new Float32Array(N * 6), col = new Float32Array(N * 6), idx = [];
    for (let i = 0; i + 1 < N; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.raycast = function () {}; m.frustumCulled = false; scene.add(m);
    L.trails.push({ loc, m, pts: [], c: new THREE.Color(J.trails.colour) });
  }
  rj.lights = L;
}
const __rlP = new THREE.Vector3(), __rlS = new THREE.Vector3(), __rlT = new THREE.Vector3(), __rlE = new THREE.Vector3();
function __rjLightsTick(rj, e, F, d) {
  const L = rj.lights, t = __world.time || 0;
  if (L.beam) L.beam.m.material.uniforms.uA.value = L.beam.B.amount * (0.85 + 0.15 * Math.min(1, F.speed / 30));
  const T = rj.J.trails;
  for (const tr of L.trails) {
    tr.loc.getWorldPosition(__rlP);
    const last = tr.pts[0];
    if (F.speed > T.minSpeed && (!last || __rlP.distanceToSquared(last.p) > 0.04)) { tr.pts.unshift({ p: __rlP.clone(), t }); if (tr.pts.length > T.points) tr.pts.pop(); }
    while (tr.pts.length && t - tr.pts[tr.pts.length - 1].t > T.life) tr.pts.pop();
    const pos = tr.m.geometry.attributes.position.array, col = tr.m.geometry.attributes.color.array, n = tr.pts.length;
    const A = T.amount * (F.braking ? T.brake : 1);
    for (let i = 0; i < T.points; i++) {
      const q = tr.pts[Math.min(i, n - 1)], o = i * 6;
      if (!q || n < 2) { for (let k = 0; k < 6; k++) { pos[o + k] = 0; col[o + k] = 0; } continue; }
      const a = tr.pts[Math.max(0, Math.min(i, n - 1) - 1)].p, b = tr.pts[Math.min(n - 1, Math.min(i, n - 1) + 1)].p;
      const age = i < n ? Math.max(0, 1 - (t - q.t) / T.life) : 0, hw = (T.width / 2) * (0.25 + 0.75 * age);   // (narrowing as it ages)
      __rlT.subVectors(b, a); __rlE.subVectors(camera.position, q.p); __rlS.crossVectors(__rlT, __rlE);
      const sl = __rlS.length(); if (sl > 1e-6) __rlS.multiplyScalar(hw / sl); else __rlS.set(0, 0, hw);
      pos[o] = q.p.x + __rlS.x; pos[o + 1] = q.p.y + __rlS.y; pos[o + 2] = q.p.z + __rlS.z;
      pos[o + 3] = q.p.x - __rlS.x; pos[o + 4] = q.p.y - __rlS.y; pos[o + 5] = q.p.z - __rlS.z;
      const f = A * age * age;
      col[o] = col[o + 3] = tr.c.r * f; col[o + 1] = col[o + 4] = tr.c.g * f; col[o + 2] = col[o + 5] = tr.c.b * f;
    }
    tr.m.geometry.attributes.position.needsUpdate = true; tr.m.geometry.attributes.color.needsUpdate = true;
  }
}` : ''}
let __rjStarTex = null, __rjStars = [], __rjStreaks = [], __rjShocks = [], __rjScreen = null;
function __rjStarTexture() {
  if (__rjStarTex) return __rjStarTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 29, a = -Math.PI / 2 + (i * Math.PI) / 5; g.lineTo(32 + r * Math.cos(a), 32 + r * Math.sin(a)); } g.closePath();
  g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.stroke();
  __rjStarTex = new THREE.CanvasTexture(c); return __rjStarTex;
}
function __rjStar(col, size) {
  let s = __rjStars.find((q) => !q.on);
  if (!s) { if (__rjStars.length >= 160) return null; const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: __rjStarTexture(), transparent: true, depthWrite: false, depthTest: false })); spr.renderOrder = 10; spr.raycast = function () {}; scene.add(spr); s = { spr }; __rjStars.push(s); }
  s.on = true; s.age = 0; s.spr.material.color.set(col); s.spr.visible = true; s.size = size; return s;
}
function __rjStreak(rj, e, row) {
  let k = __rjStreaks.find((q) => !q.on);
  if (!k) { if (__rjStreaks.length >= 240) return; const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.raycast = function () {}; scene.add(m); k = { m }; __rjStreaks.push(k); }
  const D = rj.J.D, h = e.transform.heading, f = [Math.cos(h), Math.sin(h)], sd = [-f[1], f[0]], side = __rjRnd() < 0.5 ? -1 : 1, top = __rjRnd() < 0.3;
  const off = top ? (__rjRnd() - 0.5) * D * 1.6 : side * D * (1.1 + __rjRnd() * 1.2), up = top ? D * (1.6 + __rjRnd() * 0.8) : D * (0.2 + __rjRnd() * 1.4), ahead = D * (__rjRnd() * 2 - 0.6);
  const p = e.transform.pos, gz = p[2] - ((e.rule && e.rule.eye) || 0);
  k.m.position.set(p[0] + f[0] * ahead + sd[0] * off, p[1] + f[1] * ahead + sd[1] * off, gz + up);
  k.m.rotation.set(top ? 0 : Math.PI / 2, 0, h, 'ZYX'); k.len = row.size * D * (0.6 + __rjRnd() * 0.8); k.wid = D * 0.035;
  k.m.material.color.set(row.colours[0]); k.on = true; k.age = 0; k.life = row.life * (0.7 + __rjRnd() * 0.6); k.m.visible = true; k.rj = rj; k.key = row.id;
  rj.alive[row.id] = (rj.alive[row.id] || 0) + 1;
}
// one ring, behind the machine at the middle of its anchors (two stacks throw one shock), thin and faint
function __rjShock(rj, as, e, row) {
  if (!as.length) return;
  let k = __rjShocks.find((q) => !q.on);
  if (!k) { const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.raycast = function () {}; scene.add(m); k = { m }; __rjShocks.push(k); }
  k.m.position.set(0, 0, 0); for (const a of as) { a.loc.getWorldPosition(__rjV); k.m.position.addScaledVector(__rjV, 1 / as.length); }
  k.m.position.x -= Math.cos(e.transform.heading) * rj.J.D * 0.3; k.m.position.y -= Math.sin(e.transform.heading) * rj.J.D * 0.3;
  k.m.rotation.set(0, Math.PI / 2, e.transform.heading, 'ZYX');
  k.m.material.color.set(row.colours[0]); k.on = true; k.age = 0; k.life = row.life; k.size = row.size * rj.J.D; k.m.visible = true;
}
function __rjScreenLines(amt, row) {
  if (!__rjScreen) {
    const host = document.getElementById('wrap') || document.body, c = document.createElement('canvas');
    c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:5';
    host.appendChild(c); __rjScreen = { c, g: c.getContext('2d'), amt: 0 };
  }
  const S = __rjScreen; S.amt += (amt - S.amt) * 0.25;
  const c = S.c, w = c.clientWidth || 1, h = c.clientHeight || 1; if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  S.g.clearRect(0, 0, w, h); if (S.amt < 0.03) return;
  const cx = w / 2, cy = h * 0.46, n = Math.round((row ? row.count : 40) * S.amt);
  S.g.strokeStyle = row ? row.colours[0] : '#ffffff';
  for (let i = 0; i < n; i++) {
    const t = __rjRnd() * Math.PI * 2, R = Math.hypot(w, h) * 0.55, x0 = cx + Math.cos(t) * R, y0 = cy + Math.sin(t) * R * 0.8, k = 0.18 + __rjRnd() * 0.32;
    S.g.globalAlpha = (0.25 + __rjRnd() * 0.55) * S.amt; S.g.lineWidth = 1 + __rjRnd() * 3;
    S.g.beginPath(); S.g.moveTo(x0, y0); S.g.lineTo(x0 + (cx - x0) * k, y0 + (cy - y0) * k); S.g.stroke();
  }
  S.g.globalAlpha = 1;
}
function __rjSpawn(rj, row, a, e, F, tier) {
  const key = row.id; if ((rj.alive[key] || 0) >= row.budget) return;
  let p = __rjParts.find((q) => !q.on);
  if (!p) { if (__rjParts.length >= 900) return; const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: __rjTexture(), transparent: true, depthWrite: false })); spr.raycast = function () {}; scene.add(spr); p = { spr }; __rjParts.push(p); }
  a.loc.getWorldPosition(__rjV); a.loc.getWorldQuaternion(__rjQ); __rjD.copy(a.dir).applyQuaternion(__rjQ);
  const D = rj.J.D, r = () => __rjRnd() - 0.5, look = row.look, spark = look === 'spark' || look === 'trail';
  const fx = Math.cos(e.transform.heading), fy = Math.sin(e.transform.heading), v = e.speed || 0;
  p.on = true; p.rj = rj; p.key = key; p.age = 0; p.life = (row.life || 0.6) * (0.8 + 0.4 * __rjRnd());
  p.spr.position.set(__rjV.x + r() * D * 0.1, __rjV.y + r() * D * 0.1, __rjV.z + (look === 'puff' ? 0 : 0.02));
  p.grav = spark && look === 'spark' ? -9 : 0;
  if (look === 'puff') p.vel = [__rjD.x * 0.6 + r() * 0.3 + fx * v, __rjD.y * 0.6 + r() * 0.3 + fy * v, 0.5 + __rjD.z * 0.6];
  else if (look === 'smoke') p.vel = [r() * 0.8 + fx * v * 0.3, r() * 0.8 + fy * v * 0.3, 0.6 + __rjRnd() * 0.5];
  else if (look === 'dust') p.vel = [r() * 1.6 + fx * v * 0.2, r() * 1.6 + fy * v * 0.2, 0.8 + __rjRnd() * 0.8];
  else if (look === 'spark') p.vel = [r() * 3 + fx * v * 0.4, r() * 3 + fy * v * 0.4, 1.2 + __rjRnd() * 2.4];
  else p.vel = [0, 0, 0];
  const cols = row.colours, c0 = cols[Math.min(cols.length - 1, tier)], c1 = row.tierBy ? c0 : cols[cols.length - 1];
  p.c0 = new THREE.Color(c0); p.c1 = new THREE.Color(c1);
  p.s0 = row.size * D * (spark ? 1 : 0.8); p.s1 = spark ? p.s0 * 0.3 : p.s0 * 2.6;
  p.o0 = spark ? 1 : look === 'puff' ? 0.75 : 0.6;
  p.spr.material.blending = spark ? THREE.AdditiveBlending : THREE.NormalBlending;${figHasJuiceFid ? `
  // (at a fidelity: its particle's shape; a block is solid, never added light; a bloom is wider than its core)
  const fid = rj.J.fidelity; p.spr.material.map = __rjTexOf(fid, spark); p.spin = 0; p.spr.material.rotation = 0;
  if (fid === 'voxel') { p.spr.material.blending = THREE.NormalBlending; p.o0 = 1; p.s0 *= 0.8; p.s1 = p.s0 * (spark ? 0.5 : 1.4); p.spin = (__rjRnd() - 0.5) * 9; }
  else if (fid === 'form' && spark) { p.s0 *= 1.7; p.s1 = p.s0 * 0.35; }` : ''} p.spr.material.needsUpdate = true;
  p.spr.visible = true; rj.alive[key] = (rj.alive[key] || 0) + 1;
}
function __rjRing(rj, row, e) {
  let g = __rjRings.find((q) => !q.on);
  if (!g) { const m = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 28), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide })); m.raycast = function () {}; scene.add(m); g = { m }; __rjRings.push(g); }
  g.on = true; g.age = 0; g.life = row.life || 0.4; g.size = row.size * rj.J.D; g.m.position.set(e.transform.pos[0], e.transform.pos[1], (e.transform.pos[2] - ((e.rule && e.rule.eye) || 0)) + 0.03);
  g.m.material.color.set(row.colours[0]); g.m.visible = true;
}
// the status rows on the slots' uniforms: reset, then each row on (a glow adds, a tint multiplies, the rest mix toward
// a colour, the strongest wins); a lamp's halo with its glow; the shield's bubble
const __rjC = new THREE.Color();
function __rjStatus(rj, F, d, t) {
  for (const u of rj.st) if (u) { u.uTint.value.set(1, 1, 1); u.uMix.value = 0; u.uAdd.value.set(0, 0, 0); }
  for (const h of rj.halos) h.spr.material.opacity = 0;
  for (const row of rj.J.status || []) {
    const on = !!__rjWhen(row.when, F), was = rj.on[row.id]; rj.on[row.id] = on;
    if (row.look === 'flash') { if (on && !was) rj.flashT[row.id] = row.duration || 0.12; rj.flashT[row.id] = Math.max(0, (rj.flashT[row.id] || 0) - d); }
    const live = row.look === 'flash' ? (rj.flashT[row.id] || 0) > 0 : on;
    if (row.look === 'bubble') { if (rj.bubble) { rj.bubble.visible = live; rj.bubble.material.uniforms.uCol.value.set(row.colours[0]); rj.bubble.material.uniforms.uA.value = (row.amount || 0.8) * (0.85 + 0.15 * Math.sin(t * 6)); } continue; }
    if (!live) continue;
    const by = row.by ? F[row.by] || 0 : 1, A = row.amount != null ? row.amount : 1;
    let mix = 0, glow = 0, tint = null;
    if (row.look === 'glow') { __rjC.set(row.colours[row.colours.length - 1]); glow = A; }
    else if (row.look === 'fill') { const full = by >= 0.999; __rjC.set(full ? row.colours[row.colours.length - 1] : row.colours[0]); mix = full ? 0.45 + 0.35 * Math.sin(t * 14) : 0.6 * Math.min(1, by); }
    else if (row.look === 'tier') { const i = Math.max(0, (row.tierAt || [0]).filter((x) => by >= x).length - 1); __rjC.set(row.colours[Math.min(row.colours.length - 1, i)]); mix = A; glow = A * 0.5; }
    else if (row.look === 'flash') { __rjC.set(row.colours[0]); mix = A * ((rj.flashT[row.id] || 0) / (row.duration || 0.12)); }
    else if (row.look === 'tint') { if (row.flicker && __rjRnd() < row.flicker * 0.15) continue; __rjC.set(row.colours[0]); tint = A * Math.min(1, by); }
    else if (row.look === 'cycle') { __rjC.set(row.colours[Math.floor(t * (row.rate || 8)) % row.colours.length]); mix = A; }
    else if (row.look === 'pulse') { __rjC.set(row.colours[0]); mix = A * (0.5 + 0.5 * Math.sin(t * (row.rate || 2) * Math.PI * 2)); }
    for (const sl of row.slots) for (const u of rj.slot[sl] || []) {
      if (tint != null) u.uTint.value.set(u.uTint.value.x * (1 - tint + tint * __rjC.r), u.uTint.value.y * (1 - tint + tint * __rjC.g), u.uTint.value.z * (1 - tint + tint * __rjC.b));
      if (mix > u.uMix.value) { u.uMix.value = mix; u.uMixCol.value.copy(__rjC); }
      if (glow) u.uAdd.value.set(u.uAdd.value.x + __rjC.r * glow * 0.5, u.uAdd.value.y + __rjC.g * glow * 0.5, u.uAdd.value.z + __rjC.b * glow * 0.5);
    }
    if (glow) for (const h of rj.halos) if (h.row === row) h.spr.material.opacity = Math.min(1, glow);
  }
}
// the big effects: stars from a bump, stars round the head, motion lines at speed, a boost's shock, speed lines on
// the pilot's screen
function __rjFx(rj, e, F, d) {
  for (const row of rj.J.fx || []) {
    const on = !!__rjWhen(row.when, F), key = 'fx:' + row.id, was = rj.on[key]; rj.on[key] = on;
    if (row.look === 'screen') { if (__world.pilotId === e.id || (!__world.pilotId && e.pilotable)) { __rjScreenLines(on ? (row.by ? F[row.by] || 0 : 1) : 0, row); rj.screen = __rjScreen ? __rjScreen.amt : 0; } continue; }
    if (row.look === 'streak') { if (!on || (rj.alive[row.id] || 0) >= row.budget) continue; rj.acc[key] = (rj.acc[key] || 0) + row.rate * d; while (rj.acc[key] >= 1) { rj.acc[key] -= 1; __rjStreak(rj, e, row); } continue; }
    if (!on || was) continue;   // the rest fire on the rising edge
    rj.fired[row.id] = (rj.fired[row.id] || 0) + 1;
    const a = rj.anchors.find((x) => x.kind === row.at || x.kind.split('.')[0] === row.at); if (!a) continue;
    if (row.look === 'shock') { __rjShock(rj, rj.anchors.filter((b) => b.kind === row.at), e, row); continue; }
    a.loc.getWorldPosition(__rjV);
    for (let i = 0; i < (row.count || 5); i++) {
      const s = __rjStar(row.colours[i % row.colours.length], row.size * rj.J.D * (0.75 + __rjRnd() * 0.5)); if (!s) break;
      s.life = row.life * (0.85 + __rjRnd() * 0.3); s.spin = (__rjRnd() - 0.5) * 14;
      if (row.look === 'orbit') { s.orbit = { a: a, ph: (i / (row.count || 4)) * Math.PI * 2, r: rj.J.D * 0.55 }; s.vel = null; }
      else { const th = __rjRnd() * Math.PI * 2, sp = 2.2 + __rjRnd() * 2.2; s.orbit = null; s.vel = [Math.cos(th) * sp, Math.sin(th) * sp, 1.5 + __rjRnd() * 2.5]; s.spr.position.copy(__rjV); }
    }
  }
}
function __rjPools(d) {
  for (const s of __rjStars) {
    if (!s.on) continue;
    s.age += d; const u = s.age / s.life;
    if (u >= 1) { s.on = false; s.spr.visible = false; continue; }
    if (s.orbit) { s.orbit.a.loc.getWorldPosition(__rjV); const ph = s.orbit.ph + s.age * 7; s.spr.position.set(__rjV.x + Math.cos(ph) * s.orbit.r, __rjV.y + Math.sin(ph) * s.orbit.r, __rjV.z + s.orbit.r * 0.6 + 0.06 * Math.sin(ph * 2)); }
    else { s.vel[2] -= 6 * d; s.spr.position.x += s.vel[0] * d; s.spr.position.y += s.vel[1] * d; s.spr.position.z += s.vel[2] * d; }
    const pop = u < 0.15 ? u / 0.15 * 1.25 : 1.25 - 0.45 * (u - 0.15), sz = s.size * pop; s.spr.scale.set(sz, sz, sz);
    s.spr.material.rotation += s.spin * d; s.spr.material.opacity = u > 0.7 ? (1 - u) / 0.3 : 1;
  }
  for (const k of __rjStreaks) {
    if (!k.on) continue;
    k.age += d; const u = k.age / k.life;
    if (u >= 1) { k.on = false; k.m.visible = false; k.rj.alive[k.key]--; continue; }
    k.m.scale.set(k.len * (0.4 + 0.6 * Math.min(1, u * 3)), k.wid, 1); k.m.material.opacity = 0.75 * (1 - u);
  }
  for (const k of __rjShocks) {
    if (!k.on) continue;
    k.age += d; const u = k.age / k.life;
    if (u >= 1) { k.on = false; k.m.visible = false; continue; }
    const s = k.size * (0.2 + 0.8 * Math.sqrt(u)); k.m.scale.set(s, s, s); k.m.material.opacity = 0.5 * (1 - u) * (1 - u);
  }
}
${figHasHeroJuice ? `// a HERO's facts (gameworld/feel/hero-juice.js), the platform rule's as this frame leaves them: its speed along the
// ground, a jump's frame and an air jump's, the landing's and how hard, a hard stop, its share of the top speed, a surge,
// the charge, a blow taken (its hits counted up), a bump (speed lost in an instant)
function __rjHero(rj, e, F, d) {
  // (its speed along the ground from how far it went: the rule moves a body directly, its vel the vertical's; a jump
  // across the map, a respawn, read as none)
  const p = e.transform.pos, R = e.rule || {}, step = rj.hpos && d > 0 ? Math.hypot(p[0] - rj.hpos[0], p[1] - rj.hpos[1]) / d : 0, sp = step > 60 ? 0 : step; rj.hpos = [p[0], p[1]];
  const acc = d > 0 ? (sp - (rj.hv || 0)) / d : 0; rj.hv = sp; rj.hacc = (rj.hacc || 0) + (acc - (rj.hacc || 0)) * Math.min(1, d * 8);
  const air = e.airJumpsUsed || 0, hits = e.hits || 0;
  F.speed = sp; F.accel = rj.hacc; F.grounded = e.grounded ? 1 : 0;
  F.airJump = air > (rj.air || 0) ? 1 : 0; F.takeoff = e.jumped && !F.airJump ? 1 : 0; rj.air = air;
  F.landed = e.landed ? 1 : 0; F.fall = Math.abs(e.landVel || 0);
  F.brake = e.grounded && rj.hacc < -14 && sp > 1 ? 1 : 0;
  F.topShare = sp / Math.max(4, e.boosting && R.boostSpeed ? R.boostSpeed : R.speed || 6);
  F.surge = e.boosting ? 1 : Math.max(0, Math.min(1, (rj.hacc - 6) / 10));
  F.charging = e.charging ? 1 : 0; F.charge = e.chargeFrac || 0;
  F.hit = hits > (rj.hits || 0) ? 1 : 0; rj.hits = hits;
  rj.himp = Math.max(0, (rj.himp || 0) - d); F.impact = acc < -40 && rj.himp === 0 ? 1 : 0; if (F.impact) rj.himp = 0.5;
}
` : ''}function __updateRacerJuice(dt) {
  const d = Math.min(0.05, dt || 0), t = __world.time || 0;
  for (const e of __world.entities) {
    const body = __bodies[e.id], rf = body && body.userData && body.userData.rigFig, rj = rf && rf.rj;
    if (!rj) continue;
    rj.skidT = e.skidding ? rj.skidT + d : 0;
    const R = e.rule || {}, vv = e.speed || 0, corner = (vv * vv * Math.abs(Math.tan(e.steerAngle || 0))) / Math.max(0.3, R.wheelbase || 1) / (Math.max(0.2, R.grip || 1) * 9.81);
    rj.cornerT = corner > 0.6 ? (rj.cornerT || 0) + d : 0;
    const hp = e.hp != null && e.hpMax ? 1 - e.hp / e.hpMax : (e.damage || 0);
    // R4's facts: the speed's change (smoothed), a bump (more speed lost in an instant than any brake: an edge, with a
    // cooldown), a boost's first frame, the share of the top speed, a surge (a boost, or a hard pull)
    const acc = d > 0 ? (Math.abs(vv) - rj.prevV) / d : 0; rj.prevV = Math.abs(vv); rj.accel += (acc - rj.accel) * Math.min(1, d * 8);
    rj.impactCD = Math.max(0, rj.impactCD - d);
    const impact = acc < -28 && rj.impactCD === 0 ? 1 : 0; if (impact) rj.impactCD = 0.6;
    const boosting = e.boosting || (e.boostT || 0) > 0 ? 1 : 0, boostStart = boosting && !rj.wasBoost ? 1 : 0; rj.wasBoost = !!boosting;
    const topShare = Math.abs(vv) / Math.max(6, R.topSpeed || 13), surge = boosting ? 1 : Math.max(0, Math.min(1, (rj.accel - 4) / 6));
    const F = { speed: Math.abs(e.speed || 0), throttle: e.throttle || 0, braking: e.braking ? 1 : 0, steer: e.steerAngle || 0, skidding: e.skidding ? 1 : 0, skidTime: rj.skidT, corner, cornerTime: rj.cornerT, landed: e.landed ? 1 : 0, boosting, boostStart, accel: rj.accel, topShare, surge, impact, hit: e.hit || e.hitStart ? 1 : 0, charge: e.boostCharge != null ? e.boostCharge : (e.charge || 0), shield: e.shield ? 1 : 0, invulnerable: e.invulnerable || e.star ? 1 : 0, item: e.item ? 1 : 0, offroad: ${driveSurface ? `(__surface(e.transform.pos) || { mu: 1 }).mu < 0.85 ? 1 : 0` : '0'}, damage: hp };
${figHasHeroJuice ? `    if (rj.J.hero) __rjHero(rj, e, F, d);
` : ''}    for (const row of rj.J.rows) {
      const on = !!__rjWhen(row.when, F);
      if (row.look === 'flame') continue;
      if (row.look === 'ring') { if (on) __rjRing(rj, row, e); continue; }
      if (!on) continue;
      const tier = row.tierBy ? Math.max(0, row.tierAt.filter((x) => F[row.tierBy] >= x).length - 1) : 0;
      for (const a of rj.anchors) {
        if (!__rjMatch(row.at, a.kind)) continue;
        const k = row.id + '|' + a.kind + a.loc.id; rj.acc[k] = (rj.acc[k] || 0) + (row.look === 'trail' ? 30 : (row.rate || 10)) * d;
        while (rj.acc[k] >= 1) { rj.acc[k] -= 1; __rjSpawn(rj, row, a, e, F, tier); }
      }
    }
    for (const f of rj.flames) {
      const want = __rjWhen(f.row.when, F) ? 1 : 0; f.amt += (want - f.amt) * Math.min(1, d * 18);
      if (f.amt < 0.02) { if (f.holder.visible) f.holder.visible = false; continue; }
      f.holder.visible = true;
      const fl = 1 - (f.row.flicker || 0.2) + (f.row.flicker || 0.2) * (0.5 + 0.5 * Math.sin(t * 47 + f.holder.id));
      f.holder.scale.set(0.6 + 0.4 * f.amt, f.amt * fl, 0.6 + 0.4 * f.amt);
      f.outer.material.opacity = f.outer.userData.o * f.amt; f.inner.material.opacity = f.inner.userData.o * f.amt;
    }
    __rjStatus(rj, F, d, t);
    __rjFx(rj, e, F, d);${figHasLights ? `
    if (rj.lights) __rjLightsTick(rj, e, F, d);` : ''}
  }
  for (const p of __rjParts) {
    if (!p.on) continue;
    p.age += d; const u = p.age / p.life;
    if (u >= 1) { p.on = false; p.spr.visible = false; p.rj.alive[p.key]--; continue; }
    p.vel[2] += p.grav * d; const drag = Math.max(0, 1 - d * 2.2); p.vel[0] *= drag; p.vel[1] *= drag;
    p.spr.position.x += p.vel[0] * d; p.spr.position.y += p.vel[1] * d; p.spr.position.z = Math.max(0.02, p.spr.position.z + p.vel[2] * d);
    const s = p.s0 + (p.s1 - p.s0) * u; p.spr.scale.set(s, s, s);${figHasJuiceFid ? `
    if (p.spin) p.spr.material.rotation += p.spin * d;` : ''}
    p.spr.material.color.copy(p.c0).lerp(p.c1, u); p.spr.material.opacity = p.o0 * (1 - u) * (1 - u * 0.3);
  }
  for (const g of __rjRings) {
    if (!g.on) continue;
    g.age += d; const u = g.age / g.life;
    if (u >= 1) { g.on = false; g.m.visible = false; continue; }
    const s = g.size * (0.35 + 0.65 * Math.sqrt(u)); g.m.scale.set(s, s, s); g.m.material.opacity = 0.85 * (1 - u);
  }
  __rjPools(d);
}
` : ''}${figHasLive ? `// THE LIVE VEHICLE (car-designer/racer.js \`live\`): the drive rule's facts, exaggerated, as bone overlays. Springs
// per rig (rig.lv): the lean out of a turn, the pitch (a squat on the throttle, a dive on the brake), the bounce of a
// landing (a damped spring), an engine's idle shiver; the front wheels' steer, the steering wheel's turn, a mast's
// whip and a propeller's spin. → per bone: 'steer' | 'body' | 'wheel' | 'mast' and the frame's quaternions.
const __lvQ = new THREE.Quaternion(), __lvQB = new THREE.Quaternion(), __lvQP = new THREE.Quaternion(), __lvQS = new THREE.Quaternion(), __lvQW = new THREE.Quaternion(), __lvQM = new THREE.Quaternion(), __lvH = new THREE.Vector3();
const __LV_X = new THREE.Vector3(1, 0, 0), __LV_Y = new THREE.Vector3(0, 1, 0), __LV_Z = new THREE.Vector3(0, 0, 1);
${figHasRide ? `const __lvQR = new THREE.Quaternion(), __lvA = new THREE.Vector3();
` : ''}function __rigLive(e, rig, dt) {
  const L = rig.fig.live, G = L.gains, d = Math.min(0.05, dt || 0);
  if (!rig.lv) { rig.lv = { lean: 0, pitch: 0, bz: 0, vz: 0, spin: 0, whip: 0, role: {} }; rig.fig.bones.forEach((b, i) => { if (L.steer.includes(b.id)) rig.lv.role[i] = 'steer'; else if (b.id === L.wheel) rig.lv.role[i] = 'wheel'; else if (b.id === L.mast) rig.lv.role[i] = 'mast'; else if (L.body.bones.includes(b.id)) rig.lv.role[i] = 'body'; }); }
${figHasRide ? `  if (L.ridden && !rig.lv.at) { rig.lv.at = {}; rig.lv.pv = [0, 0, 0]; rig.lv.lift = 0; rig.fig.bones.forEach((b, i) => { if (L.steerAt && L.steerAt[b.id]) rig.lv.at[i] = L.steerAt[b.id]; }); }
` : ''}  const S = rig.lv, v = e.speed || 0, st = e.steerAngle || 0, k = (r) => Math.min(1, d * r);
  const steer = Math.max(-G.steerMax, Math.min(G.steerMax, st * G.steer));
  S.lean += (Math.max(-G.leanMax, Math.min(G.leanMax, ${figHasRide ? `L.lean === 'rule' ? -(e.lean || 0) : ` : ''}st * Math.abs(v) * G.lean)) - S.lean) * k(6);
${figHasRide ? `  // (a three-wheeler: the turn's pull, v² tan(steer) / wheelbase, against what tips it toward the outside, ssf·g;
  // the inner wheel lifts over its last 30%, about the outer edge where the centre of mass meets it)
  if (L.lift) {
    const lat = v * v * Math.tan(st) / L.lift.wb, E = lat >= 0 ? L.lift.r : L.lift.l, a = Math.abs(lat) / (E.ssf * 9.81);
    S.lift += (Math.sign(lat) * G.liftMax * Math.max(0, Math.min(1, (a - 0.7) / 0.3)) - S.lift) * k(6);
    S.pv[0] = S.lift >= 0 ? L.lift.r.x : L.lift.l.x; S.pv[1] = L.body.pivot[1]; S.pv[2] = L.body.pivot[2];
  }
` : ''}  S.pitch += ((e.throttle || 0) * G.squat * (v >= 0 ? 1 : -1) - (e.braking ? G.dive : 0) - S.pitch) * k(5);
  if (e.landed) S.vz -= G.bounce * 4;
  S.vz += (-140 * S.bz - 11 * S.vz) * d; S.bz += S.vz * d;
  S.spin += d * (5 + Math.abs(v) * 1.6);
  S.whip += (Math.min(G.wobbleMax, Math.abs(v) * G.wobble) + (e.braking ? -0.15 : 0) - S.whip) * k(4);
  const shiver = (e.throttle || 0) > 0.05 || Math.abs(v) < 0.5 ? 0.004 * Math.sin((__world.time || 0) * 52) : 0;
  __lvQS.setFromAxisAngle(__LV_Z, steer);
${figHasRide ? `  if (L.steerAxis) __lvQR.setFromAxisAngle(__lvA.fromArray(L.steerAxis), steer);
` : ''}  __lvQW.setFromAxisAngle(__LV_Y, -steer * 2.2);
  __lvQB.setFromAxisAngle(__LV_Y, S.lean${figHasRide ? ` + (L.lift ? S.lift : 0)` : ''}); __lvQP.setFromAxisAngle(__LV_X, S.pitch); __lvQB.multiply(__lvQP);
  __lvQM.setFromAxisAngle(__LV_X, S.whip + 0.05 * Math.sin((__world.time || 0) * 9) * Math.min(1, Math.abs(v) / 8));
  if (L.spin) { __lvQ.setFromAxisAngle(__LV_Z, S.spin); __lvQM.multiply(__lvQ); }
  return { role: S.role, steer: __lvQS, wheel: __lvQW, body: __lvQB, mast: __lvQM, pivot: ${figHasRide ? `L.lift ? S.pv : ` : ''}L.body.pivot, dz: Math.max(-0.2, S.bz) + shiver${figHasRide ? `, rides: !!L.ridden, at: S.at, axisQ: __lvQR` : ''} };
}
` : ''}${figHasForms ? `// A BODY IN TWO FORMS (transformation/compose.js): the base form plays the plain clips; another form plays its own
// (\`vehicle:drive\`), holding its rest (\`vehicle:idle\`) for any it has none of; the transformation's clips
// (\`transform:vehicle\`) play as named.
function __formMode(fig, e, mode) {
  if (mode.indexOf(':') >= 0 && fig.clips[mode]) return mode;
  const f = e.form || fig.forms.base;
  if (f === fig.forms.base) return mode;
  const k = f + ':' + mode;
  return fig.clips[k] ? k : f + ':idle';
}
` : ''}${acts ? `// a battle act's clip among the figure's own: the first it has of the act's names (its swing, its recoil, its fall)
const __ACT_CLIPS = { strike: ['strike', 'swing_neutral', 'swing', 'attack', 'punch'], cast: ['cast', 'strike', 'swing_neutral'], hurt: ['stagger', 'hitHigh', 'flinch'], fall: ['topple', 'knockedOutDown', 'fall'] };
function __actClip(fig, is) { const L = __ACT_CLIPS[is] || []; for (let i = 0; i < L.length; i++) if (fig.clips[L[i]]) return L[i]; return null; }
// A BATTLE ACT (the party battles' juice, rpg-channel.js: e.act { is, t0, for, to? }): the figure plays its own clip for it
// at the act's phase on the world's clock (a fight holds the world still, its clock running), a strike leaning toward its
// target and back; a fall holds its last frame; a figure without the clip plays nothing new (A.clip says which it played)
function __actMode(fig, e, m) {
  const A = e.act, at = A ? ((__world.time || 0) - A.t0) / A.for : -1;
  if (!(A && at >= 0 && (at <= 1 || A.is === 'fall'))) { if (A && at > 1) e.act = null; return null; }
  const c = __actClip(fig, A.is); A.clip = c;
  const T = A.to && A.is === 'strike' ? __world.byId[A.to] : null;
  if (T && at <= 1) { const dx = T.transform.pos[0] - e.transform.pos[0], dy = T.transform.pos[1] - e.transform.pos[1], d = Math.hypot(dx, dy) || 1, k = Math.sin(Math.PI * at) * Math.min(1.2, d * 0.4) / d; m.position.x += dx * k; m.position.y += dy * k; }
  return c ? { mode: c, phase: Math.min(at, 0.999) } : null;
}
` : ''}${figHasLayers ? `// POSE LAYERS (\`body.layers: { run?, combat?: [{ pivot, chain, axis, deg }] }\`, an action hero's: gameworld/levels.js): a
// pose laid over the clip a state plays, each op turning its pivot bone (figure-local: right +x, forward +y, up +z) and
// carrying its chain round the pivot's head: the run's legs set apart, combat's guard (leaning in, the weapon arm up, the
// feet wide). A layer eases in and out (8/s) with its state: the run while running out of combat, combat while in it
// and not striking (the strike's clip owns the body)
const __plH = new THREE.Vector3(), __plAx = new THREE.Vector3();
function __poseLayers(e, fig, dt) {
  const L = e.body.layers, W = e.__plw || (e.__plw = {}), out = [];
  if (!fig.__pl) fig.__pl = {};
  const busy = e.swingT != null || e.dodgeT != null || e.staggerT != null${moveset ? ' || !!e.mvPose' : ''};${moveset ? '   // (a sidearm\'s aim owns the body as a swing does)' : ''}
  const want = { run: e.moving && !e.combat && (e.locomotion === 'forward' || e.locomotion === 'sprint') ? 1 : 0, combat: e.combat && !busy${moveset ? ' && !(e.moving && e.rule && e.rule.moveset)' : ''} ? 1 : 0 };${moveset ? '   // (a moveset\'s hero on the move carries its blade in its gaits: hero-swing-body.js carryArm)' : ''}
  for (const name in L) {
    W[name] = (W[name] || 0) + ((want[name] || 0) - (W[name] || 0)) * Math.min(1, (dt || 0) * 8);
    if (W[name] < 1e-3) continue;
    const ops = fig.__pl[name] || (fig.__pl[name] = L[name].map((o) => ({ pi: fig.bones.findIndex((b) => b.id === o.pivot), ix: new Set(o.chain.map((c) => fig.bones.findIndex((b) => b.id === c)).filter((i) => i >= 0)), axis: o.axis, rad: o.deg * Math.PI / 180, q: new THREE.Quaternion(), at: null })).filter((o) => o.pi >= 0));
    for (const op of ops) { op.at = null; __plAx.set(op.axis[0], op.axis[1], op.axis[2]).normalize(); op.q.setFromAxisAngle(__plAx, op.rad * W[name]); out.push(op); }
  }
  return out.length ? out : null;
}
` : ''}${moveset ? `// A SIDEARM'S AIM LAYER (gameworld/combos.js a weapon's sidearm, hero-swing-body.js aimClip): its weight eased in and
// out (a tenth of a second), the bones below the spine (the hips, the legs) left to the walk; the spine's base its root
const __aimQX = new THREE.Quaternion(), __aimQY = new THREE.Quaternion(), __aimAX = new THREE.Vector3(1, 0, 0), __aimH = new THREE.Vector3();
const __aimQ = new THREE.Quaternion(), __aimP = [0, 0, 0], __AIM_LOW = /^(pelvis|thigh|shank|hipFold|kneeFold|foot|toes)/;
function __aimLayer(rig, fig, AP, dt) {
  const A = rig.aim || (rig.aim = { w: 0, clip: null, phase: 0, d: [0, 0, 0] });
  if (AP) { if (AP.clip !== A.clip) A.corr = null; A.clip = AP.clip; A.phase = AP.phase; A.prop = AP.prop || null; A.side = !!AP.sidearm; }
  A.w = Math.max(0, Math.min(1, A.w + (AP ? 1 : -1) * (dt || 0) / 0.1));
  if (A.w <= 1e-3 || !A.clip || !fig.clips[A.clip]) return null;
  if (!fig.__aimLow) { fig.__aimLow = fig.bones.map((b) => __AIM_LOW.test(b.id)); fig.__aimRoot = fig.bones.findIndex((b) => b.id === 'lumbar'); }
  A.lower = fig.__aimLow; A.root = fig.__aimRoot; A.d[0] = A.d[1] = A.d[2] = 0;
  // ON THE TARGET: the body above the hips turned by the pitch and the yaw the props measured it still lacks (A.corr,
  // __sidearmProps), about the spine's base
  // (a sidearm's aim only: a guard's pose stands as it was solved)
  const C = A.corr || (A.corr = [0, 0]), k = A.side ? A.w : 0;
  __aimQY.setFromAxisAngle(__RIG_Z, C[1] * k); __aimQX.setFromAxisAngle(__aimAX, C[0] * k);
  if (!A.q) A.q = new THREE.Quaternion();
  A.q.copy(__aimQY).multiply(__aimQX); A.at = null;
  return A;
}
// THE SIDEARM IN HAND, drawn on the page at the posed hands while the aim is up: the bow (its limbs, bent as it draws,
// its string to the drawing hand, the arrow on it while one is nocked) or the guns (one a hand, a dual sidearm's two),
// in the figure's own frame (x right, y forward, z up, metres)
const __spV = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], __spY = new THREE.Vector3(0, 1, 0), __spD = new THREE.Vector3(), __spM = new THREE.Matrix4(), __spX = new THREE.Vector3(), __spZ = new THREE.Vector3();
function __spRod(r, col) { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 6), new THREE.MeshBasicMaterial({ color: col })); o.raycast = function () {}; return o; }
function __spSpan(o, a, b) { __spD.subVectors(b, a); const L = __spD.length() || 1e-4; o.position.addVectors(a, b).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(__spY, __spD.multiplyScalar(1 / L)); o.scale.set(1, L, 1); }
function __spBox(s, at, col, into) { const o = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), new THREE.MeshBasicMaterial({ color: col })); o.position.set(at[0], at[1], at[2]); o.raycast = function () {}; into.add(o); return o; }
function __spGun() { const g = new THREE.Group(); __spBox([0.035, 0.2, 0.045], [0, 0.06, 0.03], 0x2b2e33, g); __spBox([0.03, 0.05, 0.1], [0, -0.01, -0.03], 0x3a2a1e, g); __spBox([0.02, 0.03, 0.02], [0, 0.17, 0.035], 0x55595f, g); g.userData.mz = new THREE.Object3D(); g.userData.mz.position.set(0, 0.19, 0.035); g.add(g.userData.mz); return g; }
// ON THE TARGET: where the arrow (or the guns) points now (o, d: the figure's frame) against where the target is (the
// aim's: e.mvAim, the round's own line to the foe's body; none, straight ahead and level): the pitch and yaw still
// lacking, taken into the aim layer's turn (A.corr) a share at a time once the aim is all the way up
const __spT = new THREE.Vector3(), __spInv = new THREE.Matrix4();
function __spOnTarget(e, m, A, o, d) {
  if (!A || A.w < 0.99 || !A.corr) return;
  const M = e.mvAim;
  if (M) { m.updateMatrix(); __spInv.copy(m.matrix).invert(); __spT.set(M.from[0] + M.dir[0], M.from[1] + M.dir[1], M.from[2] + M.dir[2]).applyMatrix4(__spInv).sub(o); }
  else __spT.set(0, 1, 0);
  const el = (v) => Math.atan2(v.z, Math.hypot(v.x, v.y)), az = (v) => Math.atan2(-v.x, v.y);
  e.__aimErr = [Math.round((el(__spT) - el(d)) * 1800 / Math.PI) / 10, Math.round((az(__spT) - az(d)) * 1800 / Math.PI) / 10];   // (degrees still off: a check reads it)
  A.corr[0] = Math.max(-0.9, Math.min(0.9, A.corr[0] + 0.6 * (el(__spT) - el(d))));
  A.corr[1] = Math.max(-0.9, Math.min(0.9, A.corr[1] + 0.6 * (az(__spT) - az(d))));
}
function __sidearmProps(e, m, rig, fig, AL) {
  const R = e.mvRanged || {}, kind = AL ? AL.prop : null;
  let P = rig.props;
  if (!P) {
    const ix = (id) => fig.bones.findIndex((b) => b.id === id);
    P = rig.props = { hL: ix('handL'), hR: ix('handR'), fL: ix('foreArmL'), fR: ix('foreArmR'), bow: null, guns: null };
  }
  if (P.bow) P.bow.g.visible = kind === 'bow';
  if (P.guns) P.guns.g.visible = kind === 'guns';
  if (P.shield) P.shield.g.visible = kind === 'shield';
  if (rig.muzzle && rig.muzzle.userData.sidearm && kind !== 'guns') rig.muzzle = null;   // (the shot's flash from the gun that fired)
  if (!kind || P.hL < 0 || P.hR < 0 || P.fL < 0 || P.fR < 0) return;
  // each hand's grip: a hand's length past the wrist along the forearm
  const at = (h, f, out, k) => { const bh = fig.bones[h].head, bf = fig.bones[f].head; __spV[k].set(bh[0], bh[1], bh[2]).applyMatrix4(rig.boneMeshes[h].matrix); __spV[k + 1].set(bf[0], bf[1], bf[2]).applyMatrix4(rig.boneMeshes[f].matrix); __spD.subVectors(__spV[k], __spV[k + 1]).normalize(); out.copy(__spV[k]).addScaledVector(__spD, 0.07); return __spD.clone(); };
  const gL = new THREE.Vector3(), gR = new THREE.Vector3(), dL = at(P.hL, P.fL, gL, 0), dR = at(P.hR, P.fR, gR, 2);
  if (kind === 'bow') {
    if (!P.bow) {
      const g = new THREE.Group(), limbs = [], string = [__spRod(0.004, 0xeee6cf), __spRod(0.004, 0xeee6cf)];
      for (let i = 0; i < 8; i++) { const o = __spRod(0.016, 0x7a4a24); limbs.push(o); g.add(o); }
      string.forEach((o) => g.add(o));
      const shaft = __spRod(0.007, 0xc9a46a), head = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 6), new THREE.MeshBasicMaterial({ color: 0x9aa3ad }));
      head.raycast = function () {}; g.add(shaft); g.add(head);
      m.add(g); P.bow = { g, limbs, string, shaft, head };
    }
    const B = P.bow, bowHand = R.hand === 'right' ? gR : gL, pull = R.hand === 'right' ? gL : gR, k = AL.phase || 0;
    // the arrow's line: from the drawing hand to the bow hand (else the body's forward); the limbs square to it, upright
    const a = new THREE.Vector3().subVectors(bowHand, pull); if (a.lengthSq() < 0.01) a.set(0, 1, 0); a.normalize();
    const u = new THREE.Vector3(0, 0, 1).addScaledVector(a, -a.z).normalize(), H = 0.62, bend = 0.1 + 0.12 * k;
    const pt = (sg) => new THREE.Vector3().copy(bowHand).addScaledVector(u, sg * H).addScaledVector(a, -bend * sg * sg);
    let prev = pt(-1);
    for (let i = 0; i < 8; i++) { const nx = pt(-1 + (2 * (i + 1)) / 8); __spSpan(B.limbs[i], prev, nx); prev = nx; }
    const top = pt(1), bot = pt(-1), rest = new THREE.Vector3().addVectors(top, bot).multiplyScalar(0.5);
    const nock = e.weapon && e.weapon.charging ? pull : rest;
    __spSpan(B.string[0], top, nock); __spSpan(B.string[1], nock, bot);
    // the arrow on the string while one is nocked (its point past the bow)
    const armed = !!(e.weapon && e.weapon.ammo > 0 && !e.weapon.reloading);
    B.shaft.visible = B.head.visible = armed;
    if (armed) { const tip = new THREE.Vector3().copy(nock).addScaledVector(a, 0.78); __spSpan(B.shaft, nock, tip); B.head.position.copy(tip); B.head.quaternion.setFromUnitVectors(__spY, a); }
    __spOnTarget(e, m, AL, pull, a);
  } else if (kind === 'shield') {
    // THE SHIELD (a blade's guard): a round shield on the left forearm, its face out from the arm toward where the body
    // faces, its rim a band of iron, its boss at the middle
    if (!P.shield) {
      const g = new THREE.Group(), mk = (geo, col) => { const o = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col })); o.raycast = function () {}; g.add(o); return o; };
      mk(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 20), 0x6b4423); mk(new THREE.TorusGeometry(0.3, 0.018, 6, 24), 0x8a8f96).rotation.x = Math.PI / 2;
      mk(new THREE.SphereGeometry(0.06, 10, 6), 0xa9aeb5).position.y = 0.02;
      m.add(g); P.shield = { g };
    }
    // (the cylinder's axis, +y, its face's normal: turned onto the arm's outward side, square to the forearm)
    const n = new THREE.Vector3(0, 1, 0).addScaledVector(dL, -dL.y).normalize();
    if (n.lengthSq() < 1e-6) n.set(0, 1, 0);
    P.shield.g.position.copy(gL).addScaledVector(dL, -0.12).addScaledVector(n, 0.07);
    __spX.crossVectors(dL, n).normalize(); __spM.makeBasis(dL, n, __spX); P.shield.g.quaternion.setFromRotationMatrix(__spM);
  } else {
    if (!P.guns) { const g = new THREE.Group(), L = __spGun(), Rg = __spGun(); g.add(L); g.add(Rg); m.add(g); P.guns = { g, L, R: Rg }; }
    const G = P.guns;
    const place = (o, grip, d) => { __spZ.set(0, 0, 1).addScaledVector(d, -d.z).normalize(); __spX.crossVectors(d, __spZ).normalize(); __spM.makeBasis(__spX, d, __spZ); o.quaternion.setFromRotationMatrix(__spM); o.position.copy(grip); };
    place(G.R, gR, dR); place(G.L, gL, dL);
    G.L.visible = !!R.dual; G.R.visible = true;
    __spOnTarget(e, m, AL, R.dual ? new THREE.Vector3().addVectors(gL, gR).multiplyScalar(0.5) : gR, R.dual ? new THREE.Vector3().addVectors(dL, dR).normalize() : dR);
    const mz = (R.dual && e.weapon && (e.weapon.shots || 0) % 2 ? G.L : G.R).userData.mz; mz.userData.sidearm = true; rig.muzzle = mz;
  }
}
` : ''}function __syncRigEntity(e, m, rig, dt) {
  const yawA = e.transform.heading + rig.yaw;
  if (e.tumble && e.tumble.angle) {
    // ACROBATIC DODGE tumble: spin the WHOLE body a full turn about a world
    // horizontal axis (forward roll / backflip / barrel-roll) or vertical
    // (spin). Pivot about the body CENTER, not the feet, so it tumbles in place
    // instead of cartwheeling on the soles: q = R_tumble · R_yaw, and the group
    // origin is shifted so the point at local height c maps back to feet+c.
    __rigAxis.set(e.tumble.axis[0], e.tumble.axis[1], e.tumble.axis[2]);
    if (__rigAxis.lengthSq() < 1e-9) __rigAxis.set(0, 0, 1);
    __rigAxis.normalize();
    __rigQT.setFromAxisAngle(__rigAxis, e.tumble.angle);
    __rigQZ.setFromAxisAngle(__RIG_Z, yawA);
    m.quaternion.copy(__rigQT).multiply(__rigQZ);
    const c = (rig.fig.figH || 1) * 0.42;
    __rigPivot.set(0, 0, c).applyQuaternion(__rigQT);
    m.position.set(e.transform.pos[0] - __rigPivot.x, e.transform.pos[1] - __rigPivot.y, e.transform.pos[2] + c - __rigPivot.z);
  } else {
    ${figHasForms ? `if (e.tilt && rig.fig.forms) m.rotation.set(e.tilt.pitch || 0, e.tilt.roll || 0, yawA, 'ZYX');   // a flying form's attitude
    else ` : ''}m.rotation.set(0, 0, yawA);
  }
  ${figHasSquash ? `// the rule's squash and stretch (e.squash: [across, up]) about the feet, over the body's own scale
  if (e.squash || m.userData.s0 != null) {
    if (m.userData.s0 == null) m.userData.s0 = m.scale.z;
    const s0 = m.userData.s0, q = e.squash;
    if (q) m.scale.set(s0 * q[0], s0 * q[0], s0 * q[1]); else { m.scale.setScalar(s0); m.userData.s0 = null; }
  }
  ` : ''}const fig = rig.fig;
  ${figHasForms || acts || moveset || takes ? 'let' : 'const'} mode = e.moving ? e.locomotion : ${moveset ? "(e.idleClip && rig.fig.clips && rig.fig.clips[e.idleClip] ? e.idleClip : 'idle')" : "'idle'"};${moveset ? '   // (a moveset\'s hero in combat idles in its fighting stance: mv_ready)' : ''}${moveset ? `
  // A SIDEARM'S AIM (e.mvPose, combat-melee.js: the archer's draw at its share, the gunslinger's guns): the whole body
  // standing, the body above the hips over the walk (the aim layer in the bone loop, __aimLayer)
  const AP = e.mvPose && e.staggerT == null && fig.clips && fig.clips[e.mvPose.clip] ? e.mvPose : null;   // (none while reeling)
  if (AP && !e.moving) mode = AP.clip;
  const AL = __aimLayer(rig, fig, AP, dt);` : ''}${figHasForms ? `
  if (fig.forms) mode = __formMode(fig, e, mode);` : ''}${acts ? `
  const act = __actMode(fig, e, m), phase = act ? act.phase : e.gaitPhase;
  if (act) mode = act.mode;` : ''}${takes ? `
  // (a scene's take: the figure plays the script's clip at the line's phase while it stands; e.taking says which)
  const tk = __world.take && !e.moving && fig.clips[__world.take.clip] ? __world.take : null;
  if (tk) mode = tk.clip;
  e.taking = tk ? tk.clip : null;` : ''}
  const mix = __CW.advanceGaitMix(rig.mix, mode, ${takes ? `tk ? Math.min(tk.u, 0.999) : ` : ''}${moveset ? `(AP && mode === AP.clip ? AP.phase : ${acts ? 'phase' : 'e.gaitPhase'})` : acts ? 'phase' : 'e.gaitPhase'}, dt || 0, ${moveset ? "(typeof mode === 'string' && mode.indexOf('mv_') === 0 && e.rule && e.rule.moveset ? e.rule.moveset.blend : rig.blendTime)" : 'rig.blendTime'});${moveset ? '   // (into a move\'s own clip: the moveset\'s blend, its travel waiting it out: no foot slides)' : ''}
  const w = mix.prevMode ? mix.w * mix.w * (3 - 2 * mix.w) : 1;
  // head-look-at overlay (renderer-convergence step 2, procedural rung): ease the head bone's
  // yaw toward a tracked entity, clamped to a natural range — a runtime joint override no
  // frame stack can express.
  let lookWant = 0;
  if (rig.headTrack) {
    const tgt = (__world.entities || []).find((x) => x.id === rig.headTrack);
    if (tgt) {
      m.updateMatrixWorld();
      __rigT.set(tgt.transform.pos[0], tgt.transform.pos[1], tgt.transform.pos[2]);
      m.worldToLocal(__rigT);                                   // figure-local: forward = +y
      const a = Math.atan2(-__rigT.x, __rigT.y);
      lookWant = Math.max(-1.0, Math.min(1.0, a));
    }
  }
  rig.lookA += (lookWant - rig.lookA) * Math.min(1, (dt || 0) * 6);
  // A bake may carry an explicit 'idle' clip (an armed unit's standing hold —
  // unit-rig.js aim lock); standing still then plays it instead of snapping to
  // the raw rest pose. Bakes without one keep the statik rest, byte-identical.
  const hasIdle = !!fig.clips.idle;
  // per-slot arm overlay (R17): the active loadout slot can pose the right arm differently (the
  // bazooka's over-shoulder launch). Resolve the overlay for the shown weapon tag; the loop below
  // overrides upperArmR/forearmR/weapon_<tag> from it on the aim-locked clips it covers.
  let ov = null, ovClip = null;
  if (fig.armOverlays) {
    const lo = __entLoadout(e);
    const cfg = lo && lo[e.loadoutIdx || 0];
    // show may be a LIST [active, ...racked cosmetic tags] — the ACTIVE weapon is the first
    // entry; only it can carry an arm overlay (racked copies are display-only).
    const show0 = cfg && cfg.show;
    const show = Array.isArray(show0) ? show0[0] : show0;
    // a weapon tag selects its own overlay (over-shoulder bazooka); a slot that flags restHand
    // (a body-fired empty hand — head vulcan / torso beam) selects the __rest overlay so the freed
    // RIGHT arm settles into the ready guard instead of holding an invisible weapon. Opt-in per
    // slot: a hand-fired empty slot (wrist gatling / finger vulcan) keeps its arm POINTED, so it
    // must NOT set restHand.
    const overlayTag = show && fig.armOverlays[show] ? show : (cfg && cfg.restHand && fig.armOverlays.__rest ? '__rest' : null);
    if (overlayTag) {
      ov = fig.armOverlays[overlayTag];
      ovClip = mix.mode === 'idle' ? (hasIdle ? 'idle' : e.locomotion) : mix.mode;
    }
  }
  // LOOK-PITCH AIM (vertical): the body yaws to face the aim, but the arm holds a FIXED pitch — so
  // looking up/down never raised the weapon (only the fire ray followed pitch). Rotate the right arm
  // (upperArmR + forearmR + the active weapon bone) about the SHOULDER by the look pitch so the barrel
  // points where you aim. Ranged slots only; skipped while a swing / dodge / reaction owns the arm;
  // clamped so the arm never folds through the body. The over-shoulder overlay (above) sets the base
  // arm; this rotates that whole arm about the shoulder, so the launcher elevates rigidly.
  let apAng = 0, apSet = null, apPivot = null;
  {
    const lo = __entLoadout(e);
    const cfg = lo && lo[e.loadoutIdx || 0];
    const pitch = e.transform.pitch || 0;
    const owned = e.swingT != null || e.dodgeT != null || e.staggerT != null;
    // piloted suit only (a vacated suit keeps its last look pitch — don't let it hold a stale elevation)
    const piloted = !__world.pilotId || e.id === __world.pilotId;
    // R19 fix: a show:'none' slot (head vulcan / torso beam) fires from the BODY, not the hand — keep
    // the arm DOWN (skip the look-pitch raise) since there is no held weapon to point.
    // the ACTIVE tag when show is a [active, ...racked] list — racked copies never aim
    const showP = Array.isArray(cfg && cfg.show) ? cfg.show[0] : (cfg && cfg.show);
    if (piloted && cfg && cfg.weapon && !cfg.strike && showP !== 'none' && !owned && Math.abs(pitch) > 1e-3) {
      if (!fig.__armIdx) {
        fig.__armIdx = { up: fig.bones.findIndex((b) => b.id === 'upperArmR'), fo: fig.bones.findIndex((b) => b.id === 'forearmR'), hand: fig.bones.findIndex((b) => b.id === 'handR'), wtag: {} };
        fig.bones.forEach((b, i) => { if (b.id.indexOf('weapon_') === 0) fig.__armIdx.wtag[b.id.slice(7)] = i; });
      }
      if (fig.__armIdx.up >= 0 && fig.__armIdx.fo >= 0) {
        apAng = Math.max(-0.95, Math.min(0.95, pitch));   // ~±54° of arm elevation
        const wi = (showP && showP !== 'none') ? (fig.__armIdx.wtag[showP] ?? -1) : -1;
        // the FIST orbits the shoulder with the forearm (else it stays at the level 'middle' pose
        // while the arm + weapon elevate — the hand detaches from the wrist). −1 (hand-less) is inert.
        apSet = { up: fig.__armIdx.up, fo: fig.__armIdx.fo, w: wi, hand: fig.__armIdx.hand };
        __apQ.setFromAxisAngle(__RIG_X, apAng);   // +y forward → tips toward +z (up) for pitch>0
      }
    }
  }
${figHasLive ? `  const LV = fig.live ? __rigLive(e, rig, dt) : null;
` : ''}${figHasLayers ? `  const PL = e.body && e.body.layers ? __poseLayers(e, fig, dt) : null;
` : ''}  for (let bi = 0; bi < fig.bones.length; bi++) {
    const mesh = rig.boneMeshes[bi];
    if (!mesh) continue;
    __rigBone(fig, mix.mode === 'idle' ? (hasIdle ? 'idle' : e.locomotion) : mix.mode, mix.phase, mix.mode === 'idle' && !hasIdle, bi, __rigQA, __rigPA);
    if (mix.prevMode) {
      __rigBone(fig, mix.prevMode === 'idle' ? (hasIdle ? 'idle' : e.locomotion) : mix.prevMode, mix.prevPhase, mix.prevMode === 'idle' && !hasIdle, bi, __rigQB, __rigPB);
      __rigQA.slerp(__rigQB, 1 - w);
      __rigPA[0] += (__rigPB[0] - __rigPA[0]) * (1 - w);
      __rigPA[1] += (__rigPB[1] - __rigPA[1]) * (1 - w);
      __rigPA[2] += (__rigPB[2] - __rigPA[2]) * (1 - w);
    }${moveset ? `
    // the aim layer: each bone above the hips toward the aim clip's, carried with the spine's base onto the walk's
    if (AL && !AL.lower[bi]) {
      __rigBone(fig, AL.clip, AL.phase, false, bi, __aimQ, __aimP);
      if (bi === AL.root) { AL.d[0] = __rigPA[0] - __aimP[0]; AL.d[1] = __rigPA[1] - __aimP[1]; AL.d[2] = __rigPA[2] - __aimP[2]; }
      __rigQA.slerp(__aimQ, AL.w);
      for (let c = 0; c < 3; c++) __rigPA[c] += (__aimP[c] + AL.d[c] - __rigPA[c]) * AL.w;
      // (turned onto the target about the spine's base)
      if (bi === AL.root) AL.at = [__rigPA[0], __rigPA[1], __rigPA[2]];
      else if (AL.at) { __aimH.set(__rigPA[0] - AL.at[0], __rigPA[1] - AL.at[1], __rigPA[2] - AL.at[2]).applyQuaternion(AL.q); __rigPA[0] = AL.at[0] + __aimH.x; __rigPA[1] = AL.at[1] + __aimH.y; __rigPA[2] = AL.at[2] + __aimH.z; }
      __rigQA.premultiply(AL.q);
    }` : ''}
    if (fig.bones[bi].id === 'head' && Math.abs(rig.lookA) > 1e-4) {
      __rigQL.setFromAxisAngle(__RIG_Z, rig.lookA);
      __rigQA.premultiply(__rigQL);
    }
    // per-slot arm overlay: on the covered arm bones, REPLACE the base [q, head] with the
    // alternate-aim curve (over-shoulder bazooka). The weapon bone rides forearmR, so it follows.
    if (ov) { const j = ov.bones.indexOf(bi); if (j >= 0) __rigOverlay(ov, ovClip, mix.phase, j, __rigQA, __rigPA); }
    // look-pitch aim: rotate the arm about the shoulder. upperArmR (its head IS the shoulder) captures
    // the pivot + rotates in place; forearmR + the weapon bone orbit their heads about that pivot. Bone
    // order guarantees upperArmR is seen first, so apPivot is set before the others.
    if (apSet) {
      if (bi === apSet.up) { apPivot = [__rigPA[0], __rigPA[1], __rigPA[2]]; __rigQA.premultiply(__apQ); }
      else if (apPivot && (bi === apSet.fo || bi === apSet.w || bi === apSet.hand)) {
        __apH.set(__rigPA[0] - apPivot[0], __rigPA[1] - apPivot[1], __rigPA[2] - apPivot[2]).applyQuaternion(__apQ);
        __rigPA[0] = apPivot[0] + __apH.x; __rigPA[1] = apPivot[1] + __apH.y; __rigPA[2] = apPivot[2] + __apH.z;
        __rigQA.premultiply(__apQ);
      }
    }
${figHasLayers ? `    // POSE LAYERS (__poseLayers): each op turns its pivot bone and carries its chain round the pivot's head
    if (PL) for (const op of PL) {
      if (bi === op.pi) { op.at = [__rigPA[0], __rigPA[1], __rigPA[2]]; __rigQA.premultiply(op.q); }
      else if (op.at && op.ix.has(bi)) {
        __plH.set(__rigPA[0] - op.at[0], __rigPA[1] - op.at[1], __rigPA[2] - op.at[2]).applyQuaternion(op.q);
        __rigPA[0] = op.at[0] + __plH.x; __rigPA[1] = op.at[1] + __plH.y; __rigPA[2] = op.at[2] + __plH.z;
        __rigQA.premultiply(op.q);
      }
    }
` : ''}${turretOn ? `    // (a base's turret and gun bones turned by its turret, worlds/controllable/turret.js: turret-view.js)
    if (e.turret && e.turret.yaw !== undefined && window.__tvReady) __tvRigBone(e, fig, bi, __rigQA, __rigPA, mesh);
` : ''}${figHasLive ? `    // the live vehicle: a front wheel yaws about its hub; the steering wheel turns and a mast whips about their own heads,
    // then they, and the body, lean, pitch and bounce about the wheelbase's middle
    if (LV && LV.role[bi]) {
      const role = LV.role[bi];
${figHasRide ? `      // (a ridden machine's front turns about the steering axis, orbiting the head; then it leans with the rest)
      const A = LV.rides && role === 'steer' ? LV.at[bi] : null;
      if (A) {
        __lvH.set(__rigPA[0] - A[0], __rigPA[1] - A[1], __rigPA[2] - A[2]).applyQuaternion(LV.axisQ);
        __rigPA[0] = A[0] + __lvH.x; __rigPA[1] = A[1] + __lvH.y; __rigPA[2] = A[2] + __lvH.z;
        __rigQA.premultiply(LV.axisQ);
      } else if (role === 'steer') __rigQA.premultiply(LV.steer);
      if (role !== 'steer' || LV.rides) {` : `      if (role === 'steer') __rigQA.premultiply(LV.steer);
      else {`}
        if (role === 'wheel') __rigQA.premultiply(LV.wheel);
        else if (role === 'mast') __rigQA.premultiply(LV.mast);
        const P = LV.pivot;
        __lvH.set(__rigPA[0] - P[0], __rigPA[1] - P[1], __rigPA[2] - P[2]).applyQuaternion(LV.body);
        __rigPA[0] = P[0] + __lvH.x; __rigPA[1] = P[1] + __lvH.y; __rigPA[2] = P[2] + __lvH.z + LV.dz;
        __rigQA.premultiply(LV.body);
      }
    }
` : ''}    // M·v = head' + q·(v − restHead)  →  compose(position = head' − q·restHead, q, 1)
    const rh = fig.bones[bi].head;
    __rigH.set(rh[0], rh[1], rh[2]).applyQuaternion(__rigQA);
    __rigV.set(__rigPA[0] - __rigH.x, __rigPA[1] - __rigH.y, __rigPA[2] - __rigH.z);
    mesh.matrix.compose(__rigV, __rigQA, __RIG_ONE);
  }${moveset ? `
  __sidearmProps(e, m, rig, fig, AL);` : ''}${figHasFace ? `
  if (fig.face) __rigFace(rig, mix.mode === 'idle' ? (hasIdle ? 'idle' : e.locomotion) : mix.mode, mix.phase);` : ''}${takes && figHasFace ? `
  // (a taking face's weights, where a headless driver reads them: e.takeFace)
  if (fig.face) { const fm = tk ? rig.boneMeshes.find((x) => x && x.morphTargetInfluences && x.morphTargetInfluences.length) : null; e.takeFace = fm ? Array.from(fm.morphTargetInfluences) : null; }` : ''}
  // i-frame SHIMMER: while INVINCIBLE the whole rig flickers translucent — the
  // classic i-frame read. Both the acrobatic dodge and the getup rise set
  // e.invincible, so both shimmer; the topple FALL (not invincible) does not.
  // Restore full opacity when it ends.
  if (e.invincible) {
    const o = 0.45 + 0.35 * Math.sin(__world.time * 40);
    for (const bm of rig.skin ? [rig.skin] : rig.boneMeshes) { if (bm && bm.material) { bm.material.transparent = true; bm.material.opacity = o; } }   // (a merged figure: its one skin)
    rig.__shimmered = true;
  } else if (rig.__shimmered) {
    for (const bm of rig.skin ? [rig.skin] : rig.boneMeshes) { if (bm && bm.material) { bm.material.opacity = 1; bm.material.transparent = false; } }
    rig.__shimmered = false;
  }
}
// CONSOLIDATED weapon toggle (R15): a loadout slot may name a show tag instead of a per-weapon
// figure. The baked body carries a weapon_TAG bone per weapon (unit-rig splits them off, each
// riding forearmR); here we show ONLY the active slot's weapon bone — a weapon-only switch on ONE
// body, no figure-group swap. A loadout without show tags is untouched.
function __applyWeaponShow(e, rigFig) {
  const lo = __entLoadout(e);
  if (!lo) return;
  const cfg = lo[e.loadoutIdx || 0];
  const show = cfg && cfg.show;
  if (!show) return;
  // show is one tag OR a list [active, ...racked] — the drawn weapon plus any cosmetic
  // stowed copies visible on this slot (a saber racked on the back while the rifle is out).
  let tags = Array.isArray(show) ? show : [show];
  // STRIKE FORM (geof heat rod): a melee slot may carry strikeShow — extra weapon tags
  // shown ONLY while a swing is live, keyed by the swing direction (last _segment of the
  // playing clip name), with 'default' as the fallback. The whip lash EXTENDS out of the
  // retracted handle when a strike fires and slides back in when the clip ends; 'forward'
  // shows the straight rope-dart form instead of the curved lash. Slots without strikeShow
  // are untouched. (This comment stays backtick-free — the block is emitted inside a
  // template literal.)
  if (cfg.strikeShow && e.swingT != null) {
    const clip = typeof e.swingClip === 'string' ? e.swingClip : '';
    const dir = clip.slice(clip.lastIndexOf('_') + 1);
    const form = cfg.strikeShow[dir] || cfg.strikeShow.default;
    if (form) tags = tags.concat(form);
  }
  const key = tags.join('+');
  if (!rigFig.__wBones) {   // cache the weapon-bone meshes by tag once
    rigFig.__wBones = {};
    rigFig.fig.bones.forEach((bn, i) => { if (bn.id.indexOf('weapon_') === 0) rigFig.__wBones[bn.id.slice(7)] = rigFig.boneMeshes[i]; });
  }
  if (rigFig.__wShown === key) return;   // only touch visibility on an actual change
  rigFig.__wShown = key;
  for (const tag in rigFig.__wBones) { const mesh = rigFig.__wBones[tag]; if (mesh) mesh.visible = tags.indexOf(tag) !== -1; }
}
// R19: DESTRUCTIBLE SHIELD — when the engine flags e.shieldBroken, DROP the synthetic shield bone
// mesh (unit-rig split it off forearmL) and pop a one-shot shatter fx at its world position. Edge-run
// (only when the mesh is first hidden), so it fires once per break. Bodies with no shield are untouched.
// The reverse edge re-shows it: respawnEntity reforges the shield (shieldBroken back to false), so a
// fresh life spawns in carrying its shield again instead of fighting the rest of the match bare.
function __applyShieldBreak(e, rigFig) {
  if (rigFig.__shieldMesh === undefined) {   // cache once (null when the body has no shield bone)
    const si = rigFig.fig.bones.findIndex((b) => b.id === 'shield');
    rigFig.__shieldMesh = si >= 0 ? rigFig.boneMeshes[si] : null;
  }
  const mesh = rigFig.__shieldMesh;
  if (!mesh) return;
  if (!e.shieldBroken && !mesh.visible) { mesh.visible = true; return; }   // respawn reforged it
  if (e.shieldBroken && mesh.visible) {
    mesh.visible = false;
    const wp = new THREE.Vector3(); mesh.getWorldPosition(wp);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), __fxMat(0xffd27a));
    shell.position.copy(wp); shell.raycast = function () {}; scene.add(shell);
    __fx.push({ obj: shell, born: __world.time, ttl: 0.35, kind: 'burst', base: 2.4, dim: 0.7 });
    const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), __fxMat(0xffffff));
    flash.position.copy(wp); flash.raycast = function () {}; scene.add(flash);
    __fx.push({ obj: flash, born: __world.time, ttl: 0.14, kind: 'burst', base: 1.5, dim: 1 });
  }
}
function __syncEntity(e, dt) {
  let m = __bodies[e.id]; if (!m) return;
  if (e.gone) { if (m.visible) m.visible = false; return; }   // wreck finisher: the body detonated and is gone
  // loadout swap: the rule changed e.body.figure — show that variant's group from here on. The
  // gait-mix state carries over so the new body continues the crossfade instead of snapping.
  const ld = m.userData && m.userData.loadout;
  if (ld && e.body.figure !== ld.figName && ld.variants[e.body.figure]) {
    const nm = ld.variants[e.body.figure];
    m.visible = false;
    nm.visible = true;
    if (nm.userData.rigFig && m.userData.rigFig) nm.userData.rigFig.mix = m.userData.rigFig.mix;
    __bodies[e.id] = nm;
    m = nm;
  }
  // wreck finisher: a respawn cleared the vanish — re-show the body. NOT while the hangar
  // menu holds this body hidden (userData.hangarHidden, __showActive): this unconditional
  // per-frame re-show is what superposed every suit at the origin after the respawn work.
  if (!m.visible && !m.userData.hangarHidden${hideId ? ` && e.id !== ${JSON.stringify(hideId)}` : ''}) m.visible = true;${hideId ? `
  if (e.id === ${JSON.stringify(hideId)}) m.visible = false;   // first person: the eye rides inside this body` : ''}${xr ? `
  if (__xrCtl && __xrCtl.hides(e)) m.visible = false;   // in the headset: the player stands inside this body` : ''}
  m.position.set(e.transform.pos[0], e.transform.pos[1], e.transform.pos[2]);
  // hit flash: a hittable target (invincible) whitens for a beat when a shot lands, then restores.
  if (e.body && e.body.hittable && m.material) {
    const lit = e.hitFlash >= 0 && (__world.time - e.hitFlash) < 0.15;
    if (lit && !m.__flashed) { m.material.color.set(0xffffff); m.__flashed = true; }
    else if (!lit && m.__flashed) { m.material.color.set(e.body.color != null ? e.body.color : 0xff7a59); m.__flashed = false; }
  }
  // POLYGOMER body (platformer.plan.md P2): a rig-less baked mesh. Face it along heading (its authored
  // front is +y, so yaw −90° maps +y → forward) and give it its only animation — SQUASH & STRETCH,
  // driven off the platform rule's grounded/jump/land edges: stretch tall rising, squash flat on land.
  if (m.userData && m.userData.polygomer) {
    const yaw = e.body && e.body.yawOffset != null ? e.body.yawOffset : -Math.PI / 2;
    m.rotation.set(0, 0, e.transform.heading + yaw);
    let sxy = 1, sz = 1;
    if (!e.grounded) { const t = Math.max(-1, Math.min(1, (e.vel ? e.vel[2] : 0) / 9)); sz = 1 + 0.16 * t; sxy = 1 - 0.10 * t; }
    if (e.landed) m.userData.landT = 0.18;
    const lt = m.userData.landT || 0;
    if (lt > 0) { const k = lt / 0.18; sz *= 1 - 0.30 * k; sxy *= 1 + 0.22 * k; m.userData.landT = Math.max(0, lt - (dt || 0)); }
    m.scale.set(sxy, sxy, sz);
    return;
  }
  const rigFig = m.userData && m.userData.rigFig;
  if (rigFig) { __applyWeaponShow(e, rigFig); __syncRigEntity(e, m, rigFig, dt); __applyShieldBreak(e, rigFig); return; }
  const fig = m.userData && m.userData.fig;
  if (fig) {
    m.rotation.set(0, 0, e.transform.heading + fig.yaw);
${acts ? `    const act = __actMode(fig, e, m);
` : ''}    if (!fig.lerpable) {   // mismatched clip topologies → legacy frame snapping
      const clip = __figClipOf(fig, e, ${acts ? "act ? act.mode : " : ''}e.moving ? e.locomotion : 'idle');
      const N = clip.length, ph = ((${acts ? '(act ? act.phase : e.gaitPhase)' : 'e.gaitPhase'} % 1) + 1) % 1;
      const frame = ${acts ? 'act || ' : ''}e.moving ? (Math.floor(ph * N) % N) : 0;
      const attr = fig.mesh.geometry.getAttribute('position');
      if (attr.array.length === clip[frame].pos.length) {
        attr.array.set(clip[frame].pos); attr.needsUpdate = true;
        const cattr = fig.mesh.geometry.getAttribute('color');
        cattr.array.set(clip[frame].col); cattr.needsUpdate = true;
      } else {   // face count differs from the live buffer → rebuild attributes for this frame
        fig.mesh.geometry.setAttribute('position', new THREE.BufferAttribute(clip[frame].pos.slice(), 3));
        fig.mesh.geometry.setAttribute('color', new THREE.BufferAttribute(clip[frame].col, 3));
      }
      return;
    }
    const mode = ${acts ? 'act ? act.mode : ' : ''}e.moving ? e.locomotion : ${moveset ? "(e.idleClip || 'idle')" : "'idle'"};
    const mix = __CW.advanceGaitMix(fig.mix, mode, ${acts ? 'act ? act.phase : ' : ''}e.gaitPhase, dt || 0, ${moveset ? "(typeof mode === 'string' && mode.indexOf('mv_') === 0 && e.rule && e.rule.moveset ? e.rule.moveset.blend : fig.blendTime)" : 'fig.blendTime'});
    const attr = fig.mesh.geometry.getAttribute('position');
    const out = attr.array;
    out.fill(0);
    // smoothstep the crossfade so mode switches ease in/out instead of ramping linearly
    const w = mix.prevMode ? mix.w * mix.w * (3 - 2 * mix.w) : 1;
    __figAccum(out, __figClipOf(fig, e, mix.mode), mix.phase, mix.mode === 'idle', w);
    if (mix.prevMode) __figAccum(out, __figClipOf(fig, e, mix.prevMode), mix.prevPhase, mix.prevMode === 'idle', 1 - w);
    attr.needsUpdate = true;
  } else {
    // vehicle attitude (fly): e.tilt banks/pitches the mesh about its own axes — 'ZYX' applies
    // roll (body x), then pitch (body y, negated so nose-up pitches up), then the yaw.
    // Absent → the flat yaw-only read, byte-identical.
    if (e.tilt) m.rotation.set(e.tilt.roll || 0, -(e.tilt.pitch || 0), e.transform.heading, 'ZYX');
    else if (e.castDown) {   // felled by the cast: it lies along its heading, on the ground its feet were on
      m.rotation.set(0, Math.PI / 2, e.transform.heading, 'ZYX');
      m.position.z = e.transform.pos[2] - ((e.rule && e.rule.eye) || 0) + (Array.isArray(e.body.size) ? e.body.size[0] / 2 : (e.body.radius || 0));
    }
    else m.rotation.set(0, 0, e.transform.heading);   // yaw about +Z (z-up)
  }
}
// WALL PULL-IN (camera-tuning.plan.md): a chase cam behind a wall-backed suit ends up INSIDE the
// wall, filling the screen. Cast from the framed subject (lookAt, ~suit chest) toward the eased eye
// and, if a WORLD surface blocks the view, clamp the rendered eye to just in front of it so the suit
// stays visible. View-only (never touches sim state); mirrors __ground's mesh-only / skip-own-body
// filter, so it collides on level geometry but never on suit bodies.
const __camRay = new THREE.Raycaster();
let __camCd = 1;   // current eye distance as a fraction of the full follow distance (1 = no pull-in)
const __followPullIn = ${followPullIn.toString()};
function __driveCamera(dt) {
  const c = __world.camera; if (!c) return;
  const p = c.transform.pos;
  let look = c.lookAt;
  if (!look) { const h = c.transform.heading, pi = c.transform.pitch || 0; look = [p[0] + Math.cos(pi) * Math.cos(h), p[1] + Math.cos(pi) * Math.sin(h), p[2] + Math.sin(pi)]; }
  let px = p[0], py = p[1], pz = p[2];
  if (c.rule && c.rule.type === 'follow') {
    const dx = p[0] - look[0], dy = p[1] - look[1], dz = p[2] - look[2];
    const full = Math.hypot(dx, dy, dz);
    if (full > 1e-3) {
      const ux = dx / full, uy = dy / full, uz = dz / full;
      __camRay.set(new THREE.Vector3(look[0], look[1], look[2]), new THREE.Vector3(ux, uy, uz));
      __camRay.far = full; __camRay.camera = camera;   // sprite-safe traverse (see __ground's E8 note)
      const own = __bodySet();
      let hitD = full;
      for (const hit of __camRay.intersectObjects(scene.children, true)) {
        const ho = hit.object;
        if (!ho.isMesh || (ho.material && ho.material.depthTest === false)) continue;   // meshes only; skip overlay quads (fog/effects)
        let o = ho, isOwn = false; while (o) { if (own.includes(o)) { isOwn = true; break; } o = o.parent; }
        if (isOwn) continue;   // never pull in on an entity body (suits) — world geometry only
        hitD = hit.distance; break;   // nearest world surface between subject and eye
      }
      // the stand-off and the floor are the subject's own (follow-pull-in.js): its far side across the ground from the
      // look point (its collide volume, capsule or body radius), its capsule height, and the near plane kept off it
      const tg = __world.byId[c.rule.target], tb = (tg && tg.body) || {};
      const lead = tg ? Math.hypot(look[0] - tg.transform.pos[0], look[1] - tg.transform.pos[1]) : 0;
      const rad = (tg && tg.collideVol && tg.collideVol.a) || (tg && tg.rule && tg.rule.collideRadius) || (tb.egg ? tb.egg.a : tb.radius) || 0;
      const target = __followPullIn(full, hitD, lead, Math.hypot(ux, uy), rad, (tg && tg.rule && tg.rule.collideHeight) || 0, camera.near, c.rule.standOff);
      // pull IN instantly (never flash the wall); ease OUT so leaving cover doesn't snap the framing.
      if (target < __camCd) __camCd = target;
      else __camCd += (target - __camCd) * (1 - Math.exp(-6 * (dt || 0)));
      px = look[0] + ux * full * __camCd;
      py = look[1] + uy * full * __camCd;
      pz = look[2] + uz * full * __camCd;
    }
  }
  camera.position.set(px, py, pz);
  camera.lookAt(look[0], look[1], look[2]);
  if (c.roll) camera.rotateZ(-c.roll);   // a follow camera banking with its target (rollFollow): about the view axis
}
${driveSurface ? `// surface hook (roads/surface.js): what a car's tyres are on, for the vehicle classes' rule
const __surfaceT = ${safeJson(driveSurface)};
const __surfaceAt = ${surfaceAt.toString()};
const __surface = (p) => __surfaceAt(__surfaceT, p);
` : ''}${groundGridScript()}// ground hook: nearest scene surface straight below (excluding entity bodies), for walk entities.
const __groundRay = new THREE.Raycaster();
const __bodySet = () => Object.values(__bodies);
let __gridOn = false;
function __ground(pos) {
  // (the big static meshes take straight-down rays by grid, indexed at the first probe: every mesh is built by then)
  if (!__gridOn) { __gridOn = true; __gridMeshes(); }
  // Probe straight down FROM the passed origin — the CALLER chooses the height. The walk rule passes
  // its eye position (finds the floor below it); the platform rule passes feet+step (so it lands on the
  // surface under the FEET and ignores platforms whose tops sit above them — you jump onto a ledge, you
  // do not warp up into it by walking into its base). (Was pos.z+20, which grabbed any overhead surface.)
  __groundRay.set(new THREE.Vector3(pos[0], pos[1], pos[2] + 0.05), new THREE.Vector3(0, 0, -1));
  // decoration safety (E8): only MESHES are footing. THREE.Sprite.raycast dereferences
  // raycaster.camera — without it, ONE glow sprite anywhere in the scene (a tracer/comet head)
  // kills the first ground probe of a walk/platform entity; and THREE.Line raycasts with a fat
  // default threshold, so an orbit/track line reads as a floor 0.6 units up. Set the camera so
  // the traverse survives whatever channels add, and skip every non-mesh hit.
  __groundRay.camera = camera;
  const own = __bodySet();
  const hits = __groundRay.intersectObjects(scene.children, true);
  for (const hit of hits) { if (!hit.object.isMesh) continue; let o = hit.object; while (o) { if (own.includes(o)) break; o = o.parent; } if (!o) return hit.point.z; }
  return null;
}
// input: keys → normalized axes, mouse → look deltas (consumed each frame). Which key, pad button or
// mouse button serves an action is the pilot scheme's (controls/schemes.js), read through the controls
// kernel per device family (controls/devices.js); __BIND is the live table, so a remap replaces it and
// nothing below changes. This page drives the keyboard, mouse and standard-mapping gamepad families.
const __CTL = (${buildControlsKernel.toString()})();
const __SCHEME = ${safeJson(SCHEMES.pilot)};
const __DEV = ${safeJson({ keyboard: DEVICES.keyboard, mouse: DEVICES.mouse, gamepad: DEVICES.gamepad })};
let __BIND = __CTL.resolve(__SCHEME, __DEV);
const __held = {};
${seats ? `// SEATS: seat 1 reads the keyboard only while the keyboard is its controller (or nobody has sat down yet)
let __seat1 = null;
const __kbRead = (c) => (__seat1 && __seat1 !== 'keyboard' ? false : __held[c]);` : 'const __kbRead = (c) => __held[c];'}
const __k = (id) => __CTL.held(__BIND, id, 'keyboard', __kbRead);
const __mb = (id, e) => __CTL.is(__BIND, id, 'mouse', Object.keys(__DEV.mouse.buttons).find((n) => __DEV.mouse.buttons[n] === e.button));
let __usePad = false;   // the device the player last used (a prompt names its key): a key press says keyboard, pad activity the pad
window.addEventListener('keydown', (e) => { __held[e.code] = true; __usePad = false; if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); });
window.addEventListener('keyup', (e) => { __held[e.code] = false; });
let __lookDX = 0, __lookDY = 0, __drag = false, __fireDown = false;${moveset ? ' let __heavyDown = false, __specialDown = false, __cycleDown = false;' : ''}
const __canvas = renderer.domElement;
const __MOUSELOOK = ${!!(camera && (camera.turnMode === 'look' || camera.mouseLook))};   // FPS look camera?
if (__MOUSELOOK) {
  // pointer-lock FPS look: click once to capture the mouse, then RAW moves steer (no drag to hold).
  // both axes NEGATED so the view AGREES with the hand: swipe left looks left, push up looks up.
  __canvas.addEventListener('click', () => { if (document.pointerLockElement !== __canvas) __canvas.requestPointerLock(); });
  document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === __canvas) { __lookDX -= e.movementX || 0; __lookDY -= e.movementY || 0; } });
  // FIRE = left mouse, but ONLY once the pointer is captured (the first click captures the mouse and
  // does not fire). The weapon subsystem gates ROF / semi-edge / reload, so this is a raw held flag.
  __canvas.addEventListener('mousedown', (e) => { if (__mb('fire', e) && document.pointerLockElement === __canvas) __fireDown = true; });
  window.addEventListener('mouseup', (e) => { if (__mb('fire', e)) __fireDown = false; });${moveset ? `
  // A MOVESET's beats (gameworld/combos.js): heavy the right click, special the mouse's forward button, once the pointer
  // is captured; neither opens the menu nor turns the browser's page (preventDefault on the side buttons)
  __canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  __canvas.addEventListener('mousedown', (e) => { if (document.pointerLockElement !== __canvas) return; if (__mb('heavy', e)) __heavyDown = true; if (__mb('special', e)) { e.preventDefault(); __specialDown = true; } if (__mb('cycleWeapon', e)) { e.preventDefault(); __cycleDown = true; } });
  window.addEventListener('mouseup', (e) => { if (__mb('heavy', e)) __heavyDown = false; if (__mb('special', e)) { e.preventDefault(); __specialDown = false; } if (__mb('cycleWeapon', e)) __cycleDown = false; if (e.button === 3 || e.button === 4) e.preventDefault(); });` : ''}
} else {
  // default: hold-to-look drag (walk / glide / orbit worlds keep the cursor visible).
  __canvas.addEventListener('pointerdown', () => { __drag = true; });
  window.addEventListener('pointerup', () => { __drag = false; });
  __canvas.addEventListener('pointermove', (e) => { if (__drag) { __lookDX += e.movementX || 0; __lookDY += e.movementY || 0; } });${moveset ? `
  // A MOVESET's beats on a camera that does not capture the mouse: a press strikes at once (no capture to wait for), the
  // light on fire, heavy the right click, special the forward button; a drag still looks
  __canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  __canvas.addEventListener('mousedown', (e) => { if (__mb('fire', e)) __fireDown = true; if (__mb('heavy', e)) __heavyDown = true; if (__mb('special', e)) { e.preventDefault(); __specialDown = true; } if (__mb('cycleWeapon', e)) { e.preventDefault(); __cycleDown = true; } });
  window.addEventListener('mouseup', (e) => { if (__mb('fire', e)) __fireDown = false; if (__mb('heavy', e)) __heavyDown = false; if (__mb('special', e)) { e.preventDefault(); __specialDown = false; } if (__mb('cycleWeapon', e)) __cycleDown = false; if (e.button === 3 || e.button === 4) e.preventDefault(); });` : ''}
}
${lock ? `// TARGET LOCK (lock.js): middle mouse is the lock press beside C and pad R3 — a held flag the
// input read turns into an edge. preventDefault keeps the browser's autoscroll off the canvas.
let __midDown = false;
__canvas.addEventListener('mousedown', (e) => { if (__mb('lock', e)) { e.preventDefault(); __midDown = true; } });
window.addEventListener('mouseup', (e) => { if (__mb('lock', e)) __midDown = false; });
` : ''}const __kx = (pos, neg) => __CTL.axis(__BIND, pos, neg, 'keyboard', __kbRead);
// gamepad (standard-mapping): polled once per input read and MERGED into the same normalized
// snapshot the keyboard/mouse build — the engine never learns which device spoke. Keyboard wins
// an axis it is actively pressing; pad buttons OR into the shared held/edge chains so dodge
// double-tap (LT), semi-auto fire and every press-edge action reuse the one __prev* discipline.
// Mapping: left stick = move (strafe in look worlds, turn otherwise) · right stick = look/aim ·
// RT fire · LT boost (double-tap = dodge) · A jump-ascend · B/LB kneel-descend · Y (PS △) tackle ·
// D-pad ↑ switch suit · D-pad ↓ reverse view (a chase camera) · select = AI toggle. RB is the WEAPON button: a quick tap cycles, a HOLD
// raises the selector overlay, and face buttons chord while it is down — RB+X (PS □) = the main
// ranged weapon, RB+Y (PS △) = the main melee, RB+B/A = the remaining slots in shelf order (a
// chord suppresses the face button's solo action). Start is the SHELL's (pause) — the world
// ignores it. Prefs arrive over the game-gamepad sidecar; a shell-less world plays the defaults.
let __padOn = true, __padIdx = -1, __padSeen = false;
// the pad a camera or watch control reads outside the pilot's poll: the one the pilot holds, else the first connected
const __padNow = () => { if (!__padOn || !navigator.getGamepads) return null; const ps = navigator.getGamepads(); if (__padIdx >= 0 && ps[__padIdx] && ps[__padIdx].connected) return ps[__padIdx]; for (let i = 0; i < ps.length; i++) if (ps[i] && ps[i].connected) return ps[i]; return null; };
const __padCfg = { deadZone: 0.15, lookScale: 18, invertY: false };   // lookScale: px-equivalent per frame at full deflection
window.__mojPad = { active: () => __padOn && __padSeen, cfg: __padCfg };   // read by the pause legend (__controlRows)
window.addEventListener('gamepadconnected', (e) => { __padSeen = true; __padIdx = e.gamepad.index; });
window.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || d.moj !== '${GAME_MSG_GAMEPAD}') return;
  if (typeof d.on === 'boolean') { __padOn = d.on; if (!d.on) __wcHide(); }
  if (Number.isFinite(d.deadZone)) __padCfg.deadZone = Math.max(0, Math.min(0.6, d.deadZone));
  if (Number.isFinite(d.lookScale)) __padCfg.lookScale = Math.max(1, Math.min(80, d.lookScale));
  if (typeof d.invertY === 'boolean') __padCfg.invertY = d.invertY;
});
const __padStick = (x, y) => {   // radial dead zone, rescaled so travel starts at zero past it
  const m = Math.hypot(x, y);
  if (m < __padCfg.deadZone) return [0, 0];
  const s = Math.min(1, (m - __padCfg.deadZone) / (1 - __padCfg.deadZone)) / m;
  return [x * s, y * s];
};
// ---- RB weapon selector: the chord map assigns loadout slots to face buttons — the MAIN
// ranged weapon always rides X (PS square) and the MAIN melee always rides Y (PS triangle)
// (operator, 2026-08-03); leftover slots fill B then A in shelf order. Recomputed per open,
// so a suit switch (new loadout) re-deals the buttons.
let __wcPrevRB = false, __wcDownT = 0, __wcChorded = false, __wcOpen = false, __wcPrevFace = 0, __wcEl = null, __padLayout = 'xbox', __wcCur = -1;
const __WC_HOLD = 260;   // ms — under it a release is a tap (cycle), past it the selector raises
const __wcEnt = () => (__world.pilotId && __world.byId[__world.pilotId]) || null;
function __wcMap() {
  const ent = __wcEnt();
  const lo = ent && __entLoadout(ent);
  if (!lo) return null;
  const map = {}, used = [];
  const firstRanged = lo.findIndex((c) => c && c.weapon);
  const firstMelee = lo.findIndex((c) => c && c.strike);
  if (firstRanged >= 0) { map[2] = firstRanged; used.push(firstRanged); }         // X / PS square
  if (firstMelee >= 0 && used.indexOf(firstMelee) < 0) { map[3] = firstMelee; used.push(firstMelee); }   // Y / PS triangle
  const rest = [];
  for (let i = 0; i < lo.length; i++) if (lo[i] && used.indexOf(i) < 0) rest.push(i);
  const restBtns = [1, 0];   // B / PS circle, then A / PS cross
  for (let k = 0; k < rest.length && k < restBtns.length; k++) map[restBtns[k]] = rest[k];
  return map;
}
function __wcRender() {
  const ent = __wcEnt();
  const lo = ent && __entLoadout(ent);
  const m = __wcMap();
  if (!lo || !m) { __wcHide(); return; }
  if (!__wcEl) {
    __wcEl = document.createElement('div');
    __wcEl.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:30;display:flex;flex-direction:column;gap:6px;min-width:240px;padding:14px 18px;background:rgba(8,13,24,.88);border:1px solid #2a3b58;border-radius:12px;font:600 13px system-ui,sans-serif;color:#cfe3ff;pointer-events:none;backdrop-filter:blur(2px)';
    (typeof wrap !== 'undefined' ? wrap : document.body).appendChild(__wcEl);
  }
  const gl = {};   // the face glyphs in this pad's own layout (positions 0-3: south, east, west, north)
  __DEV.gamepad.faces.forEach((f, i) => { gl[i] = __CTL.label(__DEV, 'gamepad', f, __padLayout); });
  const cur = ent.loadoutIdx || 0;
  let html = '<div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8fa5c8;margin-bottom:4px">weapons \\u2014 hold RB \\u00b7 tap a button</div>';
  for (const bi of [2, 3, 1, 0]) {   // main weapon, main melee, then the leftovers
    if (m[bi] == null) continue;
    const cfg = lo[m[bi]] || {};
    const on = m[bi] === cur;
    const nm = cfg.name || (cfg.strike ? 'MELEE' : 'RANGED');
    const tag = bi === 2 ? 'main weapon' : bi === 3 ? 'main melee' : '';
    html += '<div style="display:flex;align-items:center;gap:10px;padding:5px 8px;border-radius:7px;'
      + (on ? 'background:rgba(95,176,255,.16);border:1px solid #5fb0ff' : 'border:1px solid transparent') + '">'
      + '<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:1px solid #4a5f82;border-radius:50%;font-size:12px;color:' + (on ? '#9cd2ff' : '#8fa5c8') + '">' + gl[bi] + '</span>'
      + '<span style="flex:1;letter-spacing:.06em;color:' + (on ? '#e8f4ff' : '#cfe3ff') + '">' + nm + '</span>'
      + (tag ? '<span style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#6f87ab">' + tag + '</span>' : '')
      + '</div>';
  }
  __wcEl.innerHTML = html;
  __wcEl.style.display = 'flex';
  __wcCur = cur;
}
function __wcHide() { __wcOpen = false; __wcCur = -1; if (__wcEl) __wcEl.style.display = 'none'; }
window.__mojWcHide = __wcHide;   // the pause sidecar closes the selector when the shell freezes the sim
${touchLayer ? `${touchScript(touchLayer)}` : ''}function __pollPad() {
${seats ? `  // SEATS: seat 1 reads only its own pad (none when the keyboard is its controller), never another seat's
  if (__seat1 === 'keyboard') return null;
  if (__seat1) { __padIdx = +__seat1.slice(4); const __sp = navigator.getGamepads ? navigator.getGamepads()[__padIdx] : null; if (!__sp || !__sp.connected) return null; }
` : ''}${touchLayer ? `  // the screen's virtual pad (touch.js) when no real one is connected: read through the same bindings, never counted
  // as a pad the player plugged in (the legend, the prompts and the printed layout stay the keyboard's)
  const __tp = __touchPad();
  if ((!__padOn || !navigator.getGamepads) && !__tp) return null;
  const pads = __padOn && navigator.getGamepads ? navigator.getGamepads() : [];
  let g = (__padIdx >= 0 && pads[__padIdx] && pads[__padIdx].connected) ? pads[__padIdx] : null;
  if (!g) { for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { g = pads[i]; __padIdx = i; break; } }
  if (!g && __tp) g = __tp;
  if (!g) { __wcHide(); __wcPrevRB = false; return null; }
  const __virt = g === __tp;
  if (!__virt) __padSeen = true;
  // the pad's printed layout (Xbox, PlayStation, Nintendo): the glyphs it shows, and where confirm / cancel sit
  const __lay = __virt ? __padLayout : __CTL.padLayout(g.id);` : `  if (!__padOn || !navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  let g = (__padIdx >= 0 && pads[__padIdx] && pads[__padIdx].connected) ? pads[__padIdx] : null;
  if (!g) { for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { g = pads[i]; __padIdx = i; break; } }
  if (!g) { __wcHide(); __wcPrevRB = false; return null; }
  __padSeen = true;
  // the pad's printed layout (Xbox, PlayStation, Nintendo): the glyphs it shows, and where confirm / cancel sit
  const __lay = __CTL.padLayout(g.id);`}
  if (__lay !== __padLayout) { __padLayout = __lay; __BIND = __CTL.resolve(__SCHEME, __DEV, null, { layout: __lay }); }
  const b = (i) => !!(g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > 0.5));
  const __gr = __CTL.gamepadRead(g, __DEV), __ga = __CTL.gamepadRead(g, __DEV, true);
  const pb = (id, quiet) => __CTL.held(__BIND, id, 'gamepad', __gr, quiet ? __DEV.gamepad.faces : null);   // quiet: a held RB silences the face buttons (they chord)
  const [mx, my] = __padStick(g.axes[0] || 0, g.axes[1] || 0);
  const [lx, ly] = __padStick(g.axes[2] || 0, g.axes[3] || 0);
  if (${touchLayer ? '!__virt && (' : ''}mx || my || lx || ly || g.buttons.some((x) => x && x.pressed)${touchLayer ? ')' : ''}) __usePad = true;
  // RB state machine: press starts the tap/hold clock; the hold raises the selector; face-button
  // press EDGES while RB is down chord a slot (and mark the press so release doesn't also cycle);
  // a chordless release inside the tap window is the cycle.
  const rb = pb('cycleWeapon');
  const now = performance.now();
  let cycle = false, slot = 0;
  if (rb && !__wcPrevRB) { __wcDownT = now; __wcChorded = false; }
  if (rb && !__wcOpen && now - __wcDownT >= __WC_HOLD) { __wcOpen = true; __wcRender(); }
  const face = (b(0) ? 1 : 0) | (b(1) ? 2 : 0) | (b(2) ? 4 : 0) | (b(3) ? 8 : 0);
  if (rb) {
    for (const bi of [2, 3, 1, 0]) {
      if ((face & (1 << bi)) && !(__wcPrevFace & (1 << bi))) {
        const m = __wcMap();
        if (m && m[bi] != null) { slot = m[bi] + 1; __wcChorded = true; if (!__wcOpen) { __wcOpen = true; } }
        break;
      }
    }
  }
  if (!rb && __wcPrevRB) {
    if (!__wcChorded && now - __wcDownT < __WC_HOLD) cycle = true;
    __wcHide();
  }
  if (__wcOpen && (slot || (__wcEnt() && (__wcEnt().loadoutIdx || 0) !== __wcCur))) __wcRender();   // live highlight tracks the engine's slot
  __wcPrevRB = rb; __wcPrevFace = face;
  return {
    moveX: mx, moveY: -my,                     // stick up = forward
    lookX: lx, lookY: ly,
    fire: pb('fire'), boost: pb('boost'),${moveset ? `
    light: pb('light', rb), heavy: pb('heavy', rb), special: pb('special', rb),   // a moveset's beats: the left, top and right faces
    mod: pb('modifier'),   // the modifier held: the right trigger (a face with it is its special)` : ''}${guards ? `
    guard: pb('guard'),   // the guard held: the left shoulder` : ''}
    // analog trigger VALUES — the vehicle rules (drive/fly) read RT/LT as throttle/brake, the
    // console-driving standard; suits keep the pressed reads above untouched.
    rt: __CTL.value(__BIND, 'fire', 'gamepad', __ga), lt: __CTL.value(__BIND, 'boost', 'gamepad', __ga),
    tackle: pb('tackle', rb),                  // Y / PS triangle (operator, 2026-08-03) — silent inside an RB chord
    kneel: pb('kneel', rb),                    // LB or B / PS circle — descend in space, kneel on ground
    jump: pb('jump', rb),                      // A / PS cross — ascend in space
    cycle, slot,                               // RB tap / RB chord (the selector)
    swap: pb('swapSuit'), ai: pb('aiToggle'),  // D-pad up = switch suit · select = AI toggle
    lock: pb('lock'),                          // R3 (right stick click) = target lock (lock.js)${hasForms ? `
    transform: pb('transform'),                // L3 (left stick click) = transform (forms.js)` : ''}
    interact: pb('interact', rb),              // X / PS square — use / talk where the figure stands in reach (silent inside an RB chord)${vayoOn ? `
    vayo: !!(g.buttons && g.buttons[13] && g.buttons[13].pressed),   // D-pad down — a vayo move (vayo-move.js)` : ''}
  };
}
// the pause legend for the piloted entity (scene-three's __controlRows asks): the scheme's rows,
// read off the live bindings and filtered by what this world has, so it teaches only the keys it answers to.
function __ctlLegend(pil) {
${touchLayer ? `  if (__touchOn()) return __touchRows();   // the screen's pad (touch.js): its thumbs, not the keys
` : ''}  const r = pil.rule || pil.pilotRule || {};
  const W = __world, lo = (e) => (e.rule && Array.isArray(e.rule.loadout) && e.rule.loadout.length) || (e.pilotRule && Array.isArray(e.pilotRule.loadout) && e.pilotRule.loadout.length);
  return __CTL.legend(__SCHEME, __BIND, __DEV, {
    space: r.space === true, kneel: r.kneel === true, tackle: !!r.tackle, vehicle: r.type === 'drive' || r.type === 'fly'${hoverOn ? " || r.type === 'hover'" : ''},
    walker: r.walkSpeed > 0 && r.space !== true && !r.gear,   // a person: the walk held, no thrusters
    dash: !!r.dash, sprint: !!r.sprint && !r.dash,             // a feel's F: the dash, or the run button (rules-platform.js)
    mouselook: __MOUSELOOK, armed: W.entities.some((e) => e.weapon || lo(e)), lock: ${!!lock},
    suits: W.entities.filter((e) => e.pilotable).length > 1,
    ai: W.entities.some((e) => (e.ambientRule && e.ambientRule.type === 'ai') || (e.rule && e.rule.type === 'ai')),
    follow: !!(W.camera && W.camera.rule && W.camera.rule.type === 'follow'),
    interact: !!window.__mojUses,   // the world has somewhere to use (the events channel says)${hasForms ? `
    forms: true,                    // a body that transforms (forms.js)` : ''}
    active: { gamepad: __padOn && __padSeen }, layout: __padLayout,
  });
}
let __prevJump = false;             // for the jump PRESS edge (platform rule) vs held (variable height)
let __prevInteract = false, __interactN = 0;   // interact press edges, counted for the events channel (a use where the figure stands)
let __prevCycle = false, __prevSlot = 0;   // weapon-cycling press edges (R / 1-5)
let __prevSwap = false;                    // suit-switcher press edge (T)
let __prevTackle = false;                  // tackle press edge (Shift) — platform rule, opt-in r.tackle
let __prevAi = false;                      // AI-attack toggle press edge (G / HUD button)
let __prevLock = false;                    // target-lock press edge (C / middle mouse / R3) — lock.js${hasForms ? `
let __prevTransform = false;               // transform press edge (B / L3) — forms.js` : ''}
let __aiBtnPress = false;                  // HUD button click injects one toggle edge
// shell AI switch (practice mode): the pause menu posts a DESIRED state over the game-ai sidecar;
// the world converges through the same input edge the G key uses (one deterministic path — the
// engine flips aiEnabled in stepWorld), injecting edges until live state matches the request.
let __aiWant = null;
window.addEventListener('message', (e) => {
  const d = e.data;
  if (d && d.moj === '${GAME_MSG_AI}' && typeof d.on === 'boolean') __aiWant = d.on;
});
function __readInput() {
  // a menu is up (events channel): the figure takes nothing — not a key held as it opened, not the pad, not the look.
  // The edges read as held, so the key that picked doesn't jump or interact again when the menu goes.
  if (window.__mojMenuOpen) { __lookDX = 0; __lookDY = 0; __fireDown = false; __prevJump = true; __prevInteract = true; return { ...__CW.ZERO_INPUT }; }
  const __pad = ${xr ? '__xrCtl ? __xrCtl.pad() : ' : ''}__pollPad();   // null when no controller (or prefs turned it off)${xr ? `
  // (in the headset, channels/xr.js: the controllers are the pad, and the read is finished on the body below)` : ''}
  // INTERACT (use / talk) press edge: counted; the events channel sends use-<place> when the figure stands in reach
  const it = __k('interact') || !!(__pad && __pad.interact);
  if (it && !__prevInteract) __interactN++;
  __prevInteract = it;
  const sp = __k('jump') || !!(__pad && __pad.jump);
  const jump = sp && !__prevJump ? 1 : 0;   // rising edge: a discrete press, not a held axis
  __prevJump = sp;
  // weapon cycling (platform rule, opt-in loadout): R press edge cycles, digit press edge selects
  const cy = __k('cycleWeapon') || !!(__pad && __pad.cycle)${moveset ? ' || __cycleDown' : ''};   // (a moveset's: the mouse's back button too)
  const cycle = cy && !__prevCycle ? 1 : 0;
  __prevCycle = cy;
  let slotNow = (__pad && __pad.slot) || 0;
  for (let d = 1; d <= 5; d++) if (__k('weapon' + d)) { slotNow = d; break; }
  const slot = slotNow && slotNow !== __prevSlot ? slotNow : 0;
  __prevSlot = slotNow;
  // suit switcher (pilotable entities): T press edge transfers the pilot
  const sw = __k('swapSuit') || !!(__pad && __pad.swap);
  const swap = sw && !__prevSwap ? 1 : 0;
  __prevSwap = sw;
  // TACKLE (platform rule, opt-in r.tackle): Shift press edge fires the invincible offensive dash.
  // A press EDGE (not held) — one tackle per key-down, like the suit-switcher / jump edges.
  const tk = __k('tackle') || !!(__pad && __pad.tackle);
  const tackle = tk && !__prevTackle ? 1 : 0;
  __prevTackle = tk;
  // AI attack toggle (worlds with ai ambients): G press edge OR the HUD button OR the shell's
  // requested state (pause-menu switch — inject edges until aiEnabled converges), one shared edge
  const __aiCur = __world.aiEnabled !== false;
  if (__aiWant != null && __aiWant === __aiCur) __aiWant = null;   // converged — stand down
  const ai = __k('aiToggle') || __aiBtnPress || !!(__pad && __pad.ai) || (__aiWant != null && __aiWant !== __aiCur);
  const aiToggle = ai && !__prevAi ? 1 : 0;
  __prevAi = ai;
  __aiBtnPress = false;
  // TARGET LOCK press edge (lock.js): C / middle mouse / pad R3 — acquire, cycle, release
  const lk = ${lock ? "__k('lock') || __midDown || !!(__pad && __pad.lock)" : 'false'};
  const lock = lk && !__prevLock ? 1 : 0;
  __prevLock = lk;${hasForms ? `
  // TRANSFORM press edge (forms.js): B / pad L3 turns the pilot into its next form
  const tf = __k('transform') || !!(__pad && __pad.transform);
  const transform = tf && !__prevTransform ? 1 : 0;
  __prevTransform = tf;` : ''}
  // pad right stick → the SAME look accumulators the mouse feeds, per-frame at lookScale px
  // equivalents; signs follow each mouse branch's convention (mouselook negates so stick-right
  // looks right, drag worlds keep the drag sign). Stick look never needs pointer capture — a
  // match is fully playable without a single mouse click.
  if (__pad && (__pad.lookX || __pad.lookY)) {
    const __ps = __padCfg.lookScale, __py = __padCfg.invertY ? -1 : 1;
    if (__MOUSELOOK) { __lookDX -= __pad.lookX * __ps; __lookDY -= __pad.lookY * __ps * __py; }
    else { __lookDX += __pad.lookX * __ps; __lookDY += __pad.lookY * __ps * __py; }
  }
  // look keys (unbound by default: the mouse looks) steer the same accumulators at the pad's full-deflection rate,
  // so a remap gives a keyboard-only player the camera
  const __klx = __kx('lookRight', 'lookLeft'), __kly = __kx('lookDown', 'lookUp');
  if (__klx || __kly) {
    const __ks = __padCfg.lookScale;
    if (__MOUSELOOK) { __lookDX -= __klx * __ks; __lookDY -= __kly * __ks; }
    else { __lookDX += __klx * __ks; __lookDY += __kly * __ks; }
  }
  // keyboard wins an axis it is actively pressing; otherwise the pad's analog float flows
  // through (the rules multiply by accel/speed, so magnitude = walk-to-run travel).
  const __pmx = __pad ? __pad.moveX : 0, __pmy = __pad ? __pad.moveY : 0;
  // VEHICLE PILOT (drive / fly): the pad's ANALOG triggers become throttle (RT) and brake (LT) —
  // the console-driving standard — with the stick as fallback; RT stops firing and LT stops
  // boosting while a vehicle is piloted (F is reserved there anyway). Keyed off the LIVE piloted
  // entity's rule each frame, so T in-and-out of a car swaps the scheme with the seat.
  const __vp = __world.pilotId && __world.byId[__world.pilotId];
  const __veh = !!(__vp && __vp.rule && (__vp.rule.type === 'drive' || __vp.rule.type === 'fly'${hoverOn ? " || __vp.rule.type === 'hover'" : ''}));
  const inp = {
    forward: __kx('moveForward', 'moveBack')
      || (__veh && __pad && (__pad.rt > 0.02 || __pad.lt > 0.02) ? __pad.rt - __pad.lt : __pmy),
    // look worlds steer with the stick/mouse — left stick X strafes (matching how A/D fold
    // into sideIn there); tank-turn worlds keep left stick X as the turn axis.
    turn: __kx('turnRight', 'turnLeft') || (__MOUSELOOK ? 0 : __pmx),
    // in reach (window.__mojReach, the events channel's) the interact controls interact and don't strafe
    strafe: (window.__mojReach ? __CTL.value(__BIND, 'strafeRight', 'keyboard', __kbRead, __BIND.bind.keyboard.interact) - __CTL.value(__BIND, 'strafeLeft', 'keyboard', __kbRead, __BIND.bind.keyboard.interact) : __kx('strafeRight', 'strafeLeft')) || (__MOUSELOOK ? __pmx : 0),
    lift: __kx('jump', 'descend') || (__pad ? (__pad.jump ? 1 : 0) - (__pad.kneel ? 1 : 0) : 0),
    jump, jumpHeld: sp ? 1 : 0,
    boost: __k('boost') || (__pad && __pad.boost && !__veh) ? 1 : 0,   // thrusters (platform rule): held = boost locomotion
    walk: __k('walk') ? 1 : 0,       // a person's walk, held (platform rule, walkSpeed); a pad walks by the stick's travel
    kneel: __k('kneel') || (__pad && __pad.kneel) ? 1 : 0,   // one-knee hold (platform rule, opt-in kneel:true) / space descend
    fire: __fireDown || (__pad && (${moveset ? '__pad.light' : '__pad.fire'}) && !__veh) ? 1 : 0,   // left mouse or RT (weapon subsystem; RT is throttle in a vehicle)${moveset ? `
    heavy: __heavyDown || (__pad && __pad.heavy) ? 1 : 0, special: __specialDown || (__pad && __pad.special) ? 1 : 0,   // a moveset's heavy and special beats
    mod: __k('modifier') || (__pad && __pad.mod) ? 1 : 0,   // the modifier held (left Ctrl, the right trigger): a moveset's specials` : ''}${guards ? `
    guard: __k('guard') || (__pad && __pad.guard) ? 1 : 0,   // the guard held (Shift, the left shoulder)` : ''}
    cycle, slot,                     // weapon cycling (platform rule, opt-in loadout)
    swap,                            // suit switcher (T): transfer the pilot between pilotable suits
    tackle,                          // tackle (Shift): the platform rule's invincible offensive dash (opt-in r.tackle)
    aiToggle,                        // AI attack switch (G): ai-ambient suits stand down / wake up
    lock,                            // target lock (C): lock.js acquires / cycles / releases on the edge${hasForms ? `
    transform,                       // transform (B): a body with forms turns into its next one (forms.js)` : ''}
    missile: __k('missile') || window.__mojAltFire ? 1 : 0,   // a craft's missile (R, or the right mouse, pointer-locked: the flight block's)
    flare: __k('flare') ? 1 : 0,     // a craft's flare (X)${vayoOn ? `
    vayo: __kbRead('KeyV') || (__pad && __pad.vayo) ? 1 : 0,   // a vayo move (V, or the pad's D-pad down): vayo-move.js` : ''}${sprint ? `
    sprint: __kbRead('ShiftLeft') || __kbRead('ShiftRight') ? 1 : 0,   // a person's sprint, held (rules-platform.js sprintSpeed)` : ''}
    lookDX: __lookDX, lookDY: __lookDY,
  };
  __lookDX = 0; __lookDY = 0;
  return ${xr ? '__xrCtl ? __xrCtl.input(inp) : ' : ''}inp;
}
${seats ? seatsScript(seats) : ''}// active whenever there are entities to step; the camera is OWNED only if a camera entity exists
// (otherwise OrbitControls keeps the view — e.g. a clock-driven figure turntable orbited by hand).
__ctrlActive = __world.entities.length > 0;
if (__world.camera) { controls.enabled = false; __ctrlOwnsCamera = true; }
// reverse view (follow cameras only): swing the chase camera around to the FRONT of the target —
// WASD keeps driving it exactly as before, you just see the unit face-on (the suit-detail view).
// Flips the follow rule's live \`reverse\` flag; the rule eases the swing as an orbit. HUD button + V.
if (__world.camera && __world.camera.rule.type === 'follow') {
  const __rvBtn = document.createElement('button');
  __rvBtn.textContent = 'reverse view';
  const __rvFlip = () => { const r = __world.camera.rule; r.reverse = !r.reverse; __rvBtn.classList.toggle('on', !!r.reverse); };
  __rvBtn.classList.toggle('on', !!__world.camera.rule.reverse);
  __rvBtn.onclick = __rvFlip;
  window.addEventListener('keydown', (ev) => { if (__CTL.is(__BIND, 'reverseView', 'keyboard', ev.code) && !ev.repeat) __rvFlip(); });
  // the pad's reverse view (its binding: D-pad down), on the press edge, polled with the frame
  let __rvPadWas = false;
  (function __rvPad() { requestAnimationFrame(__rvPad); const g = __padNow(); const on = !!g && __CTL.held(__BIND, 'reverseView', 'gamepad', __CTL.gamepadRead(g, __DEV)); if (on && !__rvPadWas) __rvFlip(); __rvPadWas = on; })();
  hud.appendChild(__rvBtn);
}
${faunaOnly ? '' : `// AI ATTACK toggle (worlds with ai-ambient suits): a HUD button twin of the G key. The click only
// INJECTS the shared input edge — the engine flips world.aiEnabled in stepWorld, so live play and
// capture replay go through the one deterministic path; a tiny watcher mirrors the live state onto
// the button label (G presses update it too).
if (__world.entities.some((e) => (e.ambientRule && e.ambientRule.type === 'ai') || (e.rule && e.rule.type === 'ai'))) {
  const __aiBtn = document.createElement('button');
  __aiBtn.onclick = () => { __aiBtnPress = true; };
  hud.appendChild(__aiBtn);
  (function __aiBtnSync() {
    requestAnimationFrame(__aiBtnSync);
    const on = __world.aiEnabled !== false;
    const want = on ? 'AI attack: ON' : 'AI attack: OFF';
    if (__aiBtn.textContent !== want) { __aiBtn.textContent = want; __aiBtn.classList.toggle('on', on); }
  })();
}
`}// SPECTATOR RIG (ai-battle-spectator.plan.md): a no-pilot ALL-AI battle the operator WATCHES. The
// camera is a glide FREE-FLY drone (WASD + mouse) by default; F toggles a LOCKED chase-cam on a
// chosen fighter; TAB cycles which fighter is watched (retargets the chase / snaps the drone behind
// the new pick). __specCast/__specWatchEnt sit at this scope (hoisted) so the radar + HP HUD can
// centre on the watched fighter. All gated on __world.spectate — a piloted world builds none of it.
let __specWatch = 0, __specLocked = false;
function __specCast() {
  const out = [];
  for (let __si = 0; __si < __world.entities.length; __si++) {
    const __se = __world.entities[__si];
    if (!__se.isCamera && __se.body && __se.body.hittable && Number.isFinite(__se.hpMax)) out.push(__se);
  }
  return out;
}
function __specWatchEnt() {
  if (!__world.spectate) return null;
  const c = __specCast(); if (!c.length) return null;
  if (__specWatch >= c.length) __specWatch = 0;
  return c[__specWatch];
}
if (__world.spectate && __world.camera) {
  const __specCam = __world.camera;
  const __specNameOf = (id) => (__world.match && __world.match.names && __world.match.names[id]) || id;
  // LOCK the chase-cam onto the watched fighter: flip the camera rule to 'follow' and point it — the
  // camera rule carries BOTH glide + follow tunables, so stepWorld's RULES[type] dispatch does the rest.
  const __specFollow = () => {
    const c = __specWatchEnt(); if (!c) return;
    __specCam.rule.type = 'follow';
    __specCam.rule.target = c.id;
    __specCam.lookAt = null;
  };
  // SNAP the free-fly drone to a vantage behind the watched fighter, looking at it (Tab in free mode).
  const __specSnap = () => {
    const c = __specWatchEnt(); if (!c) return;
    const tp = c.transform.pos, th = c.transform.heading || 0;
    const dist = __specCam.rule.dist || 60, height = __specCam.rule.height || 24;
    const px = tp[0] - Math.cos(th) * dist, py = tp[1] - Math.sin(th) * dist, pz = tp[2] + height;
    __specCam.transform.pos = [px, py, pz];
    const dx = tp[0] - px, dy = tp[1] - py, dz = (tp[2] + height * 0.4) - pz, len = Math.hypot(dx, dy, dz) || 1;
    __specCam.transform.heading = Math.atan2(dy, dx);
    __specCam.transform.pitch = Math.asin(Math.max(-1, Math.min(1, dz / len)));
    __specCam.vel = [0, 0, 0];
    __specCam.lookAt = null;
  };
  // hand control back to the glide FREE-FLY without a snap: seed heading/pitch from the current look.
  const __specFree = () => {
    const look = __specCam.lookAt, p = __specCam.transform.pos;
    if (look) {
      const dx = look[0] - p[0], dy = look[1] - p[1], dz = look[2] - p[2], len = Math.hypot(dx, dy, dz) || 1;
      __specCam.transform.heading = Math.atan2(dy, dx);
      __specCam.transform.pitch = Math.asin(Math.max(-1, Math.min(1, dz / len)));
    }
    __specCam.lookAt = null;
    __specCam.vel = [0, 0, 0];
    __specCam.rule.type = 'glide';
  };
  const __specApply = () => { if (__specLocked) __specFollow(); else __specSnap(); };
  const __specHud = document.createElement('div');
  __specHud.style.cssText = 'position:absolute;left:50%;bottom:18px;transform:translateX(-50%);padding:7px 16px;border-radius:8px;background:rgba(8,14,22,0.5);box-shadow:inset 0 0 0 1px rgba(120,200,255,0.22);pointer-events:none;z-index:10;font:600 12px system-ui,sans-serif;color:#cfe3ff;text-align:center;white-space:nowrap';
  wrap.appendChild(__specHud);
  const __specSync = () => {
    const c = __specWatchEnt();
    const nm = c ? __specNameOf(c.id) : '\\u2014';
    __specHud.innerHTML = '<span style="color:#8fb4d8;letter-spacing:.14em;font-size:10px">SPECTATING</span> &nbsp; <b>' + nm + '</b> &nbsp;<span style="opacity:.6;font-size:10px">' + (__specLocked ? '\\u25c9 LOCKED' : '\\u25c7 FREE-FLY') + ' \\u00b7 TAB next \\u00b7 F ' + (__specLocked ? 'free-cam' : 'lock') + '</span>';
  };
  const __specCycle = () => {
    const c = __specCast(); if (!c.length) return;
    let i = __specWatch, tries = 0;
    do { i = (i + 1) % c.length; tries++; } while (c[i] && c[i].downed && tries < c.length);   // prefer a living fighter
    __specWatch = i;
    __specApply();
    __specSync();
  };
  window.addEventListener('keydown', (ev) => {
    if (__CTL.is(__BIND, 'spectateNext', 'keyboard', ev.code)) { ev.preventDefault(); if (!ev.repeat) __specCycle(); }
    else if (__CTL.is(__BIND, 'spectateLock', 'keyboard', ev.code) && !ev.repeat) { __specLocked = !__specLocked; if (__specLocked) __specFollow(); else __specFree(); __specSync(); }
  });
  // the pad's (its bindings: RB or D-pad right the next fighter, A the lock), on the press edges, polled with the frame
  const __specPadWas = { next: false, lock: false };
  (function __specPad() {
    requestAnimationFrame(__specPad);
    const g = __padNow(), rd = g && __CTL.gamepadRead(g, __DEV);
    const next = !!g && __CTL.held(__BIND, 'spectateNext', 'gamepad', rd), lock = !!g && __CTL.held(__BIND, 'spectateLock', 'gamepad', rd);
    if (next && !__specPadWas.next) __specCycle();
    if (lock && !__specPadWas.lock) { __specLocked = !__specLocked; if (__specLocked) __specFollow(); else __specFree(); __specSync(); }
    __specPadWas.next = next; __specPadWas.lock = lock;
  })();
  __specSync();
}
// weapon HUD (mobile-suit R6-C): a reticle (core + assist + readiness status, sized from the camera
// fov), an ammo/resource readout, and a lower-right reload/resource bar — built ONLY when a controlled
// entity carries a weapon. The reticle core flashes on a hit (green core / cyan assist / red miss);
// the engine owns all state.
let __wep = null;
// armed = carries a live weapon, OR a loadout with a ranged slot (weapon cycling: the ranged
// slot may not be the active one right now, but the HUD must exist for when it is). A pilotable
// suit's loadout lives on pilotRule while it stands unpiloted — check both.
const __entLoadout = (e) => (e.rule && Array.isArray(e.rule.loadout) && e.rule.loadout.length ? e.rule.loadout : null)
  || (e.pilotRule && Array.isArray(e.pilotRule.loadout) && e.pilotRule.loadout.length ? e.pilotRule.loadout : null);
const __armed = __world.entities.find((e) => e.weapon
  || (__entLoadout(e) || []).some((c) => c && c.weapon));
// SPECTATE: no pilot aims a weapon — the reticle + ammo panel are pilot HUDs, so skip building them
// (the watched fighter's own fire fx still render; only the operator's crosshair is gone).
if (__armed && !__world.spectate) {
  const __lo = __entLoadout(__armed);
  const W = __armed.weapon
    || __CW.normalizeEntity({ weapon: __lo.find((c) => c && c.weapon).weapon }, 0).weapon;
  const __H = renderer.domElement.clientHeight || 780;
  const __tanF = Math.tan((camera.fov || 60) * Math.PI / 360) || 1;
  const __ringPx = (deg) => (__H / 2) * Math.tan(deg * Math.PI / 180) / __tanF;
  // the reticle svg for a weapon config — rebuilt when a loadout switch changes W. __rstat is the
  // act-readiness ring: switch startup + shot cooldown live around the reticle, and vanish when ready.
  const __retInner = (w) => {
    const coreR = Math.max(6, __ringPx(w.coreAngle));
    const assistR = Math.max(coreR + 6, __ringPx(w.assistAngle));
    const statusR = assistR + 7;
    const chargeR = Math.max(3, coreR * 0.72);
    const chargedR = coreR + 4;
    const svgSize = Math.ceil(statusR * 2 + 10), cxy = svgSize / 2;
    let svg = '<svg width="' + svgSize + '" height="' + svgSize + '" viewBox="0 0 ' + svgSize + ' ' + svgSize + '">';
    if (w.fireClass === 'area') svg += '<circle cx="' + cxy + '" cy="' + cxy + '" r="' + assistR.toFixed(1) + '" fill="none" stroke="#7fd4ff" stroke-opacity="0.45" stroke-width="1.5" stroke-dasharray="4 5"/>';
    svg += '<circle id="__rstat" cx="' + cxy + '" cy="' + cxy + '" r="' + statusR.toFixed(1) + '" fill="none" stroke="#ffb066" stroke-opacity="0.95" stroke-width="3" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 ' + cxy + ' ' + cxy + ')" style="display:none"/>';
    svg += '<circle id="__rchgReady" cx="' + cxy + '" cy="' + cxy + '" r="' + chargedR.toFixed(1) + '" fill="none" stroke="#8fffa8" stroke-opacity="0.98" stroke-width="2.5" style="display:none"/>';
    svg += '<circle id="__rcore" cx="' + cxy + '" cy="' + cxy + '" r="' + coreR.toFixed(1) + '" fill="none" stroke="#e8f4ff" stroke-opacity="0.85" stroke-width="1.5"/>';
    svg += '<circle id="__rcharge" cx="' + cxy + '" cy="' + cxy + '" r="' + chargeR.toFixed(1) + '" data-r="' + chargeR.toFixed(1) + '" fill="none" stroke="#8fffa8" stroke-opacity="0.9" stroke-width="2" style="display:none"/>';
    svg += '<circle id="__rdot" cx="' + cxy + '" cy="' + cxy + '" r="1.5" fill="#e8f4ff"/></svg>';
    return svg;
  };
  const __ret = document.createElement('div');
  __ret.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:9';
  __ret.innerHTML = __retInner(W);
  wrap.appendChild(__ret);
  const __rl = 22, __circ = 2 * Math.PI * __rl;
  // weapon-type ICONS (simple monochrome SVG): the loadout slot names one via its icon key;
  // ranged/melee generics are the fallback. Guns read wide, melee tall — each fits the 42px box.
  // (No backticks in this comment on purpose — it lives inside an emitted template literal.)
  const __WICONS = {
    rifle: '<svg viewBox="0 0 40 24" width="38" height="23"><rect x="3" y="10" width="31" height="4" fill="#cfe3ff"/><rect x="5" y="13" width="6" height="8" fill="#cfe3ff"/><rect x="14" y="6" width="11" height="3" fill="#9fc2e8"/><rect x="31" y="8" width="7" height="2" fill="#cfe3ff"/></svg>',
    mg: '<svg viewBox="0 0 40 24" width="38" height="23"><rect x="3" y="9" width="31" height="4" fill="#cfe3ff"/><circle cx="15" cy="17" r="5" fill="none" stroke="#cfe3ff" stroke-width="2"/><rect x="5" y="12" width="5" height="8" fill="#cfe3ff"/><rect x="31" y="10" width="7" height="2" fill="#cfe3ff"/></svg>',
    saber: '<svg viewBox="0 0 24 40" width="22" height="37"><rect x="10" y="2" width="4" height="23" rx="2" fill="#8fd0ff"/><rect x="8" y="25" width="8" height="3" fill="#cfe3ff"/><rect x="10" y="28" width="4" height="10" fill="#7f9bc4"/></svg>',
    axe: '<svg viewBox="0 0 24 40" width="22" height="37"><rect x="10" y="4" width="3" height="33" fill="#7f9bc4"/><path d="M13 6 L21 9 L21 17 L13 19 Z" fill="#cfe3ff"/></svg>',
    bazooka: '<svg viewBox="0 0 40 24" width="38" height="23"><rect x="4" y="7" width="28" height="9" rx="2" fill="#cfe3ff"/><path d="M2 6 L4 8 L4 15 L2 17 Z" fill="#9fc2e8"/><path d="M32 8 L38 11 L32 14 Z" fill="#ffb066"/><rect x="12" y="16" width="5" height="6" fill="#9fc2e8"/></svg>',
    grenade: '<svg viewBox="0 0 40 24" width="38" height="23"><rect x="6" y="8" width="18" height="7" rx="2" fill="#cfe3ff"/><circle cx="12" cy="17" r="4" fill="none" stroke="#cfe3ff" stroke-width="2"/><path d="M24 9 L30 6 L34 8 L29 15 Z" fill="#ffb066"/></svg>',
  };
  const __iconFor = (cfg) => (cfg && __WICONS[cfg.icon]) || (cfg && cfg.strike ? __WICONS.saber : __WICONS.rifle);
  // the status panel lives LOWER-RIGHT (above the sound toggle): equipped-weapon icon + name +
  // ammo/resource + the reload/resource ring. Ranged startup/cooldown lives on the reticle.
  const __panel = document.createElement('div');
  __panel.style.cssText = 'position:absolute;right:12px;bottom:54px;display:flex;align-items:center;gap:11px;padding:8px 12px;background:rgba(11,18,32,.62);border:1px solid #24324a;border-radius:9px;font:600 14px system-ui,sans-serif;color:#e8f4ff;text-shadow:0 1px 3px rgba(0,0,0,.6);pointer-events:none;z-index:9';
  __panel.innerHTML =
      '<div id="__wepIcon" style="display:flex;align-items:center;justify-content:center;width:42px;height:40px">' + __iconFor(__lo ? __lo[0] : null) + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:2px;min-width:62px">'
    +   '<span id="__wepName" style="letter-spacing:.07em;font-size:11px;color:#9fc2e8"></span>'
    +   '<span id="__ammoTxt" style="font-size:15px"></span>'
    + '</div>'
    + '<svg id="__rlRing" width="46" height="46" viewBox="0 0 52 52" style="display:none">'
    +   '<circle cx="26" cy="26" r="' + __rl + '" fill="none" stroke="#26303f" stroke-width="4"/>'
    +   '<circle id="__rlArc" cx="26" cy="26" r="' + __rl + '" fill="none" stroke="#7fd4ff" stroke-width="4" stroke-linecap="round" transform="rotate(-90 26 26)" stroke-dasharray="' + __circ.toFixed(1) + '" stroke-dashoffset="' + __circ.toFixed(1) + '"/></svg>';
  wrap.appendChild(__panel);
  __wep = { e: __armed, W, lo: __lo, retInner: __retInner, ret: __ret, core: __ret.querySelector('#__rcore'),
    dot: __ret.querySelector('#__rdot'), stat: __ret.querySelector('#__rstat'), charge: __ret.querySelector('#__rcharge'), charged: __ret.querySelector('#__rchgReady'), ray: new THREE.Raycaster(), rayO: new THREE.Vector3(), rayD: new THREE.Vector3(),
    iconFor: __iconFor, iconEl: __panel.querySelector('#__wepIcon'), iconKey: null,
    name: __panel.querySelector('#__wepName'), ammoTxt: __panel.querySelector('#__ammoTxt'),
    rlRing: __panel.querySelector('#__rlRing'), rlArc: __panel.querySelector('#__rlArc'), circ: __circ, aimV: new THREE.Vector3() };
}
function __retStatus(frac, color) {
  if (!__wep || !__wep.stat) return;
  const f = Math.max(0, Math.min(1, frac || 0));
  if (f <= 0) { __wep.stat.style.display = 'none'; return; }
  __wep.stat.style.display = '';
  __wep.stat.setAttribute('stroke', color || '#ffb066');
  __wep.stat.setAttribute('stroke-dashoffset', (100 * (1 - f)).toFixed(1));
}
function __retReady() {
  if (__wep && __wep.stat) __wep.stat.style.display = 'none';
}
function __retCharge(W) {
  if (!__wep || !__wep.charge || !__wep.charged) return;
  if (W && W.charging && !W.chargeReady) {
    const base = Number(__wep.charge.getAttribute('data-r')) || 6;
    const frac = Math.max(0, Math.min(1, W.chargeFrac || 0));
    __wep.charge.style.display = '';
    __wep.charge.setAttribute('r', Math.max(0.1, base * (1 - frac)).toFixed(2));
    __wep.charged.style.display = 'none';
  } else if (W && W.charging && W.chargeReady) {
    __wep.charge.style.display = 'none';
    __wep.charged.style.display = '';
  } else {
    __wep.charge.style.display = 'none';
    __wep.charged.style.display = 'none';
  }
}
function __updateWepHud() {
  if (!__wep) return;
  // the HUD tracks the PILOTED suit when a suit switcher is present (T swaps __world.pilotId),
  // else the armed entity it was built for.
  const ent = (__world.pilotId && __world.byId[__world.pilotId]) || __wep.e;
  const now = __world.time, tr = ent.transform;
  // loadout: show the ACTIVE slot's name; a melee slot has no weapon — reticle + ammo hide,
  // the name readout is the tell that a saber/axe is up.
  const lo = __entLoadout(ent);
  const cfg = lo ? (lo[ent.loadoutIdx || 0] || {}) : null;
  if (__wep.name) __wep.name.textContent = cfg ? (cfg.name || (cfg.strike ? 'MELEE' : 'RANGED')) : '';
  // swap the equipped-weapon ICON on a slot change (keyed so it re-renders only when it actually changes)
  if (__wep.iconEl) {
    const ikey = cfg ? (cfg.icon || (cfg.strike ? 'melee' : 'ranged')) : 'none';
    if (ikey !== __wep.iconKey) { __wep.iconEl.innerHTML = cfg ? __wep.iconFor(cfg) : ''; __wep.iconKey = ikey; }
  }
  const W = ent.weapon;
  if (!W) {
    // MELEE slot: no ammo, no reticle — but the same ring shows the swing COOLDOWN (swingT 0->1
    // fills the ring; empty = ready to strike again). While the R20.4 COMBO WINDOW is live the
    // status reads 'COMBO' with a go-green ring DRAINING as the window closes — the tell that a
    // timed follow-up is available (S+click inside it = the knockdown). READY otherwise.
    __wep.ret.style.display = 'none';
    __retReady();
    __retCharge(null);
    if (ent.swingT != null) {
      __wep.ammoTxt.textContent = '';
      __wep.rlRing.style.display = '';
      __wep.rlArc.setAttribute('stroke', '#ffb066');   // cooldown = warm (distinct from the cyan reload)
      __wep.rlArc.setAttribute('stroke-dashoffset', (__wep.circ * (1 - Math.max(0, Math.min(1, ent.swingT)))).toFixed(1));
    } else if (ent.readyT > 0) {
      // SWITCH READY-TIME (2026-07-28): a freshly-drawn weapon can't act yet — warm ring drains to READY.
      __wep.ammoTxt.textContent = '';
      __wep.rlRing.style.display = '';
      __wep.rlArc.setAttribute('stroke', '#ffb066');
      __wep.rlArc.setAttribute('stroke-dashoffset', (__wep.circ * (1 - Math.max(0, Math.min(1, ent.readyT / (ent.readyMax || 1))))).toFixed(1));
    } else if (ent.comboT > 0) {
      __wep.ammoTxt.textContent = 'COMBO';
      __wep.rlRing.style.display = '';
      __wep.rlArc.setAttribute('stroke', '#8fffa8');   // combo window = go-green
      const cw = (cfg && cfg.comboWindow) || 0.8;
      const frac = Math.max(0, Math.min(1, ent.comboT / cw));
      __wep.rlArc.setAttribute('stroke-dashoffset', (__wep.circ * (1 - frac)).toFixed(1));
    } else if (ent.strikeCdT > 0 && cfg && cfg.strikeCooldown > 0) {
      // R20.5 melee cooldown: the fist is spent — warm ring drains toward READY (the combo
      // state above outranks it: while the window is live you CAN press, cooldown or not).
      // The divisor is the ACTUAL armed span (strikeCdMax) so the 2.5s post-combo lockout
      // (2026-07-28) drains over 2.5s, not the base strikeCooldown.
      __wep.ammoTxt.textContent = '';
      __wep.rlRing.style.display = '';
      __wep.rlArc.setAttribute('stroke', '#ffb066');
      const frac = Math.max(0, Math.min(1, ent.strikeCdT / (ent.strikeCdMax || cfg.strikeCooldown)));
      __wep.rlArc.setAttribute('stroke-dashoffset', (__wep.circ * (1 - frac)).toFixed(1));
    } else {
      __wep.ammoTxt.textContent = 'READY';
      __wep.rlRing.style.display = 'none';
    }
    return;
  }
  if (W !== __wep.W) {   // switched to a different ranged slot: resize the rings to its cones
    __wep.ret.innerHTML = __wep.retInner(W);
    __wep.core = __wep.ret.querySelector('#__rcore');
    __wep.dot = __wep.ret.querySelector('#__rdot');
    __wep.stat = __wep.ret.querySelector('#__rstat');
    __wep.charge = __wep.ret.querySelector('#__rcharge');
    __wep.charged = __wep.ret.querySelector('#__rchgReady');
    __wep.W = W;
  }
  // reticle: project the WORLD aim point (eye + aimDir·reticleDist) to screen, so the crosshair sits
  // over where the gun points OUT IN FRONT of the suit — not fixed at screen center. Tracks yaw+pitch.
  const hh = tr.heading, pp = tr.pitch || 0, cpp = Math.cos(pp);
  const rd = W.reticleDist || 80;
  camera.updateMatrixWorld();
  __wep.aimV.set(
    tr.pos[0] + cpp * Math.cos(hh) * rd,
    tr.pos[1] + cpp * Math.sin(hh) * rd,
    tr.pos[2] + (W.eye || 0) + Math.sin(pp) * rd
  ).project(camera);
  const cw = renderer.domElement.clientWidth, ch = renderer.domElement.clientHeight;
  if (__wep.aimV.z < 1) {
    __wep.ret.style.display = '';
    __wep.ret.style.left = ((__wep.aimV.x * 0.5 + 0.5) * cw) + 'px';
    __wep.ret.style.top = ((-__wep.aimV.y * 0.5 + 0.5) * ch) + 'px';
  } else __wep.ret.style.display = 'none';   // aim point behind the camera
  if (ent.readyT > 0) {
    __retStatus(Math.max(0, Math.min(1, ent.readyT / (ent.readyMax || 1))), '#ffb066');
  } else if (W.cooldownT > 0 && !W.auto) {
    // semi/lob only — an AUTO weapon's between-round gap IS its fire rate (operator, 2026-08-10):
    // a 16/s gatling flashed this ring at rof, pure noise. Autos skip straight to ready.
    const __cdMax = W.burstLeft > 0 ? (1 / (W.burstRof || 8)) : (W.cooldown || 0.5);
    __retStatus(Math.max(0, Math.min(1, W.cooldownT / __cdMax)), '#ffb066');
  } else {
    __retReady();
  }
  __retCharge(W);
  if (W.energyMax > 0) {
    const efrac = Math.max(0, Math.min(1, (W.energy == null ? W.energyMax : W.energy) / W.energyMax));
    __wep.ammoTxt.textContent = W.energyLock ? 'OVERHEAT' : (Math.round(efrac * 100) + '%');
    __wep.rlRing.style.display = '';
    __wep.rlArc.setAttribute('stroke', W.energyLock ? '#ff6b6b' : (efrac < 0.25 ? '#ffb347' : '#7fd4ff'));
    __wep.rlArc.setAttribute('stroke-dashoffset', (__wep.circ * (1 - efrac)).toFixed(1));
  } else if (W.reloading) {
    __wep.ammoTxt.textContent = 'RELOADING';
    __wep.rlRing.style.display = '';
    __wep.rlArc.setAttribute('stroke', '#7fd4ff');   // reload = cyan (reset — a melee slot tints it warm)
    const frac = Math.max(0, Math.min(1, 1 - W.reloadT / (W.reload || 1)));
    __wep.rlArc.setAttribute('stroke-dashoffset', (__wep.circ * (1 - frac)).toFixed(1));
  } else {
    // a weapon with a reserve reads its spare rounds too (+n), and EMPTY when both are out
    __wep.ammoTxt.textContent = W.reserve === 0 && W.ammo <= 0 ? 'EMPTY' : W.ammo + ' / ' + W.magazine + (W.reserve != null ? '  +' + W.reserve : '');
    __wep.rlRing.style.display = 'none';
  }
  // TARGET ACQUIRED: the rings + dot burn RED while the aim would LAND — the renderer-side
  // mirror of stepWeapon's adjudication (in-range + inside the weapon's cone widened by the
  // target's angular size + a clear sightline; the egg test rides the collide egg's angular
  // approximation, same as the floating enemy-HP 'targeting' read). Invincible targets (dodge
  // i-frames / spawn shield) read WHITE — the tell is honest: red means the shot counts.
  const lock = __aimLocked(ent, W, tr);
  const ls = ent.lastShot;
  let col = lock ? '#ff5a4d' : '#e8f4ff';
  if (ls && now - ls.t < 0.12) col = ls.mode === 'core' ? '#8fffa8' : ls.mode === 'assist' ? '#7fd4ff' : '#ff6b6b';
  __wep.core.setAttribute('stroke', col);
  if (__wep.dot) __wep.dot.setAttribute('fill', lock ? '#ff5a4d' : '#e8f4ff');
}
function __aimLocked(ent, W, tr) {
  const pp = tr.pitch || 0, cp = Math.cos(pp);
  const ax = cp * Math.cos(tr.heading), ay = cp * Math.sin(tr.heading), az = Math.sin(pp);
  const eye = [tr.pos[0], tr.pos[1], tr.pos[2] + (W.eye || 0)];
  const aim = [ax, ay, az];
  const coreR = (W.coreAngle || 1.5) * Math.PI / 180;
  const assistR = (W.assistAngle || W.coreAngle || 1.5) * Math.PI / 180;
  const range = W.range || 400;
  const own = __bodySet();
  for (const tg of __world.entities) {
    if (tg === ent || tg.invincible || !(tg.body && tg.body.hittable)) continue;
    // stepWeapon's own adjudication, verbatim: v to the FEET pos, range gate on |v|, then the
    // ray-vs-egg intersection for suits (__CW.hitEgg — the exact engine function, so the HUD is
    // never more forgiving than the shot) with the area assist ring beside it; legacy spheres
    // keep the angular cone widened by their subtend.
    const dx = tg.transform.pos[0] - eye[0], dy = tg.transform.pos[1] - eye[1], dz = tg.transform.pos[2] - eye[2];
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-3 || d > range) continue;
    let would = false;
    if (tg.body.egg) {
      const te = __CW.hitEgg(eye, aim, tg);
      if (te != null && te <= range) would = true;
      else if (W.fireClass === 'area') {
        const ang = Math.acos(Math.max(-1, Math.min(1, (ax * dx + ay * dy + az * dz) / d)));
        would = ang <= assistR + Math.atan(tg.body.egg.a / d);
      }
    } else {
      const ang = Math.acos(Math.max(-1, Math.min(1, (ax * dx + ay * dy + az * dz) / d)));
      const subtend = Math.atan((tg.body.radius || 0.5) / d);
      would = ang <= coreR + subtend || (W.fireClass === 'area' && ang <= assistR + subtend);
    }
    if (!would) continue;
    const latR = tg.body.egg ? tg.body.egg.a : (tg.body.radius || 1);
    // sightline: probed lazily — only for a would-be hit (engine posture), so a clean lane costs
    // one ray per frame at most. Entity bodies are excluded (cover blocks shots, suits do not).
    __wep.rayO.set(eye[0], eye[1], eye[2]); __wep.rayD.set(dx / d, dy / d, dz / d);
    __wep.ray.set(__wep.rayO, __wep.rayD);
    __wep.ray.far = Math.max(0, d - latR);
    __wep.ray.camera = camera;   // sprite-safe traverse (see __ground's E8 note)
    let blocked = false;
    for (const h of __wep.ray.intersectObjects(scene.children, true)) {
      if (!h.object.isMesh) continue;
      let o = h.object; while (o) { if (own.includes(o)) break; o = o.parent; }
      if (!o) { blocked = true; break; }
    }
    __wep.ray.far = Infinity;
    if (!blocked) return true;
  }
  return false;
}
// BOOST GAUGE HUD (mobile-suit boost resource): a translucent minimalist horizontal bar pinned
// bottom-middle whose fill tracks the piloted suit's boost/boostMax (moved off the top 2026-08-13 —
// the top-center band is reserved for announcements: Mobile Suit Destroyed, match calls). Built
// ONLY when some entity carries a gauge (rule.boostMax, or pilotRule.boostMax on an unpiloted
// pilotable suit). The fill dims + reddens while the gauge is empty-locked (the "spent" read),
// ambers when low. Bottom-center is free in piloted mode: the bottom spectate HUD and this gauge
// are mutually exclusive (no gauge in spectate), and the weapon/HP cards keep to the right edge.
let __bg = null;
const __boostMaxOf = (e) => (e.rule && e.rule.boostMax > 0 ? e.rule.boostMax
  : (e.pilotRule && e.pilotRule.boostMax > 0 ? e.pilotRule.boostMax : 0));
const __boostEnt = __world.entities.find((e) => __boostMaxOf(e) > 0);
if (__boostEnt && !__world.spectate) {   // SPECTATE: boost is a pilot resource — no gauge when nobody flies
  const __bgWrap = document.createElement('div');
  __bgWrap.style.cssText = 'position:absolute;left:50%;bottom:16px;transform:translateX(-50%);width:240px;height:7px;border-radius:4px;background:rgba(10,18,28,0.32);box-shadow:inset 0 0 0 1px rgba(160,200,232,0.22);overflow:hidden;pointer-events:none;z-index:9';
  const __bgFill = document.createElement('div');
  __bgFill.style.cssText = 'height:100%;width:100%;background:#7fd4ff;opacity:0.72';
  __bgWrap.appendChild(__bgFill);
  wrap.appendChild(__bgWrap);
  // the OVERHEAT tell: while the gauge is locked (drained, or dumped by a dodge), thrust is dead —
  // a small red caption just above the bar reads it out (inboard of the screen edge, mirroring
  // the old under-the-bar placement at top). Hidden whenever the thruster is live.
  const __bgLabel = document.createElement('div');
  __bgLabel.textContent = 'OVERHEAT';
  __bgLabel.style.cssText = 'position:absolute;left:50%;bottom:27px;transform:translateX(-50%);font:700 10px system-ui,sans-serif;letter-spacing:.14em;color:#ff6b6b;text-shadow:0 1px 3px rgba(0,0,0,.6);display:none;pointer-events:none;z-index:9';
  wrap.appendChild(__bgLabel);
  __bgWrap.className = 'moj-c-gauge'; __bgFill.className = 'moj-c-fill'; __bgLabel.className = 'moj-c-cap';   // (a HUD look's hooks: mana-ui/theme.js gameHudCss)
  __bg = { wrap: __bgWrap, fill: __bgFill, label: __bgLabel };
}
// R19 SHIELD pip — REMOVED (operator, 2026-08-06): the shield's HP is no longer read out as a
// HUD bar. The shield still reads visually — the prop on the arm, the shatter fx on break, and
// the break-stagger — which is the whole tell now.
// RADAR HUD (mobile-suit): a top-down circular minimap pinned upper-right. Blips are the OTHER
// hittable entities relative to the piloted suit, HEADING-RELATIVE (the suit's forward is UP). Always
// top-down (ignores pitch), so it reads the same in ground and space. Vertical is encoded by the blip
// STYLE: an enemy ABOVE the suit is a THICK ring, one BELOW is a DOTTED ring, one roughly level is a
// filled dot. Rival SUITS (pilotable) are red; plain targets are blue. Built only for a controllable
// world that has a controlled shooter (pilot / armed) + at least one hittable other; re-resolves to
${lock ? `// TARGET LOCK bracket (lock.js): a diamond projected over the locked target's body centre with a
// LOCK caption; hidden when nothing is locked or the target sits behind the camera. Opt-in bytes.
const __lockEl = document.createElement('div');
__lockEl.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:9;display:none';
__lockEl.innerHTML = '<div style="width:40px;height:40px;margin:-20px 0 0 -20px;border:2px solid #ffe000;border-radius:5px;transform:rotate(45deg);box-shadow:0 0 14px rgba(255,224,0,.55),inset 0 0 8px rgba(255,224,0,.25)"></div>'
  + '<div style="position:absolute;left:26px;top:-8px;font:700 11px/1 ui-monospace,Menlo,monospace;letter-spacing:2px;color:#ffe000;text-shadow:0 0 8px rgba(255,224,0,.7)">LOCK</div>';
wrap.appendChild(__lockEl);
const __lockV = new THREE.Vector3();
function __updateLock() {
  const L = __world.lock, tg = L && L.target ? __world.byId[L.target] : null;
  if (!tg) { __lockEl.style.display = 'none'; return; }
  const p = tg.transform.pos, lift = tg.body && tg.body.egg ? (tg.body.egg.b || 0) : ((tg.body && tg.body.radius) || 0);
  camera.updateMatrixWorld();
  __lockV.set(p[0], p[1], p[2] + lift).project(camera);
  if (__lockV.z >= 1) { __lockEl.style.display = 'none'; return; }
  const cw = renderer.domElement.clientWidth, ch = renderer.domElement.clientHeight;
  __lockEl.style.display = '';
  __lockEl.style.left = ((__lockV.x * 0.5 + 0.5) * cw) + 'px';
  __lockEl.style.top = ((-__lockV.y * 0.5 + 0.5) * ch) + 'px';
}
` : ''}// the PILOTED suit each frame (T swaps it). Absent otherwise (byte-identical).
let __radar = null;
const __radarSelf = () => __world.spectate ? __specWatchEnt() : ((__world.pilotId && __world.byId[__world.pilotId]) || __armed || null);
// (none under a side camera: the screen is the lane, a side-scroller's foes in it)
if (__radarSelf() && !(__world.camera && __world.camera.rule && __world.camera.rule.type === 'side') && __world.entities.some((e) => e.body && e.body.hittable && e !== __radarSelf())) {
  const RSZ = 132;
  const __rWrap = document.createElement('div');
  __rWrap.style.cssText = 'position:absolute;right:16px;top:16px;width:' + RSZ + 'px;height:' + RSZ + 'px;border-radius:50%;background:rgba(8,14,22,0.42);box-shadow:inset 0 0 0 1px rgba(120,200,255,0.28),0 2px 10px rgba(0,0,0,0.42);pointer-events:none;z-index:9;overflow:hidden';
  const __rCv = document.createElement('canvas');
  __rCv.width = RSZ * 2; __rCv.height = RSZ * 2; __rCv.style.cssText = 'width:100%;height:100%';
  __rWrap.appendChild(__rCv); wrap.appendChild(__rWrap);
  __radar = { ctx: __rCv.getContext('2d'), sz: RSZ * 2, range: 620, band: 10 };
}
function __updateRadar() {
  if (!__radar) return;
  const x = __radar.ctx, S = __radar.sz, C = S / 2, rad = C - 11;
  x.clearRect(0, 0, S, S); x.setLineDash([]);
  x.strokeStyle = 'rgba(120,200,255,0.22)'; x.lineWidth = 2;
  x.beginPath(); x.arc(C, C, rad, 0, 7); x.stroke();
  x.beginPath(); x.arc(C, C, rad * 0.5, 0, 7); x.stroke();
  x.strokeStyle = 'rgba(120,200,255,0.12)'; x.lineWidth = 1.5;
  x.beginPath(); x.moveTo(C, C - rad); x.lineTo(C, C + rad); x.moveTo(C - rad, C); x.lineTo(C + rad, C); x.stroke();
  const self = __radarSelf();
  if (self) {
    const sp = self.transform.pos, h = self.transform.heading;
    const fwx = Math.cos(h), fwy = Math.sin(h), rgx = Math.sin(h), rgy = -Math.cos(h);   // forward + right basis
    const scale = rad / __radar.range, band = __radar.band;
    for (const e of __world.entities) {
      if (e === self || e.isCamera || !(e.body && e.body.hittable)) continue;
      const dx = e.transform.pos[0] - sp[0], dy = e.transform.pos[1] - sp[1], dz = e.transform.pos[2] - sp[2];
      const u = dx * fwx + dy * fwy, rr = dx * rgx + dy * rgy;   // forward-up, right
      let px = rr * scale, py = -u * scale;
      const d = Math.hypot(px, py); if (d > rad) { px = px / d * rad; py = py / d * rad; }   // clamp off-radar blips to the rim
      // TEAM battle: same-faction suits read as ALLIES (green), other-faction as enemies (red). Enemy
      // seats are not pilotable, so team mode keys off the TEAM, not the pilotable heuristic; plain
      // targets stay blue. Absent teams → the classic pilotable=red read (byte-identical).
      const __teamOn = __world.match && __world.match.teamMode;
      const ally = __teamOn && self.team && e.team && e.team === self.team;
      const enemy = __teamOn ? (!ally && !!e.team && e.team !== self.team) : !!e.pilotable;
      const bx = C + px, by = C + py, col = ally ? '#5fe08a' : (enemy ? '#ff5a5a' : '#7fd4ff');
      x.strokeStyle = col; x.fillStyle = col; x.setLineDash([]);
      if (dz > band) { x.lineWidth = enemy ? 3.4 : 2.6; x.beginPath(); x.arc(bx, by, enemy ? 6 : 5, 0, 7); x.stroke(); }          // ABOVE → thick ring
      else if (dz < -band) { x.setLineDash([3, 3]); x.lineWidth = 2; x.beginPath(); x.arc(bx, by, enemy ? 6 : 5, 0, 7); x.stroke(); x.setLineDash([]); }   // BELOW → dotted ring
      else { x.beginPath(); x.arc(bx, by, enemy ? 4.6 : 3.8, 0, 7); x.fill(); }                                                   // LEVEL → filled dot
    }
  }
  x.fillStyle = '#eaf4ff'; x.beginPath(); x.moveTo(C, C - 7); x.lineTo(C - 5, C + 5); x.lineTo(C + 5, C + 5); x.closePath(); x.fill();   // the pilot (forward = up)
}
// HEALTH BAR HUD (mobile-suit): the PILOTED suit's hp/hpMax, lower-right (stacked above the weapon
// panel). Built when some entity carries hp; re-resolves to world.pilotId each frame — damage carries
// across a T switch, so piloting a suit that was shot as the enemy shows its reduced HP. Green →
// amber → red as it drops. Absent when no entity has hp (byte-identical).
let __hp = null;
const __hpMaxOf = (e) => (e && Number.isFinite(e.hpMax) && e.hpMax > 0 ? e.hpMax : 0);
if (__world.entities.some((e) => __hpMaxOf(e) > 0)) {
  const __hpWrap = document.createElement('div');
  __hpWrap.style.cssText = 'position:absolute;right:12px;bottom:100px;width:196px;padding:6px 11px 8px;background:rgba(11,18,32,.62);border:1px solid #24324a;border-radius:9px;pointer-events:none;z-index:9';
  const __hpTop = document.createElement('div');
  __hpTop.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px;font:700 10px system-ui,sans-serif;letter-spacing:.14em;color:#cfe0f2;text-shadow:0 1px 3px rgba(0,0,0,.6)';
  const __hpLbl = document.createElement('span'); __hpLbl.textContent = 'HP';
  const __hpNum = document.createElement('span'); __hpNum.style.cssText = 'font:600 12px system-ui,sans-serif;letter-spacing:0;color:#e8f4ff';
  __hpTop.appendChild(__hpLbl); __hpTop.appendChild(__hpNum);
  const __hpTrack = document.createElement('div');
  __hpTrack.style.cssText = 'height:9px;border-radius:5px;background:rgba(10,18,28,0.55);box-shadow:inset 0 0 0 1px rgba(160,200,232,0.18);overflow:hidden';
  const __hpFill = document.createElement('div');
  __hpFill.style.cssText = 'height:100%;width:100%;background:#5fe08a;opacity:0.9';
  __hpTrack.appendChild(__hpFill);
  __hpWrap.appendChild(__hpTop); __hpWrap.appendChild(__hpTrack);
  wrap.appendChild(__hpWrap);
  __hpWrap.className = 'moj-c-hp'; __hpTrack.className = 'moj-c-track'; __hpFill.className = 'moj-c-fill'; __hpNum.className = 'moj-c-num'; __hpLbl.className = 'moj-c-lbl';   // (a HUD look's hooks: mana-ui/theme.js gameHudCss)
  __hp = { wrap: __hpWrap, fill: __hpFill, num: __hpNum };
}
function __updateHpHud() {
  if (!__hp) return;
  // SPECTATE: the bar tracks the WATCHED fighter (Tab cycles it); piloted worlds track the pilot.
  const ent = __world.spectate ? __specWatchEnt() : ((__world.pilotId && __world.byId[__world.pilotId]) || null);
  const max = __hpMaxOf(ent);
  if (max <= 0) { __hp.wrap.style.display = 'none'; return; }
  __hp.wrap.style.display = '';
  const cur = ent.body && Number.isFinite(ent.body.hp) ? Math.max(0, ent.body.hp) : max;
  const frac = Math.max(0, Math.min(1, cur / max));
  __hp.fill.style.width = (frac * 100).toFixed(1) + '%';
  __hp.fill.style.background = frac < 0.25 ? '#ff5a5a' : (frac < 0.55 ? '#ffb347' : '#5fe08a');
  __hp.num.textContent = Math.ceil(cur) + ' / ' + max;
}
// ENEMY HP BARS: a floating red hp bar above any hp-bearing enemy the piloted suit is TARGETING (the
// aim ray is on it, within its angular size) or ENGAGING (hit within the last ~4s). World-space,
// projected to screen each frame; the red fill shrinks as you chip its hp. One bar per hp-bearing
// entity (the piloted suit's own is hidden — its hp is the lower-right bar). Absent when nothing has hp.
const __ehp = [];
for (const e of __world.entities) {
  if (!(e.body && Number.isFinite(e.hpMax) && e.hpMax > 0)) continue;
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;width:56px;height:6px;transform:translate(-50%,-50%);border-radius:3px;background:rgba(8,12,20,0.6);box-shadow:inset 0 0 0 1px rgba(255,120,120,0.55),0 1px 3px rgba(0,0,0,0.5);overflow:hidden;pointer-events:none;z-index:8;display:none';
  const fl = document.createElement('div'); fl.style.cssText = 'height:100%;width:100%;background:#ff5a5a';
  el.appendChild(fl); wrap.appendChild(el);
  __ehp.push({ id: e.id, el: el, fill: fl });
}
const __ehpV = __ehp.length ? new THREE.Vector3() : null;${foeBars ? `
// the one foe the pilot targets: its lock's, else the foe nearest the way it faces (a ground hero aims where it
// faces: the angle on the ground, within the foe's own width and 30 m), the nearer of two equally in line
function __foeTarget(pilot) {
  if (!pilot) return null;
  if (__world.lock && __world.lock.target) return __world.lock.target;
  const h = pilot.transform.heading, p = pilot.transform.pos;
  let best = null, bestS = Infinity;
  for (const e of __world.entities) {
    if (!(e.body && e.body.hpBar === 'target') || e.gone || e.downed || e === pilot) continue;
    const dx = e.transform.pos[0] - p[0], dy = e.transform.pos[1] - p[1], d = Math.hypot(dx, dy);
    if (d > 30 || d < 1e-6) continue;
    const a = Math.abs(((Math.atan2(dy, dx) - h + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
    const w = (e.body.egg && e.body.egg.a) || e.body.radius || 0.5;
    if (a <= 0.2 + Math.atan(w / d) && a * 10 + d < bestS) { bestS = a * 10 + d; best = e.id; }
  }
  return best;
}
// a foe body's drawn top above its feet (m), measured once from its mesh against its own group (where it is drawn,
// whatever the entity did this frame); its bar stands clear of it
const __foeTop = {}, __foeBox = new THREE.Box3();
function __foeTopOf(e) {
  if (__foeTop[e.id] != null) return __foeTop[e.id];
  const g = __bodies[e.id]; if (!g) return 1;
  g.updateMatrixWorld(true);
  __foeBox.setFromObject(g);
  const top = __foeBox.max.z - g.position.z;
  return Number.isFinite(top) && top > 0 ? (__foeTop[e.id] = Math.min(top, 12)) : 1;
}${foeRim ? `
// the TARGET RIM: a shell of light at the targeted foe's edges (fresnel: brightest where its surface turns from the eye),
// pulsing, on each bone mesh of the body it is drawn as now, or on its one skinned mesh (a merged figure: its
// boneMeshes are bones), bound to its skeleton; moved off when the target changes or its body does
const __tgtRimMat = new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(1, 1, 1) }, uK: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: '#include <common>\\n#include <skinning_pars_vertex>\\n#include <logdepthbuf_pars_vertex>\\nvarying vec3 vN; varying vec3 vV; void main() {\\n#include <beginnormal_vertex>\\n#include <skinbase_vertex>\\n#include <skinnormal_vertex>\\n#include <begin_vertex>\\n#include <skinning_vertex>\\n vec4 wp = modelMatrix * vec4(transformed + objectNormal * 0.006, 1.0); vN = normalize(mat3(modelMatrix) * objectNormal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp;\\n#include <logdepthbuf_vertex>\\n}',
  fragmentShader: '#include <logdepthbuf_pars_fragment>\\nuniform vec3 uCol; uniform float uK; varying vec3 vN; varying vec3 vV; void main() {\\n#include <logdepthbuf_fragment>\\n float f = pow(1.0 - abs(dot(normalize(vN), vV)), 1.8); gl_FragColor = vec4(uCol * (1.0 + f), min(1.0, (0.18 + 1.3 * f) * uK)); }' });
const __rim = { id: null, g: null, kids: [] };
// smooth normals for a bone mesh's triangle list, once (its corners averaged where they meet), for the rim's fresnel
function __rimNormals(geo) {
  if (geo.attributes.normal) return;
  const P = geo.attributes.position.array, N = new Float32Array(P.length), acc = new Map(), key = (i) => Math.round(P[i] * 1e4) + ',' + Math.round(P[i + 1] * 1e4) + ',' + Math.round(P[i + 2] * 1e4);
  for (let t = 0; t < P.length; t += 9) {
    const ax = P[t + 3] - P[t], ay = P[t + 4] - P[t + 1], az = P[t + 5] - P[t + 2], bx = P[t + 6] - P[t], by = P[t + 7] - P[t + 1], bz = P[t + 8] - P[t + 2];
    const n = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
    for (let k = 0; k < 9; k += 3) { const q = key(t + k), a = acc.get(q) || [0, 0, 0]; a[0] += n[0]; a[1] += n[1]; a[2] += n[2]; acc.set(q, a); }
  }
  for (let i = 0; i < P.length; i += 3) { const a = acc.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1; N[i] = a[0] / l; N[i + 1] = a[1] / l; N[i + 2] = a[2] / l; }
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
}
function __foeRim(id) {
  const e = id && __world.byId[id], g = e && __bodies[id];
  if (__rim.id !== id || __rim.g !== g) {
    for (const k of __rim.kids) if (k.parent) k.parent.remove(k);
    __rim.kids = []; __rim.id = id; __rim.g = g;
    const rf = g && g.userData.rigFig;
    if (rf) for (const m of rf.skin ? [rf.skin] : rf.boneMeshes) {
      if (!m || !m.geometry || !m.geometry.attributes.position) continue;
      __rimNormals(m.geometry);
      const k = m.isSkinnedMesh ? new THREE.SkinnedMesh(m.geometry, __tgtRimMat) : new THREE.Mesh(m.geometry, __tgtRimMat);
      k.raycast = function () {}; k.renderOrder = 5; k.userData.ink = true;
      if (m.isSkinnedMesh) { k.frustumCulled = false; m.parent.add(k); k.bind(m.skeleton, m.bindMatrix); } else m.add(k);
      __rim.kids.push(k);
    }
    if (e && Array.isArray(e.body.targetRim)) __tgtRimMat.uniforms.uCol.value.setRGB(e.body.targetRim[0], e.body.targetRim[1], e.body.targetRim[2]);
  }
  __tgtRimMat.uniforms.uK.value = __rim.kids.length ? 0.75 + 0.25 * Math.sin(__world.time * 6) : 0;
}` : ''}` : ''}
function __updateEnemyHp() {
  if (!__ehp.length) return;
  const pilot = (__world.pilotId && __world.byId[__world.pilotId]) || null;
  const __teamOn = __world.match && __world.match.teamMode;   // TEAM: allies get a green, always-on bar
  const __selfTeam = pilot && pilot.team;
  const now = __world.time, cw = renderer.domElement.clientWidth, ch = renderer.domElement.clientHeight;
  let aim = null, eye = null;
  if (pilot) {
    const ph = pilot.transform.heading, pp = pilot.transform.pitch || 0, cp = Math.cos(pp);
    aim = [cp * Math.cos(ph), cp * Math.sin(ph), Math.sin(pp)];   // the fire ray direction
    const ez = pilot.weapon ? (pilot.weapon.eye || 0) : (pilot.collideVol ? pilot.collideVol.cz : 12);
    eye = [pilot.transform.pos[0], pilot.transform.pos[1], pilot.transform.pos[2] + ez];
  }
  camera.updateMatrixWorld();${foeBars ? `
  const __foeT = __foeTarget(pilot);${foeRim ? `
  __foeRim(__foeT);` : ''}` : ''}
  for (const r of __ehp) {
    const e = __world.byId[r.id];${foeBars ? `
    if (e && e.body && e.body.hpBar === 'target') {
      if (e.id !== __foeT || e.gone || e.downed) { r.el.style.display = 'none'; continue; }
      const top = __foeTopOf(e);
      __ehpV.set(e.transform.pos[0], e.transform.pos[1], e.transform.pos[2] + top + 0.25).project(camera);
      if (__ehpV.y > 0.94) __ehpV.set(e.transform.pos[0], e.transform.pos[1], e.transform.pos[2] - 0.2).project(camera);
      if (__ehpV.z >= 1) { r.el.style.display = 'none'; continue; }
      r.el.style.display = '';
      r.el.style.left = ((__ehpV.x * 0.5 + 0.5) * cw) + 'px';
      r.el.style.top = ((-__ehpV.y * 0.5 + 0.5) * ch) + 'px';
      const cur = Number.isFinite(e.body.hp) ? Math.max(0, e.body.hp) : e.hpMax, frac = Math.max(0, Math.min(1, cur / e.hpMax));
      r.fill.style.width = (frac * 100).toFixed(1) + '%';
      r.fill.style.background = frac < 0.3 ? '#ff2e2e' : '#ff5a5a';
      continue;
    }` : ''}
    // gone covers both the vanished wreck (finisher) and a DORMANT tutorial seat parked at its
    // authored pose — neither should float a bar over empty air.
    if (!e || e === pilot || e.gone) { r.el.style.display = 'none'; continue; }
    // TEAM: an ALLY bar is always shown (green) so you can track your wing's health; an enemy bar keeps
    // the engage/target gate — ENGAGING (recently hit) OR TARGETING (aim ray within its angular size).
    const ally = __teamOn && __selfTeam && e.team && e.team === __selfTeam;
    let show = ally ? !e.downed : (e.hitFlash >= 0 && (now - e.hitFlash) < 4);
    if (!show && !ally && aim) {
      const dx = e.transform.pos[0] - eye[0], dy = e.transform.pos[1] - eye[1];
      const dz = (e.transform.pos[2] + (e.collideVol ? e.collideVol.cz : 12)) - eye[2];
      const d = Math.hypot(dx, dy, dz) || 1e-6, dot = (aim[0] * dx + aim[1] * dy + aim[2] * dz) / d;
      const latR = e.collideVol ? e.collideVol.a : (e.body.radius || 1);
      if (dot > 0 && Math.acos(Math.max(-1, Math.min(1, dot))) <= 0.07 + Math.atan(latR / d)) show = true;
    }
    if (!show) { r.el.style.display = 'none'; continue; }
    // project the enemy's HEAD (above the collide egg / hit radius) to screen
    const topZ = e.transform.pos[2] + (e.collideVol ? e.collideVol.c * 2.1 : (e.body.radius ? e.body.radius * 1.5 : 22));
    __ehpV.set(e.transform.pos[0], e.transform.pos[1], topZ).project(camera);
    if (__ehpV.z >= 1) { r.el.style.display = 'none'; continue; }   // behind the camera
    r.el.style.display = '';
    r.el.style.left = ((__ehpV.x * 0.5 + 0.5) * cw) + 'px';
    r.el.style.top = ((-__ehpV.y * 0.5 + 0.5) * ch) + 'px';
    const cur = Number.isFinite(e.body.hp) ? Math.max(0, e.body.hp) : e.hpMax;
    const frac = Math.max(0, Math.min(1, cur / e.hpMax));
    r.fill.style.width = (frac * 100).toFixed(1) + '%';
    r.fill.style.background = ally ? '#5fe08a' : (frac < 0.3 ? '#ff2e2e' : '#ff5a5a');
    r.el.style.boxShadow = ally ? 'inset 0 0 0 1px rgba(120,255,160,0.62),0 1px 3px rgba(0,0,0,0.5)' : 'inset 0 0 0 1px rgba(255,120,120,0.55),0 1px 3px rgba(0,0,0,0.5)';
  }
}
function __updateBoostHud() {
  if (!__bg) return;
  const ent = (__world.pilotId && __world.byId[__world.pilotId]) || __boostEnt;
  const max = __boostMaxOf(ent);
  if (max <= 0) { __bg.wrap.style.display = 'none'; __bg.label.style.display = 'none'; return; }
  __bg.wrap.style.display = '';
  const cur = ent.boost == null ? max : ent.boost;   // unpiloted-never-ran suits read full
  const frac = Math.max(0, Math.min(1, cur / max));
  const overheat = !!ent.boostLock;
  // OVERHEAT read (rev3): while the bar is overheat-locked, boost AND dodge are both dead —
  // the RED fill + the OVERHEAT caption now span the whole ~7.5s climb back to FULL (the
  // engine unlocks only at a full bar). Unlocked = both usable → the classic cyan, with the
  // low-fuel amber warning that a little more thrust would tip it into the outage.
  __bg.fill.style.width = (frac * 100).toFixed(1) + '%';
  __bg.fill.style.background = overheat ? '#ff6b6b' : (frac < 0.25 ? '#ffb347' : '#7fd4ff');
  __bg.fill.style.opacity = overheat ? '0.5' : '0.72';
  __bg.label.style.display = overheat ? '' : 'none';
}${entities.some((x) => x && x.rule && x.rule.stamina === true) ? `
// STAMINA (a hero that sprints on it, rules-platform.js \`stamina\`): the boost gauge read as the hero's stamina, a green bar that
// ambers low, and WINDED (not OVERHEAT) while it is run dry and refilling. Emitted only on a page whose hero sprints.
if (__bg && __boostEnt && __boostEnt.rule && __boostEnt.rule.stamina) { __bg.label.textContent = 'WINDED'; __bg.label.style.color = '#ffb36b'; }
const __updateBoostHud0 = __updateBoostHud;
__updateBoostHud = function () {   // eslint-disable-line no-func-assign
  __updateBoostHud0();
  const ent = (__world.pilotId && __world.byId[__world.pilotId]) || __boostEnt;
  if (!__bg || !ent || !ent.rule || !ent.rule.stamina) return;
  const max = __boostMaxOf(ent), frac = Math.max(0, Math.min(1, (ent.boost == null ? max : ent.boost) / max));
  __bg.fill.style.background = ent.boostLock ? '#ff8a5c' : (frac < 0.25 ? '#ffc35c' : '#8fdc6a');
};` : ''}
// muzzle-flash + tracer + impact effects: on each new shot (weapon.shots increments) spawn transient
// additive meshes at the engine-provided from/to and fade them over their ttl. Non-pickable (raycast
// disabled) so they never confuse the ground probe. Colour + size come from the weapon's fx config.
// R20: tracked PER SHOOTER (a map keyed by entity id), not just the piloted suit — an AI-driven
// vacated suit fires back now, and its tracers/flash/impacts must be visible too. Each fx record
// carries its own base size, so two shooters' effects never share scale state.
const __fxSeen = {};   // entity id -> { w, shots } — the weapon + shot count each shooter's fx track
const __fx = [];
const __muzzleV = new THREE.Vector3();
const __beamUpY = new THREE.Vector3(0, 1, 0);   // the cylinder's own axis (+Y), rotated onto the travel dir
const __beamDir = new THREE.Vector3();
const __impUpZ = new THREE.Vector3(0, 0, 1);    // +Z → shot dir, for orienting the impact ring/star
function __fxMat(c) { return new THREE.MeshBasicMaterial({ color: new THREE.Color(c), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }); }
// richer HIT feedback (2026-08-13, operator "add more impact frames so we can see we're hitting"): a
// landed rifle/vulcan shot pops a CLUSTER at the impact point — a bright core FLASH, an expanding shock
// RING facing back up the shot, and a radial SPARK STAR in the plane perpendicular to the shot — so a
// hit reads visually, not just as a dropping number. Deferred to the bolt's arrival, and seeded
// ONLY by geometry (no Math.random → capture stays byte-identical). Sized by the weapon's fxScale, so a
// vulcan round sparks small and a rifle bolt hits big.
${flow ? `// on the flow (rupa-vayo): a hit is a soft flash and a ring of air, sprites, no meshes and no spikes
const __fxSoftTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const __fxRingTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 18, 32, 32, 31); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const __fxSprite = (tex, col) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(col), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })); s.geometry = s.geometry.clone(); s.raycast = function () {}; s.visible = false; scene.add(s); return s; };   // (its own quad: a dropped effect frees what it holds)
function __spawnImpactFx(b, col, sz, dir, at) {
  const flash = __fxSprite(__fxSoftTex, 0xffffff); flash.position.set(b[0], b[1], b[2]); flash.scale.setScalar(sz * 0.42);
  __fx.push({ obj: flash, born: at, ttl: 0.13, kind: 'impact', base: sz * 0.85 });
  const glow = __fxSprite(__fxSoftTex, col); glow.position.set(b[0], b[1], b[2]);
  __fx.push({ obj: glow, born: at, ttl: 0.22, kind: 'burst', base: sz * 0.7, dim: 0.6 });
  const ring = __fxSprite(__fxRingTex, col); ring.position.set(b[0], b[1], b[2]);
  __fx.push({ obj: ring, born: at, ttl: 0.2, kind: 'burst', base: sz * 0.9, dim: 0.7 });
}
` : ''}function __spawnImpactFx${flow ? 'Mesh' : ''}(b, col, sz, dir, at) {
  const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), __fxMat(0xffffff));
  flash.position.set(b[0], b[1], b[2]); flash.scale.setScalar(sz * 0.42); flash.raycast = function () {}; flash.visible = false; scene.add(flash);
  __fx.push({ obj: flash, born: at, ttl: 0.13, kind: 'impact', base: sz * 0.85 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.13, 6, 20), __fxMat(col));
  ring.position.set(b[0], b[1], b[2]);
  ring.quaternion.setFromUnitVectors(__impUpZ, __beamDir.set(-dir[0], -dir[1], -dir[2]));   // face back up the shot
  ring.raycast = function () {}; ring.visible = false; scene.add(ring);
  __fx.push({ obj: ring, born: at, ttl: 0.2, kind: 'shock', base: sz * 0.32 });
  const N = 7, pts = [];
  for (let k = 0; k < N; k++) { const ang = k * (Math.PI * 2 / N); pts.push(0, 0, 0, Math.cos(ang), Math.sin(ang), 0); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const star = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: new THREE.Color(col), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  star.position.set(b[0], b[1], b[2]);
  star.quaternion.setFromUnitVectors(__impUpZ, __beamDir.set(dir[0], dir[1], dir[2]));   // star plane ⟂ the shot
  star.raycast = function () {}; star.visible = false; scene.add(star);
  __fx.push({ obj: star, born: at, ttl: 0.16, kind: 'shard', base: sz * 0.9 });
}
function __spawnShotFx(shot, from, col, sz, range) {
  if (!shot || !from || !shot.to) return;
  const a = from, b = shot.to, born = __world.time;
  // TRAVELLING BOLT (2026-08-13): a hitscan shot (beam rifle / beam MG / vulcan — the engine resolves
  // the hit instantly) is drawn as a thin ELONGATED ROD that FLIES from the muzzle to the target over a
  // brief beat, instead of the old instant full-length tracer line (which read as "just a flash"). The
  // rod is a slim cylinder aligned to the travel direction — NO spherical bead (operator "less ball,
  // more rod, no circular effect"). The travel time scales with how far the shot reached vs the weapon's
  // RANGE, so it is world-scale independent — a full-range shot takes ~beamMaxT, a point-blank one
  // ~beamMinT. Each weapon's fxColor tints the rod (cyan beams, amber tracers), so it reads as
  // beam-vs-round by colour. The bazooka never reaches here (to:null; the projectile channel owns it).
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 0.05) return;   // degenerate (muzzle == target): no bolt, and no zero-vector orientation
  const beamMinT = 0.045, beamMaxT = 0.26;
  const rng = (range && range > 0) ? range : dist;
  const travelT = Math.max(beamMinT, Math.min(beamMaxT, beamMaxT * dist / rng));
  const dir = [dx / dist, dy / dist, dz / dist];
  // length scales with the WEAPON (fxScale), NOT the shot distance — so a small head vulcan fires a
  // small bolt (a distance-driven length made vulcan rounds long streaks; operator 2026-08-13). Capped
  // at half the gap so a point-blank shot stays short. Rifle ≈ sz·1.6, vulcan ≈ sz·1.6 of a small sz.
  const rodLen = Math.min(dist * 0.5, sz * 1.6);
  const rodRad = Math.max(0.2, sz * 0.1);                                 // slim — a rod, not a ball
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(rodRad, rodRad, rodLen, 6, 1), __fxMat(col));
  rod.quaternion.setFromUnitVectors(__beamUpY, __beamDir.set(dir[0], dir[1], dir[2]));   // +Y → travel dir (fixed for a straight shot)
  rod.raycast = function () {}; scene.add(rod);
  __fx.push({ obj: rod, born: born, ttl: travelT, kind: 'beam', p0: a.slice(), p1: b.slice(), dir: dir, len: rodLen, dist: dist });
  const mf = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), __fxMat(col));
  mf.position.set(a[0], a[1], a[2]); mf.scale.setScalar(sz * 0.5); mf.raycast = function () {}; scene.add(mf);
  __fx.push({ obj: mf, born: born, ttl: 0.08, kind: 'flash', base: sz * 0.5 });
  // the impact CLUSTER is DEFERRED to the bolt's arrival (born + travelT), so the hit lands WHEN the
  // bolt reaches the target instead of at fire time (each piece stays invisible until then, age < 0 guard).
  if (shot.mode === 'core' || shot.mode === 'assist') __spawnImpactFx(b, col, sz, dir, born + travelT);
}
// A ROUND (a weapon's \`round\`, gameworld/rounds.js: small arms in the sim register): what an eye sees of a gun going
// off. A muzzle flash about a hand's length (three thin blades crossed along the bore round a small hot core), gone in
// a frame or two, and a wisp of grey smoke that rises and spreads; the round a faint thin streak a few metres long that
// crosses the gap at its own speed (a rifle's 30 m in two frames); where it strikes a wall a pinch of dust, on a body a
// smaller one. No glow, no rings, no stars, nothing a metre wide.
function __roundMat(c, o, add) { return new THREE.MeshBasicMaterial({ color: new THREE.Color(c), transparent: true, opacity: o, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, side: THREE.DoubleSide }); }
function __roundPuff(at, col, size, ttl, dim, rise, born) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), __roundMat(col, dim, false));
  m.position.set(at[0], at[1], at[2]); m.scale.setScalar(size * 0.3); m.raycast = function () {}; m.visible = false; scene.add(m);
  __fx.push({ obj: m, born, ttl, kind: 'wisp', base: size, dim, rise, z0: at[2] });
}
function __spawnRoundFx(shot, from, R, range) {
  if (!shot || !from || !shot.to) return;
  const a = from, b = shot.to, born = __world.time;
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], dist = Math.hypot(dx, dy, dz);
  if (dist < 0.05) return;
  const dir = [dx / dist, dy / dist, dz / dist], fl = R.flash || 0.12, sp = R.speed || 800;
  // the flash: blades along the bore from the muzzle, a core at it
  const g = new THREE.Group();
  g.position.set(a[0], a[1], a[2]); g.quaternion.setFromUnitVectors(__beamUpY, __beamDir.set(dir[0], dir[1], dir[2]));
  for (let k = 0; k < 3; k++) { const bl = new THREE.Mesh(new THREE.PlaneGeometry(fl * 0.3, fl), __roundMat(0xffcf8a, 0.85, true)); bl.position.y = fl * 0.5; bl.rotation.y = k * Math.PI / 3; bl.raycast = function () {}; g.add(bl); }
  const core = new THREE.Mesh(new THREE.SphereGeometry(fl * 0.2, 6, 4), __roundMat(0xfff0d8, 0.9, true)); core.raycast = function () {}; g.add(core);
  scene.add(g);
  __fx.push({ obj: g, born, ttl: 0.04, kind: 'mflash' });
  __roundPuff([a[0] + dir[0] * fl, a[1] + dir[1] * fl, a[2] + dir[2] * fl], 0xc9c5bc, fl * 2.2, 0.7, 0.14, 0.18, born);
  // the round: a streak travelling at its speed, never longer than the gap
  const len = Math.min(dist, sp * 0.006), ttl = Math.max(1 / 60, dist / sp);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute([a[0], a[1], a[2], a[0], a[1], a[2]], 3));
  const ln = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: new THREE.Color(0xfff2d8), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
  ln.raycast = function () {}; ln.frustumCulled = false; scene.add(ln);
  __fx.push({ obj: ln, born, ttl, kind: 'streak', p0: a.slice(), dir, len, dist });
  // the strike: dust off a wall (a miss that stopped short of its range), a smaller puff off a body
  const struck = shot.mode === 'core' || shot.mode === 'assist', wall = shot.mode === 'miss' && range > 0 && dist < range * 0.98;
  if (struck || wall) {
    const back = [b[0] - dir[0] * 0.05, b[1] - dir[1] * 0.05, b[2] - dir[2] * 0.05];
    __roundPuff(back, wall ? 0xa59a88 : 0x8a7c70, wall ? 0.32 : 0.16, wall ? 0.6 : 0.35, wall ? 0.45 : 0.3, 0.12, born + ttl);
    const sk = new THREE.Mesh(new THREE.SphereGeometry(wall ? 0.03 : 0.02, 6, 4), __roundMat(0xffe6c0, 0.9, true));
    sk.position.set(back[0], back[1], back[2]); sk.raycast = function () {}; sk.visible = false; scene.add(sk);
    __fx.push({ obj: sk, born: born + ttl, ttl: 0.05, kind: 'mflash' });
  }
}
function __updateFx() {
  // EVERY armed entity's shots spawn fx (the pilot, a fixed armed entity, an AI fire-back suit).
  for (const fent of __world.entities) {
    if (!fent.weapon && !__fxSeen[fent.id]) continue;
    // a loadout switch (or a T pilot transfer) swaps the live weapon reference (or nulls it on a
    // melee slot): re-sync this shooter's fx state so shot counting + tint follow its active gun.
    const rec = __fxSeen[fent.id] || (__fxSeen[fent.id] = { w: fent.weapon, shots: fent.weapon ? (fent.weapon.shots || 0) : 0 });
    if (fent.weapon !== rec.w) { rec.w = fent.weapon; rec.shots = rec.w ? (rec.w.shots || 0) : 0; }
    if (!rec.w) continue;
    const s = rec.w.shots || 0;
    if (s > rec.shots) {
      const col = rec.w.fxColor != null ? rec.w.fxColor : 0xffcc66;
      const sz = rec.w.fxScale != null ? rec.w.fxScale : 3;
      // origin = the live weapon-tip locator (rides the arm) when present, else the engine's from.
      // R19 fix: a show:'none' slot (head vulcan / torso beam) fires from the BODY muzzle, NOT the
      // hand — keep the engine's from (head/chest muzzleOffset) instead of the arm locator.
      let from = fent.lastShot && fent.lastShot.from;
      const __flo = __entLoadout(fent), __fcfg = __flo && __flo[fent.loadoutIdx || 0];
      // show may be a [active, ...racked] list — the ACTIVE (first) tag decides body-vs-hand muzzle
      const __fshow = __fcfg && (Array.isArray(__fcfg.show) ? __fcfg.show[0] : __fcfg.show);
      const bodyMuzzle = __fshow === 'none';
      const body = __bodies[fent.id], rf = body && body.userData && body.userData.rigFig;
      if (rf && rf.muzzle && !bodyMuzzle) { rf.muzzle.getWorldPosition(__muzzleV); from = [__muzzleV.x, __muzzleV.y, __muzzleV.z]; }
      // (a gun carried in the hands or before the eye, gunplay-view.js, flashes at its own muzzle)
      else if (window.__mojMuzzle && window.__mojMuzzle[fent.id]) from = window.__mojMuzzle[fent.id].slice();
      if (rec.w.round) __spawnRoundFx(fent.lastShot, from, rec.w.round, rec.w.range);
      else __spawnShotFx(fent.lastShot, from, col, sz, rec.w.range);
      // DUAL WIELD (muzzleDual): the second gun fires SIMULTANEOUSLY — mirror the muzzle across the
      // body's sagittal plane (normal = the right vector) so the off-hand pistol flashes at its own tip.
      if (from && rec.w.muzzleDual) {
        const __tp = fent.transform.pos, __hh = fent.transform.heading || 0;
        const __rx = Math.sin(__hh), __ry = -Math.cos(__hh);
        const __lat = (from[0] - __tp[0]) * __rx + (from[1] - __tp[1]) * __ry;
        __spawnShotFx(fent.lastShot, [from[0] - 2 * __lat * __rx, from[1] - 2 * __lat * __ry, from[2]], col, sz, rec.w.range);
      }
      rec.shots = s;
    }
  }
  for (let i = __fx.length - 1; i >= 0; i--) {
    const f = __fx[i], age = (__world.time - f.born) / f.ttl;
    if (age >= 1) { scene.remove(f.obj); f.obj.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); __fx.splice(i, 1); continue; }
    if (age < 0) { f.obj.visible = false; continue; }   // DEFERRED fx (a beam's impact) waits for its born time
    if (!f.obj.visible) f.obj.visible = true;
    if (f.kind === 'beam') {
      // the ROD EMERGES from the muzzle and flies forward: the leading tip travels p0→p1, and the rod's
      // tail is CLAMPED at the muzzle (never extends behind p0) — so a bolt spawns AT the gun tip, not
      // trailing out the back (operator 2026-08-13, head vulcan). It grows to full length as it clears
      // the muzzle, then travels rigid. Orientation is fixed (straight shot); centre + length update.
      const leadDist = f.dist * age;                    // the leading tip's distance from the muzzle
      const effLen = Math.min(f.len, leadDist);         // visible length: 0 at the muzzle → full once clear
      const c = leadDist - effLen * 0.5;                // rod centre, measured from the muzzle along dir
      f.obj.position.set(f.p0[0] + f.dir[0] * c, f.p0[1] + f.dir[1] * c, f.p0[2] + f.dir[2] * c);
      f.obj.scale.set(1, f.len > 0 ? effLen / f.len : 1, 1);   // shrink the cylinder to its un-clipped length
      const fade = age > 0.8 ? (1 - (age - 0.8) / 0.2) : 1;   // a brief guttering as it lands
      f.obj.material.opacity = 0.9 * fade;
    }
    else if (f.kind === 'flash') { f.obj.material.opacity = 1 - age; f.obj.scale.setScalar(f.base * (1 + age * 0.6)); }
    // a round's (__spawnRoundFx): the muzzle flash shown whole and gone; the smoke rising and spreading as it thins; the
    // streak's head crossing the gap at the round's speed, its tail a few metres behind
    else if (f.kind === 'mflash') { f.obj.scale.setScalar(1 + age * 0.25); }
    else if (f.kind === 'wisp') { f.obj.material.opacity = f.dim * (1 - age) * (1 - age); f.obj.scale.setScalar(f.base * (0.3 + age * 0.9)); f.obj.position.z = f.z0 + f.rise * age; }
    else if (f.kind === 'streak') {
      const lead = f.dist * Math.min(1, age + 1 / 60 / Math.max(1e-3, f.ttl)), tail = Math.max(0, lead - f.len), ap = f.obj.geometry.attributes.position;
      ap.setXYZ(0, f.p0[0] + f.dir[0] * tail, f.p0[1] + f.dir[1] * tail, f.p0[2] + f.dir[2] * tail);
      ap.setXYZ(1, f.p0[0] + f.dir[0] * lead, f.p0[1] + f.dir[1] * lead, f.p0[2] + f.dir[2] * lead);
      ap.needsUpdate = true;
    }
    else if (f.kind === 'impact') { f.obj.material.opacity = 1 - age; f.obj.scale.setScalar(f.base * (0.3 + age * 1.4)); }
    // impact CLUSTER (rifle/vulcan hit): a shock RING expands + fades; a radial SPARK STAR flies out + snaps out.
    else if (f.kind === 'shock') { f.obj.material.opacity = 0.9 * (1 - age); f.obj.scale.setScalar(f.base * (0.3 + age * 1.7)); }
    else if (f.kind === 'shard') { f.obj.material.opacity = 0.95 * (1 - age * age); f.obj.scale.setScalar(f.base * (0.25 + age * 1.25)); }
    // R14 burst: an expanding shell that carries its OWN base + dim (so it is not coupled to the
    // active hitscan weapon's __fxSz like the shot flash is). dim caps peak opacity — the wide
    // splash shell is translucent (a fireball), the small inner flash near-opaque.
    else if (f.kind === 'burst') { f.obj.material.opacity = (f.dim != null ? f.dim : 1) * (1 - age); f.obj.scale.setScalar(f.base * (0.3 + age * 1.0)); }
    // suit-death fragment shower: each point flies out along its own velocity and arcs down under
    // gravity, resting on the ground (z=0), fading out (quicker at the end).
    else if (f.kind === 'debris') {
      const t = age * f.ttl, ap = f.obj.geometry.attributes.position;
      for (let k = 0; k < f.vels.length; k++) {
        const v = f.vels[k];
        let z = f.p0[2] + v[2] * t - 0.5 * f.grav * t * t;
        if (z < 0) z = 0;
        ap.setXYZ(k, f.p0[0] + v[0] * t, f.p0[1] + v[1] * t, z);
      }
      ap.needsUpdate = true;
      f.obj.material.opacity = 1 - age * age;
    }
    // spark (melee clash): a glowing mote + line tail on an analytic ballistic arc — head at
    // age·ttl seconds of flight, tail trailing 45ms behind, both floor-clamped, fading linearly.
    else if (f.kind === 'spark') {
      const tt = age * f.ttl, t2 = Math.max(0, tt - 0.045);
      const hx = f.p0[0] + f.vel[0] * tt, hy = f.p0[1] + f.vel[1] * tt, hz = Math.max(0, f.p0[2] + f.vel[2] * tt - 0.5 * f.grav * tt * tt);
      const ln = f.obj.children[0], bead = f.obj.children[1];
      const ap = ln.geometry.attributes.position;
      ap.setXYZ(0, f.p0[0] + f.vel[0] * t2, f.p0[1] + f.vel[1] * t2, Math.max(0, f.p0[2] + f.vel[2] * t2 - 0.5 * f.grav * t2 * t2));
      ap.setXYZ(1, hx, hy, hz);
      ap.needsUpdate = true;
      bead.position.set(hx, hy, hz);
      bead.scale.setScalar(f.bsz * (1 - age * 0.55));   // the mote gutters as it cools
      ln.material.opacity = 0.95 * (1 - age);
      bead.material.opacity = 0.95 * (1 - age);
    }
  }
}
// CHARGE RING (2026-08-13, operator): a world-space energy ring at the rifle MUZZLE that appears while a
// charge weapon spins up — it CONVERGES (shrinks) and brightens as the charge fills, then BLINKS once
// fully charged (the "ready" tell). This is the in-world twin of the screen-space reticle charge SVG
// (__retCharge). One ring per entity, built lazily and shown only while that entity's active weapon is
// charging (so a semi-firing AI never shows one). Faces along the barrel aim, so it reads as an aperture
// glowing at the gun tip. Pure presentation — reads the live weapon's charge state, writes nothing.
const __chgRings = {};   // entity id -> { ring: Mesh }
const __chgUpZ = new THREE.Vector3(0, 0, 1);   // the torus's hole-axis (+Z), rotated onto the aim dir
const __chgDir = new THREE.Vector3();
function __updateChargeRings() {
  for (const e of __world.entities) {
    const w = e.weapon;
    let rec = __chgRings[e.id];
    if (!(w && w.charging === true)) { if (rec) rec.ring.visible = false; continue; }
    const sz = (w.fxScale != null ? w.fxScale : 3);
    const col = (w.fxColor != null ? w.fxColor : 0x66e0ff);
    // muzzle world point: the held rifle's weapon-tip locator when present, else the body muzzle offset.
    const body = __bodies[e.id], rf = body && body.userData && body.userData.rigFig, tr = e.transform;
    let mp;
    if (rf && rf.muzzle) { rf.muzzle.getWorldPosition(__muzzleV); mp = [__muzzleV.x, __muzzleV.y, __muzzleV.z]; }
    else { const mo = w.muzzleOffset || { f: sz, u: sz }, hf = Math.cos(tr.heading), hs = Math.sin(tr.heading);
      mp = [tr.pos[0] + hf * (mo.f || 0), tr.pos[1] + hs * (mo.f || 0), tr.pos[2] + (mo.u || 0)]; }
    if (!rec) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.16, 8, 24),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(col), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.raycast = function () {}; scene.add(ring);
      rec = __chgRings[e.id] = { ring };
    }
    rec.ring.material.color.set(col);
    rec.ring.visible = true;
    rec.ring.position.set(mp[0], mp[1], mp[2]);
    // face along the barrel aim (ring normal = the aim forward, same convention as the radar)
    const pp = tr.pitch || 0, cp = Math.cos(pp);
    rec.ring.quaternion.setFromUnitVectors(__chgUpZ, __chgDir.set(cp * Math.cos(tr.heading), cp * Math.sin(tr.heading), Math.sin(pp)));
    const frac = Math.max(0, Math.min(1, w.chargeFrac || 0));
    // small — a tight ring right at the muzzle TIP (operator 2026-08-13: "a lot smaller"). ~0.12·fxScale.
    const baseR = Math.max(0.35, sz * 0.12);
    if (w.chargeReady) {
      rec.ring.scale.setScalar(baseR);
      rec.ring.material.opacity = (Math.sin(__world.time * 22) > 0) ? 1.0 : 0.12;   // BLINK when charged
    } else {
      rec.ring.scale.setScalar(baseR * (1.4 - 0.4 * frac));   // converges as it fills (stays tight)
      rec.ring.material.opacity = 0.25 + 0.6 * frac;          // and brightens
    }
  }
}
// R14 projectile channel: MIRROR the in-flight rounds the engine integrates in __world.projectiles,
// and pop an expanding shell when the engine records a burst in __world.bursts. The engine owns all
// motion + hit adjudication (deterministic); this only reflects positions and spawns transient fx —
// a muzzle flash on a round's birth, a glowing round while it flies, an expanding shell on its burst.
const __projMeshes = {};    // projectile id -> { g } group tracking one live round
let __burstSeen = -1;       // highest burst seq drawn (the engine's monotonic burstSeq)
const __projUpY = new THREE.Vector3(0, 1, 0);   // the cone axis (apex +Y) rotated onto each round's velocity
const __projDir = new THREE.Vector3();
function __updateProjectiles() {
  const ps = __world.projectiles || [];
  const live = {};
  for (const p of ps) {
    live[p.id] = true;
    let rec = __projMeshes[p.id];${moveset ? `
    // (a moveset's bow, gameworld/combos.js a draw sidearm: its round an ARROW, a shaft along its flight, its point leading)
    if (!rec) {
      const ow = __world.byId && __world.byId[p.owner];
      if (ow && ow.mvRanged && ow.mvRanged.mode === 'draw') {
        const g = new THREE.Group(), shaft = __spRod(0.008, 0xc9a46a), head = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 6), new THREE.MeshBasicMaterial({ color: 0x9aa3ad })), fl = __spBox([0.004, 0.09, 0.05], [0, -0.34, 0], 0xb8322a, g);
        shaft.scale.set(1, 0.78, 1); head.position.set(0, 0.42, 0); head.raycast = function () {}; g.add(shaft); g.add(head); fl.raycast = function () {};
        scene.add(g); rec = __projMeshes[p.id] = { g: g };
      }
    }` : ''}
    if (!rec) {
      const col = p.fxColor != null ? p.fxColor : 0xffcc66, sz = p.fxScale != null ? p.fxScale : 3;
      // the round is a POINTED SHELL (a hot nose-cone, not a beachball): a long thin cone whose TIP
      // leads along the velocity, wrapped in a translucent glow cone. Oriented per-frame to its heading.
      const len = sz * 0.6, rad = sz * 0.12;
      const glow = new THREE.Mesh(new THREE.ConeGeometry(rad * 1.9, len * 1.5, 12), __fxMat(col));
      const core = new THREE.Mesh(new THREE.ConeGeometry(rad, len, 12), __fxMat(0xffffff));
      glow.raycast = function () {}; core.raycast = function () {};
      const g = new THREE.Group(); g.add(glow); g.add(core); scene.add(g);
      rec = __projMeshes[p.id] = { g: g };
      // muzzle flash at the launch point (own base + dim, decoupled from __fxSz)
      const mf = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), __fxMat(col));
      mf.position.set(p.pos[0], p.pos[1], p.pos[2]); mf.raycast = function () {}; scene.add(mf);
      __fx.push({ obj: mf, born: __world.time, ttl: 0.1, kind: 'burst', base: sz * 0.4, dim: 0.9 });
    }
    rec.g.position.set(p.pos[0], p.pos[1], p.pos[2]);
    // point the nose along the round's velocity (cone apex is +Y → rotate +Y onto the travel direction)
    if (p.vel) { const vl = Math.hypot(p.vel[0], p.vel[1], p.vel[2]); if (vl > 1e-4) rec.g.quaternion.setFromUnitVectors(__projUpY, __projDir.set(p.vel[0] / vl, p.vel[1] / vl, p.vel[2] / vl)); }
  }
  for (const id in __projMeshes) {   // drop rounds that burst/expired this frame
    if (live[id]) continue;
    const rec = __projMeshes[id];
    scene.remove(rec.g);
    rec.g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    delete __projMeshes[id];
  }
  const bs = __world.bursts || [];   // spawn an expanding shell for any burst not yet drawn
  for (const b of bs) {
    if (b.seq <= __burstSeen) continue;
    __burstSeen = b.seq;${flow ? `
    if (window.__mojFlowBursts) continue;   // (on the flow, rupa-vayo: the moment channel sets it off as the flow's blast)` : ''}
    const col = b.fxColor != null ? b.fxColor : 0xffcc66;
    // the shell peaks at the TRUE splash reach (b.radius) — honest to the gameplay AoE — but stays
    // TRANSLUCENT (dim 0.5) so it reads as a fireball, not a screen-filling wash. A small, brighter
    // white flash marks the detonation point. A record may carry fxRadius (the DEATH BURST, R34.1):
    // the spectacle outsizes the shove — safe, because the stagger is adjudicated the frame the
    // record spawns, so the bigger shell never overstates a circle anyone could still dodge.
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), __fxMat(col));
    shell.position.set(b.pos[0], b.pos[1], b.pos[2]); shell.raycast = function () {}; scene.add(shell);
    __fx.push({ obj: shell, born: __world.time, ttl: 0.4, kind: 'burst', base: (b.fxRadius || b.radius || 0) * 0.9, dim: 0.5 });
    const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), __fxMat(0xffffff));
    flash.position.set(b.pos[0], b.pos[1], b.pos[2]); flash.raycast = function () {}; scene.add(flash);
    __fx.push({ obj: flash, born: __world.time, ttl: 0.16, kind: 'burst', base: (b.fxScale != null ? b.fxScale : 3) * 0.5, dim: 1 });
    // SUIT-DEATH fragment shower (operator 2026-08-13): a suit blows APART into many pieces flung out
    // and up, arcing down under gravity to rest on the ground — so the death reads as an explosion of
    // debris ahead of the smoke, not just one ball flash. Deterministic (golden-angle directions +
    // modulo speeds, no Math.random), so capture stays byte-identical. Only death bursts carry the flag.
    if (b.debris) {
      const N = 28, base = (b.fxScale != null ? b.fxScale : 6), col2 = b.fxColor != null ? b.fxColor : 0xffa03c;
      const positions = new Float32Array(N * 3), vels = [];
      for (let k = 0; k < N; k++) {
        const yy = 1 - (k + 0.5) / N * 1.6;                 // 1 .. -0.6 — mostly the upper hemisphere
        const rr = Math.sqrt(Math.max(0, 1 - yy * yy)), phi = k * 2.399963;   // golden-angle spiral
        const spd = base * (1.4 + ((k * 13) % 11) / 11 * 1.3);
        vels.push([Math.cos(phi) * rr * spd, Math.sin(phi) * rr * spd, yy * spd + base * 0.9]);   // outward + upward bias
        positions[k * 3] = b.pos[0]; positions[k * 3 + 1] = b.pos[1]; positions[k * 3 + 2] = b.pos[2];
      }
      const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const dmat = new THREE.PointsMaterial({ color: new THREE.Color(col2), size: Math.max(0.5, base * 0.16), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
      const pts = new THREE.Points(dgeo, dmat); pts.raycast = function () {}; scene.add(pts);
      __fx.push({ obj: pts, born: __world.time, ttl: 0.75, kind: 'debris', p0: b.pos.slice(), vels: vels, grav: base * 4.5 });
    }
  }
}
// melee CLASH sparks (melee-clash-fx): when a swing CONNECTS, the engine records a clash in
// __world.clashes (stepMelee stamps the contact point on the target's hull at blade height,
// seq-keyed like bursts). Edge-detect the seq and pop a spark shower: a small white core flash
// + a fan of short additive STREAKS thrown from the contact point, each flying an analytic
// ballistic arc (position re-derived from age every frame — no integration state, so a dropped
// frame never bends it) and fading over its ttl. Scatter is SEEDED per clash (mulberry32 over
// the seq — never Math.random, so a replay scatters identically), biased UP and BACK toward the
// attacker (c.dir) so the spray reads as the blade shearing off the armor. Colour/size ride the
// strike config's strikeFx via the record's fxColor/fxScale (null → the hot white-gold default).
let __clashSeen = -1;
function __clashRng(a) { a = a >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// a spark is a glowing MOTE (an additive radial sprite — a 1px WebGL line alone vanishes at
// mecha scale) dragging a short line tail; the shared head texture is built once.
const __sparkTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(32, 32, 32, 0, 7); x.fill(); return new THREE.CanvasTexture(cv); })();
function __updateClashes() {
  const cs = __world.clashes || [];
  for (const c of cs) {
    if (c.seq <= __clashSeen) continue;
    __clashSeen = c.seq;
    const col = c.fxColor != null ? c.fxColor : 0xffd98c;
    const sz = c.fxScale != null ? c.fxScale : 3;
    const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), __fxMat(0xffffff));
    flash.position.set(c.pos[0], c.pos[1], c.pos[2]); flash.raycast = function () {}; scene.add(flash);
    __fx.push({ obj: flash, born: __world.time, ttl: 0.12, kind: 'burst', base: sz * 0.55, dim: 1 });
    const rnd = __clashRng(0x5eed ^ Math.imul(c.seq + 1, 2654435761));
    const baseA = c.dir ? Math.atan2(c.dir[1], c.dir[0]) : rnd() * 6.283;
    // 2026-07-28 impact pump: a denser default shower (26), and the record may pin its own
    // count (c.n — the CLASH-EVENT lock pushes 40 for the opening burst); no dir field means
    // the fan is a full seeded ring (the blade-lock case: sparks jet out all around the cross).
    const n = Math.min(48, Math.max(4, c.n != null ? c.n : 26));
    for (let i = 0; i < n; i++) {
      // azimuth fans ~±135° around the attacker-facing normal (wide enough to clear both
      // silhouettes); speed/lift/life vary per spark — fast, so the shower reads OUTSIDE the
      // duel gap instead of dying between the hulls. ~1 in 5 is a slow EMBER that hangs and
      // rains (longer ttl, harder gravity) — the impact's afterglow.
      const az = baseA + (rnd() - 0.5) * (c.dir ? 4.7 : 6.283);
      const ember = rnd() < 0.2;
      const sp = sz * (ember ? 3 + rnd() * 4 : 6 + rnd() * 11);
      const up = sp * (0.35 + rnd() * (ember ? 1.6 : 1.1));
      const hot = rnd() < 0.35 ? 0xffffff : col;
      const grp = new THREE.Group();
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(c.pos[0], c.pos[1], c.pos[2]), new THREE.Vector3(c.pos[0], c.pos[1], c.pos[2])]);
      const ln = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(hot), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
      const bead = new THREE.Sprite(new THREE.SpriteMaterial({ map: __sparkTex, color: new THREE.Color(hot), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
      const bsz = sz * (0.24 + rnd() * 0.26);
      bead.scale.setScalar(bsz); bead.position.set(c.pos[0], c.pos[1], c.pos[2]);
      ln.raycast = function () {}; bead.raycast = function () {}; ln.frustumCulled = false; bead.frustumCulled = false;
      grp.add(ln); grp.add(bead); scene.add(grp);
      __fx.push({ obj: grp, born: __world.time, ttl: (ember ? 0.4 + rnd() * 0.35 : 0.26 + rnd() * 0.34), kind: 'spark', p0: c.pos.slice(), vel: [Math.cos(az) * sp, Math.sin(az) * sp, up], grav: sz * (ember ? 42 : 30), bsz: bsz });
    }
  }
}
// thruster jets: ease each rig's flame toward its entity's e.thrust (the platform
// rule flags it on boost) and scale/fade the nozzle cones — a flare-up on boost, a
// fade-out on release, with a per-jet flicker so the plume trembles.
const __jetZ = new THREE.Vector3(0, 0, 1);
const __jetQ = new THREE.Quaternion();
function __updateThrusters(dt) {
  for (const e of __world.entities) {
    const body = __bodies[e.id], rf = body && body.userData && body.userData.rigFig;
    if (!rf || !rf.jets) continue;
    const want = Math.max(0, Math.min(1, e.thrust || 0));
    rf.thrustAmt = (rf.thrustAmt || 0) + (want - (rf.thrustAmt || 0)) * Math.min(1, (dt || 0) * 16);
    const amt = rf.thrustAmt;
    // thrust VECTORING: the engine's e.thrustYaw is the dash direction as a body-frame yaw
    // (0 = forward, + = right); the BACKPACK jets swivel so the exhaust blows OPPOSITE the
    // dash (left dash → flames out to the right). Eased as a heading vector (cos/sin) so a
    // back dash (±π) never lerps the long way around; foot jets keep firing straight down.
    const ty = e.thrustYaw || 0;
    const k = Math.min(1, (dt || 0) * 10);
    rf.jetVX = (rf.jetVX == null ? 1 : rf.jetVX) + (Math.cos(ty) - (rf.jetVX == null ? 1 : rf.jetVX)) * k;
    rf.jetVY = (rf.jetVY || 0) + (Math.sin(ty) - (rf.jetVY || 0)) * k;
    const jyaw = Math.atan2(rf.jetVY, rf.jetVX);
    for (let i = 0; i < rf.jets.length; i++) {
      const j = rf.jets[i];
      if (amt < 0.02) { if (j.holder.visible) j.holder.visible = false; continue; }
      j.holder.visible = true;
      if (j.kind === 'backpack') {
        __jetQ.setFromAxisAngle(__jetZ, -jyaw);
        j.holder.quaternion.copy(__jetQ).multiply(j.baseQ);
      }
      const fl = 0.82 + 0.18 * Math.sin(__world.time * 46 + i * 1.7);
      j.holder.scale.set(0.65 + 0.35 * amt, amt * fl, 0.65 + 0.35 * amt);
      j.core.material.opacity = 0.7 * amt;
      j.inner.material.opacity = 0.9 * amt;
      // shards shimmer faster than the cones for a livelier energy read (render-only; sim untouched).
      if (j.shards) j.shards.material.opacity = 0.6 * amt * (0.65 + 0.35 * Math.sin(__world.time * 58 + i * 2.7));
    }
  }
}
${place ? `// THE LIGHT OF WHERE A BODY STANDS (a land's buildings, era/stage-buildings.js \`form.room.place\`): each body under the
// cast rig carries its own set of the rig's uniforms, and each frame they ease toward the light of its place: the room
// it stands in (its lamps overhead, its floor's bounce), else the sky it was made under; a flood it stands under adds
// to what falls on it from above; a form body gives back less of the sky indoors
const __PLACE = ${safeJson(place)}, __placed = [];
for (const e of __world.entities) { __castNow = {}; const m = __makeBody(e); if (m) { __bodies[e.id] = m; if (__castNow.U) __placed.push({ e, U: __castNow.U, mats: __castNow.mats || [], sky0: __castNow.U.uCastSky.value.clone(), ground0: __castNow.U.uCastGround.value.clone(), fill0: __castNow.U.uCastFill.value, in: -1 }); } }
__castNow = null;
const __plS = new THREE.Vector3(), __plG = new THREE.Vector3();
function __placeStep(dt) {
  for (const q of __placed) {
    const p = q.e.transform && q.e.transform.pos; if (!p) continue;
    const x = p[0], y = p[1], z = p[2] + 1;
    let r = null; for (const R of __PLACE.rooms) if (x > R.min[0] && x < R.max[0] && y > R.min[1] && y < R.max[1] && z > R.min[2] && z < R.max[2]) { r = R; break; }
    const want = r ? 1 : 0, k = q.in < 0 ? 1 : Math.min(1, dt * 5); q.in = q.in < 0 ? want : q.in + (want - q.in) * k;
    if (r) q.room = r;
    const R = q.room, a = q.in;
    __plS.copy(q.sky0).multiplyScalar(q.fill0 * (1 - a)); __plG.copy(q.ground0).multiplyScalar(q.fill0 * (1 - a));
    if (R && a > 0) { __plS.x += R.sky[0] * a; __plS.y += R.sky[1] * a; __plS.z += R.sky[2] * a; __plG.x += R.ground[0] * a; __plG.y += R.ground[1] * a; __plG.z += R.ground[2] * a; }
    for (const f of __PLACE.floods || []) { const dz = f.at[2] - z; if (dz <= 0) continue; const d = Math.hypot(f.at[0] - x, f.at[1] - y, dz), t = Math.max(0, 1 - d / f.radius), w = t * t * Math.min(1, Math.max(0, (dz / Math.max(d, 1e-3) - 0.2) / 0.42)) * (1 - a) * 0.6; __plS.x += f.key[0] * w; __plS.y += f.key[1] * w; __plS.z += f.key[2] * w; }
    q.U.uCastSky.value.copy(__plS); q.U.uCastGround.value.copy(__plG); q.U.uCastFill.value = 1;
    for (const m of q.mats) m.envMapIntensity = m.userData.env0 * (1 - 0.85 * a);
  }
}
__placeStep(1);
` : `for (const e of __world.entities) { const m = __makeBody(e); if (m) __bodies[e.id] = m; }
`}${stills ? `// (a body that never moves is the static world's: it casts into the hour's map, channels/cast-shadows.js still)
if (window.__mojCast && window.__mojCast.still) for (const e of __world.entities) if (e.rule && e.rule.type === 'static' && __bodies[e.id]) window.__mojCast.still(__bodies[e.id]);
` : ''}for (const e of __world.entities) __syncEntity(e);${shadowBlock}${smokeBlock}${hangarBlock}${gearBlock}
// ---- MATCH layer (mobile-suit-arena.plan.md M1b/M3): scoreboard + kill feed + result + game seam ----
// Built only when the world runs a match; matchless worlds emit the same bytes they always did
// (the block below is inert without __world.match). The scoreboard is the top-left kill tally per
// contender; the feed shows the last few kills; the result banner freezes over the tableau when a
// contender reaches killTarget, and — when a hosting game shell is present — the ONE outcome
// envelope leaves through window.__mojGame (emit + end), success iff the piloted suit won.
let __ms = null;
const __msName = (id) => (__world.match && __world.match.names && __world.match.names[id]) || id;
// TEAM read (arena-menu-reframe): a team battle colours the scoreboard + banner by faction so
// allies and enemies read at a glance. teamMode / teamNames / teamKills ride the engine match layer;
// absent (a duel or FFA) every team line below is a no-op and the HUD emits byte-identically.
const __msTeamName = (t) => (__world.match && __world.match.teamNames && __world.match.teamNames[t]) || (t ? String(t).toUpperCase() : '');
const __msMyTeam = () => ((__world.pilotId && __world.byId[__world.pilotId]) ? __world.byId[__world.pilotId].team : null);
function __msTeamColor(team) {
  const m = __world.match;
  if (!m || !m.teamMode || !team) return null;
  const teams = Object.keys(m.teamKills || {});
  const mine = __msMyTeam();
  if (mine) return team === mine ? '#7fe0a8' : ['#ff8f8f', '#ff9d6b', '#e6b3ff'][teams.filter((t) => t !== mine).indexOf(team) % 3];
  return ['#7fd4ff', '#ff9d6b', '#a8e6a1', '#e6b3ff'][teams.indexOf(team) % 4];   // spectate: no pilot seat, colour by team order
}
if (__world.match) {
  const __msWrap = document.createElement('div');
  __msWrap.style.cssText = 'position:absolute;left:16px;top:16px;min-width:150px;padding:8px 12px;border-radius:8px;background:rgba(8,14,22,0.42);box-shadow:inset 0 0 0 1px rgba(120,200,255,0.22);pointer-events:none;z-index:9;font:600 12px system-ui,sans-serif;color:#cfe3ff';
  const __msTitle = document.createElement('div');
  __msTitle.textContent = __world.match.practice ? 'PRACTICE' : ('FIRST TO ' + __world.match.killTarget);
  __msTitle.style.cssText = 'font-size:9px;letter-spacing:.18em;color:#8fb4d8;margin-bottom:5px';
  __msWrap.appendChild(__msTitle);
  const __msTeams = document.createElement('div');   // TEAM tally line (BLUE n \\u00b7 RED n) — shown only in a team bout
  __msTeams.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:.04em;margin-bottom:5px;display:none';
  __msWrap.appendChild(__msTeams);
  const __msRows = document.createElement('div');
  __msWrap.appendChild(__msRows);
  const __msFeed = document.createElement('div');
  __msFeed.style.cssText = 'margin-top:6px;font:500 10px system-ui,sans-serif;color:#9fb8d4;opacity:0.85';
  __msWrap.appendChild(__msFeed);
  wrap.appendChild(__msWrap);
  const __msBanner = document.createElement('div');
  __msBanner.style.cssText = 'position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);padding:16px 34px;border-radius:12px;background:rgba(10,16,26,0.88);box-shadow:0 0 0 1px rgba(140,210,255,0.35),0 6px 28px rgba(0,0,0,0.55);text-align:center;display:none;pointer-events:none;z-index:12;font:700 15px system-ui,sans-serif;color:#eaf4ff;letter-spacing:.06em';
  wrap.appendChild(__msBanner);
  __ms = { rows: __msRows, teams: __msTeams, feed: __msFeed, banner: __msBanner, rowEls: {}, sig: '', ended: false };
}
// FAULT CONTAINMENT: the match HUD + params seam are additive layers over the sim — an error in
// either reports ONCE and disables that layer (scoreboard goes dark / picks stay unapplied) while
// the world keeps stepping and rendering. A bug here must never freeze the page's step loop.
function __updateMatchHud() {
  if (__ms && __ms.dead) return;
  try { __updateMatchHudInner(); } catch (err) {
    if (__ms) __ms.dead = true;
    console.error('match HUD disabled after error:', err);
  }
}
function __updateMatchHudInner() {
  const m = __world.match;
  if (!m || !__ms) return;
  const ids = Object.keys(m.kills);
  const sig = ids.join(',');
  if (sig !== __ms.sig) {   // contender set changed (params despawned a seat) — rebuild the rows
    __ms.sig = sig; __ms.rowEls = {}; __ms.rows.textContent = '';
    for (let i = 0; i < ids.length; i++) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;gap:14px;line-height:1.55';
      const nm = document.createElement('span'); nm.textContent = __msName(ids[i]);
      const ct = document.createElement('span');
      row.appendChild(nm); row.appendChild(ct); __ms.rows.appendChild(row);
      __ms.rowEls[ids[i]] = { nm: nm, ct: ct };
    }
  }
  // the HIGHLIGHTED contender: the pilot normally; the WATCHED fighter when spectating (Tab moves it).
  const __hi = __world.spectate ? ((__specWatchEnt() || {}).id) : __world.pilotId;
  for (let i = 0; i < ids.length; i++) {
    const r = __ms.rowEls[ids[i]];
    if (!r) continue;
    r.ct.textContent = String(m.kills[ids[i]]);
    const me = ids[i] === __hi;
    // TEAM bout: the row wears its faction colour (allies vs enemies); a duel/FFA keeps the
    // pilot-highlight read. The highlighted contender is emphasised with weight in either mode.
    const tc = m.teamMode ? __msTeamColor(__world.byId[ids[i]] && __world.byId[ids[i]].team) : null;
    const col = tc || (me ? '#7fd4ff' : '#cfe3ff');
    r.nm.style.color = col;
    r.nm.style.fontWeight = me ? '800' : '600';
    r.ct.style.color = m.teamMode ? col : (m.kills[ids[i]] >= m.killTarget ? '#ffd166' : (me ? '#7fd4ff' : '#cfe3ff'));
  }
  // TEAM tally line: each faction's kill total in its own colour (BLUE 3 \\u00b7 RED 2), live.
  if (m.teamMode && m.teamKills) {
    const tks = Object.keys(m.teamKills);
    let th = '';
    for (let i = 0; i < tks.length; i++) th += (th ? '<span style="color:#5f7690"> \\u00b7 </span>' : '') + '<span style="color:' + (__msTeamColor(tks[i]) || '#cfe3ff') + '">' + __msTeamName(tks[i]) + ' ' + m.teamKills[tks[i]] + '</span>';
    __ms.teams.innerHTML = th;
    __ms.teams.style.display = '';
  }
  const fl = m.feed.slice(-3);
  let ft = '';
  for (let i = 0; i < fl.length; i++) ft += (ft ? '\\n' : '') + __msName(fl[i].killer) + ' \\u2715 ' + __msName(fl[i].victim);
  __ms.feed.style.whiteSpace = 'pre';
  __ms.feed.textContent = ft;
  if (m.over && !__ms.ended) {
    __ms.ended = true;
    if (__world.spectate) {
      // NO pilot — the operator watched. A neutral banner (nobody "won" or "lost"); the spectate
      // level's contract declares no promote event, so no career is staked. end() closes the bout.
      // A team-battle spectate names the winning FACTION; a solo/FFA spectate names the pilot.
      const __wtxt = m.teamMode ? (__msTeamName(m.winnerTeam) + ' TEAM WINS') : (__msName(m.winner) + ' WINS');
      const __wcol = m.teamMode ? (__msTeamColor(m.winnerTeam) || '#7fe0a8') : '#7fe0a8';
      __ms.banner.innerHTML = '<div style="font-size:22px;letter-spacing:.12em;color:' + __wcol + '">' + __wtxt + '</div><div style="margin-top:6px;font:600 12px system-ui,sans-serif;color:#bcd2ea">takes the match \\u2014 ' + m.killTarget + ' kills</div>';
      __ms.banner.style.display = '';
      if (window.__mojGame) {
        try {
          const wids = Object.keys(m.kills), wrows = [];
          for (let i = 0; i < wids.length; i++) {
            const s = (m.stats && m.stats[wids[i]]) || {};
            wrows.push({ id: wids[i], name: __msName(wids[i]), team: (__world.byId[wids[i]] && __world.byId[wids[i]].team) || null, kills: m.kills[wids[i]] || 0,
              deaths: s.deaths || 0, dmg: Math.round(s.dmg || 0), shots: s.shots || 0, hits: s.hits || 0 });
          }
          wrows.sort(function (a, b) { return (b.kills - a.kills) || (a.deaths - b.deaths) || (b.dmg - a.dmg); });
          window.__mojGame.end('success', { spectated: true, winner: m.winner, winnerTeam: m.winnerTeam || null, teamNames: m.teamNames || null, rows: wrows });
        } catch (err) { console.error('match outcome', err); }
      }
      return;
    }
    // TEAM bout: win iff the pilot's own faction took it; the sub-line names the winning TEAM.
    const won = m.teamMode ? (m.winnerTeam != null && m.winnerTeam === __msMyTeam()) : (m.winner === __world.pilotId);
    const __sub = m.teamMode ? (__msTeamName(m.winnerTeam) + ' TEAM takes the match \\u2014 ' + m.killTarget + ' kills') : (__msName(m.winner) + ' takes the match \\u2014 ' + m.killTarget + ' kills');
    __ms.banner.innerHTML = '<div style="font-size:22px;letter-spacing:.12em;color:' + (won ? '#7fe0a8' : '#ff8f8f') + '">' + (won ? 'VICTORY' : 'DEFEAT') + '</div><div style="margin-top:6px;font:600 12px system-ui,sans-serif;color:#bcd2ea">' + __sub + '</div>';
    __ms.banner.style.display = '';
    if (window.__mojGame) {
      // the ONE outcome envelope, spoken in the store's typed-event vocabulary: a promote event
      // on whatever progression slice the level's contract declares (contract-driven — the match
      // layer never hardcodes slice names), then end(). Success iff the piloted suit won.
      try {
        const c = window.__mojGame.contract || {};
        const evs = (c.produces && c.produces.events) || [];
        for (let i = 0; i < evs.length; i++) {
          if (evs[i].type === 'promote') {
            window.__mojGame.emit({ type: 'promote', slice: evs[i].slice, ref: c.levelRef, result: won ? 'success' : 'fail' });
            break;
          }
        }
        // the SCORE-SCREEN payload: one row per contender (kills / deaths / hull damage /
        // rounds fired / rounds on target), ranked, riding the envelope beside the store events.
        const ids = Object.keys(m.kills);
        const rows = [];
        for (let i = 0; i < ids.length; i++) {
          const s = (m.stats && m.stats[ids[i]]) || {};
          rows.push({ id: ids[i], name: __msName(ids[i]), team: (__world.byId[ids[i]] && __world.byId[ids[i]].team) || null, kills: m.kills[ids[i]] || 0,
            deaths: s.deaths || 0, dmg: Math.round(s.dmg || 0), shots: s.shots || 0, hits: s.hits || 0 });
        }
        rows.sort(function (a, b) { return (b.kills - a.kills) || (a.deaths - b.deaths) || (b.dmg - a.dmg); });
        window.__mojGame.end(won ? 'success' : 'fail', { pilot: __world.pilotId, winnerTeam: m.teamMode ? (m.winnerTeam || null) : null, teamNames: m.teamMode ? (m.teamNames || null) : null, rows: rows });
      } catch (err) { console.error('match outcome', err); }
    }
  }
}
// ---- TUTORIAL objective HUD + terminal (tutorial-mode.plan.md T1): the director's face ----
// Built only when the world runs a tutorial script (state.tutorial — worlds without one emit the
// same inert function). The card (top-center) shows the active step's prompt + progress; when the
// script completes the banner freezes over the tableau and the ONE outcome envelope leaves through
// window.__mojGame — the same promote/end discipline as the match layer, the director being the
// terminal here (tutorial levels run no match). Fault-contained like the match HUD.
let __tut = null;
if (__world.tutorial) {
  const __tutWrap = document.createElement('div');
  __tutWrap.style.cssText = 'position:absolute;left:50%;top:16px;transform:translateX(-50%);max-width:520px;padding:9px 18px 10px;border-radius:10px;background:rgba(8,14,22,0.55);box-shadow:inset 0 0 0 1px rgba(120,200,255,0.25);pointer-events:none;z-index:9;text-align:center';
  const __tutEyebrow = document.createElement('div');
  __tutEyebrow.style.cssText = 'font:700 9px system-ui,sans-serif;letter-spacing:.22em;color:#8fb4d8;margin-bottom:4px';
  const __tutPrompt = document.createElement('div');
  __tutPrompt.style.cssText = 'font:700 14px system-ui,sans-serif;letter-spacing:.05em;color:#eaf4ff;text-shadow:0 1px 3px rgba(0,0,0,.6)';
  const __tutProg = document.createElement('div');
  __tutProg.style.cssText = 'font:600 11px system-ui,sans-serif;color:#7fd4ff;margin-top:3px;display:none';
  __tutWrap.appendChild(__tutEyebrow); __tutWrap.appendChild(__tutPrompt); __tutWrap.appendChild(__tutProg);
  wrap.appendChild(__tutWrap);
  const __tutBanner = document.createElement('div');
  __tutBanner.style.cssText = 'position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);padding:16px 34px;border-radius:12px;background:rgba(10,16,26,0.88);box-shadow:0 0 0 1px rgba(140,210,255,0.35),0 6px 28px rgba(0,0,0,0.55);text-align:center;display:none;pointer-events:none;z-index:12;font:700 15px system-ui,sans-serif;color:#eaf4ff;letter-spacing:.06em';
  wrap.appendChild(__tutBanner);
  __tut = { wrap: __tutWrap, eyebrow: __tutEyebrow, prompt: __tutPrompt, prog: __tutProg, banner: __tutBanner, ended: false, dead: false };
}
function __updateTutorialHud() {
  if (!__tut || __tut.dead) return;
  try { __updateTutorialHudInner(); } catch (err) {
    __tut.dead = true;
    console.error('tutorial HUD disabled after error:', err);
  }
}
function __updateTutorialHudInner() {
  const T = __world.tutorial;
  if (!T || T.dead) { if (__tut) __tut.wrap.style.display = 'none'; return; }
  if (T.over) {
    if (__tut.ended) return;
    __tut.ended = true;
    __tut.wrap.style.display = 'none';
    const won = T.result === 'success';
    __tut.banner.innerHTML = '<div style="font-size:22px;letter-spacing:.12em;color:' + (won ? '#7fe0a8' : '#ff8f8f') + '">' + (won ? 'TUTORIAL COMPLETE' : 'SUIT LOST') + '</div><div style="margin-top:6px;font:600 12px system-ui,sans-serif;color:#bcd2ea">' + (won ? T.steps.length + ' objectives cleared' : 'restart the level to try again') + '</div>';
    __tut.banner.style.display = '';
    if (window.__mojGame) {
      try {
        const c = window.__mojGame.contract || {};
        const evs = (c.produces && c.produces.events) || [];
        for (let i = 0; i < evs.length; i++) {
          if (evs[i].type === 'promote') {
            window.__mojGame.emit({ type: 'promote', slice: evs[i].slice, ref: c.levelRef, result: won ? 'success' : 'fail' });
            break;
          }
        }
        window.__mojGame.end(won ? 'success' : 'fail', { pilot: __world.pilotId, tutorial: { steps: T.steps.length, cleared: won ? T.steps.length : T.idx } });
      } catch (err) { console.error('tutorial outcome', err); }
    }
    return;
  }
  const s = T.steps[T.idx];
  if (!s) { __tut.wrap.style.display = 'none'; return; }
  __tut.wrap.style.display = '';
  __tut.eyebrow.textContent = 'TUTORIAL \\u00b7 ' + (T.idx + 1) + ' / ' + T.steps.length;
  __tut.prompt.textContent = s.prompt;
  // the advance flash: a brief bright ring when a step clears, so progress is felt without reading.
  const fresh = T.flash >= 0 && (__world.time - T.flash) < 0.6;
  __tut.wrap.style.boxShadow = fresh ? 'inset 0 0 0 2px rgba(127,224,168,0.85)' : 'inset 0 0 0 1px rgba(120,200,255,0.25)';
  if (s.goal.count > 1) {
    __tut.prog.style.display = '';
    __tut.prog.textContent = Math.min(Math.floor(T.count), Math.ceil(s.goal.count)) + ' / ' + Math.ceil(s.goal.count);
  } else __tut.prog.style.display = 'none';
}
// game-params seam (arena M3): a hosting shell's launcher picks arrive as __mojGame params —
// the chosen suit takes the pilot seat (other seat:'player' options despawn), and only the
// picked seat:'opponent' entities stay in the arena. Standalone opens fall back to the level's
// presets.default (the game channel already does that), so /world stays playable.
function __msDespawn(id) {
  const e = __world.byId[id];
  if (!e) return;
  const i = __world.entities.indexOf(e);
  if (i >= 0) __world.entities.splice(i, 1);
  delete __world.byId[id];
  if (__world.match && __world.match.kills) delete __world.match.kills[id];
  if (__world.match && __world.match.stats) delete __world.match.stats[id];
  const b = __bodies[id];
  if (b) { scene.remove(b); delete __bodies[id]; }
}
function __applyMatchParams(params) {
  if (__world.spectate) {
    // SPECTATE PICKS (2026-08-09): the level authors every candidate seat:'ai' fighter; the shell's
    // watch picks name who fights and the unpicked cast leaves before the bout. Only roster slices
    // are read — no pilot, difficulty or livery here (an all-AI show is never detuned). An absent or
    // empty pick keeps the whole cast, so a pickless watch level plays exactly as before.
    if (!params || typeof params !== 'object') return;
    const keep = {};
    let anyPicked = false;
    for (const k in params) {
      const v = params[k];
      const ids = v && typeof v === 'object' && v.roster && typeof v.roster === 'object' ? Object.keys(v.roster) : null;
      if (ids && ids.length) { anyPicked = true; for (let i = 0; i < ids.length; i++) keep[ids[i]] = true; }
    }
    if (!anyPicked) return;
    for (let i = __world.entities.length - 1; i >= 0; i--) {
      const e = __world.entities[i];
      if (e.seat === 'ai' && !keep[e.id]) __msDespawn(e.id);
    }
    return;
  }
  if (!params || typeof params !== 'object') return;
  // DIFFICULTY (arena difficulty select): the shell's pick rides beside the slice params as a
  // plain string naming an engine tuning tier ('easy' | 'medium' | 'max'); unknown or absent →
  // null = the max brain. Spectate returned above — an all-AI show is never detuned.
  if (typeof params.difficulty === 'string' && __CW.AI_DIFFICULTY) __world.aiTuning = __CW.AI_DIFFICULTY[params.difficulty] || null;
  const idOf = (v) => (v && typeof v === 'object' ? (v.id || v.name || '') : String(v == null ? '' : v));
  // the game shell passes a picked party slice as { roster: { <id>: {...} } } — the ids are the keys.
  const rosterIds = (v) => (v && typeof v === 'object' && v.roster && typeof v.roster === 'object' ? Object.keys(v.roster) : null);
  const want = params.pilot != null ? idOf(params.pilot)
    : ((rosterIds(params.suits) || [])[0]
      || (Array.isArray(params.roster) && params.roster.length ? idOf(params.roster[0]) : null));
  if (want && __world.byId[want] && __world.byId[want].pilotable && __world.pilotId !== want) {
    const cur = __world.byId[__world.pilotId];
    if (cur) { cur.rule = cur.ambientRule; cur.moving = false; }
    const nxt = __world.byId[want];
    nxt.rule = nxt.pilotRule;
    __world.pilotId = want;
    if (__world.camera && __world.camera.rule && cur && __world.camera.rule.target === cur.id) __world.camera.rule.target = want;
  }
  // LIVERY (livery-ingame.plan.md): the shell carries the picked wear on the roster entry
  // (roster[<id>].livery). Paint the piloted suit by swapping its figure + loadout figures to the
  // chosen livery's pre-built variant; the sync reveals it and __applyWeaponShow re-applies the weapon.
  const __pilotE = __world.byId[__world.pilotId];
  if (__pilotE && Array.isArray(__pilotE.liveries)) {
    let __wear = null;
    for (const k in params) { const r = params[k] && params[k].roster; if (r && r[__world.pilotId] && r[__world.pilotId].livery) { __wear = r[__world.pilotId].livery; break; } }
    const __lv = __wear && __pilotE.liveries.find((l) => l.id === __wear);
    if (__lv && __lv.figure) {
      __pilotE.body.figure = __lv.figure;
      for (const slot of ((__pilotE.rule && __pilotE.rule.loadout) || [])) slot.figure = __lv.figure;
      for (const slot of ((__pilotE.pilotRule && __pilotE.pilotRule.loadout) || [])) slot.figure = __lv.figure;
    }
  }
  for (let i = __world.entities.length - 1; i >= 0; i--) {   // unpicked PLAYER options leave the arena
    const e = __world.entities[i];
    if (e.seat === 'player' && e.id !== __world.pilotId) __msDespawn(e.id);
  }
  // COMBATANT seats (opponent / enemy / ally): keep the picked ids drawn from EVERY non-pilot party
  // slice the shell passed (opponents for FFA, duel_enemy for a solo pick, team_allies + team_foes for
  // a team bout), despawn the rest. Generalises the old opponents-only despawn — a mode declares its
  // own combatant slices and this seam honours them all without hardcoding names. seat:'player' is the
  // pilot slice (handled above); seat:'ai' is a spectate cast (handled by the spectate branch above).
  const __combatantSeat = { opponent: 1, enemy: 1, ally: 1 };
  const keep = {};
  let anyPicked = false;
  if (Array.isArray(params.seats)) { anyPicked = true; for (let i = 0; i < params.seats.length; i++) keep[idOf(params.seats[i])] = true; }
  for (const k in params) {
    if (k === 'suits' || k === 'pilot' || k === 'seats') continue;
    const ids = rosterIds(params[k]) || (Array.isArray(params[k]) ? params[k].map(idOf) : null);
    if (ids) { anyPicked = true; for (let i = 0; i < ids.length; i++) keep[ids[i]] = true; }
  }
  if (anyPicked) {
    for (let i = __world.entities.length - 1; i >= 0; i--) {
      const e = __world.entities[i];
      if (__combatantSeat[e.seat] && !keep[e.id]) __msDespawn(e.id);
    }
  }
}
// the game channel block is emitted AFTER this one, so the hook is lazy: the first step (live rAF
// or capture tick) finds __mojGame and registers; onStart replays immediately if params already
// arrived (the standalone presets.default fallback starts synchronously at page load).
let __msParamsHooked = false;
function __msHookParams() {
  if (__msParamsHooked || !window.__mojGame) return;
  __msParamsHooked = true;
  window.__mojGame.onStart(function (p) {
    try { __applyMatchParams(p); } catch (err) { console.error('match params not applied:', err); }
  });
}
if (__ctrlOwnsCamera) __driveCamera();
${breakables || loose ? `// breakability: a block that broke (the runtime's state.breaks) leaves the scene: its render group (break:<id>) hides,
// a flash and a ring cover the swap, and its pre-cut pieces (playscape/destruct/breakability.js piecesOf: the cut of
// how it broke) take its place, parting the cut's way (impact bursts from the blow, a blade slips the halves apart,
// anime holds the beat first), falling, tumbling and settling on the floor it stood on, then sinking away. Seeded by
// the break's seq and stepped on sim dt, so a capture stays byte-identical.
const __breakPieces = ${safeJson(breakPieces || {})};${Object.values(breakPieces || {}).some((v) => v && v.like) ? `
// blocks of one size and cut share their pieces (playscape/destruct/breakability.js piecesOf share): each takes the first's, in its own colour
for (const k in __breakPieces) { const v = __breakPieces[k]; if (v.like) __breakPieces[k] = { ...__breakPieces[v.like], fill: v.fill, tex: v.tex }; }` : ''}
const __pieces = [];
let __breaksSeen = 0;
const __PART = { impact: { speed: 3.2, up: 2.2, blow: 1.6, hold: 0 }, blade: { speed: 0.9, up: 0.6, blow: 0.9, hold: 0.06 }, laser: { speed: 0.3, up: 0.2, blow: 0.2, hold: 0.25 }, anime: { speed: 1.2, up: 0.5, blow: 0.7, hold: 0.42 } };
const __pieceLight = [0.35, -0.55, 0.76];
function __spawnBreak(br) {
  const blk = (__world.breakables || []).find((q) => q.id === br.id)${loose ? ' || (__world.loose || []).find((q) => q.id === br.id)' : ''};
  const ext = blk ? Math.max(blk.max[0] - blk.min[0], blk.max[1] - blk.min[1], blk.max[2] - blk.min[2]) : 1;
  const floor = blk ? blk.min[2] : 0;
  const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), __fxMat(0xffffff));
  flash.position.set(br.at[0], br.at[1], br.at[2]); flash.raycast = function () {}; scene.add(flash);
  __fx.push({ obj: flash, born: __world.time, ttl: 0.16, kind: 'burst', base: ext * 0.7, dim: 0.9 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 24), __fxMat(0xffe2b0));
  ring.position.set(br.at[0], br.at[1], floor + 0.05); ring.raycast = function () {}; scene.add(ring);
  __fx.push({ obj: ring, born: __world.time, ttl: 0.3, kind: 'shock', base: ext * 0.8 });
  const show = __breakPieces[br.id], set = show && show.pieces[show.cuts[br.how] || 'chip'];
  if (!set) return;
  const by = br.by && __world.entities.find((e) => e.id === br.by);
  let bx = 0, byy = 0;
  if (by) { bx = br.at[0] - by.transform.pos[0]; byy = br.at[1] - by.transform.pos[1]; const l = Math.hypot(bx, byy) || 1; bx /= l; byy /= l; }
  const P = __PART[set.style] || __PART.impact, rnd = __clashRng(0xb4ea ^ Math.imul(br.seq + 1, 2654435761));
  // a textured thing breaks into its own texture (box-projected, about a repeat per 1.2 units, the inside shaded
  // darker); an untextured one into its colour
  const own = meshes['break:' + br.id], tm = own && own.userData.tex && own.userData.tex[0], map = tm && tm.material.map;
  const skin = new THREE.Color(show.fill).multiplyScalar(show.tex && !map ? 0.72 : 1), inside = skin.clone().multiplyScalar(0.62);
  for (const k of set.chunks) {
    const pos = [], col = [], uv = [];
    let lo = 0, r = 0;
    for (const f of k.faces) {
      const a = f.pts[0], b = f.pts[1], c = f.pts[2];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1;
      const lit = (map ? 0.95 : 0.55) + (map ? 0.3 : 0.45) * Math.max(0, (nx * __pieceLight[0] + ny * __pieceLight[1] + nz * __pieceLight[2]) / nl);   // a texture is lit already
      const base = f.cut ? inside : skin;
      const ax = Math.abs(nx) >= Math.abs(ny) && Math.abs(nx) >= Math.abs(nz) ? 0 : Math.abs(ny) >= Math.abs(nz) ? 1 : 2, ua = ax === 0 ? 1 : 0, va = ax === 2 ? 1 : 2;
      for (let i = 1; i < f.pts.length - 1; i++) for (const p of [f.pts[0], f.pts[i], f.pts[i + 1]]) { pos.push(p[0], p[1], p[2]); col.push(base.r * lit, base.g * lit, base.b * lit); uv.push((p[ua] + k.at[ua]) / 1.2, (p[va] + k.at[va]) / 1.2); }
      for (const p of f.pts) { lo = Math.max(lo, -p[2]); r = Math.max(r, Math.hypot(p[0], p[1])); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    if (map) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, ...(map ? { map } : {}) }));
    m.position.set(k.at[0], k.at[1], k.at[2]); m.raycast = function () {}; scene.add(m);
    let ox = k.at[0] - br.at[0], oy = k.at[1] - br.at[1], oz = k.at[2] - br.at[2]; const ol = Math.hypot(ox, oy, oz) || 1; ox /= ol; oy /= ol; oz /= ol;
    const sp = P.speed * (0.7 + 0.6 * rnd());
    __pieces.push({ m, born: __world.time, hold: P.hold, rest: floor + lo, r: r * 0.6,
      v: [ox * sp + bx * P.blow, oy * sp + byy * P.blow, Math.max(0, oz) * sp + P.up * (0.6 + 0.8 * rnd())],
      w: [(rnd() - 0.5) * 9 * P.speed / 3.2, (rnd() - 0.5) * 9 * P.speed / 3.2, (rnd() - 0.5) * 4], settled: false });
  }
}
function __pieceBlocked(x, y, z, r) {
  for (const c of (__world.colliders || [])) if (x > c.min[0] - r && x < c.max[0] + r && y > c.min[1] - r && y < c.max[1] + r && z > c.min[2] && z < c.max[2]) return true;
  return false;
}
function __updateBreaks(dt) {
  const B = __world.breaks || [];
  for (; __breaksSeen < B.length; __breaksSeen++) {
    const br = B[__breaksSeen], m = meshes['break:' + br.id];
    if (m) { m.visible = false; for (const tm of (m.userData.tex || [])) tm.visible = false; }
    if (br.how !== 'restore'${distort ? " && br.how !== 'strip' && br.how !== 'cut'" : ''}) __spawnBreak(br);   // a restored break (an aftermath carried in) is simply gone${distort ? '; a stripped plate falls whole and a cut block parts in two (__updateDents)' : ''}
  }
  for (let i = __pieces.length - 1; i >= 0; i--) {
    const q = __pieces[i], age = __world.time - q.born;
    if (age > 4) { scene.remove(q.m); q.m.geometry.dispose(); q.m.material.dispose(); __pieces.splice(i, 1); continue; }
    if (age < q.hold) continue;   // the cut is drawn before anything parts
    if (age > 3.2) { q.m.position.z -= dt * 0.25; continue; }   // sink away through the floor
    if (q.settled) continue;
    q.v[2] -= 9.8 * dt;
    // the walls hold them: each horizontal step that would put a piece inside a collider bounces back off it instead
    const x1 = q.m.position.x + q.v[0] * dt, y1 = q.m.position.y + q.v[1] * dt, z = q.m.position.z;
    if (__pieceBlocked(x1, q.m.position.y, z, q.r)) q.v[0] *= -0.3; else q.m.position.x = x1;
    if (__pieceBlocked(q.m.position.x, y1, z, q.r)) q.v[1] *= -0.3; else q.m.position.y = y1;
    q.m.position.z += q.v[2] * dt;
    q.m.rotation.x += q.w[0] * dt; q.m.rotation.y += q.w[1] * dt; q.m.rotation.z += q.w[2] * dt;
    if (q.m.position.z <= q.rest && q.v[2] < 0) {   // land: bounce a little, drag along the floor, stop when slow
      q.m.position.z = q.rest; q.v[2] *= -0.25; q.v[0] *= 0.55; q.v[1] *= 0.55; q.w[0] *= 0.5; q.w[1] *= 0.5; q.w[2] *= 0.5;
      if (Math.abs(q.v[2]) < 0.4 && Math.hypot(q.v[0], q.v[1]) < 0.3) q.settled = true;
    }
  }
}
${distort ? distortViewScript() : ''}${rupa ? smokeViewScript() : ''}` : ''}${panelsOn ? panelsViewScript() : ''}${scarsOn ? scarsViewScript() : ''}${groundOn ? groundViewScript() : ''}${runner ? runnerViewScript(runner) : ''}${focusHook}stepControllable = (dt, inputOverride) => {
${hangarHook}  __msHookParams();
  if (dt > 0 && !window.__mojFreeze) {   // a menu up freezes the world (interact-channel)
    ${commanderStep}__CW.stepWorld(__world, inputOverride || ${seats ? '__withSeats(__readInput())' : '__readInput()'}, dt, { ground: __ground${driveSurface ? ', surface: __surface' : ''} });${tempo ? `
    const wdt = dt * __CW.tempoScale(__world);   // the world clock: the bodies and their effects on the world's step, the camera on the real one
    // a moment that fires cues the live shoot plan's shot waiting on it (on: 'tempo:<what fired it>'): the impact cam
    if (__world.tempo && __world.tempo.playing !== __tmLast) { __tmLast = __world.tempo.playing; if (__tmLast && window.__mojShoot && window.__mojShoot.cue) window.__mojShoot.cue('tempo:' + __tmLast.on); }` : ''}
    for (const e of __world.entities) __syncEntity(e, ${tempo ? 'wdt' : 'dt'});${place ? '\n    __placeStep(dt);' : ''}${seats ? `
    __seatRings();
    __seatStrip();
    __seatsOver();` : ''}
    __updateFx();
    __updateChargeRings();
    __updateProjectiles();
    __updateClashes();
    __updateThrusters(${tempo ? 'wdt' : 'dt'});${figHasJuice ? `
    __updateRacerJuice(${tempo ? 'wdt' : 'dt'});` : ''}${shadowHook}${smokeHook}${gearHook}${breakables || loose ? `
    __updateBreaks(${tempo ? 'wdt' : 'dt'});${distort ? `
    __updateDents();` : ''}${rupa ? `
    __updateSmoke();` : ''}` : ''}${panelsOn ? `
    __updatePanels();` : ''}${scarsOn ? `
    __updateScars(${tempo ? 'wdt' : 'dt'});` : ''}${groundOn ? `
    __updateGround();` : ''}${runner ? `
    __updateRunner(${tempo ? 'wdt' : 'dt'});` : ''}${vayoOn ? `
    __updateVayo(dt);` : ''}${knock ? `
    __updateKnock(dt);` : ''}
  }${acts ? `
  // (a fight holds the world, but its bodies act and stand where it stages them: a figure with a battle act or a staged
  // place is drawn on, the rest stand as they were)
  else if (dt > 0) for (const e of __world.entities) if (e.act || e.staged) __syncEntity(e, dt);` : ''}
  if (__ctrlOwnsCamera${xr ? ' && !__xrCtl' : ''}) __driveCamera(dt);${xr ? '   // (in the headset the head is the camera)' : ''}${figPose ? `
  __poseFrame();   // (the pose grade cut in on the figures a close shot is on)` : ''}${tempoLook ? `
  // a moment's look over the world's grade (channels/grade.js), by the moment's weight; its impact frame hard for its
  // frames as it fires; its zoom aimed at whom it is about, on the screen as the camera now stands
  if (window.__mojGrade) {
    const P = __world.tempo && __world.tempo.playing, L = P && P.m.look;
    if (L) {
      const hit = L.impact && P.t < L.impact / 60, who = P.who && (__world.byId[P.who.b] || __world.byId[P.who.a]);
      let at = null;
      if (who) { camera.updateMatrixWorld(); __tmAt.set(who.transform.pos[0], who.transform.pos[1], who.transform.pos[2] + 1).project(camera); at = [(__tmAt.x + 1) / 2, (__tmAt.y + 1) / 2]; }
      window.__mojGrade.moment(hit ? { ...L, invert: 1 } : L, hit ? 1 : __CW.tempoWeight(__world), at);
    } else if (window.__mojGrade.look) window.__mojGrade.moment(null);
  }` : ''}
  __updateWepHud();   // after the camera is positioned, so the reticle projects onto the current frame
  __updateBoostHud();
  __updateRadar();${lock ? '\n  __updateLock();' : ''}
  __updateHpHud();
  __updateEnemyHp();
  __updateMatchHud();
  __updateTutorialHud();
};
${tempo ? `let __tmLast = null;${tempoLook ? ' const __tmAt = new THREE.Vector3();' : ''}
window.__mojTempo = { now: () => __world.tempo && { scale: __world.tempo.scale, playing: __world.tempo.playing && __world.tempo.playing.on }, fire: (on, who) => __CW.tempoMoment(__world, on, who), end: (on) => __CW.tempoEnd(__world, on) };
` : ''}${backdrop ? `// THE ENCOUNTER'S BACKDROP (a fight staged on its own arena, rpg rules.stage 'backdrop'): the map drawn once from a pose
// into a texture, stood as a full-frame quad behind the arena's camera (the same pose shifted by \`shift\`), so the arena
// reads as the place the fight was met; the world itself stays where it is, out of the arena camera's sight
function __mojBackdrop(from, look, shift) {
  const el = renderer.domElement, rt = new THREE.WebGLRenderTarget(Math.max(2, el.width), Math.max(2, el.height));
  const cam = camera.clone(); cam.up.copy(camera.up); cam.position.set(from[0], from[1], from[2]); cam.lookAt(look[0], look[1], look[2]); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const prev = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(prev);
  const dir = new THREE.Vector3(look[0] - from[0], look[1] - from[1], look[2] - from[2]), reach = dir.length(); dir.normalize();
  const d = Math.max(60, 4 * reach), H = 2 * d * Math.tan((cam.fov * Math.PI) / 360) * 1.04, Wd = H * cam.aspect;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(Wd, H), new THREE.MeshBasicMaterial({ map: rt.texture, fog: false, depthWrite: false }));
  const eye = new THREE.Vector3(from[0] + shift[0], from[1] + shift[1], from[2] + shift[2]);
  quad.position.copy(eye).addScaledVector(dir, d); quad.up.copy(camera.up); quad.lookAt(eye); quad.renderOrder = -1; quad.frustumCulled = false;
  scene.add(quad);
  return { dispose: () => { scene.remove(quad); quad.geometry.dispose(); quad.material.dispose(); rt.dispose(); } };
}
` : ''}window.__mojCtrl = { world: __world,${exposeBodies ? ' bodies: __bodies,' : ''}${backdrop ? ' backdrop: __mojBackdrop,' : ''}${breakables ? ' restore: (id) => __CW.restoreBlock(__world, id),' : ''}${rupa && breakables ? ' strike: (id, joules, how, src) => __CW.strikeBlock(__world, id, joules, how, src), heat: (id, joules) => __CW.heatBlock(__world, id, joules), physics: __CW.rupaPhysics,' : ''}${gusts ? ' air: __CW.vayoAir,' : ''} step: (dt, input) => stepControllable(dt, input), cast: (ops) => __CW.castOps(__world, ops),${acts ? ' ground: (x, y, z) => __ground([x, y, z]), project: (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight, v.z]; },' : ''} facts: (prev) => __CW.castFacts(__world, prev), interacts: () => __interactN, label: (id) => { const f = __padOn && __padSeen && __usePad ? 'gamepad' : 'keyboard', c = (__BIND.bind[f][id] || [])[0]; return c ? __CTL.label(__DEV, f, c, __padLayout) : ''; } };${gunplay ? gunplayScript() : ''}${vayoOn ? vayoTrailScript() : ''}${knock ? knockFxScript() : ''}${turretOn ? turretScript() : ''}${boatOn ? boatWaterScript() : ''}${moveset ? specialsPaletteScript() : ''}`;
}
