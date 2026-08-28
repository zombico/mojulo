#!/usr/bin/env node
/**
 * export-godot.mjs — G1 of the Godot handoff (godot-handoff.plan.md): emit a
 * ready-to-open, text-only Godot project for a world ref, then run the machine
 * gate. Mirrors the local-worker posture of bake-world-gi.mjs / godot-verify.mjs:
 * env-located binary, JSON handback on stdout, logs on stderr.
 *
 * Flow: resolveWorldScene → facesToGlb (the same GLB export_model writes) →
 * extractEngineScore (the shared engine-agnostic score) → emitGodotProject →
 * data/outcomes/<ref>/godot/. Machine gate: `--headless --import` twice (the
 * fresh-project wart tolerates the first exit), second must exit 0; --web then
 * attempts an `--export-release Web` build (needs export templates installed).
 * Eyes gate stays with the operator: open the project and walk it.
 *
 * Capability ladder rung 0 (no Godot binary): emit-only, gate skipped.
 *
 * Usage (from control/, repo-dev sets MOJULO_DATA_DIR/MOJULO_OUTCOMES_DIR):
 *   node scripts/export-godot.mjs --ref sk_ms_tutorial_rising
 *   node scripts/export-godot.mjs --ref <ref> --web          # + web build
 *   node scripts/export-godot.mjs --ref <ref> --no-gate      # emit only
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

if (!args.ref) fail('need --ref <world sketch>');
const godotBin = args.godot || GODOT;

register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
resolveMojuloPaths();
const { SketchRepository } = await import('@/lib/db/repositories/sketches');
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { facesToGlb } = await import('@/lib/graph/scene/scene-gltf');
const { extractEngineScore } = await import('@/lib/graph/scene/engine-score.js');
const { emitGodotProject } = await import('@/lib/graph/scene/godot-project.js');

const sketch = SketchRepository.getByRef(args.ref);
if (!sketch) fail(`world '${args.ref}' not found`);
const manifest = sketch.manifest ?? {};
if (manifest.kind === 'game') {
  fail(`'${args.ref}' is a game — the game-scope target (export_game { target: 'godot' }) lands after G1; pass one of its level refs`);
}
if (manifest.engine === 'pixelizer' || manifest.kind === 'pixelizer') {
  fail(`refused: '${args.ref}' is a pixelizer game — a 2D reducer is not a scene (godot-handoff.plan.md, cross-engine alignment)`);
}

// RESOLVE + EXPORT — same realizer, same GLB bytes as export_model.
const { payload, kind } = await resolveWorldScene(sketch);
if (!payload) fail(`kind '${manifest.kind ?? kind ?? '?'}' resolves to no traversable scene — nothing to hand off`);
log(`resolved '${args.ref}' (kind ${kind}) — ${payload.faces?.length ?? 0} faces`);
const exported = facesToGlb(payload, { generator: `mojulo ${args.ref}`, ...(args['no-clips'] ? {} : { clips: '_all' }) });
log(`GLB: ${exported.byteLength} bytes, ${exported.nodeCount} nodes, ${exported.animationCount ?? 0} animations`);

// SCORE + EMIT
const score = extractEngineScore(sketch, payload);
const manifestHash = createHash('sha256').update(JSON.stringify(manifest)).digest('hex').slice(0, 16);

let audioFile = null;
if (score.soundtrack) {
  const beats = SketchRepository.getByRef(score.soundtrack);
  if (!beats) fail(`soundtrack beats ref '${score.soundtrack}' not found`);
  const { renderBeatsOffline } = await import('@/lib/graph/beats/beats-render');
  const rendered = await renderBeatsOffline(beats.manifest, {});
  audioFile = { rel: `audio/${score.soundtrack}.wav`, bytes: rendered.wav };
  log(`soundtrack '${score.soundtrack}' rendered — ${rendered.wav.length} bytes`);
}

const { files, ledger } = emitGodotProject({
  ref: args.ref,
  score,
  manifestHash,
  glbFile: 'model.glb',
  audioFile: audioFile?.rel ?? null,
  remint: `node scripts/export-godot.mjs --ref ${args.ref}`,
});

// WRITE — the folder is wholly derived; clean-emit for deterministic re-mints.
const outcomes = process.env.MOJULO_OUTCOMES_DIR || path.join(process.cwd(), 'data', 'outcomes');
const outDir = args.out ? path.resolve(args.out) : path.join(outcomes, args.ref, 'godot');
await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });
const written = [];
async function writeOut(rel, data) {
  const abs = path.join(outDir, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, data);
  written.push({ file: rel, bytes: Buffer.byteLength(data) });
}
await writeOut('model.glb', exported.bytes);
await writeOut('score.json', JSON.stringify(score, null, 2));
await writeOut(`recipe/${args.ref}.json`, JSON.stringify(manifest, null, 2));
if (audioFile) await writeOut(audioFile.rel, audioFile.bytes);
for (const f of files) await writeOut(f.file, f.text);
log(`emitted ${written.length} files → ${outDir}`);

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
  // Import compiles no GDScript — instantiate the scene and run one frame so
  // script parse errors and broken node paths actually fail the gate. Godot
  // exits 0 even on script load failure, so grep the log, don't trust the code.
  log('machine gate — one-frame headless run (script compile + scene instantiation)');
  const frame = await runGodot(['--headless', '--path', outDir, '--quit']);
  const frameLog = frame.out + frame.err;
  const scriptErr = /SCRIPT ERROR|Parse Error|Failed to load script|Cannot open file|Failed loading resource/.exec(frameLog);
  gate.one_frame_exit = frame.code;
  gate.one_frame_clean = !scriptErr;
  if (frame.code !== 0 || scriptErr) {
    process.stderr.write(frameLog);
    fail(`machine gate FAILED: one-frame run ${scriptErr ? `logged "${scriptErr[0]}"` : `exit ${frame.code}`}`);
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
  kind,
  dir: outDir,
  manifest_hash: manifestHash,
  glb: {
    bytes: exported.byteLength,
    nodes: exported.nodeCount,
    triangles: exported.triangleCount,
    animations: exported.animationCount ?? 0,
    cameras: exported.cameraCount ?? 0,
    entities: exported.entityCount ?? 0,
  },
  files: written.length,
  total_bytes: written.reduce((s, f) => s + f.bytes, 0),
  ledger,
  gate,
  ...(webBuild ? { web_build: webBuild } : {}),
  eyes_gate: `run: ${godotBin} --path ${outDir} — walk with WASD + mouse${score.cameras?.length ? '; 0 toggles the authored view' : ''}`,
}, null, 2)}\n`);
