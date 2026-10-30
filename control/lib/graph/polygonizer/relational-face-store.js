/**
 * relational-face-store — the realistic face rig's solved shapes kept on disk (relational-face-rig.js: the rest build
 * and each action's difference over it), so a head pays its rig's builds (most of a minute) once per machine, not once
 * per process: a World page or a level of a realistic hero after a restart reads them back.
 *
 *   • THE KEY: sha256 over the rig's own key (the head's words, its fit, its parts' layout), the stored face itself (the
 *     parts the rig differences, as the figure carries them: a head the code now builds otherwise is another key), the
 *     hand-bumped `FACE_STORE_VERSION` (bump it when an ACTION changes and the rest does not) and the package version
 *     (an upgrade starts afresh), as render-etag.js salts its keys.
 *   • THE FILE: `<key>.bin`, a short JSON head ({ n, names }) and the shapes as float64, exactly as built; the newest
 *     `KEEP` kept. Best effort: a store that cannot be read or written is a build, never an error.
 *   • THE FOLDER: MOJULO_FACE_RIG_DIR (the bins seed it under the mojulo home, scripts/mojulo-paths.mjs), else
 *     data/cache/face-rig under MOJULO_DATA_DIR or the working folder; none under vitest but a suite's own
 *     (`setFaceStoreDir`).
 *
 * Server-only (node:fs, node:crypto). The rig's output is the same with the store or without it.
 */
import crypto from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { getServerVersion } from '../../server-version.js';

export const FACE_STORE_VERSION = 'v10';   // v2: the lashes turned with their lids; v3: the eyes' own targets (wide, squint, worried); v4: the FACS units, sides split; v5: the gaze's look targets; v6: the globes in the rig; v7: the speech's lips (pucker, funnel, the rolls, parted), the lips carried apart; v8: the blink rolls (the lid unrolled from under the fold, the lower lid lifted a little); v9: the corner capped, the rolled lid taut (an action's change the rest's key does not see); v10: the brow of one section carried along its pad
/** the heads kept (each a few megabytes) */
export const KEEP = 24;
const MAGIC = 'MJFR1\n';

let testDir = null;
/** (tests: the folder a suite keeps its store in; none otherwise under vitest, whatever the environment names) */
export const setFaceStoreDir = (dir) => { testDir = dir; };
export function faceStoreDir() {
  if (process.env.VITEST) return testDir;
  if (process.env.MOJULO_FACE_RIG_DIR) return process.env.MOJULO_FACE_RIG_DIR;
  return path.join(process.env.MOJULO_DATA_DIR || path.join(process.cwd(), 'data'), 'cache', 'face-rig');
}

/** the store's key for a rig's key and the stored face it differences */
export function faceStoreKey(rigKey, face) {
  return crypto.createHash('sha256').update(JSON.stringify([FACE_STORE_VERSION, getServerVersion(), rigKey, face])).digest('hex');
}

/** a head's shapes `{ V0, D }` (V0 the rest's points, D each target's Float64Array) back from the store, or null */
export function readFaceStore(key) {
  const dir = faceStoreDir();
  if (!dir) return null;
  try {
    const b = readFileSync(path.join(dir, `${key}.bin`));
    if (b.toString('latin1', 0, MAGIC.length) !== MAGIC) return null;
    const len = b.readUInt32LE(MAGIC.length), head = JSON.parse(b.toString('utf8', MAGIC.length + 4, MAGIC.length + 4 + len));
    let o = MAGIC.length + 4 + len;
    const f64 = (count) => { const a = new Float64Array(count); Buffer.from(a.buffer).set(b.subarray(o, o + count * 8)); o += count * 8; return a; };
    const v = f64(head.n * 3), V0 = Array.from({ length: head.n }, (_, i) => [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]]);
    const D = Object.fromEntries(head.names.map((name) => [name, f64(head.n * 3)]));
    return o === b.length ? { V0, D } : null;
  } catch {
    return null;
  }
}

/** keep a head's shapes; the oldest past `KEEP` leave */
export function writeFaceStore(key, { V0, D }) {
  const dir = faceStoreDir();
  if (!dir) return;
  try {
    mkdirSync(dir, { recursive: true });
    const n = V0.length, names = Object.keys(D), head = Buffer.from(JSON.stringify({ n, names }), 'utf8');
    const v = new Float64Array(n * 3); V0.forEach((p, i) => { v[i * 3] = p[0]; v[i * 3 + 1] = p[1]; v[i * 3 + 2] = p[2]; });
    const len = Buffer.alloc(4); len.writeUInt32LE(head.length);
    const body = Buffer.concat([Buffer.from(MAGIC, 'latin1'), len, head, Buffer.from(v.buffer), ...names.map((name) => Buffer.from(Float64Array.from(D[name]).buffer))]);
    const file = path.join(dir, `${key}.bin`), tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, body); renameSync(tmp, file);
    const kept = readdirSync(dir).filter((f) => f.endsWith('.bin')).map((f) => ({ f, t: statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
    for (const { f } of kept.slice(KEEP)) unlinkSync(path.join(dir, f));
  } catch {
    // (a store that cannot be written is a build next time)
  }
}
