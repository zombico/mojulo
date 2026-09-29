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

  it('refuses a malformed design, and reads nothing for a single floor', async () => {
    await expect(createSketchHandler({ title: 'bad', manifest: { kind: 'floorplan', title: 'bad', storeys: 2, seed: 1, design: { passage: 'wide' } } })).rejects.toThrow(/design.passage/);
    const floor = await createSketchHandler({ title: 'one floor', manifest: { kind: 'floorplan', title: 'one floor', seed: 3 } });
    expect(floor.design).toBeUndefined();
  });
});
