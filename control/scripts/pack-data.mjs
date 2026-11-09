#!/usr/bin/env node
/**
 * pack-data.mjs — the studio's work as ONE file, to carry it from one machine to another (a cloud box's session to the
 * operator's laptop: the workshop's `local` path, lib/graph/game/workshop.js). The database is written whole and
 * compact (SQLite's VACUUM INTO: every row, the write-ahead log folded in, nothing half-written), then gzipped. The
 * storage folder (uploads, renders a sketch keeps) is not in the database: when it holds anything, it is named, to be
 * copied beside it.
 *
 * Usage (from control/, repo-dev sets MOJULO_DATA_DIR; an install: npx mojulo script pack-data):
 *   node scripts/pack-data.mjs [--out <file.db.gz>]
 * Prints one JSON line: { file, bytes, rows: { sketches }, storage?, restore }.
 * Restoring is a drop-in: gunzip it as the data folder's mojulo-lite.db (an install: ~/.mojulo/data; the repo:
 * control/data), the old one moved aside first, with nothing running on it.
 */
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { createRequire } from 'node:module';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

const { values } = parseArgs({ options: { out: { type: 'string' } } });
const { dbPath, storageRoot, outcomesDir } = resolveMojuloPaths();
if (!fs.existsSync(dbPath)) { process.stderr.write(`pack-data: no database at ${dbPath}\n`); process.exit(1); }
const Database = createRequire(import.meta.url)('better-sqlite3');
const out = path.resolve(values.out ?? path.join(outcomesDir, 'mojulo-data.db.gz'));
fs.mkdirSync(path.dirname(out), { recursive: true });
const tmp = `${out.replace(/\.gz$/, '')}.tmp`;
fs.rmSync(tmp, { force: true });
const db = new Database(dbPath, { readonly: true });
db.prepare('VACUUM INTO ?').run(tmp);
db.close();
const check = new Database(tmp, { readonly: true });
const ok = check.pragma('integrity_check', { simple: true });
const sketches = check.prepare('SELECT count(*) AS c FROM sketches').get().c;
check.close();
if (ok !== 'ok') { fs.rmSync(tmp, { force: true }); process.stderr.write(`pack-data: the copy failed its integrity check (${ok})\n`); process.exit(1); }
await pipeline(fs.createReadStream(tmp), zlib.createGzip({ level: 9 }), fs.createWriteStream(out));
fs.rmSync(tmp, { force: true });
// (the storage folder: named when it holds anything, to be carried beside the database)
const count = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(d, e.name)) : 1), 0) : 0);
const stored = count(storageRoot);
process.stdout.write(`${JSON.stringify({
  file: out, bytes: fs.statSync(out).size, rows: { sketches },
  ...(stored ? { storage: { dir: storageRoot, files: stored, says: 'copy this folder beside the database too' } } : {}),
  restore: 'gunzip it as the data folder\'s mojulo-lite.db (an install: ~/.mojulo/data; the repo: control/data), the old one moved aside first, nothing running on it',
})}\n`);
