/**
 * THE RPG's MENUS — the deep ones: the party, a skill or tech tree, a level up, a loadout, the inventory, a shop, the
 * quest log and a talk. Each is a def over the components, a list or grid beside the detail of what it has picked
 * (`{ pick }`), so going deeper is moving the focus, not another screen. The rules stay the game's: an idiom shows what
 * the host reads it and emits what was asked (learn, equip, buy), and the game's kernel says yes or no.
 */
const P = (name) => ({ param: name });
const I = (field) => ({ item: field });
const K = (path) => ({ pick: path });
const txt = (value, role) => ({ use: 'text', props: { value, ...(role ? { role } : {}) } });
const screen = (props, children) => ({ use: 'screen', props, children });
const row = (...children) => ({ use: 'stack', props: { dir: 'row', align: 'apart' }, children });
const col = (children, gap = 'tight') => ({ use: 'stack', props: { gap }, children });
const check = { use: 'stack', props: { dir: 'row', gap: 'tight', align: 'start' }, children: [{ use: 'text', props: { value: '☑' }, when: I('done') }, { use: 'text', props: { value: '☐' }, unless: I('done') }, txt(I('text'))] };
const compares = (rows) => ({ use: 'each', props: { rows, row: { use: 'compare', props: { label: I('label'), from: I('from'), to: I('to') } } } });
const stat = (label, field) => ({ use: 'stat', props: { label, value: K(`members.${field}`) } });

export const RPG_IDIOMS = {
  'party-screen': {
    kind: 'screen', about: 'the party: the members beside the one in focus, its status, gear and skills in tabs ([ and ] turn them)',
    reads: 'party: [{ id, name, cls, level, hp, hpMax, mp, mpMax, stats: { atk, def, mag, spd }, gear: [{ slot, name }], skills: [{ name, mp }] }]', emits: 'a member\'s then on accept (an equip screen, a class switch)',
    params: ['title', 'party'],
    node: screen({ title: P('title'), layer: 'modal', place: 'full' }, [{ use: 'split', children: [
      { use: 'window', props: { title: 'Party' }, children: [{ use: 'list', id: 'members', props: { rows: P('party'), row: col([
        row(txt(I('name'), 'heading'), txt({ format: 'Lv {level}' }, 'numeral')),
        { use: 'bar', props: { label: 'HP', value: I('hp'), max: I('hpMax'), variant: 'hp' } },
        { use: 'bar', props: { label: 'MP', value: I('mp'), max: I('mpMax'), variant: 'mp' } },
      ]) }, on: { accept: I('then') } }] },
      { use: 'window', children: [{ use: 'tabs', children: [
        { use: 'tab', props: { label: 'Status' }, children: [col([row({ use: 'portrait', props: { name: K('members.name'), size: 'l' } }, col([txt(K('members.name'), 'title'), txt(K('members.cls'), 'label')])), { use: 'divider' }, stat('Attack', 'stats.atk'), stat('Defence', 'stats.def'), stat('Magic', 'stats.mag'), stat('Speed', 'stats.spd')])] },
        { use: 'tab', props: { label: 'Equip' }, children: [{ use: 'list', id: 'gear', props: { rows: K('members.gear'), empty: 'Nothing worn', row: row(txt(I('slot'), 'label'), txt(I('name'))) }, on: { accept: { emit: 'equip-slot', member: K('members.id'), slot: I('slot') } } }] },
        { use: 'tab', props: { label: 'Skills' }, children: [{ use: 'list', props: { rows: K('members.skills'), empty: 'No skills yet', row: row(txt(I('name')), txt({ format: '{mp} MP' }, 'numeral')) } }] },
      ] }] },
    ] }, { use: 'legend', props: { rows: [{ action: 'tabNext', label: 'next tab' }, { action: 'right', label: 'detail' }, { action: 'back', label: 'back' }] } }]),
    example: { title: 'Party', party: { bind: 'party' } },
  },
  'skill-tree': {
    kind: 'screen', about: 'a skill or tech tree: nodes in tiers by what they require (learned, available, locked), the one in focus in detail, the points to spend',
    reads: 'nodes: [{ id, name, cost, state, requires?, about }], points', emits: '{ emit: learn, skill: <id> } on an available node',
    params: ['title', 'nodes', 'points'],
    node: screen({ title: P('title'), layer: 'modal', place: 'full' }, [{ use: 'split', props: { ratio: 'wide' }, children: [
      { use: 'window', children: [{ use: 'tree', id: 'skills', props: { nodes: P('nodes'), node: col([txt(I('name')), txt({ format: '{cost} SP' }, 'caption')]) }, on: { accept: { emit: 'learn', skill: I('id') } } }] },
      { use: 'window', children: [col([
        { use: 'counter', props: { label: 'Points', value: P('points'), icon: 'skill point' } }, { use: 'divider' },
        txt(K('skills.name'), 'title'), txt(K('skills.state'), 'label'), txt(K('skills.about')), { use: 'stat', props: { label: 'Cost', value: K('skills.cost') } },
      ], 'normal')] },
    ] }]),
    example: { title: 'Skills', nodes: { bind: 'skills' }, points: { bind: 'sp' } },
  },
  'level-up': {
    kind: 'screen', about: 'a level gained: points spent across the stats as a draft (never past the points or a stat\'s max), then confirmed',
    reads: 'who, level, points, stats: [{ id, label, value, max? }]', emits: '{ emit: level-up, allocate: { <stat>: n } } on confirm',
    params: ['who', 'level', 'points', 'stats'],
    node: screen({ title: 'Level up', layer: 'modal', place: 'center' }, [{ use: 'window', children: [col([
      row(txt(P('who'), 'title'), { use: 'stat', props: { label: 'Level', value: P('level') } }),
      { use: 'allocator', props: { rows: P('stats'), points: P('points') }, on: { confirm: { emit: 'level-up', allocate: { input: true } } } },
    ], 'normal')] }]),
    example: { who: { bind: 'levelup.who' }, level: { bind: 'levelup.level' }, points: { bind: 'levelup.points' }, stats: { bind: 'levelup.stats' } },
  },
  'loadout-screen': {
    kind: 'screen', about: 'prepare a loadout: the slots beside what could fill the one in focus, each candidate compared with what it replaces, under a weight budget',
    reads: 'slots: [{ slot, name, can: [{ id, name, weight, delta: [{ label, from, to }] }] }], weight, weightMax', emits: '{ emit: equip, slot, item } on a candidate',
    params: ['title', 'slots', 'weight', 'weightMax'],
    node: screen({ title: P('title'), layer: 'modal', place: 'full' }, [
      { use: 'bar', props: { label: 'Weight', value: P('weight'), max: P('weightMax'), variant: 'stamina' } },
      { use: 'split', props: { ratio: 'even' }, children: [
        { use: 'window', props: { title: 'Slots' }, children: [{ use: 'list', id: 'slots', props: { rows: P('slots'), row: col([txt(I('slot'), 'label'), txt(I('name'), 'heading')]) } }] },
        { use: 'window', props: { title: 'Swap for' }, children: [{ use: 'list', props: { rows: K('slots.can'), empty: 'Nothing fits this slot', row: col([row(txt(I('name'), 'heading'), { use: 'badge', props: { value: { format: '{weight} kg' } } }), compares(I('delta'))]) }, on: { accept: { emit: 'equip', slot: K('slots.slot'), item: I('id') } } }] },
      ] },
    ]),
    example: { title: 'Loadout', slots: { bind: 'loadout.slots' }, weight: { bind: 'loadout.weight' }, weightMax: { bind: 'loadout.weightMax' } },
  },
  'inventory-screen': {
    kind: 'screen', about: 'what is carried, by category (tabs): a grid of items beside the one in focus; accept uses or equips it',
    reads: 'categories: [{ label, items: [{ id, name, kind, count, about, then? }] }], gold', emits: 'an item\'s then (use, equip)',
    params: ['title', 'categories', 'gold'],
    node: screen({ title: P('title'), layer: 'modal', place: 'full' }, [
      { use: 'counter', props: { label: 'Gold', value: P('gold'), icon: 'gold' } },
      { use: 'window', children: [{ use: 'tabs', props: { pages: P('categories'), page: { use: 'split', props: { ratio: 'wide' }, children: [
        { use: 'grid', id: 'bag', props: { cells: I('items'), columns: 4, cell: { use: 'stack', props: { align: 'center', gap: 'tight' }, children: [{ use: 'icon', props: { name: I('name') } }, txt(I('name'), 'caption'), { use: 'badge', props: { value: { format: 'x{count}' } } }] } }, on: { accept: I('then') } },
        col([txt(K('bag.name'), 'title'), txt(K('bag.kind'), 'label'), txt(K('bag.about')), { use: 'stat', props: { label: 'Held', value: K('bag.count') } }], 'normal'),
      ] } } }] },
    ]),
    example: { title: 'Inventory', categories: { bind: 'bag' }, gold: { bind: 'player.gold' } },
  },
  'shop-screen': {
    kind: 'screen', about: 'a shop: buy and sell in tabs, the gold on hand, each ware compared with what you wear',
    reads: 'gold, buy: [{ id, name, price, about, delta, disabled? }], sell: [{ id, name, price }]', emits: '{ emit: buy | sell, item }',
    params: ['title', 'gold', 'buy', 'sell'],
    node: screen({ title: P('title'), layer: 'modal', place: 'full' }, [
      { use: 'counter', props: { label: 'Gold', value: P('gold'), icon: 'gold' } },
      { use: 'window', children: [{ use: 'tabs', children: [
        { use: 'tab', props: { label: 'Buy' }, children: [{ use: 'split', children: [
          { use: 'list', id: 'wares', props: { rows: P('buy'), row: row(txt(I('name')), txt({ format: '{price} G' }, 'numeral')) }, on: { accept: { emit: 'buy', item: I('id') } } },
          col([txt(K('wares.name'), 'title'), txt(K('wares.about')), compares(K('wares.delta'))], 'normal'),
        ] }] },
        { use: 'tab', props: { label: 'Sell' }, children: [{ use: 'list', props: { rows: P('sell'), empty: 'Nothing to sell', row: row(txt(I('name')), txt({ format: '{price} G' }, 'numeral')) }, on: { accept: { emit: 'sell', item: I('id') } } }] },
      ] }] },
    ]),
    example: { title: 'Armoury', gold: { bind: 'player.gold' }, buy: { bind: 'shop.buy' }, sell: { bind: 'shop.sell' } },
  },
  'quest-log': {
    kind: 'screen', about: 'the journal: quests beside the one in focus, its story and its steps (done ☑, to do ☐)',
    reads: 'quests: [{ id, name, state, about, steps: [{ text, done }] }]', emits: 'a quest\'s then (track it)',
    params: ['title', 'quests'],
    node: screen({ title: P('title'), layer: 'modal', place: 'full' }, [{ use: 'split', children: [
      { use: 'window', props: { title: 'Quests' }, children: [{ use: 'list', id: 'quests', props: { rows: P('quests'), row: row(txt(I('name')), { use: 'badge', props: { value: I('state') } }) }, on: { accept: { emit: 'track', quest: I('id') } } }] },
      { use: 'window', children: [col([txt(K('quests.name'), 'title'), txt(K('quests.about')), { use: 'divider', props: { label: 'Steps' } }, { use: 'each', props: { rows: K('quests.steps'), row: check } }], 'normal')] },
    ] }]),
    example: { title: 'Journal', quests: { bind: 'quests' } },
  },
  'dialogue-box': {
    kind: 'screen', about: 'someone speaks at the foot of the screen: their face, their words, the answers',
    reads: 'who, text, choices: [{ label, then }]', emits: 'the answer\'s then',
    params: ['who', 'text', 'choices'],
    node: screen({ layer: 'overlay', place: 'bottom' }, [{ use: 'window', children: [{ use: 'stack', props: { dir: 'row', align: 'start', gap: 'loose' }, children: [
      { use: 'portrait', props: { name: P('who'), size: 'l' } },
      col([txt(P('who'), 'heading'), txt(P('text')), { use: 'list', props: { rows: P('choices') }, on: { accept: I('then') } }], 'normal'),
    ] }] }]),
    example: { who: { bind: 'talk.who' }, text: { bind: 'talk.text' }, choices: { bind: 'talk.choices' } },
  },
};
