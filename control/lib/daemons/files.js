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

export function daemonsDir() {
  return path.join(mojuloHome(), 'daemons');
}

export function portFilePath() {
  return path.join(daemonsDir(), 'port');
}

export function bearerFilePath() {
  return path.join(daemonsDir(), 'bearer');
}

export function ensureRuntimeDirs() {
  mkdirSync(daemonsDir(), { recursive: true });
}

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

export function readBearer() {
  const p = bearerFilePath();
  if (!existsSync(p)) return null;
  const raw = readFileSync(p, 'utf8').trim();
  return raw || null;
}

export function ensureBearer() {
  const existing = readBearer();
  if (existing) return existing;
  ensureRuntimeDirs();
  const bearer = randomBytes(32).toString('hex');
  writeFileSync(bearerFilePath(), bearer, { mode: 0o600 });
  return bearer;
}
