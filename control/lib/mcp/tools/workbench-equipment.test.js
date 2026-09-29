// An equipment build through the real mint path: the words are stored (stamped with the laws), the readout names the
// focal and sockets, a dial patch restyles in place, a bad build fails the mint naming the choices, and an assembler
// freezes a built item as its words.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createWorkbenchHandler } from './workbench.js';
import { createAssemblerHandler } from './assembler.js';
import { updateSketchHandler } from './sketches.js';
import { LAWS_VERSION } from '@/lib/graph/equipment/expand';

beforeEach(() => { closeDb(); });
const STAFF = { type: 'equipment', item: 'staff', style: 'druid', seed: 3 };

describe('mint_solid workbench { build }', () => {
  it('stores the words, stamped with the laws, and reads out the focal and sockets', async () => {
    const r = await createWorkbenchHandler({ title: 'druid staff', ref: 'eq-staff', units: 'cm', build: STAFF });
    const stored = SketchRepository.getByRef('eq-staff').manifest;
    expect(stored.build).toEqual({ ...STAFF, laws: LAWS_VERSION });
    expect(stored.lofts).toBeUndefined();                                // the expansion is never stored
    expect(r.stats.equipment.focal.gem).toBe('tourmaline');
    expect(r.stats.equipment.sockets.grip.origin).toHaveLength(3);
    expect(r.stats.ledger.closed).toBe(true);
    expect(r.stats.ledger.recipe_bytes).toBeLessThan(300);
  });
  it('a dial patch restyles in place', async () => {
    await createWorkbenchHandler({ title: 'sword', ref: 'eq-sword', units: 'cm', build: { type: 'equipment', item: 'sword', style: 'celestial', seed: 3 } });
    const r = await updateSketchHandler({ ref: 'eq-sword', patch: [{ op: 'set', path: '/build/dials', value: { stylize: 1 } }] });
    expect(r.ok).toBe(true);
    expect(SketchRepository.getByRef('eq-sword').manifest.build.dials.stylize).toBe(1);
  });
  it('a bad build fails the mint and names the choices', async () => {
    await expect(createWorkbenchHandler({ title: 'x', ref: 'eq-bad', build: { type: 'equipment', item: 'halberd', style: 'druid' } })).rejects.toThrow(/dagger, sword, greatsword, staff, bow, shield/);
  });
  it('an assembler freezes a built item as its words', async () => {
    await createWorkbenchHandler({ title: 'bow', ref: 'eq-bow', units: 'cm', build: { type: 'equipment', item: 'bow', style: 'elven', seed: 3 } });
    const r = await createAssemblerHandler({ title: 'rack', ref: 'eq-rack', units: 'cm', items: [{ source: { ref: 'eq-bow' }, at: [0, 0, 0] }] });
    expect(r.ref).toBe('eq-rack');
    const items = SketchRepository.getByRef('eq-rack').manifest.items;
    expect(items[0].source.build.item).toBe('bow');
  });
});
