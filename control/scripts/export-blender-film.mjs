#!/usr/bin/env node
/**
 * export-blender-film.mjs — world camera shots → one Blender film (lib/motion/blender-film.js).
 *
 * For each motion ref (all over ONE world): the per-frame cameras from its recipe
 * (worldMotionCameras — the same path forge_motion rendered), the world's Blender pack + the film
 * scripts in the first motion's outcome folder, then Blender headless, serially:
 *   import_mojulo.py run   → film.blend (only when absent — your lights and art survive a re-run)
 *   film_shots.py          → the shots as keyed cameras, cut in the order given; --verify → film-gate.json
 *   film_light.py          → the starter rig, only when the scene has no light yet
 *   film_render.py         → (--render draft|final) PNG frames → film-<preset>.mp4
 *
 * The film workspace (film.blend, check stills, frames, mp4) lives OUTSIDE the repo:
 * $MOJULO_HOME/films/<first motion ref>/ by default, and an --out inside a git working tree is
 * refused — renders never land in a checkout. Optional worker: without Blender the pack is emitted
 * and the commands are printed.
 *
 * Usage (from control/; repo-dev sets MOJULO_DATA_DIR/MOJULO_OUTCOMES_DIR):
 *   node scripts/export-blender-film.mjs --motion mo_a [--motion mo_b …]
 *        [--render draft|final] [--check 1,18,36] [--out <dir>] [--base lit|unlit|shaded] [--blender <bin>]
 * Env: MOJULO_BLENDER, MOJULO_BLENDER_TIMEOUT_MS (setup steps, default 10 min),
 *      MOJULO_BLENDER_RENDER_TIMEOUT_MS (the render, default 12 h).
 */
import { parseArgs } from 'node:util';
import { promises as fs, existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

const { values: args } = parseArgs({ options: {
  motion: { type: 'string', multiple: true },
  out: { type: 'string' },
  render: { type: 'string' },
  check: { type: 'string' },
  base: { type: 'string', default: 'lit' },
  blender: { type: 'string' },
} });

function fail(msg) { process.stdout.write(`${JSON.stringify({ ok: false, error: msg })}\n`); process.exit(1); }
const log = (msg) => process.stderr.write(`[export-blender-film] ${msg}\n`);
const motions = args.motion || [];
if (!motions.length) fail('need --motion <mo_…> (repeat for several shots of one world)');
if (args.render && !['draft', 'final'].includes(args.render)) fail('--render must be draft or final');

const which = (name) => { const r = spawnSync('which', [name], { encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; };
const blenderBin = args.blender || process.env.MOJULO_BLENDER
  || (existsSync('/Applications/Blender.app/Contents/MacOS/Blender') ? '/Applications/Blender.app/Contents/MacOS/Blender' : which('blender'));

/** The git working tree that contains `dir`, or null. */
function workTreeOf(dir) {
  let d = path.resolve(dir);
  while (!existsSync(d)) d = path.dirname(d);
  const r = spawnSync('git', ['-C', d, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
resolveMojuloPaths();
const { SketchRepository } = await import('@/lib/db/repositories/sketches');
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { worldMotionCameras, WORLD_MOTION_NAMES } = await import('@/lib/motion/world-motion.js');
const { filmShot, writeBlenderFilm } = await import('@/lib/motion/blender-film.js');

const outcomes = process.env.MOJULO_OUTCOMES_DIR || path.join(process.env.MOJULO_DATA_DIR, 'outcomes');

// ── shots: each motion's recipe → its exact cameras ────────────────────────────
const shots = [];
for (const ref of motions) {
  const recipePath = path.join(outcomes, ref, 'recipe.json');
  if (!existsSync(recipePath)) fail(`no recipe at ${recipePath} — is '${ref}' a forged motion ref?`);
  const recipe = JSON.parse(await fs.readFile(recipePath, 'utf8'));
  const worldRef = recipe.subject?.world_ref;
  if (!worldRef) fail(`'${ref}' is not a WORLD motion (its subject has no world_ref) — a Blender film is a camera over a world`);
  const { motion, params = {}, frames, fps = 12 } = recipe.shot || {};
  if (!WORLD_MOTION_NAMES.includes(motion)) fail(`'${ref}' is a '${motion}' shot — a film takes camera motions (${WORLD_MOTION_NAMES.join(', ')})`);
  if (shots.length && worldRef !== shots[0].shot.world_ref) fail(`'${ref}' is over '${worldRef}', not '${shots[0].shot.world_ref}' — one film is one world`);
  const sketch = SketchRepository.getByRef(worldRef);
  if (!sketch) fail(`world '${worldRef}' not found`);
  const { payload } = await resolveWorldScene(sketch, { view: params.view });
  if (!payload) fail(`world '${worldRef}' has no World form`);
  const { cameras, width, height } = worldMotionCameras({ payload, motion, params, frames });
  shots.push({ ref, shot: filmShot({ motionRef: ref, worldRef, title: recipe.title, motion, fps, width, height, cameras: cameras.map((c) => c.worldFraming) }) });
}

// ── the pack (text + GLB, in the first motion's outcome folder) ─────────────────
const packDir = path.join(outcomes, shots[0].ref, 'blender');
await fs.mkdir(path.join(packDir, 'shots'), { recursive: true });
let film;
try {
  film = await writeBlenderFilm({ outDir: packDir, shot: shots[0].shot, title: shots[0].shot.title, base: args.base, log });
} catch (e) {
  fail(e?.message ?? String(e));
}
const shotFiles = [];
for (const s of shots) {
  const f = path.join(packDir, 'shots', `${s.ref}.json`);
  await fs.writeFile(f, `${JSON.stringify(s.shot, null, 2)}\n`);
  shotFiles.push(f);
}
log(`pack: ${film.written.length} files + ${shotFiles.length} shot(s) → ${packDir}`);

// ── the film workspace: never inside a git working tree ─────────────────────────
const ws = path.resolve(args.out || path.join(process.env.MOJULO_HOME, 'films', shots[0].ref));
const tree = workTreeOf(ws);
if (tree) fail(`--out ${ws} is inside the git working tree ${tree} — renders never land in a checkout; pick a folder outside it`);
await fs.mkdir(ws, { recursive: true });
const blend = path.join(ws, 'film.blend');
const gatePath = path.join(ws, 'film-gate.json');

const py = (name) => path.join(packDir, name);
const commands = [
  ...(existsSync(blend) ? [] : [`<blender> -b --python '${py('import_mojulo.py')}' -- --mode run --blend '${blend}'`]),
  `<blender> -b '${blend}' --python '${py('film_shots.py')}' -- ${shotFiles.map((f) => `--shot '${f}'`).join(' ')} --verify '${gatePath}'`,
  `<blender> -b '${blend}' --python '${py('film_light.py')}'`,
  ...(args.render ? [`<blender> -b '${blend}' --python '${py('film_render.py')}' -- --preset ${args.render} --out '${path.join(ws, 'film')}'`] : []),
];

if (!blenderBin || !existsSync(blenderBin)) {
  log('Blender not found — the pack is emitted; run the commands yourself (or set MOJULO_BLENDER)');
  process.stdout.write(`${JSON.stringify({ ok: true, blender: null, pack: packDir, workspace: ws, shots: shots.map((s) => s.ref), commands }, null, 2)}\n`);
  process.exit(0);
}

// ── Blender, serially, watchdogged ──────────────────────────────────────────────
const SETUP_MS = Number(process.env.MOJULO_BLENDER_TIMEOUT_MS || 10 * 60 * 1000);
const RENDER_MS = Number(process.env.MOJULO_BLENDER_RENDER_TIMEOUT_MS || 12 * 60 * 60 * 1000);
const PY_ERR = /Traceback \(most recent call last\)|^Error: /m;
function runBlender(step, bargs, { env = {}, done, ms = SETUP_MS } = {}) {
  return new Promise((resolve) => {
    log(`${step} …`);
    const child = spawn(blenderBin, bargs, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
    let out = ''; let err = '';
    const dog = setTimeout(() => child.kill('SIGKILL'), ms);
    child.stdout.on('data', (d) => { out += d; for (const l of String(d).split('\n')) if (/\[film\]|\[mojulo\]/.test(l)) log(`  ${l.trim()}`); });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', async (code, signal) => {
      clearTimeout(dog);
      const logPath = path.join(ws, `${step}.log`);
      await fs.writeFile(logPath, `${out}\n--- stderr ---\n${err}`);
      const pyErr = PY_ERR.exec(out) || PY_ERR.exec(err);
      if (signal === 'SIGKILL' || code !== 0 || pyErr || (done && !done.test(out))) {
        fail(`${step} failed: ${signal === 'SIGKILL' ? `watchdog after ${ms / 60000} min` : pyErr ? `python error "${pyErr[0].trim()}"` : `exit ${code}`} (log: ${logPath})`);
      }
      resolve(out);
    });
  });
}

if (!existsSync(blend)) {
  await runBlender('import', ['-b', '--python', py('import_mojulo.py'), '--', '--mode', 'run', '--blend', blend, '--force'],
    { env: { MOJULO_PACK: packDir }, done: /MOJ_RUN_DONE/ });
} else {
  log(`film.blend exists — kept (your lights and art); only the mojulo cameras are replaced`);
}
await runBlender('shots', ['-b', blend, '--python', py('film_shots.py'), '--',
  ...shotFiles.flatMap((f) => ['--shot', f]), '--verify', gatePath,
  ...(args.check ? ['--check', args.check, '--check-dir', path.join(ws, 'check')] : [])], { done: /MOJ_FILM_SHOTS_DONE/ });
await runBlender('light', ['-b', blend, '--python', py('film_light.py')], { done: /MOJ_FILM_LIGHT_DONE/ });
let mp4 = null;
if (args.render) {
  const out = await runBlender(`render-${args.render}`, ['-b', blend, '--python', py('film_render.py'), '--',
    '--preset', args.render, '--out', path.join(ws, 'film')], { done: /MOJ_FILM_RENDER_DONE/, ms: RENDER_MS });
  mp4 = (/MOJ_FILM_RENDER_DONE (.+)/.exec(out) || [])[1]?.trim() || null;
}

const gate = existsSync(gatePath) ? JSON.parse(await fs.readFile(gatePath, 'utf8')) : null;
process.stdout.write(`${JSON.stringify({
  ok: !!gate?.ok,
  blender: blenderBin,
  pack: packDir,
  workspace: ws,
  blend,
  shots: shots.map((s) => ({ ref: s.ref, motion: s.shot.motion, frames: s.shot.frame_count })),
  gate,
  ...(args.check ? { check_dir: path.join(ws, 'check') } : {}),
  mp4,
  eyes_gate: `hold ${args.check ? 'the check stills' : 'a few frames (--check 1,…)'} against each motion's GIF before a long render; the eyes gate is the operator's`,
}, null, 2)}\n`);
