/**
 * craft shelf characterization net: one hash per builder path (a part chosen from the inventory in code, as the
 * concept tests choose it) and one whole assembled craft. An inventory row is a part number: a craft minted from
 * it regenerates on every read, so its recipe is a compatibility promise over minted rows. The pins hash the
 * emitted RECIPE (the workbench lowerers under it have their own pins). Re-pin ONLY alongside a change that says
 * a part's emission changes, and log it here.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { CRAFT_ODM, assembleCraft, resolveCraftPart } from './index.js';

const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

const PINS = {
  'fus-light-single': '59fd3902da1e1f26',
  'wing-light-high': '1a04694cea947b64',
  'stab-light': 'bbb357b42f17e939',
  'fin-light': '93109d838e1448ad',
  'eng-piston-flat4': '3ad57b50243e4952',
  'eng-piston-v12': '5a728b261b7d1fee',
  'eng-turboprop': 'bbdc6cdd82c9f532',
  'eng-turbofan-small': '4a63e16c81ffd579',
  'eng-turbofan-afterburning': '0e00e48fb05b4682',
  'prop-2-fixed': '818716fd40e44c72',
  'gear-spring-light': '18d0dc82aace55f3',
  'gear-nose-light': '5052bbec7a4f967e',
  'gear-bogie-widebody': '71bcfd9f9f355825',
  'canopy-bubble-warbird': 'c427c73cb5f47db5',
  'pylon-underwing-narrowbody': 'aeb011550f05486d',
  'pylon-aft-stub': 'ab6d64910fad09b5',
  'gun-rotary-20': '19bc9feb10da72c4',
  'gun-heavy-mg': '37e314badecf7676',
  'missile-aam-short': '9da7b802cec11a8a',
  'hull-ball-pod': '04dadd7cc342b535',
  'panel-hex': '0a3b66606736cbb9',
  'drive-pod-light': '50e1b5ecef293bc2',
  'drive-ion-twin': 'd14b3e28b341afa7',
  'drive-bell-main': 'ca415f0fe27a964b',
  'drive-nacelle-long': '78071a58d3709031',
  'rcs-quad': '2aab5283bbb9529b',
  'strut-light': 'd1ec18f4657851e2',
  'arm-panel': '0941c4f6612847e2',
  'crossbar-nacelle': '952963bdb18fc980',
  'canopy-ball-window': '01d0a03b999c0a82',
  'launcher-torpedo': 'a301a312cde4427c',
  'turret-ion-dorsal': '4235dedd27bf330b',
  'craft:lightSingle': '893c76b68ef977c7',
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
