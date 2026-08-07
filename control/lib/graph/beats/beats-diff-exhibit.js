/**
 * beats-diff-exhibit — emitBeatsDiff(variants, opts?) → a self-contained HTML
 * page that plays a base groove and two one-line variants side by side, so a
 * visitor can hear what changing a single line of a recipe does, read the ACTUAL
 * diff_beats output between them, and take the score away as MIDI.
 *
 * The site's "music as code" exhibit (site/music-showcase.plan.md M2). Same
 * discipline as beats-player: no dependencies, no network, no media bytes — the
 * kernel is emitted via buildBeatsKernel.toString() and every sound is
 * synthesized at play time from the stored recipe. The WAV download is rendered
 * in the visitor's own browser on an OfflineAudioContext (the same realize path
 * renderBeatsOffline uses for patterns); nothing audio ever ships.
 *
 * variants: [{ ref, label, manifest, diff, changed }]
 *   ref     — the stored beats ref (shown as the diff's right-hand side)
 *   label   — short tab label (e.g. "rhodes +12")
 *   manifest — the stored beats-pattern manifest (played + rendered live)
 *   diff    — the diff_beats summary line(s) vs the base (CODE-TRUTH, computed
 *             by diffBeatsManifests at export; [] for the base itself)
 *   changed — { track, field } the one line changed vs base (null for base) so
 *             the strip that moved can be highlighted; purely presentational.
 * The FIRST variant is the base. opts: { title, lede }.
 *
 * MIDI downloads are tiny static <ref>.mid files written beside the page by the
 * exporter (a score is not audio); this emitter only links them by ref.
 */

import { buildBeatsKernel } from './beats-kernel.js';
import { PATCHES } from './audio-patches.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function chainLabel(chain) {
  if (!Array.isArray(chain) || !chain.length) return 'dry';
  return chain.map((f) => f.type).join(' → ');
}

function instrumentOf(tr) {
  return tr.patch || (tr.cue ? tr.cue.map((g) => g.type).join(' + ') : tr.gesture ? `${tr.gesture.type} (gesture)` : '');
}

// One track strip: name · role · instrument → chain · macros. The row that the
// variant changed vs base gets `.changed` so the eye lands on the single edit.
function strip(tr, changed) {
  const isChanged = changed && changed.track === tr.name;
  const macros = [];
  if (tr.transpose) macros.push(`transpose ${tr.transpose > 0 ? '+' : ''}${tr.transpose}`);
  if (tr.tone != null) macros.push(`tone ${tr.tone}`);
  return `<div class="strip${isChanged ? ' changed' : ''}">
    <span class="name">${esc(tr.name)}</span>
    <span class="chain"><b>${esc(instrumentOf(tr))}</b> → ${esc(chainLabel(tr.chain))}</span>
    ${macros.length ? `<span class="macro">${esc(macros.join(' · '))}</span>` : ''}
  </div>`;
}

// The per-variant panel: the tool diff (or the base caption) + the track strips
// + the download row. All three are server-rendered; only the active is shown.
function variantPanel(v, isBase) {
  const tracks = v.manifest.tracks || [];
  const diffBlock = isBase
    ? `<div class="diff base"><span class="diff-label">the original recipe</span>
         <p class="diff-note">Each variant below is exactly one line different — and a real stored artifact you can diff against this one forever.</p></div>`
    : `<div class="diff"><span class="diff-label">diff_beats <b>${esc(v.baseRef)}</b> → <b>${esc(v.ref)}</b></span>
         <pre class="diff-body">${v.diff.map(esc).join('\n')}</pre></div>`;
  return `<section class="variant" data-variant="${esc(v.ref)}"${isBase ? '' : ' hidden'}>
    ${diffBlock}
    <div class="strips">${tracks.map((t) => strip(t, v.changed)).join('')}</div>
    <div class="downloads">
      <a class="dl" href="${esc(v.ref)}.mid" download>↓ MIDI <span>the score, for your DAW</span></a>
      <button class="dl wav" data-ref="${esc(v.ref)}">↓ WAV <span>rendered in your browser</span></button>
    </div>
  </section>`;
}

export function emitBeatsDiff(variants, opts = {}) {
  const base = variants[0];
  for (const v of variants) v.baseRef = base.ref;
  const title = opts.title || 'The hearable diff';
  const lede = opts.lede || 'Change one line of the recipe. Hear the change. Keep both, and diff them forever.';
  const bpm = base.manifest.bpm;
  const facts = `${bpm} BPM${base.manifest.swing ? ` · swing ${Math.round(base.manifest.swing * 100)}%` : ''} · ${base.manifest.steps} steps · synthesized live`;
  const MANIFESTS = Object.fromEntries(variants.map((v) => [v.ref, v.manifest]));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { --ground:#131320; --panel:#1d1d30; --edge:#2b2b44; --text:#c9c7de; --dim:#807da0; --amber:#ffb454; --teal:#5fd4c4;
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  html { background: var(--ground); }
  body { margin:0; font-family: system-ui, sans-serif; color: var(--text); line-height:1.5; }
  .wrap { max-width:720px; margin:0 auto; padding:36px 20px 56px; display:flex; flex-direction:column; gap:22px; }
  .eyebrow { font-family:var(--mono); font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--dim); }
  h1 { font-family: Georgia, serif; font-style: italic; font-weight:400; font-size:clamp(28px,6vw,40px); margin:2px 0 0; color:#eceafb; }
  .lede { font-size:15px; color:var(--text); margin:0; max-width:52ch; }
  .facts { font-family:var(--mono); font-size:12px; color:var(--dim); font-variant-numeric:tabular-nums; }
  .scope { background:#0d0d18; border:1px solid var(--edge); border-radius:4px; height:88px; overflow:hidden; }
  .scope canvas { display:block; width:100%; height:100%; }
  .tabs { display:flex; gap:8px; flex-wrap:wrap; }
  .tab { font-family:var(--mono); font-size:12px; letter-spacing:.06em; border:1px solid var(--edge); background:var(--panel);
    color:var(--dim); border-radius:4px; padding:8px 14px; cursor:pointer; }
  .tab:hover { color:var(--text); }
  .tab:focus-visible { outline:2px solid var(--teal); outline-offset:2px; }
  .tab[aria-selected="true"] { color:#171224; background:var(--teal); border-color:var(--teal); font-weight:600; }
  .tab .k { opacity:.7; text-transform:uppercase; letter-spacing:.14em; font-size:10px; }
  .transport { display:flex; align-items:center; gap:18px; }
  #play { width:64px; height:64px; border-radius:50%; border:2px solid #b87428; color:var(--amber);
    background: radial-gradient(circle at 38% 32%, #2b2138, #171224 70%); cursor:pointer; display:grid; place-items:center; flex-shrink:0; }
  #play:hover { border-color: var(--amber); }
  #play:focus-visible { outline:2px solid var(--teal); outline-offset:3px; }
  #play svg { width:22px; height:22px; fill:currentColor; }
  #play.on { border-color:var(--amber); box-shadow:0 0 22px rgba(255,180,84,.25); }
  .state { font-family:var(--mono); font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--dim); }
  .state.live { color: var(--teal); }
  .diff { background:#11111e; border:1px solid var(--edge); border-left:3px solid var(--teal); border-radius:4px; padding:12px 14px; }
  .diff.base { border-left-color:var(--dim); }
  .diff-label { font-family:var(--mono); font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--dim); }
  .diff-label b { color:var(--teal); font-weight:600; text-transform:none; letter-spacing:0; }
  .diff-body { font-family:var(--mono); font-size:13px; color:var(--amber); margin:8px 0 0; white-space:pre-wrap; }
  .diff-note { font-size:13px; color:var(--dim); margin:6px 0 0; }
  .strips { display:flex; flex-direction:column; gap:8px; }
  .strip { background:var(--panel); border:1px solid var(--edge); border-radius:4px; padding:9px 13px;
    display:grid; grid-template-columns:92px 1fr auto; gap:2px 12px; align-items:center; }
  .strip .name { font-weight:600; font-size:13px; color:#eceafb; }
  .strip .chain { font-family:var(--mono); font-size:12px; color:var(--dim); overflow-x:auto; white-space:nowrap; }
  .strip .chain b { color:var(--amber); font-weight:500; }
  .strip .macro { font-family:var(--mono); font-size:11px; color:var(--teal); }
  .strip.changed { border-color:var(--teal); box-shadow:0 0 0 1px var(--teal) inset; }
  .strip.changed .name::after { content:'changed'; margin-left:8px; font-family:var(--mono); font-size:9px; letter-spacing:.12em;
    text-transform:uppercase; color:#171224; background:var(--teal); padding:2px 5px; border-radius:3px; vertical-align:middle; }
  .downloads { display:flex; gap:10px; flex-wrap:wrap; margin-top:2px; }
  .dl { font-family:var(--mono); font-size:12px; color:var(--teal); text-decoration:none; border:1px solid #2e5e57;
    background:transparent; border-radius:4px; padding:8px 12px; cursor:pointer; display:inline-flex; gap:8px; align-items:baseline; }
  .dl:hover { background:#16162a; }
  .dl:focus-visible { outline:2px solid var(--teal); outline-offset:2px; }
  .dl span { color:var(--dim); font-size:11px; }
  .foot { font-size:12px; color:var(--dim); border-top:1px solid var(--edge); padding-top:16px; margin-top:2px; }
  @media (max-width:520px) { .strip { grid-template-columns:1fr auto; } .strip .chain { grid-column:1 / -1; grid-row:2; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="eyebrow">Mojulo Beats · the hearable diff</div>
    <h1>${esc(title)}</h1>
    <p class="lede">${esc(lede)}</p>
    <div class="facts">${esc(facts)}</div>
  </header>
  <div class="scope"><canvas id="scope"></canvas></div>
  <div class="tabs" role="tablist" aria-label="variants">
    ${variants.map((v, i) => `<button class="tab" role="tab" data-ref="${esc(v.ref)}" aria-selected="${i === 0}"><span class="k">${i === 0 ? 'base' : `diff ${String.fromCharCode(64 + i)}`}</span> ${esc(v.label)}</button>`).join('')}
  </div>
  <div class="transport">
    <button id="play" aria-label="Play">
      <svg id="ic-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>
      <svg id="ic-stop" viewBox="0 0 24 24" aria-hidden="true" style="display:none"><path d="M6 6h12v12H6z"/></svg>
    </button>
    <span class="state" id="state">Stopped — press play, then switch variants to hear the diff</span>
  </div>
  ${variants.map((v, i) => variantPanel(v, i === 0)).join('')}
  <p class="foot">No audio files ship. Every note is synthesized in your browser from the recipe, and the WAV you download is rendered here too — nothing was recorded, and no two instruments came from a sample.</p>
</div>
<script>
const MANIFESTS = ${JSON.stringify(MANIFESTS)};
const PATCHES = ${JSON.stringify(PATCHES)};
const KERNEL = (${buildBeatsKernel.toString()})();
let ctx = null, engine = null, analyser = null, playing = false;
let activeRef = ${JSON.stringify(base.ref)};

function ensureEngine() {
  if (engine) { if (ctx.state === 'suspended') ctx.resume(); return engine; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  engine = KERNEL.createEngine(ctx, { analyser });
  return engine;
}

function startActive() {
  const eng = ensureEngine();
  eng.startPattern(MANIFESTS[activeRef], PATCHES);
}

const playBtn = document.getElementById('play');
const stateEl = document.getElementById('state');
function setPlaying(on) {
  playing = on;
  document.getElementById('ic-play').style.display = on ? 'none' : '';
  document.getElementById('ic-stop').style.display = on ? '' : 'none';
  playBtn.classList.toggle('on', on);
  playBtn.setAttribute('aria-label', on ? 'Stop' : 'Play');
  stateEl.classList.toggle('live', on);
}
playBtn.addEventListener('click', () => {
  const eng = ensureEngine();
  if (!playing) { startActive(); setPlaying(true); stateEl.textContent = 'Playing — ' + activeRef; }
  else { eng.stop(); setPlaying(false); stateEl.textContent = 'Stopped'; }
});

// ── variant switch: swap the shown panel; if playing, re-synth instantly ──────
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const ref = tab.dataset.ref;
    if (ref === activeRef) return;
    activeRef = ref;
    document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    document.querySelectorAll('.variant').forEach((s) => { s.hidden = s.dataset.variant !== ref; });
    if (playing) { engine.stop(); startActive(); stateEl.textContent = 'Playing — ' + activeRef; }
  });
});

// ── WAV download: render THIS variant offline in the visitor's browser ────────
// Mirrors renderBeatsOffline's pattern realize path exactly (loops=2, tail=2),
// reusing the inlined kernel — so the download matches what plays, and no audio
// bytes were ever shipped.
const clamp01 = (v) => Math.max(0, Math.min(1, v));
function planPattern(manifest, loops) {
  const pat = KERNEL.patternEvents(manifest);
  const tracks = manifest.tracks || [];
  const entries = [];
  for (let cursor = 0; cursor < loops; cursor++) {
    const b = cursor * pat.duration;
    pat.events.forEach((ev, ei) => {
      const tr = tracks.find((c) => c.name === ev.channel);
      if (tr && (tr.cue || tr.gesture)) { entries.push({ type: 'cue', t: b + ev.t, channel: ev.channel, gestures: tr.cue || [tr.gesture], vel: ev.vel }); return; }
      const feel = tr && tr.feel;
      ev.notes.forEach((n, ni) => {
        const fl = KERNEL.noteFeel(feel, manifest.seed, cursor * 1000 + ei, ni, ev.notes.length);
        entries.push({ type: 'note', t: b + ev.t + fl.timeOffset, channel: ev.channel, patch: (tr && tr.patch) || 'sinePluck', pluck: fl.pluck, note: n, dur: ev.dur, vel: ev.vel * fl.velScale });
      });
    });
  }
  return { entries, duration: loops * pat.duration };
}
function encodeWav(buf) {
  const nCh = buf.numberOfChannels, sr = buf.sampleRate, len = buf.length, blockAlign = nCh * 2;
  const dataBytes = len * blockAlign, ab = new ArrayBuffer(44 + dataBytes), dv = new DataView(ab);
  const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + dataBytes, true); wr(8, 'WAVE'); wr(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, nCh, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * blockAlign, true); dv.setUint16(32, blockAlign, true);
  dv.setUint16(34, 16, true); wr(36, 'data'); dv.setUint32(40, dataBytes, true);
  const chans = []; for (let c = 0; c < nCh; c++) chans.push(buf.getChannelData(c));
  let off = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < nCh; c++) {
    const s = Math.max(-1, Math.min(1, chans[c][i]));
    dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true); off += 2;
  }
  return new Blob([ab], { type: 'audio/wav' });
}
async function renderWav(manifest) {
  const sr = 44100, tail = 2, loops = 2;
  const plan = planPattern(manifest, loops);
  const total = plan.duration + tail;
  const octx = new OfflineAudioContext(2, Math.max(1, Math.ceil(total * sr)), sr);
  const eng = KERNEL.createEngine(octx);
  const chains = {}, transposeFor = {};
  for (const ch of (manifest.tracks || [])) {
    const built = eng.buildChain(ch.chain, manifest.seed, manifest.bpm);
    built.output.connect(eng.channelGain(ch.name));
    let dest = built.input;
    if (ch.tone !== undefined) { const tn = octx.createBiquadFilter(); tn.type = 'lowpass'; tn.Q.value = 0.5; tn.frequency.value = KERNEL.toneFreq(ch.tone); tn.connect(built.input); dest = tn; }
    chains[ch.name] = dest;
    if (ch.transpose) transposeFor[ch.name] = Math.pow(2, ch.transpose / 12);
  }
  for (const e of plan.entries) {
    const t = Math.max(0, e.t);
    if (e.type === 'cue') eng.playCue(e.gestures, t, e.channel ? chains[e.channel] : undefined, e.vel);
    else { const patch = PATCHES[e.patch] || {}; const p = e.pluck ? { ...patch, pick: clamp01((patch.pick || 0) + e.pluck) } : patch; eng.playVoice(p, KERNEL.noteHz(e.note) * (transposeFor[e.channel] || 1), t, e.dur, e.vel, chains[e.channel]); }
  }
  return encodeWav(await octx.startRendering());
}
document.querySelectorAll('.dl.wav').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const ref = btn.dataset.ref;
    const label = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '↓ WAV <span>rendering…</span>';
    try {
      const blob = await renderWav(MANIFESTS[ref]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = ref + '.wav'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally { btn.disabled = false; btn.innerHTML = label; }
  });
});

// ── oscilloscope ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('scope');
const g2d = canvas.getContext('2d');
function resize() { const dpr = window.devicePixelRatio || 1; canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr; }
resize(); window.addEventListener('resize', resize);
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
