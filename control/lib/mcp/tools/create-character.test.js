process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { createCharacterHandler, updateCharacterHandler, CHARACTER_DOORS } from './create-character.js';
import { updateSketchHandler } from './sketch-mint.js';
import { mintSolidHandler } from './mint-solid.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createSketchHandler } from './sketches.js';
import { WORLD_KINDS } from '@/lib/graph/worlds/world-kinds.js';

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
    expect(CHARACTER_DOORS.creature.route({})).toEqual({ kind: 'layered' });
    expect(CHARACTER_DOORS.creature.route({ plan: RING_PLAN })).toEqual({ kind: 'layered', via: 'plan' });
    expect(Object.keys(CHARACTER_DOORS)).toEqual(['hero', 'creature', 'animal']);
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
    // each cube is given its own palette's seed where it is written (color-theorist/stamp.js): the two agree but for it
    const unseeded = (ref) => manifestOf(ref).replace(/,"seed":\d+/, '');
    expect(unseeded('uc_words_door')).toBe(unseeded('uc_words_sketch'));
    const hero = SketchRepository.getByRef('uc_words_door').manifest.hero;
    expect(hero).toMatchObject({ register: 'chamfer', target: '1080p', geocube: { from: 'island-noon', palette: { key: 'high', seed: expect.any(Number) } } });
  }, 240_000);

  it('the readout gives each part\'s outline at the target; null removes a word', async () => {
    await twin('readout');
    const a = await updateCharacterHandler({ ref: 'uc_readout_door', target: '1080p', readout: 'full' });
    // (the scale re-pinned for hero laws 4: the leg length moved the figure's height by a millimetre)
    expect(JSON.stringify(a)).toMatch(/"density":\{"target":\{"resolution":"1080p","framing":"third-person","error":1,"figurePx":360\},"pxPerMetre":217\.65,"triangles":7724/);
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

  it('a word the door does not take is refused with where it belongs, on create and on update; a stored one keeps rendering', async () => {
    await expect(createCharacterHandler({ as: 'hero', spec: { cast: 'female', build: 'brute' } })).rejects.toThrow(/build: not a hero word; a build is the cast's: cast: \{ pole/);
    await expect(createCharacterHandler({ as: 'hero', spec: { cast: 'female', wings: true } })).rejects.toThrow(/wings: not a hero word; a body beyond a person is a creature/);
    await expect(createCharacterHandler({ as: 'hero', spec: { cast: 'female', hiar: 'bob' } })).rejects.toThrow(/hiar: not a hero word \(did you mean hair\?\)/);
    await twin('stray');
    await expect(updateCharacterHandler({ ref: 'uc_stray_door', spec: { wings: true } })).rejects.toThrow(/update_character refused:\n - wings: not a hero word/);
    // a row that already carries a stray key (stored by an edit before the refusal) is still revised by its other words
    await updateSketchHandler({ ref: 'uc_stray_door', patch: [{ op: 'set', path: '/hero/wings', value: true }] });
    const r = await updateCharacterHandler({ ref: 'uc_stray_door', spec: { hair: 'bob' } });
    expect(r.ok).toBe(true);
  }, 240_000);

  it('spec merges at any depth: one dial turns, a style replaces, null removes a nested word', async () => {
    await createCharacterHandler({ as: 'hero', spec: { cast: 'male', adorn: { type: 'armor', style: 'knight', dials: { stylize: 0.5, coverage: 0.7 } }, palette: { Top: '#334455', Bottom: '#222222' } }, title: 'deep', ref: 'uc_deep' });
    await updateCharacterHandler({ ref: 'uc_deep', spec: { adorn: { dials: { stylize: 1 } }, palette: { Top: '#aa3311' } } });
    const h1 = SketchRepository.getByRef('uc_deep').manifest.hero;
    expect(h1.adorn).toMatchObject({ type: 'armor', style: 'knight', dials: { stylize: 1, coverage: 0.7 } });
    expect(h1.palette).toEqual({ Top: '#aa3311', Bottom: '#222222' });
    await updateCharacterHandler({ ref: 'uc_deep', spec: { palette: { Bottom: null } } });
    expect(SketchRepository.getByRef('uc_deep').manifest.hero.palette).toEqual({ Top: '#aa3311' });
    await updateCharacterHandler({ ref: 'uc_deep', spec: { adorn: { type: 'armor', style: 'grim-scifi' } } });
    expect(SketchRepository.getByRef('uc_deep').manifest.hero.adorn.dials?.coverage).not.toBe(0.7);
  }, 240_000);

  it('vibe: words for how the hero moves, lowered to its gaits and its stand at mint and on an edit', async () => {
    const r = await createCharacterHandler({ as: 'hero', spec: { cast: 'female', vibe: ['cocky', 'light'] }, title: 'vibe', ref: 'uc_vibe' });
    expect(r.vibe.read).toEqual(['cocky', 'light']);
    const h = SketchRepository.getByRef('uc_vibe').manifest.hero;
    expect(h.vibe).toBeUndefined();
    expect(Object.keys(h.motion)).toContain('walk');
    expect(h.gesture).toBeTruthy();
    await updateCharacterHandler({ ref: 'uc_vibe', spec: { vibe: 'heavy' } });
    expect(SketchRepository.getByRef('uc_vibe').manifest.hero.motion.walk).not.toEqual(h.motion.walk);
  }, 240_000);

  it('a creature takes patch ops, and refuses a hero\'s words by name', async () => {
    await createCharacterHandler({ as: 'creature', spec: { plan: RING_PLAN }, title: 'beast', ref: 'uc_beast' });
    await expect(updateCharacterHandler({ ref: 'uc_beast', target: '1080p' })).rejects.toThrow(/'uc_beast' is a creature; spec and target are a hero's words today \(a creature takes geocube alone\).*\/plan\//);
    const r = await updateCharacterHandler({ ref: 'uc_beast', title: 'renamed beast' });
    expect(r.ok).toBe(true);
  }, 120_000);

  it('a creature takes its level by word: the cube dresses it in its plan\'s materials, at the cube\'s age; null undresses it', async () => {
    const plan = { ...RING_PLAN, materials: { Torso: { metal: 'bronze', finish: 'polished' } } };
    await createCharacterHandler({ as: 'creature', spec: { plan, geocube: 'upland-morning' }, title: 'bronze beast', ref: 'uc_bronze' });
    const m0 = SketchRepository.getByRef('uc_bronze').manifest;
    expect(m0.geocube).toBe('upland-morning');
    expect(m0.recipe.surfaces.Torso).toEqual({ metal: 'bronze', finish: 'polished' });
    await updateCharacterHandler({ ref: 'uc_bronze', geocube: { from: 'upland-morning', materials: { age: 'ancient' } } });
    expect(SketchRepository.getByRef('uc_bronze').manifest.recipe.surfaces.Torso.film).toEqual({ age: 60 });
    await updateCharacterHandler({ ref: 'uc_bronze', geocube: null });
    const m2 = SketchRepository.getByRef('uc_bronze').manifest;
    expect(m2).not.toHaveProperty('geocube');
    expect(m2.recipe).not.toHaveProperty('surfaces');
    // a bad material on the plan, and a cube on a bare recipe, refuse by name
    await expect(createCharacterHandler({ as: 'creature', spec: { plan: { ...RING_PLAN, materials: { Torso: 'golden' } } }, ref: 'uc_bad' })).rejects.toThrow(/plan.materials.Torso: unknown material 'golden'/);
  }, 240_000);

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

describe('create_character from an egocube: one sheet, many games', () => {
  it('makes the sheet\'s character at an age, records the sheet, and says when the sheet has moved since', async () => {
    await createSketchHandler({ title: 'Wren', ref: 'cc_ego', manifest: { kind: 'egocube', roll: { seed: 3, years: 11, facets: { pole: 'female' }, chapters: [{ chapter: 'time', years: 15 }] } } });
    const r = await createCharacterHandler({ egocube: 'cc_ego', years: 26, ref: 'cc_wren26' });
    expect(r.ok).toBe(true);
    expect(r.egocube).toMatchObject({ ref: 'cc_ego', years: 26, node: { years: 26, band: 'adult' } });
    const m = SketchRepository.getByRef('cc_wren26').manifest;
    expect(m.egocube).toMatchObject({ ref: 'cc_ego', rev: 1, years: 26 });
    expect(m.hero.outfit.pieces?.length ?? 0).toBeGreaterThanOrEqual(0);
    // the same sheet, the girl at 11: the female pole's child build
    await createCharacterHandler({ egocube: 'cc_ego', ref: 'cc_wren11' });
    expect(SketchRepository.getByRef('cc_wren11').manifest.hero.cast).toEqual({ pole: 'female', build: 'child' });
    // a hero's words lay over the sheet's
    await createCharacterHandler({ egocube: 'cc_ego', years: 26, spec: { palette: { Top: '#334455' } }, ref: 'cc_wren_own' });
    expect(SketchRepository.getByRef('cc_wren_own').manifest.hero.palette.Top).toBe('#334455');
    await expect(createCharacterHandler({ egocube: 'cc_ego', as: 'animal' })).rejects.toThrow(/makes a person \(as: hero\); leave `as` out/);
    // the sheet re-rolled: the character keeps what it was made with, and an edit says so
    await updateSketchHandler({ ref: 'cc_ego', patch: [{ op: 'set', path: '/roll/seed', value: 4 }] });
    const u = await updateCharacterHandler({ ref: 'cc_wren26', spec: { hair: 'bob' } });
    expect(u.egocube.moved).toMatch(/has moved since this character was made from it/);
  }, 600_000);

  it('a cast\'s cube makes each member by its path: a person through its door, a beast through the animal door', async () => {
    const cast = { seed: 2, cast: { rival: { relation: 'rival', body: 'person' }, red: { relation: 'party', body: 'beast', species: 'wolf' } } };
    const made = await createSketchHandler({ title: 'Cast', ref: 'cc_cast', manifest: { kind: 'egocube', cast } });
    expect(made.ok).toBe(true);
    expect(SketchRepository.getByRef('cc_cast').manifest.castSheet.order).toEqual(['hero', 'hero/rival', 'hero/red']);
    const r = await createCharacterHandler({ egocube: 'cc_cast', member: 'hero/rival', ref: 'cc_cast_rival' });
    expect(r.egocube).toMatchObject({ ref: 'cc_cast', member: { path: 'hero/rival', relation: 'rival', body: 'person' } });
    expect(SketchRepository.getByRef('cc_cast_rival').manifest.egocube).toMatchObject({ ref: 'cc_cast', member: 'hero/rival' });
    // made with its moves: its page's clip picker plays them (the rig preview's figure)
    expect(r.egocube.moves.react).toEqual(['hitHigh', 'stagger', 'knockedOut']);
    const scene = await WORLD_KINDS.layered.resolve(SketchRepository.getByRef('cc_cast_rival').manifest, { title: 'rival' });
    const clips = Object.keys(Object.values(scene.figures).find((f) => f?.rig && f.preview).clips);
    expect(clips).toEqual(expect.arrayContaining(['idle', 'walk', 'hitHigh', 'stagger', 'knockedOutDown', 'knockedOutUp', r.egocube.moves.win]));
    const w = await createCharacterHandler({ egocube: 'cc_cast', member: 'hero/red', title: 'animal · wolf', ref: 'cc_cast_red' });
    await mintSolidHandler({ kind: 'animal', spec: { species: 'wolf', motion: ['walk', 'trot', 'flinch', 'fall', 'rise'] }, title: 'animal · wolf', ref: 'cc_cast_red_solid' });   // its two gaits and its reactions rigged
    expect(manifestOf('cc_cast_red')).toBe(manifestOf('cc_cast_red_solid'));
    expect(w.egocube.member).toMatchObject({ path: 'hero/red', bond: 'party', body: 'beast' });
    await expect(createCharacterHandler({ egocube: 'cc_cast', member: 'hero/nobody' })).rejects.toThrow(/has no member 'hero\/nobody'/);
    await expect(createCharacterHandler({ egocube: 'cc_cast', years: 20 })).rejects.toThrow(/made by path \(member\)/);
  }, 600_000);
});

describe('create_character as a mascot (docs/mascot.md)', () => {
  it('rolls a sheet from its words, mints its body through the creature door, and makes the same mascot from an egocube', async () => {
    const r = await createCharacterHandler({ as: 'mascot', spec: { brief: 'a sonic-like mascot, but cheeky', seed: 2 }, ref: 'cc_mascot' });
    expect(r.ok).toBe(true);
    expect(r.mascot.facets).toMatchObject({ promise: 'mischief', accent: 'spike', hook: 'quills' });
    expect(r.next.tool).toBe('update_character');
    const m = SketchRepository.getByRef('cc_mascot').manifest;
    expect(m.plan.clips.idle).toBeTruthy();
    expect(m.dials).toMatchObject({ lean: -4, tilt: -9 });   // the promise's pose (law 9)
    expect(m).toMatchObject({ hullShade: true, toon: { light: true } });
    await expect(createCharacterHandler({ as: 'mascot', spec: { cast: 'male' } })).rejects.toThrow(/brief, facets, seed/);
    // the egocube kind: a cartoony brief rolls the same sheet, and the egocube door makes the same body
    await createSketchHandler({ title: 'Zip', ref: 'cc_ego_mascot', manifest: { kind: 'egocube', roll: { brief: 'a sonic-like mascot, but cheeky', seed: 2 } } });
    expect(SketchRepository.getByRef('cc_ego_mascot').manifest.sheet.tuning).toBe('mascot');
    const e = await createCharacterHandler({ egocube: 'cc_ego_mascot', ref: 'cc_ego_mascot_made' });
    expect(e.ok).toBe(true);
    const made = SketchRepository.getByRef('cc_ego_mascot_made').manifest;
    expect(JSON.stringify(made.plan)).toBe(JSON.stringify(m.plan));
    expect(made.dials).toEqual(m.dials);
    // a person drawn as a mascot mints through the same door, its face rigged: the expressions are clips
    const h = await createCharacterHandler({ as: 'mascot', spec: { brief: 'a mario-like mascot' }, ref: 'cc_mascot_human' });
    expect(h.mascot.facets).toMatchObject({ being: 'human', hook: 'cap' });
    const hm = SketchRepository.getByRef('cc_mascot_human').manifest;
    expect(Object.keys(hm.plan.clips)).toEqual(expect.arrayContaining(['blink', 'happy', 'surprised', 'sad', 'angry']));
    expect(hm.plan.rig.chains.lipU).toBeTruthy();
    // a real species made a mascot (docs/mascot-animals.md): its card's kit, its own coat
    const fx = await createCharacterHandler({ as: 'mascot', spec: { brief: 'a fox mascot' }, ref: 'cc_mascot_fox' });
    expect(fx.mascot.facets).toMatchObject({ animal: 'fox', promise: 'mischief' });
    expect(SketchRepository.getByRef('cc_mascot_fox').manifest.plan.segments.map((x) => x.name)).toEqual(expect.arrayContaining(['earR', 'snout', 'tail0']));
    // the egocube's mascot output: the person on the cube made as their mascot, with the model sheet
    await createSketchHandler({ title: 'Paladin', ref: 'cc_ego_person', manifest: { kind: 'egocube', roll: { brief: 'a weary paladin', seed: 3 } } });
    const pm = await createCharacterHandler({ egocube: 'cc_ego_person', output: 'mascot', ref: 'cc_ego_person_mascot' });
    expect(pm.ok).toBe(true);
    expect(pm.egocube.output).toBe('mascot');
    expect(pm.modelSheet.laws).toHaveLength(10);
    expect(pm.mascot.facets).toMatchObject({ promise: 'might', adorn: 'belt' });
    expect(SketchRepository.getByRef('cc_ego_person_mascot').manifest.plan.adorn.map((a) => a.id)).toEqual(['belt']);
  }, 300_000);
});
