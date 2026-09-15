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

export const SLOPER_KINDS = ['bodice-front', 'bodice-back', 'sleeve', 'skirt-front', 'skirt-back', 'trouser-front', 'trouser-back', 'shoe-sole', 'shoe-upper', 'boot-shaft'];

// hem names → the chart landmark the hem sits at (bodice/skirt); numbers are cm below the anchor
const HEM_LANDMARK = { waist: 'waist', hip: 'hip', crotch: 'crotch' };

const r2 = (v) => Math.round(v * 100) / 100;

// NECKLINES (wardrobe-variety P4). The front's neckline shape; the back keeps a shallow crew
// whatever the front wears. Each kind is a default drop and width scale plus the run of points
// from the neck's shoulder end to the centre (exclusive of both): a curve, a corner, or nothing.
export const NECK_KINDS = ['crew', 'scoop', 'v', 'square', 'boat'];
const NECK_DROP = { crew: 7, scoop: 12, v: 12, square: 9, boat: 2 };
const NECK_WIDTH = { crew: 1, scoop: 1.3, v: 1, square: 1.1, boat: 1.6 };
function neckline(kind, neckHalf, L, neckDrop) {
  if (kind === 'v') return [];                                   // a straight line to the centre drop
  if (kind === 'square') return [[r2(neckHalf), r2(L - neckDrop)]];   // straight down, then across
  return curve([neckHalf, L], [neckHalf * 0.5, L - neckDrop * 0.95], [0, L - neckDrop], 5);
}

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

// THE TAILOR'S EASE (wardrobe-variety): a block's `ease_*_cm` dial is the TOTAL circumference the
// cloth has over the tape — the number a pattern book prints (a shirt +10 at the chest, a jacket
// +5 over the shirt) — and never less than the ease ring the piece is placed on (m.standoff =
// 2π·ease_cm, the stand-off's own circumference, set by pattern-garment.js; 0 when a block is
// drafted straight from a tape). Before this the dial was doubled (a half-piece took half of it)
// and added ON TOP of the ring, so the default shift carried 21 cm at the bust and a suit jacket
// over a shirt read 186 cm around on a 102 cm chest.
const total = (m, girth, ease) => (Number.isFinite(girth) ? girth + Math.max(ease ?? 0, m.standoff ?? 0) : girth);

// outline index of the bust point on the right half (hem, then the optional hip and waist points)
const iBustOf = (yHip, yWaist) => 1 + (yHip > 0 ? 1 : 0) + (yWaist > yHip + 0.5 ? 1 : 0) + 1;

function bodice(side, m, d = {}) {
  const g = m.girth, drop = m.drop;
  const easeB = d.ease_bust_cm ?? 6, easeW = d.ease_waist_cm ?? easeB, easeH = d.ease_hip_cm ?? easeB;
  const back = side === 'back';
  const L = hemDrop(m, d.hem ?? 'hip', (drop.hip ?? 45));          // shoulder row → hem
  const yBust = Math.max(4, L - (drop.bust ?? L * 0.3));
  const yWaist = Math.max(2, L - (drop.waist ?? L * 0.55));
  const yHip = Math.max(0, L - (drop.hip ?? L));
  // a quarter of the total (front + back, each mirrored): the tape plus the ease, or the ring
  const bustHalf = total(m, g.bust, easeB) / 4, waistHalf = total(m, g.waist, easeW) / 4, hipHalf = total(m, g.hip, easeH) / 4;
  // the neck opening is the NECK'S BASE: a quarter of its girth where it rises through the crest
  // (measured, `m.crest.neck_cm`), else the tailor's neck girth over five — never the ring's:
  // the ease rises off the crest, it does not widen the neckline into a boat neck
  const neckKind = back ? 'crew' : (NECK_KINDS.includes(d.neck) ? d.neck : 'crew');
  const neckBase = Number.isFinite(m.crest?.neck_cm) ? m.crest.neck_cm / 4 : Math.max(5, Number.isFinite(m.girth.neck) ? m.girth.neck / 5 : 7);
  const neckHalf = d.neck_width_cm != null ? d.neck_width_cm / 2 : neckBase * NECK_WIDTH[neckKind];
  const neckDrop = d.neck_drop_cm ?? (back ? 2 : NECK_DROP[neckKind]);
  // THE OPEN FRONT (wardrobe-variety P5): `split: 'cf'` drafts the front as its RIGHT half only,
  // with a `cf` edge on the centre line (extended past it by half the `overlap_cm` button stand);
  // the caller mirrors it into the left half. A shirt, a vest, a jacket, a coat.
  const split = !back && d.split === 'cf';
  const ov = split ? Math.max(0, d.overlap_cm ?? 0) / 2 : 0;
  // THE SHOULDER LINE: the tip sits at the crest's end (the acromion, `m.crest.half_cm` from
  // the neck centre) and drops by the crest's measured slope — the chart's cap is the body's
  // own shoulder, and the block drafts to it. Without a cap (a chart with no crest) the old
  // reading stands: a quarter of the top row, 4 cm down.
  const shoulderHalf = d.shoulder_cm != null ? d.shoulder_cm / 2 : m.crest ? Math.max(neckHalf + 4, m.crest.half_cm) : Math.max(neckHalf + 6, Number.isFinite(g.top) ? total(m, g.top, 0) / 4 - 1 : total(m, g.bust, easeB) * 0.22);
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
    ...neckline(neckKind, neckHalf, L, neckDrop),
  ];
  const nNeck = right.length - (iBustOf(yHip, yWaist) + 8);   // points on the neck run after [neckHalf, L]
  const pts = [[-r2(split ? ov : hemHalf), 0]];
  for (const p of right) pts.push([r2(p[0]), r2(p[1])]);
  pts.push([0, r2(L - neckDrop)]);
  if (split) { if (ov > 0) pts.push([-r2(ov), r2(L - neckDrop)]); }
  else for (let i = right.length - 1; i >= 1; i--) pts.push([-r2(right[i][0]), r2(right[i][1])]);
  // dedupe the centre-front point the two halves share
  const out = [];
  for (const p of pts) { const q = out[out.length - 1]; if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-6) out.push(p); }
  // named edges by outline index (the right half runs bottom → top from index 1)
  const iHemR = 1, iBust = iBustOf(yHip, yWaist);
  const iTip = iBust + 6, iNeckR = iTip + 1, iCF = iNeckR + nNeck + 1;   // iCF = the centre point at the neck's drop
  const n = out.length;
  if (split) {
    // the right half: hem · sideR · armholeR · shoulderR · neck · cf, chained from the hem
    const iCFtop = n - 1;   // the last point: the centre-top, or the overlap's corner beside it
    const edges = { hem: [0, iHemR], sideR: [iHemR, iBust], armholeR: [iBust, iTip], shoulderR: [iTip, iNeckR], neck: [iNeckR, iCFtop], cf: [iCFtop, 0] };
    return { outline: out, edges, corners: [iCFtop, iTip, iHemR, 0], chart: 'trunk', split: true, anchor: { piece: [0, r2(L)], chart: { u: 'cf', v: 'top' } } };
  }
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
  const g = m.girth;
  // THE TAILOR'S SLEEVE: widest at the underarm level — the armscye row, the fullest row of the
  // upper arm, where the cap sets — then tapered to the BICEP (mid upper arm) below it, then to
  // the wrist. Cut to the bicep alone it cannot close around the deltoid and the underarm seam
  // gapes; cut to the deltoid alone it hangs as a tube.
  const arm = total(m, g.upperArm ?? g.bicep ?? 30, d.ease_cm ?? 4);
  const bicep = Number.isFinite(g.bicep) && g.bicep < (g.upperArm ?? Infinity) ? total(m, g.bicep, d.ease_cm ?? 4) : arm;
  const dBicep = Number.isFinite(m.drop?.bicep) && m.drop.bicep > 1 ? m.drop.bicep : null;   // cm below the armscye row
  const wrist = total(m, g.wrist ?? 17, d.ease_wrist_cm ?? 6);
  const lengths = { short: 22, 'three-quarter': Math.max(30, (m.length ?? 58) * 0.7), long: (m.length ?? 58) };
  const len = typeof d.length === 'number' ? d.length : (lengths[d.length ?? 'long'] ?? lengths.long);
  const capH = Math.min(d.cap_height_cm ?? Math.max(8, arm / 3), Math.max(4, (m.above ?? 10) - 0.5));   // never taller than the room above the anchor row
  const L = len + capH, bh = arm / 2, bb = bicep / 2, wh = wrist / 2;
  const taper = dBicep != null && bicep < arm - 0.5 && len - dBicep > 2;   // a bicep point on the underarm edge, below the armscye
  const cap = curve([bh, len], [bh * 0.55, L + capH * 0.25], [0, L], 6);
  const right = [[wh, 0], ...(taper ? [[bb, len - dBicep]] : []), [bh, len], ...cap];
  const pts = [[-r2(wh), 0]];
  for (const p of right) pts.push([r2(p[0]), r2(p[1])]);
  pts.push([0, r2(L)]);
  for (let i = right.length - 1; i >= 1; i--) pts.push([-r2(right[i][0]), r2(right[i][1])]);
  const out = [];
  for (const p of pts) { const q = out[out.length - 1]; if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-6) out.push(p); }
  const n = out.length, iBicep = taper ? 3 : 2, iTop = iBicep + 6, iBicepL = n - iBicep + 1;   // the apex: hem, (bicep,) the armscye point, five cap points, then [0, L]
  // THE SET-IN SLEEVE (wardrobe-variety P2): the cap's apex sits on the SHOULDER POINT — the
  // arm chart's outer side (`sideL` on the left arm; the mirror swaps it) — so the underarm seam
  // falls under the arm, and the cap is two named halves, `capFront` and `capBack`, so each of a
  // bodice's two armhole edges (the front's and the back's) can take its seam.
  return {
    outline: out, edges: { hem: [0, 1], underarmR: [1, iBicep], capFront: [iBicep, iTop], capBack: [iTop, iBicepL], underarmL: [iBicepL, 0] },
    corners: [iBicepL, iBicep, 1, 0], chart: 'armL',
    anchor: { piece: [0, r2(len)], chart: { u: 'sideL', v: 'shoulder' } },
  };
}

function skirt(side, m, d = {}) {
  const g = m.girth, drop = m.drop;
  const easeW = d.ease_waist_cm ?? 2, easeH = d.ease_hip_cm ?? 4;
  const waistToHip = Math.max(8, (drop.hip ?? 0) - (drop.waist ?? 0));
  const L = typeof d.length === 'number' ? d.length : (d.length === 'mini' ? waistToHip + 20 : d.length === 'midi' ? waistToHip + 45 : waistToHip + 32);
  const waistHalf = total(m, g.waist, easeW) / 4, hipHalf = total(m, g.hip, easeH) / 4, hemHalf = hipHalf + (d.flare_cm ?? 4);
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
  const g = m.girth, drop = m.drop, leg = m.leg ?? { girth: {}, drop: {} };
  const lg = leg.girth ?? {};
  const back = side === 'back';
  const ease = d.ease_cm ?? 6, easeHem = d.ease_hem_cm ?? 16, easeW = d.ease_waist_cm ?? 2;
  const q = (girth, e) => (Number.isFinite(girth) ? total(m, girth, e) / 4 : 20);   // a quarter of the total: the tape plus the ease, or the ring
  const oWaist = q(g.waist ?? g.top, easeW), oHip = q(g.hip ?? g.waist, ease), oCrotch = q(g.crotch ?? g.hip, ease);
  const hipRaw = m.girth.hip ?? m.girth.waist ?? 90;
  const fork = d.fork_cm ?? (back ? hipRaw / 8 + 1 : hipRaw / 16 + 0.5);
  const dHip = drop.hip ?? 20, dCrotch = Math.max(dHip + 2, drop.crotch ?? 26);
  const legLen = typeof d.length === 'number' ? Math.max(0, d.length - dCrotch) : d.length === 'knee' ? (leg.drop?.knee ?? 40) : (leg.drop?.ankle ?? 80);
  const L = dCrotch + legLen;
  const yCrotch = legLen, yHip = L - dHip, yKnee = Math.max(0, yCrotch - (leg.drop?.knee ?? legLen * 0.5));
  // the leg's front half sits about the piece column xc (the middle of the crotch-level trunk span)
  const xc = -oCrotch / 2;
  const half = (girth, e) => (Number.isFinite(girth) ? total(m, girth, e) / 4 : oCrotch / 2);
  // the hem is drafted to the leg's girth AT THE HEM (wardrobe-variety P3): the knee's for knee
  // length, the ankle's for ankle length, interpolated between thigh, knee and ankle for a cm length
  const gThigh = lg.thigh ?? lg.knee, gKnee = lg.knee ?? gThigh, gAnkle = lg.ankle ?? gKnee;
  const dKnee = leg.drop?.knee ?? legLen * 0.5, dAnkle = leg.drop?.ankle ?? legLen;
  const hemGirth = d.length === 'knee' ? gKnee
    : typeof d.length === 'number' ? (legLen <= dKnee ? gThigh + (gKnee - gThigh) * (dKnee > 0 ? legLen / dKnee : 1) : gKnee + (gAnkle - gKnee) * (dAnkle > dKnee ? Math.min(1, (legLen - dKnee) / (dAnkle - dKnee)) : 1))
    : gAnkle;
  const hKnee = half(gKnee, ease), hHem = half(hemGirth, easeHem);
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


// ── FOOTWEAR ─────────────────────────────────────────────────────────────────
// A shoe is two pieces and a rule. The SOLE is a footprint under the foot; the UPPER wraps from
// one edge of that sole, over the instep, to the other. Both draft from `m.sections` — the foot
// chart's OWN ROWS, with each row's girth, breadth and distance from the heel — because the
// chart's end rows are the tube's closing caps (7.8 cm around at the heel, 1.0 cm at the toe,
// against 24 cm at the ball) and a piece wider than the ring it sits on smears. Every footwear
// block therefore lives between two v fractions, never on the caps.
//
// Piece space for both: y = 0 at the TOE end and y = L at the HEEL end, because the placer maps
// piece +y toward the chart's top and a foot chart runs heel (v 0) to toe (v 1).
const SHOE_SPAN = { from: 0.13, to: 0.92 };   // the usable chart, clear of both closing caps

// Linear read of the sections table at an along-fraction v.
function sectionAtV(sections, v) {
  if (!sections || !sections.length) return { y_cm: 0, girth: 20, width: 8, depth: 4 };
  let lo = 0; while (lo < sections.length - 2 && sections[lo + 1].v <= v) lo++;
  const a = sections[lo], b = sections[Math.min(sections.length - 1, lo + 1)];
  const f = b.v - a.v > 1e-9 ? (v - a.v) / (b.v - a.v) : 0;
  const mix = (k) => a[k] + (b[k] - a[k]) * f;
  return { y_cm: mix('y_cm'), girth: mix('girth'), width: mix('width'), depth: mix('depth') };
}
// the sections strictly inside (v0, v1), so an outline runs end - rows - end
const innerSections = (sections, v0, v1) => (sections ?? []).filter((t) => t.v > v0 + 1e-6 && t.v < v1 - 1e-6);

const smooth01 = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };

/**
 * SHOE SOLE — the footprint, drafted to the chart's rows and worn at `thickness_cm` off the
 * sole (the piece's `ease_cm`, which is what holds the foot off the ground). `margin_cm` is how
 * far the sole stands proud of the flesh all round.
 */
function shoeSole(m, d = {}) {
  const v0 = d.from ?? SHOE_SPAN.from, v1 = d.to ?? SHOE_SPAN.to;
  const margin = d.margin_cm ?? 0.5;
  const S = m.sections ?? [];
  const yAt = (v) => sectionAtV(S, v).y_cm;
  const L = r2(yAt(v1) - yAt(v0));
  const half = (sec) => r2(sec.width / 2 + margin);
  const rows = innerSections(S, v0, v1).map((t) => ({ y: r2(L - (t.y_cm - yAt(v0))), w: half(t) }));
  const wToe = r2(half(sectionAtV(S, v1)) * (d.toe_round ?? 0.82));   // the front is rounded off, not cut square
  // the heel end is NOT pulled in: its ring is the smallest the sole sits on, and narrowing the
  // piece there forces it to stretch over the heel's curl (measured: strain 2.20 -> 1.88)
  const wHeel = r2(half(sectionAtV(S, v0)) * (d.heel_round ?? 1));
  const right = [...rows].sort((a, b) => a.y - b.y);                  // toe end -> heel end
  const pts = [[-wToe, 0], [wToe, 0]];
  for (const r of right) pts.push([r.w, r.y]);
  pts.push([wHeel, L], [-wHeel, L]);
  for (let i = right.length - 1; i >= 0; i--) pts.push([-right[i].w, right[i].y]);
  const n = pts.length, iHeelR = 2 + right.length;
  return {
    outline: pts, edges: { toe: [0, 1], sideR: [1, iHeelR], heel: [iHeelR, iHeelR + 1], sideL: [iHeelR + 1, 0] },
    corners: [iHeelR + 1, iHeelR, 1, 0], chart: 'footL',
    anchor: { piece: [0, L], chart: { u: 0.5, v: v0 } },             // u 0.5 is a foot chart's SOLE
    ease_cm: d.thickness_cm ?? 2,
  };
}

/**
 * SHOE UPPER — one wrap anchored on the SOLE line, so its half-width is the arc from the sole's
 * centre up that side. Ahead of the `throat` it is half the girth: the two sides meet over the
 * instep and the shoe is closed. Behind it they fall to the sole's own half-breadth plus
 * `collar_cm` — the quarters — which leaves the top open for the foot. That ramp IS the throat,
 * and where it sits is what separates an oxford from a loafer from a sneaker from a boot.
 * Anchored at the sole rather than the instep on purpose: a piece anchored at the top would need
 * a concave outline to open its throat, and a Coons patch cannot mesh one.
 */
function shoeUpper(m, d = {}) {
  const v0 = d.heel ?? 0.10, v1 = d.toe ?? 0.96;
  const throat = d.throat ?? 0.55, blend = d.throat_blend ?? 0.12;
  const collar = d.collar_cm ?? 4;
  const S = m.sections ?? [];
  const yAt = (v) => sectionAtV(S, v).y_cm;
  const L = r2(yAt(v1) - yAt(v0));
  // half-width at v: the closed wrap ahead of the throat, the quarters behind it
  // Half the ring is the CEILING everywhere: wrap further and the two sides cross over the instep,
  // which meshes as a self-intersecting cage rather than a shoe. Near the toe the ring is small
  // enough that `open` would exceed it on its own, so the clamp is not just the ramp's end point.
  const halfAt = (v) => {
    const sec = sectionAtV(S, v);
    const closed = sec.girth / 2, open = Math.min(closed, sec.width / 2 + collar);
    const t = smooth01((v - (throat - blend)) / (2 * blend));
    return r2(open + (closed - open) * t);
  };
  const rows = innerSections(S, v0, v1).map((t) => ({ y: r2(L - (t.y_cm - yAt(v0))), w: halfAt(t.v) }))
    .sort((a, b) => a.y - b.y);
  // a sample either side of the throat so the ramp is drawn, not stepped over between rows
  for (const v of [throat - blend, throat, throat + blend]) {
    if (v <= v0 + 1e-6 || v >= v1 - 1e-6) continue;
    rows.push({ y: r2(L - (yAt(v) - yAt(v0))), w: halfAt(v) });
  }
  rows.sort((a, b) => a.y - b.y);
  const uniq = rows.filter((r, i) => i === 0 || Math.abs(r.y - rows[i - 1].y) > 0.05);
  const wToe = r2(halfAt(v1) * (d.toe_round ?? 0.7)), wHeel = r2(halfAt(v0));
  const pts = [[-wToe, 0], [wToe, 0]];
  for (const r of uniq) pts.push([r.w, r.y]);
  pts.push([wHeel, L], [-wHeel, L]);
  for (let i = uniq.length - 1; i >= 0; i--) pts.push([-uniq[i].w, uniq[i].y]);
  const iHeelR = 2 + uniq.length;
  return {
    outline: pts, edges: { front: [0, 1], toplineR: [1, iHeelR], back: [iHeelR, iHeelR + 1], toplineL: [iHeelR + 1, 0] },
    corners: [iHeelR + 1, iHeelR, 1, 0], chart: 'footL',
    anchor: { piece: [0, L], chart: { u: 0.5, v: v0 } },
    ease_cm: d.ease_cm ?? 0.6,
  };
}


// NO HEEL BLOCK, and the reason is worth keeping. A heel has to stand off further than the sole
// it sits under, and the only lever for that here is the piece's own `ease` — so it would be a
// second sole at `thickness + heel_cm`. Built and measured, it does not work: a piece placed by
// this chart maps a centimetre of FLAT arc onto a centimetre of SKIN arc and then pushes it out,
// so a section of radius r offset by e stretches by (r + e) / r. The heel's rings are small
// (22.5 cm around, r 3.6 cm) and a 1.5-4 cm heel is an ease of 2.7-5.2 on top of the sole's own:
// strain 3.60 at heel_cm 1.5, 4.59 at 2.5, 6.11 at 4, against 1.62 with no heel. Rendered, it is
// bulk at the back rather than a lift under it. A heel needs the sole placed in the GROUND PLANE
// instead of on the chart's radial, which is a placement mode pattern-garment.js does not have.
// The sole's own thickness (1.2-1.7 cm) is what lifts a shoe today.

/**
 * BOOT SHAFT — the leg above the ankle, on the leg chart. `height` is a name or centimetres;
 * the shaft drafts to the leg's own girth at each end (the ankle's, and the knee's interpolated)
 * so it closes on a calf instead of running as a straight tube.
 */
function bootShaft(m, d = {}) {
  const g = m.girth, drop = m.drop ?? {};
  const dKnee = drop.knee ?? 40, dAnkle = drop.ankle ?? 0;
  const names = { ankle: 6, 'mid-calf': Math.max(10, Math.abs(dKnee) * 0.55), knee: Math.max(14, Math.abs(dKnee) * 0.95) };
  const H = typeof d.height === 'number' ? d.height : (names[d.height ?? 'ankle'] ?? names.ankle);
  const ease = d.ease_cm ?? 2;
  const gAnkle = (g.ankle ?? g.bottom ?? 22) + ease;
  const gKnee = (g.knee ?? gAnkle) + ease;
  const span = Math.abs(dKnee - dAnkle) || 40;
  const at = (h) => { const f = Math.max(0, Math.min(1, h / span)); return r2((gAnkle + (gKnee - gAnkle) * f) / 2 * (d.flare ?? 1)); };
  const mid = H > 8 ? [[at(H / 2), r2(H / 2)]] : [];
  const w0 = at(0), w1 = at(H);
  const pts = [[-w0, 0], [w0, 0], ...mid.map(([w, y]) => [w, y]), [w1, r2(H)], [-w1, r2(H)], ...mid.map(([w, y]) => [-w, y]).reverse()];
  const iTopR = 2 + mid.length;
  return {
    outline: pts, edges: { hem: [0, 1], sideR: [1, iTopR], top: [iTopR, iTopR + 1], sideL: [iTopR + 1, 0] },
    corners: [iTopR + 1, iTopR, 1, 0], chart: 'legL',
    anchor: { piece: [0, 0], chart: { u: 'cf', v: 'ankle' } },       // the hem sits at the ankle, the shaft rises
    ease_cm: ease / 4,
  };
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
    case 'sleeve': return sleeve(measures, dials);
    case 'skirt-front': return skirt('front', measures, dials);
    case 'skirt-back': return skirt('back', measures, dials);
    case 'trouser-front': return trouser('front', measures, dials);
    case 'trouser-back': return trouser('back', measures, dials);
    case 'shoe-sole': return shoeSole(measures, dials);
    case 'shoe-upper': return shoeUpper(measures, dials);
    case 'boot-shaft': return bootShaft(measures, dials);
    default: throw new Error(`draftSloper: '${kind}' is not one of ${SLOPER_KINDS.join(' | ')}`);
  }
}

// The chart a block sits on when the piece does not say.
export function sloperChart(kind) {
  if (kind === 'sleeve') return 'armL';
  if (kind === 'boot-shaft') return 'legL';
  if (/^shoe-/.test(kind)) return 'footL';
  return 'trunk';
}

// Whole garments (a shift dress, an A-line skirt, trousers) are REPERTOIRE, not capability: they
// live in the recipe book's wardrobe chapter as `garment.json` entries — dials over these blocks —
// and reach `create_figure` by name through `outfit`. Core carries the blocks only.
