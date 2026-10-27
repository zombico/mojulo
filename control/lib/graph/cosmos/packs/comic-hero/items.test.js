// The item cards: what a hero holds or carries, each one slot of the hero door's `gear` filled with an equipment
// build the door already makes. A card's build passes the door's gear validator; a card lands in the slot it names and
// the door holds it there by its class; two cards for one slot are refused by name; a member carries its signature items
// only when asked, and a swing word stands the hero only when asked. No item adds nothing. One card per family, chosen
// from the catalogue in code; comic-hero.deep.test.js validates every card on both bodies.
import { describe, it, expect } from 'vitest';
import { ITEMS, ITEM_IDS, ITEM_GAPS, withItems, swingOf } from './items.js';
import { CAST } from './cast.js';
import { ERA_IDS } from './costumes.js';
import { memberOrders } from './characters.js';
import { GEAR_SLOTS, validateGear, gearMounts } from '../../../polygonizer/hero-gear.js';
import { validateRig } from '../../../polygonizer/station-loft-rig.js';
import { validateHeroSpec, heroRecord, expandLayeredManifest } from '../../../../mcp/tools/layered.js';

const FAMILIES = ['shield', 'blade', 'staff', 'bow', 'sidearm', 'longGun'];
const firstOfFamily = (ids, cards) => [...new Set(ids.map((id) => cards[id].family))].map((f) => ids.find((id) => cards[id].family === f));
const fields = (spec) => { const { vibe: _v, ...f } = spec; return f; };
const LOOK = { tiered: 'comic-day', realistic: 'realistic-city' };

describe('comic hero pack: item cards', () => {
  it('each card reads, names a family, eras and a slot, and its build passes the door\'s gear validator', () => {
    for (const id of ITEM_IDS) {
      const C = ITEMS[id];
      expect(C.reads && FAMILIES.includes(C.family) && C.eras.length > 0 && C.eras.every((e) => ERA_IDS.includes(e)), id).toBe(true);
      expect(GEAR_SLOTS, id).toContain(C.slot);
      expect(validateGear({ [C.slot]: C.build }), id).toEqual([]);
    }
    expect(Object.keys(ITEM_GAPS).length).toBeGreaterThan(0);
  });

  it('a card lands in the slot it names; two cards for one slot, an unknown card and an unknown body are refused by name', () => {
    const bySlot = Object.fromEntries(GEAR_SLOTS.map((s) => [s, ITEM_IDS.find((id) => ITEMS[id].slot === s)]));
    const { gear } = withItems({}, Object.values(bySlot), 'tiered');
    for (const [slot, id] of Object.entries(bySlot)) expect(gear[slot], `${id} → ${slot}`).toEqual(ITEMS[id].build);
    const [a, b] = ITEM_IDS.filter((id) => ITEMS[id].slot === 'right');
    expect(() => withItems({}, [a, b], 'tiered')).toThrow(new RegExp(`items '${a}' and '${b}' both fill the right slot`));
    expect(() => withItems({}, ['mjolnir'], 'tiered')).toThrow(new RegExp(`no item card 'mjolnir' \\(known: ${ITEM_IDS[0]}`));
    expect(() => withItems({}, [a], 'chibi')).toThrow(/no body 'chibi' \(known: tiered, realistic\)/);
  });

  it('no item adds nothing: the spec itself, and the orders as without the option (no gear key, the member\'s own gesture)', () => {
    const spec = { cast: 'male' };
    expect(withItems(spec, [], 'tiered')).toBe(spec);
    expect(withItems(spec, null, 'tiered')).toBe(spec);
    for (const look of Object.values(LOOK)) {
      const bare = memberOrders('hero', look);
      expect(memberOrders('hero', look, { items: [], swing: null })).toEqual(bare);
      expect(bare.mint.args.spec.gear).toBeUndefined();
    }
  });

  it('a card of each family validates through the door on both bodies', () => {
    for (const id of firstOfFamily(ITEM_IDS, ITEMS)) for (const look of Object.values(LOOK)) {
      const spec = fields(memberOrders('hero', look, { era: 'modern', items: [id] }).mint.args.spec);
      expect(validateHeroSpec(spec), `${id} on ${look}`).toEqual([]);
      expect(spec.gear[ITEMS[id].slot].item).toBe(ITEMS[id].build.item);
    }
  });

  it('a member carries its signature items only when asked, and stands in a swing only when asked', () => {
    for (const m of CAST) for (const id of m.items || []) expect(ITEMS[id], `${m.id}: ${id}`).toBeTruthy();
    const m = CAST.find((x) => x.items?.some((id) => ITEMS[id].swing)), id = m.items.find((k) => ITEMS[k].swing);
    const signed = memberOrders(m.id, LOOK.tiered, { items: 'signature' }).mint.args.spec;
    expect(signed.gear[ITEMS[id].slot]).toEqual(ITEMS[id].build);
    expect(signed.gesture).toBe(m.gesture);
    const swung = fields(memberOrders(m.id, LOOK.tiered, { items: 'signature', swing: true }).mint.args.spec);
    expect(swung.gesture).toBe(swingOf(m.items));
    expect(validateHeroSpec(swung)).toEqual([]);
    const bare = CAST.find((x) => !x.items?.length);
    if (bare) expect(memberOrders(bare.id, LOOK.tiered, { items: 'signature' }).mint.args.spec.gear).toBeUndefined();
    const still = ITEM_IDS.find((k) => !ITEMS[k].swing);
    expect(() => memberOrders('hero', LOOK.tiered, { items: [still], swing: true })).toThrow(/no item card worn names a swing/);
  });

  it('the door holds each slot on its bone: one hero carrying a card in every slot', () => {
    const ids = GEAR_SLOTS.map((s) => ITEM_IDS.find((id) => ITEMS[id].slot === s));
    const hero = heroRecord(fields(memberOrders('hero', LOOK.tiered, { items: ids }).mint.args.spec));
    const m = expandLayeredManifest({ kind: 'layered', hero });
    const bone = Object.fromEntries(gearMounts(hero, validateRig(m.recipe.rig)).map((g) => [g.slot, g.bone]));
    expect(bone.right).toBe('handR');
    expect(bone.back).toBe('torso');
    expect(bone.hip).toBe('pelvis');
    expect(bone.left).toMatch(/L$/);
  }, 60_000);
});
