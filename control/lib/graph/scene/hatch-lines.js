/**
 * hatch-lines — cross-contour HATCHING of soft forms, the black-and-white shading an illustrator puts on a cushion.
 *
 * A soft part (a cushion, a pad; construction/soft.js) has no creases to draw: the wire renderer gives its silhouette
 * and seams and nothing of its crown. Hatching gives the form. Each hatch line is a SLICE of the surface by a plane —
 * so it runs over the form the way an illustrator's cross-contour line does, bending with the crown — and it is kept
 * only where the surface turns from the light:
 *   · tone = mostly the light falling on it (the light over the viewer's left shoulder), partly the cloth's own
 *     lightness, so a dark cloth reads darker all over;
 *   · three families of planes, square to the part's own axes (across its width, along its depth, level with its
 *     thickness), each `spacing` apart on the page, drawn where the tone falls under that family's threshold: a pale
 *     cloth in the light gets none, a turned-away side one family, a dark cloth two or three;
 *   · every piece of a slice is tested against every triangle (the wire renderer's depth test), so what is hidden is
 *     not drawn; pieces chain into polylines, are simplified on the page, and get a slight seeded wobble (`wobble`, page
 *     units) — a hand's line, not a plotter's.
 *
 * Pure and deterministic: same faces, camera and options → same bytes.
 */
import { projectVertices, triangleGrid, visibleAt } from './wire-svg.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

export const HATCH_LEVELS = Object.freeze([0.6, 0.4, 0.2]);

const hash = (a, b, c) => { let n = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

/** Radial-distance then perpendicular-distance simplification of a page polyline. */
function simplify(pts, tol) {
  if (pts.length <= 2) return pts;
  const keep = new Array(pts.length).fill(false); keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop(); const [ax, ay] = pts[i], [bx, by] = pts[j]; const L = Math.hypot(bx - ax, by - ay) || 1e-12;
    let m = -1, md = tol;
    for (let k = i + 1; k < j; k++) { const d = Math.abs((by - ay) * pts[k][0] - (bx - ax) * pts[k][1] + bx * ay - by * ax) / L; if (d > md) { md = d; m = k; } }
    if (m >= 0) { keep[m] = true; stack.push([i, m], [m, j]); }
  }
  return pts.filter((_, k) => keep[k]);
}

/**
 * hatchRuns(source, cam, { groups, spacing, levels, wobble, tol }) → [[[x, y], …], …] page polylines.
 * `source` as wireRuns takes it (weldFaces); `groups`: Map of group id → { axes: [ex, ey, ez] (world unit vectors),
 * lightness (0–1) } — only those groups are hatched, but every triangle hides.
 */
export function hatchRuns(source, cam, { groups, spacing = 1, levels = HATCH_LEVELS, wobble = 0.08, tol = 0.1 } = {}) {
  const V = source.vertices, F = source.faces, G = source.groups || [];
  if (!F.length || !groups || !groups.size) return [];
  const q = projectVertices(V, cam);
  const tris = F.map((f) => [q[f[0]], q[f[1]], q[f[2]]]);
  const grid = triangleGrid(tris);
  // the light over the viewer's left shoulder: right, up and toward the viewer in the camera's frame
  const right = cam.R[0], up = cam.R[1].map((v) => -v), toCam = cam.R[2].map((v) => -v);
  const L = norm([0, 1, 2].map((k) => -0.5 * right[k] + 0.65 * up[k] + 0.55 * toCam[k]));
  const out = [];
  const byGroup = new Map();
  F.forEach((f, j) => { const g = groups.get(G[j]); if (g) { if (!byGroup.has(G[j])) byGroup.set(G[j], []); byGroup.get(G[j]).push(j); } });
  let gi = 0;
  for (const [gid, js] of byGroup) {
    gi++;
    const g = groups.get(gid);
    // page units per world unit at this group's depth: the spacing on the page is `spacing` wherever the part stands
    let c = [0, 0, 0], n = 0; for (const j of js) for (const i of F[j]) { c[0] += V[i][0]; c[1] += V[i][1]; c[2] += V[i][2]; n++; }
    c = c.map((v) => v / n);
    const depth = dot(sub(c, cam.position), cam.R[2]);
    const s = spacing * depth / cam.f;
    // each triangle's tone, its normal turned toward the viewer
    const tone = new Map();
    for (const j of js) {
      const p = F[j].map((i) => V[i]); let N = norm(cross(sub(p[1], p[0]), sub(p[2], p[0])));
      const m = [(p[0][0] + p[1][0] + p[2][0]) / 3, (p[0][1] + p[1][1] + p[2][1]) / 3, (p[0][2] + p[1][2] + p[2][2]) / 3];
      if (dot(N, sub(cam.position, m)) < 0) N = N.map((v) => -v);
      tone.set(j, 0.62 * Math.max(0, dot(N, L)) + 0.38 * g.lightness);
    }
    levels.forEach((th, fam) => {
      const nrm = norm(g.axes[fam % g.axes.length]);
      const phase = (fam * 0.37) % 1;
      // slice: each plane k·s (+ phase) cuts each dark-enough triangle in a segment; key its ends to chain them
      const segs = new Map();                                      // plane k → [{ a, b, ka, kb }]
      const key = (e0, e1) => (e0 < e1 ? `${e0}|${e1}` : `${e1}|${e0}`);
      for (const j of js) {
        if (tone.get(j) >= th) continue;
        const f = F[j]; const d = f.map((i) => dot(V[i], nrm) / s - phase);
        const k0 = Math.ceil(Math.min(...d)), k1 = Math.floor(Math.max(...d));
        for (let k = k0; k <= k1; k++) {
          const hits = [];
          for (let e = 0; e < 3; e++) {
            const a = e, b = (e + 1) % 3; const da = d[a] - k, db = d[b] - k;
            if ((da < 0 && db >= 0) || (da >= 0 && db < 0)) { const t = da / (da - db); hits.push({ p: [0, 1, 2].map((x) => V[f[a]][x] + t * (V[f[b]][x] - V[f[a]][x])), key: key(f[a], f[b]) }); }
          }
          if (hits.length !== 2) continue;
          if (!segs.has(k)) segs.set(k, []);
          segs.get(k).push({ a: hits[0], b: hits[1] });
        }
      }
      // chain each plane's segments through their shared edges, then keep the runs the viewer sees
      for (const k of [...segs.keys()].sort((x, y) => x - y)) {
        const list = segs.get(k); const at = new Map();
        list.forEach((sg, i) => { for (const e of [sg.a.key, sg.b.key]) { if (!at.has(e)) at.set(e, []); at.get(e).push(i); } });
        const used = new Array(list.length).fill(false);
        for (let i0 = 0; i0 < list.length; i0++) {
          if (used[i0]) continue;
          // walk back to an end, then forward
          let i = i0, from = list[i0].a.key, guard = 0;
          for (;;) { const nb = at.get(from).find((x) => x !== i && !used[x]); if (nb === undefined || nb === i0 || guard++ > list.length) break; const o = list[nb]; from = o.a.key === from ? o.b.key : o.a.key; i = nb; }
          const chain = []; let cur = i, enter = from;
          while (cur !== undefined && !used[cur]) {
            used[cur] = true; const sg = list[cur];
            const [p0, p1] = sg.a.key === enter ? [sg.a, sg.b] : [sg.b, sg.a];
            if (!chain.length) chain.push(p0.p); chain.push(p1.p);
            enter = p1.key; cur = (at.get(enter) || []).find((x) => !used[x]);
          }
          // visibility at each point (nudged toward the viewer), split where it is hidden
          const pp = projectVertices(chain.map((p) => { const t = sub(cam.position, p); const l = Math.hypot(...t) || 1; return p.map((v, x) => v + (t[x] / l) * s * 0.02); }), cam);
          let run = [];
          const flush = () => {
            if (run.length > 1) {
              const w = wobble ? run.map(([x, y], m) => { const h = hash(gi * 131 + fam, k, m >> 2); return [x + (h - 0.5) * wobble, y + (hash(gi, k * 7 + fam, m >> 2) - 0.5) * wobble]; }) : run;
              out.push(simplify(w, tol));
            }
            run = [];
          };
          for (const p of pp) { if (visibleAt(p[0], p[1], p[2], grid.at(p[0], p[1]))) run.push([p[0], p[1]]); else flush(); }
          flush();
        }
      }
    });
  }
  return out;
}

/** Polylines → one SVG path element. */
export function hatchPath(lines, { stroke = '#000', width = 0.13 } = {}) {
  if (!lines.length) return '';
  const r2 = (v) => Math.round(v * 100) / 100;
  return `<path d="${lines.map((l) => `M${l.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L')}`).join('')}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
