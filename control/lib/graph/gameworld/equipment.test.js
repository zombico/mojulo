import { describe, it, expect } from 'vitest';
import { readEquipment, resolveEquipment, equipmentOrders, equippedHero, composeHero, HOLD_STAND, readGameworld, gameworldBibleHtml, characterReady, MEADOWMARK, MEADOWMARK_HERO, CLASS_SLOTS } from './index.js';
import { validateHeroSpec } from '../../mcp/tools/layered.js';
import { EQUIPMENT_ITEMS } from '../equipment/expand.js';

const bad = (e, re) => expect(() => readEquipment(e)).toThrow(re);
// the hero's staff alone (the example without its filled table), and the example as it stands
const G = readGameworld({ ...MEADOWMARK_HERO, equipment: undefined });
const FULL = readGameworld(MEADOWMARK_HERO);
const withEquipment = (equipment) => readGameworld({ ...MEADOWMARK_HERO, equipment });

describe('equipment', () => {
  it('says what is wrong', () => {
    bad([], /equipment is \{ classes \}/);
    bad({ gear: {} }, /gear is not part of the equipment/);
    bad({ classes: { lance: null } }, /'lance' is not a class of gear \(dagger, sword/);
    bad({ classes: { sword: 'big' } }, /classes.sword is \{ build, slot\?, tiers\? \}, or null/);
    bad({ classes: { sword: { build: {}, slot: 'head' } } }, /classes.sword.slot is 'right'/);
    bad({ classes: { sword: { build: { item: 'dagger' } } } }, /a row's build is its own class \('sword'\)/);
    bad({ classes: { sword: { build: { dials: { mass: 9 } } } } }, /equipment: classes.sword.build: gear.right: build.dials.mass/);
    bad({ classes: { sword: { build: {}, tiers: { final: {} } } } }, /equipment: classes.sword.tiers.final is not a stage/);
    expect(() => readGameworld({ ...MEADOWMARK, equipment: { classes: { lance: null } } })).toThrow(/'lance' is not a class of gear/);
  });

  it('a row\'s build names its class by default, and is carried in the class\'s first hand', () => {
    expect(readEquipment({ classes: { bow: { build: {} } } }).classes.bow).toEqual({ build: { item: 'bow' }, slot: CLASS_SLOTS.bow });
  });

  it('the hero\'s staff alone is the template of its class; every other class is a task', () => {
    const E = resolveEquipment(G);
    expect(E.rows.map((r) => r.class)).toEqual(EQUIPMENT_ITEMS);
    const staff = E.rows.find((r) => r.class === 'staff');
    expect(staff).toMatchObject({ status: 'seeded', from: 'hero:wind-staff', slot: 'right', build: { item: 'staff', gem: 'quartz' }, tiers: { late: { dials: { ornament: 3 } } } });
    expect(E.tasks).toEqual(EQUIPMENT_ITEMS.filter((c) => c !== 'staff'));
    expect(E.ledger).toEqual([]);
  });

  it('the world\'s own row wins over the hero\'s and is ledgered; null leaves a class empty on purpose; later items are listed', () => {
    const E = resolveEquipment(withEquipment({ classes: { staff: { build: { dials: { mass: 2 } } }, sword: { build: {} } } }));
    expect(E.rows.find((r) => r.class === 'staff')).toMatchObject({ status: 'authored', build: { item: 'staff', dials: { mass: 2 } } });
    expect(E.rows.find((r) => r.class === 'sword').status).toBe('authored');
    expect(E.ledger).toEqual([{ scope: 'equipment', at: 'equipment.classes.staff', key: 'staff', world: 'hero:wind-staff', local: 'authored' }]);
    const left = resolveEquipment(withEquipment({ classes: { staff: null } }));
    expect(left.rows.find((r) => r.class === 'staff').status).toBe('empty');
    expect(left.ledger[0]).toMatchObject({ key: 'staff', local: 'left empty' });
    const two = readGameworld({ ...MEADOWMARK_HERO, characters: { ...MEADOWMARK_HERO.characters, hero: { ...MEADOWMARK_HERO.characters.hero, adornment: { ...MEADOWMARK_HERO.characters.hero.adornment, items: [...MEADOWMARK_HERO.characters.hero.adornment.items, { id: 'spare-staff', slot: 'back', build: { item: 'staff' }, serves: ['wind-orb'] }] } } } });
    expect(resolveEquipment(two).rows.find((r) => r.class === 'staff')).toMatchObject({ from: 'hero:wind-staff', also: ['hero:spare-staff'] });
  });

  it('a world with no equipment and no adornment: every row empty, and the world bible is unchanged', () => {
    const E = resolveEquipment(readGameworld(MEADOWMARK));
    expect(E.rows.every((r) => r.status === 'empty')).toBe(true);
    expect(readGameworld(MEADOWMARK)).not.toHaveProperty('equipment');
    expect(gameworldBibleHtml({ ...MEADOWMARK, equipment: null })).toBe(gameworldBibleHtml(MEADOWMARK));
  });

  it('orders wait for the stats: nothing to mint until the step is ready, then one equipment mint per filled class', () => {
    const waiting = equipmentOrders(G, characterReady(MEADOWMARK_HERO).equipment);
    expect(waiting.mints).toEqual([]);
    expect(waiting.waiting.map((w) => w.id)).toContain('mechanics:stats');
    const ready = equipmentOrders(G, { ready: true, waiting: [] });
    expect(ready).toEqual({ waiting: [], mints: [{ tool: 'mint_solid', part: 'equipment', class: 'staff', args: { kind: 'equipment', title: 'Meadowmark · staff', spec: { item: 'staff', parts: { head: 'claw' }, dials: { focus: 'head', ornament: 1, mass: 1 }, gem: 'quartz' } } }] });
    // while waiting, the mints it will make are listed
    expect(equipmentOrders(G, characterReady(MEADOWMARK_HERO).equipment).planned).toEqual(ready.mints);
  });

  it('an order is one the door takes: the build rides under spec, and mint_solid mints it', async () => {
    process.env.SQLITE_PATH = ':memory:';
    const { mintSolidHandler } = await import('../../mcp/tools/mint-solid.js');
    const { mints } = equipmentOrders(FULL, { ready: true, waiting: [] });
    expect(mints.map((m) => m.class)).toEqual(EQUIPMENT_ITEMS);
    for (const m of mints.slice(0, 2)) expect((await mintSolidHandler({ ...m.args, ref: `equipment-order-${m.class}` }))?.ok, m.class).toBe(true);
  }, 60000);

  it('one gear language: every class wears the world\'s style unless its row names its own; the seeded staff too', () => {
    const E = resolveEquipment(FULL);
    expect(E.tasks).toEqual([]);
    for (const r of E.rows) expect(r.build.style?.id, r.class).toBe('wind-brass');
    const own = resolveEquipment(withEquipment({ ...MEADOWMARK_HERO.equipment, classes: { ...MEADOWMARK_HERO.equipment.classes, bow: { build: { style: 'druid' } } } }));
    expect(own.rows.find((r) => r.class === 'bow').build.style).toBe('druid');
    bad({ style: 'plastic' }, /equipment: style: .*'plastic' is not a sample/);
    // a style that would break the seeded template leaves it its own build, and says why
    // (a card whose bow names no limb, over a bow the hero carries with none of its own: the kernel's default card has one)
    const S = MEADOWMARK_HERO.equipment.style, limbless = { ...S, language: { ...S.language, bow: { focus: 'riser' } } };
    const A = MEADOWMARK_HERO.characters.hero.adornment;
    const broke = readGameworld({ ...MEADOWMARK_HERO, equipment: { style: limbless }, characters: { ...MEADOWMARK_HERO.characters, hero: { ...MEADOWMARK_HERO.characters.hero, adornment: { ...A, items: [...A.items, { id: 'gale-bow', slot: 'left', build: { item: 'bow' }, serves: ['wind-orb'] }] } } } });
    const bow = resolveEquipment(broke).rows.find((r) => r.class === 'bow');
    expect(bow).toMatchObject({ status: 'seeded', build: { item: 'bow' }, unstyled: expect.stringMatching(/a bow needs a limb/) });
    expect(bow.build).not.toHaveProperty('style');
    expect(resolveEquipment(broke).rows.find((r) => r.class === 'staff').build.style.id).toBe('wind-brass');
  });

  it('the hero equipped: the composed base holding the table\'s build of each item it carries, at the last stage; a picture, the base untouched', () => {
    const Q = equippedHero(FULL);
    expect(Q.carried).toEqual([{ id: 'wind-staff', slot: 'right', class: 'staff' }]);
    expect(Q.spec.gear.right).toMatchObject({ item: 'staff', gem: 'quartz', dials: { ornament: 3, mass: 1.25 }, style: { id: 'wind-brass' } });
    expect(Q.spec.gesture).toBe(HOLD_STAND.staff);
    expect(validateHeroSpec(Q.spec)).toEqual([]);
    expect(composeHero(FULL).spec).not.toHaveProperty('gear');
    expect(equippedHero(FULL, { stage: 'early' }).spec.gear.right.dials.ornament).toBe(1);
    expect(equippedHero(readGameworld(MEADOWMARK))).toBeNull();
  });

  it('pure: the same world, the same table', () => {
    expect(JSON.stringify(resolveEquipment(G))).toBe(JSON.stringify(resolveEquipment(G)));
  });
});
