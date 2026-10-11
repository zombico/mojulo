/**
 * structure/sheets/section — A-301, the building section: the house cut by a vertical plane and seen past the cut.
 *
 *   cut       the walls the plane crosses, each floor slab (broken at a stair void), the roof where the plane
 *             meets its planes — poched or drawn heavy; a stair flight the plane passes through, as its riser and
 *             tread profile over its soffit, and its landing
 *   beyond    each cut room's far wall and the doors and windows in it, projected
 *   labels    the room names in their spaces, a level head at each floor, the storey heights dimensioned
 *
 * The cut is `cut: { axis, at }` on the sheet spec: axis 'x' (a plane of constant plan y, looking north) or 'y' (a
 * plane of constant plan x, looking west), at a fraction of the footprint (default the middle). The plan sheets mark
 * the same cut with a section line and its markers (sectionCut).
 */

import { n2, esc, dimension, titleBlock, drawingTitle, sheetSvg, SCALES } from './kit.js';
import { levelsOf, levelHead } from './elevations.js';

/** The cut in plan feet: { axis, at (plan y for 'x', plan x for 'y'), lo, hi (the run across) }. */
export function sectionCut(read, cut = {}) {
  const fp = read.footprint;
  const axis = cut.axis === 'y' ? 'y' : 'x';
  const f = Number.isFinite(cut.at) ? Math.min(0.95, Math.max(0.05, cut.at)) : 0.5;
  return axis === 'x'
    ? { axis, at: fp.y0 + f * (fp.y1 - fp.y0), lo: fp.x0, hi: fp.x1 }
    : { axis, at: fp.x0 + f * (fp.x1 - fp.x0), lo: fp.y0, hi: fp.y1 };
}

/**
 * The section drawing, its ground line's left end at sheet `at`, at `scale`. Looking north (axis x: u = plan x, east
 * on the right) or west (axis y: facing west, north is on the right, so u = −y).
 */
export function sectionDrawing(read, at, scale, { cut = {}, units = 'imperial' } = {}) {
  const C = sectionCut(read, cut);
  const k = 304.8 / SCALES[scale].ratio;
  const t = Math.max(0, ...read.elements.walls.filter((w) => !w.interior).map((w) => w.thickness));
  const U = C.axis === 'x' ? (x) => x : (y) => -y;            // across the cut as seen
  const uLo = Math.min(U(C.lo - t / 2), U(C.hi + t / 2)), uHi = Math.max(U(C.lo - t / 2), U(C.hi + t / 2));
  const zLo = Math.min(...read.storeys.map((s) => s.baseZ)) - read.floorDrop;
  const X = (u) => at[0] + (u - uLo) * k;
  const Y = (z) => at[1] - (z - zLo) * k;
  const rect = (u0, u1, z0, z1, cls) => `<rect class="${cls}" x="${n2(X(Math.min(u0, u1)))}" y="${n2(Y(Math.max(z0, z1)))}" width="${n2(Math.abs(u1 - u0) * k)}" height="${n2(Math.abs(z1 - z0) * k)}"/>`;
  const out = { beyond: [], cut: [], labels: [] };
  const storeyOf = new Map(read.storeys.map((s) => [s.index, s]));
  // a wall crosses the plane when it runs across it; one that runs along the cut is beyond or behind
  const across = C.axis === 'x' ? 'v' : 'h';
  const crosses = (w) => w.orientation === across && w.along[0] - 1e-6 <= C.at && C.at <= w.along[1] + 1e-6;

  // ── beyond: each cut room's far wall, and its openings ──
  for (const r of read.rooms) {
    const lo = C.axis === 'x' ? r.rect.y : r.rect.x, hi = lo + (C.axis === 'x' ? r.rect.h : r.rect.w);
    if (!(lo < C.at && C.at < hi)) continue;
    const s = storeyOf.get(r.storey);
    const farAt = lo;      // looking north (−y) or west (−x): the far wall is on the room's low side
    const [a, b] = C.axis === 'x' ? [r.rect.x, r.rect.x + r.rect.w] : [r.rect.y, r.rect.y + r.rect.h];
    const far = read.elements.walls.filter((w) => w.storey === r.storey && w.orientation === (C.axis === 'x' ? 'h' : 'v') && Math.abs(w.at - farAt) < 0.5);
    for (const o of [...read.elements.windows, ...read.elements.doors]) {
      if (!far.some((w) => w.tag === o.host)) continue;
      const c = C.axis === 'x' ? o.at.x : o.at.y;
      if (c < a || c > b) continue;
      const z0 = s.baseZ + (o.sill || 0);
      out.beyond.push(`<g class="${o.mark ? 's-window' : 's-door'}" data-${o.mark ? 'mark' : 'tag'}="${esc(o.mark || o.tag)}">${rect(U(c - o.width / 2), U(c + o.width / 2), z0, z0 + o.height, 's-proj')}</g>`);
    }
    // the room's name at mid-height of its storey
    const mid = U((a + b) / 2);
    out.labels.push(`<text class="s-tb" text-anchor="middle" x="${n2(X(mid))}" y="${n2(Y(s.baseZ + s.height * 0.2))}">${esc(String(r.name).toUpperCase())}</text>`
      + `<text class="s-ts" text-anchor="middle" x="${n2(X(mid))}" y="${n2(Y(s.baseZ + s.height * 0.2) + 3)}">${esc(r.tag)}</text>`);
  }

  // ── cut: the walls the plane crosses, storey by storey ──
  for (const w of read.elements.walls.filter(crosses)) {
    const s = storeyOf.get(w.storey);
    out.cut.push(`<g class="s-wall" data-tag="${esc(w.tag)}">${rect(U(w.at - w.thickness / 2), U(w.at + w.thickness / 2), s.baseZ, s.baseZ + s.height, 's-poche')}</g>`);
  }
  // ── cut: each storey's floor slab, broken where a stair void crosses the plane; the top storey's ceiling ──
  const sorted = [...read.storeys].sort((a, b) => a.index - b.index);
  for (const s of sorted) {
    const slab = read.elements.slabs.find((x) => x.storey === s.index);
    const gaps = (slab ? slab.holes : []).filter((h) => (C.axis === 'x' ? h.y <= C.at && C.at <= h.y + h.h : h.x <= C.at && C.at <= h.x + h.w))
      .map((h) => (C.axis === 'x' ? [h.x, h.x + h.w] : [h.y, h.y + h.h])).sort((p, q) => p[0] - q[0]);
    let cur = C.lo - t / 2;
    const pieces = [];
    for (const [g0, g1] of gaps) { if (g0 > cur) pieces.push([cur, g0]); cur = Math.max(cur, g1); }
    pieces.push([cur, C.hi + t / 2]);
    for (const [p0, p1] of pieces) out.cut.push(`<g class="s-slab" data-tag="${esc(slab ? slab.tag : '')}">${rect(U(p0), U(p1), s.baseZ - read.floorDrop, s.baseZ, 's-poche')}</g>`);
  }
  const top = sorted[sorted.length - 1];
  const zTop = top.baseZ + top.height;
  const roof = read.elements.roof;
  if (roof) {
    // where the plane meets each roof plane: the segment between its two crossings, drawn heavy (the cut roof)
    const coord = C.axis === 'x' ? 1 : 0, other = C.axis === 'x' ? 0 : 1;
    for (const p of roof.planes) {
      const pts = [];
      const cs = p.corners;
      for (let i = 0; i < cs.length; i++) {
        const A = cs[i], B = cs[(i + 1) % cs.length];
        const da = A[coord] - C.at, db = B[coord] - C.at;
        if ((da <= 0 && db >= 0) || (da >= 0 && db <= 0)) {
          if (da === db) continue;
          const f = da / (da - db);
          pts.push([A[other] + f * (B[other] - A[other]), A[2] + f * (B[2] - A[2])]);
        }
      }
      if (pts.length >= 2) {
        pts.sort((m, q) => m[0] - q[0]);
        const [P, Q] = [pts[0], pts[pts.length - 1]];
        out.cut.push(`<line class="s-cut" style="stroke-width:0.7" x1="${n2(X(U(P[0])))}" y1="${n2(Y(P[1]))}" x2="${n2(X(U(Q[0])))}" y2="${n2(Y(Q[1]))}"/>`);
      }
    }
  }
  // the ceiling of the top storey (a flat roof when there is no roof)
  out.cut.push(rect(U(C.lo - t / 2), U(C.hi + t / 2), zTop, zTop + (roof ? 0.6 : read.floorDrop), 's-poche'));
  // the ground line
  out.cut.push(`<line class="s-cut" style="stroke-width:0.7" x1="${n2(X(uLo) - 8)}" y1="${n2(Y(zLo))}" x2="${n2(X(uHi) + 8)}" y2="${n2(Y(zLo))}"/>`);

  // ── stairs: a flight the plane passes through is cut (heavy), one past the cut is seen (projected) ──
  // looking north (−y) or west (−x), what lies past the cut is on the low side of it; what is behind is not drawn
  const PC = (pu, z) => `${n2(X(U(pu)))} ${n2(Y(z))}`;
  const bandOf = (r) => (C.axis === 'x' ? [r.y, r.y + r.h] : [r.x, r.x + r.w]);
  const runOf = (r) => (C.axis === 'x' ? [r.x, r.x + r.w] : [r.y, r.y + r.h]);
  const seen = (r) => { const [lo, hi] = bandOf(r); return lo < C.at && C.at < hi ? 'cut' : hi <= C.at + 1e-6 ? 'beyond' : null; };
  for (const st of read.elements.stairs) {
    const parts = [];
    for (const f of st.flights || []) {
      const how = seen(f.rect);
      if (!how) continue;
      const cls = how === 'cut' ? 's-cut' : 's-proj';
      const [a0, a1] = runOf(f.rect);
      const climb = C.axis === 'x' ? f.climb[0] : f.climb[1];
      const rise = (f.z1 - f.z0) / f.steps;
      if (climb !== 0) {
        // the profile a section shows: riser, tread, riser … from the foot of the flight, and its soffit beneath
        const start = climb > 0 ? a0 : a1, go = ((a1 - a0) / f.steps) * climb;
        let d = `M${PC(start, f.z0)}`;
        for (let i = 0; i < f.steps; i++) d += `L${PC(start + i * go, f.z0 + (i + 1) * rise)}L${PC(start + (i + 1) * go, f.z0 + (i + 1) * rise)}`;
        const waist = 0.6;
        d += `L${PC(start + f.steps * go, f.z1 - waist)}L${PC(start + go, f.z0 - waist + rise)}L${PC(start, f.z0 - waist + rise)}Z`;
        parts.push(`<path class="${cls}" d="${d}"/>`);
      } else {
        // seen along its run: the flight's width, a riser line at each step
        parts.push(rect(U(a0), U(a1), f.z0, f.z1, cls));
        for (let i = 1; i < f.steps; i++) parts.push(`<line class="s-dim" x1="${n2(X(U(a0)))}" y1="${n2(Y(f.z0 + i * rise))}" x2="${n2(X(U(a1)))}" y2="${n2(Y(f.z0 + i * rise))}"/>`);
      }
    }
    if (st.landing) {
      const how = seen(st.landing.rect);
      if (how) { const [a0, a1] = runOf(st.landing.rect); parts.push(rect(U(a0), U(a1), st.landing.z - 0.6, st.landing.z, how === 'cut' ? 's-poche' : 's-proj')); }
    }
    if (parts.length) out.cut.push(`<g class="s-stair" data-tag="${esc(st.tag)}">${parts.join('')}</g>`);
  }

  // ── level heads and storey heights ──
  const heads = levelsOf(read).map((L) => levelHead(X(uLo) - 4, X(uHi) + 10, Y(L.z), L, units));
  const dims = sorted.map((s) => dimension([X(uLo), Y(s.baseZ)], [X(uLo), Y(s.baseZ + s.height)], s.height, { offset: 10, units }));
  return `<g class="s-section" data-axis="${C.axis}" data-at="${n2(C.at)}">${out.beyond.join('')}${out.cut.join('')}${out.labels.join('')}${heads.join('')}${dims.join('')}</g>`;
}

/** The sheet room a section takes at a scale (mm). */
export function sectionSize(read, scale, cut = {}) {
  const C = sectionCut(read, cut);
  const k = 304.8 / SCALES[scale].ratio;
  const zLo = Math.min(...read.storeys.map((s) => s.baseZ)) - read.floorDrop;
  let zHi = levelsOf(read).slice(-1)[0].z + 1;
  if (read.elements.roof) for (const p of read.elements.roof.planes) for (const c of p.corners) zHi = Math.max(zHi, c[2]);
  return [(C.hi - C.lo + 1) * k + 48, (zHi - zLo) * k + 6];
}

/** A-301: the longitudinal section (axis x) above the cross section (axis y). → { id, title, scale, cuts, svg } */
export function sectionSheet(read, { units = 'imperial', project, size = 'ANSI B', revision = null } = {}) {
  if (!read.footprint) return null;
  const id = 'A-301', title = 'Building sections';
  const [dx, dy, dw, dh] = titleBlock({ size }).drawing;
  const cellH = dh / 2;
  const cuts = [{ axis: 'x', at: 0.5 }, { axis: 'y', at: 0.5 }];
  const keys = units === 'metric' ? ['1:50', '1:100', '1:200'] : ['1/4', '3/16', '1/8', '3/32', '1/16'];
  const scale = keys.find((s) => cuts.every((c) => { const [w, h] = sectionSize(read, s, c); return w + 24 <= dw && h + 22 <= cellH; })) || keys[keys.length - 1];
  const body = [];
  cuts.forEach((c, i) => {
    const cy = dy + i * cellH;
    const [w, h] = sectionSize(read, scale, c);
    body.push(sectionDrawing(read, [dx + 18 + Math.max(0, (dw - 24 - w) / 2), cy + 6 + h + Math.max(0, (cellH - 22 - h) / 2)], scale, { cut: c, units }));
    body.push(drawingTitle([dx + 6, cy + cellH - 9], { detail: String(i + 1), title: c.axis === 'x' ? 'Longitudinal section' : 'Cross section', scale, sheet: id }));
  });
  const block = titleBlock({ size, project: project || read.title || 'mojulo house', title, id, scale, revision });
  return { id, title, scale, cuts, svg: sheetSvg({ size, body: body.join(''), block }) };
}
