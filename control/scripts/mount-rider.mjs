#!/usr/bin/env node
/**
 * mount-rider.mjs — the rider on the mount, for the eyes: the realistic hero seated in the saddle and carried through the
 * clips by its riding seat (mount/rider.js), drawn with the horse and its tack. The hero is minted once and its recipe
 * cached (`--cache`, default the system's temp folder): a mint takes some forty seconds, a cached one under one.
 *
 *   node scripts/mount-rider.mjs <out-dir> [--cells 64] [--cache <file>] [--png]
 */
import { register } from 'node:module';
register('./mcp-stdio-loader.mjs', import.meta.url);
import path from 'node:path';
import os from 'node:os';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(`--${k}`); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args.splice(i, 2)[1] : d; };
const cells = Number(opt('cells', 64)), cache = opt('cache', path.join(os.tmpdir(), 'mojulo-rider-male-realistic.json')), png = flag('png');
const out = args[0] || '.';
mkdirSync(out, { recursive: true });

const { resolveMount } = await import('../lib/graph/mount/build.js');
const { bodyMesh, bodyField } = await import('../lib/graph/mount/body.js');
const { boneFrames, skinPose } = await import('../lib/graph/mount/skin.js');
const { standPose } = await import('../lib/graph/mount/gait.js');
const { coatColor } = await import('../lib/graph/mount/coats.js');
const { tackPieces, tackSkin, ribbon, TACK_COLOURS } = await import('../lib/graph/mount/tack.js');
const { mountClips } = await import('../lib/graph/mount/export.js');
const { ridingGeometry, riderSeat, riderPose, riderClipModes, RIDER_MODES, KNEE, carriageOf, riddenFrame, reinCurve } = await import('../lib/graph/mount/rider.js');
const { bodySheet } = await import('../lib/graph/mount/body-sheet.js');
const { compileLayered } = await import('../lib/graph/polygonizer/station-loft.js');
const { validateRig, bindLayered } = await import('../lib/graph/polygonizer/station-loft-rig.js');
const { poseLayered } = await import('../lib/graph/polygonizer/hero-gesture.js');

const t0 = Date.now(), lap = (w) => console.log(`${w} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
// THE RIDER: minted once, its recipe cached
let recipe;
if (existsSync(cache)) recipe = JSON.parse(readFileSync(cache, 'utf8'));
else {
  const { heroRecord, expandLayeredManifest } = await import('../lib/mcp/tools/layered.js');
  recipe = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic' }) }).recipe;
  writeFileSync(cache, JSON.stringify(recipe));
}
const hmesh = compileLayered(recipe), R = { ...validateRig(recipe.rig), reach: 'clamp' }, hskin = bindLayered(hmesh, recipe, R), H = { R, mesh: hmesh, skin: hskin, recipe };
lap(`rider: ${hmesh.vertices.length} vertices`);

// THE HORSE and its tack
const B = resolveMount('horse'), m = bodyMesh(B, { cells }), F = bodyField(B), rest = boneFrames(B, standPose(B));
const pcs0 = tackPieces(B, { reins: false }), anchors = pcs0.anchors;
const geo0 = ridingGeometry(anchors, rest, rest);
const cal = riderSeat(H, geo0, (p) => F.field(p));
lap(`seated: leathers ${cal.leather.toFixed(3)} m, irons ${cal.out.toFixed(3)} m out, splay ${cal.splay}°`);
const pcs = tackPieces(B, { reins: false, stirrups: { length: cal.leather, out: cal.out } }), tsk = tackSkin(pcs, m);
lap('tack');

const coat = m.quads.map((q) => { const c = q.map((i) => m.vertices[i]).reduce((a, b) => a.map((x, i) => x + b[i] / 4), [0, 0, 0]); return coatColor('bay', m.parts[q[0]], c, { stand: m.stand }); });
// the rider's clothes by group (the hero's own palette where it names one)
const pal = recipe.palette || {}, hex = (g) => (typeof pal[g] === 'string' ? pal[g] : pal[g]?.fill) ?? { Skin: '#d9a789', Top: '#2f3a52', Bottom: '#d8cfb6', Shoes: '#1c1c1c' }[g] ?? '#8a8f96';
// (for the sheet the rider is decimated: its rest vertices clustered on a 1.5 cm grid, each cluster drawn at its first
// vertex's posed place; the export carries the whole mesh)
const cl = new Map(), rep = [], of = hmesh.vertices.map((v, vi) => { const kk = v.map((x) => Math.floor(x / 0.015)).join(","); if (!cl.has(kk)) { cl.set(kk, rep.length); rep.push(vi); } return cl.get(kk); });
const seenF = new Set(), dfaces = [], hcol = [];
hmesh.faces.forEach((f, fi) => { const g = f.map((i) => of[i]); if (g[0] === g[1] || g[1] === g[2] || g[0] === g[2]) return; const kk = [...g].sort((a, b) => a - b).join(','); if (seenF.has(kk)) return; seenF.add(kk); dfaces.push(g); hcol.push(hex(hmesh.groups[fi])); });
console.log(`rider for the sheet: ${dfaces.length} faces of ${hmesh.faces.length}`);
const lbs = (v, ws, frames) => { let p = [0, 0, 0]; for (const [bone, w] of ws) { const r = rest[bone], q = frames[bone], d = v.map((x, i) => x - r.h[i]), l = [0, 1, 2].map((a) => d[0] * r.R[a][0] + d[1] * r.R[a][1] + d[2] * r.R[a][2]); for (let a = 0; a < 3; a++) p[a] += w * (q.h[a] + q.R[0][a] * l[0] + q.R[1][a] * l[1] + q.R[2][a] * l[2]); } return p; };

/** the fist's middle (the rein runs through it): between the wrist and the knuckles */
const fistOf = (n, S) => n[`wrist${S}`].map((x, i) => x + (n[`knuckles${S}`][i] - x) * 0.55);
let REIN = null;                                                  // the reins' length: the ridden halt's bit-to-fist, and a little
/** one cell: the horse posed, its tack, the rider posed by its words, the reins from the bit to the fists */
function scene(frames, riderWords, view, caption, geo = null) {
  const V = skinPose(m, rest, frames), Q = [...m.quads], C = [...coat], T = m.quads.map(() => false);
  pcs.forEach((pc, k) => { const o = V.length; pc.vertices.forEach((v, j) => V.push(lbs(v, tsk[k][j], frames))); Q.push(...pc.quads.map((q) => q.map((i) => i + o))); C.push(...pc.colors); T.push(...pc.quads.map(() => true)); });
  const PL = poseLayered(hmesh, recipe, riderWords, { R, skin: hskin }), P = PL.mesh.vertices, o = V.length;
  if (geo) for (const S of ['R', 'L']) {
    const fist = fistOf(PL.nodes, S), bit = geo.bits[S];
    if (REIN === null) REIN = Math.hypot(...fist.map((x, i) => x - bit[i])) + 0.02;
    const pts = reinCurve(bit, fist, REIN, 8), r = ribbon(pts, pts.map(() => [0, 0, 1]), { width: 0.018, thick: 0.005, colour: TACK_COLOURS.leather }), o2 = V.length;
    V.push(...r.vertices); Q.push(...r.quads.map((q) => q.map((i) => i + o2))); C.push(...r.colors); T.push(...r.quads.map(() => true));
  }
  const o3 = V.length;
  V.push(...rep.map((i) => P[i])); dfaces.forEach((f, fi) => { Q.push([f[0] + o3, f[1] + o3, f[2] + o3, f[2] + o3]); C.push(hcol[fi]); T.push(false); });
  void o;
  return { vertices: V, quads: Q, colors: C, twoSided: T, view, caption };
}

const rows = [];
// the halt, ridden: the horse in its ridden head carriage, the rider's hands on the line to the higher bit
const stand1 = riddenFrame(standPose(B), carriageOf(standPose(B))), rest1 = boneFrames(B, stand1), geo1 = ridingGeometry(anchors, rest1, rest);
{ const p = riderPose(H, cal, geo1, RIDER_MODES.sit).pose; rows.push({ label: 'seated at the halt', sub: `the classical seat: leathers ${cal.leather.toFixed(2)} m (the knee at ${KNEE}°), the knees out ${cal.splay}°`, cells: ['side', 'threeQuarter', 'front', 'rearQuarter'].map((v) => scene(rest1, p, v, v, geo1)) }); }
const clips = mountClips(B, { names: ['trot', 'gallop', 'jump'], ridden: true });
for (const [name, label, pick] of [['trot', 'the rising trot', [0, 0.2, 0.4, 0.6, 0.8]], ['gallop', 'the gallop in two-point', [0, 0.25, 0.5, 0.75]], ['jump', 'the jump', null]]) {
  const c = clips[name], K = c.once ? Math.round(c.s * 30) + 1 : Math.round(c.s * 30), kt = (k) => (c.once ? c.s * k / (K - 1) : c.s * k / K);
  const frames = Array.from({ length: K }, (_, k) => c.at(kt(k))), modes = riderClipModes(name, c, frames, kt);
  // the seat a two-point holds: the saddle's mean place over the clip
  // (a moving average of the saddle's place over a third of a second: the steadier seat a two-point holds while the
  // legs take the stride's heave, which still rides a jump's flight)
  const geos = frames.map((f) => ridingGeometry(anchors, boneFrames(B, f), rest)), wk = Math.max(1, Math.round(0.17 * 30));
  const hold = geos.map((_, k) => { const acc = [0, 0, 0]; let n = 0; for (let j = -wk; j <= wk; j++) { const i = c.once ? Math.min(K - 1, Math.max(0, k + j)) : (k + j + K) % K; acc[0] += geos[i].seat[0]; acc[1] += geos[i].seat[1]; acc[2] += geos[i].seat[2]; n++; } return acc.map((x) => x / n); });
  const ks = pick ? pick.map((u) => Math.round(u * K) % K) : [c.flight.launch - 0.6, c.flight.launch - 0.1, c.flight.apex, c.flight.touchdown, c.flight.touchdown + 0.4].map((t) => Math.round(t / c.s * (K - 1)));
  let seed = {};
  const cellsRow = ks.map((k) => { const r = riderPose(H, cal, geos[k], modes[k].mode, { rise: modes[k].rise, seatHold: hold[k], seed }); seed = r.seed; return scene(boneFrames(B, frames[k]), r.pose, 'side', `${name} ${kt(k).toFixed(2)} s · rise ${(modes[k].rise * 100).toFixed(0)} cm · lean ${modes[k].mode.lean.toFixed(0)}°`, geos[k]); });
  rows.push({ label, sub: '', cells: cellsRow });
  lap(label);
}
// THE ARMS, close: the rider's upper body and the horse's neck to the bit (the line elbow, hand, bit judged here)
const crop = (cell, geo) => { const ids = cell.quads.map((q, i) => i).filter((i) => { const c = cell.quads[i].map((k) => cell.vertices[k]).reduce((a, b) => a.map((x, j) => x + b[j] / 4), [0, 0, 0]); return c[2] > geo.seat[2] - 0.05 && c[1] > geo.seat[1] - 0.45 && c[1] < geo.bits.R[1] + 0.15; }); return { ...cell, quads: ids.map((i) => cell.quads[i]), colors: ids.map((i) => cell.colors[i]), twoSided: ids.map((i) => cell.twoSided[i]), ownScale: true }; };
{
  const close = [];
  const halt = riderPose(H, cal, geo1, RIDER_MODES.sit).pose;
  close.push(crop(scene(rest1, halt, 'side', 'halt', geo1), geo1), crop(scene(rest1, halt, 'threeQuarter', 'halt, ¾', geo1), geo1));
  for (const [name, mode, label] of [['gallop', RIDER_MODES.two, 'two-point'], ['jump', RIDER_MODES.fold, 'the fold']]) {
    const c = clips[name], t = name === 'jump' ? c.flight.apex : 0.25 * c.s, f = boneFrames(B, c.at(t)), g = ridingGeometry(anchors, f, rest);
    close.push(crop(scene(f, riderPose(H, cal, g, mode, { seatHold: g.seat }).pose, 'side', label, g), g));
  }
  rows.push({ label: 'the arms, close', sub: 'the upper arm by the side, the forearm, the fist and the rein one line to the bit', cells: close });
}
writeFileSync(path.join(out, 'mount-rider.svg'), bodySheet(rows, { title: 'the rider on the mount', cellW: 420, cellH: 360 }));
if (png) {
  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage(); await page.goto('file://' + path.resolve(out, 'mount-rider.svg')); await (await page.$('svg')).screenshot({ path: path.join(out, 'mount-rider.png') }); await browser.close();
}
console.log('wrote', path.join(out, 'mount-rider.svg'));
