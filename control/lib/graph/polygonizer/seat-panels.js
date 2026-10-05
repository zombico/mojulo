/**
 * seat-panels — the lines on the structured core's seat that whole faces cannot draw: the thong's back (a V narrowing
 * into the cleft, the string round the hip), the speedo's leg line, the swimsuit's crease and the bare seat's cleft.
 * Each is a region cut out of the pelvis's or the thigh's faces by scalars on the REST mesh: a corner's values,
 * interpolated across the face, so a line crosses faces at any angle and as thin as it needs (painted by whole faces on
 * the twelve-point ring a V is a block and a string a band the ring's height). A region is a union of convex sets, a
 * set a list of planes (a value per corner, inside at or under 0 on every one).
 *
 * The swimsuit's regions are the garment (`swim`): every light draws them, the studio's Lambert faces
 * (station-loft-faces.js) as well as the character light's pieces (station-loft-shade.js). The crease and the cleft
 * are shadow (`crease`, `cleft`): the character light's tones alone.
 *
 * Read off the mesh itself, as the shade rules are: the structured core (a `pelvis` part) whose cleft is cut `depth`
 * or deeper; a swimsuit by its `Swim` faces; a thong by a bare seat (skin under the seat's fullest height, behind), a
 * speedo by a covered one. Pure, deterministic.
 */

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const partOf = (mesh, fi) => mesh.provenance[mesh.faces[fi][0]].part;

/** THE SEAT'S CLEFT: a wedge down the cleft, `w` (m) either side of the midline behind the pelvis's axis, from the
 * crotch up to `top` of the crotch-to-fullest span over the seat's fullest height, only where the cleft is cut `depth`
 * (m) or deeper. On a bare seat with no swimsuit it is the second shadow tone (the anime 2影, kept for the deepest
 * recess: the shade darkened by `tone`); on the swimsuit, its crease (`w`, up to `crease` of the span) in its shade
 * darkened by `tone`. The ink draws the silhouette only and from behind the back is one tone, so without it the two
 * halves read as one */
export const SEAT_CLEFT = Object.freeze({ w: 0.009, top: 0.95, crease: 0.45, tone: 0.72, depth: 0.015 });
/** THE THONG'S BACK on a bare seat: a V panel from `vee` (m) either side under the string to the cleft's `w` at the
 * crotch, its sides straight; the string `string` (m) tall, its centre `back` of the crotch-to-fullest span over the
 * seat's fullest height at the back, rising toward the hip to meet the front panel's top (the highest swimsuit corner in
 * front of the axis) at the side. The string as a ring band was the band's height (~5 cm: a waistband, the critic) */
export const THONG = Object.freeze({ vee: 0.075, string: 0.012, back: 0.8 });
/** THE SPEEDO'S LEG LINE on the thigh's top (the lower seat is the thighs' backs, so a speedo ending on the pelvis's
 * rings showed the thighs' skin through its lower edge in notches): the swimsuit above a line round each thigh at
 * `fold` of the crotch-to-fullest span at the back (the seat's lower curve), rising to `side` at the outer side and
 * `front` at the front (the groin's diagonal), so the back panel's lower edge is rounded, not a V */
export const SPEEDO_LEG = Object.freeze({ fold: 0.4, side: 1, front: 0.65 });

/** The seat's panels on a mesh (its REST positions), or null (no structured core, or a cleft shallower than the rule):
 * `at(fi, group)` → `{ kind: 'swim' | 'crease' | 'cleft', sets }` for a face the region can touch (its planes' corner
 * values), else null */
export function seatPanels(rest) {
  if (!rest?.parts?.pelvis) return null;
  const V = rest.vertices, pv = new Set();
  rest.faces.forEach((t, fi) => { if (partOf(rest, fi) === 'pelvis') t.forEach((v) => pv.add(v)); });
  if (!pv.size) return null;
  // the pelvis's axis, the crotch, the seat's fullest (its backmost point) and the midline's back
  let ay = 0, zc = Infinity, yb = Infinity, zm = 0, ym = Infinity;
  for (const v of pv) { const p = V[v]; ay += p[1]; zc = Math.min(zc, p[2]); if (p[1] < yb) { yb = p[1]; zm = p[2]; } if (Math.abs(p[0]) < 1e-4) ym = Math.min(ym, p[1]); }
  ay /= pv.size; const span = zm - zc;
  if (!(span > 0) || !(ym - yb >= SEAT_CLEFT.depth)) return null;
  const swim = rest.groups.includes('Swim');
  // the seat bare (skin under its fullest height, behind)
  let bare = false; rest.faces.forEach((t, fi) => { if (!bare && partOf(rest, fi) === 'pelvis' && rest.groups[fi] === 'Skin' && t.every((v) => V[v][2] < zm && V[v][1] < ay)) bare = true; });
  const C = SEAT_CLEFT, behind = (vi) => V[vi][1] - ay;
  const wedge = (zTop, w = () => C.w) => [(vi) => V[vi][0] - w(vi), (vi) => -V[vi][0] - w(vi), (vi) => V[vi][2] - zTop, (vi) => zc - V[vi][2], behind];
  const sets = {};
  if (swim && bare) {
    // the thong: the front panel's top, the string's centre at the back and at the hip, the V under it
    let zTop = -Infinity; rest.faces.forEach((t, fi) => { if (partOf(rest, fi) === 'pelvis' && rest.groups[fi] === 'Swim') for (const v of t) if (V[v][1] > ay) zTop = Math.max(zTop, V[v][2]); });
    const hs = THONG.string / 2, zB = zm + THONG.back * span, zH = Number.isFinite(zTop) ? Math.max(zB, zTop - hs) : zB;
    const zs = (vi) => { const p = V[vi], c = Math.max(0, (ay - p[1]) / (Math.hypot(p[0], p[1] - ay) || 1)); return zH - (zH - zB) * c * c; };
    const vee = (vi) => C.w + (THONG.vee - C.w) * clamp01((V[vi][2] - zc) / (zB - zc));
    sets.pelvisSkin = { kind: 'swim', fns: [wedge(zB, vee), [(vi) => zs(vi) - hs - V[vi][2], (vi) => V[vi][2] - zs(vi) - hs]] };
  } else if (!swim && bare) sets.pelvisSkin = { kind: 'cleft', fns: [wedge(zm + C.top * span)] };
  if (swim) sets.pelvisSwim = { kind: 'crease', fns: [wedge(zm + C.crease * span)] };
  if (swim && !bare) {
    // the speedo's leg line: each thigh's axis (its rings above the crotch), the line's height by the turn about it
    const axes = new Map();
    rest.faces.forEach((t, fi) => { const pn = partOf(rest, fi); if (!/^thigh[RL]$/.test(pn)) return; let a = axes.get(pn); if (!a) axes.set(pn, a = { s: new Set() }); for (const v of t) if (V[v][2] >= zc) a.s.add(v); });
    for (const a of axes.values()) { let x = 0, y = 0; for (const v of a.s) { x += V[v][0]; y += V[v][1]; } a.x = x / (a.s.size || 1); a.y = y / (a.s.size || 1); }
    const L = SPEEDO_LEG;
    sets.thighSkin = { kind: 'swim', axes, fns: (a) => [[(vi) => { const p = V[vi], r = Math.hypot(p[0] - a.x, p[1] - a.y) || 1, out = Math.max(0, Math.sign(a.x) * (p[0] - a.x) / r), front = Math.max(0, (p[1] - a.y) / r); return zc + span * (L.fold + (L.side - L.fold) * out + (L.front - L.fold) * front) - p[2]; }]] };
  }
  if (!Object.keys(sets).length) return null;
  return {
    at(fi, group) {
      const pn = partOf(rest, fi), tri = rest.faces[fi];
      let S = null, fns = null;
      if (pn === 'pelvis' && group === 'Skin') S = sets.pelvisSkin; else if (pn === 'pelvis' && group === 'Swim') S = sets.pelvisSwim;
      else if (group === 'Skin' && sets.thighSkin?.axes.has(pn)) S = sets.thighSkin;
      if (!S) return null;
      fns = typeof S.fns === 'function' ? S.fns(S.axes.get(pn)) : S.fns;
      // a set whose plane holds all three corners outside never touches the face
      const live = fns.map((set) => set.map((fn) => tri.map(fn))).filter((set) => set.every((P) => P.some((x) => x <= 0)));
      return live.length ? { kind: S.kind, sets: live } : null;
    },
  };
}

/** A convex polygon `poly` (points `{ w }`: barycentric weights over the face's three corners) cut by every plane of
 * `sets` into convex cells, each `{ ring, inside }` (inside: its centroid under 0 on every plane of some set). `mk(w, a,
 * b)` makes the point where edge a → b crosses a plane (`w` its weights; a weight exactly 0 marks a point on the face's
 * own edge) */
export function clipCells(poly, sets, mk) {
  const at = (w, P) => w[0] * P[0] + w[1] * P[1] + w[2] * P[2];
  let cells = [poly];
  for (const P of sets.flat()) {
    const next = [];
    for (const R of cells) {
      const v = R.map((pt) => at(pt.w, P));
      if (v.every((x) => x <= 0) || v.every((x) => x >= 0)) { next.push(R); continue; }
      const neg = [], pos = [];
      for (let i = 0; i < R.length; i++) {
        const j = (i + 1) % R.length, a = R[i], b = R[j], va = v[i], vb = v[j];
        if (va <= 0) neg.push(a); if (va >= 0) pos.push(a);
        if ((va < 0 && vb > 0) || (va > 0 && vb < 0)) { const t = va / (va - vb), x = mk(a.w.map((wa, k) => (wa === b.w[k] ? wa : wa + (b.w[k] - wa) * t)), a, b); neg.push(x); pos.push(x); }
      }
      if (neg.length >= 3) next.push(neg); if (pos.length >= 3) next.push(pos);
    }
    cells = next;
  }
  return cells.map((R) => { const c = [0, 1, 2].map((k) => R.reduce((s, pt) => s + pt.w[k], 0) / R.length); return { ring: R, inside: sets.some((S) => S.every((P) => at(c, P) <= 0)) }; });
}
