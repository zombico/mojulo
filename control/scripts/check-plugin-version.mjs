#!/usr/bin/env node
/**
 * Checks that the manifests published outside control/ run the version control/package.json carries.
 *
 * Three files outside the npm package start or advertise it, and each names a version by hand:
 *   - plugins/mojulo/.claude-plugin/plugin.json — the Claude plugin runs `npx -y mojulo@<version>`
 *     (the plugin directory blocks an unpinned launcher);
 *   - glama.json — the same launcher, for the Glama listing;
 *   - server.json — the MCP registry entry, `version` and the npm package's `version`.
 * Each must name exactly control/package.json's version. The marketplace entry carries no version of
 * its own (plugin.json is the source), and every `mojulo@<version>` or `mojulo-ui@<version>` written
 * anywhere under plugins/mojulo/ must be that version too (the dashboard package is published at
 * core's version and runs against the same database, so a stale pin opens an older dashboard).
 *
 * `--since <git ref>` adds the plugin cache rule: Claude Code keys an installed plugin by its
 * plugin.json `version`, so a change under plugins/mojulo/ that keeps the version never reaches
 * anyone who already installed it. Compared against the merge base of <ref> and HEAD.
 * `--expect <version>` also requires package.json to be that version (the release workflow passes
 * the tag).
 *
 * It also refuses an unfilled `<measured>` placeholder in the published prose (the READMEs npm, GitHub
 * and the plugin directory render, and docs/): a renderer drops it as an unknown HTML tag, so
 * "about <measured> MB" ships as "about  MB".
 *
 * (Until 3.0 a `--bot-image` flag also asked GHCR whether the chatbot image core pinned was
 * published. The image left with the chatbot factory, so the flag and its GHCR read are gone.)
 *
 * Usage (from the repo root or control/):
 *   node control/scripts/check-plugin-version.mjs [--since origin/main] [--expect 3.0.0]
 * Exit 0 when everything agrees, 1 with one line per problem otherwise.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const PLUGIN_DIR = 'plugins/mojulo';
export const PLUGIN_MANIFEST = `${PLUGIN_DIR}/.claude-plugin/plugin.json`;
export const MARKETPLACE_MANIFEST = '.claude-plugin/marketplace.json';
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

// The package spec in a launcher's args: `mojulo` or `mojulo@<anything>`, never `mojulo-ui` etc.
const specOf = (arg) => (typeof arg === 'string' && /^mojulo(@|$)/.test(arg) ? arg : null);

function launcherProblems(file, servers, version) {
  const problems = [];
  const entries = Object.entries(servers || {});
  if (!entries.length) problems.push(`${file}: no mcpServers entry`);
  for (const [name, server] of entries) {
    const specs = (server.args || []).map(specOf).filter(Boolean);
    if (specs.length !== 1) {
      problems.push(`${file}: mcpServers.${name} should run exactly one mojulo package spec, found ${specs.length}`);
      continue;
    }
    if (specs[0] !== `mojulo@${version}`) {
      problems.push(`${file}: mcpServers.${name} runs ${specs[0]}, expected mojulo@${version} (control/package.json)`);
    }
  }
  return problems;
}

function listFiles(root, rel) {
  const out = [];
  for (const entry of readdirSync(path.join(root, rel))) {
    const child = `${rel}/${entry}`;
    if (statSync(path.join(root, child)).isDirectory()) out.push(...listFiles(root, child));
    else out.push(child);
  }
  return out;
}

/**
 * The problems in one tree, as strings (empty when everything agrees).
 * @param {object} opts
 * @param {string} [opts.root] — the repo root
 * @param {string} [opts.expect] — a version package.json must equal
 */
export function checkManifestVersions({ root = REPO_ROOT, expect = null } = {}) {
  const read = (rel) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));
  const problems = [];
  const { version } = read('control/package.json');
  if (expect && expect !== version) problems.push(`control/package.json is ${version}, expected ${expect}`);

  const plugin = read(PLUGIN_MANIFEST);
  if (!SEMVER.test(String(plugin.version || ''))) {
    problems.push(`${PLUGIN_MANIFEST}: version ${JSON.stringify(plugin.version)} is not a semver string`);
  }
  problems.push(...launcherProblems(PLUGIN_MANIFEST, plugin.mcpServers, version));
  problems.push(...launcherProblems('glama.json', read('glama.json').mcpServers, version));

  const server = read('server.json');
  if (server.version !== version) problems.push(`server.json: version is ${server.version}, expected ${version}`);
  const npmPackages = (server.packages || []).filter((p) => p.registryType === 'npm' && p.identifier === 'mojulo');
  if (npmPackages.length !== 1) problems.push(`server.json: expected one npm package "mojulo", found ${npmPackages.length}`);
  for (const p of npmPackages) {
    if (p.version !== version) problems.push(`server.json: packages[mojulo].version is ${p.version}, expected ${version}`);
  }

  for (const entry of read(MARKETPLACE_MANIFEST).plugins || []) {
    if (entry.name === plugin.name && 'version' in entry) {
      problems.push(`${MARKETPLACE_MANIFEST}: the ${entry.name} entry sets version; plugin.json is the only source`);
    }
  }

  // A version written in prose (the README's inline command, a skill) drifts the same way, for
  // core and for the dashboard package, which is published at core's version.
  for (const rel of listFiles(root, PLUGIN_DIR)) {
    const text = readFileSync(path.join(root, rel), 'utf8');
    for (const m of text.matchAll(/\b(mojulo(?:-ui)?)@(\d+\.\d+\.\d+[0-9A-Za-z.+-]*)/g)) {
      if (m[2] !== version) problems.push(`${rel}: names ${m[1]}@${m[2]}, expected ${m[1]}@${version}`);
    }
  }
  return problems;
}

// The prose a release publishes as written: the READMEs npmjs.com, GitHub and the plugin directory
// render, and docs/. control/CHANGELOG.md is not scanned; its Unreleased section is curated at the tag.
export const PUBLISHED_PROSE = ['README.md', 'control/README.md', PLUGIN_DIR, 'docs'];
const UNPUBLISHED = new Set(['docs/STATUS.md']); // the maintainer's gitignored ledger

/** Unfilled `<measured>` placeholders in the published prose, one problem per line. */
export function checkPlaceholders({ root = REPO_ROOT } = {}) {
  const problems = [];
  for (const rel of PUBLISHED_PROSE) {
    const abs = path.join(root, rel);
    if (!existsSync(abs)) continue;
    const files = statSync(abs).isDirectory() ? listFiles(root, rel).filter((f) => f.endsWith('.md')) : [rel];
    for (const file of files) {
      if (UNPUBLISHED.has(file)) continue;
      readFileSync(path.join(root, file), 'utf8').split('\n').forEach((line, i) => {
        if (line.includes('<measured>')) problems.push(`${file}:${i + 1}: unfilled <measured> placeholder`);
      });
    }
  }
  return problems;
}

/** The cache rule: files under plugins/mojulo/ changed since `ref` but plugin.json's version did not. */
export function checkPluginVersionBump({ root = REPO_ROOT, since }) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const base = git('merge-base', since, 'HEAD');
  const changed = git('diff', '--name-only', base, '--', PLUGIN_DIR).split('\n').filter(Boolean);
  if (!changed.length) return [];
  let before = null;
  try {
    before = JSON.parse(git('show', `${base}:${PLUGIN_MANIFEST}`)).version;
  } catch {
    return []; // the plugin is new since the base
  }
  const now = JSON.parse(readFileSync(path.join(root, PLUGIN_MANIFEST), 'utf8')).version;
  return now === before
    ? [`${PLUGIN_DIR} changed since ${since} (${changed.join(', ')}) but ${PLUGIN_MANIFEST} is still version ${now}; raise it, or installed copies never update`]
    : [];
}

function parseArgs(argv) {
  const out = { since: null, expect: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--since') out.since = argv[++i];
    else if (argv[i] === '--expect') out.expect = argv[++i];
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const problems = [
    ...checkManifestVersions({ expect: args.expect }),
    ...checkPlaceholders(),
    ...(args.since ? checkPluginVersionBump({ since: args.since }) : []),
  ];
  if (problems.length) {
    for (const p of problems) process.stderr.write(`check-plugin-version: ${p}\n`);
    process.exit(1);
  }
  const { version } = JSON.parse(readFileSync(path.join(REPO_ROOT, 'control/package.json'), 'utf8'));
  process.stdout.write(`check-plugin-version: plugin.json, glama.json and server.json all run mojulo@${version}\n`);
}
