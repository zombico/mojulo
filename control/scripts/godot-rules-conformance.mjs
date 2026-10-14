#!/usr/bin/env node
/**
 * The rules conformance gate: are the Godot kernel's motion rules (lib/graph/scene/godot-kernel/rules.gd: walk, and the
 * ground half of platform) EQUAL to the web's controllable engine, frame by frame, over the corpus
 * (lib/graph/scene/rules-conformance.js)? Builds a scratch Godot project (the kernel files plus the runner), runs it
 * headless, and compares every frame's snapshot. Advisory like every engine gate: it needs Godot ($MOJULO_GODOT).
 *
 *   node scripts/godot-rules-conformance.mjs [--random 8] [--seed 1] [--json] [--only <id> [--dump]]
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

const { corpus, runRules, scenarioById } = await import('../lib/graph/scene/rules-conformance.js');
const { findGodot } = await import('../lib/workers/find.js');
const { firstDifference } = await import('./godot-bus-conformance.mjs');

// `mutate`: [{ file, from, to }] plants a bug in this run's copy of the kernel; a plant that no longer applies throws
export function runGodotRules(scenarios, godot, { mutate = [] } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'mojulo-rules-'));
  try {
    mkdirSync(path.join(dir, 'kernel'));
    writeFileSync(path.join(dir, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="rules-conformance"\n');
    for (const f of ['bus.gd', 'json_exact.gd', 'rules.gd']) copyFileSync(path.join(CONTROL, 'lib/graph/scene/godot-kernel', f), path.join(dir, 'kernel', f));
    for (const { file, from, to } of mutate) {
      const p = path.join(dir, 'kernel', file), src = readFileSync(p, 'utf8');
      if (!src.includes(from)) throw new Error(`plant does not apply: kernel/${file} has no '${from}'`);
      writeFileSync(p, src.replace(from, to));
    }
    copyFileSync(path.join(HERE, 'godot-rules-conformance.gd'), path.join(dir, 'conformance.gd'));
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

export function compare(scenarios, godotOut, opts = {}) {
  return scenarios.map((sc) => {
    const web = runRules(scenarioById(sc.id, opts)), gd = (godotOut && godotOut[sc.id]) || [];
    let bad = null;
    for (let f = 0; f < web.length; f++) if (web[f] !== gd[f]) { bad = { frame: f, ...firstDifference(web[f], gd[f] || '') }; break; }
    return { id: sc.id, frames: web.length, equal: !bad, ...(bad ? { first: bad } : {}) };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? Number(argv[i + 1]) : d; };
  const godot = findGodot();
  if (!godot) { console.error('godot-rules-conformance: no Godot (set MOJULO_GODOT)'); process.exit(2); }
  const opts = { random: opt('--random', 8), seed: opt('--seed', 1) };
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
  const scenarios = corpus(opts).filter((sc) => !only || sc.id === only);
  const { out, errors, status } = runGodotRules(scenarios, godot);
  if (errors.length || !out) { console.error(`godot exited ${status}:\n${errors.join('\n') || 'no output'}`); process.exit(1); }
  const rows = compare(scenarios, out, opts);
  if (argv.includes('--dump') && only) {
    const web = runRules(scenarioById(only, opts)), gd = out[only] || [], at = rows[0].first ? rows[0].first.frame : 0;
    for (let f = Math.max(0, at - 3); f <= Math.min(web.length - 1, at + 1); f++) console.log(`frame ${f}\n  web   ${web[f]}\n  godot ${gd[f]}`);
  }
  if (argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
  else {
    const eq = rows.filter((r) => r.equal).length, frames = rows.reduce((n, r) => n + r.frames, 0);
    console.log(`rules conformance · ${eq}/${rows.length} scenarios equal · ${frames} frames`);
    for (const r of rows.filter((x) => !x.equal)) console.log(`  ✗ ${r.id} frame ${r.first.frame} at char ${r.first.at}\n      web   ${r.first.web}\n      godot ${r.first.godot}`);
  }
  process.exit(rows.every((r) => r.equal) ? 0 : 1);
}
