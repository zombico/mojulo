/**
 * armor characterization net: one hash per seeded card × coverage, at the register ring halves Ht 4 / Hl 3 and scale 1,
 * the laws at ARMOR_LAWS_VERSION.
 *
 * A stored armour build regenerates on every read of the hero, so its expansion is a compatibility promise over minted
 * rows. The pins hash the expanded KIT (the adornment layer under it has its own tests). They were computed by the
 * kernel as ported from the fantasy-armor spike. Re-pin ONLY alongside a change that says a suit's emission changes; a
 * change to the laws' curves is a new ARMOR_LAWS_VERSION instead, and rows minted under the old one keep it.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { expandArmor } from './expand.js';
import { SEEDED_ARMOR } from './styles.js';

const PINS = {
  'knight@0': '63e95558d2ea7cad',
  'knight@0.5': '72cef3b04f0e5e65',
  'knight@1': '602aaeda100b8516',
  'kuro-kon@0': '08021efcbd4e35b8',
  'kuro-kon@0.5': 'b953954b58028925',
  'kuro-kon@1': '700672fe26bcb4f0',
  'aka@0': 'c71768c55c8add9d',
  'aka@0.5': 'ca6dc5c476b082df',
  'aka@1': 'f8c0b791427e570c',
  'shiro@0': '83bbe71e639ad0f6',
  'shiro@0.5': '7fa8bbe006ed6ace',
  'shiro@1': '83241c9ce3527620',
};

const COVERAGES = [0, 0.5, 1];
const hashOf = (style, coverage) => createHash('sha1').update(JSON.stringify(expandArmor({ type: 'armor', style, dials: { coverage } }, { Ht: 4, Hl: 3, scale: 1 }).kit)).digest('hex').slice(0, 16);

describe('armor kits (characterization)', () => {
  for (const style of Object.keys(SEEDED_ARMOR)) for (const c of COVERAGES) {
    it(`${style} @ coverage ${c}`, () => { expect(hashOf(style, c)).toBe(PINS[`${style}@${c}`]); });
  }
});
