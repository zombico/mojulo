/**
 * THE WEATHER CARD — the bible's page for a world's climate: each state it can be in as a grey still (the sky's value,
 * the fog's veil, what falls), and a strip of the first twenty minutes of its dice. Values only; the style guide
 * colours it. Pure: the same climate and seed, the same card.
 */
import { STATES, weatherRuns, SURFACES, dice } from '../weather/weather.js';
import { airColour, castOf } from '../era/air.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const grey = (v) => { const n = Math.round(255 * Math.min(1, Math.max(0, v))); return `rgb(${n},${n},${n})`; };
const r1 = (v) => Math.round(v * 10) / 10;
const rgb = (c) => `rgb(${c.map((v) => Math.round(255 * Math.min(1, Math.max(0, v)))).join(',')})`;
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

/** One state as a grey still: sky, a ground line, the fog's veil over both, and the fall as strokes or dots. */
export function stateStill(name, w = 220, h = 140, air = null) {
  const S = STATES[name], F = S.fall, op = Math.min(0.92, 1 - Math.exp(-S.fog / 3.2));
  // in a style's air: the sky and the fog in its colours, the dark side in its shade, a shadow only where the sun is out
  if (air) return styledStill(name, w, h, air);
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

// a state drawn in a style's air (era/air.js): the sky takes the fog's colour at its own value, the ground the shade, the
// fog a veil in the state's colour, the light taken off in the shade (never black), a cast shadow where the sun allows
function styledStill(name, w, h, air) {
  const S = STATES[name], F = S.fall, fog = airColour(air, name, S.veil), sky = airColour(air, name, Math.min(1.1, S.sky * 0.88)), sh = hexRgb(air.shade);
  const op = Math.min(0.92, 1 - Math.exp(-S.fog / 3.2)), band = (v) => (air.body === 'smooth' ? v : Math.round(v * air.steps) / air.steps), cast = castOf(S, air);
  const steps = air.body === 'smooth' ? 0 : air.steps;
  let fall = '';
  if (F) {
    const n = Math.min(70, Math.round(14 + F.rate * 50)), len = F.glyph === 'streak' ? Math.max(6, F.length * 28) : Math.max(2, F.size * 90), lean = Math.tan((F.slant * Math.PI) / 180) * len;
    const c = rgb(fog.map((v) => v * 0.4 + F.value * 0.6));
    for (let i = 0; i < n; i++) {
      const x = r1(dice(7, i, 1) * (w + 20) - 10), y = r1(dice(7, i, 2) * (h * 0.85));
      fall += F.glyph === 'streak' ? `<line x1="${x}" y1="${y}" x2="${r1(x + lean)}" y2="${r1(y + len)}" stroke="${c}" stroke-width="1"/>` : `<circle cx="${x}" cy="${y}" r="${r1(len / 2)}" fill="${c}"/>`;
    }
  }
  // the fog banded or smooth over the far ground: planes of haze, or a gradient
  let haze = '';
  if (steps) for (let i = 0; i < steps; i++) { haze += `<rect y="${r1(h * 0.55 + (h * 0.2 * i) / steps)}" width="${w}" height="${r1(h * 0.2 / steps + 0.5)}" fill="${rgb(fog)}" opacity="${r1(band(op * (1 - i / steps)) * 100) / 100}"/>`; }
  else haze = `<defs><linearGradient id="g-${name}" x1="0" y1="0" x2="0" y2="1"><stop offset="0.5" stop-color="${rgb(fog)}" stop-opacity="${r1(op * 100) / 100}"/><stop offset="0.75" stop-color="${rgb(fog)}" stop-opacity="0"/></linearGradient></defs><rect y="${h * 0.5}" width="${w}" height="${h * 0.3}" fill="url(#g-${name})"/>`;
  const ground = rgb(mixc(sh, fog, 0.35).map((v) => v * 0.85)), shadow = cast > 0.02 ? `<ellipse cx="${w * 0.42}" cy="${h * 0.86}" rx="${w * 0.16}" ry="${h * 0.035}" fill="${rgb(sh.map((v) => v * 0.55))}" opacity="${r1(cast * 70) / 100}"/>` : '';
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(name)}"><rect width="${w}" height="${h}" fill="${rgb(sky)}"/><rect y="${h * 0.7}" width="${w}" height="${h * 0.3}" fill="${ground}"/>${shadow}${haze}<rect width="${w}" height="${h}" fill="${rgb(sh)}" opacity="${r1(Math.min(0.75, S.dim * 0.7 + Math.max(0, 0.85 - S.sky) * 0.4) * (0.6 + 0.8 * air.depth) * 100) / 100}"/>${fall}</svg>`;
}
const mixc = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);

/** The first `span` seconds of the dice as a strip: a bar per run, its grey the state's sky, its label the state. */
export function weatherStrip(W, seed, span = 1200, w = 880, h = 46) {
  const runs = weatherRuns(W, seed, span), k = w / span;
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="the first ${span / 60} minutes">${runs.map((r) => `<rect x="${r1(r.from * k)}" width="${r1((r.to - r.from) * k)}" height="${h}" fill="${grey(STATES[r.is].sky)}" stroke="#fff"/><text x="${r1(r.from * k + 4)}" y="${h / 2 + 4}" font-size="11" fill="${STATES[r.is].sky > 0.6 ? '#17202e' : '#fff'}">${esc(r.is)}</text>`).join('')}</svg>`;
}

/** The card: `W` a read weather, `seed` the world's. */
export function weatherCardHtml(W, seed, air = null) {
  const names = Object.keys(W.climate), total = names.reduce((a, n) => a + W.climate[n], 0);
  const stills = names.map((n) => `<figure class="wx"><div>${stateStill(n, 220, 140, air)}</div><figcaption><b>${esc(n)}</b> <span class="muted">${Math.round((100 * W.climate[n]) / total)}%</span><br><span class="muted">${esc(STATES[n].read)}</span></figcaption></figure>`).join('');
  const own = [`dwell ${W.dwell[0]}–${W.dwell[1]} s`, `blend ${W.blend} s`, ...(W.start ? [`opens in ${W.start}`] : []), ...(W.surface ? [`lands on ${W.surface}: ${SURFACES[W.surface]}`] : [])];
  const sw = (c) => `<i class="sw" style="background:${esc(c)}"></i>`;
  const airRow = air ? `<p class="muted">Air in this style: ${esc(air.body)} fog${air.body === 'smooth' ? '' : ` ×${air.steps}`} ${sw(air.hue)}${esc(air.hue)} · shade ${sw(air.shade)}${esc(air.shade)} (depth ${air.depth}) · cast shadows ${air.cast} · sky follows ${air.skyFollow}${Object.keys(air.states).length ? ' · ' + Object.entries(air.states).map(([n, s]) => `${esc(n)} ${sw(s.hue)}`).join(' ') : ''}</p>` : '';
  return `<article class="card wide" id="guide-weather"><div class="card-h"><span class="eyebrow">The sky</span><h3>Weather</h3><p class="muted">${esc(own.join(' · '))}. Values only: the style guide colours it.</p>${airRow}</div><div class="wxs">${stills}</div><div class="eyebrow">The first twenty minutes of its dice</div><div class="canvas">${weatherStrip(W, seed)}</div></article>`;
}
