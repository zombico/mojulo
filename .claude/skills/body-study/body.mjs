#!/usr/bin/env node
// body-study — the HERO's body as an engine gets it: the cage (station-loft-faces' layered mesh, skinned by its rig,
// shaded smooth), from all round, posed, with its sections and its girths. The realistic register's body lane: read the
// shell before any of it changes, and after. Run, then Read the sheet.
//
//   node .claude/skills/body-study/body.mjs [male] [female] [--acts '[…]'] [--crop <part>] [--register <word>]
//                                           [--out dir]
//
//   male / female   which casts (default both); any figure cast word works (heroic, brute, lithe …).
//   --acts          an ACTION STRIP: one row per entry per cast, at the front, the front ¾, the lateral and the back.
//                   An entry is {} (the bind), { "gait": "walk"|"jog"|"sprint", "phase": 0 … 1 }, { "gesture": a
//                   stand word (relaxed, guard, hand-on-hip …) }, or { "pose": a rig pose as rigNodesAt takes it };
//                   any entry may carry its own "crop". Without --acts: the bind, from the front, the front ¾, the
//                   lateral, the back and below.
//   --crop          torso | shoulder | hip | knee | hand | foot | neck (the right side's, the neck seam where the head
//                   sits), framed on the posed joints; default the whole body.
//   --register      the hero's register word (the door's `register`, default its own).
//   --laws          the hero laws to mint under (hero-form.js HERO_LAWS_VERSION; default the current): 1 for a hero as
//                   rows minted before laws 2 read
//   --form          a body build of the form field (body-relational.js BODY_BUILDS: norrin, shalla): the torso
//                   re-sampled onto it, bald, in a matte silver-grey (the realistic register's vertical slice; a dev
//                   path, no minted hero changes), wearing the RELATIONAL head (head-relational.js, the head-study
//                   field lane's) in place of the hero's: its skin meshed, fitted to the hero's head (vertex to
//                   menton, the ear's depth) and carried by the head bone
//   --out           output dir (default /tmp/body-study): sheet.png, sheet.svg, report.json.
//
// Each cast gets a SECTIONS panel at the bind (the trunk cut level at the neck, the chest, the waist and the seat; the
// right limbs cut square to their bones at the thigh, the knee, the calf, the upper arm and the forearm; each outline
// drawn to one scale with its girth, the cut's convex hull: what a tape reads) and a MEASURES table (stature, heads
// tall, the shoulder's and the hip's breadths, the girths). The register's targets join the table when it has them.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire, register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CONTROL = path.join(REPO, 'control');
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
process.chdir(CONTROL);
const sharp = createRequire(path.join(CONTROL, 'package.json'))('sharp');
const { heroRecord, expandLayeredManifest } = await import('@/lib/mcp/tools/layered.js');
const { compileLayered } = await import('@/lib/graph/polygonizer/station-loft.js');
const { validateRig, bindLayered, rigNodesAt, boneFrames, skinLayered } = await import('@/lib/graph/polygonizer/station-loft-rig.js');
const { layeredShadingNormals } = await import('@/lib/graph/polygonizer/station-loft-shade.js');
const { standPose } = await import('@/lib/graph/polygonizer/hero-gesture.js');
const { gaitPose } = await import('@/lib/graph/polygonizer/hero-stretch.js');
const { formSlice, BODY_BUILDS } = await import('@/lib/graph/polygonizer/body-relational.js');
const { relationalHead } = await import('@/lib/graph/polygonizer/head-relational.js');
const { headFieldMesh } = await import('@/lib/graph/polygonizer/head-field-view.js');

// ─── arguments ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let out = '/tmp/body-study', acts = null, crop = null, reg = null, laws = null, form = null;
const casts = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--acts') { acts = JSON.parse(args[++i]); continue; }
  if (a === '--crop') { crop = args[++i]; continue; }
  if (a === '--register') { reg = args[++i]; continue; }
  if (a === '--laws') { laws = Number(args[++i]); continue; }
  if (a === '--form') { form = args[++i]; continue; }
  if (a === '--out') { out = args[++i]; continue; }
  if (a.startsWith('--')) throw new Error(`body-study: unknown option ${a}`);
  casts.push(a);
}
if (!casts.length) casts.push('male', 'female');
const CROPS = ['torso', 'shoulder', 'hip', 'knee', 'hand', 'foot', 'neck'];
for (const c of [crop, ...(acts || []).map((r) => r.crop)]) if (c && !CROPS.includes(c)) throw new Error(`body-study: crop '${c}' is not one of ${CROPS.join(', ')}`);
mkdirSync(out, { recursive: true });

// ─── the camera and the rasteriser (head-study's, for the hero's frame: metres, z up, +y forward) ─────────────────
const ALL_VIEWS = [
  { name: 'front', az: 0, elev: 4 }, { name: 'front ¾', az: 35, elev: 8 }, { name: 'lateral', az: 90, elev: 2 },
  { name: 'back', az: 180, elev: 4 }, { name: 'under', az: 20, elev: -40 },
];
const ROW_VIEWS = ALL_VIEWS.filter((v) => v.name !== 'under');
// the clay; the slice's a matte silver-grey (the shader is diffuse: no highlight)
const CLAY = form ? [176, 180, 186] : [196, 184, 170], BG = '#e9e7e3';
function camera(az, elev, box, W, H) {
  const a = (az * Math.PI) / 180, e = (elev * Math.PI) / 180;
  const c = [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
  const r = [-Math.cos(a), Math.sin(a), 0];
  const u = [c[1] * r[2] - c[2] * r[1], c[2] * r[0] - c[0] * r[2], c[0] * r[1] - c[1] * r[0]];
  const ctr = [0, 1, 2].map((k) => (box.min[k] + box.max[k]) / 2);
  // the frame's extent as this view sees it (its corners on the screen axes), fitted to the cell
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((m) => [0, 1, 2].map((k) => ((m >> k) & 1 ? box.max[k] : box.min[k]) - ctr[k]));
  const span = (v) => Math.max(...corners.map((p) => p[0] * v[0] + p[1] * v[1] + p[2] * v[2])) * 2;
  const sc = 0.94 * Math.min(W / span(r), H / span(u));
  const dot = (p, v) => (p[0] - ctr[0]) * v[0] + (p[1] - ctr[1]) * v[1] + (p[2] - ctr[2]) * v[2];
  const ln = Math.hypot(-0.45, 0.55, 0.75), light = [-0.45 / ln, 0.55 / ln, 0.75 / ln];
  return {
    project: (p) => [W / 2 + dot(p, r) * sc, H / 2 - dot(p, u) * sc, dot(p, c)],
    shade: (n) => { const d = Math.max(0, (n[0] * r[0] + n[1] * r[1] + n[2] * r[2]) * light[0] + (n[0] * u[0] + n[1] * u[1] + n[2] * u[2]) * light[1] + (n[0] * c[0] + n[1] * c[1] + n[2] * c[2]) * light[2]); return 0.30 + 0.70 * d; },
  };
}
/** the triangles (vertex positions, per-corner normals) z-buffered and lit in clay */
function rasterize(V, faces, normals, cam, W, H) {
  const zbuf = new Float32Array(W * H).fill(-Infinity), img = Buffer.alloc(W * H * 4, 0);
  faces.forEach((tri, fi) => {
    const P = tri.map((v) => cam.project(V[v])), N = normals[fi];
    const [A, B, C] = P;
    const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    if (!area) return;
    const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
    const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const qx = x + 0.5, qy = y + 0.5;
      const w0 = ((B[0] - qx) * (C[1] - qy) - (B[1] - qy) * (C[0] - qx)) / area, w1 = ((C[0] - qx) * (A[1] - qy) - (C[1] - qy) * (A[0] - qx)) / area, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const d = w0 * A[2] + w1 * B[2] + w2 * C[2], o = y * W + x;
      if (d <= zbuf[o]) continue;
      zbuf[o] = d;
      const n = [0, 1, 2].map((q) => w0 * N[0][q] + w1 * N[1][q] + w2 * N[2][q]), l = Math.hypot(...n) || 1;
      const s = cam.shade(n.map((v) => v / l));
      img[o * 4] = Math.min(255, CLAY[0] * s); img[o * 4 + 1] = Math.min(255, CLAY[1] * s); img[o * 4 + 2] = Math.min(255, CLAY[2] * s); img[o * 4 + 3] = 255;
    }
  });
  return img;
}

// ─── the hero, posed ─────────────────────────────────────────────────────────
const heroes = new Map();
function hero(cast, extra = {}) {
  const key = JSON.stringify([cast, extra]);
  if (heroes.has(key)) return heroes.get(key);
  const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, ...(reg ? { register: reg } : {}), ...(laws ? { laws } : {}), ...(form ? { hair: 'none', ...(BODY_BUILDS[form]?.tune ? { tune: BODY_BUILDS[form].tune } : {}) } : {}), ...extra }) });
  if (form) m.recipe = formSlice(m.recipe, validateRig(m.recipe.rig), form).recipe;
  const mesh = compileLayered(m.recipe, m.dials), R = validateRig(m.recipe.rig);
  const h = { m, mesh, R, skin: bindLayered(mesh, m.recipe, R) };
  if (form) h.graft = graftHead(h, cast === 'female' ? 'female' : 'male');
  heroes.set(key, h);
  return h;
}
/** a row's posed joints and its label */
function rowNodes(cast, H, row) {
  if (row.gait) { const ph = row.phase ?? 0; return { nodes: rigNodesAt(H.R, gaitPose(H.R, row.gait)(ph)).nodes, label: `${row.gait} ${ph}` }; }
  if (row.gesture) { const g = hero(cast, { gesture: row.gesture }); const pose = standPose(g.m.recipe, g.R); return { nodes: rigNodesAt(H.R, pose || {}).nodes, label: `gesture ${row.gesture}` }; }
  if (row.pose) return { nodes: rigNodesAt(H.R, row.pose).nodes, label: `pose ${JSON.stringify(row.pose)}` };
  return { nodes: H.R.joints, label: 'bind' };
}
// the hero's own head (its shell and what sits on it), hidden where the relational head is grafted
const HERO_HEAD = /^(cranium|jaw|eye|iris|pupil|lid|brow|ear|nostril|upperLip|mouth|hair|face)/;
/** the relational head's skin as triangles in the hero's rest frame: scaled so vertex to menton is the hero's head's,
 * the menton on the hero's, the ear canal at the hero's ear's depth; its normals the field's gradient */
function graftHead(H, sex) {
  const head = relationalHead({ sex, tune: true }), quads = headFieldMesh(head, { cells: 110 });
  const of = (re) => H.mesh.vertices.filter((_, i) => re.test(H.mesh.provenance[i].part));
  const cran = of(/^(cranium|jaw)$/), ear = of(/^earR$/);
  const top = Math.max(...cran.map((v) => v[2])), men = Math.min(...of(/^jaw$/).map((v) => v[2]));
  const hz = Math.max(...quads.flatMap((q) => q.corners.map((c) => c.z))), sc = (top - men) / hz;
  const earY = ear.length ? ear.reduce((a, v) => a + v[1], 0) / ear.length : 0, ty = earY - head.landmarks.tragionR.y * sc;
  const e = 1e-5, grad = (c) => norm([head.field({ ...c, x: c.x + e }) - head.field({ ...c, x: c.x - e }), head.field({ ...c, y: c.y + e }) - head.field({ ...c, y: c.y - e }), head.field({ ...c, z: c.z + e }) - head.field({ ...c, z: c.z - e })]);
  const V = [], N = [], faces = [];
  for (const q of quads) {
    const b = V.length;
    for (const c of q.corners) { V.push([c.x * sc, c.y * sc + ty, c.z * sc + men]); N.push(grad(c)); }
    faces.push([b, b + 1, b + 2], [b, b + 2, b + 3]);
  }
  const keep = H.mesh.faces.map((tri, fi) => (HERO_HEAD.test(H.mesh.provenance[tri[0]].part) ? -1 : fi)).filter((fi) => fi >= 0);
  return { V, N, faces, keep, bone: H.R.bones.findIndex((b) => b.id === 'head') };
}
function posed(H, nodes) {
  const frames = boneFrames(H.R, H.R.joints, nodes);
  const V = skinLayered(H.mesh, H.skin, frames);
  const normals = layeredShadingNormals({ ...H.mesh, vertices: V }, H.m.recipe, { rest: H.mesh });
  if (!H.graft) return { V, normals, faces: H.mesh.faces };
  // the graft rides the head bone rigidly; the hero's own head stays out of the picture
  const G = H.graft, f = frames[G.bone], mv = (m, v) => [0, 1, 2].map((r) => m[r][0] * v[0] + m[r][1] * v[1] + m[r][2] * v[2]);
  const o = V.length, Vall = [...V, ...G.V.map((p) => { const q = mv(f.m, sub(p, f.restHead)); return [f.head[0] + q[0], f.head[1] + q[1], f.head[2] + q[2]]; })], Ng = G.N.map((n) => mv(f.m, n));
  return { V: Vall, faces: [...G.keep.map((fi) => H.mesh.faces[fi]), ...G.faces.map((t) => t.map((i) => i + o))], normals: [...G.keep.map((fi) => normals[fi]), ...G.faces.map((t) => t.map((i) => Ng[i]))] };
}
/** the camera's box: the whole posed body, or a crop about the posed joints (the right side's) */
function frameBox(V, J, which) {
  const box = (c, h) => ({ min: [c[0] - h[0], c[1] - h[1], c[2] - h[2]], max: [c[0] + h[0], c[1] + h[1], c[2] + h[2]] });
  const mid = (a, b, t = 0.5) => a.map((x, k) => x + (b[k] - x) * t);
  if (which === 'torso') return { min: [J.shoulderL[0] - 0.12, -0.2, J.hipR[2] - 0.12], max: [J.shoulderR[0] + 0.12, 0.2, J.neckHub[2] + 0.1] };
  if (which === 'shoulder') return box(J.shoulderR, [0.15, 0.15, 0.15]);
  if (which === 'hip') return box(mid(J.pelvisHub, J.hipR, 0.7), [0.2, 0.2, 0.2]);
  if (which === 'knee') return box(J.kneeR, [0.14, 0.14, 0.16]);
  if (which === 'hand') return box(mid(J.wristR, J.knucklesR, 0.7), [0.12, 0.12, 0.12]);
  if (which === 'foot') return box(mid(J.ankleR, J.toeTipR, 0.45), [0.14, 0.14, 0.14]);
  if (which === 'neck') return box(mid(J.neckHub, J.headBase, 0.4), [0.15, 0.15, 0.15]);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const v of V) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); }
  return { min: lo, max: hi };
}

// ─── sections and measures, at the bind ──────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** the cut of the faces of `parts` (a regex on the part's name) by the plane through o with normal n: its segments in
 * the plane's own 2-D frame, and its girth (the convex hull's perimeter) */
function section(H, V, parts, o, n) {
  n = norm(n);
  const e1 = norm(Math.abs(n[2]) > 0.9 ? cross3([0, 1, 0], n) : cross3([0, 0, 1], n)), e2 = cross3(n, e1);
  const to2 = (p) => { const d = sub(p, o); return [dot3(d, e1), dot3(d, e2)]; };
  const segs = [];
  H.mesh.faces.forEach((tri) => {
    if (!parts.test(H.mesh.provenance[tri[0]].part)) return;
    const s = tri.map((v) => dot3(sub(V[v], o), n)), pts = [];
    for (let k = 0; k < 3; k++) {
      const a = tri[k], b = tri[(k + 1) % 3], sa = s[k], sb = s[(k + 1) % 3];
      if ((sa < 0) !== (sb < 0)) { const t = sa / (sa - sb); pts.push(to2(V[a].map((x, q) => x + (V[b][q] - x) * t))); }
    }
    if (pts.length === 2) segs.push(pts);
  });
  // (a limb's plane runs on into the far side's limb and the trunk: keep the cut nearest the plane's own origin)
  const near = segs.filter(([a, b]) => Math.hypot(a[0], a[1]) < 0.25 && Math.hypot(b[0], b[1]) < 0.25);
  const pts = near.flat().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const crossZ = (o2, a, b) => (a[0] - o2[0]) * (b[1] - o2[1]) - (a[1] - o2[1]) * (b[0] - o2[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && crossZ(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of [...pts].reverse()) { while (up.length >= 2 && crossZ(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const hull = lo.slice(0, -1).concat(up.slice(0, -1));
  let girth = 0;
  for (let i = 0; i < hull.length; i++) girth += Math.hypot(hull[(i + 1) % hull.length][0] - hull[i][0], hull[(i + 1) % hull.length][1] - hull[i][1]);
  return { segs: near, hull, girth };
}
function measures(H) {
  const J = H.R.joints, V = H.mesh.vertices, at = (a, b, t) => a.map((x, k) => x + (b[k] - x) * t);
  const level = (z) => ({ o: [0, 0, z], n: [0, 0, 1] });
  const along = (a, b, t) => ({ o: at(a, b, t), n: sub(b, a) });
  const cuts = {
    neck: [/^neck$/, level((J.neckHub[2] + J.headBase[2]) / 2)],
    chest: [/^(torso|pectoral|bust)/, level(J.navel[2] + 0.6 * (J.shoulderR[2] - J.navel[2]))],
    waist: [/^(torso|pelvis)$/, level(J.navel[2])],
    seat: [/^(pelvis|thigh[LR])$/, level(J.hipR[2])],
    thigh: [/^thighR$/, along(J.hipR, J.kneeR, 0.2)],
    knee: [/^(thighR|shankR)$/, along(J.kneeR, J.ankleR, 0)],
    calf: [/^shankR$/, along(J.kneeR, J.ankleR, 0.3)],
    upperArm: [/^upperArmR$/, along(J.shoulderR, J.elbowR, 0.5)],
    forearm: [/^foreArmR$/, along(J.elbowR, J.wristR, 0.25)],
  };
  const sections = Object.fromEntries(Object.entries(cuts).map(([k, [re, { o, n }]]) => [k, section(H, V, re, o, n)]));
  const partsZ = (re) => V.filter((_, i) => re.test(H.mesh.provenance[i].part)).map((v) => v[2]);
  const zs = V.map((v) => v[2]), stature = Math.max(...zs) - Math.min(...zs);
  const head = Math.max(...zs) - Math.min(...partsZ(/^(cranium|jaw|face|head)/));
  const band = (re, z0, z1) => { const xs = V.filter((v, i) => re.test(H.mesh.provenance[i].part) && v[2] >= z0 && v[2] <= z1).map((v) => v[0]); return xs.length ? Math.max(...xs) - Math.min(...xs) : 0; };
  const mm = (x) => Math.round(x * 1000);
  return {
    sections,
    table: {
      'stature': mm(stature), 'heads tall': Math.round((stature / head) * 100) / 100, 'head (vertex–menton)': mm(head),
      'biacromial (shoulder joints)': mm(J.shoulderR[0] - J.shoulderL[0]),
      'shoulders (silhouette)': mm(band(/^(torso|pectoral|upperArm)/, J.shoulderR[2] - 0.1, J.shoulderR[2] + 0.02)),
      'hips (silhouette)': mm(band(/^(pelvis|thigh)/, J.hipR[2] - 0.08, J.hipR[2] + 0.04)),
      ...Object.fromEntries(Object.entries(sections).map(([k, s]) => [`girth ${k}`, mm(s.girth)])),
    },
  };
}

// ─── the sheet ──────────────────────────────────────────────────────────────
const parts = [], report = {};
let y0 = 0, sheetW = 0;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const label = (x, y, t, size = 13) => parts.push(`<text x="${x + 8}" y="${y}" font-family="monospace" font-size="${size}" fill="#555">${esc(t)}</text>`);
async function cell(x, y, img, W, H) {
  const png = await sharp(img, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  parts.push(`<rect x="${x}" y="${y}" width="${W}" height="${H}" fill="${BG}"/>`, `<image x="${x}" y="${y}" width="${W}" height="${H}" href="data:image/png;base64,${png.toString('base64')}"/>`);
}
for (const cast of casts) {
  const H = hero(cast);
  const rows = acts || [{}];
  for (const row of rows) {
    const { nodes, label: lab } = rowNodes(cast, H, row);
    const which = row.crop ?? crop, views = acts ? ROW_VIEWS : ALL_VIEWS;
    const W = which ? 380 : 300, Hh = which ? 440 : 560;
    const { V, normals, faces } = posed(H, nodes);
    const box = frameBox(V, nodes, which);
    for (const [col, v] of views.entries()) {
      const img = rasterize(V, faces, normals, camera(v.az, v.elev, box, W, Hh), W, Hh);
      await cell(col * W, y0, img, W, Hh);
      label(col * W, y0 + Hh - 10, `${cast} · ${lab}${which ? ` · ${which}` : ''} · ${v.name}`, 12);
    }
    sheetW = Math.max(sheetW, views.length * W);
    y0 += Hh;
  }
  // the sections at the bind, one scale, each with its girth; and the measures table
  const M = measures(H);
  report[cast] = { register: H.m.recipe.parts ? (reg ?? 'default') : reg, ...M.table };
  const SC = 900;   // px per metre
  const ph = 300, names = Object.keys(M.sections);
  // each cut side by side at its own width (its outline's extent), one scale for all
  const ext = names.map((k) => { const xs = M.sections[k].segs.flat().map((p) => p[0]); return xs.length ? [Math.min(...xs), Math.max(...xs)] : [-0.05, 0.05]; });
  const at = []; let x = 40;
  ext.forEach(([a, b]) => { const w = Math.max((b - a) * SC, 110); at.push(x + w / 2 - ((a + b) / 2) * SC); x += w + 30; });
  sheetW = Math.max(sheetW, x + 10);
  parts.push(`<rect x="0" y="${y0}" width="${Math.max(sheetW, 1500)}" height="${ph + 330}" fill="#faf9f7"/>`);
  label(0, y0 + 22, `${cast} · sections at the bind (the trunk level, the right limbs square to the bone; ${SC / 100} px per cm; the dashed loop is the tape's, its girth below)`, 14);
  names.forEach((k, i) => {
    const s = M.sections[k], ys = s.segs.flat().map((p) => p[1]), cx = at[i], cy = y0 + 40 + ph / 2 + (ys.length ? ((Math.min(...ys) + Math.max(...ys)) / 2) * SC : 0);
    for (const [a, b] of s.segs) parts.push(`<line x1="${cx + a[0] * SC}" y1="${cy - a[1] * SC}" x2="${cx + b[0] * SC}" y2="${cy - b[1] * SC}" stroke="#333" stroke-width="1.4"/>`);
    if (s.hull.length) parts.push(`<polygon points="${s.hull.map((p) => `${cx + p[0] * SC},${cy - p[1] * SC}`).join(' ')}" fill="none" stroke="#b5482a" stroke-dasharray="4 3" stroke-width="1"/>`);
    parts.push(`<text x="${cx + ((ext[i][0] + ext[i][1]) / 2) * SC}" y="${y0 + 40 + ph + 4}" text-anchor="middle" font-family="monospace" font-size="13" fill="#333">${k} ${(s.girth * 100).toFixed(1)} cm</text>`);
  });
  const lines = Object.entries(M.table).map(([k, v]) => `${k.padEnd(30)} ${typeof v === 'number' && Number.isInteger(v) ? `${v} mm` : v}`);
  lines.push('targets: none yet (the register\'s relations, phase 3a)');
  lines.forEach((t, i) => parts.push(`<text x="40" y="${y0 + 40 + ph + 34 + i * 17}" font-family="monospace" font-size="13" fill="#333">${esc(t)}</text>`));
  console.log(`\n${cast}${reg ? ` (${reg})` : ''}${laws ? ` laws ${laws}` : ''}:`); for (const t of lines) console.log(`  ${t}`);
  y0 += ph + 330;
}
sheetW = Math.max(sheetW, 1500);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${y0}" viewBox="0 0 ${sheetW} ${y0}"><rect width="100%" height="100%" fill="${BG}"/>${parts.join('')}</svg>`;
writeFileSync(path.join(out, 'sheet.svg'), svg);
writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
const r = spawnSync('node', [path.join(REPO, '.claude/skills/view-svg/rasterize.mjs'), path.join(out, 'sheet.svg'), '--out', out, '--max', '2400'], { cwd: REPO, encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr || r.stdout); process.exit(1); }
console.log(`\n— body-study: ${casts.join(' + ')} → ${out} (sheet.png, sheet.svg, report.json)`);
