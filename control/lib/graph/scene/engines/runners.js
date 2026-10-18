/**
 * THE CONFORMANCE RUNNERS, one per engine with a runtime kernel: how its kernel is laid out and how a corpus is run
 * through it headless (engines/conformance.js is the neutral half). Each run builds a scratch folder holding the
 * kernel modules the corpus names (`kernel/<file>`) and the engine's runner script for that corpus, writes the
 * scenarios to `corpus.json`, runs the engine, and reads `out.json` back: `{ [scenario id]: [canonical string] }`.
 *
 *   RUNNERS[engine]   { find, kernelDir, file(module id), always, script(corpus), entry, prepare?(dir), args(dir, in, out), error }
 *   runCorpus(engine, corpus, scenarios, { bin?, mutate? }) → { out, errors, status }
 *     mutate: [{ file, from, to }] plants a bug in this run's copy of the kernel (the corpus must catch it); a plant that
 *     no longer applies throws
 *
 * Like every engine gate, advisory: an engine that is not found is reported, never installed.
 */
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findGodot, findLune } from '../../../workers/find.js';
import { corpusOf } from './conformance.js';

const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

export const RUNNERS = Object.freeze({
  godot: {
    find: findGodot,
    kernelDir: 'lib/graph/scene/godot-kernel',
    file: (m) => ({ json: 'json_exact.gd', game: 'game_channel.gd', level: null }[m] ?? `${m}.gd`),
    always: ['js', 'json'],
    script: (corpus) => `scripts/conformance/godot/${corpus}.gd`,
    entry: 'conformance.gd',
    prepare: (dir, corpus) => writeFileSync(path.join(dir, 'project.godot'), `config_version=5\n\n[application]\nconfig/name="${corpus}-conformance"\n`),
    args: (dir, inFile, outFile) => ['--headless', '--path', dir, '--script', 'res://conformance.gd', '--', inFile, outFile],
    error: /SCRIPT ERROR|Parse Error|ERROR:/,
  },
  roblox: {
    find: findLune,
    kernelDir: 'lib/graph/scene/roblox-kernel',
    file: (m) => `${m}.luau`,
    always: ['js'],
    script: (corpus) => `scripts/conformance/roblox/${corpus}.luau`,
    entry: 'conformance.luau',
    args: (dir, inFile, outFile) => ['run', path.join(dir, 'conformance.luau'), inFile, outFile],
    error: /error|Error|exception/,
  },
});

export function runnerOf(engine) {
  const r = RUNNERS[engine];
  if (!r) throw new Error(`conformance: no runner for engine '${engine}' (known: ${Object.keys(RUNNERS).join(', ')})`);
  return r;
}

/** The kernel files a corpus needs in an engine, and those the engine's kernel does not have yet. */
export function kernelFiles(engine, corpus) {
  const r = runnerOf(engine);
  // a module id an engine's kernel has no file for (null) is the runner's own: Godot's level step
  const files = [...new Set([...r.always, ...corpusOf(corpus).kernel].map(r.file).filter(Boolean))];
  return { files, missing: files.filter((f) => !existsSync(path.join(CONTROL, r.kernelDir, f))) };
}

export function runCorpus(engine, corpus, scenarios, { bin = runnerOf(engine).find(), mutate = [] } = {}) {
  const r = runnerOf(engine), c = corpusOf(corpus);
  if (c.engines && !c.engines.includes(engine)) return { out: null, errors: [`the ${corpus} corpus has no ${engine} runner (it runs on ${c.engines.join(', ')})`], status: null };
  if (!bin) return { out: null, errors: [`no ${engine} runner found (see lib/workers/find.js)`], status: null };
  const { files, missing } = kernelFiles(engine, corpus);
  if (missing.length) return { out: null, errors: [`not in the ${engine} kernel yet: ${missing.join(', ')}`], status: null };
  const dir = mkdtempSync(path.join(tmpdir(), `mojulo-${engine}-${corpus}-`));
  try {
    mkdirSync(path.join(dir, 'kernel'));
    r.prepare?.(dir, corpus);
    for (const f of files) copyFileSync(path.join(CONTROL, r.kernelDir, f), path.join(dir, 'kernel', f));
    for (const { file, from, to } of mutate) {
      const p = path.join(dir, 'kernel', file), src = readFileSync(p, 'utf8');
      if (!src.includes(from)) throw new Error(`plant does not apply: kernel/${file} has no '${from}'`);
      writeFileSync(p, src.replace(from, to));
    }
    copyFileSync(path.join(CONTROL, r.script(corpus)), path.join(dir, r.entry));
    const inFile = path.join(dir, 'corpus.json'), outFile = path.join(dir, 'out.json');
    writeFileSync(inFile, JSON.stringify(scenarios));
    const run = spawnSync(bin, r.args(dir, inFile, outFile), { cwd: dir, encoding: 'utf8', timeout: 300000, maxBuffer: 1 << 28 });
    let out = null;
    try { out = JSON.parse(readFileSync(outFile, 'utf8')); } catch { /* no output: reported below */ }
    const errors = `${run.stdout || ''}\n${run.stderr || ''}`.split('\n').filter((l) => r.error.test(l));
    return { out, errors, status: run.status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
