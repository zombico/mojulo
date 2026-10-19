#!/usr/bin/env node
/**
 * Writes the Claude plugin's launcher package (plugins/mojulo/server/package.json and package-lock.json) for the
 * version control/package.json carries, resolved from registry.npmjs.org.
 *
 * The plugin starts mojulo through server/launch.mjs, which runs `npm ci` against this lockfile: exact versions,
 * registry sources and integrity hashes for mojulo and every package under it. The lockfile names the published
 * tarball's own hash, so it can only be written once the version is on npm: run this after `npm publish`, then
 * commit the two files with the release. check-plugin-version.mjs refuses a lockfile for any other version.
 *
 * Usage (from the repo root or control/):
 *   node control/scripts/plugin-lock.mjs [--check]
 * --check resolves again in a temporary folder and exits 1 if the committed lockfile differs (a moved dist-tag
 * cannot change it: the version is exact, but a transitive range can resolve newer between runs).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const LAUNCHER_DIR = 'plugins/mojulo/server';
const REGISTRY = 'https://registry.npmjs.org/';

/** The launcher's package.json for a mojulo version. */
export const launcherPackage = (version) => ({
  name: 'mojulo-claude-plugin-server',
  private: true,
  description: 'Installs the mojulo MCP server for the Claude plugin from the lockfile beside it (launch.mjs).',
  license: 'Apache-2.0',
  dependencies: { mojulo: version },
});

/** The problems with a lockfile for a version, as strings (empty when it pins that version, hashed, from npm). */
export function lockProblems(lock, version) {
  const problems = [];
  const packages = lock?.packages || {};
  if (packages['']?.dependencies?.mojulo !== version) problems.push(`the root depends on mojulo ${packages['']?.dependencies?.mojulo}, expected ${version}`);
  if (packages['node_modules/mojulo']?.version !== version) problems.push(`it locks mojulo ${packages['node_modules/mojulo']?.version}, expected ${version}`);
  for (const [key, entry] of Object.entries(packages)) {
    if (!key || entry.link) continue;
    if (!entry.integrity) problems.push(`${key} has no integrity hash`);
    if (!String(entry.resolved || '').startsWith(REGISTRY)) problems.push(`${key} does not resolve from ${REGISTRY}`);
  }
  return problems;
}

function resolveLock(version) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-plugin-lock-'));
  try {
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify(launcherPackage(version), null, 2) + '\n');
    execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund', `--registry=${REGISTRY}`], {
      cwd: tmp, stdio: ['ignore', 2, 2],
    });
    return fs.readFileSync(path.join(tmp, 'package-lock.json'), 'utf8');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const { version } = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'control/package.json'), 'utf8'));
  let lock;
  try {
    lock = resolveLock(version);
  } catch {
    process.stderr.write(`plugin-lock: npm could not resolve mojulo@${version}; is it published yet? (run this after npm publish)\n`);
    process.exit(1);
  }
  const problems = lockProblems(JSON.parse(lock), version);
  if (problems.length) {
    for (const p of problems) process.stderr.write(`plugin-lock: ${p}\n`);
    process.exit(1);
  }
  const dir = path.join(REPO_ROOT, LAUNCHER_DIR);
  const pkg = JSON.stringify(launcherPackage(version), null, 2) + '\n';
  if (check) {
    const same = fs.readFileSync(path.join(dir, 'package.json'), 'utf8') === pkg && fs.readFileSync(path.join(dir, 'package-lock.json'), 'utf8') === lock;
    process.stdout.write(`plugin-lock: ${LAUNCHER_DIR} ${same ? 'matches' : 'differs from'} a fresh resolution of mojulo@${version}\n`);
    process.exit(same ? 0 : 1);
  }
  fs.writeFileSync(path.join(dir, 'package.json'), pkg);
  fs.writeFileSync(path.join(dir, 'package-lock.json'), lock);
  process.stdout.write(`plugin-lock: wrote ${LAUNCHER_DIR}/package.json and package-lock.json for mojulo@${version} (${Object.keys(JSON.parse(lock).packages).length - 1} packages)\n`);
}
