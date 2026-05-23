/**
 * Local-state readers for `check_for_updates`.
 *
 * Returns what the *running* control plane thinks it is:
 *   - Control-plane package version, read from control/package.json.
 *   - Pinned bot image, read from process.env.BOT_IMAGE, falling back to the
 *     same default string baked into lib/deployers/docker.js.
 *
 * Kept separate from remote.js so the local read is cheap and never fails on
 * registry outage — the tool can still report current state even when the
 * upstream check 404s.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mirror of the default in lib/deployers/docker.js — kept here so this module
// doesn't import docker.js (which pulls in archiver / storage deps). When the
// pin in docker.js moves, this one should too; the existing `version` tool in
// lib/mcp/tools/context.js carries the same mirrored constant for the same
// reason. A stale display here just means the tool reports the older tag —
// deploys still use the docker.js value.
const DEFAULT_BOT_IMAGE = 'ghcr.io/zombico/mojulo-bot:0.5.1';

// Memoize the package.json read — it doesn't change during process lifetime.
let cachedPkg = null;

function readControlPlanePkg() {
  if (cachedPkg) return cachedPkg;
  // Resolve relative to this file rather than process.cwd(): the control plane
  // can be launched from anywhere (npx, source clone, IDE), and cwd is not
  // reliably the package root.
  const pkgPath = path.resolve(__dirname, '..', '..', 'package.json');
  const raw = fs.readFileSync(pkgPath, 'utf8');
  cachedPkg = JSON.parse(raw);
  return cachedPkg;
}

export function getControlPlaneVersion() {
  return readControlPlanePkg().version;
}

export function getControlPlanePackageName() {
  return readControlPlanePkg().name;
}

export function getBotImagePin() {
  const fromEnv = process.env.BOT_IMAGE;
  if (fromEnv) {
    return { image: fromEnv, source: 'env BOT_IMAGE' };
  }
  return { image: DEFAULT_BOT_IMAGE, source: 'docker.js default' };
}

/**
 * Split `ghcr.io/zombico/mojulo-bot:0.5.1` into `{ repo, tag }`. Returns
 * `{ repo, tag: null }` if no tag is present (treat as `:latest`, which we
 * deliberately never produce on the control-plane side).
 */
export function parseImageRef(image) {
  const lastColon = image.lastIndexOf(':');
  const lastSlash = image.lastIndexOf('/');
  if (lastColon > lastSlash) {
    return { repo: image.slice(0, lastColon), tag: image.slice(lastColon + 1) };
  }
  return { repo: image, tag: null };
}

/**
 * Heuristic: are we running from a source clone (vs an installed npm package)?
 * Used to tailor the install hint — a clone-user runs `git pull`, an npm-user
 * runs `npm i -g mojulo@latest`. Checked by looking for a `.git` dir adjacent
 * to the package root.
 */
export function isSourceClone() {
  try {
    const pkgRoot = path.resolve(__dirname, '..', '..');
    // .git can be a dir (normal clone) or a file (worktree). Either indicates
    // the package lives inside a checkout.
    const gitPath = path.join(pkgRoot, '..', '.git');
    return fs.existsSync(gitPath);
  } catch {
    return false;
  }
}
