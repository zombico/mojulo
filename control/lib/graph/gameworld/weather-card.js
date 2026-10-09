/**
 * THE WEATHER CARD — the bible's page for a world's climate: each state it can be in as a grey still (the sky's value,
 * the fog's veil, what falls), and a strip of the first twenty minutes of its dice. Values only; the style guide
 * colours it. Pure: the same climate and seed, the same card.
 */
import { STATES, weatherRuns, SURFACES } from '../weather/weather.js';
import { dice } from '../weather/weather.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const grey = (v) => { const n = Math.round(255 * Math.min(1, Math.max(0, v))); return `rgb(${n},${n},${n})`; };
const r1 = (v) => Math.round(v * 10) / 10;

/** One state as a grey still: sky, a ground line, the fog's veil over both, and the fall as strokes or dots. */
export function stateStill(name, w = 220, h = 140) {
  const S = STATES[name], F = S.fall, op = Math.min(0.92, 1 - Math.exp(-S.fog / 3.2));
  let fall = '';
  if (F) {
    const n = Math.min(70, Math.round(14 + F.rate * 50)), len = F.glyph === 'streak' ? Math.max(6, F.length * 28) : Math.max(2, F.size * 90), lean = Math.tan((F.slant * Math.PI) / 180) * len;
    for (let i = 0; i < n; i++) {
      const x = r1(dice(7, i, 1) * (w + 20) - 10), y = r1(dice(7, i, 2) * (h * 0.85)), c = grey(F.value);
      fall += F.glyph === 'streak' ? `<line x1="${x}" y1="${y}" x2="${r1(x + lean)}" y2="${r1(y + len)}" stroke="${c}" stroke-width="1"/>` : `<circle cx="${x}" cy="${y}" r="${r1(len / 2)}" fill="${c}"/>`;
    }
  }
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(name)}"><rect width="${w}" height="${h}" fill="${grey(S.sky)}"/><rect y="${h * 0.7}" width="${w}" height="${h * 0.3}" fill="${grey(S.sky * 0.45)}"/><rect width="${w}" height="${h}" fill="${grey(S.veil)}" opacity="${r1(op * 100) / 100}"/><rect width="${w}" height="${h}" fill="#000" opacity="${S.dim}"/>${fall}</svg>`;
}

/** The first `span` seconds of the dice as a strip: a bar per run, its grey the state's sky, its label the state. */
export function weatherStrip(W, seed, span = 1200, w = 880, h = 46) {
  const runs = weatherRuns(W, seed, span), k = w / span;
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="the first ${span / 60} minutes">${runs.map((r) => `<rect x="${r1(r.from * k)}" width="${r1((r.to - r.from) * k)}" height="${h}" fill="${grey(STATES[r.is].sky)}" stroke="#fff"/><text x="${r1(r.from * k + 4)}" y="${h / 2 + 4}" font-size="11" fill="${STATES[r.is].sky > 0.6 ? '#17202e' : '#fff'}">${esc(r.is)}</text>`).join('')}</svg>`;
}

/** The card: `W` a read weather, `seed` the world's. */
export function weatherCardHtml(W, seed) {
  const names = Object.keys(W.climate), total = names.reduce((a, n) => a + W.climate[n], 0);
  const stills = names.map((n) => `<figure class="wx"><div>${stateStill(n)}</div><figcaption><b>${esc(n)}</b> <span class="muted">${Math.round((100 * W.climate[n]) / total)}%</span><br><span class="muted">${esc(STATES[n].read)}</span></figcaption></figure>`).join('');
  const own = [`dwell ${W.dwell[0]}–${W.dwell[1]} s`, `blend ${W.blend} s`, ...(W.start ? [`opens in ${W.start}`] : []), ...(W.surface ? [`lands on ${W.surface}: ${SURFACES[W.surface]}`] : [])];
  return `<article class="card wide" id="guide-weather"><div class="card-h"><span class="eyebrow">The sky</span><h3>Weather</h3><p class="muted">${esc(own.join(' · '))}. Values only: the style guide colours it.</p></div><div class="wxs">${stills}</div><div class="eyebrow">The first twenty minutes of its dice</div><div class="canvas">${weatherStrip(W, seed)}</div></article>`;
}
