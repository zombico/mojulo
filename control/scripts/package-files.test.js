// Every script a shipped entry point imports or spawns must itself be in package.json `files`, or
// it works from a checkout and fails with MODULE_NOT_FOUND on every npm and npx install. That is
// how `mojulo install recall` shipped without scripts/fetch-embed-model.js: the runtime installed,
// and the model fetch failed.

import { readdirSync, readFileSync } from 'node:fs';
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

// A lib module that imports above lib/ (or reads a file there by path) works from a checkout and
// fails at load on every install unless `files` ships the target. That is how 3.2.0's first pack
// broke the stdio server: lib/graph/game/title-words.js imports i18n/config.js and reads
// messages/<locale>.json, and neither shipped. A `files` entry covers a target literally, as a
// `dir/**` prefix, or as a `dir/*.ext` glob.
function covered(rel) {
  return pkg.files.some((f) => {
    if (f.startsWith('!')) return false;
    if (f === rel) return true;
    if (f.endsWith('/**')) return rel.startsWith(f.slice(0, -2));
    const glob = f.match(/^(.*\/)\*(\.\w+)$/);
    return !!glob && rel.startsWith(glob[1]) && !rel.slice(glob[1].length).includes('/') && rel.endsWith(glob[2]);
  });
}

function libModules(dir = 'lib', out = []) {
  for (const e of readdirSync(path.join(CONTROL_DIR, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) { if (!/^(node_modules|mobile-suit|__snapshots__|spike-output)$/.test(e.name)) libModules(rel, out); }
    else if (/\.m?js$/.test(e.name) && !/\.test\.m?js$/.test(e.name)) out.push(rel);
  }
  return out;
}

describe('package.json files covers what lib reaches above lib/', () => {
  it('ships every module a lib module imports from outside lib/', () => {
    const IMPORT = /(?:\bfrom\s+|\bimport\s*\(\s*|^\s*import\s+)'(\.\.\/[^']+\.m?js)'/gm;
    let escapes = 0;
    for (const rel of libModules()) {
      for (const m of read(rel).matchAll(IMPORT)) {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1]));
        if (target.startsWith('lib/') || target.startsWith('../')) continue;
        escapes++;
        expect(covered(target), `${rel} imports ${target}`).toBe(true);
      }
    }
    expect(escapes).toBeGreaterThan(0);   // title-words → i18n/config.js; a scan that finds none has gone blind
  });

  it('ships the locale catalogs title-words reads by path', () => {
    for (const f of readdirSync(path.join(CONTROL_DIR, 'messages')).filter((n) => n.endsWith('.json'))) {
      expect(covered(`messages/${f}`), f).toBe(true);
    }
  });
});
