#!/usr/bin/env node
/**
 * verify-usd.mjs — the OpenUSD export's MACHINE GATE (interchange-seams.plan.md
 * seam 2). Exports a sketch as USDZ (or USDA), then asks two READERS what they
 * see and compares that to what mojulo declared:
 *
 *   1. `usdcat` (ships with macOS; also in the Pixar USD tools) — parses the
 *      layer; with --usdc, flattens it to binary USDC beside the export (the
 *      snowman: 3.7 MB of text → 1.4 MB).
 *   2. Blender, headless (`-b --python verify-usd.py`) — imports the file and
 *      reports meshes / triangles / world box / vertex colours / textures /
 *      cameras / bones; usd-gate.js compares triangles, size (metres, via
 *      metersPerUnit), colours, textures, cameras, and — for a GLB with
 *      `--humanoid` — the VRM bone names.
 *
 * Stamps `mojulo-usd-gate.json` beside the file. Same posture as the other
 * drivers: readers are operator-hosted and optional; absent ⇒ rung 0 with the
 * reason, never an error. Advisory — it reports; fitness is the operator's.
 *
 * Usage (from control/, repo-dev sets MOJULO_DATA_DIR/MOJULO_OUTCOMES_DIR):
 *   node scripts/verify-usd.mjs --ref sk_foo                 # usdz → usdcat + Blender
 *   node scripts/verify-usd.mjs --ref sk_foo --format usda
 *   node scripts/verify-usd.mjs --ref sk_foo --usdc          # also write model.usdc
 *   node scripts/verify-usd.mjs --ref sk_foo --glb           # gate the GLB export instead
 *   node scripts/verify-usd.mjs --ref sk_foo --glb --quantize --skinned --humanoid
 * Env: MOJULO_BLENDER (default /Applications/Blender.app/Contents/MacOS/Blender,
 *      else `blender` on PATH), MOJULO_USDCAT (default `usdcat` on PATH or /usr/bin/usdcat).
 */
import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

const { values: args } = parseArgs({ options: {
  ref: { type: 'string' },
  format: { type: 'string', default: 'usdz' },
  glb: { type: 'boolean', default: false },
  quantize: { type: 'boolean', default: false },
  skinned: { type: 'boolean', default: false },
  humanoid: { type: 'boolean', default: false },
  usdc: { type: 'boolean', default: false },
  'no-gate': { type: 'boolean', default: false },
} });

function fail(msg) { process.stdout.write(`${JSON.stringify({ ok: false, error: msg })}\n`); process.exit(1); }
const log = (msg) => process.stderr.write(`[verify-usd] ${msg}\n`);
if (!args.ref) fail('need --ref <sketch>');

register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
resolveMojuloPaths();
const { exportModelHandler } = await import('@/lib/mcp/tools/sketch-model-export.js');
const { compareUsdGate } = await import('@/lib/graph/scene/usd-gate.js');

// ── 1. export ─────────────────────────────────────────────────────────────────
const input = args.glb
  ? { ref: args.ref, format: 'glb', ...(args.quantize ? { quantize: true } : {}), ...(args.skinned ? { clips: '_all', skinned: true } : {}), ...(args.humanoid ? { clips: '_all', skinned: true, humanoid: true } : {}) }
  : { ref: args.ref, format: args.format === 'usda' ? 'usda' : 'usdz' };
let exported;
try { exported = await exportModelHandler(input); } catch (e) { fail(e?.message ?? String(e)); }
if (!exported.ok) fail(exported.reason || 'sketch has no exportable geometry');
const file = exported.path;
const dir = path.dirname(file);
log(`exported ${file} (${exported.bytes} bytes, ${exported.triangles} tris${exported.size_units ? `, ${exported.size_units.join(' × ')} units` : ''})`);

const which = (name) => { const r = spawnSync('which', [name], { encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; };
const WATCHDOG_MS = Number(process.env.MOJULO_VERIFY_TIMEOUT_MS || 10 * 60 * 1000);
function run(bin, sargs) {
  return new Promise((resolve) => {
    const child = spawn(bin, sargs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    const dog = setTimeout(() => child.kill('SIGKILL'), WATCHDOG_MS);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(dog); resolve({ code: -1, out, err: String(e), timedOut: false }); });
    child.on('close', (code, signal) => { clearTimeout(dog); resolve({ code, out, err, timedOut: signal === 'SIGKILL' && code == null }); });
  });
}

const gate = { skipped: args['no-gate'], readers: {} };

// ── 2. usdcat (USD files only) ────────────────────────────────────────────────
if (!args['no-gate'] && !args.glb) {
  const usdcat = process.env.MOJULO_USDCAT || which('usdcat') || (existsSync('/usr/bin/usdcat') ? '/usr/bin/usdcat' : null);
  if (!usdcat) gate.readers.usdcat = { skipped: true, reason: 'usdcat not found (macOS ships /usr/bin/usdcat; else the Pixar USD tools) — set MOJULO_USDCAT' };
  else {
    log(`usdcat — parse${args.usdc ? ' + flatten to USDC' : ''}`);
    const usdcPath = path.join(dir, 'model.usdc');
    const r = args.usdc
      ? await run(usdcat, ['--flatten', '-o', usdcPath, file])
      : await run(usdcat, ['--flatten', file]);
    const ok = !r.timedOut && r.code === 0;
    gate.readers.usdcat = { bin: usdcat, exit: r.timedOut ? 'timeout' : r.code, parsed: ok };
    if (ok && args.usdc && existsSync(usdcPath)) gate.readers.usdcat.usdc = { path: usdcPath, bytes: (await fs.stat(usdcPath)).size, text_bytes: exported.bytes };
    if (!ok) gate.readers.usdcat.error = (r.err || r.out).trim().split('\n').slice(-4).join(' | ');
  }
}

// ── 3. Blender headless import ────────────────────────────────────────────────
if (!args['no-gate']) {
  const blender = process.env.MOJULO_BLENDER || (existsSync('/Applications/Blender.app/Contents/MacOS/Blender') ? '/Applications/Blender.app/Contents/MacOS/Blender' : which('blender'));
  if (!blender) gate.readers.blender = { skipped: true, reason: 'Blender not found — install Blender or set MOJULO_BLENDER (docs/local-blender-worker.md)' };
  else {
    const reportPath = path.join(dir, 'blender-import.json');
    await fs.rm(reportPath, { force: true });
    log(`Blender — headless import (${path.basename(file)})`);
    const r = await run(blender, ['-b', '--python', path.join(here, 'verify-usd.py'), '--', file, reportPath]);
    const report = existsSync(reportPath) ? JSON.parse(await fs.readFile(reportPath, 'utf8')) : null;
    gate.readers.blender = { bin: blender, exit: r.timedOut ? 'timeout' : r.code, report };
    if (!report) gate.readers.blender.error = (r.err || r.out).trim().split('\n').filter((l) => /Error|error|Traceback/.test(l)).slice(-4).join(' | ') || 'no report written';
    else {
      const cmp = compareUsdGate({ exported, blender: report });
      gate.compare = cmp;
      for (const [k, c] of Object.entries(cmp.checks)) log(`  ${c.ok === null ? '·' : c.ok ? '✓' : '✗'} ${k}: expected ${JSON.stringify(c.expected)} got ${JSON.stringify(c.got)}${c.missing ? ` missing ${c.missing.join(',')}` : ''}`);
    }
  }
}

const gatePath = path.join(dir, `mojulo-${args.glb ? 'glb' : 'usd'}-gate.json`);
const stamp = { file, ref: args.ref, input, measured_at: new Date().toISOString(), declared: { bytes: exported.bytes, triangles: exported.triangles, nodes: exported.nodes, meters_per_unit: exported.meters_per_unit, size_units: exported.size_units, textures: exported.textures, cameras: exported.cameras, quantized: exported.quantized, humanoid_figures: exported.humanoid_figures }, gate };
await fs.writeFile(gatePath, `${JSON.stringify(stamp, null, 2)}\n`);

const ok = args['no-gate'] ? true : (gate.compare ? gate.compare.ok : true);
process.stdout.write(`${JSON.stringify({
  ok,
  ref: args.ref,
  file,
  gate_path: gatePath,
  declared: stamp.declared,
  gate,
  eyes_gate: args.glb
    ? `open ${file} in Blender / your engine and look — the numbers above say it imported, not that it reads right`
    : `open ${file} in Blender (File › Import › USD) or AirDrop it to an iPhone for Quick Look: it should land upright at true scale, colours showing — fitness is yours to judge`,
}, null, 2)}\n`);
