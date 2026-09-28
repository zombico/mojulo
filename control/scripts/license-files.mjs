#!/usr/bin/env node
/**
 * License and notice files for the two npm packages.
 *
 * The repository's LICENSE and NOTICE sit at the repo root, outside both package directories, so
 * neither tarball carried them. Core's prepack copies them into control/ and its postpack removes
 * the copies (npm always packs a root LICENSE; NOTICE is listed in `files`); stage-ui-package.mjs
 * copies them into ui-package/ the same way. The copies are gitignored.
 *
 * The dashboard package also redistributes third-party code under standalone/node_modules. Next's
 * output tracing copies only the files a server needs, which leaves out every package's license
 * text, so stageThirdPartyNotices copies each staged package's LICENSE, LICENCE, NOTICE and COPYING
 * files back from the build's node_modules and writes standalone/THIRD_PARTY_NOTICES.md listing
 * each package, its version and its declared license.
 *
 *   node scripts/license-files.mjs copy <dir>     copy LICENSE and NOTICE into <dir>
 *   node scripts/license-files.mjs remove <dir>   remove those copies
 */

import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PROJECT_LICENSE_FILES = ['LICENSE', 'NOTICE'];
const LICENSE_FILE = /^(licen[cs]e|notice|copying)(\b|[.-]|$)/i;

/** Copy the repository's LICENSE and NOTICE into `dir`. */
export function copyProjectLicense(dir, { root = REPO_ROOT } = {}) {
  for (const name of PROJECT_LICENSE_FILES) copyFileSync(path.join(root, name), path.join(dir, name));
}

/** Remove the copies copyProjectLicense made in `dir`. */
export function removeProjectLicense(dir) {
  for (const name of PROJECT_LICENSE_FILES) rmSync(path.join(dir, name), { force: true });
}

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

/** Every package directory under a node_modules tree, as paths relative to it (nested ones too). */
function packageDirs(nodeModules, prefix = '') {
  const out = [];
  if (!existsSync(nodeModules)) return out;
  for (const entry of readdirSync(nodeModules, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const names = entry.name.startsWith('@')
      ? readdirSync(path.join(nodeModules, entry.name), { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => `${entry.name}/${e.name}`)
      : [entry.name];
    for (const name of names) {
      const rel = prefix ? `${prefix}/node_modules/${name}` : name;
      out.push(rel);
      out.push(...packageDirs(path.join(nodeModules, name, 'node_modules'), rel));
    }
  }
  return out;
}

/**
 * Put each staged package's license files back and write the notices file.
 * @param {object} opts
 * @param {string} opts.stagedNodeModules — standalone/node_modules in the staged package
 * @param {string} opts.sourceNodeModules — the build's node_modules, which has the full packages
 * @param {string} opts.outFile — where THIRD_PARTY_NOTICES.md goes
 * @returns {{ packages: number, missing: string[] }} `missing`: packages with no license text found
 */
export function stageThirdPartyNotices({ stagedNodeModules, sourceNodeModules, outFile }) {
  const rows = [];
  const missing = [];
  for (const rel of packageDirs(stagedNodeModules)) {
    const staged = path.join(stagedNodeModules, rel);
    const pkg = readJson(path.join(staged, 'package.json')) || {};
    // The staged tree mirrors the build's node_modules; a nested copy may be hoisted there.
    const flat = rel.split('/node_modules/').at(-1);
    const source = [path.join(sourceNodeModules, rel), path.join(sourceNodeModules, flat)].find((dir) => existsSync(dir));
    const texts = [];
    for (const dir of [staged, source].filter(Boolean)) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const { name } = entry;
        if (!entry.isFile() || !LICENSE_FILE.test(name) || texts.includes(name)) continue;
        if (dir !== staged) copyFileSync(path.join(dir, name), path.join(staged, name));
        texts.push(name);
      }
    }
    const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type || 'UNKNOWN';
    if (!texts.length) missing.push(rel);
    rows.push(`| ${pkg.name || flat} | ${pkg.version || '?'} | ${license} | ${texts.length ? texts.map((t) => `node_modules/${rel}/${t}`).join(', ') : 'no license file in the published package'} |`);
  }
  writeFileSync(
    outFile,
    [
      '# Third-party notices',
      '',
      'The mojulo dashboard redistributes the packages below under `standalone/node_modules`, each under',
      'its own license. Each package\'s license and notice files are kept beside it; this table lists',
      'them. mojulo itself is Apache-2.0 (see LICENSE and NOTICE at the package root).',
      '',
      '| Package | Version | License | License text |',
      '|---|---|---|---|',
      ...rows.sort(),
      '',
    ].join('\n'),
  );
  return { packages: rows.length, missing };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [action, dir] = process.argv.slice(2);
  if (!dir || !['copy', 'remove'].includes(action)) {
    process.stderr.write('Usage: node scripts/license-files.mjs copy|remove <dir>\n');
    process.exit(2);
  }
  if (action === 'copy') copyProjectLicense(path.resolve(dir));
  else removeProjectLicense(path.resolve(dir));
}
