import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { manaUi, manaUiSource, withIdioms, IDIOMS, manaUiPage, manaUiBoard, SAMPLE_STATE, coverageOverlap } from './index.js';

// The runtime's concepts, each on the smallest spec that exercises it: reading that teaches, props down (literals and
// bindings), three owners of state, function as effects, focus in one and two directions, seats, the in-game layer,
// and the kernel self-contained. Every idiom on the sample state is the deep sweep's (idioms.deep.test.js).

const setPath = (o, path, v) => { const k = path.split('.'), last = k.pop(); for (const x of k) o = o[x] = o[x] || {}; o[last] = v; };
const host = (state, log = []) => ({ read: (p) => manaUi.readPath(state, p), act: (e, from) => { log.push({ e, from }); if (typeof e.set === 'string') setPath(state, e.set, e.to); } });
const screen = (children, props = {}) => ({ use: 'screen', props, children });
const run = (s, state = {}, log = []) => manaUi.runtime({ start: 'a', screens: { a: s } }, host(state, log));
const press = (rt, ...as) => as.forEach((a) => rt.press(a));
const txt = (value) => ({ use: 'text', props: { value } });

describe('mana-ui: reading teaches', () => {
  const read = (n, defs) => () => manaUi.readNode(n, defs);
  it('a node has no look of its own: a style prop points at the theme', () => {
    expect(read({ use: 'text', props: { value: 'x', color: '#f00' } })).toThrow(/no look of its own; the theme dresses it/);
    expect(read({ use: 'window', style: 'border:0' })).toThrow(/theme dresses/);
  });
  it('names what exists when a component, a prop, a verb or a child is wrong', () => {
    expect(read({ use: 'menuu' })).toThrow(/is a component \(screen, window/);
    expect(read({ use: 'text', props: { value: 'x', size: 3 } })).toThrow(/text takes value, role/);
    expect(read({ use: 'text', props: {} })).toThrow(/value is needed/);
    expect(read({ use: 'awareness', props: { state: 'angry' } })).toThrow(/one of: unaware, suspicious/);
    expect(read({ use: 'button', props: { label: 'x' }, on: { change: {} } })).toThrow(/button answers accept/);
    expect(read({ use: 'text', props: { value: 'x' }, children: [txt('y')] })).toThrow(/holds no children/);
    expect(read({ use: 'tabs', children: [txt('y')] })).toThrow(/is a tab/);
    expect(read({ use: 'hud', children: [txt('y')] })).toThrow(/is a region/);
    expect(read({ use: 'list', props: { rows: [], row: { use: 'nope' } } })).toThrow(/props\.row\.use 'nope'/);
  });
  it('a def is a composition: params replaced, a prop it does not take refused', () => {
    const defs = { chip: { params: ['what'], node: { use: 'text', props: { value: { param: 'what' }, role: 'label' } } } };
    expect(manaUi.readNode({ use: 'chip', props: { what: 'Lv 3' } }, defs)).toMatchObject({ use: 'text', props: { value: 'Lv 3', role: 'label' } });
    expect(read({ use: 'chip', props: { who: 1 } }, defs)).toThrow(/chip takes what/);
    expect(() => manaUi.readSpec({ screens: { a: screen([]) }, defs: { list: { node: {} } } })).toThrow(/component's name/);
    expect(() => manaUi.readSpec({ screens: { a: { use: 'window' } } })).toThrow(/is a screen/);
  });
});

describe('mana-ui: props down and state in three places', () => {
  it('a detail reads the row its list has picked, on the binding the game gave', () => {
    const rt = manaUi.runtime(withIdioms({ start: 'p', screens: { p: { use: 'party-screen', props: { title: 'Party', party: { bind: 'party' } } } } }), host({ party: SAMPLE_STATE.party }));
    const first = SAMPLE_STATE.party[0], second = SAMPLE_STATE.party[1];
    expect(rt.view()).toContain(first.cls);
    rt.press('down');
    expect(rt.view()).toContain(second.cls);
    expect(rt.view()).not.toContain(`>${first.cls}<`);
  });
  it('a bound input asks the host to set the game\'s value and shows what the host holds; a binding\'s path may be a row\'s', () => {
    const S = { cfg: { sound: 1 } }, log = [];
    const rt = run(screen([{ use: 'each', props: { rows: [{ label: 'Sound', var: 'cfg.sound' }], row: { use: 'field', props: { kind: 'toggle', label: { item: 'label' }, value: { bind: { item: 'var' } } } } } }]), S, log);
    rt.press('accept');
    expect(log.map((x) => x.e)).toEqual([{ set: 'cfg.sound', to: 0 }]);
    expect(rt.view()).toContain('data-on="no"');
    const lit = run(screen([{ use: 'toggle', props: { label: 'Grid', value: false } }]));
    lit.press('accept');
    expect(lit.view()).toContain('data-on="yes"');
  });
  it('a draft is the screen\'s until confirmed: an allocation never passes its points or a row\'s max', () => {
    const log = [], rt = run(screen([{ use: 'allocator', props: { points: 2, rows: [{ id: 'atk', label: 'Attack', value: 5 }, { id: 'mag', label: 'Magic', value: 4, max: 5 }] }, on: { confirm: { emit: 'level-up', allocate: { input: true } } } }]), {}, log);
    press(rt, 'right', 'right', 'right');               // two points, the third refused
    press(rt, 'down', 'right');                          // none left for magic
    press(rt, 'up', 'left', 'down', 'right', 'right');   // one back from attack; magic stops at its max
    press(rt, 'down', 'accept');
    expect(log.map((x) => x.e)).toEqual([{ emit: 'level-up', allocate: { atk: 1, mag: 1 } }]);
  });
  it('a name is typed from a grid: the draft is the screen\'s, done sets the game\'s', () => {
    const S = { name: '' }, log = [], rt = run(screen([{ use: 'textentry', props: { value: { bind: 'name' }, max: 3 } }]), S, log);
    press(rt, 'accept', 'right', 'accept', 'accept', 'accept');   // A, B, B, and a fourth refused by max
    expect(rt.view()).toContain('ABB');
    while (rt.state().kind !== 'char-done') rt.press('down');
    rt.press('accept');
    expect(S.name).toBe('ABB');
  });
  it('a name is typed straight in from a keyboard: its charset and max kept, erased, done as Done does', () => {
    const S = { name: '' }, rt = run(screen([{ use: 'textentry', props: { value: { bind: 'name' }, max: 4 } }, { use: 'button', props: { label: 'x' } }]), S);
    expect(rt.typing()).toBe(true);
    expect(rt.type('ab1 c!d')).toBe(true);   // lower case read as capitals; the digit and the mark not in the letters
    expect(rt.view()).toContain('AB C');
    expect(rt.type('e')).toBe(false);         // past the max
    expect(rt.erase()).toBe(true);
    expect(rt.submit()).toBe(true);
    expect(S.name).toBe('AB');
    while (rt.state().kind !== 'button') rt.press('down');
    expect([rt.typing(), rt.type('a'), rt.erase(), rt.submit()]).toEqual([false, false, false, false]);   // nothing in focus to type into
  });
  it('when and unless draw a node only while their value says so', () => {
    const rt = run(screen([{ use: 'text', props: { value: 'ready' }, when: { bind: 'ok' } }, { use: 'text', props: { value: 'wait' }, unless: { bind: 'ok' } }]), { ok: false });
    expect(rt.view()).toContain('wait');
    expect(rt.view()).not.toContain('ready');
  });
});

describe('mana-ui: function as effects', () => {
  it('a row does its own effect; open, close and back are the runtime\'s, every other effect the host\'s', () => {
    const log = [], items = [{ label: 'Go', then: { open: 'b' } }, { label: 'Quit', then: [{ emit: 'quit' }, { close: true }] }];
    const rt = manaUi.runtime({ start: 'a', screens: { a: screen([{ use: 'list', props: { rows: items }, on: { accept: { item: 'then' } } }]), b: screen([{ use: 'button', props: { label: 'Up' }, on: { accept: { back: true } } }]) } }, host({}, log));
    rt.press('accept');
    expect(rt.state().stack).toEqual(['a', 'b']);
    rt.press('accept');
    expect(rt.state().stack).toEqual(['a']);
    press(rt, 'down', 'accept');
    expect(log.map((x) => x.e)).toEqual([{ emit: 'quit' }, { emit: 'mana:closed' }]);
    expect(log[0].from).toMatchObject({ screen: 'a', verb: 'accept', seat: 0 });
    expect(rt.state().screen).toBe(null);
  });
  it('a disabled row does nothing; a bound carousel sets the next item\'s id; a slider stops at its max', () => {
    const S = { arena: 'b', vol: 9 }, log = [];
    const rt = run(screen([
      { use: 'list', props: { rows: [{ label: 'x', disabled: true, then: { emit: 'x' } }] }, on: { accept: { item: 'then' } } },
      { use: 'carousel', props: { items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], value: { bind: 'arena' } } },
      { use: 'slider', props: { label: 'Volume', value: { bind: 'vol' }, max: 10 } },
    ]), S, log);
    rt.press('accept');
    press(rt, 'down', 'right', 'down', 'right', 'right');
    expect(log.map((x) => x.e)).toEqual([{ set: 'arena', to: 'c' }, { set: 'vol', to: 10 }, { set: 'vol', to: 10 }]);
  });
});

describe('mana-ui: focus', () => {
  it('a grid moves in two directions and leaves by its edge', () => {
    const rt = run(screen([{ use: 'grid', props: { cells: ['a', 'b', 'c', 'd', 'e'], columns: 3 } }, { use: 'button', props: { label: 'After' } }]));
    press(rt, 'right', 'down');
    expect(rt.view()).toMatch(/data-st="focus"[^>]*>e<|>e<\/span><\/div>/);
    rt.press('down');
    expect(rt.state().kind).toBe('button');
  });
  it('tabs turn on [ and ]; the state says which is open', () => {
    const rt = run(screen([{ use: 'tabs', children: ['A', 'B', 'C'].map((label) => ({ use: 'tab', props: { label }, children: [txt(label)] })) }]));
    expect(rt.state().tabs).toEqual([0]);
    press(rt, 'tabNext', 'tabNext');
    expect(rt.state().tabs).toEqual([2]);
    rt.press('tabNext');
    expect(rt.state().tabs).toEqual([0]);
  });
  it('a long list scrolls with the focus, saying how much is above and below', () => {
    const rt = run(screen([{ use: 'list', props: { rows: ['a', 'b', 'c', 'd', 'e', 'f'], visible: 3 } }]));
    expect(rt.view()).toContain('▼ 3 more');
    press(rt, 'down', 'down', 'down', 'down');
    expect(rt.view()).toContain('▲ 2 more');
    expect((rt.view().match(/class="mana-row"/g) || []).length).toBe(3);
  });
  it('a tree lays nodes in tiers by what they require; a locked node is read, not taken', () => {
    const log = [], nodes = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', requires: ['a'] }, { id: 'c', name: 'C', requires: ['b'], state: 'locked' }];
    const rt = run(screen([{ use: 'tree', props: { nodes }, on: { accept: { emit: 'learn', skill: { item: 'id' } } } }]), {}, log);
    expect((rt.view().match(/class="mana-tier"/g) || []).length).toBe(3);
    press(rt, 'right', 'accept', 'right', 'accept');
    expect(log.map((x) => x.e)).toEqual([{ emit: 'learn', skill: 'b' }]);
  });
  it('a seat\'s own pick reads the row that seat is on, the path built from data', () => {
    const rows = [{ name: 'Ayla' }, { name: 'Rook' }];
    const rt = run(screen([
      { use: 'grid', id: 'roster', props: { cells: rows, columns: 2 } },
      { use: 'each', props: { rows: [{ seat: 1 }, { seat: 2 }], row: { use: 'text', props: { value: { pick: { format: 'roster@{seat}.name' } } } } } },
    ], { seats: 2 }));
    rt.press('right', 1);
    expect(rt.view()).toMatch(/Ayla<\/span><span[^>]*>Rook/);
  });
  it('left and right cross the panes of a split, landing on the active row', () => {
    const rt = run(screen([{ use: 'split', children: [
      { use: 'list', id: 'l', props: { rows: ['a', 'b', 'c'] } },
      { use: 'button', props: { label: 'Detail' } },
    ] }]));
    press(rt, 'down', 'right');
    expect(rt.state().kind).toBe('button');
    rt.press('left');
    expect(rt.state()).toMatchObject({ kind: 'row', focus: 1 });
  });
  it('a list id is its screen\'s: two screens with one id each read their own', () => {
    const scr = (rows) => screen([{ use: 'list', id: 'l', props: { rows } }, { use: 'text', props: { value: { pick: 'l' } } }]);
    const rt = manaUi.runtime({ start: 'a', screens: { a: scr(['one']), b: scr(['two']) } }, host({}));
    rt.open('b'); rt.press('back');
    expect(rt.view()).toMatch(/one<\/span>(?![\s\S]*two)/);
  });
  it('each seat has its own cursor, and its picks say whose', () => {
    const log = [], rt = run(screen([{ use: 'grid', props: { cells: [{ id: 'x' }, { id: 'y' }], columns: 2 }, on: { accept: { emit: 'pick', seat: { seat: true }, id: { item: 'id' } } } }], { seats: 2 }), {}, log);
    rt.press('right', 1);
    rt.press('accept', 0); rt.press('accept', 1);
    expect(rt.state().seats).toEqual({ 0: 0, 1: 1 });
    expect(log.map((x) => x.e)).toEqual([{ emit: 'pick', seat: 0, id: 'x' }, { emit: 'pick', seat: 1, id: 'y' }]);
    expect(rt.press('accept', 2)).toBe(false);
    expect(rt.view()).toContain('data-seats="2"');
  });
});

describe('mana-ui: in game', () => {
  it('the HUD is drawn under the stack, takes no focus, and places what is over the world by its screen x and y', () => {
    const S = { foes: [{ name: 'A', state: 'alert', x: 0.25, y: 0.5 }, { name: 'B', state: 'unaware', x: 1.4, y: 0.5 }] };
    const spec = { hud: { use: 'hud', children: [
      { use: 'region', props: { at: 'top-left' }, children: [{ use: 'bar', props: { value: 3, max: 4, variant: 'hp' } }] },
      { use: 'anchors', props: { rows: { bind: 'foes' }, row: { use: 'awareness', props: { state: { item: 'state' } } } } },
    ] }, screens: { pause: screen([{ use: 'button', props: { label: 'Resume' } }]) } };
    const rt = manaUi.runtime(spec, host(S)), v = rt.view();
    expect(rt.state().focusables).toBe(0);
    expect(v).toContain('left:25%;top:50%');
    expect(v).toContain('data-state="alert"');
    expect(v).not.toContain('data-state="unaware"');   // off screen: not drawn
    rt.open('pause');
    expect(rt.view().indexOf('mana-hud')).toBeLessThan(rt.view().indexOf('mana-screen'));
    expect(rt.state().focusables).toBe(1);
  });
  it('a passing anchor rises once from where it lands: a row\'s id is its element, so a number that lands again is new', () => {
    const S = { pops: [{ id: 1, x: 0.5, y: 0.5, value: 4 }] }, el = new JSDOM('<div></div>').window.document.querySelector('div');
    const rt = manaUi.runtime({ hud: { use: 'hud', children: [{ use: 'anchors', props: { rows: { bind: 'pops' }, pass: true, row: txt({ item: 'value' }) } }] }, screens: {} }, host(S));
    const m = manaUi.mount(el, rt), first = el.querySelector('.mana-anchor');
    expect(el.querySelector('.mana-anchors').getAttribute('data-pass')).toBe('yes');
    expect(first.getAttribute('data-key')).toBe('a1');
    S.pops = [{ id: 2, x: 0.5, y: 0.5, value: 4 }]; rt.tick(); m.paint();
    expect(el.querySelector('.mana-anchor')).not.toBe(first);   // the same place, the same words: a new number all the same
  });
  it('the HUD reads a screen\'s pick in the frame the screen picks it (the target in focus, marked over its head)', () => {
    const S = { foes: [{ id: 'a', x: 0.3, y: 0.5, aim: { a: true } }, { id: 'b', x: 0.7, y: 0.5, aim: { b: true } }] };
    const spec = { hud: { use: 'hud', children: [{ use: 'anchors', props: { rows: { bind: 'foes' }, row: { use: 'stack', children: [{ use: 'badge', props: { value: '▼' }, when: { pick: { format: 'targets.aim.{id}' } } }] } } }] },
      screens: { aim: screen([{ use: 'list', id: 'targets', props: { rows: { bind: 'foes' } } }]) } };
    const rt = manaUi.runtime(spec, host(S));
    rt.open('aim');
    const marked = () => [...rt.view().matchAll(/data-key="a(\w)"[^>]*><div[^>]*>(<span class="mana-badge")?/g)].filter((m) => m[2]).map((m) => m[1]);
    expect(marked()).toEqual(['a']);
    rt.press('down');
    expect(marked()).toEqual(['b']);
  });
  it('a bar without its numbers is read by its length alone (a foe\'s health)', () => {
    const view = (numbers) => manaUi.runtime({ start: 'a', screens: { a: screen([{ use: 'bar', props: { value: 3, max: 4, variant: 'hp', numbers } }]) } }, host({})).view();
    expect(view(true)).toContain('3/4');
    expect(view(false)).not.toContain('3/4');
    expect(view(false)).toContain('width:75%');
  });
  it('an anchor\'s row may say its point in the game\'s world, for a surface that is the world (a headset)', () => {
    const rt = manaUi.runtime({ hud: { use: 'hud', children: [{ use: 'anchors', props: { rows: [{ id: 'a', x: 0.5, y: 0.5, world: [1.23456, -2, 3] }, { id: 'b', x: 0.2, y: 0.5 }], row: txt('x') } }] }, screens: {} }, host({}));
    expect(rt.view()).toContain('data-key="aa" data-world="1.235,-2,3"');
    expect(rt.view()).toMatch(/data-key="ab" style=/);
  });
  it('a HUD region\'s place may be bound: the part moves to the corner the game names', () => {
    const S = { at: 'bottom-right' }, spec = { hud: { use: 'hud', children: [{ use: 'region', props: { at: { bind: 'at' } }, children: [txt('Foes')] }] }, screens: {} };
    const rt = manaUi.runtime(spec, host(S));
    expect(rt.view()).toMatch(/class="mana-place" data-at="bottom-right"/);
    S.at = 'top-left'; rt.tick();
    expect(rt.view()).toMatch(/class="mana-place" data-at="top-left"/);
  });
  it('a frame re-renders only when a value it read has changed', () => {
    const S = { hp: 10 }, rt = manaUi.runtime({ hud: { use: 'hud', children: [{ use: 'region', props: { at: 'top' }, children: [{ use: 'bar', props: { value: { bind: 'hp' }, max: 40, variant: 'hp' } }] }] }, screens: {} }, host(S));
    expect(rt.tick()).toBe(false);
    S.hp = 2;
    expect(rt.tick()).toBe(true);
    expect(rt.view()).toContain('data-low="yes"');
  });
});

describe('mana-ui: the live game', () => {
  const hudOf = (children, S = {}) => manaUi.runtime({ hud: { use: 'hud', children }, screens: {} }, host(S));
  const at = (c) => ({ use: 'region', props: { at: 'top' }, children: [c] });
  it('a fighter\'s bar shows the chip of the last hit, and the second fighter\'s fills from the right', () => {
    const v = hudOf([at({ use: 'bar', props: { value: 6, max: 10, ghost: 8, dir: 'rtl' } })]).view();
    expect(v).toContain('data-dir="rtl"');
    expect(v).toContain('<u style="left:60%;width:20%"></u>');
    expect(hudOf([at({ use: 'bar', props: { value: 6, max: 10, ghost: 4 } })]).view()).not.toContain('<u ');   // healing leaves no chip
  });
  it('what is off screen is held at the edge with an arrow toward it; what is on screen is not', () => {
    const v = hudOf([{ use: 'edges', props: { markers: [{ x: 1.4, y: 0.5, kind: 'goal' }, { x: 0.5, y: -0.2, kind: 'foe' }, { x: 0.4, y: 0.4, kind: 'ally' }] } }]).view();
    expect(v).toContain('left:97%;top:50%');
    expect(v).toMatch(/→★/);
    expect(v).toMatch(/↑✕/);
    expect(v).not.toContain('data-kind="ally"');
  });
  it('harm\'s bearing becomes a mark on the ring, turned toward it', () => {
    const v = hudOf([{ use: 'threat', props: { markers: [{ bearing: 90 }, { bearing: 180 }] } }]).view();
    expect(v).toContain('left:95%;top:50%;transform:translate(-50%,-50%) rotate(90deg)');
    expect(v).toContain('left:50%;top:95%');
  });
  it('a table marks your row by a shape; a slot shows its key, cooldown and the one in hand; a dial turns with its value', () => {
    const t = hudOf([at({ use: 'table', props: { columns: ['name', { key: 'score', align: 'right' }], rows: [{ name: 'A', score: 3 }, { name: 'B', score: 2, self: true }] } })]).view();
    expect(t).toMatch(/<tr data-mark="yes"><td>B<\/td><td data-align="right">2<\/td>/);
    const sl = hudOf([at({ use: 'slot', props: { name: 'Fire Bolt', key: 'E', cooldown: 0.25, active: true } })]).view();
    expect(sl).toContain('data-active="yes"');
    expect(sl).toContain('height:25%');
    expect(sl).toContain('>E<');
    expect(hudOf([at({ use: 'gauge', props: { value: 120, max: 240 } })]).view()).toContain('rotate(0deg)');
  });
  it('a hud holds regions and layers only; a screen lays its own parts out in regions over the held game', () => {
    expect(() => manaUi.readNode({ use: 'hud', children: [{ use: 'gauge', props: { value: 1, max: 2 } }] })).toThrow(/a region .* or a layer \(anchors, edges, threat, letterbox\)/);
    const rt = run(screen([{ use: 'region', props: { at: 'bottom-left' }, children: [{ use: 'list', props: { rows: [{ label: 'Attack', active: true }, { label: 'Guard' }] } }] }]));
    expect(rt.view()).toContain('class="mana-region" data-at="bottom-left"');
    rt.press('down');
    expect(rt.view()).toMatch(/data-st="active"[^>]*>.*Attack/);   // the data's own active row, beside the focus
  });
});

describe('mana-ui: sides, leads and the menu\'s hold', () => {
  it('a row, a table row or a badge with a side draws its chip; a row\'s lead marks its leading cell', () => {
    const v = run(screen([
      { use: 'list', props: { rows: [{ label: 'North', side: 0 }, { label: 'South', side: 1 }] } },
      { use: 'table', props: { columns: ['words', 'c0', 'c1'], rows: [{ words: 'goals', c0: '2', c1: '1', lead: 'c0', side: 1 }] } },
      { use: 'badge', props: { value: '2', side: 9 } },
    ])).view();
    expect(v).toContain('<i class="mana-chip" data-side="0"></i>');
    expect(v).toMatch(/<td><i class="mana-chip" data-side="1"><\/i>goals<\/td><td data-lead="yes">2<\/td><td>1<\/td>/);
    expect(v).toContain('data-side="7"');   // a side past the eighth is the eighth's chip
  });
  it('a covered page knows which HUD parts its coverage draws instead', () => {
    const covered = Object.keys(IDIOMS).find((k) => IDIOMS[k].coverage), plain = Object.keys(IDIOMS).find((k) => IDIOMS[k].kind === 'hud' && !IDIOMS[k].coverage);
    expect(coverageOverlap({ hud: { use: 'hud', children: [{ use: plain }, { use: covered }] } })).toEqual([covered]);
    expect(coverageOverlap({ screens: {} })).toEqual([]);
  });
  it('mount is a view: it reads no device, and holds the page while a screen is up', () => {
    const listeners = [], was = globalThis.window;
    globalThis.window = { addEventListener: (type) => listeners.push(type) };
    try {
      const rt = manaUi.runtime({ screens: { p: screen([{ use: 'button', props: { label: 'Resume' } }]) } }, host({}));
      const el = new JSDOM('<div></div>').window.document.querySelector('div'), add = el.addEventListener.bind(el);
      el.on = []; el.addEventListener = (t, f) => { el.on.push(t); add(t, f); };
      const m = manaUi.mount(el, rt);
      expect(listeners).toEqual([]);   // no key, no pad: the controls layer's
      expect(el.on.every((t) => t.startsWith('pointer'))).toBe(true);   // its own widgets under a pointer only
      rt.open('p'); m.paint();
      expect(window.__mojMenuOpen).toBe(true);
      rt.close(); m.paint();
      expect(window.__mojMenuOpen).toBe(false);
    } finally { globalThis.window = was; }
  });
});

describe('mana-ui: selection by touch and by cursor', () => {
  it('the input in use is on the root: keys and a pad move a cursor, a finger or a mouse select; a phone\'s long list scrolls whole', () => {
    const rt = run(screen([{ use: 'list', props: { rows: ['a', 'b', 'c', 'd', 'e', 'f'], visible: 3 } }]));
    expect(rt.view()).toContain('▼ 3 more');
    rt.input('touch');
    expect(rt.view()).toContain('data-input="touch"');
    expect((rt.view().match(/class="mana-row"/g) || []).length).toBe(6);
    expect(() => rt.input('voice')).toThrow(/keys, pad, xr, touch, mouse/);
  });
  it('a tap does what it lands on at once; a row with a detail beside it is selected first, done on the second tap', () => {
    const log = [], rt = run(screen([
      { use: 'split', children: [{ use: 'list', props: { rows: [{ label: 'Tonic', then: { emit: 'use' } }, { label: 'Ether', then: { emit: 'use2' } }] }, on: { accept: { item: 'then' } } }, { use: 'text', props: { value: 'detail' } }] },
      { use: 'button', props: { label: 'Close' }, on: { accept: { emit: 'close-it' } } },
    ]), {}, log);
    rt.input('touch');
    expect(rt.view()).not.toContain('data-st="focus"');   // nothing shows selected before a tap
    rt.point(1, 0.5);
    expect(rt.state().focus).toBe(1);
    expect(rt.view()).toContain('data-st="focus"');
    expect(log).toEqual([]);
    rt.point(1, 0.5);
    rt.point(2, 0.5);
    expect(log.map((x) => x.e)).toEqual([{ emit: 'use2' }, { emit: 'close-it' }]);
  });
  it('a slider takes the value under the finger; a stepper\'s ends turn it and its middle does it; a switch flips', () => {
    const S = { vol: 5, lvl: 'Normal', snd: 1 }, log = [], rt = run(screen([
      { use: 'slider', props: { label: 'Volume', value: { bind: 'vol' }, min: 0, max: 10 } },
      { use: 'cycler', props: { label: 'Level', options: ['Easy', 'Normal', 'Hard'], value: { bind: 'lvl' } } },
      { use: 'toggle', props: { label: 'Sound', value: { bind: 'snd' } } },
    ]), S, log);
    rt.point(0, 0.81); rt.point(1, 0.05); rt.point(1, 0.5); rt.point(2, 0.5);
    expect(log.map((x) => x.e)).toEqual([{ set: 'vol', to: 8 }, { set: 'lvl', to: 'Easy' }, { set: 'lvl', to: 'Normal' }, { set: 'snd', to: 0 }]);
    expect(rt.view()).toContain('class="mana-switch"');
  });
  it('a legend and a prompt print the glyph of the control in hand; a finger needs no legend', () => {
    const rt = run(screen([{ use: 'legend', props: { rows: [{ action: 'accept', label: 'pick' }, 'back'] } }, { use: 'prompt', props: { action: 'interact', label: 'Open' } }]));
    rt.glyphs({ keys: { accept: 'Enter', back: 'Esc', interact: 'E' }, pad: { xbox: { accept: 'A', back: 'B', interact: 'X' }, playstation: { accept: '✕', back: '◯', interact: '□' } } });
    expect(rt.view()).toMatch(/>Enter<.*>pick<.*>Esc<.*>back<.*>E<\/span><span>Open/);
    rt.input('pad', 'playstation');
    expect(rt.view()).toMatch(/>✕<.*>◯<.*>□</);
    rt.input('touch');
    expect(rt.view()).not.toContain('mana-legend');
  });
  it('a HUD\'s button or slot with an accept is a tap (pause, a skill), and takes no focus', () => {
    const log = [], spec = { hud: { use: 'hud', children: [{ use: 'region', props: { at: 'top-right' }, children: [{ use: 'button', props: { label: '❚❚' }, on: { accept: { open: 'pause' } } }, { use: 'slot', props: { name: 'Dash', key: 'Q' }, on: { accept: { emit: 'dash' } } }] }] }, screens: { pause: screen([{ use: 'button', props: { label: 'Resume' } }]) } };
    const rt = manaUi.runtime(spec, host({}, log));
    expect(rt.state().focusables).toBe(0);
    expect(rt.view()).toContain('data-tap="1"');
    rt.hudTap(1);
    expect(log.map((x) => x.e)).toEqual([{ emit: 'dash' }]);
    rt.hudTap(0);
    expect(rt.state().screen).toBe('pause');
  });
});

describe('mana-ui: motion that means something', () => {
  const hudOf = (...parts) => ({ use: 'hud', children: [{ use: 'region', props: { at: 'top-left' }, children: parts }] });
  const live = (hud, state, extra = {}) => manaUi.runtime({ hud, screens: {} }, { ...host(state), ...extra });
  it('a value that changed says so once, its direction and its gain; never on the first draw', () => {
    const st = { gold: 10 }, rt = live(hudOf({ use: 'counter', props: { label: 'Gold', value: { bind: 'gold' } } }), st);
    expect(rt.view()).not.toContain('data-ch');                      // what was there is not news
    st.gold = 13; rt.tick();
    expect(rt.view()).toMatch(/data-ch="up" data-key="ch1">13<s class="mana-gain">\+3</);
    st.gold = 5; rt.tick();
    expect(rt.view()).toMatch(/data-ch="down" data-key="ch2">5<s class="mana-gain">−8</);   // a new key replays it
    rt.tick();
    expect(rt.view()).toContain('data-key="ch2"');                   // nothing changed: the same mark, nothing replays
  });
  it('a word that changed is new; a screen opened again shows what is there without news', () => {
    const st = { s: 'Idle', n: 1 }, rt = manaUi.runtime({ screens: { a: screen([{ use: 'badge', props: { value: { bind: 's' } } }, { use: 'stat', props: { label: 'N', value: { bind: 'n' } } }]) } }, host(st));
    rt.open('a'); st.s = 'Ready'; rt.tick();
    expect(rt.view()).toMatch(/data-ch="new"/);
    rt.close(); st.n = 2; rt.open('a');
    expect(rt.view()).not.toContain('data-ch');
  });
  it('a row whose id is new rings once; the last move and whose turn the game says, in that side\'s colour', () => {
    const st = { rows: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', turn: true, side: 2 }] };
    const rt = run(screen([{ use: 'list', props: { rows: { bind: 'rows' } } }]), st);
    expect(rt.view()).not.toContain('data-fresh');
    expect(rt.view()).toContain('data-turn="2"');
    st.rows = [...st.rows, { id: 'c', label: 'C', last: true }]; rt.tick();
    expect((rt.view().match(/data-fresh="yes"/g) || []).length).toBe(1);
    expect(rt.view()).toMatch(/data-fresh="yes" data-k="2" data-last="yes"/);
    rt.press('down'); // a move draws again: the fresh row stays fresh until the rows change
    expect(rt.view()).toContain('data-fresh="yes"');
    expect(run(screen([{ use: 'badge', props: { value: 'Ayla', turn: true } }])).view()).toContain('data-turn="yes"');
  });
  it('the game\'s clock held holds the HUD; less motion asked is on the root, the sheet keeps the fades', () => {
    const rt = live(hudOf(txt('x')), {});
    rt.hold(true); rt.reduceMotion(true);
    expect(rt.view()).toMatch(/data-clock="held".*data-motion="reduced"/);
    expect(rt.state()).toMatchObject({ held: true, reducedMotion: true });
    rt.hold(false);
    expect(rt.view()).not.toContain('data-clock');
  });
});

describe('mana-ui: one moment at a time, by weight', () => {
  const at = { t: 0 };
  const moments = (rows, extra = {}) => manaUi.runtime({ hud: { use: 'hud', children: [{ use: 'region', props: { at: 'center' }, children: [{ use: 'moments', props: { rows: { bind: 'm' }, hold: 3, read: 1, ...extra } }] }] }, screens: {} }, { read: (p) => manaUi.readPath(rows, p), now: () => at.t });
  const up = (rt) => (rt.view().match(/data-role="display">([^<]*)</) || [])[1] || null;
  it('a weightier moment takes the screen at once; an equal one once read; a lighter one waits its turn', () => {
    at.t = 0;
    const st = { m: [{ id: 1, text: 'Goal' }] }, rt = moments(st);
    expect(up(rt)).toBe('Goal');
    at.t = 0.5; st.m = [...st.m, { id: 2, text: 'Corner', weight: 'minor' }, { id: 3, text: 'Save' }]; rt.tick();
    expect(up(rt)).toBe('Goal');                         // an equal one waits until the one up has been read
    at.t = 1.1; expect(rt.tick()).toBe(true);
    expect(up(rt)).toBe('Save');
    at.t = 1.2; st.m = [...st.m, { id: 4, text: 'Red card', weight: 'decisive' }]; rt.tick();
    expect(up(rt)).toBe('Red card');                     // a weightier one takes it at once
    at.t = 4.3; rt.tick();
    expect(up(rt)).toBe('Corner');                       // the lighter one, its turn come
    at.t = 7.4; rt.tick();
    expect(up(rt)).toBeNull();
  });
  it('a new moment is a new element (its entrance plays); with no clock, the weightiest the game still lists', () => {
    at.t = 0;
    const st = { m: [{ id: 'a', text: 'One' }] }, rt = moments(st);
    expect(rt.view()).toContain('data-key="m1"');
    const still = manaUi.runtime({ hud: { use: 'hud', children: [{ use: 'moments', props: { rows: [{ text: 'Big', weight: 3 }, { text: 'Small', weight: 0 }], as: 'toast' } }].map((c) => ({ use: 'region', props: { at: 'top-right' }, children: [c] })) }, screens: {} }, {});
    expect(still.view()).toMatch(/class="mana-toast" data-key="#?0:Big"|class="mana-toast" data-key="0:Big"/);
  });
});

describe('mana-ui: the view patches, never replaces', () => {
  it('an element lives on while its tag and key hold; a new key is a new element', () => {
    const st = { gold: 1, show: true }, el = new JSDOM('<div></div>').window.document.querySelector('div');
    const rt = manaUi.runtime({ hud: { use: 'hud', children: [{ use: 'region', props: { at: 'top-left' }, children: [{ use: 'counter', props: { label: 'Gold', value: { bind: 'gold' } } }, { use: 'bar', props: { value: { bind: 'gold' }, max: 10 } }] }] }, screens: {} }, host(st));
    const m = manaUi.mount(el, rt), counter = el.querySelector('.mana-counter'), fill = el.querySelector('.mana-track i');
    st.gold = 4; rt.tick(); m.paint();
    expect(el.querySelector('.mana-counter')).toBe(counter);        // the same element: its transition can run
    expect(el.querySelector('.mana-track i')).toBe(fill);
    expect(fill.getAttribute('style')).toBe('width:40%');
    const num = el.querySelector('.mana-counter .mana-num');
    st.gold = 6; rt.tick(); m.paint();
    expect(el.querySelector('.mana-counter .mana-num')).not.toBe(num);   // a new change: a new element, it plays again
    const said = el.ownerDocument.createElement('div'); said.innerHTML = rt.view();
    expect(el.firstChild.isEqualNode(said.firstChild)).toBe(true);    // what is drawn is what the runtime says
  });
});

describe('mana-ui: form and the kernel', () => {
  it('the form is data, drawn the same every time and escaped', () => {
    const s = screen([txt('<b>&')], { title: 'T' });
    expect(run(s).view()).toBe(run(s).view());
    expect(run(s).view()).toContain('&lt;b&gt;&amp;');
  });
  it('the kernel is self-contained: its source, run alone, draws what the module draws', () => {
    const k = new Function(`return ${manaUiSource()}`)(), id = 'party-screen';
    const spec = withIdioms({ start: 's', screens: { s: { use: id, props: IDIOMS[id].example } } });
    const read = (p) => manaUi.readPath(SAMPLE_STATE, p);
    expect(k.runtime(spec, { read }).view()).toBe(manaUi.runtime(spec, { read }).view());
  });
  it('a page and the board load nothing from anywhere', () => {
    const page = manaUiPage({ start: 'a', screens: { a: screen([txt('hi')]) } });
    expect(page).not.toMatch(/\b(src|href)=["']?https?:/);
    expect(page).toContain('window.__manaUi');
    expect(() => manaUiPage({ screens: { a: { use: 'nope' } } })).toThrow(/is a component/);
    expect(manaUiBoard()).not.toMatch(/\b(src|href)=["']?https?:/);
  });
});
