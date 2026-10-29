/**
 * HAIR SCORE — how a depiction of a groom (epidermis/hair-depict.js: the grass hat's blades and its coat) reads, measured
 * on the head it grows on, orthographic, from the front, the lateral, the back and the top (the depiction solver's
 * machine gate; a human's look is the contact sheet's):
 *   coverage    the hair-bearing scalp a view would see bare, covered by blades or coat (1: no bald spot)
 *   bladeCover  the same by the blades alone (the coat a coat of paint: where it shows, the hair reads painted)
 *   silhouette  the head and its hair's outline against the reference's (the study's strands, `reference`), as IoU
 *   faces       the depiction's cost
 *
 *   rasterize(meshes, view, px, box)           → { depth, id } per pixel (the nearest face's mesh index and face)
 *   scoreHair(chart, D, depiction, opts)       → { coverage, bladeCover, silhouette, faces, views }
 *   strandMesh(strands, width)                 the reference strands as thin strips (a study's hair, for the outline)
 *
 * Pure: the same inputs, the same numbers.
 */
import { dermisAt } from './dermal-map.js';

/** the views: azimuth about the head's vertical (0 the front, +y), elevation (90 from above) */
export const SCORE_VIEWS = Object.freeze({ front: [0, 0], lateral: [90, 0], back: [180, 0], top: [0, 90] });

/** a view's frame: right, up, toward the eye (unit) */
function frameOf([az, el]) {
  const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
  const c = [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
  const r = Math.abs(e) > 1.5 ? [1, 0, 0] : [Math.cos(a), -Math.sin(a), 0];
  const u = [r[1] * c[2] - r[2] * c[1], r[2] * c[0] - r[0] * c[2], r[0] * c[1] - r[1] * c[0]];
  return { r, u, c };
}

/**
 * Meshes (each { vertices, faces }) z-buffered orthographically from `view` into px × px over `box` ({ c, s }: the centre
 * and the side, m): per pixel the nearest face's mesh index (−1 none) and face index.
 */
export function rasterize(meshes, view, px, box) {
  const { r, u, c } = frameOf(SCORE_VIEWS[view] ?? view), depth = new Float32Array(px * px).fill(-Infinity), mesh = new Int16Array(px * px).fill(-1), face = new Int32Array(px * px).fill(-1);
  const P = (p) => { const d = [p[0] - box.c[0], p[1] - box.c[1], p[2] - box.c[2]]; return [((d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / box.s + 0.5) * px, (0.5 - (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / box.s) * px, d[0] * c[0] + d[1] * c[1] + d[2] * c[2]]; };
  meshes.forEach((M, mi) => {
    const Q = M.vertices.map(P);
    M.faces.forEach((t, fi) => {
      const [A, B, C] = t.map((v) => Q[v]), area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]); if (!area) return;
      const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(px - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
      const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(px - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const qx = x + 0.5, qy = y + 0.5, w0 = ((B[0] - qx) * (C[1] - qy) - (B[1] - qy) * (C[0] - qx)) / area, w1 = ((C[0] - qx) * (A[1] - qy) - (C[1] - qy) * (A[0] - qx)) / area, w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const d = w0 * A[2] + w1 * B[2] + w2 * C[2], o = y * px + x;
        if (d > depth[o]) { depth[o] = d; mesh[o] = mi; face[o] = fi; }
      }
    });
  });
  return { depth, mesh, face, px };
}

/** strands (each { pts }) as thin strips `width` m wide, square to the view-independent across (for an outline only) */
export function strandMesh(strands, width) {
  const vertices = [], faces = [];
  for (const st of strands) {
    const P = st.pts; if (P.length < 2) continue;
    for (let i = 0; i + 1 < P.length; i++) {
      const a = P[i], b = P[i + 1], t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...t) || 1, s = [-t[1] / l, t[0] / l, 0];
      const sl = Math.hypot(...s) > 0.2 ? s.map((v) => (v * width) / 2 / Math.hypot(...s)) : [width / 2, 0, 0], k = vertices.length;
      vertices.push(a.map((v, q) => v + sl[q]), a.map((v, q) => v - sl[q]), b.map((v, q) => v + sl[q]), b.map((v, q) => v - sl[q]), a.map((v, q) => v + [0, 0, width / 2][q]), b.map((v, q) => v - [0, 0, width / 2][q]));
      faces.push([k, k + 1, k + 3], [k, k + 3, k + 2], [k + 4, k, k + 5], [k + 4, k + 1, k + 5]);
    }
  }
  return { vertices, faces };
}

/**
 * The depiction's score on its head: `chart` the head's (its faces the skin's), `D` its dermis (which skin grows scalp
 * hair), `depiction` { strips, cap } (hair-depict.js depictHair), `reference` an optional strand mesh (strandMesh) for the
 * silhouette; `px` a view's pixels.
 */
export function scoreHair(chart, D, depiction, { reference = null, px = 160, views = Object.keys(SCORE_VIEWS) } = {}) {
  const head = { vertices: chart.vertices, faces: chart.faces };
  const grows = chart.samples.map((s) => { if (!s || s.feature) return false; const H = dermisAt(s, D, { detail: false }).hair; return H.tract === 'scalp' && H.kind === 'terminal'; });
  const scalpFace = chart.faces.map((t) => t.every((v) => grows[v]));
  const all = [head, ...(depiction.strips ? [depiction.strips] : []), ...(depiction.cap ? [depiction.cap] : [])];
  const lo = [0, 1, 2].map((k) => Math.min(...all.flatMap((M) => M.vertices.map((p) => p[k])))), hi = [0, 1, 2].map((k) => Math.max(...all.flatMap((M) => M.vertices.map((p) => p[k]))));
  const box = { c: lo.map((v, k) => (v + hi[k]) / 2), s: 1.08 * Math.max(...hi.map((v, k) => v - lo[k])) };
  let bare = 0, covered = 0, byBlades = 0, inter = 0, union = 0;
  const out = {};
  for (const view of views) {
    const H = rasterize([head], view, px, box), W = rasterize(all, view, px, box), B = depiction.strips ? rasterize([head, depiction.strips], view, px, box) : null;
    const R = reference ? rasterize([head, reference], view, px, box) : null;
    let vb = 0, vc = 0, vbl = 0;
    for (let o = 0; o < px * px; o++) {
      if (H.mesh[o] === 0 && scalpFace[H.face[o]]) { vb++; if (W.mesh[o] > 0) vc++; if (B && B.mesh[o] > 0) vbl++; }
      if (R) { const a = W.mesh[o] >= 0, b = R.mesh[o] >= 0; if (a && b) inter++; if (a || b) union++; }
    }
    bare += vb; covered += vc; byBlades += vbl;
    out[view] = { scalp: vb, coverage: vb ? vc / vb : 1, bladeCover: vb ? vbl / vb : 1 };
  }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return { coverage: r3(bare ? covered / bare : 1), bladeCover: r3(bare ? byBlades / bare : 1), silhouette: reference ? r3(union ? inter / union : 1) : null, faces: (depiction.strips?.faces.length ?? 0) + (depiction.cap?.faces.length ?? 0), views: out, box };
}

/**
 * THE OVERLAP PRINCIPLE (the lock hair's, hair-locks.js; the operator's, 2026-10-28): from every view, the hair-bearing
 * scalp shows the hair's MASS, never the scalp. What is under the locks (the shell, the skin) may show only in a SPLIT: a
 * gap between locks no wider than `split` (m), or the groom's part line. Each scalp pixel a view sees is the mass's, a
 * split's (the shell or the skin with the mass within `split` on both sides of it), or OPEN (the scalp shown: a wider gap,
 * or an edge the mass lies on one side of only, as a hairline's band); `exempt(p)` a point the principle passes over
 * (stubble, where the shell is the hair). Every section the turntable sees counts. Measured orthographically as scoreHair
 * is; a machine gate, advisory.
 *
 *   overlapHair(chart, D, { mass, under }, { split, px, views, exempt, partOf }) → { open, split, mass, passes, worst, views, openAt }
 */
export const OVERLAP = Object.freeze({ split: 0.004, open: 0.01, px: 128 });
export function overlapHair(chart, D, { mass, under = [] }, { S = null, split = OVERLAP.split, px = OVERLAP.px, views = Object.keys(SCORE_VIEWS), exempt = null, partOf = null, maps = false } = {}) {
  const head = { vertices: chart.vertices, faces: chart.faces };
  const grows = chart.samples.map((s, i) => { if (!s || s.feature) return false; const H = dermisAt(s, D, { detail: false }).hair; return H.tract === 'scalp' && H.kind === 'terminal' && !(partOf && partOf(s)) && !(exempt && exempt(chart.vertices[i])); });
  const scalpFace = chart.faces.map((t) => t.every((v) => grows[v]));
  const layers = [head, ...(mass ? [mass] : []), ...under.filter(Boolean)];
  const lo = [0, 1, 2].map((k) => Math.min(...layers.flatMap((M) => M.vertices.map((p) => p[k])))), hi = [0, 1, 2].map((k) => Math.max(...layers.flatMap((M) => M.vertices.map((p) => p[k]))));
  const box = { c: lo.map((v, k) => (v + hi[k]) / 2), s: 1.08 * Math.max(...hi.map((v, k) => v - lo[k])) };
  const reach = Math.max(1, Math.round((split / box.s) * px));
  let seen = 0, open = 0, inSplit = 0, byMass = 0;
  const out = {}, openFaces = new Set(), pictures = maps ? {} : null;
  for (const view of views) {
    const H = rasterize([head], view, px, box), W = rasterize(layers, view, px, box);
    // (a SPLIT: the mass within `reach` pixels on both sides of it, along one of four lines; an edge with mass on one
    // side only, a hairline's band, is open)
    const isMass = (x, y) => x >= 0 && y >= 0 && x < px && y < px && W.mesh[y * px + x] === 1;
    const sees = (x, y, dx, dy) => { for (let k = 1; k <= reach; k++) if (isMass(x + dx * k, y + dy * k)) return true; return false; };
    const between = (o) => { const x = o % px, y = (o - x) / px; return [[1, 0], [0, 1], [1, 1], [1, -1]].some(([dx, dy]) => sees(x, y, dx, dy) && sees(x, y, -dx, -dy)); };
    let vs = 0, vo = 0, vsp = 0, vm = 0;
    const pic = maps ? new Uint8Array(px * px) : null;
    for (let o = 0; o < px * px; o++) {
      if (!(H.mesh[o] === 0 && scalpFace[H.face[o]])) continue;
      vs++;
      if (W.mesh[o] === 1) vm++; else if (between(o)) { vsp++; if (pic) pic[o] = 2; } else { vo++; openFaces.add(H.face[o]); if (pic) pic[o] = 3; }
    }
    seen += vs; open += vo; inSplit += vsp; byMass += vm;
    if (pic) { for (let o = 0; o < px * px; o++) if (!pic[o]) pic[o] = W.mesh[o] === 1 ? 1 : W.mesh[o] >= 0 ? 4 : 0; pictures[String(view)] = pic; }
    out[String(view)] = { scalp: vs, open: vs ? vo / vs : 0, split: vs ? vsp / vs : 0 };
  }
  const r3 = (v) => Math.round(v * 1000) / 1000, o = seen ? open / seen : 0;
  return { open: r3(o), split: r3(seen ? inSplit / seen : 0), mass: r3(seen ? byMass / seen : 1), passes: o <= OVERLAP.open, worst: r3(Math.max(0, ...Object.values(out).map((v) => v.open))), views: out,
    // (where the scalp shows: the open faces' middles, for whoever fills them)
    // (`maps`: each view's pixels, 0 nothing, 1 the mass, 2 a split, 3 open, 4 the rest: what a sheet shows)
    ...(pictures ? { maps: pictures, px } : {}),
    openAt: [...openFaces].sort((a, b) => a - b).map((f) => [0, 1, 2].map((k) => chart.faces[f].reduce((a, v) => a + chart.vertices[v][k], 0) / 3)) };
}
