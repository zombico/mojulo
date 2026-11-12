/**
 * THE METRO'S INDUSTRY — what an industrial neighbourhood of the outskirts stands its blocks with (segments.js `works`,
 * `warehouse`, `storage`, `tanks`, `substation`), and the grid that feeds it: a high-voltage line on lattice pylons from
 * each substation out to the land's edge. Two halves:
 *
 *   industryTemplates(L) → { tank, sphere, holder, silos: { x, y }, container: { x, y }, transformer: { x, y },
 *                    gantry: { x, y }, breaker, pylon: { x, y }, stack, chainlink: { x, y }, piperack: { x, y } }:
 *                    each piece at true size in metres about its foot, baked under the scene's light (a piece is never
 *                    yawed: each way it lies is its own template; `x` lies along x). A container's body is pale for
 *                    an instance's tint
 *     tank         a storage tank: its shell, its wind girder, its low cone roof, a stair up its side, a rail round
 *     sphere       a gas sphere on its legs, braced, a stair up to its top
 *     holder       a gasholder: its bell inside a guide frame of columns and girder rings
 *     silos        a bank of four concrete silos under a gallery, a headhouse at its end
 *     container    a shipping container, its ribs and its doors' end
 *     transformer  an outdoor transformer on its plinth: its tank, its radiators, its bushings, its conservator
 *     gantry       a substation's gantry: two columns and a beam, its insulator strings
 *     breaker      a breaker on its stand, its post insulators
 *     pylon        a lattice pylon: four legs braced in panels, three crossarms each side, insulator strings, its peak
 *     stack        a works' chimney, tapered, its top banded red and white
 *     chainlink    a fence's 3 m: two posts, its rails, a strand of barbed wire leaning out
 *     piperack     a pipe rack's 6 m: its two bents, three pipes on them
 *   PYLON          the pylon's conductors' points (along y: its arms' reach each side, their heights) and its spacing
 *   INDUSTRY_FINISHES  each building's family (works, warehouse, control, shed) and its variants, each a wall's material
 *                  word and a roof's; finishOf(family, R) → { group, wall, roof } one by the dice
 *                  (`ribbon` and `punched` ops: a hall's ribbon of glazing high along its walls, an office's windows a row
 *                  a storey; a `celltower` stamp: a monopole at a works' or storage's back corner, geocity/rooftop.js)
 *   industrialPlan(b, R, { far? }) → [op]: a block's plan, each op one the scene draws: { op: 'box', q, z, h, group, wall,
 *                    roof }, { op: 'gable', q, z, ze, zr, axis, group, wall, roof }, { op: 'door', side, a, w, h, q, z },
 *                    { op: 'stamp', key, at, z?, scale? }, { op: 'vehicle', role, at, nose }, { op: 'fence', q }; `z`
 *                    over the block's ground at the op's middle, metres
 *
 * Metres, the design's frame. Pure; the block's own dice.
 */
import { litFactor, scaleHex } from '../polygonizer/vexar.js';
import { MATERIAL_WORDS } from '../era/arch-style.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const TAU = Math.PI * 2;

// ── the pieces, unlit: { corners, normal, hex } ──────────────────────────────────────────────────────────────────
const F = (corners, normal, hex) => ({ corners, normal, hex });
/** A box's top and four walls (and its floor, `under`). */
function boxU(x0, y0, z0, x1, y1, z1, hex, under = false) {
  return [
    F([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], hex),
    F([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], hex), F([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0], hex),
    F([[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], [0, 1, 0], hex), F([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], [-1, 0, 0], hex),
    ...(under ? [F([[x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0]], [0, 0, -1], hex)] : []),
  ];
}
/** A frustum about (cx, cy): its side in `n` quads, r0 at z0 to r1 at z1; its top a disc (`top`: its colour, or none). */
function cylU(cx, cy, r0, z0, z1, n, hex, { r1 = r0, top = hex } = {}) {
  const out = [], s = (r0 - r1) / Math.max(1e-6, z1 - z0), k = 1 / Math.hypot(1, s);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, b = ((i + 1) / n) * TAU, m = (a + b) / 2;
    out.push(F([[cx + r0 * Math.cos(a), cy + r0 * Math.sin(a), z0], [cx + r0 * Math.cos(b), cy + r0 * Math.sin(b), z0], [cx + r1 * Math.cos(b), cy + r1 * Math.sin(b), z1], [cx + r1 * Math.cos(a), cy + r1 * Math.sin(a), z1]], [Math.cos(m) * k, Math.sin(m) * k, s * k], hex));
  }
  if (top) out.push(F(Array.from({ length: n }, (_, i) => [cx + r1 * Math.cos((i / n) * TAU), cy + r1 * Math.sin((i / n) * TAU), z1]), [0, 0, 1], top));
  return out;
}
/** A cone's roof from a rim at z0 up `h` to its apex. */
function coneU(cx, cy, r, z0, h, n, hex) {
  const out = [], L = Math.hypot(r, h);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, b = ((i + 1) / n) * TAU, m = (a + b) / 2;
    out.push(F([[cx + r * Math.cos(a), cy + r * Math.sin(a), z0], [cx + r * Math.cos(b), cy + r * Math.sin(b), z0], [cx, cy, z0 + h]], [(Math.cos(m) * h) / L, (Math.sin(m) * h) / L, r / L], hex));
  }
  return out;
}
/** A sphere about (cx, cy, cz), `n` round and `m` from pole to pole. */
function sphereU(cx, cy, cz, r, n, m, hex) {
  const out = [], P = (i, j) => { const a = (i / n) * TAU, t = (j / m) * Math.PI; return [cx + r * Math.sin(t) * Math.cos(a), cy + r * Math.sin(t) * Math.sin(a), cz + r * Math.cos(t)]; };
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * TAU, t = ((j + 0.5) / m) * Math.PI, nn = [Math.sin(t) * Math.cos(a), Math.sin(t) * Math.sin(a), Math.cos(t)];
    const c = [P(i, j), P(i, j + 1), P(i + 1, j + 1), P(i + 1, j)];
    out.push(F(j === 0 ? [c[0], c[1], c[2]] : j === m - 1 ? [c[0], c[1], c[3]] : c, nn, hex));
  }
  return out;
}
/** A member between two points: a square section `w` across, its four sides. */
function beamU(p, q, w, hex) {
  const a = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], L = Math.hypot(...a) || 1e-6, d = a.map((v) => v / L);
  const ref = Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  let u = [d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]];
  const ul = Math.hypot(...u); u = u.map((v) => v / ul);
  const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]], h = w / 2;
  const at = (o, s, t) => o.map((x, i) => x + (u[i] * s + v[i] * t) * h);
  const out = [];
  for (const [s0, t0, s1, t1, n] of [[-1, -1, 1, -1, v.map((x) => -x)], [1, -1, 1, 1, u], [1, 1, -1, 1, v], [-1, 1, -1, -1, u.map((x) => -x)]]) out.push(F([at(p, s0, t0), at(q, s0, t0), at(q, s1, t1), at(p, s1, t1)], n, hex));
  return out;
}
/** An insulator: a rod from z0 down (or up) `len`, its sheds every so often. */
function insulatorU(x, y, z0, len, hex = '#7a4b2e') {
  const sg = Math.sign(len) || 1, out = [...cylU(x, y, 0.06, Math.min(z0, z0 + len), Math.max(z0, z0 + len), 6, '#6d6f70')];
  for (let s = 0.2; s < Math.abs(len) - 0.1; s += 0.28) out.push(...cylU(x, y, 0.17, z0 + sg * s - 0.03, z0 + sg * s + 0.03, 8, hex));
  return out;
}

// ── lit, and turned to lie along y ───────────────────────────────────────────────────────────────────────────────
const lit = (faces, L) => faces.map((f) => ({ corners: f.corners.map((c) => c.map(r4)), normal: f.normal.map(r4), fill: scaleHex(f.hex, litFactor(f.normal, L)) }));
const turn = (faces) => faces.map((f) => ({ corners: f.corners.map(([x, y, z]) => [-y, x, z]), normal: [-f.normal[1], f.normal[0], f.normal[2]], hex: f.hex }));
const both = (build, L) => { const u = build(); return { x: lit(u, L), y: lit(turn(u), L) }; };

// the colours: steel painted and galvanized, concrete, porcelain, a gasholder's green
const C = Object.freeze({ tank: '#e7e3d8', tankRoof: '#c9c5ba', girder: '#b9b5aa', stair: '#55595d', galv: '#9aa1a6', conc: '#c9c4b9', plinth: '#a9a59c',
  sphere: '#eeece5', holder: '#5d6e62', bell: '#7f8c82', silo: '#d3cec3', gallery: '#a8aaa6', box: '#f2f2f2', rib: '#d6d6d6', door: '#c4c4c4',
  tx: '#7d8a85', fin: '#6b7672', bushing: '#7a4b2e', red: '#c4362c', white: '#ece9e2', brick: '#9c5440', pipe: '#8f6f4a', pipe2: '#6f7f8c', rail: '#7b8085' });

/** A storage tank: r 10, h 12 (an instance's scale sizes it). */
function tank() {
  const r = 10, h = 12, out = [...cylU(0, 0, r + 0.5, -0.2, 0.3, 24, C.conc), ...cylU(0, 0, r, 0.3, h, 24, C.tank, { top: null }), ...cylU(0, 0, r + 0.2, h - 0.5, h - 0.15, 24, C.girder, { top: null }), ...coneU(0, 0, r, h, 1.2, 24, C.tankRoof)];
  // (a stair winding a quarter of the way round, up to the roof's edge; a rail round the roof)
  const P = (a, z, rr = r + 0.7) => [rr * Math.cos(a), rr * Math.sin(a), z];
  for (let i = 0; i < 8; i++) { const a0 = -0.2 + (i / 8) * (TAU / 4), a1 = -0.2 + ((i + 1) / 8) * (TAU / 4); out.push(...beamU(P(a0, 0.3 + (i / 8) * (h - 0.3)), P(a1, 0.3 + ((i + 1) / 8) * (h - 0.3)), 0.7, C.stair), ...beamU(P(a0, 1.3 + (i / 8) * (h - 0.3), r + 1.05), P(a1, 1.3 + ((i + 1) / 8) * (h - 0.3), r + 1.05), 0.06, C.stair)); }
  for (let i = 0; i < 16; i++) out.push(...beamU([(r - 0.2) * Math.cos((i / 16) * TAU), (r - 0.2) * Math.sin((i / 16) * TAU), h + 1.1], [(r - 0.2) * Math.cos(((i + 1) / 16) * TAU), (r - 0.2) * Math.sin(((i + 1) / 16) * TAU), h + 1.1], 0.06, C.stair));
  return out;
}
/** A gas sphere: r 7.5 its middle at 10, on ten legs braced, a stair up to its top. */
function sphere() {
  const r = 7.5, zc = 10, n = 10, out = [...sphereU(0, 0, zc, r, 20, 12, C.sphere)];
  const leg = (i) => [r * Math.cos((i / n) * TAU), r * Math.sin((i / n) * TAU)];
  for (let i = 0; i < n; i++) {
    const [x, y] = leg(i), [x2, y2] = leg(i + 1);
    out.push(...beamU([x, y, 0], [x, y, zc], 0.45, C.galv), ...boxU(x - 0.5, y - 0.5, -0.1, x + 0.5, y + 0.5, 0.4, C.conc));
    out.push(...beamU([x, y, 0.5], [x2, y2, zc * 0.55], 0.12, C.galv), ...beamU([x2, y2, 0.5], [x, y, zc * 0.55], 0.12, C.galv));
  }
  // (a stair tower beside it and a walk over to its crown)
  out.push(...beamU([r + 2, -1, 0], [r + 2, -1, zc + r], 0.3, C.stair), ...beamU([r + 3.4, -1, 0], [r + 3.4, -1, zc + r], 0.3, C.stair), ...beamU([r + 2.7, -1, zc + r], [0.5, -1, zc + r + 0.2], 0.8, C.stair));
  return out;
}
/** A gasholder: its bell (r 20.5, up 16) in a guide frame of twelve columns 28 m tall, girder rings at three heights. */
function holder() {
  const R = 22, H = 28, n = 12, out = [...cylU(0, 0, 20.5, 0, 16, 32, C.bell, { top: null }), ...cylU(0, 0, 20.5, 16, 17.2, 32, C.bell, { r1: 17, top: C.bell })];
  const col = (i) => [R * Math.cos((i / n) * TAU), R * Math.sin((i / n) * TAU)];
  for (let i = 0; i < n; i++) {
    const [x, y] = col(i), [x2, y2] = col(i + 1);
    out.push(...beamU([x, y, 0], [x, y, H], 0.8, C.holder));
    for (const z of [9.5, 19, H - 0.4]) out.push(...beamU([x, y, z], [x2, y2, z], 0.5, C.holder));
    out.push(...beamU([x, y, 0.5], [x2, y2, 9.5], 0.15, C.holder), ...beamU([x2, y2, 9.5], [x, y, 19], 0.15, C.holder));
  }
  return out;
}
/** A bank of four silos along x (r 3.6, 24 tall) under a gallery, a headhouse at its +x end. */
function silos() {
  const r = 3.6, h = 24, out = [];
  for (let i = 0; i < 4; i++) out.push(...cylU(i * 2 * r, 0, r, 0, h, 20, C.silo, { top: C.tankRoof }));
  out.push(...boxU(-r, -1.6, h, 7 * r, 1.6, h + 3, C.gallery), ...boxU(7 * r, -4, 0, 7 * r + 8, 4, h + 9, C.silo), ...boxU(7 * r - 0.4, -4.3, h + 9, 7 * r + 8.4, 4.3, h + 9.6, C.gallery));
  return out;
}
/** A shipping container (12.19 × 2.44 × 2.59) along x, its ribs down its sides and its doors' end; pale for its tint. */
function container() {
  const l = 6.095, w = 1.22, h = 2.59, out = [...boxU(-l, -w, 0, l, w, h, C.box)];
  for (let i = 1; i < 16; i++) { const x = -l + (i * 2 * l) / 16; for (const s of [-1, 1]) out.push(F([[x - 0.12, s * (w + 0.02), 0.15], [x + 0.12, s * (w + 0.02), 0.15], [x + 0.12, s * (w + 0.02), h - 0.15], [x - 0.12, s * (w + 0.02), h - 0.15]], [0, s, 0], C.rib)); }
  for (const y of [-0.62, 0.62]) out.push(F([[l + 0.02, y - 0.04, 0.1], [l + 0.02, y + 0.04, 0.1], [l + 0.02, y + 0.04, h - 0.1], [l + 0.02, y - 0.04, h - 0.1]], [1, 0, 0], C.door));
  return out;
}
/** An outdoor transformer along x on its plinth: its tank, radiator fins down its long sides, three bushings, its
 *  conservator on struts. */
function transformer() {
  const out = [...boxU(-2.3, -1.7, 0, 2.3, 1.7, 0.4, C.plinth), ...boxU(-1.6, -1.1, 0.4, 1.6, 1.1, 3.1, C.tx)];
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) { const x = -1.35 + i * 0.45; out.push(...boxU(x - 0.03, s > 0 ? 1.1 : -1.95, 0.7, x + 0.03, s > 0 ? 1.95 : -1.1, 2.8, C.fin)); }
  for (const x of [-0.9, 0, 0.9]) out.push(...insulatorU(x, -0.3, 3.1, 1.7, C.bushing));
  for (const x of [-0.6, 0.6]) out.push(...insulatorU(x, 0.6, 3.1, 0.8, C.bushing));
  out.push(...beamU([-1.1, 0.6, 3.1], [-1.1, 0.6, 3.8], 0.12, C.tx), ...beamU([1.1, 0.6, 3.1], [1.1, 0.6, 3.8], 0.12, C.tx), ...boxU(-1.4, 0.3, 3.8, 1.4, 0.9, 4.4, C.tx));
  return out;
}
/** A substation's gantry spanning x: two columns 12 m, a beam, three insulator strings hung off it. */
function gantry() {
  const out = [...beamU([-6, 0, 0], [-6, 0, 12], 0.5, C.galv), ...beamU([6, 0, 0], [6, 0, 12], 0.5, C.galv), ...beamU([-6.3, 0, 11.7], [6.3, 0, 11.7], 0.6, C.galv)];
  for (const x of [-6, 6]) out.push(...beamU([x, -1.2, 0], [x, 0, 5], 0.2, C.galv), ...beamU([x, 1.2, 0], [x, 0, 5], 0.2, C.galv));
  for (const x of [-3, 0, 3]) out.push(...insulatorU(x, 0, 11.4, -2.2));
  return out;
}
/** A breaker on its stand along x: three post insulators on a steel frame. */
function breaker() {
  const out = [];
  for (const [x, y] of [[-1.2, -0.4], [1.2, -0.4], [-1.2, 0.4], [1.2, 0.4]]) out.push(...beamU([x, y, 0], [x, y, 2.4], 0.14, C.galv));
  out.push(...boxU(-1.4, -0.5, 2.4, 1.4, 0.5, 2.6, C.galv));
  for (const x of [-1, 0, 1]) out.push(...insulatorU(x, 0, 2.6, 1.5), ...boxU(x - 0.15, -0.15, 4.1, x + 0.15, 0.15, 4.4, C.galv));
  return out;
}
// THE PYLON: its line along x, its arms across it (y); a conductor hung at each arm's tip, `drop` under it
export const PYLON = Object.freeze({ arms: [[7, 22], [8.2, 27], [7, 32]], drop: 2.6, peak: 36, span: 85 });
function pylon() {
  const out = [], leg = (sx, sy, z) => { const t = Math.min(1, z / 28), b = 4.2 + (1.1 - 4.2) * t - (z > 28 ? ((z - 28) / 8) * 0.4 : 0); return [sx * b, sy * b, z]; };
  const zs = [0, 6, 11.5, 16.5, 21, 25, 28, 32, 34.5];
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let k = 0; k + 1 < zs.length; k++) for (let c = 0; c < 4; c++) {
    const [sx, sy] = corners[c], [tx, ty] = corners[(c + 1) % 4], z0 = zs[k], z1 = zs[k + 1];
    out.push(...beamU(leg(sx, sy, z0), leg(sx, sy, z1), 0.32, C.galv));
    // (each face braced in an X, a strut across its top)
    out.push(...beamU(leg(sx, sy, z0), leg(tx, ty, z1), 0.1, C.galv), ...beamU(leg(tx, ty, z0), leg(sx, sy, z1), 0.1, C.galv), ...beamU(leg(sx, sy, z1), leg(tx, ty, z1), 0.12, C.galv));
  }
  for (const [reach, z] of PYLON.arms) for (const s of [-1, 1]) {
    const root = leg(1, s, z)[1];
    out.push(...beamU([-0.9, root, z], [0, s * reach, z], 0.16, C.galv), ...beamU([0.9, root, z], [0, s * reach, z], 0.16, C.galv), ...beamU([0, root, z + 2.2], [0, s * reach, z], 0.12, C.galv));
    out.push(...insulatorU(0, s * reach, z, -PYLON.drop + 0.2));
  }
  out.push(...beamU([0, 0, 34.5], [0, 0, PYLON.peak], 0.2, C.galv));
  return out;
}
/** A works' chimney: 40 m, tapered from 1.9 to 1.2, its top three bands red and white, a dark rim. */
function stack() {
  const out = [], H = 40, r = (z) => 1.9 + (1.2 - 1.9) * (z / H);
  const bands = [[0, 31, C.brick], [31, 34, C.red], [34, 37, C.white], [37, 40, C.red]];
  for (const [z0, z1, hex] of bands) out.push(...cylU(0, 0, r(z0), z0, z1, 14, hex, { r1: r(z1), top: z1 === H ? '#2b2b2b' : null }));
  out.push(...cylU(0, 0, 2.6, -0.2, 0.6, 14, C.conc));
  return out;
}
/** A fence's 3 m along x: two posts, its top and bottom rails, a strand of barbed wire on arms leaning out. */
function chainlink() {
  return [...beamU([0, 0, 0], [0, 0, 2.5], 0.07, C.rail), ...beamU([3, 0, 0], [3, 0, 2.5], 0.07, C.rail), ...beamU([0, 0, 2.4], [3, 0, 2.4], 0.05, C.rail), ...beamU([0, 0, 0.15], [3, 0, 0.15], 0.04, C.rail),
    ...beamU([0, 0, 2.5], [0, 0.35, 2.85], 0.04, C.rail), ...beamU([0, 0.35, 2.85], [3, 0.35, 2.85], 0.02, '#3a3c3e'), ...beamU([0, 0.2, 2.68], [3, 0.2, 2.68], 0.02, '#3a3c3e'),
    // (its mesh read as its wires: a strand every 30 cm, an opaque panel would read as a wall)
    ...[0.45, 0.75, 1.05, 1.35, 1.65, 1.95, 2.25].flatMap((z) => beamU([0, 0, z], [3, 0, z], 0.012, '#7d8285'))];
}
/** A pipe rack's 6 m along x: two bents, three pipes on their beam. */
function piperack() {
  const out = [];
  for (const x of [0, 6]) out.push(...beamU([x, -1.5, 0], [x, -1.5, 5], 0.3, C.galv), ...beamU([x, 1.5, 0], [x, 1.5, 5], 0.3, C.galv), ...beamU([x, -1.7, 5], [x, 1.7, 5], 0.35, C.galv));
  [[-0.9, 0.35, C.pipe], [0, 0.25, C.pipe2], [0.9, 0.45, C.tank]].forEach(([y, r, hex]) => { for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, b = ((i + 1) / 8) * TAU, m = (a + b) / 2; out.push(F([[0, y + r * Math.cos(a), 5.2 + r + r * Math.sin(a)], [6, y + r * Math.cos(a), 5.2 + r + r * Math.sin(a)], [6, y + r * Math.cos(b), 5.2 + r + r * Math.sin(b)], [0, y + r * Math.cos(b), 5.2 + r + r * Math.sin(b)]], [0, Math.cos(m), Math.sin(m)], hex)); } });
  return out;
}

const MEMO = new WeakMap();
/** The industrial pieces under a scene's light, once a light. */
export function industryTemplates(L) {
  let T = MEMO.get(L);
  if (T) return T;
  T = {
    tank: lit(tank(), L), sphere: lit(sphere(), L), holder: lit(holder(), L), breaker: lit(breaker(), L), stack: lit(stack(), L),
    silos: both(silos, L), container: both(container, L), transformer: both(transformer, L), gantry: both(gantry, L), pylon: both(pylon, L), chainlink: both(chainlink, L), piperack: both(piperack, L),
  };
  MEMO.set(L, T);
  return T;
}
/** A shipping container as it is built, unlit, along x about its foot: [{ corners, normal, hex }] (a stage stacks them on a
 *  building's apron and lights them as it lights the building, era/stage-buildings.js). Its body pale for an instance's tint. */
export function containerRaw() { return container(); }
/** How far each piece is seen (m): the tall ones across their district, the rest near the camera like the street's kit. */
export const INDUSTRY_FAR = Object.freeze(['tank', 'sphere', 'holder', 'silos', 'stack', 'pylon']);

// ── the blocks ───────────────────────────────────────────────────────────────────────────────────────────────────
// the walls: corrugated steel on a works, cladding on a warehouse, block on a substation's control house
export const INDUSTRY_PAINT = Object.freeze({ works: ['#9ea5a9', '#a89e8c', '#8f9a8e', '#b2aa9a'], warehouse: ['#c8cdd1', '#d6d2c6', '#b9c2c9'], roof: ['#7b8287', '#6f767b', '#8a8f92'], control: '#bdb8ad', lantern: '#9fb3bd', canopy: '#5d6266' });
export const CONTAINER_PAINT = Object.freeze(['#b8402e', '#2f5d8a', '#3d7a4a', '#c98b2b', '#6b6f73', '#8a2f2f', '#d9d4c6']);

const pick = (R, xs) => xs[Math.floor(R() * xs.length)];
// THE FINISHES: each industrial building's family and the variants it is drawn from by its block's dice, each its wall's
// material word and its roof's (era/arch-style.js MATERIAL_WORDS: a works' sheet in its paints or let go to rust, or an
// old works' brick; a warehouse's cladding or tilt-up concrete under a membrane; a control house's block or brick)
export const INDUSTRY_FINISHES = Object.freeze({
  works: { galv: ['corrugated', 'standing-seam'], red: ['corrugated-red', 'standing-seam'], green: ['corrugated-green', 'standing-seam'], cream: ['corrugated-cream', 'standing-seam'], blue: ['corrugated-blue', 'standing-seam'], rusted: ['corrugated-rusted', 'standing-seam'], brick: ['factory-brick', 'standing-seam'] },
  warehouse: { white: ['cladding', 'membrane'], grey: ['cladding-grey', 'membrane'], blue: ['cladding-blue', 'membrane'], tilt: ['tilt-up', 'membrane'] },
  control: { block: ['cmu', 'membrane'], brick: ['factory-brick', 'membrane'] },
  shed: { galv: ['corrugated', 'standing-seam'], red: ['corrugated-red', 'standing-seam'], green: ['corrugated-green', 'standing-seam'], rusted: ['corrugated-rusted', 'standing-seam'] },
});
/** A building of a family dressed by the dice: its group (`geocity:<family>-<variant>`, the scene's finish for it) and
 *  its wall's and roof's colours (its words', for where it is drawn without its tiles). */
export function finishOf(family, R) {
  const vs = Object.keys(INDUSTRY_FINISHES[family]), v = vs[Math.floor(R() * vs.length)], [w, r] = INDUSTRY_FINISHES[family][v];
  return { group: `geocity:${family}-${v}`, wall: MATERIAL_WORDS[w].colour, roof: MATERIAL_WORDS[r].colour };
}
/** A block's plan: what stands on it, each op the scene draws. `long` its long axis ('x' or 'y'), `front` the side its
 *  street is on (the side its yard opens to). */
export function industrialPlan(b, R, { far = false } = {}) {
  const [x0, y0, x1, y1] = b.rect, w = x1 - x0, h = y1 - y0, longY = h >= w, ops = [];
  // its frame: `a` along its long axis, `s` across it; P(a, s) the point
  const [a0, a1] = longY ? [y0, y1] : [x0, x1], [s0, s1] = longY ? [x0, x1] : [y0, y1], P = (a, s) => (longY ? [s, a] : [a, s]);
  const Q = (aa0, ss0, aa1, ss1) => { const p = P(aa0, ss0), q = P(aa1, ss1); return [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])]; };
  // (its front: the long side on an arterial or a street, else the low one)
  const sideKeys = longY ? ['w', 'e'] : ['s', 'n'], rank = (k) => (b.sides?.[k]?.kind === 'arterial' ? 2 : b.sides?.[k]?.kind === 'street' ? 1 : 0);
  const front = rank(sideKeys[1]) > rank(sideKeys[0]) ? 1 : -1, sFront = front < 0 ? s0 : s1, sBack = front < 0 ? s1 : s0, inward = -front;
  const axisAlong = longY ? 'y' : 'x', axisAcross = longY ? 'x' : 'y', noseIn = (k) => (longY ? [k, 0] : [0, k]);
  const fence = () => ops.push({ op: 'fence', q: [x0 + 1.5, y0 + 1.5, x1 - 1.5, y1 - 1.5] });
  const L = a1 - a0, D = s1 - s0;
  if (b.kind === 'works' || b.kind === 'warehouse') {
    const ware = b.kind === 'warehouse', fin = finishOf(ware ? 'warehouse' : 'works', R), paint = fin.wall, roof = fin.roof;
    // the hall: back from its front by its yard (a truck's court before its doors), most of its length
    const court = Math.min(D * 0.42, ware ? 38 : 30), hallS0 = sFront + inward * court, hallS1 = sBack - inward * 6, la0 = a0 + 8, la1 = a1 - (ware ? 8 : 26);
    const q = Q(la0, Math.min(hallS0, hallS1), la1, Math.max(hallS0, hallS1)), eave = ware ? 11 + R() * 3 : 8 + R() * 4;
    if (ware) ops.push({ op: 'box', q, z: 0, h: eave, group: fin.group, wall: paint, roof });
    else {
      ops.push({ op: 'gable', q, z: 0, ze: eave, zr: eave + Math.min(q[2] - q[0], q[3] - q[1]) * 0.07, axis: axisAlong, group: fin.group, wall: paint, roof });
      // (its lantern along its ridge: a clerestory's glazing over the floor)
      const mid = (hallS0 + hallS1) / 2, rq = Q(la0 + 6, mid - 2, la1 - 6, mid + 2), zr = eave + Math.min(q[2] - q[0], q[3] - q[1]) * 0.07;
      if (!far) ops.push({ op: 'box', q: rq, z: zr - 0.3, h: 1.6, group: 'geocity:works:lantern', wall: INDUSTRY_PAINT.lantern, roof });
    }
    // (its windows: a ribbon of glazing high along its long walls; a warehouse's along its back and its ends)
    const backKey = longY ? (front < 0 ? 'e' : 'w') : (front < 0 ? 'n' : 's'), ends = longY ? ['s', 'n'] : ['w', 'e'];
    if (!far) ops.push(ware ? { op: 'ribbon', q, z: eave - 2.4, h: 1.1, sides: [backKey, ...ends], pitch: 4.2, w: 3.6 } : { op: 'ribbon', q, z: eave - 2.8, h: 1.6, sides: longY ? ['w', 'e'] : ['s', 'n'], pitch: 3.4, w: 3 });
    // its office at its front end, in block: two or three storeys
    if (!ware) {
      const cf = finishOf('control', R), cq = Q(a1 - 24, Math.min(sFront + inward * 6, sFront + inward * 20), a1 - 6, Math.max(sFront + inward * 6, sFront + inward * 20)), st = 2 + Math.floor(R() * 2);
      ops.push({ op: 'box', q: cq, z: 0, h: 3.6 * st, group: cf.group, wall: cf.wall, roof: cf.roof });
      // (its office's windows, a row a storey on every side)
      if (!far) ops.push({ op: 'punched', q: cq, storeys: st, floorH: 3.6, sides: ['s', 'e', 'n', 'w'], pitch: 2.8, w: 1.6, h: 1.5 });
    }
    if (far) return ops;
    // its doors on its yard side: a warehouse's docks every 4.5 m (a canopy over them, a truck backed in to some), a
    // works' roller doors wider apart
    const pitch = ware ? 4.6 : 14, dw = ware ? 3 : 5, dh = ware ? 3.2 : 5.5;
    const face = hallS0;
    const side = longY ? (front < 0 ? 'w' : 'e') : (front < 0 ? 's' : 'n');
    for (let a = la0 + pitch; a + dw / 2 <= la1 - pitch / 2; a += pitch) {
      ops.push({ op: 'door', side, a, w: dw, h: dh, at: face });
      if (ware && R() < 0.45) { const c = P(a, face - inward * 9); ops.push({ op: 'vehicle', role: 'delivery', at: c, nose: noseIn(-inward) }); }
    }
    if (ware) ops.push({ op: 'box', q: Q(la0, Math.min(face, face - inward * 3.5), la1, Math.max(face, face - inward * 3.5)), z: dh + 0.4, h: 0.4, group: 'geocity:canopy', wall: INDUSTRY_PAINT.canopy, roof: INDUSTRY_PAINT.canopy });
    else for (let k = 0; k < 2; k++) if (R() < 0.6) ops.push({ op: 'vehicle', role: 'delivery', at: P(la0 + 20 + k * 30, face - inward * 12), nose: noseIn(-inward) });
    // a works' stack, some; its back end's containers and pallets of stock
    if (!ware && R() < 0.45) ops.push({ op: 'stamp', key: 'stack', at: P(la1 + 10, (hallS0 + hallS1) / 2) });
    if (!ware) for (let k = 0; k < 4; k++) if (R() < 0.7) ops.push({ op: 'stamp', key: `container:${axisAcross}`, at: P(la1 + 6 + k * 3.2, sBack - inward * 14), tint: pick(R, CONTAINER_PAINT) });
    // a lot for its people at its far end
    for (let k = 0; k < 6; k++) if (R() < 0.6) ops.push({ op: 'vehicle', role: 'civilian', at: P(a0 + 4 + k * 2.6 * 1.0, sFront + inward * 5), nose: noseIn(inward) });
    fence();
    if (b.kind === 'works' && R() < 0.3) ops.push({ op: 'stamp', key: 'celltower', at: P(a0 + 5, sBack - inward * 5) });
  } else if (b.kind === 'storage') {
    if (R() < 0.3) ops.push({ op: 'stamp', key: 'celltower', at: P(a1 - 5, sBack - inward * 5) });
    // container stacks in rows along it, two to four high, a straddle lane between each two rows; a bank of silos
    const silo = R() < 0.6, la1 = silo ? a1 - 34 : a1 - 6;
    for (let s = s0 + 8; s + 2.6 <= s1 - 8; s += 2.6 * 2 + 9) for (const ds of [0, 2.6]) for (let a = a0 + 10; a + 12.4 <= la1; a += 12.6) {
      if (R() < 0.12) continue;
      const n = 1 + Math.floor(R() * 4);
      for (let k = 0; k < n; k++) ops.push({ op: 'stamp', key: `container:${axisAlong}`, at: P(a + 6.1, s + ds + 1.3), z: k * 2.6, tint: pick(R, CONTAINER_PAINT) });
    }
    if (silo) ops.push({ op: 'stamp', key: `silos:${axisAcross}`, at: P(a1 - 20, s0 + 8) });
    { const sf = finishOf('shed', R), sq = Q(a0 + 2, sFront + inward * 2, a0 + 14, sFront + inward * 10); ops.push({ op: 'box', q: sq, z: 0, h: 4, group: sf.group, wall: sf.wall, roof: sf.roof }); if (!far) ops.push({ op: 'punched', q: sq, storeys: 1, floorH: 4, sides: ['s', 'e', 'n', 'w'], pitch: 3, w: 1.4, h: 1.2 }); }
    fence();
  } else if (b.kind === 'tanks') {
    // the tank farm: tanks in bunded rows, a pipe rack down its middle; gas spheres at one end; a gasholder where
    // there is room
    const big = L > 150 && D > 70 && R() < 0.6;
    const la1 = big ? a1 - 56 : a1 - 26, mid = (s0 + s1) / 2;
    for (const side of [-1, 1]) {
      const sc = mid + side * Math.min(D / 4 + 2, 17), rows = [];
      for (let a = a0 + 16; a + 12 <= la1; a += 26) rows.push(a);
      for (const a of rows) { const k = 0.75 + R() * 0.4; ops.push({ op: 'stamp', key: 'tank', at: P(a, sc), scale: r4(Math.min(k, (D / 4 - 3) / 10.5)) }); }
      if (rows.length) ops.push({ op: 'bund', q: Q(a0 + 3, sc - 13, la1 + 1, sc + 13) });
    }
    for (let a = a0 + 6; a + 6 <= la1; a += 6) ops.push({ op: 'stamp', key: `piperack:${axisAlong}`, at: P(a, mid) });
    if (big) ops.push({ op: 'stamp', key: 'holder', at: P(a1 - 28, mid) });
    else for (let k = 0; k < 2; k++) ops.push({ op: 'stamp', key: 'sphere', at: P(a1 - 13, mid + (k ? 1 : -1) * Math.min(10, D / 4)) });
    fence();
  } else if (b.kind === 'substation') {
    // the switchyard: its transformers in a row, a gantry over each bay, breakers between; its control house
    const bays = Math.max(2, Math.min(5, Math.floor((L - 30) / 16)));
    for (let k = 0; k < bays; k++) {
      const a = a0 + 14 + k * 16;
      ops.push({ op: 'stamp', key: `transformer:${axisAcross}`, at: P(a, s0 + D * 0.3) });
      ops.push({ op: 'stamp', key: `gantry:${axisAcross}`, at: P(a, s0 + D * 0.62) });
      for (const ds of [-0.2, 0.2]) ops.push({ op: 'stamp', key: 'breaker', at: P(a, s0 + D * (0.46 + ds * 0.4)) });
    }
    { const cf = finishOf('control', R), cq = Q(a1 - 22, sFront + inward * 4, a1 - 6, sFront + inward * 14); ops.push({ op: 'box', q: cq, z: 0, h: 4.8, group: cf.group, wall: cf.wall, roof: cf.roof }); if (!far) ops.push({ op: 'punched', q: cq, storeys: 1, floorH: 4.8, sides: ['s', 'e', 'n', 'w'], pitch: 2.8, w: 1.6, h: 1.4 }); }
    fence();
  }
  return ops;
}
