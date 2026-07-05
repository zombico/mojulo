/**
 * beats-player — emitBeatsPlayer(manifest) → a fully self-contained HTML player
 * page for a stored beats artifact (beats.plan.md). The spike page distilled:
 * a transport button, per-channel strips with chain labels + mutes, and a live
 * oscilloscope. No dependencies, no network, no media bytes — the kernel is
 * emitted via buildBeatsKernel.toString() (the physics-sim/event-bus discipline)
 * and every sound is synthesized at play time from the stored recipe.
 *
 * Served by /api/sketches/[ref]/beats (Cache-Control: no-store), embedded as an
 * <iframe> by the /sketches/[ref] page (render mode 'beats').
 *
 * The page renders state and mutes channels; it does not author — the recipe
 * stays the only source of truth (beats.plan.md → "Deliberately out").
 */

import { buildBeatsKernel } from './beats-kernel.js';
import { PATCHES } from './audio-patches.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function chainLabel(chain) {
  if (!Array.isArray(chain) || !chain.length) return 'dry';
  return chain.map((f) => f.type).join(' → ');
}

function stripRows(manifest) {
  if (manifest.kind === 'beats-sfx') {
    return Object.entries(manifest.cues).map(([id, list]) => `
      <div class="strip">
        <span class="name">${esc(id)}</span>
        <span class="role">cue</span>
        <span class="chain">${esc(list.map((g) => g.type).join(' + '))}</span>
        <button class="fire" data-cue="${esc(id)}">FIRE</button>
      </div>`).join('');
  }
  const rows = manifest.kind === 'beats-ambient' ? manifest.channels
    : manifest.kind === 'beats-pattern' ? manifest.tracks
    : manifest.parts;
  // a pattern track's instrument is a patch OR a gesture/cue (B5.1).
  const instrument = (ch) => ch.patch || (ch.cue ? ch.cue.map((g) => g.type).join(' + ') : ch.gesture ? ch.gesture.type : '');
  return rows.map((ch) => `
    <div class="strip">
      <span class="name">${esc(ch.name)}</span>
      <span class="role">${esc(ch.role || (manifest.kind === 'beats-pattern' ? 'track' : 'part'))}</span>
      <span class="chain"><b>${esc(instrument(ch))}</b> → ${esc(chainLabel(ch.chain))}</span>
      <button class="mute" data-ch="${esc(ch.name)}" aria-pressed="false">MUTE</button>
    </div>`).join('');
}

export function emitBeatsPlayer(manifest) {
  const isSfx = manifest.kind === 'beats-sfx';
  const facts = isSfx
    ? `${Object.keys(manifest.cues).length} cue${Object.keys(manifest.cues).length === 1 ? '' : 's'} · synthesized foley`
    : `${manifest.bpm} BPM${manifest.swing ? ` · swing ${Math.round(manifest.swing * 100)}%` : ''}${manifest.kind === 'beats-ambient' ? ` · seed ${manifest.seed}` : ''}${manifest.kind === 'beats-pattern' ? ` · ${manifest.steps} steps` : ''}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(manifest.title)}</title>
<style>
  :root { --ground:#131320; --panel:#1d1d30; --edge:#2b2b44; --text:#c9c7de; --dim:#807da0; --amber:#ffb454; --teal:#5fd4c4;
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  html { background: var(--ground); }
  body { margin:0; font-family: system-ui, sans-serif; color: var(--text); line-height:1.5; }
  .wrap { max-width:720px; margin:0 auto; padding:36px 20px 56px; display:flex; flex-direction:column; gap:24px; }
  .eyebrow { font-family:var(--mono); font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--dim); }
  h1 { font-family: Georgia, serif; font-style: italic; font-weight:400; font-size:clamp(28px,6vw,40px); margin:2px 0 0; color:#eceafb; }
  .facts { font-family:var(--mono); font-size:12px; color:var(--dim); font-variant-numeric:tabular-nums; }
  .scope { background:#0d0d18; border:1px solid var(--edge); border-radius:4px; height:96px; position:relative; overflow:hidden; }
  .scope canvas { display:block; width:100%; height:100%; }
  .transport { display:flex; align-items:center; gap:20px; }
  #play { width:72px; height:72px; border-radius:50%; border:2px solid #b87428; color:var(--amber);
    background: radial-gradient(circle at 38% 32%, #2b2138, #171224 70%); cursor:pointer; display:grid; place-items:center; flex-shrink:0; }
  #play:hover { border-color: var(--amber); }
  #play:focus-visible { outline:2px solid var(--teal); outline-offset:3px; }
  #play svg { width:24px; height:24px; fill:currentColor; }
  #play.on { border-color:var(--amber); box-shadow:0 0 22px rgba(255,180,84,.25); }
  .state { font-family:var(--mono); font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--dim); }
  .state.live { color: var(--teal); }
  .strips { display:flex; flex-direction:column; gap:10px; }
  .strip { background:var(--panel); border:1px solid var(--edge); border-radius:4px; padding:11px 14px;
    display:grid; grid-template-columns:96px 1fr auto; gap:2px 14px; align-items:center; }
  .strip .name { font-weight:600; font-size:14px; color:#eceafb; }
  .strip .role { grid-column:1; font-family:var(--mono); font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--dim); }
  .strip .chain { grid-column:2; grid-row:1 / span 2; font-family:var(--mono); font-size:12px; color:var(--dim); overflow-x:auto; white-space:nowrap; }
  .strip .chain b { color:var(--amber); font-weight:500; }
  .mute, .fire { grid-column:3; grid-row:1 / span 2; font-family:var(--mono); font-size:11px; letter-spacing:.14em;
    border:1px solid #2e5e57; background:transparent; color:var(--teal); border-radius:3px; padding:6px 12px; cursor:pointer; }
  .mute:focus-visible, .fire:focus-visible { outline:2px solid var(--teal); outline-offset:2px; }
  .mute[aria-pressed="true"] { color:var(--dim); border-color:var(--edge); background:#16162a; }
  .fire { border-color:#7a5a2c; color:var(--amber); }
  @media (max-width:520px) { .strip { grid-template-columns:1fr auto; } .strip .chain { grid-column:1 / -1; grid-row:3; } .mute,.fire { grid-column:2; grid-row:1 / span 2; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="eyebrow">Mojulo Beats · ${esc(manifest.kind)}</div>
    <h1>${esc(manifest.title)}</h1>
    <div class="facts">${esc(facts)}</div>
  </header>
  <div class="scope"><canvas id="scope"></canvas></div>
  ${isSfx ? '' : `
  <div class="transport">
    <button id="play" aria-label="Play">
      <svg id="ic-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>
      <svg id="ic-stop" viewBox="0 0 24 24" aria-hidden="true" style="display:none"><path d="M6 6h12v12H6z"/></svg>
    </button>
    <span class="state" id="state">Stopped — press play</span>
  </div>`}
  <div class="strips">${stripRows(manifest)}</div>
</div>
<script>
const MANIFEST = ${JSON.stringify(manifest)};
const PATCHES = ${JSON.stringify(PATCHES)};
const KERNEL = (${buildBeatsKernel.toString()})();
let ctx = null, engine = null, analyser = null, playing = false;

function ensureEngine() {
  if (engine) { if (ctx.state === 'suspended') ctx.resume(); return engine; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  engine = KERNEL.createEngine(ctx, { analyser });
  return engine;
}

// ── transport (ambient / composition) ──────────────────────────────────────
const playBtn = document.getElementById('play');
if (playBtn) {
  const stateEl = document.getElementById('state');
  playBtn.addEventListener('click', () => {
    const eng = ensureEngine();
    playing = !playing;
    if (playing) {
      if (MANIFEST.kind === 'beats-ambient') eng.startAmbient(MANIFEST, PATCHES);
      else if (MANIFEST.kind === 'beats-pattern') eng.startPattern(MANIFEST, PATCHES);
      else eng.startComposition(MANIFEST, PATCHES);
      stateEl.textContent = 'Playing'; stateEl.classList.add('live'); playBtn.classList.add('on');
    } else {
      eng.stop();
      stateEl.textContent = 'Stopped — press play'; stateEl.classList.remove('live'); playBtn.classList.remove('on');
    }
    document.getElementById('ic-play').style.display = playing ? 'none' : '';
    document.getElementById('ic-stop').style.display = playing ? '' : 'none';
    playBtn.setAttribute('aria-label', playing ? 'Stop' : 'Play');
  });
}

// ── channel mutes ───────────────────────────────────────────────────────────
document.querySelectorAll('.mute').forEach((btn) => {
  btn.addEventListener('click', () => {
    const eng = ensureEngine();
    const muted = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-pressed', String(!muted));
    eng.channelGain(btn.dataset.ch).gain.value = muted ? 1 : 0;
  });
});

// ── sfx cue firing ──────────────────────────────────────────────────────────
document.querySelectorAll('.fire').forEach((btn) => {
  btn.addEventListener('click', () => {
    const eng = ensureEngine();
    playing = true; // light the scope
    eng.playCue(MANIFEST.cues[btn.dataset.cue]);
  });
});

// ── oscilloscope ────────────────────────────────────────────────────────────
const canvas = document.getElementById('scope');
const g2d = canvas.getContext('2d');
function resize() { const dpr = window.devicePixelRatio || 1; canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr; }
resize();
window.addEventListener('resize', resize);
const wave = new Float32Array(2048);
(function draw() {
  requestAnimationFrame(draw);
  const w = canvas.width, h = canvas.height;
  g2d.fillStyle = '#0d0d18'; g2d.fillRect(0, 0, w, h);
  g2d.strokeStyle = '#22213a'; g2d.lineWidth = 1;
  g2d.beginPath(); g2d.moveTo(0, h / 2); g2d.lineTo(w, h / 2); g2d.stroke();
  if (analyser) analyser.getFloatTimeDomainData(wave); else wave.fill(0);
  g2d.strokeStyle = playing ? '#ffb454' : '#4a4870';
  g2d.lineWidth = Math.max(1.5, (window.devicePixelRatio || 1) * 1.25);
  g2d.beginPath();
  for (let i = 0; i < wave.length; i++) {
    const x = (i / (wave.length - 1)) * w, y = h / 2 + wave[i] * h * 0.45;
    if (i === 0) g2d.moveTo(x, y); else g2d.lineTo(x, y);
  }
  g2d.stroke();
})();
</script>
</body>
</html>`;
}
