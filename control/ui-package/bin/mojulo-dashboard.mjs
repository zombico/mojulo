#!/usr/bin/env node
/**
 * mojulo-dashboard — starts the mojulo dashboard from this package's prebuilt Next.js server.
 *
 * The launcher is core's (mojulo/scripts/ui-launch.mjs). This package depends on mojulo at its own
 * exact version, finds it from its own location, and hands it the standalone build it ships.
 * core's `mojulo-ui` bin runs this file when it finds this package beside it.
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const own = readJson(path.join(ROOT, 'package.json'));

function fail(message) {
  process.stderr.write(`${own.name}: ${message}\n`);
  process.exit(1);
}

// The mojulo this package installed with. A repo checkout keeps this package at
// control/ui-package, inside core, where no node_modules/mojulo exists.
function coreRoot() {
  try {
    return path.dirname(createRequire(import.meta.url).resolve('mojulo/package.json'));
  } catch {
    const repoCore = path.resolve(ROOT, '..');
    try {
      if (readJson(path.join(repoCore, 'package.json')).name === 'mojulo') return repoCore;
    } catch {}
    return null;
  }
}

const core = coreRoot();
if (!core) fail(`cannot find the mojulo package it runs on (mojulo@${own.version}). Reinstall: npx -y ${own.name}@${own.version}`);
const coreVersion = readJson(path.join(core, 'package.json')).version;
if (coreVersion !== own.version) {
  fail(
    `${own.version} found mojulo ${coreVersion} at ${core}. The dashboard runs only on its own version: it carries a `
      + `compiled copy of mojulo's code, and both share one database. Run: npx -y ${own.name}@${coreVersion}`,
  );
}

const { UI_STANDALONE_DIR } = await import(
  pathToFileURL(path.join(core, 'lib', 'version', 'ui-package.js')).href
);
const { startDashboard } = await import(pathToFileURL(path.join(core, 'scripts', 'ui-launch.mjs')).href);

await startDashboard({
  standaloneServer: path.join(ROOT, UI_STANDALONE_DIR, 'server.js'),
  argv: process.argv.slice(2),
  // Resolved from this package, which declares it; core does not.
  openUrl: async (url) => (await import('open')).default(url),
});
