/**
 * The inventory's dress, swept: every look names a word for every dial, every border flavor has a look, and every word
 * off the classic one changes the sheet, its rules under the scope.
 */
import { describe, it, expect } from 'vitest';
import { DRESS_WORDS, DRESS_DIALS, INVENTORY_LOOKS, LOOK_IDS, FLAVOR_LOOK, cleanDress, inventoryCss } from './inventory-dress.js';
import { FLAVOR_IDS } from './borders.js';

describe('the dress, every word', () => {
  it('every look names a word for every dial, from the dial\'s own set', () => {
    for (const l of LOOK_IDS) for (const d of DRESS_DIALS) expect(Object.keys(DRESS_WORDS[d])).toContain(INVENTORY_LOOKS[l][d]);
  });
  it('every border flavor dresses an inventory in a look', () => {
    for (const f of FLAVOR_IDS) expect(LOOK_IDS).toContain(FLAVOR_LOOK[f]);
  });
  it('every word off the classic one changes the sheet, under the scope', () => {
    for (const d of DRESS_DIALS) for (const w of Object.keys(DRESS_WORDS[d])) {
      if (w === INVENTORY_LOOKS.classic[d]) continue;
      const css = inventoryCss({ ...cleanDress(null), [d]: w }, '.st');
      expect(css, `${d}: ${w}`).not.toBe('');
      expect(css.split('}').filter(Boolean).every((r) => r.trim().startsWith('.st')), `${d}: ${w}`).toBe(true);
    }
  });
});
