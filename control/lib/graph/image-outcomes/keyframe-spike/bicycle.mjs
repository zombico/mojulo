/**
 * The keyframe BICYCLE (animation-cheats.plan.md Addendum 4) — the whole
 * keyframe-animation loop as one drivable tool, so an image-capable worker
 * agent (Codex) can run it end-to-end with no human relay:
 *
 *   node bicycle.mjs init <dir> --character <charDir> [--motion wave] [--k 6]
 *       emits guides + JOB.md (auto-generated handoff) + status.json
 *   node bicycle.mjs audit <dir>
 *       audits painted cels, writes per-cel RETRY.md on violations,
 *       composites passing sets on twos, updates status.json
 *   node bicycle.mjs face <dir> [--blink-seed N] [--speech "0.5-1.5,..."]
 *       emits JOB-FACE.md (the expression-cel handoff), meru-audits each
 *       full expression cel the worker rendered (same gate as the body cels),
 *       composites motion-face.gif by selecting a whole cel per frame on a
 *       seeded schedule, and records a `face` status section. Face states are
 *       FULL meru-locked renders — not decals (face-subcels.plan.md, revised).
 *   node bicycle.mjs status <dir>
 *       prints machine-readable state + the next action
 *
 * The loop the worker drives: init → paint keys/key-<i>/cel.png → audit →
 * fix retries → audit → … until status.json.done. Geometric gates are
 * deterministic (this tool); register/facing gates are the worker's own
 * eyes against JOB.md's checklist — the two-gate doctrine.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { CANVAS } from '../parts-bank-spike/front.js';
import { floodKey } from '../parts-bank-spike/key.js';
import { buildFaceManifest, requiredVariants } from './face-composite.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [, , CMD, DIR_ARG, ...rest] = process.argv;
const DIR = DIR_ARG ? path.resolve(DIR_ARG) : null;
const flag = (name, dflt) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : dflt;
};
const exists = (p) => fs.access(p).then(() => true, () => false);
const die = (msg) => { console.error(msg); process.exit(1); };

const run = (script, args) => {
  const r = spawnSync(process.execPath, [path.join(HERE, script), ...args], { stdio: 'inherit' });
  if (r.status !== 0) die(`${script} failed`);
};

async function writeStatus(dir, patch) {
  const p = path.join(dir, 'status.json');
  const cur = (await exists(p)) ? JSON.parse(await fs.readFile(p, 'utf8')) : {};
  const next = { ...cur, ...patch, updated: 'run `node bicycle.mjs status` for a fresh view' };
  await fs.writeFile(p, JSON.stringify(next, null, 2));
  return next;
}

const STATE_DESC = {
  'blink-closed.png': 'EYES FULLY CLOSED (relaxed lids, soft lashes — a calm blink); everything else the same pose',
  'blink-half.png': 'EYES HALF-CLOSED (lids lowered mid-blink); everything else the same pose',
  'mouth-mid.png': 'MOUTH SLIGHTLY OPEN (mid-syllable); eyes and everything else the same pose',
  'mouth-open.png': 'MOUTH OPEN WIDE (a vowel shape); eyes and everything else the same pose',
};

// The native-rung handoff. Face states are WHOLE meru-locked cel renders — the
// SAME primitive that locked the character in the first place (guide declares
// scale + pose + placement; the identity reference locks the character). NOT
// decals. Bicycle discipline: the doc carries the loop + the two gates so a
// fresh worker drives it cold.
function buildFaceJob({ keys, variants, blinkSeed, speech, cycles, identityRef }) {
  return `# JOB-FACE — expression cels (full meru-locked renders)

You are the image worker. The body animation is DONE (the ${keys.length} wave
cels). This job adds EXPRESSION cels: full renders of the character with a
different face (eyes closed, etc.), which mojulo selects on a seeded
blink/speech schedule — so re-blinking / re-timing later costs ZERO new
generations.

## The primitive (why this holds — same as the body cels)

Do NOT decal or paint a patch onto a finished cel. RENDER THE WHOLE CEL
again, locked exactly like the wave cels were:
- **Meru scale + pose** come from that key's \`keys/<key>/guide.png\` — the rig
  mannequin between the crown/ground register lines. Paint OVER it, covering
  it, same height and pose. This is what stops the face from drifting.
- **Identity** comes from the character reference \`${identityRef || '../<character>/renders/front-full.png'}\` —
  the same lock that made the character consistent across the six cels.

## What to render

For EACH key below, render a FULL 832×1216 cel of that exact pose, identical
to \`keys/<key>/cel.png\` in every way EXCEPT the face state named. Save each at:

    keys/<key>/face/<variant>.png

Variants needed (per key):
${variants.map((f) => `- \`${f}\` — ${STATE_DESC[f] || f}`).join('\n')}

Keys: ${keys.join(', ')}
Full set: ${keys.length}×${variants.length} = ${keys.length * variants.length} expression cels.

Keep the base expression (eyes open, relaxed mouth) as \`cel.png\` itself — it
is the default; do not re-render it here.

## The two gates

1. MERU (machine — mojulo checks): each expression cel keeps the unit — crown
   at/below the register line, soles ON the ground line, same height as the
   base cel. A violation → \`status.json\` marks it \`meru:<ratio>\` with a
   RETRY note; re-render over the guide.
2. EYES (your check before submitting): the new face READS at animation scale
   (a closed eye looks closed), it is unmistakably the SAME character in the
   SAME pose and outfit, and ONLY the face differs from \`cel.png\`.

## The loop you drive

1. Render the ${keys.length * variants.length} expression cels into \`keys/<key>/face/\`.
2. Run:  \`node bicycle.mjs face <dir>\`
   — mojulo meru-audits each and composites \`composite/motion-face.gif\`
   (blink seed ${blinkSeed}${speech ? `, speech ${speech}` : ''}, ${cycles} cycles).
3. Read \`status.json\` → \`face.states\`: any \`missing\`/\`meru:*\` entry names
   the key/variant to (re)render. \`face.done: true\` when all pass.
4. LOOK at \`composite/motion-face.gif\`: the character waves and blinks${speech ? ' and talks' : ''},
   scale rock-steady, only the face changing.

Re-timing later (new blink seed / new speech spans) is
\`node composite-face.mjs <dir> --blink-seed N --speech "..."\` — zero new
generations.
`;
}

if (CMD === 'init') {
  if (!DIR) die('usage: bicycle.mjs init <dir> --character <charDir> [--motion wave] [--k 6]');
  const motion = flag('motion', 'wave');
  // `motion` is a named vocab motion OR a path to a `.json` keyframe spec
  // (l1-nero-airfist.plan.md seam 1). The spec is copied into the job dir as
  // motion.json for provenance; JOB.md/status.json carry the clean label.
  const motionIsSpec = motion.endsWith('.json');
  const motionLabel = motionIsSpec ? path.basename(motion, '.json') : motion;
  const k = Number(flag('k', 6));
  const charDir = flag('character', null);
  if (!charDir) die('--character <dir with renders/front-full.png + renders/DELIVERED.md> is required');
  const charAbs = path.resolve(charDir);
  const idRef = path.join(charAbs, 'renders', 'front-full.png');
  if (!(await exists(idRef))) die(`identity reference not found: ${idRef}`);
  let description = '(no DELIVERED.md found — describe the character from the identity reference)';
  const dm = path.join(charAbs, 'renders', 'DELIVERED.md');
  if (await exists(dm)) {
    const md = await fs.readFile(dm, 'utf8');
    const m = md.match(/## Character Description\s+([\s\S]*?)(\n## |$)/);
    if (m) description = m[1].trim();
  }
  run('emit-keys.mjs', [DIR, motion, String(k)]);
  if (motionIsSpec) await fs.copyFile(path.resolve(motion), path.join(DIR, 'motion.json'));
  const canonical = JSON.parse(await fs.readFile(path.join(DIR, 'canonical.json'), 'utf8'));
  const relId = path.relative(DIR, idRef);
  await fs.writeFile(path.join(DIR, 'JOB.md'), `# JOB — ${k} keyframe cels, motion '${motionLabel}'${motionIsSpec ? ` (spec: motion.json)` : ''}

You are the image render worker. Paint one full-character cel per key:
\`keys/key-<i>/cel.png\` (832×1216), an EDIT of that key's \`guide.png\`.

## The character

${description}

Identity reference (match it exactly, every cel): \`${relId}\`

## Rules per cel

1. Paint the character OVER the mannequin, covering it completely —
   same pose, every mannequin limb inside the painted limb. Remove both
   register lines (plain background there).
2. SCALE (machine-audited): crown of head at/just below y=${canonical.crown},
   soles exactly ON y=${canonical.ground}, never below. Identical height in
   every cel.
3. REGISTER (self-audit with your eyes before submitting): painted anime
   cel in the identity reference's studio style — real face, drawn hair,
   fabric, cel shading, clean dark outlines. INVOKE YOUR IMAGE-GENERATION
   CAPABILITY; a vector tracing of the mannequin will be rejected.
4. FACING (self-audit): the guides are FRONT views — the character faces
   the viewer, face fully visible, same neutral expression in every cel.
5. Background: plain uniform pale sky-blue (~#ADD0EB); no ground, no
   shadow, no scenery, no text.
6. Consistency: identical character, style, and line weight across all
   ${k} cels — only the pose changes.

## How to paint (capability ladder — resolve it yourself)

1. **Native image generation** (Codex / image-capable ChatGPT): edit each
   guide.png directly per the rules above. Preferred when available.
2. **Local diffusion backend** (a driving agent without native image
   generation, e.g. Claude + ComfyUI at 127.0.0.1:8188): run
   \`node ${path.join(HERE, 'bicycle.mjs')} render ${DIR}\`
   — it paints missing/retry cels (img2img over each guide + per-key
   OpenPose conditioning + IP-Adapter identity from the reference).
   Then LOOK at every cel with your own eyes before auditing: gates 3–4
   are not machine-checked. Nudge with --denoise/--cn/--ip/--seed and
   re-render individual cels with --only key-N.
3. Neither available: stop and tell the operator.

## The loop you drive

1. Paint all cels → run:
   \`node ${path.join(HERE, 'bicycle.mjs')} audit ${DIR}\`
2. Read \`status.json\`. Any cel marked "retry" has a
   \`keys/key-<i>/RETRY.md\` with exact pixel targets — redo just that
   cel and audit again.
3. Before every audit, self-check gates 3–4 against the identity
   reference; the machine only measures gate 2.
4. Done when \`status.json\` says \`"done": true\` — the animation is at
   \`composite/motion.gif\`. Write \`keys/DELIVERED.md\` (prompts used per
   cel, verbatim, plus retries).
`);
  await writeStatus(DIR, {
    motion: motionLabel, motionSpec: motionIsSpec ? 'motion.json' : null, k, character: charAbs, identityRef: idRef,
    canonical, phase: 'awaiting-cels',
    cels: Object.fromEntries(Array.from({ length: k }, (_, i) => [`key-${i}`, 'missing'])),
    done: false,
  });
  console.log(`\nbicycle ready: ${DIR}\n1. worker reads JOB.md\n2. paints keys/key-<i>/cel.png\n3. runs: node bicycle.mjs audit ${DIR}`);
} else if (CMD === 'audit') {
  if (!DIR) die('usage: bicycle.mjs audit <dir>');
  run('composite-keys.mjs', [DIR]);
  const audit = JSON.parse(await fs.readFile(path.join(DIR, 'audit.json'), 'utf8'));
  const status = JSON.parse(await fs.readFile(path.join(DIR, 'status.json'), 'utf8'));
  const cels = {};
  let pass = 0, retry = 0, missing = 0;
  for (const key of Object.keys(status.cels)) {
    if (audit.cels[key]) {
      cels[key] = audit.cels[key].compliant ? 'pass' : 'retry';
      if (cels[key] === 'pass') pass += 1; else retry += 1;
    } else { cels[key] = 'missing'; missing += 1; }
  }
  const done = pass === Object.keys(cels).length;
  const next = await writeStatus(DIR, {
    cels, done,
    phase: done ? 'complete' : retry ? 'retries-pending' : 'awaiting-cels',
    gif: (await exists(path.join(DIR, 'composite', 'motion.gif'))) ? 'composite/motion.gif' : null,
  });
  console.log(`\nstatus: ${pass} pass, ${retry} retry, ${missing} missing — ${next.phase}`);
  if (retry) console.log('retries: read keys/key-<i>/RETRY.md for each cel marked "retry"');
  if (done) console.log('DONE — composite/motion.gif is the animation; write keys/DELIVERED.md');
} else if (CMD === 'render') {
  // the LOCAL-BACKEND worker rung: paint missing/retry cels via ComfyUI
  // (img2img over the guide + per-key OpenPose CN + IP-Adapter identity).
  // The driving agent must still LOOK at the results — register/facing
  // gates are eyes-only — then run audit.
  if (!DIR) die('usage: bicycle.mjs render <dir> [--only key-N] [--seed N] [--denoise 0.9] [--cn 0.5] [--ip 0.7]');
  run('local-render.mjs', [DIR, ...rest]);
} else if (CMD === 'face') {
  // The EXPRESSION layer (face-subcels.plan.md, revised) — face states are
  // WHOLE meru-locked cel renders selected on a seeded schedule, NOT decals.
  // Emits JOB-FACE.md, meru-audits each expression cel (same gate as the body
  // cels), and composites motion-face.gif by frame selection.
  if (!DIR) die('usage: bicycle.mjs face <dir> [--blink-seed N] [--speech "0.5-1.5,..."] [--cycles N]');
  const blinkSeed = Number(flag('blink-seed', 7));
  const speechArg = flag('speech', '');
  const cycles = Number(flag('cycles', 3));
  const fps = Number(flag('fps', 12));
  const spans = speechArg ? speechArg.split(',').map((s) => { const [from, to] = s.split('-').map(Number); return { from, to }; }) : [];

  const keys = (await fs.readdir(path.join(DIR, 'keys'), { withFileTypes: true }))
    .filter((d) => d.isDirectory() && d.name.startsWith('key-')).map((d) => d.name)
    .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));
  const canonical = JSON.parse(await fs.readFile(path.join(DIR, 'canonical.json'), 'utf8'));
  const status0 = (await exists(path.join(DIR, 'status.json'))) ? JSON.parse(await fs.readFile(path.join(DIR, 'status.json'), 'utf8')) : {};

  // Identity lock: --character <dir> (its renders/front-full.png), else the
  // init-recorded identityRef. Shown in the handoff relative to the job dir.
  const charDir = flag('character', null);
  const idAbs = charDir ? path.join(path.resolve(charDir), 'renders', 'front-full.png') : (status0.identityRef || null);
  const identityRef = idAbs ? path.relative(DIR, idAbs) : null;

  const manifest = buildFaceManifest({ keys, fps, onTwos: 2, cycles, blink: { seed: blinkSeed, meanGapSec: 2.2 }, speech: spans.length ? { spans } : null });
  const variants = requiredVariants(manifest);

  await fs.writeFile(path.join(DIR, 'JOB-FACE.md'), buildFaceJob({ keys, variants, blinkSeed, speech: speechArg, cycles, identityRef }));

  // Meru-audit each present expression cel — the SAME gate as the body cels:
  // keyed-alpha bbox must keep the canonical unit (height + ground). No decals.
  const { width: W, height: H } = CANVAS;
  const measure = (buf) => {
    let top = H, bottom = -1;
    for (let i = 0; i < W * H; i += 1) if (buf[i * 4 + 3] > 28) { const y = (i / W) | 0; if (y < top) top = y; if (y > bottom) bottom = y; }
    return { top, bottom };
  };
  const states = {};
  for (const k of keys) {
    await fs.mkdir(path.join(DIR, 'keys', k, 'face'), { recursive: true });
    for (const file of variants) {
      const celPath = path.join(DIR, 'keys', k, 'face', file);
      if (!(await exists(celPath))) { states[`${k}/${file}`] = 'missing'; continue; }
      const rgba = await sharp(celPath).resize({ width: W, height: H, fit: 'fill' }).ensureAlpha().raw().toBuffer();
      floodKey(rgba, CANVAS);
      const { top, bottom } = measure(rgba);
      const heightRatio = Math.round(((bottom - top) / canonical.span) * 1000) / 1000;
      const groundDelta = bottom - canonical.ground;
      const compliant = Math.abs(heightRatio - 1) < 0.06 && groundDelta < canonical.span * 0.02;
      states[`${k}/${file}`] = compliant ? 'pass' : `meru:${heightRatio}`;
      if (!compliant) {
        await fs.writeFile(path.join(DIR, 'keys', k, 'face', `${file}.RETRY.md`),
          `# ${k}/${file} meru retry — height ${heightRatio}× the unit (must be within 6%), lowest pixel y=${bottom} vs ground y=${canonical.ground}. Re-render this expression cel over keys/${k}/guide.png: crown at/below y=${canonical.crown}, soles ON y=${canonical.ground}, same height as cel.png.`);
      }
    }
  }

  const compArgs = [DIR, '--blink-seed', String(blinkSeed), '--cycles', String(cycles), '--fps', String(fps)];
  if (speechArg) compArgs.push('--speech', speechArg);
  run('composite-face.mjs', compArgs);

  const total = Object.keys(states).length;
  const passed = Object.values(states).filter((v) => v === 'pass').length;
  const missing = Object.values(states).filter((v) => v === 'missing').length;
  const meru = Object.entries(states).filter(([, v]) => v.startsWith('meru'));
  await writeStatus(DIR, {
    face: {
      blinkSeed, speech: speechArg || null, cycles, variants, states,
      tracksApplied: manifest.subCels.map((s) => s.id),
      gif: (await exists(path.join(DIR, 'composite', 'motion-face.gif'))) ? 'composite/motion-face.gif' : null,
      done: total > 0 && missing === 0 && meru.length === 0,
    },
  });
  console.log(`\nface: ${passed}/${total} expression cels pass, ${missing} missing, ${meru.length} meru-violations`);
  if (meru.length) console.log(`re-render (off the unit): ${meru.slice(0, 6).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(missing
    ? `JOB-FACE.md written — the worker RENDERS full expression cels into keys/<k>/face/<variant>.png (over each pose's guide + identity ref), then re-run \`bicycle.mjs face ${DIR}\`.`
    : 'all expression cels present — composite/motion-face.gif is the wave + face animation.');
} else if (CMD === 'status') {
  if (!DIR) die('usage: bicycle.mjs status <dir>');
  console.log(await fs.readFile(path.join(DIR, 'status.json'), 'utf8'));
} else {
  die('usage: bicycle.mjs init|render|audit|face|status <dir> [flags]');
}
