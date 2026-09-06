#!/usr/bin/env node
/**
 * export-blender.mjs — the Blender DESTINATION handoff CLI (export-blender.plan.md rev 3,
 * B0). Thin front door over lib/graph/scene/blender-pack.js; this script adds the MACHINE
 * GATE (D2): the pack's OWN import_mojulo.py run headless twice — MOJULO_MODE=run into a
 * scratch .blend (never the operator's), then MOJULO_MODE=verify on that file → a report
 * compared to pack.json by usd-gate.js (the fields the USD/GLB verify gate already
 * compares) + blender-gate.js (node inventory, collections, the sign-sensitive frame
 * landmark). Stamps <pack>/mojulo-gate.json; on green, copies the scratch .blend beside
 * the pack as <ref>.blend when none is there yet. Advisory — it reports; the eyes gate
 * (ARTPASS-GUIDE.md ②) is the operator's.
 *
 * Capability ladder rung 0 (no Blender): emit-only — the pack + guide are the product;
 * the gate says why it skipped. Mirrors export-unreal.mjs / verify-usd.mjs: env-located
 * binary, watchdogged serial launches, log-grepped, stdout-JSON handback.
 *
 * Usage (from control/, repo-dev sets MOJULO_DATA_DIR/MOJULO_OUTCOMES_DIR):
 *   node scripts/export-blender.mjs --ref <sketch>
 *   node scripts/export-blender.mjs --ref <sketch> --base unlit|shaded   # the taste dials (default lit)
 *   node scripts/export-blender.mjs --ref <sketch> --no-gate             # emit only
 *   node scripts/export-blender.mjs --ref <sketch> --force               # replace an existing <ref>.blend
 * Env: MOJULO_BLENDER (default /Applications/Blender.app/Contents/MacOS/Blender, else `blender` on PATH),
 *      MOJULO_BLENDER_TIMEOUT_MS (watchdog per launch, default 10 min).
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
  out: { type: 'string' },
  base: { type: 'string', default: 'lit' },
  posture: { type: 'string' },
  blender: { type: 'string' },
  'no-gate': { type: 'boolean', default: false },
  force: { type: 'boolean', default: false },
  'keep-scratch': { type: 'boolean', default: false },
} });

function fail(msg) { process.stdout.write(`${JSON.stringify({ ok: false, error: msg })}\n`); process.exit(1); }
const log = (msg) => process.stderr.write(`[export-blender] ${msg}\n`);
if (!args.ref) fail('need --ref <sketch>');

const which = (name) => { const r = spawnSync('which', [name], { encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; };
const blenderBin = args.blender || process.env.MOJULO_BLENDER
  || (existsSync('/Applications/Blender.app/Contents/MacOS/Blender') ? '/Applications/Blender.app/Contents/MacOS/Blender' : which('blender'));

register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
resolveMojuloPaths();
const { buildBlenderPack } = await import('@/lib/graph/scene/blender-pack.js');
const { compareBlenderPack } = await import('@/lib/graph/scene/blender-gate.js');
const { compareUsdGate } = await import('@/lib/graph/scene/usd-gate.js');

const outcomes = process.env.MOJULO_OUTCOMES_DIR || path.join(process.cwd(), 'data', 'outcomes');
const outDir = args.out ? path.resolve(args.out) : path.join(outcomes, args.ref, 'blender');

let pack;
try {
  pack = await buildBlenderPack({ ref: args.ref, outDir, base: args.base, posture: args.posture ?? null, log });
} catch (e) {
  fail(e?.message ?? String(e));
}
log(`emitted ${pack.written.length} files (leg v${pack.legVersion}) → ${outDir}`);

// ── MACHINE GATE — serial, watchdogged, log-grepped ────────────────────────────
const WATCHDOG_MS = Number(process.env.MOJULO_BLENDER_TIMEOUT_MS || 10 * 60 * 1000);
function runBlender(bargs, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(blenderBin, bargs, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
    let out = ''; let err = '';
    const dog = setTimeout(() => child.kill('SIGKILL'), WATCHDOG_MS);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(dog); resolve({ code: -1, out, err: String(e), timedOut: false }); });
    child.on('close', (code, signal) => { clearTimeout(dog); resolve({ code, out, err, timedOut: signal === 'SIGKILL' && code == null }); });
  });
}
const PY_ERR = /Traceback \(most recent call last\)|^Error: /m;
const tail = (text, n = 30) => text.split('\n').filter((l) => /\[mojulo\]|Error|Traceback|MOJ_/.test(l)).slice(-n).join('\n');

let gate = { skipped: true };
const blendBeside = path.join(outDir, `${args.ref}.blend`);
if (!args['no-gate'] && blenderBin && existsSync(blenderBin)) {
  const scratch = path.join(outcomes, args.ref, 'blender-scratch');
  await fs.rm(scratch, { recursive: true, force: true });
  await fs.mkdir(scratch, { recursive: true });
  const scratchBlend = path.join(scratch, `${args.ref}.blend`);
  const reportPath = path.join(scratch, 'mojulo-gate.json');
  const script = path.join(outDir, 'import_mojulo.py');
  const env = { MOJULO_PACK: outDir };

  log('machine gate — run (fresh scene → import → collections → shading → camera → scratch .blend)');
  const run = await runBlender(['-b', '--python', script, '--', '--mode', 'run', '--blend', scratchBlend, '--force'], env);
  const runLog = path.join(scratch, 'run.log');
  await fs.writeFile(runLog, `${run.out}\n--- stderr ---\n${run.err}`);
  const runErr = PY_ERR.exec(run.out) || PY_ERR.exec(run.err);
  gate = { skipped: false, blender: blenderBin, run: { exit: run.timedOut ? 'timeout' : run.code, done: /MOJ_RUN_DONE/.test(run.out), log: runLog } };
  if (run.timedOut || run.code !== 0 || runErr || !gate.run.done) {
    process.stderr.write(`${tail(`${run.out}\n${run.err}`)}\n`);
    fail(`machine gate FAILED: run ${run.timedOut ? `hung past the ${WATCHDOG_MS / 60000}min watchdog` : runErr ? `python error "${runErr[0].trim()}"` : `exit ${run.code}`} (log: ${runLog})`);
  }

  log('machine gate — verify (open the scratch .blend → report)');
  const verify = await runBlender(['-b', '--python', script, '--', '--mode', 'verify', '--blend', scratchBlend, '--gate', reportPath], env);
  const verifyLog = path.join(scratch, 'verify.log');
  await fs.writeFile(verifyLog, `${verify.out}\n--- stderr ---\n${verify.err}`);
  const report = existsSync(reportPath) ? JSON.parse(await fs.readFile(reportPath, 'utf8')) : null;
  gate.verify = { exit: verify.timedOut ? 'timeout' : verify.code, log: verifyLog, report_path: reportPath };
  if (!report) {
    process.stderr.write(`${tail(`${verify.out}\n${verify.err}`)}\n`);
    fail(`machine gate FAILED: verify wrote no report (${verify.timedOut ? 'watchdog' : `exit ${verify.code}`}; log: ${verifyLog})`);
  }
  gate.blender_version = report.blender;

  // The fields the USD/GLB verify gate already compares (usd-gate.js) — the pack's geometry
  // is unscaled in Blender (unit DISPLAY scale only), so metres-per-unit is 1 here …
  const common = compareUsdGate({
    exported: { triangles: pack.pack.glb.triangles, nodes: pack.pack.glb.mesh_nodes, size_units: pack.pack.bounds.size, meters_per_unit: 1, ...(pack.pack.glb.textures ? { textures: pack.pack.glb.textures } : {}) },
    blender: report,
  });
  // … plus what only a pack declares (blender-gate.js).
  const packCmp = compareBlenderPack({ pack: pack.pack, report });
  gate.compare = { common, pack: packCmp };
  gate.ok = common.ok && packCmp.ok;
  for (const [k, c] of Object.entries(common.checks)) log(`  ${c.ok === null ? '·' : c.ok ? '✓' : '✗'} ${k}: expected ${JSON.stringify(c.expected)} got ${JSON.stringify(c.got)}`);
  for (const [k, c] of Object.entries(packCmp.checks)) log(`  ${c.ok === null ? '·' : c.ok ? '✓' : '✗'} ${k}: expected ${JSON.stringify(c.expected)} got ${JSON.stringify(c.got)}${c.missing?.length ? ` missing ${c.missing.slice(0, 5).join(',')}` : ''}`);
  for (const d of packCmp.drift.slice(0, 5)) log(`    drift ${d.name}: expected ${JSON.stringify(d.expected)} got ${JSON.stringify(d.got)}`);

  const stamp = { ref: args.ref, manifest_hash: pack.manifestHash, base: pack.base, measured_at: new Date().toISOString(), blender: { bin: blenderBin, version: report.blender }, ok: gate.ok, compare: gate.compare, report };
  await fs.writeFile(path.join(outDir, 'mojulo-gate.json'), `${JSON.stringify(stamp, null, 2)}\n`);

  if (gate.ok && (args.force || !existsSync(blendBeside))) {
    await fs.copyFile(scratchBlend, blendBeside);
    gate.blend = blendBeside;
    log(`gate green — ${path.basename(blendBeside)} placed beside the pack`);
  } else if (gate.ok) {
    gate.blend = blendBeside;
    log(`gate green — ${path.basename(blendBeside)} already beside the pack (your pass in progress; --force replaces it)`);
  }
  if (!args['keep-scratch'] && gate.ok) await fs.rm(scratch, { recursive: true, force: true });
} else if (!args['no-gate']) {
  log('Blender not found — capability ladder rung 0, emitting the pack + guide only');
  gate = { skipped: true, reason: 'Blender not found — install Blender or set MOJULO_BLENDER (docs/local-blender-worker.md); the pack + ARTPASS-GUIDE.md are the no-Blender-here path' };
}

process.stdout.write(`${JSON.stringify({
  ok: gate.skipped ? true : !!gate.ok,
  ref: args.ref,
  dir: outDir,
  manifest_hash: pack.manifestHash,
  leg: pack.legVersion,
  base: pack.base,
  glb: pack.glbStats,
  landmark: pack.pack.landmark ? { name: pack.pack.landmark.name, asymmetry: pack.pack.landmark.asymmetry } : null,
  collections: Object.keys(pack.pack.collections).length,
  files: pack.written.length,
  total_bytes: pack.written.reduce((s, f) => s + f.bytes, 0),
  ledger: pack.ledger,
  gate,
  eyes_gate: `follow ${outDir}/ARTPASS-GUIDE.md — ① open → ② look (before any art hours) → ③ what is yours → ④ export_return.py → ⑤ bind_mesh_render; the guide is the no-Blender-here path too`,
}, null, 2)}\n`);
