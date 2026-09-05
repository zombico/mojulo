#!/usr/bin/env node
/**
 * export-unreal.mjs — the Unreal handoff CLI (export-unreal.plan.md rev 2,
 * U0). Thin front door over lib/graph/scene/unreal-pack.js; this script adds
 * the MACHINE GATE: a scratch UE project (a plain-JSON .uproject the driver
 * writes itself — UE needs no -createProject step), the pack copied in as
 * MojuloPack/, then two headless passes — MOJULO_MODE=run (import + build +
 * save the level) and MOJULO_MODE=verify (assertions → mojulo-gate.json:
 * collider count, spawn, ground, world instance, and the frame landmark that
 * pins the score→UE axis convention). Mirrors export-unity.mjs: env-located
 * binary, watchdogged serial launches, log-grepped, stdout-JSON handback.
 *
 * Capability ladder rung 0 (no UE binary): emit-only — the pack +
 * IMPORT-GUIDE.md are the no-binary path; the gate says why it skipped.
 *
 * The headless incantation is PINNED (first machine gate, 2026-09-03). Game
 * scope (U1): a game ref emits the game pack + the MojuloKernel C++ plugin;
 * the gate copies the plugin into the scratch project's Plugins/ and
 * compiles it with UBT (Build.sh UnrealEditor …) before the import launch —
 * the compile IS a gate rung (kernel_compile in the result).
 *
 * Usage (from control/, repo-dev sets MOJULO_DATA_DIR/MOJULO_OUTCOMES_DIR):
 *   node scripts/export-unreal.mjs --ref <world-or-game sketch>
 *   node scripts/export-unreal.mjs --ref <ref> --no-gate       # emit only
 *   node scripts/export-unreal.mjs --ref <ref> --fresh-project # rebuild scratch
 * Env: MOJULO_UNREAL (UnrealEditor-Cmd binary; else newest under
 *      "/Users/Shared/Epic Games/UE_<ver>/Engine/Binaries/Mac/UnrealEditor-Cmd"),
 *      MOJULO_UNREAL_TIMEOUT_MS (watchdog, default 15 min).
 */
import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import { existsSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

function findUnreal() {
  if (process.env.MOJULO_UNREAL) return process.env.MOJULO_UNREAL;
  const hub = '/Users/Shared/Epic Games';
  if (!existsSync(hub)) return null;
  const versions = readdirSync(hub).filter((v) => /^UE_\d/.test(v)).sort();
  for (const v of versions.reverse()) {
    const bin = path.join(hub, v, 'Engine', 'Binaries', 'Mac', 'UnrealEditor-Cmd');
    if (existsSync(bin)) return bin;
  }
  return null;
}

/** "…/UE_5.6/Engine/…" → "5.6"; null when the path carries no version. */
function engineAssociation(bin) {
  const m = /UE_(\d+\.\d+)/.exec(bin ?? '');
  return m ? m[1] : null;
}

const { values: args } = parseArgs({ options: {
  ref: { type: 'string' },
  out: { type: 'string' },
  unreal: { type: 'string' },
  posture: { type: 'string' },   // greybox|final — operator-declared handoff posture (engine-score.js)
  'no-gate': { type: 'boolean', default: false },
  'no-clips': { type: 'boolean', default: false },
  lit: { type: 'boolean', default: false },   // the LIT handoff: PBR materials over an unshaded base (lit-handoff.plan.md)
  'fresh-project': { type: 'boolean', default: false },
} });

function fail(msg) { process.stdout.write(`${JSON.stringify({ ok: false, error: msg })}\n`); process.exit(1); }
const log = (msg) => process.stderr.write(`[export-unreal] ${msg}\n`);

if (!args.ref) fail('need --ref <world sketch>');
const unrealBin = args.unreal || findUnreal();

register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
resolveMojuloPaths();
const { SketchRepository } = await import('@/lib/db/repositories/sketches');
const { buildUnrealWorldPack, buildUnrealGamePack } = await import('@/lib/graph/scene/unreal-pack.js');

const sketch = SketchRepository.getByRef(args.ref);
if (!sketch) fail(`sketch '${args.ref}' not found`);
const isGame = sketch.manifest?.kind === 'game';

const outcomes = process.env.MOJULO_OUTCOMES_DIR || path.join(process.cwd(), 'data', 'outcomes');
const outDir = args.out ? path.resolve(args.out) : path.join(outcomes, args.ref, 'unreal');
const clips = args['no-clips'] ? null : '_all';

let pack;
try {
  const build = isGame ? buildUnrealGamePack : buildUnrealWorldPack;
  pack = await build({ lit: args.lit, ref: args.ref, outDir, clips, posture: args.posture ?? null, log });
} catch (e) {
  fail(e?.message ?? String(e));
}
log(`emitted ${pack.written.length} files (leg v${pack.legVersion}) → ${outDir}`);

// MACHINE GATE — serial, watchdogged launches (the Unity leg's stale-lock
// 8-hour hang is the cautionary tale; UE has no known lockfile equivalent,
// but a hung batch editor must still fail loudly, never sit silent).
const WATCHDOG_MS = Number(process.env.MOJULO_UNREAL_TIMEOUT_MS || 15 * 60 * 1000);
function runUnreal(uargs, logFile, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(unrealBin, [...uargs, `-abslog=${logFile}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });
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
// Grep the log, never trust exit codes alone (the sibling drivers' rule).
const PY_ERR = /LogPython: Error|Traceback \(most recent call last\)|mojulo gate FAILED/;

let gate = { skipped: true };
if (!args['no-gate'] && unrealBin && existsSync(unrealBin)) {
  const scratch = path.join(outcomes, args.ref, 'unreal-scratch');
  if (args['fresh-project']) await fs.rm(scratch, { recursive: true, force: true });
  const uproject = path.join(scratch, 'Mojulo.uproject');

  if (!existsSync(uproject)) {
    log(`machine gate — writing scratch .uproject (${scratch})`);
    await fs.mkdir(path.join(scratch, 'Content'), { recursive: true });
    const assoc = engineAssociation(unrealBin);
    await fs.writeFile(uproject, JSON.stringify({
      FileVersion: 3,
      ...(assoc ? { EngineAssociation: assoc } : {}),
      Plugins: [{ Name: 'PythonScriptPlugin', Enabled: true }],
    }, null, 2));
  }

  log('machine gate — copying pack into MojuloPack/');
  const packDest = path.join(scratch, 'MojuloPack');
  await fs.rm(packDest, { recursive: true, force: true });
  await fs.cp(outDir, packDest, { recursive: true });

  // Game scope: the MojuloKernel plugin rides the pack; the scratch project
  // compiles it with UBT before the editor launches (the operator-side
  // equivalent is the editor's own "rebuild module?" prompt, guide ③).
  const kernelSrc = path.join(packDest, 'MojuloKernel');
  if (existsSync(kernelSrc)) {
    const pluginDest = path.join(scratch, 'Plugins', 'MojuloKernel');
    await fs.rm(path.join(pluginDest, 'Source'), { recursive: true, force: true });
    // Clean Binaries too: with a live editor holding the project, UBT goes
    // hot-reload — it writes a new -00NN dylib for THAT session but leaves
    // the .modules manifest at the loaded version, so headless runs keep
    // executing the stale kernel (pinned at U3: dumps never appeared).
    await fs.rm(path.join(pluginDest, 'Binaries'), { recursive: true, force: true });
    await fs.rm(path.join(pluginDest, 'Intermediate'), { recursive: true, force: true });
    await fs.mkdir(path.dirname(pluginDest), { recursive: true });
    await fs.cp(kernelSrc, pluginDest, { recursive: true });
    const engineDir = path.resolve(unrealBin, '..', '..', '..'); // …/Engine
    const buildSh = path.join(engineDir, 'Build', 'BatchFiles', 'Mac', 'Build.sh');
    const compileLog = path.join(outcomes, args.ref, 'unreal-compile.log');
    log('machine gate — compiling the MojuloKernel plugin (UBT)');
    const compile = await new Promise((resolve) => {
      const child = spawn('bash', [buildSh, 'UnrealEditor', 'Mac', 'Development', `-Project=${uproject}`], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      const dog = setTimeout(() => { child.kill('SIGKILL'); }, WATCHDOG_MS);
      child.stdout.on('data', (d) => { out += d; });
      child.stderr.on('data', (d) => { out += d; });
      child.on('close', (code, signal) => { clearTimeout(dog); resolve({ code, out, timedOut: signal === 'SIGKILL' && code == null }); });
    });
    await fs.writeFile(compileLog, compile.out);
    // UBT suffixes the dylib (-0001) when an editor instance is live (hot
    // reload); the .modules manifest resolves it either way — accept any.
    const binDir = path.join(pluginDest, 'Binaries', 'Mac');
    const dylibs = existsSync(binDir)
      ? readdirSync(binDir).filter((f) => /^libUnrealEditor-MojuloKernel.*\.dylib$/.test(f)) : [];
    gate.kernel_compile = { exit: compile.code, dylib: dylibs[0] ?? null };
    if (compile.timedOut || compile.code !== 0 || !dylibs.length) {
      process.stderr.write(compile.out.split('\n').filter((l) => /error|Error/.test(l)).slice(-30).join('\n'));
      fail(`machine gate FAILED: kernel compile ${compile.timedOut ? 'hung' : `exit ${compile.code}`}${dylibs.length ? '' : ' (no plugin dylib)'} (log: ${compileLog})`);
    }
  }

  const script = path.join(packDest, 'import_mojulo.py');
  const batch = [uproject, '-run=pythonscript', `-script=${script}`, '-unattended', '-nullrhi', '-nosplash'];

  const importLog = path.join(outcomes, args.ref, 'unreal-import.log');
  log('machine gate — headless import + level build (first run compiles shaders; may take minutes)');
  const run = await runUnreal(batch, importLog, { MOJULO_MODE: 'run' });
  const runText = await fs.readFile(importLog, 'utf8').catch(() => '');
  const pyErr = PY_ERR.exec(runText);
  gate = { ...gate, skipped: false, import_exit: run.code, python_clean: !pyErr };
  if (run.timedOut || run.code !== 0 || pyErr) {
    process.stderr.write(runText.split('\n').filter((l) => PY_ERR.test(l) || /\[mojulo\]|Error/.test(l)).slice(-40).join('\n'));
    fail(`machine gate FAILED: import ${run.timedOut ? `hung past the ${WATCHDOG_MS / 60000}min watchdog` : pyErr ? `python error "${pyErr[0]}"` : `exit ${run.code}`} (log: ${importLog})`);
  }

  const verifyLog = path.join(outcomes, args.ref, 'unreal-verify.log');
  log('machine gate — verify pass');
  await fs.rm(path.join(scratch, 'mojulo-gate.json'), { force: true });
  const verify = await runUnreal(batch, verifyLog, { MOJULO_MODE: 'verify' });
  const gateJson = await fs.readFile(path.join(scratch, 'mojulo-gate.json'), 'utf8').catch(() => null);
  gate.verify_exit = verify.code;
  gate.checks = gateJson ? JSON.parse(gateJson) : null;
  if (verify.timedOut || !gate.checks?.ok) {
    fail(`machine gate FAILED: verify ${verify.timedOut ? `hung past the ${WATCHDOG_MS / 60000}min watchdog` : `exit ${verify.code}`} — ${JSON.stringify(gate.checks)} (log: ${verifyLog})`);
  }
} else if (!args['no-gate']) {
  log('Unreal not found — capability ladder rung 0, emitting the pack + guide only');
  gate = { skipped: true, reason: 'no Unreal editor found (set MOJULO_UNREAL to UnrealEditor-Cmd, or install UE 5.4+ via the Epic Games Launcher)' };
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
  eyes_gate: `follow ${outDir}/IMPORT-GUIDE.md — chunks ① project → ⑤ play; the guide is the no-Unreal-here path too`,
}, null, 2)}\n`);
