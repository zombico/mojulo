process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

// Hero body types: a controllable world's bodies are checked against the one list the page draws
// (worlds/controllable/body-types.js). An unknown type used to mint ok:true and play an invisible hero.
import { describe, it, expect } from 'vitest';
import { composeWorld } from '@/lib/mcp/tools/compose-world';
import { updateSketchHandler } from '@/lib/mcp/tools/sketch-mint';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { BODY_TYPE_NAMES } from '@/lib/graph/worlds/controllable/body-types';

const hero = (body) => ({ id: 'hero', transform: { pos: [0, 0, 0] }, rule: { type: 'platform', speed: 4 }, body });
const compose = (overrides, ref) => composeWorld({ base: 'controllable', ref, overrides: { title: 'body types', ...overrides } });
const namesEveryType = (msg) => BODY_TYPE_NAMES.every((t) => msg.includes(t));

describe('controllable body types at authoring', () => {
  it("refuses 'zzzbogus' and 'character', naming the body types that draw", () => {
    for (const type of ['zzzbogus', 'character']) {
      let err = null;
      try { compose({ entities: [hero({ type })] }); } catch (e) { err = e; }
      expect(err, type).toBeTruthy();
      expect(err.message).toContain(`"${type}"`);
      expect(namesEveryType(err.message), err.message).toBe(true);
    }
    // a hero-shaped word is pointed at the made-character path
    expect(() => compose({ entities: [hero({ type: 'character' })] })).toThrow(/heroRef/);
  });

  it('a valid recipe mints and stores as given, and resolves its bodies untouched', async () => {
    const entities = [
      hero({ type: 'mesh', shape: 'box', size: [1, 1, 2], color: '#fa0' }),
      { id: 'cam', transform: { pos: [0, -6, 3] }, rule: { type: 'static' }, body: { type: 'none' } },
      { id: 'gem', transform: { pos: [3, 0, 0] }, rule: { type: 'clock', rate: 0 }, body: { type: 'glyph', form: 'gem' } },
      { id: 'prop', transform: { pos: [5, 0, 0] }, rule: { type: 'static' } },   // no body: none
    ];
    const res = compose({ entities, camera: { rule: 'follow', target: 'hero' } }, 'sk_bt_valid');
    expect(res.ok).toBe(true);
    const stored = SketchRepository.getByRef('sk_bt_valid').manifest;
    expect(stored.entities).toEqual(entities);
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('sk_bt_valid'));
    expect(payload.entities.find((e) => e.id === 'hero').body).toEqual(entities[0].body);
  });

  it('refuses a figure-rig body whose figure is not declared', () => {
    expect(() => compose({ entities: [hero({ type: 'figure-rig', figure: 'ghost' })] })).toThrow(/figure 'ghost' which is not declared in figures/);
  });

  it('update_sketch refuses a body type an edit introduces', async () => {
    compose({ entities: [hero({ type: 'mesh', shape: 'sphere', radius: 0.5 })] }, 'sk_bt_edit');
    await expect(updateSketchHandler({ ref: 'sk_bt_edit', patch: [{ op: 'set', path: '/entities/0/body/type', value: 'zzzbogus' }] }))
      .rejects.toThrow(/body type "zzzbogus", which nothing draws \(the body types: /);
    expect(SketchRepository.getByRef('sk_bt_edit').manifest.entities[0].body.type).toBe('mesh');
  });
});

describe('a made character as the hero (heroRef) at authoring', () => {
  const rigHero = hero({ type: 'figure-rig', figure: 'hero' });
  it('refuses an animal, pointing at the animal mascot', () => {
    SketchRepository.create({ ref: 'sk_bt_fox', title: 'animal · fox', manifest: { kind: 'animal', species: 'redFox' } });
    expect(() => compose({ entities: [rigHero], figures: { hero: { heroRef: 'sk_bt_fox' } } }))
      .toThrow(/is an animal, and an animal is not a pilot yet[\s\S]*as: 'mascot'/);
  });
  it('refuses a missing ref and a row that is no hero', () => {
    expect(() => compose({ entities: [rigHero], figures: { hero: { heroRef: 'sk_bt_nobody' } } })).toThrow(/is not a stored sketch/);
    SketchRepository.create({ ref: 'sk_bt_box', title: 'a box', manifest: { kind: 'controllable', entities: [] } });
    expect(() => compose({ entities: [rigHero], figures: { hero: { heroRef: 'sk_bt_box' } } })).toThrow(/is not a stored hero or mascot \(it is a 'controllable'/);
  });
  it('takes a stored hero', () => {
    SketchRepository.create({ ref: 'sk_bt_hero', title: 'hero', manifest: { kind: 'layered', hero: { cast: 'heroic' } } });
    expect(compose({ entities: [rigHero], figures: { hero: { heroRef: 'sk_bt_hero' } } }).ok).toBe(true);
  });
});
