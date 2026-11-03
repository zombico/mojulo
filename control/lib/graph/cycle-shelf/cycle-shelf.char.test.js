/**
 * cycle shelf characterization net: one hash per builder path (a part chosen from the inventory in code, the first of
 * each kind and family) and one whole assembled machine. An inventory row is a part number and an archetype a machine:
 * a machine minted from them regenerates on every read, so its recipe is a compatibility promise over minted rows. The
 * pins hash the emitted RECIPE (the workbench lowerers under it have their own pins). Re-pin ONLY alongside a change that
 * says a part's emission changes, and log it here.
 *
 * Log:
 *   - The shelf's first machine, the motocross bike (unreleased): every builder path pinned.
 *   - The road machines, the step-throughs and the pedalled (unreleased): their families' builder paths pinned; the
 *     helpers moved to cycle-kit.js and the builders dispatch by family, and no existing pin moved.
 *   - The three-wheelers, the quad and the sidecar (unreleased): their builder paths pinned; a wheel's slot beyond
 *     front and rear, its contact its own x, and a pair's fender mirrored moved no existing pin.
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
  'frame-trellis-street': '0667f14d1cbd64ad',
  'frame-spar-sport': '6cb15fa5cfef7398',
  'fork-tele-41': 'bb2cd861584a6613',
  'swingarm-road': '9d2b15f077cdc2ed',
  'shock-twin-cruiser': '43b3a9c1faaa61d7',
  'wheel-cast-120-17': '6ec3a35f5f0e5689',
  'brake-twin-310': 'b84493d181b9b816',
  'engine-twin-700': '1935ef27bac7b498',
  'engine-vee-1800': '6bed5b06a7321aff',
  'radiator-front-road': '2d18ba809d4ae766',
  'drive-belt-cruiser': '8bf10422700dfbde',
  'exhaust-street-2into1': '767e94f90b4990e2',
  'tank-street': '0fcb80fa431f7cf3',
  'seat-street': 'fd979dbd3633ebbb',
  'bars-street': 'ec3d9bafa493bfd1',
  'bars-clipon': '104b7610373a3e35',
  'tail-street': '043b82cea89fc945',
  'screen-sport': 'b4ba5a7ab3570eb5',
  'lamp-head-round': '5ff9d908ee131216',
  'lamp-tail-led': '9ab56300fc8ac2ba',
  'peg-road': '083ffbaa5f186b77',
  'brake-drum-110': '31804a56ce01d34e',
  'engine-scooter-150': 'bfda82af82547f31',
  'engine-flat-110': '37f1eeaefdf17565',
  'bars-scooter': '64026aa275949255',
  'shield-scooter': '7daa83bb7e11252f',
  'floor-scooter': 'e0f9d8cd68a0daf5',
  'fork-rigid-700': '9948d0297302c4c2',
  'wheel-wire-700': '0ff9cba31a59eb18',
  'brake-disc-160': '380d5fc34f0da493',
  'drive-pedal-road': 'e5aea7e6389bbf2a',
  'motor-mid-250': 'dd47661eef786596',
  'battery-downtube-500': '4e4cd5d7e5c30f64',
  'saddle-road': '4b4f4154cd633607',
  'bars-flat-bicycle': 'b73e10ac43dae512',
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
  'frame-trellis-street': '0667f14d1cbd64ad',
  'frame-spar-sport': '6cb15fa5cfef7398',
  'fork-tele-41': 'bb2cd861584a6613',
  'swingarm-road': '9d2b15f077cdc2ed',
  'shock-twin-cruiser': '43b3a9c1faaa61d7',
  'wheel-cast-120-17': '6ec3a35f5f0e5689',
  'brake-twin-310': 'b84493d181b9b816',
  'engine-twin-700': '1935ef27bac7b498',
  'engine-vee-1800': '6bed5b06a7321aff',
  'radiator-front-road': '2d18ba809d4ae766',
  'drive-belt-cruiser': '8bf10422700dfbde',
  'exhaust-street-2into1': '767e94f90b4990e2',
  'tank-street': '0fcb80fa431f7cf3',
  'seat-street': 'fd979dbd3633ebbb',
  'bars-street': 'ec3d9bafa493bfd1',
  'bars-clipon': '104b7610373a3e35',
  'tail-street': '043b82cea89fc945',
  'screen-sport': 'b4ba5a7ab3570eb5',
  'lamp-head-round': '5ff9d908ee131216',
  'lamp-tail-led': '9ab56300fc8ac2ba',
  'peg-road': '083ffbaa5f186b77',
  'brake-drum-110': '31804a56ce01d34e',
  'engine-scooter-150': 'bfda82af82547f31',
  'engine-flat-110': '37f1eeaefdf17565',
  'bars-scooter': '64026aa275949255',
  'shield-scooter': '7daa83bb7e11252f',
  'floor-scooter': 'e0f9d8cd68a0daf5',
  'fork-rigid-700': '9948d0297302c4c2',
  'wheel-wire-700': '0ff9cba31a59eb18',
  'brake-disc-160': '380d5fc34f0da493',
  'drive-pedal-road': 'e5aea7e6389bbf2a',
  'motor-mid-250': 'dd47661eef786596',
  'battery-downtube-500': '4e4cd5d7e5c30f64',
  'saddle-road': '4b4f4154cd633607',
  'bars-flat-bicycle': 'b73e10ac43dae512',
  'sidecar-touring': 'a5b27b61f6f41019',
  'column-atv': '7e7075b52e3cbeaa',
  'arms-atv': 'ce809949992e260d',
  'axle-live-trike': 'c91d4a50e66f707f',
  'axle-light-rickshaw': '22d51e79aaaf4541',
  'axle-solid-atv': '94f2fa53b9f18ef4',
  'cab-tuktuk': '7129e08616fba1d5',
  'carriage-rickshaw': 'd09e037c123bd2a5',
  'box-cargo': 'a4d329c4f63725d6',
  'cycle:dirtBike': 'b29fc4ae7e2f5ee6',
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
