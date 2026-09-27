/**
 * canal-house — the roof and gable of one canal house (a `kind: 'canalhouse'` box, planned by
 * city/canal-city.js). The walls are an ordinary facade box (scene-css3d's cityBox); this adds what
 * makes the house read as a Low Countries canal house: a steep pitched roof whose ridge runs BACK
 * from the water, and a gable wall on the water face in one of the ring's outlines (cornice, neck,
 * bell, spout, step), with a plain triangle to the garden. A double-wide house turns its ridge
 * parallel to the front behind a cornice, as the wide merchant houses do.
 *
 * Every outline is drawn as CONVEX pieces: the World fan-triangulates a clipped quad from its first
 * vertex (face-mesh.js), so a concave clip would smear across its notches. A step gable is literally
 * stacked rectangles; a neck is a body, two claws, a neck and a pediment; a bell is a body, two claws
 * and a convex cap. Each piece is a quad with a `clip: polygon(…)` (u along c0→c1, v along c0→c3),
 * the same device churchBuilding uses for its triangles.
 *
 * Pure: no rng, no Date. `shade(corners, hex)` returns the lit fill (the caller owns the light).
 */

// outlines in the gable's own frame: s across the front 0..1, t up from the eaves 0..1. The roof's
// section at the facade is t = RIDGE_T · (1 − |2s − 1|); every outline covers it (checked in tests).
export const RIDGE_T = 0.8;
const GABLE_PIECES = {
  step: [
    [[0, 0], [1, 0], [1, 0.3], [0, 0.3]],
    [[0.12, 0.3], [0.88, 0.3], [0.88, 0.55], [0.12, 0.55]],
    [[0.24, 0.55], [0.76, 0.55], [0.76, 0.8], [0.24, 0.8]],
    [[0.36, 0.8], [0.64, 0.8], [0.64, 1], [0.36, 1]],
  ],
  neck: [
    [[0, 0], [1, 0], [1, 0.28], [0, 0.28]],
    [[0, 0.28], [0.3, 0.28], [0.3, 0.52]],
    [[0.7, 0.28], [1, 0.28], [0.7, 0.52]],
    [[0.3, 0.28], [0.7, 0.28], [0.7, 0.86], [0.3, 0.86]],
    { trim: true, pts: [[0.25, 0.86], [0.75, 0.86], [0.5, 1]] },
  ],
  bell: [
    [[0, 0], [1, 0], [1, 0.24], [0, 0.24]],
    [[0, 0.24], [0.2, 0.24], [0.2, 0.44]],
    [[0.8, 0.24], [1, 0.24], [0.8, 0.44]],
    [[0.2, 0.24], [0.8, 0.24], [0.8, 0.6], [0.75, 0.8], [0.63, 0.94], [0.5, 1], [0.37, 0.94], [0.25, 0.8], [0.2, 0.6]],
  ],
  spout: [
    [[0, 0], [1, 0], [0.5, 0.9]],
    [[0.4, 0.62], [0.6, 0.62], [0.6, 1], [0.4, 1]],
  ],
  cornice: [
    [[0, 0], [1, 0], [1, 0.16], [0, 0.16]],
  ],
};
export const CANAL_GABLES = Object.keys(GABLE_PIECES);
// the face each gable outline reaches over the roof section, for the census and the tests
export function gablePieces(type) { return (GABLE_PIECES[type] || GABLE_PIECES.cornice).map((p) => (Array.isArray(p) ? { pts: p } : p)); }

// the house's local frame: the front plane, the across axis (s) and the depth axis (inward)
function frameOf(b) {
  const f = b.face || '-y';
  if (f === '-y' || f === '+y') {
    const front = f === '-y' ? b.y : b.y + b.d, inward = f === '-y' ? 1 : -1;
    return { W: b.w, D: b.d, P: (s, v, z) => [b.x + s, front + inward * v, z], out: [0, -inward, 0] };
  }
  const front = f === '-x' ? b.x : b.x + b.w, inward = f === '-x' ? 1 : -1;
  return { W: b.d, D: b.w, P: (s, v, z) => [front + inward * v, b.y + s, z], out: [-inward, 0, 0] };
}

// a convex polygon (pts in [s, t] of a W × H rectangle at depth v, bottom at z0) → one clipped quad
function piece(P, W, H, v, z0, pts, fill, shade, lift = 0) {
  const s0 = Math.min(...pts.map((p) => p[0])), s1 = Math.max(...pts.map((p) => p[0]));
  const t0 = Math.min(...pts.map((p) => p[1])), t1 = Math.max(...pts.map((p) => p[1]));
  const at = (s, t) => P(s * W, v - lift, z0 + t * H);
  const corners = [at(s0, t0), at(s1, t0), at(s1, t1), at(s0, t1)];
  const face = { corners, fill: shade(corners, fill), doubleSided: true };
  const rect = pts.length === 4 && pts.every(([s, t]) => (s === s0 || s === s1) && (t === t0 || t === t1));
  if (!rect) face.clip = `polygon(${pts.map(([s, t]) => `${(((s - s0) / (s1 - s0)) * 100).toFixed(1)}% ${(((t - t0) / (t1 - t0)) * 100).toFixed(1)}%`).join(', ')})`;
  return face;
}

/**
 * The faces of one canal bridge box (`kind: 'canalbridge'`): a solid brick mass from the water to
 * a humped deck, pierced by one or three elliptical arches, with parapet walls and a stone cap. The
 * side elevations are cut into vertical slices (each a convex trapezoid between the arch or the
 * waterline and the parapet top) so the World's fan triangulation never smears an arch.
 */
export function canalBridgeFaces(b, shade) {
  const alongX = b.axis === 'x', S = alongX ? b.w : b.d, Wd = alongX ? b.d : b.w;
  const P = (s, c, z) => (alongX ? [b.x + s, b.y + c, z] : [b.x + c, b.y + s, z]);
  const deck = (s) => b.deck + b.hump * Math.sin((Math.PI * s) / S);
  const arches = (b.arches || []).map((a) => ({ c: a.at * S, h: a.span / 2, rise: a.rise }));
  const under = (s) => {
    for (const a of arches) { const u = (s - a.c) / a.h; if (Math.abs(u) < 1) return b.water + a.rise * Math.sqrt(1 - u * u); }
    return b.water;
  };
  const cuts = new Set();
  for (let k = 0; k <= 16; k++) cuts.add(+(S * k / 16).toFixed(5));
  for (const a of arches) for (let k = 0; k <= 10; k++) cuts.add(+(a.c - a.h + (2 * a.h * k) / 10).toFixed(5));
  const ss = [...cuts].filter((s) => s >= 0 && s <= S).sort((p, q) => p - q);
  const wall = b.tint || '#6a4638', cap = '#b9ae9a', paving = b.paving || '#8c5d4b', faces = [];
  const t = Math.min(0.14, Wd * 0.08);
  for (let k = 0; k < ss.length - 1; k++) {
    const s0 = ss[k], s1 = ss[k + 1];
    const b0 = under(s0 + 1e-6), b1 = under(s1 - 1e-6), p0 = deck(s0) + b.parapet, p1 = deck(s1) + b.parapet;
    for (const c of [0, Wd]) {
      const zlo = Math.min(b0, b1), zhi = Math.max(p0, p1);
      const corners = [P(s0, c, zlo), P(s1, c, zlo), P(s1, c, zhi), P(s0, c, zhi)];
      const v = (z) => (((z - zlo) / (zhi - zlo)) * 100).toFixed(1);
      faces.push({ corners, fill: shade(corners, wall), doubleSided: true, clip: `polygon(0.0% ${v(b0)}%, 100.0% ${v(b1)}%, 100.0% ${v(p1)}%, 0.0% ${v(p0)}%)` });
    }
    const d0 = deck(s0), d1 = deck(s1);
    const top = [P(s0, t, d0), P(s1, t, d1), P(s1, Wd - t, d1), P(s0, Wd - t, d0)];
    faces.push({ corners: top, fill: shade(top, paving), doubleSided: true });
    for (const [c0, c1] of [[0, t], [Wd - t, Wd]]) {
      const cp = [P(s0, c0, p0), P(s1, c0, p1), P(s1, c1, p1), P(s0, c1, p0)];
      faces.push({ corners: cp, fill: shade(cp, cap), doubleSided: true });
    }
    if (b0 > b.water + 1e-6 || b1 > b.water + 1e-6) {   // the arch's vault, seen from the water
      const vault = [P(s0, 0, b0), P(s1, 0, b1), P(s1, Wd, b1), P(s0, Wd, b0)];
      faces.push({ corners: vault, fill: shade(vault, wall), doubleSided: true });
    }
  }
  return faces;
}

/** The roof + gable faces of one canal house box. */
export function canalHouseFaces(b, shade) {
  const { W, D, P } = frameOf(b);
  const z1 = b.z1, gh = b.gableH, wall = b.facade?.glass || '#7c4635', trim = b.trim || '#e9e2cf', roof = b.roofTint || '#3f4247';
  const faces = [];
  if (b.ridge === 'parallel') {
    // wide house: the ridge runs along the front, halfway back; a cornice parapet on the front
    const hr = b.ridgeH, vm = D / 2;
    for (const [va, vb] of [[0, vm], [D, vm]]) {
      const c = [P(0, va, z1), P(W, va, z1), P(W, vb, z1 + hr), P(0, vb, z1 + hr)];
      faces.push({ corners: c, fill: shade(c, roof), doubleSided: true });
    }
    for (const s of [0, W]) {   // the party-wall triangles under the ridge ends
      const c = [P(s, 0, z1), P(s, D, z1), P(s, D, z1 + hr), P(s, 0, z1 + hr)];
      faces.push({ corners: c, fill: shade(c, wall), doubleSided: true, clip: 'polygon(0% 0%, 100% 0%, 50% 100%)' });
    }
    faces.push(piece(P, W, gh, 0, z1, [[0, 0], [1, 0], [1, 1], [0, 1]], wall, shade));
    faces.push(piece(P, W, 0.07, 0, z1 + gh - 0.07, [[0, 0], [1, 0], [1, 1], [0, 1]], trim, shade, 0.02));   // the white cornice line
    return faces;
  }
  // ridge back from the water: two slopes from the eaves to the ridge line at the centre
  const hr = b.ridgeH;
  for (const s of [0, W]) {
    const c = [P(s, 0, z1), P(s, D, z1), P(W / 2, D, z1 + hr), P(W / 2, 0, z1 + hr)];
    faces.push({ corners: c, fill: shade(c, roof), doubleSided: true });
  }
  // the garden gable: the roof's own triangle
  faces.push(piece(P, W, hr, D, z1, [[0, 0], [1, 0], [0.5, 1]], wall, shade));
  // the water gable: the outline's pieces, trimmed pieces in the stone colour
  for (const p of gablePieces(b.gable)) faces.push(piece(P, W, gh, 0, z1, p.pts, p.trim ? trim : wall, shade));
  if (b.gable === 'cornice') faces.push(piece(P, W, 0.07, 0, z1 + gh * 0.16 - 0.07, [[0, 0], [1, 0], [1, 1], [0, 1]], trim, shade, 0.02));
  else {
    // the attic window and the loft door under the hoisting beam, a hair proud of the gable
    const win = b.attic || '#23282b';
    faces.push(piece(P, W, gh, 0, z1, [[0.4, 0.2], [0.6, 0.2], [0.6, 0.42], [0.4, 0.42]], win, shade, 0.012));
    if (b.gable !== 'step' || W > 1.7) faces.push(piece(P, W, gh, 0, z1, [[0.43, 0.56], [0.57, 0.56], [0.57, 0.74], [0.43, 0.74]], win, shade, 0.012));
  }
  return faces;
}
