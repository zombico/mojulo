#!/usr/bin/env node
/**
 * slice-print.mjs — the print handoff's MACHINE GATE (interchange-seams.plan.md
 * seam 1b). Exports a sketch as 3MF (or takes an existing 3MF), hands it to a
 * local slicer headless, and stamps what the slice MEASURED beside the file as
 * `mojulo-print-gate.json`: does it slice, printed size as the slicer sees it
 * (vs mojulo's declared size — the unit-slip check), manifold/parts from
 * `--info`, estimated time, filament, supports, layers from the G-code ledger.
 *
 * Same posture as blender-bake.mjs / export-unity.mjs: the slicer is
 * operator-hosted, located by env or the macOS app bundle, never a dependency.
 * No slicer ⇒ capability rung 0: the 3MF + closure audit ship, the gate says
 * why it skipped. The gate is ADVISORY — it reports and stamps; whether the
 * part is fit to print is the operator's call (docs/bicycles.md).
 *
 * Usage (from control/, repo-dev sets MOJULO_DATA_DIR/MOJULO_OUTCOMES_DIR):
 *   node scripts/slice-print.mjs --ref sk_foo                  # export 3MF + slice
 *   node scripts/slice-print.mjs --ref sk_foo --target-mm 80   # fit-to-size first
 *   node scripts/slice-print.mjs --3mf path/to/model.3mf       # slice an existing file
 *   node scripts/slice-print.mjs --ref sk_foo --no-gate        # export only
 *   node scripts/slice-print.mjs --ref sk_foo --profile my.ini # PrusaSlicer config bundle
 *   node scripts/slice-print.mjs --ref sk_foo --supports       # ask for support material
 *   node scripts/slice-print.mjs --ref sk_foo --center 125,105 # place on the bed here (default: the profile's bed centre, else 100,100)
 * Env: MOJULO_SLICER (binary; else PATH `prusa-slicer` / `superslicer`, then
 *      the /Applications bundles), MOJULO_SLICER_PROFILE (default --profile),
 *      MOJULO_SLICER_TIMEOUT_MS (watchdog, default 10 min).
 */
import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

const { values: args } = parseArgs({ options: {
  ref: { type: 'string' },
  '3mf': { type: 'string' },
  scale: { type: 'string' },
  'target-mm': { type: 'string' },
  profile: { type: 'string' },
  supports: { type: 'boolean', default: false },
  'no-gate': { type: 'boolean', default: false },
  slicer: { type: 'string' },
  center: { type: 'string' },     // X,Y on the bed; a mojulo 3MF sits around its own origin, so the slicer must be told where the bed is
} });

function fail(msg) { process.stdout.write(`${JSON.stringify({ ok: false, error: msg })}\n`); process.exit(1); }
const log = (msg) => process.stderr.write(`[slice-print] ${msg}\n`);

if (!args.ref && !args['3mf']) fail('need --ref <sketch> or --3mf <file>');

register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
resolveMojuloPaths();
const { findSlicer, parseGcodeHeader, parseSlicerInfo, summarizePrintGate, bedCenterFromProfile, sliceFailureReason, DEFAULT_BED_CENTER, orcaProfileFiles, orcaSliceArgs, parseOrcaGcodeHeader } = await import('@/lib/graph/scene/print-gate.js');

// ── 1. the file: export via the same handler the MCP tool uses, or take one ──
let file; let exported = null;
if (args.ref) {
  const { exportModelHandler } = await import('@/lib/mcp/tools/sketch-model-export.js');
  const input = { ref: args.ref, format: '3mf' };
  if (args.scale) input.scale = Number(args.scale);
  if (args['target-mm']) input.target_mm = Number(args['target-mm']);
  try { exported = await exportModelHandler(input); } catch (e) { fail(e?.message ?? String(e)); }
  if (!exported.ok) fail(exported.reason || 'sketch has no printable geometry');
  file = exported.path;
  log(`exported ${file} — ${exported.size_mm.join(' × ')} mm, profile ${exported.print_profile}, closure ${exported.closure.audited ? (exported.closure.closed ? 'closed' : `${exported.closure.holes} open rim(s)`) : 'not audited'}`);
} else {
  file = path.resolve(args['3mf']);
  if (!existsSync(file)) fail(`no such file: ${file}`);
}
const dir = path.dirname(file);
const gatePath = path.join(dir, 'mojulo-print-gate.json');

// ── 2. the slicer ───────────────────────────────────────────────────────────
const which = (name) => {
  const r = spawnSync('which', [name], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
};
const slicer = args.slicer ? { id: 'custom', family: 'prusa', bin: args.slicer } : findSlicer({ env: process.env, exists: existsSync, which });

const WATCHDOG_MS = Number(process.env.MOJULO_SLICER_TIMEOUT_MS || 10 * 60 * 1000);
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

let gate;
if (args['no-gate']) {
  gate = { skipped: true, reason: '--no-gate' };
} else if (!slicer) {
  log('no slicer found — capability rung 0, 3MF + closure audit only');
  gate = { skipped: true, reason: 'no slicer found (set MOJULO_SLICER, or install PrusaSlicer / SuperSlicer — verified; OrcaSlicer / Bambu Studio are driven with a machine+process --profile, unverified) — open the 3MF in the app' };
} else if (slicer.family === 'orca') {
  // OrcaSlicer / Bambu Studio (text-to-cad-seam T6): JSON profiles, no defaults, no --info.
  const profile = args.profile || process.env.MOJULO_SLICER_PROFILE || null;
  const listDir = (d) => { try { return statSync(d).isDirectory() ? readdirSync(d) : null; } catch { return null; } };
  const profiles = orcaProfileFiles(profile, { listDir });
  if (!profiles) {
    log(`${slicer.id} found at ${slicer.bin} — its CLI needs a machine + process profile; skipping the slice`);
    gate = { skipped: true, slicer: slicer.id, bin: slicer.bin, reason: `${slicer.id} needs --profile "machine.json;process.json[;filament.json]" (or a directory of them) — this family slices with no defaults; open ${file} in the app meanwhile` };
  } else {
    const sliceDir = path.join(dir, 'slicedata');
    await fs.rm(sliceDir, { recursive: true, force: true });
    await fs.rm(path.join(dir, 'sliced.3mf'), { force: true });
    const sargs = orcaSliceArgs({ file, outDir: dir, profiles, supports: !!args.supports });
    log(`machine gate — ${slicer.id} ${sargs.slice(0, 6).join(' ')} … (arranged onto the bed; flags per the Bambu Studio CLI wiki — unverified on this host)`);
    const slice = await run(slicer.bin, sargs);
    const sliceLog = path.join(dir, 'slice.log');
    await fs.writeFile(sliceLog, `$ ${slicer.bin} ${sargs.join(' ')}\n\n${slice.out}\n${slice.err}`);
    // the plate G-code lands under slicedata/ (plate_1.gcode); read the first one found
    let gcodePath = null; let gcodeParsed = null;
    try {
      const walk = (d) => { for (const n of readdirSync(d)) { const p = path.join(d, n); if (statSync(p).isDirectory()) { const r = walk(p); if (r) return r; } else if (/\.gcode$/i.test(n)) return p; } return null; };
      gcodePath = existsSync(sliceDir) ? walk(sliceDir) : null;
    } catch { gcodePath = null; }
    if (!slice.timedOut && slice.code === 0 && gcodePath) gcodeParsed = parseOrcaGcodeHeader(await fs.readFile(gcodePath, 'utf8'));
    const summary = summarizePrintGate({ info: null, gcode: gcodeParsed, exportSizeMm: exported?.size_mm ?? null });
    gate = {
      skipped: false,
      slicer: slicer.id,
      bin: slicer.bin,
      family: 'orca',
      verified: false,
      verify_note: 'orca-family flags follow the Bambu Studio CLI wiki (2026-09-08) and have not been run against a real install here; size_agrees is null (no --info twin) — read slice.log if anything looks off',
      profile: profile,
      slice_exit: slice.timedOut ? 'timeout' : slice.code,
      gcode: gcodePath,
      sliced_3mf: existsSync(path.join(dir, 'sliced.3mf')) ? path.join(dir, 'sliced.3mf') : null,
      log: sliceLog,
      reason: summary.sliced ? null : (slice.timedOut ? 'timeout' : sliceFailureReason(slice.out + slice.err)),
      ...summary,
    };
    if (!summary.sliced) {
      process.stderr.write((slice.err || slice.out).trim().split('\n').slice(-8).join('\n') + '\n');
      log(`machine gate FAILED: no plate G-code came out (${slice.timedOut ? `hung past the ${WATCHDOG_MS / 60000}min watchdog` : `exit ${slice.code}`}${gate.reason ? `, reason ${gate.reason}` : ''}) — see ${sliceLog}`);
    }
  }
} else if (slicer.family !== 'prusa') {
  log(`${slicer.id} found at ${slicer.bin} — its CLI is not wired; open the 3MF in the app for the eyes gate`);
  gate = { skipped: true, slicer: slicer.id, bin: slicer.bin, reason: `${slicer.id} CLI not wired — open ${file} in the app` };
} else {
  const profile = args.profile || process.env.MOJULO_SLICER_PROFILE || null;
  const load = profile ? ['--load', path.resolve(profile)] : [];
  const supports = args.supports ? ['--support-material'] : [];
  // Placement: the 3MF's objects sit around their own origin; PrusaSlicer reads that
  // literally and refuses ("outside of the print volume"). Centre on the bed — the
  // operator's --center, else the profile's bed_shape centre, else the CLI default bed.
  let center = null;
  if (args.center) { const c = args.center.split(',').map(Number); if (c.length !== 2 || c.some((n) => !Number.isFinite(n))) fail('--center wants X,Y in mm'); center = c; }
  else if (profile) center = bedCenterFromProfile(await fs.readFile(path.resolve(profile), 'utf8').catch(() => ''));
  if (!center) center = DEFAULT_BED_CENTER;
  const place = ['--center', `${center[0]},${center[1]}`];

  log(`machine gate — ${slicer.id} --info`);
  const info = await run(slicer.bin, ['--info', file]);
  const infoParsed = info.code === 0 ? parseSlicerInfo(info.out) : null;
  if (info.code !== 0) log(`--info exit ${info.code}: ${(info.err || info.out).trim().split('\n').slice(-3).join(' | ')}`);

  const gcodePath = path.join(dir, 'model.gcode');
  await fs.rm(gcodePath, { force: true });
  log(`machine gate — ${slicer.id} --export-gcode${profile ? ` (--load ${profile})` : ' (slicer defaults)'} --center ${center.join(',')}`);
  const slice = await run(slicer.bin, ['--export-gcode', ...load, ...supports, ...place, '--output', gcodePath, file]);
  const sliceLog = path.join(dir, 'slice.log');
  await fs.writeFile(sliceLog, `$ ${slicer.bin} --export-gcode ${load.join(' ')} ${supports.join(' ')} ${place.join(' ')} --output ${gcodePath} ${file}\n\n${slice.out}\n${slice.err}`);
  let gcodeParsed = null;
  if (!slice.timedOut && slice.code === 0 && existsSync(gcodePath)) {
    const g = await fs.readFile(gcodePath, 'utf8');
    gcodeParsed = parseGcodeHeader(g);
  }
  const summary = summarizePrintGate({ info: infoParsed, gcode: gcodeParsed, exportSizeMm: exported?.size_mm ?? null });
  gate = {
    skipped: false,
    slicer: slicer.id,
    bin: slicer.bin,
    profile: profile ? path.resolve(profile) : 'slicer defaults',
    info_exit: info.code,
    slice_exit: slice.timedOut ? 'timeout' : slice.code,
    gcode: gcodeParsed ? gcodePath : null,
    log: sliceLog,
    center_mm: center,
    reason: summary.sliced ? null : (slice.timedOut ? 'timeout' : sliceFailureReason(slice.out + slice.err)),
    ...summary,
  };
  if (!summary.sliced) {
    process.stderr.write((slice.err || slice.out).trim().split('\n').slice(-8).join('\n') + '\n');
    log(`machine gate FAILED: the slicer produced no G-code (${slice.timedOut ? `hung past the ${WATCHDOG_MS / 60000}min watchdog` : `exit ${slice.code}`}${gate.reason ? `, reason ${gate.reason}` : ''}) — see ${sliceLog}`);
    if (gate.reason === 'outside_print_volume') log(`the model (${exported?.size_mm ? exported.size_mm.join(' × ') + ' mm' : 'as exported'}) does not fit the ${profile ? 'profile' : 'default 200 mm'} bed/height — re-run with --target-mm <mm>, or --profile <your printer .ini> if the bed is larger`);
  } else if (summary.size_agrees === false) {
    log(`machine gate WARNING: slicer size ${infoParsed.size_mm.join(' × ')} mm ≠ declared ${exported.size_mm.join(' × ')} mm — a unit slip; check \`scale\` / \`units\``);
  }
}

// ── 3. stamp the gate beside the file (overwrite: it is a derived measurement) ──
const stamp = {
  file,
  ref: args.ref ?? null,
  measured_at: new Date().toISOString(),
  declared: exported ? { size_mm: exported.size_mm, scale: exported.scale, print_profile: exported.print_profile, closure: exported.closure, measure: exported.print_measure ?? null, advisories: exported.print_advisories ?? null, objects: exported.objects, items: exported.items, colors: exported.colors } : null,
  gate,
};
await fs.writeFile(gatePath, `${JSON.stringify(stamp, null, 2)}\n`);

process.stdout.write(`${JSON.stringify({
  ok: gate.skipped ? true : gate.sliced,
  ref: args.ref ?? null,
  file,
  gate_path: gatePath,
  declared: stamp.declared,
  gate,
  eyes_gate: `open ${file} in your slicer: the shells land at ${exported ? exported.size_mm.join(' × ') + ' mm' : 'the declared size'} as separate objects; merge, orient, hollow, and add supports there — fitness to print is yours to judge`,
}, null, 2)}\n`);
