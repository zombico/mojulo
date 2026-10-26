// THE HAIR SWEEP — every scalp style (dermal-hair.js SCALP_STYLES) depicted as the realistic hero wears it (the grass
// hat: epidermis/hair-depict.js), on the pole's own head, scored (epidermis/hair-score.js: coverage, the blades' own
// cover, the outline against the study's strands, the faces) and drawn as a contact sheet: a row a style, the front, the
// lateral, the back and the top in the hat's flat colours over a grey head. The depiction solver's eyes and its table.
//
//   node .claude/skills/dermis-study/hair-sweep.mjs [--styles a,b,…] [--type straight|wavy|curly|coily] [--level L2|L1|L0]
//                                                   [--sex male|female] [--px 160] [--out dir] [--raw]
//
// Without --styles: every style. --sex: the head (default: female for a style past the shoulder, else male). --type
// over each style's own. --raw: the ladder's rung alone, not its class's solved row (hair-depict.js HAIR_DEPICTION). Writes sheet.png and scores.json; prints the table.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';

const CONTROL = resolve(dirname(new URL(import.meta.url).pathname), '../../../control');
register(pathToFileURL(`${CONTROL}/scripts/mcp-stdio-loader.mjs`).href);
process.chdir(CONTROL);
const sharp = createRequire(join(CONTROL, 'package.json'))('sharp');
const { relationalHead } = await import('@/lib/graph/polygonizer/head-relational.js');
const { HEAD_TUNES } = await import('@/lib/graph/polygonizer/hero-relational-head.js');
const { relationalHeadChart, STAND_M } = await import('@/lib/graph/epidermis/dermal-head.js');
const { readDermis, hairColourOf, toSrgb } = await import('@/lib/graph/epidermis/dermal-map.js');
const { readScalp, growScalp, SCALP_STYLES } = await import('@/lib/graph/epidermis/dermal-hair.js');
const { depictHair, hairClass, HAIR_RAMP } = await import('@/lib/graph/epidermis/hair-depict.js');
const { scoreHair, rasterize, strandMesh, SCORE_VIEWS } = await import('@/lib/graph/epidermis/hair-score.js');

const args = process.argv.slice(2);
let raw = false, styles = null, type = null, level = 'L1', sexArg = null, px = 160, out = '/tmp/hair-sweep';
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--styles') styles = args[++i].split(',');
  else if (a === '--type') type = args[++i];
  else if (a === '--level') level = args[++i];
  else if (a === '--sex') sexArg = args[++i];
  else if (a === '--px') px = +args[++i];
  else if (a === '--out') out = args[++i];
  else if (a === '--raw') raw = true;
  else throw new Error(`hair-sweep: unknown flag ${a}`);
}
styles ??= Object.keys(SCALP_STYLES);
mkdirSync(out, { recursive: true });
const VIEWS = Object.keys(SCORE_VIEWS), heads = {}, rows = [], table = [];
const headOf = (sex) => (heads[sex] ??= (() => { const h = relationalHead({ sex, tune: HEAD_TUNES[sex] }); return { h, chart: relationalHeadChart(h, { cells: 60 }) }; })());
const byte = (v) => Math.round(255 * Math.max(0, Math.min(1, toSrgb(v))));

for (const style of styles) {
  const t0 = Date.now(), S0 = readScalp(style), S = readScalp({ style, ...(type ? { type } : {}) });
  const sex = sexArg ?? (S0.length > 0.25 ? 'female' : 'male'), { h, chart } = headOf(sex), D = readDermis({ from: sex });
  const centre = [0, h.landmarks.eyeR.y * STAND_M * 0.3, h.landmarks.eyeR.z * STAND_M];
  const dep = depictHair(chart, D, S, { level, centre, ...(raw ? { rules: {} } : {}) });
  // the reference: the study's strands (every other), thin, for the outline
  const ref = S.length < 0.02 ? null : strandMesh(growScalp(chart, D, S, { colliders: ['head'] }).strands.filter((_, i) => i % 2 === 0), 0.0012);
  const sc = scoreHair(chart, D, dep, { reference: ref, px });
  // the row: each view z-buffered, a face its group's colour lit by its facing
  const hair = hairColourOf(D), colOf = (g) => (g === 'HairStreak' ? [0.4, 0.15, 0.6] : hair.map((v) => Math.min(1, v * (HAIR_RAMP[g] ?? 1) + 0.003)));
  const meshes = [{ vertices: chart.vertices, faces: chart.faces, groups: null }, ...(dep.strips ? [dep.strips] : []), ...(dep.cap ? [dep.cap] : [])];
  const img = Buffer.alloc(px * VIEWS.length * px * 3, 233);
  VIEWS.forEach((v, k) => {
    const R = rasterize(meshes, v, px, sc.box), view = SCORE_VIEWS[v], a = (view[0] * Math.PI) / 180, e = (view[1] * Math.PI) / 180, eye = [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
    for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
      const o = y * px + x, mi = R.mesh[o]; if (mi < 0) continue;
      const M = meshes[mi], t = M.faces[R.face[o]], [A, B, C] = t.map((q) => M.vertices[q]);
      const n = [(B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]), (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]), (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0])], l = Math.hypot(...n) || 1;
      const lit = 0.45 + 0.55 * Math.abs((n[0] * eye[0] + n[1] * eye[1] + n[2] * eye[2]) / l), base = mi === 0 ? [0.62, 0.6, 0.58] : colOf(M.groups[R.face[o]]);
      const q = (y * px * VIEWS.length + k * px + x) * 3; for (let c = 0; c < 3; c++) img[q + c] = byte(base[c] * lit);
    }
  });
  rows.push({ style, img, sc, sex, type: S.type });
  const row = { style, class: hairClass(S), type: S.type, sex, length: S.length, coverage: sc.coverage, bladeCover: sc.bladeCover, silhouette: sc.silhouette, faces: sc.faces, ms: Date.now() - t0 };
  table.push(row);
  console.log(`${style.padEnd(20)} ${S.type.padEnd(8)} cover ${sc.coverage.toFixed(3)} blades ${sc.bladeCover.toFixed(3)} outline ${sc.silhouette === null ? '  —  ' : sc.silhouette.toFixed(3)} faces ${String(sc.faces).padStart(6)} ${row.ms} ms`);
}
// the sheet: a row a style, its name and scores in a margin
const W = 230 + px * VIEWS.length, H = px * rows.length;
const composites = rows.map((r, i) => ({ input: r.img, raw: { width: px * VIEWS.length, height: px, channels: 3 }, top: i * px, left: 230 }));
const label = rows.map((r, i) => `<text x="8" y="${i * px + 22}" font-family="monospace" font-size="14" fill="#222">${r.style}</text><text x="8" y="${i * px + 42}" font-family="monospace" font-size="11" fill="#444">${r.type} · ${r.sex} · ${hairClass(readScalp(r.style))}</text><text x="8" y="${i * px + 62}" font-family="monospace" font-size="11" fill="${r.sc.coverage < 0.97 ? '#b00' : '#444'}">cover ${r.sc.coverage.toFixed(3)}</text><text x="8" y="${i * px + 78}" font-family="monospace" font-size="11" fill="#444">blades ${r.sc.bladeCover.toFixed(3)}</text><text x="8" y="${i * px + 94}" font-family="monospace" font-size="11" fill="#444">outline ${r.sc.silhouette === null ? '—' : r.sc.silhouette.toFixed(3)}</text><text x="8" y="${i * px + 110}" font-family="monospace" font-size="11" fill="#444">${r.sc.faces} faces</text>`).join('');
composites.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${label}</svg>`), top: 0, left: 0 });
await sharp({ create: { width: W, height: H, channels: 3, background: '#e9e7e3' } }).composite(composites).png().toFile(join(out, 'sheet.png'));
writeFileSync(join(out, 'scores.json'), JSON.stringify(table, null, 2));
console.log(`— hair-sweep: ${rows.length} styles at ${level} → ${join(out, 'sheet.png')}, scores.json`);
