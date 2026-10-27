/**
 * The rock's relief (form/rock-relief.js): a heartbeat at a cliff's scale read and mapped — one preset per kind of mark
 * it leans on (a ledge's cliff, a crack's gorge), not the catalog.
 */
import { describe, expect, it } from 'vitest';

import { readRelief, reliefMap, RELIEF_PRESETS, RELIEF_MAX } from './rock-relief.js';

// the presets whose marks are a ledge (cliff) and a crack (gorge): the two procedures a face's map runs through
const byOp = (op) => Object.values(RELIEF_PRESETS).find((p) => p.marks.some((m) => m.op === op)).id;

describe('the rock\'s relief', () => {
  it('reads a preset, a document and a copy with changes; refuses what is not a face\'s', () => {
    expect(readRelief(byOp('cliff')).marks.length).toBeGreaterThan(0);
    const R = readRelief({ from: byOp('cliff'), pulse: { swell: 0.3 } });
    expect(R.pulse.swell).toBe(0.3);
    expect(R.pulse.wave).toBe(RELIEF_PRESETS[byOp('cliff')].pulse.wave);
    expect(() => readRelief('nope')).toThrow(/not a relief/);
    expect(() => readRelief({ marks: [{ op: 'rise', points: [[0, 0], [1, 1]] }] })).toThrow(/op one of/);
    expect(() => readRelief({ marks: [{ op: 'raise', at: [0.5, 0.5], height: RELIEF_MAX + 1 }] })).toThrow(/metres/);
    // (the heartbeat's own reader checks the mark: a cliff needs its high side)
    expect(() => readRelief({ marks: [{ op: 'cliff', path: [[0, 0.5], [1, 0.5]], height: 0.2 }] })).toThrow(/side/);
  });

  it('maps a face that wraps, centred on its mean, within a metre, and the same for the same seed', () => {
    const R = readRelief(byOp('gorge')), M = reliefMap(R, { seed: 4, cell: 0.25 }), N = M.size, h = (i, j) => M.h[(((j % N) + N) % N) * N + (((i % N) + N) % N)];
    expect(Buffer.from(M.h.buffer).equals(Buffer.from(reliefMap(R, { seed: 4, cell: 0.25 }).h.buffer))).toBe(true);
    expect(M.h.reduce((s, v) => s + v, 0) / M.h.length).toBeCloseTo(0, 5);
    expect(Math.max(-M.lo, M.hi)).toBeLessThanOrEqual(RELIEF_MAX);
    // (across the tile's edge the face runs on as it does between any two cells inside it)
    let edge = 0, inner = 0;
    for (let j = 0; j < N; j++) { edge = Math.max(edge, Math.abs(h(0, j) - h(N - 1, j)), Math.abs(h(j, 0) - h(j, N - 1))); inner = Math.max(inner, Math.abs(h(1, j) - h(0, j)), Math.abs(h(j, 1) - h(j, 0))); }
    expect(edge).toBeLessThanOrEqual(inner * 1.5 + 1e-6);
    // (another seed, another face of the same kind)
    expect(Buffer.from(reliefMap(R, { seed: 5, cell: 0.25 }).h.buffer).equals(Buffer.from(M.h.buffer))).toBe(false);
  });

  it('a ledge stands out below its line and steps back above it', () => {
    const R = readRelief({ tile: 24, marks: [{ op: 'cliff', path: [[0.1, 0.5], [0.9, 0.5]], height: 0.3, side: 'right', face: 75, reach: 3 }] });
    const M = reliefMap(R, { seed: 1, cell: 0.1 }), N = M.size, at = (u, v) => M.h[Math.round(v * N - 0.5) * N + Math.round(u * N - 0.5)];
    // (the bench stands out over its reach, 3 m below the line; the seed nudges the line by up to 0.72 m: read 1.5 m off it)
    expect(at(0.5, 0.5 - 1.5 / 24) - at(0.5, 0.5 + 1.5 / 24)).toBeGreaterThan(0.2);
  });
});
