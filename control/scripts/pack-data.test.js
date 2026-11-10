import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

// PACK-DATA: the studio's database carried as one gzipped file, whole (the write-ahead log folded in) and checked.
const Database = createRequire(import.meta.url)('better-sqlite3');

describe('pack-data', () => {
  it('writes the database as one gzipped file that opens with every row', () => {
    const d = mkdtempSync(path.join(tmpdir(), 'pack-data-')), db = path.join(d, 'data', 'mojulo-lite.db');
    execFileSync('mkdir', ['-p', path.dirname(db)]);
    const w = new Database(db);
    w.pragma('journal_mode = WAL');
    w.exec('CREATE TABLE sketches (ref TEXT PRIMARY KEY, body TEXT)');
    for (let i = 0; i < 5; i++) w.prepare('INSERT INTO sketches VALUES (?, ?)').run(`s-${i}`, 'x'.repeat(100));
    const out = path.join(d, 'carry.db.gz');
    const said = JSON.parse(execFileSync(process.execPath, [path.join(process.cwd(), 'scripts', 'pack-data.mjs'), '--out', out], { env: { ...process.env, MOJULO_HOME: d, MOJULO_DATA_DIR: path.join(d, 'data'), SQLITE_PATH: db, MOJULO_OUTCOMES_DIR: path.join(d, 'out') } }).toString());
    w.close();
    expect(said).toMatchObject({ file: out, rows: { sketches: 5 } });
    expect(said.restore).toMatch(/mojulo-lite\.db/);
    const back = path.join(d, 'back.db');
    writeFileSync(back, gunzipSync(readFileSync(out)));
    const r = new Database(back, { readonly: true });
    expect(r.prepare('SELECT count(*) AS c FROM sketches').get().c).toBe(5);
    r.close();
    rmSync(d, { recursive: true, force: true });
  });
});
