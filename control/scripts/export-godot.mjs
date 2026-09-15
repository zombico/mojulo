#!/usr/bin/env node
/**
 * export-godot.mjs — the Godot handoff CLI (godot-handoff.plan.md G1 + game
 * scope + G6 kernel). Thin front door over the shared assembly engine
 * (lib/graph/scene/godot-pack.js — also behind export_game
 * { target: 'godot' }); this script adds the MACHINE GATE: headless import
 * ×2, a one-frame run of every scene (import compiles no GDScript, and Godot
 * exits 0 even on script load failure — the gate greps the log), the
 * materials + locomotion probes (scene packs) or the replay probe (arcade
 * packs: pixelizer games, godot-arcade.js), and the optional --web build. Mirrors the local-worker posture of
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
  posture: { type: 'string' },   // greybox|final — operator-declared handoff posture (engine-score.js)
  web: { type: 'boolean', default: false },
  'no-gate': { type: 'boolean', default: false },
  'no-clips': { type: 'boolean', default: false },
  lit: { type: 'boolean', default: false },   // the LIT handoff: PBR materials over an unshaded base (lit-handoff.plan.md)
} });

function fail(msg) { process.stdout.write(`${JSON.stringify({ ok: false, error: msg })}\n`); process.exit(1); }
const log = (msg) => process.stderr.write(`[export-godot] ${msg}\n`);

if (!args.ref) fail('need --ref <world or game sketch>');
const godotBin = args.godot || GODOT;

register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
resolveMojuloPaths();
const { SketchRepository } = await import('@/lib/db/repositories/sketches');
const { buildGodotWorldPack, buildGodotGamePack } = await import('@/lib/graph/scene/godot-pack.js');
const { compareShading, declaredShading, sumDeclared } = await import('@/lib/graph/scene/materials-gate.js');
const { parseReplayLine, compareReplay, parsePerfLine } = await import('@/lib/graph/pixelizer/brickster-replay.js');

const sketch = SketchRepository.getByRef(args.ref);
if (!sketch) fail(`sketch '${args.ref}' not found`);
const isGame = sketch.manifest?.kind === 'game';

const outcomes = process.env.MOJULO_OUTCOMES_DIR || path.join(process.cwd(), 'data', 'outcomes');
const outDir = args.out ? path.resolve(args.out) : path.join(outcomes, args.ref, 'godot');
const clips = args['no-clips'] ? null : '_all';

let pack;
try {
  pack = isGame
    ? await buildGodotGamePack({ ref: args.ref, outDir, clips, posture: args.posture ?? null, lit: args.lit, log })
    : await buildGodotWorldPack({ ref: args.ref, outDir, clips, posture: args.posture ?? null, lit: args.lit, log });
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
  // ARCADE scope (godot-arcade.js): no GLB, no walker — the one rung that
  // matters is the REPLAY probe. The kernel replays the pack's seeded action
  // script through its reducer port and prints a [mojulo-replay] digest; the
  // JS reducer's outcome rides the pack as probe/replay.json.expected. Every
  // field must match. [mojulo-perf] is stamped advisory (CPU-side only:
  // headless has no renderer).
  if (pack.scope === 'arcade') {
    log(`machine gate — replay probe (${pack.replay.steps} actions through kernel/${pack.reducer}.gd)`);
    const run = await runGodot(['--headless', '--path', outDir, '--', `--mojulo-replay=res://${pack.replay.file}`]);
    const text = run.out + run.err;
    const got = parseReplayLine(text);
    const cmp = compareReplay(pack.replay.expected, got);
    const ran = run.code === 0 && !SCRIPT_ERR.test(text) && !!got;
    gate.replay_probe = { ok: ran && cmp.ok, ran, steps: pack.replay.steps, checks: cmp.checks, perf: parsePerfLine(text) };
    for (const [k, c] of Object.entries(cmp.checks)) log(`  ${c.ok ? '✓' : '✗'} ${k}: ${c.ok ? String(c.expected).slice(0, 40) : `expected ${c.expected} got ${c.got}`}`);
    if (!gate.replay_probe.ok) {
      process.stderr.write(text);
      fail(`machine gate FAILED: replay probe — ${JSON.stringify({ ran, checks: cmp.checks })}`);
    }
  }
  // interchange-next.plan.md N5: the MATERIALS probe — did the importer build the
  // shading the GLB DECLARES? KHR_materials_unlit on a primitive ⇒ an UNSHADED
  // surface, a real pbrMetallicRoughness ⇒ a shaded one, KHR_lights_punctual ⇒
  // Light3D nodes. --lit only labels the run (an unlit export may carry a PBR
  // emissive disc; a lit one keeps its unlit stickers). Gate-only script
  // (scripts/godot-materials-probe.gd); nothing of it rides the pack.
  if (pack.scope !== 'arcade') {
    const glbs = pack.scope === 'game'
      ? pack.sceneChecks.map((scene) => scene.replace(/level\.tscn$/, 'model.glb'))
      : ['res://model.glb'];
    const declared = sumDeclared(await Promise.all(glbs.map(async (g) => declaredShading(await fs.readFile(path.join(outDir, g.replace(/^res:\/\//, '')))))));
    log(`machine gate — materials probe (${args.lit ? 'lit' : 'unlit'} export; file declares ${declared.pbr_primitives} shaded + ${declared.unlit_primitives} unlit primitives, ${declared.lights} lights)`);
    const probe = await runGodot(['--headless', '--path', outDir, '--script', path.join(here, 'godot-materials-probe.gd'), '--', ...glbs]);
    const line = /\[mojulo-materials\] (.*)/.exec(probe.out + probe.err);
    const built = {};
    if (line) for (const kv of line[1].trim().split(/\s+/)) { const [k, v] = kv.split('='); built[k] = Number.isFinite(+v) ? +v : v; }
    const cmp = compareShading({ declared, built, unit: 'primitives' });
    const ran = probe.code === 0 && !!line && !built.error;
    gate.materials = { ok: ran && cmp.ok, ran, mode: args.lit ? 'lit' : 'unlit', declared, built, checks: cmp.checks };
    for (const [k, c] of Object.entries(cmp.checks)) log(`  ${c.ok === null ? '·' : c.ok ? '✓' : '✗'} ${k}: expected ${c.expected} got ${c.got}`);
    if (!gate.materials.ok) {
      process.stderr.write(probe.out + probe.err);
      fail(`machine gate FAILED: materials probe — ${JSON.stringify(gate.materials)}`);
    }
  }
  // walking-suit-backport G-P: the headless locomotion probe — the one
  // machine rung for MOTION that only Godot can run (physics without a
  // window). Every scene whose player carries a locomotion row is run with
  // the walker's forward input held for PROBE_FRAMES physics frames; the
  // kernel prints a [mojulo-dump] ledger at t=1 and t=N. Asserted: the
  // walker travelled, the suit sits on the walker's feet, it is upright,
  // and the walk cycle is the current animation while moving (clips
  // resolved ⇒ clips bound: an unresolved name leaves anim empty).
  const PROBE_FRAMES = 120;
  const probes = pack.scope === 'arcade' ? []
    : pack.scope === 'game'
      ? pack.sceneChecks.map((scene) => ({ scene, scoreFile: path.join(outDir, scene.replace(/^res:\/\//, '').replace(/level\.tscn$/, 'score.json')) }))
      : [{ scene: 'res://level.tscn', scoreFile: path.join(outDir, 'score.json') }];
  gate.locomotion_probe = {};
  for (const { scene, scoreFile } of probes) {
    const score = JSON.parse(await fs.readFile(scoreFile, 'utf8').catch(() => 'null'));
    const player = score?.entities?.find((e) => e?.id === score?.player);
    const loco = player?.locomotion;
    if (!loco || !(loco.idle || loco.walk)) continue;
    log(`machine gate — locomotion probe: ${scene} (auto-walk ${PROBE_FRAMES} frames)`);
    const run = await runGodot(['--headless', '--path', outDir, scene, '--', '--mojulo-autowalk', `--mojulo-frames=${PROBE_FRAMES}`]);
    const text = run.out + run.err;
    const dumps = text.split('\n').filter((l) => l.startsWith('[mojulo-dump] t='));
    const parse = (l) => {
      const num = (k) => { const m = new RegExp(`${k}=\\(([-\\d.]+),([-\\d.]+),([-\\d.]+)\\)`).exec(l); return m ? [+m[1], +m[2], +m[3]] : null; };
      const str = (k) => { const m = new RegExp(`${k}=(\\S*)`).exec(l); return m ? m[1] : null; };
      const suitM = /suit=([^(\s]+)\(([-\d.]+),([-\d.]+),([-\d.]+)\)/.exec(l);
      return { walker: num('walker'), suit: suitM ? [+suitM[2], +suitM[3], +suitM[4]] : null, upright: +(str('upright') ?? 'NaN'), anim: str('anim') ?? '', moving: str('moving') === 'true' };
    };
    const first = dumps[0] ? parse(dumps[0]) : null;
    const last = dumps[1] ? parse(dumps[1]) : null;
    const planar = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
    const wantWalk = loco.walk ? String(loco.walk).replace(/[:.@/"%]/g, '_') : null;
    const checks = {
      ran: run.code === 0 && !SCRIPT_ERR.test(text) && !!first && !!last,
      walker_moved: !!(first && last) && planar(first.walker, last.walker) > 1.0,
      suit_on_feet: !!(last?.suit) && planar(last.suit, last.walker) < 0.05,
      suit_upright: !!last && last.upright > 0.9,
      walk_playing: !!last && last.moving && (wantWalk ? last.anim === wantWalk : last.anim !== ''),
    };
    const ok = Object.values(checks).every(Boolean);
    gate.locomotion_probe[scene] = { ok, ...checks, travelled_m: first && last ? +planar(first.walker, last.walker).toFixed(2) : null, perf: parsePerfLine(text), dump: dumps };
    if (!ok) {
      process.stderr.write(text);
      fail(`machine gate FAILED: locomotion probe '${scene}' — ${JSON.stringify(checks)}`);
    }
  }
  if (!Object.keys(gate.locomotion_probe).length) gate.locomotion_probe = { skipped: pack.scope === 'arcade' ? 'arcade scope — the replay probe is the rung' : 'no player locomotion row' };
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
  ...(pack.scope === 'arcade' ? { reducer: pack.reducer } : {}),
  eyes_gate: `run: ${godotBin} --path ${outDir}${pack.scope === 'arcade' ? ' — Enter starts; arrows move, Space hard-drops, C holds; the groove should loop and SFX fire on lock/rotate/clear/game over' : pack.scope === 'game' ? ' — pick a level from the menu; completing it unlocks the next' : ' — walk with WASD + mouse'}${gate.locomotion_probe && !gate.locomotion_probe.skipped ? '; the player suit should follow you in third person, walk while moving, idle when still, upright, turning with the mouse' : ''}`,
}, null, 2)}\n`);
