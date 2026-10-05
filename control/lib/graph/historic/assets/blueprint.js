/**
 * historic/assets/blueprint — an asset as an SVG BLUEPRINT before it is rendered: the step between
 * the dreamed sheet and the 3D scene. The sheet is a picture; the blueprint says how the picture is
 * made of pure geometry — which primitives (box, battered block, wedge, drum, dome, vault, ring),
 * how many, how big, where — so the piece can be checked, argued with and built on in flat drawings
 * before a single face is lit.
 *
 * It is drawn FROM the asset's own parts (the same `build()` the kit places), so the blueprint and
 * the render cannot drift: three orthographic views (front elevation x–z, side elevation y–z, plan
 * x–y) on a metre grid with overall dimensions, a parts table (primitive × count × size), and the
 * asset's build notes — the guidance for the next pass.
 *
 * Every primitive but the ring is convex, so a part's silhouette in a view is the convex hull of its
 * projected corners; parts are painted back to front. Pure and deterministic.
 */
import { beamCorners } from './solids.js';
const r2 = (v) => Math.round(v * 100) / 100;

// the corner points of a part (local metres) — enough to bound its silhouette in any view
function corners(b) {
  const { x, y, w, d, z0, z1 } = b, x1 = x + w, y1 = y + d;
  const boxPts = (bx, by, bw, bd, za, zb) => [[bx, by, za], [bx + bw, by, za], [bx + bw, by + bd, za], [bx, by + bd, za], [bx, by, zb], [bx + bw, by, zb], [bx + bw, by + bd, zb], [bx, by + bd, zb]];
  if (!b.solid) return boxPts(x, y, w, d, z0, z1);
  if (b.solid === 'frustum') { const t = b.top || b; return [[x, y, z0], [x1, y, z0], [x1, y1, z0], [x, y1, z0], [t.x, t.y, z1], [t.x + t.w, t.y, z1], [t.x + t.w, t.y + t.d, z1], [t.x, t.y + t.d, z1]]; }
  if (b.solid === 'wedge') {
    const hi = { 'x+': (p) => p[0] === x1, 'x-': (p) => p[0] === x, 'y+': (p) => p[1] === y1, 'y-': (p) => p[1] === y }[b.rise || 'y+'];
    const base = [[x, y], [x1, y], [x1, y1], [x, y1]];
    return [...base.map(([a, c]) => [a, c, z0]), ...base.filter((p) => hi(p)).map(([a, c]) => [a, c, z1])];
  }
  if (b.solid === 'drum' || b.solid === 'dome') {
    const N = 16, cx = x + w / 2, cy = y + d / 2, ring = (f, z) => Array.from({ length: N }, (_, i) => [cx + Math.cos((i / N) * 6.2832) * w / 2 * f, cy + Math.sin((i / N) * 6.2832) * d / 2 * f, z]);
    if (b.solid === 'drum') return [...ring(1, z0), ...ring(b.taper ?? 1, z1)];
    return Array.from({ length: 6 }, (_, k) => ring(Math.cos((k / 6) * 1.5708), z0 + (z1 - z0) * Math.sin((k / 6) * 1.5708))).flat().concat([[cx, cy, z1]]);
  }
  if (b.solid === 'vault') {
    const alongY = (b.axis || 'y') === 'y', span = alongY ? w : d, R = span / 2, spring = z1 - Math.min(R, z1 - z0), N = 10, out = [];
    for (const L of [0, alongY ? d : w]) {
      out.push(alongY ? [x, y + L, z0] : [x + L, y, z0], alongY ? [x1, y + L, z0] : [x + L, y1, z0]);
      for (let i = 0; i <= N; i++) { const a = Math.PI * (i / N), s = R - R * Math.cos(a), z = spring + (z1 - spring) * Math.sin(a); out.push(alongY ? [x + s, y + L, z] : [x + L, y + s, z]); }
    }
    return out;
  }
  if (b.solid === 'ring') {
    const inY = b.plane === 'y', span = inY ? d : w, R = span / 2, cz = (z0 + z1) / 2, cA = inY ? y + d / 2 : x + w / 2, N = 16, out = [];
    for (const dep of inY ? [x, x1] : [y, y1]) for (let i = 0; i < N; i++) { const a = (i / N) * 6.2832, u = cA + Math.cos(a) * R, z = cz + Math.sin(a) * R; out.push(inY ? [dep, u, z] : [u, dep, z]); }
    return out;
  }
  if (b.solid === 'beam') return beamCorners(b);
  return boxPts(x, y, w, d, z0, z1);   // palm and anything else: its bounding box
}

function hull(pts) {
  const p = [...new Map(pts.map((q) => [`${r2(q[0])},${r2(q[1])}`, q])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

const PRIM = (b) => (b.solid ? { frustum: 'battered block', wedge: 'wedge (slope)', drum: b.taper && b.taper !== 1 ? 'tapered drum' : 'drum', dome: 'dome', vault: 'vault', ring: 'ring', palm: 'palm', beam: 'beam' }[b.solid] || b.solid : 'box');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/**
 * An asset → its blueprint SVG. `parts` are the asset's local-frame masses (front −y, metres), as its
 * build() returns them for a W × D slot.
 */
export function assetBlueprintSvg({ id, read = '', notes = [], W, D, parts }) {
  const all = parts.flatMap(corners);
  const ext = (i) => [Math.min(...all.map((p) => p[i]), 0), Math.max(...all.map((p) => p[i]))];
  const [x0, x1] = ext(0), [y0, y1] = ext(1), [, z1] = ext(2);
  const S = Math.min(260 / Math.max(x1 - x0, y1 - y0, z1, 1), 90);   // px per metre
  const pad = 64, colW = Math.max((x1 - x0) * S, (y1 - y0) * S, 150);
  // views: [name, u axis, v axis (up), depth axis (far = drawn first), flip u]
  const views = [
    { name: 'FRONT  x–z', u: 0, v: 2, depth: (p) => -p[1], ox: pad, oy: pad + z1 * S, um: x0 },
    { name: 'SIDE  y–z (front at left)', u: 1, v: 2, depth: (p) => p[0], ox: pad * 2 + colW, oy: pad + z1 * S, um: y0 },
    { name: 'PLAN  x–y (front at top)', u: 0, v: 1, depth: (p) => p[2], ox: pad, oy: pad * 2.6 + z1 * S, um: x0, down: true },
  ];
  const svg = [];
  for (const V of views) {
    const px = (q) => [V.ox + (q[V.u] - V.um) * S, V.down ? V.oy + (q[V.v] - y0) * S : V.oy - q[V.v] * S];
    const span = V.u === 0 ? [x0, x1] : [y0, y1], vspan = V.down ? [y0, y1] : [0, z1];
    // metre grid
    for (let m = Math.ceil(span[0]); m <= span[1]; m++) { const [gx] = px(V.u === 0 ? [m, 0, 0] : [0, m, 0]); svg.push(`<line x1="${r2(gx)}" y1="${r2(V.down ? px([0, vspan[0], 0])[1] : px([0, 0, 0])[1])}" x2="${r2(gx)}" y2="${r2(V.down ? px([0, vspan[1], 0])[1] : px([0, 0, z1])[1])}" class="g"/>`); }
    for (let m = Math.ceil(vspan[0]); m <= vspan[1]; m++) { const q = V.down ? [span[0], m, 0] : [span[0], span[0], m]; q[V.u] = span[0]; const [, gy] = px(q); const q2 = q.slice(); q2[V.u] = span[1]; svg.push(`<line x1="${r2(px(q)[0])}" y1="${r2(gy)}" x2="${r2(px(q2)[0])}" y2="${r2(gy)}" class="g"/>`); }
    // parts back to front
    const order = parts.map((b) => ({ b, c: corners(b) })).map((o) => ({ ...o, dep: Math.max(...o.c.map(V.depth)) })).sort((a, b) => a.dep - b.dep);
    for (const { b, c } of order) {
      const h = hull(c.map(px));
      const dash = b.solid ? '' : '';
      svg.push(`<polygon points="${h.map((q) => `${r2(q[0])},${r2(q[1])}`).join(' ')}" fill="${b.tint || '#bbb'}" class="p${dash}"><title>${esc(b.kind)} · ${PRIM(b)}</title></polygon>`);
      if (b.solid === 'ring') {   // a hull has no hole: cut the ring's own back in
        const band = b.band || Math.min(b.w, b.d) * 0.11, inner = corners({ ...b, x: b.x + band, y: b.y + band, w: b.w - 2 * band, d: b.d - 2 * band, z0: b.z0 + band, z1: b.z1 - band, band: 0 });
        const flat = (b.plane === 'y' ? V.u === 0 : V.u === 1) || V.down;   // seen edge-on, or from above: no hole shows
        if (!flat) svg.push(`<polygon points="${hull(inner.map(px)).map((q) => `${r2(q[0])},${r2(q[1])}`).join(' ')}" fill="#f6f8fb" class="p"/>`);
      }
    }
    // overall dimensions
    const a = px(V.u === 0 ? [span[0], 0, 0] : [0, span[0], 0]), bb = px(V.u === 0 ? [span[1], 0, 0] : [0, span[1], 0]);
    const yd = V.down ? px([0, vspan[1], 0])[1] + 16 : a[1] + 16;
    svg.push(`<line x1="${r2(a[0])}" y1="${r2(yd)}" x2="${r2(bb[0])}" y2="${r2(yd)}" class="d"/><text x="${r2((a[0] + bb[0]) / 2)}" y="${r2(yd + 13)}" class="t" text-anchor="middle">${r2(span[1] - span[0])} m</text>`);
    if (!V.down) { const top = px([0, 0, z1]); svg.push(`<line x1="${r2(a[0] - 14)}" y1="${r2(a[1])}" x2="${r2(a[0] - 14)}" y2="${r2(top[1])}" class="d"/><text x="${r2(a[0] - 18)}" y="${r2((a[1] + top[1]) / 2)}" class="t" text-anchor="end">${r2(z1)} m</text>`); }
    svg.push(`<text x="${V.ox}" y="${r2((V.down ? V.oy : V.oy - z1 * S) - 10)}" class="h">${V.name}</text>`);
  }
  // parts table + notes, right column
  const tx = pad * 3 + colW * 2, groups = new Map();
  for (const b of parts) {
    const k = `${b.kind}|${PRIM(b)}`, g = groups.get(k) || { kind: b.kind, prim: PRIM(b), n: 0, w: 0, d: 0, h: 0, tint: b.tint };
    g.n++; g.w = Math.max(g.w, b.w); g.d = Math.max(g.d, b.d); g.h = Math.max(g.h, b.z1 - b.z0); groups.set(k, g);
  }
  let ty = pad;
  svg.push(`<text x="${tx}" y="${ty}" class="h">${esc(id)} — ${r2(W)} × ${r2(D)} m slot, ${r2(z1)} m tall, ${parts.length} parts</text>`);
  ty += 14;
  for (const line of wrap(read, 64)) { svg.push(`<text x="${tx}" y="${(ty += 14)}" class="t">${esc(line)}</text>`); }
  ty += 10;
  svg.push(`<text x="${tx}" y="${(ty += 16)}" class="h">PARTS (primitive × count, largest w × d × h)</text>`);
  for (const g of groups.values()) {
    ty += 15;
    svg.push(`<rect x="${tx}" y="${ty - 9}" width="10" height="10" fill="${g.tint || '#bbb'}" class="p"/><text x="${tx + 16}" y="${ty}" class="t">${esc(g.kind)} — ${g.prim} × ${g.n} — ${r2(g.w)} × ${r2(g.d)} × ${r2(g.h)}</text>`);
  }
  if (notes.length) {
    ty += 12;
    svg.push(`<text x="${tx}" y="${(ty += 16)}" class="h">BUILD NOTES</text>`);
    for (const n of notes) for (const [i, line] of wrap(n, 64).entries()) svg.push(`<text x="${tx}" y="${(ty += 14)}" class="t">${i ? '   ' : '• '}${esc(line)}</text>`);
  }
  const Wsvg = Math.ceil(tx + 470), Hsvg = Math.ceil(Math.max(ty + pad, pad * 3.2 + z1 * S + (y1 - y0) * S + 30));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wsvg} ${Hsvg}" width="${Wsvg}" height="${Hsvg}" font-family="ui-monospace,Menlo,monospace">
<style>.g{stroke:#c9d4e2;stroke-width:.5}.p{stroke:#2a2f38;stroke-width:.8;stroke-linejoin:round}.d{stroke:#2a6fb8;stroke-width:1}.t{font-size:11px;fill:#2a2f38}.h{font-size:12px;font-weight:700;fill:#1b3a63}</style>
<rect width="100%" height="100%" fill="#f6f8fb"/>
${svg.join('\n')}
</svg>`;
}

function wrap(s, n) {
  const out = []; let line = '';
  for (const w of String(s || '').split(/\s+/).filter(Boolean)) { if ((line + ' ' + w).trim().length > n) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); }
  if (line) out.push(line);
  return out;
}
