/**
 * versus play — the front of a versus game (inlined as text by versus-page.js, never imported).
 *
 * The pure modules and the runtime (versus-runtime.client.js) are concatenated ahead of this script, and `VERSUS`
 * (the game's title, roster recipes, stages, arenas and rules) is injected; the page compiles the fighters.
 * Screens: title → mode select → character select (each player picks a fighter and a scheme) → stage select → the
 * fight → the result (rematch, character select, mode select; against the CPU, a loss offers a continue).
 *
 * Where the fight happens: a game with ARENAS (scapeshift stage worlds carrying the fight channel) hosts the chosen
 * arena's World page in a frame and speaks the level wire to it (ready → init with the picks → outcome back), the
 * game shell's own handshake; the arena draws the fight in 3D. A game without arenas draws the fight here, on a
 * flat backdrop with a crowd band, from its `stages`.
 */

/* global VERSUS, compileFighter, rigJoints, SCHEMES, RT, VS_LEVELS, VS_DUMMY, installVersusInput, menuInput, blip, endInputFrame,
   newMatch, stepMatch, poseOf, drawEffects, drawHud, drawBlade, vsText, vsOutlined, vsShade */

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
const ARENAS = VERSUS.arenas || [];
const STAGES = ARENAS.length ? ARENAS : VERSUS.stages;
const MODES = [
  { id: 'versus', name: 'Versus', says: 'two players, one keyboard or two pads' },
  { id: 'cpu', name: 'Versus CPU', says: 'you against the machine' },
  { id: 'training', name: 'Training', says: 'a dummy, the boxes, the frame data' },
  { id: 'watch', name: 'CPU vs CPU', says: 'watch the roster fight itself' },
];
const WIRE = VERSUS.wire;

const game = {
  screen: 'title', t: 0, mode: 'versus', modeIx: 0, level: 1,
  pick: [{ ix: 0, scheme: 0, locked: false }, { ix: Math.min(1, ROSTER.length - 1), scheme: 0, locked: false }],
  stageIx: 0, pauseIx: 0, resultIx: 0, cont: 0, result: null,
};
let match = null;   // a fight drawn here
let host = null;    // a fight hosted in an arena's frame: { frame, params, names }

installVersusInput((code) => { if (code === 'KeyR' && game.mode === 'training') RT.dummy = (RT.dummy + 1) % VS_DUMMY.length; });

function picks() {
  const a = ROSTER[game.pick[0].ix], b = ROSTER[game.pick[1].ix];
  return {
    a, b, names: [a.name, b.name], colors: [a.color, a.id === b.id ? '#e8e8e8' : b.color],
    schemes: game.pick.map((p) => SCHEMES[p.scheme]), mode: game.mode, level: game.level, rules: VERSUS.rules || {},
    seed: (game.t * 2654435761) >>> 0,
  };
}

function startMatch() {
  const P = picks();
  game.result = null;
  if (ARENAS.length) { hostArena(P); return; }
  match = newMatch({ ...P, fighters: [P.a.F, P.b.F] });
  game.screen = 'fight';
}

// ── an arena, hosted ─────────────────────────────────────────────────────────────────────────────────────────

function hostArena(P) {
  closeArena();
  const arena = ARENAS[game.stageIx];
  const frame = document.createElement('iframe');
  frame.src = arena.src;
  frame.title = arena.name;
  frame.setAttribute('allow', 'gamepad; autoplay');
  frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;background:#000';
  document.body.appendChild(frame);
  const params = { fighters: [P.a.recipe, P.b.recipe], names: P.names, colors: P.colors, schemes: P.schemes, mode: P.mode, level: P.level, rules: P.rules, seed: P.seed };
  host = { frame, params, names: P.names };
  frame.addEventListener('load', () => frame.focus());
  game.screen = 'arena';
}

function closeArena() {
  if (host && host.frame.parentNode) host.frame.parentNode.removeChild(host.frame);
  host = null;
  window.focus();
}

window.addEventListener('message', (e) => {
  if (!host || e.source !== host.frame.contentWindow || !e.data || typeof e.data !== 'object') return;
  const msg = e.data;
  if (msg.moj === WIRE.ready) {
    host.frame.contentWindow.postMessage({ moj: WIRE.init, contractVersion: WIRE.version, params: { versus: host.params }, seed: host.params.seed }, '*');
    host.frame.focus();
  }
  if (msg.moj === WIRE.outcome) {
    const env = msg.envelope || {};
    const names = host.names;
    closeArena();
    if (env.result === 'abort') { toSelect(); return; }
    const v = env.stats && env.stats.versus ? env.stats.versus : { winner: env.result === 'success' ? 0 : 1, wins: [0, 0] };
    game.result = { winner: v.winner, wins: v.wins, names };
    game.screen = game.mode === 'cpu' && v.winner !== 0 ? 'continue' : 'result';
    game.cont = 10 * 60; game.resultIx = 0;
  }
});

// ── screens ──────────────────────────────────────────────────────────────────────────────────────────────────

function toSelect() { game.screen = 'select'; game.pick[0].locked = false; game.pick[1].locked = false; }

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
        if (any('left')) game.level = (game.level + VS_LEVELS.length - 1) % VS_LEVELS.length;
        if (any('right')) game.level = (game.level + 1) % VS_LEVELS.length;
      }
      if (any('ok')) { game.mode = MODES[game.modeIx].id; blip('ok'); toSelect(); }
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
    case 'pause':
      if (any('up')) game.pauseIx = (game.pauseIx + 2) % 3;
      if (any('down')) game.pauseIx = (game.pauseIx + 1) % 3;
      if (any('ok')) {
        if (game.pauseIx === 0) game.screen = 'fight';
        if (game.pauseIx === 1) toSelect();
        if (game.pauseIx === 2) game.screen = 'mode';
      }
      break;
    case 'result':
      if (any('up')) game.resultIx = (game.resultIx + 2) % 3;
      if (any('down')) game.resultIx = (game.resultIx + 1) % 3;
      if (any('ok')) {
        blip('ok');
        if (game.resultIx === 0) startMatch();
        if (game.resultIx === 1) toSelect();
        if (game.resultIx === 2) game.screen = 'mode';
      }
      break;
    case 'continue':
      game.cont--;
      if (any('ok')) { blip('ok'); startMatch(); }
      if (game.cont <= 0 || any('back')) game.screen = 'title';
      break;
    default: break;
  }
}

// ── drawing (the flat fight and the menus) ───────────────────────────────────────────────────────────────────

const BONES = [
  ['shoulder', 'elbowB'], ['elbowB', 'fistB'], ['pelvis', 'kneeB'], ['kneeB', 'ankleB'], ['ankleB', 'toeB'],
  ['pelvis', 'neck'],
  ['pelvis', 'kneeF'], ['kneeF', 'ankleF'], ['ankleF', 'toeF'], ['shoulder', 'elbowF'], ['elbowF', 'fistF'],
];

function drawFighter(p, F, color, view, t) {
  const J = rigJoints(F.body, poseOf(p, F, t));
  const S = view.scale;
  const sx = (x) => view.cx + (p.x + x * p.face - view.camX) * S;
  const sy = (y) => view.ground - (p.y + y) * S;
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath();
  g.ellipse(view.cx + (p.x - view.camX) * S, view.ground + 4, F.body.bodyR * 1.6 * S, 7 * Math.max(0.5, 1 - p.y / 1500), 0, 0, Math.PI * 2);
  g.fill();
  g.lineCap = 'round'; g.lineJoin = 'round';
  const lw = Math.max(4, F.body.limbR * 2 * S);
  // a rear-hand weapon is behind the body, a lead-hand one in front of it
  if (F.weapon && F.weapon.grip === 'B') drawBlade(g, F, J, sx, sy, S);
  for (const [a, b] of BONES) {
    const back = a.endsWith('B') || b.endsWith('B');
    const trunk = a === 'pelvis' && b === 'neck';
    g.strokeStyle = '#000';
    g.lineWidth = (trunk ? lw * 1.7 : lw) + 4;
    g.beginPath(); g.moveTo(sx(J[a][0]), sy(J[a][1])); g.lineTo(sx(J[b][0]), sy(J[b][1])); g.stroke();
    g.strokeStyle = back ? vsShade(color, -0.45) : color;
    g.lineWidth = trunk ? lw * 1.7 : lw;
    g.beginPath(); g.moveTo(sx(J[a][0]), sy(J[a][1])); g.lineTo(sx(J[b][0]), sy(J[b][1])); g.stroke();
  }
  if (F.weapon && F.weapon.grip === 'F') drawBlade(g, F, J, sx, sy, S);
  const hr = F.body.head * S;
  g.fillStyle = color; g.strokeStyle = '#000'; g.lineWidth = 3;
  g.beginPath(); g.arc(sx(J.head[0]), sy(J.head[1]), hr, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#000';
  g.beginPath(); g.arc(sx(J.head[0] + F.body.head * 0.45), sy(J.head[1] + F.body.head * 0.15), Math.max(1.5, hr * 0.14), 0, Math.PI * 2); g.fill();
}

function drawStage(stage, view, t) {
  const sky = g.createLinearGradient(0, 0, 0, view.ground);
  sky.addColorStop(0, stage.sky[0]); sky.addColorStop(1, stage.sky[1]);
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.fillStyle = vsShade(stage.crowd, -0.35);
  for (let k = -12; k <= 12; k++) {
    const bx = view.cx + (k * 900 - view.camX * 0.3) * view.scale;
    const bh = (900 + ((k * 7919) % 5) * 260) * view.scale;
    g.fillRect(bx, view.ground - 900 * view.scale - bh, 720 * view.scale, bh);
  }
  const heat = match ? Math.min(1, (match.shake || 0) / 6 + (match.superFlash ? 1 : 0)) : 0;
  for (let row = 0; row < 3; row++) {
    const par = 0.55 + row * 0.12;
    const yb = view.ground - (700 - row * 170) * view.scale;
    const step = 260 - row * 20;
    for (let k = -40; k <= 40; k++) {
      const px = view.cx + (k * step + (row * 97) % step - view.camX * par) * view.scale;
      if (px < -40 || px > W + 40) continue;
      const seed = (k * 31 + row * 17) & 7;
      const bob = Math.sin(t * (0.1 + seed * 0.01) + seed) * (2 + heat * 10) * view.scale * 3;
      g.fillStyle = vsShade(stage.crowd, (seed - 3) * 0.06 + row * 0.08);
      g.fillRect(px - 70 * view.scale, yb - 220 * view.scale + bob, 140 * view.scale, 260 * view.scale);
      g.beginPath(); g.arc(px, yb - 280 * view.scale + bob, 62 * view.scale, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = vsShade(stage.crowd, -0.2 - row * 0.1);
    g.fillRect(0, yb, W, 40 * view.scale);
  }
  const fl = g.createLinearGradient(0, view.ground, 0, H);
  fl.addColorStop(0, stage.floor); fl.addColorStop(1, vsShade(stage.floor, -0.5));
  g.fillStyle = fl; g.fillRect(0, view.ground, W, H - view.ground);
  g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 2;
  for (let k = -12; k <= 12; k++) {
    const top = view.cx + (k * 600 - view.camX) * view.scale;
    const bot = view.cx + (k * 600 * 1.6 - view.camX * 1.6) * view.scale;
    g.beginPath(); g.moveTo(top, view.ground); g.lineTo(bot, H); g.stroke();
  }
  const half = match ? match.s.rules.half : 3800;
  for (const side of [-1, 1]) {
    const wx = view.cx + (side * half - view.camX) * view.scale;
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(side < 0 ? wx - 2000 * view.scale : wx, view.ground - 2600 * view.scale, 2000 * view.scale, 2600 * view.scale + (H - view.ground));
  }
}

function viewFor() {
  const s = match.s;
  const scale = Math.min(W / (s.rules.span + 1600), H / 3600);
  const mid = (s.p[0].x + s.p[1].x) / 2;
  const lim = Math.max(0, s.rules.half - W / scale / 2 + 200);
  match.cam += (Math.max(-lim, Math.min(lim, mid)) - match.cam) * 0.18;
  const shake = match.shake > 0 ? Math.sin(game.t * 2.3) * match.shake : 0;
  if (match.shake > 0) match.shake *= 0.85;
  if (match.shake < 0.3) match.shake = 0;
  return { scale, camX: match.cam + shake * 6, cx: W / 2, ground: H * 0.84 };
}

function drawFight() {
  const view = viewFor();
  drawStage(STAGES[game.stageIx], view, game.t);
  const s = match.s;
  const order = s.p[0].mv && !s.p[1].mv ? [1, 0] : [0, 1];
  for (const i of order) drawFighter(s.p[i], match.ctx.fighters[i], match.colors[i], view, game.t + i * 40);
  drawEffects(g, match, (x, y) => [view.cx + (x - view.camX) * view.scale, view.ground - y * view.scale], view.scale);
  drawHud(g, W, H, match);
}

function drawPanel(title, items, ix, sub) {
  g.fillStyle = 'rgba(0,0,0,0.72)'; g.fillRect(0, 0, W, H);
  vsOutlined(g, title, W / 2, H * 0.22, Math.min(64, W / 12), '#fff');
  if (sub) vsText(g, sub, W / 2, H * 0.22 + 46, 18, '#ffd23a', 'center', 600);
  items.forEach((it, k) => {
    const y = H * 0.4 + k * 54;
    if (k === ix) { g.fillStyle = 'rgba(255,210,58,0.18)'; g.fillRect(W / 2 - 220, y - 22, 440, 44); }
    vsText(g, it, W / 2, y, 26, k === ix ? '#ffd23a' : '#fff');
  });
}

function drawFigureCard(entry, x, y, size, t, color) {
  const fake = { x: 0, y: 0, face: 1, st: 'stand', sf: 0, mv: null };
  drawFighter(fake, entry.F, color || entry.color, { scale: size / 2200, camX: 0, cx: x, ground: y }, t);
}

function drawMenuBackdrop() {
  const grd = g.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, '#1a1024'); grd.addColorStop(1, '#3a1a1a');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,0.04)'; g.lineWidth = 40;
  for (let k = -10; k < 30; k++) { const x = ((k * 140 + game.t * 0.6) % (W + 400)) - 200; g.beginPath(); g.moveTo(x, 0); g.lineTo(x - 400, H); g.stroke(); }
}

function drawSelect() {
  drawMenuBackdrop();
  vsOutlined(g, 'CHOOSE YOUR FIGHTER', W / 2, 54, Math.min(46, W / 16), '#fff');
  const n = ROSTER.length;
  const cell = Math.min(170, (W - 80) / n);
  const x0 = W / 2 - (cell * n) / 2;
  const y0 = H * 0.62;
  ROSTER.forEach((r, k) => {
    const cx = x0 + cell * k + cell / 2;
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(cx - cell / 2 + 6, y0 - cell + 6, cell - 12, cell - 12);
    drawFigureCard(r, cx, y0 - 14, cell * 0.85, game.t + k * 30);
    vsText(g, r.name, cx, y0 + 16, 16, '#fff');
    for (let i = 0; i < 2; i++) {
      if (game.pick[i].ix !== k) continue;
      g.strokeStyle = i === 0 ? '#ff4a3a' : '#3a9aff'; g.lineWidth = game.pick[i].locked ? 6 : 3;
      const inset = i === 0 ? 6 : 12;
      g.strokeRect(cx - cell / 2 + inset, y0 - cell + inset, cell - inset * 2, cell + 20 - inset * 2);
      vsText(g, i === 0 ? '1P' : (game.mode === 'versus' ? '2P' : 'CPU'), cx + (i === 0 ? -cell / 2 + 20 : cell / 2 - 22), y0 - cell + 22, 13, i === 0 ? '#ff4a3a' : '#3a9aff');
    }
  });
  for (let i = 0; i < 2; i++) {
    const P = game.pick[i], r = ROSTER[P.ix];
    const side = i === 0 ? W * 0.2 : W * 0.8;
    drawFigureCard(r, side, H * 0.42, Math.min(H * 0.32, 300), game.t, i === 1 && game.pick[0].ix === P.ix ? '#e8e8e8' : r.color);
    vsText(g, r.name.toUpperCase(), side, H * 0.46, 26, '#fff');
    vsText(g, r.archetype || '', side, H * 0.46 + 24, 14, '#ffd23a', 'center', 600);
    const cpuSide = (game.mode === 'cpu' && i === 1) || game.mode === 'watch';
    vsText(g, cpuSide ? `CPU · ${game.mode === 'watch' ? 'veteran' : VS_LEVELS[game.level]}` : `▲ ${SCHEMES[P.scheme].toUpperCase()} ▼`, side, H * 0.46 + 46, 15, cpuSide ? '#aaa' : '#7affd2', 'center', 700);
    if (P.locked) vsText(g, 'READY', side, H * 0.12, 20, '#7affd2');
  }
  vsText(g, schemeHelp(), W / 2, H - 56, 14, 'rgba(255,255,255,0.8)', 'center', 600);
  vsText(g, '1P: WASD move · J/K/L light/medium/heavy · U special · I throw     2P: arrows · 1/2/3 · 4 special · 5 throw (or , . / ; \')', W / 2, H - 30, 13, 'rgba(255,255,255,0.6)', 'center', 500);
}

function schemeHelp() {
  const sc = SCHEMES[game.pick[0].scheme];
  if (sc === 'modern') return 'MODERN: L/M/H normals · Special + direction for specials · Special + H super · Throw button (or L+M)';
  if (sc === 'classic') return 'CLASSIC: L/M/H normals · motions + button: ↓↘→ fireball, →↓↘ uppercut, ↓↙← rush · ↓↘→↓↘→ + button super';
  return 'SIMPLE: one attack button, tap again on hit to auto-combo · Special + direction · Special + attack super';
}

function drawTitle() {
  drawMenuBackdrop();
  ROSTER.slice(0, 2).forEach((r, k) => {
    const fake = { x: 0, y: 0, face: k === 0 ? 1 : -1, st: 'stand', sf: 0, mv: null };
    drawFighter(fake, r.F, r.color, { scale: Math.min(H, W) / 3000, camX: 0, cx: W / 2 + (k === 0 ? -W * 0.18 : W * 0.18), ground: H * 0.8 }, game.t + k * 50);
  });
  vsOutlined(g, VERSUS.title.toUpperCase(), W / 2, H * 0.3, Math.min(96, W / 9), '#fff');
  vsText(g, 'a side-view fighter on mojulo rails', W / 2, H * 0.3 + 60, 18, '#ffd23a', 'center', 600);
  if (Math.floor(game.t / 30) % 2 === 0) vsOutlined(g, 'PRESS START', W / 2, H * 0.62, 30, '#fff');
  vsText(g, 'Enter / Space / J / a gamepad\'s A', W / 2, H * 0.62 + 34, 14, 'rgba(255,255,255,0.6)', 'center', 500);
}

function drawStageSelect() {
  drawMenuBackdrop();
  const st = STAGES[game.stageIx];
  if (!ARENAS.length) drawStage(st, { scale: Math.min(W / 6000, H / 3600), camX: 0, cx: W / 2, ground: H * 0.8 }, game.t);
  vsOutlined(g, 'STAGE SELECT', W / 2, 54, Math.min(46, W / 16), '#fff');
  vsOutlined(g, `◀  ${st.name.toUpperCase()}  ▶`, W / 2, H * 0.4, Math.min(56, W / 14), '#ffd23a');
  if (st.says) vsText(g, st.says, W / 2, H * 0.4 + 50, 16, 'rgba(255,255,255,0.8)', 'center', 600);
}

const drawResultBackdrop = () => (match && !ARENAS.length ? drawFight() : drawMenuBackdrop());

// ── the loop: a fixed 60 Hz step under requestAnimationFrame ──────────────────────────────────────────────────

let acc = 0, last = performance.now(), slowTick = 0;
function frame(now) {
  acc += Math.min(100, now - last);
  last = now;
  let ticked = false;
  while (acc >= 1000 / 60) {
    acc -= 1000 / 60;
    game.t++;
    ticked = true;
    if (game.screen === 'arena') continue;   // the arena's frame has the keys and the fight
    const inp = menuInput();
    if (game.screen === 'fight') {
      // pause on start or escape (never the special button, which is back only in the menus)
      if ((inp[0].pause || inp[1].pause) && match.s.phase !== 'matchEnd') { game.screen = 'pause'; game.pauseIx = 0; continue; }
      if (match.slow > 0) { match.slow--; if (++slowTick % 3) continue; }
      stepMatch(match);
      if (match.end === 150) {
        const s = match.s;
        game.result = { winner: s.winner, wins: s.wins, names: match.names };
        game.screen = game.mode === 'cpu' && s.winner !== 0 ? 'continue' : 'result';
        game.cont = 10 * 60; game.resultIx = 0;
      }
    } else tickMenus(inp);
  }
  if (ticked) endInputFrame();
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.clearRect(0, 0, W, H);
  const R = game.result;
  switch (game.screen) {
    case 'title': drawTitle(); break;
    case 'mode': drawMenuBackdrop(); drawPanel('MODE SELECT', MODES.map((m) => (m.id === 'cpu' ? `${m.name}  ◀ ${VS_LEVELS[game.level]} ▶` : m.name)), game.modeIx, MODES[game.modeIx].says); break;
    case 'select': drawSelect(); break;
    case 'stage': drawStageSelect(); break;
    case 'fight': drawFight(); break;
    case 'arena': break;
    case 'pause': drawFight(); drawPanel('PAUSED', ['Resume', 'Character select', 'Mode select'], game.pauseIx, 'B toggles the boxes · M mutes'); break;
    case 'result': drawResultBackdrop(); drawPanel(R && R.winner >= 0 ? `${R.names[R.winner].toUpperCase()} WINS` : 'DRAW', ['Rematch', 'Character select', 'Mode select'], game.resultIx, R ? `${R.wins[0]} – ${R.wins[1]}` : ''); break;
    case 'continue': drawResultBackdrop(); drawPanel('CONTINUE?', [String(Math.ceil(game.cont / 60))], 0, 'press a button to fight again'); break;
    default: break;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// a handle for headless checks: the page's state, read only
window.__versus = { game, get match() { return match; }, get host() { return host; }, ROSTER };
