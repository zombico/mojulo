#!/usr/bin/env node
/**
 * export-godot.mjs — the Godot handoff CLI (godot-handoff.plan.md G1 + game
 * scope + G6 kernel). Thin front door over the shared assembly engine
 * (lib/graph/scene/godot-pack.js — also behind export_game
 * { target: 'godot' }); this script adds the MACHINE GATE: headless import
 * ×2, a one-frame run of every scene (import compiles no GDScript, and Godot
 * exits 0 even on script load failure — the gate greps the log), and the
 * optional --web build. Mirrors the local-worker posture of
 * bake-world-gi.mjs: env-located binary, stdout-JSON handback, stderr logs.
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
const { buildGodotWorldPack, buildGodotGamePack } = await import('@/lib/graph/scene/godot-pack.js');

const sketch = SketchRepository.getByRef(args.ref);
if (!sketch) fail(`sketch '${args.ref}' not found`);
const isGame = sketch.manifest?.kind === 'game';

const outcomes = process.env.MOJULO_OUTCOMES_DIR || path.join(process.cwd(), 'data', 'outcomes');
const outDir = args.out ? path.resolve(args.out) : path.join(outcomes, args.ref, 'godot');
const clips = args['no-clips'] ? null : '_all';

let pack;
try {
  pack = isGame
    ? await buildGodotGamePack({ ref: args.ref, outDir, clips, log })
    : await buildGodotWorldPack({ ref: args.ref, outDir, clips, log });
} catch (e) {
  fail(e?.message ?? String(e));
}
log(`emitted ${pack.written.length} files (kernel ${pack.kernelVersion}) → ${outDir}`);

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
  const frames = [['main', ['--headless', '--path', outDir, '--quit']]];
  for (const scene of pack.sceneChecks) frames.push([scene, ['--headless', '--path', outDir, scene, '--quit']]);
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
  scope: pack.scope,
  dir: outDir,
  manifest_hash: pack.manifestHash,
  kernel: pack.kernelVersion,
  glb: pack.glbStats,
  files: pack.written.length,
  total_bytes: pack.written.reduce((s, f) => s + f.bytes, 0),
  portability: { portable: pack.portability.portable, flags: pack.portability.flags },
  ledger: pack.ledger,
  gate,
  ...(webBuild ? { web_build: webBuild } : {}),
  eyes_gate: `run: ${godotBin} --path ${outDir}${pack.scope === 'game' ? ' — pick a level from the menu; completing it unlocks the next' : ' — walk with WASD + mouse'}`,
}, null, 2)}\n`);
