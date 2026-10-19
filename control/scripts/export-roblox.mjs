#!/usr/bin/env node
/**
 * export-roblox.mjs — the Roblox handoff CLI. Thin front door over lib/graph/scene/roblox-pack.js (also behind
 * export_game { target: 'roblox' }); this script adds the MACHINE GATE (lib/graph/scene/roblox-gate.js): Rojo builds
 * the place beside the project (<ref>.rbxl), and Lune opens it, checks its tree, compiles its scripts and plays every
 * level from the place's own kernel and data over the track the web recorded, frame by frame against the web.
 *
 * Capability ladder rung 0 (no Rojo or Lune): emit-only, the gate says why it skipped. Eyes: none (play it in Studio).
 *
 * Usage (from control/, repo-dev sets MOJULO_DATA_DIR/MOJULO_OUTCOMES_DIR):
 *   node scripts/export-roblox.mjs --ref <game>
 *   node scripts/export-roblox.mjs --ref <game> --no-gate     # emit only
 * Env: MOJULO_ROJO, MOJULO_LUNE (else PATH, ~/.rokit, ~/.aftman, ~/.foreman, ~/.cargo: lib/workers/find.js).
 * Prints one JSON line: { ok, ref, dir, files, verdict, lost, gate }.
 */
import { parseArgs } from 'node:util';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const { values: args } = parseArgs({ options: {
  ref: { type: 'string' },
  out: { type: 'string' },
  posture: { type: 'string' },
  'no-gate': { type: 'boolean', default: false },
} });

function fail(msg) { process.stdout.write(`${JSON.stringify({ ok: false, error: msg })}\n`); process.exit(1); }
const log = (msg) => process.stderr.write(`[export-roblox] ${msg}\n`);
if (!args.ref) fail('need --ref <game sketch>');

register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
resolveMojuloPaths();
const { buildRobloxGamePack } = await import('@/lib/graph/scene/roblox-pack.js');
const { robloxGate } = await import('@/lib/graph/scene/roblox-gate.js');
const { exportVerdict } = await import('@/lib/graph/scene/engine-portability.js');

const outcomes = process.env.MOJULO_OUTCOMES_DIR || path.join(process.cwd(), 'data', 'outcomes');
const outDir = args.out ? path.resolve(args.out) : path.join(outcomes, args.ref, 'roblox');
let pack;
try {
  pack = await buildRobloxGamePack({ ref: args.ref, outDir, posture: args.posture ?? null, log });
} catch (e) {
  fail(e?.message ?? String(e));
}
log(`emitted ${pack.written.length} files → ${outDir}`);
const stamp = exportVerdict(pack.portability, 'roblox');

let gate = { ran: false, skipped: '--no-gate' };
if (!args['no-gate']) {
  gate = robloxGate({ dir: outDir, ref: args.ref, payloads: pack.payloads });
  if (gate.ran) {
    for (const l of gate.levels) log(`${l.ref}: ${l.frames} frames ${l.equal ? 'equal to the web' : `part at frame ${l.first?.frame}`} (web outcome: ${l.outcome ?? 'none'})`);
    for (const p of gate.problems) log(`problem: ${p}`);
  } else log(`gate skipped: ${gate.skipped}`);
}
const passed = !gate.ran || (gate.problems.length === 0 && gate.kernel?.equal && gate.levels.every((l) => l.equal));
const levels = gate.levels?.map(({ first, ...l }) => ({ ...l, ...(first ? { first: { frame: first.frame, web: first.web, engine: first.engine } } : {}) }));
process.stdout.write(`${JSON.stringify({ ok: passed, ref: args.ref, dir: outDir, files: pack.written.length, verdict: stamp.verdict, lost: stamp.lost, gate: { ...gate, ...(levels ? { levels } : {}) } })}\n`);
process.exit(passed ? 0 : 1);
