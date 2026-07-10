/**
 * arabesque spike-lib — SPIKE-ONLY SVG helpers layered over the engine geometry.
 *
 * The geometry (tilings, PIC, rosette, circles, strapwork strands) now lives in
 * the promoted engine module ./arabesque.js and is re-exported below so the
 * existing *.spike.gen.test.js files keep working unchanged. This file adds only
 * the standalone SVG emitters used by the spikes (the engine renders via base
 * marks through expandArabesque, not these).
 *
 * See control/lib/graph/arabesque-renderer.plan.md.
 */

export * from './arabesque.js';
import { regularPolygon, tileMotif, strapworkPieces } from './arabesque.js';

// --- local vector helpers (spike SVG only) ---------------------------------
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a, s) => ({ x: a.x * s, y: a.y * s });
const norm = (a) => {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
};

function bounds(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** Spike SVG emitter for segments / tiles / circles / filled polys. */
export function segmentsToSvg({ segments = [], tiles = [], circles = [], polys = [], pad = 0.6, style = {} }) {
  const s = {
    bg: '#0f1020',
    stroke: '#e9d8a6',
    strokeWidth: 0.05,
    tileStroke: '#3a3a5a',
    tileWidth: 0.02,
    guideStroke: '#37507a',
    guideWidth: 0.018,
    showTiles: false,
    ...style,
  };
  const allPts = [];
  for (const [a, b] of segments) allPts.push(a, b);
  for (const t of tiles) allPts.push(...t);
  for (const p of polys) allPts.push(...p.points);
  for (const c of circles) {
    allPts.push({ x: c.cx - c.r, y: c.cy - c.r }, { x: c.cx + c.r, y: c.cy + c.r });
  }
  const bb = bounds(allPts);
  const w = bb.maxX - bb.minX + 2 * pad;
  const h = bb.maxY - bb.minY + 2 * pad;
  const ox = bb.minX - pad;
  const oy = bb.minY - pad;
  const f = (n) => Number(n.toFixed(4));

  let body = '';
  for (const p of polys) {
    const d = p.points.map((pt, k) => `${k ? 'L' : 'M'}${f(pt.x)} ${f(pt.y)}`).join(' ') + ' Z';
    body += `<path d="${d}" fill="${p.fill || 'none'}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.strokeWidth || s.strokeWidth}"` : ''}/>`;
  }
  if (s.showTiles) {
    for (const t of tiles) {
      const d = t.map((p, k) => `${k ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join(' ') + ' Z';
      body += `<path d="${d}" fill="none" stroke="${s.tileStroke}" stroke-width="${s.tileWidth}"/>`;
    }
  }
  for (const c of circles.filter((c) => c.role !== 'ink')) {
    body += `<circle cx="${f(c.cx)}" cy="${f(c.cy)}" r="${f(c.r)}" fill="none" stroke="${s.guideStroke}" stroke-width="${s.guideWidth}"/>`;
  }
  let lines = '';
  for (const [a, b] of segments) {
    lines += `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}"/>`;
  }
  body += `<g stroke="${s.stroke}" stroke-width="${s.strokeWidth}" stroke-linecap="round">${lines}</g>`;
  for (const c of circles.filter((c) => c.role === 'ink')) {
    body += `<circle cx="${f(c.cx)}" cy="${f(c.cy)}" r="${f(c.r)}" fill="none" stroke="${s.stroke}" stroke-width="${s.strokeWidth}"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(ox)} ${f(oy)} ${f(w)} ${f(h)}" width="800" height="${Math.round((800 * h) / w)}">` +
    `<rect x="${f(ox)}" y="${f(oy)}" width="${f(w)}" height="${f(h)}" fill="${s.bg}"/>` +
    body +
    `</svg>`
  );
}

/** Spike strapwork SVG — renders woven bands from the strand pieces. */
export function strapworkSvg(segments, { bandW = 0.06, casing = 0.03, gap = 0.11, pad = 0.6, style = {} } = {}) {
  const s = { bg: '#0f1020', band: '#e9d8a6', casingColor: '#0f1020', ...style };
  const pieces = strapworkPieces(segments, { gap });

  const all = [];
  for (const p of pieces) all.push(...p);
  const bb = bounds(all);
  const w = bb.maxX - bb.minX + 2 * pad;
  const h = bb.maxY - bb.minY + 2 * pad;
  const ox = bb.minX - pad;
  const oy = bb.minY - pad;
  const f = (n) => Number(n.toFixed(4));
  const path = (p) => p.map((q, k) => `${k ? 'L' : 'M'}${f(q.x)} ${f(q.y)}`).join(' ');

  let casings = '';
  let cores = '';
  for (const p of pieces) {
    casings += `<path d="${path(p)}"/>`;
    cores += `<path d="${path(p)}"/>`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(ox)} ${f(oy)} ${f(w)} ${f(h)}" width="800" height="${Math.round((800 * h) / w)}">` +
    `<rect x="${f(ox)}" y="${f(oy)}" width="${f(w)}" height="${f(h)}" fill="${s.bg}"/>` +
    `<g fill="none" stroke="${s.casingColor}" stroke-width="${bandW + 2 * casing}" stroke-linecap="round" stroke-linejoin="round">${casings}</g>` +
    `<g fill="none" stroke="${s.band}" stroke-width="${bandW}" stroke-linecap="round" stroke-linejoin="round">${cores}</g>` +
    `</svg>`
  );
}

/** Translate a set of segments (for laying out a row of samples). */
export function shift(segments, dx, dy) {
  const d = { x: dx, y: dy };
  return segments.map(([a, b]) => [add(a, d), add(b, d)]);
}

/** Offset each line into two parallel rails (naive band skeleton, no weave). */
export function toBands(segments, w) {
  const rails = [];
  for (const [a, b] of segments) {
    const d = norm(sub(b, a));
    const nrm = { x: -d.y, y: d.x };
    const o = scale(nrm, w);
    rails.push([add(a, o), add(b, o)]);
    rails.push([sub(a, o), sub(b, o)]);
  }
  return rails;
}

/** First (rough) rosette approximation — kept for the research-spike comparison. */
export function rosette(n, { c = { x: 0, y: 0 }, outerR = 1, shoulderR = 0.6, baseR = 0.36, petalSpanDeg } = {}) {
  const span = ((petalSpanDeg ?? (0.92 * 180) / n) * Math.PI) / 180;
  const polar = (r, a) => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  const segments = [];
  const petals = [];
  for (let k = 0; k < n; k++) {
    const a = (2 * Math.PI * k) / n;
    const tip = polar(outerR, a);
    const left = polar(shoulderR, a - span);
    const right = polar(shoulderR, a + span);
    const base = polar(baseR, a);
    const petal = [base, right, tip, left];
    petals.push(petal);
    for (let i = 0; i < petal.length; i++) segments.push([petal[i], petal[(i + 1) % petal.length]]);
  }
  const core = regularPolygon(n, baseR * 1.15, c, 180 / n);
  segments.push(...tileMotif(core, 62));
  return { segments, corePoly: core, petals };
}
