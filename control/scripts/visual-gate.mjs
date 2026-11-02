#!/usr/bin/env node
/**
 * visual-gate.mjs — the engine handoff's visual gate (the machine gate, advisory): a level's shots (its camera markers,
 * its shoot plan's shots, any poses given) rendered on the World page in headless Chrome and in each engine on this
 * machine, through each adapter's own build of the level, scored per shot per engine (SSIM on luminance, mean CIEDE2000
 * ΔE, the worst region) and stamped: visual-gate.json and a self-contained contact sheet, visual-gate.html, the stills
 * beside them. It never refuses and never fails an export; an engine that is absent is skipped and says so. How the
 * level looks is the eyes gate's, the operator's. lib/graph/scene/visual-gate.js (the scores, the report) and
 * visual-gate-run.js (the drivers).
 *
 * Usage (from control/, repo-dev sets MOJULO_DATA_DIR/MOJULO_OUTCOMES_DIR for --ref):
 *   node scripts/visual-gate.mjs --ref <level | game> [--engines godot,blender,unreal,unity] [--out <dir>]
 *   node scripts/visual-gate.mjs --fixture trail|bay|couch [--engines …] [--out <dir>]
 *   … --pose 'close:-5,-5,5.5:8,8,1.5:50'   a pose of its own (name:at:look:vfov in degrees), repeatable
 *   … --poses <poses.json>                   [{ name, pos, target, vfov }]
 *   … --no-fixture-poses                     a fixture's camera markers only
 *   … --shots island,close                   only the shots named
 *   … --json                                 the report on stdout
 * Default --out: the ref's outcome folder's visual-gate/ (a game's: each level's own), a fixture's under the temp dir.
 * Unreal and Unity take minutes each (an import, then the editor): pick engines with --engines.
 * Env: MOJULO_GODOT, MOJULO_BLENDER, MOJULO_UNREAL (UnrealEditor-Cmd), MOJULO_UNITY name the engines (else the usual
 * places, lib/workers/find.js); MOJULO_CHROMIUM a browser.
 */
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
const cwd0 = process.env.INIT_CWD || process.cwd();
process.chdir(path.resolve(here, '..'));

const { values: args } = parseArgs({ options: {
  ref: { type: 'string' }, fixture: { type: 'string' }, engines: { type: 'string' }, out: { type: 'string' },
  pose: { type: 'string', multiple: true }, shots: { type: 'string' }, poses: { type: 'string' }, 'no-fixture-poses': { type: 'boolean' }, json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} });
const usage = 'usage: node scripts/visual-gate.mjs --ref <level | game> | --fixture trail|bay|couch [--engines godot,blender,unreal,unity] [--out <dir>] [--pose name:x,y,z:x,y,z:vfov]… [--poses <file>] [--shots a,b] [--json]';
if (args.help || (!args.ref === !args.fixture)) { console.error(usage); process.exit(args.help ? 0 : 2); }

const { GATE_ENGINES, GATE_FIXTURES } = await import('@/lib/graph/scene/visual-gate.js');
const engines = args.engines ? args.engines.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : [...GATE_ENGINES];
const unknown = engines.filter((e) => !GATE_ENGINES.includes(e));
if (unknown.length) { console.error(`unknown engine${unknown.length > 1 ? 's' : ''} ${unknown.join(', ')}: ${GATE_ENGINES.join(', ')}`); process.exit(2); }

const num3 = (s) => { const v = String(s).split(',').map(Number); if (v.length !== 3 || !v.every(Number.isFinite)) throw new Error(`'${s}' is not x,y,z`); return v; };
const poses = [];
for (const p of args.pose ?? []) {
  const [name, at, look, vfov] = p.split(':');
  if (!at || !look || !Number.isFinite(Number(vfov))) { console.error(`--pose '${p}': name:x,y,z:x,y,z:vfov`); process.exit(2); }
  poses.push({ name, pos: num3(at), target: num3(look), vfov: Number(vfov) });
}
if (args.poses) poses.push(...JSON.parse(readFileSync(path.resolve(cwd0, args.poses), 'utf8')));

const { runVisualGate } = await import('@/lib/graph/scene/visual-gate-run.js');
const log = args.json ? (m) => console.error(`[visual-gate] ${m}`) : (m) => console.log(`[visual-gate] ${m}`);
const outArg = args.out ? path.resolve(cwd0, args.out) : null;

// the levels to gate: a fixture, a level, or a game's levels each
let levels;
if (args.fixture) {
  const F = GATE_FIXTURES[args.fixture];
  if (!F) { console.error(`no fixture '${args.fixture}': ${Object.keys(GATE_FIXTURES).join(', ')}`); process.exit(2); }
  levels = [{ sketch: F.sketch, out: outArg ?? path.join(os.tmpdir(), 'mojulo-visual-gate', args.fixture), poses: [...(args['no-fixture-poses'] ? [] : F.poses), ...poses] }];
} else {
  const { resolveMojuloPaths } = await import('./mojulo-paths.mjs');
  resolveMojuloPaths();
  const { SketchRepository } = await import('@/lib/db/repositories/sketches');
  const { outcomeDirFor } = await import('@/lib/outcomes-paths');
  const sk = SketchRepository.getByRef(args.ref);
  if (!sk || !sk.manifest) { console.error(`sketch '${args.ref}' not found`); process.exit(2); }
  if (sk.manifest.kind === 'game') {
    const { normalizeGameManifest } = await import('@/lib/graph/game/game-manifest.js');
    const refs = [...new Set((normalizeGameManifest(sk.manifest).levels ?? []).map((lv) => lv.ref).filter((r) => typeof r === 'string'))];
    levels = refs.map((r) => ({ sketch: SketchRepository.getByRef(r), out: outArg ? path.join(outArg, r) : path.join(outcomeDirFor(r), 'visual-gate'), poses })).filter((l) => l.sketch?.manifest);
    log(`game ${args.ref}: ${levels.length} level${levels.length === 1 ? '' : 's'} (${levels.map((l) => l.sketch.ref).join(', ')})`);
  } else levels = [{ sketch: sk, out: outArg ?? path.join(outcomeDirFor(args.ref), 'visual-gate'), poses }];
}

const reports = [];
for (const L of levels) {
  log(`${L.sketch.ref ?? L.sketch.title}: engines ${engines.join(', ')} → ${L.out}`);
  const { report, json, html } = await runVisualGate(L.sketch, { engines, out: L.out, poses: L.poses, only: args.shots ? args.shots.split(',').map((x) => x.trim()) : null, log });
  reports.push(report);
  log(`report ${json}`);
  log(`contact sheet ${html}`);
}
if (args.json) console.log(JSON.stringify(reports.length === 1 ? reports[0] : reports));
// (advisory: the gate stamps what it saw and exits 0 whatever the scores; only a crash exits otherwise)
process.exit(0);
