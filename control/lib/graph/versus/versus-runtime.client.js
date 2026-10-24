/**
 * versus runtime — what a fight needs in a browser, whatever draws it (inlined as text, never imported).
 *
 * Shared by the front (versus-play.client.js: the menus and the 2D page) and the arena (versus-arena.client.js:
 * the World page's fight channel, drawn in 3D): the keyboard and gamepads, the CPU and training pads, a match's
 * step at 60 Hz with its events turned into banners, sparks and sounds, and the 2D overlay every fight draws over
 * its picture (health, meter, timer, rounds, combo, banners, the training panel, sparks, fireballs, boxes). The
 * picture itself is the caller's: it hands `toScreen(xmm, ymm)` and a px-per-mm scale for the overlay to land on.
 */

/* global compileFighter, newVersus, stepVersus, cpuPad, newCpuMemory, CPU_LEVELS, POSES, lerpPose, reactionPose, hurtBoxes,
   hitBox, pushBox, BTN, weaponLine */

const VS_LEVELS = ['novice', 'regular', 'veteran', 'ace'];
const VS_DUMMY = ['stand', 'crouch', 'block', 'jump', 'cpu'];
// held: keys down now; latch: keys pressed since the last frame read them (a tap between two slow frames still counts)
const RT = { held: new Set(), latch: new Set(), showBoxes: false, dummy: 0, muted: false };

// ── input ────────────────────────────────────────────────────────────────────────────────────────────────────

function installVersusInput(onKey) {
  window.addEventListener('keydown', (e) => {
    RT.held.add(e.code);
    RT.latch.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    if (e.code === 'KeyB') RT.showBoxes = !RT.showBoxes;
    if (e.code === 'KeyM') RT.muted = !RT.muted;
    if (onKey) onKey(e.code);
  });
  window.addEventListener('keyup', (e) => RT.held.delete(e.code));
  window.addEventListener('blur', () => RT.held.clear());
}

// THE SEATS (controls/seats-kernel.js): two, each a controller, the keyboard one and every pad another. A player sits
// down with start or light on their own controller (the keyboard's Space too); a pad unplugged keeps its seat, away, its
// fighter standing, until it is back. Polled once a tick, from the menus (menuInput leads every tick of every loop).
let VS_SEATS = __VS_SEATK.newSeats({ max: 2 });
let VS_READS = {};
const kbRead = (c) => RT.held.has(c) || RT.latch.has(c);
function pollSeats() {
  const reads = { keyboard: kbRead }, frame = {};
  const wants = (fam, rd) => __VS_CTL.held(__VS_BIND, 'start', fam, rd) || __VS_CTL.held(__VS_BIND, 'light', fam, rd);
  frame.keyboard = { join: wants('keyboard', kbRead) || kbRead('Space') };
  const ps = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let k = 0; k < ps.length; k++) {
    const p = ps[k];
    if (!p || !p.connected) continue;
    const id = 'pad:' + p.index, rd = __VS_CTL.gamepadRead(p, __VS_DEV);
    reads[id] = rd; frame[id] = { connected: true, join: wants('gamepad', rd) };
  }
  for (const x of VS_SEATS.seats) if (!frame[x.controller]) frame[x.controller] = { connected: false };
  VS_SEATS = __VS_SEATK.step(VS_SEATS, frame);
  VS_READS = reads;
}
/** Call once a drawn frame has stepped: the taps it saw are spent. */
const endInputFrame = () => RT.latch.clear();

// a player's controls: their seat's controller through the versus scheme; an empty or away seat presses nothing
const NO_INPUT = Object.freeze({ x: 0, y: 0, b: 0, start: false, back: false });
function rawInput(i) {
  const s = __VS_SEATK.seat(VS_SEATS, i + 1);
  if (!s || s.away || !VS_READS[s.controller]) return NO_INPUT;
  const fam = s.controller === 'keyboard' ? 'keyboard' : 'gamepad', rd = VS_READS[s.controller];
  const on = (id) => __VS_CTL.held(__VS_BIND, id, fam, rd);
  const up = on('up'), down = on('down'), left = on('left'), right = on('right');
  const b = (on('light') ? BTN.L : 0) | (on('medium') ? BTN.M : 0) | (on('heavy') ? BTN.H : 0) | (on('special') ? BTN.S : 0) | (on('throw') ? BTN.T : 0);
  return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (up ? 1 : 0) - (down ? 1 : 0), b, start: on('start'), back: on('back') };
}
const seatOfPlayer = (i) => __VS_SEATK.seat(VS_SEATS, i + 1);

// menu edges for both players
const menuPrev = [{}, {}];
function menuInput() {
  pollSeats();
  const out = [];
  for (let i = 0; i < 2; i++) {
    const r = rawInput(i), kb = seatOfPlayer(i)?.controller === 'keyboard';
    const now = { up: r.y > 0, down: r.y < 0, left: r.x < 0, right: r.x > 0, ok: !!(r.b & BTN.L) || r.start || (kb && kbRead('Space')), back: !!(r.b & BTN.S) || r.back, pause: r.start || r.back };
    const edge = {};
    for (const k of Object.keys(now)) edge[k] = now[k] && !menuPrev[i][k];
    menuPrev[i] = now;
    out.push(edge);
  }
  return out;
}

// ── sound: a few synthesized blips (off with M) ───────────────────────────────────────────────────────────────

let vsAudio = null;
function blip(kind) {
  if (RT.muted) return;
  try {
    vsAudio = vsAudio || new (window.AudioContext || window.webkitAudioContext)();
    const t = vsAudio.currentTime;
    const o = vsAudio.createOscillator(), v = vsAudio.createGain();
    const spec = { hit: [180, 60, 0.18, 'square'], counter: [260, 80, 0.22, 'square'], block: [520, 380, 0.08, 'triangle'], throw: [120, 40, 0.3, 'sawtooth'], super: [220, 880, 0.5, 'sawtooth'], ko: [300, 40, 0.9, 'sawtooth'], menu: [660, 660, 0.05, 'square'], ok: [440, 880, 0.12, 'square'], fireball: [300, 500, 0.15, 'triangle'] }[kind];
    if (!spec) return;
    o.type = spec[3];
    o.frequency.setValueAtTime(spec[0], t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, spec[1]), t + spec[2]);
    v.gain.setValueAtTime(0.12, t);
    v.gain.exponentialRampToValueAtTime(0.001, t + spec[2]);
    o.connect(v).connect(vsAudio.destination);
    o.start(t); o.stop(t + spec[2] + 0.02);
  } catch (e) { /* no audio */ }
}

// ── a match ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * opts: { fighters: [compiled, compiled], names, colors, schemes, mode: versus | cpu | training | watch, level,
 *         rules, seed }
 */
function newMatch(opts) {
  const ctx = { fighters: opts.fighters };
  const schemes = opts.schemes.slice();
  if (opts.mode === 'cpu') schemes[1] = 'modern';
  if (opts.mode === 'watch') { schemes[0] = 'modern'; schemes[1] = 'modern'; }
  const s = newVersus(ctx, { schemes, rules: { ...(opts.rules || {}), ...(opts.mode === 'training' ? { intro: 30 } : {}) } });
  return {
    ctx, s, mode: opts.mode, level: opts.level ?? 1, mem: [newCpuMemory(), newCpuMemory()], sparks: [], banner: null,
    slow: 0, shake: 0, cam: 0, end: 0, colors: opts.colors, names: opts.names, lastMove: null, lag: [s.p[0].hp, s.p[1].hp],
    combo: [0, 0], comboT: [0, 0], seed: opts.seed >>> 0, idle: 0, flash: null, superFlash: 0, t: 0,
    // the swing trail's look (a fight kind's: versus-kinds.js), absent ⇒ no trail
    ...(opts.look && VS_TRAIL[opts.look] ? { look: opts.look, trails: [[], []] } : {}),
  };
}

function padFor(m, i) {
  const s = m.s;
  const cpu = (lv) => {
    const r = cpuPad(s, m.ctx, i, m.mem[i], { ...CPU_LEVELS[lv], seed: m.seed + i });
    m.mem[i] = r.mem;
    return r.pad;
  };
  if (m.mode === 'watch') return cpu('veteran');
  if (m.mode === 'cpu' && i === 1) return cpu(VS_LEVELS[m.level]);
  if (m.mode === 'training' && i === 1) {
    const me = s.p[1], o = s.p[0];
    const back = Math.sign(me.x - o.x) || 1;
    switch (VS_DUMMY[RT.dummy]) {
      case 'crouch': return { x: 0, y: -1, b: 0 };
      case 'block': {
        const om = o.mv ? m.ctx.fighters[0].moves[o.mv] : null;
        const low = om && om.guard === 'low';
        const shot = s.shots.some((t) => t.o === 0);
        return { x: (om || shot || o.y > 0) ? back : 0, y: low ? -1 : 0, b: 0 };
      }
      case 'jump': return { x: 0, y: (s.f % 60) < 2 ? 1 : 0, b: 0 };
      case 'cpu': return cpu('regular');
      default: return { x: 0, y: 0, b: 0 };
    }
  }
  const r = rawInput(i);
  return { x: r.x, y: r.y, b: r.b };
}

/** One frame of a match (presentation slow-motion after a KO is the caller's: it skips calls). `given` [pad1?, pad2?]:
 * a pad its caller read itself (a host with its own keys), else the match's own (the keyboard, the CPU, the dummy). */
function stepMatch(m, given = []) {
  const before = m.s;
  m.t++;
  m.s = stepVersus(before, [given[0] ?? padFor(m, 0), given[1] ?? padFor(m, 1)], m.ctx);
  const s = m.s;
  if (m.mode === 'training') {
    s.timer = s.rules.timer * 60;
    for (let i = 0; i < 2; i++) s.p[i].meter = 1000;
    const calm = s.p.every((p) => p.combo === 0 && (p.st === 'stand' || p.st === 'crouch' || p.st === 'walkF' || p.st === 'walkB'));
    m.idle = calm ? m.idle + 1 : 0;
    if (m.idle === 40) for (let i = 0; i < 2; i++) s.p[i].hp = m.ctx.fighters[i].hp;
    if (s.phase === 'ko') { s.phase = 'fight'; for (let i = 0; i < 2; i++) { s.p[i].ko = 0; s.p[i].hp = m.ctx.fighters[i].hp; } }
  }
  const p0 = s.p[0], b0 = before.p[0];
  if (p0.mv && p0.mf === 1 && (b0.mv !== p0.mv || b0.mf !== 0)) m.lastMove = m.ctx.fighters[0].moves[p0.mv];
  tickEffects(m);
  tickPoses(m);
  if (m.look) tickTrails(m);
  for (const e of s.events) onEvent(m, e);
  for (let i = 0; i < 2; i++) {
    if (s.p[1 - i].combo >= 2) { m.combo[i] = s.p[1 - i].combo; m.comboT[i] = 70; }
    if (m.comboT[i] > 0) m.comboT[i]--;
  }
  if (s.phase === 'matchEnd') m.end++;
}

/**
 * The overlay's clocks run on the match's steps, never the screen's frames: a banner, a toast, the super's dimming,
 * the shake, the sparks and the health bar's trailing red last as many steps at any refresh rate (and hold still
 * while the match is paused). Drawing only reads them.
 */
/**
 * The bodies drawn, one a step: each body's pose this step and its joints, eased in from the joints drawn before
 * whenever it changes state or move, or a state starts over (a second hit in a stun): over two steps into a move,
 * four into anything else, and more when the joints have far to go (no joint further in a step than BLEND_STEP of
 * the body's height: a held body flung into its fall swings its arms over, it does not jump). The JOINTS blend, not
 * the angles, so a body falling onto the floor travels down to it instead of jumping. A new round is a cut. Drawing
 * reads `drawnPose` (the pose, for its round-body channels, and the joints).
 */
const BLEND_STEP = 0.2;
function tickPoses(m) {
  m.drawn = m.drawn || [null, null];
  for (let i = 0; i < 2; i++) {
    const p = m.s.p[i], F = m.ctx.fighters[i];
    const pose = poseOf(p, F, m.t + i * 40, m.s.rules), J = rigJoints(F.body, pose);
    // (what it reacts to is part of the state: a second blow that throws it another way starts it over)
    const key = p.mv ? `mv:${p.mv}` : `st:${p.st}${p.rx ? `:${p.rx.k}${p.rx.h}` : ''}`;
    const d = m.drawn[i];
    // a new round is a cut (the bodies are set on their marks): drawn as they are, nothing eased in
    if (!d || d.round !== m.s.round) { m.drawn[i] = { key, sf: p.sf, round: m.s.round, from: J, k: 1, n: 1, pose, J }; continue; }
    if (key !== d.key || (!p.mv && p.sf < d.sf)) {
      d.from = d.J; d.k = 0; d.key = key; d.n = p.mv ? 2 : 4;
      if (!p.mv) {
        // the eased step's fastest is 1.5 times its average
        let far = 0;
        for (const k of Object.keys(J)) far = Math.max(far, Math.hypot(J[k][0] - d.from[k][0], J[k][1] - d.from[k][1]));
        d.n = Math.max(d.n, Math.ceil((1.5 * far) / (BLEND_STEP * F.body.height)));
      }
    }
    d.sf = p.sf;
    d.k = Math.min(1, d.k + 1 / d.n);
    const e = d.k * d.k * (3 - 2 * d.k);
    d.pose = pose;
    d.J = d.k >= 1 ? J : Object.fromEntries(Object.keys(J).map((k) => [k, [d.from[k][0] + (J[k][0] - d.from[k][0]) * e, d.from[k][1] + (J[k][1] - d.from[k][1]) * e]]));
  }
}
/** What to draw a body as: { pose, J } (its pose this step and its eased joints), or its state's own before a step. */
const drawnPose = (m, i) => {
  if (m.drawn?.[i]) return m.drawn[i];
  const F = m.ctx.fighters[i], pose = poseOf(m.s.p[i], F, m.t + i * 40, m.s.rules);
  return { pose, J: rigJoints(F.body, pose) };
};

/**
 * THE SWING TRAIL (a fight kind's look): an armed fighter's blade, kept a few steps while its tip sweeps fast in a move,
 * each sample the blade's butt and tip on the stage (mm); drawn by drawEffects in the look's way: cel flat hard bands by
 * age (newest light, the colour, a deep tone), sampled on twos; isekai an added glow fading, white at the cutting edge;
 * material a short faint sheen. Its colour is the fighter's.
 */
const VS_TRAIL = { isekai: { life: 10, fast: 30 }, cel: { life: 8, fast: 30, twos: true }, material: { life: 4, fast: 45 } };
function tickTrails(m) {
  const T = VS_TRAIL[m.look];
  for (let i = 0; i < 2; i++) {
    const p = m.s.p[i], F = m.ctx.fighters[i], L = F.weapon && m.drawn[i] ? weaponLine(m.drawn[i].J, F.weapon) : null, tr = m.trails[i];
    while (tr.length && m.t - tr[tr.length - 1].at > T.life) tr.pop();
    if (!L) continue;
    const w = (q) => [p.x + q[0] * p.face, p.y + q[1]], tip = w(L.tip), last = tr.lastTip;
    tr.lastTip = tip;
    if (!p.mv || !last || (T.twos && m.t % 2)) continue;
    if (Math.hypot(tip[0] - last[0], tip[1] - last[1]) * (T.twos ? 0.5 : 1) < T.fast) continue;
    if (!tr.length || m.t - tr[0].at > 2) tr.unshift({ b: w(L.butt), t: last, at: m.t - 1 });
    tr.unshift({ b: w(L.butt), t: tip, at: m.t });
  }
}

function tickEffects(m) {
  if (m.banner && m.banner.n > 0) m.banner.n--;
  if (m.flash && m.flash.n > 0) m.flash.n--;
  if (m.superFlash > 0) m.superFlash--;
  if (m.shake > 0) { m.shake *= 0.85; if (m.shake < 0.3) m.shake = 0; }
  for (const p of m.sparks) { p.x += p.vx; p.y += p.vy; p.life--; }
  m.sparks = m.sparks.filter((p) => p.life > 0);
  for (let i = 0; i < 2; i++) m.lag[i] += (m.s.p[i].hp - m.lag[i]) * (m.s.p[i].combo ? 0 : 0.08);
}

function onEvent(m, e) {
  const big = (t, sub, n) => { m.banner = { t, sub, n: n || 70, max: n || 70 }; };
  switch (e.t) {
    case 'round': big(m.s.round > 1 && m.s.wins[0] === m.s.rules.rounds - 1 && m.s.wins[1] === m.s.rules.rounds - 1 ? 'FINAL ROUND' : `ROUND ${e.n}`, null, 60); break;
    case 'fight': big('FIGHT!', null, 40); blip('ok'); break;
    case 'hit': case 'counter':
      spark(m, e.x, e.y, e.t === 'counter' ? '#ffd23a' : '#ffffff', e.dmg > 80 ? 14 : 9);
      blip(e.t); m.shake = Math.min(10, (e.dmg || 30) / 10);
      if (e.t === 'counter') m.flash = { text: 'COUNTER', p: e.p, n: 40 };
      break;
    case 'block': spark(m, e.x, e.y, '#7ac8ff', 6); blip('block'); break;
    case 'throw': spark(m, e.x, e.y, '#ffffff', 12); blip('throw'); m.shake = 8; break;
    case 'tech': spark(m, e.x, 1100, '#aaaaaa', 8); m.flash = { text: 'TECH', p: -1, n: 40 }; blip('block'); break;
    case 'clash': spark(m, e.x, e.y, '#ff9a3a', 10); blip('block'); break;
    case 'parry': spark(m, e.x, e.y, '#7ad2ff', 12); m.flash = { text: 'PARRY', p: e.p, n: 40 }; blip('block'); break;
    case 'burst': spark(m, e.x, e.y, '#ffffff', 18); m.flash = { text: 'BURST', p: e.p, n: 50 }; m.shake = 10; blip('super'); break;
    case 'reset': spark(m, e.x, e.y, m.colors[e.p], 16); m.flash = { text: 'RESET', p: e.p, n: 40 }; blip('super'); break;
    case 'bound': spark(m, e.x, e.y, '#ffffff', 14); m.shake = 9; blip('counter'); break;
    case 'crush': spark(m, e.x, e.y, '#ff5a3a', 14); m.flash = { text: 'GUARD CRUSH', p: e.p, n: 50 }; m.shake = 8; blip('counter'); break;
    case 'armor': spark(m, e.x, e.y, '#c8c8c8', 8); m.flash = { text: 'ARMOR', p: 1 - e.p, n: 30 }; blip('block'); break;
    case 'riposte': spark(m, e.x, e.y, '#ffd23a', 14); m.flash = { text: 'RIPOSTE', p: e.p, n: 40 }; m.shake = 8; blip('counter'); break;
    case 'super': m.superFlash = 40; blip('super'); break;
    // a lock super caught: the hit-combo's name over the fight, or the cutscene's cut (drawHud letterboxes it while it runs)
    case 'lock': m.flash = { text: e.kind === 'cutscene' ? 'CRITICAL' : `${e.hits}-HIT SUPER`, p: e.p, n: 50 }; m.shake = 8; blip('super'); break;
    case 'unlock': m.shake = 10; break;
    case 'special': if (m.ctx.fighters[e.p].moves[e.slot].projectile) blip('fireball'); break;
    case 'ko': big('K.O.', null, 120); m.slow = 70; blip('ko'); break;
    case 'time': big('TIME', null, 120); break;
    case 'roundEnd': case 'match': {
      const w = e.w;
      if (w === -1) big('DRAW', null, 90);
      else if (e.t === 'match') big(`${m.names[w].toUpperCase()} WINS`, m.mode === 'versus' ? `PLAYER ${w + 1}` : null, 150);
      else big(m.names[w].toUpperCase(), 'takes the round', 70);
      break;
    }
    default: break;
  }
}

function spark(m, x, y, color, n) {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + (m.s.f % 7);
    const sp = 18 + ((k * 37) % 23);
    m.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 16, color });
  }
}

/** The pose a body is in this frame: its move's, a reaction's (versus-react.js), or its state's. */
function poseOf(p, F, t, rules) {
  if (p.mv) {
    const mv = F.moves[p.mv];
    return mv.frames[Math.max(1, Math.min(p.mf, mv.total))].pose;
  }
  // the fighter's own guard, crouch and walk (its tradition's, versus-traditions.js), else the genre's
  const own = F.poses ?? POSES, guard = own.guard, crouch = own.crouch;
  const reacting = reactionPose(p, rules, own);
  if (reacting) return reacting;
  const wave = (k) => (Math.sin(t * k) + 1) / 2;
  switch (p.st) {
    case 'walkF': case 'walkB': {
      // the stride in the round: the hips swing with each step and the shoulders counter them, the side tilt rides
      // onto the stepping foot; walking in the chest opens further to the screen, backing off it closes up
      const w = wave(0.22), s = w * 2 - 1;
      return { ...lerpPose(own.walkA, own.walkB, w), sway: s * 7, twist: (p.st === 'walkF' ? 8 : -4) - s * 5, tilt: s * 3 };
    }
    case 'crouch': return crouch;
    case 'prejump': return POSES.prejump;
    case 'air': return POSES.jump;
    case 'land': return lerpPose(crouch, guard, Math.min(1, p.sf / Math.max(1, p.landing)));
    case 'dashF': return POSES.dash;
    case 'dashB': return POSES.backdash;
    // a sidestep (sidestep): the body turns side-on and steps off the line and back, in the round channels
    case 'side': { const k = Math.sin(Math.PI * Math.min(1, p.sf / ((rules && rules.sidestepFrames) || 16))); return { ...guard, twist: 38 * k, sway: 30 * k, tilt: -5 * k }; }
    case 'burst': return lerpPose(crouch, POSES.burst, Math.min(1, p.sf / 4));
    case 'win': return lerpPose(guard, POSES.win, Math.min(1, p.sf / 20));
    case 'lose': return lerpPose(guard, POSES.lose, Math.min(1, p.sf / 30));
    default: {
      // standing: breathing, the chest and the tilt swaying slowly about the stance; a tradition's rhythm on top (a
      // boxer's bounce on the balls of the feet, the ginga's rock from side to side)
      // (the bounce bends the knees: the body stands on its feet, so a dip is the legs folding under it)
      const r = F.rhythm ?? { bounce: 0, rock: 0 }, hip = guard.hip ?? [0, 0];
      const bob = r.bounce ? (1 - Math.abs(Math.sin(t * 0.16))) * 9 * r.bounce : 0, rock = Math.sin(t * 0.07) * r.rock;
      const knee = (leg) => [leg[0] + bob, leg[1] - bob, ...leg.slice(2)];
      return {
        ...guard, torso: (guard.torso ?? 0) + Math.sin(t * 0.08) * 2, hip: [hip[0] + rock * 60, hip[1]],
        ...(bob ? { legF: knee(guard.legF), legB: knee(guard.legB) } : {}),
        twist: Math.sin(t * 0.05) * 2 + rock * 14, sway: rock * 18, tilt: Math.sin(t * 0.08) * 1.5 - rock * 4,
      };
    }
  }
}

// ── the overlay ──────────────────────────────────────────────────────────────────────────────────────────────

const VS_FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
/** A fighter's weapon in 2D: the blade (and butt) as an inked stroke, at `sx(x)`, `sy(y)` (rig mm → px). */
function drawBlade(g, F, J, sx, sy, S) {
  const L = weaponLine(J, F.weapon);
  if (!L) return;
  const w = Math.max(3, F.weapon.width * 0.9 * S);
  const stroke = (color, width) => {
    g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round';
    g.beginPath(); g.moveTo(sx(L.butt[0]), sy(L.butt[1])); g.lineTo(sx(L.tip[0]), sy(L.tip[1])); g.stroke();
  };
  stroke('#000', w + 4);
  stroke(F.weapon.color, w);
}

function vsText(g, str, x, y, size, color, align = 'center', weight = 800) {
  g.font = `${weight} ${size}px ${VS_FONT}`;
  g.textAlign = align; g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(str, x, y);
}
function vsOutlined(g, str, x, y, size, color, align = 'center') {
  g.font = `900 ${size}px ${VS_FONT}`;
  g.textAlign = align; g.textBaseline = 'middle';
  g.lineWidth = Math.max(3, size / 9); g.strokeStyle = '#000'; g.lineJoin = 'round';
  g.strokeText(str, x, y);
  g.fillStyle = color; g.fillText(str, x, y);
}
function vsShade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function vsRgba(hex, k, a) {
  return vsShade(hex, k).replace('rgb(', 'rgba(').replace(')', `,${a.toFixed(3)})`);
}
/** The swing trails (tickTrails) in the fight kind's look. */
function drawTrails(g, m, toScreen) {
  const T = VS_TRAIL[m.look];
  for (let i = 0; i < 2; i++) {
    const tr = m.trails[i], c = m.colors[i];
    for (let k = 0; k + 1 < tr.length; k++) {
      const a = tr[k], b = tr[k + 1], u = Math.min(1, (m.t - a.at) / T.life);
      const q = [a.b, a.t, b.t, b.b].map((v) => toScreen(v[0], v[1]));
      g.beginPath(); g.moveTo(q[0][0], q[0][1]); for (let j = 1; j < 4; j++) g.lineTo(q[j][0], q[j][1]); g.closePath();
      if (m.look === 'cel') g.fillStyle = u < 0.34 ? vsShade(c, 0.6) : u < 0.67 ? vsShade(c, 0) : vsShade(c, -0.45);
      else if (m.look === 'isekai') { g.globalCompositeOperation = 'lighter'; g.fillStyle = vsRgba(c, 0.2, 0.75 * (1 - u) ** 1.5); }
      else g.fillStyle = vsRgba(c, 0.6, 0.3 * (1 - u));
      g.fill();
      if (m.look === 'isekai') {
        g.strokeStyle = `rgba(255,255,255,${(0.9 * (1 - u)).toFixed(3)})`; g.lineWidth = 2;
        g.beginPath(); g.moveTo(q[1][0], q[1][1]); g.lineTo(q[2][0], q[2][1]); g.stroke();
        g.globalCompositeOperation = 'source-over';
      }
    }
  }
}

/** Sparks, fireballs and (B) the boxes, at `toScreen(xmm, ymm)` with `S` px per mm. */
function drawEffects(g, m, toScreen, S) {
  const s = m.s;
  for (const t of s.shots) {
    const [x, y] = toScreen(t.x, t.y);
    const r = (t.h / 2) * S;
    const glow = g.createRadialGradient(x, y, r * 0.1, x, y, r * 1.3);
    glow.addColorStop(0, '#fff'); glow.addColorStop(0.35, m.colors[t.o]); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(x, y, r * 1.3, 0, Math.PI * 2); g.fill();
  }
  if (m.look) drawTrails(g, m, toScreen);
  for (const p of m.sparks) {
    const [x, y] = toScreen(p.x, p.y);
    g.strokeStyle = p.color; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - p.vx * S * 2, y + p.vy * S * 2); g.stroke();
  }
  if (!RT.showBoxes) return;
  const rect = (b, stroke, fill) => {
    const [x0, y1] = toScreen(b[0], b[3]), [x1, y0] = toScreen(b[2], b[1]);
    g.fillStyle = fill; g.fillRect(x0, y1, x1 - x0, y0 - y1);
    g.strokeStyle = stroke; g.lineWidth = 1.5; g.strokeRect(x0, y1, x1 - x0, y0 - y1);
  };
  for (let i = 0; i < 2; i++) {
    const p = s.p[i], F = m.ctx.fighters[i];
    rect(pushBox(p, F), 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0.05)');
    for (const b of hurtBoxes(p, F)) rect(b, 'rgba(80,200,255,0.9)', 'rgba(80,200,255,0.15)');
    const hb = hitBox(p, F);
    if (hb) rect(hb, 'rgba(255,60,60,1)', 'rgba(255,60,60,0.3)');
  }
  for (const t of s.shots) rect([t.x - t.w / 2, t.y - t.h / 2, t.x + t.w / 2, t.y + t.h / 2], 'rgba(255,60,60,1)', 'rgba(255,60,60,0.15)');
}

/** Health, meter, timer, rounds, combo, banners and the training panel. */
function drawHud(g, W, H, m) {
  const s = m.s;
  const barW = Math.min(W * 0.38, 520), barH = 22, top = 24, gap = 70;
  if (m.superFlash > 0) { g.fillStyle = `rgba(0,0,0,${0.5 * Math.min(1, m.superFlash / 10)})`; g.fillRect(0, 0, W, H); }
  // a cutscene super: the fight cut away while its script runs, the picture darkened and letterboxed (the caller's
  // camera may close in too: `m.s.lock`)
  if (m.s.lock?.kind === 'cutscene') {
    const bar = Math.round(H * 0.11);
    g.fillStyle = 'rgba(10,0,20,0.35)'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar);
    return;
  }
  for (let i = 0; i < 2; i++) {
    const F = m.ctx.fighters[i];
    const frac = s.p[i].hp / F.hp;
    const lagFrac = Math.max(frac, m.lag[i] / F.hp);
    const x0 = i === 0 ? W / 2 - gap / 2 - barW : W / 2 + gap / 2;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x0 - 3, top - 3, barW + 6, barH + 6);
    g.fillStyle = '#5a1010'; g.fillRect(x0, top, barW, barH);
    const fillFrom = (f) => (i === 0 ? x0 + barW * (1 - f) : x0);
    g.fillStyle = '#d23a2a'; g.fillRect(fillFrom(lagFrac), top, barW * lagFrac, barH);
    g.fillStyle = frac < 0.25 ? '#ff8a3a' : '#ffd23a'; g.fillRect(fillFrom(frac), top, barW * frac, barH);
    if (s.p[i].gd !== undefined) {
      const gf = s.p[i].gd / s.rules.guardMax;
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x0, top + barH + 1, barW, 5);
      g.fillStyle = gf < 0.3 ? '#ff5a3a' : '#9ad2ff'; g.fillRect(fillFrom(gf), top + barH + 1, barW * gf, 5);
    }
    vsText(g, m.names[i].toUpperCase(), i === 0 ? x0 : x0 + barW, top + barH + 16, 16, '#fff', i === 0 ? 'left' : 'right');
    vsText(g, s.p[i].scheme.toUpperCase(), i === 0 ? x0 + barW : x0, top + barH + 16, 11, 'rgba(255,255,255,0.6)', i === 0 ? 'right' : 'left', 600);
    for (let k = 0; k < s.rules.rounds; k++) {
      const px = i === 0 ? W / 2 - gap / 2 - 14 - k * 18 : W / 2 + gap / 2 + 14 + k * 18;
      g.fillStyle = k < s.wins[i] ? '#ffd23a' : 'rgba(255,255,255,0.2)';
      g.beginPath(); g.arc(px, top + barH + 38, 6, 0, Math.PI * 2); g.fill();
    }
    const mW = Math.min(W * 0.3, 360);
    const mx = i === 0 ? 24 : W - 24 - mW, my = H - 34;
    const mf = s.p[i].meter / 1000;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(mx - 2, my - 2, mW + 4, 16);
    g.fillStyle = mf >= 1 ? (s.f % 20 < 10 ? '#7affd2' : '#3ad2ff') : '#2a7ad2';
    g.fillRect(i === 0 ? mx : mx + mW * (1 - mf), my, mW * mf, 12);
    if (mf >= 1) vsText(g, 'SUPER', i === 0 ? mx + mW + 10 : mx - 10, my + 6, 13, '#7affd2', i === 0 ? 'left' : 'right');
    if (m.comboT[i] > 0) vsOutlined(g, `${m.combo[i]} HITS`, i === 0 ? 30 : W - 30, H * 0.36, 34, '#ffd23a', i === 0 ? 'left' : 'right');
  }
  const secs = Math.ceil(s.timer / 60);
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(W / 2 - 30, top - 6, 60, 44);
  vsOutlined(g, m.mode === 'training' ? '∞' : String(secs).padStart(2, '0'), W / 2, top + 16, 32, secs <= 10 ? '#ff6a3a' : '#fff');
  if (m.flash && m.flash.n > 0) {
    const fx = m.flash.p === 0 ? W * 0.18 : m.flash.p === 1 ? W * 0.82 : W / 2;
    vsOutlined(g, m.flash.text, fx, H * 0.28, 28, '#ffd23a');
  }
  if (m.banner && m.banner.n > 0) {
    const b = m.banner;
    const k = Math.min(1, (b.max - b.n) / 8);
    vsOutlined(g, b.t, W / 2, H * 0.4, Math.round(Math.min(W / 9, 110) * (0.6 + 0.4 * k)), '#fff');
    if (b.sub) vsOutlined(g, b.sub, W / 2, H * 0.4 + Math.min(W / 9, 110) * 0.7, 26, '#ffd23a');
  }
  if (m.mode === 'training') drawTraining(g, m);
}

function drawTraining(g, m) {
  const mv = m.lastMove;
  const x = 24, y = 120;
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x - 10, y - 18, 300, mv ? 130 : 60);
  vsText(g, `dummy: ${VS_DUMMY[RT.dummy]}  (R)`, x, y, 14, '#fff', 'left', 600);
  vsText(g, `boxes: ${RT.showBoxes ? 'on' : 'off'}  (B)`, x, y + 20, 14, '#fff', 'left', 600);
  if (!mv) return;
  const adv = (v) => (v === null || v === undefined ? '—' : v > 0 ? `+${v}` : `${v}`);
  vsText(g, `${mv.slot}  ${mv.id}${mv.strength ? ' ' + mv.strength : ''}`, x, y + 48, 15, '#ffd23a', 'left');
  vsText(g, `startup ${mv.startup}  active ${mv.active}  recovery ${mv.recovery}`, x, y + 70, 14, '#fff', 'left', 600);
  vsText(g, `on hit ${adv(mv.adv.hit)}  on block ${adv(mv.adv.block)}  dmg ${mv.damage}`, x, y + 90, 14, '#fff', 'left', 600);
}
