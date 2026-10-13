import { describe, it, expect } from 'vitest';
import { buildBus } from '../../worlds/event-bus.js';
import { readItems, itemKey, heldVar, ITEM_FORMS } from './items.js';
import { lowerMenus, menuPages, menuHtml, viewRows, viewLive } from './menus.js';
import { ICON_IDS, iconFor } from './item-icons.js';
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
  const page = (id) => ({ ...menuPages(play).find((m) => m.id === id), layout: 'list' });
  it('a row whose holder holds none is not drawn; the one in focus shows its words and its verb (layout: list)', () => {
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
  it('a move says each holder it touches, with the item and how many: in:<holder>:<item>:<n> / out:…', () => {
    const { s, go } = bus(play, { gold: 20 });
    go('menu-act:counter:0', 'gift', 'quaff', 'menu-act:trunk:1');
    expect(s.log.map((r) => r.type).filter((t) => /^(in|out):/.test(t))).toEqual(['in:bag:tonic:1', 'in:bag:tonic:2', 'out:bag:tonic:1', 'in:bag:candle:1', 'out:trunk:candle:1']);
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
    expect(s).toContain("B.state.vars['held:bag:' + k] = bag[k]");
    expect(s).toContain("emit({ type: m[1] === 'in' ? 'grant' : 'consume', slice: into, item: m[3], count: Number(m[4]) })");
    // the page's own reading of the name, run
    const re = new RegExp(s.match(/\/\^\(in\|out\)[^/]*\//)[0].slice(1, -1));
    expect(re.exec('out:bag:lamp-oil:2').slice(1)).toEqual(['out', 'bag', 'lamp-oil', '2']);
    expect(re.exec('in:trunk:crest-key:1').slice(1)).toEqual(['in', 'trunk', 'crest-key', '1']);
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

describe('equipment', () => {
  const kit = {
    items: {
      sword: { equip: { slot: 'hand', on: { add: 'atk', by: 2 }, off: { add: 'atk', by: -2 } } },
      axe: { equip: { slot: 'hand', on: { add: 'atk', by: 3 }, off: { add: 'atk', by: -3 } } },
      cloak: { equip: { slot: 'back' } },
    },
    menus: [{ id: 'bag', kind: 'inventory' }],
    cues: [{ id: 'arm', when: { on: 'arm' }, then: [{ give: 'sword' }, { give: 'axe' }, { give: 'cloak' }] }, { id: 'draw', when: { on: 'draw' }, then: { equip: 'sword' } }],
  };
  it('equip wears it in its slot and does its on effects; another in the slot sends the first back, its off effects done', () => {
    const { s, go, held } = bus(kit, { atk: 1 });
    go('arm', 'draw');
    expect([held('bag', 'sword'), held('worn', 'sword'), s.vars.atk]).toEqual([0, 1, 3]);
    go('equip:axe');
    expect([held('worn', 'sword'), held('bag', 'sword'), held('worn', 'axe'), s.vars.atk]).toEqual([0, 1, 1, 4]);
    go('equip:cloak');
    expect([held('worn', 'axe'), held('worn', 'cloak')]).toEqual([1, 1]);
    go('unequip:axe');
    expect([held('worn', 'axe'), held('bag', 'axe'), s.vars.atk]).toEqual([0, 1, 1]);
  });
  it('the bag\'s view lists what is worn first, by slot, to unequip; equipment in the bag to equip', () => {
    const rows = viewRows(kit, { kind: 'inventory', id: 'bag', from: 'bag' });
    expect(rows.slice(0, 3).map((r) => [r.name, r.verb])).toEqual([['sword (hand)', 'unequip'], ['axe (hand)', 'unequip'], ['cloak (back)', 'unequip']]);
    expect(rows.find((r) => !r.worn && r.item === 'axe').verb).toBe('equip');
    const { go, held } = bus(kit, { atk: 0 });
    go('arm', 'menu-act:bag:3');   // the bag's sword row
    expect(held('worn', 'sword')).toBe(1);
  });
  it('says what is wrong', () => {
    expect(() => readItems({ items: { sword: { equip: 'hand' } } })).toThrow(/equip is \{ slot/);
    expect(() => readItems({ items: { sword: { equip: { slot: 'hand', grip: 2 } } } })).toThrow(/grip is not part of equipping/);
    expect(() => readItems({ items: { tonic: { use: { say: 'x' }, equip: { slot: 'hand' } } } })).toThrow(/used up or worn, not both/);
  });
  it('the bag mechanic carries what is worn and what the chests hold; the page restores both', async () => {
    const store = { slices: [{ name: 'bag', kind: 'inventory' }, { name: 'gear', kind: 'inventory' }, { name: 'world', kind: 'flags' }] };
    const c = composeMechanics([{ kind: 'bag', worn: 'gear', holders: 'world' }, { kind: 'reach-exit', at: [9, 0, 0] }], { player: 'hero', storeSchema: store });
    expect(c.bag).toEqual({ slice: 'bag', worn: 'gear', holders: 'world' });
    expect(c.consumes).toEqual([{ slice: 'bag' }, { slice: 'gear' }, { slice: 'world' }]);
    expect(c.produces.map((e) => `${e.type}→${e.slice}`)).toEqual(['grant→bag', 'consume→bag', 'grant→gear', 'consume→gear', 'setFlag→world']);
    expect(() => composeMechanics([{ kind: 'bag', worn: 'bag' }, { kind: 'reach-exit', at: [9, 0, 0] }], { player: 'hero', storeSchema: store })).toThrow(/worn is its own inventory slice/);
    const { gameChannelScript } = await import('../../scene/channels/game.js');
    const p = gameChannelScript({ levelRef: 'cellar', consumes: [{ slice: 'bag' }, { slice: 'gear' }, { slice: 'world' }], bag: c.bag, on: { 'goal:reached': { end: 'success' } } });
    expect(p).toContain("on.push({ type: 'equipped:' + k })");
    expect(p).toContain("B.state.vars['held:' + k.slice(pre.length)] = fl[k]");
    expect(p).toContain("emit({ type: 'setFlag', slice: __GAME.bag.holders, key: __hk(h, m[3]), value: Number(state.vars['held:' + h + ':' + m[3]]) || 0 })");
  });
  it('the store keeps a chest\'s count as a flag by level and holder, and what is worn in its own slice', async () => {
    const { buildGameStoreKernel } = await import('../../game/store-kernel.js');
    const K = buildGameStoreKernel(), schema = { slices: [{ name: 'gear', kind: 'inventory' }, { name: 'world', kind: 'flags' }] };
    const r = K.applyEvents(schema, K.createStore(schema), [{ type: 'grant', slice: 'gear', item: 'sword', count: 1 }, { type: 'setFlag', slice: 'world', key: 'cellar|trunk:candle', value: 0 }]);
    expect(r.ok).toBe(true);
    expect([r.state.gear.items, r.state.world.flags]).toEqual([{ sword: 1 }, { 'cellar|trunk:candle': 0 }]);
  });
});

describe('a list is not a view', () => {
  it('a status list draws its rows over vars, as it did', () => {
    const [m] = menuPages({ menus: [{ id: 'status', kind: 'list', title: 'Status', rows: [{ label: 'Health', var: 'hp' }] }] });
    const html = menuHtml(m, 0, 0, { hp: 7 });
    expect(html).toContain('Health');
    expect(html).toContain('{hp}');
    expect(html).not.toContain('Nothing carried');
  });
});

describe('the grid', () => {
  const items = { tonic: { about: 'Heals.', use: { add: 'hp', by: 5 } }, sword: { equip: { slot: 'hand' } }, 'crest key': { kind: 'key' }, apple: {} };
  const P = { items, menus: [{ id: 'bag', kind: 'inventory', title: 'Bag' }, { id: 'stall', kind: 'shop', currency: 'gold', stock: [{ item: 'apple', price: 2 }] }] };
  const bag = () => menuPages(P).find((m) => m.id === 'bag');
  const vars = { [heldVar('bag', 'tonic')]: 3, [heldVar('bag', 'apple')]: 1, [heldVar('bag', 'crest-key')]: 1, [heldVar('worn', 'sword')]: 1 };
  it('a view is a grid by default: tabs by the kinds it holds, icons by the items\' words', () => {
    const m = bag();
    expect(m.layout).toBe('grid');
    expect(m.tabs.map((t) => t.label)).toEqual(['All', 'Use', 'Gear', 'Keys', 'Things']);
    expect(iconFor({ key: 'tonic' })).toBe('potion');
    expect(iconFor({ key: 'apple' })).toBe('food');
    expect(iconFor({ key: 'widget', form: 'gem' })).toBe('gem');
    expect(m.rows.every((r) => r.icon.startsWith('<svg'))).toBe(true);
  });
  it('the focus runs over what is worn first, then the open tab\'s tiles; the drawing marks the same one', () => {
    const m = bag();
    expect(viewLive(m, vars, 0).map(([, r]) => r.item)).toEqual(['sword', 'tonic', 'crest-key', 'apple']);
    expect(viewLive(m, vars, 1).map(([, r]) => r.item)).toEqual(['sword', 'tonic']);   // Use: the worn strip, then the tonic
    const html = menuHtml(m, 1, 0, vars, 0);
    expect(html).toMatch(/<span class="pu-tile on k-consumable" data-pick="1" title="tonic"><svg/);
    expect(html).toContain('<b class="pu-qty">3</b>');
    expect(html).toMatch(/<span class="pu-slot k-equipment" data-pick="0" title="sword \(hand\)"><svg[\s\S]*?<i>hand<\/i>/);
    expect(html).toContain('<span class="pu-name">tonic</span>');
    expect(html).toContain('<b>enter</b> use');
    expect((html.match(/pu-tile empty/g) || []).length).toBe(15 - 3);
  });
  it('a worn slot in focus reads as worn, to unequip; a shop\'s tiles carry their prices and the purse', () => {
    const html = menuHtml(bag(), 0, 0, vars, 0);
    expect(html).toContain('<span class="pu-kind">worn · hand</span>');
    expect(html).toContain('<b>enter</b> unequip');
    const shop = menuHtml(menuPages(P).find((m) => m.id === 'stall'), 0, 0, { gold: 5 }, 0);
    expect(shop).toContain('<b class="pu-price">2</b>');
    expect(shop).toContain('<span class="pu-purse">gold <b>5</b></span>');
  });
  it('says what is wrong', () => {
    expect(() => readItems({ items: { tonic: { icon: 'teapot' } } })).toThrow(/icon is one of item, gem/);
    expect(() => menuPages({ menus: [{ id: 'b', kind: 'inventory', layout: 'tiles' }] })).toThrow(/layout is grid/);
    expect(() => menuPages({ menus: [{ id: 'b', kind: 'inventory', cols: 12 }] })).toThrow(/cols is how many tiles/);
    expect(ICON_IDS).toContain('potion');
  });
});
