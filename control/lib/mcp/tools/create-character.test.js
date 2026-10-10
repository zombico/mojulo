process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect } from 'vitest';
import { createCharacterHandler, CHARACTER_KINDS } from './create-character.js';
import { mintSolidHandler } from './mint-solid.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';

// create_character is a door, not a kind: a character minted through it is the same stored recipe mint_solid makes
// from the same spec. Each pair mints under two refs and compares the stored manifests byte for byte.
const RING_PLAN = {
  schema: 'layered-plan-v1', frame: { up: '+z', front: '+y' },
  joints: { hip: [0.2, 0, 1], knee: [0.22, 0.1, 0.5], toe: [0.22, 0.3, 0.05] },
  segments: [
    { name: 'torso', kind: 'trunk', stations: [{ z: 0.9, r: [0.3, 0.22] }, { z: 1.3, r: [0.32, 0.24] }, { z: 1.7, r: [0.2, 0.16] }], caps: { back: [0, 0, 0.8], tip: [0, 0, 1.8] }, group: 'Torso', tint: '#667', mirror: 'plane' },
    { name: 'thighR', kind: 'segment', from: 'hip', to: 'knee', rA: 0.14, rB: 0.1, group: 'Legs', tint: '#565', mirror: 'name' },
    { name: 'shinR', kind: 'segment', from: 'knee', to: 'toe', rA: 0.1, rB: [0.08, 0.04], over: [0.6, 0.3], group: 'Legs', tint: '#565', mirror: 'name' },
  ],
};

const manifestOf = (ref) => JSON.stringify(SketchRepository.getByRef(ref).manifest);

describe('create_character mints what mint_solid mints', () => {
  it.each([
    ['hero', { kind: 'layered', via: 'hero' }, { cast: 'female', register: 'round', hair: 'ponytail' }],
    ['creature', { kind: 'layered', via: 'plan' }, { plan: RING_PLAN }],
    ['animal', { kind: 'animal' }, { species: 'wolf' }],
  ])('%s: the same stored recipe as mint_solid with the same spec', async (as, solid, spec) => {
    const a = await createCharacterHandler({ as, spec, title: `${as} door`, ref: `cc_${as}_door` });
    const b = await mintSolidHandler({ ...solid, spec, title: `${as} door`, ref: `cc_${as}_solid` });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(manifestOf(`cc_${as}_door`)).toBe(manifestOf(`cc_${as}_solid`));
  }, 180_000);

  it('routes a creature without a plan to the layered recipe, and names every door', () => {
    expect(CHARACTER_KINDS.creature.route({})).toEqual({ kind: 'layered' });
    expect(CHARACTER_KINDS.creature.route({ plan: RING_PLAN })).toEqual({ kind: 'layered', via: 'plan' });
    expect(Object.keys(CHARACTER_KINDS)).toEqual(['hero', 'creature', 'animal']);
  });

  it('an unknown `as` refuses by name and points at both manuals', async () => {
    await expect(createCharacterHandler({ as: 'robot', spec: {} })).rejects.toThrow(/unknown as 'robot'\. Known: hero, creature, animal.*get_solid_vocab\(\{ id: 'layered' \}\).*\{ id: 'animal' \}/);
  });

  it("a failed mint keeps mint_solid's pointer at the kind's card", async () => {
    await expect(createCharacterHandler({ as: 'animal', spec: { species: 'no-such-beast' } })).rejects.toThrow(/get_solid_vocab\(\{ id: 'animal' \}\)/);
  });
});
