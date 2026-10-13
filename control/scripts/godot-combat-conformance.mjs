#!/usr/bin/env node
/**
 * The combat conformance gate: is the Godot kernel's fight (lib/graph/scene/godot-kernel/combat.gd, with cast.gd's hit
 * facts) EQUAL to the web's controllable engine, frame by frame, over the corpus (lib/graph/scene/combat-conformance.js)?
 * Builds a scratch Godot project (the kernel files plus the runner), runs it headless, and compares every frame's
 * snapshot. Advisory like every engine gate: it needs Godot ($MOJULO_GODOT, or the app in /Applications).
 *
 *   node scripts/godot-combat-conformance.mjs [--random 12] [--seed 1] [--json] [--only <id> [--dump]]
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

const { corpus, runCombat, scenarioById } = await import('../lib/graph/scene/combat-conformance.js');
const { findGodot } = await import('../lib/workers/find.js');
const { firstDifference } = await import('./godot-bus-conformance.mjs');

export function runGodotCombat(scenarios, godot) {
  const dir = mkdtempSync(path.join(tmpdir(), 'mojulo-combat-'));
  try {
    mkdirSync(path.join(dir, 'kernel'));
    writeFileSync(path.join(dir, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="combat-conformance"\n');
    for (const f of ['bus.gd', 'json_exact.gd', 'cast.gd', 'combat.gd']) copyFileSync(path.join(CONTROL, 'lib/graph/scene/godot-kernel', f), path.join(dir, 'kernel', f));
    copyFileSync(path.join(HERE, 'godot-combat-conformance.gd'), path.join(dir, 'conformance.gd'));
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
  const rows = [];
  for (const sc of scenarios) {
    const web = runCombat(scenarioById(sc.id, opts)).snaps, gd = (godotOut && godotOut[sc.id]) || [];
    let bad = null;
    for (let f = 0; f < web.length; f++) {
      if (web[f] !== gd[f]) { bad = { frame: f, ...firstDifference(web[f], gd[f] || '') }; break; }
    }
    rows.push({ id: sc.id, frames: web.length, equal: !bad, ...(bad ? { first: bad } : {}) });
  }
  return rows;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? Number(argv[i + 1]) : d; };
  const godot = findGodot();
  if (!godot) { console.error('godot-combat-conformance: no Godot (set MOJULO_GODOT)'); process.exit(2); }
  const opts = { random: opt('--random', 12), seed: opt('--seed', 1) };
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
  const scenarios = corpus(opts).filter((sc) => !only || sc.id === only);
  const { out, errors, status } = runGodotCombat(scenarios, godot);
  if (errors.length || !out) { console.error(`godot exited ${status}:\n${errors.join('\n') || 'no output'}`); process.exit(1); }
  const rows = compare(scenarios, out, opts);
  if (argv.includes('--dump') && only) {
    // both sides, frame by frame around the first difference
    const web = runCombat(scenarioById(only, opts)).snaps, gd = out[only] || [], at = rows[0].first ? rows[0].first.frame : 0;
    for (let f = Math.max(0, at - 3); f <= Math.min(web.length - 1, at + 1); f++) console.log(`frame ${f}\n  web   ${web[f]}\n  godot ${gd[f]}`);
  }
  if (argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
  else {
    const eq = rows.filter((r) => r.equal).length, frames = rows.reduce((n, r) => n + r.frames, 0);
    console.log(`combat conformance · ${eq}/${rows.length} scenarios equal · ${frames} frames`);
    for (const r of rows.filter((x) => !x.equal)) console.log(`  ✗ ${r.id} frame ${r.first.frame} at char ${r.first.at}\n      web   ${r.first.web}\n      godot ${r.first.godot}`);
  }
  process.exit(rows.every((r) => r.equal) ? 0 : 1);
}
