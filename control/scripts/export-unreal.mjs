#!/usr/bin/env node
/**
 * export-unreal.mjs — the Unreal ASSET CLI: one of mojulo's things (a character, a creature, a prop, a building, a
 * robot, anything assembled) as an Unreal asset pack. Thin front door over lib/graph/scene/unreal-pack.js, the same pack
 * export_model { ref, format: 'unreal' } writes; this script adds the MACHINE GATE: a scratch UE project (a plain-JSON
 * .uproject the driver writes itself — UE needs no -createProject step), the pack copied in as Mojulo/<ref>/, then two
 * headless passes — MOJULO_MODE=run (import the asset, build its preview map) and MOJULO_MODE=verify (assertions →
 * mojulo-gate.json: the preview map, the imported asset, its materials, its lights, a figure's mesh, clip and retarget
 * rig, and the diagnostics the run found). Env-located binary, watchdogged serial launches, log-grepped, stdout-JSON
 * handback.
 *
 * Unreal takes mojulo's assets, not its games or levels: a game ref is refused with the move (export its characters and
 * solids, each by its ref).
 *
 * Capability ladder rung 0 (no UE binary): emit-only — the pack + IMPORT-GUIDE.md are the no-binary path; the gate says
 * why it skipped. The headless incantation is PINNED (first machine gate, 2026-09-03).
 *
 * Usage (from control/, repo-dev sets MOJULO_DATA_DIR/MOJULO_OUTCOMES_DIR):
 *   node scripts/export-unreal.mjs --ref <character | solid sketch>
 *   node scripts/export-unreal.mjs --ref <ref> --no-gate       # emit only
 *   node scripts/export-unreal.mjs --ref <ref> --lit           # PBR materials Unreal lights
 *   node scripts/export-unreal.mjs --ref <ref> --no-humanoid   # a humanoid figure on the flat skeleton (default: the engine skeleton)
 *   node scripts/export-unreal.mjs --ref <ref> --fresh-project # rebuild scratch
 * Env: MOJULO_UNREAL (UnrealEditor-Cmd binary; else newest under
 *      "/Users/Shared/Epic Games/UE_<ver>/Engine/Binaries/Mac/UnrealEditor-Cmd"),
 *      MOJULO_UNREAL_TIMEOUT_MS (watchdog, default 15 min),
 *      MOJULO_SOURCE_IK_RIG (the mannequin IK rig a humanoid figure's retargeter maps from, when the project holds it).
 */
import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { register } from 'node:module';
import path from 'node:path';
import { findUnreal } from '../lib/workers/find.js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

/** "…/UE_5.6/Engine/…" → "5.6"; null when the path carries no version. */
function engineAssociation(bin) {
  const m = /UE_(\d+\.\d+)/.exec(bin ?? '');
  return m ? m[1] : null;
}

const { values: args } = parseArgs({ options: {
  ref: { type: 'string' },
  out: { type: 'string' },
  unreal: { type: 'string' },
  'no-gate': { type: 'boolean', default: false },
  'no-clips': { type: 'boolean', default: false },
  lit: { type: 'boolean', default: false },   // the LIT handoff: PBR materials over an unshaded base, Unreal lights it
  'no-humanoid': { type: 'boolean', default: false },   // a humanoid figure ships the flat skeleton, not the retargetable engine one
  'fresh-project': { type: 'boolean', default: false },
} });

function fail(msg) { process.stdout.write(`${JSON.stringify({ ok: false, error: msg })}\n`); process.exit(1); }
const log = (msg) => process.stderr.write(`[export-unreal] ${msg}\n`);

if (!args.ref) fail('need --ref <character or solid sketch>');
const unrealBin = args.unreal || findUnreal();

register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
resolveMojuloPaths();
const { SketchRepository } = await import('@/lib/db/repositories/sketches');
const { buildUnrealAssetPack } = await import('@/lib/graph/scene/unreal-pack.js');

if (!SketchRepository.getByRef(args.ref)) fail(`sketch '${args.ref}' not found`);

const outcomes = process.env.MOJULO_OUTCOMES_DIR || path.join(process.cwd(), 'data', 'outcomes');
const outDir = args.out ? path.resolve(args.out) : path.join(outcomes, args.ref, 'unreal');
const clips = args['no-clips'] ? null : '_all';

let pack;
try {
  pack = await buildUnrealAssetPack({ ref: args.ref, outDir, clips, lit: args.lit, humanoid: !args['no-humanoid'], log });
} catch (e) {
  fail(e?.message ?? String(e));
}
log(`emitted ${pack.written.length} files (leg v${pack.legVersion}) → ${outDir}`);

// MACHINE GATE — serial, watchdogged launches (the Unity leg's stale-lock 8-hour hang is the cautionary tale; UE has no
// known lockfile equivalent, but a hung batch editor must still fail loudly, never sit silent).
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

  // Lumen + virtual shadow maps — the Third Person template's own DefaultEngine.ini lines. A bare .uproject has none,
  // so a LIT pack rendered direct light only (the first lit eyes gate, 2026-09-06). Idempotent: the editor appends its
  // own sections to this file; we add ours once.
  const cfgDir = path.join(scratch, 'Config');
  const cfgIni = path.join(cfgDir, 'DefaultEngine.ini');
  const ini = await fs.readFile(cfgIni, 'utf8').catch(() => '');
  if (!/r\.DynamicGlobalIlluminationMethod/.test(ini)) {
    await fs.mkdir(cfgDir, { recursive: true });
    const sep = ini && !ini.endsWith('\n') ? '\n' : '';
    await fs.writeFile(cfgIni, `${ini}${sep}\n[/Script/Engine.RendererSettings]\nr.DynamicGlobalIlluminationMethod=1\nr.ReflectionMethod=1\nr.GenerateMeshDistanceFields=True\nr.Shadow.Virtual.Enable=1\n`);
    log('machine gate — Lumen renderer settings written to Config/DefaultEngine.ini');
  }

  log(`machine gate — copying the pack into Mojulo/${args.ref}/`);
  const packDest = path.join(scratch, 'Mojulo', args.ref);
  await fs.rm(packDest, { recursive: true, force: true });
  await fs.mkdir(path.dirname(packDest), { recursive: true });
  await fs.cp(outDir, packDest, { recursive: true });

  const script = path.join(packDest, 'import_mojulo.py');
  const batch = [uproject, '-run=pythonscript', `-script=${script}`, '-unattended', '-nullrhi', '-nosplash'];

  const importLog = path.join(outcomes, args.ref, 'unreal-import.log');
  log('machine gate — headless import + preview map (first run compiles shaders; may take minutes)');
  const run = await runUnreal(batch, importLog, { MOJULO_MODE: 'run' });
  const runText = await fs.readFile(importLog, 'utf8').catch(() => '');
  const pyErr = PY_ERR.exec(runText);
  gate = { skipped: false, import_exit: run.code, python_clean: !pyErr };
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
  kind: pack.kind,
  dir: outDir,
  manifest_hash: pack.manifestHash,
  leg: pack.legVersion,
  glb: pack.glbStats,
  ...(pack.figure ? { figure: pack.figure } : {}),
  files: pack.written.length,
  total_bytes: pack.written.reduce((s, f) => s + f.bytes, 0),
  gate,
  eyes_gate: `follow ${outDir}/IMPORT-GUIDE.md — chunks ① project → ⑤ look; the guide is the no-Unreal-here path too`,
}, null, 2)}\n`);
