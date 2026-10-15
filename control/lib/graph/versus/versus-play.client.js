/**
 * versus play — the browser shell around the fight (inlined as text by versus-page.js, never imported).
 *
 * The pure modules (rig, library, compile, input, core, cpu) are concatenated ahead of this script, and `VERSUS`
 * (the game's roster recipes, stages and title) is injected; the page compiles the fighters from their recipes.
 * Screens: title → mode select → character select (each player picks a fighter and a scheme) → stage select →
 * the fight (rounds, KO, time) → the result (rematch, character select, mode select; against the CPU, a loss
 * offers a continue). Keyboard split for two players, and up to two gamepads. The sim steps at a fixed 60 Hz;
 * everything here only draws it.
 */

/* global VERSUS, compileFighter, newVersus, stepVersus, cpuPad, newCpuMemory, CPU_LEVELS, rigJoints, POSES,
   lerpPose, hurtBoxes, hitBox, pushBox, BTN, SCHEMES */

const cv = document.getElementById('versus');
const g = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function fit() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
}
window.addEventListener('resize', fit);
fit();

const ROSTER = VERSUS.roster.map((r) => ({ ...r, F: compileFighter(r.recipe) }));
const STAGES = VERSUS.stages;
const MODES = [
  { id: 'versus', name: 'Versus', says: 'two players, one keyboard or two pads' },
  { id: 'cpu', name: 'Versus CPU', says: 'you against the machine' },
  { id: 'training', name: 'Training', says: 'a dummy, the boxes, the frame data' },
  { id: 'watch', name: 'CPU vs CPU', says: 'watch the roster fight itself' },
];
const LEVELS = ['novice', 'regular', 'veteran', 'ace'];
const DUMMY = ['stand', 'crouch', 'block', 'jump', 'cpu'];

// ── input ────────────────────────────────────────────────────────────────────────────────────────────────────

const held = new Set();
window.addEventListener('keydown', (e) => {
  held.add(e.code);
  if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  if (e.code === 'KeyB') showBoxes = !showBoxes;
  if (e.code === 'KeyR' && game.mode === 'training') dummy = (dummy + 1) % DUMMY.length;
  if (e.code === 'KeyM') muted = !muted;
});
window.addEventListener('keyup', (e) => held.delete(e.code));
window.addEventListener('blur', () => held.clear());

const KEYS = [
  { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], L: ['KeyJ'], M: ['KeyK'], H: ['KeyL'], S: ['KeyU'], T: ['KeyI'], start: ['Enter'], back: ['Escape'] },
  { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], L: ['Numpad1', 'Comma'], M: ['Numpad2', 'Period'], H: ['Numpad3', 'Slash'], S: ['Numpad4', 'Semicolon'], T: ['Numpad5', 'Quote'], start: ['NumpadEnter', 'Backslash'], back: ['Backspace'] },
];
const anyKey = (list) => list.some((k) => held.has(k));

function rawInput(i) {
  const K = KEYS[i];
  let up = anyKey(K.up), down = anyKey(K.down), left = anyKey(K.left), right = anyKey(K.right);
  let b = (anyKey(K.L) ? BTN.L : 0) | (anyKey(K.M) ? BTN.M : 0) | (anyKey(K.H) ? BTN.H : 0) | (anyKey(K.S) ? BTN.S : 0) | (anyKey(K.T) ? BTN.T : 0);
  let start = anyKey(K.start), back = anyKey(K.back);
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
    const now = { up: r.y > 0, down: r.y < 0, left: r.x < 0, right: r.x > 0, ok: !!(r.b & BTN.L) || r.start || (i === 0 && held.has('Space')), back: !!(r.b & BTN.S) || r.back, pause: r.start || r.back };
    const edge = {};
    for (const k of Object.keys(now)) edge[k] = now[k] && !menuPrev[i][k];
    menuPrev[i] = now;
    out.push(edge);
  }
  return out;
}

// ── sound: a few synthesized blips (off with M) ───────────────────────────────────────────────────────────────

let audio = null, muted = false;
function blip(kind) {
  if (muted) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    const o = audio.createOscillator(), v = audio.createGain();
    const spec = { hit: [180, 60, 0.18, 'square'], counter: [260, 80, 0.22, 'square'], block: [520, 380, 0.08, 'triangle'], throw: [120, 40, 0.3, 'sawtooth'], super: [220, 880, 0.5, 'sawtooth'], ko: [300, 40, 0.9, 'sawtooth'], menu: [660, 660, 0.05, 'square'], ok: [440, 880, 0.12, 'square'], fireball: [300, 500, 0.15, 'triangle'] }[kind];
    if (!spec) return;
    o.type = spec[3];
    o.frequency.setValueAtTime(spec[0], t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, spec[1]), t + spec[2]);
    v.gain.setValueAtTime(0.12, t);
    v.gain.exponentialRampToValueAtTime(0.001, t + spec[2]);
    o.connect(v).connect(audio.destination);
    o.start(t); o.stop(t + spec[2] + 0.02);
  } catch (e) { /* no audio */ }
}

// ── game state ───────────────────────────────────────────────────────────────────────────────────────────────

const game = {
  screen: 'title', t: 0, mode: 'versus', modeIx: 0, level: 1,
  pick: [{ ix: 0, scheme: 0, locked: false }, { ix: 1, scheme: 0, locked: false }],
  stageIx: 0, pauseIx: 0, resultIx: 0, cont: 0,
};
let showBoxes = false, dummy = 0;
let match = null; // { ctx, s, mem, banner, sparks, slow, shake, cam, end, lastMove }

function startMatch() {
  const a = ROSTER[game.pick[0].ix], b = ROSTER[game.pick[1].ix];
  const ctx = { fighters: [a.F, b.F] };
  const schemes = game.pick.map((p) => SCHEMES[p.scheme]);
  if (game.mode === 'cpu') schemes[1] = 'modern';
  if (game.mode === 'watch') { schemes[0] = 'modern'; schemes[1] = 'modern'; }
  const s = newVersus(ctx, { schemes, rules: { ...(VERSUS.rules || {}), ...(game.mode === 'training' ? { intro: 30 } : {}) } });
  match = {
    ctx, s, mem: [newCpuMemory(), newCpuMemory()], sparks: [], banner: null, slow: 0, shake: 0, cam: 0, end: 0,
    colors: [a.color, a.id === b.id ? '#e8e8e8' : b.color], names: [a.name, b.name], lastMove: null, lag: [s.p[0].hp, s.p[1].hp],
    combo: [0, 0], comboT: [0, 0], seed: (game.t * 2654435761) >>> 0, idle: 0,
  };
  game.screen = 'fight';
}

function padFor(i) {
  const s = match.s;
  const cpu = (lv) => {
    const r = cpuPad(s, match.ctx, i, match.mem[i], { ...CPU_LEVELS[lv], seed: match.seed + i });
    match.mem[i] = r.mem;
    return r.pad;
  };
  if (game.mode === 'watch') return cpu('veteran');
  if (game.mode === 'cpu' && i === 1) return cpu(LEVELS[game.level]);
  if (game.mode === 'training' && i === 1) {
    const me = s.p[1], o = s.p[0];
    const back = Math.sign(me.x - o.x) || 1;
    switch (DUMMY[dummy]) {
      case 'crouch': return { x: 0, y: -1, b: 0 };
      case 'block': {
        const om = o.mv ? match.ctx.fighters[0].moves[o.mv] : null;
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

function stepMatch() {
  const before = match.s;
  const pads = [padFor(0), padFor(1)];
  match.s = stepVersus(before, pads, match.ctx);
  const s = match.s;
  if (game.mode === 'training') {
    s.timer = s.rules.timer * 60;
    for (let i = 0; i < 2; i++) s.p[i].meter = 1000;
    const calm = s.p.every((p) => p.combo === 0 && (p.st === 'stand' || p.st === 'crouch' || p.st === 'walkF' || p.st === 'walkB'));
    match.idle = calm ? match.idle + 1 : 0;
    if (match.idle === 40) for (let i = 0; i < 2; i++) s.p[i].hp = match.ctx.fighters[i].hp;
    if (s.phase === 'ko') { s.phase = 'fight'; for (let i = 0; i < 2; i++) { s.p[i].ko = 0; s.p[i].hp = match.ctx.fighters[i].hp; } }
  }
  for (let i = 0; i < 2; i++) {
    const p = s.p[i];
    if (p.mv && p.mf === 1 && (!before.p[i].mv || before.p[i].mf !== 0 || before.p[i].mv !== p.mv) && i === 0) match.lastMove = match.ctx.fighters[0].moves[p.mv];
  }
  for (const e of s.events) onEvent(e);
  for (let i = 0; i < 2; i++) {
    if (s.p[1 - i].combo >= 2) { match.combo[i] = s.p[1 - i].combo; match.comboT[i] = 70; }
    if (match.comboT[i] > 0) match.comboT[i]--;
  }
  if (s.phase === 'matchEnd') {
    match.end++;
    if (match.end === 150) {
      const lost = game.mode === 'cpu' && s.winner !== 0;
      game.screen = lost ? 'continue' : 'result';
      game.cont = 10 * 60; game.resultIx = 0;
    }
  }
}

function onEvent(e) {
  const m = match;
  const big = (t, sub, n) => { m.banner = { t, sub, n: n || 70, max: n || 70 }; };
  switch (e.t) {
    case 'round': big(m.s.round === m.s.rules.rounds * 2 - 1 && m.s.wins[0] === m.s.wins[1] && m.s.round > 1 ? 'FINAL ROUND' : `ROUND ${e.n}`, null, 60); break;
    case 'fight': big('FIGHT!', null, 40); blip('ok'); break;
    case 'hit': case 'counter':
      spark(e.x, e.y, e.t === 'counter' ? '#ffd23a' : '#ffffff', e.dmg > 80 ? 14 : 9);
      blip(e.t); m.shake = Math.min(10, (e.dmg || 30) / 10);
      if (e.t === 'counter') m.flash = { text: 'COUNTER', p: e.p, n: 40 };
      break;
    case 'block': spark(e.x, e.y, '#7ac8ff', 6); blip('block'); break;
    case 'throw': spark(e.x, e.y, '#ffffff', 12); blip('throw'); m.shake = 8; break;
    case 'tech': spark(e.x, 1100, '#aaaaaa', 8); m.flash = { text: 'TECH', p: -1, n: 40 }; blip('block'); break;
    case 'clash': spark(e.x, e.y, '#ff9a3a', 10); blip('block'); break;
    case 'super': m.superFlash = 40; m.superBy = e.p; blip('super'); break;
    case 'special': if (/neutral/.test(e.slot) && m.ctx.fighters[e.p].moves[e.slot].projectile) blip('fireball'); break;
    case 'ko': big('K.O.', null, 120); m.slow = 70; blip('ko'); break;
    case 'time': big('TIME', null, 120); break;
    case 'roundEnd': case 'match': {
      const w = e.w;
      if (w === -1) big('DRAW', null, 90);
      else if (e.t === 'match') big(`${m.names[w].toUpperCase()} WINS`, game.mode === 'versus' ? `PLAYER ${w + 1}` : null, 150);
      else big(`${m.names[w].toUpperCase()}`, 'takes the round', 70);
      break;
    }
    default: break;
  }
}

function spark(x, y, color, n) {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + (match.s.f % 7);
    const sp = 18 + ((k * 37) % 23);
    match.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 16, color });
  }
}

// ── screens ──────────────────────────────────────────────────────────────────────────────────────────────────

function tickMenus(inp) {
  const any = (k) => inp[0][k] || inp[1][k];
  switch (game.screen) {
    case 'title':
      if (any('ok')) { game.screen = 'mode'; blip('ok'); }
      break;
    case 'mode':
      if (any('up')) { game.modeIx = (game.modeIx + MODES.length - 1) % MODES.length; blip('menu'); }
      if (any('down')) { game.modeIx = (game.modeIx + 1) % MODES.length; blip('menu'); }
      if (MODES[game.modeIx].id === 'cpu') {
        if (any('left')) game.level = (game.level + LEVELS.length - 1) % LEVELS.length;
        if (any('right')) game.level = (game.level + 1) % LEVELS.length;
      }
      if (any('ok')) {
        game.mode = MODES[game.modeIx].id; game.screen = 'select'; blip('ok');
        game.pick[0].locked = false; game.pick[1].locked = false;
      }
      if (any('back')) game.screen = 'title';
      break;
    case 'select': {
      // versus: each player picks their own side; any other mode: player 1 picks both, left then right
      for (let i = 0; i < 2; i++) {
        const P = game.pick[i];
        if (P.locked) continue;
        const ctrl = game.mode === 'versus' ? inp[i] : (i === 0 || game.pick[0].locked ? inp[0] : null);
        if (!ctrl) continue;
        if (ctrl.left) { P.ix = (P.ix + ROSTER.length - 1) % ROSTER.length; blip('menu'); }
        if (ctrl.right) { P.ix = (P.ix + 1) % ROSTER.length; blip('menu'); }
        if (ctrl.up) P.scheme = (P.scheme + SCHEMES.length - 1) % SCHEMES.length;
        if (ctrl.down) P.scheme = (P.scheme + 1) % SCHEMES.length;
        if (ctrl.ok) { P.locked = true; blip('ok'); if (game.mode !== 'versus') break; }
      }
      if (inp[0].back || inp[1].back) {
        const last = game.pick[1].locked ? 1 : game.pick[0].locked ? 0 : -1;
        if (last >= 0) game.pick[last].locked = false; else game.screen = 'mode';
      }
      if (game.pick[0].locked && game.pick[1].locked) game.screen = 'stage';
      break;
    }
    case 'stage':
      if (any('left')) { game.stageIx = (game.stageIx + STAGES.length - 1) % STAGES.length; blip('menu'); }
      if (any('right')) { game.stageIx = (game.stageIx + 1) % STAGES.length; blip('menu'); }
      if (any('ok')) { blip('ok'); startMatch(); }
      if (any('back')) { game.pick[1].locked = false; game.screen = 'select'; }
      break;
    case 'pause': {
      const items = ['Resume', 'Character select', 'Mode select'];
      if (any('up')) game.pauseIx = (game.pauseIx + items.length - 1) % items.length;
      if (any('down')) game.pauseIx = (game.pauseIx + 1) % items.length;
      if (any('ok')) {
        if (game.pauseIx === 0) game.screen = 'fight';
        if (game.pauseIx === 1) { game.screen = 'select'; game.pick[0].locked = false; game.pick[1].locked = false; }
        if (game.pauseIx === 2) game.screen = 'mode';
      }
      break;
    }
    case 'result': {
      const items = ['Rematch', 'Character select', 'Mode select'];
      if (any('up')) game.resultIx = (game.resultIx + items.length - 1) % items.length;
      if (any('down')) game.resultIx = (game.resultIx + 1) % items.length;
      if (any('ok')) {
        blip('ok');
        if (game.resultIx === 0) startMatch();
        if (game.resultIx === 1) { game.screen = 'select'; game.pick[0].locked = false; game.pick[1].locked = false; }
        if (game.resultIx === 2) game.screen = 'mode';
      }
      break;
    }
    case 'continue':
      game.cont--;
      if (any('ok')) { blip('ok'); startMatch(); }
      if (game.cont <= 0 || any('back')) game.screen = 'title';
      break;
    default: break;
  }
}

// ── drawing ──────────────────────────────────────────────────────────────────────────────────────────────────

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
function text(str, x, y, size, color, align = 'center', weight = 800) {
  g.font = `${weight} ${size}px ${FONT}`;
  g.textAlign = align; g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(str, x, y);
}
function outlined(str, x, y, size, color, align = 'center') {
  g.font = `900 ${size}px ${FONT}`;
  g.textAlign = align; g.textBaseline = 'middle';
  g.lineWidth = Math.max(3, size / 9); g.strokeStyle = '#000'; g.lineJoin = 'round';
  g.strokeText(str, x, y);
  g.fillStyle = color; g.fillText(str, x, y);
}
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

/** The pose a body is in this frame. */
function poseOf(p, F, t) {
  if (p.mv) {
    const m = F.moves[p.mv];
    return m.frames[Math.max(1, Math.min(p.mf, m.total))].pose;
  }
  const wave = (k) => (Math.sin(t * k) + 1) / 2;
  switch (p.st) {
    case 'walkF': case 'walkB': return lerpPose(POSES.walkA, POSES.walkB, wave(0.22));
    case 'crouch': return POSES.crouch;
    case 'prejump': return POSES.prejump;
    case 'air': return POSES.jump;
    case 'land': return lerpPose(POSES.crouch, POSES.guard, Math.min(1, p.sf / Math.max(1, p.landing)));
    case 'dashF': return POSES.dash;
    case 'dashB': case 'tech': return POSES.backdash;
    case 'hit': return p.low ? POSES.hitCrouch : (p.sf % 2 ? POSES.hitHigh : POSES.hitLow);
    case 'block': return p.low ? POSES.blockLow : POSES.blockHigh;
    case 'fall': return POSES.fall;
    case 'ko': return p.y > 0 ? POSES.fall : POSES.down;
    case 'down': return POSES.down;
    case 'rise': return lerpPose(POSES.down, POSES.rise, Math.min(1, p.sf / 10));
    case 'thrown': return POSES.thrown;
    case 'win': return lerpPose(POSES.guard, POSES.win, Math.min(1, p.sf / 20));
    case 'lose': return lerpPose(POSES.guard, POSES.lose, Math.min(1, p.sf / 30));
    default: {
      const pose = { ...POSES.guard };
      pose.torso = POSES.guard.torso + Math.sin(t * 0.08) * 2;
      return pose;
    }
  }
}

const BONES = [
  ['shoulder', 'elbowB'], ['elbowB', 'fistB'], ['pelvis', 'kneeB'], ['kneeB', 'ankleB'], ['ankleB', 'toeB'],
  ['pelvis', 'neck'],
  ['pelvis', 'kneeF'], ['kneeF', 'ankleF'], ['ankleF', 'toeF'], ['shoulder', 'elbowF'], ['elbowF', 'fistF'],
];

function drawFighter(p, F, color, view, t, x0) {
  const pose = poseOf(p, F, t);
  const J = rigJoints(F.body, pose);
  const S = view.scale;
  const sx = (x) => view.cx + (p.x + x * p.face - view.camX) * S;
  const sy = (y) => view.ground - (p.y + y) * S;
  // a shadow on the floor
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath();
  g.ellipse(view.cx + (p.x - view.camX) * S, view.ground + 4, F.body.bodyR * 1.6 * S, 7 * Math.max(0.5, 1 - p.y / 1500), 0, 0, Math.PI * 2);
  g.fill();
  g.lineCap = 'round'; g.lineJoin = 'round';
  const lw = Math.max(4, F.body.limbR * 2 * S);
  for (const [a, b] of BONES) {
    const back = a.endsWith('B') || b.endsWith('B');
    const trunk = a === 'pelvis' && b === 'neck';
    g.strokeStyle = '#000';
    g.lineWidth = (trunk ? lw * 1.7 : lw) + 4;
    g.beginPath(); g.moveTo(sx(J[a][0]), sy(J[a][1])); g.lineTo(sx(J[b][0]), sy(J[b][1])); g.stroke();
    g.strokeStyle = back ? shade(color, -0.45) : color;
    g.lineWidth = trunk ? lw * 1.7 : lw;
    g.beginPath(); g.moveTo(sx(J[a][0]), sy(J[a][1])); g.lineTo(sx(J[b][0]), sy(J[b][1])); g.stroke();
  }
  const hr = F.body.head * S;
  g.fillStyle = color; g.strokeStyle = '#000'; g.lineWidth = 3;
  g.beginPath(); g.arc(sx(J.head[0]), sy(J.head[1]), hr, 0, Math.PI * 2); g.fill(); g.stroke();
  // an eye toward the opponent
  g.fillStyle = '#000';
  g.beginPath(); g.arc(sx(J.head[0] + F.body.head * 0.45), sy(J.head[1] + F.body.head * 0.15), Math.max(1.5, hr * 0.14), 0, Math.PI * 2); g.fill();
}

function drawBoxes(p, F, view) {
  const S = view.scale;
  const rect = (b, stroke, fill) => {
    const x = view.cx + (b[0] - view.camX) * S, y = view.ground - b[3] * S;
    g.fillStyle = fill; g.fillRect(x, y, (b[2] - b[0]) * S, (b[3] - b[1]) * S);
    g.strokeStyle = stroke; g.lineWidth = 1.5; g.strokeRect(x, y, (b[2] - b[0]) * S, (b[3] - b[1]) * S);
  };
  rect(pushBox(p, F), 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0.05)');
  for (const b of hurtBoxes(p, F)) rect(b, 'rgba(80,200,255,0.9)', 'rgba(80,200,255,0.15)');
  const hb = hitBox(p, F);
  if (hb) rect(hb, 'rgba(255,60,60,1)', 'rgba(255,60,60,0.3)');
}

function drawStage(stage, view, t) {
  const sky = g.createLinearGradient(0, 0, 0, view.ground);
  sky.addColorStop(0, stage.sky[0]); sky.addColorStop(1, stage.sky[1]);
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // the far set: a skyline at a third of the camera's travel
  g.fillStyle = shade(stage.crowd, -0.35);
  for (let k = -12; k <= 12; k++) {
    const bx = view.cx + (k * 900 - view.camX * 0.3) * view.scale;
    const bh = (900 + ((k * 7919) % 5) * 260) * view.scale;
    g.fillRect(bx, view.ground - 900 * view.scale - bh, 720 * view.scale, bh);
  }
  // the crowd behind the fight plane: rows of heads and shoulders, cheering when the fight is hot
  const heat = match ? Math.min(1, (match.shake || 0) / 6 + (match.superFlash ? 1 : 0)) : 0;
  for (let row = 0; row < 3; row++) {
    const par = 0.55 + row * 0.12;
    const yb = view.ground - (700 - row * 170) * view.scale;
    const step = 260 - row * 20;
    for (let k = -40; k <= 40; k++) {
      const wx = k * step + (row * 97) % step;
      const px = view.cx + (wx - view.camX * par) * view.scale;
      if (px < -40 || px > W + 40) continue;
      const seed = (k * 31 + row * 17) & 7;
      const bob = Math.sin(t * (0.1 + seed * 0.01) + seed) * (2 + heat * 10) * view.scale * 3;
      const c = shade(stage.crowd, (seed - 3) * 0.06 + row * 0.08);
      g.fillStyle = c;
      g.fillRect(px - 70 * view.scale, yb - 220 * view.scale + bob, 140 * view.scale, 260 * view.scale);
      g.beginPath(); g.arc(px, yb - 280 * view.scale + bob, 62 * view.scale, 0, Math.PI * 2); g.fill();
      if (heat > 0.5 && seed % 3 === 0) { g.fillRect(px + 50 * view.scale, yb - 420 * view.scale + bob, 26 * view.scale, 180 * view.scale); }
    }
    g.fillStyle = shade(stage.crowd, -0.2 - row * 0.1);
    g.fillRect(0, yb, W, 40 * view.scale);
  }
  // the floor
  const fl = g.createLinearGradient(0, view.ground, 0, H);
  fl.addColorStop(0, stage.floor); fl.addColorStop(1, shade(stage.floor, -0.5));
  g.fillStyle = fl; g.fillRect(0, view.ground, W, H - view.ground);
  g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 2;
  for (let k = -12; k <= 12; k++) {
    const wx = k * 600;
    const top = view.cx + (wx - view.camX) * view.scale;
    const bot = view.cx + (wx * 1.6 - view.camX * 1.6) * view.scale;
    g.beginPath(); g.moveTo(top, view.ground); g.lineTo(bot, H); g.stroke();
  }
  // the walls
  const half = match ? match.s.rules.half : 3800;
  for (const side of [-1, 1]) {
    const wx = view.cx + (side * half - view.camX) * view.scale;
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(side < 0 ? wx - 2000 * view.scale : wx, view.ground - 2600 * view.scale, 2000 * view.scale, 2600 * view.scale + (H - view.ground));
  }
}

function drawHud(view) {
  const s = match.s;
  const barW = Math.min(W * 0.38, 520), barH = 22, top = 24, gap = 70;
  for (let i = 0; i < 2; i++) {
    const F = match.ctx.fighters[i];
    const frac = s.p[i].hp / F.hp;
    match.lag[i] += (s.p[i].hp - match.lag[i]) * (s.p[i].combo ? 0 : 0.08);
    const lagFrac = Math.max(frac, match.lag[i] / F.hp);
    const x0 = i === 0 ? W / 2 - gap / 2 - barW : W / 2 + gap / 2;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x0 - 3, top - 3, barW + 6, barH + 6);
    g.fillStyle = '#5a1010'; g.fillRect(x0, top, barW, barH);
    const fillFrom = (f) => (i === 0 ? x0 + barW * (1 - f) : x0);
    g.fillStyle = '#d23a2a'; g.fillRect(fillFrom(lagFrac), top, barW * lagFrac, barH);
    g.fillStyle = frac < 0.25 ? '#ff8a3a' : '#ffd23a'; g.fillRect(fillFrom(frac), top, barW * frac, barH);
    text(match.names[i].toUpperCase(), i === 0 ? x0 : x0 + barW, top + barH + 16, 16, '#fff', i === 0 ? 'left' : 'right');
    text(s.p[i].scheme.toUpperCase(), i === 0 ? x0 + barW : x0, top + barH + 16, 11, 'rgba(255,255,255,0.6)', i === 0 ? 'right' : 'left', 600);
    // round pips
    for (let k = 0; k < s.rules.rounds; k++) {
      const px = i === 0 ? W / 2 - gap / 2 - 14 - k * 18 : W / 2 + gap / 2 + 14 + k * 18;
      g.fillStyle = k < s.wins[i] ? '#ffd23a' : 'rgba(255,255,255,0.2)';
      g.beginPath(); g.arc(px, top + barH + 38, 6, 0, Math.PI * 2); g.fill();
    }
    // meter
    const mW = Math.min(W * 0.3, 360);
    const mx = i === 0 ? 24 : W - 24 - mW, my = H - 34;
    const mf = s.p[i].meter / 1000;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(mx - 2, my - 2, mW + 4, 16);
    g.fillStyle = mf >= 1 ? (s.f % 20 < 10 ? '#7affd2' : '#3ad2ff') : '#2a7ad2';
    g.fillRect(i === 0 ? mx : mx + mW * (1 - mf), my, mW * mf, 12);
    if (mf >= 1) text('SUPER', i === 0 ? mx + mW + 10 : mx - 10, my + 6, 13, '#7affd2', i === 0 ? 'left' : 'right');
    // combo counter
    if (match.comboT[i] > 0) outlined(`${match.combo[i]} HITS`, i === 0 ? 30 : W - 30, H * 0.36, 34, '#ffd23a', i === 0 ? 'left' : 'right');
  }
  // timer
  const secs = Math.ceil(s.timer / 60);
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(W / 2 - 30, top - 6, 60, 44);
  outlined(game.mode === 'training' ? '∞' : String(secs).padStart(2, '0'), W / 2, top + 16, 32, secs <= 10 ? '#ff6a3a' : '#fff');
  if (match.flash && match.flash.n > 0) {
    const fx = match.flash.p === 0 ? W * 0.18 : match.flash.p === 1 ? W * 0.82 : W / 2;
    outlined(match.flash.text, fx, H * 0.28, 28, '#ffd23a');
    match.flash.n--;
  }
  if (match.banner && match.banner.n > 0) {
    const b = match.banner;
    const k = Math.min(1, (b.max - b.n) / 8);
    outlined(b.t, W / 2, H * 0.4, Math.round(Math.min(W / 9, 110) * (0.6 + 0.4 * k)), '#fff');
    if (b.sub) outlined(b.sub, W / 2, H * 0.4 + Math.min(W / 9, 110) * 0.7, 26, '#ffd23a');
    b.n--;
  }
  if (game.mode === 'training') drawTraining();
}

function drawTraining() {
  const m = match.lastMove;
  const x = 24, y = 120;
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x - 10, y - 18, 300, m ? 130 : 60);
  text(`dummy: ${DUMMY[dummy]}  (R)`, x, y, 14, '#fff', 'left', 600);
  text(`boxes: ${showBoxes ? 'on' : 'off'}  (B)`, x, y + 20, 14, '#fff', 'left', 600);
  if (!m) return;
  const adv = (v) => (v === null || v === undefined ? '—' : v > 0 ? `+${v}` : `${v}`);
  text(`${m.slot}  ${m.id}${m.strength ? ' ' + m.strength : ''}`, x, y + 48, 15, '#ffd23a', 'left');
  text(`startup ${m.startup}  active ${m.active}  recovery ${m.recovery}`, x, y + 70, 14, '#fff', 'left', 600);
  text(`on hit ${adv(m.adv.hit)}  on block ${adv(m.adv.block)}  dmg ${m.damage}`, x, y + 90, 14, '#fff', 'left', 600);
}

function viewFor() {
  const s = match.s;
  const span = s.rules.span + 1600;
  const scale = Math.min(W / span, H / 3600);
  const mid = (s.p[0].x + s.p[1].x) / 2;
  const halfView = W / scale / 2;
  const lim = Math.max(0, s.rules.half - halfView + 200);
  const want = Math.max(-lim, Math.min(lim, mid));
  match.cam += (want - match.cam) * 0.18;
  const shake = match.shake > 0 ? Math.sin(game.t * 2.3) * match.shake : 0;
  if (match.shake > 0) match.shake *= 0.85;
  if (match.shake < 0.3) match.shake = 0;
  return { scale, camX: match.cam + shake * 6, cx: W / 2, ground: H * 0.84 };
}

function drawFight() {
  const view = viewFor();
  const stage = STAGES[game.stageIx];
  drawStage(stage, view, game.t);
  const s = match.s;
  if (match.superFlash > 0) { g.fillStyle = `rgba(0,0,0,${0.55 * Math.min(1, match.superFlash / 10)})`; g.fillRect(0, 0, W, H); match.superFlash--; }
  // the one acting draws in front
  const order = s.p[0].mv && !s.p[1].mv ? [1, 0] : [0, 1];
  for (const i of order) drawFighter(s.p[i], match.ctx.fighters[i], match.colors[i], view, game.t + i * 40);
  for (const t of s.shots) {
    const x = view.cx + (t.x - view.camX) * view.scale, y = view.ground - t.y * view.scale;
    const r = (t.h / 2) * view.scale;
    const glow = g.createRadialGradient(x, y, r * 0.1, x, y, r * 1.3);
    const c = match.colors[t.o];
    glow.addColorStop(0, '#fff'); glow.addColorStop(0.35, c); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(x, y, r * 1.3, 0, Math.PI * 2); g.fill();
  }
  match.sparks = match.sparks.filter((p) => p.life > 0);
  for (const p of match.sparks) {
    p.x += p.vx; p.y += p.vy; p.life--;
    g.strokeStyle = p.color; g.lineWidth = 3;
    const x = view.cx + (p.x - view.camX) * view.scale, y = view.ground - p.y * view.scale;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - p.vx * view.scale * 2, y + p.vy * view.scale * 2); g.stroke();
  }
  if (showBoxes) for (let i = 0; i < 2; i++) drawBoxes(s.p[i], match.ctx.fighters[i], view);
  if (showBoxes) for (const t of s.shots) {
    const S = view.scale;
    g.strokeStyle = 'rgba(255,60,60,1)'; g.lineWidth = 1.5;
    g.strokeRect(view.cx + (t.x - t.w / 2 - view.camX) * S, view.ground - (t.y + t.h / 2) * S, t.w * S, t.h * S);
  }
  drawHud(view);
}

function drawPanel(title, items, ix, sub) {
  g.fillStyle = 'rgba(0,0,0,0.72)'; g.fillRect(0, 0, W, H);
  outlined(title, W / 2, H * 0.22, Math.min(64, W / 12), '#fff');
  if (sub) text(sub, W / 2, H * 0.22 + 46, 18, '#ffd23a', 'center', 600);
  items.forEach((it, k) => {
    const y = H * 0.4 + k * 54;
    if (k === ix) { g.fillStyle = 'rgba(255,210,58,0.18)'; g.fillRect(W / 2 - 220, y - 22, 440, 44); }
    text(it, W / 2, y, 26, k === ix ? '#ffd23a' : '#fff');
  });
}

function drawFigureCard(entry, x, y, size, t, color) {
  const fake = { x: 0, y: 0, face: 1, st: 'stand', sf: 0, mv: null };
  const S = size / 2200;
  const view = { scale: S, camX: 0, cx: x, ground: y };
  drawFighter(fake, entry.F, color || entry.color, view, t);
}

function drawSelect() {
  drawMenuBackdrop();
  outlined('CHOOSE YOUR FIGHTER', W / 2, 54, Math.min(46, W / 16), '#fff');
  const n = ROSTER.length;
  const cell = Math.min(170, (W - 80) / n);
  const x0 = W / 2 - (cell * n) / 2;
  const y0 = H * 0.62;
  ROSTER.forEach((r, k) => {
    const cx = x0 + cell * k + cell / 2;
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(cx - cell / 2 + 6, y0 - cell + 6, cell - 12, cell - 12);
    drawFigureCard(r, cx, y0 - 14, cell * 0.85, game.t + k * 30);
    text(r.name, cx, y0 + 16, 16, '#fff');
    for (let i = 0; i < 2; i++) {
      if (game.pick[i].ix !== k) continue;
      g.strokeStyle = i === 0 ? '#ff4a3a' : '#3a9aff'; g.lineWidth = game.pick[i].locked ? 6 : 3;
      const inset = i === 0 ? 6 : 12;
      g.strokeRect(cx - cell / 2 + inset, y0 - cell + inset, cell - inset * 2, cell + 20 - inset * 2);
      text(i === 0 ? '1P' : (game.mode === 'versus' ? '2P' : 'CPU'), cx + (i === 0 ? -cell / 2 + 20 : cell / 2 - 22), y0 - cell + 22, 13, i === 0 ? '#ff4a3a' : '#3a9aff');
    }
  });
  for (let i = 0; i < 2; i++) {
    const P = game.pick[i], r = ROSTER[P.ix];
    const side = i === 0 ? W * 0.2 : W * 0.8;
    drawFigureCard(r, side, H * 0.42, Math.min(H * 0.32, 300), game.t, i === 1 && game.pick[0].ix === P.ix ? '#e8e8e8' : r.color);
    text(r.name.toUpperCase(), side, H * 0.46, 26, '#fff');
    text(r.archetype || '', side, H * 0.46 + 24, 14, '#ffd23a', 'center', 600);
    const cpuSide = (game.mode === 'cpu' && i === 1) || game.mode === 'watch';
    text(cpuSide ? `CPU · ${game.mode === 'watch' ? 'veteran' : LEVELS[game.level]}` : `▲ ${SCHEMES[P.scheme].toUpperCase()} ▼`, side, H * 0.46 + 46, 15, cpuSide ? '#aaa' : '#7affd2', 'center', 700);
    if (P.locked) text('READY', side, H * 0.12, 20, '#7affd2');
  }
  text(schemeHelp(), W / 2, H - 56, 14, 'rgba(255,255,255,0.8)', 'center', 600);
  text('1P: WASD move · J/K/L light/medium/heavy · U special · I throw     2P: arrows · 1/2/3 · 4 special · 5 throw (or , . / ; \')', W / 2, H - 30, 13, 'rgba(255,255,255,0.6)', 'center', 500);
}

function schemeHelp() {
  const sc = SCHEMES[game.pick[0].scheme];
  if (sc === 'modern') return 'MODERN: L/M/H normals · Special + direction for specials · Special + H super · Throw button (or L+M)';
  if (sc === 'classic') return 'CLASSIC: L/M/H normals · motions + button: ↓↘→ fireball, →↓↘ uppercut, ↓↙← rush · ↓↘→↓↘→ + button super';
  return 'SIMPLE: one attack button, tap again on hit to auto-combo · Special + direction · Special + attack super';
}

function drawMenuBackdrop() {
  const grd = g.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, '#1a1024'); grd.addColorStop(1, '#3a1a1a');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,0.04)'; g.lineWidth = 40;
  for (let k = -10; k < 30; k++) { const x = ((k * 140 + game.t * 0.6) % (W + 400)) - 200; g.beginPath(); g.moveTo(x, 0); g.lineTo(x - 400, H); g.stroke(); }
}

function drawTitle() {
  drawMenuBackdrop();
  ROSTER.slice(0, 2).forEach((r, k) => {
    const fake = { x: 0, y: 0, face: k === 0 ? 1 : -1, st: 'stand', sf: 0, mv: null };
    drawFighter(fake, r.F, r.color, { scale: Math.min(H, W) / 3000, camX: 0, cx: W / 2 + (k === 0 ? -W * 0.18 : W * 0.18), ground: H * 0.8 }, game.t + k * 50);
  });
  outlined(VERSUS.title.toUpperCase(), W / 2, H * 0.3, Math.min(96, W / 9), '#fff');
  text('a side-view fighter on mojulo rails', W / 2, H * 0.3 + 60, 18, '#ffd23a', 'center', 600);
  if (Math.floor(game.t / 30) % 2 === 0) outlined('PRESS START', W / 2, H * 0.62, 30, '#fff');
  text('Enter / Space / J / a gamepad\'s A', W / 2, H * 0.62 + 34, 14, 'rgba(255,255,255,0.6)', 'center', 500);
}

function drawMode() {
  drawMenuBackdrop();
  drawPanel('MODE SELECT', MODES.map((m) => (m.id === 'cpu' ? `${m.name}  ◀ ${LEVELS[game.level]} ▶` : m.name)), game.modeIx, MODES[game.modeIx].says);
}

function drawStageSelect() {
  drawMenuBackdrop();
  const st = STAGES[game.stageIx];
  const view = { scale: Math.min(W / 6000, H / 3600), camX: 0, cx: W / 2, ground: H * 0.8 };
  drawStage(st, view, game.t);
  outlined('STAGE SELECT', W / 2, 54, Math.min(46, W / 16), '#fff');
  outlined(`◀  ${st.name.toUpperCase()}  ▶`, W / 2, H * 0.4, Math.min(56, W / 14), '#ffd23a');
}

// ── the loop: a fixed 60 Hz step under requestAnimationFrame ──────────────────────────────────────────────────

let acc = 0, last = performance.now(), slowTick = 0;
function frame(now) {
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= 1000 / 60) {
    acc -= 1000 / 60;
    game.t++;
    const inp = menuInput();
    if (game.screen === 'fight') {
      // pause on start or escape (never the special button, which is back only in the menus)
      if ((inp[0].pause || inp[1].pause) && match.s.phase !== 'matchEnd') { game.screen = 'pause'; game.pauseIx = 0; continue; }
      if (match.slow > 0) { match.slow--; if (++slowTick % 3) continue; }
      stepMatch();
    } else tickMenus(inp);
  }
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.clearRect(0, 0, W, H);
  switch (game.screen) {
    case 'title': drawTitle(); break;
    case 'mode': drawMode(); break;
    case 'select': drawSelect(); break;
    case 'stage': drawStageSelect(); break;
    case 'fight': drawFight(); break;
    case 'pause': drawFight(); drawPanel('PAUSED', ['Resume', 'Character select', 'Mode select'], game.pauseIx, 'B toggles the boxes · M mutes'); break;
    case 'result': drawFight(); drawPanel(match.s.winner >= 0 ? `${match.names[match.s.winner].toUpperCase()} WINS` : 'DRAW', ['Rematch', 'Character select', 'Mode select'], game.resultIx, `${match.s.wins[0]} – ${match.s.wins[1]}`); break;
    case 'continue': drawFight(); drawPanel('CONTINUE?', [String(Math.ceil(game.cont / 60))], 0, 'press a button to fight again'); break;
    default: break;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// a handle for headless checks: the page's state, read only
window.__versus = { game, get match() { return match; }, ROSTER };
