/**
 * philosophers stone shell — the served/standalone playable, as ONE emitter.
 *
 * The match-3 folded into a self-contained HTML page: the pure modules
 * (pixelizer + philosophers-stone-core + -skin) inlined by naive concatenation
 * (they only import from each other, so stripping import/export lines yields one
 * classic script), and a thin imperative shell.
 *
 * Board rendering is a PER-GEM element layer (one absolutely-positioned sprite
 * per cell), so the cascade the reducer emits as `frames` can be ANIMATED: a
 * pop flashes + fades the matched gems, then survivors and fresh gems SLIDE down
 * into the holes (CSS transform transition, a slight landing bounce). The reducer
 * stays clockless + settled-in-one-step; the frames are pure presentation, and
 * the timed clock pauses while a cascade plays.
 *
 * Two modes (Free Play endless · Alchemist's Trial timed level progression),
 * pointer swaps (tap-tap or drag onto a neighbour) + a keyboard cursor. Source is
 * read from `process.cwd()/lib/graph/pixelizer` so it survives Next's bundler.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildBeatsKernel } from '../beats/beats-kernel.js';
import { PATCHES } from '../beats/audio-patches.js';
import { PS_THEME, PS_SFX } from './philosophers-stone-beats.js';

const SRC = join(process.cwd(), 'lib', 'graph', 'pixelizer');

/** Read a sibling pixelizer module and strip its import/export lines to inline it. */
export const inlineSource = (file) =>
  readFileSync(join(SRC, file), 'utf8')
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/^export /gm, '');

/** The beats bundle: kernel serialized + recipes as JSON. Emitted only in music mode. */
export const beatsBundle = () => `
const KERNEL = (${buildBeatsKernel.toString()})();
const PATCHES = ${JSON.stringify(PATCHES)};
const PS_THEME = ${JSON.stringify(PS_THEME)};
const PS_SFX = ${JSON.stringify(PS_SFX)};
`;

const shell = ({ scale = 4, music = true } = {}) => `
const SCALE = ${scale};
const TP = 16 * SCALE;                 // one gem cell in px
const SWAP_MS = 240, POP_MS = 300, FALL_MS = 380, SWAP_SLIDE_MS = 200; // slow enough to read
const world = document.getElementById('game');
const cursorEl = document.getElementById('cursor');
const splash = document.getElementById('splash');
const overEl = document.getElementById('over');
const overMsg = document.getElementById('over-msg');
const hudEl = document.getElementById('hud');
const timeFill = document.getElementById('timebar-fill');
const freeBtn = document.getElementById('free-btn');
const timedBtn = document.getElementById('timed-btn');
const el = (id) => document.getElementById(id);
const hud = { score: el('score'), moves: el('moves'), stones: el('stones'), chain: el('chain'),
  level: el('level'), target: el('target'), time: el('time') };
const fmtScore = (s) => String(Math.min(s, 9999999)).padStart(7, '0');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let mode = 'free';
let state = newGame((Date.now() & 0xffffffff) >>> 0, { mode });
let cursor = { x: 0, y: 0 };
// the keyboard cursor is noise on touch screens — hidden there until a key moves it
let cursorSeen = !matchMedia('(pointer: coarse)').matches;
let started = false;
let animating = false;
let last = performance.now();

// --- audio (beats): a theme loop + foley cues, started on the first user gesture ---
${music ? `
let actx = null, beng = null, musicStarted = false, muted = false;
const ensureAudio = () => {
  if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); beng = KERNEL.createEngine(actx, {}); beng.setMuted(muted); }
  if (actx.state === 'suspended') actx.resume();
};
const startMusic = () => { ensureAudio(); if (!musicStarted) { beng.startAmbient(PS_THEME, PATCHES); musicStarted = true; } };
const sfx = (id) => { if (beng && !muted && PS_SFX.cues[id]) beng.playCue(PS_SFX.cues[id]); };
const muteBtn = document.getElementById('mute-btn');
muteBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); ensureAudio(); muted = !muted; muteBtn.classList.toggle('muted', muted); muteBtn.setAttribute('aria-pressed', String(muted)); beng.setMuted(muted); });
muteBtn.addEventListener('contextmenu', (e) => e.preventDefault());
` : 'const startMusic = () => {}, sfx = () => {};'}
const cellKind = (st, p) => (st.grid[p.y][p.x] || {}).kind;

// --- per-gem element board ---
const sizeBoard = () => { world.style.width = state.W * TP + 'px'; world.style.height = state.H * TP + 'px'; };
const place = (g, x, row) => { g.style.transform = 'translate(' + x * TP + 'px,' + row * TP + 'px)'; };
const makeGem = (cell) => { const g = document.createElement('div'); g.className = 'gem'; g.innerHTML = renderCellSvg(cell, SCALE); world.appendChild(g); return g; };
// lay a whole grid out statically, return a (x,y)->element map
const layout = (grid) => {
  sizeBoard();
  world.classList.remove('falling');
  world.innerHTML = '';
  const map = {};
  for (let y = 0; y < state.H; y++) for (let x = 0; x < state.W; x++) {
    if (!grid[y][x]) continue;
    const g = makeGem(grid[y][x]);
    place(g, x, y);
    map[x + ',' + y] = g;
  }
  return map;
};

const renderCursor = () => {
  cursorEl.style.display = cursorSeen ? '' : 'none';
  cursorEl.style.width = cursorEl.style.height = TP + 'px';
  cursorEl.style.transform = 'translate(' + cursor.x * TP + 'px,' + cursor.y * TP + 'px)';
};
const renderHud = () => {
  const o = resolveOverlay(state);
  hud.score.textContent = o.score;
  hud.stones.textContent = o.stones;
  if (o.mode === 'timed') {
    hud.level.textContent = o.level;
    hud.target.textContent = o.progress + ' / ' + o.target;
    hud.time.textContent = o.timeSec + 's';
    timeFill.style.width = Math.round(o.timeFrac * 100) + '%';
    timeFill.style.background = o.timeFrac > 0.5 ? '#33c866' : o.timeFrac > 0.25 ? '#e8c840' : '#e8564a';
    overEl.style.display = o.status === 'over' ? 'flex' : 'none';
    if (o.status === 'over') overMsg.textContent = "TIME'S UP — reached level " + o.level;
  } else {
    hud.moves.textContent = o.moves;
    hud.chain.textContent = o.chain > 1 ? '×' + o.chain : '—';
    overEl.style.display = 'none';
  }
};
const render = () => {
  const map = layout(state.grid);
  if (state.sel && map[state.sel.x + ',' + state.sel.y]) map[state.sel.x + ',' + state.sel.y].classList.add('armed');
  renderHud();
  renderCursor();
};

// --- cascade animation: pop (flash+fade the matched) then drop (slide survivors + fresh gems) ---
const doPop = (prevGrid, popGrid) => new Promise((res) => {
  const map = layout(prevGrid);
  let popped = false;
  for (let y = 0; y < state.H; y++) for (let x = 0; x < state.W; x++) {
    const before = prevGrid[y][x];
    const after = popGrid[y][x];
    const g = map[x + ',' + y];
    if (!g) continue;
    if (before && !after) { g.classList.add('popping'); popped = true; }        // matched → gone
    else if (before && after && after.kind !== before.kind) g.innerHTML = renderCellSvg(after, SCALE); // promoted in place
  }
  setTimeout(res, popped ? POP_MS : 40);
});
const doFall = (popGrid, settledGrid) => new Promise((res) => {
  sizeBoard();
  world.classList.remove('falling');
  world.innerHTML = '';
  const moving = [];
  for (let x = 0; x < state.W; x++) {
    const survivors = [];
    for (let y = 0; y < state.H; y++) if (popGrid[y][x]) survivors.push(y);
    const k = survivors.length;
    survivors.forEach((py, j) => { const toRow = state.H - k + j; const g = makeGem(settledGrid[toRow][x]); place(g, x, py); moving.push([g, x, toRow]); });
    for (let r = 0; r < state.H - k; r++) { const g = makeGem(settledGrid[r][x]); place(g, x, r - (state.H - k)); moving.push([g, x, r]); } // fresh gems from above
  }
  world.offsetHeight; // commit start positions
  requestAnimationFrame(() => {
    world.classList.add('falling');
    for (const [g, x, toRow] of moving) place(g, x, toRow);
    setTimeout(() => { world.classList.remove('falling'); res(); }, FALL_MS);
  });
});
const manh = (p, q) => Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
// slide the two swapped gems past each other; layout(before) then move them to each other's cell
const doSwapSlide = (grid, a, b) => new Promise((res) => {
  const map = layout(grid);
  const ea = map[a.x + ',' + a.y], eb = map[b.x + ',' + b.y];
  if (ea) ea.style.zIndex = 3;
  if (eb) eb.style.zIndex = 3;
  world.offsetHeight;                       // commit start positions
  requestAnimationFrame(() => {
    world.classList.add('swapping');
    if (ea) place(ea, b.x, b.y);
    if (eb) place(eb, a.x, a.y);
    setTimeout(() => { world.classList.remove('swapping'); res(); }, SWAP_SLIDE_MS);
  });
});
// the Bejeweled "no match" reject: slide together, then snap back
const rejectSwap = (grid, a, b) => new Promise((res) => {
  const map = layout(grid);
  const ea = map[a.x + ',' + a.y], eb = map[b.x + ',' + b.y];
  if (ea) ea.style.zIndex = 3;
  if (eb) eb.style.zIndex = 3;
  world.offsetHeight;
  requestAnimationFrame(() => {
    world.classList.add('swapping');
    if (ea) place(ea, b.x, b.y);
    if (eb) place(eb, a.x, a.y);
    setTimeout(() => {
      if (ea) place(ea, a.x, a.y);          // ... and back
      if (eb) place(eb, b.x, b.y);
      setTimeout(() => { world.classList.remove('swapping'); res(); }, SWAP_SLIDE_MS);
    }, SWAP_SLIDE_MS);
  });
});

const playCascade = async (frames, trace, stoneSwap, skipSwap) => {
  animating = true;
  if (!skipSwap) { layout(frames[0].grid); await wait(SWAP_MS); } // show the swapped board (stone detonation etc.)
  hud.score.textContent = fmtScore(frames[0].score);
  if (skipSwap) await wait(90);            // a brief beat after the swap slide, before the first pop
  let prev = frames[0].grid;
  let pass = 0;
  for (let i = 1; i + 1 < frames.length; i += 2) {
    hud.score.textContent = fmtScore(frames[i].score);
    const mints = (trace[pass] && trace[pass].mints) || [];
    if (mints.includes('stone')) sfx('stone');                       // a straight-5 brewed the Stone
    else if (mints.includes('line') || mints.includes('area')) sfx('promote');
    else if (!(pass === 0 && stoneSwap)) sfx(pass === 0 ? 'match' : 'cascade');
    await doPop(prev, frames[i].grid);
    await doFall(frames[i].grid, frames[i + 1].grid);
    prev = frames[i + 1].grid;
    pass++;
  }
  animating = false;
  render();
};

const begin = () => { startMusic(); if (!started) { started = true; splash.style.display = 'none'; last = performance.now(); } };
const dispatch = async (action) => {
  if (animating) return; // input locked mid-animation
  const before = state;
  // a "swap move" is an explicit swap, or a select onto an armed adjacent cell
  let pair = null;
  if (action.type === 'swap') pair = { a: action.a, b: action.b };
  else if (action.type === 'select' && before.sel && manh(before.sel, { x: action.x, y: action.y }) === 1)
    pair = { a: before.sel, b: { x: action.x, y: action.y } };
  const stoneSwap = pair && (cellKind(before, pair.a) === 'stone' || cellKind(before, pair.b) === 'stone');
  const after = step(state, action);
  const committed = after.moves > before.moves; // a real swap landed

  if (pair && !committed) {                // attempted swap, no match → slide together and snap back
    state = after;                         // (clears sel, if a select drove it)
    sfx('invalid');
    animating = true;
    await rejectSwap(before.grid, pair.a, pair.b);
    animating = false;
    render();
    return;
  }
  if (after === before) return;            // nothing changed (tapped empty / same cell)
  state = after;
  if (pair && committed) {
    if (mode === 'timed' && before.level && after.level > before.level) sfx('levelup');
    animating = true;
    if (stoneSwap) {                       // the Stone activates in place (no trade), then transmutes
      sfx('stone');
      await playCascade(after.cascade, after.lastTrace, true, false);
    } else {                              // slide the two gems past each other, then cascade
      sfx('swap');
      await doSwapSlide(before.grid, pair.a, pair.b);
      await playCascade(after.cascade, after.lastTrace, false, true);
    }
    return;
  }
  render();                                // arm / deselect / reselect
};

const newRun = (m) => {
  mode = m;
  state = newGame((Date.now() & 0xffffffff) >>> 0, { mode });
  cursor = { x: 0, y: 0 };
  started = false;
  animating = false;
  splash.style.display = 'flex';
  overEl.style.display = 'none';
  hudEl.className = mode;
  freeBtn.classList.toggle('on', mode === 'free');
  timedBtn.classList.toggle('on', mode === 'timed');
  render();
};
freeBtn.addEventListener('click', () => newRun('free'));
timedBtn.addEventListener('click', () => newRun('timed'));
overEl.addEventListener('pointerdown', (e) => { e.preventDefault(); newRun(mode); });
// the splash covers the board, so its own tap must lift the gate (touch has no keyboard)
splash.addEventListener('pointerdown', (e) => { e.preventDefault(); begin(); });

// the clock: wall-time deltas → reducer tick dt (timed mode; paused during a cascade)
setInterval(() => {
  const now = performance.now();
  const dt = now - last;
  last = now;
  if (mode === 'timed' && started && !state.over && !animating) {
    const before = state;
    state = step(state, { type: 'tick', dt });
    if (state !== before) { if (!before.over && state.over) sfx('timesup'); renderHud(); }
  }
}, 100);

// --- pointer: tap a gem then an adjacent gem to swap, or drag one onto its neighbour ---
const cellFromEvent = (e) => {
  const rect = world.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / (rect.width / state.W));
  const y = Math.floor((e.clientY - rect.top) / (rect.height / state.H));
  return x >= 0 && y >= 0 && x < state.W && y < state.H ? { x, y } : null;
};
let downCell = null;
world.addEventListener('pointerdown', (e) => { e.preventDefault(); begin(); downCell = cellFromEvent(e); });
world.addEventListener('pointerup', (e) => {
  e.preventDefault();
  const up = cellFromEvent(e);
  if (!downCell || !up) { downCell = null; return; }
  if (up.x === downCell.x && up.y === downCell.y) dispatch({ type: 'select', x: up.x, y: up.y });
  else if (Math.abs(up.x - downCell.x) + Math.abs(up.y - downCell.y) === 1) dispatch({ type: 'swap', a: downCell, b: up });
  downCell = null;
});
world.addEventListener('contextmenu', (e) => e.preventDefault());

// --- keyboard: arrows move the cursor, enter arms it (and swaps into an armed neighbour) ---
const STEPS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') { e.preventDefault(); newRun(mode); return; }
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cursorSeen = true; renderCursor(); begin(); dispatch({ type: 'select', x: cursor.x, y: cursor.y }); return; }
  const d = STEPS[e.key];
  if (!d) return;
  e.preventDefault();
  cursorSeen = true;
  begin();
  cursor = { x: Math.max(0, Math.min(state.W - 1, cursor.x + d[0])), y: Math.max(0, Math.min(state.H - 1, cursor.y + d[1])) };
  renderCursor();
});

// --- fit: scale the fixed-size board to the viewport (the phone posture) ---
// The gems keep their native TP coordinate space; the wrap is transform-scaled
// as one unit, so cellFromEvent's getBoundingClientRect ratios stay true.
const boardOuter = document.getElementById('board-outer');
const boardWrapEl = document.getElementById('board-wrap');
const fitBoard = () => {
  const natW = state.W * TP, natH = state.H * TP;
  const stacked = matchMedia('(max-width: 760px)').matches;
  const chrome = stacked ? 190 : 40; // the stat strip + mode row above the board
  const k = Math.min(1, (innerWidth - 12) / natW, (innerHeight - chrome) / natH);
  boardWrapEl.style.transform = k < 1 ? 'scale(' + k + ')' : '';
  boardOuter.style.width = Math.round(natW * k) + 'px';
  boardOuter.style.height = Math.round(natH * k) + 'px';
};
addEventListener('resize', () => { fitBoard(); renderCursor(); });
fitBoard();
render();
`;

/** The playable cabinet: gem world + real-text HUD, pointer + keyboard, two modes, animated cascades, beats audio. */
export function emitPhilosophersStoneShell({ title = "Philosopher's Stone", scale = 4, music = true } = {}) {
  const TP = 16 * scale;
  return `<!doctype html><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
  body { background: #120c1c; color: #8a7ea6; display: grid; place-items: center; min-height: 100vh; min-height: 100dvh; margin: 0;
         font: 13px/1.6 'SF Mono', Menlo, Consolas, monospace; touch-action: manipulation; }
  #frame { display: flex; gap: 28px; align-items: flex-start; }
  #board-outer { position: relative; }
  #board-wrap { position: relative; transform-origin: 0 0; touch-action: none; -webkit-user-select: none; user-select: none; }
  #game { position: relative; background: #161022; border-radius: 6px; overflow: hidden; }
  .gem { position: absolute; left: 0; top: 0; width: ${TP}px; height: ${TP}px; will-change: transform; }
  .gem svg { display: block; transform-origin: center; }
  #game.falling .gem { transition: transform 380ms cubic-bezier(.34,1.28,.5,1); } /* FALL_MS; slide + a little landing bounce */
  #game.swapping .gem { transition: transform 200ms cubic-bezier(.4,0,.2,1); } /* SWAP_SLIDE_MS; the two gems trade places */
  .gem.armed { filter: drop-shadow(0 0 5px #ffe27a) brightness(1.15); z-index: 2; }
  .gem.popping { animation: popfx 300ms ease-out forwards; z-index: 3; }
  .gem.popping svg { transition: transform 300ms ease-in; transform: scale(0.18); }
  @keyframes popfx { 0% { filter: brightness(2); } 100% { opacity: 0; filter: brightness(2); } }
  #cursor { position: absolute; left: 0; top: 0; box-sizing: border-box; border: 3px solid #ffe27a;
            border-radius: 6px; pointer-events: none; transition: transform 80ms ease-out; box-shadow: 0 0 10px rgba(255,226,122,0.5); z-index: 4; }
  #splash, #over { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
                   background: rgba(18,12,28,0.86); border-radius: 6px; text-align: center; cursor: pointer; z-index: 5; }
  #over { display: none; }
  #splash h2 { color: #c9a227; letter-spacing: 3px; font-size: 18px; margin: 0 0 8px; }
  #splash p, #over .card { color: #8a7ea6; margin: 2px; font-size: 12px; }
  #over .card { color: #f2eefb; font-size: 16px; }
  #over #over-msg { color: #e8564a; font-size: 18px; margin-bottom: 6px; }
  #hud { display: flex; flex-direction: column; min-width: 188px; padding-top: 6px; }
  #hud h1 { font-size: 14px; letter-spacing: 2px; color: #c9a227; margin: 0 0 4px; font-weight: 600; }
  #hud .sub { color: #6b5f86; margin-bottom: 12px; font-size: 11px; }
  #modes { display: flex; gap: 6px; margin-bottom: 12px; }
  #modes button { flex: 1; border: 2px solid #38304a; background: #1c1428; color: #8a7ea6; font: inherit; font-size: 11px;
                  padding: 6px 4px; border-radius: 14px; cursor: pointer; }
  #modes button.on { background: #c9a227; color: #1c1428; border-color: #ffe27a; }
  #hud .label { font-size: 11px; letter-spacing: 3px; color: #7e6f96; margin-top: 12px; }
  #hud .value { font-size: 26px; color: #f2eefb; }
  #hud .value.sm { font-size: 18px; }
  #timebar { height: 12px; border-radius: 6px; background: #241a30; margin-top: 4px; overflow: hidden; }
  #timebar-fill { height: 100%; width: 100%; background: #33c866; transition: width 120ms linear, background 300ms; }
  #time { float: right; color: #f2eefb; letter-spacing: 0; }
  .timed-only, .free-only { display: none; }
  #hud.timed .timed-only { display: block; }
  #hud.free .free-only { display: block; }
  #legend { margin-top: 18px; font-size: 11px; color: #6b5f86; line-height: 1.7; }
  #legend b { color: #c9a227; font-weight: 600; }
  #audio { margin-top: 16px; }
  #mute-btn { border: 2px solid #38304a; background: #1c1428; color: #8a7ea6; font: inherit; font-size: 11px; padding: 6px 12px; border-radius: 14px; cursor: pointer; }
  #mute-btn.muted { color: #4a4458; text-decoration: line-through; }
  #keys { text-align: center; margin-top: 16px; color: #6b5f86; font-size: 11px; }
  /* the phone posture: mode row + stat strip above a fit-scaled board */
  @media (max-width: 760px) {
    body { place-items: start center; padding: 8px 0 calc(8px + env(safe-area-inset-bottom)); }
    #frame { flex-direction: column-reverse; align-items: center; gap: 10px; }
    #hud { flex-direction: row; flex-wrap: wrap; justify-content: center; align-items: end;
           column-gap: 16px; row-gap: 2px; min-width: 0; padding: 0; max-width: 96vw; }
    #hud h1 { width: 100%; text-align: center; margin: 0; font-size: 12px; }
    #hud .sub, #legend { display: none; }
    #modes { width: 100%; justify-content: center; margin: 4px 0 2px; }
    #modes button { flex: 0 1 132px; }
    #hud .label { margin-top: 0; font-size: 9px; text-align: center; }
    #hud .value { font-size: 16px; text-align: center; }
    #hud .value.sm { font-size: 13px; }
    #time-stat { width: 100%; order: 9; margin-top: 2px; }
    #audio { order: 10; margin: 2px 0 0; }
    #keys { display: none; }
  }
</style>
<div>
  <div id="frame">
    <div id="board-outer"><div id="board-wrap">
      <div id="game"></div>
      <div id="cursor"></div>
      <div id="splash"><h2>PHILOSOPHER'S STONE</h2><p>swap adjacent reagents to make 3+</p><p>4 &rarr; Aqua Vitae &middot; L/T &rarr; Athanor &middot; 5 &rarr; the Stone</p><p style="margin-top:10px;color:#c9a227">tap, click, or press a key to begin</p></div>
      <div id="over"><div class="card"><div id="over-msg"></div>tap or press r to retry</div></div>
    </div></div>
    <div id="hud" class="free">
      <h1>PHILOSOPHER'S STONE</h1>
      <div class="sub">a cute-alchemy transmutation</div>
      <div id="modes">
        <button id="free-btn" class="on">Free Play</button>
        <button id="timed-btn">Alchemist's Trial</button>
      </div>
      <div class="stat timed-only"><div class="label">LEVEL</div><div class="value" id="level"></div></div>
      <div class="stat timed-only" id="time-stat">
        <div class="label">TIME <span id="time"></span></div>
        <div id="timebar"><div id="timebar-fill"></div></div>
      </div>
      <div class="stat"><div class="label">SCORE</div><div class="value" id="score"></div></div>
      <div class="stat timed-only"><div class="label">TARGET</div><div class="value sm" id="target"></div></div>
      <div class="stat free-only"><div class="label">MOVES</div><div class="value" id="moves"></div></div>
      <div class="stat"><div class="label">STONES BREWED</div><div class="value" id="stones"></div></div>
      <div class="stat free-only"><div class="label">CASCADE</div><div class="value" id="chain"></div></div>
      <div id="legend">
        <b>Aqua Vitae</b> — a bar; clears its line<br>
        <b>Athanor</b> — a furnace; bursts 3×3<br>
        <b>Philosopher's Stone</b> — swap onto a<br>reagent to transmute that whole colour
      </div>${music ? '\n      <div id="audio"><button id="mute-btn" aria-pressed="false" aria-label="mute music">&#9834; music</button></div>' : ''}
    </div>
  </div>
  <div id="keys">drag or tap-tap adjacent gems &middot; arrows move cursor &middot; enter selects &middot; r restart</div>
</div>
<script>
${inlineSource('pixelizer.js')}
${inlineSource('philosophers-stone-core.js')}
${inlineSource('philosophers-stone-skin.js')}
${music ? beatsBundle() : ''}
${shell({ scale, music })}
</script>
`;
}
