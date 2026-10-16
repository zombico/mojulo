#!/usr/bin/env node
/**
 * export-desktop.mjs — the desktop handoff CLI. Thin front door over `export_game { target: 'desktop' }`; this
 * script adds the MACHINE GATE: the folder's main.js launched under Electron in its `--mojulo-smoke` mode
 * (lib/graph/game/desktop-gate.js), loading the shell and the first level hidden and reporting pages that failed,
 * console errors and files the folder lacks. Mirrors export-godot.mjs / export-unity.mjs: env-located binary,
 * stdout-JSON handback, stderr logs.
 *
 * export_game runs the same gate itself when lib/workers/find.js finds Electron (answered as `desktop.smoke`); this
 * script is the shell's way to run it, with an explicit --electron or none (--no-gate).
 *
 * Rung 0 (no Electron here): emit-only. The folder plays after `npm install && npm start`; the gate says why it
 * skipped. mojulo never installs Electron.
 *
 * Usage (from control/, repo-dev sets MOJULO_DATA_DIR/MOJULO_OUTCOMES_DIR):
 *   node scripts/export-desktop.mjs --ref <game ref>
 *   node scripts/export-desktop.mjs --ref <ref> --electron /path/to/electron
 *   node scripts/export-desktop.mjs --ref <ref> --no-gate
 * Env: MOJULO_ELECTRON (the binary; else the folder's node_modules/.bin/electron, else `electron` on PATH),
 *      MOJULO_SMOKE_SETTLE_MS (per page, default 4000), MOJULO_SMOKE_TIMEOUT_MS (default 90000).
 */
import { parseArgs } from 'node:util';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findElectron } from '../lib/workers/find.js';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

const { values: args } = parseArgs({ options: {
  ref: { type: 'string' },
  electron: { type: 'string' },
  'no-gate': { type: 'boolean', default: false },
} });

function fail(msg) { process.stdout.write(`${JSON.stringify({ ok: false, error: msg })}\n`); process.exit(1); }
const log = (msg) => process.stderr.write(`[export-desktop] ${msg}\n`);

if (!args.ref) fail('need --ref <game sketch>');

register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
resolveMojuloPaths();
const { exportGameHandler } = await import('@/lib/mcp/tools/export-game');
const { runDesktopGate, smokePages } = await import('../lib/graph/game/desktop-gate.js');

let result;
try {
  // the tool's own smoke is skipped here: this script runs it below, with --electron and --no-gate
  result = await exportGameHandler({ ref: args.ref, target: 'desktop' }, {}, { smoke: false });
} catch (e) {
  fail(e?.message ?? String(e));
}
log(`emitted ${result.files.length} files → ${result.dir}`);

let gate = { skipped: true, reason: '--no-gate' };
if (!args['no-gate']) {
  const electron = args.electron || findElectron(undefined, { dir: result.dir });
  const pages = smokePages(result.files);
  if (electron) log(`gate: ${electron} over ${pages.join(', ')}`);
  gate = await runDesktopGate({ dir: result.dir, electron, pages, log });
  if (!gate.ran) gate = { skipped: true, reason: gate.skipped };
}

process.stdout.write(`${JSON.stringify({
  ok: gate.skipped ? true : gate.ok === true,
  ref: args.ref,
  dir: result.dir,
  files: result.files.length,
  total_bytes: result.total_bytes,
  desktop: result.desktop,
  gate,
  eyes_gate: `cd ${result.dir} && npm install && npm start, then play a level; the gate saw pages load, not how they look`,
}, null, 2)}\n`);
