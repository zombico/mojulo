/** render-pelvic-overlay.mjs — the VAJRA CORE over the hero's mesh: where the ring plan and the vajra body disagree.
 *
 * A diagnostic for figure articulation (pelvic). The hero form's midsection is a torso tube over two thigh lofts that
 * overlap through the mirror plane ("no pelvis part"); the vajra body (vajra-body.js) already says what is there: the
 * rib egg hung off the thoracic curve and tilted 18°, the pelvic basket whose floor is the hip joints, tilted 26°, the
 * iliac rim that cradles the dantien, the groin at the pelvic floor, and the femoral neck out to the trochanter (the
 * outer edge of the hip). This draws those pieces, derived from the hero's own rest joints, over the hero's skinned
 * mesh (x-ray, arms and pinned dress hidden) at rest and in poses that load the midsection, each piece carried by the
 * hero bone that would own it (the rib egg on `torso`, the basket and groin on `pelvis`, the dantien half and half,
 * the trochanter on the thigh). A measurements table compares widths and depths at the vajra landmark heights.
 * `--core structured` draws the structured core (the basin and lumbar bones) for the after. Nothing here is a recipe
 * change. Run from control:
 *   MOJULO_SPIKE_OUT=/absolute/path node ../docs/examples/humanoid/render-pelvic-overlay.mjs [--cast lead,heroine] [--core structured] */
import { register, createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

register('../../../control/scripts/mcp-stdio-loader.mjs', import.meta.url);
const lib = (p) => import(new URL(`../../../control/lib/${p}`, import.meta.url).href);
const sharp = createRequire(new URL('../../../control/package.json', import.meta.url))('sharp');
const { expandLayeredManifest } = await lib('mcp/tools/layered.js');
const { compileLayered } = await lib('graph/polygonizer/station-loft.js');
const { validateRig, bindLayered, rigNodesAt, boneFrames, skinLayered } = await lib('graph/polygonizer/station-loft-rig.js');
const { ribCageLines, pelvisLines, chakras, sphereLoops, circleLoop } = await lib('graph/polygonizer/vajra-body.js');
const { viewCamera, rasterDepth } = await lib('graph/scene/depth-raster.js');
const { projectVertices } = await lib('graph/scene/wire-svg.js');
const { encodePng } = await lib('graph/landscape/surface-textures.js');

const OUT = resolve(process.env.MOJULO_SPIKE_OUT || fileURLToPath(new URL('../../../lite-template/integration/1004/spike-output/pelvic-overlay', import.meta.url)));
mkdirSync(OUT, { recursive: true });
const argOf = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : undefined);
const CASTS = (argOf('--cast') ?? 'lead,heroine').split(',');
const CORE = argOf('--core');   // 'structured' draws the structured core (hero-form.js HERO_CORES); absent: the spec's own

// poses that load the midsection: the trunk folding over the hips, the girdles counter-turning, the hip flexing
const POSES = [
  ['rest', {}],
  ['spine curl', { spine: { curl: 1 } }],
  ['crouch + hinge', { crouch: 0.45, hinge: 18 }],
  ['twist', { pelvis: -15, shoulders: 12, spine: { twist: ['right', 0.7] } }],
  ['high knee', { support: 'L', hipR: { yaw: 0, pitch: 70, roll: 0 }, kneeR: 90 }],
];
const VIEWS = ['frontal', 'three-quarter', 'lateral', 'back'];
const CELL = 300;
const INK = { rib: '#1f8a83', pelvis: '#7a4fc0', dantien: '#d08a14', groin: '#d08a14', femur: '#c0502a', bone: '#555' };

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mv = (m, v) => [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const r3 = (x) => Math.round(x * 1000) / 1000;

function figure(name) {
  const spec = JSON.parse(readFileSync(new URL(`./cast/${name}.json`, import.meta.url), 'utf8'));
  const m = expandLayeredManifest({ kind: 'layered', title: name, hero: { ...spec.hero, ...(CORE ? { core: CORE } : {}) } });
  const recipe = m.recipe, mesh = compileLayered(recipe, m.dials || {}, m.channels || {});
  const R = validateRig(recipe.rig), skin = bindLayered(mesh, recipe, R);
  const J = R.joints, P = (k) => ({ x: J[k][0], y: J[k][1], z: J[k][2] });
  // metres per vajra STAND unit for THIS figure: the cast moves lengths, so read it off the lumbar + thoracic run against
  // the canonical STAND run (navel 0.625 → neck 0.78, pelvis 0.47 → navel 0.625) — the vajra body's offsets are STAND
  const k = (J.neckHub[2] - J.pelvisHub[2]) / (0.78 - 0.47);
  const toStand = (p) => ({ x: p.x / k, y: p.y / k, z: p.z / k });
  const p = Object.fromEntries(['navel', 'pelvisHub', 'neckHub', 'headTop', 'hipL', 'hipR', 'kneeL', 'kneeR', 'shoulderL', 'shoulderR'].map((n) => [n, toStand(P(n))]));
  const toM = (q) => [q.x * k, q.y * k, q.z * k];
  // each overlay polyline names the bone(s) that carry it: [[boneId, weight], ...]
  const pieces = [], lumbar = R.bones.some((b) => b.id === 'lumbar');
  for (const l of ribCageLines(p)) pieces.push({ ink: INK.rib, pts: l.pts.map(toM), ride: [['torso', 1]], o: l.opacity ?? 1 });
  for (const l of pelvisLines(p)) pieces.push({ ink: INK.pelvis, pts: l.pts.map(toM), ride: [['pelvis', 1]], o: l.opacity ?? 1 });
  for (const c of chakras(p).filter((c) => c.name !== 'throat')) for (const loop of sphereLoops(c.c, c.r)) pieces.push({ ink: INK[c.name], pts: loop.map(toM), ride: c.name === 'dantien' ? (lumbar ? [['lumbar', 1]] : [['pelvis', 0.5], ['torso', 0.5]]) : [['pelvis', 1]], o: 0.9 });
  for (const [S, sg] of [['L', -1], ['R', 1]]) {
    const hip = p[`hip${S}`], troch = { x: hip.x + sg * 0.024, y: 0, z: hip.z - 0.04 };   // vajra-body femoralNeckLines
    pieces.push({ ink: INK.femur, pts: [toM(hip), toM(troch)], ride: [[`thigh${S}`, 1]], o: 1, w: 2.4 });
    pieces.push({ ink: INK.femur, pts: circleLoop(troch, 'xy', 0.013).map(toM), ride: [[`thigh${S}`, 1]], o: 1 });
    pieces.push({ ink: INK.femur, pts: [toM(troch), J[`knee${S}`]], ride: [[`thigh${S}`, 1]], o: 0.7, w: 1.6 });
  }
  // the hero's own core bones, thin: pelvis (pelvisHub → navel) and torso (navel → neckHub)
  pieces.push({ ink: INK.bone, pts: [J.pelvisHub, J.navel, J.neckHub], joints: ['pelvisHub', 'navel', 'neckHub'], o: 0.8, w: 1.2, dash: true });
  // the basin's own frame, drawn as its hip line through the hub (structured: it turns with the hips alone)
  pieces.push({ ink: INK.pelvis, pts: [J.hipR, J.pelvisHub, J.hipL], ride: [['pelvis', 1]], o: 1, w: 2.6 });
  // the parts shown: the layer-1 body without the arms (they cover the hips frontally); pinned dress hidden
  const showPart = (part) => recipe.parts[part]?.layer === 1 && !/Arm|hand/.test(part);
  const keepFace = mesh.faces.map((f) => showPart(mesh.provenance[f[0]].part));
  return { name, recipe, mesh, R, skin, J, k, p, pieces, keepFace, palette: recipe.palette || {} };
}

function posed(F, pose) {
  const { nodes } = rigNodesAt(F.R, pose);
  const frames = boneFrames(F.R, F.R.joints, nodes), byId = Object.fromEntries(frames.map((f) => [f.id, f]));
  const vertices = skinLayered(F.mesh, F.skin, frames);
  const rideP = (pt, ride) => ride.reduce((acc, [b, w]) => { const f = byId[b]; const q = add(f.head, mv(f.m, sub(pt, f.restHead))); return [acc[0] + w * q[0], acc[1] + w * q[1], acc[2] + w * q[2]]; }, [0, 0, 0]);
  const lines = F.pieces.map((pc) => ({ ...pc, pts: pc.joints ? pc.joints.map((j) => nodes[j]) : pc.pts.map((q) => rideP(q, pc.ride)) }));
  return { mesh: { ...F.mesh, vertices }, lines, nodes };
}

// one cell: the shown body, flat-lit and faded (x-ray), the overlay as SVG strokes on top
function cell(F, P, view, label) {
  const faces = F.mesh.faces.filter((_, i) => F.keepFace[i]), groups = F.mesh.groups.filter((_, i) => F.keepFace[i]);
  const shown = { vertices: P.mesh.vertices, faces };
  // frame on the midsection: shown vertices between the knees and the neck (posed)
  const zLo = Math.min(P.nodes.kneeL[2], P.nodes.kneeR[2]) - 0.05, zHi = P.nodes.neckHub[2] + 0.06;
  const ids = new Set(); faces.forEach((f) => f.forEach((v) => ids.add(v)));
  const frameVerts = [...ids].map((v) => P.mesh.vertices[v]).filter((v) => v[2] >= zLo && v[2] <= zHi);
  const camera = viewCamera({ vertices: frameVerts, faces: [] }, view, { size: CELL, focalPixels: 900, elevationDegrees: 4 });
  const raster = rasterDepth(shown, camera, CELL * 2);
  const key = unit([-0.5, 0.7, 0.85]);
  const cols = faces.map((f, i) => {
    const [a, b, c] = f.slice(0, 3).map((v) => P.mesh.vertices[v]), n = unit(cross(sub(b, a), sub(c, a)));
    const light = 0.62 + 0.38 * Math.max(0, dot(n, key));
    return hex(F.palette[groups[i]] || '#999999').map((ch) => Math.round(255 - (255 - Math.min(255, ch * light)) * 0.5));   // faded 50% to white
  });
  const BG = [250, 249, 245], rgb = Buffer.alloc(CELL * CELL * 3);
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    const s = [0, 0, 0];
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const fi = raster.face[(y * 2 + dy) * CELL * 2 + x * 2 + dx]; const c = fi < 0 ? BG : cols[fi]; for (let q = 0; q < 3; q++) s[q] += c[q]; }
    rgb.set(s.map((c) => Math.round(c / 4)), (y * CELL + x) * 3);
  }
  const png = encodePng(rgb, CELL, CELL).toString('base64');
  const strokes = P.lines.map((l) => {
    const q = projectVertices(l.pts, camera).map((v) => `${v[0].toFixed(1)},${v[1].toFixed(1)}`).join(' ');
    return `<polyline points="${q}" fill="none" stroke="${l.ink}" stroke-opacity="${l.o}" stroke-width="${l.w ?? 1.1}"${l.dash ? ' stroke-dasharray="4 3"' : ''}/>`;
  }).join('');
  return { png, strokes, label };
}

function sheet(file, title, rows, legend) {
  const W = VIEWS.length * CELL, headH = 70, rowLab = 22, H = headH + rows.length * (CELL + rowLab);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#e8e5dd"/>`;
  svg += `<text x="10" y="24" font-family="Helvetica" font-size="18" font-weight="bold">${title}</text><text x="10" y="44" font-family="Helvetica" font-size="12">${legend}</text>`;
  svg += `<text x="10" y="62" font-family="Helvetica" font-size="12" fill="#444">columns: ${VIEWS.join(' · ')} · body x-rayed, arms and pinned dress hidden · dashed grey: the hero's pelvis and torso bones</text>`;
  rows.forEach((row, r) => {
    const y0 = headH + r * (CELL + rowLab);
    svg += `<text x="10" y="${y0 + 16}" font-family="Helvetica" font-size="13" font-weight="bold">${row.label}</text>`;
    row.cells.forEach((c, i) => { svg += `<g transform="translate(${i * CELL},${y0 + rowLab})"><image width="${CELL}" height="${CELL}" xlink:href="data:image/png;base64,${c.png}"/>${c.strokes}</g>`; });
  });
  return sharp(Buffer.from(svg + '</svg>')).png().toFile(`${OUT}/${file}`);
}

// widths and depths of the body at the vajra landmark heights (true plane sections of the layer-1 trunk and thighs at
// rest), against the vajra body's own half-widths; mid front / mid back are the depths on the midline (|x| < 1.5 cm)
function measures(F) {
  const { mesh, p, k, J } = F, V = mesh.vertices;
  const tris = mesh.faces.filter((f) => { const part = mesh.provenance[f[0]].part; return F.recipe.parts[part]?.layer === 1 && /^(torso|thigh[LR])$/.test(part); });
  const section = (z) => {
    const pts = [];
    for (const f of tris) for (let i = 1; i + 1 < f.length; i++) {
      const t = [V[f[0]], V[f[i]], V[f[i + 1]]];
      for (let e = 0; e < 3; e++) { const a = t[e], b = t[(e + 1) % 3]; if ((a[2] - z) * (b[2] - z) > 0 || a[2] === b[2]) continue; const u = (z - a[2]) / (b[2] - a[2]); pts.push([a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])]); }
    }
    if (!pts.length) return null;
    const mid = pts.filter((q) => Math.abs(q[0]) < 0.015);
    return { half: r3(Math.max(...pts.map((q) => Math.abs(q[0])))), midFront: mid.length ? r3(Math.max(...mid.map((q) => q[1]))) : null, midBack: mid.length ? r3(Math.min(...mid.map((q) => q[1]))) : null };
  };
  const lerp = (a, b, t) => a + (b - a) * t, hipHalf = Math.abs(p.hipL.x), costal = lerp(p.navel.z, p.neckHub.z, 0.02);
  const rows = [
    ['rib egg widest (lower third)', lerp(costal, p.neckHub.z + 0.015, 0.33), 0.085],
    ['costal margin (rib egg base)', costal, 0.085 * Math.sin(Math.PI * 0.16)],
    ['iliac rim (basket top)', p.hipL.z + 0.105, hipHalf],
    ['dantien centre', lerp(p.navel.z, p.pelvisHub.z, 0.40), 0.075],
    ['hip joints (basket floor)', p.hipL.z, hipHalf * 0.88],
    ['trochanter', p.hipL.z - 0.04, hipHalf + 0.024],
    ['groin', p.pelvisHub.z - 0.02, null],
  ];
  const hem = J.pelvisHub[2] + 0.63 * (J.navel[2] - J.pelvisHub[2]);
  return rows.map(([what, zS, halfS]) => { const z = zS * k, m = section(z); return { landmark: what, z_m: r3(z), vajra_half_m: halfS == null ? null : r3(halfS * k), mesh_half_m: m?.half ?? null, mid_front_m: m?.midFront ?? null, mid_back_m: m?.midBack ?? null }; })
    .concat([{ landmark: 'hero torso hem (zWaist): tube ends, thigh lofts begin', z_m: r3(hem), mesh_half_m: section(hem)?.half ?? null }]);
}

// the hero's `pelvis` bone runs pelvisHub → navel (the lumbar), the hips only its aux: how far does the basket it
// carries tip under a pose that moves the spine and not the hips, against the hip line's own turn?
function boneCheck(F) {
  const angle = (pose) => {
    const { nodes } = rigNodesAt(F.R, pose); const f = boneFrames(F.R, F.R.joints, nodes).find((b) => b.id === 'pelvis');
    const tr = f.m[0][0] + f.m[1][1] + f.m[2][2]; const hipLine = (n) => unit(sub(n.hipL, n.hipR));
    const lb = boneFrames(F.R, F.R.joints, nodes).find((b) => b.id === 'lumbar'), lt = lb ? lb.m[0][0] + lb.m[1][1] + lb.m[2][2] : null;
    return { ...(lb ? { lumbarTurn_deg: r3(Math.acos(Math.max(-1, Math.min(1, (lt - 1) / 2))) * 180 / Math.PI) } : {}), basketTurn_deg: r3(Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2))) * 180 / Math.PI), hipLineTurn_deg: r3(Math.acos(Math.min(1, dot(hipLine(nodes), hipLine(F.R.joints)))) * 180 / Math.PI) };
  };
  return { 'spine curl 1': angle({ spine: { curl: 1 } }), 'spine arch 1': angle({ spine: { arch: 1 } }), 'hinge 30': angle({ hinge: 30 }), 'pelvis 15': angle({ pelvis: 15 }) };
}

const report = {}, tag = CORE ? `-${CORE}` : '';
for (const name of CASTS) {
  const F = figure(name);
  const rows = POSES.map(([label, pose]) => { const P = posed(F, pose); return { label: `${name} · ${label}`, cells: VIEWS.map((v) => cell(F, P, v)) }; });
  await sheet(`pelvic-overlay-${name}${tag}.png`, `${name}: the vajra core over the hero mesh · core ${F.R.bones.some((b) => b.id === 'lumbar') ? 'structured' : 'streamlined'}`, rows,
    `<tspan fill="${INK.rib}">■ rib egg (torso bone)</tspan>   <tspan fill="${INK.pelvis}">■ pelvic basket (pelvis bone)</tspan>   <tspan fill="${INK.dantien}">● dantien (½ pelvis ½ torso) · groin (pelvis)</tspan>   <tspan fill="${INK.femur}">— femoral neck → trochanter (thigh bone)</tspan>`);
  report[name] = { metresPerStand: r3(F.k), measures: measures(F), pelvisBone: boneCheck(F) };
  console.log(`wrote ${OUT}/pelvic-overlay-${name}${tag}.png`);
}
writeFileSync(`${OUT}/pelvic-overlay${tag}.json`, JSON.stringify(report, null, 2));
const md = Object.entries(report).map(([n, r]) => `## ${n} (1 STAND = ${r.metresPerStand} m)\n\n| landmark | z m | vajra half-width | mesh half-width | mid front y | mid back y |\n|---|---|---|---|---|---|\n` +
  r.measures.map((m) => `| ${m.landmark} | ${m.z_m} | ${m.vajra_half_m ?? '—'} | ${m.mesh_half_m ?? '—'} | ${m.mid_front_m ?? '—'} | ${m.mid_back_m ?? '—'} |`).join('\n') +
  `\n\nthe pelvis bone (and the lumbar, structured) under spine-only poses:\n\n| pose | basket turn ° | lumbar turn ° | hip line turn ° |\n|---|---|---|---|\n` +
  Object.entries(r.pelvisBone).map(([k, v]) => `| ${k} | ${v.basketTurn_deg} | ${v.lumbarTurn_deg ?? '—'} | ${v.hipLineTurn_deg} |`).join('\n')).join('\n\n');
writeFileSync(`${OUT}/pelvic-overlay${tag}.md`, md + '\n');
console.log(md);
