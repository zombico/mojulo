/**
 * The last print reading per MCP session: what measure_solid (or a print export) measured, for which recipe and
 * params, so a repeat names the reading the agent already has instead of reading it again.
 *
 * Keyed by session: only an agent that saw a reading is told "the same as before". Without a session id (the CLI,
 * a test) nothing is remembered and every call measures. The recipe is part of the key, so any edit measures anew.
 * Bounded: the newest READINGS_PER_SESSION readings per session, the newest SESSIONS sessions.
 */
import { createHash } from 'node:crypto';

const SESSIONS = 64;
const READINGS_PER_SESSION = 32;
const bySession = new Map();

/** A stable key for a reading: the ref, a hash of its recipe, and the params that change the numbers. */
export function readingKey(ref, manifest, params) {
  const recipe = createHash('sha256').update(JSON.stringify(manifest ?? null)).digest('hex').slice(0, 16);
  return `${ref}|${recipe}|${JSON.stringify(params ?? {})}`;
}

/** The reading kept for this session and key, or null. */
export function lastReading(sessionId, key) {
  if (!sessionId) return null;
  return bySession.get(sessionId)?.get(key) ?? null;
}

/** Keep a reading ({ tool, size_mm, advisories, … }) for this session under one key or several. */
export function keepReading(sessionId, keys, reading) {
  if (!sessionId) return;
  let readings = bySession.get(sessionId);
  if (!readings) {
    readings = new Map();
    bySession.set(sessionId, readings);
    while (bySession.size > SESSIONS) bySession.delete(bySession.keys().next().value);
  }
  const kept = { ...reading, at: new Date().toISOString() };
  for (const key of [keys].flat()) {
    readings.delete(key);
    readings.set(key, kept);
  }
  while (readings.size > READINGS_PER_SESSION) readings.delete(readings.keys().next().value);
}

/** Tests only. */
export function _resetPrintReadings() {
  bySession.clear();
}
