// THE SPLAT — the skin map read as points, the lightest look at a face there is. Every sample of the head's surface net
// (the chart dermal-head.js charts the relational head on) is drawn as a small square, orthographic, the far ones first
// so the near ones cover them (a painter's sort, no z-buffer; a point whose normal faces away is left out), its colour the dermis map's weight of each region asked
// for at that sample (dermal-map.js dermisAt(...).regions: a pale grey where none is). No mesh is rasterised, no atlas painted,
// no hair grown, no light: the map's read is a fraction of a second; the head and its chart are the cost (a pole's in
// seconds; a subject with relations of its own solves its tune first), where the dermis study's lit rows take minutes. Read with it WHERE a region lies on
// the face (the beard's edge, the hairline, a style's zones, the scalp a man's loss leaves) before paying for a render;
// the dermis study (dermis.mjs) then shows how it looks.
//
//   node .claude/skills/dermis-study/splat.mjs [male|female] [--faces '[{…}]'] [--dermis '{…}'] [--regions beard,ear]
//                                              [--views front,34,lateral,back] [--cells N] [--px N] [--out file.png]
//
//   male / female   the pole (default male), its dermis preset under --dermis
//   --faces         subjects as dermis.mjs takes them ({ label, sex, relations, dermis }; the head's relations replaced,
//                   its tune solved for them, which takes a while): one row a subject
//   --dermis        the dermis's dials over the subject's (dermal-map.js DERMIS_DIALS): '{"beardStyle":"goatee","bald":0.8}'
//   --regions       the regions coloured (dermal-map.js region names: beard, scalp, ear, lip, nose, cheek, chin, eyelid,
//                   forehead, …), each its colour, the first listed drawn over the rest where both weigh (default beard,ear)
//   --views         azimuths: front (0°), 34 (the front ¾), lateral (90°), back (180°), or degrees (default all four)
//   --cells         the head's surface net (default 60; finer is denser points and a slower chart)
//   --px            a view's size in pixels (default 360)
//   --out           the PNG (default /tmp/dermis-study/splat.png); the legend and the views' order print to stdout
//
// Pure reads of the map: what it shows is what the textures and the hair are grown from.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const CONTROL = resolve(dirname(new URL(import.meta.url).pathname), '../../../control');
register(pathToFileURL(`${CONTROL}/scripts/mcp-stdio-loader.mjs`).href);
process.chdir(CONTROL);
const { relationalHead } = await import('@/lib/graph/polygonizer/head-relational.js');
const { relationalHeadChart } = await import('@/lib/graph/epidermis/dermal-head.js');
const { HEAD_TUNES } = await import('@/lib/graph/polygonizer/hero-relational-head.js');
const { readDermis, dermisAt } = await import('@/lib/graph/epidermis/dermal-map.js');
const { encodePngRgba } = await import('@/lib/graph/landscape/surface-textures.js');

// ─── the flags ───
const args = process.argv.slice(2);
let faces = [], dermisSpec = {}, regions = ['beard', 'ear'], views = ['front', '34', 'lateral', 'back'], cells = 60, px = 360, out = '/tmp/dermis-study/splat.png', pole = 'male';
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === 'male' || a === 'female') pole = a;
  else if (a === '--faces') faces = JSON.parse(args[++i]);
  else if (a === '--dermis') dermisSpec = JSON.parse(args[++i]);
  else if (a === '--regions') regions = args[++i].split(',');
  else if (a === '--views') views = args[++i].split(',');
  else if (a === '--cells') cells = +args[++i];
  else if (a === '--px') px = +args[++i];
  else if (a === '--out') out = args[++i];
  else throw new Error(`splat: unknown flag ${a}`);
}
if (!faces.length) faces = [{ label: pole, sex: pole }];
const AZ = { front: 0, 34: 35, lateral: 90, back: 180 };
// (a region's colour: the beard's ink, the ear's coral, the scalp's brown, then a wheel)
const COLOURS = { beard: [20, 20, 20], ear: [232, 120, 120], scalp: [110, 70, 40], lip: [200, 60, 90], nose: [240, 170, 60], cheek: [230, 110, 150], chin: [90, 140, 220], eyelid: [120, 90, 200], forehead: [80, 170, 120] };
const wheel = (k) => [[60, 120, 200], [200, 140, 40], [40, 160, 120], [180, 60, 160]][k % 4];
const colourOf = (r, k) => COLOURS[r] ?? wheel(k);

// ─── one subject's points: the chart's vertices and, per vertex, each region's weight ───
function pointsOf(face) {
  const sex = face.sex || pole;
  // (a pole's own head takes its saved tune: no solve; relations of its own are solved for, which takes the time)
  const head = relationalHead({ sex, tune: face.relations ? true : HEAD_TUNES[sex], ...(face.relations ? { relations: face.relations } : {}) });
  const chart = relationalHeadChart(head, { cells }), D = readDermis({ from: sex, ...(face.dermis || {}), ...dermisSpec });
  return chart.samples.map((s, i) => { if (!s) return null; const R = dermisAt(s, D, { detail: false }).regions; return { p: chart.vertices[i], n: s.n, w: regions.map((r) => R[r] || 0) }; }).filter(Boolean);
}
// ─── a view: the points turned by the azimuth about the head's vertical, orthographic, the far first ───
function splat(P, az, img, W, x0, y0, box) {
  const c = Math.cos((az * Math.PI) / 180), s = Math.sin((az * Math.PI) / 180);
  // the chart's frame: x across (the figure's right +), y forward, z up; a view looks at the face turned by `az`
  // (a point facing away is behind the head from here: left out, so the far side never shows between the near points)
  const T = P.filter(({ n }) => !n || n[0] * s + n[1] * c > -0.05).map(({ p, w }) => ({ u: p[0] * c - p[1] * s, d: p[0] * s + p[1] * c, z: p[2], w }));
  T.sort((a, b) => a.d - b.d);
  const sc = (W * 0.9) / Math.max(box.w, box.h), dot = Math.max(3, Math.round((W * 60) / (cells * 110)));
  for (const t of T) {
    const X = Math.round(x0 + W / 2 + (t.u - box.cu) * sc), Y = Math.round(y0 + W / 2 - (t.z - box.cz) * sc);
    // (the first region listed that weighs wins; its weight shades white toward its colour)
    let col = [226, 222, 216];   // (skin no region weighs on: a pale grey, so the head's own shape reads)
    for (let k = regions.length - 1; k >= 0; k--) if (t.w[k] > 0.02) { const C = colourOf(regions[k], k), a = Math.min(1, t.w[k]); col = col.map((v, j) => Math.round(v + (C[j] - v) * a)); }
    for (let dy = 0; dy < dot; dy++) for (let dx = 0; dx < dot; dx++) {
      const xx = X + dx, yy = Y + dy; if (xx < 0 || yy < 0 || xx >= img.W || yy >= img.H) continue;
      const o = (yy * img.W + xx) * 4; img.px[o] = col[0]; img.px[o + 1] = col[1]; img.px[o + 2] = col[2]; img.px[o + 3] = 255;
    }
  }
}

const img = { W: px * views.length, H: px * faces.length };
img.px = new Uint8Array(img.W * img.H * 4).fill(255);
faces.forEach((face, row) => {
  const t0 = Date.now(), P = pointsOf(face);
  const xs = P.map((q) => q.p[0]), ys = P.map((q) => q.p[1]), zs = P.map((q) => q.p[2]);
  const r = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2;
  const box = { cu: 0, cz: (Math.max(...zs) + Math.min(...zs)) / 2, w: 2 * r, h: Math.max(...zs) - Math.min(...zs) };
  views.forEach((v, col) => splat(P, AZ[v] ?? +v, img, px, col * px, row * px, box));
  console.log(`${face.label ?? face.sex ?? pole}: ${P.length} points, ${Date.now() - t0} ms`);
});
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, encodePngRgba(Buffer.from(img.px.buffer), img.W, img.H));
console.log(`— splat: rows ${faces.map((f) => f.label ?? f.sex ?? pole).join(', ')} · views ${views.join(', ')} · regions ${regions.map((r, k) => `${r} rgb(${colourOf(r, k).join(',')})`).join(', ')} → ${out}`);
