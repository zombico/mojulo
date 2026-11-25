/**
 * THE ROCK'S COLOUR (a geocube's `outside.rock`, opt-in; the form render's land, form/land-read.js): what colour a land's
 * rock is where it stands, so a cliff reads as the beds it is made of and the weather that ran down it, not one stone.
 * Read corner by corner over the rock layer's base, so it is baked into the land's own colours (a page and an engine's
 * handoff get the same), and none of it costs a face.
 *
 *   readRockColour(spec)            → the rock's words, checked (null when absent)
 *   rockColourAt(R, bases, { seed? }) → (x, y, z, base) → [r, g, b] (0–255): the rock's base at a corner, from the layer's
 *                                   own (`base`) and the cube's solved bases (`bases`, era/cube-light.js: { role: '#rrggbb' })
 *
 * The words (heights are metres over the land's datum; colours are the cube's own roles, so a solved palette moves them):
 *   beds     [{ to, toward?, mix?, value? }], bottom up: each band runs from the one below's `to` up to its own; its colour
 *            is the stone pulled `mix` (0..1) of the way toward the cube's `toward` colour (a role: 'trim', 'sand',
 *            'floor', 'stone', 'accent', …) and lifted or darkened by `value` (−0.5..0.5). The pale upper rock over a red
 *            wall, a dark plinth, a band of another stone
 *   blend    metres a band fades into the next (2): a contact, not a line ruled across the cliff
 *   thin     { beds: [lo, hi], jitter }: the rock parted into thin beds lo..hi metres thick, each its own small tone (up to
 *            ±jitter), so no two ledges of a wall are the one colour and no pattern repeats (each bed's dice its own)
 *   varnish  { strength, width, mask }: the desert varnish, dark streaks run down the walls from the ledges where the water
 *            ran: `strength` (0..1) how dark, `width` metres between streaks (a streak is a function of the plan alone, so on
 *            any wall it runs straight down; a wall's corners stand a land's cell apart, so a streak is no narrower than a
 *            few of them), `mask` metres over which whole walls are clean or streaked
 *
 * Pure and seeded: the same words, bases and seed, the same colour at the same place.
 */
import { fractal2 } from '../noise/noise.js';
import { strHash } from '../city/plan/dice.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const bad = (m) => { throw new Error(`rock${m}`); };
const num = (v, lo, hi, m) => { if (!(typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi)) bad(m); };
const ROLE = /^[a-z]{3,16}$/;
export const ROCK_COLOUR = Object.freeze({ blend: 2, thin: Object.freeze({ beds: Object.freeze([4, 9]), jitter: 0.08 }), varnish: null });

/** The rock's words, checked → { beds, blend, thin, varnish }, or null when absent. */
export function readRockColour(spec) {
  if (spec === undefined || spec === null || spec === false) return null;
  if (!isObj(spec)) bad(' is { beds, blend?, thin?, varnish? }: the rock\'s colour by its beds and its weather');
  for (const k of Object.keys(spec)) if (!['beds', 'blend', 'thin', 'varnish'].includes(k)) bad(`.${k} is not a word (rock: beds, blend, thin, varnish)`);
  const R = { ...ROCK_COLOUR, ...spec, thin: spec.thin === false ? null : { ...ROCK_COLOUR.thin, ...(spec.thin || {}) } };
  if (!Array.isArray(R.beds) || !R.beds.length) bad('.beds is [{ to, toward?, mix?, value? }], bottom up, at least one');
  R.beds = R.beds.map((b, i) => {
    if (!isObj(b)) bad(`.beds[${i}] is { to, toward?, mix?, value? }`);
    for (const k of Object.keys(b)) if (!['to', 'toward', 'mix', 'value'].includes(k)) bad(`.beds[${i}].${k} is not a word (to, toward, mix, value)`);
    num(b.to, -200, 2000, `.beds[${i}].to is metres over the land's datum`);
    if (i && b.to <= R.beds[i - 1].to) bad(`.beds[${i}].to stands over the band below it (bottom up)`);
    if (b.toward !== undefined && !(typeof b.toward === 'string' && ROLE.test(b.toward))) bad(`.beds[${i}].toward is one of the cube's colours by its role ('trim', 'sand', 'floor', …)`);
    const out = { to: b.to, toward: b.toward ?? 'stone', mix: b.mix ?? (b.toward ? 0.5 : 0), value: b.value ?? 0 };
    num(out.mix, 0, 1, `.beds[${i}].mix is 0..1`);
    num(out.value, -0.5, 0.5, `.beds[${i}].value is −0.5..0.5`);
    return out;
  });
  num(R.blend, 0, 40, '.blend is metres a band fades into the next, 0..40');
  if (R.thin) {
    if (!(Array.isArray(R.thin.beds) && R.thin.beds.length === 2 && R.thin.beds[0] >= 1 && R.thin.beds[1] >= R.thin.beds[0] && R.thin.beds[1] <= 60)) bad('.thin.beds is [lo, hi] metres, 1..60');
    num(R.thin.jitter, 0, 0.4, '.thin.jitter is 0..0.4');
  }
  if (R.varnish !== null) {
    if (!isObj(R.varnish)) bad('.varnish is { strength, width?, mask? }');
    R.varnish = { width: 16, mask: 140, ...R.varnish };
    num(R.varnish.strength, 0, 1, '.varnish.strength is 0..1');
    num(R.varnish.width, 1, 100, '.varnish.width is metres between streaks, 1..100');
    num(R.varnish.mask, 10, 4000, '.varnish.mask is metres, 10..4000');
  }
  return R;
}

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The rock's base at a corner. */
export function rockColourAt(R, bases, { seed = 1 } = {}) {
  const target = (b, base) => {
    const to = bases[b.toward] ? hexRgb(bases[b.toward]) : base, k = 1 + b.value;
    return base.map((v, c) => (v + (to[c] - v) * b.mix) * k);
  };
  const sd = seed | 0, h01 = (k, tag) => strHash(`${sd}|rock-${tag}|${k}`) / 4294967296;
  // (the thin beds, from 200 m under the datum up: their tops and their tones)
  const thin = [];
  if (R.thin) for (let z = -200, k = 0; z < 2000 && thin.length < 4000; k++) { const t = R.thin.beds[0] + (R.thin.beds[1] - R.thin.beds[0]) * h01(k, 'thin'); thin.push({ z0: z, t, tone: (h01(k, 'tone') * 2 - 1) * R.thin.jitter }); z += t; }
  const thinAt = (z) => { let lo = 0, hi = thin.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (thin[m].z0 <= z) lo = m; else hi = m - 1; } return thin[lo]; };
  const V = R.varnish;
  return (x, y, z, base) => {
    // the band: the colour of the bed it is in, faded into the next over `blend` metres either side of their contact
    let c = target(R.beds[R.beds.length - 1], base);
    for (let i = 0; i < R.beds.length; i++) {
      const b = R.beds[i];
      if (z < b.to + R.blend) {
        const here = target(b, base), next = i + 1 < R.beds.length ? target(R.beds[i + 1], base) : here, w = R.blend > 0 ? smooth(b.to - R.blend, b.to + R.blend, z) : z >= b.to ? 1 : 0;
        c = here.map((v, k) => v + (next[k] - v) * w);
        break;
      }
    }
    let k = 1;
    if (thin.length) k *= 1 + thinAt(z).tone;
    if (V && V.strength > 0) {
      // (a streak: thin dark lines in the plan, so straight down any wall; its length the bed's, heavier toward the
      // ledge it ran off; whole walls clean or streaked by the slow mask)
      const s = 1 - Math.abs(fractal2(x / V.width, y / V.width, { seed: sd + 77, octaves: 2 })[0]);
      const streak = smooth(0.55, 0.9, s), mask = smooth(-0.2, 0.45, fractal2(x / V.mask, y / V.mask, { seed: sd + 79, octaves: 2 })[0]);
      const b = thin.length ? thinAt(z) : null, top = b ? 0.45 + 0.55 * smooth(0, 1, (z - b.z0) / b.t) : 1;
      k *= 1 - V.strength * 0.7 * streak * mask * top;
    }
    return c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
  };
}
