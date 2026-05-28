/**
 * Per-app run records under ~/.mojulo/app-runtime/runs/<running_ref>.json.
 *
 * Written by the engine on spawn, removed on intentional stop, and read by
 * reconcile-on-boot to decide whether a pre-restart app is still alive (adopt)
 * or dead (sweep). The record is the daemon's only durable handle on a process
 * it spawned in a previous life — the in-memory Map dies with the daemon, the
 * pidfile survives.
 *
 * Shape: { runningRef, appPid, sidecarPid, url, sidecarUrl, bearer,
 *          artifactRef, appName, serverName, materializationRef, startedAt }.
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  readdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { runsDir, ensureRuntimeDirs } from './files.js';

function pidfilePath(runningRef) {
  return join(runsDir(), `${runningRef}.json`);
}

export function writePidfile(record) {
  if (!record || typeof record.runningRef !== 'string') {
    throw new Error('writePidfile requires a record with a runningRef');
  }
  ensureRuntimeDirs();
  writeFileSync(pidfilePath(record.runningRef), JSON.stringify(record, null, 2), {
    mode: 0o600,
  });
}

export function readPidfile(runningRef) {
  const p = pidfilePath(runningRef);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    // A corrupt pidfile is treated as absent — reconcile will sweep it.
    return null;
  }
}

export function removePidfile(runningRef) {
  const p = pidfilePath(runningRef);
  if (existsSync(p)) {
    try {
      unlinkSync(p);
    } catch {
      /* best-effort */
    }
  }
}

/** Every pidfile record currently on disk. Skips corrupt/unparseable files. */
export function listPidfiles() {
  let names;
  try {
    names = readdirSync(runsDir());
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const runningRef = name.slice(0, -'.json'.length);
    const rec = readPidfile(runningRef);
    if (rec) out.push(rec);
  }
  return out;
}

/**
 * Is `pid` a live process this user can signal? `kill(pid, 0)` sends no
 * signal but performs the existence + permission check. ESRCH = gone, EPERM =
 * alive but owned by another user (treated as alive — we can't prove it dead).
 */
export function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === 'EPERM';
  }
}
