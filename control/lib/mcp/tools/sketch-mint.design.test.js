// A house's design considerations ride create_sketch / update_sketch: measured findings, advisory, and the next move;
// the repair asked for by patch clears them. A single-floor plan reads none.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-design-'));

import { describe, expect, it } from 'vitest';
import { createSketchHandler, updateSketchHandler } from './sketch-mint.js';

describe('design considerations at mint and update', () => {
  it('reads a house out, and the repair clears it', async () => {
    const made = await createSketchHandler({ title: 'two storeys', ref: 'sk_design_house', manifest: { kind: 'floorplan', title: 'two storeys', storeys: 2, seed: 4, tier: 'house' } });
    expect(made.ok).toBe(true);
    expect(made.design.ok).toBe(false);
    expect(made.design.tradition).toBe('north-american');
    expect(made.design.findings[0]).toMatch(/^upstairs: .*stair well/);
    expect(made.design.next).toMatch(/repair: true/);
    const fixed = await updateSketchHandler({ ref: 'sk_design_house', patch: [{ op: 'set', path: '/design', value: { repair: true } }] });
    expect(fixed.design).toMatchObject({ ok: true });
    expect(fixed.design.findings).toBeUndefined();
  });

  it('suggests a repair that joins the design the house names, keeping its tradition', async () => {
    const made = await createSketchHandler({ title: 'japanese', ref: 'sk_design_japanese', manifest: { kind: 'floorplan', title: 'japanese', storeys: 2, seed: 4, tier: 'house', design: { tradition: 'japanese' } } });
    expect(made.design.tradition).toBe('japanese');
    expect(made.design.ok).toBe(false);
    expect(made.design.next).toContain("patch: [{ op: 'set', path: '/design/repair', value: true }]");
    const fixed = await updateSketchHandler({ ref: 'sk_design_japanese', patch: [{ op: 'set', path: '/design/repair', value: true }] });
    expect(fixed.design.tradition).toBe('japanese');
    // a house naming no design is told to set one
    const plain = await createSketchHandler({ title: 'plain', manifest: { kind: 'floorplan', title: 'plain', storeys: 2, seed: 4, tier: 'house' } });
    expect(plain.design.next).toContain("patch: [{ op: 'set', path: '/design', value: { repair: true } }]");
  });

  it('refuses a framing, drainage, roof covering or furnishing the house does not know, by field, at mint and on an edit', async () => {
    const house = { kind: 'floorplan', title: 'framed', storeys: 2, seed: 1 };
    const mint = (extra) => createSketchHandler({ title: 'framed', manifest: { ...house, ...extra } });
    await expect(mint({ framing: { system: 'balloon' } })).rejects.toThrow(/framing\.system: one of platform, masonry/);
    await expect(mint({ framing: { stage: 'drywall' } })).rejects.toThrow(/framing\.stage: one of/);
    await expect(mint({ drainage: { tradition: 'martian' } })).rejects.toThrow(/drainage\.tradition: one of .*british/);
    await expect(mint({ drainage: 'yes' })).rejects.toThrow(/drainage: true or \{/);
    await expect(mint({ roof: { style: 'bungalow', covering: 'thatch' } })).rejects.toThrow(/roof\.covering\.type: one of asphalt-shingle/);
    await expect(mint({ furnishing: 'realistic' })).rejects.toThrow(/furnishing: 'composed' .*'constructed'/);
    await expect(mint({ layout: 'random' })).rejects.toThrow(/layout: 'varied'/);
    await expect(createSketchHandler({ title: 'condo', manifest: { kind: 'condo-complex', title: 'condo', seed: 7, furnishing: 'built' } })).rejects.toThrow(/furnishing: 'constructed'/);
    // what it knows mints, and null / false read as none
    const made = await mint({ framing: { system: 'platform', stage: 'lined' }, drainage: { tradition: 'british' }, roof: { style: 'bungalow', covering: 'slate' }, furnishing: 'constructed' });
    expect(made.ok).toBe(true);
    expect((await mint({ framing: null, drainage: false, roof: { style: 'bungalow', covering: false }, furnishing: null })).ok).toBe(true);
    expect((await mint({ furnishing: 'composed', layout: 'varied' })).ok).toBe(true);
    // an edit pays the same gate
    await expect(updateSketchHandler({ ref: made.ref, patch: [{ op: 'set', path: '/framing/system', value: 'timber-frame' }] })).rejects.toThrow(/framing\.system/);
    await expect(updateSketchHandler({ ref: made.ref, patch: [{ op: 'set', path: '/roof/covering', value: 'clay-tile' }] })).rejects.toThrow(/roof\.covering\.type/);
  });

  it('refuses a malformed design, and reads nothing for a single floor', async () => {
    await expect(createSketchHandler({ title: 'bad', manifest: { kind: 'floorplan', title: 'bad', storeys: 2, seed: 1, design: { passage: 'wide' } } })).rejects.toThrow(/design.passage/);
    const floor = await createSketchHandler({ title: 'one floor', manifest: { kind: 'floorplan', title: 'one floor', seed: 3 } });
    expect(floor.design).toBeUndefined();
  });
});
