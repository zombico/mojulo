import { describe, it, expect } from 'vitest';
import { readEquipment, resolveEquipment, equipmentOrders, readGameworld, gameworldBibleHtml, characterReady, MEADOWMARK, MEADOWMARK_HERO, CLASS_SLOTS } from './index.js';
import { EQUIPMENT_ITEMS } from '../equipment/expand.js';

const bad = (e, re) => expect(() => readEquipment(e)).toThrow(re);
const G = readGameworld(MEADOWMARK_HERO);
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

  it('the example: the hero\'s staff is the template of its class; every other class is a task', () => {
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
    expect(waiting.waiting.map((w) => w.id)).toContain('mechanics');
    const ready = equipmentOrders(G, { ready: true, waiting: [] });
    expect(ready).toEqual({ waiting: [], mints: [{ tool: 'mint_solid', part: 'equipment', class: 'staff', args: { kind: 'equipment', title: 'Meadowmark · staff', item: 'staff', parts: { head: 'claw' }, dials: { focus: 'head', ornament: 1, mass: 1 }, gem: 'quartz' } }] });
  });

  it('pure: the same world, the same table', () => {
    expect(JSON.stringify(resolveEquipment(G))).toBe(JSON.stringify(resolveEquipment(G)));
  });
});
