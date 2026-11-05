import { describe, it, expect } from 'vitest';
import { manaUi, manaUiSource, withIdioms, IDIOMS, manaUiPage, DEFAULT_TOKENS } from './index.js';
import { STYLE_DEFAULTS } from '../graph/game/hud-widgets.js';

// The runtime's concepts, each on the smallest spec that exercises it: props down (literals and bindings), three owners
// of state, form as data, function as effects, and the kernel self-contained.

const host = (state, log = []) => ({ read: (p) => manaUi.readPath(state, p), act: (e, from) => { log.push({ e, from }); if (typeof e.set === 'string') state[e.set] = e.to; } });
const screen = (children, extra = {}) => ({ use: 'screen', ...extra, children });
const PARTY = [
  { id: 'a', name: 'Ayla', cls: 'Knight', level: 7, hp: 64, hpMax: 80, mp: 10, mpMax: 20, stats: { atk: 21, def: 18, mag: 4, spd: 9 }, gear: [{ slot: 'weapon', name: 'Iron Sword' }], skills: [] },
  { id: 'r', name: 'Rook', cls: 'Mage', level: 6, hp: 12, hpMax: 52, mp: 40, mpMax: 44, stats: { atk: 8, def: 9, mag: 24, spd: 11 }, gear: [], skills: [{ name: 'Fire', mp: 6 }] },
];

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
    expect(read({ use: 'text', props: { value: 'x', role: 'huge' } })).toThrow(/one of: title, heading/);
    expect(read({ use: 'button', props: { label: 'x' }, on: { change: {} } })).toThrow(/button answers accept/);
    expect(read({ use: 'text', props: { value: 'x' }, children: [{ use: 'text', props: { value: 'y' } }] })).toThrow(/holds no children/);
    expect(read({ use: 'tabs', children: [{ use: 'text', props: { value: 'y' } }] })).toThrow(/is a tab/);
  });
  it('a def is a composition: params replaced, a prop it does not take refused', () => {
    const defs = { chip: { params: ['what'], node: { use: 'text', props: { value: { param: 'what' }, role: 'label' } } } };
    expect(manaUi.readNode({ use: 'chip', props: { what: 'Lv 3' } }, defs)).toMatchObject({ use: 'text', props: { value: 'Lv 3', role: 'label' } });
    expect(read({ use: 'chip', props: { who: 1 } }, defs)).toThrow(/chip takes what/);
    expect(() => manaUi.readSpec({ screens: { a: screen([]) }, defs: { list: { node: {} } } })).toThrow(/component's name/);
    expect(() => manaUi.readSpec({ screens: { a: { use: 'window' } } })).toThrow(/is a screen/);
  });
  it('every idiom reads (a composition of the components only)', () => {
    const one = Object.keys(IDIOMS)[0];
    expect(() => manaUi.readSpec(withIdioms({ screens: { p: { use: one, props: { title: 'T', items: [] } } } }))).not.toThrow();
  });
});

describe('mana-ui: props down, state in three places, function as effects', () => {
  it('a binding reads the game through the host; rows read their item; a detail reads the row its list has picked', () => {
    const S = { party: PARTY }, rt = manaUi.runtime(withIdioms({ start: 'p', screens: { p: { use: 'party-screen', props: { title: 'Party', party: { bind: 'party' } } } } }), host(S));
    expect(rt.view()).toContain('Lv 7');
    expect(rt.view()).toContain('Knight');
    rt.press('down');
    expect(rt.state().picks.members).toBe(1);
    expect(rt.view()).toContain('Mage');
    rt.press('tabNext'); rt.press('tabNext');
    expect(rt.view()).toContain('Fire');
  });
  it('the game\'s state is never copied: a bound toggle asks the host to set it and shows what the host holds', () => {
    const S = { sound: 1 }, log = [], rt = manaUi.runtime({ start: 'o', screens: { o: screen([{ use: 'toggle', props: { label: 'Sound', value: { bind: 'sound' } } }]) } }, host(S, log));
    rt.press('accept');
    expect(log.map((x) => x.e)).toEqual([{ set: 'sound', to: 0 }]);
    expect(S.sound).toBe(0);
    expect(rt.view()).toContain('data-on="no"');
    // a toggle over a literal is the screen's own state
    const lit = manaUi.runtime({ start: 'o', screens: { o: screen([{ use: 'toggle', props: { label: 'Grid', value: false } }]) } }, host({}, []));
    lit.press('accept');
    expect(lit.view()).toContain('data-on="yes"');
  });
  it('a row does its own effect; open, close and back are the runtime\'s, every other effect the host\'s', () => {
    const log = [], items = [{ label: 'Go', then: { open: 'b' } }, { label: 'Quit', then: [{ emit: 'quit' }, { close: true }] }];
    const rt = manaUi.runtime({ start: 'a', screens: { a: screen([{ use: 'list', props: { rows: items }, on: { accept: { item: 'then' } } }]), b: screen([{ use: 'button', props: { label: 'Up' }, on: { accept: { back: true } } }]) } }, host({}, log));
    rt.press('accept');
    expect(rt.state().stack).toEqual(['a', 'b']);
    rt.press('accept');
    expect(rt.state().stack).toEqual(['a']);
    rt.press('down'); rt.press('accept');
    expect(log.map((x) => x.e)).toEqual([{ emit: 'quit' }, { emit: 'mana:closed' }]);
    expect(log[0].from).toMatchObject({ screen: 'a', verb: 'accept' });
    expect(rt.state().screen).toBe(null);
  });
  it('focus wraps, a disabled row does nothing, a cycler turns through its options', () => {
    const log = [], rt = manaUi.runtime({ start: 'a', screens: { a: screen([
      { use: 'list', props: { rows: [{ label: 'x', disabled: true, then: { emit: 'x' } }] }, on: { accept: { item: 'then' } } },
      { use: 'cycler', props: { label: 'Level', options: ['Easy', 'Normal', 'Hard'], value: 'Normal' }, on: { change: { emit: 'level', to: { input: true } } } },
    ]) } }, host({}, log));
    rt.press('accept');
    expect(log).toEqual([]);
    rt.press('up');
    expect(rt.state().focus).toBe(1);
    rt.press('right'); rt.press('right');
    expect(log.map((x) => x.e.to)).toEqual(['Hard', 'Easy']);
  });
  it('a frame re-renders only when a value the screen read has changed', () => {
    const S = { party: PARTY.map((m) => ({ ...m })) }, rt = manaUi.runtime(withIdioms({ start: 'p', screens: { p: { use: 'party-screen', props: { title: 'P', party: { bind: 'party' } } } } }), host(S));
    expect(rt.tick()).toBe(false);
    S.party = [{ ...S.party[0], hp: 1 }, S.party[1]];
    expect(rt.tick()).toBe(true);
    expect(rt.view()).toContain('1/80');
    expect(rt.view()).toContain('data-low="yes"');
  });
});

describe('mana-ui: form and the kernel', () => {
  it('the form is data, drawn the same every time and escaped', () => {
    const spec = { start: 'a', screens: { a: screen([{ use: 'text', props: { value: '<b>&' } }], { props: { title: 'T' } }) } };
    const a = manaUi.runtime(spec, host({})).view(), b = manaUi.runtime(spec, host({})).view();
    expect(a).toBe(b);
    expect(a).toContain('&lt;b&gt;&amp;');
    expect(manaUi.runtime(spec, host({})).tree()[0]).toBe('div');
  });
  it('the kernel is self-contained: its source, run alone, draws what the module draws', () => {
    const k = new Function(`return ${manaUiSource()}`)();
    const spec = withIdioms({ start: 'p', screens: { p: { use: 'party-screen', props: { title: 'P', party: { bind: 'party' } } } } });
    expect(k.runtime(spec, host({ party: PARTY })).view()).toBe(manaUi.runtime(spec, host({ party: PARTY })).view());
  });
  it('the sheet\'s default tokens are the HUD\'s, and a preview page loads nothing from anywhere', () => {
    for (const k of Object.keys(DEFAULT_TOKENS)) expect(DEFAULT_TOKENS[k], k).toBe(STYLE_DEFAULTS[k]);
    const page = manaUiPage({ start: 'a', screens: { a: screen([{ use: 'text', props: { value: 'hi' } }]) } });
    expect(page).not.toMatch(/\b(src|href)=["']?https?:/);
    expect(page).toContain('window.__manaUi');
    expect(() => manaUiPage({ screens: { a: { use: 'nope' } } })).toThrow(/is a component/);
  });
});
