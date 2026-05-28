/**
 * Minimal .env parser/serializer shared by the runner engine (which reads an
 * app's .env at spawn to harvest APP_MCP_BEARER + operator vars) and the
 * LocalRunner HTTP client (which owns env CRUD locally — env mutation is pure
 * filesystem work on the artifact and deliberately does NOT round-trip through
 * the daemon).
 *
 * Quoted values are unwrapped on read and written back bare. Comments and
 * blank lines round-trip via `raw` entries — only `KEY=value` lines are
 * touched on set/delete, so an operator-edited .env keeps its comments.
 *
 * Extracted from the pre-daemon local.js; behavior is unchanged.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function parseEnvFile(text) {
  const entries = [];
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine;
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      entries.push({ kind: 'raw', line });
      continue;
    }
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) {
      entries.push({ kind: 'raw', line });
      continue;
    }
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries.push({ kind: 'kv', key: m[1], value });
  }
  return entries;
}

export function serializeEnvFile(entries) {
  const out = [];
  for (const e of entries) {
    if (e.kind === 'raw') out.push(e.line);
    else out.push(`${e.key}=${e.value}`);
  }
  return out.join('\n');
}

export function readEnv(artifactDir) {
  const envPath = join(artifactDir, '.env');
  if (!existsSync(envPath)) return { envPath, entries: [], values: {} };
  const text = readFileSync(envPath, 'utf8');
  const entries = parseEnvFile(text);
  const values = {};
  for (const e of entries) {
    if (e.kind === 'kv') values[e.key] = e.value;
  }
  return { envPath, entries, values };
}

export function writeEnv(envPath, entries) {
  let text = serializeEnvFile(entries);
  if (!text.endsWith('\n')) text += '\n';
  writeFileSync(envPath, text);
}
