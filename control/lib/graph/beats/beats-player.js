/**
 * beats-player — emitBeatsPlayer(manifest, opts?) → a fully self-contained HTML
 * player page for a stored beats artifact (beats.plan.md). The spike page
 * distilled: a transport button, per-channel strips with chain labels + mutes +
 * B5.2 macro sliders, a live oscilloscope, and — for the pattern kind — the
 * GRID itself with a playhead sweep (B9.2: the manifest already IS the grid, so
 * show it). No dependencies, no network, no media bytes — the kernel is emitted
 * via buildBeatsKernel.toString() (the physics-sim/event-bus discipline) and
 * every sound is synthesized at play time from the stored recipe.
 *
 * Served by /api/beats/[ref] (canonical, `?rev=` plays any revision) and the
 * /api/sketches/[ref]/beats alias (Cache-Control: no-store), embedded as an
 * <iframe> by the /beats/[ref] studio and the /sketches/[ref] page.
 *
 * opts (all optional — bare emitBeatsPlayer(manifest) is the pre-B9 page):
 *   ref         — the artifact's ref (shown as page identity)
 *   rev         — shown in the facts line
 *   annotations — open annotations to render as grid/timeline markers
 *
 * The page renders state, mutes channels, and performs macros; it does not
 * author — the recipe stays the only source of truth. Annotation WRITES stay
 * on the MCP (`annotate_beats`): the player renders marks read-only, and a
 * change worth keeping is described to the host agent, which applies it via
 * update_beats (beats.plan.md B9 → "Deliberately out").
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
  // B5.2 performance macros: transpose (pitched voices only — gestures carry
  // their own pitch choreography) and tone (every channel: the low-pass sits at
  // the chain head, so it darkens gestures and delay tails alike). Sliders are
  // performance, not authoring: they drive the live engine and never write back.
  const macroRow = (ch) => {
    const pitched = !ch.cue && !ch.gesture;
    const tr = ch.transpose || 0;
    const tn = ch.tone == null ? 1 : ch.tone;
    return `
      <span class="macros">
        ${pitched ? `<label>pitch <input type="range" class="macro-tr" data-ch="${esc(ch.name)}" min="-12" max="12" step="1" value="${tr}" aria-label="transpose ${esc(ch.name)}"><b class="macro-val">${tr > 0 ? '+' : ''}${tr}</b></label>` : ''}
        <label>tone <input type="range" class="macro-tn" data-ch="${esc(ch.name)}" min="0" max="1" step="0.01" value="${tn}" aria-label="tone ${esc(ch.name)}"></label>
      </span>`;
  };
  return rows.map((ch) => `
    <div class="strip">
      <span class="name">${esc(ch.name)}</span>
      <span class="role">${esc(ch.role || (manifest.kind === 'beats-pattern' ? 'track' : 'part'))}</span>
      <span class="chain"><b>${esc(instrument(ch))}</b> → ${esc(chainLabel(ch.chain))}</span>
      ${macroRow(ch)}
      <button class="mute" data-ch="${esc(ch.name)}" aria-pressed="false">MUTE</button>
    </div>`).join('');
}

// the pattern grid, server-rendered: one row per track, one cell per sixteenth.
// Velocity → cell opacity; annotation markers land on their anchored cells.
function gridRows(manifest, annotations) {
  if (manifest.kind !== 'beats-pattern') return '';
  const N = manifest.steps || 32;
  const marks = new Map(); // 'track|absStep' or '|absStep' → [annotation…]
  for (const a of annotations || []) {
    if (!a.anchor || a.anchor.scope !== 'time' || a.status === 'resolved') continue;
    const abs = (a.anchor.bar - 1) * 16 + (a.anchor.step || 0);
    if (abs < 0 || abs >= N) continue;
    const key = `${a.anchor.track || ''}|${abs}`;
    if (!marks.has(key)) marks.set(key, []);
    marks.get(key).push(a);
  }
  const rows = manifest.tracks.map((tr) => {
    const cells = Array.from({ length: N }, (_, i) => {
      const v = tr.mask[i % tr.mask.length] || 0;
      const anns = [...(marks.get(`${tr.name}|${i}`) || []), ...(marks.get(`|${i}`) || [])];
      const mark = anns.length ? ` mark" title="${esc(anns.map((a) => a.body).join(' · '))}` : '';
      return `<i class="cell${v ? ' on' : ''}${mark}" style="${v ? `opacity:${(0.35 + v * 0.65).toFixed(2)}` : ''}" data-s="${i}"></i>`;
    }).join('');
    return `<div class="gtrack"><span class="glabel">${esc(tr.name)}</span><span class="gcells" style="grid-template-columns:repeat(${N},1fr)">${cells}</span></div>`;
  }).join('');
  return `<div class="grid" id="grid" data-steps="${N}">${rows}</div>`;
}

export function emitBeatsPlayer(manifest, opts = {}) {
  const isSfx = manifest.kind === 'beats-sfx';
  const facts = (isSfx
    ? `${Object.keys(manifest.cues).length} cue${Object.keys(manifest.cues).length === 1 ? '' : 's'} · synthesized foley`
    : `${manifest.bpm} BPM${manifest.swing ? ` · swing ${Math.round(manifest.swing * 100)}%` : ''}${manifest.kind === 'beats-ambient' ? ` · seed ${manifest.seed}` : ''}${manifest.kind === 'beats-pattern' ? ` · ${manifest.steps} steps` : ''}`)
    + (opts.rev ? ` · rev ${opts.rev}` : '');
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
  .macros { grid-column:1 / 3; grid-row:3; display:flex; gap:18px; padding-top:6px; }
  .macros label { display:flex; align-items:center; gap:7px; font-family:var(--mono); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--dim); }
  .macros input[type="range"] { width:110px; accent-color:var(--teal); }
  .macros .macro-val { color:var(--text); font-weight:500; min-width:2.2em; font-variant-numeric:tabular-nums; }
  .grid { background:var(--panel); border:1px solid var(--edge); border-radius:4px; padding:12px 14px; display:flex; flex-direction:column; gap:5px; overflow-x:auto; }
  .gtrack { display:grid; grid-template-columns:82px 1fr; gap:10px; align-items:center; min-width:420px; }
  .glabel { font-family:var(--mono); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--dim);
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .gcells { display:grid; gap:2px; }
  .gcells .cell { display:block; height:16px; border-radius:2px; background:#23233a; position:relative; }
  .gcells .cell.on { background:var(--teal); }
  .gcells .cell.mark::after { content:''; position:absolute; top:-3px; left:50%; margin-left:-3px; width:6px; height:6px; border-radius:50%; background:var(--amber); }
  .gcells .cell.head { outline:1px solid var(--amber); outline-offset:0; }
  .gcells .cell:nth-child(4n+1) { box-shadow:inset 1px 0 0 #343452; }
  @media (max-width:520px) { .strip { grid-template-columns:1fr auto; } .strip .chain { grid-column:1 / -1; grid-row:3; } .macros { grid-column:1 / -1; grid-row:4; flex-wrap:wrap; } .mute,.fire { grid-column:2; grid-row:1 / span 2; } }
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
  ${gridRows(manifest, opts.annotations)}
  <div class="strips">${stripRows(manifest)}</div>
</div>
<script>
const MANIFEST = ${JSON.stringify(manifest)};
const META = ${JSON.stringify({ ref: opts.ref || null, rev: opts.rev || null })};
const PATCHES = ${JSON.stringify(PATCHES)};
const KERNEL = (${buildBeatsKernel.toString()})();
let ctx = null, engine = null, analyser = null, playing = false, playT0 = null;

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
      playT0 = ctx.currentTime + 0.08;   // matches the transport's own t0
      if (MANIFEST.kind === 'beats-ambient') eng.startAmbient(MANIFEST, PATCHES);
      else if (MANIFEST.kind === 'beats-pattern') eng.startPattern(MANIFEST, PATCHES);
      else eng.startComposition(MANIFEST, PATCHES);
      stateEl.textContent = 'Playing'; stateEl.classList.add('live'); playBtn.classList.add('on');
    } else {
      eng.stop(); playT0 = null;
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

// ── performance macros (B5.2): sliders drive the live engine, never the recipe ──
document.querySelectorAll('.macro-tr').forEach((el) => {
  const val = el.nextElementSibling;
  el.addEventListener('input', () => {
    ensureEngine().setTranspose(el.dataset.ch, Number(el.value));
    val.textContent = (Number(el.value) > 0 ? '+' : '') + el.value;
  });
});
document.querySelectorAll('.macro-tn').forEach((el) => {
  el.addEventListener('input', () => { ensureEngine().setTone(el.dataset.ch, Number(el.value)); });
});

// ── sfx cue firing ──────────────────────────────────────────────────────────
document.querySelectorAll('.fire').forEach((btn) => {
  btn.addEventListener('click', () => {
    const eng = ensureEngine();
    playing = true; // light the scope
    eng.playCue(MANIFEST.cues[btn.dataset.cue]);
  });
});

// ── grid playhead (B9.2): read-only sweep — the recipe stays the author ─────
// The playhead's clock is the AudioContext itself (the same clock the
// transport schedules against), so the sweep stays honest at any tempo.
const gridEl = document.getElementById('grid');
if (gridEl) {
  const N = Number(gridEl.dataset.steps);
  const cols = [];
  for (let i = 0; i < N; i++) cols.push(gridEl.querySelectorAll('.cell[data-s="' + i + '"]'));
  let headStep = -1;
  (function sweep() {
    requestAnimationFrame(sweep);
    let step = -1;
    if (playing && playT0 !== null && ctx) {
      const sixteenth = 60 / MANIFEST.bpm / 4;
      const t = ctx.currentTime - playT0;
      if (t >= 0) step = Math.floor(t / sixteenth) % N;
    }
    if (step === headStep) return;
    if (headStep >= 0) cols[headStep].forEach((c) => c.classList.remove('head'));
    if (step >= 0) cols[step].forEach((c) => c.classList.add('head'));
    headStep = step;
  })();
}

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
