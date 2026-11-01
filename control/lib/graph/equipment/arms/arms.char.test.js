/**
 * equipment/arms — a characterization pin per builder procedure (its first model in the registry, modern and future):
 * the expanded monomers hashed. Re-pin only with a change that says an arm's emission changes (and a new
 * ARMS_LAWS_VERSION when a minted row would move).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { expandEquipment } from '../expand.js';
import { ARM_MODELS } from './index.js';

const hash = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const PROCEDURES = (() => {
  const seen = new Map();
  for (const [item, I] of Object.entries(ARM_MODELS)) for (const [model, M] of Object.entries(I.models)) if (!seen.has(M.build)) seen.set(M.build, { item, model });
  return [...seen.values()];
})();
const PINS = {
  'carbine/assault/modern': '44945b1dc17a653f', 'carbine/assault/future': 'e8bf5a196be4131f',
  'knife/combat/modern': '10cd2e7ede781f66', 'knife/combat/future': '649cd0826b5c4cb8',
  'pistol/revolver/modern': 'fade6e53ae5f283e', 'pistol/revolver/future': 'd665ded16a5aa803',
  'pistol/service/modern': 'a4a1f8e58baf8a5e', 'pistol/service/future': '3943de52879f0655',
  'rifle/bullpup/modern': '94009645317ec7c9', 'rifle/bullpup/future': 'e706881810c8293e',
  'shotgun/pump/modern': '8b02e37b7bc90fb7', 'shotgun/pump/future': 'ed757c6e15235700',
};

describe('arms characterization', () => {
  it('pins each procedure\'s emission', () => {
    const got = {};
    for (const p of PROCEDURES) for (const line of ['modern', 'future']) got[`${p.item}/${p.model}/${line}`] = hash(expandEquipment({ type: 'equipment', ...p, line }).monomers);
    expect(got).toEqual(PINS);
  });
});
