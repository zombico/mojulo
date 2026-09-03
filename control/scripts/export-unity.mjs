#!/usr/bin/env node
/**
 * export-unity.mjs — the Unity handoff CLI (export-unity.plan.md Y0). Thin
 * front door over lib/graph/scene/unity-pack.js; this script adds the
 * MACHINE GATE: a scratch Unity project (created once, cached beside the
 * pack), the pack copied into Assets/MojuloPack, then two headless passes —
 * -executeMethod Mojulo.Import.Run (build the scene) and Mojulo.Import.Verify
 * (assertions → mojulo-gate.json: collider counts, spawn, ground, and the
 * frame landmark that pins the glTFast axis convention). Mirrors the
 * local-worker posture of export-godot.mjs / bake-world-gi.mjs: env-located
 * binary, stdout-JSON handback, stderr logs.
 *
 * Capability ladder rung 0 (no Unity binary or license): emit-only — the
 * pack + IMPORT-GUIDE.md are the no-binary path; the gate says why it
 * skipped.
 *
 * Usage (from control/, repo-dev sets MOJULO_DATA_DIR/MOJULO_OUTCOMES_DIR):
 *   node scripts/export-unity.mjs --ref sk_ms_tutorial_rising
 *   node scripts/export-unity.mjs --ref <ref> --build         # + standalone app
 *   node scripts/export-unity.mjs --ref <ref> --no-gate       # emit only
 *   node scripts/export-unity.mjs --ref <ref> --fresh-project # rebuild scratch
 * Env: MOJULO_UNITY (editor binary; else newest under
 *      /Applications/Unity/Hub/Editor/<version>/Unity.app/Contents/MacOS/Unity),
 *      MOJULO_GLTFAST_VERSION (default 6.9.1).
 */
import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import { existsSync, readdirSync } from 'node:fs';
import * as fsSync from 'node:fs';
import { spawn } from 'node:child_process';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
// Pinned against the Unity registry (dist-tags.latest stable, checked 2026-09):
// 7.x is still -exp. Override with MOJULO_GLTFAST_VERSION when the pin ages.
const GLTFAST_VERSION = process.env.MOJULO_GLTFAST_VERSION || '6.9.1';

function findUnity() {
  if (process.env.MOJULO_UNITY) return process.env.MOJULO_UNITY;
  const hub = '/Applications/Unity/Hub/Editor';
  if (!existsSync(hub)) return null;
  const versions = readdirSync(hub).filter((v) => /^\d/.test(v)).sort();
  for (const v of versions.reverse()) {
    const bin = path.join(hub, v, 'Unity.app', 'Contents', 'MacOS', 'Unity');
    if (existsSync(bin)) return bin;
  }
  return null;
}

const { values: args } = parseArgs({ options: {
  ref: { type: 'string' },
  out: { type: 'string' },
  unity: { type: 'string' },
  build: { type: 'boolean', default: false },
  'no-gate': { type: 'boolean', default: false },
  'no-clips': { type: 'boolean', default: false },
  'fresh-project': { type: 'boolean', default: false },
} });

function fail(msg) { process.stdout.write(`${JSON.stringify({ ok: false, error: msg })}\n`); process.exit(1); }
const log = (msg) => process.stderr.write(`[export-unity] ${msg}\n`);

if (!args.ref) fail('need --ref <world sketch>');
const unityBin = args.unity || findUnity();

register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
resolveMojuloPaths();
const { SketchRepository } = await import('@/lib/db/repositories/sketches');
const { buildUnityWorldPack, buildUnityGamePack } = await import('@/lib/graph/scene/unity-pack.js');

const sketch = SketchRepository.getByRef(args.ref);
if (!sketch) fail(`sketch '${args.ref}' not found`);
const isGame = sketch.manifest?.kind === 'game';

const outcomes = process.env.MOJULO_OUTCOMES_DIR || path.join(process.cwd(), 'data', 'outcomes');
const outDir = args.out ? path.resolve(args.out) : path.join(outcomes, args.ref, 'unity');
const clips = args['no-clips'] ? null : '_all';

let pack;
try {
  pack = isGame
    ? await buildUnityGamePack({ ref: args.ref, outDir, clips, log })
    : await buildUnityWorldPack({ ref: args.ref, outDir, clips, log });
} catch (e) {
  fail(e?.message ?? String(e));
}
log(`emitted ${pack.written.length} files (leg v${pack.legVersion}) → ${outDir}`);

// MACHINE GATE
// Every launch gets a watchdog: a batchmode Unity that hangs (observed Y0:
// a stale Temp/UnityLockfile from a dead instance blocks the next launch
// FOREVER at startup) must fail loudly, never sit silent. And the stale lock
// itself is cleared before each launch — safe here because the gate owns the
// scratch project and runs its launches strictly one at a time.
const WATCHDOG_MS = Number(process.env.MOJULO_UNITY_TIMEOUT_MS || 15 * 60 * 1000);
function runUnity(uargs, logFile, { projectPath = null } = {}) {
  if (projectPath) fsSync.rmSync(path.join(projectPath, 'Temp', 'UnityLockfile'), { force: true });
  return new Promise((resolve) => {
    const child = spawn(unityBin, [...uargs, '-logFile', logFile], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    const dog = setTimeout(() => { child.kill('SIGKILL'); }, WATCHDOG_MS);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code, signal) => {
      clearTimeout(dog);
      resolve({ code, out, err, timedOut: signal === 'SIGKILL' && code == null });
    });
  });
}
const LICENSE_ERR = /No valid Unity Editor license|License is not active|User cancelled|Token not found in cache/i;
const COMPILE_ERR = /error CS\d+|Scripts have compiler errors|CompilationFailedException/;

let gate = { skipped: true };
if (!args['no-gate'] && unityBin && existsSync(unityBin)) {
  const scratch = path.join(outcomes, args.ref, 'unity-scratch');
  if (args['fresh-project']) await fs.rm(scratch, { recursive: true, force: true });
  const batch = ['-batchmode', '-nographics'];

  if (!existsSync(path.join(scratch, 'Packages', 'manifest.json'))) {
    log(`machine gate — creating scratch project (${scratch})`);
    const create = await runUnity([...batch, '-quit', '-createProject', scratch], path.join(outcomes, args.ref, 'unity-create.log'));
    if (create.code !== 0 || !existsSync(path.join(scratch, 'Packages', 'manifest.json'))) {
      const created = await fs.readFile(path.join(outcomes, args.ref, 'unity-create.log'), 'utf8').catch(() => '');
      if (LICENSE_ERR.test(created)) fail('machine gate unavailable: Unity is not activated — open the Unity editor once and sign in, then re-run');
      fail(`machine gate FAILED: -createProject exit ${create.code}`);
    }
  }
  // Pin glTFast into the scratch manifest (idempotent).
  const manifestPath = path.join(scratch, 'Packages', 'manifest.json');
  const pkgManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  if (pkgManifest.dependencies['com.unity.cloud.gltfast'] !== GLTFAST_VERSION) {
    pkgManifest.dependencies['com.unity.cloud.gltfast'] = GLTFAST_VERSION;
    await fs.writeFile(manifestPath, JSON.stringify(pkgManifest, null, 2));
  }

  log('machine gate — copying pack into Assets/MojuloPack');
  const packDest = path.join(scratch, 'Assets', 'MojuloPack');
  await fs.rm(packDest, { recursive: true, force: true });
  await fs.cp(outDir, packDest, { recursive: true });

  const importLog = path.join(outcomes, args.ref, 'unity-import.log');
  log('machine gate — headless import + scene build (first run resolves packages; may take minutes)');
  const run = await runUnity([...batch, '-projectPath', scratch, '-executeMethod', 'Mojulo.Import.Run', '-quit'], importLog, { projectPath: scratch });
  const runText = await fs.readFile(importLog, 'utf8').catch(() => '');
  if (LICENSE_ERR.test(runText)) fail('machine gate unavailable: Unity is not activated — open the Unity editor once and sign in, then re-run');
  const compileErr = COMPILE_ERR.exec(runText);
  gate = { skipped: false, import_exit: run.code, compile_clean: !compileErr };
  if (run.timedOut || run.code !== 0 || compileErr) {
    process.stderr.write(runText.split('\n').filter((l) => COMPILE_ERR.test(l) || /\[mojulo\]|Exception/.test(l)).join('\n'));
    fail(`machine gate FAILED: import ${run.timedOut ? `hung past the ${WATCHDOG_MS / 60000}min watchdog` : compileErr ? `compile error "${compileErr[0]}"` : `exit ${run.code}`} (log: ${importLog})`);
  }

  const verifyLog = path.join(outcomes, args.ref, 'unity-verify.log');
  log('machine gate — verify pass');
  await fs.rm(path.join(scratch, 'mojulo-gate.json'), { force: true });
  const verify = await runUnity([...batch, '-projectPath', scratch, '-executeMethod', 'Mojulo.Import.Verify', '-quit'], verifyLog, { projectPath: scratch });
  const gateJson = await fs.readFile(path.join(scratch, 'mojulo-gate.json'), 'utf8').catch(() => null);
  gate.verify_exit = verify.code;
  gate.checks = gateJson ? JSON.parse(gateJson) : null;
  if (verify.timedOut || verify.code !== 0 || !gate.checks?.ok) {
    fail(`machine gate FAILED: verify ${verify.timedOut ? `hung past the ${WATCHDOG_MS / 60000}min watchdog` : `exit ${verify.code}`} — ${JSON.stringify(gate.checks)} (log: ${verifyLog})`);
  }

  // Y5: the standalone player build — the Godot leg's --web sibling. The
  // .app lands INSIDE the scratch project (build/mojulo.app); the driver
  // reports its path rather than copying it into the deterministic pack.
  if (args.build) {
    const buildLog = path.join(outcomes, args.ref, 'unity-build.log');
    log('player build — BuildPipeline for the host platform (first build compiles shaders; may take minutes)');
    const build = await runUnity([...batch, '-projectPath', scratch, '-executeMethod', 'Mojulo.Import.BuildPlayer', '-quit'], buildLog, { projectPath: scratch });
    const appPath = ['build/mojulo.app', 'build/mojulo.exe', 'build/mojulo']
      .map((p) => path.join(scratch, p)).find((p) => existsSync(p));
    gate.player_build = { exit: build.code, app: appPath ?? null };
    if (build.timedOut || build.code !== 0 || !appPath) {
      fail(`player build FAILED: ${build.timedOut ? `hung past the ${WATCHDOG_MS / 60000}min watchdog` : `exit ${build.code}, app ${appPath ? 'present' : 'missing'}`} (log: ${buildLog})`);
    }
  }
} else if (!args['no-gate']) {
  log('Unity not found — capability ladder rung 0, emitting the pack + guide only');
  gate = { skipped: true, reason: 'no Unity editor found (set MOJULO_UNITY, or install via Unity Hub)' };
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  ref: args.ref,
  scope: pack.scope,
  dir: outDir,
  manifest_hash: pack.manifestHash,
  leg: pack.legVersion,
  glb: pack.glbStats,
  files: pack.written.length,
  total_bytes: pack.written.reduce((s, f) => s + f.bytes, 0),
  portability: { portable: pack.portability.portable, flags: pack.portability.flags },
  ledger: pack.ledger,
  gate,
  eyes_gate: `follow ${outDir}/IMPORT-GUIDE.md — chunks ① project → ⑤ play${pack.scope === 'game' ? ' (menu first; completing a level unlocks the next)' : ''}; the guide is the no-Unity-here path too`,
}, null, 2)}\n`);
