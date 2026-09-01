#!/usr/bin/env node
/**
 * Bake the 2.0 mark — the dot-relief `m` — into a static dot lattice.
 *
 * The mark is the lowercase `m` rendered as a halftone relief: a fixed 18x15
 * lattice where ink dots swell toward the letterform and latent dots hold the
 * field. Design: components/3d-factory-ui.plan.md §7c.
 *
 * Why this is a build step and not a runtime one. The design spike derived the
 * lattice in the browser by drawing the glyph to a canvas and running ~270
 * `getImageData` reads per mount. That cannot server-render, repeats on every
 * navigation, and is invisible to the theme. Baking it once gives an inline SVG
 * of <circle>s that SSRs, takes `currentColor` (so the §13 light flip is free),
 * and costs nothing per navigation.
 *
 * No canvas here either: the glyph is five stroked skeletons with round caps, so
 * "is this sample inside the ink" is a distance test against three segments and
 * two cubic beziers. That makes the bake dependency-free and exactly
 * reproducible — re-running this script on any host emits a byte-identical
 * module, which is the same promise every other kernel in the tree makes.
 *
 *   node scripts/build-brand-mark.mjs          # writes lib/brand/mark-dots.js
 *   node scripts/build-brand-mark.mjs --check  # verifies the committed file
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'lib', 'brand', 'mark-dots.js');

/* ── The lattice ──────────────────────────────────────────────────────────── */

export const COLS = 18;
export const ROWS = 15;
const RES = 18;                 // sampling resolution per cell
const W = COLS * RES;
const H = ROWS * RES;
const SUB = 12;                 // supersamples per axis inside a cell's box
const BOX = 0.46;               // half-extent of the sample box, in cell units
const INK = 0.08;               // coverage above which a dot is ink, not field

/* ── The glyph, as stroked skeletons ──────────────────────────────────────── */

/** The `m`: three stems under two arches, weights descending left to right. */
function markSkeleton() {
  const u = H / 1.45;
  const base = H - 0.22 * u;
  const xTop = base - u;
  const w1 = 0.27 * u, w2 = 0.215 * u, w3 = 0.165 * u;
  const span = 0.98 * u + (w1 + w3) / 2;
  const x1 = (W - span) / 2 + w1 / 2;
  const x2 = x1 + 0.54 * u;
  const x3 = x2 + 0.44 * u;

  /** An arch from xa to xb: a cubic whose control points share one height. */
  const arch = (xa, xb, w) => {
    const peak = xTop + w / 2 - 0.02 * u;
    const yE = xTop + w / 2 + 0.34 * u;
    // The cubic's extreme sits at 0.25*end + 0.75*ctrl, so solve for the ctrl
    // height that puts the crown exactly on `peak`.
    const c = (peak - 0.25 * yE) / 0.75;
    return { w, yE, curve: [{ x: xa, y: yE }, { x: xa, y: c }, { x: xb, y: c }, { x: xb, y: yE }] };
  };

  const a1 = arch(x1, x2, (w1 + w2) / 2);
  const a2 = arch(x2, x3, (w2 + w3) / 2);

  return [
    { kind: 'curve', pts: a1.curve, w: a1.w },
    { kind: 'curve', pts: a2.curve, w: a2.w },
    { kind: 'seg', a: { x: x1, y: base }, b: { x: x1, y: a1.yE }, w: w1 },
    { kind: 'seg', a: { x: x2, y: base }, b: { x: x2, y: a1.yE - 0.05 * u }, w: w2 },
    { kind: 'seg', a: { x: x3, y: base }, b: { x: x3, y: a2.yE }, w: w3 },
  ];
}

/** Flatten a cubic to a polyline — round joins make this exact enough. */
function flatten(pts, n = 160) {
  const [p0, p1, p2, p3] = pts;
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, m = 1 - t;
    out.push({
      x: m * m * m * p0.x + 3 * m * m * t * p1.x + 3 * m * t * t * p2.x + t * t * t * p3.x,
      y: m * m * m * p0.y + 3 * m * m * t * p1.y + 3 * m * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return out;
}

function distToSeg(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
  const cx = a.x + t * dx, cy = a.y + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Round caps and joins mean the stroke IS the halfwidth neighbourhood. */
function buildInkTest() {
  const strokes = markSkeleton().map((s) =>
    s.kind === 'curve'
      ? { poly: flatten(s.pts), half: s.w / 2 }
      : { poly: [s.a, s.b], half: s.w / 2 },
  );
  return (px, py) => {
    for (const { poly, half } of strokes) {
      for (let i = 0; i < poly.length - 1; i++) {
        if (distToSeg(px, py, poly[i], poly[i + 1]) <= half) return true;
      }
    }
    return false;
  };
}

/* ── The bake ─────────────────────────────────────────────────────────────── */

export function bakeDots() {
  const inside = buildInkTest();
  const half = RES * BOX;
  const dots = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = (c + 0.5) * RES, cy = (r + 0.5) * RES;
      let hit = 0;
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const px = cx - half + ((sx + 0.5) / SUB) * half * 2;
          const py = cy - half + ((sy + 0.5) / SUB) * half * 2;
          if (inside(px, py)) hit++;
        }
      }
      const v = hit / (SUB * SUB);
      if (v > 0) dots.push([c, r, Math.round(v * 1000) / 1000]);
    }
  }
  return dots;
}

/* ── The solid reading ────────────────────────────────────────────────────────

   A halftone cannot resolve below ~28px: at 16px the lattice is ~1px per cell
   and the `m` turns to mush (verified on a size contact sheet before wiring it
   anywhere). So the SAME skeleton is also emitted as plain strokes, normalized
   into the same 18x15 viewBox the dots use. That is not a second mark — it is
   this mark at a size where its own screen cannot resolve, which is what a
   favicon has always been. One geometry, two readings, no drift. */

function bakeStrokes() {
  const sx = COLS / W, sy = ROWS / H;   // sample space → viewBox units
  const n = (v) => Math.round(v * 1000) / 1000;
  return markSkeleton().map((s) =>
    s.kind === 'curve'
      ? { d: `M${n(s.pts[0].x * sx)},${n(s.pts[0].y * sy)}C${s.pts.slice(1).map((p) => `${n(p.x * sx)},${n(p.y * sy)}`).join(' ')}`, w: n(s.w * sx) }
      : { d: `M${n(s.a.x * sx)},${n(s.a.y * sy)}L${n(s.b.x * sx)},${n(s.b.y * sy)}`, w: n(s.w * sx) },
  );
}

/* ── Emit ─────────────────────────────────────────────────────────────────── */

function emit(dots, strokes) {
  return `// GENERATED by scripts/build-brand-mark.mjs — do not edit by hand.
//
// The 2.0 mark's dot lattice: the lowercase \`m\` as a ${COLS}x${ROWS} halftone
// relief. Each entry is [col, row, coverage]; cells with zero coverage are
// omitted and render as latent field dots. Design: 3d-factory-ui.plan.md §7c.
//
// Re-bake with \`node scripts/build-brand-mark.mjs\`; verify with \`--check\`.

export const MARK_COLS = ${COLS};
export const MARK_ROWS = ${ROWS};

/** Dot radius in cell units, lerped left→right so the relief has a light side. */
export const MARK_GRADIENT = { maxL: 0.46, maxR: 0.34, bgL: 0.15, bgR: 0.11 };

/** Coverage above which a cell reads as ink rather than field. */
export const MARK_INK = ${INK};

export const MARK_DOTS = ${JSON.stringify(dots)};

/**
 * The same \`m\`, as plain round-capped strokes in the same viewBox — the
 * reading for sizes where the lattice cannot resolve (favicon, dense chrome).
 */
export const MARK_STROKES = ${JSON.stringify(strokes)};
`;
}

/** The module text this bake would emit — pure, so tests can pin it. */
export function renderModule() {
  return emit(bakeDots(), bakeStrokes());
}

/* Importing this file must not write anything: the test suite imports `bakeDots`
   to prove the committed lattice re-bakes identically, and a top-level write
   would make that test rewrite the very file it is checking. */
function main() {
  const body = renderModule();
  const cells = bakeDots().length;
  if (process.argv.includes('--check')) {
    if (readFileSync(OUT, 'utf8') !== body) {
      console.error('mark-dots.js is stale — re-run: node scripts/build-brand-mark.mjs');
      process.exit(1);
    }
    console.log(`mark-dots.js up to date (${cells} ink cells of ${COLS * ROWS})`);
    return;
  }
  writeFileSync(OUT, body);
  console.log(`wrote ${OUT} — ${cells} ink cells of ${COLS * ROWS}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
