/** body-detail/body-detail.mjs — the head's detail principles on the dragon body's segments, as a post-compile
 * layer over the dragon body recipe, through the core detail operators (station-loft-detail.js).
 *   node body-detail.mjs      → body-detail.png (rest / posed, before / after) + stats.json in the spike tree
 * Species-free passes (BODY DATA at the bottom names the anatomy):
 *   density   refine joint zones (stations) and limb rings (slots); claw pins migrated by address
 *   volume    volumize by name (chest, biceps, thigh)
 *   creases   per joint: rows either side of the bend, one strip per ring quadrant, height ∝ how much that
 *             quadrant faces the INSIDE of the bend × the bend angle, both read from the compiled mesh
 *   rigid     tiles/spines/collars only where the dominant bone's bind weight ≥ RIGID over the footprint
 *   pads      dishes on the side a joint's bend faces (palm) or the ground faces (sole)
 *   spurs     sweeps on the outside of a bend, in the rigid zone
 *   spines    a dorsal row on symmetric midline frames
 *   collars   tail rings at the rigid mid-station */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const CORE = new URL('../../../control/lib/graph/polygonizer/', import.meta.url).href;
const { compileLayered } = await import(`${CORE}station-loft.js`);
const { vec } = await import(`${CORE}station-loft-detail.js`);
const { detailBody, dominance, bend, facing, RIGID } = await import(`${CORE}station-loft-body.js`);
const { orbitCamera, projectVertices } = await import(new URL('../../../control/lib/graph/scene/wire-svg.js', import.meta.url).href);
const { sub, dot, cross, unit } = vec;
const OUT = () => { const o = resolve(process.env.MOJULO_SPIKE_OUT || fileURLToPath(new URL('../../../lite-template/integration/0924/spike-output/body-detail/', import.meta.url))); mkdirSync(o, { recursive: true }); return o; };
const RECIPE = JSON.parse(readFileSync(new URL('../dragon-body/recipe.json', import.meta.url), 'utf8'));
const mirrorName = (n) => n.replace(/([RL])$/, (m) => (m === 'R' ? 'L' : 'R'));
const both = (names) => names.flatMap((n) => (/[RL]$/.test(n) ? [n, mirrorName(n)] : [n]));

// ═══════════ BODY DATA (the dragon body; species lives here) ═══════════
const FINGERS = ['A', 'B', 'C'];
const LIMB_PARTS = both(['upperArmR', 'foreArmR', 'handR', 'thighR', 'shinR', 'metaR', 'toesR', ...FINGERS.flatMap((X) => [`finger${X}1R`, `finger${X}2R`])]);
const TAIL = [0, 1, 2, 3, 4].map((i) => `tail${i}`);
const JOINTS = [['pelvis', 'torso'], ['torso', 'neck'], ...TAIL.slice(1).map((t, i) => [TAIL[i], t]),
  ...['R', 'L'].flatMap((S) => [[`upperArm${S}`, `foreArm${S}`], [`foreArm${S}`, `hand${S}`], [`thigh${S}`, `shin${S}`], [`shin${S}`, `meta${S}`], [`meta${S}`, `toes${S}`],
    ...FINGERS.flatMap((X) => [[`hand${S}`, `finger${X}1${S}`], [`finger${X}1${S}`, `finger${X}2${S}`]])])];
const TILES = [
  // belly scutes: one wide column each side of the ventral midline (torso `front` faces +y), shingled downward
  { parts: ['torso'], s: [0.1, 3.9], t: [0, 0.95], grid: [10, 1], sides: 4, coverage: 1.02, inset: 0.1, height: 0.016, lean: -0.5, group: ['Scute', 'ScuteAlt'] },
  { parts: ['pelvis'], s: [0.1, 1.9], t: [0, 0.95], grid: [5, 1], sides: 4, coverage: 1.02, inset: 0.1, height: 0.016, lean: -0.5, group: ['Scute', 'ScuteAlt'] },
  // tail underside scutes (tail `front` faces down)
  { parts: TAIL, s: [0.05, 1.95], t: [0, 0.7], grid: [4, 1], sides: 4, coverage: 1.02, inset: 0.12, height: 0.012, lean: 0.5, group: ['Scute', 'ScuteAlt'] },
  // hex scales on the outer forearm, shin and thigh; plates on the shoulder
  { parts: ['foreArmR', 'foreArmL'], s: [0.2, 1.8], t: [0.9, 3], grid: [6, 3], brick: true, sides: 6, coverage: 1.2, inset: 0.35, height: 0.008, lean: -0.8, thin: 0.4, wobble: 0.2, jitter: 0.3, edgeFade: 0.2, group: ['Scales', 'ScalesAlt'] },
  { parts: ['shinR', 'shinL'], s: [0.2, 1.8], t: [0.6, 2.6], grid: [6, 3], brick: true, sides: 6, coverage: 1.2, inset: 0.35, height: 0.008, lean: -0.8, thin: 0.4, wobble: 0.2, jitter: 0.3, edgeFade: 0.2, group: ['Scales', 'ScalesAlt'] },
  { parts: ['thighR', 'thighL'], s: [0.3, 1.7], t: [1.0, 2.4], grid: [4, 2], brick: true, sides: 6, coverage: 1.15, inset: 0.3, height: 0.012, lean: -0.6, wobble: 0.15, jitter: 0.2, edgeFade: 0.2, group: ['Plates'] },
  { parts: ['upperArmR', 'upperArmL'], s: [0.3, 1.7], t: [0.9, 2.3], grid: [3, 2], brick: true, sides: 6, coverage: 1.2, inset: 0.3, height: 0.014, lean: -0.7, wobble: 0.1, group: ['Plates'] },
];
const VOLUME = [ // [part, slots, stations, metres]
  ['torso', { 'front*': 0.8, 'side*': 0.4 }, { st3: 1, st2: 0.4 }, 0.045],                   // pectorals
  ...['R', 'L'].flatMap((S) => [[`upperArm${S}`, { front: 1, 'front*': 0.6 }, { st1: 1 }, 0.03],    // biceps
    [`thigh${S}`, { front: 1, 'front*': 0.7 }, { st1: 1, st0: 0.3 }, 0.035],                           // quadriceps
    [`shin${S}`, { back: 1, 'back*': 0.6 }, { st0: 0.6, st1: 1 }, 0.025]])];                          // calf
const PADS = [ // palm: the inside of the knuckle bend; soles and fingertips: the ground / grip side
  ...['R', 'L'].flatMap((S) => [{ part: `hand${S}`, s: 1.3, toward: { flex: [`hand${S}`, `fingerB1${S}`], drive: { grip: 45 } }, r: 0.5 },
    { part: `toes${S}`, s: 1.0, toward: { world: [0, 0, -1] }, r: 0.55 }, { part: `meta${S}`, s: 1.2, toward: { world: [0, 0, -1] }, r: 0.5 },
    ...FINGERS.map((X) => ({ part: `finger${X}2${S}`, s: 1.0, toward: { flex: [`finger${X}1${S}`, `finger${X}2${S}`], drive: { grip: 45 } }, r: 0.6 }))])];
const SPURS = ['R', 'L'].flatMap((S) => [{ part: `foreArm${S}`, s: 0.62, away: [`upperArm${S}`, `foreArm${S}`] }, { part: `meta${S}`, s: 0.62, away: [`shin${S}`, `meta${S}`] }]);
const SPINES = [{ part: 'torso', t: 'back', s: [1.9, 3.5], step: 0.3, r: 0.07, rake: 1 }, ...TAIL.map((p) => ({ part: p, t: 'back', s: [0.6, 1.4], step: 0.4, size: 0.55, rake: -1 }))];
const COLLARS = TAIL.map((p) => ({ part: p, at: 'st1', height: 0.07 }));
const PALETTE = { Crease: '#34402d', Scute: '#b8b08a', ScuteAlt: '#aea57f', Scales: '#56664b', ScalesAlt: '#617257', Plates: '#6d7d60', Pad: '#4d5a44', PadInner: '#3a3530', Spur: '#e3dcc6', Spine: '#cfc5a6', Ring: '#5d6e52' };

/** the dragon body's passes as BODY DATA over the core (station-loft-body.js): the limbs and the tail refined with the
 * limb6 ring bands, the torso's stations only */
const BODY = { refine: [{ parts: [...LIMB_PARTS, ...TAIL] }, { parts: ['torso'], slots: false }], volume: VOLUME, creases: { joints: JOINTS }, tiles: TILES, pads: PADS, spurs: SPURS, rows: SPINES, collars: COLLARS };

// ═══════════ build ═══════════
function build(src, dials = {}, detail = true) {
  if (!detail) return { mesh: compileLayered(src, dials), parts: {}, stats: { gatedTiles: 0 }, r: src };
  const { mesh, parts, stats, r } = detailBody(src, BODY, dials); return { mesh, parts, stats, r };
}

// ═══════════ source, audit, raster ═══════════
function toSource({ mesh, parts }, palette) { const V = [...mesh.vertices], F = [...mesh.faces], C = []; let open = 0, wind = 0;
  const tintOf = Object.fromEntries(Object.entries(mesh.parts).map(([k, p]) => [k, p.tint])); const pal = { ...(RECIPE.palette || {}), ...palette };
  mesh.faces.forEach((f, i) => C.push(pal[mesh.groups[i]] || tintOf[mesh.provenance[f[0]].part] || '#8a8f96'));
  for (const d of Object.values(parts)) { const idx = {}; for (const [k, p] of Object.entries(d.points)) { idx[k] = V.length; V.push(p); } const fg = d.faceGroups;
    d.faces.forEach((f, i) => { F.push(f.map((k) => idx[k])); C.push(pal[fg ? fg[i] : d.group] || '#ff00ff'); });
    const E = new Map(); for (const f of d.faces) for (let i = 0; i < 3; i++) { const a = f[i], b = f[(i + 1) % 3]; const key = a < b ? `${a}|${b}` : `${b}|${a}`; const e = E.get(key) || [0, 0]; e[0]++; e[1] += a < b ? 1 : -1; E.set(key, e); }
    for (const [c, bal] of E.values()) { if (c !== 2) open++; else if (bal) wind++; } }
  return { vertices: V, faces: F, colors: C, audit: { detailParts: Object.keys(parts).length, open, wind } }; }
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const LIGHT = unit([0.35, -0.55, 0.75]); const BG = [247, 245, 239];
function raster(src, cam, size, ss = 2) { const P = projectVertices(src.vertices, cam); const N = size * ss; const img = new Uint8Array(N * N * 3); const zb = new Float64Array(N * N).fill(Infinity);
  for (let i = 0; i < N * N; i++) img.set(BG, 3 * i);
  src.faces.forEach((f, fi) => { const [a, b, c] = f.map((k) => src.vertices[k]); const k = 0.5 + 0.55 * Math.max(0, dot(unit(cross(sub(b, a), sub(c, a))), LIGHT)); const col = hex(src.colors[fi]).map((x) => Math.min(255, Math.round(x * k)));
    const [[ax, ay, az], [bx, by, bz], [cx, cy, cz]] = f.map((v) => [P[v][0] * ss, P[v][1] * ss, P[v][2]]); const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-12) return;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(N - 1, Math.ceil(Math.max(ax, bx, cx))), y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(N - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const px = x + 0.5, py = y + 0.5; const w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den, w2 = 1 - w0 - w1;
      if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue; const z = 1 / (w0 / az + w1 / bz + w2 / cz); const idx = y * N + x; if (z < zb[idx]) { zb[idx] = z; img.set(col, 3 * idx); } } });
  const M = size, out = new Uint8Array(M * M * 3); for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) for (let ch = 0; ch < 3; ch++) { let t = 0; for (let dy = 0; dy < ss; dy++) for (let dx = 0; dx < ss; dx++) t += img[3 * ((y * ss + dy) * N + x * ss + dx) + ch]; out[3 * (y * M + x) + ch] = Math.round(t / (ss * ss)); }
  return out; }
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function png(rgb, w, h) { const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); }
function sheet(cells, cols, size) { const rows = Math.ceil(cells.length / cols); const W = cols * size, out = new Uint8Array(W * rows * size * 3).fill(BG[0]);
  cells.forEach((c, i) => { const ox = (i % cols) * size, oy = Math.floor(i / cols) * size; for (let y = 0; y < size; y++) out.set(c.subarray(y * size * 3, (y + 1) * size * 3), 3 * ((oy + y) * W + ox)); }); return png(out, W, rows * size); }

export { build, toSource, bend, dominance, facing, RECIPE, PALETTE, JOINTS, RIGID, BODY };
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const t0 = Date.now(); const poses = { rest: {}, grip: { grip: 45, tailCurl: 20, lean: 15 } };
  const S = 520; const views = [['front34', 150, 8, [0, 0.1, 1.3], 3.9], ['side', 90, 5, [0, -0.3, 1.1], 5.0], ['back34', 330, 12, [0, -0.3, 1.3], 3.9], ['hand', 120, -5, [0.66, 0.35, 0.72], 1.3], ['foot', 110, 10, [0.32, 0.1, 0.25], 1.4], ['tail', 250, 25, [0, -1.1, 0.7], 2.6]];
  const stats = {}; const cells = [];
  for (const [pname, dials] of Object.entries(poses)) for (const detail of [false, true]) { const B = build(RECIPE, dials, detail); const src = toSource(B, PALETTE);
    stats[`${pname}-${detail ? 'after' : 'before'}`] = { faces: src.faces.length, ...src.audit, gatedTiles: B.stats.gatedTiles };
    for (const [, az, el, tgt, dist] of views) cells.push(raster(src, orbitCamera({ azimuthDegrees: az, elevationDegrees: el, target: tgt, distance: dist, focalPixels: 1200, size: S }), S)); }
  // rows: rest-before, rest-after, grip-before, grip-after; columns: views
  writeFileSync(`${OUT()}/body-detail.png`, sheet(cells, views.length, S)); writeFileSync(`${OUT()}/stats.json`, JSON.stringify(stats, null, 1));
  console.log(JSON.stringify(stats), `${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
