// action-lab page: the playable half. lab.mjs inlines feel.mjs (the kernel, its exports stripped) above this file and
// DATA (takes.mjs bake, per cast) above that, so the page steps the very code the gate runs.
/* global DATA, FEELS, FEEL_IDS, ARENA, BTN, FPS, SPAR, newState, step, poseOf, frameData, util, copy */
const $ = (id) => document.getElementById(id);
const stage = $('stage'), ctx = stage.getContext('2d'), strip = $('strip'), sctx = strip.getContext('2d');
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const COL = {};
const readCols = () => { for (const k of ['floor', 'grid', 'block', 'blockTop', 'hero', 'dummy', 'ink', 'dim', 'startup', 'active', 'recovery', 'stop', 'stun', 'air', 'inv', 'gather', 'guard', 'mercy', 'spark', 'smear', 'shadow']) COL[k] = css(`--${k}`); };
readCols();

const store = { get(k, d) { try { const v = localStorage.getItem(`action-lab:${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(`action-lab:${k}`, JSON.stringify(v)); } catch { /* storage refused: the page works without it */ } } };

let cast = store.get('cast', 'male'), feel = store.get('feel', 'action'), view = store.get('view', 'three');
let spar = false, guard = true, paused = false, stepOnce = false;
const cards = Object.fromEntries(FEEL_IDS.map((id) => [id, copy(FEELS[id])]));
let S, hist = [], log = [], presses = [], sparks = [], cam = { x: 0, y: 0 }, shown = {}, prevWorld = {}, rec = null, replay = null;

function reset() {
  S = newState(cards[feel], DATA[cast].body, { arena: ARENA, spar, guard });
  hist = []; log = []; presses = []; sparks = []; shown = {}; prevWorld = {};
  cam = { x: S.hero.p[0], y: S.hero.p[1] };
  renderFeel(); renderDials(); renderFrameData(); renderLog(); renderLast();
}

// ─── input: keyboard, gamepad, touch ───
const keys = new Set(), tapped = new Set();   // tapped: pressed since the last tick, so a tap between two ticks still lands
const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'jump', KeyJ: 'attack', KeyK: 'dodge', ShiftLeft: 'sprint', ShiftRight: 'sprint', KeyL: 'sprint' };
addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select')) return;
  const k = KEYMAP[e.code]; if (k) { if (!e.repeat) tapped.add(k); keys.add(k); e.preventDefault(); return; }
  if (/^Digit[1-4]$/.test(e.code)) { setFeel(FEEL_IDS[+e.code.slice(5) - 1]); return; }
  if (e.code === 'KeyR') reset();
  else if (e.code === 'KeyV') setView(view === 'three' ? 'side' : 'three');
  else if (e.code === 'KeyT') setSpar(!spar);
  else if (e.code === 'KeyG') setGuard(!guard);
  else if (e.code === 'KeyC') setCast(cast === 'male' ? 'female' : 'male');
  else if (e.code === 'Escape' || e.code === 'KeyP') setPaused(!paused);
  else if (e.code === 'Period') { if (paused) stepOnce = true; }
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys.delete(k); });
addEventListener('blur', () => keys.clear());

const touch = { x: 0, y: 0, b: 0, id: null, ox: 0, oy: 0 };
const pad = $('touchpad');
if (matchMedia('(pointer: coarse)').matches) pad.hidden = false;
$('tstick').addEventListener('pointerdown', (e) => { touch.id = e.pointerId; touch.ox = e.clientX; touch.oy = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); });
$('tstick').addEventListener('pointermove', (e) => { if (e.pointerId !== touch.id) return; const dx = e.clientX - touch.ox, dy = e.clientY - touch.oy, m = Math.max(1, Math.hypot(dx, dy) / 50); touch.x = dx / 50 / m; touch.y = -dy / 50 / m; $('tknob').style.transform = `translate(${touch.x * 30}px, ${-touch.y * 30}px)`; });
const tEnd = (e) => { if (e.pointerId !== touch.id) return; touch.id = null; touch.x = touch.y = 0; $('tknob').style.transform = ''; };
$('tstick').addEventListener('pointerup', tEnd); $('tstick').addEventListener('pointercancel', tEnd);
for (const el of document.querySelectorAll('[data-tbtn]')) {
  const bit = BTN[el.dataset.tbtn];
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); if (bit === BTN.SPRINT) { touch.b ^= bit; el.classList.toggle('on', !!(touch.b & bit)); } else touch.b |= bit; });
  const up = () => { if (bit !== BTN.SPRINT) touch.b &= ~bit; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
}

let padName = null;
function readPad() {
  const on = (k) => keys.has(k) || tapped.has(k);
  let x = (on('right') ? 1 : 0) - (on('left') ? 1 : 0), y = (on('up') ? 1 : 0) - (on('down') ? 1 : 0);
  if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  let b = (on('jump') ? BTN.JUMP : 0) | (on('attack') ? BTN.ATTACK : 0) | (on('dodge') ? BTN.DODGE : 0) | (on('sprint') ? BTN.SPRINT : 0);
  tapped.clear();
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  padName = gp ? gp.id : null;
  if (gp) {
    const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0, dz = Math.hypot(ax, ay) > 0.18;
    if (dz) { x = ax; y = -ay; }
    const pr = (i) => !!gp.buttons[i]?.pressed;
    if (pr(12)) y = 1; if (pr(13)) y = -1; if (pr(14)) x = -1; if (pr(15)) x = 1;
    b |= (pr(0) ? BTN.JUMP : 0) | (pr(2) ? BTN.ATTACK : 0) | (pr(1) ? BTN.DODGE : 0) | (pr(5) || pr(7) || pr(10) ? BTN.SPRINT : 0);
  }
  if (touch.x || touch.y) { x = touch.x; y = touch.y; }
  b |= touch.b;
  return [Math.round(Math.max(-1, Math.min(1, x)) * 127), Math.round(Math.max(-1, Math.min(1, y)) * 127), b];
}

// ─── the tick ───
function tick() {
  let p;
  if (replay) { p = replay.pads[replay.i++] ?? [0, 0, 0]; if (replay.i >= replay.pads.length) { replay = null; renderRec(); } }
  else p = readPad();
  if (rec) rec.pads.push(p);
  S = step(S, p);
  for (const e of S.events) onEvent(e);
  hist.push({ h: catOf('hero'), d: catOf('dummy'), p: S.events.filter((e) => e.who === 'hero' && (e.type === 'press' || e.type === 'dropped')).map((e) => e.type) });
  if (hist.length > 180) hist.shift();
  lastPad = p;
}
let lastPad = [0, 0, 0];

function catOf(who) {
  const B = S[who], a = B.act;
  if (B.stop) return 'stop';
  if (a?.kind === 'move' || a?.kind === 'spar') {
    const m = a.kind === 'spar' ? SPAR : S.card.moves.string[a.i], f = a.shown ?? a.f;
    return f < m.startup ? 'startup' : f < m.startup + m.active ? 'active' : 'recovery';
  }
  if (a?.kind === 'gather') return 'gather';
  if (a?.kind === 'dodge') { const I = S.card.dodge.iframes, f = a.shown ?? a.f; return I && f >= I[0] && f < I[1] ? 'inv' : 'recovery'; }
  if (a?.kind === 'guard') return 'guard';
  if (B.stun > 0 || a?.kind === 'hurt' || a?.kind === 'stagger' || a?.kind === 'bonk') return 'stun';
  if (B.mercy > 0) return 'mercy';
  if (!B.grounded) return 'air';
  return null;
}

// ─── events: the log and the last press ───
const say = {
  press: (e) => null,
  acted: (e) => `${e.button} acted${e.waited ? ` after waiting ${e.waited} f in its buffer` : ''}`,
  buffered: (e) => `${e.button} buffered: ${e.why}`,
  dropped: (e) => `${e.button} dropped: ${e.why}`,
  takeoff: () => 'take-off', apex: (e) => `apex ${e.height.toFixed(2)} m`, land: (e) => `land at ${e.fall.toFixed(1)} m/s`,
  edge: () => 'walked off an edge', coyote: (e) => `coyote jump (${e.left} f were left)`, cut: () => 'jump cut on release',
  move: (e) => (e.who === 'dummy' ? `dummy telegraphs a jab (${e.telegraph} f)` : `move ${e.i + 1}: ${e.take}`),
  hit: (e) => `${e.who === 'dummy' ? 'dummy' : 'hero'} hit by ${e.take}: Δv ${e.dv.toFixed(2)} m/s (×${e.powerscale.toFixed(1)}), hitstop ${e.hitstop} f, stun ${e.stun} f${e.advantage != null ? `, linked +${e.advantage}` : ''}${e.finisher ? ', finisher' : ''}`,
  blocked: (e) => `blocked (a free dummy that saw it coming), hitstop ${e.hitstop} f`, immune: (e) => `immune: mercy ${e.mercy} f left`,
  whiff: (e) => (e.short > 0 ? `whiff, ${e.short.toFixed(2)} m short` : 'whiff, wide of the dummy'), evaded: (e) => `evaded through the ${e.by}'s invincible frames`,
  wall: (e) => `wall: ${e.response} at ${e.into.toFixed(1)} m/s${e.out != null ? ` → ${e.out.toFixed(1)}` : ''}`,
  free: (e) => `${e.who} free to act`, end: () => null, dodge: (e) => `${e.kind}`,
};
function onEvent(e) {
  const line = say[e.type]?.(e);
  const whose = e.who === 'dummy' && ['takeoff', 'apex', 'land', 'edge', 'wall', 'free'].includes(e.type) ? 'dummy: ' : '';
  if (line) { log.push({ f: e.f, who: e.who, type: e.type, line: e.type === 'free' ? line : whose + line }); if (log.length > 60) log.shift(); }
  if (e.who === 'hero' && e.type === 'press') presses.push({ button: e.button, f: e.f, acted: null, effect: null, out: null });
  const open = (btn, need) => [...presses].reverse().find((p) => p.button === btn && !p.out && (need === 'acted' ? p.acted == null : p.acted != null && p.effect == null));
  if (e.who === 'hero' && e.type === 'acted') { const p = open(e.button, 'acted'); if (p) { p.acted = e.f; if (e.button === 'dodge') { p.effect = e.f; p.out = S.card.dodge.kind; } } }
  if (e.who === 'hero' && e.type === 'dropped') { const p = [...presses].reverse().find((q) => q.button === e.button && q.acted == null && !q.out); if (p) p.out = `dropped: ${e.why}`; }
  if (e.who === 'hero' && e.type === 'takeoff') { const p = open('jump', 'effect'); if (p) { p.effect = e.f; p.out = 'take-off'; } }
  if (e.who === 'hero' && e.type === 'whiff') { const p = open('attack', 'effect'); if (p) { p.effect = e.f; p.out = 'whiff'; } }
  if (e.who === 'dummy' && ['hit', 'blocked', 'immune'].includes(e.type)) {
    const p = open('attack', 'effect'); if (p) { p.effect = e.f; p.out = e.type === 'hit' ? `hit${e.advantage != null ? ` (linked +${e.advantage})` : ''}` : e.type; }
    sparks.push({ p: [S.dummy.p[0], S.dummy.p[1], S.dummy.p[2] + 1.3], t: 0, big: e.finisher || e.hitstop > 6 });
  }
  if (e.who === 'hero' && (e.type === 'hit' || e.type === 'evaded')) sparks.push({ p: [S.hero.p[0], S.hero.p[1], S.hero.p[2] + 1.3], t: 0, big: false, evade: e.type === 'evaded' });
  if (presses.length > 20) presses.shift();
  dirty.log = true;
}
const dirty = { log: true };

// ─── poses: the baked frames, chosen by the kernel's poseOf ───
const lerp = (a, b, w) => a.map((v, i) => v + (b[i] - v) * w);
function locoFrames(L, phase) { const n = L.frames.length, x = phase * n, i = Math.floor(x) % n, w = x - Math.floor(x); return lerp(L.frames[i], L.frames[(i + 1) % n], w); }
function locoAt(D, speed, phase) {
  const L = D.loco, g = [L.walk, L.jog, L.sprint];
  let pose;
  if (speed <= g[0].v) pose = locoFrames(g[0], phase);
  else if (speed >= g[2].v) pose = locoFrames(g[2], phase);
  else { const i = speed < g[1].v ? 0 : 1, w = (speed - g[i].v) / (g[i + 1].v - g[i].v); pose = lerp(locoFrames(g[i], phase), locoFrames(g[i + 1], phase), w); }
  return speed < 0.3 ? lerp(D.idle, pose, speed / 0.3) : pose;
}
const pick = (arr, at) => arr[Math.max(0, Math.min(arr.length - 1, Math.round(at)))];
/** a move's baked frame for the kernel's frame: the take was fitted to the card's defaults, so a dial that moved the
 * startup or the length warps time about the contact frame (the promise: contact stays on contact) */
function moveFrame(F, i, at) {
  const def = FEELS[feel].moves.string[i] ?? FEELS[feel].moves.string.at(-1), cur = S.card.moves.string[i], M = F.moves[Math.min(i, F.moves.length - 1)];
  const dT = def.startup + def.active + def.recovery, cT = cur.startup + cur.active + cur.recovery;
  const b = at <= cur.startup ? (at * def.startup) / cur.startup : def.startup + ((at - cur.startup) * (dT - def.startup)) / Math.max(1, cT - cur.startup);
  return pick(M.frames, b);
}
function poseFrames(who) {
  const D = DATA[cast], F = D.feels[feel], d = poseOf(S, who);
  let a, key = d.clip;
  switch (d.clip) {
    case 'move': a = moveFrame(F, d.i, d.at); key += d.i; break;
    case 'spar': a = pick(D.spar, d.at); break;
    case 'gather': a = pick(F.gather, F.gather.length > 1 ? (d.at * (F.gather.length - 1)) / Math.max(1, d.of) : 0); break;
    case 'dodge': a = F.dodge ? pick(F.dodge, (d.at * (F.dodge.length - 1)) / d.of) : locoAt(D, Math.max(D.loco.sprint.v, d.speed), (S.f * 0.08) % 1); break;
    case 'guard': a = pick(F.guard, d.at); break;
    case 'react': a = pick(F.react[d.take].frames, d.at); key += d.take; break;
    case 'air': { const n = F.air.length - 1, x = d.u * n, i = Math.min(n - 1, Math.floor(x)); a = lerp(F.air[i], F.air[i + 1], x - i); break; }
    case 'spin': a = d.spin > 0.4 ? D.tuck : lerp(F.air[0], D.tuck, d.spin / 0.4); break;
    case 'land': a = pick(F.land, d.at); break;
    case 'loco': a = locoAt(D, d.speed, d.phase); break;
    default: a = D.idle;
  }
  // a short cross-fade when the clip changes, so a hand-off never pops (the kernel's frames are untouched)
  const s = shown[who];
  if (s && s.key !== key && !d.held) shown[who] = { key, from: s.cur, n: 4, cur: a };
  else if (!s) shown[who] = { key, from: null, n: 0, cur: a };
  const t = shown[who]; t.key = key;
  let out = a;
  if (t.n > 0 && t.from && !d.held) { out = lerp(t.from, a, 1 - (t.n - 1) / 4); t.n--; }
  t.cur = out;
  return { d, a: out };
}
/** rig millimetres → world metres: squash about the feet, a spin about the hips, turned to the body's yaw, placed */
function toWorld(d, a) {
  const D = DATA[cast], n = D.names.length, out = new Array(n);
  const sc = d.scale ?? [1, 1, 1], c = Math.cos(d.yaw), s = Math.sin(d.yaw);
  const pel = D.names.indexOf('pelvisHub'), pz = a[pel * 3 + 2] / 1000;
  const sp = d.clip === 'spin' ? d.spin : 0, cs = Math.cos(sp), ss = Math.sin(sp);
  for (let k = 0; k < n; k++) {
    let x = a[k * 3] / 1000, y = a[k * 3 + 1] / 1000, z = a[k * 3 + 2] / 1000;
    if (sp) { const zz = z - pz; [y, z] = [y * cs + zz * ss, pz - y * ss + zz * cs]; }
    x *= sc[0]; y *= sc[1]; z *= sc[2];
    out[k] = [d.p[0] + x * c + y * s, d.p[1] - x * s + y * c, d.p[2] + z];
  }
  return out;
}

// ─── drawing ───
const TH = (50 * Math.PI) / 180, CT = Math.cos(TH), ST = Math.sin(TH);
let W = 0, H = 0, DPR = 1;
function fit() {
  DPR = Math.min(2, devicePixelRatio || 1);
  const r = stage.getBoundingClientRect(); W = r.width; H = r.height; stage.width = Math.round(W * DPR); stage.height = Math.round(H * DPR);
  const q = strip.getBoundingClientRect(); strip.width = Math.round(q.width * DPR); strip.height = Math.round(q.height * DPR);
}
addEventListener('resize', fit);
new ResizeObserver(fit).observe(stage.parentElement); new ResizeObserver(fit).observe(strip);
function P(x, y, z) {
  const ppm = Math.max(70, view === 'three' ? Math.min(W, H * 1.4) / 9 : Math.min(W, H * 1.6) / 8);
  if (view === 'three') return [W / 2 + (x - cam.x) * ppm, H * 0.62 - (z * CT + (y - cam.y) * ST) * ppm];
  return [W / 2 + (y - cam.y) * ppm, H * 0.78 - z * ppm];
}
function poly(pts, fill, stroke) { ctx.beginPath(); pts.forEach((p, i) => { const q = P(...p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } }
function drawArena() {
  const A = S.arena, h = A.half;
  if (view === 'three') {
    poly([[-h, -h, 0], [h, -h, 0], [h, h, 0], [-h, h, 0]], COL.floor);
    ctx.lineWidth = 1; ctx.strokeStyle = COL.grid;
    for (let i = -h; i <= h; i++) { const a = P(i, -h, 0), b = P(i, h, 0), c2 = P(-h, i, 0), d = P(h, i, 0); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(c2[0], c2[1]); ctx.lineTo(d[0], d[1]); ctx.stroke(); }
    poly([[-h, h, 0], [h, h, 0], [h, h, 0.5], [-h, h, 0.5]], COL.block);
  } else {
    const a = P(0, -h, 0), b = P(0, h, 0); ctx.fillStyle = COL.floor; ctx.fillRect(a[0], a[1], b[0] - a[0], H - a[1]);
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1; for (let i = -h; i <= h; i++) { const q = P(0, i, 0); ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0], q[1] + 6); ctx.stroke(); }
  }
}
function drawBlock(k, front) {
  const [x0, x1] = k.x, [y0, y1] = k.y;
  if (view === 'three') {
    if (!front) poly([[x0, y0, k.h], [x1, y0, k.h], [x1, y1, k.h], [x0, y1, k.h]], COL.blockTop);
    poly([[x0, y0, 0], [x1, y0, 0], [x1, y0, k.h], [x0, y0, k.h]], COL.block);
  } else if (!front) poly([[0, y0, 0], [0, y1, 0], [0, y1, k.h], [0, y0, k.h]], COL.block, COL.blockTop);
}
function drawShadow(B) {
  const g = util.groundAt(S, B.p[0], B.p[1]), up = Math.max(0, B.p[2] - g), r = 0.34 / (1 + up * 0.4);
  ctx.globalAlpha = 0.5 / (1 + up); ctx.fillStyle = COL.shadow;
  const c = P(B.p[0], B.p[1], g); const ppm = Math.abs(P(1, 0, 0)[0] - P(0, 0, 0)[0]);
  ctx.beginPath(); ctx.ellipse(c[0], c[1], r * ppm, r * ppm * (view === 'three' ? ST : 0.25), 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
}
function drawBody(who, colour) {
  const { d, a } = poseFrames(who), w = toWorld(d, a), D = DATA[cast], B = S[who];
  const ppm = Math.abs(P(1, 0, 0)[0] - P(0, 0, 0)[0]);
  const shake = d.held ? ((S.f % 2) * 2 - 1) * 2 : 0;
  // smears: a hand or foot that jumped further than the card's smear in one frame
  const sm = S.card.look.smear, prev = prevWorld[who];
  if (sm && prev && !d.held) for (const nm of ['wristL', 'wristR', 'toeTipL', 'toeTipR']) {
    const k = D.names.indexOf(nm), a0 = prev[k], b0 = w[k]; if (Math.hypot(a0[0] - b0[0], a0[1] - b0[1], a0[2] - b0[2]) < sm) continue;
    const p0 = P(...a0), p1 = P(...b0); ctx.strokeStyle = COL.smear; ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(4, ppm * 0.09); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); ctx.globalAlpha = 1;
  }
  prevWorld[who] = w;
  const inv = d.clip === 'dodge' && d.iframes, hurt = B.stun > 0 || B.act?.kind === 'hurt';
  ctx.strokeStyle = d.held ? COL.ink : inv ? COL.inv : hurt ? COL.stun : colour; ctx.globalAlpha = inv ? 0.6 : 1;
  ctx.lineWidth = Math.max(2, ppm * 0.055); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const [i, j] of D.bones) { const p0 = P(...w[i]), p1 = P(...w[j]); ctx.moveTo(p0[0] + shake, p0[1]); ctx.lineTo(p1[0] + shake, p1[1]); }
  ctx.stroke();
  const hb = w[D.names.indexOf('headBase')], ht = w[D.names.indexOf('headTop')];
  if (hb && ht) { const c = P((hb[0] + ht[0]) / 2, (hb[1] + ht[1]) / 2, (hb[2] + ht[2]) / 2); ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(c[0] + shake, c[1], Math.max(4, ppm * 0.11), 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function drawSparks() {
  const ppm = Math.abs(P(1, 0, 0)[0] - P(0, 0, 0)[0]);
  sparks = sparks.filter((s) => s.t < 14);
  for (const s of sparks) {
    const c = P(...s.p), r = (s.big ? 0.6 : 0.35) * ppm * (0.4 + s.t / 14), n = s.big ? 10 : 7;
    ctx.strokeStyle = s.evade ? COL.inv : COL.spark; ctx.globalAlpha = 1 - s.t / 14; ctx.lineWidth = 2;
    ctx.beginPath(); for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2 + s.t * 0.05; ctx.moveTo(c[0] + Math.cos(t) * r * 0.4, c[1] + Math.sin(t) * r * 0.4); ctx.lineTo(c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r); } ctx.stroke();
    ctx.globalAlpha = 1; if (!paused) s.t++;
  }
}
function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
  const k = 0.12; cam.x += (S.hero.p[0] - cam.x) * k; cam.y += (S.hero.p[1] - cam.y) * k;
  drawArena();
  const blocks = [...S.arena.blocks].sort((a, b) => b.y[0] - a.y[0]);
  for (const b of blocks) drawBlock(b, false);
  const bodies = [['dummy', COL.dummy], ['hero', COL.hero]].sort((a, b) => (view === 'three' ? S[b[0]].p[1] - S[a[0]].p[1] : S[a[0]].p[0] - S[b[0]].p[0]));
  for (const [who, col] of bodies) {
    drawShadow(S[who]); drawBody(who, col);
    // a block whose front face stands before a body that is below its top covers the body's legs
    if (view === 'three') for (const b of blocks) { const B = S[who]; if (B.p[1] > b.y[0] && B.p[2] < b.h - 0.05 && B.p[0] > b.x[0] - 0.4 && B.p[0] < b.x[1] + 0.4 && B.p[1] - b.y[0] < 2.5) drawBlock(b, true); }
  }
  drawSparks();
  drawStrip();
}

// ─── the frame strip: the training mode's bar ───
function drawStrip() {
  const w = strip.width / DPR, h = strip.height / DPR; sctx.setTransform(DPR, 0, 0, DPR, 0, 0); sctx.clearRect(0, 0, w, h);
  const n = 120, cw = w / n, rows = [['hero', 'h', 2], ['dummy', 'd', 22]];
  const rh = 16;
  sctx.font = `600 10px ${css('--mono')}`; sctx.textBaseline = 'middle';
  const seg = hist.slice(-n), off = n - seg.length;
  for (const [, k, y] of rows) for (let i = 0; i < seg.length; i++) { const c = seg[i][k]; if (!c) continue; sctx.fillStyle = COL[c]; sctx.fillRect((off + i) * cw, y, Math.max(1, cw - 0.6), rh); }
  for (let i = 0; i < seg.length; i++) for (const p of seg[i].p) { const x = (off + i + 0.5) * cw; sctx.fillStyle = p === 'press' ? COL.ink : COL.stun; sctx.beginPath(); sctx.moveTo(x, 42); sctx.lineTo(x - 4, 50); sctx.lineTo(x + 4, 50); sctx.closePath(); sctx.fill(); }
  sctx.strokeStyle = COL.grid; sctx.lineWidth = 1; for (let i = 0; i <= n; i += 10) { const x = i * cw; sctx.beginPath(); sctx.moveTo(x, 0); sctx.lineTo(x, 40); sctx.stroke(); }
}

// ─── panels ───
function renderFeel() {
  for (const b of document.querySelectorAll('[data-feel]')) b.setAttribute('aria-pressed', String(b.dataset.feel === feel));
  $('says').textContent = FEELS[feel].says;
  $('cast').textContent = cast === 'male' ? 'Male body' : 'Female body';
  $('spar').setAttribute('aria-pressed', String(spar)); $('guard').setAttribute('aria-pressed', String(guard));
  $('view').textContent = view === 'three' ? '¾ view' : 'Side view'; $('pause').textContent = paused ? 'Resume' : 'Pause';
}
const DIALS = [
  ['Ground', 'ground.run', 'run', 1, 24, 0.5, 'm/s'], ['Ground', 'ground.accel', 'accel', 1, 120, 1, 'm/s²'], ['Ground', 'ground.decel', 'decel', 1, 120, 1, 'm/s²'],
  ['Jump', 'jump.commit', 'commit', 0, 20, 1, 'f'], ['Jump', 'jump.height', 'height', 0.2, 3, 0.05, 'm'], ['Jump', 'jump.gRise', 'rise g', 5, 60, 0.5, 'm/s²'], ['Jump', 'jump.gFall', 'fall g', 5, 80, 0.5, 'm/s²'],
  ['Jump', 'jump.cut', 'cut', 0.1, 1, 0.05, '×'], ['Jump', 'jump.hang', 'hang', 0, 20, 1, 'f'], ['Jump', 'jump.coyote', 'coyote', 0, 20, 1, 'f'], ['Jump', 'jump.buffer', 'buffer', 0, 20, 1, 'f'], ['Jump', 'jump.air', 'air control', 0, 1, 0.05, '×'],
  ['Moves', 'moves.string.0.startup', 'first startup', 1, 30, 1, 'f'], ['Moves', 'moves.buffer', 'buffer', 0, 20, 1, 'f'], ['Hit', 'hit.hitstop.base', 'hitstop base', 0, 20, 1, 'f'],
];
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setPath = (o, p, v) => { const ks = p.split('.'); let c = o; for (const k of ks.slice(0, -1)) c = c[k]; c[ks.at(-1)] = v; };
function renderDials() {
  const box = $('dials'); box.innerHTML = '';
  let group = null;
  for (const [g, path, label, min, max, st, unit] of DIALS) {
    const v = getPath(S.card, path); if (v == null) continue;
    if (g !== group) { group = g; const h = document.createElement('div'); h.className = 'dgroup'; h.textContent = g; box.append(h); }
    const id = `dial-${path.replace(/\./g, '-')}`;
    const row = document.createElement('label'); row.className = 'dial'; row.htmlFor = id;
    row.innerHTML = `<span>${label}</span><input id="${id}" type="range" min="${min}" max="${max}" step="${st}" value="${v}"><output>${fmt(v)} ${unit}</output>`;
    const input = row.querySelector('input'), out = row.querySelector('output');
    input.addEventListener('input', () => { const x = +input.value; setPath(S.card, path, x); setPath(cards[feel], path, x); out.textContent = `${fmt(x)} ${unit}`; renderFrameData(); });
    box.append(row);
  }
}
const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
function renderFrameData() {
  const rows = frameData(S.card, DATA[cast].body);
  const head = '<tr><th>move</th><th>startup</th><th>active</th><th>recovery</th><th>total</th><th>cancel</th><th>hitstop</th><th>stun</th><th>link</th><th>on block</th></tr>';
  const sign = (x) => (x == null ? '–' : x > 0 ? `+${x}` : String(x));
  $('fd').innerHTML = head + rows.map((r, i) => `<tr><td>${i + 1}. ${r.take}${r.finisher ? ' ✦' : ''}</td><td class="c-startup">${r.startup}</td><td class="c-active">${r.active}</td><td class="c-recovery">${r.recovery}</td><td>${r.total}</td><td>${r.cancel ?? '–'}</td><td>${r.hitstop}</td><td>${r.stun}</td><td class="${r.link == null ? '' : r.link >= 0 ? 'good' : 'bad'}">${sign(r.link)}</td><td class="${r.onBlock >= 0 ? 'good' : 'bad'}">${sign(r.onBlock)}</td></tr>`).join('');
  const C = S.card;
  $('jd').textContent = `jump: commit ${C.jump.commit} f · apex ${C.jump.height} m · coyote ${C.jump.coyote} f · buffer ${C.jump.buffer} f · cut ×${C.jump.cut} · dodge: ${C.dodge.kind}, ${C.dodge.frames} f${C.dodge.iframes ? `, invincible ${C.dodge.iframes[0]}–${C.dodge.iframes[1]}` : ', no invincibility'} · wall: ${C.wall.model}`;
}
function renderLog() {
  $('log').innerHTML = log.slice(-14).reverse().map((l) => `<li class="t-${l.type}"><span class="f">${l.f}</span>${l.line}</li>`).join('') || '<li class="empty">Move, jump, attack: every press and what came of it shows here.</li>';
}
function renderLast() {
  const p = [...presses].reverse().find((q) => q.out) ?? null;
  if (!p) { $('lastBig').textContent = '–'; $('lastWhat').textContent = 'Press jump or attack.'; return; }
  const lat = p.effect != null ? p.effect - p.f : null;
  $('lastBig').textContent = lat != null ? `${lat} f` : '✕';
  $('lastWhat').textContent = `${p.button} → ${p.out}${lat != null ? ` · ${Math.round((lat * 1000) / FPS)} ms after the press` : ''}`;
}
function renderState() {
  const H = S.hero, v = Math.hypot(H.v[0], H.v[1]), d = poseOf(S, 'hero');
  $('st').innerHTML = [['frame', S.f], ['clip', d.clip + (d.clip === 'move' ? ` ${d.i + 1}` : '')], ['speed', `${v.toFixed(2)} m/s`], ['height', `${H.p[2].toFixed(2)} m`], ['ground', H.grounded ? 'yes' : H.coyote ? `coyote ${H.coyote}` : 'no'], ['buffer', S.queue.map((q) => `${q.button} ${q.buffer - q.age}`).join(', ') || '–'], ['dummy', S.dummy.stun ? `stun ${S.dummy.stun}` : S.dummy.mercy ? `mercy ${S.dummy.mercy}` : S.dummy.alert ? 'alert' : 'idle']].map(([k, x]) => `<div><dt>${k}</dt><dd>${x}</dd></div>`).join('');
  const [x, y, b] = lastPad;
  $('knob').setAttribute('cx', String(20 + (x / 127) * 14)); $('knob').setAttribute('cy', String(20 - (y / 127) * 14));
  for (const [id, bit] of [['bJ', BTN.JUMP], ['bA', BTN.ATTACK], ['bD', BTN.DODGE], ['bS', BTN.SPRINT]]) $(id).classList.toggle('on', !!(b & bit));
  $('padname').textContent = padName ? `Gamepad: ${padName.slice(0, 40)}` : 'Keyboard (a gamepad works too)';
}

// ─── the recorder: a run becomes a gate fixture ───
function renderRec() {
  $('recState').textContent = rec ? `Recording · ${rec.pads.length} frames` : replay ? `Replaying · ${replay.i}/${replay.pads.length}` : last ? `${last.pads.length} frames recorded (${last.feel}, ${last.cast})` : 'Nothing recorded yet.';
  $('rec').textContent = rec ? 'Stop' : 'Record';
  $('replay').disabled = !last || !!rec; $('copy').disabled = !last;
}
let last = null;
$('rec').addEventListener('click', () => {
  if (rec) { last = rec; rec = null; $('fixture').value = JSON.stringify(fixture(last)); }
  else { reset(); rec = { feel, cast, spar, guard, card: copy(S.card), pads: [] }; }
  renderRec();
});
$('replay').addEventListener('click', () => { if (!last) return; setFeel(last.feel, true); cast = last.cast; spar = last.spar; guard = last.guard; cards[feel] = copy(last.card); reset(); replay = { pads: last.pads, i: 0 }; renderRec(); });
const fixture = (r) => ({ says: 'recorded in the lab', feel: r.feel, cast: r.cast, spar: r.spar, card: r.card, pads: r.pads });
$('copy').addEventListener('click', async () => {
  const t = $('fixture'); t.value = JSON.stringify(fixture(last));
  try { await navigator.clipboard.writeText(t.value); $('recState').textContent = 'Copied. Save it under scripts/spikes/action-lab/fixtures/ and verify.mjs replays it.'; }
  catch { t.hidden = false; t.select(); $('recState').textContent = 'Select-all is on the box below: copy it from there.'; }
});
$('load').addEventListener('click', () => { try { const fx = JSON.parse($('fixture').value); last = { feel: fx.feel, cast: fx.cast ?? 'male', spar: !!fx.spar, guard: fx.guard ?? true, card: fx.card ?? copy(FEELS[fx.feel]), pads: fx.pads }; renderRec(); $('replay').click(); } catch (e) { $('recState').textContent = `That is not a recorded run: ${e.message}`; } });
$('showfx').addEventListener('click', () => { $('fixture').hidden = !$('fixture').hidden; $('load').hidden = $('fixture').hidden; });

// ─── controls ───
function setFeel(id, quiet) { feel = id; store.set('feel', id); if (!quiet) reset(); else renderFeel(); }
function setView(v) { view = v; store.set('view', v); renderFeel(); }
function setSpar(on) { spar = on; S.spar = on; renderFeel(); }
function setGuard(on) { guard = on; S.guard = on; renderFeel(); }
function setCast(c) { cast = c; store.set('cast', c); reset(); }
function setPaused(on) { paused = on; renderFeel(); }
for (const b of document.querySelectorAll('[data-feel]')) b.addEventListener('click', () => setFeel(b.dataset.feel));
$('reset').addEventListener('click', reset); $('defaults').addEventListener('click', () => { cards[feel] = copy(FEELS[feel]); reset(); });
$('view').addEventListener('click', () => setView(view === 'three' ? 'side' : 'three'));
$('spar').addEventListener('click', () => setSpar(!spar)); $('guard').addEventListener('click', () => setGuard(!guard));
$('cast').addEventListener('click', () => setCast(cast === 'male' ? 'female' : 'male')); $('pause').addEventListener('click', () => setPaused(!paused));
$('stepbtn').addEventListener('click', () => { if (!paused) setPaused(true); stepOnce = true; });

// ─── the loop: a fixed 60 Hz tick under a free frame rate ───
let acc = 0, then = performance.now(), slow = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - then) / 1000); then = now;
  if (!paused) { acc += dt; let n = 0; while (acc >= 1 / FPS && n < 5) { tick(); acc -= 1 / FPS; n++; } if (n === 5) acc = 0; }
  else if (stepOnce) { tick(); stepOnce = false; }
  draw(); renderState();
  if (dirty.log && ++slow % 3 === 0) { renderLog(); renderLast(); dirty.log = false; }
  if (rec || replay) renderRec();
  requestAnimationFrame(frame);
}
fit(); reset(); renderRec();
requestAnimationFrame(frame);
