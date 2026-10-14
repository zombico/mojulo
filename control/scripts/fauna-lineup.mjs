#!/usr/bin/env node
/**
 * The fauna lineup: species ring plans drawn as flat-shaded contact sheets, one row a species, four views across
 * (side, rear three-quarter, front, top), with no database and no browser. The eyes-gate sheet for a proportion pass:
 * render a family before and after a change and read the two side by side. `--measure` prints the proportion readout
 * the pass steers by instead (or as well): the trunk's width over its height, the legs' outer reach over the trunk's
 * half-width (above 1 the legs stand out past the body's sides from the front), the head's length over the trunk's,
 * and the head's centre against the top of the back.
 *
 * Usage (from control/):
 *   node scripts/fauna-lineup.mjs --out <dir> [<species|family> ...]   one sheet per family (rows of five), or per species
 *   node scripts/fauna-lineup.mjs --out <dir> --one cats lion tiger     every named row on one sheet, cats.png
 *   node scripts/fauna-lineup.mjs --measure [<species|family> ...]       the readout only (no names: every species)
 *   options: --parts (each face coloured by its part, to tell which part makes a lump), --head (each view cropped to the
 *            head: the skull, jaw, eyes, ears and nose), --size 300 (a view's pixels)
 * Orthographic, each view fitted to its own frame: compare proportions within a row, not sizes between rows.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { register } from 'node:module';

const { values: args, positionals: names } = parseArgs({ allowPositionals: true, options: {
  out: { type: 'string' }, one: { type: 'string' }, measure: { type: 'boolean' }, parts: { type: 'boolean' }, head: { type: 'boolean' }, size: { type: 'string', default: '300' },
} });
if (!args.out && !args.measure) { console.error('need --out <dir> (sheets) or --measure (the readout)'); process.exit(1); }

register('./mcp-stdio-loader.mjs', import.meta.url);
const { SPECIES, speciesPlan } = await import('@/lib/graph/fauna/species.js');
const { expandPlan } = await import('@/lib/graph/polygonizer/station-loft-plan.js');
const { compileLayered } = await import('@/lib/graph/polygonizer/station-loft.js');

const families = {}; for (const [id, s] of Object.entries(SPECIES)) (families[s.family] ??= []).push(id);
for (const n of names) if (!families[n] && !SPECIES[n]) { console.error(`no species or family '${n}'`); process.exit(1); }
const meshOf = (id) => compileLayered(expandPlan(speciesPlan(id)));

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
const box = (pts) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], p[c]); hi[c] = Math.max(hi[c], p[c]); } return { lo, hi }; };

if (args.measure) {
  const ids = names.length ? names.flatMap((n) => families[n] || [n]) : Object.keys(SPECIES);
  const r2 = (x) => (Number.isFinite(x) ? (Math.round(x * 100) / 100).toFixed(2) : '-');
  console.log(['species', 'trunk W/H', 'legs/trunk', 'head/trunk', 'head drop', 'withers'].map((h, i) => (i ? h.padStart(11) : h.padEnd(18))).join(''));
  for (const id of ids) {
    const m = meshOf(id), pts = (re) => Object.entries(m.parts).filter(([n]) => re.test(n)).flatMap(([, p]) => Object.values(p.points || {}));
    const T = pts(/^torso$/); if (!T.length) { console.log(id.padEnd(18), 'no trunk'); continue; }
    const t = box(T), W = t.hi[0] - t.lo[0], H = t.hi[2] - t.lo[2], L = t.hi[1] - t.lo[1];
    const legs = pts(/^(upperArm|foreArm|thigh|shin|gaskin|cannon|meta|pastern|forePaw|hindPaw)/), head = pts(/^(cranium|jaw|head)$/);
    const h = head.length ? box(head) : null;
    console.log([id.padEnd(18), ...[W / H, legs.length ? box(legs).hi[0] / (W / 2) : NaN, h ? (h.hi[1] - h.lo[1]) / L : NaN, h ? t.hi[2] - (h.hi[2] + h.lo[2]) / 2 : NaN, t.hi[2]].map((x) => r2(x).padStart(11))].join(''));
  }
  if (!args.out) process.exit(0);
}

const sharp = (await import('sharp')).default;
const S = Number(args.size);
// [azimuth, elevation] in degrees: azimuth 0 looks at the rump, 90 at the right flank, 180 at the face
const VIEWS = [[90, 8], [140, 15], [180, 5], [90, 80]];
const hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const hashColour = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return [90 + (h % 140), 80 + ((h >> 8) % 140), 80 + ((h >> 16) % 140)]; };
const colourOf = (g, pal) => (typeof pal[g] === 'string' && pal[g].startsWith('#') ? hex(pal[g]) : hashColour(g));

function view(mesh, groupOf, pal, [az, el], frameIdx = null) {
  const a = az * Math.PI / 180, e = el * Math.PI / 180;
  const eye = [Math.sin(a) * Math.cos(e), -Math.cos(a) * Math.cos(e), Math.sin(e)];
  const right = unit(cross([0, 0, 1], eye)), up = cross(eye, right);
  const V = mesh.vertices.map((v) => [dot(v, right), dot(v, up), dot(v, eye)]), b = box(frameIdx ? frameIdx.map((i) => V[i]) : V);
  const k = (S * 0.9) / Math.max(b.hi[0] - b.lo[0], b.hi[1] - b.lo[1]), ox = S / 2 - k * (b.lo[0] + b.hi[0]) / 2, oy = S / 2 + k * (b.lo[1] + b.hi[1]) / 2;
  const P = V.map((p) => [ox + p[0] * k, oy - p[1] * k, p[2]]);
  const img = new Uint8Array(S * S * 3).fill(238), zb = new Float32Array(S * S).fill(-Infinity), light = unit([0.4, -0.3, 0.85]);
  mesh.faces.forEach((f, i) => {
    const [A, B, C] = f.map((j) => mesh.vertices[j]); let n = unit(cross(sub(B, A), sub(C, A))); if (dot(n, eye) < 0) n = n.map((x) => -x);
    const lit = 0.45 + 0.5 * Math.max(0, dot(n, light)) + 0.1 * Math.max(0, dot(n, eye)), col = colourOf(groupOf(i), pal).map((c) => Math.min(255, c * lit));
    const [p, q, r] = f.map((j) => P[j]), d = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); if (Math.abs(d) < 1e-9) return;
    const x0 = Math.max(0, Math.floor(Math.min(p[0], q[0], r[0]))), x1 = Math.min(S - 1, Math.ceil(Math.max(p[0], q[0], r[0])));
    const y0 = Math.max(0, Math.floor(Math.min(p[1], q[1], r[1]))), y1 = Math.min(S - 1, Math.ceil(Math.max(p[1], q[1], r[1])));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5, w1 = ((q[0] - px) * (r[1] - py) - (q[1] - py) * (r[0] - px)) / d, w2 = ((r[0] - px) * (p[1] - py) - (r[1] - py) * (p[0] - px)) / d, w3 = 1 - w1 - w2;
      if (w1 < 0 || w2 < 0 || w3 < 0) continue;
      const z = w1 * p[2] + w2 * q[2] + w3 * r[2], at = y * S + x; if (z > zb[at]) { zb[at] = z; img.set(col, at * 3); }
    }
  });
  // the outline: a dark pixel wherever the figure meets the background
  const out = new Uint8Array(img);
  for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) { const at = y * S + x;
    if (zb[at] !== -Infinity && [zb[at - 1], zb[at + 1], zb[at - S], zb[at + S]].some((w) => w === -Infinity)) out.set([40, 40, 45], at * 3); }
  return out;
}

async function sheet(ids, file) {
  const W = S * VIEWS.length, H = S * ids.length, buf = new Uint8Array(W * H * 3).fill(255), labels = [];
  ids.forEach((id, row) => {
    const plan = speciesPlan(id), mesh = meshOf(id);
    const pal = Object.assign({}, ...(plan.heads || []).map((h) => h.plan?.palette || {}), plan.palette || {});
    const groupOf = args.parts ? (i) => mesh.faceIds[i].split('/')[0].replace(/[LR]$/, '') : (i) => mesh.groups[i];
    // --head: frame each view on the head's own vertices (the faces of the skull, jaw, eyes, ears, nose)
    const frameIdx = args.head ? [...new Set(mesh.faces.flatMap((f, i) => (/^(cranium|jaw|head|eye|catch|brow|lid|orbit|ear|nose|nostril|whisker)/i.test(mesh.faceIds[i]) ? f : [])))] : null;
    VIEWS.forEach((v, col) => { const img = view(mesh, groupOf, args.parts ? {} : pal, v, frameIdx?.length ? frameIdx : null);
      for (let y = 0; y < S; y++) buf.set(img.subarray(y * S * 3, (y + 1) * S * 3), ((row * S + y) * W + col * S) * 3); });
    labels.push(`<text x="6" y="${row * S + 18}" font-size="16" font-family="sans-serif" fill="#222">${id}</text>`);
  });
  const svg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${labels.join('')}</svg>`);
  await sharp(Buffer.from(buf), { raw: { width: W, height: H, channels: 3 } }).composite([{ input: svg }]).png().toFile(file);
  console.log(file);
}

fs.mkdirSync(args.out, { recursive: true });
if (args.one) await sheet(names.flatMap((n) => families[n] || [n]), path.join(args.out, `${args.one}.png`));
else for (const n of names.length ? names : Object.keys(families)) {
  if (!families[n]) { await sheet([n], path.join(args.out, `${n}.png`)); continue; }
  for (let i = 0; i < families[n].length; i += 5) await sheet(families[n].slice(i, i + 5), path.join(args.out, `${n}${i ? `-${i / 5}` : ''}.png`));
}
