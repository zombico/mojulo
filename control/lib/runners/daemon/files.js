/**
 * Filesystem rendezvous between the app-runtime daemon and its in-process
 * HTTP clients (the LocalRunner shim in lib/runners/local.js).
 *
 * Layout under MOJULO_HOME (default ~/.mojulo), symmetric with how the other
 * bins resolve state via scripts/mojulo-paths.mjs:
 *
 *   ~/.mojulo/app-runtime/port      — the daemon's chosen 127.0.0.1 port (text)
 *   ~/.mojulo/app-runtime/bearer    — shared secret, 0600, minted on first boot
 *   ~/.mojulo/app-runtime/runs/     — one <running_ref>.json pidfile per app
 *
 * The daemon WRITES port + bearer on boot; the client READS them before each
 * request. Binding to port 0 (the default) means the OS picks a free port and
 * the daemon advertises it through the port file — no fixed-port conflict.
 */

import os from 'node:os';
import path from 'node:path';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';

export function mojuloHome() {
  return process.env.MOJULO_HOME || path.join(os.homedir(), '.mojulo');
}

export function appRuntimeDir() {
  return path.join(mojuloHome(), 'app-runtime');
}

export function runsDir() {
  return path.join(appRuntimeDir(), 'runs');
}

export function portFilePath() {
  return path.join(appRuntimeDir(), 'port');
}

export function bearerFilePath() {
  return path.join(appRuntimeDir(), 'bearer');
}

/** Create the app-runtime dir tree if absent. Idempotent. */
export function ensureRuntimeDirs() {
  mkdirSync(runsDir(), { recursive: true });
}

/**
 * Read the daemon's advertised port, or null if the daemon has never written
 * one (i.e. it isn't running / has never run). Clients treat null as
 * "daemon unreachable".
 */
export function readPort() {
  const p = portFilePath();
  if (!existsSync(p)) return null;
  const raw = readFileSync(p, 'utf8').trim();
  const port = Number.parseInt(raw, 10);
  return Number.isFinite(port) && port > 0 ? port : null;
}

export function writePort(port) {
  ensureRuntimeDirs();
  writeFileSync(portFilePath(), String(port), { mode: 0o600 });
}

/**
 * Read the shared bearer, or null if absent. Clients with a null bearer treat
 * the daemon as unreachable (no secret to authenticate with).
 */
export function readBearer() {
  const p = bearerFilePath();
  if (!existsSync(p)) return null;
  const raw = readFileSync(p, 'utf8').trim();
  return raw || null;
}

/**
 * Read the existing bearer or mint one (32 random bytes hex, 0600). Called by
 * the daemon on boot. Reusing an existing bearer across restarts keeps any
 * client that cached it working; rotation is `rm bearer && restart`.
 */
export function ensureBearer() {
  const existing = readBearer();
  if (existing) return existing;
  ensureRuntimeDirs();
  const bearer = randomBytes(32).toString('hex');
  writeFileSync(bearerFilePath(), bearer, { mode: 0o600 });
  return bearer;
}
