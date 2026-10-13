import { describe, it, expect } from 'vitest';
import { buildBus } from '../../worlds/event-bus.js';
import { readItems, itemKey, heldVar, ITEM_FORMS } from './items.js';
import { lowerMenus, menuPages, menuHtml, viewRows } from './menus.js';
import { lowerCues } from './cues.js';
import { mergeEventManifests } from '../../game/level-synth.js';
import { composeMechanics } from '../../game/mechanics.js';

// ITEMS: every inventory action is a transfer between holders (counts on the bus: held:<holder>:<item>), guarded so it
// never overdraws; every inventory menu is a view of a holder whose rows carry a verb.

const B = buildBus();
const play = {
  items: {
    tonic: { name: 'Tonic', about: 'Heals 25.', use: [{ add: 'hp', by: 25, max: 100 }, { say: 'Better.', as: 'toast' }] },
    'lamp oil': { value: 4 },
    'crest key': { kind: 'key' },
  },
  menus: [
    { id: 'counter', kind: 'shop', title: 'Apothecary', currency: 'gold', stock: [{ item: 'tonic', price: 12 }, { item: 'lamp oil', count: 2 }] },
    { id: 'trunk', kind: 'chest', holds: [{ item: 'crest key' }, { item: 'candle', count: 2 }] },
    { id: 'bag', kind: 'inventory', title: 'Bag' },
  ],
  cues: [{ id: 'gift', when: { on: 'gift' }, then: { give: { item: 'tonic', n: 2 } } }, { id: 'quaff', when: { on: 'quaff' }, then: { use: 'tonic' } }],
};
function bus(p = play, vars = {}) {
  const ev = mergeEventManifests(lowerCues(p) || {}, lowerMenus(p));
  const s = B.createBusState({ ...ev, vars: { ...(ev.vars || {}), ...vars } });
  const go = (...types) => { for (const t of types) { B.processEvents(s, [{ type: t }]); let w = B.watchEvents(s); for (let k = 0; w.length && k < 8; k++) { B.processEvents(s, w); w = B.watchEvents(s); } } return s; };
  return { s, go, held: (h, i) => s.vars[heldVar(h, i)] };
}

describe('the item table', () => {
  it('reads names, kinds and uses; an item with uses is consumable; any word is an item', () => {
    const T = readItems(play);
    expect(T.tonic).toMatchObject({ name: 'Tonic', kind: 'consumable' });
    expect(ITEM_FORMS).toContain(T.tonic.form);
    expect(T['lamp-oil']).toMatchObject({ key: 'lamp-oil', name: 'lamp oil', kind: 'thing', value: 4 });
    expect(itemKey('Lamp  Oil')).toBe('lamp-oil');
  });
  it('says what is wrong', () => {
    expect(() => readItems({ items: { tonic: { heals: 5 } } })).toThrow(/heals is not part of an item/);
    expect(() => readItems({ items: { key: { kind: 'key', use: { say: 'x' } } } })).toThrow(/a key is not used up/);
    expect(() => readItems({ items: { gem: { form: 'cube' } } })).toThrow(/form is a glyph/);
    expect(() => menuPages({ menus: [{ id: 's', kind: 'shop', currency: 'gold', stock: [{ item: 'rope' }] }] })).toThrow(/'rope' has no price here and no value/);
  });
});

describe('the verbs, on the bus', () => {
  it('take: one from the chest into the bag each time, until the chest has none', () => {
    const { go, held } = bus();
    go('menu-act:trunk:1');
    expect([held('trunk', 'candle'), held('bag', 'candle')]).toEqual([1, 1]);
    const s = go('menu-act:trunk:1', 'menu-act:trunk:1');
    expect([held('trunk', 'candle'), held('bag', 'candle')]).toEqual([0, 2]);
    expect(s.log.map((r) => r.type)).toContain('denied:candle');
  });
  it('buy: the price paid from the currency, the item in the bag; too poor, nothing moves; a counted stock runs out', () => {
    const { s, go, held } = bus(play, { gold: 20 });
    go('menu-act:counter:0');
    expect([s.vars.gold, held('bag', 'tonic')]).toEqual([8, 1]);
    go('menu-act:counter:0');
    expect([s.vars.gold, held('bag', 'tonic')]).toEqual([8, 1]);
    expect(s.log.map((r) => r.type)).toContain('denied:tonic');
    go('menu-act:counter:1', 'menu-act:counter:1', 'menu-act:counter:1');
    expect([s.vars.gold, held('bag', 'lamp-oil'), held('counter', 'lamp-oil')]).toEqual([0, 2, 0]);
  });
  it('use: one spent from the bag and its effects done; with none, it says so and does nothing', () => {
    const { s, go, held } = bus(play, { hp: 50 });
    go('gift');
    expect(held('bag', 'tonic')).toBe(2);
    go('menu-act:bag:0');
    expect([held('bag', 'tonic'), s.vars.hp]).toEqual([1, 75]);
    go('quaff', 'quaff');
    expect([held('bag', 'tonic'), s.vars.hp]).toEqual([0, 100]);
    expect(s.log.filter((r) => r.type === 'used:tonic').length).toBe(2);
    expect(s.log.map((r) => r.type)).toContain('denied:tonic');
  });
  it('a key is listed and not used: its row has no verb', () => {
    const rows = viewRows(play, { kind: 'inventory', id: 'bag', from: 'bag' });
    expect(rows.find((r) => r.item === 'crest-key').verb).toBeUndefined();
    expect(rows.find((r) => r.item === 'tonic').verb).toBe('use');
  });
});

describe('the views, drawn', () => {
  const page = (id) => menuPages(play).find((m) => m.id === id);
  it('a row whose holder holds none is not drawn; the one in focus shows its words and its verb', () => {
    const bag = page('bag');
    expect(menuHtml(bag, 0, 0, {})).toContain('Nothing carried.');
    const html = menuHtml(bag, 0, 0, { [heldVar('bag', 'tonic')]: 2, [heldVar('bag', 'candle')]: 1 });
    expect(html).toContain('▸ Tonic');
    expect(html).toContain('×2');
    expect(html).toContain('Heals 25.');
    expect(html).toContain('accept: use');
    expect(html).not.toContain('crest key');
  });
  it('a shop shows prices, what is left of a counted stock, and the purse', () => {
    const html = menuHtml(page('counter'), 1, 0, { gold: 9, [heldVar('counter', 'lamp-oil')]: 2 });
    expect(html).toContain('4 · 2 left');
    expect(html).toContain('gold: 9');
    expect(html).toContain('accept: buy');
  });
});

describe('collecting counts into the bag', () => {
  it('a pickup is counted on the bus and shown on the HUD by name', () => {
    const c = composeMechanics([{ kind: 'collect', into: 'bag', pickups: [{ item: 'gold coin', at: [3, 0, 0] }, { item: 'gold coin', at: [6, 0, 0] }] }, { kind: 'reach-exit', at: [9, 0, 0] }], { player: 'hero', storeSchema: { slices: [{ name: 'bag', kind: 'inventory' }] } });
    expect(c.events.hud).toContainEqual({ var: 'held:bag:gold-coin', label: 'gold coin' });
    const s = B.createBusState(c.events, c.events.entities);
    B.processEvents(s, [{ type: 'enter', zone: 'pk_0_0', entity: 'hero' }, { type: 'enter', zone: 'pk_0_1', entity: 'hero' }]);
    expect(s.vars['held:bag:gold-coin']).toBe(2);
  });
});

describe('the bag carried, level to level', () => {
  it('a move into or out of the bag says so, with the item and how many: bag:in:<item>:<n> / bag:out:<item>:<n>', () => {
    const { s, go } = bus(play, { gold: 20 });
    go('menu-act:counter:0', 'gift', 'quaff');
    expect(s.log.map((r) => r.type).filter((t) => t.startsWith('bag:'))).toEqual(['bag:in:tonic:1', 'bag:in:tonic:2', 'bag:out:tonic:1']);
  });
  it('the bag mechanic consumes the slice, may give back grants and consumes, and marks the contract', () => {
    const store = { slices: [{ name: 'bag', kind: 'inventory' }] };
    const c = composeMechanics([{ kind: 'bag' }, { kind: 'reach-exit', at: [9, 0, 0] }], { player: 'hero', storeSchema: store });
    expect(c.bag).toEqual({ slice: 'bag' });
    expect(c.consumes).toEqual([{ slice: 'bag' }]);
    expect(c.produces).toEqual([{ type: 'grant', slice: 'bag' }, { type: 'consume', slice: 'bag' }]);
    expect(() => composeMechanics([{ kind: 'bag' }, { kind: 'reach-exit', at: [9, 0, 0] }], { player: 'hero', storeSchema: { slices: [] } })).toThrow(/inventory/);
  });
  it('the page fills the bag from the slice at the start, and sends each bag:in / bag:out to the store', async () => {
    const { gameChannelScript } = await import('../../scene/channels/game.js');
    const s = gameChannelScript({ levelRef: 'x', consumes: [{ slice: 'bag' }], bag: { slice: 'bag' }, on: { 'goal:reached': { end: 'success' } } });
    expect(s).toContain("B.state.vars['held:bag:' + k] = items[k]");
    expect(s).toContain("emit({ type: m[1] === 'in' ? 'grant' : 'consume', slice: __GAME.bag.slice, item: m[2], count: Number(m[3]) })");
    // the page's own reading of the name, run
    const re = new RegExp(s.match(/\/\^bag:\(in\|out\)[^/]*\//)[0].slice(1, -1));
    expect(re.exec('bag:out:lamp-oil:2').slice(1)).toEqual(['out', 'lamp-oil', '2']);
    expect(gameChannelScript({ levelRef: 'x', on: { 'goal:reached': { end: 'success' } } })).not.toContain('held:bag:');
  });
  it('the store takes the envelope: what one level gained and spent is what the next starts with', async () => {
    const { buildGameStoreKernel } = await import('../../game/store-kernel.js');
    const K = buildGameStoreKernel(), schema = { slices: [{ name: 'bag', kind: 'inventory' }] };
    const s0 = K.createStore(schema);
    const r = K.applyEvents(schema, s0, [{ type: 'grant', slice: 'bag', item: 'coin', count: 3 }, { type: 'grant', slice: 'bag', item: 'tonic', count: 1 }, { type: 'consume', slice: 'bag', item: 'tonic', count: 1 }]);
    expect(r.state.bag.items).toEqual({ coin: 3 });
  });
});

describe('one declaration a produced event', () => {
  it('a collect and the bag into one inventory declare its grants once, unbounded', () => {
    const store = { slices: [{ name: 'bag', kind: 'inventory' }] };
    const c = composeMechanics([{ kind: 'collect', into: 'bag', pickups: [{ item: 'coin', at: [3, 0, 0] }] }, { kind: 'bag' }, { kind: 'reach-exit', at: [9, 0, 0] }], { player: 'hero', storeSchema: store });
    expect(c.produces).toEqual([{ type: 'grant', slice: 'bag' }, { type: 'consume', slice: 'bag' }]);
  });
});
