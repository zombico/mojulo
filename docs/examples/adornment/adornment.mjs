/** adornment/adornment.mjs — adornment as its own layer over a built-up creature:
 * body → segment detail → wings → ADORNMENT. Each adornment reads what is beneath it and never writes it.
 *
 * MUGEN on a layered creature: an adornment point is an ADDRESS on its carrier, lifted along that address's
 * normal by the height of everything beneath it (body, segment detail, earlier adornment; the hat's rule, true
 * stacking) plus its mugen. The height field is smoothed (a max then a mean, the garments' min-shield) so the
 * adornment follows the gross line, not every scale. Detail that declares `pokes` (spurs, spines) is left out of
 * the hull and pokes through (P5: openings = poke-through − cover).
 *
 * Attachment modes: SHELL (a window of the carrier, wrapped or partial), BAND (a narrow wrapped shell), STRAP (a
 * path of addresses, across parts' halves), HANG (a chain from an anchor, gravity plus clearance), and the
 * SIGNATURE: every adornment names one recognizable visual element, which the exposure ledger must find reading.
 * Builds on the body-detail and wings examples. `node adornment.mjs` writes build-up.png and report.json to the spike tree. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const CORE = new URL('../../../control/lib/graph/polygonizer/', import.meta.url).href;
const { vec } = await import(`${CORE}station-loft-detail.js`);
const AD = await import(`${CORE}station-loft-adorn.js`);
const { shell, strap, hang, clearOf, beneathOf, hullHeight } = AD;
/** the ledger over a worn kit (its record): every signature must read and be a real share of its adornment's picture */
const justify = (src, worn) => AD.justify(src, worn.record);
const { orbitCamera, projectVertices } = await import(new URL('../../../control/lib/graph/scene/wire-svg.js', import.meta.url).href);
const BD = await import(new URL('../body-detail/body-detail.mjs', import.meta.url).href);
const WG = await import(new URL('../wings/wings.mjs', import.meta.url).href);
const { sub, dot, cross, unit } = vec;
const OUT = () => { const o = resolve(process.env.MOJULO_SPIKE_OUT || fileURLToPath(new URL('../../../lite-template/integration/0924/spike-output/adornment/', import.meta.url))); mkdirSync(o, { recursive: true }); return o; };

// ═══════════ ADORNMENT DATA ═══════════
const METAL = 'Iron', BRONZE = 'Bronze', LEATHER = 'Leather', GOLD = 'Gold';
/** each adornment: a mode, where it sits, its mugen, and its SIGNATURE — the one element that justifies it, a named
 * element from the core library (station-loft-adorn.js SIGNATURES) with its numbers */
const DRAGON_KIT = (S) => [
  { id: `bracer${S}`, mode: 'shell', part: `foreArm${S}`, s: [0.62, 1.38], t: 'wrap', mugen: 0.012, thick: 0.01, group: METAL, rigid: true,
    signature: { kind: 'boss', side: S, t: 1.5, tol: 0.2, r: 0.045, h: 0.03, m: 12, rim: 0.55, group: BRONZE } },
  { id: `pauldron${S}`, mode: 'shell', part: 'torso', over: [`upperArm${S}`], side: S, s: [2.55, 3.5], t: [1.1, 2.9], nt: 10, mugen: 0.014, thick: 0.014, group: METAL, rigid: true, rad: 0.09, support: 3.5, ramp: 1.2,
    signature: { kind: 'spike', k: 'mid', j: -2, rise: 1.2, sink: 0.01, len: [0.12, 0.26, 0.38], r: [0.075, 0.05, 0.02], m: 6, group: METAL } },
];
const DRAGON_MID = [
  { id: 'belt', mode: 'shell', part: 'pelvis', s: [1.5, 1.9], t: 'wrap', nt: 14, ns: 2, mugen: 0.012, thick: 0.014, group: LEATHER,
    signature: { kind: 'buckle', k: 0, j: 1, w: 0.075, h: 0.06, bar: 0.012, standoff: 0.01, group: GOLD } },
  { id: 'harness', mode: 'strap', part: 'torso', path: [[3.7, 2.2, 'R'], [3.3, 1.2, 'R'], [2.6, 0.45, 'R'], [2.0, 0.05, 'R'], [1.5, 0.5, 'L'], [0.9, 1.3, 'L'], [0.45, 2.0, 'L']], width: 0.07, thick: 0.012, mugen: 0.01, group: LEATHER, rad: 0.06,
    signature: { kind: 'ring', R: 0.06, r: 0.012, lean: [0, 0.4, 0], standoff: 0.02, m: 14, rm: 6, group: BRONZE } },
  { id: 'collar', mode: 'shell', part: 'neck', s: [0.55, 1.05], t: 'wrap', nt: 14, ns: 2, mugen: 0.012, thick: 0.02, group: METAL,
    signature: { kind: 'medallion', k: 0, j: 0, anchor: [0, 0.01, -0.01], links: 6, len: 0.045, clear: 0.05, link: 0.006, surfaces: ['torso'], out: [0, 1, 0], drop: 0.07, dropClear: 0.06, face: [0, 1, 0.15], r: 0.07, h: 0.022, m: 14, rim: 0.6, group: GOLD, beneath: ['torso'] } },
];
const VULTURE_KIT = [
  { id: 'hood', mode: 'shell', part: 'head', s: [0.1, 1.45], t: 'wrap', nt: 12, ns: 5, mugen: 0.004, thick: 0.006, group: 'HoodLeather', support: 0.1, ramp: 0.8,
    signature: { kind: 'plume', k: 0, j: 2, spread: [-1, 0, 1], spine: [[0, 0, -0.006], [0.012, -0.012, 0.028], [0.022, -0.035, 0.05], [0.03, -0.065, 0.058], [0.034, -0.095, 0.05]], r: [0.008, 0.014, 0.012, 0.006], m: 6, squash: [1, 0.45], group: 'Plume' } },
  ...['R', 'L'].map((S) => ({ id: `jess${S}`, mode: 'shell', part: `tarsus${S}`, s: [0.7, 1.05], t: 'wrap', nt: 10, ns: 2, mugen: 0.004, thick: 0.008, group: LEATHER,
    signature: { kind: 'bell', side: S, after: 1.2, links: 2, len: 0.018, clear: 0.02, link: 0.003, profile: [0.5, 0.95, 1, 0.9, 0.55], r: 0.017, top: 0.008, step: 0.007, m: 10, capTop: 0.004, capBottom: 0.045, group: GOLD, beneath: [`tarsus${S}`, `toeF${S}`, `toeB${S}`] } })),
];

// ═══════════ build up the figure ═══════════
const wear = (fig, kit) => AD.wear(fig, kit, { recipe: BD.RECIPE });
const PALETTE = { Iron: '#8e9196', Bronze: '#b0864c', Leather: '#5b3a24', Gold: '#d5aa3a', HoodLeather: '#6d3e22', Plume: '#b8322a' };
function dragonStages() { const base = BD.build(BD.RECIPE, {}, false); const detail = BD.build(BD.RECIPE, {}, true); const W = WG.dragon(0);
  const wings = Object.fromEntries(Object.entries(W.parts)); const pal = { ...BD.PALETTE, ...W.palette, ...PALETTE };
  const s0 = { mesh: base.mesh, parts: {} }, s1 = { mesh: detail.mesh, parts: detail.parts }, s2 = { mesh: detail.mesh, parts: { ...detail.parts, ...wings } };
  const kit = [...DRAGON_KIT('R'), ...DRAGON_KIT('L'), ...DRAGON_MID]; const worn = wear(s2, kit); const s3 = { mesh: detail.mesh, parts: { ...s2.parts, ...worn.parts } };
  return { stages: [s0, s1, s2, s3], palette: pal, worn }; }
function vultureStages() { const V = WG.vulture(0); const isWing = (k) => /^(humerus|ulna|hand|tertial|secondary|primary|greaterCovert|lesserCovert)/.test(k); const isDetail = (k) => !isWing(k);
  const pick = (f) => Object.fromEntries(Object.entries(V.parts).filter(([k]) => f(k)));
  const s0 = { mesh: V.mesh, parts: {} }, s1 = { mesh: V.mesh, parts: pick(isDetail) }, s2 = { mesh: V.mesh, parts: V.parts }; const worn = wear(s2, VULTURE_KIT); const s3 = { mesh: V.mesh, parts: { ...V.parts, ...worn.parts } };
  return { stages: [s0, s1, s2, s3], palette: { ...V.palette, ...PALETTE }, worn }; }

// ═══════════ source, exposure, raster ═══════════
function toSource(fig, palette) { const m = fig.mesh; const V = [...m.vertices], F = [...m.faces], C = [], prov = m.provenance.map((p) => ({ part: p.part })); const parts = Object.fromEntries(Object.keys(m.parts).map((k) => [k, { layer: m.parts[k].layer ?? 1 }]));
  const tintOf = Object.fromEntries(Object.entries(m.parts).map(([k, p]) => [k, p.tint])); m.faces.forEach((f, i) => C.push(palette[m.groups[i]] || tintOf[m.provenance[f[0]].part] || '#8a8f96')); let open = 0;
  for (const [name, d] of Object.entries(fig.parts)) { const idx = {}; for (const [k, p] of Object.entries(d.points)) { idx[k] = V.length; V.push(p); prov.push({ part: name }); } parts[name] = { layer: d.layer ?? 2 }; const fg = d.faceGroups;
    d.faces.forEach((f, i) => { F.push(f.map((k) => idx[k])); C.push(palette[fg ? fg[i] : d.group] || '#ff00ff'); });
    const E = new Map(); for (const f of d.faces) for (let i = 0; i < 3; i++) { const a = f[i], b = f[(i + 1) % 3]; const key = a < b ? `${a}|${b}` : `${b}|${a}`; E.set(key, (E.get(key) || 0) + 1); } for (const c of E.values()) if (c !== 2) open++; }
  return { vertices: V, faces: F, colors: C, provenance: prov, parts, open }; }
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const LIGHT = unit([0.35, -0.55, 0.75]), FILL = unit([-0.7, 0.35, 0.15]); const BG = [247, 245, 239];   // a key and a weaker fill from the far side: a face turned from the key goes dark, it is not lit twice
function raster(src, cam, size, ss = 2) { const P = projectVertices(src.vertices, cam); const N = size * ss; const img = new Uint8Array(N * N * 3); const zb = new Float64Array(N * N).fill(Infinity); for (let i = 0; i < N * N; i++) img.set(BG, 3 * i);
  src.faces.forEach((f, fi) => { const [a, b, c] = f.map((k) => src.vertices[k]); const nn = cross(sub(b, a), sub(c, a)); if (Math.hypot(...nn) < 1e-14) return; const n = unit(nn); const k = 0.3 + 0.62 * Math.max(0, dot(n, LIGHT)) + 0.16 * Math.max(0, dot(n, FILL)); const col = hex(src.colors[fi]).map((x) => Math.min(255, Math.round(x * k)));
    const [[ax, ay, az], [bx, by, bz], [cx, cy, cz]] = f.map((v) => [P[v][0] * ss, P[v][1] * ss, P[v][2]]); const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-12) return;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(N - 1, Math.ceil(Math.max(ax, bx, cx))), y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(N - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const px = x + 0.5, py = y + 0.5; const w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den, w2 = 1 - w0 - w1; if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue; const z = 1 / (w0 / az + w1 / bz + w2 / cz); const idx = y * N + x; if (z < zb[idx]) { zb[idx] = z; img.set(col, 3 * idx); } } });
  const M = size, out = new Uint8Array(M * M * 3); for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) for (let ch = 0; ch < 3; ch++) { let t = 0; for (let dy = 0; dy < ss; dy++) for (let dx = 0; dx < ss; dx++) t += img[3 * ((y * ss + dy) * N + x * ss + dx) + ch]; out[3 * (y * M + x) + ch] = Math.round(t / (ss * ss)); } return out; }
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }); const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function png(rgb, w, h) { const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); }; const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); }
function sheet(cells, cols, size) { const rows = Math.ceil(cells.length / cols); const W = cols * size, out = new Uint8Array(W * rows * size * 3).fill(BG[0]); cells.forEach((c, i) => { const ox = (i % cols) * size, oy = Math.floor(i / cols) * size; for (let y = 0; y < size; y++) out.set(c.subarray(y * size * 3, (y + 1) * size * 3), 3 * ((oy + y) * W + ox)); }); return png(out, W, rows * size); }

export { shell, strap, hang, clearOf, beneathOf, hullHeight, wear, dragonStages, vultureStages, toSource, justify };
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const t0 = Date.now(); const S = 520; const cells = []; const report = {};
  for (const [name, make, views] of [['dragon', dragonStages, [[150, 8, [0, 0, 1.45], 4.6], [330, 14, [0, -0.2, 1.5], 5.2]]], ['vulture', vultureStages, [[140, 12, [0, 0.05, 0.75], 2.4], [150, 10, [0, 0.42, 1.12], 0.7]]]]) {
    const { stages, palette, worn } = make(); const srcs = stages.map((st) => toSource(st, palette));
    for (const [az, el, tgt, dist] of views) for (const src of srcs) cells.push(raster(src, orbitCamera({ azimuthDegrees: az, elevationDegrees: el, target: tgt, distance: dist, focalPixels: 1100, size: S }), S));
    report[name] = { faces: srcs.map((s) => s.faces.length), openEdges: srcs[3].open, adornments: justify(srcs[3], worn) }; }
  writeFileSync(`${OUT()}/build-up.png`, sheet(cells, 4, S)); writeFileSync(`${OUT()}/report.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1), `${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
