#!/usr/bin/env node
// render-film — the animation studio's RENDER WORKER: a scene's Blender film pack (forge_motion's screenplay, export
// 'blender') or a whole film's (forge_motion's film, run 'blender') rendered in Blender, chunk by chunk, resumable. The
// MCP tools never launch Blender: this script does, on the operator's machine, and writes what it did to render.json,
// which the film's readout reads back.
//
//   node scripts/render-film.mjs <pack or film dir> [--preset draft|final] [--chunk 24] [--budget-min 60]
//                                [--look film|anime] [--locale fr] [--rebuild] [--plan]
//
//   a pack    a folder with scene.json (one scene); a film: a folder with film.json and scenes/<id>/blender/
//   --preset  draft (EEVEE) | final (Cycles; the pack's render.samples, its motion blur and depth of field)
//   --chunk   frames a Blender call renders (a chunk never crosses a cut; a stopped render loses at most a chunk)
//   --budget-min  stop starting chunks after this many minutes; run again to go on (frames on disk are never redone)
//   --look    the look built when the pack is first built (default: film.json's look, else film)
//   --locale  the dub's faces (dub.py) and sound for the encode and the cut
//   --rebuild build film.blend again (the cast, the cameras, the lights, the look)
//   --plan    say what would run, run nothing
//
// Each pack: build film.blend once (lib/graph/film/render-plan.js buildSteps: the set, the cast, the cameras, the
// lights, the look), render its chunks (film_render.py --frames a-b --no-encode), then encode it (film_render.py: the
// frames on disk, its voice under them). A film: every scene so, then cut.py joins the scenes' films. Blender is found
// as lib/workers/find.js finds it (MOJULO_BLENDER).
//
// A pack made again since its render (the scene edited, the pack's scripts a newer mojulo's) is another pack
// (lib/graph/film/pack-stamp.js): its film.blend, its frames and its films are of the old scene, so they are removed and
// it is built and rendered again; a film's cut of other packs or another order is cut again.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';

const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
const lib = (p) => import(pathToFileURL(path.join(CONTROL, 'lib', p)).href);

const argv = process.argv.slice(2), opt = {}, flags = new Set();
let dir = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) { if (dir) throw new Error(`render-film: one folder (not ${a})`); dir = a; continue; }
  const k = a.slice(2);
  if (['rebuild', 'plan'].includes(k)) { flags.add(k); continue; }
  if (!['preset', 'chunk', 'budget-min', 'look', 'locale'].includes(k) || argv[i + 1] === undefined) throw new Error(`render-film: unknown or empty option ${a}`);
  opt[k] = argv[++i];
}
if (!dir) throw new Error('render-film: <a scene pack folder (scene.json) or a film folder (film.json)>');
dir = path.resolve(dir);
const preset = opt.preset ?? 'draft', chunk = Number(opt.chunk ?? 24), budgetMs = Number(opt['budget-min'] ?? 600) * 60_000, locale = opt.locale ?? null;
const { RENDER_PRESETS, buildSteps, renderChunks, frameFile, renderProgress } = await lib('graph/film/render-plan.js');
if (!RENDER_PRESETS[preset]) throw new Error(`render-film: --preset ${Object.keys(RENDER_PRESETS).join(' | ')}`);
const { packStamp } = await lib('graph/film/pack-stamp.js');
const { findBlender } = await lib('workers/find.js');
const blender = findBlender() ?? null;
const t0 = Date.now();

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const film = existsSync(path.join(dir, 'film.json')) ? readJson(path.join(dir, 'film.json')) : null;
if (!film && !existsSync(path.join(dir, 'scene.json'))) throw new Error(`render-film: ${dir} holds neither scene.json (a scene's pack) nor film.json (a film)`);
const look = opt.look ?? film?.look ?? 'film';
const packs = film ? film.order.map((id) => ({ id, dir: path.join(dir, 'scenes', id, 'blender') })) : [{ id: path.basename(dir), dir }];

/** run blender in a pack's folder, its output's tail kept */
function run(cwd, args) {
  const t = Date.now(), r = spawnSync(blender, ['-b', ...args], { cwd, encoding: 'utf8', timeout: 6 * 3600 * 1000 });
  return { status: r.status, seconds: Math.round((Date.now() - t) / 100) / 10, tail: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-4).join('\n') };
}

/** a pack's shot files, as film_shots.py was given them */
function shotFilesOf(p) {
  const sdir = path.join(p, 'shots');
  const many = existsSync(sdir) ? readdirSync(sdir).filter((f) => f.endsWith('.json')).sort().map((f) => `shots/${f}`) : [];
  return many.length ? many : ['shot.json'];
}

function framesDone(p) {
  const fdir = path.join(p, 'film', `frames-${preset}`);
  if (!existsSync(fdir)) return new Set();
  return new Set(readdirSync(fdir).filter((f) => /^\d{4,}\.png$/.test(f) && statSync(path.join(fdir, f)).size > 0).map((f) => Number(f.slice(0, -4))));
}

const encodedName = `film-${preset}${locale ? `-${locale}` : ''}.mp4`;
const report = { preset, chunk, locale, blender, scenes: {}, started: new Date(t0).toISOString() };
const stamps = {};

for (const P of packs) {
  if (!existsSync(path.join(P.dir, 'scene.json'))) { report.scenes[P.id] = { state: 'not made', note: 'no pack yet: forge_motion film run blender makes it' }; continue; }
  const scene = readJson(path.join(P.dir, 'scene.json')), shotFiles = shotFilesOf(P.dir);
  const counts = shotFiles.map((f) => readJson(path.join(P.dir, f)).frame_count);
  const chunks = renderChunks(counts, { chunk });
  // (the record keeps every call across runs, the newest last: what was built, each chunk, the encode)
  const before = existsSync(path.join(P.dir, 'render.json')) ? readJson(path.join(P.dir, 'render.json')) : null;
  const stamp = packStamp(P.dir), stale = Boolean(before && before.pack !== stamp);
  const rec = { preset, pack: stamp, frames: counts.reduce((a, n) => a + n, 0), calls: (before?.calls ?? []).slice(-200) };
  stamps[P.id] = stamp;
  const write = () => writeFileSync(path.join(P.dir, 'render.json'), `${JSON.stringify({ ...rec, ...renderProgress(chunks, framesDone(P.dir)), updated: new Date().toISOString() }, null, 2)}\n`);
  const steps = buildSteps({ shotFiles, look, set: Boolean(scene.set), lights: Boolean(scene.lights) });
  if (flags.has('plan') || !blender) {
    report.scenes[P.id] = { build: existsSync(path.join(P.dir, 'film.blend')) && !flags.has('rebuild') && !stale ? 'built' : steps.map((s) => s.step), ...renderProgress(chunks, stale ? new Set() : framesDone(P.dir)), chunks: chunks.length, ...(stale ? { stale: 'the pack was made again since its render: it is built and rendered again' } : {}) };
    continue;
  }
  if (stale) {
    for (const f of ['film.blend', 'film.blend1', 'film', 'film-gate.json']) rmSync(path.join(P.dir, f), { recursive: true, force: true });
    rec.calls.push({ step: 'made again', was: before.pack, pack: stamp });
  }
  // ─── build film.blend once ──────────────────────────────────────────────────────────────────────────────────────────
  if (!existsSync(path.join(P.dir, 'film.blend')) || flags.has('rebuild')) {
    for (const s of steps) {
      const r = run(P.dir, s.args);
      rec.calls.push({ step: s.step, ...r });
      if (r.status !== 0) { write(); report.scenes[P.id] = { state: 'build failed', step: s.step, tail: r.tail }; break; }
    }
    if (report.scenes[P.id]) continue;
  }
  if (locale) { const r = run(P.dir, ['film.blend', '--python', 'dub.py', '--', '--locale', locale]); rec.calls.push({ step: `dub ${locale}`, ...r }); }
  // ─── the chunks, resumable ──────────────────────────────────────────────────────────────────────────────────────────
  let stopped = false;
  for (const c of renderProgress(chunks, framesDone(P.dir)).chunks) {
    if (c.state === 'done') continue;
    if (Date.now() - t0 > budgetMs) { stopped = true; break; }
    const r = run(P.dir, ['film.blend', '--python', 'film_render.py', '--', '--preset', preset, '--frames', `${c.from}-${c.to}`, '--no-encode']);
    rec.calls.push({ step: 'chunk', from: c.from, to: c.to, status: r.status, seconds: r.seconds, ...(r.status ? { tail: r.tail } : {}) });
    write();
    if (r.status !== 0) { stopped = true; break; }
  }
  const progress = renderProgress(chunks, framesDone(P.dir));
  // ─── the encode: the frames on disk, the voice under them ──────────────────────────────────────────────────────────
  if (!stopped && progress.done === progress.frames && !existsSync(path.join(P.dir, 'film', encodedName))) {
    const r = run(P.dir, ['film.blend', '--python', 'film_render.py', '--', '--preset', preset, ...(locale ? ['--locale', locale] : [])]);
    rec.calls.push({ step: 'encode', ...r });
  }
  rec.encoded = existsSync(path.join(P.dir, 'film', encodedName)) ? `film/${encodedName}` : null;
  write();
  report.scenes[P.id] = { frames: progress.frames, done: progress.done, encoded: rec.encoded, ...(stopped ? { state: 'paused' } : {}) };
}

// ─── a film: its cut, once every scene is encoded ───────────────────────────────────────────────────────────────────
if (film && blender && !flags.has('plan')) {
  const all = packs.every((P) => report.scenes[P.id]?.encoded);
  const cutName = `cut-${preset}${locale ? `-${locale}` : ''}.mp4`;
  // (a cut is of the packs and the order it joined: of others, it is cut again)
  const of = { order: film.order, packs: stamps }, was = existsSync(path.join(dir, 'render.json')) ? readJson(path.join(dir, 'render.json')).cut?.of : null;
  if (JSON.stringify(was ?? null) !== JSON.stringify(of)) for (const f of readdirSync(dir)) if (/^cut-.*\.mp4$/.test(f)) rmSync(path.join(dir, f), { force: true });
  if (all && !existsSync(path.join(dir, cutName))) { const r = run(dir, ['--python', 'cut.py', '--', '--preset', preset, ...(locale ? ['--locale', locale] : [])]); report.cut = { status: r.status, ...(r.status ? { tail: r.tail } : {}) }; }
  report.cut = { ...(report.cut ?? {}), file: existsSync(path.join(dir, cutName)) ? cutName : null, ...(existsSync(path.join(dir, cutName)) ? { of } : was ? { of: was } : {}), ...(all ? {} : { waiting: packs.filter((P) => !report.scenes[P.id]?.encoded).map((P) => P.id) }) };
}
report.seconds = Math.round((Date.now() - t0) / 1000);
if (!blender && !flags.has('plan')) report.blender = 'none found (MOJULO_BLENDER, lib/workers/find.js): the plan above is what a render would do';
// (a plan, or a machine with no Blender, ran nothing: the record of what did run stays)
if (film && blender && !flags.has('plan')) writeFileSync(path.join(dir, 'render.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
