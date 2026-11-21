/**
 * front-plates — the start screen's pictures, baked when a game is exported (game/front-stage.js; the cards in
 * playscape/ui/front-cards/). Each subject is put on its own World page with its studio floor taken away, posed a
 * moment into its first clip (the rig preview plays it), framed by its slot (seen from its view, cropped as it says),
 * and captured twice, over black and over white: the difference cuts it out (front-treatments.js matte), so its edge
 * and its glow come out soft and nothing behind it comes with it. The cut-out is trimmed, drawn in its treatment in the
 * game's colours, and cached on disk by everything that made it.
 *
 * A host with no Chromium bakes none: the stage then draws its name and its ground alone, and the export says why.
 *
 *   PLATE_VERSION
 *   subjectBounds(payload)                       → { min, max } of the subject's own faces (the studio's left out)
 *   subjectShot(bounds, slot, { aspect })        → { pos, target, vfov }: the camera its slot asks (z-up, metres)
 *   plateSize(card, i, { height })               → { width, height }: the capture, at its wide box's shape
 *   plateCacheKey(sketch, card, i, { height })   → the hash a subject's cut-out is kept under
 *   bakePlate(sketch, card, i, { treatment, colours, height }) → Promise<{ png, width, height, frame }>: frame the
 *                                                  capture's camera, its size and the crop's window in it
 *   bakeSubjectGlb(sketch)                       → Promise<{ glb, clip }>: the subject's skinned model, its first clip
 *   LIVE_TREATMENTS · LIVE_GLB_MAX               which pictures a live stage takes over, and how heavy a model may be
 *   bakeFrontStage(stage, { getSketch, colours }) → Promise<{ plates: [{ slot, ref, png, width, height, frame, live? } | null], says }>
 *
 * Pure but for bakePlate's browser and its cache (MOJULO_FRONT_PLATE_DIR, else data/front-plates under the cwd).
 */
import { promises as fs, existsSync } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

import { FRONT_CARDS, SUBJECT_VIEWS } from '../playscape/ui/front-cards/loader.js';
import { matte, trimmed, trimRect, treat } from './front-treatments.js';

// bumped when a plate's making changes (the camera, the pose's moment, the matte): every cached plate is made again
export const PLATE_VERSION = 'p1';
// how much of the subject a crop keeps, from the top of its head down
const CROP_KEEP = Object.freeze({ full: 1, knees: 0.74, waist: 0.56, bust: 0.34 });
const VFOV = 28;          // a long lens: a figure drawn as a poster draws it, little perspective
const MARGIN = 1.08;      // room round the subject, so a clip's reach stays in frame
const POSE_MS = 900;      // the moment into its first clip the subject is caught at

const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

/** The bounds of the subject's own faces: a World page's studio floor (`studio: true`) is not the subject. */
export function subjectBounds(payload) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const f of payload?.faces || []) {
    if (f?.studio) continue;
    for (const c of f?.corners || []) if (isVec(c)) for (let k = 0; k < 3; k++) { if (c[k] < min[k]) min[k] = c[k]; if (c[k] > max[k]) max[k] = c[k]; }
  }
  if (!Number.isFinite(min[0])) return null;
  return { min, max };
}

/**
 * The camera a slot asks: turned off the subject's front (+y on a World page) by its view's yaw, level with the middle
 * of what its crop keeps (a little below: a figure looked up at), far enough on a long lens to hold that much of it.
 */
export function subjectShot(bounds, slot, { aspect = 0.8 } = {}) {
  const { min, max } = bounds, H = max[2] - min[2], keep = CROP_KEEP[slot.crop] ?? 1;
  const seen = H * keep, cz = max[2] - seen / 2, cx = (min[0] + max[0]) / 2, cy = (min[1] + max[1]) / 2;
  const reach = Math.max(max[0] - min[0], max[1] - min[1]) / 2;
  const half = (VFOV / 2) * (Math.PI / 180), hHalf = Math.atan(Math.tan(half) * aspect);
  const dist = Math.max((seen / 2) * MARGIN / Math.tan(half), reach * MARGIN / Math.tan(hHalf)) + reach;
  // (a view's yaw turns the subject's front to the screen's left; turned right, the same view from its other side)
  const yaw = (SUBJECT_VIEWS[slot.view] ?? 0) * (slot.facing === 'right' ? -1 : 1) * (Math.PI / 180);
  return {
    pos: [cx + Math.sin(yaw) * dist, cy + Math.cos(yaw) * dist, cz - seen * 0.06],
    target: [cx, cy, cz],
    vfov: VFOV,
  };
}

/** The capture's size: the shape of the slot's box on a 16:9 screen, at a height. */
export function plateSize(card, i, { height = 1100 } = {}) {
  const [, , w, h] = card.frames.wide.subjects[i];
  const aspect = (w * 16) / (h * 9);
  return { width: Math.max(64, Math.round(height * aspect)), height };
}

// the cut-out is what is kept (the browser's work); its treatment and colours are drawn over it each time, in a moment
export function plateCacheKey(sketch, card, i, { height = 1100 } = {}) {
  const payload = JSON.stringify({ v: PLATE_VERSION, manifest: sketch?.manifest, slot: card.slots[i], box: card.frames.wide.subjects[i], height });
  return crypto.createHash('sha1').update(payload).digest('hex').slice(0, 16);
}

const cacheDir = () => process.env.MOJULO_FRONT_PLATE_DIR || path.join(process.cwd(), 'data', 'front-plates');

async function decode(png) {
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
}
async function encode(img) {
  const sharp = (await import('sharp')).default;
  return sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length), { raw: { width: img.width, height: img.height, channels: 4 } }).png().toBuffer();
}

/**
 * Bake one subject's plate: its cut-out (from the cache, else captured), drawn in its treatment, with the frame it was
 * cut from (the capture's camera, its size and the crop's window in it: the live stage frames the same window).
 */
export async function bakePlate(sketch, card, i, { treatment = 'cutout', colours = {}, height = 1100 } = {}) {
  const { img: cut, frame } = await cutOut(sketch, card, i, { height });
  const img = treat(cut, treatment, colours);
  return { png: await encode(img), width: img.width, height: img.height, frame };
}

// the subject cut out and trimmed, and its frame: read from the cache (the cut-out and a note of its frame beside it),
// else captured over black and white
async function cutOut(sketch, card, i, { height }) {
  const file = path.join(cacheDir(), `${sketch.ref || 'subject'}-${plateCacheKey(sketch, card, i, { height })}.png`), note = file.replace(/\.png$/, '.json');
  if (existsSync(file) && existsSync(note)) return { img: await decode(await fs.readFile(file)), frame: JSON.parse(await fs.readFile(note, 'utf8')) };
  // loaded here, not at import: the World assemblers and the browser stay off the graph of anything that only reads
  const { resolveWorldScene } = await import('../worlds/world-scene.js');
  const { emitThreeWorld } = await import('../scene/scene-three.js');
  const { renderWorldFrames } = await import('../../motion/world-frames.js');
  const resolved = await resolveWorldScene(sketch, {});
  const payload = resolved?.payload;
  if (!payload) throw new Error(`'${sketch.ref}' (kind '${sketch.manifest?.kind}') has no World to stand on a start screen`);
  const bounds = subjectBounds(payload);
  if (!bounds) throw new Error(`'${sketch.ref}' has nothing but its studio to show`);
  const size = plateSize(card, i, { height });
  const shot = subjectShot(bounds, card.slots[i], { aspect: size.width / size.height });
  const faces = payload.faces.filter((f) => !f.studio);
  const spec = { ...shot, t: POSE_MS };
  const page = (bg) => emitThreeWorld({ ...payload, faces, bg, sky: null, haze: null, inline: true, capture: true, walk: false, decollide: payload.decollide !== false });
  const [onBlack] = (await renderWorldFrames(page('#000000'), [spec], size)).pngs;
  const [onWhite] = (await renderWorldFrames(page('#ffffff'), [spec], size)).pngs;
  const whole = matte(await decode(onBlack), await decode(onWhite)), pad = Math.max(4, Math.round(height * 0.012));
  const img = trimmed(whole, { pad }), crop = trimRect(whole, { pad }) ?? { x: 0, y: 0, w: 1, h: 1 };
  const frame = { shot, capture: size, crop, poseMs: POSE_MS };
  try {
    await fs.mkdir(cacheDir(), { recursive: true });
    await fs.writeFile(file, await encode(img));
    await fs.writeFile(note, JSON.stringify(frame));
  } catch { /* the next export captures it again */ }
  return { img, frame };
}

// the live stage draws a subject as it is, a rim round it for a cut-out; a picture remade in other colours stays a picture
export const LIVE_TREATMENTS = Object.freeze(['cutout', 'silhouette']);
// past this a subject's model is too heavy for a start screen that opens at once: its picture stays
export const LIVE_GLB_MAX = 12 * 1024 * 1024;

/**
 * A subject's model for the live stage: its own faces (the studio left out) as a skinned .glb playing its first clip
 * (with its face's blink, when it has one), or a still mesh when it has no rig. Cached by its recipe. → { glb, clip }
 */
export async function bakeSubjectGlb(sketch) {
  const key = crypto.createHash('sha1').update(JSON.stringify({ v: PLATE_VERSION, glb: 1, manifest: sketch?.manifest })).digest('hex').slice(0, 16);
  const file = path.join(cacheDir(), `${sketch.ref || 'subject'}-${key}.glb`), note = file.replace(/\.glb$/, '.glb.json');
  if (existsSync(file) && existsSync(note)) return { glb: await fs.readFile(file), ...JSON.parse(await fs.readFile(note, 'utf8')) };
  const { resolveWorldScene } = await import('../worlds/world-scene.js');
  const { facesToGlb } = await import('../scene/scene-gltf.js');
  const { payload } = (await resolveWorldScene(sketch, { face: true })) || {};
  if (!payload) throw new Error(`'${sketch.ref}' has no World to take a model from`);
  const rig = Object.values(payload.figures || {}).find((f) => f && f.rig === true && f.clips && Object.keys(f.clips).length);
  const clip = rig ? (rig.preview?.clips?.[0] ?? Object.keys(rig.clips)[0]) : null;
  const faces = payload.faces.filter((f) => !f.studio);
  const out = facesToGlb({ ...payload, faces }, { generator: `mojulo start screen ${sketch.ref}`, ...(clip ? { clips: [clip], skinned: true } : {}) });
  const glb = Buffer.from(out.bytes);
  try { await fs.mkdir(cacheDir(), { recursive: true }); await fs.writeFile(file, glb); await fs.writeFile(note, JSON.stringify({ clip })); } catch { /* baked again next time */ }
  return { glb, clip };
}

/**
 * A stage's plates: each slot's subject (a sketch ref, resolved by the runner from the game's roles) baked in the
 * stage's treatment. A slot whose subject cannot be found or baked is null, and `says` tells why. A stage in 3d also
 * gives each plate its model (`live`: { glb, clip }) where its treatment draws live and the model is light enough.
 */
export async function bakeFrontStage(stage, { getSketch, colours = {}, height = 1100 } = {}) {
  const card = FRONT_CARDS[stage?.composition], says = [];
  if (!card) return { plates: [], says: [`front.stage: no front card '${stage?.composition}'`] };
  const subjects = Array.isArray(stage.subjects) ? stage.subjects : [];
  const treatment = stage.treatment || 'cutout', plates = [], live = stage.mode === '3d';
  if (live && !LIVE_TREATMENTS.includes(treatment)) says.push(`front.stage: mode '3d' draws a subject as it is (a cut-out or a silhouette); the ${treatment} pictures stay still`);
  for (let i = 0; i < card.slots.length; i++) {
    const ref = subjects[i];
    if (!ref) { plates.push(null); says.push(`front.stage: ${card.id}'s slot ${i + 1} has no subject (the game made none of its roles: ${card.slots[i].roles.join(', ')})`); continue; }
    const sketch = getSketch(ref);
    if (!sketch?.manifest) { plates.push(null); says.push(`front.stage: no sketch '${ref}' for slot ${i + 1}`); continue; }
    let p;
    try {
      // eslint-disable-next-line no-await-in-loop -- one browser at a time
      p = { slot: i, ref, ...(await bakePlate(sketch, card, i, { treatment, colours, height })) };
    } catch (e) {
      plates.push(null);
      says.push(`front.stage: slot ${i + 1} ('${ref}') was not pictured: ${String(e?.message || e).split('\n')[0]}`);
      continue;
    }
    if (live && LIVE_TREATMENTS.includes(treatment)) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const m = await bakeSubjectGlb(sketch);
        if (m.glb.length > LIVE_GLB_MAX) says.push(`front.stage: slot ${i + 1}'s model is ${(m.glb.length / 1048576).toFixed(1)} MB, past the ${LIVE_GLB_MAX / 1048576} MB a start screen loads: its picture stays still`);
        else p.live = m;
      } catch (e) {
        says.push(`front.stage: slot ${i + 1} ('${ref}') has no live model: ${String(e?.message || e).split('\n')[0]}`);
      }
    }
    plates.push(p);
  }
  return { plates, says };
}
