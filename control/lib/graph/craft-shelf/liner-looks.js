/**
 * liner-looks — an airliner's look as a card (the third family beside the drones' and the helicopters', drone-looks.js
 * reading each against its craft): the same airframe read as one operator's or another's by the scheme it wears. Every
 * scheme is generic, never a real airline's: its colours and its tail's emblem are shapes, not a mark anyone owns.
 *
 * A card says what a helicopter's does (palette, slots, lights, payloads, livery: its body's colour and its civil
 * registration) and its scheme:
 *   tail      the fin's colour
 *   engines   the nacelles' colour
 *   wings     the wings' and the tailplane's colour (by default the body's); their winglets take the tail's
 *   belly     { colour, level }: the hull below `level` (half-heights of the hull from its waist) in that colour
 *   cheat     [{ colour, from, to }]: bands along the hull between two levels, the cheatline under the windows
 *   emblem    { shape: disc | sweep | chevron | bars, colour }: a generic emblem on both sides of the fin
 *   plugs     true: the cabin's windows plugged, painted over (a freighter's)
 *
 *   LINER_LOOKS, LINER_LOOK_IDS, EMBLEMS
 *   schemeCraft(stage, S, { waist, half, length })   the scheme laid on the stage's items (in place), after the body's paint
 *
 * Pure: the cuts are the livery's (livery-cut.js cutByField), by height.
 */
import { cutByField } from '../car-designer/livery-cut.js';
import { decal } from './air-surface.js';

const card = (reads, body, scheme) => Object.freeze({
  reads, palette: 'airlinerWhite', slots: {}, lights: 'nav', payloads: {},
  livery: { pattern: 'mono', colours: [body], marks: { style: 'civil' } }, scheme: Object.freeze(scheme),
});

export const LINER_LOOKS = Object.freeze({
  white: card('an airliner in plain white, its tail in its trim, its registration aft', '#f2f3f4',
    { tail: '#1f4e8c', engines: '#f2f3f4' }),
  tail: card('white all over, the colour on its tail and its engines, a white disc on the tail', '#f2f3f4',
    { tail: '#c2272d', engines: '#c2272d', emblem: { shape: 'disc', colour: '#f2f3f4' } }),
  cheatline: card('a classic scheme: a dark cheatline under the windows and a gold line beside it, a polished grey belly, its tail dark with a gold sweep', '#f2f3f4',
    { tail: '#1d2f5a', engines: '#1d2f5a', belly: { colour: '#b9bec4', level: -0.42 }, cheat: [{ colour: '#1d2f5a', from: -0.05, to: 0.1 }, { colour: '#c49a3a', from: -0.12, to: -0.07 }], emblem: { shape: 'sweep', colour: '#c49a3a' } }),
  bellied: card('white over a coloured belly that reaches up to the windows, its tail the belly\'s with a white chevron', '#f2f3f4',
    { tail: '#2a6f97', engines: '#f2f3f4', belly: { colour: '#2a6f97', level: -0.08 }, emblem: { shape: 'chevron', colour: '#f2f3f4' } }),
  bold: card('a bold scheme: the whole body in one strong colour, its tail and engines another', '#e86a1c',
    { tail: '#3a1f5c', engines: '#3a1f5c', wings: '#d5d8dc', emblem: { shape: 'bars', colour: '#e86a1c' } }),
  freighter: card('a freighter: white, its cabin\'s windows plugged, a grey tail and engines', '#eceeef',
    { tail: '#5a6068', engines: '#8c9197', plugs: true, emblem: { shape: 'bars', colour: '#eceeef' } }),
});
export const LINER_LOOK_IDS = Object.freeze(Object.keys(LINER_LOOKS));

// the emblems: convex shapes in a unit square (u across, v up), laid on the fin at its size
const poly = (n, r, cu = 0, cv = 0) => Array.from({ length: n }, (_, i) => [cu + r * Math.cos((2 * Math.PI * i) / n), cv + r * Math.sin((2 * Math.PI * i) / n)]);
const slant = (u0, v0, w, h, k) => [[u0, v0], [u0 + w, v0], [u0 + w + k, v0 + h], [u0 + k, v0 + h]];
export const EMBLEMS = Object.freeze({
  disc: [poly(20, 0.42)],
  sweep: [slant(-0.5, -0.36, 0.9, 0.16, 0.25), slant(-0.42, -0.08, 0.9, 0.16, 0.25), slant(-0.34, 0.2, 0.9, 0.16, 0.25)],
  chevron: [[[-0.45, 0.35], [-0.2, 0.35], [0.12, -0.05], [-0.13, -0.05]], [[-0.13, -0.05], [0.12, -0.05], [-0.2, -0.45], [-0.45, -0.45]]].map((p) => p.map(([u, v]) => [u + 0.15, v + 0.05])),
  bars: [[-0.45, 0.18], [-0.45, -0.06], [-0.45, -0.3]].map(([u, v]) => [[u, v], [u + 0.9, v], [u + 0.9, v + 0.14], [u, v + 0.14]]),
});

const painted = (f) => f.material === 'airPaint' && !f.fitting;
const recolour = (it, colour) => { it.fs = it.fs.map((f) => (painted(f) ? { ...f, albedo: colour } : f)); };
const extent = (fs, k) => { let lo = Infinity, hi = -Infinity; for (const f of fs) for (const c of f.corners) { if (c[k] < lo) lo = c[k]; if (c[k] > hi) hi = c[k]; } return [lo, hi]; };

/** An airliner's scheme on its stage: its belly and its cheatlines cut into the hull by height, its tail's and its
 *  engines' colours, the emblem on its fin, its windows plugged. */
export function schemeCraft(stage, S, { waist, half, length = 30 }) {
  if (!S) return stage;
  const hull = stage.find((it) => it.kind === 'craft-fuselage'), g = Math.max(1, length / 15);
  const cut = (it, valueAt, levels, colourOf) => {
    it.fs = cutByField(it.fs, { select: painted, valueAt, levels, hMax: 0.6 * g, hMin: 0.14 * g, stripH: 0.3 * g, remake: (f, p, band) => { const c = colourOf(band); return c ? { part: f.part, material: f.material, albedo: c } : null; } });
  };
  const h = (p) => (p[2] - waist) / half;
  if (hull && S.belly) cut(hull, (p) => -h(p), [-S.belly.level], (band) => (band ? S.belly.colour : null));
  if (hull) for (const c of S.cheat ?? []) cut(hull, h, [c.from, c.to], (band) => (band === 1 ? c.colour : null));
  for (const it of stage) {
    if (it.kind === 'craft-fin' && S.tail) recolour(it, S.tail);
    if (it.kind === 'craft-engine' && S.engines) recolour(it, S.engines);
    if ((it.kind === 'craft-wing' || it.kind === 'craft-stabilizer') && S.wings) recolour(it, S.wings);
    // (a wing's winglet, in the trim, the tail's colour: the scheme carried out to the tips)
    if (it.kind === 'craft-wing' && S.tail) it.fs = it.fs.map((f) => (f.material === 'airTrim' && !f.fitting ? { ...f, albedo: S.tail } : f));
  }
  // the cabin's windows plugged: its glass behind the flight deck painted over as the skin round it
  if (hull && S.plugs) {
    const [y0, y1] = extent(hull.fs, 1), deck = y1 - 0.12 * (y1 - y0), body = hull.fs.find(painted)?.albedo ?? '#eceeef';
    hull.fs = hull.fs.map((f) => (f.material === 'canopy' && f.corners.every((c) => c[1] < deck) ? { ...f, material: 'airPaint', albedo: body } : f));
  }
  // the emblem on both sides of each fin, on its skin at three-fifths of its height
  if (S.emblem) for (const it of stage.filter((q) => q.kind === 'craft-fin')) {
    const skin = it.fs.filter((f) => !f.fitting), [fy0, fy1] = extent(skin, 1), [fz0, fz1] = extent(skin, 2), [fx0, fx1] = extent(skin, 0);
    const size = Math.min(fy1 - fy0, fz1 - fz0) * 0.42, zc = fz0 + (fz1 - fz0) * 0.55, yc = (fy0 + fy1) / 2 - (fy1 - fy0) * 0.08;
    const shapes = EMBLEMS[S.emblem.shape].map((p) => p.map(([u, v]) => [u * size, v * size]));
    for (const sx of [1, -1]) it.fs.push(...decal(skin, { at: [(fx0 + fx1) / 2, yc, zc], out: [sx, 0, 0], up: [0, 0, 1] }, shapes, (f) => ({ material: f.material, albedo: S.emblem.colour }), { depth: 3 }));
  }
  return stage;
}
