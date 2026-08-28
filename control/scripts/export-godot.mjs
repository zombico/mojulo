#!/usr/bin/env node
/**
 * export-godot.mjs — the Godot handoff driver (godot-handoff.plan.md G1 +
 * game scope). Emits a ready-to-open, text-only Godot project for a WORLD ref
 * (walkable level) or a GAME ref (menu + gated level progression + music
 * beds), then runs the machine gate. Mirrors the local-worker posture of
 * bake-world-gi.mjs / godot-verify.mjs: env-located binary, JSON handback on
 * stdout, logs on stderr.
 *
 * Flow per level: resolveWorldScene → facesToGlb (the same GLB export_model
 * writes) → extractEngineScore (the shared engine-agnostic score) → emit.
 * Machine gate: `--headless --import` twice (the fresh-project wart tolerates
 * the first exit), second must exit 0; then a one-frame headless run of every
 * scene — import compiles NO GDScript, and Godot exits 0 even on script load
 * failure, so the gate greps the log. --web then attempts an
 * `--export-release Web` build (needs export templates installed). Eyes gate
 * stays with the operator: open the project and play it.
 *
 * Capability ladder rung 0 (no Godot binary): emit-only, gate skipped.
 *
 * Usage (from control/, repo-dev sets MOJULO_DATA_DIR/MOJULO_OUTCOMES_DIR):
 *   node scripts/export-godot.mjs --ref sk_ms_tutorial_rising      # world
 *   node scripts/export-godot.mjs --ref crypt-of-the-rune-key      # game
 *   node scripts/export-godot.mjs --ref <ref> --web                # + web build
 *   node scripts/export-godot.mjs --ref <ref> --no-gate            # emit only
 * Env: MOJULO_GODOT (default /Applications/Godot.app/Contents/MacOS/Godot).
 */
import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const GODOT = process.env.MOJULO_GODOT || '/Applications/Godot.app/Contents/MacOS/Godot';

const { values: args } = parseArgs({ options: {
  ref: { type: 'string' },
  out: { type: 'string' },
  godot: { type: 'string' },
  web: { type: 'boolean', default: false },
  'no-gate': { type: 'boolean', default: false },
  'no-clips': { type: 'boolean', default: false },
} });

function fail(msg) { process.stdout.write(`${JSON.stringify({ ok: false, error: msg })}\n`); process.exit(1); }
const log = (msg) => process.stderr.write(`[export-godot] ${msg}\n`);

if (!args.ref) fail('need --ref <world or game sketch>');
const godotBin = args.godot || GODOT;

register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
resolveMojuloPaths();
const { SketchRepository } = await import('@/lib/db/repositories/sketches');
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { facesToGlb } = await import('@/lib/graph/scene/scene-gltf');
const { extractEngineScore } = await import('@/lib/graph/scene/engine-score.js');
const { emitGodotProject, emitGodotGame } = await import('@/lib/graph/scene/godot-project.js');
const { assessPortability } = await import('@/lib/graph/scene/engine-portability.js');

const kernelSrc = path.join(here, '..', 'lib', 'graph', 'scene', 'godot-kernel');
const kernelVersion = (await fs.readFile(path.join(kernelSrc, 'VERSION'), 'utf8')).trim();

const sketch = SketchRepository.getByRef(args.ref);
if (!sketch) fail(`sketch '${args.ref}' not found`);
const manifest = sketch.manifest ?? {};
if (manifest.engine === 'pixelizer' || manifest.kind === 'pixelizer') {
  fail(`refused: '${args.ref}' is a pixelizer game — a 2D reducer is not a scene (godot-handoff.plan.md, cross-engine alignment)`);
}
const isGame = manifest.kind === 'game';

const hashOf = (m) => createHash('sha256').update(JSON.stringify(m)).digest('hex').slice(0, 16);
const toDb = (v) => (Number.isFinite(v) && v > 0 ? 20 * Math.log10(v) : null);

// ── shared per-world resolution: ref → { glb, score } ──
async function resolveLevel(levelSketch) {
  const { payload, kind } = await resolveWorldScene(levelSketch);
  if (!payload) return { error: `kind '${levelSketch.manifest?.kind ?? kind ?? '?'}' resolves to no traversable scene` };
  const exported = facesToGlb(payload, { generator: `mojulo ${levelSketch.ref}`, ...(args['no-clips'] ? {} : { clips: '_all' }) });
  const score = extractEngineScore(levelSketch, payload);
  return { kind, exported, score };
}

let beatsRender = null;
async function renderBeats(beatsRef) {
  const beats = SketchRepository.getByRef(beatsRef);
  if (!beats) fail(`beats ref '${beatsRef}' not found`);
  if (!beatsRender) ({ renderBeatsOffline: beatsRender } = await import('@/lib/graph/beats/beats-render'));
  const rendered = await beatsRender(beats.manifest, {});
  log(`beats '${beatsRef}' rendered — ${rendered.wav.length} bytes`);
  return rendered.wav;
}

// ── emit ──
const outcomes = process.env.MOJULO_OUTCOMES_DIR || path.join(process.cwd(), 'data', 'outcomes');
const outDir = args.out ? path.resolve(args.out) : path.join(outcomes, args.ref, 'godot');
const written = [];
const binaries = []; // [{ rel, bytes }] written alongside emitted text
let emitted;
let glbStats;
let portability;
let sceneChecks = []; // res:// scene paths for the one-frame gate

if (!isGame) {
  const { error, kind, exported, score } = await resolveLevel(sketch);
  if (error) fail(error);
  log(`resolved '${args.ref}' (kind ${kind}) — GLB ${exported.byteLength} bytes, ${exported.animationCount ?? 0} animations`);
  let audioFile = null;
  if (score.soundtrack) {
    binaries.push({ rel: `audio/${score.soundtrack}.wav`, bytes: await renderBeats(score.soundtrack) });
    audioFile = `audio/${score.soundtrack}.wav`;
  }
  binaries.push({ rel: 'model.glb', bytes: exported.bytes });
  binaries.push({ rel: 'score.json', bytes: JSON.stringify(score, null, 2) });
  binaries.push({ rel: `recipe/${args.ref}.json`, bytes: JSON.stringify(manifest, null, 2) });
  portability = assessPortability({ manifest, levels: [{ ref: args.ref, score }] });
  emitted = emitGodotProject({
    ref: args.ref, score, manifestHash: hashOf(manifest), glbFile: 'model.glb', audioFile,
    kernelVersion, remint: `node scripts/export-godot.mjs --ref ${args.ref}`,
  });
  glbStats = {
    bytes: exported.byteLength, nodes: exported.nodeCount, triangles: exported.triangleCount,
    animations: exported.animationCount ?? 0, cameras: exported.cameraCount ?? 0, entities: exported.entityCount ?? 0,
  };
  sceneChecks = []; // main scene IS the level; the plain one-frame run covers it
} else {
  const levelSpecs = Array.isArray(manifest.levels) ? manifest.levels : [];
  if (!levelSpecs.length) fail(`game '${args.ref}' declares no levels`);
  const music = manifest.music ?? {};
  const battle = Array.isArray(music.battle) ? music.battle : [];
  const battleDb = toDb(music.battleVolume);
  const beds = new Map(); // beatsRef → audio/<ref>.wav (rendered once)
  async function bed(beatsRef) {
    if (!beatsRef) return null;
    if (!beds.has(beatsRef)) {
      binaries.push({ rel: `audio/${beatsRef}.wav`, bytes: await renderBeats(beatsRef) });
      beds.set(beatsRef, `audio/${beatsRef}.wav`);
    }
    return beds.get(beatsRef);
  }

  const levels = [];
  glbStats = { levels: {} };
  for (let i = 0; i < levelSpecs.length; i++) {
    const spec = levelSpecs[i];
    const lvSketch = SketchRepository.getByRef(spec.ref);
    if (!lvSketch) fail(`level '${spec.ref}' not found`);
    const { error, exported, score } = await resolveLevel(lvSketch);
    if (error) fail(`level '${spec.ref}': ${error}`);
    log(`level ${i + 1}/${levelSpecs.length} '${spec.ref}' — GLB ${exported.byteLength} bytes`);
    // A level's own soundtrack wins; else the game's battle beds rotate.
    const own = score.soundtrack;
    const audioFile = await bed(own ?? battle[i % Math.max(battle.length, 1)]);
    binaries.push({ rel: `levels/${spec.ref}/model.glb`, bytes: exported.bytes });
    binaries.push({ rel: `levels/${spec.ref}/score.json`, bytes: JSON.stringify(score, null, 2) });
    binaries.push({ rel: `recipe/${spec.ref}.json`, bytes: JSON.stringify(lvSketch.manifest, null, 2) });
    levels.push({ ref: spec.ref, title: spec.title ?? spec.ref, gate: spec.gate ?? null, score, audioFile, audioDb: own ? null : battleDb });
    glbStats.levels[spec.ref] = { bytes: exported.byteLength, triangles: exported.triangleCount, animations: exported.animationCount ?? 0 };
    sceneChecks.push(`res://levels/${spec.ref}/level.tscn`);
  }
  const menuFile = await bed(music.menu);
  binaries.push({ rel: 'game.json', bytes: JSON.stringify(manifest, null, 2) });
  binaries.push({ rel: 'recipe/game.json', bytes: JSON.stringify(manifest, null, 2) });
  portability = assessPortability({ manifest, levels: levels.map((l) => ({ ref: l.ref, score: l.score })) });
  emitted = emitGodotGame({
    ref: args.ref, title: manifest.title ?? args.ref, manifestHash: hashOf(manifest), levels,
    music: { menuFile, menuDb: toDb(music.menuVolume) },
    shellExtras: ['menu', 'setup', 'difficulty', 'theme'].filter((k) => manifest[k] != null),
    kernelVersion, remint: `node scripts/export-godot.mjs --ref ${args.ref}`,
  });
}

// WRITE — the folder is wholly derived; clean-emit for deterministic re-mints.
await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });
async function writeOut(rel, data) {
  const abs = path.join(outDir, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, data);
  written.push({ file: rel, bytes: Buffer.byteLength(data) });
}
for (const b of binaries) await writeOut(b.rel, b.bytes);
for (const f of emitted.files) await writeOut(f.file, f.text);
await writeOut('portability.json', JSON.stringify(portability, null, 2));
// The kernel: hand-authored, versioned, copied verbatim (never generated).
await fs.cp(kernelSrc, path.join(outDir, 'kernel'), { recursive: true });
for (const k of await fs.readdir(kernelSrc)) {
  written.push({ file: `kernel/${k}`, bytes: (await fs.stat(path.join(kernelSrc, k))).size });
}
log(`emitted ${written.length} files (kernel ${kernelVersion}) → ${outDir}`);

// MACHINE GATE
function runGodot(gargs) {
  return new Promise((resolve) => {
    const child = spawn(godotBin, gargs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => resolve({ code, out, err }));
  });
}
const SCRIPT_ERR = /SCRIPT ERROR|Parse Error|Failed to load script|Cannot open file|Failed loading resource/;

let gate = { skipped: true };
let webBuild = null;
if (!args['no-gate'] && existsSync(godotBin)) {
  log('machine gate — headless import (twice, per the fresh-project wart)');
  const first = await runGodot(['--headless', '--path', outDir, '--import']);
  const second = await runGodot(['--headless', '--path', outDir, '--import']);
  const imported = existsSync(path.join(outDir, '.godot'));
  gate = { skipped: false, import_first_exit: first.code, import_exit: second.code, dot_godot: imported };
  if (second.code !== 0 || !imported) {
    process.stderr.write(second.out + second.err);
    fail(`machine gate FAILED: second --import exit ${second.code}, .godot ${imported ? 'present' : 'missing'}`);
  }
  // Import compiles no GDScript — run one frame of the main scene AND of every
  // level scene so script errors and broken node paths actually fail the gate.
  // Godot exits 0 even on script load failure: grep the log, don't trust the code.
  const frames = [['main', ['--headless', '--path', outDir, '--quit']]];
  for (const scene of sceneChecks) frames.push([scene, ['--headless', '--path', outDir, scene, '--quit']]);
  gate.one_frame = {};
  for (const [label, fargs] of frames) {
    log(`machine gate — one-frame run: ${label}`);
    const frame = await runGodot(fargs);
    const frameLog = frame.out + frame.err;
    const scriptErr = SCRIPT_ERR.exec(frameLog);
    gate.one_frame[label] = { exit: frame.code, clean: !scriptErr };
    if (frame.code !== 0 || scriptErr) {
      process.stderr.write(frameLog);
      fail(`machine gate FAILED: one-frame '${label}' ${scriptErr ? `logged "${scriptErr[0]}"` : `exit ${frame.code}`}`);
    }
  }
  if (args.web) {
    log('web build — --export-release Web (needs export templates)');
    await fs.mkdir(path.join(outDir, 'build', 'web'), { recursive: true });
    const web = await runGodot(['--headless', '--path', outDir, '--export-release', 'Web', 'build/web/index.html']);
    const wasm = existsSync(path.join(outDir, 'build', 'web', 'index.wasm'));
    webBuild = { exit: web.code, wasm };
    if (web.code !== 0 || !wasm) {
      process.stderr.write(web.out + web.err);
      fail(`web build FAILED (exit ${web.code}) — are export templates installed? (Editor → Manage Export Templates)`);
    }
  }
} else if (!args['no-gate']) {
  log(`Godot not found at ${godotBin} — capability ladder rung 0, emitting project text only`);
  gate = { skipped: true, reason: `no Godot binary at ${godotBin} (set MOJULO_GODOT)` };
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  ref: args.ref,
  scope: isGame ? 'game' : 'world',
  dir: outDir,
  manifest_hash: hashOf(manifest),
  glb: glbStats,
  files: written.length,
  total_bytes: written.reduce((s, f) => s + f.bytes, 0),
  kernel: kernelVersion,
  portability: { portable: portability.portable, flags: portability.flags },
  ledger: emitted.ledger,
  gate,
  ...(webBuild ? { web_build: webBuild } : {}),
  eyes_gate: `run: ${godotBin} --path ${outDir}${isGame ? ' — pick a level from the menu; completing it unlocks the next' : ' — walk with WASD + mouse'}`,
}, null, 2)}\n`);
