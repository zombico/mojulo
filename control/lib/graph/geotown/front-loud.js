/**
 * A LOUD SHOPFRONT — a shop's front drawn by the cube's `exaggerate.front` (era/exaggerate.js): the toy-town street, where
 * every member is fat and proud of the wall, the glass sits deep behind it, the sign is too big and a little askew in its
 * dark rim with its letters as blocks, the awning is striped with a scalloped valance, posters are slapped on the glass
 * and ink is splashed across the front. The same shop (its gaps, its door, its sign's and awning's kinds, its colours)
 * as fronts.js draws it plumb, pushed: the plan of the front never moves (the door where it was, the glass where it was).
 *
 *   loudShopfront(L, V, f) → [{ corners, out, role, hex? }]   in the house's frame (fronts.js: x along the front, y into
 *       the house, its wall at y = 0 facing −y, z up)
 *     L   the terms { chunk, sign, tilt, stripes, scallop, stickers, splats, pop }
 *     V   the shop (fronts.js `shop`: sign, awning, frame, signHex, awningHex, letterHex, kick) and its `seed`
 *     f   { W, sh, n, doorX, doorW, zt, gaps, kick, Sf }: the front's width, the storey, the storeys, the door, the
 *         glazing's head, the glass's gaps either side of the door, the kick plate, fronts.js FRONT.shop
 *     V.crown  metres: the FALSE FRONT raised over the street wall's top (the scene's, so no two neighbours stand one height),
 *              in V.crownForm (CROWN_FORMS: step, arch, gable, teeth; the scene's, never the neighbour's)
 *   LOUD_WALLS  the hues a loud street's buildings are painted in, one each, never the neighbour's
 *   popHex(hex, pop)  a colour pushed toward full saturation at a middle value (pop 0: as it was)
 *   INK               the splats' and the posters' inks
 *
 * Pure; its dice the shop's seed.
 */
import { hexToRgb, rgbToHex } from '../polygonizer/vexar.js';
import { skewCorners, skewWarp } from '../era/exaggerate.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const P = (x, y, z) => [r4(x), r4(y), r4(z)];
const DEG = Math.PI / 180;
// the inks a loud street is splashed and postered in, and the rim round its signs
export const INK = Object.freeze(['#ff3d8b', '#b6f01e', '#20d0f0', '#ff8a1a', '#8a4dff', '#ffd51f', '#16e0a0']);
const RIM = '#1c1830', PAPER = '#f7f3ea';
// the walls a loud street paints its buildings in, each its own and never its neighbour's (the scene's pick): the brick's
// light kept, its hue leant to one of these
export const LOUD_WALLS = Object.freeze(['#ff8fb8', '#7fd0f5', '#ffc94d', '#9fe06a', '#b994ff', '#ff9a5c', '#5fe0c0', '#f2f0e6']);

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** A colour pushed toward full saturation at a middle value by `pop` (0 as it was, 1 all the way). */
export function popHex(hex, pop) {
  if (!pop || typeof hex !== 'string') return hex;
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0;
  if (d > 1e-6) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const s0 = d < 1e-6 ? 0 : d / (1 - Math.abs(2 * l - 1));
  // (a grey has no hue to push: it is pushed to the ink its value is nearest, so a dark frame becomes a deep colour)
  if (s0 < 0.08) return popHex(INK[Math.min(INK.length - 1, Math.floor(l * INK.length))], pop * (0.6 + 0.4 * (1 - l)));
  const s = s0 + (0.95 - s0) * pop, L = l + (Math.min(0.62, Math.max(0.42, l)) - l) * pop;
  const c = (1 - Math.abs(2 * L - 1)) * s, x = c * (1 - Math.abs((h % 2) - 1)), m = L - c / 2;
  const [R, G, B] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  return rgbToHex([R + m, G + m, B + m].map((v) => v * 255));
}

/** A box's five faces (no floor), each facing out, `rot` (radians) turning it in the wall's plane about (cx, cz). */
function box(x0, y0, x1, y1, z0, z1, role, hex, rot = 0, cx = 0, cz = 0) {
  const T = (x, y, z) => (rot ? P(cx + (x - cx) * Math.cos(rot) - (z - cz) * Math.sin(rot), y, cz + (x - cx) * Math.sin(rot) + (z - cz) * Math.cos(rot)) : P(x, y, z));
  const o = (v) => (rot ? [v[0] * Math.cos(rot) - v[2] * Math.sin(rot), v[1], v[0] * Math.sin(rot) + v[2] * Math.cos(rot)].map(r4) : v);
  const e = { role, ...(hex ? { hex } : {}) };
  return [
    { corners: [T(x0, y0, z1), T(x1, y0, z1), T(x1, y1, z1), T(x0, y1, z1)], out: o([0, 0, 1]), ...e },
    { corners: [T(x0, y0, z0), T(x1, y0, z0), T(x1, y0, z1), T(x0, y0, z1)], out: o([0, -1, 0]), ...e },
    { corners: [T(x1, y1, z0), T(x0, y1, z0), T(x0, y1, z1), T(x1, y1, z1)], out: o([0, 1, 0]), ...e },
    { corners: [T(x0, y1, z0), T(x0, y0, z0), T(x0, y0, z1), T(x0, y1, z1)], out: o([-1, 0, 0]), ...e },
    { corners: [T(x1, y0, z0), T(x1, y1, z0), T(x1, y1, z1), T(x1, y0, z1)], out: o([1, 0, 0]), ...e },
  ];
}
/** A flat quad on the front at depth y, (x, z) its middle, w × h, turned by rot in the wall's plane. */
function flat(x, y, z, w, h, rot, role, hex) {
  const c = Math.cos(rot), s = Math.sin(rot), at = (u, v) => P(x + u * c - v * s, y, z + u * s + v * c);
  return { corners: [at(-w / 2, -h / 2), at(w / 2, -h / 2), at(w / 2, h / 2), at(-w / 2, h / 2)], out: [0, -1, 0], role, hex };
}
/** An ink splat on the front at depth y: a blob round (x, z) of radius r in triangles from its middle, and its droplets. */
function splat(x, y, z, r, hex, R) {
  const out = [], n = 18, ph = [R() * 6.28, R() * 6.28, R() * 6.28];
  const rad = (t) => r * (0.78 + 0.16 * Math.sin(3 * t + ph[0]) + 0.1 * Math.sin(5 * t + ph[1]) + 0.08 * Math.sin(8 * t + ph[2]));
  const ring = Array.from({ length: n }, (_, i) => { const t = (2 * Math.PI * i) / n; return [x + rad(t) * Math.cos(t), z + rad(t) * Math.sin(t)]; });
  for (let i = 0; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n]; out.push({ corners: [P(x, y, z), P(b[0], y, b[1]), P(a[0], y, a[1])], out: [0, -1, 0], role: 'decal', hex }); }
  for (let k = 0; k < 4; k++) {
    const t = R() * 2 * Math.PI, d = r * (1.15 + 0.6 * R()), q = r * (0.08 + 0.12 * R()), cx = x + d * Math.cos(t), cz = z + d * Math.sin(t);
    const pts = Array.from({ length: 8 }, (_, i) => [cx + q * Math.cos((2 * Math.PI * i) / 8), cz + q * Math.sin((2 * Math.PI * i) / 8)]);
    for (let i = 0; i < 8; i++) { const a = pts[i], b = pts[(i + 1) % 8]; out.push({ corners: [P(cx, y, cz), P(b[0], y, b[1]), P(a[0], y, a[1])], out: [0, -1, 0], role: 'decal', hex }); }
  }
  return out;
}

/** The false front's faces: its wall (role 'wall', its top storey's) and the cap along its edge, by form. */
const CROWN_FORMS = Object.freeze(['step', 'arch', 'gable', 'teeth']);
export { CROWN_FORMS };
function falseFront(form, W, zw, c, frame, fw, fd) {
  const out = [], wall = (pts) => {
    // (a wall's polygon in triangles from its foot's middle, both faces: the street's and the roof's side)
    const m = [W / 2, zw - 0.3];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      out.push({ corners: [P(m[0], -0.02, m[1]), P(a[0], -0.02, a[1]), P(b[0], -0.02, b[1])], out: [0, -1, 0], role: 'wall', storey: 0, crown: true });
      out.push({ corners: [P(m[0], 0.3, m[1]), P(b[0], 0.3, b[1]), P(a[0], 0.3, a[1])], out: [0, 1, 0], role: 'wall', storey: 0, crown: true });
    }
  };
  const cap = (a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2, rot = Math.atan2(b[1] - a[1], b[0] - a[0]), t = fw * 1.4; out.push(...box(cx - L / 2 - 0.06, -0.06 - fd * 0.6, cx + L / 2 + 0.06, 0.34, cz, cz + t, 'trim', frame, rot, cx, cz)); };
  const top = zw + c * 1.45, z0 = zw - 0.3;
  let edge;
  if (form === 'arch') {
    const zb = zw + c * 0.8, k = 10;
    edge = [[0, zb], ...Array.from({ length: k - 1 }, (_, i) => { const t = Math.PI * (1 - (i + 1) / k); return [W / 2 + (W / 2) * Math.cos(t), zb + (top - zb) * Math.sin(t)]; }), [W, zb]];
  } else if (form === 'gable') edge = [[0, zw + c * 0.6], [W / 2, top], [W, zw + c * 0.6]];
  else if (form === 'teeth') {
    const k = Math.max(3, Math.round(W / 1.3)) | 1, tw = W / k, zl = zw + c;
    edge = [];
    for (let i = 0; i < k; i++) { const x0 = i * tw, x1 = x0 + tw, z = i % 2 ? zl : top; edge.push([x0, z], [x1, z]); }
  } else { const mid = W * 0.34; edge = [[0, zw + c], [mid, zw + c], [mid, top], [W - mid, top], [W - mid, zw + c], [W, zw + c]]; }
  wall([[0, z0], ...edge, [W, z0]]);
  for (let i = 0; i + 1 < edge.length; i++) cap(edge[i], edge[i + 1]);
  return out;
}

export function loudShopfront(L, V, { W, sh, n, doorX, doorW, zt, gaps, kick, Sf }) {
  const R = mulberry32(((V.seed ?? 1) * 2654435761) >>> 0 || 1), out = [], C = L.chunk, pop = L.pop;
  const frame = popHex(V.frame ?? '#2a2d33', pop), signHex = popHex(V.signHex ?? '#e8e0cc', pop), awningHex = popHex(V.awningHex ?? '#c8432f', pop);
  // (the letters read against their board: dark on a light board, paper on a dark one)
  const lum = (h) => { const [r, g, b] = hexToRgb(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
  const letterHex = lum(signHex) > 0.55 ? RIM : PAPER, ink = () => INK[Math.floor(R() * INK.length)];
  const fw = 0.08 * C, fd = 0.1 * C, glassY = -0.01, tilt = (L.tilt ?? 0) * DEG;
  // ── the glazing: the glass deep in the wall, fat posts, a head and a sill proud of it, its kick plate an ink of its own ──
  const kickHex = popHex(ink(), pop);
  for (const [a, b] of gaps) {
    if (b - a < 0.6) continue;
    out.push({ corners: [P(a, -0.02, 0), P(b, -0.02, 0), P(b, -0.02, kick), P(a, -0.02, kick)], out: [0, -1, 0], role: 'trim', hex: kickHex });
    const g0 = out.length;
    out.push({ corners: [P(a, glassY, kick), P(b, glassY, kick), P(b, glassY, zt), P(a, glassY, zt)], out: [0, -1, 0], role: 'glass' });
    out.push(...box(a, -fd, a + fw, 0, 0, zt + fw, 'trim', frame), ...box(b - fw, -fd, b, 0, 0, zt + fw, 'trim', frame));
    out.push(...box(a, -fd, b, 0, zt, zt + fw, 'trim', frame), ...box(a, -fd * 1.25, b, 0, kick - fw * 0.7, kick, 'trim', frame));
    const k = Math.max(1, Math.round((b - a) / (Sf.mullion * 1.15)));
    for (let i = 1; i < k; i++) { const x = a + ((b - a) * i) / k; out.push(...box(x - fw * 0.35, -fd * 0.7, x + fw * 0.35, 0, kick, zt, 'trim', frame)); }
    // (no window square: the glass, its frame, its mullions and its sill warped together, the posts' feet kept)
    if (L.skew > 0) {
      const wv = skewWarp(skewCorners((V.seed ?? 1) * 31 + Math.round(a * 100), b - a, zt - kick, L.skew), a, kick, b - a, zt - kick), lo = kick - fw;
      for (let j = g0; j < out.length; j++) out[j] = { ...out[j], corners: out[j].corners.map(([x, y, z]) => { if (z < lo - 1e-6) return [x, y, z]; const [u, w] = wv(x, z); return P(u, y, w); }) };
    }
  }
  // ── the false front: the street wall raised past its roof by the scene's crown in the shop's own FORM (stepped, an arch,
  // a gable, battlements), a fat cap along its edge; its peak 1.45 × the crown over the wall's top, so no two neighbours
  // stand one height ──
  if (V.crown > 0 && n) out.push(...falseFront(V.crownForm ?? 'step', W, n * sh, V.crown, frame, fw, fd));
  // ── the door's surround: fat jambs and a head over it ──
  const d0 = doorX - doorW / 2 - 0.12, d1 = doorX + doorW / 2 + 0.12;
  out.push(...box(d0 - fw, -fd, d0, 0, 0, zt + fw, 'trim', frame), ...box(d1, -fd, d1 + fw, 0, 0, zt + fw, 'trim', frame), ...box(d0 - fw, -fd, d1 + fw, 0, zt, zt + fw * 1.3, 'trim', frame));
  // ── the awning: stripes, the shop's ink and paper in turn, a scalloped valance hanging under its edge ──
  const awning = V.awning ?? 'slope', ao = Sf.awning * (0.9 + 0.2 * C / 2), a0 = Sf.edge * 0.4, a1 = W - Sf.edge * 0.4, zh = zt + fw * 1.3 + 0.04, zl = zh - ao * 0.5;
  let top = zh;
  if (awning !== 'none') {
    const k = Math.max(3, L.stripes || Math.round((a1 - a0) / 0.45)), sw = (a1 - a0) / k;
    for (let i = 0; i < k; i++) {
      const x0 = a0 + i * sw, x1 = x0 + sw, hex = L.stripes ? (i % 2 ? PAPER : awningHex) : awningHex;
      out.push({ corners: [P(x0, -ao, zl), P(x1, -ao, zl), P(x1, 0, zh), P(x0, 0, zh)], out: [0, -0.45, 0.9], role: 'canvas', hex });
      // (its tooth of the valance: a half disc under the edge, or a plain band)
      if (L.scallop) {
        const n = 6, rr = sw / 2, cx = x0 + rr;
        for (let j = 0; j < n; j++) {
          const t0 = Math.PI + (Math.PI * j) / n, t1 = Math.PI + (Math.PI * (j + 1)) / n;
          out.push({ corners: [P(cx, -ao, zl), P(cx + rr * Math.cos(t0), -ao, zl + rr * Math.sin(t0) * 0.9), P(cx + rr * Math.cos(t1), -ao, zl + rr * Math.sin(t1) * 0.9)], out: [0, -1, 0], role: 'canvas', hex });
        }
      } else out.push({ corners: [P(x0, -ao, zl - 0.25), P(x1, -ao, zl - 0.25), P(x1, -ao, zl), P(x0, -ao, zl)], out: [0, -1, 0], role: 'canvas', hex });
    }
    for (const [x, sx] of [[a0, -1], [a1, 1]]) out.push({ corners: [P(x, 0, zh), P(x, -ao, zl), P(x, -ao, zl - 0.18)], out: [sx, 0, 0], role: 'canvas', hex: awningHex });
    top = zh + 0.05;
  }
  // ── the sign: too big, proud, in a dark rim, a little askew; its letters blocks of the letter's ink, each its own tilt ──
  const sign = V.sign ?? 'band';
  if (sign !== 'none') {
    const hS = Sf.sign * L.sign, x0 = 0.1, x1 = W - 0.1, z0 = Math.max(top + 0.06, sh - 0.1 - hS * 0.75), z1 = z0 + hS, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const rot = (R() < 0.5 ? -1 : 1) * tilt, rim = 0.06 * L.sign, dS = 0.1 * L.sign;
    out.push(...box(x0 - rim, -dS, x1 + rim, -0.01, z0 - rim, z1 + rim, 'sign', RIM, rot, cx, cz));
    out.push(...box(x0, -dS - 0.05, x1, -dS, z0, z1, 'sign', signHex, rot, cx, cz));
    const n = Math.max(3, Math.min(9, Math.round((x1 - x0) / 0.62))), pitch = (x1 - x0 - 0.5) / n;
    for (let i = 0; i < n; i++) {
      const w = pitch * (0.55 + 0.3 * R()), h = hS * (0.5 + 0.22 * R()), lx = x0 + 0.25 + pitch * (i + 0.5), lz = cz + hS * 0.06 * (R() - 0.5), lr = rot + (R() - 0.5) * 12 * DEG;
      // (each letter turned about its own middle, then the board's turn carried to it)
      const px = cx + (lx - cx) * Math.cos(rot) - (lz - cz) * Math.sin(rot), pz = cz + (lx - cx) * Math.sin(rot) + (lz - cz) * Math.cos(rot);
      out.push(...box(px - w / 2, -dS - 0.12, px + w / 2, -dS - 0.05, pz - h / 2, pz + h / 2, 'sign', letterHex, lr, px, pz));
    }
  }
  // ── posters slapped on the glass, askew; each a sheet of one ink, a band of another across it ──
  const sheets = Math.round(L.stickers * gaps.reduce((s, [a, b]) => s + Math.max(0, b - a), 0) / 0.9);
  for (let i = 0; i < sheets; i++) {
    const g = gaps.filter(([a, b]) => b - a >= 0.8);
    if (!g.length) break;
    const [a, b] = g[Math.floor(R() * g.length)], w = 0.32 + 0.3 * R(), h = 0.42 + 0.4 * R(), x = a + fw + w / 2 + R() * Math.max(0, b - a - 2 * fw - w), z = kick + 0.2 + h / 2 + R() * Math.max(0, zt - kick - 0.5 - h);
    const rot = (R() - 0.5) * 2 * Math.max(tilt * 2, 6 * DEG), base = popHex(ink(), pop), band = R() < 0.5 ? PAPER : popHex(ink(), pop);
    out.push(flat(x, glassY - 0.012, z, w, h, rot, 'decal', base), flat(x, glassY - 0.016, z + h * 0.12, w * 0.86, h * 0.22, rot, 'decal', band));
  }
  // ── ink splashed across the front: over the frames and the kick plate, low, as if thrown from the street ──
  const blots = Math.round(L.splats * (W / 2.2));
  for (let i = 0; i < blots; i++) {
    const r = 0.22 + 0.3 * R(), x = 0.3 + R() * (W - 0.6), z = 0.25 + R() * Math.max(0.2, zt * 0.55);
    out.push(...splat(x, -fd * 1.3 - 0.015, z, r, popHex(ink(), pop), R));
  }
  return out;
}
