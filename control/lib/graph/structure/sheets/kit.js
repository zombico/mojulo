/**
 * structure/sheets/kit — the drawing kit: the marks a construction drawing is made of, as SVG strings, in the
 * conventions of the field (the US National CAD Standard and its drawing practice).
 *
 * Every mark is drawn in SHEET millimetres (the paper), never in model feet: a `View` maps a plan point in feet onto
 * the sheet at a drawing scale (1/4" = 1'-0" is 1:48), so a line weight, a text height and a tag are the same size on
 * every sheet whatever the building's size, as on paper.
 *
 *   line weights   cut 0.50 · projected 0.25 · hidden 0.18 dashed · dimension and witness 0.13 · grid a chain line
 *   text           2.5 mm annotation (3/32"), 3.5 mm titles, a sans face; dimension text above its line, reading
 *                  from the bottom or the right
 *   dimensions     witness lines kept off the object by a gap, arch ticks (imperial) or arrows (metric), in chains
 *   tags           door in a box (101A) · window in a hexagon (A) · room name, number and area · object in a circle
 *                  (CH-1) · wall type in a diamond (1) · grid bubble · section and elevation markers
 *   furniture      north arrow, graphic scale bar, title block
 *
 * Pure and deterministic: no `Date`, no `Intl` (numbers are formatted by hand), no `Math.random`; trigonometry from
 * dmath, so a sheet draws the same bytes on every machine. Ink on white paper;
 * the one accent (`--accent`) is for a selected tag in the book.
 */

import * as dmath from '../../../util/dmath.js';

// ── numbers, written by hand ─────────────────────────────────────────────────────────────────────────────────────

const r3 = (n) => Math.round(n * 1000) / 1000;
/** A sheet coordinate, written short (two decimals, no trailing zeros). */
export const n2 = (v) => { const s = (Math.round(v * 100) / 100).toFixed(2); return s.replace(/\.?0+$/, '') || '0'; };

/**
 * Feet as a set writes them: 12'-6", 0'-9", 12'-6 1/2" (to the half inch by default; `step` in inches).
 * Rounds the whole length once, so 11'-11.9" reads 12'-0", never 11'-12".
 */
export function ftIn(ft, { step = 0.5 } = {}) {
  const neg = ft < 0;
  const total = Math.round((Math.abs(ft) * 12) / step) * step;
  const feet = Math.floor(total / 12 + 1e-9);
  const inch = r3(total - feet * 12);
  const whole = Math.floor(inch + 1e-9);
  const frac = r3(inch - whole);
  const fracS = frac === 0 ? '' : frac === 0.5 ? ' 1/2' : frac === 0.25 ? ' 1/4' : frac === 0.75 ? ' 3/4' : ` ${n2(frac)}`;
  return `${neg ? '-' : ''}${feet}'-${whole}${fracS}"`;
}

/** The inverse of ftIn: 12'-6 1/2" → 12.5417 (feet). */
export function parseFtIn(s) {
  const m = /^(-?)(\d+)'-(\d+)(?: (\d+)\/(\d+)| ([\d.]+))?"$/.exec(String(s).trim());
  if (!m) return null;
  const frac = m[4] ? Number(m[4]) / Number(m[5]) : m[6] ? Number(m[6]) : 0;
  const v = Number(m[2]) + (Number(m[3]) + frac) / 12;
  return m[1] ? -v : v;
}

/** Feet as millimetres, whole (ISO practice writes building dimensions in mm without the unit). */
export const mmOf = (ft) => String(Math.round(ft * 304.8));

/** A length in the sheet's units. */
export const lengthText = (ft, units = 'imperial') => (units === 'metric' ? mmOf(ft) : ftIn(ft));

/** An area as a room tag states it: 245 SF, or 22.8 m². */
export const areaText = (sqft, units = 'imperial') => (units === 'metric' ? `${n2(Math.round(sqft * 0.09290304 * 10) / 10)} m²` : `${Math.round(sqft)} SF`);

/** Escape for text content (a dimension's inch mark stays a plain "). */
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Escape for an attribute value. */
export const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

// ── scale and view ───────────────────────────────────────────────────────────────────────────────────────────────

/** Architectural scales: the name a set prints and its ratio (1/4" = 1'-0" is 1:48). */
export const SCALES = {
  '1/32': { name: '1/32" = 1\'-0"', ratio: 384 },
  '1/16': { name: '1/16" = 1\'-0"', ratio: 192 },
  '3/32': { name: '3/32" = 1\'-0"', ratio: 128 },
  '1/8': { name: '1/8" = 1\'-0"', ratio: 96 },
  '3/16': { name: '3/16" = 1\'-0"', ratio: 64 },
  '1/4': { name: '1/4" = 1\'-0"', ratio: 48 },
  '3/8': { name: '3/8" = 1\'-0"', ratio: 32 },
  '1/2': { name: '1/2" = 1\'-0"', ratio: 24 },
  '1:50': { name: '1:50', ratio: 50, metric: true },
  '1:100': { name: '1:100', ratio: 100, metric: true },
  '1:200': { name: '1:200', ratio: 200, metric: true },
  '1:500': { name: '1:500', ratio: 500, metric: true },
};

/** The largest standard scale at which `extentFt` (w, h) fits `boxMm` (w, h) on the sheet. */
export function fitScale(extentFt, boxMm, units = 'imperial') {
  // the smallest (1/32", 1:500) is for a building the size of a mall: a house fits long before it
  const keys = units === 'metric' ? ['1:50', '1:100', '1:200', '1:500'] : ['1/2', '3/8', '1/4', '3/16', '1/8', '3/32', '1/16', '1/32'];
  for (const k of keys) {
    const mmPerFt = 304.8 / SCALES[k].ratio;
    if (extentFt[0] * mmPerFt <= boxMm[0] && extentFt[1] * mmPerFt <= boxMm[1]) return k;
  }
  return keys[keys.length - 1];
}

/**
 * A view: plan feet → sheet mm. `origin` is the plan point that lands at sheet `at`; plan y runs down the sheet as
 * the plan is stored (north up). → { x(ftX), y(ftY), p([x,y]), len(ft), scale, mmPerFt }
 */
export function makeView({ scale = '1/4', origin = [0, 0], at = [0, 0] } = {}) {
  const mmPerFt = 304.8 / SCALES[scale].ratio;
  const x = (fx) => at[0] + (fx - origin[0]) * mmPerFt;
  const y = (fy) => at[1] + (fy - origin[1]) * mmPerFt;
  return { scale, mmPerFt, x, y, p: ([fx, fy]) => [x(fx), y(fy)], len: (ft) => ft * mmPerFt };
}

// ── line weights and the sheet's style ───────────────────────────────────────────────────────────────────────────

/** Pen widths in mm at sheet scale, by what a line is (the hierarchy a drawing reads by). */
export const PENS = { cut: 0.5, proj: 0.25, hidden: 0.18, dim: 0.13, grid: 0.13, border: 0.7, title: 0.35 };

/** The sheet's style block: every mark carries a class from here, so the hierarchy is one table. */
export function sheetStyle() {
  return `<style>
.s-cut{fill:none;stroke:var(--ink,#111);stroke-width:${PENS.cut};stroke-linejoin:miter}
.s-poche{fill:var(--poche,#2b2b2b);stroke:var(--ink,#111);stroke-width:${PENS.cut}}
.s-proj{fill:none;stroke:var(--ink,#111);stroke-width:${PENS.proj}}
.s-hid{fill:none;stroke:var(--ink,#111);stroke-width:${PENS.hidden};stroke-dasharray:1.5 1}
.s-dim{fill:none;stroke:var(--ink,#111);stroke-width:${PENS.dim}}
.s-grid{fill:none;stroke:var(--ink,#111);stroke-width:${PENS.grid};stroke-dasharray:6 1.2 1 1.2}
.s-fill{fill:var(--ink,#111);stroke:none}
.s-paper{fill:var(--paper,#fff);stroke:var(--ink,#111);stroke-width:${PENS.dim}}
.s-border{fill:none;stroke:var(--ink,#111);stroke-width:${PENS.border}}
.s-rule{fill:none;stroke:var(--ink,#111);stroke-width:${PENS.title}}
.s-t{font-family:'Helvetica Neue',Arial,sans-serif;font-size:2.5px;fill:var(--ink,#111)}
.s-tb{font-family:'Helvetica Neue',Arial,sans-serif;font-size:2.5px;font-weight:700;fill:var(--ink,#111)}
.s-ts{font-family:'Helvetica Neue',Arial,sans-serif;font-size:1.8px;fill:var(--ink,#111);letter-spacing:.04em}
.s-halo{paint-order:stroke;stroke:var(--paper,#fff);stroke-width:0.9px;stroke-linejoin:round}
.s-th{font-family:'Helvetica Neue',Arial,sans-serif;font-size:3.5px;font-weight:700;fill:var(--ink,#111)}
.s-tag.on>*{stroke:var(--accent,#c2410c)}.s-tag.on text{fill:var(--accent,#c2410c)}
</style>`;
}

// ── dimensions ───────────────────────────────────────────────────────────────────────────────────────────────────

const TICK = 1.2;           // half-length of an arch tick, mm
const ARROW = 1.6;          // arrow length, mm
const GAP = 1.0;            // witness line gap off the object, mm
const EXT = 1.5;            // witness line past the dimension line, mm

/**
 * One dimension between two sheet points, its line set `offset` mm off the measured edge (positive: to the left of
 * a→b, which for a left-to-right run is up the sheet). The text states `ft` in the units; an arch tick (imperial) or
 * an arrow (metric) closes each end. Text sits above the line, reading from the bottom (or from the right on a
 * vertical run).
 */
export function dimension(a, b, ft, { offset = 8, units = 'imperial', text } = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = dmath.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  const nx = uy, ny = -ux;                      // left normal (sheet y is down)
  const s = Math.sign(offset) || 1;
  const A = [a[0] + nx * offset, a[1] + ny * offset], B = [b[0] + nx * offset, b[1] + ny * offset];
  const w = (p, d) => [p[0] + nx * d, p[1] + ny * d];
  const out = [];
  // witness lines: from a gap off the object to just past the dimension line
  for (const p of [a, b]) {
    const p0 = w(p, s * GAP), p1 = w(p, offset + s * EXT);
    out.push(`<line class="s-dim" x1="${n2(p0[0])}" y1="${n2(p0[1])}" x2="${n2(p1[0])}" y2="${n2(p1[1])}"/>`);
  }
  out.push(`<line class="s-dim" x1="${n2(A[0] - ux * EXT)}" y1="${n2(A[1] - uy * EXT)}" x2="${n2(B[0] + ux * EXT)}" y2="${n2(B[1] + uy * EXT)}"/>`);
  if (units === 'metric') {
    for (const [P, d] of [[A, 1], [B, -1]]) {
      const tip = P, back = [P[0] + ux * ARROW * d, P[1] + uy * ARROW * d];
      const l = [back[0] + nx * 0.45, back[1] + ny * 0.45], r = [back[0] - nx * 0.45, back[1] - ny * 0.45];
      out.push(`<path class="s-fill" d="M${n2(tip[0])} ${n2(tip[1])}L${n2(l[0])} ${n2(l[1])}L${n2(r[0])} ${n2(r[1])}Z"/>`);
    }
  } else {
    // the arch tick: a short heavy slash at 45° through each end
    const tx = (ux + nx) / Math.SQRT2, ty = (uy + ny) / Math.SQRT2;
    for (const P of [A, B]) out.push(`<line class="s-proj" x1="${n2(P[0] - tx * TICK)}" y1="${n2(P[1] - ty * TICK)}" x2="${n2(P[0] + tx * TICK)}" y2="${n2(P[1] + ty * TICK)}"/>`);
  }
  // text: centred above the line, turned to read from the bottom or the right
  // into [-90, 90): a vertical run, up or down the sheet, turns to -90 (it reads from the right)
  let ang = (dmath.atan2(uy, ux) * 180) / Math.PI;
  if (ang >= 89.999) ang -= 180;
  else if (ang < -90.001) ang += 180;
  const ar = (ang * Math.PI) / 180;
  const up = [dmath.sin(ar), -dmath.cos(ar)];     // "above" in the turned text's frame
  const M = [(A[0] + B[0]) / 2 + up[0] * 0.9, (A[1] + B[1]) / 2 + up[1] * 0.9];
  const label = text ?? lengthText(ft, units);
  out.push(`<text class="s-t" text-anchor="middle" x="${n2(M[0])}" y="${n2(M[1])}"${Math.abs(ang) > 0.001 ? ` transform="rotate(${n2(ang)} ${n2(M[0])} ${n2(M[1])})"` : ''}>${esc(label)}</text>`);
  return `<g class="s-dimension" data-ft="${r3(ft)}">${out.join('')}</g>`;
}

/**
 * A chain of dimensions along one line: `stations` are plan distances (ft) along the run from `start`, sorted;
 * each consecutive pair is dimensioned, all on one line `offset` off. `toSheet(s)` gives the sheet point of station s.
 */
export function dimChain(stations, toSheet, { offset = 8, units = 'imperial' } = {}) {
  const st = [...new Set(stations.map(r3))].sort((a, b) => a - b);
  const out = [];
  for (let i = 1; i < st.length; i++) out.push(dimension(toSheet(st[i - 1]), toSheet(st[i]), st[i] - st[i - 1], { offset, units }));
  return out.join('');
}

// ── tags ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const tagG = (cls, id, body) => `<g class="s-tag ${cls}"${id ? ` data-tag="${escAttr(id)}"` : ''}>${body}</g>`;
const label = (x, y, s, cls = 's-t') => `<text class="${cls}" text-anchor="middle" dominant-baseline="central" x="${n2(x)}" y="${n2(y)}">${esc(s)}</text>`;

/** A door tag: the number in a box (101A). */
export function doorTag([x, y], tag) {
  const w = Math.max(6, String(tag).length * 1.55 + 1.6), h = 3.6;
  return tagG('door', tag, `<rect class="s-paper" x="${n2(x - w / 2)}" y="${n2(y - h / 2)}" width="${n2(w)}" height="${n2(h)}"/>${label(x, y, tag)}`);
}

/** A window tag: the type letter in a hexagon (A). */
export function windowTag([x, y], type) {
  const r = 2.3;
  const pts = [0, 1, 2, 3, 4, 5].map((i) => { const a = (Math.PI / 3) * i; return `${n2(x + r * dmath.cos(a))},${n2(y + r * dmath.sin(a))}`; }).join(' ');
  return tagG('window', type, `<polygon class="s-paper" points="${pts}"/>${label(x, y, type)}`);
}

/** An object (furniture) tag: the FF&E type in a circle (CH-1). */
export function objectTag([x, y], tag) {
  const r = Math.max(2.4, String(tag).length * 0.75);
  return tagG('object', tag, `<circle class="s-paper" cx="${n2(x)}" cy="${n2(y)}" r="${n2(r)}"/>${label(x, y, tag, 's-ts')}`);
}

/** A wall type tag: the number in a diamond (1). */
export function wallTag([x, y], type) {
  const r = 2.3;
  return tagG('wall', type, `<polygon class="s-paper" points="${n2(x)},${n2(y - r)} ${n2(x + r)},${n2(y)} ${n2(x)},${n2(y + r)} ${n2(x - r)},${n2(y)}"/>${label(x, y, type)}`);
}

/** A room tag: the name over a rule over the number and the area (no box, as a plan writes it). */
export function roomTag([x, y], { name, number, area, units = 'imperial' }) {
  const N = String(name || '').toUpperCase();
  const w = Math.max(N.length * 1.75, 10);
  return tagG('room', number,
    `<text class="s-tb" text-anchor="middle" x="${n2(x)}" y="${n2(y - 1.2)}">${esc(N)}</text>`
    + `<line class="s-dim" x1="${n2(x - w / 2)}" y1="${n2(y)}" x2="${n2(x + w / 2)}" y2="${n2(y)}"/>`
    + `<text class="s-t" text-anchor="middle" x="${n2(x)}" y="${n2(y + 3)}">${esc(number)}${area != null ? `  ·  ${esc(areaText(area, units))}` : ''}</text>`);
}

/** A grid bubble at the end of a grid line: a letter or number in a circle. */
export function gridBubble([x, y], id) {
  return tagG('grid', id, `<circle class="s-paper" cx="${n2(x)}" cy="${n2(y)}" r="3.2"/>${label(x, y, id, 's-tb')}`);
}

/**
 * A section marker at sheet point `at`, looking in `dir` ('N'|'S'|'E'|'W'): a circle split by a rule, the detail
 * number over the sheet id, with a filled arrow showing the direction of view.
 */
export function sectionMarker([x, y], { detail = '1', sheet = 'A-301', dir = 'N' } = {}) {
  const r = 4;
  const a = { N: -90, E: 0, S: 90, W: 180 }[dir] ?? -90;
  const ar = (a * Math.PI) / 180;
  const tip = [x + dmath.cos(ar) * (r + 2.6), y + dmath.sin(ar) * (r + 2.6)];
  const s1 = [x + dmath.cos(ar + 0.9) * r, y + dmath.sin(ar + 0.9) * r], s2 = [x + dmath.cos(ar - 0.9) * r, y + dmath.sin(ar - 0.9) * r];
  return tagG('section', `${detail}/${sheet}`,
    `<path class="s-fill" d="M${n2(tip[0])} ${n2(tip[1])}L${n2(s1[0])} ${n2(s1[1])}L${n2(s2[0])} ${n2(s2[1])}Z"/>`
    + `<circle class="s-paper" cx="${n2(x)}" cy="${n2(y)}" r="${r}"/><line class="s-dim" x1="${n2(x - r)}" y1="${n2(y)}" x2="${n2(x + r)}" y2="${n2(y)}"/>`
    + label(x, y - 1.7, detail, 's-tb') + label(x, y + 1.8, sheet, 's-ts'));
}

/** An elevation marker: the same circle, the arrow toward the face it draws. */
export const elevationMarker = (at, o = {}) => sectionMarker(at, { sheet: 'A-201', ...o }).replace('s-tag section', 's-tag elevation');

/** A section cut line across the plan, chain-dashed, with a marker at each end looking the same way. */
export function sectionLine(a, b, { detail = '1', sheet = 'A-301', dir = 'N' } = {}) {
  return `<g class="s-cutline"><line class="s-grid" style="stroke-width:${PENS.proj}" x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(b[0])}" y2="${n2(b[1])}"/>${sectionMarker(a, { detail, sheet, dir })}${sectionMarker(b, { detail, sheet, dir })}</g>`;
}

// ── framing marks ────────────────────────────────────────────────────────────────────────────────────────────────

/** A member mark: the type (B1, H2, P1) in a box with clipped corners, as a framing plan writes a beam or post mark. */
export function memberTag([x, y], tag) {
  const w = Math.max(5.6, String(tag).length * 1.6 + 1.6), h = 3.4, c = 0.8;
  const x0 = x - w / 2, x1 = x + w / 2, y0 = y - h / 2, y1 = y + h / 2;
  return tagG('member', tag, `<polygon class="s-paper" points="${n2(x0 + c)},${n2(y0)} ${n2(x1 - c)},${n2(y0)} ${n2(x1)},${n2(y0 + c)} ${n2(x1)},${n2(y1 - c)} ${n2(x1 - c)},${n2(y1)} ${n2(x0 + c)},${n2(y1)} ${n2(x0)},${n2(y1 - c)} ${n2(x0)},${n2(y0 + c)}"/>${label(x, y, tag, 's-tb')}`);
}

const arrowHead = (tip, ux, uy, len = ARROW) => {
  const back = [tip[0] - ux * len, tip[1] - uy * len];
  const l = [back[0] - uy * 0.5, back[1] + ux * 0.5], r = [back[0] + uy * 0.5, back[1] - ux * 0.5];
  return `<path class="s-fill" d="M${n2(tip[0])} ${n2(tip[1])}L${n2(l[0])} ${n2(l[1])}L${n2(r[0])} ${n2(r[1])}Z"/>`;
};

/**
 * A field of repeated members (joists, rafters), as a framing plan draws one: a line in the direction the members run,
 * across their bearings `a`→`b`, an arrow at each end; a light line across the field from `c` to `d` (its extent) with
 * ticks; the size and spacing written along the arrow ("2x10 @ 16" O.C.").
 */
export function fieldArrow(a, b, c, d, text, { role = '' } = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = dmath.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  const out = [`<line class="s-proj" x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(b[0])}" y2="${n2(b[1])}"/>`, arrowHead(b, ux, uy), arrowHead(a, -ux, -uy)];
  if (c && d) {
    out.push(`<line class="s-dim" x1="${n2(c[0])}" y1="${n2(c[1])}" x2="${n2(d[0])}" y2="${n2(d[1])}"/>`);
    for (const P of [c, d]) out.push(`<line class="s-dim" x1="${n2(P[0] - ux * 1.2)}" y1="${n2(P[1] - uy * 1.2)}" x2="${n2(P[0] + ux * 1.2)}" y2="${n2(P[1] + uy * 1.2)}"/>`);
  }
  let ang = (dmath.atan2(uy, ux) * 180) / Math.PI;
  if (ang >= 89.999) ang -= 180; else if (ang < -90.001) ang += 180;
  const ar = (ang * Math.PI) / 180;
  const up = [dmath.sin(ar), -dmath.cos(ar)];
  const M = [(a[0] + b[0]) / 2 + up[0] * 1.1, (a[1] + b[1]) / 2 + up[1] * 1.1];
  const rot = Math.abs(ang) > 0.001 ? ` transform="rotate(${n2(ang)} ${n2(M[0])} ${n2(M[1])})"` : '';
  out.push(`<text class="s-tb" text-anchor="middle" x="${n2(M[0])}" y="${n2(M[1])}"${rot}>${esc(text)}</text>`);
  return `<g class="s-field"${role ? ` data-role="${escAttr(role)}"` : ''}>${out.join('')}</g>`;
}

/** A slope arrow on a roof plane: an arrow down the fall from `a` to `b`, the pitch written at its tail (6:12). */
export function slopeArrow(a, b, text) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = dmath.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L;
  return `<g class="s-slope"><line class="s-dim" x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(b[0])}" y2="${n2(b[1])}"/>${arrowHead(b, ux, uy, 1.4)}`
    + `<text class="s-ts" text-anchor="middle" dominant-baseline="central" x="${n2(a[0] - ux * 3.2)}" y="${n2(a[1] - uy * 3.2)}">${esc(text)}</text></g>`;
}

// ── services marks (the NECA / ANSI Y32.9 symbols a residential electrical plan uses) ───────────────────────────────

/** A duplex receptacle: a circle with two short parallel lines through it. */
export function receptacleMark([x, y], { tag } = {}) {
  const r = 1.1;
  return `<g class="s-device receptacle"${tag ? ` data-tag="${escAttr(tag)}"` : ''}><circle class="s-paper" cx="${n2(x)}" cy="${n2(y)}" r="${r}"/>`
    + `<line class="s-dim" x1="${n2(x - 1.7)}" y1="${n2(y - 0.4)}" x2="${n2(x + 1.7)}" y2="${n2(y - 0.4)}"/><line class="s-dim" x1="${n2(x - 1.7)}" y1="${n2(y + 0.4)}" x2="${n2(x + 1.7)}" y2="${n2(y + 0.4)}"/></g>`;
}

/** A single-pole switch: the letter S. */
export function switchMark([x, y], { tag } = {}) {
  return `<g class="s-device switch"${tag ? ` data-tag="${escAttr(tag)}"` : ''}><text class="s-tb" text-anchor="middle" dominant-baseline="central" x="${n2(x)}" y="${n2(y)}">S</text></g>`;
}

/** A ceiling outlet (a light's box): a circle with four ticks. */
export function ceilingMark([x, y], { tag } = {}) {
  const r = 1.4;
  const ticks = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([u, v]) => `<line class="s-dim" x1="${n2(x + u * r)}" y1="${n2(y + v * r)}" x2="${n2(x + u * (r + 0.9))}" y2="${n2(y + v * (r + 0.9))}"/>`).join('');
  return `<g class="s-device ceiling"${tag ? ` data-tag="${escAttr(tag)}"` : ''}><circle class="s-paper" cx="${n2(x)}" cy="${n2(y)}" r="${r}"/>${ticks}</g>`;
}

/** A panelboard: a rectangle, half filled on its diagonal, with its name. */
export function panelMark([x, y], name = 'PANEL') {
  const w = 5, h = 2.2;
  return `<g class="s-device panel" data-tag="${escAttr(name)}"><rect class="s-paper" x="${n2(x - w / 2)}" y="${n2(y - h / 2)}" width="${w}" height="${h}"/>`
    + `<path class="s-fill" d="M${n2(x - w / 2)} ${n2(y + h / 2)}L${n2(x + w / 2)} ${n2(y - h / 2)}L${n2(x + w / 2)} ${n2(y + h / 2)}Z"/>`
    + `<text class="s-ts" text-anchor="middle" x="${n2(x)}" y="${n2(y - h / 2 - 1)}">${esc(name)}</text></g>`;
}

/** A downspout: a circle at its foot, with its number (DS1) beside it. */
export function downspoutMark([x, y], tag) {
  return tagG('downspout', tag, `<circle class="s-paper" cx="${n2(x)}" cy="${n2(y)}" r="1.3"/><circle class="s-fill" cx="${n2(x)}" cy="${n2(y)}" r="0.45"/>`
    + `<text class="s-ts" x="${n2(x + 2)}" y="${n2(y - 1.6)}">${esc(tag)}</text>`);
}

// ── north arrow, scale bar, title block ──────────────────────────────────────────────────────────────────────────

/** A north arrow: a circle with a half-filled arrow and N, pointing `deg` clockwise from up (0 = plan north up). */
export function northArrow([x, y], deg = 0) {
  const r = 5;
  return `<g class="s-north" transform="rotate(${n2(deg)} ${n2(x)} ${n2(y)})"><circle class="s-dim" cx="${n2(x)}" cy="${n2(y)}" r="${r}"/>`
    + `<path class="s-fill" d="M${n2(x)} ${n2(y - r - 1)}L${n2(x + 2.2)} ${n2(y + r - 1)}L${n2(x)} ${n2(y + r - 2.6)}Z"/>`
    + `<path class="s-paper" d="M${n2(x)} ${n2(y - r - 1)}L${n2(x - 2.2)} ${n2(y + r - 1)}L${n2(x)} ${n2(y + r - 2.6)}Z"/>`
    + `<text class="s-tb" text-anchor="middle" x="${n2(x)}" y="${n2(y - r - 2.2)}">N</text></g>`;
}

/**
 * A graphic scale bar at the view's scale: alternating filled and open segments, 0 at the left. Imperial in feet
 * (0 4 8 16), metric in metres (0 1 2 5).
 */
export function scaleBar([x, y], view, units = 'imperial') {
  const metric = units === 'metric';
  const marks = metric ? [0, 1, 2, 5] : [0, 4, 8, 16];
  const toFt = (v) => (metric ? v / 0.3048 : v);
  const h = 1.4;
  const out = [];
  for (let i = 1; i < marks.length; i++) {
    const x0 = x + view.len(toFt(marks[i - 1])), x1 = x + view.len(toFt(marks[i]));
    out.push(`<rect class="${i % 2 ? 's-fill' : 's-paper'}" x="${n2(x0)}" y="${n2(y)}" width="${n2(x1 - x0)}" height="${h}"/>`);
  }
  for (const m of marks) out.push(`<text class="s-ts" text-anchor="middle" x="${n2(x + view.len(toFt(m)))}" y="${n2(y + h + 2.4)}">${m}${m === marks[marks.length - 1] ? (metric ? ' m' : "'") : ''}</text>`);
  out.push(`<text class="s-ts" x="${n2(x)}" y="${n2(y - 1.2)}">${esc(SCALES[view.scale].name)}</text>`);
  return `<g class="s-scalebar">${out.join('')}</g>`;
}

/** Sheet sizes (mm, landscape): ANSI B (tabloid) for the book, ARCH D for a full set. */
export const SHEETS = { 'ANSI B': [431.8, 279.4], 'ARCH C': [609.6, 457.2], 'ARCH D': [914.4, 609.6] };

/**
 * The title block: a strip down the sheet's right edge, as NCS lays it out: the project, the sheet title, the
 * sheet id (large, at the foot), the scale, the revision. No date is written (a recipe has no clock); the field is
 * left for the operator.
 * → { svg, drawing: [x, y, w, h] } — the drawing area left of the strip, inside the border.
 */
export function titleBlock({ size = 'ANSI B', project = 'mojulo house', title = '', id = 'A-101', scale = null, revision = null, sheetOf = null } = {}) {
  const [W, H] = SHEETS[size] || SHEETS['ANSI B'];
  const m = 10, strip = 62;
  const bx = W - m - strip;
  const rows = [
    ['PROJECT', project],
    ['SHEET TITLE', title],
    ['SCALE', scale ? (SCALES[scale]?.name ?? scale) : 'AS NOTED'],
    ['REVISION', revision != null ? String(revision) : '—'],
    ['DATE', ''],
    ...(sheetOf ? [['SHEET', sheetOf]] : []),
  ];
  const out = [`<rect class="s-border" x="${m}" y="${m}" width="${n2(W - 2 * m)}" height="${n2(H - 2 * m)}"/>`, `<line class="s-rule" x1="${n2(bx)}" y1="${m}" x2="${n2(bx)}" y2="${n2(H - m)}"/>`];
  let yy = m;
  for (const [k, v] of rows) {
    out.push(`<text class="s-ts" x="${n2(bx + 3)}" y="${n2(yy + 4)}">${k}</text>`);
    // long values wrap at the strip's width, a word at a time
    const words = String(v).split(/\s+/).filter(Boolean);
    const lines = [];
    for (const w of words) { const last = lines[lines.length - 1]; if (last && (last + ' ' + w).length <= 22) lines[lines.length - 1] = `${last} ${w}`; else lines.push(w); }
    lines.slice(0, 3).forEach((ln, i) => out.push(`<text class="s-tb" x="${n2(bx + 3)}" y="${n2(yy + 8.5 + i * 3.4)}">${esc(ln)}</text>`));
    yy += 8.5 + Math.max(1, Math.min(lines.length, 3)) * 3.4 + 1;
    out.push(`<line class="s-dim" x1="${n2(bx)}" y1="${n2(yy)}" x2="${n2(W - m)}" y2="${n2(yy)}"/>`);
  }
  // the sheet id, large, in its own box at the foot
  const idTop = H - m - 26;
  out.push(`<line class="s-rule" x1="${n2(bx)}" y1="${n2(idTop)}" x2="${n2(W - m)}" y2="${n2(idTop)}"/>`);
  out.push(`<text class="s-ts" x="${n2(bx + 3)}" y="${n2(idTop + 4)}">SHEET</text>`);
  out.push(`<text class="s-th" style="font-size:11px" text-anchor="middle" x="${n2(bx + strip / 2)}" y="${n2(idTop + 19)}">${esc(id)}</text>`);
  return { svg: `<g class="s-titleblock">${out.join('')}</g>`, drawing: [m + 4, m + 4, bx - m - 8, H - 2 * m - 8], size: [W, H] };
}

/** A drawing title under a view: the detail circle, the title, the scale (as a set labels each drawing). */
export function drawingTitle([x, y], { detail = '1', title = '', scale = null, sheet = null } = {}) {
  return `<g class="s-drawingtitle"><circle class="s-paper" cx="${n2(x + 4)}" cy="${n2(y)}" r="4"/><line class="s-dim" x1="${n2(x)}" y1="${n2(y)}" x2="${n2(x + 8)}" y2="${n2(y)}"/>`
    + label(x + 4, y - 1.7, detail, 's-tb') + (sheet ? label(x + 4, y + 1.8, sheet, 's-ts') : '')
    + `<text class="s-th" x="${n2(x + 11)}" y="${n2(y + 0.4)}">${esc(String(title).toUpperCase())}</text>`
    + `<line class="s-rule" x1="${n2(x + 11)}" y1="${n2(y + 2)}" x2="${n2(x + 11 + Math.max(40, String(title).length * 2.5))}" y2="${n2(y + 2)}"/>`
    + (scale ? `<text class="s-ts" x="${n2(x + 11)}" y="${n2(y + 5.2)}">${esc(SCALES[scale]?.name ?? scale)}</text>` : '') + '</g>';
}

/** A whole sheet: the paper, the style, the title block and the drawings, in mm (width/height in mm too). */
export function sheetSvg({ size = 'ANSI B', body = '', block }) {
  const [W, H] = SHEETS[size] || SHEETS['ANSI B'];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n2(W)}mm" height="${n2(H)}mm" viewBox="0 0 ${n2(W)} ${n2(H)}">${sheetStyle()}<rect width="${n2(W)}" height="${n2(H)}" fill="var(--paper,#fff)"/>${block ? block.svg : ''}${body}</svg>`;
}
