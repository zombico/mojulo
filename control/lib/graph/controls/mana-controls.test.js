import { describe, it, expect, afterEach } from 'vitest';
import { manaControls, manaGlyphs, controlsRows, remap } from './mana-controls.js';
import { SCHEMES } from './schemes.js';
import { DEVICES } from './devices.js';
import { manaUi } from '../../mana-ui/index.js';

// The controls, one truth both ways: the schemes drive mana-ui's screens (keys, every pad in its printed layout, any
// driver) and say back what each control is called (prompts, legends, the controls screen, a remap's conflicts).
const LAYOUTS = Object.keys(DEVICES.gamepad.layouts);
const confirmOn = (L) => DEVICES.gamepad.roles.confirm[L];
// a layout whose confirm sits apart from the Xbox's (a Nintendo pad's A is on the right), chosen from the devices table
const OTHER = LAYOUTS.find((L) => confirmOn(L) !== confirmOn('xbox'));
const ID = { xbox: 'Xbox Wireless Controller', playstation: 'DualSense Wireless Controller (054c)', nintendo: 'Pro Controller (057e)' };
const pad = (L, held = []) => ({ id: ID[L], connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: held.includes(i), value: held.includes(i) ? 1 : 0 })) });
const was = { navigator: globalThis.navigator, window: globalThis.window };
afterEach(() => { Object.defineProperty(globalThis, 'navigator', { value: was.navigator, configurable: true, writable: true }); globalThis.window = was.window; });
const scr = (children, props = {}) => ({ use: 'screen', props, children });

describe('the controls into mana-ui', () => {
  it('the menu\'s scheme on the keyboard and on each pad layout, the pilot\'s interact accepting too', () => {
    const C = manaControls();
    expect(C.keys.ArrowDown).toBe('down');
    for (const c of K_INTERACT()) expect(C.keys[c]).toBe('accept');
    for (const L of LAYOUTS) expect(C.pad[L].b[DEVICES.gamepad.buttons[confirmOn(L)]]).toBe('accept');
  });
  it('a pad drives the screen in its own printed layout, a second pad the second seat, and the prompts print what is in hand', () => {
    globalThis.window = { addEventListener() {} };
    let pads = [pad(OTHER), pad('xbox')];
    Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => pads }, configurable: true, writable: true });
    const log = [], rt = manaUi.runtime({ start: 'a', screens: { a: scr([
      { use: 'grid', props: { cells: [{ id: 'x' }, { id: 'y' }], columns: 2 }, on: { accept: { emit: 'pick', seat: { seat: true }, id: { item: 'id' } } } },
      { use: 'legend', props: { rows: [{ action: 'accept', label: 'pick' }] } },
    ], { seats: 2 }) } }, { read: () => undefined, act: (e) => log.push(e) });
    rt.glyphs(manaGlyphs());
    const m = manaUi.mount({ innerHTML: '', addEventListener() {} }, rt, { controls: manaControls() });
    m.poll();
    pads = [pad(OTHER, [DEVICES.gamepad.buttons[confirmOn(OTHER)]]), pad('xbox', [DEVICES.gamepad.buttons.dpad_right ?? 15])];
    m.poll();
    expect(rt.state()).toMatchObject({ input: 'pad' });
    expect(log).toEqual([{ emit: 'pick', seat: 0, id: 'x' }]);
    expect(rt.state().seats[1]).toBe(1);   // the second pad moved the second seat
    expect(rt.view()).toContain(`<span class="mana-key">${manaGlyphs().pad[rt.state().layout].accept}</span>`);
  });
  it('a driver of another device acts the same way, and a held control does not repeat', () => {
    globalThis.window = { addEventListener() {} };
    let now = {};
    const rt = manaUi.runtime({ start: 'a', screens: { a: scr([{ use: 'list', props: { rows: ['a', 'b', 'c'] } }]) } }, { read: () => undefined });
    const m = manaUi.mount({ innerHTML: '', addEventListener() {} }, rt, { drivers: [() => ({ input: 'xr', actions: now })] });
    m.poll(); now = { down: 1 }; m.poll(); m.poll();
    expect(rt.state()).toMatchObject({ input: 'xr', focus: 1 });
  });
  it('the drawn touch pad is the touch family\'s driver: its buttons and stick read as the gamepad\'s controls', () => {
    globalThis.window = { addEventListener() {} };
    const on = {}, el = { innerHTML: '', addEventListener: (t, fn) => { on[t] = fn; } };
    const rt = manaUi.runtime({ hud: { use: 'hud', children: [{ use: 'region', props: { at: 'bottom' }, children: [{ use: 'touchpad', props: { buttons: ['A', { label: 'Fire', control: 'rt' }] } }] }] }, screens: {} }, { read: () => undefined });
    const m = manaUi.mount(el, rt);
    expect(rt.view()).toContain('data-control="south"');
    const target = (cls, dataset, rect) => ({ closest: () => ({ classList: { contains: (c) => c === cls }, dataset, getBoundingClientRect: () => rect }) });
    on.pointerdown({ pointerId: 1, target: target('mana-pad', { control: 'rt' }) });
    expect(m.read('rt')).toBe(1);
    on.pointerdown({ pointerId: 2, clientX: 100, clientY: 50, target: target('mana-stick', {}, { left: 0, top: 0, width: 100, height: 100 }) });
    expect([m.read('leftX'), m.read('leftY')]).toEqual([1, 0]);
    on.pointerup({ pointerId: 1 });
    expect(m.read('rt')).toBe(0);
    expect(rt.state().input).toBe('touch');
  });
});

describe('the controls out of mana-ui', () => {
  it('each action\'s control as each family and layout prints it', () => {
    const G = manaGlyphs();
    expect(G.keys.accept).toBeTruthy();
    for (const L of LAYOUTS) expect(G.pad[L].accept).toBe(DEVICES.gamepad.layouts[L][confirmOn(L)]);
    expect(G.keys.interact).toBeTruthy();   // the pilot's, for a prompt in play
  });
  it('the controls screen lists a scheme as the kernel labels it; a remap onto a taken control is a conflict, advised', () => {
    const S = SCHEMES.pilot, rows = controlsRows(S);
    expect(rows.length).toBe(S.actions.length);
    expect(rows.every((r) => Array.isArray(r.keys) && r.label)).toBe(true);
    const [a, b] = S.actions.filter((x) => x.bind.keyboard && x.in.some((c) => S.actions[0].in.includes(c))).slice(0, 2);
    const { over, conflicts } = remap(S, null, { action: a.id, family: 'keyboard', control: b.bind.keyboard[0] });
    expect(conflicts.length).toBeGreaterThan(0);
    expect(controlsRows(S, { over }).find((r) => r.action === a.id).conflict).toBe(true);
    expect(() => remap(S, null, { action: 'fly-away', family: 'keyboard', control: 'KeyQ' })).toThrow(/has no action/);
  });
});

function K_INTERACT() { return SCHEMES.pilot.actions.find((x) => x.id === 'interact').bind.keyboard; }
