// action-lab page: the playable half. lab.mjs inlines feel.mjs (the kernel, its exports stripped) above this file and
// DATA (takes.mjs bake, per cast) above that, so the page steps the very code the gate runs.
/* global DATA, FEELS, FEEL_IDS, ARENA, BTN, FPS, newState, step, poseOf, frameData, util, copy */
const $ = (id) => document.getElementById(id);
const stage = $('stage'), ctx = stage.getContext('2d'), strip = $('strip'), sctx = strip.getContext('2d');
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const COL = {};
const readCols = () => { for (const k of ['floor', 'grid', 'block', 'blockTop', 'hero', 'dummy', 'ink', 'dim', 'startup', 'active', 'recovery', 'stop', 'stun', 'air', 'inv', 'gather', 'guard', 'mercy', 'spark', 'smear', 'shadow', 'cling', 'lock', 'zoneRed', 'zoneOrange', 'charge1', 'charge2', 'armor', 'hyper', 'foe', 'laser', 'life', 'flame', 'wing']) COL[k] = css(`--${k}`); };
readCols();

const store = { get(k, d) { try { const v = localStorage.getItem(`action-lab:${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(`action-lab:${k}`, JSON.stringify(v)); } catch { /* storage refused: the page works without it */ } } };

let cast = store.get('cast', 'male'), feel = store.get('feel', 'action'), view = store.get('view', 'three');
let spar = false, guard = true, critter = false, paused = false, stepOnce = false, shooter = null, gear = null;   // shooter: the name of one of the card's ranged sets, or off
const cards = Object.fromEntries(FEEL_IDS.map((id) => [id, copy(FEELS[id])]));
let S, hist = [], log = [], presses = [], sparks = [], tracers = [], cam = { x: 0, y: 0, z: 0, yaw: 0 }, shown = {}, prevWorld = {}, rec = null, replay = null;

function reset() {
  const sets = cards[feel].ranged?.sets ?? {}; if (shooter && !sets[shooter]) shooter = Object.keys(sets)[0] ?? null;
  S = newState(cards[feel], DATA[cast].body, { arena: ARENA, spar, guard, dummyHeight: critter ? 0.8 : util.HEIGHT, shooter: shooter ? sets[shooter] : null, gear });
  hist = []; log = []; presses = []; sparks = []; tracers = []; shown = {}; prevWorld = {};
  cam = { x: S.hero.p[0], y: S.hero.p[1], z: 0, yaw: 0 };
  renderFeel(); renderDials(); renderFrameData(); renderLog(); renderLast();
}

// ─── input: keyboard, gamepad, touch ───
const keys = new Set(), tapped = new Set();   // tapped: pressed since the last tick, so a tap between two ticks still lands
const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'jump', KeyJ: 'attack', KeyK: 'dodge', KeyL: 'dash', KeyQ: 'lock', KeyU: 'guard', ShiftLeft: 'sprint', ShiftRight: 'sprint' };
addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select')) return;
  const k = KEYMAP[e.code]; if (k) { if (!e.repeat) tapped.add(k); keys.add(k); e.preventDefault(); return; }
  if (/^Digit[1-4]$/.test(e.code)) { setFeel(FEEL_IDS[+e.code.slice(5) - 1]); return; }
  if (e.code === 'KeyR') reset();
  else if (e.code === 'KeyV') setView(view === 'three' ? 'side' : 'three');
  else if (e.code === 'KeyT') setSpar(!spar);
  else if (e.code === 'KeyY') cycleShooter();
  else if (e.code === 'KeyE') cycleGear();
  else if (e.code === 'KeyO') setOneHit(!S.card.life?.oneHit);
  else if (e.code === 'KeyG') setGuard(!guard);
  else if (e.code === 'KeyH') setCritter(!critter);
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
  let b = (on('jump') ? BTN.JUMP : 0) | (on('attack') ? BTN.ATTACK : 0) | (on('dodge') ? BTN.DODGE : 0) | (on('dash') ? BTN.DASH : 0) | (on('lock') ? BTN.LOCK : 0) | (on('guard') ? BTN.GUARD : 0) | (on('sprint') ? BTN.SPRINT : 0);
  tapped.clear();
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  padName = gp ? gp.id : null;
  if (gp) {
    const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0, dz = Math.hypot(ax, ay) > 0.18;
    if (dz) { x = ax; y = -ay; }
    const pr = (i) => !!gp.buttons[i]?.pressed;
    if (pr(12)) y = 1; if (pr(13)) y = -1; if (pr(14)) x = -1; if (pr(15)) x = 1;
    b |= (pr(0) ? BTN.JUMP : 0) | (pr(2) ? BTN.ATTACK : 0) | (pr(1) ? BTN.DODGE : 0) | (pr(5) ? BTN.DASH : 0) | (pr(4) || pr(11) ? BTN.LOCK : 0) | (pr(7) ? BTN.GUARD : 0) | (pr(6) || pr(10) ? BTN.SPRINT : 0);
  }
  if (touch.x || touch.y) { x = touch.x; y = touch.y; }
  b |= touch.b;
  // the stick is the camera's: up the screen is the way the camera looks (behind the hero at the target, when locked)
  const c = Math.cos(cam.yaw), sn = Math.sin(cam.yaw), wx = x * c + y * sn, wy = -x * sn + y * c;
  return [Math.round(Math.max(-1, Math.min(1, wx)) * 127), Math.round(Math.max(-1, Math.min(1, wy)) * 127), b];
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
    const m = a.kind === 'spar' ? util.sparMove(a) : a.lv ? S.card.charge.at[a.lv - 1] : S.card.moves.string[a.i], f = a.shown ?? a.f;
    return f < m.startup ? 'startup' : f < m.startup + m.active ? 'active' : 'recovery';
  }
  if (a?.kind === 'gather' || a?.kind === 'charge') return 'gather';
  if (a?.kind === 'aim') return (a.shown ?? a.f) < util.rangedOf(a.name).telegraph ? 'startup' : 'active';
  if (a?.kind === 'ko') return 'stun';
  if (a?.kind === 'pound') return (a.shown ?? a.f) < (S.card.pound?.hang ?? 0) ? 'gather' : 'active';
  if (a?.kind === 'poundLag') return 'recovery';
  if (a?.kind === 'dodge' || a?.kind === 'dash') { const I = (a.kind === 'dash' ? S.card.dash : S.card.dodge)?.iframes, f = a.shown ?? a.f; return I && f >= I[0] && f < I[1] ? 'inv' : 'recovery'; }
  if (a?.kind === 'guard' || a?.kind === 'block') return 'guard';
  if (B.stun > 0 || a?.kind === 'hurt' || a?.kind === 'stagger' || a?.kind === 'bonk') return 'stun';
  if (B.mercy > 0) return 'mercy';
  if (B.cling) return 'cling';
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
  move: (e) => (e.who === 'dummy' ? `dummy telegraphs a ${e.name} (${e.telegraph} f): ${e.unblockable ? 'red, unblockable: dodge it' : e.zone === 'orange' ? 'all orange: parryable' : 'red with an orange middle: parry it there'}; ${({ jab: 'any hit interrupts it', hook: 'armored: only a heavy or a shot interrupts it', perilous: 'hyper armor: nothing interrupts it' })[e.name] ?? ''}` : `move ${e.i + 1}: ${e.take}`),
  hit: (e) => `${e.who === 'dummy' ? 'dummy' : 'hero'} hit by ${e.pound ? `the ${e.pound}` : e.shot ? `the ${e.shot > 1 ? 'full charge shot' : 'charge shot'}` : e.charged ? `the charged ${e.charged > 1 ? 'launcher' : 'heavy'}` : e.attack ? `the ${e.attack}${e.unblockable && e.guarding ? ', through the guard (unblockable)' : ''}` : e.take}: Δv ${e.dv.toFixed(2)} m/s (×${e.powerscale.toFixed(1)}), hitstop ${e.hitstop} f, stun ${e.stun} f${e.advantage != null ? `, linked +${e.advantage}` : ''}${e.finisher ? ', finisher' : ''}`,
  blocked: (e) => `blocked (a free dummy that saw it coming), hitstop ${e.hitstop} f`, immune: (e) => `immune: mercy ${e.mercy} f left`,
  whiff: (e) => (e.short > 0 ? `whiff, ${e.short.toFixed(2)} m short` : 'whiff, wide of the dummy'), evaded: (e) => `evaded through the ${e.by}'s invincible frames`,
  wall: (e) => `wall: ${e.response} at ${e.into.toFixed(1)} m/s${e.out != null ? ` → ${e.out.toFixed(1)}` : ''}`,
  free: (e) => `${e.who} free to act`, end: (e) => (e.what === 'dash' && e.released ? 'dash let go' : null),
  dodge: (e) => (e.neutral ? `backstep (the stick at rest)` : `${e.kind} ${({ fwd: 'forward', back: 'back', left: 'to the left', right: 'to the right' })[e.rel]}`), dash: (e) => (e.kind === 'boost' ? 'boost' : 'dash'),
  stomp: (e) => (e.immune ? 'stomped, but the dummy is in its mercy: a bounce only' : `stomp: the dummy squashed, the bounce ${e.held ? 'high (jump held)' : 'low'} at ${e.vz.toFixed(1)} m/s`),
  'bounce-off': (e) => (e.immune ? 'bounced off (the dummy is in its mercy)' : `bounced off the dummy at ${e.vz.toFixed(1)} m/s (fell at ${e.fell.toFixed(1)}), the dummy ricochets`),
  slide: () => 'on its head: slid off (its top is no floor)',
  cling: () => 'on the wall: sliding down it', 'wall-jump': (e) => `${e.dash ? 'dash ' : ''}wall jump${e.coyote ? ', a moment after leaving the wall' : ': kicked off the wall'}`,
  'air-dash': (e) => `air dash (${e.left} left)`, lock: () => 'locked on the dummy', guard: () => 'guard up',
  block: (e) => `blocked${e.zone === 'red' ? ' (met in red: not parryable there)' : ''}: ${e.blockstun} f of blockstun${e.stamina != null ? `, stamina ${Math.round(e.stamina)}` : ''}`,
  parry: (e) => `parry (${e.at} f after the press): the dummy staggered ${e.riposte} f, riposte!`, 'guard-break': (e) => `guard broken: out of stamina, staggered ${e.stagger} f`,
  perfect: (e) => `perfect dodge: Witch Time, the dummy at half speed for ${e.witch} f`, 'witch-end': () => 'Witch Time over', unlock: () => 'lock let go', 'lock-lost': () => 'lock lost: the target is out of range', 'dash-jump': (e) => `dash jump: the air keeps ${e.speed.toFixed(1)} m/s`, 'air-jump': (e) => `air jump (${e.left} left)`,
  pound: (e) => ({ plunge: 'plunge: straight down', pound: 'ground pound: the flip, then the drop', bounce: 'bounce attack: straight down' })[e.kind],
  charge: (e) => ({ heavy: 'charging the heavy: hold on…', shot: 'charging the buster: hold on, move and jump with it', spin: 'revving the spin dash: the stick aims it' })[e.kind],
  'charge-level': (e) => `charge level ${e.lv} (held ${e.held} f)`, 'charge-fizzle': (e) => `let go: ${e.why}, nothing fires`, 'charge-lost': (e) => `charge lost: ${e.why === 'hit' ? 'hit while charging' : e.why}`,
  release: (e) => `released at level ${e.lv} after ${e.held} f: ${({ heavy: e.lv > 1 ? 'the launcher' : 'the heavy', shot: e.top ? 'the full charge shot' : 'a charge shot', spin: 'the spin dash' })[e.kind]}`,
  'shot-wall': () => 'the shot hit a wall',
  aim: (e) => `dummy aims: ${util.rangedOf(e.name).says} (${e.telegraph} f)`,
  fire: (e) => (e.hitscan ? `the ${e.name} fires: ${({ hit: 'a hit, no flight to react to', cover: 'stopped by cover', out: 'a miss' })[e.result]}` : null),
  burst: (e) => `the ${e.name} bursts on the floor`,
  hurt: (e) => `hit by the ${e.by}: ${e.damage} damage, ${e.stun ? `${e.down ? 'knocked down' : 'stunned'} ${e.stun} f` : 'a flinch, control kept'}${e.maneuver ? ' (maneuver armor: moving through it)' : ''}`,
  glide: (e) => ({ paraglider: 'the paraglider opens', glide: 'gliding', float: 'floating: the height held' })[e.kind],
  'glide-end': (e) => `${S.card.glide?.kind === 'float' ? 'the float' : 'the glide'} ends: ${e.why}`,
  jet: (e) => `the jetpack lights (${e.kind}, ${e.fuel} f of fuel)`, 'jet-end': (e) => `the jetpack ${e.why === 'out of fuel' ? 'burns out' : 'cuts'}: ${e.why}`,
  flap: () => null, tired: () => 'too tired to fly: down you go',
  rings: (e) => `the rings scattered (${e.lost}): one more hit is the end`, ko: (e) => (e.oneHit ? 'down: one hit is the end in this game' : 'down: out of life'), up: (e) => `up again, life ${e.hp}`,
  armor: (e) => `${e.who === 'dummy' ? 'the dummy\'s attack' : 'your attack'} shrugs off a ${e.tags.join(' ')} hit${e.of ? ` (${e.hits} of ${e.of}: the next one interrupts)` : ''}: ${e.breaks.length ? `only ${e.breaks.join(' or ')} interrupts it` : 'hyper armor, nothing interrupts it'}`,
  'armor-break': (e) => `${e.who === 'dummy' ? 'the dummy\'s' : 'your'} armor broken by a ${e.tags.join(' ')} hit${e.hits > 1 ? ` (hit ${e.hits})` : ''}: interrupted`,
  'pound-jump': () => 'ground-pound jump: the jump out of the pound\'s lag goes higher', 'pound-bounce': () => 'bounced back up off the floor', step: () => 'enemy step: a fresh jump off the dummy', bump: () => null,
};
function onEvent(e) {
  const line = say[e.type]?.(e);
  const whose = e.who === 'dummy' && ['takeoff', 'apex', 'land', 'edge', 'wall', 'free'].includes(e.type) ? 'dummy: ' : '';
  if (line) { log.push({ f: e.f, who: e.who, type: e.type, line: e.type === 'free' ? line : whose + line }); if (log.length > 60) log.shift(); }
  if (e.who === 'hero' && e.type === 'press') presses.push({ button: e.button, f: e.f, acted: null, effect: null, out: null });
  const open = (btn, need) => [...presses].reverse().find((p) => p.button === btn && !p.out && (need === 'acted' ? p.acted == null : p.acted != null && p.effect == null));
  if (e.who === 'hero' && e.type === 'acted') { const p = open(e.button, 'acted'); if (p) { p.acted = e.f; if (e.button === 'dodge' || e.button === 'dash') { p.effect = e.f; p.out = e.button === 'dash' ? S.card.dash.kind : S.card.dodge.kind; } } }
  if (e.who === 'hero' && e.type === 'dropped') { const p = [...presses].reverse().find((q) => q.button === e.button && q.acted == null && !q.out); if (p) p.out = `dropped: ${e.why}`; }
  if (e.who === 'hero' && e.type === 'takeoff') { const p = open('jump', 'effect'); if (p) { p.effect = e.f; p.out = 'take-off'; } }
  if (e.who === 'hero' && e.type === 'whiff') { const p = open('attack', 'effect'); if (p) { p.effect = e.f; p.out = 'whiff'; } }
  if (e.who === 'dummy' && ['hit', 'blocked', 'immune'].includes(e.type)) {
    const p = open('attack', 'effect'); if (p) { p.effect = e.f; p.out = e.type === 'hit' ? `hit${e.advantage != null ? ` (linked +${e.advantage})` : ''}` : e.type; }
    sparks.push({ p: [S.dummy.p[0], S.dummy.p[1], S.dummy.p[2] + 1.3], t: 0, big: e.finisher || e.hitstop > 6 });
  }
  if (e.who === 'hero' && (e.type === 'stomp' || e.type === 'bounce-off' || e.type === 'step' || e.type === 'pound-bounce' || e.type === 'wall-jump' || e.type === 'air-jump' || e.type === 'dash-jump' || e.type === 'air-dash')) sparks.push({ p: [S.hero.p[0], S.hero.p[1], S.hero.p[2]], t: 0, big: e.type !== 'step' });
  if (e.type === 'armor' || e.type === 'armor-break') { const B = S[e.who]; sparks.push({ p: [B.p[0], B.p[1], B.p[2] + 1.2], t: 0, big: e.type === 'armor-break', evade: e.type === 'armor' }); }
  if (e.who === 'hero' && (e.type === 'parry' || e.type === 'block' || e.type === 'perfect' || e.type === 'guard-break')) sparks.push({ p: [S.hero.p[0], S.hero.p[1], S.hero.p[2] + 1.3], t: 0, big: e.type === 'parry' || e.type === 'perfect', evade: e.type === 'perfect' });
  if (e.type === 'fire' && e.hitscan) tracers.push({ from: e.from, to: e.to, t: 0, hit: e.result === 'hit' });
  if (e.who === 'hero' && (e.type === 'hurt' || e.type === 'ko')) sparks.push({ p: [S.hero.p[0], S.hero.p[1], S.hero.p[2] + 1.2], t: 0, big: e.type === 'ko' || !!e.down });
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
    case 'move': if (d.lv) { a = pick(F.charged[d.lv - 1].frames, d.at); key += `c${d.lv}`; } else { a = moveFrame(F, d.i, d.at); key += d.i; } break;
    case 'charge': { const m = S.card.charge.at[0]; a = pick(F.charged[0].frames, m.startup - m.snap); break; }   // the haymaker loaded: the wind-up's end, held
    case 'spar': a = pick(D.spar[d.name] ?? D.spar.jab, d.at); key += d.name; break;
    case 'aim': a = pick(D.spar.jab, 30); break;   // the arm out at the target: the jab's extension, held
    case 'gather': a = pick(F.gather, F.gather.length > 1 ? (d.at * (F.gather.length - 1)) / Math.max(1, d.of) : 0); break;
    case 'dodge': { const fr = F.dodge[d.rel]; a = pick(fr, (d.at * (fr.length - 1)) / d.of); key += d.rel; break; }
    case 'dash': a = locoAt(D, Math.max(D.loco.sprint.v, d.speed), (S.f * 0.08) % 1); break;
    case 'guard': a = pick(F.guard, d.at); break;
    case 'react': a = pick(F.react[d.take].frames, d.at); key += d.take; break;
    case 'air': { const n = F.air.length - 1, x = d.u * n, i = Math.min(n - 1, Math.floor(x)); a = lerp(F.air[i], F.air[i + 1], x - i); break; }
    case 'spin': a = d.spin > 0.4 ? D.tuck : lerp(F.air[0], D.tuck, d.spin / 0.4);
      if (S[who].grounded) { let mz = Infinity; for (let k = 2; k < a.length; k += 3) mz = Math.min(mz, a[k]); a = a.map((v, k) => (k % 3 === 2 ? v - mz : v)); }   // a ball on the ground (the spin dash) sits on it
      break;
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
  // a spin turns about the pose's own centre (the drawn joints carry no pelvis hub of their own)
  let pz = 0; for (let k = 0; k < n; k++) pz += a[k * 3 + 2] / 1000; pz /= n;
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
const scale = () => Math.max(70, view === 'three' ? Math.min(W, H * 1.4) / 9 : Math.min(W, H * 1.6) / 8);
/** a world point's depth along the camera (larger: farther up the screen) */
const depthOf = (x, y) => (x - cam.x) * Math.sin(cam.yaw) + (y - cam.y) * Math.cos(cam.yaw);
function P(x, y, z) {
  const ppm = scale();
  if (view === 'three') { const rx = x - cam.x, ry = y - cam.y, c = Math.cos(cam.yaw), sn = Math.sin(cam.yaw); return [W / 2 + (rx * c - ry * sn) * ppm, H * 0.62 - ((z - cam.z) * CT + (rx * sn + ry * c) * ST) * ppm]; }
  return [W / 2 + (y - cam.y) * ppm, H * 0.78 - (z - cam.z) * ppm];
}
function poly(pts, fill, stroke) { ctx.beginPath(); pts.forEach((p, i) => { const q = P(...p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } }
function drawArena() {
  const A = S.arena, h = A.half;
  if (view === 'three') {
    poly([[-h, -h, 0], [h, -h, 0], [h, h, 0], [-h, h, 0]], COL.floor);
    ctx.lineWidth = 1; ctx.strokeStyle = COL.grid;
    for (let i = -h; i <= h; i++) { const a = P(i, -h, 0), b = P(i, h, 0), c2 = P(-h, i, 0), d = P(h, i, 0); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(c2[0], c2[1]); ctx.lineTo(d[0], d[1]); ctx.stroke(); }
    const up = [Math.sin(cam.yaw), Math.cos(cam.yaw)];
    for (const [n, a, b] of [[[0, 1], [-h, h], [h, h]], [[0, -1], [h, -h], [-h, -h]], [[1, 0], [h, h], [h, -h]], [[-1, 0], [-h, -h], [-h, h]]]) if (n[0] * up[0] + n[1] * up[1] > 0.2) poly([[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], 0.5], [a[0], a[1], 0.5]], COL.block);
  } else {
    const a = P(0, -h, 0), b = P(0, h, 0); ctx.fillStyle = COL.floor; ctx.fillRect(a[0], a[1], b[0] - a[0], H - a[1]);
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1; for (let i = -h; i <= h; i++) { const q = P(0, i, 0); ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0], q[1] + 6); ctx.stroke(); }
  }
}
/** a block: the side faces that face the camera, then its top */
function drawBlock(k) {
  const [x0, x1] = k.x, [y0, y1] = k.y;
  if (view === 'three') {
    const up = [Math.sin(cam.yaw), Math.cos(cam.yaw)];
    for (const [n, a, b] of [[[0, -1], [x0, y0], [x1, y0]], [[0, 1], [x1, y1], [x0, y1]], [[-1, 0], [x0, y1], [x0, y0]], [[1, 0], [x1, y0], [x1, y1]]]) if (n[0] * up[0] + n[1] * up[1] < 0) poly([[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], k.h], [a[0], a[1], k.h]], COL.block);
    poly([[x0, y0, k.h], [x1, y0, k.h], [x1, y1, k.h], [x0, y1, k.h]], COL.blockTop);
  } else poly([[0, y0, 0], [0, y1, 0], [0, y1, k.h], [0, y0, k.h]], COL.block, COL.blockTop);
}
const corners = (k) => [[k.x[0], k.y[0]], [k.x[1], k.y[0]], [k.x[1], k.y[1]], [k.x[0], k.y[1]]];
/** an enemy attack's arc on the floor: red, its orange segment, filling through the telegraph; the sweep's edge once live */
function drawArc() {
  const D = S.dummy, a = D.act; if (a?.kind !== 'spar' || view !== 'three') return;
  const m = util.sparMove(a), f = a.shown ?? a.f, r = m.reach + util.RADIUS, total = m.startup + m.active;
  if (f >= total) return;
  const deg = Math.PI / 180, at = (t) => D.yaw + (m.arc[0] + (m.arc[1] - m.arc[0]) * t) * deg;
  const sector = (t0, t1, fill, alpha) => {
    const pts = [[D.p[0], D.p[1], D.p[2] + 0.02]];
    for (let i = 0; i <= 12; i++) { const ang = at(t0 + ((t1 - t0) * i) / 12); pts.push([D.p[0] + Math.sin(ang) * r, D.p[1] + Math.cos(ang) * r, D.p[2] + 0.02]); }
    ctx.globalAlpha = alpha; poly(pts, fill); ctx.globalAlpha = 1;
  };
  const live = f >= m.startup, k = f - m.startup, fill = live ? 0.6 : 0.15 + (0.35 * f) / m.startup;
  sector(0, 1, COL.zoneRed, fill);
  if (m.zone === 'orange') sector(0, 1, COL.zoneOrange, fill);
  else if (m.orange) sector(m.orange[0], m.orange[1], COL.zoneOrange, fill);
  if (live && m.sweep) { const ang = at((k + 1) / m.active), p0 = P(D.p[0], D.p[1], D.p[2] + 0.02), p1 = P(D.p[0] + Math.sin(ang) * r, D.p[1] + Math.cos(ang) * r, D.p[2] + 0.02); ctx.strokeStyle = COL.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); }
  if (m.unblockable) { const top = P(D.p[0], D.p[1], D.p[2] + D.h + 0.5); ctx.fillStyle = COL.zoneRed; ctx.font = `700 ${Math.round(scale() * 0.35)}px ${css('--display')}`; ctx.textAlign = 'center'; ctx.fillText('!', top[0], top[1]); ctx.textAlign = 'start'; }
}
/** the lock-on's mark: a ring at the target's feet and a notch over its head */
function drawLock() {
  if (!S.lock) return;
  const D = S.dummy, c = P(D.p[0], D.p[1], D.p[2]), ppm = scale(), top = P(D.p[0], D.p[1], D.p[2] + D.h + 0.35);
  ctx.strokeStyle = COL.lock; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(c[0], c[1], 0.55 * ppm, 0.55 * ppm * (view === 'three' ? ST : 0.25), 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = COL.lock; ctx.beginPath(); ctx.moveTo(top[0], top[1] + 7); ctx.lineTo(top[0] - 7, top[1] - 5); ctx.lineTo(top[0] + 7, top[1] - 5); ctx.closePath(); ctx.fill();
}
function drawShadow(B) {
  const g = util.groundAt(S, B.p[0], B.p[1]), up = Math.max(0, B.p[2] - g), r = 0.34 / (1 + up * 0.4);
  ctx.globalAlpha = 0.5 / (1 + up); ctx.fillStyle = COL.shadow;
  const c = P(B.p[0], B.p[1], g); const ppm = scale();
  ctx.beginPath(); ctx.ellipse(c[0], c[1], r * ppm, r * ppm * (view === 'three' ? ST : 0.25), 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
}
function drawBody(who, colour) {
  const { d, a } = poseFrames(who), w = toWorld(d, a), D = DATA[cast], B = S[who];
  const ppm = scale();
  const shake = d.held ? ((S.f % 2) * 2 - 1) * 2 : 0;
  // smears: a hand or foot that jumped further than the card's smear in one frame
  const sm = S.card.look.smear, prev = prevWorld[who];
  if (sm && prev && !d.held) for (const nm of ['wristL', 'wristR', 'toeTipL', 'toeTipR']) {
    const k = D.names.indexOf(nm), a0 = prev[k], b0 = w[k]; if (Math.hypot(a0[0] - b0[0], a0[1] - b0[1], a0[2] - b0[2]) < sm) continue;
    const p0 = P(...a0), p1 = P(...b0); ctx.strokeStyle = COL.smear; ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(4, ppm * 0.09); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); ctx.globalAlpha = 1;
  }
  prevWorld[who] = w;
  const inv = (d.clip === 'dodge' || d.clip === 'dash') && d.iframes, hurt = B.stun > 0 || B.act?.kind === 'hurt';
  const witch = who === 'dummy' && S.witch > 0;
  // armor on this frame: a halo under the bones (steel: something breaks it; gold: hyper armor, nothing does)
  const AR = util.armorOf(S, B);
  if (AR) { ctx.strokeStyle = AR.by.length ? COL.armor : COL.hyper; ctx.globalAlpha = 0.45; ctx.lineWidth = Math.max(6, ppm * 0.16); ctx.lineCap = 'round'; ctx.beginPath(); for (const [i, j] of D.bones) { const p0 = P(...w[i]), p1 = P(...w[j]); ctx.moveTo(p0[0] + shake, p0[1]); ctx.lineTo(p1[0] + shake, p1[1]); } ctx.stroke(); ctx.globalAlpha = 1; }
  ctx.strokeStyle = d.held ? COL.ink : inv || witch ? COL.inv : hurt ? COL.stun : colour; ctx.globalAlpha = inv ? 0.6 : 1;
  if (who === 'hero' && B.mercy > 0 && S.card.hurt?.mercy && S.f % 6 < 3) ctx.globalAlpha = 0.25;   // mercy: the classic blink
  ctx.lineWidth = Math.max(2, ppm * 0.055); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const [i, j] of D.bones) { const p0 = P(...w[i]), p1 = P(...w[j]); ctx.moveTo(p0[0] + shake, p0[1]); ctx.lineTo(p1[0] + shake, p1[1]); }
  ctx.stroke();
  const hb = w[D.names.indexOf('headBase')], ht = w[D.names.indexOf('headTop')];
  if (hb && ht) { const c = P((hb[0] + ht[0]) / 2, (hb[1] + ht[1]) / 2, (hb[2] + ht[2]) / 2); ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(c[0] + shake, c[1], Math.max(4, ppm * 0.11), 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function drawSparks() {
  const ppm = scale();
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
  cam.z += (Math.max(0, S.hero.p[2] - 2) - cam.z) * 0.08;   // a high flight lifts the camera with it (a jump's height does not)
  // locked, the camera swings behind the hero to look at the target; let go, it swings back north
  const want = S.lock ? util.bearing(S) : 0; cam.yaw += util.angDiff(want, cam.yaw) * (S.lock ? 0.3 : 0.12);   // close behind while locked, so a held stick keeps circling
  drawArena();
  const near = (b) => Math.min(...corners(b).map(([x, y]) => depthOf(x, y))), far = (b) => Math.max(...corners(b).map(([x, y]) => depthOf(x, y)));
  const blocks = [...S.arena.blocks].sort((a, b) => far(b) - far(a));
  for (const b of blocks) drawBlock(b);
  drawArc(); drawLock();
  const bodies = [['dummy', COL.dummy], ['hero', COL.hero]].sort((a, b) => (view === 'three' ? depthOf(S[b[0]].p[0], S[b[0]].p[1]) - depthOf(S[a[0]].p[0], S[a[0]].p[1]) : S[a[0]].p[0] - S[b[0]].p[0]));
  for (const [who, col] of bodies) {
    drawShadow(S[who]); drawBody(who, col);
    // a block standing between the camera and a body below its top covers it
    if (view === 'three') for (const b of blocks) {
      const B = S[who], dB = depthOf(B.p[0], B.p[1]); if (B.p[2] >= b.h - 0.05 || dB <= near(b)) continue;
      const xs = corners(b).map(([x, y]) => P(x, y, 0)[0]), bx = P(B.p[0], B.p[1], 0)[0];
      if (bx > Math.min(...xs) - 20 && bx < Math.max(...xs) + 20 && dB - near(b) < 3) drawBlock(b);
    }
  }
  drawShots(); drawCharge(); drawFoes(); drawAim(); drawGear(); drawLife();
  drawSparks();
  drawStrip();
}
/** the enemy's shots: a ball its size with a shadow on the floor, the hitscan tracers a fading line */
function drawFoes() {
  const ppm = scale();
  for (const q of S.foes) {
    const g = util.groundAt(S, q.p[0], q.p[1]), sh = P(q.p[0], q.p[1], g); ctx.fillStyle = COL.shadow; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.ellipse(sh[0], sh[1], q.size * ppm, q.size * ppm * (view === 'three' ? ST : 0.25), 0, 0, Math.PI * 2); ctx.fill();
    const c = P(...q.p); ctx.globalAlpha = 1; ctx.fillStyle = COL.foe; ctx.beginPath(); ctx.arc(c[0], c[1], Math.max(3, q.size * ppm), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COL.ink; ctx.lineWidth = 1; ctx.stroke();
  }
  tracers = tracers.filter((t) => t.t < 10);
  for (const t of tracers) { const a = P(...t.from), b = P(...t.to); ctx.strokeStyle = COL.laser; ctx.globalAlpha = 1 - t.t / 10; ctx.lineWidth = t.hit ? 3 : 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); if (!paused) t.t++; }
  ctx.globalAlpha = 1;
}
/** the shooter's aim through its telegraph: a laser for a sight (bright once locked), a faint line for the rest */
function drawAim() {
  const D = S.dummy, a = D.act; if (a?.kind !== 'aim' || !a.aim) return;
  const R = util.rangedOf(a.name); if (a.f >= R.telegraph + (R.burst - 1) * R.gap + 1) return;
  const o = P(D.p[0], D.p[1], D.p[2] + 1.3), t = P(...a.aim), k = Math.min(1, a.f / R.telegraph), locked = R.lock && a.f >= R.telegraph - R.lock;
  ctx.strokeStyle = COL.laser; ctx.globalAlpha = R.sight ? 0.25 + 0.6 * k : 0.25; ctx.lineWidth = locked ? 3 : 1.5; ctx.setLineDash(R.sight ? [] : [6, 6]);
  ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(t[0], t[1]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  if (locked && S.f % 4 < 2) { ctx.fillStyle = COL.laser; ctx.beginPath(); ctx.arc(o[0], o[1], 6, 0, Math.PI * 2); ctx.fill(); }   // the glint
}
/** the gear in flight: a canopy over a paraglider, wings out for a glide or a float, a flame under a jetpack, a rotor
 * for a flight */
function drawGear() {
  const B = S.hero, d = poseOf(S, 'hero'), g = d.gear; if (!g) return;
  const ppm = scale(), x = B.p[0], y = B.p[1], z = B.p[2], c = Math.cos(B.yaw), sn = Math.sin(B.yaw), side = (k, up) => P(x + c * k, y - sn * k, z + up);
  ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
  if (g === 'paraglider') { ctx.strokeStyle = COL.wing; ctx.beginPath(); const L = side(-1.2, 2.6), M = side(0, 3.0), R = side(1.2, 2.6); ctx.moveTo(L[0], L[1]); ctx.quadraticCurveTo(M[0], M[1] - 0.3 * ppm, R[0], R[1]); const hd = side(0, 1.6); ctx.moveTo(L[0], L[1]); ctx.lineTo(hd[0], hd[1]); ctx.lineTo(R[0], R[1]); ctx.stroke(); }
  else if (g === 'glide' || g === 'float') { ctx.fillStyle = COL.wing; ctx.globalAlpha = 0.35; const a = side(-0.9, 1.3), b = side(0, 1.45), e = side(0.9, 1.3), f = side(0, 1.05); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(e[0], e[1]); ctx.lineTo(f[0], f[1]); ctx.closePath(); ctx.fill(); }
  else if (g === 'jet') { const o = P(x - Math.sin(B.yaw) * 0.15, y - Math.cos(B.yaw) * 0.15, z + 0.9), t = P(x - Math.sin(B.yaw) * 0.15, y - Math.cos(B.yaw) * 0.15, z + 0.9 - (0.5 + 0.2 * (S.f % 3)) ); ctx.strokeStyle = COL.flame; ctx.lineWidth = Math.max(4, ppm * 0.12); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(t[0], t[1]); ctx.stroke(); }
  else if (g === 'flap') { const h = P(x, y, z + 1.95), r = 0.45 * ppm, t = S.f * 0.6; ctx.strokeStyle = COL.wing; ctx.beginPath(); ctx.moveTo(h[0] - Math.cos(t) * r, h[1] - Math.sin(t) * r * 0.3); ctx.lineTo(h[0] + Math.cos(t) * r, h[1] + Math.sin(t) * r * 0.3); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
/** the hero's life: a bar (health) or a ring count, top left */
function drawLife() {
  const L = S.card.life, H = S.hero; if (!L || H.hp == null) return;
  ctx.font = `600 12px ${css('--mono')}`; ctx.textBaseline = 'middle'; ctx.fillStyle = COL.ink;
  if (L.kind === 'rings') { ctx.fillText(`RINGS ${H.hp}${H.act?.kind === 'ko' ? '  DOWN' : ''}`, 14, 18); gauge(); return; }
  const w = 140, k = H.hp / L.hp; ctx.fillText(L.oneHit ? 'ONE HIT' : 'LIFE', 14, 18);
  ctx.strokeStyle = COL.dim; ctx.lineWidth = 1; ctx.strokeRect(80, 12, w, 12); ctx.fillStyle = H.act?.kind === 'ko' ? COL.stun : COL.life; ctx.fillRect(80, 12, w * k, 12);
  ctx.fillStyle = COL.ink; ctx.fillText(`${H.hp}`, 80 + w + 8, 18);
  gauge();
}
/** the gear's gauge under the life: the jetpack's fuel, the paraglider's stamina, a flight's time */
function gauge() {
  const H = S.hero, C = S.card; let k = null, label = '';
  if (S.gear === 'jet' && C.jet) { k = H.fuel / C.jet.fuel; label = C.jet.kind === 'flap' ? 'FLIGHT' : 'FUEL'; }
  else if (S.gear === 'glide' && C.glide?.time) { k = H.glide ? 1 - H.glideT / C.glide.time : H.glideSpent ? 0 : 1; label = C.glide.kind === 'float' ? 'FLOAT' : 'STAMINA'; }
  if (k == null) return;
  ctx.fillStyle = COL.ink; ctx.fillText(label, 14, 38); ctx.strokeStyle = COL.dim; ctx.strokeRect(80, 32, 140, 12); ctx.fillStyle = COL.flame; ctx.fillRect(80, 32, 140 * Math.max(0, k), 12);
}
/** the shots in flight: a ball its size, the full charge brighter */
function drawShots() {
  const ppm = scale();
  for (const sh of S.shots) {
    const c = P(...sh.p); ctx.fillStyle = sh.lv > 1 ? COL.charge2 : COL.charge1; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(c[0], c[1], Math.max(3, sh.size * ppm), 0, Math.PI * 2); ctx.fill();
    const t = P(sh.p[0] - sh.v[0] * 0.03, sh.p[1] - sh.v[1] * 0.03, sh.p[2]); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(2, sh.size * ppm); ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.moveTo(t[0], t[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
/** the charge, once it shows: a ring about the hero's chest, pulsing, its colour the level reached */
function drawCharge() {
  const B = S.hero, c = B.charge, CH = S.card.charge; if (!c || !CH || c.held < CH.show) return;
  const ppm = scale(), z = B.p[2] + (B.act?.kind === 'charge' && CH.kind === 'spin' ? 0.35 : 1.0), k = Math.min(1, c.held / CH.levels.at(-1)), pulse = 1 + 0.12 * Math.sin(S.f * (0.4 + 0.4 * c.lv));
  const p = P(B.p[0], B.p[1], z), r = (0.35 + 0.25 * k) * ppm * pulse;
  ctx.strokeStyle = c.lv >= CH.levels.length ? COL.charge2 : c.lv ? COL.charge1 : COL.dim; ctx.lineWidth = 2 + c.lv * 1.5; ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.ellipse(p[0], p[1], r, r * (view === 'three' ? 0.75 : 1), 0, 0, Math.PI * 2 * Math.max(0.05, k)); ctx.stroke(); ctx.globalAlpha = 1;
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
  $('spar').setAttribute('aria-pressed', String(spar)); $('shooter').setAttribute('aria-pressed', String(!!shooter)); $('shooter').textContent = shooter ? `Shooter: ${shooter}` : 'Shooter'; $('onehit').setAttribute('aria-pressed', String(!!S?.card.life?.oneHit)); $('gearbtn').setAttribute('aria-pressed', String(!!gear)); $('gearbtn').textContent = gear ? `Gear: ${gear === 'glide' ? 'glider' : 'jetpack'}` : 'Gear'; $('guard').setAttribute('aria-pressed', String(guard)); $('critter').setAttribute('aria-pressed', String(critter));
  $('view').textContent = view === 'three' ? '¾ view' : 'Side view'; $('pause').textContent = paused ? 'Resume' : 'Pause';
}
const DIALS = [
  ['Ground', 'ground.run', 'run', 1, 24, 0.5, 'm/s'], ['Ground', 'ground.accel', 'accel', 1, 120, 1, 'm/s²'], ['Ground', 'ground.decel', 'decel', 1, 120, 1, 'm/s²'],
  ['Jump', 'jump.commit', 'commit', 0, 20, 1, 'f'], ['Jump', 'jump.height', 'height', 0.2, 3, 0.05, 'm'], ['Jump', 'jump.gRise', 'rise g', 5, 60, 0.5, 'm/s²'], ['Jump', 'jump.gFall', 'fall g', 5, 80, 0.5, 'm/s²'],
  ['Jump', 'jump.cut', 'cut', 0.1, 1, 0.05, '×'], ['Wall', 'cling.slide', 'wall slide', 0.5, 8, 0.5, 'm/s'], ['Wall', 'cling.away', 'kick away', 1, 12, 0.5, 'm/s'], ['Wall', 'cling.lock', 'kick lock', 0, 20, 1, 'f'], ['Wall', 'cling.up', 'kick up', 0.3, 1.5, 0.05, '×'], ['Air', 'air.jumps', 'air jumps', 0, 3, 1, ''], ['Guard', 'guard.parry', 'parry window', 1, 20, 1, 'f'], ['Guard', 'guard.block.stun', 'blockstun', 0, 30, 1, 'f'], ['Guard', 'guard.riposte', 'riposte', 10, 120, 1, 'f'], ['Guard', 'guard.perfect.witch', 'witch time', 0, 300, 10, 'f'], ['Roll', 'dodge.speed', 'roll speed', 1, 16, 0.5, 'm/s'], ['Roll', 'dodge.frames', 'roll frames', 6, 40, 1, 'f'], ['Dash', 'dash.speed', 'dash speed', 2, 20, 0.5, 'm/s'], ['Dash', 'dash.frames', 'dash frames', 4, 60, 1, 'f'], ['Dash', 'dash.air.count', 'air dashes', 0, 3, 1, ''], ['Dash', 'dash.air.speed', 'air dash speed', 2, 20, 0.5, 'm/s'], ['Air', 'air.mult', 'air jump', 0.3, 1.5, 0.05, '×'], ['Jump', 'jump.hang', 'hang', 0, 20, 1, 'f'], ['Jump', 'jump.coyote', 'coyote', 0, 20, 1, 'f'], ['Jump', 'jump.buffer', 'buffer', 0, 20, 1, 'f'], ['Jump', 'jump.air', 'air control', 0, 1, 0.05, '×'],
  ['Gear', 'glide.fall', 'glide sink', 0.2, 6, 0.1, 'm/s'], ['Gear', 'glide.speed', 'glide speed', 1, 20, 0.5, 'm/s'], ['Gear', 'glide.time', 'glide time', 10, 900, 10, 'f'], ['Gear', 'jet.thrust', 'jet thrust', 5, 80, 1, 'm/s²'], ['Gear', 'jet.fuel', 'jet fuel', 10, 600, 10, 'f'],
  ['Ranged', 'ranged.every', 'volley every', 30, 300, 5, 'f'], ['Hurt', 'hurt.stun', 'stun', 0, 90, 1, 'f'], ['Hurt', 'hurt.knock', 'knock', 0, 10, 0.5, 'm/s'], ['Hurt', 'hurt.mercy', 'mercy', 0, 240, 5, 'f'], ['Hurt', 'maneuver.stun', 'maneuver stun', 0, 1, 0.05, '×'], ['Hurt', 'life.hp', 'life', 1, 200, 1, ''],
  ['Charge', 'charge.levels.0', 'level 1 at', 4, 120, 1, 'f'], ['Charge', 'charge.levels.1', 'level 2 at', 10, 180, 1, 'f'], ['Charge', 'charge.move', 'stance walk', 0, 1, 0.05, '×'],
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
  const head = '<tr><th>move</th><th>startup</th><th>active</th><th>recovery</th><th>total</th><th>cancel</th><th>hitstop</th><th>stun</th><th>link</th><th>on block</th><th>armor</th></tr>';
  const sign = (x) => (x == null ? '–' : x > 0 ? `+${x}` : String(x));
  $('fd').innerHTML = head + rows.map((r, i) => `<tr><td>${r.charge ? `hold ${r.charge} (${r.held} f)` : `${i + 1}. ${r.take}`}${r.finisher ? ' ✦' : ''}</td><td class="c-startup">${r.startup}</td><td class="c-active">${r.active}</td><td class="c-recovery">${r.recovery}</td><td>${r.total}</td><td>${r.cancel ?? '–'}</td><td>${r.hitstop}</td><td>${r.stun}</td><td class="${r.link == null ? '' : r.link >= 0 ? 'good' : 'bad'}">${sign(r.link)}</td><td class="${r.onBlock >= 0 ? 'good' : 'bad'}">${sign(r.onBlock)}</td><td>${r.armor}</td></tr>`).join('');
  const C = S.card;
  $('jd').textContent = `jump: commit ${C.jump.commit} f · apex ${C.jump.height} m · coyote ${C.jump.coyote} f · buffer ${C.jump.buffer} f · cut ×${C.jump.cut} · dodge: a directional ${C.dodge.kind}, ${C.dodge.frames} f${C.dodge.iframes ? `, invincible ${C.dodge.iframes[0]}–${C.dodge.iframes[1]}` : ', no invincibility'} · dash: ${C.dash ? `${C.dash.kind}, ${C.dash.frames} f${C.dash.air ? ', air dash' : ''}` : 'none'} · wall: ${C.wall.model}`;
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
  $('st').innerHTML = [['frame', S.f], ['clip', d.clip + (d.clip === 'move' ? ` ${d.i + 1}` : '')], ['speed', `${v.toFixed(2)} m/s`], ['height', `${H.p[2].toFixed(2)} m`], ['ground', H.grounded ? 'yes' : H.coyote ? `coyote ${H.coyote}` : 'no'], ['buffer', S.queue.map((q) => `${q.button} ${q.buffer - q.age}`).join(', ') || '–'], ['dummy', S.dummy.stun ? `stun ${S.dummy.stun}` : S.dummy.mercy ? `mercy ${S.dummy.mercy}` : S.dummy.alert ? 'alert' : 'idle'], ['lock', S.lock ? `on, ${util.targetDist(S).toFixed(1)} m` : S.card.lock ? 'off' : 'none'], ['guard', S.card.guard ? (S.hero.stamina != null ? `stamina ${Math.round(S.hero.stamina)}` : H.act?.kind === 'block' ? 'up' : 'down') : 'none'], ['witch', S.witch ? `${S.witch} f` : '–'], ['life', S.card.life ? `${S.card.life.kind === 'rings' ? 'rings ' : ''}${H.hp}${H.mercy ? `, mercy ${H.mercy}` : ''}` : '–'], ['shooter', shooter ?? 'off'], ['gear', gear ? `${gear === 'glide' ? S.card.glide?.kind : `jetpack (${S.card.jet?.kind})`}${gear === 'jet' ? `, fuel ${Math.round(S.hero.fuel)}` : ''}` : 'none'], ['charge', S.card.charge ? (H.charge ? `${H.charge.held} f, level ${H.charge.lv}` : S.card.charge.kind) : 'none']].map(([k, x]) => `<div><dt>${k}</dt><dd>${x}</dd></div>`).join('');
  const [x, y, b] = lastPad;
  $('knob').setAttribute('cx', String(20 + (x / 127) * 14)); $('knob').setAttribute('cy', String(20 - (y / 127) * 14));
  for (const [id, bit] of [['bJ', BTN.JUMP], ['bA', BTN.ATTACK], ['bD', BTN.DODGE], ['bX', BTN.DASH], ['bL', BTN.LOCK], ['bG', BTN.GUARD], ['bS', BTN.SPRINT]]) $(id).classList.toggle('on', !!(b & bit));
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
  else { reset(); rec = { feel, cast, spar, guard, critter, shooter: S.shooter, gear, card: copy(S.card), pads: [] }; }
  renderRec();
});
$('replay').addEventListener('click', () => { if (!last) return; setFeel(last.feel, true); cast = last.cast; spar = last.spar; guard = last.guard; critter = !!last.critter; cards[feel] = copy(last.card); shooter = null; gear = last.gear ?? null; reset(); if (last.shooter) { S.shooter = last.shooter; S.spar = false; shooter = Object.entries(S.card.ranged.sets).find(([, v]) => JSON.stringify(v) === JSON.stringify(last.shooter))?.[0] ?? 'recorded'; renderFeel(); } replay = { pads: last.pads, i: 0 }; renderRec(); });
const fixture = (r) => ({ says: 'recorded in the lab', feel: r.feel, cast: r.cast, spar: r.spar, guard: r.guard, ...(r.critter ? { dummyHeight: 0.8 } : {}), ...(r.shooter ? { shooter: r.shooter } : {}), ...(r.gear ? { gear: r.gear } : {}), card: r.card, pads: r.pads });
$('copy').addEventListener('click', async () => {
  const t = $('fixture'); t.value = JSON.stringify(fixture(last));
  try { await navigator.clipboard.writeText(t.value); $('recState').textContent = 'Copied. Save it under scripts/spikes/action-lab/fixtures/ and verify.mjs replays it.'; }
  catch { t.hidden = false; t.select(); $('recState').textContent = 'Select-all is on the box below: copy it from there.'; }
});
$('load').addEventListener('click', () => { try { const fx = JSON.parse($('fixture').value); last = { feel: fx.feel, cast: fx.cast ?? 'male', spar: !!fx.spar, guard: fx.guard ?? true, critter: fx.dummyHeight != null && fx.dummyHeight < 1, shooter: fx.shooter ?? null, gear: fx.gear ?? null, card: fx.card ?? copy(FEELS[fx.feel]), pads: fx.pads }; renderRec(); $('replay').click(); } catch (e) { $('recState').textContent = `That is not a recorded run: ${e.message}`; } });
$('showfx').addEventListener('click', () => { $('fixture').hidden = !$('fixture').hidden; $('load').hidden = $('fixture').hidden; });

// ─── controls ───
function setFeel(id, quiet) { feel = id; store.set('feel', id); if (!quiet) reset(); else renderFeel(); }
function setView(v) { view = v; store.set('view', v); renderFeel(); }
function setSpar(on) { spar = on; S.spar = on; if (on && shooter) { shooter = null; S.shooter = null; } renderFeel(); }
/** the shooter: off → each of the card's ranged sets → off (it takes the dummy from sparring) */
function cycleShooter() {
  const keys = Object.keys(S.card.ranged?.sets ?? {}), i = shooter ? keys.indexOf(shooter) : -1;
  shooter = i + 1 < keys.length ? keys[i + 1] : null; S.shooter = shooter ? S.card.ranged.sets[shooter] : null; S.volleyN = 0;
  if (shooter) { spar = false; S.spar = false; } renderFeel();
}
/** the gear: none → glider → jetpack → none (what the jump does in the air once the air jumps are spent) */
function cycleGear() { gear = gear == null ? 'glide' : gear === 'glide' ? 'jet' : null; S.gear = gear; S.hero.glide = false; S.hero.jet = false; S.hero.flying = false; S.hero.fuel = S.card.jet?.fuel ?? 0; renderFeel(); }
function setOneHit(on) { if (!S.card.life) return; S.card.life.oneHit = on; cards[feel].life.oneHit = on; renderFeel(); }
function setGuard(on) { guard = on; S.guard = on; renderFeel(); }
function setCritter(on) { critter = on; reset(); }
function setCast(c) { cast = c; store.set('cast', c); reset(); }
function setPaused(on) { paused = on; renderFeel(); }
for (const b of document.querySelectorAll('[data-feel]')) b.addEventListener('click', () => setFeel(b.dataset.feel));
$('reset').addEventListener('click', reset); $('defaults').addEventListener('click', () => { cards[feel] = copy(FEELS[feel]); reset(); });
$('view').addEventListener('click', () => setView(view === 'three' ? 'side' : 'three'));
$('spar').addEventListener('click', () => setSpar(!spar)); $('shooter').addEventListener('click', cycleShooter); $('gearbtn').addEventListener('click', cycleGear); $('onehit').addEventListener('click', () => setOneHit(!S.card.life?.oneHit)); $('guard').addEventListener('click', () => setGuard(!guard)); $('critter').addEventListener('click', () => setCritter(!critter));
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
// a read-only window for headless checks (the lab's own scripts drive the page and read what it shows)
window.__lab = { state: () => S, pose: (who) => { const r = poseFrames(who); return { d: r.d, world: toWorld(r.d, r.a) }; } };
fit(); reset(); renderRec();
requestAnimationFrame(frame);
