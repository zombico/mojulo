/**
 * brickster shell — the served/standalone playable, as ONE reusable emitter.
 *
 * The raster/overlay tetris folded into a self-contained HTML page: the pure
 * modules (pixelizer + brickster-core + brickster-skin) inlined by naive
 * concatenation (they only import from each other, so stripping import lines
 * and `export ` yields one classic script), a thin imperative shell (keys +
 * gravity timer + touch pad + start gate), and — opt-in — the beats soundtrack
 * (GROOVE default, POLKA secondary, tempo scaled to level) with SFX cues.
 *
 * This is the single source of truth for the picture: the gen spike writes it
 * to disk for eyeballing, and `/api/sketches/<ref>/game` serves it live for the
 * Mojulo Arcade cabinet (the pixelizer branch beside the world-game shell).
 * Recipes, not renders — the sketch row stores a tiny manifest; the HTML is
 * regenerated here per request.
 *
 * Source is read from `process.cwd()/lib/graph/pixelizer` (control is the cwd
 * for both `next` and the vitest spike run), so this survives Next's bundler
 * where `import.meta.url` would resolve into `.next/`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildBeatsKernel } from '../beats/beats-kernel.js';
import { PATCHES } from '../beats/audio-patches.js';
import { GROOVE, POLKA, SFX } from './brickster-audio.recipe.js';

const SRC = join(process.cwd(), 'lib', 'graph', 'pixelizer');

/** Read a sibling pixelizer module and strip its import/export lines to inline it. */
export const inlineSource = (file) =>
  readFileSync(join(SRC, file), 'utf8')
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/^export /gm, '');

// The soundtrack shell add-on: the beats kernel synthesizes everything at play
// time from the recipes (KERNEL/PATCHES/POLKA/GROOVE/SFX consts are emitted by
// the bundle). Autoplay policy: the transport starts on the first real input.
// Mute is master gain 0 — the transport keeps running, per the beats doctrine.
// The polka is a composition and the kernel does not wrap those, so musicTick()
// re-enters startComposition at the loop point; scheduled tails ring across the
// seam because stopTransport only clears the scheduler timer. Game events map
// to the brickster-sfx cue bank inside gameSfx().
export const MUSIC_SHELL = `
// Tempo rides the game: each track is (re)laid at a bpm scaled by the current
// level, so the soundtrack tightens as the well speeds up. GROOVE is the
// default (a looping pattern); POLKA is the secondary toggle (a composition,
// which musicTick re-enters at each loop point — now at the live tempo).
const tempoScale = () => 1 + Math.min(levelOf(state) * 0.05, 0.6); // up to +60% by level 12
const atTempo = (recipe) => ({ ...recipe, bpm: Math.round(recipe.bpm * tempoScale()) });
const TRACKS = [
  { label: 'GROOVE', start: (e) => e.startPattern(atTempo(GROOVE), PATCHES), loopSec: () => 0 },
  { label: 'POLKA', start: (e) => e.startComposition(atTempo(POLKA), PATCHES),
    loopSec: () => KERNEL.compositionEvents(atTempo(POLKA)).duration },
];
let actx = null, beng = null, musicStarted = false, muted = false, trackIdx = 0, loopAt = 0, musicLevel = 0;
const ensureAudio = () => {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    beng = KERNEL.createEngine(actx, {});
    beng.setMuted(muted);
  }
  if (actx.state === 'suspended') actx.resume();
};
const playTrack = () => {
  const tr = TRACKS[trackIdx];
  tr.start(beng);
  const ls = tr.loopSec();
  loopAt = ls ? actx.currentTime + 0.08 + ls : 0;
  musicLevel = levelOf(state);       // the level this laydown was tempo'd for
};
const startMusic = () => {
  ensureAudio();
  if (!musicStarted) { playTrack(); musicStarted = true; }
};
// re-lay the track when the level ticks up (new tempo) or a composition loops out.
const musicTick = () => {
  if (!musicStarted) return;
  if (levelOf(state) !== musicLevel) playTrack();
  else if (loopAt && actx.currentTime >= loopAt) playTrack();
};
const sfx = (id) => { if (beng) beng.playCue(SFX.cues[id]); };
const gameSfx = (before, after, action) => {
  if (!beng) return;
  if (!before.over && after.over) return sfx('gameover');
  const cleared = after.lines - before.lines;
  if (cleared >= 4) return sfx('tetris');
  if (cleared > 0) return sfx(levelOf(after) > levelOf(before) ? 'levelup' : 'lineclear');
  if (action === 'hold') return sfx('hold');
  if (action === 'cw' || action === 'ccw') return sfx('rotate');
  if (action === 'hardDrop') return sfx('harddrop');
  if (after.board !== before.board) return sfx('lock');
};
const muteBtn = document.getElementById('mute-btn');
muteBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  ensureAudio();
  muted = !muted;
  muteBtn.classList.toggle('muted', muted);
  muteBtn.setAttribute('aria-pressed', String(muted));
  beng.setMuted(muted);
});
muteBtn.addEventListener('contextmenu', (e) => e.preventDefault());
const trackBtn = document.getElementById('track-btn');
trackBtn.textContent = TRACKS[trackIdx].label;
trackBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  ensureAudio();
  trackIdx = (trackIdx + 1) % TRACKS.length;
  trackBtn.textContent = TRACKS[trackIdx].label;
  playTrack();
  musicStarted = true;
});
trackBtn.addEventListener('contextmenu', (e) => e.preventDefault());
`;

export const shell = ({ padDefault = false, music = false } = {}) => `
// --- render: world raster into #game, overlay view-model into real DOM ---
const world = document.getElementById('game');
const hud = {
  hold: document.getElementById('hold-prev'), next: document.getElementById('next-prev'),
  score: document.getElementById('score'), lines: document.getElementById('lines'), level: document.getElementById('level'),
  msg: document.getElementById('msg'), msgText: document.getElementById('msg-text'),
};
let state = newGame((Date.now() & 0xffffffff) >>> 0);
const render = () => {
  world.innerHTML = renderWorldSvg(state, 4);
  const o = resolveOverlay(state);          // pure facts, no pixels
  hud.hold.innerHTML = renderPreviewSvg(o.hold, 4);
  hud.next.innerHTML = renderPreviewSvg(o.next, 4);
  hud.score.textContent = o.score;
  hud.lines.textContent = o.lines;
  hud.level.textContent = o.level;
  const startPrompt = !started;             // the game waits at a start gate until first input
  hud.msg.style.display = (startPrompt || o.message) ? 'flex' : 'none';
  hud.msgText.textContent = startPrompt
    ? 'BRICKSTER — press enter / tap to start'
    : (o.message ? o.message + ' — enter to restart' : '');
};
let started = false;
let last = performance.now();
const begin = () => { started = true; last = performance.now(); render(); }; // lift the gate; gravity starts now
const dispatch = (action) => {
  const before = state;
  state = step(state, action);
  if (action === 'hardDrop' || action === 'restart') last = performance.now();
  if (state !== before) { gameSfx(before, state, action); render(); }
};

// --- touch pad: a knob + a HOLD button, a second translator beside KEYS ---
// Drag past the dead zone = held direction (left/right = shift with DAS
// repeat, down = soft drop, up = rotate at a capped rate). A tap fires the
// zone's action once. Holding the center 2s = hard drop. Game over: tap =
// restart. ?knob=1 forces the pad on, ?knob=0 hides it.
const padEl = document.getElementById('pad');
const knob = document.getElementById('knob');
const thumb = document.getElementById('thumb');
const touchKeys = document.getElementById('touch-keys');
const touchBtn = document.getElementById('touch-btn'); // the UI toggle (may be absent)
const knobOpt = new URLSearchParams(location.search).get('knob');
// on by default on coarse pointers; the toggle summons the same pad on desktop.
let touchOn = ${padDefault ? "knobOpt !== '0'" : "knobOpt === '1' || (knobOpt !== '0' && matchMedia('(pointer: coarse)').matches)"};
const applyTouch = () => {
  padEl.style.display = touchOn ? 'flex' : 'none';
  if (touchKeys) touchKeys.style.display = touchOn ? 'block' : 'none';
  if (touchBtn) { touchBtn.classList.toggle('on', touchOn); touchBtn.setAttribute('aria-pressed', String(touchOn)); }
};
if (touchBtn) touchBtn.addEventListener('click', (e) => { e.preventDefault(); touchOn = !touchOn; applyTouch(); fitBoard(); });
applyTouch();

// --- fit: scale the fixed scale-4 board to the viewport (the phone posture) ---
// The world keeps rendering at its native integer scale; the wrap is transform-
// scaled as one unit, so hit-metrics (getBoundingClientRect ratios) stay true.
const boardOuter = document.getElementById('board-outer');
const boardWrap = document.getElementById('board-wrap');
const NAT_W = COLS * 8 * 4, NAT_H = ROWS * 8 * 4; // the scale-4 world raster in px
const fitBoard = () => {
  const stacked = matchMedia('(max-width: 620px)').matches;
  const chrome = stacked ? (touchOn ? 320 : 150) : 60; // HUD strip + audio row (+ pad)
  const k = Math.min(1, (innerWidth - 16) / NAT_W, (innerHeight - chrome) / NAT_H);
  boardWrap.style.transform = k < 1 ? 'scale(' + k + ')' : '';
  boardOuter.style.width = Math.round(NAT_W * k) + 'px';
  boardOuter.style.height = Math.round(NAT_H * k) + 'px';
};
addEventListener('resize', fitBoard);
fitBoard();
${music ? MUSIC_SHELL : 'const startMusic = () => {}, musicTick = () => {}, gameSfx = () => {};'}

const DEAD = 14, DAS = 150, REPEAT = 55, ROTATE_MS = 220, LONG_PRESS = 2000, TAP_MS = 250;
const DIR_ACT = { left: 'left', right: 'right', up: 'cw', down: 'softDrop' };
const dirOf = (dx, dy) => Math.hypot(dx, dy) < DEAD ? null
  : Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
let ptr = null; // the one finger on the knob: origin, held dir, repeat deadline, long-press timer

knob.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  startMusic();
  if (!started) { begin(); return; } // first touch lifts the start gate
  knob.setPointerCapture(e.pointerId);
  ptr = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dir: null, nextAt: 0,
    downAt: performance.now(), fired: false,
    hardTimer: setTimeout(() => { if (ptr && !ptr.dir) { ptr.fired = true; dispatch('hardDrop'); } }, LONG_PRESS) };
});
knob.addEventListener('pointermove', (e) => {
  if (!ptr || e.pointerId !== ptr.id) return;
  const dx = e.clientX - ptr.ox, dy = e.clientY - ptr.oy;
  const len = Math.hypot(dx, dy), r = Math.min(len, 30);
  thumb.style.transform = len ? 'translate(' + (dx / len) * r + 'px,' + (dy / len) * r + 'px)' : '';
  const dir = dirOf(dx, dy);
  if (dir === ptr.dir) return;
  ptr.dir = dir; // re-entering the dead zone (dir null) stops the repeat
  if (dir) {
    clearTimeout(ptr.hardTimer);
    dispatch(DIR_ACT[dir]);
    ptr.nextAt = performance.now() + (dir === 'up' ? ROTATE_MS : DAS);
  }
});
const endPtr = (e) => {
  if (!ptr || e.pointerId !== ptr.id) return;
  clearTimeout(ptr.hardTimer);
  if (!ptr.dir && !ptr.fired && performance.now() - ptr.downAt < TAP_MS) {
    if (state.over) dispatch('restart');
    else {
      const rect = knob.getBoundingClientRect();
      const dir = dirOf(ptr.ox - (rect.left + rect.width / 2), ptr.oy - (rect.top + rect.height / 2));
      if (dir) dispatch(DIR_ACT[dir]);
    }
  }
  ptr = null;
  thumb.style.transform = '';
};
knob.addEventListener('pointerup', endPtr);
knob.addEventListener('pointercancel', endPtr);
knob.addEventListener('contextmenu', (e) => e.preventDefault());

const holdBtn = document.getElementById('hold-btn');
holdBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); startMusic(); if (!started) { begin(); return; } dispatch('hold'); });
holdBtn.addEventListener('contextmenu', (e) => e.preventDefault());

// the message card promises "tap to start" / "tap restarts" — honor it directly
hud.msg.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  startMusic();
  if (!started) begin();
  else if (state.over) dispatch('restart');
});

setInterval(() => {
  const now = performance.now();
  if (started && !state.over && now - last >= gravityMs(state)) { state = step(state, 'tick'); last = now; render(); }
  if (ptr && ptr.dir && now >= ptr.nextAt) {
    dispatch(DIR_ACT[ptr.dir]);
    ptr.nextAt = now + (ptr.dir === 'up' ? ROTATE_MS : REPEAT);
  }
  musicTick();
}, 30);
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'softDrop', ArrowUp: 'cw',
  ' ': 'hardDrop', x: 'cw', z: 'ccw', c: 'hold', Shift: 'hold', Enter: 'restart',
};
addEventListener('keydown', (e) => {
  const action = KEYS[e.key];
  if (!action) return;
  e.preventDefault();
  startMusic();
  if (!started) { begin(); return; } // first key lifts the start gate, doesn't act
  dispatch(action);
});
render();
`;

// The overlay markup shared by the single-player pages: a real-text HUD panel
// beside the world, and a GAME OVER card layered over the board (role="status").
export const HUD_HTML = `
  <div id="hud">
    <h1>BRICKSTER</h1>
    <div class="stat"><div class="label">NEXT</div><div id="next-prev" class="prev"></div></div>
    <div class="stat"><div class="label">SCORE</div><div class="value" id="score"></div></div>
    <div class="stat"><div class="label">LINES</div><div class="value" id="lines"></div></div>
    <div class="stat"><div class="label">LEVEL</div><div class="value" id="level"></div></div>
    <div id="hold-block" class="stat">
      <div class="label">HOLD</div><div id="hold-prev" class="prev"></div>
    </div>
  </div>`;

// The HUD is a full-height column: NEXT + stats ride the top, HOLD is pushed
// to the floor (margin-top:auto) so it sits away from the top and away from
// the next piece — the placement note made structural, not a hardcoded gap.
export const HUD_CSS = `
  #frame { display: flex; gap: 24px; align-items: stretch; }
  #board-outer { position: relative; }
  #board-wrap { position: relative; transform-origin: 0 0; }
  #game svg { display: block; }
  #hud { display: flex; flex-direction: column; padding: 6px 0; min-width: 150px; }
  #hud h1 { font-size: 15px; letter-spacing: 4px; color: #e8b040; margin: 0 0 8px; font-weight: 600; }
  #hud .label { font-size: 11px; letter-spacing: 3px; color: #7e8698; margin-top: 16px; }
  #hud .value { font-size: 24px; color: #f2f4f8; }
  #hud .prev { height: 40px; margin-top: 4px; }
  #hud .prev svg { display: block; }
  #hold-block { margin-top: auto; }
  #msg { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; }
  #msg .card { background: rgba(12,12,22,0.94); border: 1px solid #3a4258; border-radius: 8px;
               padding: 16px 24px; color: #f2f4f8; font-size: 15px; text-align: center; }`;

/** The beats bundle: kernel serialized + recipes as JSON. Emitted only in music mode. */
export const beatsBundle = () => `
const KERNEL = (${buildBeatsKernel.toString()})();
const PATCHES = ${JSON.stringify(PATCHES)};
const POLKA = ${JSON.stringify(POLKA)};
const GROOVE = ${JSON.stringify(GROOVE)};
const SFX = ${JSON.stringify(SFX)};
`;

/**
 * The playable cabinet: world raster + real-text HUD, keyboard + touch (with a
 * desktop toggle), optional soundtrack. `touchDefault` shows the pad up front
 * (the phone posture); `music` folds in the beats bundle + track/mute controls.
 */
export function emitBricksterShell({ music = true, touchDefault = false, title = 'brickster' } = {}) {
  const audioButtons = music
    ? `
    <button id="track-btn" aria-label="switch soundtrack"></button>
    <button id="mute-btn" aria-pressed="false" aria-label="mute music">&#9834;</button>`
    : '';
  return `<!doctype html><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
  body { background: #14141f; color: #8a8a99; display: grid; place-items: center; min-height: 100vh; min-height: 100dvh; margin: 0;
         font: 13px/1.6 'SF Mono', Menlo, Consolas, monospace; touch-action: manipulation; }
${HUD_CSS}
  #keys { text-align: center; margin-top: 10px; }
  #pad { display: none; justify-content: space-between; align-items: center; margin-top: 18px; padding: 0 8px;
         touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  #knob { width: 128px; height: 128px; border-radius: 50%; border: 3px solid #38383f; background: #1c1c26;
          display: grid; place-items: center; touch-action: none; }
  #thumb { width: 56px; height: 56px; border-radius: 50%; background: #68687c; border: 3px solid #8a8a99; pointer-events: none; }
  #hold-btn { width: 68px; height: 68px; border-radius: 50%; border: 3px solid #38383f; background: #1c1c26;
              color: #8a8a99; font: inherit; touch-action: none; -webkit-user-select: none; user-select: none; }
  #hold-btn:active { background: #68687c; color: #16161e; }
  #audio { display: flex; gap: 10px; justify-content: center; margin-top: 14px; }
  #audio button { border: 2px solid #38383f; background: #1c1c26; color: #8a8a99; font: inherit; cursor: pointer; }
  #audio button:active { background: #68687c; color: #16161e; }
  #track-btn { min-width: 82px; height: 34px; border-radius: 17px; }
  #touch-btn { min-width: 66px; height: 34px; border-radius: 17px; }
  #mute-btn { width: 34px; height: 34px; border-radius: 50%; font-size: 15px; }
  #mute-btn.muted { color: #4a4a55; text-decoration: line-through; }
  #audio button.on { background: #68687c; color: #16161e; border-color: #8a8a99; }
  #touch-keys { display: none; text-align: center; margin-top: 8px; color: #66667a; }
  /* the phone posture: stat strip above a fit-scaled board, pad below */
  @media (max-width: 620px) {
    body { place-items: start center; padding: 10px 0 calc(8px + env(safe-area-inset-bottom)); }
    #frame { flex-direction: column-reverse; align-items: center; gap: 10px; }
    #hud { flex-direction: row; flex-wrap: wrap; justify-content: center; align-items: end;
           column-gap: 18px; row-gap: 4px; min-width: 0; padding: 0; max-width: 94vw; }
    #hud h1 { display: none; }
    #hud .label { margin-top: 0; font-size: 9px; text-align: center; }
    #hud .value { font-size: 17px; text-align: center; }
    #hud .prev { height: 30px; margin-top: 2px; }
    #hud .prev svg { height: 30px; width: auto; }
    #hold-block { margin-top: 0; }
    #keys { display: none; }
    #audio { margin-top: 10px; }
    #pad { margin-top: 12px; padding: 0 14px; }
  }
</style>
<div>
  <div id="frame">
    <div id="board-outer"><div id="board-wrap">
      <div id="game"></div>
      <div id="msg"><div class="card" id="msg-text" role="status"></div></div>
    </div></div>${HUD_HTML}
  </div>
  <div id="audio">
    <button id="touch-btn" aria-pressed="false" aria-label="toggle touch controls">touch</button>${audioButtons}
  </div>
  <div id="pad">
    <button id="hold-btn">HOLD</button>
    <div id="knob"><div id="thumb"></div></div>
  </div>
  <div id="keys">&larr;&rarr; move &middot; &darr; soft &middot; space hard &middot; z/x/&uarr; rotate &middot; c hold &middot; enter restart</div>
  <div id="touch-keys">drag: move/rotate/soft &middot; tap: nudge &middot; hold center 2s: hard drop &middot; game over: tap restarts</div>
</div>
<script>
${inlineSource('pixelizer.js')}
${inlineSource('brickster-core.js')}
${inlineSource('brickster-skin.js')}
${music ? beatsBundle() : ''}
${shell({ padDefault: touchDefault, music })}
</script>
`;
}
