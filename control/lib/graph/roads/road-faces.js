/**
 * road-faces — the lit face helpers the roadway kernel and its structures share. Fills are baked
 * under one sun (the World renders vertex colours unlit), so every helper shades at build time.
 */
import { makeLight, shadeHex, scaleHex, newellNormal } from '../polygonizer/vexar.js';

export const LIGHT = makeLight({ direction: [0.35, 0.55, -0.76], ambient: 0.52, diffuse: 0.55 });

export function upQuad(c) {
  const n = newellNormal(c);
  return n[2] < 0 ? { c: [c[0], c[3], c[2], c[1]], n: [-n[0], -n[1], -n[2]] } : { c, n };
}
export function face(corners, hex, extra = {}) {
  const { c, n } = extra.keepWinding ? { c: corners, n: newellNormal(corners) } : upQuad(corners);
  const { keepWinding, ...rest } = extra;
  return { corners: c, fill: shadeHex(hex, n, LIGHT), ...rest };
}
/** A face whose normal is turned away from `inside` (walls, where "up" says nothing). */
export function faceOut(corners, hex, inside) {
  let n = newellNormal(corners);
  const cx = corners.reduce((a, p) => a + p[0], 0) / corners.length, cy = corners.reduce((a, p) => a + p[1], 0) / corners.length;
  const c = (n[0] * (cx - inside[0]) + n[1] * (cy - inside[1])) < 0 ? corners.slice().reverse() : corners;
  if (c !== corners) n = n.map((v) => -v);
  // road grime: the foot of a wall is darker than its head (splash and tyre spray)
  const zs = c.map((p) => p[2]), z0 = Math.min(...zs), z1 = Math.max(...zs), lit = shadeHex(hex, n, LIGHT);
  const cornerFills = z1 - z0 > 0.2 ? c.map((p) => scaleHex(lit, 0.74 + 0.26 * (p[2] - z0) / (z1 - z0))) : null;
  return { corners: c, fill: lit, ...(cornerFills ? { cornerFills } : {}) };
}
export function texFace(corners, hex, texture, uv) {
  const n = newellNormal(corners);
  const flip = n[2] < 0;
  const c = flip ? [corners[0], corners[3], corners[2], corners[1]] : corners;
  const u = flip ? [uv[0], uv[3], uv[2], uv[1]] : uv;
  return { corners: c, fill: shadeHex(hex, flip ? n.map((v) => -v) : n, LIGHT), texture, uv: u, textureLit: true };
}
/** A vertical box (4 sides + top) centred at p, size [w, d, h], yawed by `yaw`. */
export function boxFaces(p, [w, dd, h], yaw, hex) {
  const cx = Math.cos(yaw), sx = Math.sin(yaw);
  const pt = (a, b, z) => [p[0] + a * cx - b * sx, p[1] + a * sx + b * cx, p[2] + z];
  const q = [[-w / 2, -dd / 2], [w / 2, -dd / 2], [w / 2, dd / 2], [-w / 2, dd / 2]];
  const out = [];
  for (let i = 0; i < 4; i++) {
    const [a0, b0] = q[i], [a1, b1] = q[(i + 1) % 4];
    out.push(face([pt(a0, b0, 0), pt(a1, b1, 0), pt(a1, b1, h), pt(a0, b0, h)], hex, { keepWinding: true }));
  }
  out.push(face(q.map(([a, b]) => pt(a, b, h)), hex));
  out.push(face(q.map(([a, b]) => pt(a, b, 0)).reverse(), hex, { keepWinding: true }));
  return out;
}
