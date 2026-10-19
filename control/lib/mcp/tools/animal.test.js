// Isolate to an in-memory SQLite — must run before any import that pulls in db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { mintSolidHandler, SOLID_KINDS } from '@/lib/mcp/tools/mint-solid';
import { renderStoredSketchSvg } from '@/lib/graph/sketch/stored-sketch-svg';
import { classifyBucket } from '@/lib/graph/sketch/sketch-manifest';
import { getSolidVocabCatalog } from '@/lib/graph/solid-vocab/loader';

beforeEach(() => { closeDb(); });

describe("mint_solid kind 'animal'", () => {
  it('mints a ring-plan species through the layered plan door', async () => {
    const res = await mintSolidHandler({ kind: 'animal', title: 'Grey wolf', ref: 'an_wolf_plan', spec: { species: 'wolf' } });
    expect(res.ok).toBe(true);
    expect(res.species).toBe('wolf');
    const m = SketchRepository.getByRef('an_wolf_plan').manifest;
    expect(m.kind).toBe('layered');
    expect(m.plan.schema).toBe('layered-plan-v1');   // the plan is stored beside the recipe
    expect(m.provenance.plan_audit.source).toBe('agent');
    await expect(mintSolidHandler({ kind: 'animal', title: 'x', spec: { species: 'wolf', opts: { skullCfg: { length: 0.3 } } } })).rejects.toThrow(/ring plan/);
  });

  // The handler path is one for every species (its family's plan, minted through the layered door): two species
  // from two families, picked from the roster, stand for it. The families' plans are the fauna suite's.
  it('mints a family worked species as a layered plan, deterministically', async () => {
    const { SPECIES, speciesPlan } = await import('@/lib/graph/fauna/species');
    const ids = Object.keys(SPECIES);
    expect(ids).toEqual(expect.arrayContaining(['wolf', 'lion', 'horse', 'buck', 'bull', 'brownBear', 'hippo', 'raccoon', 'kangaroo']));
    const picked = [ids[0], ids.find((id) => SPECIES[id].family !== SPECIES[ids[0]].family)];
    expect(picked.every(Boolean)).toBe(true);
    for (const id of picked) {
      expect(JSON.stringify(speciesPlan(id))).toBe(JSON.stringify(speciesPlan(id)));   // recipes, not renders
      const res = await mintSolidHandler({ kind: 'animal', title: id, ref: `an_fauna_${id}`, spec: { species: id } });
      expect(res.ok).toBe(true);
      expect(SketchRepository.getByRef(`an_fauna_${id}`).manifest.kind).toBe('layered');
    }
  });

  it('mints a worked arthropod and a resolved one through the layered plan door', async () => {
    const bee = await mintSolidHandler({ kind: 'animal', title: 'Honey bee', ref: 'an_bee', spec: { species: 'honeyBee' } });
    expect(bee.ok).toBe(true); expect(bee.stance).toBe('hexapod'); expect(bee.legs).toBe(6);
    expect(SketchRepository.getByRef('an_bee').manifest.kind).toBe('layered');
    expect((await mintSolidHandler({ kind: 'animal', title: 'Crab', spec: { species: 'greenCrab' } })).stance).toBe('decapod');
    const wasp = await mintSolidHandler({ kind: 'animal', title: 'Wasp', ref: 'an_wasp', spec: { bug: { order: 'Hymenoptera', traits: { tail: 'gaster' }, length: 0.018 } } });
    expect(wasp.basis).toBe('honeyBee'); expect(wasp.worn.join(' ')).toMatch(/gaster/);
    expect(SketchRepository.getByRef('an_wasp').manifest.plan.schema).toBe('layered-plan-v1');
    await expect(mintSolidHandler({ kind: 'animal', title: 'x', spec: { bug: { order: 'Dragons' } } })).rejects.toThrow(/order 'Dragons'/);
  });

  it('takes an arthropod by the name people say, and names the stand-in for one not built', async () => {
    const lady = await mintSolidHandler({ kind: 'animal', title: 'Ladybug', ref: 'an_ladybug', spec: { species: 'a ladybug' } });
    expect(lady.species).toBe('ladybird'); expect(lady.resolved_from).toBe('a ladybug'); expect(lady.stance).toBe('hexapod');
    await expect(mintSolidHandler({ kind: 'animal', title: 'Wasp', spec: { species: 'wasp' } })).rejects.toThrow(/no 'wasp' species yet.*'honeyBee'/);
    const print = await mintSolidHandler({ kind: 'animal', title: 'Crawdad', spec: { bug: { like: 'crawdad', length: 0.2 } } });
    expect(print.basis).toBe('crayfish'); expect(print.resolved_from).toBe('crawdad'); expect(print.length_m).toBeCloseTo(0.2, 3);
    await expect(mintSolidHandler({ kind: 'animal', title: 'x', spec: { bug: { like: 'wasp' } } })).rejects.toThrow(/no 'wasp' bug yet/);
    const walker = await mintSolidHandler({ kind: 'animal', title: 'Bee', ref: 'an_beewalk', spec: { species: 'honeyBee', motion: 'walk' } });
    expect(walker.motion).toEqual({ gaits: ['walk'] });
    expect(SketchRepository.getByRef('an_beewalk').manifest.plan.motion).toMatchObject({ species: 'honeyBee', gaits: ['walk'], bug: { order: 'Hymenoptera' } });
    await expect(mintSolidHandler({ kind: 'animal', title: 'x', spec: { species: 'ladybird', motion: 'fly' } })).rejects.toThrow(/no gait 'fly' — this bug moves: walk/);
  });


  it('mints a bare archetype as a recipe and renders it through the stored-sketch dispatch', async () => {
    const res = await mintSolidHandler({ kind: 'animal', title: 'Canine', ref: 'an_wolf1', spec: { archetype: 'canine', view: 'lateral' } });
    expect(res.ok).toBe(true);
    expect(res.ref).toBe('an_wolf1');
    expect(res.stance).toBe('quadruped');

    const stored = SketchRepository.getByRef('an_wolf1');
    expect(stored.manifest.kind).toBe('animal');
    expect(stored.manifest.archetype).toBe('canine');
    expect(stored.manifest.view).toBe('lateral');
    expect(classifyBucket(stored.manifest)).toBe('illustration');

    const svg = await renderStoredSketchSvg(stored);
    expect(svg.startsWith('<svg')).toBe(true);
    // Recipes, not renders: the same stored recipe re-renders byte-identically.
    expect(await renderStoredSketchSvg(stored)).toBe(svg);
  });

  it('keeps caller opts on a bare archetype recipe', async () => {
    const res = await mintSolidHandler({ kind: 'animal', title: 'Long-faced canine', spec: { archetype: 'canine', opts: { skullCfg: { length: 0.3 } } } });
    const m = SketchRepository.getByRef(res.ref).manifest;
    expect(m.opts.skullCfg.length).toBe(0.3);
  });

  it('mints a bare archetype and reports a biped stance', async () => {
    const res = await mintSolidHandler({ kind: 'animal', title: 'Rex', spec: { archetype: 'theropod' } });
    expect(res.stance).toBe('biped');
    expect(SketchRepository.getByRef(res.ref).manifest.archetype).toBe('theropod');
  });

  it('lets an explicit archetype override the species frame', async () => {
    const res = await mintSolidHandler({ kind: 'animal', title: 'Bear-framed wolf', spec: { species: 'wolf', archetype: 'ursine' } });
    const m = SketchRepository.getByRef(res.ref).manifest;
    expect(m.archetype).toBe('ursine');
    expect(m.opts.coat).toBeDefined();              // …still wearing the wolf's dressing
  });

  it('errors teach: an unknown species / no door / a bad view name point at the card', async () => {
    await expect(mintSolidHandler({ kind: 'animal', title: 'x', spec: { species: 'dragon' } }))
      .rejects.toThrow(/`species` must be one of[\s\S]*wolf[\s\S]*get_solid_vocab/);
    await expect(mintSolidHandler({ kind: 'animal', title: 'x', spec: {} }))
      .rejects.toThrow(/pass `species`[\s\S]*or `archetype`/);
    await expect(mintSolidHandler({ kind: 'animal', title: 'x', spec: { species: 'wolf', view: 'sideways' } }))
      .rejects.toThrow(/`view` must be a number/);
  });

  it('is registered in the creature family and has a solid-vocab card', () => {
    expect(SOLID_KINDS.animal.family).toBe('creature');
    const card = getSolidVocabCatalog().get('animal');
    expect(card.entry).toBe('create_character');   // the Characters ring's door (it mints the same recipes)
    expect(card.family).toBe('creature');
  });
});

// OOZES (graph/mutagen): the door half. The law and the form are the mutagen suite's; here a species takes an ooze,
// the stored plan is the mutated body, the manifest keeps the list, and every other door refuses it.
describe("mint_solid kind 'animal' — oozes", () => {
  it('mints an oozed species: the stored plan is the mutated body and the manifest keeps the oozes', async () => {
    const { OOZES, resolveMutagen, oozeParams } = await import('@/lib/graph/mutagen/index');
    const { speciesParams } = await import('@/lib/graph/fauna/species');
    const { buildFauna } = await import('@/lib/graph/fauna/build');
    const id = Object.keys(OOZES).find((o) => OOZES[o].form?.scale);
    const res = await mintSolidHandler({ kind: 'animal', title: 'x', ref: 'an_oozed', spec: { species: 'wolf', ooze: [id] } });
    expect(res.ooze.oozes).toEqual([{ id, strength: 1 }]);
    expect(res.ooze.form.scale).toBe(OOZES[id].form.scale);
    const m = SketchRepository.getByRef('an_oozed').manifest;
    expect(m.ooze).toEqual({ oozes: [{ id, strength: 1 }], seed: res.ooze.seed });
    expect(m.plan).toEqual(buildFauna(oozeParams(speciesParams('wolf'), resolveMutagen([id], { key: 'wolf' }))));
    expect(m.species).toBe('wolf');
  });

  it('nothing acts ⇒ the plain species, byte-identical, with no ooze stored', async () => {
    const { OOZES } = await import('@/lib/graph/mutagen/index');
    const id = Object.keys(OOZES)[0];
    await mintSolidHandler({ kind: 'animal', title: 'x', ref: 'an_plain', spec: { species: 'wolf' } });
    const res = await mintSolidHandler({ kind: 'animal', title: 'x', ref: 'an_zero', spec: { species: 'wolf', ooze: { id, strength: 0 } } });
    expect(res.ooze).toBeUndefined();
    const [a, b] = ['an_plain', 'an_zero'].map((r) => SketchRepository.getByRef(r).manifest);
    expect(b.ooze).toBeUndefined();
    expect(JSON.stringify(b.plan)).toBe(JSON.stringify(a.plan));
  });

  it('refuses an ooze off a fauna species, beside motion, or that it cannot read', async () => {
    const { OOZES } = await import('@/lib/graph/mutagen/index');
    const { BUG_SPECIES } = await import('@/lib/graph/bugs/species');
    const id = Object.keys(OOZES)[0], bug = Object.keys(BUG_SPECIES)[0];
    await expect(mintSolidHandler({ kind: 'animal', title: 'x', spec: { species: 'wolf', ooze: 'ectoplasm' } })).rejects.toThrow(/unknown ooze[\s\S]*Oozes/);
    await expect(mintSolidHandler({ kind: 'animal', title: 'x', spec: { archetype: 'canine', ooze: id } })).rejects.toThrow(/mutates a `species`/);
    await expect(mintSolidHandler({ kind: 'animal', title: 'x', spec: { maker: 'fish', ooze: id } })).rejects.toThrow(/mutates a `species`/);
    await expect(mintSolidHandler({ kind: 'animal', title: 'x', spec: { species: bug, ooze: id } })).rejects.toThrow(/is a bug/);
    await expect(mintSolidHandler({ kind: 'animal', title: 'x', spec: { species: 'wolf', ooze: id, motion: 'walk' } })).rejects.toThrow(/`ooze` or `motion`/);
    await expect(mintSolidHandler({ kind: 'animal', title: 'x', spec: { species: 'wolf', seed: 3 } })).rejects.toThrow(/pass it with `ooze`/);
  });
});

describe("mint_solid kind 'animal' — the maker door", () => {
  const closed = async (plan) => {
    const { expandPlan } = await import('@/lib/graph/polygonizer/station-loft-plan.js');
    const { compileLayered, auditLayered } = await import('@/lib/graph/polygonizer/station-loft.js');
    return Object.entries(auditLayered(compileLayered(expandPlan(plan)))).filter(([, r]) => !r.pass).map(([n]) => n);
  };

  it('every maker builds a closed plan with its defaults', async () => {
    const { makerPlan } = await import('@/lib/mcp/tools/animal');
    for (const [m, p] of [['fish', {}], ['fish', { skeleton: 'cartilage' }], ['serpent', {}]]) expect(await closed(makerPlan(m, p))).toEqual([]);
  });

  it('mints a custom fish and a custom serpent, deterministically', async () => {
    const { makerPlan } = await import('@/lib/mcp/tools/animal');
    const eel = { length: 1.2, body: [[-0.37, 0.008, 0.018], [-0.18, 0.019, 0.03], [0.08, 0.024, 0.032], [0.24, 0.022, 0.027]],
      dorsal: [[0.2, 0.004], [0.0, 0.02], [-0.36, 0.01]], pectoral: null, pelvic: null, caudal: { kind: 'rounded', from: -0.36, len: 0.035 } };
    const snake = { girth: [0.05, 0.045], head: { shape: 'viper', scale: 0.2, skull: [1.3, 0.7] },
      path: { kind: 'raised', height: 0.4, ground: [[0.1, -0.6], [-0.1, -0.9], [0.1, -1.2]] } };
    expect(JSON.stringify(makerPlan('fish', eel))).toBe(JSON.stringify(makerPlan('fish', eel)));
    expect(JSON.stringify(makerPlan('serpent', snake))).toBe(JSON.stringify(makerPlan('serpent', snake)));
    expect(await closed(makerPlan('fish', eel))).toEqual([]);
    const a = await mintSolidHandler({ kind: 'animal', title: 'Eel', ref: 'an_mk_eel', spec: { maker: 'fish', params: eel } });
    const b = await mintSolidHandler({ kind: 'animal', ref: 'an_mk_snake', spec: { maker: 'serpent', params: snake, title: 'Viper' } });
    expect(a.ok && b.ok).toBe(true);
    expect(a.maker).toBe('fish');
    expect(SketchRepository.getByRef('an_mk_eel').manifest.kind).toBe('layered');
    expect(SketchRepository.getByRef('an_mk_snake').manifest.kind).toBe('layered');
  });

  it('mints a species by the name people say, and says what it resolved from', async () => {
    const res = await mintSolidHandler({ kind: 'animal', title: 'Kitty', ref: 'an_named_cat', spec: { species: 'a kitten' } });
    expect(res.species).toBe('houseCat');
    expect(res.resolved_from).toBe('a kitten');
    expect(res.stance).toBe('four legs');
    const exact = await mintSolidHandler({ kind: 'animal', title: 'Cat', ref: 'an_exact_cat', spec: { species: 'houseCat' } });
    expect(exact.resolved_from).toBeUndefined();
    expect((await mintSolidHandler({ kind: 'animal', title: 'Duck', ref: 'an_named_duck', spec: { species: 'duck' } })).stance).toBe('two legs (a bird)');
  });

  it('an asked-for animal not built yet names its stand-in; an unknown word points at the roster', async () => {
    await expect(mintSolidHandler({ kind: 'animal', title: 'x', spec: { species: 'bobcat' } })).rejects.toThrow(/no 'bobcat' species yet[\s\S]*'lynx'/);
    await expect(mintSolidHandler({ kind: 'animal', title: 'x', spec: { species: 'unicorn' } })).rejects.toThrow(/id: 'animals'/);
  });

  it('bad params error helpfully, pointing at the card', async () => {
    const bad = (spec) => expect(mintSolidHandler({ kind: 'animal', title: 'x', spec })).rejects.toThrow(/get_solid_vocab/);
    await bad({ maker: 'bird' });
    await bad({ maker: 'fish', params: { skeleton: 'bone' } });
    await bad({ maker: 'fish', params: { fins: 3 } });
    await bad({ maker: 'fish', params: { head: { mouth: 'beak' } } });
    await bad({ maker: 'fish', params: { length: -1 } });
    await bad({ maker: 'serpent', params: { path: { kind: 'zigzag' } } });
    await bad({ maker: 'serpent', params: { head: { shape: 'round' } } });
    await expect(mintSolidHandler({ kind: 'animal', title: 'x', spec: { maker: 'fish', params: { head: { mouth: 'beak' } } } })).rejects.toThrow(/terminal \| upturned/);
    await expect(mintSolidHandler({ kind: 'animal', title: 'x', spec: { maker: 'serpent', params: { girth: [5, 5] } } })).rejects.toThrow(/girth/);
  });
});
