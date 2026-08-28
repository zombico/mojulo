#!/usr/bin/env node
/**
 * godot-verify.mjs — the Godot half of the interchange I4 gate, repeatable
 * (godot-handoff.plan.md G0). Mirrors the local-worker posture of
 * bake-world-gi.mjs: env-located binary, tmpdir workspace, JSON handback.
 *
 * Machine gate: a headless Godot runtime-imports the exported GLB via
 * GLTFDocument and asserts the interchange contract (clips, cameras, moj:*
 * extras, unlit + COLOR_0 survival) — see godot-verify.gd for the assertions.
 * Eyes gate (--screenshot): a second, WINDOWED run renders the imported scene
 * from the exported cam:view 0 and saves a PNG for the operator to judge
 * (headless Godot uses the dummy renderer and cannot rasterize).
 *
 * Usage (from control/):
 *   node scripts/godot-verify.mjs --ref sk_ms_tutorial_rising
 *   node scripts/godot-verify.mjs --glb data/outcomes/<ref>/model.glb --screenshot
 * Env: MOJULO_GODOT (binary; default /Applications/Godot.app/Contents/MacOS/Godot),
 *      MOJULO_OUTCOMES_DIR (default <control>/data/outcomes).
 */
import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const controlRoot = path.resolve(here, '..');
const GODOT = process.env.MOJULO_GODOT || '/Applications/Godot.app/Contents/MacOS/Godot';

const { values: opts } = parseArgs({
  options: {
    ref: { type: 'string' },
    glb: { type: 'string' },
    screenshot: { type: 'boolean', default: false },
    out: { type: 'string' },
    keep: { type: 'boolean', default: false },
  },
});

function fail(msg) {
  console.error(`godot-verify: ${msg}`);
  process.exit(2);
}

function runGodot(args) {
  return new Promise((resolve) => {
    const child = spawn(GODOT, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let errOut = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { errOut += d; });
    child.on('close', (code) => resolve({ code, out, errOut }));
  });
}

function parseMarker(out, marker) {
  const line = out.split('\n').find((l) => l.startsWith(marker));
  if (!line) return null;
  try { return JSON.parse(line.slice(marker.length)); } catch { return null; }
}

async function main() {
  if (!existsSync(GODOT)) fail(`Godot binary not found at ${GODOT} (set MOJULO_GODOT)`);
  let glb = opts.glb ? path.resolve(opts.glb) : null;
  if (!glb && opts.ref) {
    const outcomes = process.env.MOJULO_OUTCOMES_DIR || path.join(controlRoot, 'data', 'outcomes');
    glb = path.join(outcomes, opts.ref, 'model.glb');
  }
  if (!glb) fail('pass --ref <sketch ref> or --glb <path to model.glb>');
  if (!existsSync(glb)) fail(`no GLB at ${glb} (run export_model with write:true first)`);

  // Minimal throwaway project — --script needs a project context; nothing to import.
  const proj = await fs.mkdtemp(path.join(os.tmpdir(), 'moj-godot-verify-'));
  await fs.writeFile(path.join(proj, 'project.godot'), '; godot-verify scratch project\nconfig_version=5\n\n[application]\nconfig/name="mojulo-godot-verify"\n');
  await fs.copyFile(path.join(here, 'godot-verify.gd'), path.join(proj, 'godot-verify.gd'));

  const scriptArgs = ['--path', proj, '--script', 'res://godot-verify.gd'];
  console.log(`godot-verify: machine gate — headless import of ${glb}`);
  const machine = await runGodot(['--headless', ...scriptArgs, '--', glb]);
  const report = parseMarker(machine.out, 'GODOT_VERIFY_RESULT=');
  if (!report) {
    console.error(machine.out);
    console.error(machine.errOut);
    fail(`no GODOT_VERIFY_RESULT in output (exit ${machine.code})`);
  }

  let shot = null;
  if (opts.screenshot && report.pass) {
    const png = opts.out ? path.resolve(opts.out) : path.join(path.dirname(glb), 'godot-import.png');
    console.log('godot-verify: eyes gate — windowed render (a Godot window will flash)');
    const eyes = await runGodot([...scriptArgs, '--', glb, png]);
    shot = parseMarker(eyes.out, 'GODOT_VERIFY_SHOT=');
    if (!shot?.ok) console.error(`godot-verify: screenshot failed (exit ${eyes.code})\n${eyes.errOut}`);
  }

  if (!opts.keep) await fs.rm(proj, { recursive: true, force: true });
  console.log(JSON.stringify({ ...report, screenshot: shot }, null, 2));
  process.exit(report.pass ? 0 : 1);
}

main().catch((e) => fail(e?.stack || String(e)));
