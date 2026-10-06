// mint_solid kind 'scad' via 'fabricate': the plan first (nothing minted), then the source minted with the plan frozen.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, expect, it } from 'vitest';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { loadOpenscad } from '@/lib/graph/scad/scad-render';
import { mintSolidHandler } from './mint-solid.js';

const hasWasm = (await loadOpenscad()) != null;
const NEEDS = [{ id: 'lid', function: 'fasten', tags: ['serviceable'], count: 4 }, { id: 'axle', function: 'spin', shaftD: 8 }];

describe("mint_solid via 'fabricate'", () => {
  it('without a source hands back the plan and mints nothing', async () => {
    const before = SketchRepository.list ? SketchRepository.list().length : null;
    const r = await mintSolidHandler({ kind: 'scad', via: 'fabricate', spec: { host: 'printed', needs: NEEDS } });
    expect(r).toMatchObject({ ok: true, phase: 'plan', minted: false });
    expect(r.fabrication.needs.map((n) => n.strategy)).toEqual(['heatset-bolt', 'ball-bearing']);
    expect(r.fabrication.modules).toContain('mj_bearing_seat');
    expect(r.next).toMatch(/call mint_solid again/);
    if (before !== null) expect(SketchRepository.list().length).toBe(before);
  });

  it('a bad needs list is taught, with the scad card pointer', async () => {
    await expect(mintSolidHandler({ kind: 'scad', via: 'fabricate', spec: { needs: [{ function: 'weld' }] } }))
      .rejects.toThrow(/not one of fasten.*get_solid_vocab\(\{ id: 'scad' \}\)/);
  });

  it.skipIf(!hasWasm)('with a source mints a scad row, the plan frozen beside it, unplaced cuts said', async () => {
    const source = 'difference() { cube([40, 40, 10]); translate([20, 20, 10]) mj_bearing_seat("688"); }';
    const r = await mintSolidHandler({ kind: 'scad', via: 'fabricate', title: 'axle block', ref: 'sk_fab_block', spec: { host: 'printed', needs: NEEDS, source } });
    expect(r.ok).toBe(true);
    expect(r.stats.fabrication.bom.map((b) => b.part)).toEqual(['radial-bearing', 'socket-bolt']);
    expect(r.stats.fabrication.unplaced).toEqual(['mj_counterbore', 'mj_heatset_hole']);
    expect(r.stats.warnings.join(' ')).toMatch(/never calls mj_counterbore, mj_heatset_hole/);
    const m = SketchRepository.getByRef('sk_fab_block').manifest;
    expect(m.kind).toBe('scad');
    expect(m.fabricate.plan.version).toMatch(/^fabricator-v/);
    expect(m.fabricate.needs).toEqual(NEEDS);
  });

  it.skipIf(!hasWasm)('the assembler refuses a fabricated scad row and says where it assembles instead', async () => {
    await expect(mintSolidHandler({ kind: 'assembler', spec: { items: [{ source: { ref: 'sk_fab_block' } }] } }))
      .rejects.toThrow(/scad row — the assembler composes workbench parts only.*`parts` entry.*`mechanism`.*`bom`/);
  });
});
