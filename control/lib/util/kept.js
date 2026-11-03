// kept.js — a build kept across test files: the second shelf behind a module's in-memory keep, on disk, under test only.
//
// The realistic hero's slice and head cost tens of seconds and are kept in memory by what they read (layered.js SLICES,
// HEADS and the hair's keeps), but every test file starts a fresh module graph, so every file that asked for a realistic
// body paid for it again. Under test the runner (vitest.global-setup.js) names a folder in MOJULO_KEPT_DIR, one per hash
// of the sources, so a change to any source starts an empty one; a miss in memory reads that folder before it builds,
// and writes what it built. Unset (every install, every page, every script) nothing here touches the disk.
//
// Values go through v8.serialize: the structured clone the in-memory keeps already read through (structuredClone), so
// a kept value is the built one bit for bit (−0, NaN, typed arrays). A value that cannot be cloned is built, not kept.
import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';
import { threadId } from 'node:worker_threads';
import { createHash } from 'node:crypto';

/** `build()`, or what an earlier test file built for the same `shelf` and `key` (a string) under the same sources. */
export function keptOnDisk(shelf, key, build) {
  const dir = process.env.MOJULO_KEPT_DIR;
  if (!dir) return build();
  const file = path.join(dir, `${shelf}-${createHash('sha256').update(key).digest('hex')}.v8`);
  try { return v8.deserialize(fs.readFileSync(file)); } catch { /* not kept yet, or unreadable: build it */ }
  const value = build();
  // (written whole, then renamed, so a reader in another worker never sees half a file)
  const tmp = `${file}.${process.pid}-${threadId}.tmp`;
  try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(tmp, v8.serialize(value)); fs.renameSync(tmp, file); } catch { try { fs.rmSync(tmp, { force: true }); } catch { /* nothing to clean */ } }
  return value;
}
