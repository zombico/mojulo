/**
 * Front parts-bank runner (animation-cheats.plan.md, bank v2) — point it at
 * a character directory holding renders/front-full.png +
 * renders/front-armless-v2.png (the two worker deliverables) and it runs
 * the whole deterministic chain: flood-key → registration → capsule
 * harvest → parts sheet → wave assembly frames → GIF. Zero generations.
 *
 *   cd control && node lib/graph/image-outcomes/parts-bank-spike/run-front-bank.mjs \
 *     ../lite-template/integration/0712/spike-output/animation-cheats/<character>
 *
 * Joints: declared A-pose nodes by default; drop a bank/measured-nodes.json
 * ({ nodeName: [x, y] } in REGISTERED canvas space) to override — the
 * calibration fallback when the paint's proportions drift off the rig's.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import { CANVAS, bankScaffold, targetScaffold, frontArmDefs, frontLegDefs, SHEET } from './front.js';
import { harvestParts } from './harvest.js';
import { segmentTransform, transformPart, over, fillEnclosedHoles } from './assemble.js';
import { floodKey } from './key.js';
import { encodeGifBuffers } from '../../../motion/encode-gif.js';

const DIR = path.resolve(process.argv[2] || '.');
const { width: W, height: H } = CANVAS;

const write = async (rel, data) => {
  const p = path.join(DIR, rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, data);
  return p;
};
const exists = (p) => fs.access(p).then(() => true, () => false);

const bank = bankScaffold();

// ── key + register ──
const keyedOf = async (p) => {
  const rgba = await sharp(p).resize({ width: W, height: H, fit: 'fill' }).ensureAlpha().raw().toBuffer();
  return { rgba, stats: floodKey(rgba, CANVAS) };
};
let { rgba: fullRgba, stats } = await keyedOf(path.join(DIR, 'renders', 'front-full.png'));
let { rgba: armlessRgba } = await keyedOf(path.join(DIR, 'renders', 'front-armless-v2.png'));

const scaffoldAlpha = await sharp(Buffer.from(bank.figureSvg)).resize({ width: W, height: H, fit: 'fill' }).ensureAlpha().raw().toBuffer();
const bboxOf = (buf) => {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (buf[(y * W + x) * 4 + 3] > 28) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  }
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, h: y1 - y0 };
};
// MERU banks (painted over the guide) are already in declared space —
// bbox registration would SHRINK them (hair/boots legitimately overflow
// the mannequin silhouette) and misalign the joints the paint honors.
// Pass --meru (or drop a bank/meru.flag) to skip registration.
const meru = process.argv.includes('--meru') || await exists(path.join(DIR, 'bank', 'meru.flag'));
const rb = bboxOf(fullRgba), sb = bboxOf(scaffoldAlpha);
const regT = meru
  ? { theta: 0, s: 1, from: [0, 0], to: [0, 0] }
  : segmentTransform([rb.cx, rb.y1], [rb.cx, rb.y1 - rb.h], [sb.cx, sb.y1], [sb.cx, sb.y1 - sb.h]);
if (!meru) {
  fullRgba = transformPart(fullRgba, CANVAS, regT);
  armlessRgba = transformPart(armlessRgba, CANVAS, regT);
} else console.log('meru contract: registration skipped (identity)');
await write('assembly/registration.json', JSON.stringify({ renderBbox: rb, scaffoldBbox: sb, scale: regT.s, keyStats: stats }, null, 2));
await write('assembly/full-keyed.png', await sharp(fullRgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer());
await write('assembly/armless-keyed.png', await sharp(armlessRgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer());

// ── joints: declared, with measured override ──
let M = Object.fromEntries(Object.entries(bank.nodes).map(([k, v]) => [k, [...v]]));
const measuredPath = path.join(DIR, 'bank', 'measured-nodes.json');
if (await exists(measuredPath)) {
  Object.assign(M, JSON.parse(await fs.readFile(measuredPath, 'utf8')));
  console.log('using measured joint overrides from bank/measured-nodes.json');
}

// ── harvest ──
const parts = { ...harvestParts(fullRgba, CANVAS, frontArmDefs(M)).parts };
const legH = harvestParts(armlessRgba, CANVAS, frontLegDefs(M));
Object.assign(parts, legH.parts);
const torso = legH.torso;
fillEnclosedHoles(torso.raw, CANVAS);
for (const [id, part] of Object.entries(parts)) {
  await write(`assembly/part-${id}.png`, await sharp(part.raw, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer());
}
await write('assembly/part-torso.png', await sharp(torso.raw, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer());

// ── ROUND-TRIP AUDIT (the success test: parts keep scale, stay connected,
// are not chopped up). Three measurements, written to assembly/audit.json:
// 1. connectivity — each part's largest connected component as a fraction
//    of its pixel mass (chopped part → low fraction);
// 2. coverage — parts+torso vs the keyed full figure (dropped paint);
// 3. round-trip — reassemble at the BANK pose itself (identity transforms)
//    and IoU against the original: a perfect harvest reproduces the render.
const audit = { parts: {}, coverage: null, roundTripIoU: null };
const componentFrac = (raw) => {
  const seen = new Uint8Array(W * H);
  const q = new Int32Array(W * H);
  let total = 0, largest = 0;
  for (let i = 0; i < W * H; i += 1) if (raw[i * 4 + 3] > 0) total += 1;
  for (let s = 0; s < W * H; s += 1) {
    if (raw[s * 4 + 3] === 0 || seen[s]) continue;
    let qh = 0, qt = 0, size = 0;
    q[qt++] = s; seen[s] = 1;
    while (qh < qt) {
      const i = q[qh++]; size += 1;
      const x = i % W, y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j >= 0 && raw[j * 4 + 3] > 0 && !seen[j]) { seen[j] = 1; q[qt++] = j; }
      }
    }
    if (size > largest) largest = size;
  }
  return { total, largestFrac: total ? Math.round((largest / total) * 1000) / 1000 : 1 };
};
for (const [id, part] of Object.entries(parts)) audit.parts[id] = componentFrac(part.raw);
{
  // coverage + identity round-trip: union of torso + all parts vs full figure
  const union = Buffer.alloc(W * H * 4);
  over(union, Buffer.from(torso.raw), CANVAS);
  for (const part of Object.values(parts)) over(union, Buffer.from(part.raw), CANVAS);
  let inter = 0, uni = 0, fullN = 0, unionN = 0;
  for (let i = 0; i < W * H; i += 1) {
    const a = fullRgba[i * 4 + 3] > 28, b = union[i * 4 + 3] > 28;
    if (a) fullN += 1;
    if (b) unionN += 1;
    if (a && b) inter += 1;
    if (a || b) uni += 1;
  }
  audit.coverage = Math.round((inter / (fullN || 1)) * 1000) / 1000;
  audit.roundTripIoU = Math.round((inter / (uni || 1)) * 1000) / 1000;
  await write('assembly/round-trip.png', await sharp(union, { raw: { width: W, height: H, channels: 4 } }).flatten({ background: '#add0eb' }).png().toBuffer());
}
// meru compliance: the paint must live between the declared crown/ground
// register lines (hair may exceed crown slightly; nothing may pass ground).
if (meru) {
  let top = H, bottom = -1;
  for (let i = 0; i < W * H; i += 1) if (fullRgba[i * 4 + 3] > 28) { const y = (i / W) | 0; if (y < top) top = y; if (y > bottom) bottom = y; }
  let crown = H, ground = -1;
  for (let i = 0; i < W * H; i += 1) if (scaffoldAlpha[i * 4 + 3] > 28) { const y = (i / W) | 0; if (y < crown) crown = y; if (y > ground) ground = y; }
  const span = ground - crown;
  audit.meru = {
    declared: { crown, ground, span },
    painted: { top, bottom, span: bottom - top },
    crownDeltaPx: crown - top,            // >0 = paint taller than the unit
    groundDeltaPx: bottom - ground,       // >0 = feet below the ground line
    heightRatio: Math.round(((bottom - top) / span) * 1000) / 1000,
  };
  const ok = Math.abs(audit.meru.heightRatio - 1) < 0.05 && audit.meru.groundDeltaPx < span * 0.02;
  audit.meru.compliant = ok;
  if (!ok) {
    await write('bank/RETRY.md', [
      '# Meru compliance retry — feedback for the render worker',
      '',
      `Your render exceeded the meru span: painted height is ${audit.meru.heightRatio}x`,
      `the declared crown-to-ground unit (must be within 5%). Head top at y=${top}`,
      `vs crown line y=${crown}; lowest boot pixel at y=${bottom} vs ground line y=${ground}.`,
      '',
      'Redo Deliverable 1 as an edit of meru-guide-apose.png with the character',
      `SHRUNK to fit: crown of the head at or just below y=${crown} (hair may rise`,
      `slightly above), soles exactly ON the ground line y=${ground}, never below.`,
      'Keep pose, identity, style, and background rules unchanged. Then redo',
      'Deliverable 2 from the corrected Deliverable 1.',
    ].join('\n'));
    console.log('meru NON-COMPLIANT — bank/RETRY.md written for the worker');
  }
  // the overlay diagnostic: declared skeleton + register lines over the
  // paint — the "show how it overlays" artifact, for worker feedback
  const skel = await sharp(Buffer.from(bank.skeletonSvg)).resize({ width: W, height: H, fit: 'fill' }).png().toBuffer();
  const regLines = Buffer.from([
    `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'>`,
    `<line x1='0' y1='${audit.meru.declared.crown}' x2='${W}' y2='${audit.meru.declared.crown}' stroke='#ff5555' stroke-width='3'/>`,
    `<line x1='0' y1='${audit.meru.declared.ground}' x2='${W}' y2='${audit.meru.declared.ground}' stroke='#ff5555' stroke-width='3'/>`,
    '</svg>',
  ].join(''));
  await write('assembly/meru-overlay.png', await sharp(fullRgba, { raw: { width: W, height: H, channels: 4 } })
    .flatten({ background: '#add0eb' })
    .composite([{ input: skel, blend: 'screen' }, { input: await sharp(regLines).png().toBuffer() }])
    .png().toBuffer());
}
await write('assembly/audit.json', JSON.stringify(audit, null, 2));
console.log('audit:', JSON.stringify({ coverage: audit.coverage, roundTripIoU: audit.roundTripIoU, chopped: Object.entries(audit.parts).filter(([, v]) => v.largestFrac < 0.95).map(([k]) => k) }));

// ── parts sheet ──
const trimFit = async (raw, w, h) =>
  sharp(await sharp(raw.raw ?? raw, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer())
    .trim().resize({ width: w, height: h, fit: 'inside' }).png().toBuffer();
const cellsSpec = [
  { id: 'torso', buf: await trimFit(torso, 400, 760), x: 70, y: 36 },
  { id: 'upperArmL', buf: await trimFit(parts.upperArmL, 150, 300), x: 560, y: 50 },
  { id: 'forearmL', buf: await trimFit(parts.forearmL, 150, 300), x: 750, y: 50 },
  { id: 'upperArmR', buf: await trimFit(parts.upperArmR, 150, 300), x: 940, y: 50 },
  { id: 'forearmR', buf: await trimFit(parts.forearmR, 150, 300), x: 1085, y: 50 },
  { id: 'lowerLegL', buf: await trimFit(parts.lowerLegL, 240, 380), x: 600, y: 420 },
  { id: 'lowerLegR', buf: await trimFit(parts.lowerLegR, 240, 380), x: 920, y: 420 },
];
const layout = [];
for (const c of cellsSpec) { const m = await sharp(c.buf).metadata(); layout.push({ id: c.id, x: c.x, y: c.y, w: m.width, h: m.height }); }
await write('sheet/parts-sheet-mechanical.png', await sharp({ create: { width: SHEET.width, height: SHEET.height, channels: 3, background: SHEET.bg } })
  .composite(cellsSpec.map((c) => ({ input: c.buf, left: c.x, top: c.y }))).png().toBuffer());
await write('sheet/layout.json', JSON.stringify({ canvas: SHEET, cells: layout }, null, 2));

// ── wave assembly frames + GIF ──
const proximalPoint = (raw, [rx, ry]) => {
  let best = Infinity, pt = [rx, ry];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    if (raw[(y * W + x) * 4 + 3] === 0) continue;
    const d = (x - rx) ** 2 + (y - ry) ** 2;
    if (d < best) { best = d; pt = [x, y]; }
  }
  return pt;
};
const applyT = (t, [x, y]) => {
  const c = Math.cos(t.theta), s = Math.sin(t.theta);
  const dx = x - t.from[0], dy = y - t.from[1];
  return [(c * dx - s * dy) * t.s + t.to[0], (s * dx + c * dy) * t.s + t.to[1]];
};
const roots = {};
for (const s of ['L', 'R']) {
  roots['ua' + s] = proximalPoint(parts['upperArm' + s].raw, M['shoulder' + s]);
  roots['fa' + s] = proximalPoint(parts['forearm' + s].raw, M['elbow' + s]);
}
const FRAMES = 8;
const frames = [];
for (let f = 0; f < FRAMES; f += 1) {
  const target = targetScaffold(f / FRAMES);
  const tTorso = segmentTransform(M.pelvisHub, M.neckHub, target.nodes.pelvisHub, target.nodes.neckHub);
  const canvas = Buffer.alloc(W * H * 4);
  for (const s of ['L', 'R']) {
    const t = segmentTransform(M['knee' + s], M['ankle' + s], target.nodes['knee' + s], target.nodes['ankle' + s]);
    over(canvas, transformPart(parts['lowerLeg' + s].raw, CANVAS, t), CANVAS);
  }
  over(canvas, transformPart(torso.raw, CANVAS, tTorso), CANVAS);
  for (const s of ['L', 'R']) {
    const segU = segmentTransform(M['shoulder' + s], M['elbow' + s], target.nodes['shoulder' + s], target.nodes['elbow' + s]);
    const tUa = { theta: segU.theta, s: segU.s, from: roots['ua' + s], to: applyT(tTorso, roots['ua' + s]) };
    over(canvas, transformPart(parts['upperArm' + s].raw, CANVAS, tUa), CANVAS);
    const segF = segmentTransform(M['elbow' + s], M['wrist' + s], target.nodes['elbow' + s], target.nodes['wrist' + s]);
    const tFa = { theta: segF.theta, s: segF.s, from: roots['fa' + s], to: applyT(tUa, roots['fa' + s]) };
    over(canvas, transformPart(parts['forearm' + s].raw, CANVAS, tFa), CANVAS);
  }
  const png = await sharp(canvas, { raw: { width: W, height: H, channels: 4 } }).flatten({ background: '#add0eb' }).png().toBuffer();
  if (f === 4) await write('assembly/assembly.png', png);   // the mid-wave still
  frames.push(await sharp(png).resize({ width: 416, height: 608 }).png().toBuffer());
}
const res = await encodeGifBuffers(frames, path.join(DIR, 'composite', 'wave-6fps.gif').replace(/^(.*)$/, (m) => { fs.mkdir(path.dirname(m), { recursive: true }); return m; }), { fps: 6, loop: 0 });
console.log('done:', res.outPath, res.frames, 'frames,', res.bytes, 'bytes');
