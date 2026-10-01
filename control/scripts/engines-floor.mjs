/**
 * Which packages in an installed tree refuse the Node version mojulo declares as its floor.
 *
 * `npx -y mojulo@<v>` resolves every dependency range fresh (a published package carries no
 * lockfile), so an upstream release can raise a transitive `engines.node` above mojulo's floor:
 * pdf2json 4.1.0 declared `>=22.23.2` while mojulo, puppeteer-core and the plugin README promise
 * Node 22.14. npm then warns on every first start (EBADENGINE), and under a user's
 * `engine-strict=true` the install fails and the MCP server never answers `initialize`. The cold
 * install smoke (smoke-cold-install.mjs) runs this over the fresh tree.
 *
 * Reads npm's hidden lockfile (node_modules/.package-lock.json), which records each installed
 * package's `engines` and whether it is optional. Optional packages are skipped: npm leaves out an
 * optional one it cannot use, and platform builds (sharp's per-OS binaries) declare narrow ranges.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

/** `semver`, as npm and half the tree already install it; null when it cannot be loaded. */
function loadSemver() {
  try {
    return require('semver');
  } catch {
    return null;
  }
}

/** The lowest Node version an `engines.node` range allows (`>=22.14.0` → `22.14.0`). */
export function floorOf(range) {
  const semver = loadSemver();
  return semver?.minVersion(range)?.version ?? null;
}

/**
 * The installed, non-optional packages whose `engines.node` the floor does not satisfy.
 * @param {string} nodeModules — the install's node_modules
 * @param {string} floor — a Node version (`22.14.0`)
 * @returns {{ checked: boolean, violations: { name: string, version: string, range: string }[] }}
 *   `checked` is false when semver or the hidden lockfile is unavailable.
 */
export function enginesViolations(nodeModules, floor) {
  const semver = loadSemver();
  let lock;
  try {
    lock = JSON.parse(readFileSync(path.join(nodeModules, '.package-lock.json'), 'utf8'));
  } catch {
    lock = null;
  }
  if (!semver || !lock?.packages) return { checked: false, violations: [] };
  const violations = [];
  for (const [key, entry] of Object.entries(lock.packages)) {
    const range = entry?.engines?.node;
    if (!range || entry.optional || entry.dev) continue;
    if (semver.satisfies(floor, range, { includePrerelease: true })) continue;
    violations.push({ name: key.split('node_modules/').at(-1), version: entry.version, range });
  }
  return { checked: true, violations };
}
