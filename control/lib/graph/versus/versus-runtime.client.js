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

const VS_KEYS = [
  { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], L: ['KeyJ'], M: ['KeyK'], H: ['KeyL'], S: ['KeyU'], T: ['KeyI'], start: ['Enter'], back: ['Escape'] },
  { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], L: ['Numpad1', 'Comma'], M: ['Numpad2', 'Period'], H: ['Numpad3', 'Slash'], S: ['Numpad4', 'Semicolon'], T: ['Numpad5', 'Quote'], start: ['NumpadEnter', 'Backslash'], back: ['Backspace'] },
];
const anyHeld = (list) => list.some((k) => RT.held.has(k) || RT.latch.has(k));
/** Call once a drawn frame has stepped: the taps it saw are spent. */
const endInputFrame = () => RT.latch.clear();

function rawInput(i) {
  const K = VS_KEYS[i];
  let up = anyHeld(K.up), down = anyHeld(K.down), left = anyHeld(K.left), right = anyHeld(K.right);
  let b = (anyHeld(K.L) ? BTN.L : 0) | (anyHeld(K.M) ? BTN.M : 0) | (anyHeld(K.H) ? BTN.H : 0) | (anyHeld(K.S) ? BTN.S : 0) | (anyHeld(K.T) ? BTN.T : 0);
  let start = anyHeld(K.start), back = anyHeld(K.back);
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const gp = pads[i];
  if (gp) {
    const btn = (n) => !!(gp.buttons[n] && gp.buttons[n].pressed);
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    up = up || btn(12) || ay < -0.5; down = down || btn(13) || ay > 0.5;
    left = left || btn(14) || ax < -0.5; right = right || btn(15) || ax > 0.5;
    b |= (btn(0) ? BTN.L : 0) | (btn(2) ? BTN.M : 0) | (btn(3) ? BTN.H : 0) | (btn(1) ? BTN.S : 0) | (btn(5) || btn(4) ? BTN.T : 0);
    start = start || btn(9); back = back || btn(8);
  }
  return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (up ? 1 : 0) - (down ? 1 : 0), b, start, back };
}

// menu edges for both players
const menuPrev = [{}, {}];
function menuInput() {
  const out = [];
  for (let i = 0; i < 2; i++) {
    const r = rawInput(i);
    const now = { up: r.y > 0, down: r.y < 0, left: r.x < 0, right: r.x > 0, ok: !!(r.b & BTN.L) || r.start || (i === 0 && (RT.held.has('Space') || RT.latch.has('Space'))), back: !!(r.b & BTN.S) || r.back, pause: r.start || r.back };
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

/** One frame of a match (presentation slow-motion after a KO is the caller's: it skips calls). */
function stepMatch(m) {
  const before = m.s;
  m.t++;
  m.s = stepVersus(before, [padFor(m, 0), padFor(m, 1)], m.ctx);
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
 * four into anything else. The JOINTS blend, not the angles, so a body falling onto the floor travels down to it
 * instead of jumping. Drawing reads `drawnPose` (the pose, for its round-body channels, and the joints).
 */
function tickPoses(m) {
  m.drawn = m.drawn || [null, null];
  for (let i = 0; i < 2; i++) {
    const p = m.s.p[i], F = m.ctx.fighters[i];
    const pose = poseOf(p, F, m.t + i * 40, m.s.rules), J = rigJoints(F.body, pose);
    const key = p.mv ? `mv:${p.mv}` : `st:${p.st}`;
    const d = m.drawn[i];
    if (!d) { m.drawn[i] = { key, sf: p.sf, from: J, k: 1, n: 1, pose, J }; continue; }
    if (key !== d.key || (!p.mv && p.sf < d.sf)) { d.from = d.J; d.k = 0; d.key = key; d.n = p.mv ? 2 : 4; }
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
    case 'crush': spark(m, e.x, e.y, '#ff5a3a', 14); m.flash = { text: 'GUARD CRUSH', p: e.p, n: 50 }; m.shake = 8; blip('counter'); break;
    case 'armor': spark(m, e.x, e.y, '#c8c8c8', 8); m.flash = { text: 'ARMOR', p: 1 - e.p, n: 30 }; blip('block'); break;
    case 'riposte': spark(m, e.x, e.y, '#ffd23a', 14); m.flash = { text: 'RIPOSTE', p: e.p, n: 40 }; m.shake = 8; blip('counter'); break;
    case 'super': m.superFlash = 40; blip('super'); break;
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
  const reacting = reactionPose(p, rules);
  if (reacting) return reacting;
  const wave = (k) => (Math.sin(t * k) + 1) / 2;
  switch (p.st) {
    case 'walkF': case 'walkB': {
      // the stride in the round: the hips swing with each step and the shoulders counter them, the side tilt rides
      // onto the stepping foot; walking in the chest opens further to the screen, backing off it closes up
      const w = wave(0.22), s = w * 2 - 1;
      return { ...lerpPose(POSES.walkA, POSES.walkB, w), sway: s * 7, twist: (p.st === 'walkF' ? 8 : -4) - s * 5, tilt: s * 3 };
    }
    case 'crouch': return POSES.crouch;
    case 'prejump': return POSES.prejump;
    case 'air': return POSES.jump;
    case 'land': return lerpPose(POSES.crouch, POSES.guard, Math.min(1, p.sf / Math.max(1, p.landing)));
    case 'dashF': return POSES.dash;
    case 'dashB': return POSES.backdash;
    case 'burst': return lerpPose(POSES.crouch, POSES.burst, Math.min(1, p.sf / 4));
    case 'win': return lerpPose(POSES.guard, POSES.win, Math.min(1, p.sf / 20));
    case 'lose': return lerpPose(POSES.guard, POSES.lose, Math.min(1, p.sf / 30));
    // standing: breathing, the chest and the tilt swaying slowly about the stance
    default: return { ...POSES.guard, torso: POSES.guard.torso + Math.sin(t * 0.08) * 2, twist: Math.sin(t * 0.05) * 2, tilt: Math.sin(t * 0.08) * 1.5 };
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
