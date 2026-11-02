#!/usr/bin/env node
// export-scene-blender — a SCENE (lib/graph/actor/scene.js) as a Blender film pack (lib/graph/actor/scene-film.js): each
// actor a skinned GLB of its hero carrying the scene's face take and act, the coverage's cameras cut together, and the
// look built in Blender (film | anime). The hero is minted from its spec here, in memory (no store); a realistic hero
// takes minutes an actor.
//
//   node scripts/export-scene-blender.mjs --out <dir> [--scene scene.json] [--style thespian] [--look film|anime]
//                                         [--hero '<a hero spec>'] [--fps 24] [--title scene]
//
//   --scene  { cast, marks?, script, seed? } (actor/scene.js); a cast member's own `hero` spec plays it, else --hero's;
//            default the baseline's blocked two-hander (actor/baseline.js BASELINE.blocked)
//   --style  a playing style every actor without its own takes (actor/style.js); none: as the cast says
//   --hero   the hero spec every actor without its own plays (default the baseline's realistic hero)
//
// With a Blender found (MOJULO_BLENDER, lib/workers/find.js), the advisory gate builds film.blend, the cast, the shots and
// the look, verifies the cameras (film-gate.json) and renders a still a shot; without one the pack is written and the gate
// says it was skipped.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';

const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
const lib = (p) => import(pathToFileURL(path.join(CONTROL, 'lib', p)).href);

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) { const k = argv[i].replace(/^--/, ''); if (!['out', 'scene', 'style', 'look', 'hero', 'fps', 'title'].includes(k) || argv[i + 1] === undefined) throw new Error(`export-scene-blender: unknown or empty option ${argv[i]}`); opt[k] = argv[++i]; }
if (!opt.out) throw new Error('export-scene-blender: --out <dir>');
const out = path.resolve(opt.out), look = opt.look ?? 'film', fps = Number(opt.fps ?? 24), title = opt.title ?? 'scene';

const { BASELINE } = await lib('graph/actor/baseline.js');
const { actScene } = await lib('graph/actor/scene.js');
const { coverScene } = await lib('graph/actor/coverage.js');
const { sceneActOf } = await lib('graph/actor/act.js');
const { sceneFilmFiles, LOOKS } = await lib('graph/actor/scene-film.js');
const { heroRecord, expandLayeredManifest } = await lib('mcp/tools/layered.js');
const { resolveWorldScene } = await lib('graph/worlds/world-scene.js');
const { facesToGlb } = await lib('graph/scene/scene-gltf.js');
if (!LOOKS.includes(look)) throw new Error(`export-scene-blender: --look ${LOOKS.join(' | ')}`);

const spec = opt.scene ? JSON.parse(readFileSync(opt.scene, 'utf8')) : BASELINE.blocked;
const cast = Object.fromEntries(Object.entries(spec.cast).map(([w, C]) => [w, { ...C, ...(opt.style && !C.style ? { style: opt.style } : {}) }]));
const S = actScene({ ...spec, cast }), coverage = coverScene(S);
const heroSpec = (w) => cast[w].hero ?? (opt.hero ? JSON.parse(opt.hero) : BASELINE.hero);

mkdirSync(path.join(out, 'actors'), { recursive: true });
const expanded = new Map(), actors = {};
for (const w of Object.keys(S.actors)) {
  const hs = heroSpec(w), key = JSON.stringify(hs), t0 = Date.now();
  if (!expanded.has(key)) { const h = heroRecord(hs); expanded.set(key, { ...expandLayeredManifest({ kind: 'layered', title: `${title} · ${w}`, hero: h }), hero: h }); }
  const base = expanded.get(key), take = sceneActOf(S.actors[w]);
  const manifest = { ...base, hero: { ...base.hero, perform: { ...(base.hero.perform ?? {}), ...take.perform }, acts: take.acts } };
  // (the lit export: the realistic body's smooth normals and no light baked into its colours, so either look shades it)
  const { payload } = await resolveWorldScene({ ref: `scene-${w}`, title: `${title} · ${w}`, manifest }, { face: true, unshaded: true });
  const glb = facesToGlb(payload, { generator: `mojulo scene film · ${w}`, clips: '_all', skinned: true, lit: true });
  writeFileSync(path.join(out, 'actors', `${w}.glb`), Buffer.from(glb.bytes));
  actors[w] = { take: 'scene' };
  console.log(`actors/${w}.glb: ${(glb.bytes.byteLength / 1e6).toFixed(1)} MB, ${Math.round((Date.now() - t0) / 1000)} s`);
}

const files = sceneFilmFiles({ S, coverage, actors, fps, title });
for (const f of files) { mkdirSync(path.dirname(path.join(out, f.file)), { recursive: true }); writeFileSync(path.join(out, f.file), f.text); }
console.log(`${out}: ${files.length} files, ${coverage.shots.length} shots, ${S.seconds} s; look ${look}`);

// ─── the gate, advisory: only where a Blender is found ────────────────────────────────────────────────────────────────
const { findBlender } = await lib('workers/find.js');
const blender = findBlender() ?? null;
const gate = { look, blender: blender ?? null, ran: false };
if (!blender || !existsSync(blender)) gate.skipped = 'no Blender found (MOJULO_BLENDER, lib/workers/find.js): the pack is written; build it as SCENE.md says';
else {
  const run = (args) => { const r = spawnSync(blender, ['-b', ...args], { cwd: out, encoding: 'utf8', timeout: 30 * 60 * 1000 }); return { status: r.status, tail: (r.stdout + r.stderr).split('\n').slice(-6).join('\n') }; };
  const shotArgs = files.filter((f) => f.file.startsWith('shots/')).flatMap((f) => ['--shot', f.file]);
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
