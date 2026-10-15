#!/usr/bin/env node
/**
 * godot-fixture-matrix.mjs — THE FIXTURE MATRIX: every cosmos fixture made into a real game, exported to Godot, and
 * played by script in both engines, so a hollow export is caught by playing it, never by reading a list.
 *
 * Per fixture (lib/graph/cosmos/fixtures.js), on the scratch data dir (MOJULO_DATA_DIR; never control/data):
 *   minted     design_game's quick path makes the game the fixture names (FIXTURE_QUICK below; a fixture the quick
 *              path cannot say is reported as not minted, with why)
 *   exports    the Godot pack is built (godot-pack.js), and its verdict stamped (engine-portability.js)
 *   imports    headless --import twice, then one frame of the level's scene, with no script error in the log
 *   win        the WIN script (level-equivalence.js winScript: steered toward the contract's audits in the web runtime,
 *              recorded as held input) ends the level in success on the web | in Godot (the same input, replayed)
 *   control    the STAY-PUT control (no input, as long) ends nothing on the web | in Godot
 *   equal      both runs' frame keys equal, frame by frame (the first unequal frame and field otherwise)
 *
 * The first level of each game is played. Godot is required for the import, Godot and equal columns; without it
 * they read 'no godot' and the run says so.
 *
 *   node scripts/godot-fixture-matrix.mjs [--only id,id] [--seconds 120] [--out <dir>] [--json] [--keep]
 *   env: MOJULO_GODOT (the engine), MOJULO_DATA_DIR / MOJULO_OUTCOMES_DIR (a scratch dir)
 */
import { parseArgs } from 'node:util';
import { promises as fs, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { register } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// THE FIXTURES AS QUICK GAMES: the genre the cosmos fixture names, said in design_game's quick words (gameworld/quick.js,
// its genres gameworld/intent.js QUICK_GENRE). null: the quick path has no form for it (the reason is the matrix's row).
const HERO = { cast: 'male', gear: { right: { item: 'sword' } } };
export const FIXTURE_QUICK = Object.freeze({
  'dungeon-crawler': { goal: 'collect', pickup: 'key', hero: HERO, building: { use: 'crypt', seed: 2 } },
  collectathon: { goal: 'collect', pickup: 'coin', climb: true, hero: { cast: 'female' }, world: { style: { kit: 'isekai-meadow' } } },
  'top-down-adventure': { goal: 'reach', camera: 'top-down', hero: HERO },
  shooter: { goal: 'shoot' },
  jrpg: { goal: 'battle', hero: HERO },
  metroidvania: { goal: 'reach', camera: 'side', hero: HERO },
  'survival-horror': { goal: 'reach', camera: 'fixed', hero: HERO },
  'story-adventure': null,
  'arena-brawler': null,
  'pixel-puzzle': { goal: 'puzzle', camera: 'top-down', hero: HERO, world: { style: { pixel: 4 } } },
  stealth: { goal: 'sneak' },
  racing: { goal: 'race', ride: 'car' },
  'kart-racer': { goal: 'race', racers: 4, track: 'loop' },
  'arena-shooter': { goal: 'deathmatch', bots: 3, frags: 3 },
  'flight-sim': { goal: 'fly', craft: 'trainer' },
  'space-shooter': { goal: 'shoot', craft: 'fighter', foes: 3, airspace: { space: { asteroids: 'sparse' } } },
  'air-combat': { goal: 'shoot', craft: 'fighter', foes: 3 },
  rhythm: { goal: 'rhythm', camera: 'side', hero: HERO },
  roguelike: { goal: 'reach', run: 2, camera: 'top-down', hero: HERO },
  farming: { goal: 'farm', camera: 'top-down', hero: HERO },
  'tower-defense': { goal: 'defend', camera: 'top-down', hero: HERO },
  'block-puzzle': { goal: 'puzzle', camera: 'top-down', hero: HERO },
});
export const NOT_QUICK = Object.freeze({
  'story-adventure': 'the quick path has no talk, scenes or quests: a story game is written on the full rail (design_game world)',
  'arena-brawler': 'the quick path has no arena of hunting foes to fight in melee: an arena is written on the full rail',
});

const SCRIPT_ERR = /SCRIPT ERROR|Parse Error|Failed to load script|Cannot open file|Failed loading resource/;

function godot(bin, args, timeout = 600000) {
  const r = spawnSync(bin, args, { encoding: 'utf8', timeout, maxBuffer: 1 << 28 });
  return { code: r.status, text: `${r.stdout || ''}${r.stderr || ''}` };
}

/** One fixture through the matrix. `ctx`: { designGameHandler, SketchRepository, resolveWorldScene, buildGodotGamePack,
 * exportVerdict, L (level-equivalence), godotBin, out, seconds }. */
export async function fixtureRow(id, ctx) {
  const row = { id, minted: false, exports: null, verdict: null, imports: null, win: { web: null, godot: null }, control: { web: null, godot: null }, equal: null };
  const spec = FIXTURE_QUICK[id];
  if (!spec) { row.note = NOT_QUICK[id] ?? 'no quick form'; return row; }
  const ref = `fx-${id}`;
  const { world = {}, ...quick } = spec;
  try {
    if (!ctx.SketchRepository.getByRef(`${ref}-game`)) await ctx.designGameHandler({ quick: { ...quick, world: { id: ref, name: id, ...world } }, ref });
  } catch (e) { row.note = `mint failed: ${e.message.split('\n')[0]}`; return row; }
  const game = ctx.SketchRepository.getByRef(`${ref}-game`);
  if (!game) { row.note = 'mint made no game'; return row; }
  row.minted = true;
  const levelRef = game.manifest.levels?.[0]?.ref;
  row.level = levelRef;
  const packDir = path.join(ctx.out, id);
  let pack;
  try { pack = await ctx.buildGodotGamePack({ ref: `${ref}-game`, outDir: packDir }); }
  catch (e) { row.exports = false; row.note = `export failed: ${e.message.split('\n')[0]}`; return row; }
  row.exports = true;
  const stamp = ctx.exportVerdict(pack.portability);
  row.verdict = stamp.verdict;
  // the level's figures that ship skinned (IV1: a game pack's rigged figures, as a world pack's)
  row.skinned = pack.glbStats?.levels?.[levelRef]?.skinned ?? [];
  row.lost = stamp.lost;

  // the web: the win script steered and recorded, the control held still
  const { payload } = await ctx.resolveWorldScene(ctx.SketchRepository.getByRef(levelRef));
  const win = ctx.L.winScript(payload, { seconds: ctx.seconds });
  const still = win.frames.map(() => ({}));
  const control = ctx.L.playScript(payload, still);
  row.win.web = win.outcome === 'success';
  row.win.webAt = win.at;
  row.script = win.waypoints ? `walk ${win.waypoints} point${win.waypoints > 1 ? 's' : ''}` : win.idle ? `idle ${win.idle} s` : 'no audit to walk';
  row.control.web = !control.outcome;
  if (!ctx.godotBin) { row.imports = row.win.godot = row.control.godot = row.equal = 'no godot'; return row; }

  // Godot: import twice, a frame of the level, then the two scripts through the harness autoload
  godot(ctx.godotBin, ['--headless', '--path', packDir, '--import']);
  const second = godot(ctx.godotBin, ['--headless', '--path', packDir, '--import']);
  const frame = godot(ctx.godotBin, ['--headless', '--path', packDir, `res://levels/${levelRef}/level.tscn`, '--quit']);
  row.imports = second.code === 0 && existsSync(path.join(packDir, '.godot')) && frame.code === 0 && !SCRIPT_ERR.test(frame.text);
  if (!row.imports) row.importError = (SCRIPT_ERR.exec(frame.text) || [`exit ${frame.code}`])[0];
  await fs.mkdir(path.join(packDir, 'sim'), { recursive: true });
  await fs.copyFile(path.join(here, 'godot-level-sim.gd'), path.join(packDir, 'sim', 'godot-level-sim.gd'));
  const proj = await fs.readFile(path.join(packDir, 'project.godot'), 'utf8');
  if (!proj.includes('MojuloSim=')) await fs.writeFile(path.join(packDir, 'project.godot'), proj.replace('Game="*res://kernel/game.gd"', 'Game="*res://kernel/game.gd"\nMojuloSim="*res://sim/godot-level-sim.gd"'));
  const ids = ctx.L.keyEntities(payload);
  const feet = Object.fromEntries((payload.entities || []).filter((e) => ids.includes(e.id) && Number.isFinite(e.rule?.eye)).map((e) => [e.id, e.rule.eye]));
  const run = async (name, frames) => {
    const file = path.join(packDir, 'sim', `${name}.json`);
    await fs.writeFile(file, JSON.stringify({ ref: levelRef, frames, ids, feet }));
    const r = godot(ctx.godotBin, ['--headless', '--fixed-fps', '30', '--path', packDir, '--', `--mojulo-sim=${file}`]);
    const keys = [], states = [];
    for (const l of r.text.split('\n')) {
      const m = /^\[mojulo-sim\] (\d+) (\w+) (.*)$/.exec(l);
      if (m) { keys[+m[1]] = m[3]; states[+m[1]] = m[2]; }
    }
    const err = SCRIPT_ERR.exec(r.text);
    return { keys, states, error: err ? err[0] : r.code !== 0 ? `exit ${r.code}` : null };
  };
  const gw = await run('win', win.frames);
  const gc = await run('control', still);
  const ended = (states) => states.find((s) => s && s !== 'playing') ?? null;
  row.win.godot = ended(gw.states) === 'complete';
  row.control.godot = !ended(gc.states);
  if (gw.error || gc.error) row.godotError = gw.error || gc.error;
  // equal: the win run over its frames to the web's outcome (or all), and the control run
  const upto = (keys) => keys.slice(0, (win.at ?? win.frames.length - 1) + 1);
  const cw = ctx.L.compareKeys(upto(win.keys), upto(gw.keys));
  const cc = ctx.L.compareKeys(control.keys, gc.keys);
  row.equal = cw.equal && cc.equal;
  row.diverge = cw.first ? { run: 'win', ...cw.first } : cc.first ? { run: 'control', ...cc.first } : null;
  // how far apart at worst: one quantum and an equal bus is a quantum's edge, more is a divergence
  // both engines' keys beside the pack, to read a divergence frame by frame
  // (with --keep: a long run's keys run to hundreds of megabytes, so each run is written a key a line)
  if (row.diverge && ctx.keep) {
    for (const [name, keys] of [['win-web', upto(win.keys)], ['win-godot', upto(gw.keys)], ['control-web', control.keys], ['control-godot', gc.keys]]) await fs.writeFile(path.join(packDir, 'sim', `keys-${name}.txt`), keys.join('\n'));
    await fs.writeFile(path.join(packDir, 'sim', 'frames-win.json'), JSON.stringify(win.frames));
  }
  if (row.diverge) row.drift = ctx.L.keyDrift(...(cw.first ? [upto(win.keys), upto(gw.keys)] : [control.keys, gc.keys]));
  if (!ctx.keep) await fs.rm(path.join(packDir, '.godot'), { recursive: true, force: true });
  return row;
}

const yes = (v) => (v === true ? 'yes' : v === false ? 'NO' : v == null ? '—' : String(v));
export function formatMatrix(rows) {
  const head = ['fixture', 'minted', 'exports', 'verdict', 'imports', 'win web', 'win godot', 'ctl web', 'ctl godot', 'web-equal'];
  const lines = rows.map((r) => [r.id, yes(r.minted), yes(r.exports), r.verdict ?? '—', yes(r.imports), yes(r.win.web), yes(r.win.godot), yes(r.control.web), yes(r.control.godot), r.equal === true ? 'yes' : r.equal === false ? `NO (${r.diverge?.run} f${r.diverge?.frame} ${r.diverge?.field}${r.drift ? `; ${r.drift.maxQ === Infinity ? 'apart' : `≤${r.drift.maxQ}q`}${r.drift.busFrames ? `, bus ${r.drift.busFrames}f` : ''}` : ''})` : yes(r.equal)]);
  const w = head.map((h, i) => Math.max(h.length, ...lines.map((l) => String(l[i]).length)));
  const fmt = (l) => l.map((c, i) => String(c).padEnd(w[i])).join('  ');
  const notes = rows.filter((r) => r.note || r.importError || r.godotError).map((r) => `  ${r.id}: ${[r.note, r.importError && `import: ${r.importError}`, r.godotError && `godot: ${r.godotError}`].filter(Boolean).join('; ')}`);
  return [fmt(head), fmt(w.map((n) => '-'.repeat(n))), ...lines.map(fmt), ...(notes.length ? ['', 'notes:', ...notes] : [])].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values: args } = parseArgs({ options: { only: { type: 'string' }, seconds: { type: 'string', default: '120' }, out: { type: 'string' }, json: { type: 'boolean', default: false }, keep: { type: 'boolean', default: false } } });
  process.chdir(path.join(here, '..'));
  register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
  const { resolveMojuloPaths } = await import('./mojulo-paths.mjs');
  resolveMojuloPaths();
  const { FIXTURES } = await import('../lib/graph/cosmos/fixtures.js');
  const ctx = {
    designGameHandler: (await import('@/lib/mcp/tools/design-game.js')).designGameHandler,
    SketchRepository: (await import('@/lib/db/repositories/sketches')).SketchRepository,
    resolveWorldScene: (await import('@/lib/graph/worlds/world-scene')).resolveWorldScene,
    buildGodotGamePack: (await import('@/lib/graph/scene/godot-pack.js')).buildGodotGamePack,
    exportVerdict: (await import('@/lib/graph/scene/engine-portability.js')).exportVerdict,
    L: await import('@/lib/graph/game/level-equivalence.js'),
    godotBin: process.env.MOJULO_GODOT && existsSync(process.env.MOJULO_GODOT) ? process.env.MOJULO_GODOT : null,
    out: path.resolve(args.out ?? path.join(process.env.MOJULO_OUTCOMES_DIR || os.tmpdir(), 'godot-fixture-matrix')),
    seconds: Number(args.seconds), keep: args.keep,
  };
  const only = args.only ? args.only.split(',') : null;
  const rows = [];
  for (const f of FIXTURES) {
    if (only && !only.includes(f.id)) continue;
    process.stderr.write(`[matrix] ${f.id}\n`);
    rows.push(await fixtureRow(f.id, ctx));
  }
  process.stdout.write(args.json ? `${JSON.stringify(rows, null, 2)}\n` : `${formatMatrix(rows)}\n${ctx.godotBin ? '' : '\n(no Godot: set MOJULO_GODOT for the import, Godot and equal columns)\n'}`);
  process.exit(0);
}
