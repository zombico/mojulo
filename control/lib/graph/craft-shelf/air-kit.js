/**
 * THE AIRCRAFT DETAIL KIT, its skin: what makes an aircraft's skin read as made, laid on the craft's form faces
 * (craft-form.js) along the planes its lines lie on, a ribbon on each face a line crosses, so a seam follows the skin
 * exactly at the cost of a quad a face, and the camo and the wear cut the skin under it after.
 *
 *   frames      an item's frame by its part kind: a TUBE along the craft's long axis (a fuselage, a nacelle, an intake,
 *               a store), its centre and radius read station by station from its own faces; or a PLATE, its span across
 *               a wing's or a tailplane's (x) or up a fin's (z), its chord read span by span from its own faces
 *   panels      the panel lines a skin is riveted in: on a tube its frames round it each `pitch`, denser forward, and its
 *               longerons along it (the spine, the chines, the waterline, the keel); on a plate its ribs across the span
 *               and its spars along it (the front spar, the rear spar); and the access panels, outlined rectangles where
 *               the row says (a gun bay, an avionics bay), each its fasteners round its edge
 *   seams       each line a ribbon a centimetre and a half wide laid a millimetre proud of the skin along the plane the
 *               line lies on, cut from the item's own faces, darker than the paint: the same slot (a livery's cut paints
 *               the base colour and passes a seam by), its albedo the skin's in shadow
 *   fasteners   flush heads round an access panel, set on the skin where a ray from the axis meets it
 *
 *   PANEL_KINDS                                 a part kind → its frame ('tube' | 'wing' | 'fin' | null: none)
 *   itemFrame(faces, frame)                     → a frame: station centres and radii, or chords by span
 *   skinPanels(faces, frame, { pitch?, access?, longerons?, seam? }) → the faces and their seams laid on them
 *   fastenersOn(faces, frame, access)           → flush heads (form faces) round each access panel
 *
 * Craft space: +y the nose, +z up, +x right, metres. Pure and deterministic.
 */
import { tube as tubeOf } from '../car-designer/mil-hull.js';
import { woundTo } from './craft-form.js';

export const PANEL_KINDS = Object.freeze({
  'craft-fuselage': 'tube', 'craft-engine': 'tube', 'craft-intake': 'tube', 'craft-weapon': 'tube',
  'craft-wing': 'wing', 'craft-stabilizer': 'wing', 'craft-fin': 'fin',
});
// the slots a seam is cut in: the skin's paint
const SKIN = Object.freeze(['airPaint', 'airTrim']);
const SEAM_W = 0.0065;
const r6 = (v) => Math.round(v * 1e6) / 1e6 + 0;
const rgb = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16));
const hex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
// (a coordinate's least and greatest over many points: a loop, a spread overflows the stack on a big hull)
const span = (P, k) => { let lo = Infinity, hi = -Infinity; for (const p of P) { if (p[k] < lo) lo = p[k]; if (p[k] > hi) hi = p[k]; } return [lo, hi]; };
const centre = (P) => [0, 1, 2].map((k) => P.reduce((s, q) => s + q[k], 0) / P.length);

/** An item's frame: a tube's centre and radius station by station; a plate's chord span by span (its leading and
 *  trailing edges), read from its own faces. */
export function itemFrame(faces, frame) {
  if (!frame) return null;
  const pts = faces.flatMap((f) => f.corners);
  if (frame === 'tube') {
    const [y0, y1] = span(pts, 1), n = Math.max(4, Math.ceil((y1 - y0) / 0.25));
    const bins = Array.from({ length: n + 1 }, () => ({ x: [Infinity, -Infinity], z: [Infinity, -Infinity] }));
    for (const p of pts) { const b = bins[Math.round(((p[1] - y0) / (y1 - y0 || 1)) * n)]; b.x = [Math.min(b.x[0], p[0]), Math.max(b.x[1], p[0])]; b.z = [Math.min(b.z[0], p[2]), Math.max(b.z[1], p[2])]; }
    // (a station with no corner borrows its neighbour's)
    for (let i = 0; i <= n; i++) if (!Number.isFinite(bins[i].x[0])) bins[i] = { ...(bins[i - 1] ?? bins.find((b) => Number.isFinite(b.x[0]))) };
    const st = bins.map((b, i) => ({ y: y0 + ((y1 - y0) * i) / n, cx: (b.x[0] + b.x[1]) / 2, cz: (b.z[0] + b.z[1]) / 2, r: Math.max(b.x[1] - b.x[0], b.z[1] - b.z[0]) / 2 }));
    return { kind: 'tube', y0, y1, st, at: (y) => st[Math.max(0, Math.min(n, Math.round(((y - y0) / (y1 - y0 || 1)) * n)))] };
  }
  // a plate: its span axis across (a wing's x, its side's sign kept) or up (a fin's z); its chord along y
  const ax = frame === 'fin' ? 2 : 0, [s0, s1] = span(pts, ax), n = Math.max(4, Math.ceil((s1 - s0) / 0.2));
  const bins = Array.from({ length: n + 1 }, () => [Infinity, -Infinity]);
  for (const p of pts) { const b = bins[Math.round(((p[ax] - s0) / (s1 - s0 || 1)) * n)]; b[0] = Math.min(b[0], p[1]); b[1] = Math.max(b[1], p[1]); }
  for (let i = 0; i <= n; i++) if (!Number.isFinite(bins[i][0])) bins[i] = [...(bins[i - 1] ?? bins.find((b) => Number.isFinite(b[0])))];
  return { kind: frame, ax, s0, s1, at: (s) => { const b = bins[Math.max(0, Math.min(n, Math.round(((s - s0) / (s1 - s0 || 1)) * n)))]; return { te: b[0], le: b[1] }; } };
}

// the planes a skin's panel lines lie on, each as a cutter of one face: → a segment [a, b] on it, or null. A tube: its
// frames (y = const), its longerons and an access panel's long edges (half-planes through its axis at an angle, the
// axis the face's own station's centre), an access panel's round edges (frames bounded by angle). A plate: its ribs
// (span = const) and its spars (a chord fraction, the plane through it at the face's span)
function cutters(F, { pitch, access, longerons }) {
  const out = [];
  const seg = (f, n, c, keep = () => true) => {
    const P = f.corners, pts = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], da = n[0] * a[0] + n[1] * a[1] + n[2] * a[2] - c, db = n[0] * b[0] + n[1] * b[1] + n[2] * b[2] - c;
      if ((da < 0) !== (db < 0)) { const t = da / (da - db); pts.push(a.map((v, k) => v + (b[k] - v) * t)); }
    }
    return pts.length === 2 && keep(pts[0]) && keep(pts[1]) ? { a: pts[0], b: pts[1], across: n } : null;
  };
  const angleOf = (p) => { const S = F.at(p[1]); return { th: Math.atan2(p[2] - S.cz, p[0] - S.cx), S }; };
  const within = (a, [a0, a1]) => { let x = a; while (x < a0 - Math.PI) x += 2 * Math.PI; while (x > a0 + Math.PI) x -= 2 * Math.PI; return x >= a0 && x <= a1; };
  if (F.kind === 'tube') {
    // (frames each pitch, a third closer over the forward third, none in the last 15 cm of either end)
    const fwd = F.y1 - (F.y1 - F.y0) / 3;
    for (let y = F.y0 + pitch; y < F.y1 - 0.15; y += y > fwd ? pitch * 0.66 : pitch) out.push((f) => seg(f, [0, 1, 0], y));
    const radial = (th, yr) => (f) => {
      const S = F.at(f.corners.reduce((t, q) => t + q[1], 0) / f.corners.length), n = [-Math.sin(th), 0, Math.cos(th)];
      return seg(f, n, n[0] * S.cx + n[2] * S.cz, (p) => Math.cos(angleOf(p).th - th) > 0 && (!yr || (p[1] >= yr[0] && p[1] <= yr[1])));
    };
    for (const th of longerons) out.push(radial(th));
    for (const A of access) {
      out.push(radial(A.a[0], A.y), radial(A.a[1], A.y));
      for (const y of A.y) out.push((f) => seg(f, [0, 1, 0], y, (p) => within(angleOf(p).th, A.a)));
    }
    return out;
  }
  // a plate
  const ax = F.ax, nOf = (k) => { const n = [0, 0, 0]; n[k] = 1; return n; };
  for (let s = Math.sign(F.s1 || 1) * 0 + F.s0 + pitch; s < F.s1 - 0.1; s += pitch) out.push((f) => seg(f, nOf(ax), s));
  for (const fr of [0.2, 0.66]) out.push((f) => {
    const ss = f.corners.map((q) => q[ax]), sa = Math.min(...ss), sb = Math.max(...ss) + 1e-6;
    const ya = F.at(sa), yb = F.at(sb), pa = ya.le - fr * (ya.le - ya.te), pb = yb.le - fr * (yb.le - yb.te);
    // (the plane through the spar's line at this face's span: its normal in the span–chord plane)
    const n = [0, 0, 0]; n[ax] = -(pb - pa); n[1] = sb - sa; const d = Math.hypot(n[ax], n[1]) || 1; n[ax] /= d; n[1] /= d;
    return seg(f, n, n[ax] * sa + n[1] * pa);
  });
  return out;
}

/** The faces of one item and its panel lines laid on them: each line a ribbon a centimetre and a half wide, a millimetre
 *  proud of the skin, darker than the paint it runs on (the same slot: a livery's cut paints the base colour and passes
 *  a seam by). Faces of other slots carry none. */
export function skinPanels(faces, F, { pitch = 1.1, access = [], longerons = [Math.PI / 2, -Math.PI / 2, 0.35, Math.PI - 0.35, -0.5, -Math.PI + 0.5], seam = 0.68 } = {}) {
  if (!F) return faces;
  const cuts = cutters(F, { pitch, access, longerons }), lines = [];
  for (const f of faces) {
    if (!SKIN.includes(f.material)) continue;
    const n = f.outNormal, albedo = hex(rgb(f.albedo).map((v) => v * seam));
    for (const cut of cuts) {
      const g = cut(f);
      if (!g) continue;
      // (its width along the cutting plane's normal laid into the face: across the line, on the skin)
      const dn = g.across[0] * n[0] + g.across[1] * n[1] + g.across[2] * n[2], w0 = g.across.map((v, k) => v - dn * n[k]), wl = Math.hypot(...w0) || 1;
      const w = w0.map((v) => (v / wl) * SEAM_W), up = n.map((v) => v * 0.0012);
      const q = [g.a, g.b, g.b, g.a].map((p, i) => p.map((v, k) => r6(v + up[k] + (i < 2 ? -1 : 1) * w[k])));
      if (Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1], g.b[2] - g.a[2]) < 1e-4) continue;
      // (shaded as the skin under it, its corner normals the face's own mean, and wound to agree with them)
      const cn = (f.cornerNormals ?? [n]).reduce((t, v) => t.map((x, k) => x + v[k]), [0, 0, 0]), cl = Math.hypot(...cn) || 1, m = cn.map((v) => r6(v / cl));
      lines.push({ corners: woundTo(q, n), part: f.part, material: f.material, albedo, outNormal: n, cornerNormals: q.map(() => m) });
    }
  }
  return [...faces, ...lines];
}

/** Flush heads round each access panel on a tube, every `step` along its edges, set where a ray from the axis meets the
 *  skin. */
export function fastenersOn(faces, F, access = [], { step = 0.09, look = { part: 'fastener', material: 'airMetal', albedo: '#5c6064' } } = {}) {
  if (!F || F.kind !== 'tube' || !access.length) return [];
  const hit = (y, a) => {
    const S = F.at(y), d = [Math.cos(a), 0, Math.sin(a)], o = [S.cx, y, S.cz];
    let best = null;
    for (const f of faces) {
      const c = f.corners;
      if (Math.abs(centre(c)[1] - y) > 0.4) continue;
      for (let i = 1; i + 1 < c.length; i++) {
        const t = rayTri(o, d, c[0], c[i], c[i + 1]);
        if (t !== null && (!best || t > best.t)) best = { t, n: f.outNormal };
      }
    }
    return best ? { p: o.map((v, k) => v + d[k] * best.t), n: best.n } : null;
  };
  const out = [];
  for (const A of access) {
    const S = F.at((A.y[0] + A.y[1]) / 2), dy = step, da = step / Math.max(S.r, 0.05), pts = [];
    for (let y = A.y[0] + dy / 2; y < A.y[1]; y += dy) pts.push([y, A.a[0] + 0.02], [y, A.a[1] - 0.02]);
    for (let a = A.a[0] + da / 2; a < A.a[1]; a += da) pts.push([A.y[0] + 0.02, a], [A.y[1] - 0.02, a]);
    for (const [y, a] of pts) {
      const h = hit(y, a);
      if (h) out.push(...tubeOf([h.p.map((v, k) => r6(v - h.n[k] * 0.001)), h.p.map((v, k) => r6(v + h.n[k] * 0.0025))], 0.0065, { sides: 6, look, smooth: false }));
    }
  }
  return out;
}

// a ray's distance to a triangle (Möller–Trumbore), or null
function rayTri(o, d, a, b, c) {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
  const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det, s = [o[0] - a[0], o[1] - a[1], o[2] - a[2]], u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) * inv;
  if (u < 0 || u > 1) return null;
  const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) * inv;
  if (v < 0 || u + v > 1) return null;
  const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
  return t > 0 ? t : null;
}
