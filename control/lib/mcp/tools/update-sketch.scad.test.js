// The scad kind's EDIT readout: update_sketch on a scad row pays planScad's gates (as at mint),
// re-stamps the ledger, and answers with a readout — `changed` keyed by part NAME. Before this the
// edit re-resolved through the world registry and returned no stats at all.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, expect, it } from 'vitest';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { loadOpenscad } from '@/lib/graph/scad/scad-render';
import { createScadHandler } from './scad.js';
import { updateSketchHandler } from './sketches.js';

const hasWasm = (await loadOpenscad()) != null;

const SOURCE = [
  'module slab(w, d, h) { cube([w, d, h]); }',
  'module half_a() { color("#2b3242") slab(20, 30, 4); }',
  'module half_b() { translate([22, 0, 0]) color("#2b3242") slab(20, 30, 4); }',
].join('\n');
const PARTS = { half_a: 'half_a();', half_b: 'half_b();' };

describe.skipIf(!hasWasm)('update_sketch on a scad row', () => {
  it('a /parts patch reports the named part only; the ledger is re-stamped', async () => {
    const m = await createScadHandler({ title: 'two slabs', ref: 'sk_scad_edit', source: SOURCE, parts: PARTS, units: 'mm' });
    expect(m.ok).toBe(true);
    const r = await updateSketchHandler({ ref: 'sk_scad_edit', patch: [{ op: 'set', path: '/parts/half_b', value: 'translate([0, 0, 4]) half_b();' }] });
    expect(r.ok).toBe(true);
    expect(r.stats.readout).toBe('changed');
    expect(r.stats.parts_total).toBe(2);
    expect(r.stats.parts.map((p) => p.name)).toEqual(['half_b']);
    expect(r.stats.parts[0].base).toBe(4);
    const stored = SketchRepository.getByRef('sk_scad_edit').manifest;
    expect(stored.parts.half_b).toBe('translate([0, 0, 4]) half_b();');
    expect(stored.ledger).toMatchObject({ closed: true, faces: expect.any(Number) });
  });

  it('a /source edit re-renders everything and the shape diff says what moved; summary and full readouts', async () => {
    const taller = SOURCE.replace('slab(20, 30, 4); }\nmodule half_b', 'slab(20, 30, 8); }\nmodule half_b');
    expect(taller).not.toBe(SOURCE);
    const r = await updateSketchHandler({ ref: 'sk_scad_edit', patch: [{ op: 'set', path: '/source', value: taller }] });
    expect(r.stats.parts.map((p) => p.name)).toEqual(['half_a']);   // half_b's slab is untouched
    expect(r.stats.parts[0].top).toBe(8);
    const s = await updateSketchHandler({ ref: 'sk_scad_edit', patch: [{ op: 'set', path: '/fn', value: 32 }], readout: 'summary' });
    expect(s.stats.readout).toBe('summary');
    expect(s.stats.parts).toBeUndefined();
    const f = await updateSketchHandler({ ref: 'sk_scad_edit', patch: [{ op: 'set', path: '/fn', value: 48 }], readout: 'full' });
    expect(f.stats.parts).toHaveLength(2);
  });

  it('an edit that breaks the parts contract is refused with the mint\'s reason', async () => {
    await expect(updateSketchHandler({ ref: 'sk_scad_edit', patch: [{ op: 'set', path: '/parts/half_b', value: 'nothing_here();' }] }))
      .rejects.toThrow(/Invalid world manifest \(kind 'scad'\)/);
    await expect(updateSketchHandler({ ref: 'sk_scad_edit', patch: [{ op: 'set', path: '/source', value: 'include <BOSL2/std.scad>\nmodule half_a(){cube(1);} module half_b(){cube(1);}' }] }))
      .rejects.toThrow(/include/);
  });
});
