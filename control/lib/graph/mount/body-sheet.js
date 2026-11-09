/**
 * body-sheet — the eyes gate's body sheet: a mount's mesh shaded flat (Lambert under a key light from the front above
 * and a cool fill), its quads drawn back to front, from named views (side, front, ¾, back, top) or in poses. Its
 * colours from a coat card (coats.js). Pure: a string of SVG.
 *
 *   VIEWS   side (its right side, the mount facing right) | front | threeQuarter (front right, from above) | back | top
 *   bodySheet(rows, { title }) where rows = [{ label, sub, cells: [{ vertices, quads, colors, view, ownScale?, twoSided? }] }]
 *   (one scale for the sheet, but a cell `ownScale` fits its own extent: a close-up)
 */
const VIEWS = Object.freeze({
  side: { yaw: 0, pitch: 0 },
  threeQuarter: { yaw: 35, pitch: 12 },
  front: { yaw: 90, pitch: 6 },
  back: { yaw: -90, pitch: 6 },
  top: { yaw: 0, pitch: 89 },
  lowQuarter: { yaw: 40, pitch: -8 },
  rearQuarter: { yaw: -35, pitch: 10 },
});
export const BODY_VIEWS = Object.keys(VIEWS);
const DEG = Math.PI / 180;
const f1 = (x) => x.toFixed(1);

/** a world point (x right of the mount, y its front, z up) to the view: [screen x, screen y up, depth toward the eye] */
function viewOf(name) {
  const v = VIEWS[name] ?? VIEWS.side, cy = Math.cos(v.yaw * DEG), sy = Math.sin(v.yaw * DEG), cp = Math.cos(v.pitch * DEG), sp = Math.sin(v.pitch * DEG);
  // the camera at (cos yaw, sin yaw) round the mount: yaw 0 on its right (+x) looking in, so its front (+y) is to the
  // right of the picture; yaw 90 in front of it (its right on the viewer's left); its right is f × up = (−sin, cos, 0)
  return (p) => {
    const sx = -p[0] * sy + p[1] * cy, dz = p[0] * cy + p[1] * sy;       // screen right, toward the eye (unpitched)
    return [sx, p[2] * cp - dz * sp, dz * cp + p[2] * sp];
  };
}

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const rgb = (c) => `rgb(${c.map((x) => Math.max(0, Math.min(255, Math.round(x)))).join(',')})`;

function shade(base, n, viewDir) {
  const key = [-0.45, 0.55, 0.70], fill = [0.6, -0.3, 0.2];
  const kl = Math.hypot(...key), fl = Math.hypot(...fill);
  const nk = Math.max(0, (n[0] * key[0] + n[1] * key[1] + n[2] * key[2]) / kl), nf = Math.max(0, (n[0] * fill[0] + n[1] * fill[1] + n[2] * fill[2]) / fl);
  const rim = Math.pow(1 - Math.abs(n[0] * viewDir[0] + n[1] * viewDir[1] + n[2] * viewDir[2]), 3) * 0.12;
  const c = hex(base), L = 0.32 + 0.62 * nk + 0.16 * nf + rim;
  return rgb(c.map((x) => x * L + (nf * 8)));
}

/** one cell: the mesh's quads projected, shaded, sorted back to front */
function cellSvg(cell, ox, oy, w, h, fit) {
  const P = viewOf(cell.view), V = cell.vertices.map(P);
  const out = [];
  const sx = (q) => ox + w / 2 + (q[0] - fit.cx) * fit.s, sy = (q) => oy + h - 14 - (q[1] - fit.floor) * fit.s;
  out.push(`<line x1="${ox + 8}" y1="${f1(sy([0, fit.floor]))}" x2="${ox + w - 8}" y2="${f1(sy([0, fit.floor]))}" stroke="#ced4da" stroke-width="1"/>`);
  // the eye's direction in the world (for the rim): the view's depth axis
  const v = VIEWS[cell.view] ?? VIEWS.side, cy = Math.cos(v.yaw * DEG), sy2 = Math.sin(v.yaw * DEG), cp = Math.cos(v.pitch * DEG), sp = Math.sin(v.pitch * DEG);
  const eye = [cy * cp, sy2 * cp, sp];
  const polys = [];
  for (let i = 0; i < cell.quads.length; i++) {
    const q = cell.quads[i], a = cell.vertices[q[0]], b = cell.vertices[q[1]], c = cell.vertices[q[2]], d = cell.vertices[q[3]];
    const u = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], t = [d[0] - b[0], d[1] - b[1], d[2] - b[2]];
    let n = [u[1] * t[2] - u[2] * t[1], u[2] * t[0] - u[0] * t[2], u[0] * t[1] - u[1] * t[0]];
    const nl = Math.hypot(...n);
    if (!(nl > 1e-12)) continue;                                              // a degenerate quad (two corners met)
    n = n.map((x) => x / nl);
    const facing = n[0] * eye[0] + n[1] * eye[1] + n[2] * eye[2];
    if (cell.twoSided?.[i]) { if (facing < 0) n = n.map((x) => -x); }          // a card: both its faces shown
    else if (facing < -0.05) continue;                                          // facing away
    const pz = (V[q[0]][2] + V[q[1]][2] + V[q[2]][2] + V[q[3]][2]) / 4;
    polys.push([pz, q, shade(cell.colors[i], n, eye)]);
  }
  polys.sort((A, Bq) => A[0] - Bq[0]);
  for (const [, q, col] of polys) out.push(`<polygon points="${q.map((k) => `${f1(sx(V[k]))},${f1(sy(V[k]))}`).join(' ')}" fill="${col}" stroke="${col}" stroke-width="0.4"/>`);
  if (cell.overlay) out.push(cell.overlay(sx, sy, P));
  return out.join('');
}

export function bodySheet(rows, { title = '', cellW = 360, cellH = 300 } = {}) {
  const cols = Math.max(...rows.map((r) => r.cells.length)), W = 20 + cols * cellW, rowH = cellH + 34, H = 46 + rows.length * rowH;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif">`,
    `<rect width="${W}" height="${H}" fill="#f8f9fa"/>`, `<text x="14" y="28" font-size="18" font-weight="bold" fill="#212529">${title}</text>`];
  // one scale for the whole sheet: the largest cell's extent
  let s = Infinity;
  for (const r of rows) for (const c of r.cells) {
    const P = viewOf(c.view); let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const used = new Set(); for (const q of c.quads) for (const k of q) used.add(k);   // the drawn quads' extent (a crop's)
    for (const k of used) { const v = c.vertices[k], q = P(v); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    c._fit = { cx: (x0 + x1) / 2, floor: y0 };
    const own = Math.min((cellW - 30) / (x1 - x0), (cellH - 30) / (y1 - y0));
    if (c.ownScale) c._fit.s = own;                                             // a close-up: its own scale
    else s = Math.min(s, own);
  }
  rows.forEach((r, ri) => {
    const y = 46 + ri * rowH;
    out.push(`<text x="14" y="${y + 14}" font-size="13" font-weight="bold" fill="#212529">${r.label}</text>`);
    if (r.sub) out.push(`<text x="${18 + 7.5 * r.label.length}" y="${y + 14}" font-size="11" fill="#495057">${r.sub}</text>`);
    r.cells.forEach((c, ci) => {
      out.push(cellSvg(c, 10 + ci * cellW, y + 20, cellW, cellH, { s, ...c._fit }));
      if (c.caption) out.push(`<text x="${18 + ci * cellW}" y="${y + 34}" font-size="10" fill="#868e96">${c.caption}</text>`);
    });
  });
  out.push('</svg>');
  return out.join('\n');
}
