#!/usr/bin/env node
// export-scene-blender — a SCENE (lib/graph/actor/scene.js) as a Blender film pack (lib/graph/actor/scene-film.js): each
// actor a skinned GLB of its hero carrying the scene's face take and act, the coverage's cameras cut together, and the
// look built in Blender (film | anime). The pack is written by the same core forge_motion's screenplay subject writes
// through (lib/mcp/tools/scene-film.js), so the two agree byte for byte. The hero is minted from its spec here, in memory
// (no store: a cast member's ref is refused; use the door for personas and minted heroes); a realistic hero takes
// minutes an actor.
//
//   node scripts/export-scene-blender.mjs --out <dir> [--scene scene.json] [--style thespian] [--look film|anime]
//                                         [--hero '<a hero spec>'] [--fps 24] [--title scene] [--grain ones|twos|threes] [--grade film]
//   node scripts/export-scene-blender.mjs --build <dir> [--look film|anime]
//
//   --scene  { cast, marks?, script, seed? } (actor/scene.js); a cast member's own `hero` spec plays it, else --hero's;
//            default the baseline's blocked two-hander (actor/baseline.js BASELINE.blocked)
//   --style  a playing style every actor without its own takes (actor/style.js); none: as the cast says
//   --hero   the hero spec every actor without its own plays (default the baseline's realistic hero)
//   --grain  the scene shown on twos or threes, the camera on ones (shoot/time.js), as an anime look is often keyed;
//            the screenplay's slow motion and freezes play on the same time map whatever the grain
//   --grade  the film's grade, built as compositor nodes by look.py: a word (film, noir, bleach, vivid, pastel, cold,
//            warm) or the dials as JSON (scene/channels/grade.js, the World page's own)
//   --build  a pack already written (by this script or by forge_motion's screenplay subject): only the gate below
//
// With a Blender found (MOJULO_BLENDER, lib/workers/find.js), the advisory gate builds film.blend, the cast, the shots and
// the look and verifies the cameras (film-gate.json); without one the pack is written and the gate says it was skipped.
import { writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';

const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
const lib = (p) => import(pathToFileURL(path.join(CONTROL, 'lib', p)).href);

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) { const k = argv[i].replace(/^--/, ''); if (!['out', 'build', 'scene', 'style', 'look', 'hero', 'fps', 'title', 'grain', 'grade'].includes(k) || argv[i + 1] === undefined) throw new Error(`export-scene-blender: unknown or empty option ${argv[i]}`); opt[k] = argv[++i]; }
if (!opt.out && !opt.build) throw new Error('export-scene-blender: --out <dir> (write a pack) or --build <dir> (build one written)');
const look = opt.look ?? 'film';
const { LOOKS, writeSceneFilm } = await lib('mcp/tools/scene-film.js');
if (!LOOKS.includes(look)) throw new Error(`export-scene-blender: --look ${LOOKS.join(' | ')}`);

let out, shotFiles;
if (opt.build) {
  out = path.resolve(opt.build);
  if (!existsSync(path.join(out, 'scene.json'))) throw new Error(`export-scene-blender: ${out} holds no scene.json (a scene film pack)`);
  shotFiles = readdirSync(path.join(out, 'shots')).filter((f) => f.endsWith('.json')).sort().map((f) => `shots/${f}`);
} else {
  out = path.resolve(opt.out);
  const { BASELINE } = await lib('graph/actor/baseline.js');
  const spec = opt.scene ? JSON.parse(readFileSync(opt.scene, 'utf8')) : BASELINE.blocked;
  const grade = opt.grade === undefined ? undefined : opt.grade.trim().startsWith('{') ? JSON.parse(opt.grade) : opt.grade;
  const film = await writeSceneFilm({
    outDir: out, screenplay: spec, title: opt.title ?? 'scene', style: opt.style ?? null, grain: opt.grain ?? null, grade: grade ?? null,
    fps: Number(opt.fps ?? 24), hero: opt.hero ? JSON.parse(opt.hero) : null, log: (m) => console.log(m),
  });
  shotFiles = film.shotFiles;
  console.log(`${out}: ${film.files.length - Object.keys(film.actors).length} files, ${film.shots.length} shots, ${film.seconds} s; look ${look}`);
  for (const n of film.notes) console.log(`  note · ${n.id}${n.at !== undefined ? ` (${n.at} s)` : ''}: ${n.says} Try: ${n.try}`);
}

// ─── the gate, advisory: only where a Blender is found ────────────────────────────────────────────────────────────────
const { findBlender } = await lib('workers/find.js');
const blender = findBlender() ?? null;
const gate = { look, blender: blender ?? null, ran: false };
if (!blender || !existsSync(blender)) gate.skipped = 'no Blender found (MOJULO_BLENDER, lib/workers/find.js): the pack is written; build it as SCENE.md says';
else {
  const run = (args) => { const r = spawnSync(blender, ['-b', ...args], { cwd: out, encoding: 'utf8', timeout: 30 * 60 * 1000 }); return { status: r.status, tail: (r.stdout + r.stderr).split('\n').slice(-6).join('\n') }; };
  const shotArgs = shotFiles.flatMap((f) => ['--shot', f]);
  gate.steps = [
    ['film.blend', run(['--python-expr', "import bpy; bpy.ops.wm.save_as_mainfile(filepath='film.blend')"])],
    ['actors', run(['film.blend', '--python', 'actors.py', '--python-expr', 'import bpy; bpy.ops.wm.save_mainfile()'])],
    ['shots', run(['film.blend', '--python', 'film_shots.py', '--', '--root', 'none', ...shotArgs, '--verify', 'film-gate.json'])],
    ['look', run(['film.blend', '--python', 'look.py', '--python-expr', 'import bpy; bpy.ops.wm.save_mainfile()', '--', '--look', look])],
  ].map(([step, r]) => ({ step, ...r }));
  gate.ran = true;
  gate.ok = gate.steps.every((s) => s.status === 0);
}
writeFileSync(path.join(out, 'scene-gate.json'), `${JSON.stringify(gate, null, 2)}\n`);
console.log(gate.ran ? `gate: ${gate.ok ? 'built' : 'a step failed'} (scene-gate.json)` : `gate: skipped — ${gate.skipped}`);
