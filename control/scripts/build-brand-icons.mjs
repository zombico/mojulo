#!/usr/bin/env node
/**
 * Bake the door icons into dot-relief lattices — the mark's construction,
 * applied to the workshop's doors.
 *
 * The `m` is a halftone relief (scripts/build-brand-mark.mjs). Its icons were
 * not: they were 1.25px hairlines that could have belonged to any dark
 * dashboard. This bakes the SAME sampling over the SAME radius ramp for every
 * icon in workshop-nav.jsx, so a door and the mark become samples of one
 * instrument rather than a logo sitting near an icon set.
 *
 * Why a build step, for the same reasons the mark's is one: sampling geometry
 * into a lattice in the browser cannot server-render, repeats on every
 * navigation, and is invisible to the theme. Baked, it is an inline SVG of
 * <circle>s that SSRs and takes `currentColor`.
 *
 * ── The geometry's ONE home ──────────────────────────────────────────────────
 * The icons are authored as React components in components/workshop-nav.jsx and
 * this script READS them, rather than keeping a second copy of the geometry
 * here. That is deliberate: two copies drift, and the drift would be silent.
 * The parser is strict for the same reason — anything it does not understand
 * throws instead of being skipped, so an icon that changes shape without a
 * re-bake fails loudly (the committed lattice is pinned by
 * lib/brand/icon-dots.test.js, exactly as the mark's is).
 *
 * No canvas: every icon is round-capped strokes and filled discs, so "is this
 * sample inside the ink" is a distance test against flattened polylines. The
 * bake is dependency-free and exactly reproducible on any host.
 *
 *   node scripts/build-brand-icons.mjs          # writes lib/brand/icon-dots.js
 *   node scripts/build-brand-icons.mjs --check  # verifies the committed file
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'components', 'workshop-nav.jsx');
const OUT = join(HERE, '..', 'lib', 'brand', 'icon-dots.js');

/* ── The lattice ──────────────────────────────────────────────────────────── */

/** 24 cells over the icons' 24-unit viewBox — one cell per unit, so a lattice
 *  cell and an icon coordinate are the same thing and the bake has no scale. */
export const CELLS = 24;
const SUB = 8;                  // supersamples per axis inside a dot's box
const BOX = 0.46;               // half-extent of the sample box, in cell units
const QUANT = SUB * SUB;        // coverage is hit/QUANT, so it stores as an int

/** Coverage above which a cell reads as ink. Lower than the mark's: an icon
 *  hairline grazes a cell where a letterform stem fills it. */
export const INK = 0.05;

/**
 * How much the authored stroke is fattened before sampling, and the gamma the
 * renderer applies to the coverage. Both are here so the bake and the component
 * cannot drift apart, and both exist for one reason: a 1.25-unit hairline
 * carries almost no AREA, and a lattice can only show what has mass.
 *
 * These are measured, not guessed. The first pass fattened 2.1x with no gamma,
 * which gave the dots body by eating the negative space — the Library and Games
 * icons came out as blobs. Moving the mass into the radius ramp instead (a
 * gentler fatten, a stronger gamma) keeps every form legible at tile scale.
 */
export const FATTEN = 1.3;
export const GAMMA = 0.45;

/* ── Reading the icons out of workshop-nav.jsx ────────────────────────────── */

const ICON_RE = /export function (\w+Icon)\(\{[^}]*\}\) \{([\s\S]*?)\n\}/g;
const EL_RE = /<(path|circle|rect)\b([^>]*?)\/>/g;

function attr(src, name) {
  const m = src.match(new RegExp(`\\b${name}=(?:"([^"]*)"|\\{([^}]*)\\})`));
  return m ? (m[1] ?? m[2]) : null;
}

function num(src, name, fallback = null) {
  const v = attr(src, name);
  if (v == null) return fallback;
  const n = parseFloat(v);
  if (!Number.isFinite(n)) throw new Error(`bad numeric attribute ${name}="${v}"`);
  return n;
}

/** Every `*Icon` in the nav module, with its root stroke width and elements. */
export function readIcons(source = readFileSync(SRC, 'utf8')) {
  const icons = [];
  for (const [, name, body] of source.matchAll(ICON_RE)) {
    const open = body.slice(body.indexOf('<svg'), body.indexOf('>', body.indexOf('<svg')));
    if (!open.startsWith('<svg')) throw new Error(`${name}: no <svg> found`);
    const rootWidth = num(open, 'strokeWidth');
    if (rootWidth == null) throw new Error(`${name}: <svg> has no strokeWidth`);
    const inner = body.slice(body.indexOf('>', body.indexOf('<svg')) + 1, body.lastIndexOf('</svg>'));

    const elements = [];
    for (const [full, tag, attrs] of inner.matchAll(EL_RE)) {
      elements.push({ tag, attrs, width: num(attrs, 'strokeWidth', rootWidth) });
      inner.replace(full, '');
    }
    // A stray element the element regex missed would silently vanish from the
    // relief, so count tags rather than trusting the match.
    const tags = (inner.match(/<(path|circle|rect)\b/g) || []).length;
    if (tags !== elements.length) throw new Error(`${name}: parsed ${elements.length} of ${tags} elements`);
    if (!elements.length) throw new Error(`${name}: no drawable elements`);
    icons.push({ name, elements });
  }
  if (!icons.length) throw new Error('no icons found — did workshop-nav.jsx change shape?');
  return icons;
}

/* ── Path geometry ────────────────────────────────────────────────────────── */

const TOKEN_RE = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;

function tokenize(d) {
  const out = [];
  for (const m of d.matchAll(TOKEN_RE)) out.push(m[1] ?? parseFloat(m[2]));
  return out;
}

/** Flatten a cubic to a polyline; round joins make this exact enough. */
function cubic(p0, p1, p2, p3, n = 24) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, m = 1 - t;
    out.push({
      x: m * m * m * p0.x + 3 * m * m * t * p1.x + 3 * m * t * t * p2.x + t * t * t * p3.x,
      y: m * m * m * p0.y + 3 * m * m * t * p1.y + 3 * m * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return out;
}

/**
 * SVG elliptical arc → polyline, via the spec's endpoint→centre parameterisation
 * (SVG 1.1 F.6.5). The icons only use circular arcs with no rotation, but the
 * general form is the same length to write and cannot be wrong later.
 */
function arc(x1, y1, rx, ry, phiDeg, large, sweep, x2, y2) {
  if (rx === 0 || ry === 0) return [{ x: x2, y: y2 }];
  const phi = (phiDeg * Math.PI) / 180;
  const cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  rx = Math.abs(rx); ry = Math.abs(ry);
  // Scale radii up if the endpoints are too far apart for the given ellipse.
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { const s = Math.sqrt(lambda); rx *= s; ry *= s; }
  const sq = Math.max(0, (rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p)
    / (rx * rx * y1p * y1p + ry * ry * x1p * x1p));
  const coef = (large !== sweep ? 1 : -1) * Math.sqrt(sq);
  const cxp = (coef * rx * y1p) / ry, cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const d = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
    const a = Math.acos(Math.min(1, Math.max(-1, d)));
    return ux * vy - uy * vx < 0 ? -a : a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const steps = Math.max(6, Math.ceil((Math.abs(dt) / Math.PI) * 24));
  const out = [];
  for (let i = 1; i <= steps; i++) {
    const t = t1 + (dt * i) / steps;
    out.push({
      x: cos * rx * Math.cos(t) - sin * ry * Math.sin(t) + cx,
      y: sin * rx * Math.cos(t) + cos * ry * Math.sin(t) + cy,
    });
  }
  return out;
}

/** A path's subpaths, as polylines in viewBox units. */
export function pathToPolys(d) {
  const t = tokenize(d);
  const polys = [];
  let cur = null, cmd = null, i = 0;
  let x = 0, y = 0, sx = 0, sy = 0;
  const close = () => { if (cur && cur.length > 1) polys.push(cur); cur = null; };
  const at = () => ({ x, y });
  const go = (nx, ny) => { x = nx; y = ny; cur.push(at()); };

  while (i < t.length) {
    if (typeof t[i] === 'string') cmd = t[i++];
    else if (cmd == null) throw new Error(`path starts with a number: ${d}`);
    const rel = cmd === cmd.toLowerCase();
    const n = () => t[i++];
    switch (cmd.toUpperCase()) {
      case 'M': {
        close();
        cur = [];
        x = rel ? x + n() : n(); y = rel ? y + n() : n();
        sx = x; sy = y; cur.push(at());
        cmd = rel ? 'l' : 'L';      // further pairs after a moveto are linetos
        break;
      }
      case 'L': go(rel ? x + n() : n(), rel ? y + n() : n()); break;
      case 'H': go(rel ? x + n() : n(), y); break;
      case 'V': go(x, rel ? y + n() : n()); break;
      case 'C': {
        const p0 = at();
        const p1 = { x: rel ? x + n() : n(), y: rel ? y + n() : n() };
        const p2 = { x: rel ? x + n() : n(), y: rel ? y + n() : n() };
        const p3 = { x: rel ? x + n() : n(), y: rel ? y + n() : n() };
        cur.push(...cubic(p0, p1, p2, p3));
        x = p3.x; y = p3.y;
        break;
      }
      case 'A': {
        const rx = n(), ry = n(), rot = n(), large = n(), sweep = n();
        const ex = rel ? x + n() : n(), ey = rel ? y + n() : n();
        cur.push(...arc(x, y, rx, ry, rot, large, sweep, ex, ey));
        x = ex; y = ey;
        break;
      }
      case 'Z': {
        if (cur) { cur.push({ x: sx, y: sy }); x = sx; y = sy; }
        close();
        break;
      }
      default: throw new Error(`unsupported path command "${cmd}" in: ${d}`);
    }
  }
  close();
  return polys;
}

function circlePoly(cx, cy, r, steps = 48) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return out;
}

/** A rect, rounded corners included, as one closed polyline. */
function rectPoly(x, y, w, h, rx) {
  const r = Math.min(rx || 0, w / 2, h / 2);
  if (!r) return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }];
  const corner = (cx, cy, from) => {
    const out = [];
    for (let i = 0; i <= 8; i++) {
      const a = from + (i / 8) * (Math.PI / 2);
      out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    return out;
  };
  return [
    { x: x + r, y },
    { x: x + w - r, y },
    ...corner(x + w - r, y + r, -Math.PI / 2),
    { x: x + w, y: y + h - r },
    ...corner(x + w - r, y + h - r, 0),
    { x: x + r, y: y + h },
    ...corner(x + r, y + h - r, Math.PI / 2),
    { x, y: y + r },
    ...corner(x + r, y + r, Math.PI),
  ];
}

/* ── Ink primitives ───────────────────────────────────────────────────────── */

/**
 * One icon's elements as ink: stroked polylines (round caps and joins, so the
 * stroke IS the halfwidth neighbourhood of the path) and filled discs. A filled
 * shape that is not a circle throws rather than being approximated — the icon
 * set has none today, and a silent approximation is how a relief goes subtly
 * wrong.
 */
export function inkPrimitives(icon) {
  const out = [];
  for (const el of icon.elements) {
    const filled = attr(el.attrs, 'fill') === 'currentColor';
    const half = (el.width * FATTEN) / 2;
    if (filled) {
      if (el.tag !== 'circle') throw new Error(`${icon.name}: filled <${el.tag}> is not supported`);
      out.push({ kind: 'disc', cx: num(el.attrs, 'cx'), cy: num(el.attrs, 'cy'), r: num(el.attrs, 'r') });
      continue;
    }
    if (el.tag === 'path') {
      for (const poly of pathToPolys(attr(el.attrs, 'd'))) out.push({ kind: 'stroke', poly, half });
    } else if (el.tag === 'circle') {
      out.push({ kind: 'stroke', poly: circlePoly(num(el.attrs, 'cx'), num(el.attrs, 'cy'), num(el.attrs, 'r')), half });
    } else {
      out.push({
        kind: 'stroke',
        half,
        poly: rectPoly(num(el.attrs, 'x'), num(el.attrs, 'y'), num(el.attrs, 'width'), num(el.attrs, 'height'), num(el.attrs, 'rx', 0)),
      });
    }
  }
  // A bounding box per primitive turns the sample loop from "test every segment"
  // into "test the few that could possibly be near", which is what keeps the
  // whole bake instant.
  for (const p of out) {
    if (p.kind === 'disc') {
      p.box = [p.cx - p.r, p.cy - p.r, p.cx + p.r, p.cy + p.r];
    } else {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const q of p.poly) {
        x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y);
        x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y);
      }
      p.box = [x0 - p.half, y0 - p.half, x1 + p.half, y1 + p.half];
    }
  }
  return out;
}

function distToSeg(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

function insideTest(prims) {
  return (px, py) => {
    for (const p of prims) {
      const [x0, y0, x1, y1] = p.box;
      if (px < x0 || px > x1 || py < y0 || py > y1) continue;
      if (p.kind === 'disc') {
        if (Math.hypot(px - p.cx, py - p.cy) <= p.r) return true;
        continue;
      }
      for (let i = 0; i < p.poly.length - 1; i++) {
        if (distToSeg(px, py, p.poly[i], p.poly[i + 1]) <= p.half) return true;
      }
    }
    return false;
  };
}

/* ── The bake ─────────────────────────────────────────────────────────────── */

/** One icon's lattice: [col, row, hits] where hits is out of SUB². */
export function bakeIcon(icon) {
  const inside = insideTest(inkPrimitives(icon));
  const dots = [];
  for (let r = 0; r < CELLS; r++) {
    for (let c = 0; c < CELLS; c++) {
      const cx = c + 0.5, cy = r + 0.5;
      let hit = 0;
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const px = cx - BOX + ((sx + 0.5) / SUB) * BOX * 2;
          const py = cy - BOX + ((sy + 0.5) / SUB) * BOX * 2;
          if (inside(px, py)) hit++;
        }
      }
      // Sub-threshold cells are dropped at bake time rather than at render:
      // they would draw nothing, and they are most of the lattice.
      if (hit / QUANT > INK) dots.push([c, r, hit]);
    }
  }
  return dots;
}

export function bakeAll(source) {
  const out = {};
  for (const icon of readIcons(source)) out[icon.name] = bakeIcon(icon);
  return out;
}

/* ── Emit ─────────────────────────────────────────────────────────────────── */

function emit(baked) {
  const rows = Object.entries(baked)
    .map(([name, dots]) => `  ${name}: ${JSON.stringify(dots)},`)
    .join('\n');
  return `// GENERATED by scripts/build-brand-icons.mjs — do not edit by hand.
//
// The door icons as dot-relief lattices — the mark's own construction applied to
// workshop-nav.jsx's icons, so a door and the \`m\` are samples of one system.
// Each entry is [col, row, hits] on a ${CELLS}x${CELLS} lattice; coverage is
// hits / ${QUANT}. Cells at or below the ink threshold are omitted.
//
// Re-bake with \`node scripts/build-brand-icons.mjs\`; verify with \`--check\`.

export const ICON_CELLS = ${CELLS};

/** Coverage is stored as supersample hits; divide by this for 0..1. */
export const ICON_QUANT = ${QUANT};

/** Coverage above which a cell reads as ink. */
export const ICON_INK = ${INK};

/**
 * The gamma the renderer applies to coverage before the radius ramp. Lives with
 * the bake because it is half of one measured decision: the stroke is fattened
 * ${FATTEN}x here so a hairline has mass, and the rest of the mass comes from this
 * curve rather than from more fattening, which is what preserved the negative
 * space inside forms like the gamepad and the clipboard.
 */
export const ICON_GAMMA = ${GAMMA};

export const ICON_DOTS = {
${rows}
};
`;
}

/** The module text this bake would emit — pure, so tests can pin it. */
export function renderModule(source) {
  return emit(bakeAll(source));
}

/* Importing this file must not write anything: the test suite imports the bake
   to prove the committed lattices re-bake identically, and a top-level write
   would make that test rewrite the very file it is checking. */
function main() {
  const body = renderModule();
  const baked = bakeAll();
  const names = Object.keys(baked);
  const cells = names.reduce((n, k) => n + baked[k].length, 0);
  if (process.argv.includes('--check')) {
    if (readFileSync(OUT, 'utf8') !== body) {
      console.error('icon-dots.js is stale — re-run: node scripts/build-brand-icons.mjs');
      process.exit(1);
    }
    console.log(`icon-dots.js up to date (${names.length} icons, ${cells} ink cells)`);
    return;
  }
  writeFileSync(OUT, body);
  console.log(`wrote ${OUT} — ${names.length} icons, ${cells} ink cells`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
