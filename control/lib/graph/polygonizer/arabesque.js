/**
 * arabesque — geometric Islamic star-pattern construction (polygons-in-contact /
 * Hankin, formalized by Kaplan), promoted from the spike to a first-class engine
 * primitive. Pure geometry + a mint-time expander (`expandArabesque`) that lowers
 * a compact `arabesque` sketch mark into base polyline/polygon/circle marks.
 *
 * Vocabulary (see docs / arabesque-renderer.plan.md):
 *  - PIC star fields (hex / square / khatam) via contact-point pairing
 *  - rosettes (shams): points + petals + core, with the shoulder DOF
 *  - concentric-circle constructions (medallion / shamsa)
 *  - strapwork interlace (strand walk + over/under)
 *
 * This module is dependency-free and deterministic (no RNG, no Date) so it is
 * safe on the mint path. The spike-lib re-exports the geometry from here.
 */

const EPS = 1e-9;

// --- vector helpers ---------------------------------------------------------
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a, s) => ({ x: a.x * s, y: a.y * s });
const cross = (a, b) => a.x * b.y - a.y * b.x;
const dotv = (a, b) => a.x * b.x + a.y * b.y;
const len = (a) => Math.hypot(a.x, a.y);
const norm = (a) => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
const rot = (a, rad) => {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};

/** Ray/ray intersection. Returns { t, u, point } or null (parallel / behind). */
function rayHit(p, r, q, s) {
  const rxs = cross(r, s);
  if (Math.abs(rxs) < EPS) return null;
  const qp = sub(q, p);
  const t = cross(qp, s) / rxs;
  const u = cross(qp, r) / rxs;
  if (t <= EPS || u <= EPS) return null;
  return { t, u, point: add(p, scale(r, t)) };
}

/** Bounding box of a set of points ({x,y}). */
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

// --- PIC core ---------------------------------------------------------------

/**
 * Star vertices of a convex tile by deterministic contact-point pairing
 * (Hankin). Each edge midpoint emits two rays at `contactDeg` to the edge; the
 * ray aimed at a shared vertex meets the adjacent edge's ray there — a star tip.
 */
export function starVertices(poly, contactDeg) {
  const n = poly.length;
  const theta = (contactDeg * Math.PI) / 180;
  const off = Math.PI / 2 - theta; // ray offset from the inward normal

  const mids = [];
  const edges = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const mid = scale(add(a, b), 0.5);
    const dir = norm(sub(b, a));
    const inward = { x: -dir.y, y: dir.x }; // CCW: interior is left of edge dir
    mids.push(mid);
    edges.push({
      mid,
      toNext: norm(rot(inward, -off)),
      toPrev: norm(rot(inward, off)),
    });
  }

  const tips = [];
  for (let k = 0; k < n; k++) {
    const prev = edges[(k - 1 + n) % n];
    const cur = edges[k];
    const hit = rayHit(prev.mid, prev.toNext, cur.mid, cur.toPrev);
    tips.push(hit ? hit.point : cur.mid);
  }
  return { tips, mids, n };
}

/** Star motif of a tile as line segments. */
export function tileMotif(poly, contactDeg) {
  const { tips, mids, n } = starVertices(poly, contactDeg);
  const segs = [];
  for (let i = 0; i < n; i++) {
    segs.push([mids[i], tips[(i + 1) % n]]);
    segs.push([mids[i], tips[i]]);
  }
  return segs;
}

/** The star as a single closed 2n-gon (tip, notch, tip, notch, …) for filling. */
export function starPolygon(poly, contactDeg) {
  const { tips, mids, n } = starVertices(poly, contactDeg);
  const loop = [];
  for (let i = 0; i < n; i++) loop.push(tips[i], mids[i]);
  return loop;
}

/** Run PIC over a whole tiling → segments. */
export function patternFromTiling(tiles, contactDeg) {
  const segs = [];
  for (const t of tiles) segs.push(...tileMotif(t, contactDeg));
  return segs;
}

// --- tiling generators ------------------------------------------------------

/** A single regular n-gon centred at c, circumradius R, first vertex at phase. */
export function regularPolygon(n, R, c = { x: 0, y: 0 }, phaseDeg = 0) {
  const ph = (phaseDeg * Math.PI) / 180;
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = ph + (2 * Math.PI * k) / n;
    pts.push({ x: c.x + R * Math.cos(a), y: c.y + R * Math.sin(a) });
  }
  return pts;
}

/** Flat-top hexagon tiling. */
export function hexTiling(cols, rows, R) {
  const dx = 1.5 * R;
  const dy = Math.sqrt(3) * R;
  const tiles = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const cx = i * dx;
      const cy = j * dy + (i % 2 ? dy / 2 : 0);
      tiles.push(regularPolygon(6, R, { x: cx, y: cy }, 0));
    }
  }
  return tiles;
}

/** Square grid tiling. */
export function squareTiling(cols, rows, s) {
  const tiles = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = i * s;
      const y = j * s;
      tiles.push([
        { x, y },
        { x: x + s, y },
        { x: x + s, y: y + s },
        { x, y: y + s },
      ]);
    }
  }
  return tiles;
}

/** 4.8.8 truncated-square tiling: octagons + gap squares. */
export function octagonSquareTiling(cols, rows, R) {
  const pitch = 2 * R * Math.cos(Math.PI / 8);
  const octs = [];
  const centers = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const c = { x: i * pitch, y: j * pitch };
      centers.push(c);
      octs.push(regularPolygon(8, R, c, 22.5));
    }
  }
  const key = (p) => `${Math.round(p.x * 1000)}:${Math.round(p.y * 1000)}`;
  const vmap = new Map();
  for (const oct of octs) for (const v of oct) vmap.set(key(v), v);
  const verts = [...vmap.values()];

  const squares = [];
  for (let i = 0; i < cols - 1; i++) {
    for (let j = 0; j < rows - 1; j++) {
      const gap = { x: (i + 0.5) * pitch, y: (j + 0.5) * pitch };
      const near = verts
        .map((v) => ({ v, d: len(sub(v, gap)) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 4)
        .map((e) => e.v);
      near.sort(
        (a, b) =>
          Math.atan2(a.y - gap.y, a.x - gap.x) - Math.atan2(b.y - gap.y, b.x - gap.x),
      );
      squares.push(near);
    }
  }
  return { tiles: [...octs, ...squares], octs, squares, centers, pitch };
}

/** Centre of the bounding box of a set of tiles (or any point arrays). */
export function tilesCenter(tiles) {
  const bb = bounds(tiles.flat());
  return { x: (bb.minX + bb.maxX) / 2, y: (bb.minY + bb.maxY) / 2 };
}

/** Keep segments fully outside ('out') or inside ('in') a circle. */
export function clipByCircle(segments, c, r, side = 'out') {
  const outside = (p) => Math.hypot(p.x - c.x, p.y - c.y) > r;
  return segments.filter(([a, b]) =>
    side === 'out' ? outside(a) && outside(b) : !outside(a) && !outside(b),
  );
}

// --- rosette (shams) --------------------------------------------------------

/**
 * A rosette (shams), Kaplan/Lee construction, n-fold: a ring of `n` tall POINTS
 * alternating with `n` PETALS (hexagons) around a central STAR. `Rshoulder` +
 * `pointHalfFrac` are the shoulder/flank DOF. Returns linework + classified
 * faces {points, petals, core}.
 */
export function buildRosette(n, {
  c = { x: 0, y: 0 },
  Rtip = 1,
  Rpetal = 0.78,
  Rshoulder = 0.66,
  Rinner = 0.46,
  Rcore = 0.3,
  pointHalfFrac = 0.26,
  phaseDeg = 0,
} = {}) {
  const sector = (2 * Math.PI) / n;
  const ph = (phaseDeg * Math.PI) / 180;
  const half = pointHalfFrac * sector;
  const innerHalf = half * 0.62;
  const polar = (r, a) => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });

  const P = [];
  for (let k = 0; k < n; k++) {
    const t = ph + k * sector;
    const v = t + sector / 2;
    P.push({
      tip: polar(Rtip, t),
      shA: polar(Rshoulder, t + half),
      shB: polar(Rshoulder, t - half),
      inA: polar(Rinner, t + innerHalf),
      inB: polar(Rinner, t - innerHalf),
      petalTip: polar(Rpetal, v),
      coreNotch: polar(Rcore, v),
    });
  }

  const points = [];
  const petals = [];
  for (let k = 0; k < n; k++) {
    const a = P[k];
    const b = P[(k + 1) % n];
    points.push([a.tip, a.shA, a.inA, a.inB, a.shB]);
    petals.push([a.shA, a.petalTip, b.shB, b.inB, a.coreNotch, a.inA]);
  }
  const core = [];
  for (let k = 0; k < n; k++) core.push(P[k].inB, P[k].inA, P[k].coreNotch);

  const segments = [];
  const edge = (u, w) => segments.push([u, w]);
  for (const f of [...points, ...petals]) {
    for (let i = 0; i < f.length; i++) edge(f[i], f[(i + 1) % f.length]);
  }
  for (let i = 0; i < core.length; i++) edge(core[i], core[(i + 1) % core.length]);

  return { segments, faces: { points, petals, core } };
}

// --- concentric-circle constructions ---------------------------------------

/** N radial spokes from centre c out to radius R, as segments. */
export function radialSpokes(n, R, c = { x: 0, y: 0 }, phaseDeg = 0) {
  const ph = (phaseDeg * Math.PI) / 180;
  const segs = [];
  for (let k = 0; k < n; k++) {
    const a = ph + (2 * Math.PI * k) / n;
    segs.push([c, { x: c.x + R * Math.cos(a), y: c.y + R * Math.sin(a) }]);
  }
  return segs;
}

/** Place `count` regular polygons evenly on a circle of radius `ringR` about c. */
export function ringOfTiles(count, ringR, { polygonN, tileR, c = { x: 0, y: 0 }, phaseDeg = 0, aim = true } = {}) {
  const ph = (phaseDeg * Math.PI) / 180;
  const tiles = [];
  for (let k = 0; k < count; k++) {
    const ang = ph + (2 * Math.PI * k) / count;
    const center = { x: c.x + ringR * Math.cos(ang), y: c.y + ringR * Math.sin(ang) };
    const vertPhaseDeg = aim ? (ang * 180) / Math.PI : 0;
    tiles.push(regularPolygon(polygonN, tileR, center, vertPhaseDeg));
  }
  return tiles;
}

/** Hexagonal lattice of equal circles (the flower/seed-of-life construction). */
export function hexCircleGrid(radius, rings) {
  const e1 = { x: radius, y: 0 };
  const e2 = { x: radius / 2, y: (radius * Math.sqrt(3)) / 2 };
  const seen = new Set();
  const circles = [];
  for (let i = -rings; i <= rings; i++) {
    for (let j = -rings; j <= rings; j++) {
      const dist = (Math.abs(i) + Math.abs(j) + Math.abs(i + j)) / 2;
      if (dist > rings) continue;
      const cx = i * e1.x + j * e2.x;
      const cy = i * e1.y + j * e2.y;
      const key = `${Math.round(cx * 1000)}:${Math.round(cy * 1000)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      circles.push({ cx, cy, r: radius });
    }
  }
  return circles;
}

// --- strapwork / interlace --------------------------------------------------

function planarGraph(segments, eps = 1e-4) {
  const key = (p) => `${Math.round(p.x / eps)}:${Math.round(p.y / eps)}`;
  const verts = new Map();
  const vert = (p) => {
    const k = key(p);
    if (!verts.has(k)) verts.set(k, { x: p.x, y: p.y, nbrs: new Set() });
    return k;
  };
  for (const [a, b] of segments) {
    const ka = vert(a);
    const kb = vert(b);
    if (ka === kb) continue;
    verts.get(ka).nbrs.add(kb);
    verts.get(kb).nbrs.add(ka);
  }
  return verts;
}

function extractStrands(verts) {
  const dkey = (a, b) => `${a}>${b}`;
  const done = new Set();
  const strands = [];
  const pt = (k) => ({ x: verts.get(k).x, y: verts.get(k).y });

  for (const [ka, va] of verts) {
    for (const kb of va.nbrs) {
      if (done.has(dkey(ka, kb))) continue;
      const seq = [ka];
      let prev = ka;
      let cur = kb;
      let guard = 0;
      const cap = verts.size * 6 + 10;
      while (guard++ < cap) {
        done.add(dkey(prev, cur));
        seq.push(cur);
        const vcur = verts.get(cur);
        const inDir = norm(sub(pt(cur), pt(prev)));
        let best = null;
        let bestDot = -Infinity;
        for (const nb of vcur.nbrs) {
          if (nb === prev && vcur.nbrs.size > 1) continue;
          const d = dotv(inDir, norm(sub(pt(nb), pt(cur))));
          if (d > bestDot) {
            bestDot = d;
            best = nb;
          }
        }
        if (best === null) break;
        if (done.has(dkey(cur, best))) break;
        prev = cur;
        cur = best;
      }
      strands.push(seq);
    }
  }
  return strands;
}

function assignOverUnder(strands) {
  const at = new Map();
  strands.forEach((seq, si) => {
    seq.forEach((k, idx) => {
      if (idx === 0 || idx === seq.length - 1) return;
      if (!at.has(k)) at.set(k, []);
      at.get(k).push({ si, idx });
    });
  });
  const under = new Set();
  for (const [k, list] of at) {
    if (list.length < 2) continue;
    list.sort((a, b) => (a.idx % 2) - (b.idx % 2) || a.si - b.si);
    for (let i = 1; i < list.length; i++) under.add(`${list[i].si}@${k}`);
  }
  return under;
}

function trimTowards(from, to, dist) {
  const d = norm(sub(to, from));
  return add(from, scale(d, dist));
}

/**
 * Convert a line network into strapwork strand pieces (polylines). The UNDER
 * strand is gapped (`gap` world units) at each crossing so the over strand reads
 * on top. Over/under is greedy per-strand parity (see plan for the limitation).
 * @returns {Array<Array<{x,y}>>} polyline pieces
 */
export function strapworkPieces(segments, { gap = 0.11 } = {}) {
  const verts = planarGraph(segments);
  const strands = extractStrands(verts);
  const under = assignOverUnder(strands);
  const pt = (k) => ({ x: verts.get(k).x, y: verts.get(k).y });

  const pieces = [];
  strands.forEach((seq, si) => {
    const pts = seq.map(pt);
    const cut = seq.map((k, idx) => idx > 0 && idx < seq.length - 1 && under.has(`${si}@${k}`));
    let piece = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      if (cut[i]) {
        piece.push(trimTowards(pts[i], pts[i - 1], gap));
        if (piece.length >= 2) pieces.push(piece);
        piece = [trimTowards(pts[i], pts[i + 1] || pts[i], gap)];
      } else {
        piece.push(pts[i]);
      }
    }
    if (piece.length >= 2) pieces.push(piece);
  });
  return pieces;
}

// ===========================================================================
// mint-time expander — `arabesque` mark → base polyline/polygon/circle marks
// ===========================================================================

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const intOf = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(1, Math.round(v)) : d);
const round = (n) => Number(n.toFixed(3));

const DEFAULT_ANGLE = { hex: 55, square: 50, khatam: 67 };

/** Build a field's segments + fillable star polygons for a named pattern. */
function buildField(pattern, cols, rows, angle) {
  if (pattern === 'square') {
    const tiles = squareTiling(cols, rows, 1);
    const ca = num(angle, DEFAULT_ANGLE.square);
    return { segments: patternFromTiling(tiles, ca), polys: tiles.map((t) => starPolygon(t, ca)) };
  }
  if (pattern === 'khatam') {
    const { octs, squares } = octagonSquareTiling(cols, rows, 1);
    const oca = num(angle, DEFAULT_ANGLE.khatam);
    const sca = 55;
    return {
      segments: [...octs.flatMap((t) => tileMotif(t, oca)), ...squares.flatMap((t) => tileMotif(t, sca))],
      polys: [...octs.map((t) => starPolygon(t, oca)), ...squares.map((t) => starPolygon(t, sca))],
    };
  }
  const tiles = hexTiling(cols, rows, 1); // default hex
  const ca = num(angle, DEFAULT_ANGLE.hex);
  return { segments: patternFromTiling(tiles, ca), polys: tiles.map((t) => starPolygon(t, ca)) };
}

/**
 * Lower an `arabesque` mark into base marks (polyline / polygon / circle),
 * scaled and centred into the sketch viewBox. Deterministic.
 *
 * Mark spec (all optional except kind):
 *   mode        'field' | 'rosette' | 'medallion'      (default 'field')
 *   pattern     'hex' | 'square' | 'khatam'            (field mode; default 'hex')
 *   n           star/rosette fold                       (default 12)
 *   contactAngle star sharpness in degrees
 *   cols, rows  field extent
 *   interlace   render field as woven strapwork bands   (field mode)
 *   fill        fill faces (stars / rosette points+petals+core)
 *   cx, cy      centre in viewBox px (default centre)
 *   size        fraction of min(viewBox) spanned        (default 0.9)
 *   stroke, strokeWidth, starFill, petalFill, coreFill, bandColor, casingColor
 *
 * @returns {Array<object>} base marks
 */
export function expandArabesque(mark = {}, manifest = {}) {
  const viewBox = manifest.viewBox || {};
  const vw = num(viewBox.width, 800);
  const vh = num(viewBox.height, 800);
  const mode = mark.mode === 'rosette' || mark.mode === 'medallion' ? mark.mode : 'field';
  const stroke = typeof mark.stroke === 'string' ? mark.stroke : 'var(--foreground)';
  const strokeWidth = num(mark.strokeWidth, 1.5);
  const doFill = !!mark.fill;
  const doInterlace = !!mark.interlace;
  const n = intOf(mark.n, 12);
  const pal = {
    star: typeof mark.starFill === 'string' ? mark.starFill : '#c9a227',
    petal: typeof mark.petalFill === 'string' ? mark.petalFill : '#3f6f8f',
    core: typeof mark.coreFill === 'string' ? mark.coreFill : '#b0473b',
    band: typeof mark.bandColor === 'string' ? mark.bandColor : stroke,
    casing: typeof mark.casingColor === 'string' ? mark.casingColor : '#0f1020',
  };

  // primitives in unit space: { shape, pts?, c?, r?, fill, stroke, strokeWidth, z }
  const prims = [];
  const outline = (pts, z = 2) => prims.push({ shape: 'polygon', pts, fill: 'none', stroke, strokeWidth, z, closed: true });
  const polyline = (pts, col, sw, z) => prims.push({ shape: 'polyline', pts, fill: 'none', stroke: col, strokeWidth: sw, z });
  const face = (pts, fill, z = 0) => prims.push({ shape: 'polygon', pts, fill, stroke: 'none', strokeWidth: 0, z, closed: true });
  const ring = (cx, cy, r, z = 1, col = stroke) => prims.push({ shape: 'circle', c: { x: cx, y: cy }, r, fill: 'none', stroke: col, strokeWidth, z });

  if (mode === 'rosette') {
    const { faces } = buildRosette(n, {
      Rshoulder: num(mark.shoulder, 0.66),
      Rpetal: num(mark.shoulder, 0.66) + 0.12,
      pointHalfFrac: num(mark.pointWidth, 0.26),
    });
    if (doFill) {
      faces.points.forEach((f) => face(f, pal.star));
      faces.petals.forEach((f) => face(f, pal.petal));
      face(faces.core, pal.core);
    }
    faces.points.forEach((f) => outline(f));
    faces.petals.forEach((f) => outline(f));
    outline(faces.core);
  } else if (mode === 'medallion') {
    const ca = num(mark.contactAngle, 68);
    // central star
    if (doFill) face(starPolygon(regularPolygon(n, 0.62), ca), pal.star);
    outline(starPolygon(regularPolygon(n, 0.62), ca));
    // a ring of stars
    const ringTiles = ringOfTiles(n, 1.55, { polygonN: 6, tileR: 0.44 });
    ringTiles.forEach((t) => {
      if (doFill) face(starPolygon(t, 60), pal.star);
      outline(starPolygon(t, 60));
    });
    // framing rings
    ring(0, 0, 1.0, 1);
    ring(0, 0, 2.05, 3);
    ring(0, 0, 2.18, 3);
  } else {
    const pattern = mark.pattern === 'square' || mark.pattern === 'khatam' ? mark.pattern : 'hex';
    const cols = intOf(mark.cols, pattern === 'khatam' ? 4 : 5);
    const rows = intOf(mark.rows, 4);
    const { segments, polys } = buildField(pattern, cols, rows, mark.contactAngle);
    if (doInterlace) {
      const pieces = strapworkPieces(segments, { gap: num(mark.gap, 0.11) });
      const coreW = num(mark.bandWidth, strokeWidth * 2.2);
      const caseW = coreW + strokeWidth * 1.6;
      pieces.forEach((p) => polyline(p, pal.casing, caseW, 1));
      pieces.forEach((p) => polyline(p, pal.band, coreW, 2));
    } else {
      if (doFill) polys.forEach((p) => face(p, pal.star));
      polys.forEach((p) => outline(p));
    }
  }

  // fit unit-space geometry into the viewBox
  const allPts = [];
  for (const pr of prims) {
    if (pr.shape === 'circle') {
      allPts.push({ x: pr.c.x - pr.r, y: pr.c.y - pr.r }, { x: pr.c.x + pr.r, y: pr.c.y + pr.r });
    } else {
      allPts.push(...pr.pts);
    }
  }
  if (!allPts.length) return [];
  const bb = bounds(allPts);
  const bw = bb.maxX - bb.minX || 1;
  const bh = bb.maxY - bb.minY || 1;
  const span = num(mark.size, 0.9) * Math.min(vw, vh);
  const s = span / Math.max(bw, bh);
  const bcx = (bb.minX + bb.maxX) / 2;
  const bcy = (bb.minY + bb.maxY) / 2;
  const cx = num(mark.cx, vw / 2);
  const cy = num(mark.cy, vh / 2);
  const T = (p) => [round(cx + (p.x - bcx) * s), round(cy + (p.y - bcy) * s)];

  const baseRole = typeof mark.role === 'string' && mark.role ? mark.role : 'arabesque';
  const common = { opacity: num(mark.opacity, 1), constructionKind: 'arabesque' };
  const out = [];
  prims
    .slice()
    .sort((a, b) => a.z - b.z)
    .forEach((pr, i) => {
      const role = `${baseRole}:${mode}:${i}`;
      if (pr.shape === 'circle') {
        const c = T(pr.c);
        out.push({ kind: 'circle', role, cx: c[0], cy: c[1], r: round(pr.r * s), fill: pr.fill, stroke: pr.stroke, strokeWidth: pr.strokeWidth, z: pr.z, ...common, constructionRole: 'ring' });
      } else {
        out.push({
          kind: pr.shape, role, points: pr.pts.map(T), fill: pr.fill, stroke: pr.stroke,
          strokeWidth: pr.strokeWidth, z: pr.z, ...common, constructionRole: pr.shape,
        });
      }
    });
  return out;
}
