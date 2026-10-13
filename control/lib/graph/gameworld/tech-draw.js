/**
 * TECH DRAW — a crafted thing's chassis (or any face list that carries its own fill, as the workbench lowers it) drawn
 * as a plate: the sheet's axon eye, faces turned away dropped unless double-sided, far to near. The bible's plates for
 * the technology design loop; blocks keep era/out-structures-draw.js. Pure: the same faces, the same SVG.
 *
 *   drawFilled(faces, { w, h, pad }) → '<svg …>'
 */
// the sheet's axon eye (era/out-structures-draw.js VIEWS.axon): looking along F, right R, up U
const F = [-0.47, 0.67, -0.5], R = [0.82, 0.57, 0], U = [-0.29, 0.41, 0.86];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const f1 = (v) => Math.round(v * 10) / 10;

export function drawFilled(faces, { w = 240, h = 190, pad = 8 } = {}) {
  const P = faces.filter((f) => f.corners?.length >= 3).map((f) => ({ f, q: f.corners.map((c) => [dot(c, R), -dot(c, U), dot(c, F)]) }));
  if (!P.length) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"></svg>`;
  const xs = P.flatMap((p) => p.q.map((q) => q[0])), ys = P.flatMap((p) => p.q.map((q) => q[1]));
  const x0 = Math.min(...xs), y0 = Math.min(...ys), k = Math.min((w - 2 * pad) / (Math.max(...xs) - x0 || 1), (h - 2 * pad) / (Math.max(...ys) - y0 || 1));
  const ox = (w - (Math.max(...xs) - x0) * k) / 2, oy = (h - (Math.max(...ys) - y0) * k) / 2;
  const depth = (p) => p.q.reduce((s, q) => s + q[2], 0) / p.q.length;
  // far first; the sort is stable on equal depth, so the order is the faces' own
  const order = P.map((p, i) => ({ p, i, d: depth(p) })).sort((a, b) => b.d - a.d || a.i - b.i);
  const polys = order.map(({ p }) => `<polygon points="${p.q.map((q) => `${f1(ox + (q[0] - x0) * k)},${f1(oy + (q[1] - y0) * k)}`).join(' ')}" fill="${p.f.fill ?? '#999'}" stroke="${p.f.fill ?? '#999'}" stroke-width="0.4" stroke-linejoin="round"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${polys.join('')}</svg>`;
}
