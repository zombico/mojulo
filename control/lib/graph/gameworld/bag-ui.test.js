// THE BAG AS A SCREEN: read off a level's own mechanics (what it can hold, what each is for), dressed by the interface's
// `ui.inventory`; hosted on mana-ui's inventory, in the theme's look alone.
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { bagUi, readBagUi } from './bag-ui.js';
import { bagScript, bagSpec } from '../scene/channels/bag-channel.js';
import { manaUi } from '../../mana-ui/kernel.js';
import { readUi } from '../playscape/ui/interface-look.js';

const LEVEL = { game: { mechanics: [{ kind: 'bag', slice: 'bag' },
  { kind: 'trade', item: 'fee', at: [0, 0, 0] }, { kind: 'trade', item: 'gadget', at: [5, 0, 0], needs: [{ item: 'fee', n: 1 }], place: 'electronics', till: 't1' },
  { kind: 'deliver', id: 'parcel', wants: [{ item: 'gadget' }], reward: [{ item: 'coin', n: 30 }], at: [90, 0, 0], place: 'gun-store' },
  { kind: 'trade', item: 'passenger', at: [20, 0, 0] }, { kind: 'deliver', id: 'fare', repeat: true, wants: [{ item: 'passenger' }], reward: [{ item: 'coin', n: 12 }], at: [60, 0, 0] }] } };

describe('the bag as a screen', () => {
  it('lists what the level can hold, each its icon, its kind and what it is for; money apart', () => {
    const G = bagUi(LEVEL), by = Object.fromEntries(G.items.map((i) => [i.id, i]));
    expect(Object.keys(by).sort()).toEqual(['coin', 'fee', 'gadget', 'passenger']);
    expect(by.coin).toMatchObject({ icon: 'coin', kind: 'Money', category: 'Money', var: 'held:bag:coin' });
    expect(by.passenger).toMatchObject({ icon: 'person', kind: 'Passenger', category: 'Carried' });
    expect(by.gadget).toMatchObject({ icon: 'box', kind: 'Goods', about: 'Parcel: deliver the gadget to the gun store' });
    expect(by.fee.about).toBe('Parcel: the price of the gadget');
    expect(G.money).toBe('held:bag:coin');
    expect(G.title).toBe('Inventory');
  });
  it('the interface names its icons and its title; false, or a level with no bag, has no screen', () => {
    const G = bagUi(LEVEL, { title: 'Glovebox', icons: { gadget: 'gear', fee: 'ticket' } }), by = Object.fromEntries(G.items.map((i) => [i.id, i]));
    expect(G.title).toBe('Glovebox');
    expect(by.gadget.icon).toBe('gear'); expect(by.fee.icon).toBe('ticket'); expect(by.passenger.icon).toBe('person');
    expect(bagUi(LEVEL, false)).toBeNull();
    expect(bagUi({ game: { mechanics: [] } })).toBeNull();
    expect(readBagUi({ icons: { gadget: 'gear' } })).toEqual([]);
    expect(readBagUi({ icons: { gadget: 'spaceship' } })[0]).toMatch(/not a pictogram/);
    expect(readBagUi({ colour: 'red' })[0]).toMatch(/not an inventory setting/);
    expect(readUi({ inventory: { title: 'Bag' } })).toEqual([]);
    expect(readUi({ inventory: { title: '' } })[0]).toMatch(/ui.inventory.title/);
  });
  it('the page hosts it on mana-ui: what is held by category, each item its own icon, in the theme\'s look alone', () => {
    const G = bagUi(LEVEL), spec = bagSpec(G);
    expect(() => manaUi.readSpec(spec)).not.toThrow();
    const S = { bag: { categories: [{ label: 'Carried', items: [{ id: 'gadget', name: 'Gadget', icon: 'box', kind: 'Goods', about: 'Parcel: deliver the gadget to the gun store', count: 1 }] }, { label: 'Money', items: [{ id: 'coin', name: 'Coin', icon: 'coin', kind: 'Money', about: '', count: 42 }] }], money: 42 } };
    const rt = manaUi.runtime(spec, { read: (p) => manaUi.readPath(S, p), act() {}, now: () => 0 });
    rt.open('bag');
    const html = rt.view();
    for (const s of ['data-icon="box"', 'Parcel: deliver the gadget to the gun store', 'x1', 'Inventory', 'Carried', 'Money']) expect(html).toContain(s);
    expect(html).not.toMatch(/#[0-9a-f]{6}/i);
    const src = bagScript(G, 'console');
    for (const s of ['__mojBag', 'KeyI', 'Nothing carried']) expect(src).toContain(s);
    let bad = null;
    try { execFileSync(process.execPath, ['--input-type=module', '--check'], { input: src, stdio: ['pipe', 'pipe', 'pipe'] }); } catch (e) { bad = String(e.stderr || e.message).slice(0, 300); }
    expect(bad).toBe(null);
    expect(bagScript(null)).toBe('');
  });
});
