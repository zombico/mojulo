/**
 * Motion — the outcome-folder viewer (a self-contained frame-accurate player).
 *
 * Pure module (no deps, no `@/` imports) so it can be reused both by the
 * forge_motion tool and by a standalone regen script. We own the frames, so this
 * is a real movie viewer — play/pause, scrub, speed, step, loop, fullscreen —
 * without a video encoder. It inlines the all-frames `motion.svg` (every frame is
 * a `.moj-frame` group), disables the embedded CSS animation, and drives the
 * playhead in JS for frame-exact control.
 *
 * IMPORTANT: asset URLs are ABSOLUTE (`${baseUrl}motion.svg`), not relative.
 * The outcomes route serves index.html at a NO-trailing-slash URL (Next 308s
 * `/outcomes/<ref>/` → `/outcomes/<ref>`), so a relative `./motion.svg` would
 * resolve against `/outcomes/` and 404. Absolute paths are slash-independent.
 *
 * Theming: the player chrome comes from a presentation theme's `chrome` block
 * (themes.js). With no theme, it falls back to DEFAULT_CHROME (today's dark
 * player), so existing motions render unchanged. themes.js is a pure, dep-free
 * sibling — importing it keeps this module free of `@/` app deps.
 */

import { DEFAULT_CHROME } from '../visual-language/themes.js';

export function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** Light vs dark UA controls, inferred from the chrome's page background. */
function colorScheme(pageBg) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(pageBg).trim());
  if (!m) return 'dark';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  // Rec. 601 luma; >140 reads as a light surface.
  return (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? 'light' : 'dark';
}

/**
 * @param {object} args
 * @param {string} args.title
 * @param {string} args.motion
 * @param {boolean} args.hasGif
 * @param {object} args.recipe        the persisted recipe (motion_ref, meta…)
 * @param {string} args.baseUrl       absolute folder URL, e.g. "/outcomes/mo_x/"
 * @param {object} [args.chrome]      presentation-theme chrome (DEFAULT_CHROME if absent)
 */
export function viewerHtml({ title, motion, hasGif, recipe, baseUrl, chrome = DEFAULT_CHROME }) {
  const c = chrome || DEFAULT_CHROME;
  const scheme = colorScheme(c.pageBg);
  const meta = { frames: recipe.meta.frames, fps: recipe.meta.fps, motion, svg: `${baseUrl}motion.svg` };
  const gifLink = hasGif
    ? `<a class="dl" href="${baseUrl}motion.gif" download>download .gif</a>`
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} — motion</title>
<style>
  :root { color-scheme: ${scheme}; }
  * { box-sizing: border-box; }
  body { margin: 0; background: ${c.pageBg}; color: ${c.ink}; font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; }
  main { max-width: 920px; margin: 0 auto; padding: 28px 20px; }
  h1 { font-size: 18px; font-weight: 600; margin: 0 0 4px; }
  .ref { font-family: ui-monospace, monospace; font-size: 11px; color: ${c.mutedInk}; }
  .stage { margin: 20px 0 12px; background: ${c.stageBg}; border-radius: 8px; display: flex; align-items: center; justify-content: center; min-height: 320px; overflow: hidden; }
  .stage svg, .stage img { max-width: 100%; max-height: 70vh; height: auto; display: block; }
  .bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 12px; background: ${c.panelBg}; border: 1px solid ${c.panelBorder}; border-radius: 8px; }
  button { font: inherit; color: ${c.ink}; background: ${c.panelBg}; border: 1px solid ${c.panelBorder}; border-radius: 6px; padding: 6px 10px; cursor: pointer; }
  button:hover { border-color: ${c.accent}; }
  input[type=range] { flex: 1 1 200px; min-width: 160px; accent-color: ${c.accent}; }
  .count { font-variant-numeric: tabular-nums; font-size: 12px; color: ${c.mutedInk}; min-width: 64px; text-align: center; }
  select { font: inherit; color: ${c.ink}; background: ${c.panelBg}; border: 1px solid ${c.panelBorder}; border-radius: 6px; padding: 5px 6px; }
  label.inline { font-size: 12px; color: ${c.mutedInk}; display: inline-flex; align-items: center; gap: 5px; }
  .meta { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; color: ${c.mutedInk}; margin-top: 14px; }
  .meta b { color: ${c.ink}; font-weight: 600; }
  .dl { color: ${c.mutedInk}; font-size: 12px; text-decoration: none; border-bottom: 1px dotted ${c.mutedInk}; }
  details { margin-top: 18px; } pre { overflow:auto; background:${c.panelBg}; padding:12px; border-radius:6px; font-size:11px; }
</style></head>
<body><main>
  <h1>${escapeHtml(title)}</h1>
  <div class="ref">${escapeHtml(recipe.motion_ref)}</div>
  <div class="stage" id="stage"><img src="${baseUrl}motion.svg" alt="${escapeHtml(title)}" /></div>
  <div class="bar" id="bar" hidden>
    <button id="play" aria-label="play/pause">⏸</button>
    <button id="back" aria-label="step back">⟨</button>
    <button id="fwd" aria-label="step forward">⟩</button>
    <input type="range" id="scrub" min="0" max="0" value="0" step="1" />
    <span class="count" id="count">1 / 1</span>
    <label class="inline">fps
      <select id="fps"><option>6</option><option>8</option><option>12</option><option>15</option><option>24</option></select>
    </label>
    <label class="inline"><input type="checkbox" id="loop" checked /> loop</label>
    <button id="full" aria-label="fullscreen">⤢</button>
  </div>
  <div class="meta">
    <span><b>motion</b> ${escapeHtml(motion)}</span>
    <span><b>frames</b> ${recipe.meta.frames}</span>
    <span><b>fps</b> ${recipe.meta.fps}</span>
    <span><b>framing</b> ${escapeHtml(recipe.meta.viewBoxStrategy)}</span>
    ${gifLink}
  </div>
  <details><summary>recipe</summary><pre>${escapeHtml(JSON.stringify(recipe, null, 2))}</pre></details>
<script>
(function () {
  var META = ${JSON.stringify(meta)};
  var stage = document.getElementById('stage');
  var bar = document.getElementById('bar');
  var frames = [], N = META.frames || 1, cur = 0, playing = true, fps = META.fps || 12, raf = 0, last = null;
  var playBtn = document.getElementById('play'), scrub = document.getElementById('scrub');
  var count = document.getElementById('count'), loopBox = document.getElementById('loop');
  var fpsSel = document.getElementById('fps');

  fetch(META.svg).then(function (r) { return r.text(); }).then(function (txt) {
    stage.innerHTML = txt;
    var svg = stage.querySelector('svg');
    if (!svg) return; // leave the static <img> fallback in place
    svg.removeAttribute('width'); svg.removeAttribute('height');
    frames = Array.prototype.slice.call(svg.querySelectorAll('.moj-frame'));
    if (!frames.length) return;
    frames.forEach(function (g) { g.style.animation = 'none'; g.style.transition = 'none'; g.style.opacity = '0'; });
    N = frames.length;
    scrub.max = String(N - 1);
    for (var i = 0; i < fpsSel.options.length; i++) if (+fpsSel.options[i].value === fps) fpsSel.selectedIndex = i;
    bar.hidden = false;
    show(0); setPlay(true);
    raf = requestAnimationFrame(tick);
  }).catch(function () { /* keep the <img> fallback */ });

  function show(i) {
    cur = ((i % N) + N) % N;
    for (var k = 0; k < frames.length; k++) frames[k].style.opacity = k === cur ? '1' : '0';
    scrub.value = String(cur);
    count.textContent = (cur + 1) + ' / ' + N;
  }
  function setPlay(p) { playing = p; playBtn.textContent = p ? '⏸' : '▶'; if (p) last = null; }
  function tick(t) {
    raf = requestAnimationFrame(tick);
    if (!playing || !frames.length) return;
    if (last === null) last = t;
    if ((t - last) / 1000 >= 1 / fps) {
      last = t;
      var n = cur + 1;
      if (n >= N) { if (loopBox.checked) n = 0; else { setPlay(false); return; } }
      show(n);
    }
  }
  playBtn.onclick = function () { setPlay(!playing); };
  document.getElementById('back').onclick = function () { setPlay(false); show(cur - 1); };
  document.getElementById('fwd').onclick = function () { setPlay(false); show(cur + 1); };
  scrub.oninput = function () { setPlay(false); show(+scrub.value); };
  fpsSel.onchange = function () { fps = +fpsSel.value; last = null; };
  document.getElementById('full').onclick = function () {
    var el = stage; if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen();
  };
  document.addEventListener('keydown', function (e) {
    if (e.key === ' ') { e.preventDefault(); setPlay(!playing); }
    else if (e.key === 'ArrowRight') { setPlay(false); show(cur + 1); }
    else if (e.key === 'ArrowLeft') { setPlay(false); show(cur - 1); }
  });
})();
</script>
</main></body></html>
`;
}

/**
 * The STITCH viewer — a long-form MP4 plays natively as <video> (seek, scrub,
 * fullscreen, download all for free). No bespoke frame driver: we baked the
 * frames into the file, so the browser's video pipeline is the player.
 *
 * @param {object} args
 * @param {string} args.title
 * @param {object} args.recipe   the persisted stitch recipe (motion_ref, meta…)
 * @param {string} args.baseUrl  absolute folder URL, e.g. "/outcomes/mo_x/"
 * @param {boolean}[args.loop=true]
 */
export function stitchViewerHtml({ title, recipe, baseUrl, loop = true }) {
  const m = recipe.meta || {};
  const dur = m.durationSec != null ? `${m.durationSec}s` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} — stitched motion</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0e1319; color: #c9d1d9; font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; }
  main { max-width: 920px; margin: 0 auto; padding: 28px 20px; }
  h1 { font-size: 18px; font-weight: 600; margin: 0 0 4px; }
  .ref { font-family: ui-monospace, monospace; font-size: 11px; color: #6b7280; }
  .stage { margin: 20px 0 12px; background: #000; border-radius: 8px; overflow: hidden; display: flex; }
  .stage video { width: 100%; max-height: 72vh; display: block; background: #000; }
  .meta { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; color: #8b949e; margin-top: 14px; }
  .meta b { color: #c9d1d9; font-weight: 600; }
  .dl { color: #6b7280; font-size: 12px; text-decoration: none; border-bottom: 1px dotted #6b7280; }
  details { margin-top: 18px; } pre { overflow:auto; background:#161b22; padding:12px; border-radius:6px; font-size:11px; }
</style></head>
<body><main>
  <h1>${escapeHtml(title)}</h1>
  <div class="ref">${escapeHtml(recipe.motion_ref)} · stitched</div>
  <div class="stage">
    <video src="${baseUrl}motion.mp4" controls autoplay muted playsinline ${loop ? 'loop' : ''}></video>
  </div>
  <div class="meta">
    <span><b>clips</b> ${m.clipCount ?? '—'}</span>
    <span><b>frames</b> ${m.frames ?? '—'}</span>
    <span><b>fps</b> ${m.fps ?? '—'}</span>
    ${dur ? `<span><b>length</b> ${escapeHtml(dur)}</span>` : ''}
    <a class="dl" href="${baseUrl}motion.mp4" download>download .mp4</a>
  </div>
  <details><summary>recipe</summary><pre>${escapeHtml(JSON.stringify(recipe, null, 2))}</pre></details>
</main></body></html>
`;
}
