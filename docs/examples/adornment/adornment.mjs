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
const D = await import(`${CORE}station-loft-detail.js`);
const { layeredExposure } = await import(`${CORE}station-loft-exposure.js`);
const { orbitCamera, projectVertices } = await import(new URL('../../../control/lib/graph/scene/wire-svg.js', import.meta.url).href);
const BD = await import(new URL('../body-detail/body-detail.mjs', import.meta.url).href);
const WG = await import(new URL('../wings/wings.mjs', import.meta.url).href);
const { frameAt, loftParts, ringLoft, sweep, ringAt, projectOnto, vec } = D; const { sub, add, mul, dot, cross, unit, mean } = vec;
const OUT = () => { const o = resolve(process.env.MOJULO_SPIKE_OUT || fileURLToPath(new URL('../../../lite-template/integration/0924/spike-output/adornment/', import.meta.url))); mkdirSync(o, { recursive: true }); return o; };
const lerp = (a, b, t) => a + (b - a) * t;

// ═══════════ CORE: the adornment layer (species-free) ═══════════
/** the points beneath an adornment: its carrier and `over` parts (L1) plus every detail/adornment part whose
 * name mentions one of them, minus the ones that declare they poke through */
function beneathOf(fig, names, { pokes = /^(spur|spine)/ } = {}) { const pts = []; const L1 = fig.mesh.parts;
  for (const n of names) if (L1[n]) pts.push(...Object.values(L1[n].points));
  for (const [k, p] of Object.entries(fig.parts)) if (!pokes.test(k) && names.some((n) => k.includes(n))) pts.push(...Object.values(p.points));
  return pts; }
/** height of the beneath hull above an address, along its normal, within a lateral radius */
function hullHeight(pts, p, n, rad) { let h = 0; for (const v of pts) { const d = sub(v, p), up = dot(d, n); if (up <= h) continue; const lat = Math.hypot(...sub(d, mul(n, up))); if (lat < rad) h = up; } return h; }
/** the circumferential sample list: a t window on one half, or the whole wrap (R half out, L half back) */
function around(P, t, side, nt) { const H = P.slotT ? Math.max(...Object.values(P.slotT)) : P.slots.length / 2;
  if (t === 'wrap') { const r = Array.from({ length: nt }, (_, k) => [H * k / nt, 'R']); const l = Array.from({ length: nt }, (_, k) => [H * (1 - k / nt), 'L']); return { list: [...r, ...l], closed: true }; }
  return { list: Array.from({ length: nt + 1 }, (_, k) => [lerp(t[0], t[1], k / nt), side]), closed: false }; }
/** SHELL: the carrier's (s, t) window lifted by the smoothed beneath hull + mugen; a thick wall. Wrapped → a torus
 * (ringLoft); partial → a capped loft. The mugen field ramps away from the `support` station (snug where it hangs). */
function shell(fig, A, side) { const L1 = fig.mesh.parts; const P = L1[A.part]; const beneath = beneathOf(fig, [A.part, ...(A.over || [])]);
  const { list, closed } = around(P, A.t, side, A.nt ?? 12); const S = Array.from({ length: (A.ns ?? 4) + 1 }, (_, j) => lerp(A.s[0], A.s[1], j / (A.ns ?? 4)));
  const F = list.map(([t, sd]) => S.map((s) => frameAt(L1, A.part, [s, t], sd)));
  let H = F.map((row) => row.map((f) => hullHeight(beneath, f.origin, f.normal, A.rad ?? 0.05)));
  const nb = (k, j) => [[k, j], [k - 1, j], [k + 1, j], [k, j - 1], [k, j + 1]].map(([a, b]) => [closed ? (a + H.length) % H.length : Math.min(H.length - 1, Math.max(0, a)), Math.min(S.length - 1, Math.max(0, b))]);
  H = H.map((row, k) => row.map((_, j) => Math.max(...nb(k, j).map(([a, b]) => H[a][b])))); H = H.map((row, k) => row.map((_, j) => mean(nb(k, j).map(([a, b]) => [H[a][b]]))[0]));   // min-shield: max, then mean
  const mug = (s) => A.mugen * (1 + (A.ramp ?? 0) * (A.support == null ? 0 : Math.abs(s - A.support) / Math.max(1e-9, Math.abs(A.s[1] - A.s[0]))));
  const inner = F.map((row, k) => row.map((f, j) => add(f.origin, mul(f.normal, H[k][j] + mug(S[j]))))); const outer = inner.map((row, k) => row.map((p, j) => add(p, mul(F[k][j].normal, A.thick))));
  const sections = inner.map((row, k) => [...row, ...[...outer[k]].reverse()]);
  const mesh = closed ? ringLoft(sections) : loftParts(sections, mean(sections[0]), mean(sections[sections.length - 1]));
  return { mesh: { ...mesh, group: A.group }, grid: { inner, outer, F, S, list } }; }
/** STRAP: a path of addresses (each [s, t, side] on the carrier), lifted over the beneath hull, as a flat band */
function strap(fig, A) { const L1 = fig.mesh.parts; const beneath = beneathOf(fig, [A.part, ...(A.over || [])]); const pts = [], ns = [];
  for (let i = 0; i + 1 < A.path.length; i++) { const [a, b] = [A.path[i], A.path[i + 1]]; const n = a[2] === b[2] ? 4 : 1; for (let k = 0; k < n; k++) { const u = k / n; const at = a[2] === b[2] ? [lerp(a[0], b[0], u), lerp(a[1], b[1], u)] : [a[0], a[1]]; const f = frameAt(L1, A.part, at, a[2]); pts.push(add(f.origin, mul(f.normal, hullHeight(beneath, f.origin, f.normal, A.rad ?? 0.05) + A.mugen))); ns.push(f.normal); } }
  { const z = A.path[A.path.length - 1]; const f = frameAt(L1, A.part, [z[0], z[1]], z[2]); pts.push(add(f.origin, mul(f.normal, hullHeight(beneath, f.origin, f.normal, A.rad ?? 0.05) + A.mugen))); ns.push(f.normal); }
  const rings = pts.map((p, i) => { const along = unit(sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)])); const n = unit(sub(ns[i], mul(along, dot(ns[i], along)))); const lat = mul(unit(cross(n, along)), A.width / 2);
    return [sub(p, lat), add(p, lat), add(add(p, lat), mul(n, A.thick)), add(sub(p, lat), mul(n, A.thick))]; });
  return { mesh: { ...loftParts(rings, sub(pts[0], mul(unit(sub(pts[1], pts[0])), 0.01)), add(pts[pts.length - 1], mul(unit(sub(pts[pts.length - 1], pts[pts.length - 2])), 0.01))), group: A.group }, pts }; }
/** HANG: a chain from an anchor under gravity, kept `clear` off the beneath points (a few relaxation passes that
 * keep link length), ending in a pendant; links alternate orientation */
function clearOf(p, surfaces, out, clear) { for (const S of surfaces) { let hit; try { hit = projectOnto(S, p, out); } catch { continue; } const d = dot(sub(p, hit), out); if (d < clear) p = add(p, mul(out, clear - d)); } return p; }
function hang(beneath, anchor, { links, len, clear, r, surfaces = [], out = [0, 1, 0] }) { let P = Array.from({ length: links + 1 }, (_, i) => add(anchor, [0, 0, -len * i]));
  for (let it = 0; it < 12; it++) { for (let i = 1; i < P.length; i++) { for (const v of beneath) { const d = sub(P[i], v), l = Math.hypot(...d); if (l < clear && l > 1e-9) P[i] = add(v, mul(d, clear / l)); } P[i] = clearOf(P[i], surfaces, out, clear); }
    for (let i = 1; i < P.length; i++) { const d = sub(P[i], P[i - 1]), l = Math.hypot(...d); P[i] = add(P[i - 1], mul(d, len / l)); } }
  const meshes = P.slice(0, -1).map((p, i) => { const c = mean([p, P[i + 1]]), ax = unit(sub(P[i + 1], p)); const side = unit(cross(ax, i % 2 ? [1, 0, 0] : [0, 1, 0]));
    return ringLoft(Array.from({ length: 10 }, (_, k) => { const a = 2 * Math.PI * k / 10; const q = add(c, add(mul(ax, Math.cos(a) * len * 0.55), mul(side, Math.sin(a) * len * 0.3))); const t = unit(add(mul(ax, -Math.sin(a) * 0.55), mul(side, Math.cos(a) * 0.3))); return ringAt(q, t, r, 5); })); });
  return { P, meshes }; }
/** a flat disc (medallion, boss, buckle plate) facing n: two rings and a raised face */
function disc(c, n, r, h, m = 12, rim = 0.8) { const ring = (rr, z) => ringAt(add(c, mul(n, z)), n, rr, m); return loftParts([ring(r, 0), ring(r, h * 0.6), ring(r * rim, h)], sub(c, mul(n, 0.002)), add(c, mul(n, h * 1.15))); }

// ═══════════ ADORNMENT DATA ═══════════
const METAL = 'Iron', BRONZE = 'Bronze', LEATHER = 'Leather', GOLD = 'Gold';
/** each adornment: a mode, where it sits, its mugen, and its SIGNATURE — the one element that justifies it */
const DRAGON_KIT = (S) => [
  { id: `bracer${S}`, mode: 'shell', part: `foreArm${S}`, s: [0.62, 1.38], t: 'wrap', mugen: 0.012, thick: 0.01, group: METAL, rigid: true,
    signature: { kind: 'boss', build: (fig, g) => { const k = g.list.findIndex(([t, sd]) => sd === S && Math.abs(t - 1.5) < 0.2) ?? 0; const j = Math.floor(g.S.length / 2); return disc(g.outer[k][j], g.F[k][j].normal, 0.045, 0.03, 12, 0.55); }, group: BRONZE } },
  { id: `pauldron${S}`, mode: 'shell', part: 'torso', over: [`upperArm${S}`], side: S, s: [2.55, 3.5], t: [1.1, 2.9], nt: 10, mugen: 0.014, thick: 0.014, group: METAL, rigid: true, rad: 0.09, support: 3.5, ramp: 1.2,
    signature: { kind: 'spike', build: (fig, g) => { const k = Math.floor(g.list.length / 2), j = g.S.length - 2; const p = g.outer[k][j], n = g.F[k][j].normal; const up = unit(add(n, [0, 0, 1.2]));
      return sweep([sub(p, mul(n, 0.01)), add(p, mul(up, 0.12)), add(p, mul(up, 0.26)), add(p, mul(up, 0.38))], [0.075, 0.05, 0.02], 6); }, group: METAL } },
];
const DRAGON_MID = [
  { id: 'belt', mode: 'shell', part: 'pelvis', s: [1.5, 1.9], t: 'wrap', nt: 14, ns: 2, mugen: 0.012, thick: 0.014, group: LEATHER,
    signature: { kind: 'buckle', build: (fig, g) => { const p = g.outer[0][1], n = g.F[0][1].normal; const up = [0, 0, 1], lat = unit(cross(up, n)); const W = 0.075, Hh = 0.06;
      const path = [[-W, -Hh], [W, -Hh], [W, Hh], [-W, Hh]].flatMap(([a, b], i, arr) => { const [c, d] = arr[(i + 1) % 4]; return [0, 0.5].map((u) => [lerp(a, c, u), lerp(b, d, u)]); });
      return ringLoft(path.map(([a, b], i) => { const q = add(add(add(p, mul(lat, a)), mul(up, b)), mul(n, 0.01)); const nx = path[(i + 1) % path.length], pv = path[(i - 1 + path.length) % path.length]; const tan = unit(add(mul(lat, nx[0] - pv[0]), mul(up, nx[1] - pv[1]))); return ringAt(q, tan, 0.012, 4, Math.PI / 4); })); }, group: GOLD } },
  { id: 'harness', mode: 'strap', part: 'torso', path: [[3.7, 2.2, 'R'], [3.3, 1.2, 'R'], [2.6, 0.45, 'R'], [2.0, 0.05, 'R'], [1.5, 0.5, 'L'], [0.9, 1.3, 'L'], [0.45, 2.0, 'L']], width: 0.07, thick: 0.012, mugen: 0.01, group: LEATHER, rad: 0.06,
    signature: { kind: 'ring', build: (fig, g) => { const i = Math.floor(g.pts.length / 2) - 1; const c = g.pts[i]; const n = unit(sub(c, [0, 0, c[2]])); const f = unit(add(n, [0, 0.4, 0]));
      return ringLoft(Array.from({ length: 14 }, (_, k) => { const a = 2 * Math.PI * k / 14; const u = unit(cross(f, [0, 0, 1])), v = cross(f, u); const q = add(add(c, mul(f, 0.02)), add(mul(u, Math.cos(a) * 0.06), mul(v, Math.sin(a) * 0.06))); return ringAt(q, unit(add(mul(u, -Math.sin(a)), mul(v, Math.cos(a)))), 0.012, 6); })); }, group: BRONZE } },
  { id: 'collar', mode: 'shell', part: 'neck', s: [0.55, 1.05], t: 'wrap', nt: 14, ns: 2, mugen: 0.012, thick: 0.02, group: METAL,
    signature: { kind: 'medallion', build: (fig, g, beneath) => { const a = g.outer[0][0]; const surfaces = [fig.mesh.parts.torso]; const out = [0, 1, 0];
      const { P, meshes } = hang(beneath, add(a, [0, 0.01, -0.01]), { links: 6, len: 0.045, clear: 0.05, r: 0.006, surfaces, out }); const c = clearOf(add(P[P.length - 1], [0, 0, -0.07]), surfaces, out, 0.06);
      return { links: meshes, element: disc(c, unit([0, 1, 0.15]), 0.07, 0.022, 14, 0.6) }; }, group: GOLD, beneath: ['torso'] } },
];
const VULTURE_KIT = [
  { id: 'hood', mode: 'shell', part: 'head', s: [0.1, 1.45], t: 'wrap', nt: 12, ns: 5, mugen: 0.004, thick: 0.006, group: 'HoodLeather', support: 0.1, ramp: 0.8,
    signature: { kind: 'plume', build: (fig, g) => { const p = g.outer[0][2]; return [-1, 0, 1].map((x) => sweep([sub(p, [0, 0, 0.006]), add(p, [0.012 * x, -0.012, 0.028]), add(p, [0.022 * x, -0.035, 0.05]), add(p, [0.03 * x, -0.065, 0.058]), add(p, [0.034 * x, -0.095, 0.05])], [0.008, 0.014, 0.012, 0.006], 6, { squash: [1, 0.45] })); }, group: 'Plume' } },
  ...['R', 'L'].map((S) => ({ id: `jess${S}`, mode: 'shell', part: `tarsus${S}`, s: [0.7, 1.05], t: 'wrap', nt: 10, ns: 2, mugen: 0.004, thick: 0.008, group: LEATHER,
    signature: { kind: 'bell', build: (fig, g, beneath) => { const k = g.list.findIndex(([t, sd]) => sd === S && t > 1.2); const a = g.outer[Math.max(0, k)][g.S.length - 1]; const { P, meshes } = hang(beneath, a, { links: 2, len: 0.018, clear: 0.02, r: 0.003 }); const e = P[P.length - 1];
      return { links: meshes, element: loftParts([0.5, 0.95, 1, 0.9, 0.55].map((q, i) => ringAt(add(e, [0, 0, -0.008 - 0.007 * i]), [0, 0, 1], 0.017 * q, 10)), add(e, [0, 0, -0.004]), add(e, [0, 0, -0.045])) }; }, group: GOLD, beneath: [`tarsus${S}`, `toeF${S}`, `toeB${S}`] } })),
];

// ═══════════ build up the figure ═══════════
function wear(fig, kit) { const out = {}; const record = [];
  for (const A of kit) { const side = A.side || 'R'; let g, mesh;
    if (A.mode === 'shell') { ({ mesh, grid: g } = shell(fig, A, side)); } else if (A.mode === 'strap') { const r = strap(fig, A); mesh = r.mesh; g = r; }
    out[`adorn.${A.id}`] = { ...mesh, layer: 3 };
    // the signature is built on the adornment (so it rides it); what it hangs past is its own beneath
    const beneath = beneathOf({ mesh: fig.mesh, parts: { ...fig.parts, ...out } }, A.signature.beneath || [A.part]); const sig = A.signature.build(fig, g, beneath);
    // a signature is its ELEMENT (what must read) plus whatever carries it (chain links), named apart
    const el = sig.element ? sig.element : sig; (Array.isArray(el) ? el : [el]).forEach((m, i) => { out[`adorn.${A.id}.sig${i}`] = { ...m, group: A.signature.group, layer: 3 }; });
    (sig.links || []).forEach((m, i) => { out[`adorn.${A.id}.link${i}`] = { ...m, group: A.signature.group, layer: 3 }; });
    const dom = A.rigid ? BD.dominance(BD.RECIPE.parts[A.part]) : null; const bones = dom ? A.s.map((s) => dom(s)) : null;
    record.push({ id: A.id, mode: A.mode, carrier: A.part, over: A.over || [], mugen: A.mugen, signature: A.signature.kind, rigid: !!A.rigid, bone: bones ? bones.map((b) => `${b.bone}@${b.w.toFixed(2)}`).join('..') : 'skin (inherits)' });
    fig = { ...fig, parts: { ...fig.parts, ...out } }; }   // STACKING: the next adornment's beneath includes this one
  return { parts: out, record }; }
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
/** ONE RECOGNIZABLE VISUAL ELEMENT: the signature must READ (exposed ≥ 0.25 from some view) and be a real share of
 * its adornment's picture; otherwise the adornment has not justified itself (advisory, never a refusal) */
function justify(src, worn) { const L = layeredExposure({ vertices: src.vertices, faces: src.faces, provenance: src.provenance, parts: src.parts }, { minLayer: 3, res: 384 }).parts;
  return worn.record.map((r) => { const all = Object.keys(L).filter((k) => k.startsWith(`adorn.${r.id}.sig`)).sort((a, b) => Number(a.split('sig')[1]) - Number(b.split('sig')[1])); const sig = all;
    const best = Math.max(...sig.map((k) => L[k].exposed)); const base = L[`adorn.${r.id}`];
    const views = Object.keys(L[sig[0]].pixels); const sigPx = Math.max(...views.map((v) => sig.reduce((t, k) => t + L[k].pixels[v], 0))); const basePx = Math.max(...Object.values(base.pixels)); const share = sigPx / Math.max(1, sigPx + basePx);
    return { ...r, sigExposed: +best.toFixed(2), sigShare: +share.toFixed(2), adornExposed: base.exposed, verdict: best >= 0.25 && share >= 0.08 ? 'justified' : best >= 0.25 ? 'reads, but small' : 'unjustified' }; }); }
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
