/**
 * sound-library — the installed RECORDED sound library, read where the operator installed it: `$MOJULO_SOUNDS_DIR`,
 * else `<$MOJULO_HOME or ~/.mojulo>/sounds`. The library is an index (`library.json`: cards, each a list of variants
 * named by their bytes' hash) and its masters (`masters/<id>.wav`). Nothing here ships audio and nothing here fetches:
 * a machine without the library reads `null`, and every sound that would have played a recording plays the
 * synthesized voice it stands in for.
 *
 *   `libraryDir()`              where the library is looked for
 *   `readLibrary()`             the index, or null when none is installed (read once per directory)
 *   `sampleSlice(cards)`        what an engine's `loadSamples` takes for those card names: { cards: { <card>: [id…] },
 *                               bytes: { <id>: Buffer } }, only the cards the library holds; null when it holds none
 *   `sampleSliceBase64(cards)`  the same with the bytes as base64, for a page to inline: each variant's MP3 where the
 *                               library carries one (`masters/<id>.mp3`, a tenth of the WAV), else its WAV
 *   `recordedFor(shelfId)`      the card that records a shelf row (its `shelf`), as { card, dur: the longest variant's
 *                               seconds, variants }, or null: no library, no card for the row, or none of its masters here
 *
 * Reads files; timeless (no clock: a variant is named by its content).
 */
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ID = /^[0-9a-f]{16}$/;

export function libraryDir() {
  if (process.env.MOJULO_SOUNDS_DIR) return process.env.MOJULO_SOUNDS_DIR;
  return path.join(process.env.MOJULO_HOME || path.join(os.homedir(), '.mojulo'), 'sounds');
}

const read = new Map();
export function readLibrary() {
  const dir = libraryDir();
  if (read.has(dir)) return read.get(dir);
  const file = path.join(dir, 'library.json');
  let lib = null;
  if (existsSync(file)) {
    try { lib = JSON.parse(readFileSync(file, 'utf8')); } catch { lib = null; }
    if (!lib || typeof lib.cards !== 'object') lib = null;
  }
  read.set(dir, lib);
  return lib;
}

/** for tests: forget what was read */
export function forgetLibrary() { read.clear(); recorded.clear(); }

const recorded = new Map();
export function recordedFor(shelfId) {
  const dir = libraryDir(), key = `${dir}\n${shelfId}`;
  if (!recorded.has(key)) recorded.set(key, findRecorded(dir, shelfId));
  return recorded.get(key);
}
function findRecorded(dir, shelfId) {
  const lib = readLibrary();
  if (!lib) return null;
  for (const name of Object.keys(lib.cards).sort()) {
    const c = lib.cards[name];
    if (!c || c.shelf !== shelfId || c.role === 'bed') continue;
    const held = (c.variants || []).filter((v) => ID.test(v.id) && existsSync(path.join(dir, 'masters', `${v.id}.wav`)));
    if (!held.length) continue;
    return { card: name, dur: Math.max(...held.map((v) => Number(v.seconds) || 0)), variants: held.length };
  }
  return null;
}

export function sampleSlice(cards, { compact = false } = {}) {
  const lib = readLibrary();
  if (!lib) return null;
  const dir = libraryDir(), out = { cards: {}, bytes: {} };
  for (const name of [...new Set(cards || [])].sort()) {
    const card = lib.cards[name];
    if (!card) continue;
    const ids = [];
    for (const v of card.variants || []) {
      if (!ID.test(v.id)) continue;
      const file = path.join(dir, 'masters', `${v.id}.wav`), mp3 = path.join(dir, 'masters', `${v.id}.mp3`);
      if (!existsSync(file)) continue;
      out.bytes[v.id] = readFileSync(compact && existsSync(mp3) ? mp3 : file);
      ids.push(v.id);
    }
    if (ids.length) out.cards[name] = ids;
  }
  return Object.keys(out.cards).length ? out : null;
}

export function sampleSliceBase64(cards) {
  const s = sampleSlice(cards, { compact: true });
  if (!s) return null;
  return { cards: s.cards, bytes: Object.fromEntries(Object.entries(s.bytes).map(([id, b]) => [id, b.toString('base64')])) };
}
