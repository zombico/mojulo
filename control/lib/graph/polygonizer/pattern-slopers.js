/**
 * SLOPERS — basic pattern blocks drafted from the body's own measurements.
 *
 * A sloper (block) is the tailor's starting pattern: a fitted piece drafted by arithmetic
 * over girths and drops — quarter bust plus ease, shoulder slope, armhole depth as a share
 * of the chest. Here each block is a pure function `(measures, dials) -> piece fields`
 * (outline in cm, named edges, chart, anchor) that pattern-garment.js drafts at BUILD time
 * from the chart it will sit on, so the same recipe re-drafts on every body: the female
 * pole, the male pole, a stocky mechanic. That is the recipe-book move applied to pattern
 * drafting — the garment is dials over a block, never stored geometry.
 *
 * The numbers are textbook-plain on purpose (a block, not a couture draft). Every one is a
 * named dial with a default; an outline authored by hand overrides a block entirely.
 *
 * Piece space: cm, +x the piece's right, +y up; outlines counter-clockwise; y = 0 at the hem.
 */

export const SLOPER_KINDS = ['bodice-front', 'bodice-back', 'sleeve', 'skirt-front', 'skirt-back', 'trouser-front', 'trouser-back'];

// hem names → the chart landmark the hem sits at (bodice/skirt); numbers are cm below the anchor
const HEM_LANDMARK = { waist: 'waist', hip: 'hip', crotch: 'crotch' };

const r2 = (v) => Math.round(v * 100) / 100;

// A quadratic bezier sampled into `n` points (the block's curves: armhole, neck, sleeve cap).
function curve(p0, p1, p2, n = 6) {
  const out = [];
  for (let i = 1; i < n; i++) {
    const t = i / n, u = 1 - t;
    out.push([r2(u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]), r2(u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1])]);
  }
  return out;
}

/**
 * The trunk's measures a block needs: girths in cm at the landmarks, the drops (cm) from the
 * chart top to each landmark, and — on a chart with a cap — `crest { half_cm, drop_cm }`, the
 * shoulder's half-length and slope. `chartMeasures` in pattern-garment.js builds it.
 * @typedef {{ girth: Object<string, number>, drop: Object<string, number>, length: number, crest?: { half_cm: number, drop_cm: number } }} Measures
 */

function hemDrop(m, hem, fallbackCm) {
  if (typeof hem === 'number' && Number.isFinite(hem)) return hem;
  const lm = HEM_LANDMARK[hem];
  if (lm && m.drop[lm] != null) return m.drop[lm];
  if (hem === 'knee') return (m.drop.crotch ?? fallbackCm) + 30;
  return fallbackCm;
}

// the girth the cloth actually sits at: the body's plus the ease ring's circumference (m.standoff,
// 2π·ease_cm, set by pattern-garment.js; 0 when a block is drafted straight from a tape)
const atRing = (m, girth) => (Number.isFinite(girth) ? girth + (m.standoff ?? 0) : girth);

function bodice(side, m, d = {}) {
  const g = Object.fromEntries(Object.entries(m.girth).map(([k, v]) => [k, atRing(m, v)])), drop = m.drop;
  const easeB = d.ease_bust_cm ?? 6, easeW = d.ease_waist_cm ?? easeB, easeH = d.ease_hip_cm ?? easeB;
  const back = side === 'back';
  const L = hemDrop(m, d.hem ?? 'hip', (drop.hip ?? 45));          // shoulder row → hem
  const yBust = Math.max(4, L - (drop.bust ?? L * 0.3));
  const yWaist = Math.max(2, L - (drop.waist ?? L * 0.55));
  const yHip = Math.max(0, L - (drop.hip ?? L));
  const bustHalf = g.bust / 4 + easeB / 2, waistHalf = g.waist / 4 + easeW / 2, hipHalf = g.hip / 4 + easeH / 2;
  // the neck opening is the NECK'S BASE: a quarter of its girth where it rises through the crest
  // (measured, `m.crest.neck_cm`), else the tailor's neck girth over five — never the ring's:
  // the ease rises off the crest, it does not widen the neckline into a boat neck
  const neckHalf = d.neck_width_cm != null ? d.neck_width_cm / 2 : Number.isFinite(m.crest?.neck_cm) ? m.crest.neck_cm / 4 : Math.max(5, Number.isFinite(m.girth.neck) ? m.girth.neck / 5 : 7);
  const neckDrop = d.neck_drop_cm ?? (back ? 2 : 7);
  // THE SHOULDER LINE: the tip sits at the crest's end (the acromion, `m.crest.half_cm` from
  // the neck centre) and drops by the crest's measured slope — the chart's cap is the body's
  // own shoulder, and the block drafts to it. Without a cap (a chart with no crest) the old
  // reading stands: a quarter of the top row, 4 cm down.
  const shoulderHalf = d.shoulder_cm != null ? d.shoulder_cm / 2 : m.crest ? Math.max(neckHalf + 4, m.crest.half_cm) : Math.max(neckHalf + 6, Number.isFinite(g.top) ? g.top / 4 - 1 : g.bust * 0.22);
  const shoulderDrop = d.shoulder_drop_cm ?? (m.crest ? m.crest.drop_cm : 4);
  const armholeDepth = L - shoulderDrop - yBust;                        // shoulder tip → bust line
  const hemHalf = yHip > 0 ? hipHalf + (d.flare_cm ?? 0) : (L <= (drop.waist ?? Infinity) + 0.5 ? waistHalf : hipHalf) + (d.flare_cm ?? 0);
  // right half, bottom → top (the outline is then mirrored for the left half, CCW overall)
  const right = [
    [hemHalf, 0],
    ...(yHip > 0 ? [[hipHalf, yHip]] : []),
    ...(yWaist > yHip + 0.5 ? [[waistHalf, yWaist]] : []),
    [bustHalf, yBust],
    ...curve([bustHalf, yBust], [bustHalf - 1, yBust + armholeDepth * 0.6], [shoulderHalf, L - shoulderDrop], 6),
    [shoulderHalf, L - shoulderDrop],
    [neckHalf, L],
    ...curve([neckHalf, L], [neckHalf * 0.5, L - neckDrop * 0.95], [0, L - neckDrop], 5),
  ];
  const pts = [[-r2(hemHalf), 0]];
  for (const p of right) pts.push([r2(p[0]), r2(p[1])]);
  pts.push([0, r2(L - neckDrop)]);
  for (let i = right.length - 1; i >= 1; i--) pts.push([-r2(right[i][0]), r2(right[i][1])]);
  // dedupe the centre-front point the two halves share
  const out = [];
  for (const p of pts) { const q = out[out.length - 1]; if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-6) out.push(p); }
  // named edges by outline index (the right half runs bottom → top from index 1)
  const iHemR = 1, iBust = 1 + (yHip > 0 ? 1 : 0) + (yWaist > yHip + 0.5 ? 1 : 0) + 1;
  const iTip = iBust + 6, iNeckR = iTip + 1, iCF = iNeckR + 5;
  const n = out.length;
  // the left half mirrors the right: outline index j on the right is n - j + 1 on the left
  const M = (j) => n - j + 1;
  const edges = {
    hem: [0, iHemR], sideR: [iHemR, iBust], armholeR: [iBust, iTip], shoulderR: [iTip, iNeckR], neck: [iNeckR, M(iNeckR)],
    shoulderL: [M(iNeckR), M(iTip)], armholeL: [M(iTip), M(iBust)], sideL: [M(iBust), 0],
  };
  void iCF;
  return {
    outline: out, edges, corners: [M(iTip), iTip, iHemR, 0], chart: 'trunk',
    // the shoulder line is the chart's TOP row — the CREST of its cap, the line from the neck
    // base to the acromion: the front's and the back's shoulder edges both lie on it and the
    // `over` seam stitched between them is the crest itself
    anchor: { piece: [0, r2(L)], chart: { u: back ? 'cb' : 'cf', v: 'top' } },
  };
}

function sleeve(m, d = {}) {
  const g = Object.fromEntries(Object.entries(m.girth).map(([k, v]) => [k, atRing(m, v)]));
  const bicep = (g.upperArm ?? 30) + (d.ease_cm ?? 4);
  const wrist = (g.wrist ?? 17) + (d.ease_wrist_cm ?? 6);
  const lengths = { short: 22, 'three-quarter': Math.max(30, (m.length ?? 58) * 0.7), long: (m.length ?? 58) };
  const len = typeof d.length === 'number' ? d.length : (lengths[d.length ?? 'long'] ?? lengths.long);
  const capH = Math.min(d.cap_height_cm ?? Math.max(8, bicep / 3), Math.max(4, (m.above ?? 10) - 0.5));   // never taller than the room above the anchor row
  const L = len + capH, bh = bicep / 2, wh = wrist / 2;
  const cap = curve([bh, len], [bh * 0.55, L + capH * 0.25], [0, L], 6);
  const right = [[wh, 0], [bh, len], ...cap];
  const pts = [[-r2(wh), 0]];
  for (const p of right) pts.push([r2(p[0]), r2(p[1])]);
  pts.push([0, r2(L)]);
  for (let i = right.length - 1; i >= 1; i--) pts.push([-r2(right[i][0]), r2(right[i][1])]);
  const out = [];
  for (const p of pts) { const q = out[out.length - 1]; if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-6) out.push(p); }
  const n = out.length, iBicep = 2, iTop = iBicep + 5, iBicepL = n - iBicep + 1;
  return {
    outline: out, edges: { hem: [0, 1], underarmR: [1, iBicep], cap: [iBicep, iBicepL], underarmL: [iBicepL, 0] },
    corners: [iBicepL, iBicep, 1, 0], chart: 'armL',
    anchor: { piece: [0, r2(len)], chart: { u: 'cf', v: 'shoulder' } },
    _iTop: iTop,
  };
}

function skirt(side, m, d = {}) {
  const g = Object.fromEntries(Object.entries(m.girth).map(([k, v]) => [k, atRing(m, v)])), drop = m.drop;
  const easeW = d.ease_waist_cm ?? 2, easeH = d.ease_hip_cm ?? 4;
  const waistToHip = Math.max(8, (drop.hip ?? 0) - (drop.waist ?? 0));
  const L = typeof d.length === 'number' ? d.length : (d.length === 'mini' ? waistToHip + 20 : d.length === 'midi' ? waistToHip + 45 : waistToHip + 32);
  const waistHalf = g.waist / 4 + easeW / 2, hipHalf = g.hip / 4 + easeH / 2, hemHalf = hipHalf + (d.flare_cm ?? 4);
  const yHip = L - waistToHip;
  const out = [[-r2(hemHalf), 0], [r2(hemHalf), 0], [r2(hipHalf), r2(yHip)], [r2(waistHalf), r2(L)], [-r2(waistHalf), r2(L)], [-r2(hipHalf), r2(yHip)]];
  return {
    outline: out, edges: { hem: [0, 1], sideR: [1, 3], waist: [3, 4], sideL: [4, 0] }, corners: [4, 3, 1, 0], chart: 'trunk',
    anchor: { piece: [0, r2(L)], chart: { u: side === 'back' ? 'cb' : 'cf', v: 'waist' } },
  };
}

// A TROUSER LEG: one piece on two charts (pattern-garment.js `join`). Above the crotch it lies on
// the trunk — a quarter of the trunk from the centre line to the side, its centre edge (cf on the
// front, cb on the back) straight on the body's centre line, where it is sewn to the other leg's
// piece — and below the crotch on the leg, the front (or back) half of the leg's tube. The FORK is
// the horizontal jut at the crotch level that carries the cloth under the body (hip/16 in front,
// hip/8 behind: the textbook extensions). The join's leg anchor is the middle of the piece's
// crotch-level trunk span, which lands on the leg's front (back) centre.
//
// Piece space (left front): x = 0 is the centre line on the RIGHT edge, the outseam runs at
// negative x; the left back is its mirror image (centre line on the left, outseam at +x), so
// front.outseam ↔ back.outseam sew at the side and front.inseam ↔ back.inseam inside the leg,
// front.cf ↔ frontR.cf and back.cb ↔ backR.cb on the centre lines.
function trouser(side, m, d = {}) {
  const g = Object.fromEntries(Object.entries(m.girth).map(([k, v]) => [k, atRing(m, v)])), drop = m.drop, leg = m.leg ?? { girth: {}, drop: {} };
  const lg = Object.fromEntries(Object.entries(leg.girth ?? {}).map(([k, v]) => [k, atRing(m, v)]));
  const back = side === 'back';
  const ease = d.ease_cm ?? 6, easeHem = d.ease_hem_cm ?? 16, easeW = d.ease_waist_cm ?? 2;
  const q = (girth, e) => (Number.isFinite(girth) ? girth / 4 + e / 4 : 20);
  const oWaist = q(g.waist ?? g.top, easeW), oHip = q(g.hip ?? g.waist, ease), oCrotch = q(g.crotch ?? g.hip, ease);
  const hipRaw = m.girth.hip ?? m.girth.waist ?? 90;
  const fork = d.fork_cm ?? (back ? hipRaw / 8 + 1 : hipRaw / 16 + 0.5);
  const dHip = drop.hip ?? 20, dCrotch = Math.max(dHip + 2, drop.crotch ?? 26);
  const legLen = typeof d.length === 'number' ? Math.max(0, d.length - dCrotch) : d.length === 'knee' ? (leg.drop?.knee ?? 40) : (leg.drop?.ankle ?? 80);
  const L = dCrotch + legLen;
  const yCrotch = legLen, yHip = L - dHip, yKnee = Math.max(0, yCrotch - (leg.drop?.knee ?? legLen * 0.5));
  // the leg's front half sits about the piece column xc (the middle of the crotch-level trunk span)
  const xc = -oCrotch / 2;
  const half = (girth, e) => (Number.isFinite(girth) ? girth / 4 + e / 4 : oCrotch / 2);
  const hKnee = half(lg.knee ?? lg.thigh, ease), hHem = half(lg.ankle ?? lg.knee, easeHem);
  const hasKnee = yKnee > 0.5 && yKnee < yCrotch - 0.5;
  // CCW from the bottom-left, front orientation; the back mirrors x (and reverses to stay CCW)
  const pts = [
    [xc - hHem, 0], [xc + hHem, 0],
    ...(hasKnee ? [[xc + hKnee, yKnee]] : []),
    [fork, yCrotch], [0, yCrotch], [0, L], [-oWaist, L],
    ...(yHip > yCrotch + 0.5 ? [[-oHip, yHip]] : []),
    [-oCrotch, yCrotch],
    ...(hasKnee ? [[xc - hKnee, yKnee]] : []),
  ].map(([x, y]) => [r2(x), r2(y)]);
  const iFork = hasKnee ? 3 : 2, iCentreBottom = iFork + 1, iCentreTop = iFork + 2, iWaistOut = iFork + 3;
  const centre = back ? 'cb' : 'cf';
  let outline = pts, edges = { hem: [0, 1], inseam: [1, iFork], fork: [iFork, iCentreBottom], [centre]: [iCentreBottom, iCentreTop], waist: [iCentreTop, iWaistOut], outseam: [iWaistOut, 0] };
  let corners = [iWaistOut, iCentreTop, 1, 0];
  const anchor = { piece: [0, r2(L)], chart: { u: centre, v: 'waist' } };
  // the join sits a hair ABOVE the fork line so the fork is placed on the leg (it wraps under the
  // body toward the inner thigh), never counted as cloth around the trunk
  let join = { chart: leg.chart ?? 'legL', y: r2(yCrotch + 0.5), anchor: { piece: [r2(xc), r2(yCrotch + 0.5)], chart: { u: centre } } };
  if (back) {
    // mirror in x, keep CCW; edge indices remap i → n - 1 - i with ends swapped (mirrorPiece's rule)
    const n = pts.length, remap = (i) => n - 1 - (((i % n) + n) % n);
    outline = pts.map(([x, y]) => [r2(-x), y]).reverse();
    edges = Object.fromEntries(Object.entries(edges).map(([k, [a, b]]) => [k, [remap(b), remap(a)]]));
    corners = [remap(corners[1]), remap(corners[0]), remap(corners[3]), remap(corners[2])];
    join = { ...join, anchor: { ...join.anchor, piece: [r2(-xc), r2(yCrotch + 0.5)] } };
    // list the edges in outline (chain) order from the hem, as every block does
    const hem0 = edges.hem[0];
    edges = Object.fromEntries(Object.entries(edges).sort((a, b) => ((a[1][0] - hem0 + n) % n) - ((b[1][0] - hem0 + n) % n)));
  }
  return { outline, edges, corners, chart: 'trunk', anchor, join };
}

/**
 * Draft one block. Returns the piece fields a `fit:'pattern'` piece needs (outline, edges,
 * corners, chart, anchor); the caller merges them under the author's explicit fields.
 * @param {string} kind        one of SLOPER_KINDS
 * @param {Measures} measures  from the chart the piece will sit on (trunk for bodice/skirt, an arm for a sleeve)
 * @param {object} [dials]     per-block dials, all optional
 */
export function draftSloper(kind, measures, dials = {}) {
  switch (kind) {
    case 'bodice-front': return bodice('front', measures, dials);
    case 'bodice-back': return bodice('back', measures, dials);
    case 'sleeve': { const s = sleeve(measures, dials); delete s._iTop; return s; }
    case 'skirt-front': return skirt('front', measures, dials);
    case 'skirt-back': return skirt('back', measures, dials);
    case 'trouser-front': return trouser('front', measures, dials);
    case 'trouser-back': return trouser('back', measures, dials);
    default: throw new Error(`draftSloper: '${kind}' is not one of ${SLOPER_KINDS.join(' | ')}`);
  }
}

// The chart a block sits on when the piece does not say.
export function sloperChart(kind) { return kind === 'sleeve' ? 'armL' : 'trunk'; }

// Whole garments (a shift dress, an A-line skirt, trousers) are REPERTOIRE, not capability: they
// live in the recipe book's wardrobe chapter as `garment.json` entries — dials over these blocks —
// and reach `create_figure` by name through `outfit`. Core carries the blocks only.
