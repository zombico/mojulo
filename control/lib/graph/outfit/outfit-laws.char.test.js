/**
 * THE UPDATE LAW's pin (principles.js): an outfit build regenerates on every read of the hero, so what it expands to and
 * what the garment kernel builds from that are a compatibility promise over minted rows. Two hashes per case, at
 * OUTFIT_LAWS_VERSION:
 *   laws    the expansion (expandOutfit: the pieces, paint, rows, kit, tones and trace), on the structured body's parts
 *   rings   the garment parts the kernel builds from it on the anime female (body-garment.js: every copy, skirt and panel)
 * One case per distinct procedure, chosen from the seeded cards in code (trousers worn out, trousers tucked, a dress, an
 * outer layer, drape panels), never the whole catalog. A moved hash is either a change that says an outfit's emission
 * changes AND bumps OUTFIT_LAWS_VERSION (the old version's choices kept for rows stamped with it, its pins kept beside
 * the new), or a body change, which re-pins here alongside its own pins.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { OUTFIT_LAWS_VERSION } from './principles.js';
import { SEEDED_OUTFITS } from './styles.js';
import { expandOutfit } from './expand.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

// (rings re-pinned for the hero laws 2, a body change: the hero minted now lifts its neck's root, hero-form.js
// SHOULDER_LINE, and the garments that reach the shoulders follow it; the expansions, the laws hashes, unchanged; and
// again for the hero laws 3, hero-form.js LEG_SET, the leg turned back about the ankle: every garment on the legs or
// the seat follows the hip's joint; and laws and rings rewritten in place for the waistband (1029, unreleased, at the
// operator's word: outfit law 2, a waistband has no ease, body-garment.js `waistband` on the trousers' seat; the dress
// has no seat and keeps its bytes); and the rings again for the game body's construction (1029, unreleased): a sleeve
// that starts on the arm's first ring takes its cap out past the skin's at the shoulder (authored-jacket.js sleeveSeams:
// every case with a sleeve but the trousers worn out), the outer layer fitted onto what it is worn over (fitJacket), and
// the shirt's collar stood on its neckline (standCollar: the tucked shirt's); the laws unchanged
const PINS = {
  1: {
    'out': { laws: 'c3f82aeccde0da38', rings: 'a9f475582083f731' },
    'tucked': { laws: 'a293c920ca0f83b2', rings: '5113129ac6be4764' },
    'dress': { laws: 'bb1fe989040c0422', rings: '3788f9213ce322f3' },
    'outer': { laws: '127769bbfdd8e767', rings: '2404c186875fb4d7' },
    'panels': { laws: 'd114d51d72f13d3b', rings: '8d4abf177cd7aa55' },
  },
};

const L = (id) => SEEDED_OUTFITS[id].language;
const PROCEDURES = {
  out: (id) => L(id).bottom && L(id).bottom.kind !== 'skirt' && !L(id).tuck && !L(id).outer && !L(id).panels,
  tucked: (id) => L(id).bottom && L(id).bottom.kind !== 'skirt' && L(id).tuck && !L(id).outer && !L(id).panels,
  dress: (id) => !!L(id).dress,
  outer: (id) => !!L(id).outer,
  panels: (id) => !!L(id).panels?.length && !L(id).outer,
};
const hash = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const HAVE = new Set(['torso', 'pectoral', 'bust', 'navel', 'pelvis', 'thigh', 'shank', 'foot', 'toes', 'upperArm', 'foreArm', 'neck', 'hand']);

describe('outfit laws: the update law pin', () => {
  it(`version ${OUTFIT_LAWS_VERSION} carries a pin for every procedure`, () => {
    expect(Object.keys(PINS[OUTFIT_LAWS_VERSION] || {}).sort()).toEqual(Object.keys(PROCEDURES).sort());
  });
  for (const [name, test] of Object.entries(PROCEDURES)) {
    it(`${name}: the laws and the rings are as pinned`, { timeout: 60000 }, () => {
      const style = Object.keys(SEEDED_OUTFITS).find(test); expect(style, `a seeded card for '${name}'`).toBeTruthy();
      const build = { type: 'outfit', style };
      const laws = hash(expandOutfit(build, { have: HAVE, scale: 1 }));
      const parts = expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'female', head: 'anime', outfit: build }) }).recipe.parts;
      const rings = hash(Object.keys(parts).filter((n) => parts[n].garment).sort().map((n) => [n, parts[n]]));
      if (process.env.REPIN) console.log('PIN', name, laws, rings);
      expect({ laws, rings }, `${name} (${style})`).toEqual(PINS[OUTFIT_LAWS_VERSION][name]);
    });
  }
});
