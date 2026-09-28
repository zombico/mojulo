/**
 * Local-state readers for `check_for_updates`.
 *
 * Returns what the *running* control plane thinks it is: the control-plane
 * package name and version, read from control/package.json. (Until 3.0 it also
 * read the pinned chatbot image; that pin left with the chatbot factory.)
 *
 * Kept separate from remote.js so the local read is cheap and never fails on
 * registry outage — the tool can still report current state even when the
 * upstream check 404s.
 */

import fs from 'fs';
import path from 'path';
import { moduleDir } from '../module-dir.js';
const __dirname = moduleDir(import.meta.url, 'lib/version');

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
