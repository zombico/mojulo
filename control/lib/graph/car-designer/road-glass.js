/**
 * THE GLASSHOUSE in the form render (road-form.js): a realistic loft's glass set in its frames and parted by its pillars.
 * The loft draws the side glass as one band from the screen to the rear glass, each pane meeting the paint edge to edge;
 * a car's glass is panes, pillars between them, a rubber frame round each. Read from the faces' own edges, so it holds
 * for any loft:
 *
 *   panes     each side's glass parted along its length into panes about a door's length each (a sedan's two, a short
 *             cab's one, a van's several), a pillar between them: black, as the road's door pillars are (in paint on a
 *             classic three-box)
 *   pillars   where two panes meet at a turn (the screen against the side glass, the rear glass against it), the joint
 *             is a pillar in the body's paint: the A and C pillars
 *   frames    where glass meets paint (the roof's edge, the belt, the bonnet, the boot lid), a strip of the frame:
 *             black rubber, or chrome on a classic three-box. The roof's drip line, the belt's trim, the screen's
 *             border
 *
 *   glasshouse(faces, { body, chrome?, cargo? }) → the faces with the glass parted, framed and pillared (the new strips are
 *                                          form faces: part `glass.frame` | `pillar`, their materials and normals the
 *                                          glass's own plane's)
 *     body     the body's paint colour (the A and C pillars are painted)
 *     chrome   the frames in bright metal and the door pillars in paint (a classic three-box's)
 *     cargo    a cargo van: its glass is its cab doors' alone, its side behind them a panel of the body
 *
 * Vehicle space (+y forward, x across, z up), metres. Pure and deterministic.
 */

export const GLASSHOUSE = Object.freeze({
  pane: 1.15,        // a pane's length about (m): a side's glass is parted into round(span / pane) panes
  pillar: 0.085,     // a door pillar's width (m)
  frame: 0.03,       // a frame's width where glass meets paint (m)
  aPillar: 0.05,     // each side of a turning joint between panes (m): the A and C pillars, twice this
  turn: Math.cos((35 * Math.PI) / 180),   // two panes meeting at more than this turn are a pillar's two sides
});
const RUBBER = '#141518', CHROME = '#c9ccd0', PILLAR_BLACK = '#17191c';

const key = (p) => `${p[0].toFixed(5)},${p[1].toFixed(5)},${p[2].toFixed(5)}`;
const ekey = (a, b) => { const A = key(a), B = key(b); return A < B ? `${A}|${B}` : `${B}|${A}`; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
const like = (f, corners, extra) => ({ ...f, corners, ...extra });

/** A polygon cut by the plane where coordinate `axis` (0 x, 1 y, 2 z) is `c`: its part below and its part above (null
 *  where none), the cut's points shared exactly, so the two parts and a strip cut between two planes meet edge to edge. */
export function cutPlane(corners, axis, c) {
  const lo = [], hi = [];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i], b = corners[(i + 1) % corners.length], da = a[axis] - c, db = b[axis] - c;
    if (da <= 0) lo.push(a);
    if (da >= 0) hi.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const p = lerp(a, b, da / (da - db)); p[axis] = c; lo.push(p); hi.push(p); }
  }
  return [lo, hi].map((q) => (q.length >= 3 ? q : null));
}
const cutY = (corners, c) => cutPlane(corners, 1, c);

// the side glass parted into panes: each side's span cut at its pane joints, a door pillar between neighbours
function parted(faces, { chrome, body, cargo = false }) {
  // (a door's glass, a bus's, is its own pane: the window glass alone is parted)
  const out = [], side = (f) => material(f) === 'glass' && f.part === 'glass' && Math.abs(f.outNormal[0]) > 0.6;
  for (const sx of [-1, 1]) {
    const S = faces.filter((f) => side(f) && Math.sign(f.outNormal[0]) === sx);
    if (!S.length) continue;
    const ys = S.flatMap((f) => f.corners.map((p) => p[1]));
    out.push(...paneJoints(Math.min(...ys), Math.max(...ys)).map((y, i) => [sx, y, i === 0]));
  }
  if (!out.length) return faces;
  const half = GLASSHOUSE.pillar / 2, pillarOf = (f, corners) => like(f, corners, { part: 'pillar', material: chrome ? 'paint' : 'carbon', albedo: chrome ? body : PILLAR_BLACK });
  return faces.flatMap((f) => {
    if (!side(f)) return [f];
    let pieces = [{ corners: f.corners, glass: true }];
    for (const [sx, y] of out) {
      if (Math.sign(f.outNormal[0]) !== sx) continue;
      pieces = pieces.flatMap((p) => {
        if (!p.glass) return [p];
        const [behind, rest] = cutY(p.corners, y - half);
        const [mid, ahead] = rest ? cutY(rest, y + half) : [null, null];
        return [behind && { corners: behind, glass: true }, mid && { corners: mid, glass: false }, ahead && { corners: ahead, glass: true }].filter(Boolean);
      });
    }
    // (a cargo van's glass is its cab doors' alone: behind their joint, its side is a panel of the body)
    const cab = out.find(([sx, , first]) => first && sx === Math.sign(f.outNormal[0]));
    const panel = (p) => cargo && cab && p.corners.reduce((a, q) => a + q[1], 0) / p.corners.length < cab[1];
    return pieces.map((p) => (panel(p) ? like(f, p.corners, { part: 'body', material: 'paint', albedo: body }) : p.glass ? like(f, p.corners) : pillarOf(f, p.corners)));
  });
}
const material = (f) => f.material;

/** Where a side's glass from y0 (its rear) to y1 (its front) is parted: about a door's length a pane, from the front, the
 *  front pane a touch the longer (the front door is). The panels read the same joints for the doors' shut lines. */
export function paneJoints(y0, y1) {
  const n = Math.max(1, Math.round((y1 - y0) / GLASSHOUSE.pane));
  return Array.from({ length: n - 1 }, (_, i) => y1 - (y1 - y0) * ((i + 1) / n) * (i === 0 ? 0.96 : 1));
}

// an edge of a pane inset by `w`: its two ends moved along the pane's sides that meet them, the strip between returned
function inset(corners, i, w) {
  const n = corners.length, a = corners[i], b = corners[(i + 1) % n], pa = corners[(i - 1 + n) % n], nb = corners[(i + 2) % n];
  const ta = Math.min(0.45, w / (len(a, pa) || 1)), tb = Math.min(0.45, w / (len(b, nb) || 1));
  const a2 = lerp(a, pa, ta), b2 = lerp(b, nb, tb), next = corners.slice();
  next[i] = a2; next[(i + 1) % n] = b2;
  return { strip: [a, b, b2, a2], next };
}

/** The glasshouse: the side glass parted into panes, every pane framed where it meets paint and pillared where it
 *  turns against another pane. Faces that are not glass pass as they are. */
export function glasshouse(faces, { body = '#8a8f96', chrome = false, cargo = false } = {}) {
  const F = parted(faces, { chrome, body, cargo });
  // who borders each edge: a pane's edge against paint is framed, against a pane at a turn is a pillar's side
  const by = new Map();
  F.forEach((f, i) => f.corners.forEach((p, j) => { const k = ekey(p, f.corners[(j + 1) % f.corners.length]); if (!by.has(k)) by.set(k, []); by.get(k).push(i); }));
  const frame = chrome ? { material: 'alloy', albedo: CHROME } : { material: 'seal', albedo: RUBBER };
  return F.flatMap((f, i) => {
    if (f.material !== 'glass') return [f];
    let corners = f.corners.slice();
    const strips = [];
    // (the edges read from the pane as it was, each inset in turn on the pane as it now is)
    const edges = f.corners.map((p, j) => {
      const others = (by.get(ekey(p, f.corners[(j + 1) % f.corners.length])) ?? []).filter((o) => o !== i).map((o) => F[o]);
      if (!others.length) return null;
      if (others.every((o) => o.material === 'glass')) return others.some((o) => dot(o.outNormal, f.outNormal) < GLASSHOUSE.turn) ? 'pillar' : null;
      return others.some((o) => o.material === 'paint' || o.part === 'pillar') ? 'frame' : null;
    });
    edges.forEach((kind, j) => {
      if (!kind) return;
      const { strip, next } = inset(corners, j, kind === 'pillar' ? GLASSHOUSE.aPillar : GLASSHOUSE.frame);
      corners = next;
      strips.push(kind === 'pillar' ? like(f, strip, { part: 'pillar', material: 'paint', albedo: body }) : like(f, strip, { part: 'glass.frame', ...frame }));
    });
    return [like(f, corners), ...strips];
  });
}
