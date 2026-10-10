/**
 * THE WEATHER GALLERY — every state and every climate, in each art style's own air, as standalone World pages and an index
 * to drive them. One page a style: it carries a pool for every state, so the address picks the sky:
 *
 *   <style>.html?wx=<state>                    holds that state (the row of every state)
 *   <style>.html?wxclimate=<climate>&wxspeed=60  plays that climate, the clock a minute a second (a climate run)
 *
 * The styles are a cel kit (banded fog), a painted kit (smooth), an alien night kit, and the cel kit with a dithered fog (a
 * pixel look): the fog's four bodies' worth of range. `weatherGallery()` is pure (it returns the files); the CLI is
 * scripts/weather-gallery.mjs. Machine gate only: the eyes gate is whoever opens it.
 */
import { emitThreeWorld } from '../scene/scene-three.js';
import { STATE_NAMES, CLIMATES, CLIMATE_NAMES, STATES, readWeather } from './weather.js';
import { airOfKit } from '../gameworld/style-guide.js';

/** The styles the gallery draws in: [id, label, kit, air tuning]. */
export const GALLERY_STYLES = Object.freeze([
  ['cel', 'Cel (banded fog)', 'isekai-meadow', {}],
  ['painted', 'Painted (smooth fog)', 'trail-valley', {}],
  ['night', 'Alien night', 'alien-night', {}],
  ['pixel', 'Pixel (dithered fog)', 'isekai-meadow', { body: 'dithered', steps: 4 }],
]);

// a plain world to stand in: a checkered ground and posts of several heights, seen from eye height
function testWorld() {
  const faces = [];
  for (let i = -12; i < 12; i++) for (let j = -12; j < 12; j++) faces.push({ corners: [[i * 4, j * 4, 0], [i * 4 + 4, j * 4, 0], [i * 4 + 4, j * 4 + 4, 0], [i * 4, j * 4 + 4, 0]], fill: (i + j) & 1 ? '#6f8a5a' : '#7a9663' });
  for (let k = 0; k < 40; k++) {
    const x = ((k * 37) % 80) - 40, y = ((k * 53) % 80) - 40, h = 3 + (k % 4);
    for (const [a, b, c, d] of [[0, 0, 1, 0], [1, 0, 1, 1], [1, 1, 0, 1], [0, 1, 0, 0]]) faces.push({ corners: [[x + a, y + b, 0], [x + c, y + d, 0], [x + c, y + d, h], [x + a, y + b, h]], fill: '#8a6f55' });
    faces.push({ corners: [[x, y, h], [x + 1, y, h], [x + 1, y + 1, h], [x, y + 1, h]], fill: '#a88a6a' });
  }
  return { faces, cameras: [{ name: 'eye', worldFraming: { cameraPosition: [0, -14, 2.4], lookAt: [0, 10, 2], horizontalFov: 75 } }] };
}

/** → { 'index.html': string, '<style>.html': string, … }. */
export function weatherGallery({ seed = 4 } = {}) {
  const world = testWorld(), files = {};
  // a climate that holds every state (equal weights), for the pools; the address chooses what plays
  const all = readWeather({ climate: Object.fromEntries(STATE_NAMES.map((n) => [n, 1])), dwell: [600, 700], blend: 5 });
  const climates = Object.fromEntries(CLIMATE_NAMES.map((n) => [n, readWeather(n)]));
  for (const [id, , kit, tune] of GALLERY_STYLES) {
    const air = airOfKit(kit, tune);
    files[`${id}.html`] = emitThreeWorld({ ...world, title: `weather · ${id}`, inline: true, haze: { color: air.hue, density: 0.012 }, bg: air.hue, weather: { weather: all, seed, air, gallery: true, climates } });
  }
  files['index.html'] = indexHtml();
  return files;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function indexHtml() {
  const styles = GALLERY_STYLES.map(([id, label]) => `<button data-style="${id}">${esc(label)}</button>`).join('');
  const states = STATE_NAMES.map((n) => `<button data-wx="${n}" title="${esc(STATES[n].read)}">${esc(n)}</button>`).join('');
  const climates = CLIMATE_NAMES.map((n) => `<button data-climate="${n}" title="${esc(CLIMATES[n].read)}">${esc(n)}</button>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>World weather gallery</title><style>
body{margin:0;font:14px system-ui,sans-serif;background:#10151d;color:#dfe6f2;display:grid;grid-template-rows:auto 1fr;height:100vh}
header{padding:10px 14px;display:grid;gap:8px;border-bottom:1px solid #243044}
.row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.row b{font:500 11px ui-monospace,monospace;color:#8796ab;text-transform:uppercase;width:78px}
button{background:#1a2230;color:#dfe6f2;border:1px solid #2c3a52;border-radius:5px;padding:4px 9px;cursor:pointer}button.on{background:#3b5b8c;border-color:#6d93cc}
iframe{width:100%;height:100%;border:0;background:#000}small{color:#8796ab}</style></head><body>
<header><div class="row"><b>Style</b>${styles}</div><div class="row"><b>A state</b>${states}</div><div class="row"><b>A climate</b>${climates}<small>run at a minute a second</small></div>
<small>Machine gate only: each state is the module's own sky in the style's air. Whether it looks right is yours to say.</small></header>
<iframe id="f" title="the world"></iframe>
<script>
let style = 'cel', q = 'wx=rain';
const f = document.getElementById('f'), go = () => { f.src = style + '.html?hud=0&' + q; for (const b of document.querySelectorAll('button')) b.classList.toggle('on', !!(b.dataset.style === style || (b.dataset.wx && q === 'wx=' + b.dataset.wx) || (b.dataset.climate && q === 'wxclimate=' + b.dataset.climate + '&wxspeed=60'))); };
for (const b of document.querySelectorAll('button')) b.onclick = () => { if (b.dataset.style) style = b.dataset.style; else if (b.dataset.wx) q = 'wx=' + b.dataset.wx; else q = 'wxclimate=' + b.dataset.climate + '&wxspeed=60'; go(); };
go();
</script></body></html>`;
}
