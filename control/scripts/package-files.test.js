// Every script a shipped entry point imports or spawns must itself be in package.json `files`, or
// it works from a checkout and fails with MODULE_NOT_FOUND on every npm and npx install. That is
// how `mojulo install recall` shipped without scripts/fetch-embed-model.js: the runtime installed,
// the model fetch failed, and `install chatbot` (which runs it first) failed with it.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(CONTROL_DIR, 'package.json'), 'utf8'));
const shipped = new Set(pkg.files);
const read = (rel) => readFileSync(path.join(CONTROL_DIR, rel), 'utf8');

// The ways a shipped script names a sibling: a static or dynamic import, the loader registration,
// and a path joined from the package root or the scripts directory (what gets spawned).
const REFERENCES = [
  /from\s+'\.\/([\w.-]+)'/g,
  /import\(\s*'\.\/([\w.-]+)'\s*\)/g,
  /register\(\s*'\.\/([\w.-]+)'/g,
  /'scripts',\s*'([\w.-]+\.(?:m?js|py))'/g,
  /SCRIPTS_DIR,\s*'([\w.-]+\.(?:m?js|py))'/g,
];

function referencedScripts(rel) {
  const src = read(rel);
  const out = new Set();
  for (const re of REFERENCES) for (const m of src.matchAll(re)) out.add(`scripts/${m[1]}`);
  return out;
}

describe('package.json files covers what the shipped scripts run', () => {
  it('ships every bin', () => {
    for (const bin of Object.values(pkg.bin)) expect(shipped, bin).toContain(bin.replace(/^\.\//, ''));
  });

  it('ships every script a shipped script imports or spawns', () => {
    const scripts = [...shipped].filter((f) => f.startsWith('scripts/') && /\.m?js$/.test(f));
    expect(scripts).toContain('scripts/mcp-install.mjs');
    for (const rel of scripts) {
      for (const ref of referencedScripts(rel)) expect(shipped, `${rel} runs ${ref}`).toContain(ref);
    }
  });

  it('ships the model fetch `install recall` runs, and every `mojulo script` command', () => {
    expect(referencedScripts('scripts/mcp-install.mjs')).toContain('scripts/fetch-embed-model.js');
    const commands = read('scripts/mcp-stdio.mjs').match(/const SCRIPT_COMMANDS = \[([^\]]*)\]/)[1];
    const names = [...commands.matchAll(/'([\w-]+)'/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(shipped, name).toContain(`scripts/${name}.mjs`);
  });
});
