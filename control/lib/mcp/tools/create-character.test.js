process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { createCharacterHandler, updateCharacterHandler, CHARACTER_KINDS } from './create-character.js';
import { updateSketchHandler } from './sketch-mint.js';
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

// update_character is the same door the other way round: a character's words become update_sketch patch ops, so an
// edit through it stores what the equivalent patch stores.
describe('update_character revises what update_sketch revises', () => {
  const twin = async (name, spec = { cast: 'female' }) => {
    await createCharacterHandler({ as: 'hero', spec, title: name, ref: `uc_${name}_door` });
    await createCharacterHandler({ as: 'hero', spec, title: name, ref: `uc_${name}_sketch` });
  };

  it('a hero\'s words, its target and its cube merge key by key and equal the patch', async () => {
    await twin('words');
    const a = await updateCharacterHandler({ ref: 'uc_words_door', spec: { register: 'chamfer', hair: 'braid' }, target: '1080p', geocube: 'island-noon', note: 'for 1080p' });
    await updateSketchHandler({ ref: 'uc_words_sketch', note: 'for 1080p', patch: [
      { op: 'set', path: '/hero/register', value: 'chamfer' }, { op: 'set', path: '/hero/hair', value: 'braid' },
      { op: 'set', path: '/hero/target', value: '1080p' }, { op: 'set', path: '/hero/geocube', value: 'island-noon' }] });
    expect(a.ok).toBe(true);
    expect(manifestOf('uc_words_door')).toBe(manifestOf('uc_words_sketch'));
    const hero = SketchRepository.getByRef('uc_words_door').manifest.hero;
    expect(hero).toMatchObject({ register: 'chamfer', target: '1080p', geocube: 'island-noon' });
  }, 240_000);

  it('the readout gives each part\'s outline at the target; null removes a word', async () => {
    await twin('readout');
    const a = await updateCharacterHandler({ ref: 'uc_readout_door', target: '1080p', readout: 'full' });
    expect(JSON.stringify(a)).toMatch(/"density":\{"target":\{"resolution":"1080p","framing":"third-person","error":1,"figurePx":360\},"pxPerMetre":217\.58,"triangles":7724/);
    await updateCharacterHandler({ ref: 'uc_readout_door', target: null });
    expect(SketchRepository.getByRef('uc_readout_door').manifest.hero.target).toBeUndefined();
  }, 240_000);

  // a face or a tune is composable (words and objects left to right); the mint stores it resolved, and an edit giving
  // it as a list must store the same, or the anime head reads the raw list as no controls and draws its base face
  it('a face and a tune given as lists draw what the mint draws: the same list again moves nothing', async () => {
    const face = ['soft', 'large-eyes', { spacing: 1.1 }], tune = ['athletic', { shoulders: 1.05 }];
    await createCharacterHandler({ as: 'hero', spec: { cast: 'female', head: 'anime', face, tune }, title: 'listed', ref: 'uc_listed_made' });
    await createCharacterHandler({ as: 'hero', spec: { cast: 'female', head: 'anime' }, title: 'listed', ref: 'uc_listed_edited' });
    const read = (ref) => {
      const { hero, plan } = SketchRepository.getByRef(ref).manifest, { face_m, pupils_m } = plan.include[0].faceMeasures;
      return { face: hero.face, faceFrom: hero.faceFrom, tune: hero.tune, from: hero.from, face_m, pupils_m, plan: createHash('sha256').update(JSON.stringify(plan)).digest('hex') };
    };
    const made = read('uc_listed_made'), base = read('uc_listed_edited');
    expect(made.faceFrom).toBe('soft+large-eyes');
    expect(made.pupils_m).toBeGreaterThan(base.pupils_m);   // the list's spacing moved the eyes apart
    await updateCharacterHandler({ ref: 'uc_listed_made', spec: { face, tune } });
    expect(read('uc_listed_made')).toEqual(made);
    await updateCharacterHandler({ ref: 'uc_listed_edited', spec: { face, tune } });
    expect(read('uc_listed_edited')).toEqual(made);
  }, 240_000);

  it('a creature takes patch ops, and refuses a hero\'s words by name', async () => {
    await createCharacterHandler({ as: 'creature', spec: { plan: RING_PLAN }, title: 'beast', ref: 'uc_beast' });
    await expect(updateCharacterHandler({ ref: 'uc_beast', target: '1080p' })).rejects.toThrow(/'uc_beast' is a creature; spec, target and geocube are a hero's words today.*\/plan\//);
    const r = await updateCharacterHandler({ ref: 'uc_beast', title: 'renamed beast' });
    expect(r.ok).toBe(true);
  }, 120_000);

  it('a species is an animal to the door: titled by what it is, and named so on an edit', async () => {
    const r = await createCharacterHandler({ as: 'animal', spec: { species: 'wolf' }, ref: 'uc_wolf' });
    expect(r.ok).toBe(true);
    expect(SketchRepository.getByRef('uc_wolf').title).toBe('animal · wolf');
    expect(SketchRepository.getByRef('uc_wolf').manifest).toMatchObject({ kind: 'layered', species: 'wolf' });
    await expect(updateCharacterHandler({ ref: 'uc_wolf', spec: { hair: 'bob' } })).rejects.toThrow(/'uc_wolf' is an animal;.*get_solid_vocab\(\{ id: 'animal' \}\)/);
  }, 120_000);

  it('refuses a row that is not a character, an unknown ref and an empty edit', async () => {
    await expect(updateCharacterHandler({ ref: 'uc_nope' })).rejects.toThrow(/no sketch 'uc_nope'/);
    await twin('empty');
    await expect(updateCharacterHandler({ ref: 'uc_empty_door' })).rejects.toThrow(/at least one of spec, target, geocube, patch, title/);
    await expect(updateCharacterHandler({ ref: 'uc_empty_door', target: '8k' })).rejects.toThrow(/resolution is a word/);
  }, 120_000);
});
