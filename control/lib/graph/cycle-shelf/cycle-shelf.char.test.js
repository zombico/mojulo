/**
 * cycle shelf characterization net: one hash per builder path (a part chosen from the inventory in code, the first of
 * each kind and family) and one whole assembled machine. An inventory row is a part number and an archetype a machine:
 * a machine minted from them regenerates on every read, so its recipe is a compatibility promise over minted rows. The
 * pins hash the emitted RECIPE (the workbench lowerers under it have their own pins). Re-pin ONLY alongside a change that
 * says a part's emission changes, and log it here.
 *
 * Log:
 *   - The shelf's first machine, the motocross bike (unreleased): every builder path pinned.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { CYCLE_ODM, assembleCycle, resolveCyclePart } from './index.js';

const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

const PINS = {
  'frame-mx-spar': '7ad2cbfc01c1a9f4',
  'fork-usd-48': '2c4ac12cd5a5cbc8',
  'swingarm-mx': '4b9fb6b8ce352f27',
  'shock-mx': '297cf13ee59e8e07',
  'wheel-mx-21': '72af37dd07f30773',
  'brake-disc-270': '865b1c285b8f1d21',
  'engine-single-450': '565da4b5fca0366e',
  'radiator-mx': 'c3aaeff54dfa0bab',
  'drive-chain-520': '1bb29464c7d9b6b2',
  'exhaust-mx-single': 'c57808cfaa26f175',
  'tank-mx': 'ee6f4852088c6dfb',
  'seat-mx': '5493c1d4ea9a3d8d',
  'bars-mx': '87b67a15025fdf6a',
  'fender-mx-front': '3eb786635df7aaca',
  'plate-mx-front': '268329f450cb0323',
  'plate-mx-side': 'f68a5b9e88023acf',
  'peg-mx': 'a89572f0d632f066',
  'stand-side-mx': '8aff436a19493848',
  'cycle:dirtBike': 'b29fc4ae7e2f5ee6',
};

const PROCEDURES = (() => {
  const seen = new Map();
  for (const [sku, row] of Object.entries(CYCLE_ODM)) {
    const key = `${row.kind}/${row.build.family}`;
    if (!seen.has(key)) seen.set(key, sku);
  }
  return [...seen.values()];
})();

describe('cycle shelf emission pins', () => {
  it('pins exactly one part per builder path', () => {
    expect(Object.keys(PINS).filter((k) => !k.startsWith('cycle:')).sort()).toEqual([...PROCEDURES].sort());
  });

  it.each(PROCEDURES)('%s', (sku) => {
    expect(hash(resolveCyclePart(sku))).toBe(PINS[sku]);
  });

  it('cycle:dirtBike', () => {
    expect(hash(assembleCycle('dirtBike').manifest)).toBe(PINS['cycle:dirtBike']);
  });
});
