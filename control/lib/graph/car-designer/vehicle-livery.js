/**
 * A SUPERCAR'S LIVERY: its paint as any colour, and a pattern cut into its painted panels.
 *
 *   paintHex(paint)                               a name (PAINTS) or '#rrggbb' → '#rrggbb'
 *   liveryOf(livery, paint)                       → { pattern, secondary } checked, the secondary defaulted
 *   applyLivery(faces, { paint, livery, frame })  → the faces cut at the pattern's planes and painted
 *
 * Patterns:
 *   mono      one colour (the default: nothing is cut)
 *   stripes   twin stripes either side of the centre line, over every upward-facing painted face and the fascias
 *   split     the painted body below the waist in the secondary
 *
 * Only the faces the pattern can paint are cut (paint faces, by part and by their fill being the paint; for stripes,
 * those facing up and the fascias), at the pattern's planes: an edge's cut point is computed from its endpoints in
 * sorted order, so two cut faces sharing the edge share the point. A cut piece is coloured by which side its centroid
 * falls. Cutting every crossing face (glass, seals, the underbody) would keep the mesh fully conforming but costs half
 * as much again; the T-vertices this leaves lie on a painted edge's straight line. Painting whole faces by their
 * centroid instead costs nothing but merges twin stripes at the game quality and leaves teeth round the arches. Pieces
 * of more than four corners are fanned into quads and a triangle. Pure, no dice.
 */
const r4 = (x) => Math.round(x * 1e4) / 1e4;

export const PAINTS = Object.freeze({
  scarlet: '#af2632', obsidian: '#1c2630', pearl: '#cdd4df',
  cobalt: '#1b559a', amber: '#c78928',
});
export const LIVERY_PATTERNS = Object.freeze(['mono', 'stripes', 'split']);
const HEX = /^#[0-9a-f]{6}$/;

export function paintHex(paint) {
  if (typeof paint === 'string' && Object.hasOwn(PAINTS, paint)) return PAINTS[paint];
  if (typeof paint === 'string' && HEX.test(paint.toLowerCase())) return paint.toLowerCase();
  throw new Error(`vehicle-odm: unknown paint '${paint}' (a name: ${Object.keys(PAINTS).join(', ')}; or '#rrggbb')`);
}

// relative lightness, enough to choose a near-white or a near-black against it
const luma = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export function liveryOf(livery, paint) {
  if (livery === undefined || livery === null) return { pattern: 'mono', secondary: null };
  if (typeof livery !== 'object' || Array.isArray(livery)) throw new Error('vehicle-odm: a livery is { pattern, secondary? }');
  for (const k of Object.keys(livery)) if (!['pattern', 'secondary'].includes(k)) throw new Error(`vehicle-odm: a livery's ${k} is not one of pattern, secondary`);
  const pattern = livery.pattern ?? 'mono';
  if (!LIVERY_PATTERNS.includes(pattern)) throw new Error(`vehicle-odm: a livery's pattern is one of ${LIVERY_PATTERNS.join(', ')}`);
  const secondary = livery.secondary !== undefined ? paintHex(livery.secondary) : luma(paintHex(paint)) > 0.45 ? '#1a1d22' : '#eef0f2';
  return { pattern, secondary };
}

const newell = (c) => {
  const n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
  const l = Math.hypot(...n) || 1; return n.map((v) => v / l);
};
const centroid = (c) => [0, 1, 2].map((k) => c.reduce((s, p) => s + p[k], 0) / c.length);
const before = (a, b) => (a[0] - b[0] || a[1] - b[1] || a[2] - b[2]) < 0;
/** Where an edge crosses the plane p[k] = v, from its endpoints in sorted order (the same point from either face). */
function cross(a, b, k, v) {
  const [p, q] = before(a, b) ? [a, b] : [b, a], t = (v - p[k]) / (q[k] - p[k]);
  return p.map((x, i) => (i === k ? v : r4(x + (q[i] - x) * t)));
}
/** A face cut by the plane p[k] = v into the pieces either side (a face it does not cross, whole). */
function cut(f, k, v, eps = 1e-6) {
  const d = f.corners.map((p) => p[k] - v);
  if (d.every((x) => x >= -eps) || d.every((x) => x <= eps)) return [f];
  const lo = [], hi = [];
  f.corners.forEach((p, i) => {
    const j = (i + 1) % f.corners.length, q = f.corners[j];
    if (d[i] <= eps) lo.push(p);
    if (d[i] >= -eps) hi.push(p);
    if ((d[i] < -eps && d[j] > eps) || (d[i] > eps && d[j] < -eps)) { const m = cross(p, q, k, v); lo.push(m); hi.push(m); }
  });
  return [lo, hi].filter((c) => c.length >= 3).map((corners) => ({ ...f, corners }));
}
const fan = (f) => {
  const n = f.corners.length; if (n <= 4) return [f];
  const out = []; for (let i = 1; i + 1 < n; i += 2) out.push({ ...f, corners: (i + 2 < n ? [0, i, i + 1, i + 2] : [0, i, i + 1]).map((j) => f.corners[j]) });
  return out;
};

/** The pattern's planes ([axis, value]) and the test a painted piece takes the secondary by. */
function patternOf(pattern, frame) {
  if (pattern === 'stripes') {
    const g = 0.0175 * frame.W, w = 0.1 * frame.W, edges = [g, g + w];
    const inBand = (c) => Math.abs(c[0]) > g && Math.abs(c[0]) < g + w;
    const eligible = (f) => newell(f.corners)[2] > 0.35 || f.part === 'body.nose' || f.part === 'body.tail';
    return { planes: edges.flatMap((x) => [[0, -x], [0, x]]), eligible, takes: (f, c) => inBand(c) && eligible(f) };
  }
  if (pattern === 'split') {
    const z = frame.groundClearance + 0.3 * (frame.H - frame.groundClearance);
    return { planes: [[2, z]], eligible: () => true, takes: (f, c) => c[2] < z };
  }
  return null;
}

export function applyLivery(faces, { paint, livery, frame, isPaint }) {
  const P = patternOf(livery.pattern, frame);
  if (!P) return faces;
  return faces.flatMap((f) => {
    if (f.fill !== paint || !isPaint(f) || !P.eligible(f)) return [f];
    let pieces = [f];
    for (const [k, v] of P.planes) pieces = pieces.flatMap((q) => cut(q, k, v));
    return pieces.flatMap(fan).map((q) => (P.takes(q, centroid(q.corners)) ? { ...q, fill: livery.secondary } : q));
  });
}
