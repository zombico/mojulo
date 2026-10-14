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

const PINS = {
  1: {
    'out': { laws: '265ded3657d405cc', rings: '6d0db386e7c0b75e' },
    'tucked': { laws: 'b76e277c3f91d9e7', rings: '6830faeee5c848d9' },
    'dress': { laws: 'ab5993a5be6a4df7', rings: '8b33bdb55034602a' },
    'outer': { laws: '5ca7c23fe61ab573', rings: 'f951886934855ebf' },
    'panels': { laws: '08e10bad4e472308', rings: '3f1a63101148d55e' },
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
