// A geocube's trail (era/geocube.js show 'trail') draws its own seed at mint, as a new house does, so no two mints show
// the same island; a seed given, and the cube's other specimens, are left as written.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-trail-'));

import { describe, expect, it } from 'vitest';
import { createSketchHandler } from './sketch-mint.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';

const mint = async (ref, m) => SketchRepository.getByRef((await createSketchHandler({ title: ref, ref, manifest: { kind: 'geocube', cube: 'island-noon', ...m } })).ref).manifest;

describe('a geocube trail at mint', () => {
  it('draws its seed from its ref; a seed given and the land are kept as written', async () => {
    const a = await mint('sk_trail_a', { show: 'trail' });
    const b = await mint('sk_trail_b', { show: 'trail' });
    expect(Number.isInteger(a.seed) && a.seed > 0).toBe(true);
    expect(a.seed).not.toBe(b.seed);
    expect((await mint('sk_trail_given', { show: 'trail', seed: 7 })).seed).toBe(7);
    expect((await mint('sk_trail_land', { show: 'land' })).seed).toBeUndefined();
    // a micro-town draws its own too: a new street every mint
    expect(Number.isInteger((await mint('sk_town_a', { show: 'town' })).seed)).toBe(true);
  }, 120_000);
});
