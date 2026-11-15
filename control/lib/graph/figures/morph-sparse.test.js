/**
 * Morph sparse (figures/morph-sparse.js): a face's blend-shape rows said once and only where they move. Claims under
 * test: sparse then dense is the input byte for byte; rows that are the same are stored once; a column holds only the
 * rows it moves; a small or already sparse morph is left alone; the page's reader gives the same floats as the dense
 * rows times their step.
 */
import { describe, expect, it } from 'vitest';

import { sparseMorph, denseMorph, MORPH_DECODE } from './morph-sparse.js';

const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
// (a part of 600 corners, three a vertex sharing one row, 5 columns: the rebase everywhere, each target a tenth of them)
const ROWS = 600, COLS = 5, W = COLS * 3;
const q = new Int16Array(ROWS * W);
for (let r = 0; r < ROWS; r++) { const v = Math.floor(r / 3); q[r * W] = 1 + (v % 7); for (let c = 1; c < COLS; c++) if (v % 10 === c) { q[r * W + c * 3] = 100 * c; q[r * W + c * 3 + 2] = -(v + 1); } }
const dense = { i: b64(Uint32Array.from({ length: ROWS }, (_, k) => k)), q: b64(q), s: 0.001 };

describe('morph sparse', () => {
  it('sparse then dense is the input, byte for byte, and smaller', () => {
    const sp = sparseMorph(dense);
    expect(sp.z).toBeDefined();
    expect(JSON.stringify(sp).length).toBeLessThan(JSON.stringify(dense).length / 3);
    expect(denseMorph(sp)).toEqual(dense);
    expect(sparseMorph(sp)).toBe(sp);
  });
  it('stores a shared row once and a column only where it moves', () => {
    const { z } = sparseMorph(dense);
    expect([z.r, z.c]).toEqual([ROWS, COLS]);
    // (200 vertices: the rebase moves every unique row; a target only its own tenth)
    const U = new Set(Array.from({ length: ROWS / 3 }, (_, v) => `${1 + (v % 7)}|${v % 10 < COLS && v % 10 > 0 ? v : ''}`)).size;
    expect(z.n[0]).toBe(U);
    for (let c = 1; c < COLS; c++) expect(z.n[c]).toBe(20);
  });
  it('leaves alone what it would not make smaller', () => {
    const tiny = { i: b64(Uint32Array.of(0)), q: b64(Int16Array.of(1, 2, 3, 4, 5, 6)), s: 1 };
    expect(sparseMorph(tiny)).toBe(tiny);
    expect(sparseMorph({ i: dense.i, d: 'AAAA' })).toEqual({ i: dense.i, d: 'AAAA' });
    expect(denseMorph(dense)).toBe(dense);
  });
  it('the page\'s reader gives the dense rows times their step', () => {
    const __mz = new Function('atob', `${MORPH_DECODE}\nreturn __mz;`)((s) => Buffer.from(s, 'base64').toString('latin1'));
    const f = __mz(sparseMorph(dense));
    expect(f.length).toBe(q.length);
    for (let k = 0; k < q.length; k += 37) expect(f[k]).toBeCloseTo(q[k] * dense.s, 6);
  });
});
