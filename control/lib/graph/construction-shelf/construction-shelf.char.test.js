/**
 * construction shelf characterization net: one hash per builder path (a part chosen from the inventory in code, the
 * first of each kind and family), a ram's rod, and one whole assembled machine at its rest pose. An inventory row is a
 * part number and an archetype a machine: a machine minted from them regenerates on every read, so its recipe is a
 * compatibility promise over minted rows. The pins hash the emitted RECIPE (the workbench lowerers under it have their
 * own pins). Re-pin ONLY alongside a change that says a part's emission changes, and log it here.
 *
 * Log:
 *   - The shelf's first machine, the crawler excavator (unreleased): every builder path pinned.
 *   - The bulldozer (unreleased): its hull, its blade and its ripper pinned; the crawler's optional seat and trunnions
 *     moved no existing pin.
 *   - The wheel loader, the skid steer and the compact track loader (unreleased): the frames, the tyre, the arms, the
 *     bellcrank, the loader buckets and the rubber track pinned; the bucket's and the crawler's new families moved no
 *     existing pin.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { CON_ODM, assembleMachine, resolveConPart } from './index.js';

const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

const PINS = {
  'crawler-ex20': '05f07d9590a13be7',
  'slew-ex20': '80f6f844b98806ce',
  'house-ex20': 'f0a8ac66f39a5d53',
  'cab-ex': 'c479457064ed6bb7',
  'cw-ex20': '12757e2786aa3a87',
  'boom-mono-57': '2c5d01e3e59f74c1',
  'stick-29': '2656c622c0d4b556',
  'bucket-dig-ex20': '733eb2d0a86adf3c',
  'link-dogbone-ex20': 'a766f837c2a4f264',
  'link-h-ex20': 'bac5ddc1526f19cc',
  'ram-boom-ex20': '9282f70628a24f5c',
  'hull-dz20': '32b46be169e5ed75',
  'blade-su-dz20': 'dbdf3d5863c186c2',
  'ripper-dz20': '74a4c3efe94db994',
  'frame-rear-wl15': '7404394c4e166221',
  'frame-front-wl15': '470ca22b5669ee3b',
  'wheel-otr-235': '8e80080646d5fcdf',
  'arms-zbar-wl15': '8665283c29968f54',
  'crank-zbar-wl15': '0731a3bd25aa6700',
  'bucket-gp-wl15': '5bc7a988579b7926',
  'chassis-ss33': '0364791569161e28',
  'arms-radial-ss33': '6251f97a9c1dc67d',
  'bucket-gp-ss18': '17051cc9ea2ac1b8',
  'crawler-ctl': 'd8e503c0089040ed',
  'ram-boom-ex20.rod': 'ee3b8d6daeffb743',
  'con:crawlerExcavator': '0eefeb9e723f41ef',
  'con:bulldozer': '94272ebad7ce55a9',
  'con:wheelLoader': '8850036d94e7ed84',
  'con:skidSteer': 'c501524697326176',
  'con:compactTrackLoader': 'c2f22ee973a96c2e',
};

const PROCEDURES = (() => {
  const seen = new Map();
  for (const [sku, row] of Object.entries(CON_ODM)) {
    const key = `${row.kind}/${row.build.family}`;
    if (!seen.has(key)) seen.set(key, sku);
  }
  return [...seen.values()];
})();
const RAM = PROCEDURES.find((s) => CON_ODM[s].kind === 'con-ram');

describe('construction shelf emission pins', () => {
  it('pins exactly one part per builder path, and a ram\'s rod', () => {
    expect(Object.keys(PINS).filter((k) => !k.startsWith('con:') && !k.endsWith('.rod')).sort()).toEqual([...PROCEDURES].sort());
  });
  it.each(PROCEDURES)('%s', (sku) => {
    expect(hash(resolveConPart(sku))).toBe(PINS[sku]);
  });
  it('a ram\'s rod', () => {
    expect(hash(resolveConPart(RAM, { part: 'rod' }))).toBe(PINS[`${RAM}.rod`]);
  });
  it.each(Object.keys(PINS).filter((k) => k.startsWith('con:')))('%s', (k) => {
    expect(hash(assembleMachine(k.slice(4)).manifest)).toBe(PINS[k]);
  });
});
