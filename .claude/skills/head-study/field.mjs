#!/usr/bin/env node
// head-study --field — the protoform head's FIELD as it is: surface-netted (not the latitude march), lit in clay,
// with the landmarks and the caliper points over it, a sections panel (the profile, and transverse cuts at the brow,
// the eyes, the nose base and the mouth) and the caliper measurements read off the field. Run, then Read the sheet.
//
//   node .claude/skills/head-study/field.mjs [male] [female] [--proto '{…}'] [--face '{…}'] [--cells N]
//                                            [--no-marks] [--out dir]
//
//   male / female   which poles (default both).
//   --proto         head knobs merged over the pole (browRidge, jawWidth, chinPoint, noseSize, noseWidth, noseDroop,
//                   cheekbone, cheek, foreheadSlope, earSize, eyeSize, neckGirth).
//   --face          the face dials: '{"jaw":20}', mouth, brow.
//   --cells         surface-net cells along the head's longest side (default 160; 220 for a close read).
//   --no-marks      the surface alone, no landmark or caliper overlay.
//   --source        protoform (default: figure-head.js) | relational (head-relational.js: vajras placed by relations)
//   --layer         skin (default) | skull — the relational head's layers
//   --act           the relational head's actions: '{"jaw":0.6,"smile":1}' (head-relational.js ACTIONS)
//   --acts          an ACTION STRIP: '[{}, {"jaw":0.6}, {"smile":1}]' — one row per set per pole (front, front ¾, ¾, lateral) and
//                   what each moved from that pole's first row; no sections or table
//   --eyes          the relational head's eyes: a word (neutral, wide, angry, sad, sleepy, happy, suspicious,
//                   focused, closed) or '{"word":"angry","gazeYaw":15,"L":{"open":0.6}}' (head-relational-eye.js);
//                   a row of --acts may carry its own `eyes`
//   --crop eyes     frame both eyes (the brow's line to the cheek's top)
//   --crop face     frame the face (the chin to above the brow, cheek to cheek) instead of the whole head
//   --crop ear      frame the right ear (read it in the front ¾, the ¾, the lateral and the rear ¾)
//   --untuned       the relational head as authored, its wave's internal points not solved to meet its relations
//   --rel           relations replaced over the relational pole: '{"cephalic":0.82,"jaw":0.8}' (head-relational.js)
//   --out           output dir (default /tmp/head-study-field): sheet.png, sheet.svg, measures.json.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const P = (f) => path.join(REPO, 'control/lib/graph/polygonizer', f);
const sharp = createRequire(path.join(REPO, 'control/package.json'))('sharp');
const { headFieldOf, headFieldMesh, headSections, headMeasures, throughHoles } = await import(P('head-field-view.js'));
const { HEAD_KNOB_NAMES } = await import(P('figure-head.js'));
const { relationalHead, RELATION_NAMES, ACTION_NAMES } = await import(P('head-relational.js'));
const { DIMORPH } = await import(P('figure-rig.js'));

const args = process.argv.slice(2);
let out = '/tmp/head-study-field', proto = {}, face = null, cells = 160, marks = true, source = 'protoform', rel = {}, layer = 'skin', tuned = true, act = null, acts = null, crop = null, eyesSpec = null;
const sexes = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--out') { out = args[++i]; continue; }
  if (a === '--proto') { proto = JSON.parse(args[++i]); continue; }
  if (a === '--face') { face = JSON.parse(args[++i]); continue; }
  if (a === '--cells') { cells = Number(args[++i]); continue; }
  if (a === '--no-marks') { marks = false; continue; }
  if (a === '--source') { source = args[++i]; continue; }
  if (a === '--rel') { rel = JSON.parse(args[++i]); continue; }
  if (a === '--layer') { layer = args[++i]; continue; }
  if (a === '--untuned') { tuned = false; continue; }
  if (a === '--crop') { crop = args[++i]; continue; }
  if (a === '--eyes') { const v = args[++i]; eyesSpec = v.trim().startsWith('{') ? JSON.parse(v) : v; source = 'relational'; continue; }
  if (a === '--act') { act = JSON.parse(args[++i]); source = 'relational'; continue; }
  if (a === '--acts') { acts = JSON.parse(args[++i]); source = 'relational'; continue; }
  if (a === '--field') continue;
  if (a === 'male' || a === 'female') { sexes.push(a); continue; }
  console.error(`head-study --field: unknown argument "${a}"`);
  process.exit(1);
}
if (!sexes.length) sexes.push('male', 'female');
const unknown = Object.keys(proto).filter((k) => !HEAD_KNOB_NAMES.includes(k));
if (unknown.length) { console.error(`head-study --field: not a head knob: ${unknown.join(', ')} (have ${HEAD_KNOB_NAMES.join(', ')})`); process.exit(1); }
const badRel = Object.keys(rel).filter((k) => !RELATION_NAMES.includes(k));
if (badRel.length) { console.error(`head-study --field: not a relation: ${badRel.join(', ')} (have ${RELATION_NAMES.join(', ')})`); process.exit(1); }
if (!['protoform', 'relational'].includes(source)) { console.error(`head-study --field: --source protoform | relational`); process.exit(1); }
const badAct = [act, ...(acts || [])].filter(Boolean).flatMap((o) => Object.keys(o)).filter((k) => k !== 'eyes' && !ACTION_NAMES.includes(k));
const { eyeSpecErrors } = await import(P('head-relational-eye.js'));
const badEyes = [eyesSpec, ...(acts || []).map((o) => o.eyes)].flatMap((e) => eyeSpecErrors(e ?? undefined));
if (badEyes.length) { console.error(`head-study --field: ${badEyes.join('; ')}`); process.exit(1); }
if (badAct.length) { console.error(`head-study --field: not an action: ${badAct.join(', ')} (have ${ACTION_NAMES.join(', ')})`); process.exit(1); }
mkdirSync(out, { recursive: true });

// az 0 = face-on (camera on +y), + turns the camera toward the figure's right; elev degrees
const ALL_VIEWS = [
  { name: 'front', az: 0, elev: 4 }, { name: 'front ¾', az: 30, elev: 8 }, { name: '¾', az: 50, elev: 10 },
  { name: 'lateral', az: 90, elev: 2 }, { name: 'rear ¾', az: 140, elev: 10 }, { name: 'under', az: 15, elev: -45 },
];
const VIEWS = acts ? ALL_VIEWS.filter((v) => ['front', 'front ¾', 'lateral', '¾'].includes(v.name)) : ALL_VIEWS;
const CW = 380, CH = 440;
const CLAY = [196, 184, 170], BG = '#e9e7e3';

function camera(az, elev, bounds) {
  const a = (az * Math.PI) / 180, e = (elev * Math.PI) / 180;
  const c = [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
  const r = [-Math.cos(a), Math.sin(a), 0];
  const u = [c[1] * r[2] - c[2] * r[1], c[2] * r[0] - c[0] * r[2], c[0] * r[1] - c[1] * r[0]];
  const ctr = ['x', 'y', 'z'].map((k) => (bounds.min[k] + bounds.max[k]) / 2);
  const span = Math.max(...['x', 'y', 'z'].map((k) => bounds.max[k] - bounds.min[k]));
  const sc = (Math.min(CW, CH) * 0.98) / span;
  const dot = (p, v) => (p.x - ctr[0]) * v[0] + (p.y - ctr[1]) * v[1] + (p.z - ctr[2]) * v[2];
  const ln = Math.hypot(-0.45, 0.55, 0.75), light = [-0.45 / ln, 0.55 / ln, 0.75 / ln];   // in camera space (r, u, c)
  return {
    project: (p) => [CW / 2 + dot(p, r) * sc, CH / 2 - dot(p, u) * sc, dot(p, c)],
    shade: (n) => { const d = Math.max(0, (n[0] * r[0] + n[1] * r[1] + n[2] * r[2]) * light[0] + (n[0] * u[0] + n[1] * u[1] + n[2] * u[2]) * light[1] + (n[0] * c[0] + n[1] * c[1] + n[2] * c[2]) * light[2]); return 0.30 + 0.70 * d; },
  };
}

// the painted parts (the eyes' globes); everything else is clay
const PAINT = { sclera: [232, 228, 220], iris: [64, 104, 140], pupil: [18, 18, 20] };
function rasterize(faces, cam, paint = null) {
  const zbuf = new Float32Array(CW * CH).fill(-Infinity), img = Buffer.alloc(CW * CH * 4, 0);
  for (const f of faces) {
    const Pp = f.corners.map(cam.project), N = f.cornerNormals || f.corners.map(() => f.n);
    for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) {
      const A = Pp[i], B = Pp[j], C = Pp[k];
      const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
      if (!area) continue;
      const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(CW - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
      const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(CH - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const qx = x + 0.5, qy = y + 0.5;
        const w0 = ((B[0] - qx) * (C[1] - qy) - (B[1] - qy) * (C[0] - qx)) / area;
        const w1 = ((C[0] - qx) * (A[1] - qy) - (C[1] - qy) * (A[0] - qx)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const d = w0 * A[2] + w1 * B[2] + w2 * C[2], o = y * CW + x;
        if (d <= zbuf[o]) continue;
        zbuf[o] = d;
        const n = [0, 1, 2].map((q) => w0 * N[i][q] + w1 * N[j][q] + w2 * N[k][q]);
        const l = Math.hypot(...n) || 1, s = cam.shade(n.map((v) => v / l));
        const col = f.paint ? PAINT[f.paint] : CLAY;
        img[o * 4] = col[0] * s; img[o * 4 + 1] = col[1] * s; img[o * 4 + 2] = col[2] * s; img[o * 4 + 3] = 255;
      }
    }
  }
  return { img, zbuf };
}

const LANDMARK_SKIP = new Set(['H', 's', 'earC', 'centre', 'cranium']);
const seen = new Set();
const svgParts = [];
let restZ = null, restOf = null;
const report = {};
let y0 = 0;
const PANEL_H = 520, PROF_W = 760, CUT_W = 760;
const ROWS = acts ? sexes.flatMap((sex) => acts.map((a) => ({ sex, actions: a }))) : sexes.map((sex) => ({ sex, actions: act }));
for (const { sex, actions: row } of ROWS) {
  const { eyes: rowEyes, ...actions } = row || {};
  const eyes = rowEyes ?? eyesSpec;
  const head = source === 'relational' ? relationalHead({ sex, relations: rel, layer, tune: tuned, actions, eyes }) : headFieldOf({ pole: DIMORPH[sex].head, knobs: proto, face });
  // the camera's frame: the head's bounds, or the face's (chin to above the brow, cheek to cheek, the face's depth)
  const L = head.landmarks;
  const ET = L.earTopR, TR = L.tragionR, eh = ET.z - TR.z;
  const EL = head.points?.exL, ER = head.points?.exR, EY = head.points?.eyeR;
  const frame = crop === 'eyes' && EL ? {
    min: { x: EL.x - 0.004, y: L.tragionR.y, z: EY.z - 0.022 },
    max: { x: ER.x + 0.004, y: L.noseTip.y, z: EY.z + 0.024 },
  } : crop === 'ear' ? {
    min: { x: TR.x - 0.6 * eh, y: TR.y - 1.3 * eh, z: TR.z - 1.25 * eh },
    max: { x: TR.x + 0.9 * eh, y: TR.y + 0.4 * eh, z: ET.z + 0.15 * eh },
  } : crop === 'face' ? {
    min: { x: -(L.zygionR.x + 0.006), y: L.tragionR.y, z: L.menton.z - 0.004 },
    max: { x: L.zygionR.x + 0.006, y: L.noseTip.y + 0.004, z: L.glabella.z + 0.012 },
  } : head.bounds;
  const holes = source === 'relational' ? throughHoles(head) : null;
  const eyeLabel = eyes ? ' · eyes ' + (typeof eyes === 'string' ? eyes : JSON.stringify(eyes).replace(/"/g, '')) : '';
  const actLabel = (actions && Object.keys(actions).length ? ' · ' + Object.entries(actions).map(([k, v]) => `${k} ${v}`).join(', ') : acts && !eyes ? ' · rest' : '') + eyeLabel;
  const t0 = Date.now();
  const faces = headFieldMesh(head, { cells });
  if (head.paint) for (const f of faces) {
    const c = f.corners.reduce((m, q) => ({ x: m.x + q.x / 4, y: m.y + q.y / 4, z: m.z + q.z / 4 }), { x: 0, y: 0, z: 0 });
    f.paint = head.paint(c);
  }
  const meas = headMeasures(head);
  const secs = headSections(head);
  report[sex + actLabel] = { source, throughHoles: holes ? holes.length : null, tuning: head.tuning ?? null, cells, quads: faces.length, mm: meas.mm, targets: head.targets ?? null, index: meas.index, classes: meas.classes };
  console.log(`${sex}: ${faces.length} quads at ${cells} cells, ${Date.now() - t0} ms`);

  for (const [col, v] of VIEWS.entries()) {
    const cam = camera(v.az, v.elev, frame);
    const { img, zbuf } = rasterize(faces, cam);
    const png = await sharp(img, { raw: { width: CW, height: CH, channels: 4 } }).png().toBuffer();
    const x = col * CW;
    svgParts.push(`<rect x="${x}" y="${y0}" width="${CW}" height="${CH}" fill="${BG}"/>`);
    svgParts.push(`<image x="${x}" y="${y0}" width="${CW}" height="${CH}" href="data:image/png;base64,${png.toString('base64')}"/>`);
    if (marks) {
      // a point is drawn where the surface does not hide it (a small depth tolerance: points sit ON the skin)
      const vis = (p) => { const [px, py, d] = cam.project(p); const o = Math.floor(py) * CW + Math.floor(px); return px >= 0 && px < CW && py >= 0 && py < CH && d >= zbuf[o] - 0.004 ? [px, py] : null; };
      for (const [k, p] of Object.entries(head.landmarks)) {
        if (LANDMARK_SKIP.has(k) || !p || typeof p !== 'object' || !Number.isFinite(p.x)) continue;
        const q = vis(p); if (q) svgParts.push(`<circle cx="${x + q[0]}" cy="${y0 + q[1]}" r="2.6" fill="#3a6fb0" opacity="0.8"/>`);
      }
      for (const [, p] of Object.entries(meas.points)) {
        if (!p) continue;
        const q = vis(p); if (q) svgParts.push(`<circle cx="${x + q[0]}" cy="${y0 + q[1]}" r="3.4" fill="none" stroke="#c0392b" stroke-width="1.6"/>`);
      }
    }
    svgParts.push(`<text x="${x + 10}" y="${y0 + CH - 12}" font-family="monospace" font-size="15" fill="#555">${sex} · ${source}${source === 'relational' ? ` ${layer}` : ''}${actLabel} · ${v.name}</text>`);
  }

  if (acts) {
    // the Δ column: the front view's depth against the first row's (the rest), red = the skin came toward the
    // camera, blue = it went back, full colour at 6 mm; grey where only one of the two has skin
    const cam = camera(0, 4, frame);
    const { zbuf } = rasterize(faces, cam);
    if (restOf !== sex) { restZ = zbuf; restOf = sex; }   // each pole's first row is its own rest
    const img = Buffer.alloc(CW * CH * 4, 0), FULL = 6 / 1000 / 1.8;   // 6 mm in STAND units
    for (let o = 0; o < CW * CH; o++) {
      const a = restZ[o], b = zbuf[o];
      if (a === -Infinity && b === -Infinity) continue;
      let c;
      if (a === -Infinity || b === -Infinity) c = [150, 150, 150];
      else { const t = Math.max(-1, Math.min(1, (b - a) / FULL)); c = t >= 0 ? [235, 235 - 200 * t, 235 - 200 * t] : [235 + 200 * t, 235 + 200 * t, 235]; }
      img[o * 4] = c[0]; img[o * 4 + 1] = c[1]; img[o * 4 + 2] = c[2]; img[o * 4 + 3] = 255;
    }
    const png = await sharp(img, { raw: { width: CW, height: CH, channels: 4 } }).png().toBuffer();
    const x = VIEWS.length * CW;
    svgParts.push(`<rect x="${x}" y="${y0}" width="${CW}" height="${CH}" fill="#fff"/><image x="${x}" y="${y0}" width="${CW}" height="${CH}" href="data:image/png;base64,${png.toString('base64')}"/>`);
    svgParts.push(`<text x="${x + 10}" y="${y0 + CH - 12}" font-family="monospace" font-size="15" fill="#555">moved from rest (red toward, blue away, 6 mm)</text>`);
    y0 += CH; continue;
  }
  // second row: the profile (face to the right), the transverse cuts from above (face up), the table
  const B = head.bounds, py0 = y0 + CH, pad = 34;
  svgParts.push(`<rect x="0" y="${py0}" width="${PROF_W + CUT_W}" height="${PANEL_H}" fill="#fbfaf8"/>`);
  const psc = Math.min((PROF_W - 2 * pad) / (B.max.y - B.min.y), (PANEL_H - 2 * pad) / (B.max.z - B.min.z));
  const prof = (u, v) => [pad + (u - B.min.y) * psc, py0 + pad + (B.max.z - v) * psc];
  const csc = Math.min((CUT_W - 2 * pad) / (B.max.x - B.min.x), (PANEL_H - 2 * pad) / (B.max.y - B.min.y));
  const top = (u, v) => [PROF_W + CUT_W / 2 + u * csc, py0 + pad + (B.max.y - v) * csc];
  const path = (segs, map) => segs.map(([a, b, c, d]) => { const p = map(a, b), q = map(c, d); return `M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}`; }).join('');
  svgParts.push(`<path d="${path(secs.profile.segments, prof)}" stroke="#333" stroke-width="1.6" fill="none"/>`);
  for (const [k, p] of Object.entries(meas.points)) {
    if (!p || Math.abs(p.x) > 1e-9) continue;
    const q = prof(p.y, p.z);
    svgParts.push(`<circle cx="${q[0]}" cy="${q[1]}" r="4" fill="none" stroke="#c0392b" stroke-width="1.6"/><text x="${q[0] + 7}" y="${q[1] - 5}" font-family="monospace" font-size="15" fill="#c0392b">${k}</text>`);
  }
  const CUT = { brow: '#7b4fa0', eyes: '#2e7d6b', noseBase: '#c97a1e', mouth: '#b03a48' };
  let ly = py0 + 50;
  for (const [k, col] of Object.entries(CUT)) {
    svgParts.push(`<path d="${path(secs[k].segments, top)}" stroke="${col}" stroke-width="1.5" fill="none"/>`);
    svgParts.push(`<text x="${PROF_W + 14}" y="${ly}" font-family="monospace" font-size="15" fill="${col}">— ${k}</text>`); ly += 20;
  }
  svgParts.push(`<line x1="${PROF_W}" y1="${py0}" x2="${PROF_W}" y2="${py0 + PANEL_H}" stroke="#ddd"/>`);
  svgParts.push(`<text x="12" y="${py0 + 22}" font-family="monospace" font-size="16" fill="#555">${sex} · profile (x = 0), face to the right</text>`);
  svgParts.push(`<text x="${PROF_W + 12}" y="${py0 + 22}" font-family="monospace" font-size="16" fill="#555">${sex} · cuts from above, face up</text>`);

  // measures table
  const tx = PROF_W + CUT_W, TABLE_W = VIEWS.length * CW - tx;
  svgParts.push(`<rect x="${tx}" y="${py0}" width="${TABLE_W}" height="${PANEL_H}" fill="#f4f2ee"/>`);
  const rows = [`${sex} · ${source} — calipers on the field`, '', ...Object.entries(meas.mm).map(([k, v]) => { const t = head.targets?.[k]; return `${k.padEnd(13)} ${v == null ? '—' : String(v).padStart(6)}${k === 'g-sn-pg' ? '° ' : ' mm'}${t != null ? `  target ${String(t).padStart(5)}  Δ ${v == null ? '—' : (v - t > 0 ? '+' : '') + (Math.round((v - t) * 10) / 10)}` : ''}`; }),
    '', ...Object.entries(meas.index).map(([k, v]) => `${(k + ' index').padEnd(13)} ${v == null ? '—' : String(v).padStart(6)}  ${meas.classes[k] || ''}`),
    ...(holes ? ['', `through-holes (side view): ${holes.length}${holes.length ? ' — at ' + holes.slice(0, 3).map((q) => `y ${(q.y / head.landmarks.H).toFixed(2)} z ${(q.z / head.landmarks.H).toFixed(2)}`).join(', ') : ''}`] : []),
    ...(head.tuning?.steps != null ? ['', `wave tuned in ${head.tuning.steps} step${head.tuning.steps === 1 ? '' : 's'}: worst ${Math.max(...Object.values(head.tuning.residual).map((e) => Math.abs(e ?? 0)))} mm`] : source === 'relational' ? ['', 'wave untuned'] : []),
    '', `mm at the canonical stature`, `(1 unit = 1.8 m)`, ...(meas.mm['al-al'] == null ? ['al-al — : no alar groove to read'] : [])];
  rows.forEach((t, i) => svgParts.push(`<text x="${tx + 16}" y="${py0 + 30 + i * 20}" font-family="monospace" font-size="${i ? 15 : 16}" fill="#333">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`));
  y0 += CH + PANEL_H;
}
const W = (VIEWS.length + (acts ? 1 : 0)) * CW;
writeFileSync(path.join(out, 'sheet.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${y0}" width="${W}" height="${y0}">${svgParts.join('\n')}</svg>`);
writeFileSync(path.join(out, 'measures.json'), JSON.stringify(report, null, 2) + '\n');
const r = spawnSync('node', [path.join(REPO, '.claude/skills/view-svg/rasterize.mjs'), path.join(out, 'sheet.svg'), '--out', out, '--max', '2400'], { cwd: REPO, encoding: 'utf8' });
process.stdout.write(r.stdout || '');
if (r.stderr) process.stderr.write(r.stderr);
console.log(`— head-study --field: ${sexes.join(' + ')} → ${out} (sheet.png, measures.json)`);
