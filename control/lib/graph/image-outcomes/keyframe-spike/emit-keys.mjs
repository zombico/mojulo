/**
 * K1 emitter (animation-cheats.plan.md Addendum 4) — per-key meru guides
 * for a rig motion. Body animation renders every necessary frame WHOLE:
 * the rig emits one posed mannequin guide per key frame, all normalized
 * into the CANONICAL SPINE UNIT (each key's pelvis→neck mapped onto the
 * A-pose spine), so scale and position are constant across the motion by
 * construction — the meru principle applied per cel.
 *
 *   cd control && node lib/graph/image-outcomes/keyframe-spike/emit-keys.mjs <outDir> [motion] [K]
 *
 * Emits: keys/key-<i>/{guide.png, nodes.json}, keys/contact-sheet.png,
 * canonical.json (crown/ground/spine), HANDOFF-K1.md.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import { sampleMotionPose } from '../../polygonizer/figure-render.js';
import { figureOpenPose, buildOpenPoseSvg } from '../openpose.js';
import { transformPart, segmentTransform } from '../parts-bank-spike/assemble.js';
import { APOSE, CANVAS, VIEW } from '../parts-bank-spike/front.js';

const DIR = path.resolve(process.argv[2] || '.');
// The motion arg is a name from the vocabulary ('walk'/'wave'/'stretch'/…) OR a
// path to a `.json` keyframe-motion spec ({ keyframes:[pose,…], loop:true }) —
// the door to motions beyond the named vocabulary (l1-nero-airfist.plan.md seam 1).
const MOTION_ARG = process.argv[3] || 'wave';
const MOTION = MOTION_ARG.endsWith('.json')
  ? JSON.parse(await fs.readFile(path.resolve(MOTION_ARG), 'utf8'))
  : MOTION_ARG;
const MOTION_LABEL = MOTION_ARG.endsWith('.json') ? path.basename(MOTION_ARG, '.json') : MOTION_ARG;
const K = Number(process.argv[4] || 6);
const { width: W, height: H } = CANVAS;

const write = async (rel, data) => {
  const p = path.join(DIR, rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, data);
  return p;
};

// canonical unit: the A-pose spine + its crown/ground lines
const canon = figureOpenPose({ pose: APOSE, view: VIEW, background: false }, CANVAS);
const canonAlpha = await sharp(Buffer.from(canon.figureSvg)).resize({ width: W, height: H, fit: 'fill' }).ensureAlpha().raw().toBuffer();
let crown = H, ground = -1;
for (let i = 0; i < W * H; i += 1) if (canonAlpha[i * 4 + 3] > 28) { const y = (i / W) | 0; if (y < crown) crown = y; if (y > ground) ground = y; }
const canonical = { crown, ground, span: ground - crown, spine: { pelvisHub: canon.nodes.pelvisHub, neckHub: canon.nodes.neckHub } };
await write('canonical.json', JSON.stringify(canonical, null, 2));

const linesSvg = [
  `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'>`,
  `<rect width='${W}' height='${H}' fill='#add0eb'/>`,
  `<line x1='0' y1='${crown}' x2='${W}' y2='${crown}' stroke='#7da8cc' stroke-width='3'/>`,
  `<line x1='0' y1='${ground}' x2='${W}' y2='${ground}' stroke='#7da8cc' stroke-width='3'/>`,
  '</svg>',
].join('');
const linesBase = await sharp(Buffer.from(linesSvg)).png().toBuffer();

const applyT = (t, [x, y]) => {
  const c = Math.cos(t.theta), s = Math.sin(t.theta);
  const dx = x - t.from[0], dy = y - t.from[1];
  return [(c * dx - s * dy) * t.s + t.to[0], (s * dx + c * dy) * t.s + t.to[1]];
};

const guides = [];
for (let k = 0; k < K; k += 1) {
  const pose = sampleMotionPose(MOTION, k / K);
  const key = figureOpenPose({ pose, view: VIEW, background: false }, CANVAS);
  // normalize into the canonical spine unit (each render auto-frames
  // itself — without this every key would carry its own scale)
  const T = segmentTransform(key.nodes.pelvisHub, key.nodes.neckHub, canonical.spine.pelvisHub, canonical.spine.neckHub);
  const raw = await sharp(Buffer.from(key.figureSvg)).resize({ width: W, height: H, fit: 'fill' }).ensureAlpha().raw().toBuffer();
  const normRaw = transformPart(raw, CANVAS, T);
  const fig = await sharp(normRaw, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  const guide = await sharp(linesBase).composite([{ input: fig }]).png().toBuffer();
  await write(`keys/key-${k}/guide.png`, guide);
  const nodes = Object.fromEntries(Object.entries(key.nodes).map(([n, p]) => [n, applyT(T, p).map((v) => Math.round(v * 10) / 10)]));
  await write(`keys/key-${k}/nodes.json`, JSON.stringify({ motion: MOTION_LABEL, phase: k / K, canvas: CANVAS, nodes }, null, 2));
  // per-key OpenPose skeleton (normalized) — the local diffusion worker's
  // pose conditioning (the native worker uses guide.png alone)
  const kps = key.keypoints.map((p) => (p ? applyT(T, p) : null));
  await write(`keys/key-${k}/skeleton.png`, await sharp(Buffer.from(buildOpenPoseSvg(kps, CANVAS))).png().toBuffer());
  guides.push(guide);
  console.log(`key-${k} (${MOTION_LABEL} @ ${(k / K).toFixed(2)}) emitted`);
}

// contact sheet (all keys side by side, quarter scale)
const thumbW = Math.floor(W / 3), thumbH = Math.floor(H / 3);
const thumbs = [];
for (const g of guides) thumbs.push(await sharp(g).resize({ width: thumbW, height: thumbH }).png().toBuffer());
await write('keys/contact-sheet.png', await sharp({ create: { width: thumbW * K, height: thumbH, channels: 3, background: '#add0eb' } })
  .composite(thumbs.map((t, i) => ({ input: t, left: thumbW * i, top: 0 }))).png().toBuffer());
console.log(`emitted ${K} keys for '${MOTION_LABEL}' → ${DIR}`);
