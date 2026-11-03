/**
 * mecha shelf characterization net: one hash per builder path (a part chosen from the inventory in code, the first of
 * each kind), a leg's part built for the left hand, a ram's rod, and one whole assembled frame at its rest stance. An
 * inventory row is a part number and an archetype a frame: a frame minted from them regenerates on every read, so its
 * recipe is a compatibility promise over minted rows. The pins hash the emitted RECIPE (the workbench lowerers under it
 * have their own pins). Re-pin ONLY alongside a change that says a part's emission changes, and log it here.
 *
 * Log:
 *   - The shelf's first frame, the all-terrain walker (unreleased): every builder path pinned.
 *   - Its knees bent backward (the leg's rams mirrored fore and aft, the ankle's re-solved), its nose one shape (the
 *     prow, the chin and the dash folded into it): the leg's parts, the saddle, the cabin and the frame re-pinned.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { MECHA_ARCHETYPES, MECHA_ODM, assembleFrame, resolveMechaPart } from './index.js';

const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
const firstOfKind = [...new Map(Object.entries(MECHA_ODM).map(([sku, r]) => [r.kind, sku]).reverse()).values()].reverse();
const sided = Object.values(MECHA_ARCHETYPES)[0].layout.find((e) => e.side === 'l' && !e.ram).sku;
const ram = Object.entries(MECHA_ODM).find(([, r]) => r.kind === 'mecha-ram')[0];

const PINS = {
  'pelvis-atw': '2bf43bb8301d2d01',
  'hip-atw': '7dfe96529b8d835d',
  'yoke-atw': 'e980194856eb1827',
  'thigh-atw': 'a44ce218cfb438dc',
  'shank-atw': '9c982a643e837fda',
  'ankle-atw': '8133ce847f2c2453',
  'foot-atw': '3be20c16d08b2679',
  'seat-atw': '21cccf930c2dc585',
  'cage-atw': 'fd2c4a6f9121233c',
  'pack-atw': 'aae25a1a90f1ab36',
  'ram-roll-atw': 'e73d554306c2f29f',
};
const LEFT = 'c9882af91b6cf973';
const ROD = 'bcfdb3e1621e0b1a';
const FRAME = '5d7f243552d47f90';

describe('mecha shelf: characterization', () => {
  it('pins every builder path', () => {
    const got = Object.fromEntries(firstOfKind.map((sku) => [sku, hash(resolveMechaPart(sku))]));
    expect(got).toEqual(PINS);
  });
  it('pins a leg\'s part built for the left hand, and a ram\'s rod', () => {
    expect(hash(resolveMechaPart(sided, { side: 'l' }))).toBe(LEFT);
    expect(hash(resolveMechaPart(ram, { part: 'rod' }))).toBe(ROD);
  });
  it('pins a whole frame at its rest stance', () => {
    expect(hash(assembleFrame(Object.keys(MECHA_ARCHETYPES)[0], { laws: false }).manifest)).toBe(FRAME);
  });
});
