/**
 * craft shelf characterization net: one hash per builder path (a part chosen from the inventory in code, as the
 * concept tests choose it) and one whole assembled craft. An inventory row is a part number: a craft minted from
 * it regenerates on every read, so its recipe is a compatibility promise over minted rows. The pins hash the
 * emitted RECIPE (the workbench lowerers under it have their own pins). Re-pin ONLY alongside a change that says
 * a part's emission changes, and log it here.
 *
 * Log:
 *   - Fidelity pass (unreleased, so folded in): sections at 24 points, wing planforms and folds, flat-paneled
 *     space hulls, canopies and foils; every pin re-pinned, new builder paths pinned.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { CRAFT_ODM, assembleCraft, resolveCraftPart } from './index.js';

const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

const PINS = {
  'fus-light-single': '9617a6a094f69b24',
  'wing-light-high': '76ae740ae02c384c',
  'stab-light': 'be75690df61c2d76',
  'fin-light': '0603fb914a086fa4',
  'eng-piston-flat4': '3ad57b50243e4952',
  'eng-piston-v12': '5a728b261b7d1fee',
  'eng-turboprop': 'bbdc6cdd82c9f532',
  'eng-turbofan-small': '4a63e16c81ffd579',
  'eng-turbofan-afterburning': '0e00e48fb05b4682',
  'prop-2-fixed': '889ccc9055fa410e',
  'gear-spring-light': '18d0dc82aace55f3',
  'gear-nose-light': '5052bbec7a4f967e',
  'gear-bogie-widebody': '71bcfd9f9f355825',
  'canopy-bubble-warbird': 'afe1c98c9407a4d7',
  'pylon-underwing-narrowbody': '720e9247582f743d',
  'pylon-aft-stub': '07c012c60bd7668c',
  'gun-rotary-20': '19bc9feb10da72c4',
  'gun-heavy-mg': 'ebefe5e0fbc84320',
  'missile-aam-short': 'fc1faebd8e04ff49',
  'hull-snub-wedge': '1214822f5579088f',
  'hull-ball-pod': '04dadd7cc342b535',
  'panel-hex': 'd1c5dbb9fb9597aa',
  'drive-pod-light': 'afc436f1460ea583',
  'drive-ion-twin': 'd14b3e28b341afa7',
  'drive-bell-main': 'ca415f0fe27a964b',
  'drive-nacelle-long': '78071a58d3709031',
  'rcs-quad': '2aab5283bbb9529b',
  'strut-light': 'd1ec18f4657851e2',
  'arm-panel': '0941c4f6612847e2',
  'crossbar-nacelle': 'f925290f47a182ff',
  'canopy-ball-window': '01d0a03b999c0a82',
  'launcher-torpedo': 'a301a312cde4427c',
  'turret-ion-dorsal': '4235dedd27bf330b',
  'intake-half-cone': 'acd3cc03995f4745',
  'intake-chin': '173febf62ae93a76',
  'intake-side-d': '31effa33dd64980a',
  'eng-radial-18': '0b9b0e5fbd50460b',
  'craft:lightSingle': '66c2af4706838995',
};

const PROCEDURES = (() => {
  const seen = new Map();
  for (const [sku, row] of Object.entries(CRAFT_ODM)) {
    const key = `${row.kind}/${row.build.family || (row.build.vertical ? 'vertical' : 'surface')}`;
    if (!seen.has(key)) seen.set(key, sku);
  }
  return [...seen.values()];
})();

describe('craft shelf emission pins', () => {
  it('pins exactly one part per builder path', () => {
    expect(Object.keys(PINS).filter((k) => k !== 'craft:lightSingle').sort()).toEqual([...PROCEDURES].sort());
  });

  it.each(PROCEDURES)('%s', (sku) => {
    expect(hash(resolveCraftPart(sku, { seat: 'mount' }))).toBe(PINS[sku]);
  });

  it('craft:lightSingle', () => {
    expect(hash(assembleCraft('lightSingle').manifest)).toBe(PINS['craft:lightSingle']);
  });
});
