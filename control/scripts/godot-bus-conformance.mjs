#!/usr/bin/env node
/**
 * The bus conformance gate: is the Godot kernel's event bus (lib/graph/scene/godot-kernel/bus.gd) EQUAL to the web
 * reducer (lib/graph/worlds/event-bus.js), frame by frame, over the corpus (lib/graph/scene/bus-conformance.js)?
 * Builds a scratch Godot project (the kernel's bus.gd plus the runner), runs it headless, and compares every frame's
 * canonical snapshot. Advisory like every engine gate: it needs Godot ($MOJULO_GODOT, or the app in /Applications).
 *
 *   node scripts/godot-bus-conformance.mjs [--random 24] [--seed 7] [--json]
 *
 * Exit 0 when every frame of every scenario is equal; 1 with the first difference of each unequal scenario.
 */
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTROL = path.resolve(HERE, '..');
register(pathToFileURL(path.join(HERE, 'mcp-stdio-loader.mjs')).href, pathToFileURL(`${CONTROL}/`).href);

const { corpus, runScenario, runStoreScenario } = await import('../lib/graph/scene/bus-conformance.js');
const { findGodot } = await import('../lib/workers/find.js');

export function firstDifference(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return { at: i, web: a.slice(Math.max(0, i - 60), i + 80), godot: b.slice(Math.max(0, i - 60), i + 80) };
}

export function runGodotBus(scenarios, godot) {
  const dir = mkdtempSync(path.join(tmpdir(), 'mojulo-bus-'));
  try {
    mkdirSync(path.join(dir, 'kernel'));
    writeFileSync(path.join(dir, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="bus-conformance"\n');
    for (const f of ['bus.gd', 'json_exact.gd', 'store.gd', 'stats.gd']) copyFileSync(path.join(CONTROL, 'lib/graph/scene/godot-kernel', f), path.join(dir, 'kernel', f));
    copyFileSync(path.join(HERE, 'godot-bus-conformance.gd'), path.join(dir, 'conformance.gd'));
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

export function compare(scenarios, godotOut) {
  const rows = [];
  for (const sc of scenarios) {
    const web = sc.store ? runStoreScenario(sc) : runScenario(sc), gd = (godotOut && godotOut[sc.id]) || [];
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
  if (!godot) { console.error('godot-bus-conformance: no Godot (set MOJULO_GODOT)'); process.exit(2); }
  const scenarios = corpus({ random: opt('--random', 24), seed: opt('--seed', 7) });
  const { out, errors, status } = runGodotBus(scenarios, godot);
  if (errors.length || !out) { console.error(`godot exited ${status}:\n${errors.join('\n') || 'no output'}`); process.exit(1); }
  const rows = compare(scenarios, out);
  if (argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
  else {
    const eq = rows.filter((r) => r.equal).length, frames = rows.reduce((n, r) => n + r.frames, 0);
    console.log(`bus conformance · ${eq}/${rows.length} scenarios equal · ${frames} frames`);
    for (const r of rows.filter((x) => !x.equal)) console.log(`  ✗ ${r.id} frame ${r.first.frame} at char ${r.first.at}\n      web   ${r.first.web}\n      godot ${r.first.godot}`);
  }
  process.exit(rows.every((r) => r.equal) ? 0 : 1);
}
