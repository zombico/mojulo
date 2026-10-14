#!/usr/bin/env node
/**
 * The scenes conformance gate: are the Godot kernel's scene runner and quest journal (kernel/scenes.gd, quests.gd)
 * EQUAL to the web's (scene-runner.js, quests.js), step by step, over the corpus
 * (lib/graph/scene/scenes-conformance.js)? Builds a scratch Godot project (the kernel files plus the runner), runs it
 * headless, and compares every frame's snapshot. Advisory like every engine gate: it needs Godot ($MOJULO_GODOT).
 *
 *   node scripts/godot-scenes-conformance.mjs [--random 6] [--seed 3] [--json]
 *
 * Exit 0 when every frame of every scenario is equal; 1 with the first difference of each unequal scenario.
 */
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTROL = path.resolve(HERE, '..');
register(pathToFileURL(path.join(HERE, 'mcp-stdio-loader.mjs')).href, pathToFileURL(`${CONTROL}/`).href);

const { corpus, runScenes, runQuests, scenarioById, QUEST_SCENARIOS } = await import('../lib/graph/scene/scenes-conformance.js');
const { findGodot } = await import('../lib/workers/find.js');
const { firstDifference } = await import('./godot-bus-conformance.mjs');

// `mutate`: [{ file, from, to }] plants a bug in this run's copy of the kernel; a plant that no longer applies throws
export function runGodotScenes(scenarios, godot, { mutate = [] } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'mojulo-scenes-'));
  try {
    mkdirSync(path.join(dir, 'kernel'));
    writeFileSync(path.join(dir, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="scenes-conformance"\n');
    for (const f of ['bus.gd', 'json_exact.gd', 'scenes.gd', 'quests.gd']) copyFileSync(path.join(CONTROL, 'lib/graph/scene/godot-kernel', f), path.join(dir, 'kernel', f));
    for (const { file, from, to } of mutate) {
      const p = path.join(dir, 'kernel', file), src = readFileSync(p, 'utf8');
      if (!src.includes(from)) throw new Error(`plant does not apply: kernel/${file} has no '${from}'`);
      writeFileSync(p, src.replace(from, to));
    }
    copyFileSync(path.join(HERE, 'godot-scenes-conformance.gd'), path.join(dir, 'conformance.gd'));
    const inFile = path.join(dir, 'corpus.json'), outFile = path.join(dir, 'out.json');
    writeFileSync(inFile, JSON.stringify(scenarios));
    const r = spawnSync(godot, ['--headless', '--path', dir, '--script', 'res://conformance.gd', '--', inFile, outFile], { encoding: 'utf8', timeout: 120000 });
    let out = null;
    try { out = JSON.parse(readFileSync(outFile, 'utf8')); } catch { /* no output: reported below */ }
    const errors = `${r.stdout || ''}\n${r.stderr || ''}`.split('\n').filter((l) => /SCRIPT ERROR|Parse Error|ERROR:/.test(l));
    return { out, errors, status: r.status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// the web's snapshots for every scenario and journal, by id
export function webRuns(opts = {}) {
  const c = corpus(opts), out = {};
  for (const sc of c.scenes) out[sc.id] = runScenes(scenarioById(sc.id, opts), c.program);
  for (const j of QUEST_SCENARIOS) out[j.id] = runQuests(j, c.quests);
  return out;
}

export function compare(godotOut, opts = {}) {
  return Object.entries(webRuns(opts)).map(([id, web]) => {
    const gd = (godotOut && godotOut[id]) || [];
    let bad = null;
    for (let f = 0; f < web.length; f++) if (web[f] !== gd[f]) { bad = { frame: f, ...firstDifference(web[f], gd[f] || '') }; break; }
    return { id, frames: web.length, equal: !bad, ...(bad ? { first: bad } : {}) };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? Number(argv[i + 1]) : d; };
  const godot = findGodot();
  if (!godot) { console.error('godot-scenes-conformance: no Godot (set MOJULO_GODOT)'); process.exit(2); }
  const opts = { random: opt('--random', 6), seed: opt('--seed', 3) };
  const { out, errors, status } = runGodotScenes(corpus(opts), godot);
  if (errors.length || !out) { console.error(`godot exited ${status}:\n${errors.join('\n') || 'no output'}`); process.exit(1); }
  const rows = compare(out, opts);
  if (argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
  else {
    const eq = rows.filter((r) => r.equal).length, frames = rows.reduce((n, r) => n + r.frames, 0);
    console.log(`scenes conformance · ${eq}/${rows.length} scenarios equal · ${frames} steps`);
    for (const r of rows.filter((x) => !x.equal)) console.log(`  ✗ ${r.id} step ${r.first.frame} at char ${r.first.at}\n      web   ${r.first.web}\n      godot ${r.first.godot}`);
  }
  process.exit(rows.every((r) => r.equal) ? 0 : 1);
}
