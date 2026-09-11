#!/usr/bin/env node
/**
 * scad-gate.mjs — the OpenSCAD leg's MACHINE GATE (openscad-leg.plan.md phase 3).
 *
 * Exports a sketch as an OpenSCAD PROGRAM (or takes an existing .scad), renders it
 * headless, and stamps what the render MEASURED beside the file as `mojulo-scad-gate.json`:
 * does it parse and render at all, and does the solid OpenSCAD computed match the size (and
 * volume, when one was declared) that mojulo said it would.
 *
 * This is the phase that makes the transpiler falsifiable. Phase 1 claims a recipe became an
 * equivalent OpenSCAD program; nothing inside mojulo can check that, because the emitted file
 * is text and the solid exists only once OpenSCAD evaluates it. So: render, measure, compare
 * against the declaration.
 *
 * Same posture as slice-print.mjs / blender-bake.mjs: OpenSCAD is operator-hosted, located by
 * env or the macOS app bundle, never a dependency. No OpenSCAD ⇒ the .scad + its coverage
 * ledger still ship and the gate says why it skipped. ADVISORY — it reports and stamps;
 * whether the part is right is the operator's call (docs/bicycles.md).
 *
 * Triangle counts are deliberately never compared (plan decision 4) — OpenSCAD tessellates
 * exact solids by $fn while mojulo marched a grid, so agreement would be coincidence.
 *
 * Usage (from control/, repo-dev sets MOJULO_DATA_DIR/MOJULO_OUTCOMES_DIR):
 *   node scripts/scad-gate.mjs --ref sk_foo                    # export .scad + render + compare
 *   node scripts/scad-gate.mjs --ref sk_foo --target-mm 80     # fit-to-size first
 *   node scripts/scad-gate.mjs --scad path/to/model.scad       # render an existing file
 *   node scripts/scad-gate.mjs --ref sk_foo --no-gate          # export only
 *   node scripts/scad-gate.mjs --ref sk_foo --fn 128           # finer facets on curves
 *   node scripts/scad-gate.mjs --ref sk_foo --tolerance-mm 0.5 # a baked part sits ~half a cell in
 * Env: MOJULO_OPENSCAD (binary; else PATH `openscad`, then the /Applications bundle),
 *      MOJULO_OPENSCAD_TIMEOUT_MS (watchdog, default 10 min).
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
  scad: { type: 'string' },
  scale: { type: 'string' },
  'target-mm': { type: 'string' },
  'tolerance-mm': { type: 'string' },
  fn: { type: 'string' },
  'no-gate': { type: 'boolean', default: false },
  openscad: { type: 'string' },
} });

function fail(msg) { process.stdout.write(`${JSON.stringify({ ok: false, error: msg })}\n`); process.exit(1); }
const log = (msg) => process.stderr.write(`[scad-gate] ${msg}\n`);

if (!args.ref && !args.scad) fail('need --ref <sketch> or --scad <file>');

register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
resolveMojuloPaths();
const { findOpenscad, measureStl, compareScadGate } = await import('@/lib/graph/scene/scad-gate.js');

// ── 1. the file: export via the same handler the MCP tool uses, or take one ──
let file; let exported = null;
if (args.ref) {
  const { exportModelHandler } = await import('@/lib/mcp/tools/sketch-model-export.js');
  const input = { ref: args.ref, format: 'scad' };
  if (args.scale) input.scale = Number(args.scale);
  if (args['target-mm']) input.target_mm = Number(args['target-mm']);
  try { exported = await exportModelHandler(input); } catch (e) { fail(e?.message ?? String(e)); }
  if (!exported.ok) fail(exported.reason || 'sketch has no exportable geometry');
  file = exported.path;
  const cov = exported.scad;
  log(`exported ${file} — ${cov.exact} term(s) exact, ${cov.baked} baked, ${cov.variables} dial(s), mm_per_unit ${cov.mm_per_unit}`);
  if (cov.baked) log(`baked: ${cov.terms.filter((t) => t.status !== 'exact').map((t) => `${t.at} (${t.what})`).join(', ')}`);
} else {
  file = path.resolve(args.scad);
  if (!existsSync(file)) fail(`no such file: ${file}`);
}
const dir = path.dirname(file);
const gatePath = path.join(dir, 'mojulo-scad-gate.json');

// ── 2. the binary ───────────────────────────────────────────────────────────
const which = (name) => {
  const r = spawnSync('which', [name], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
};
const scad = args.openscad
  ? { id: 'custom', bin: args.openscad }
  : findOpenscad({ env: process.env, exists: existsSync, which });

const WATCHDOG_MS = Number(process.env.MOJULO_OPENSCAD_TIMEOUT_MS || 10 * 60 * 1000);
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
} else if (!scad) {
  log('no OpenSCAD found — the .scad and its coverage ledger ship, unrendered');
  gate = {
    skipped: true,
    reason: 'no OpenSCAD found (set MOJULO_OPENSCAD, or install OpenSCAD — `brew install --cask openscad`, or openscad.org) — open the .scad in the app meanwhile: F5 previews, F6 renders, then export STL from there',
  };
} else {
  const stlPath = path.join(dir, 'model.scad-gate.stl');
  const renderLog = path.join(dir, 'mojulo-scad-gate.log');
  log(`machine gate — ${scad.id} rendering ${path.basename(file)}`);
  const sargs = ['-o', stlPath];
  if (args.fn) sargs.push('-D', `$fn=${Number(args.fn)}`);
  sargs.push(file);
  const r = await run(scad.bin, sargs);
  await fs.writeFile(renderLog, `$ ${scad.bin} ${sargs.join(' ')}\n\n${r.out}\n${r.err}`);

  let measured = null;
  if (!r.timedOut && r.code === 0 && existsSync(stlPath)) {
    measured = measureStl(await fs.readFile(stlPath));
  }
  const declared = exported
    ? { size_mm: exported.size_mm ?? null, volume_mm3: exported.union?.volume_mm3 ?? null }
    : {};
  const verdict = measured
    ? compareScadGate({ declared, measured, tolerance_mm: args['tolerance-mm'] ? Number(args['tolerance-mm']) : null })
    : null;

  gate = {
    skipped: false,
    openscad: scad.id,
    bin: scad.bin,
    exit: r.timedOut ? 'timeout' : r.code,
    rendered: !!measured,
    stl: measured ? stlPath : null,
    log: renderLog,
    reason: measured ? null : (r.timedOut ? `hung past the ${WATCHDOG_MS / 60000}min watchdog` : `OpenSCAD exit ${r.code} — see ${renderLog}`),
    measured: measured ? { triangles: measured.triangles, size_mm: measured.bounds.size.map((v) => Math.round(v * 1000) / 1000), volume_mm3: Math.round(measured.volume * 100) / 100 } : null,
    ...(verdict ? { verdict } : {}),
  };

  if (!measured) {
    process.stderr.write(`${(r.err || r.out).trim().split('\n').slice(-8).join('\n')}\n`);
    log(`machine gate FAILED: OpenSCAD produced no STL (${gate.reason}) — see ${renderLog}`);
  } else if (verdict.agrees) {
    log(`machine gate GREEN: rendered ${gate.measured.size_mm.join(' × ')} mm, agrees with the declared size${verdict.volume ? ` and volume (${gate.measured.volume_mm3} mm³)` : ''}`);
  } else {
    const off = (verdict.size?.axes || []).filter((a) => !a.agrees).map((a) => `${a.axis}: declared ${a.declared} vs rendered ${a.measured} (Δ${a.delta} > ${a.limit})`);
    log(`machine gate DISAGREES: ${off.length ? off.join('; ') : verdict.size?.reason || 'see the stamp'}${verdict.volume && !verdict.volume.agrees ? `; volume declared ${verdict.volume.declared} vs rendered ${verdict.volume.measured} mm³` : ''}`);
    if (exported?.scad?.baked) log('note: this part contains BAKED terms — a polygonized field surface sits up to about half a grid cell inside the ideal solid, so pass --tolerance-mm for a fair comparison');
  }
}

// ── 3. stamp the gate beside the file (overwrite: it is a derived measurement) ──
const stamp = {
  file,
  ref: args.ref ?? null,
  measured_at: new Date().toISOString(),
  declared: exported
    ? { size_mm: exported.size_mm ?? null, scale: exported.scale, print_profile: exported.print_profile, coverage: exported.scad }
    : null,
  gate,
};
await fs.writeFile(gatePath, `${JSON.stringify(stamp, null, 2)}\n`);

process.stdout.write(`${JSON.stringify({
  ok: gate.skipped ? true : gate.rendered,
  ref: args.ref ?? null,
  file,
  gate_path: gatePath,
  declared: stamp.declared,
  gate,
  eyes_gate: `open ${file} in OpenSCAD (F5 preview, F6 render): confirm the bores have SHARP lips where the recipe rounds them, that the variables at the head drive what you expect, and that any baked polyhedron() sits correctly against the exact geometry around it — the recipe stays the source, this file is a snapshot`,
}, null, 2)}\n`);
