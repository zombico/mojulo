/**
 * Local-backend cel renderer (the bicycle's second worker rung,
 * local-render-worker.plan.md shape) — paints keyframe cels via the
 * operator's ComfyUI: img2img over the meru guide (the mannequin under
 * the paint locks scale + pose), per-key OpenPose ControlNet, IP-Adapter
 * identity from the character's accepted render. Driven by
 * `bicycle.mjs render`; usable standalone:
 *
 *   node local-render.mjs <dir> [--only key-3] [--seed 910001]
 *                               [--denoise 0.9] [--cn 0.5] [--ip 0.7]
 *
 * Requires ComfyUI at 127.0.0.1:8188 with the models the install script
 * pins (docs/local-image-worker.md). Renders only cels that are missing
 * or marked "retry" in status.json (all, if no status.json).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COMFY = process.env.COMFY_URL || 'http://127.0.0.1:8188';
const TEMPLATE = path.join(HERE, '..', 'comfyui-workflow-compile.template.json');

const [, , DIR_ARG, ...rest] = process.argv;
const DIR = path.resolve(DIR_ARG || '.');
const flag = (name, dflt) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : dflt;
};
const ONLY = flag('only', null);
const SEED0 = Number(flag('seed', 910001));
const DENOISE = Number(flag('denoise', 0.9));
const TAGS = flag('tags', '');          // extra prompt tokens (e.g. "1boy, male")
const NEG = flag('neg', '');            // extra negatives (e.g. "1girl, long hair")
const CN = Number(flag('cn', 0.5));
const IP = Number(flag('ip', 0.7));
const exists = (p) => fs.access(p).then(() => true, () => false);

const stats = await fetch(`${COMFY}/system_stats`).then((r) => r.json()).catch(() => null);
if (!stats) { console.error(`ComfyUI not reachable at ${COMFY} — start it (docs/local-image-worker.md) or use a natively image-capable worker.`); process.exit(2); }

const status = (await exists(path.join(DIR, 'status.json'))) ? JSON.parse(await fs.readFile(path.join(DIR, 'status.json'), 'utf8')) : null;
const jobMd = (await exists(path.join(DIR, 'JOB.md'))) ? await fs.readFile(path.join(DIR, 'JOB.md'), 'utf8') : '';
// Collapse the extracted paragraph to a single line — a multi-line (hard-wrapped)
// description would otherwise inject raw newlines into the ComfyUI prompt JSON and
// break JSON.parse below (the quote-escape alone doesn't cover control chars).
const description = ((jobMd.match(/## The character\n\n([\s\S]*?)\n\n/) || [])[1] || 'the character in the identity reference').replace(/\s+/g, ' ').trim();
const idRef = status?.identityRef;
if (!idRef || !(await exists(idRef))) { console.error('identity reference missing (status.json.identityRef)'); process.exit(1); }

const prompt = [
  'full body character,', TAGS ? TAGS + ',' : '', description,
  'facing the viewer, front view, face fully visible, neutral expression,',
  'whole figure in frame, flat cel animation style, clean dark outlines, flat colors, soft daylight,',
  'the character alone on a plain uniform pale sky-blue background,',
  'no scenery, no ground, (no shadow:1.4)',
].join(' ');
const negative = (NEG ? NEG + ', ' : '') + 'shadow, ground plane, scenery, gradient background, text, watermark, wireframe, skeleton, stick figure, mannequin, extra limbs, back view, three-quarter view, chibi, cream background';

async function upload(p) {
  const buf = await fs.readFile(p);
  const fd = new FormData();
  const name = `${Date.now()}-${path.basename(path.dirname(p))}-${path.basename(p)}`;
  fd.append('image', new Blob([buf], { type: 'image/png' }), name);
  fd.append('overwrite', 'true');
  const r = await fetch(`${COMFY}/upload/image`, { method: 'POST', body: fd });
  if (!r.ok) throw new Error(`upload ${p}: ${r.status}`);
  return (await r.json()).name;
}

// one white mask + one id upload for the whole run
const white = await sharp({ create: { width: 832, height: 1216, channels: 3, background: '#ffffff' } }).png().toBuffer();
const whitePath = path.join(DIR, '.mask-white.png');
await fs.writeFile(whitePath, white);
const maskName = await upload(whitePath);
const idName = await upload(idRef);
const templateText = await fs.readFile(TEMPLATE, 'utf8');

const keyDirs = (await fs.readdir(path.join(DIR, 'keys'), { withFileTypes: true }))
  .filter((d) => d.isDirectory() && d.name.startsWith('key-')).map((d) => d.name)
  .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));

for (const kd of keyDirs) {
  if (ONLY && kd !== ONLY) continue;
  const state = status?.cels?.[kd];
  if (!ONLY && state === 'pass') { console.log(`${kd}: already passing, skipped`); continue; }
  const base = await upload(path.join(DIR, 'keys', kd, 'guide.png'));
  const pose = await upload(path.join(DIR, 'keys', kd, 'skeleton.png'));
  const seed = SEED0 + Number(kd.slice(4));
  let text = templateText;
  const fill = {
    '{{CHECKPOINT}}': 'animagine-xl-3.1.safetensors',
    '{{CONTROLNET_MODEL}}': 'controlnet-openpose-sdxl.safetensors',
    '{{PROMPT}}': prompt.replace(/"/g, '\\"'),
    '{{NEGATIVE}}': negative.replace(/"/g, '\\"'),
    '{{BASE_IMAGE}}': base,
    '{{POSE_IMAGE}}': pose,
    '{{ID_IMAGE}}': idName,
    '{{MASK_IMAGE}}': maskName,
    '"{{CN_STRENGTH}}"': String(CN),
    '"{{IP_WEIGHT}}"': String(IP),
    '"{{DENOISE}}"': String(DENOISE),
    '"{{SEED}}"': String(seed),
    '{{FILENAME_PREFIX}}': `bike-${path.basename(DIR)}-${kd}`,
  };
  for (const [k, v] of Object.entries(fill)) text = text.split(k).join(v);
  const q = await fetch(`${COMFY}/prompt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: JSON.parse(text).prompt }) });
  const qj = await q.json();
  if (!q.ok || qj.error) throw new Error(`queue ${kd}: ${JSON.stringify(qj).slice(0, 500)}`);
  let images = null;
  for (let i = 0; i < 240 && !images; i += 1) {
    await new Promise((r) => setTimeout(r, 3000));
    const h = await (await fetch(`${COMFY}/history/${qj.prompt_id}`)).json();
    const entry = h[qj.prompt_id];
    if (entry?.status?.status_str === 'error') throw new Error(`${kd}: ${JSON.stringify(entry.status.messages).slice(0, 600)}`);
    const outs = Object.values(entry?.outputs || {}).flatMap((o) => o.images || []);
    if (outs.length) images = outs;
  }
  if (!images) throw new Error(`${kd}: timed out`);
  const img = images[0];
  const url = `${COMFY}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || '')}&type=${img.type}`;
  await fs.writeFile(path.join(DIR, 'keys', kd, 'cel.png'), Buffer.from(await (await fetch(url)).arrayBuffer()));
  console.log(`${kd}: rendered (seed ${seed}, denoise ${DENOISE})`);
}
await fs.unlink(whitePath).catch(() => {});
console.log('local render pass complete — run bicycle.mjs audit next, then LOOK at the cels (register/facing gates are eyes-only)');
