// kept.js: a build kept on disk only when the runner names a folder, read back bit for bit, never kept when it cannot be.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { keptOnDisk } from './kept.js';

describe('keptOnDisk', () => {
  let dir, prev;
  beforeEach(() => { prev = process.env.MOJULO_KEPT_DIR; dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kept-test-')); });
  afterEach(() => { if (prev === undefined) delete process.env.MOJULO_KEPT_DIR; else process.env.MOJULO_KEPT_DIR = prev; fs.rmSync(dir, { recursive: true, force: true }); });

  it('without a folder builds every time and touches no disk', () => {
    delete process.env.MOJULO_KEPT_DIR;
    let n = 0;
    expect(keptOnDisk('t', 'k', () => ++n)).toBe(1);
    expect(keptOnDisk('t', 'k', () => ++n)).toBe(2);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('with one, the second ask reads what the first built, bit for bit, by shelf and key', () => {
    process.env.MOJULO_KEPT_DIR = dir;
    const value = { z: -0, nan: NaN, f: new Float64Array([0.1, 1 / 3]), nested: [{ a: 1e-300 }] };
    let n = 0;
    keptOnDisk('t', 'k', () => { n++; return value; });
    const again = keptOnDisk('t', 'k', () => { n++; return null; });
    expect(n).toBe(1);
    expect(Object.is(again.z, -0)).toBe(true);
    expect(again.nan).toBeNaN();
    expect(again.f).toEqual(value.f);
    expect(again.nested).toEqual(value.nested);
    // (another key, another shelf: built)
    keptOnDisk('t', 'other', () => { n++; return 1; });
    keptOnDisk('u', 'k', () => { n++; return 1; });
    expect(n).toBe(3);
  });

  it('a value the structured clone refuses is built and returned, never kept', () => {
    process.env.MOJULO_KEPT_DIR = dir;
    const fn = () => 1;
    expect(keptOnDisk('t', 'f', () => ({ fn })).fn).toBe(fn);
    expect(fs.readdirSync(dir)).toEqual([]);
  });
});
