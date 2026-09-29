/**
 * armor characterization net: one hash per seeded card × coverage (and per theme over the knight), at the register ring halves Ht 4 / Hl 3 and scale 1,
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
import { THEMES } from '../themes/themes.js';

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
  'grim-scifi@0': '383efe19c84adc4f',
  'grim-scifi@0.5': '4931e24b2bfa2d6a',
  'grim-scifi@1': 'f0ca194eb86a14a6',
  'fantasy-space@0': 'd4f923bdde96fbc1',
  'fantasy-space@0.5': '08b3bc4bee65c921',
  'fantasy-space@1': 'e146bf0dbbecfc30',
  'armored-hero@0': '196c4fc450ea2e25',
  'armored-hero@0.5': 'b16bc5e35c62b1a2',
  'armored-hero@1': '073d8df486b287c4',
  // themed: a theme over the plate knight (themes/themes.js)
  'knight+death-knight@0.5': '7b7758cdab24668b',
  'knight+death-knight@1': '1846ed34a5b4663a',
  'knight+radiant@0.5': '1f37e92902e008b5',
  'knight+radiant@1': '8287d365a5e96500',
};

const COVERAGES = [0, 0.5, 1];
const hashOf = (style, coverage, theme) => createHash('sha1').update(JSON.stringify(expandArmor({ type: 'armor', style, dials: { coverage }, ...(theme ? { theme } : {}) }, { Ht: 4, Hl: 3, scale: 1 }).kit)).digest('hex').slice(0, 16);

describe('armor kits (characterization)', () => {
  for (const style of Object.keys(SEEDED_ARMOR)) for (const c of COVERAGES) {
    it(`${style} @ coverage ${c}`, () => { expect(hashOf(style, c)).toBe(PINS[`${style}@${c}`]); });
  }
  for (const theme of Object.keys(THEMES)) for (const c of [0.5, 1]) {
    it(`knight + ${theme} @ coverage ${c}`, () => { expect(hashOf('knight', c, theme)).toBe(PINS[`knight+${theme}@${c}`]); });
  }
});
