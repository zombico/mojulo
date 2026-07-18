// Isolate to an in-memory SQLite — must run before any import that pulls in db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { mintEdifice, createEdificeHandler } from './edifice.js';

beforeEach(() => { closeDb(); });

const CAMPUS = {
  masses: [
    { id: 'commons', at: [0, 0], footprint: { w: 60, d: 44 }, floors: 2, facade: { material: 'glass', rhythm: 'curtain', glass: '#8fb6c8', frame: '#34383c' }, roof: 'flat' },
    { id: 'wing', on: { anchor: 'commons', side: 'E', align: 'start', gap: 14 }, footprint: { w: 34, d: 74 }, floors: 3, facade: { material: 'brick', rhythm: 'punched', glass: '#9a6650', frame: '#6f4636' }, roof: 'mission' },
  ],
  concourses: [{ from: 'commons', to: 'wing', width: 12 }],
  entrance: 'commons',
};

describe('create_edifice mint', () => {
  it('mints a sketch with kind:edifice and returns a walkable world url + stats', async () => {
    const res = await createEdificeHandler({ ...CAMPUS, title: 'Campus', ref: 'ed_test1' });
    expect(res.ok).toBe(true);
    expect(res.ref).toBe('ed_test1');
    expect(res.worldUrl).toContain('/world');
    expect(res.stats).toMatchObject({ masses: 2, concourses: 1, maxFloors: 3 });
    expect(res.advisory.reachability.ok).toBe(true);

    const stored = SketchRepository.getByRef('ed_test1');
    expect(stored.manifest.kind).toBe('edifice');
    expect(stored.manifest.masses).toHaveLength(2);
  });

  it('refuses an empty masses array', async () => {
    await expect(createEdificeHandler({ masses: [] })).rejects.toThrow(/masses/);
  });

  it('surfaces a validation error at mint (concourse between non-facing masses)', () => {
    expect(() => mintEdifice({
      masses: [
        { id: 'a', at: [0, 0], footprint: { w: 20, d: 20 }, floors: 1, facade: { material: 'glass', glass: '#89a', frame: '#333' } },
        { id: 'b', at: [0, 0], footprint: { w: 20, d: 20 }, floors: 1, facade: { material: 'glass', glass: '#89a', frame: '#333' } },
      ],
      concourses: [{ from: 'a', to: 'b', width: 8 }],
      ref: 'ed_bad',
    })).toThrow(/overlap|facing/);
  });

  it('mints an unreachable mass but SURFACES it (advisory, never gated)', async () => {
    const res = await createEdificeHandler({
      masses: [
        ...CAMPUS.masses,
        { id: 'shed', on: { anchor: 'wing', side: 'E', align: 'center', gap: 8 }, footprint: { w: 18, d: 18 }, floors: 1, facade: { material: 'brick', glass: '#844', frame: '#633' }, roof: 'flat' },
      ],
      concourses: CAMPUS.concourses,      // no hall to 'shed'
      entrance: 'commons', ref: 'ed_test2',
    });
    expect(res.ok).toBe(true);                              // still minted
    expect(res.advisory.reachability.ok).toBe(false);
    expect(res.note).toMatch(/shed/);
    expect(SketchRepository.getByRef('ed_test2')).toBeTruthy();
  });
});
