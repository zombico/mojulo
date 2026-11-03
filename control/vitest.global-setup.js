// Once per test run, before any worker starts: the folder the realistic body's keeps share across test files
// (lib/util/kept.js). It is named for a hash of every file under lib/ but the tests, and of the lockfile, so a change
// to any of them starts an empty folder and nothing built from older code is ever read back. A CI job's folder lives
// and dies with its runner; a laptop keeps the current folder between runs and prunes the stale ones after a day.
// MOJULO_KEPT=off builds everything afresh; a MOJULO_KEPT_DIR already set is used as given.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const CONTROL = path.dirname(fileURLToPath(import.meta.url));
const SKIP = new Set(['node_modules', '.next', 'data', 'models']);

function sources(dir, out) {
  for (const name of fs.readdirSync(dir).sort()) {
    if (SKIP.has(name)) continue;
    const abs = path.join(dir, name), st = fs.statSync(abs);
    if (st.isDirectory()) sources(abs, out);
    else if (!/\.test\.m?js$/.test(name)) out.push(abs);
  }
  return out;
}

export default function setup() {
  if (process.env.MOJULO_KEPT === 'off') { delete process.env.MOJULO_KEPT_DIR; return; }
  if (process.env.MOJULO_KEPT_DIR) return;
  const h = createHash('sha256');
  for (const f of [...sources(path.join(CONTROL, 'lib'), []), path.join(CONTROL, 'package-lock.json')]) {
    if (!fs.existsSync(f)) continue;
    h.update(path.relative(CONTROL, f)); h.update('\0'); h.update(fs.readFileSync(f)); h.update('\0');
  }
  const root = path.join(os.tmpdir(), 'mojulo-kept'), dir = path.join(root, h.digest('hex').slice(0, 24));
  fs.mkdirSync(dir, { recursive: true });
  const DAY = 24 * 3600 * 1000;
  for (const name of fs.readdirSync(root)) {
    const abs = path.join(root, name);
    try { if (abs !== dir && Date.now() - fs.statSync(abs).mtimeMs > DAY) fs.rmSync(abs, { recursive: true, force: true }); } catch { /* another run's: leave it */ }
  }
  fs.utimesSync(dir, new Date(), new Date());
  process.env.MOJULO_KEPT_DIR = dir;
}
