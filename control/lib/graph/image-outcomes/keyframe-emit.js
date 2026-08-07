/**
 * Keyframe meru-guide emitter — the per-key posed-mannequin guides for a rig
 * motion, extracted pure from keyframe-spike/emit-keys.mjs so the MCP render
 * packet (getImageRenderPacketHandler) can serve a key's guide PNG as its
 * scaffold conditioning image, deterministically, from the manifest.
 *
 * Body animation renders every necessary frame WHOLE: the rig emits one posed
 * mannequin guide per key, all normalized into the CANONICAL SPINE UNIT (each
 * key's pelvis→neck mapped onto the A-pose spine), so scale and position are
 * constant across the motion by construction — the meru principle per cel. The
 * worker paints Nera OVER the mannequin; scale is inherited, not measured.
 *
 * Returns Buffers, never touches the filesystem — the caller (an API route)
 * owns delivery. Deterministic: no Date, no Math.random. `motion` is a name
 * from the vocabulary ('walk'/'wave'/'stretch'/…) OR an already-parsed keyframe
 * spec object ({ keyframes:[pose,…], loop:true }).
 */

import sharp from 'sharp';

import { sampleMotionPose } from '../polygonizer/figure-render.js';
import { figureOpenPose, buildOpenPoseSvg } from './openpose.js';
import { transformPart, segmentTransform } from './parts-bank-spike/assemble.js';
import { APOSE, CANVAS, VIEW } from './parts-bank-spike/front.js';

const REGISTER_LINE = '#7da8cc';
const SKY = '#add0eb';

const applyT = (t, [x, y]) => {
  const c = Math.cos(t.theta);
  const s = Math.sin(t.theta);
  const dx = x - t.from[0];
  const dy = y - t.from[1];
  return [(c * dx - s * dy) * t.s + t.to[0], (s * dx + c * dy) * t.s + t.to[1]];
};

/**
 * Compute the canonical unit: the A-pose spine + its crown/ground register
 * lines, all in canvas coordinates. Pure of any specific motion — every key of
 * every motion for this figure normalizes onto this unit.
 */
export async function computeCanonical({ canvas = CANVAS, view = VIEW, aPose = APOSE } = {}) {
  const { width: w, height: h } = canvas;
  const canon = figureOpenPose({ pose: aPose, view, background: false }, canvas);
  const alpha = await sharp(Buffer.from(canon.figureSvg))
    .resize({ width: w, height: h, fit: 'fill' }).ensureAlpha().raw().toBuffer();
  let crown = h, ground = -1;
  for (let i = 0; i < w * h; i += 1) {
    if (alpha[i * 4 + 3] > 28) {
      const y = (i / w) | 0;
      if (y < crown) crown = y;
      if (y > ground) ground = y;
    }
  }
  return {
    crown, ground, span: ground - crown,
    spine: { pelvisHub: canon.nodes.pelvisHub, neckHub: canon.nodes.neckHub },
  };
}

/** The register-line base plate a guide is painted over (sky + crown/ground lines). */
async function registerPlate(canvas, canonical) {
  const { width: w, height: h } = canvas;
  const svg = [
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>`,
    `<rect width='${w}' height='${h}' fill='${SKY}'/>`,
    `<line x1='0' y1='${canonical.crown}' x2='${w}' y2='${canonical.crown}' stroke='${REGISTER_LINE}' stroke-width='3'/>`,
    `<line x1='0' y1='${canonical.ground}' x2='${w}' y2='${canonical.ground}' stroke='${REGISTER_LINE}' stroke-width='3'/>`,
    '</svg>',
  ].join('');
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Emit one key's guide + skeleton + normalized nodes, given the shared plate. */
async function emitOneKey({ motion, keys, index, canvas, view, canon, plate }) {
  const { width: w, height: h } = canvas;
  const phase = index / keys;
  const pose = sampleMotionPose(motion, phase);
  // Defense in depth: an unresolvable motion yields a null pose and would crash
  // downstream on a null deref. Fail loudly with context. (The manifest validator
  // already rejects unknown motion names — this guards any other null path.)
  if (!pose) throw new Error(`keyframe guide: motion ${JSON.stringify(motion)} produced no pose at key ${index} (unknown motion name or empty keyframe spec)`);
  const key = figureOpenPose({ pose, view, background: false }, canvas);
  // Normalize into the canonical spine unit — without this every key would
  // carry its own auto-frame scale.
  const T = segmentTransform(key.nodes.pelvisHub, key.nodes.neckHub, canon.spine.pelvisHub, canon.spine.neckHub);
  const raw = await sharp(Buffer.from(key.figureSvg))
    .resize({ width: w, height: h, fit: 'fill' }).ensureAlpha().raw().toBuffer();
  const normRaw = transformPart(raw, canvas, T);
  const fig = await sharp(normRaw, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  const guide = await sharp(plate).composite([{ input: fig }]).png().toBuffer();
  const nodes = Object.fromEntries(
    Object.entries(key.nodes).map(([n, p]) => [n, applyT(T, p).map((v) => Math.round(v * 10) / 10)]),
  );
  // Per-key OpenPose skeleton (normalized) — the local diffusion worker's pose
  // conditioning; the native worker paints over guide.png alone.
  const kps = key.keypoints.map((p) => (p ? applyT(T, p) : null));
  const skeleton = await sharp(Buffer.from(buildOpenPoseSvg(kps, canvas))).png().toBuffer();
  return { index, phase, guide, skeleton, nodes };
}

/**
 * Emit all per-key meru guides for a motion.
 *
 * @param {{ motion:(string|object), keys?:number, canvas?:object, view?:(string|number), aPose?:object, canonical?:object }} opts
 * @returns {Promise<{
 *   canonical: object,
 *   keys: Array<{ index:number, phase:number, guide:Buffer, skeleton:Buffer, nodes:object }>,
 *   contactSheet: Buffer,
 * }>}
 */
export async function emitKeys({ motion, keys = 6, canvas = CANVAS, view = VIEW, aPose = APOSE, canonical } = {}) {
  if (motion == null) throw new Error('emitKeys requires a motion (name or keyframe spec)');
  const K = Number(keys);
  if (!Number.isInteger(K) || K < 1) throw new Error('emitKeys requires an integer keys >= 1');
  const { width: w, height: h } = canvas;
  const canon = canonical || (await computeCanonical({ canvas, view, aPose }));
  const plate = await registerPlate(canvas, canon);

  const out = [];
  const guides = [];
  for (let k = 0; k < K; k += 1) {
    const emitted = await emitOneKey({ motion, keys: K, index: k, canvas, view, canon, plate });
    out.push(emitted);
    guides.push(emitted.guide);
  }

  const thumbW = Math.floor(w / 3), thumbH = Math.floor(h / 3);
  const thumbs = await Promise.all(guides.map((g) => sharp(g).resize({ width: thumbW, height: thumbH }).png().toBuffer()));
  const contactSheet = await sharp({ create: { width: thumbW * K, height: thumbH, channels: 3, background: SKY } })
    .composite(thumbs.map((t, i) => ({ input: t, left: thumbW * i, top: 0 }))).png().toBuffer();

  return { canonical: canon, keys: out, contactSheet };
}

/** Emit just one key's guide (the render packet's per-target need — no whole set). */
export async function emitKeyGuide({ motion, keys = 6, index, canvas = CANVAS, view = VIEW, aPose = APOSE, canonical } = {}) {
  if (motion == null) throw new Error('emitKeyGuide requires a motion (name or keyframe spec)');
  const K = Number(keys);
  const k = Number(index);
  if (!Number.isInteger(k) || k < 0 || k >= K) {
    throw new Error(`emitKeyGuide index ${index} out of range for ${K} keys`);
  }
  const canon = canonical || (await computeCanonical({ canvas, view, aPose }));
  const plate = await registerPlate(canvas, canon);
  const emitted = await emitOneKey({ motion, keys: K, index: k, canvas, view, canon, plate });
  return { canonical: canon, ...emitted };
}
