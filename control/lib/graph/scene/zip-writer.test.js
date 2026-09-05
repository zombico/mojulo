import { describe, expect, it } from 'vitest';
import zlib from 'node:zlib';

import { buildZip, crc32, readZip } from './zip-writer.js';

describe('zip-writer', () => {
  it('crc32 matches node zlib', () => {
    const b = Buffer.from('the quick brown fox jumps over the lazy dog');
    expect(crc32(b)).toBe(zlib.crc32(b));
    expect(crc32(Buffer.alloc(0))).toBe(0);
  });

  it('round-trips deflated and stored entries in order', () => {
    const zip = buildZip([
      { name: 'a.txt', data: 'hello' },
      { name: 'dir/b.bin', data: Buffer.from([1, 2, 3, 4]), method: 'store' },
    ]);
    const entries = readZip(zip);
    expect(entries.map((e) => e.name)).toEqual(['a.txt', 'dir/b.bin']);
    expect(entries[0].data.toString()).toBe('hello');
    expect(entries[0].method).toBe('deflate');
    expect(entries[1].data).toEqual(Buffer.from([1, 2, 3, 4]));
    expect(entries[1].method).toBe('store');
  });

  it('is byte-identical across calls (fixed timestamp, no wall clock)', async () => {
    const a = buildZip([{ name: 'x', data: 'same' }]);
    await new Promise((r) => setTimeout(r, 5));
    const b = buildZip([{ name: 'x', data: 'same' }]);
    expect(a.equals(b)).toBe(true);
  });

  it('aligns stored entry data to `align` bytes (the USDZ rule)', () => {
    const zip = buildZip([
      { name: 'first.usda', data: 'x'.repeat(37), method: 'store' },
      { name: 'tex.png', data: Buffer.alloc(100, 7), method: 'store' },
    ], { align: 64 });
    for (const e of readZip(zip)) expect(e.offset % 64).toBe(0);
  });

  it('rejects absolute or missing names', () => {
    expect(() => buildZip([{ name: '/abs', data: '' }])).toThrow(/relative/);
    expect(() => buildZip([{ data: '' }])).toThrow(/relative/);
  });
});
