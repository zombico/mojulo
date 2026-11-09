import { JSDOM } from 'jsdom';
import { describe, it, expect, afterEach } from 'vitest';
import { manaControls, manaGlyphs, controlsRows, remap } from './mana-controls.js';
import { buildManaHost } from './mana-host.js';
import { buildSeatsKernel } from './seats-kernel.js';
import { SCHEMES } from './schemes.js';
import { DEVICES } from './devices.js';
import { manaUi, PREVIEW_KEYS } from '../../mana-ui/index.js';

// One input paradigm on a page: the controls layer (the schemes, their drivers, the seats) reads the devices and hands
// mana-ui, a view, its intents, the device in hand and the seat that spoke; and says back what each control is called.
const H = buildManaHost(), LAYOUTS = Object.keys(DEVICES.gamepad.layouts);
const confirmOn = (L) => DEVICES.gamepad.roles.confirm[L];
// a layout whose confirm sits apart from the Xbox's, chosen from the devices table
const OTHER = LAYOUTS.find((L) => confirmOn(L) !== confirmOn('xbox'));
const ID = { xbox: 'Xbox Wireless Controller', playstation: 'DualSense Wireless Controller (054c)', nintendo: 'Pro Controller (057e)' };
const pad = (L, index, held = []) => ({ id: ID[L], index, connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: held.includes(i), value: held.includes(i) ? 1 : 0 })) });
const was = { navigator: globalThis.navigator };
afterEach(() => { Object.defineProperty(globalThis, 'navigator', { value: was.navigator, configurable: true, writable: true }); });
const scr = (children, props = {}) => ({ use: 'screen', props, children });
const view = () => ({ paints: 0, paint() { this.paints++; } });
const stubPads = (get) => Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: get }, configurable: true, writable: true });

describe('the controls layer drives the view', () => {
  it('the menu\'s scheme on the keyboard and each pad layout, the pilot\'s interact accepting too', () => {
    const C = manaControls();
    expect(C.keys.ArrowDown).toBe('down');
    for (const c of SCHEMES.pilot.actions.find((x) => x.id === 'interact').bind.keyboard) expect(C.keys[c]).toBe('accept');
    for (const L of LAYOUTS) expect(C.pad[L].b[DEVICES.gamepad.buttons[confirmOn(L)]]).toBe('accept');
  });
  it('a key is the menu\'s while a screen is up and play\'s when none is', () => {
    const log = [], rt = manaUi.runtime({ screens: { p: scr([{ use: 'button', props: { label: 'Resume' }, on: { accept: { emit: 'resume' } } }]) } }, { read: () => undefined, act: (e) => log.push(e) });
    const h = H.connect(rt, view(), { ...manaControls(), listen: false, loop: false });
    const ev = (code) => ({ code, stopped: false, stopPropagation() { this.stopped = true; }, preventDefault() {} });
    const free = ev('Enter');
    h.key(free);
    expect([free.stopped, rt.state().input]).toEqual([false, 'keys']);   // play keeps it; the prompts learn the keys
    rt.open('p');
    const taken = ev('Enter');
    h.key(taken);
    expect(taken.stopped).toBe(true);
    expect(log).toEqual([{ emit: 'resume' }]);
  });
  it('past the two slots, the keys a player reaches for anyway: the keypad, Tab and Shift+Tab, the Page keys; a slot wins', () => {
    const C = manaControls();
    for (const a of SCHEMES.menu.actions) for (const c of a.also.keyboard) expect(C.keys[c], c).toBe(a.id);
    expect([C.keys.Numpad8, C.keys.NumpadEnter, C.keys.Numpad0, C.keys.Tab, C.keys['Shift+Tab'], C.keys.PageDown]).toEqual(['up', 'accept', 'back', 'down', 'up', 'tabNext']);
    const { over } = remap(SCHEMES.menu, null, { action: 'accept', family: 'keyboard', control: 'Numpad8' });
    expect(manaControls({ over }).keys.Numpad8).toBe('accept');
    // a preview's stand-in says the same as the scheme it stands in for
    for (const [c, a] of Object.entries(PREVIEW_KEYS)) expect(C.keys[c], c).toBe(a);
  });
  it('a held key repeats a move and never a pick or a back; a chord stays the browser\'s; Shift+Tab moves up', () => {
    const log = [], rt = manaUi.runtime({ start: 'a', screens: { a: scr([{ use: 'list', props: { rows: ['a', 'b', 'c'] }, on: { accept: { emit: 'pick' } } }]) } }, { read: () => undefined, act: (e) => log.push(e) });
    const h = H.connect(rt, view(), { ...manaControls(), listen: false, loop: false });
    const ev = (code, more = {}) => ({ code, key: '', prevented: false, stopPropagation() {}, preventDefault() { this.prevented = true; }, ...more });
    h.key(ev('Numpad2')); h.key(ev('ArrowDown', { repeat: true }));
    expect(rt.state().focus).toBe(2);
    h.key(ev('Tab', { shiftKey: true }));
    expect(rt.state().focus).toBe(1);
    h.key(ev('NumpadEnter')); h.key(ev('NumpadEnter', { repeat: true }));
    h.key(ev('Escape', { repeat: true }));
    expect([log, rt.state().screen]).toEqual([[{ emit: 'pick' }], 'a']);
    const chord = ev('KeyW', { ctrlKey: true });
    expect(h.key(chord)).toBe(false);
    expect([chord.prevented, rt.state().focus]).toEqual([false, 1]);
  });
  it('a text entry in focus is typed into from the keys: W types, Backspace erases, Enter is done; Esc still backs out', () => {
    const S = { name: '' }, rt = manaUi.runtime({ start: 'a', screens: { a: scr([{ use: 'textentry', props: { value: { bind: 'name' } } }]) } }, { read: (p) => S[p], act: (e) => { if (e.set) S[e.set] = e.to; } });
    const h = H.connect(rt, view(), { ...manaControls(), listen: false, loop: false });
    const ev = (code, key) => ({ code, key, stopPropagation() {}, preventDefault() {} });
    for (const [c, k] of [['KeyW', 'w'], ['KeyA', 'a'], ['KeyD', 'd'], ['KeyX', 'x'], ['Backspace', 'Backspace'], ['KeyE', 'e'], ['Enter', 'Enter']]) h.key(ev(c, k));
    expect([S.name, rt.state().focus, rt.state().screen]).toEqual(['WADE', 0, 'a']);
    h.key(ev('ArrowRight', 'ArrowRight'));
    expect(rt.state().focus).toBe(1);
    h.key(ev('Escape', 'Escape'));
    expect(rt.state().screen).toBe(null);
  });
  it('each pad in its own printed layout, the seat it plays told by the seats kernel, never by its index', () => {
    const SK = buildSeatsKernel();
    let seats = SK.newSeats({ max: 2 });
    seats = SK.step(seats, { 'pad:1': { join: true } });   // the second pad joined first: it is P1
    seats = SK.step(seats, { 'pad:0': { join: true } });
    const seatOf = (c) => { const x = SK.seatOf(seats, c); return x ? x.n - 1 : null; };
    let pads = [pad('xbox', 0), pad(OTHER, 1)];
    stubPads(() => pads);
    const log = [], rt = manaUi.runtime({ start: 'a', screens: { a: scr([
      { use: 'grid', props: { cells: [{ id: 'x' }, { id: 'y' }], columns: 2 }, on: { accept: { emit: 'pick', seat: { seat: true }, id: { item: 'id' } } } },
      { use: 'legend', props: { rows: [{ action: 'accept', label: 'pick' }] } },
    ], { seats: 2 }) } }, { read: () => undefined, act: (e) => log.push(e) });
    rt.glyphs(manaGlyphs());
    const h = H.connect(rt, view(), { ...manaControls(), seatOf, listen: false, loop: false });
    h.poll();
    pads = [pad('xbox', 0, [15]), pad(OTHER, 1, [DEVICES.gamepad.buttons[confirmOn(OTHER)]])];   // pad 0 → right, pad 1 confirms
    h.poll(); h.poll();
    expect(log).toEqual([{ emit: 'pick', seat: 0, id: 'x' }]);   // pad 1 is seat 0 (P1)
    expect(rt.state().seats[1]).toBe(1);                         // pad 0 moved seat 1 (P2)
    expect(rt.view()).toContain(`<span class="mana-key">${manaGlyphs().pad[rt.state().layout].accept}</span>`);
  });
  it('another device through a driver the same way; held, a direction repeats after its delay at its rate; no screen, the pads are play\'s', () => {
    let now = {}, t = 0;
    stubPads(() => [pad(OTHER, 0, [0])]);
    const rt = manaUi.runtime({ screens: { a: scr([{ use: 'list', props: { rows: ['a', 'b', 'c', 'd', 'e', 'f'] } }]) } }, { read: () => undefined });
    const h = H.connect(rt, view(), { ...manaControls(), drivers: [() => ({ name: 'xr', input: 'xr', actions: now })], listen: false, loop: false, repeat: { delay: 0.4, rate: 0.1 }, now: () => t });
    h.poll();
    expect(rt.state()).toMatchObject({ input: 'pad', layout: OTHER, screen: null });   // in play: only the glyphs follow it
    rt.open('a'); h.poll();
    now = { down: 1 }; h.poll(); t = 0.2; h.poll();
    expect(rt.state()).toMatchObject({ input: 'xr', focus: 1 });   // pressed once; not yet repeating
    t = 0.41; h.poll(); t = 0.52; h.poll(); t = 0.55; h.poll();
    expect(rt.state().focus).toBe(3);                              // two repeats: at the delay, then a rate later
    now = {}; h.poll(); now = { down: 1 }; t = 0.6; h.poll(); t = 0.7; h.poll();
    expect(rt.state().focus).toBe(4);                              // let go: a fresh press, its delay again
    stubPads(() => []);
    const once = H.connect(rt, view(), { ...manaControls(), drivers: [() => ({ name: 'xr2', input: 'xr', actions: { up: 1 } })], listen: false, loop: false, repeat: false, now: () => t });
    once.poll(); t = 5; once.poll();
    expect(rt.state().focus).toBe(3);                              // repeat: false, held never repeats
  });
  it('a held stick or d-pad repeats its move after a delay, then steadily; a held pick never does, nor what was held as a screen opened', () => {
    let t = 0, held = [], axes = [0, 0, 0, 0];
    const log = [];
    stubPads(() => [{ ...pad('xbox', 0, held), axes }]);
    const rt = manaUi.runtime({ screens: { a: scr([{ use: 'list', props: { rows: Array.from({ length: 20 }, (_, i) => 'r' + i) }, on: { accept: { emit: 'pick' } } }]) } }, { read: () => undefined, act: (e) => log.push(e) });
    // (seconds on the host's clock; a delay of 0.4 and a rate of 0.1)
    const h = H.connect(rt, view(), { ...manaControls(), now: () => t, repeat: { delay: 0.4, rate: 0.1 }, listen: false, loop: false });
    const at = (s) => { t = s; h.poll(); return rt.state().focus; };
    held = [DEVICES.gamepad.buttons.down];   // held as the screen opens: it does not act, nor repeat
    rt.open('a'); at(0);
    expect([at(0.5), at(1)]).toEqual([0, 0]);
    held = []; at(1.1);
    held = [DEVICES.gamepad.buttons.down];   // the d-pad: a press, then the delay, then a step every interval
    expect([at(2), at(2.3), at(2.4), at(2.45), at(2.5), at(2.6)]).toEqual([1, 1, 2, 2, 3, 4]);
    held = []; axes = [0, 1, 0, 0];          // the stick the same way
    expect([at(3), at(3.4), at(3.5)]).toEqual([5, 6, 7]);
    axes = [0, 0, 0, 0]; held = [DEVICES.gamepad.buttons[confirmOn('xbox')]];
    at(4); at(5); at(6);
    expect(log).toEqual([{ emit: 'pick' }]);
    const once = H.connect(rt, view(), { ...manaControls(), now: () => t, repeat: false, listen: false, loop: false });
    held = []; once.poll(); held = [DEVICES.gamepad.buttons.up]; t = 7; once.poll(); t = 9; once.poll();
    expect(rt.state().focus).toBe(6);
  });
  it('a device that comes later (a headset\'s session) drives once it joins, and stops once it leaves', () => {
    let now = {};
    stubPads(() => []);
    const rt = manaUi.runtime({ start: 'a', screens: { a: scr([{ use: 'list', props: { rows: ['a', 'b', 'c'] } }]) } }, { read: () => undefined });
    const h = H.connect(rt, view(), { ...manaControls(), listen: false, loop: false });
    h.poll();
    const leave = h.drive(() => ({ name: 'xr', input: 'xr', actions: now }));
    now = { down: 1 }; h.poll(); now = {}; h.poll();
    expect(rt.state()).toMatchObject({ input: 'xr', focus: 1 });
    leave();
    now = { down: 1 }; h.poll();
    expect(rt.state().focus).toBe(1);
  });
  it('the drawn pad only names its gamepad controls (the touch driver reads it); the view takes no device from it', () => {
    const rt = manaUi.runtime({ hud: { use: 'hud', children: [{ use: 'region', props: { at: 'bottom' }, children: [{ use: 'touchpad', props: { buttons: ['A', { label: 'Fire', control: 'rt' }] } }] }] }, screens: {} }, { read: () => undefined });
    expect(rt.view()).toContain('data-control="south"');
    expect(rt.view()).toContain('data-control="rt"');
    expect(manaUi.mount(new JSDOM('<div></div>').window.document.querySelector('div'), rt).read).toBeUndefined();
  });
});

describe('the controls said back', () => {
  it('each action\'s control as each family and layout prints it', () => {
    const G = manaGlyphs();
    for (const L of LAYOUTS) expect(G.pad[L].accept).toBe(DEVICES.gamepad.layouts[L][confirmOn(L)]);
    expect(G.keys.interact).toBeTruthy();   // the pilot's, for a prompt in play
  });
  it('the controls screen lists a scheme as the kernel labels it; a remap onto a taken control is a conflict, advised', () => {
    const S = SCHEMES.pilot, rows = controlsRows(S);
    expect(rows.length).toBe(S.actions.length);
    const [a, b] = S.actions.filter((x) => x.bind.keyboard && x.in.some((c) => S.actions[0].in.includes(c))).slice(0, 2);
    const { over, conflicts } = remap(S, null, { action: a.id, family: 'keyboard', control: b.bind.keyboard[0] });
    expect(conflicts.length).toBeGreaterThan(0);
    expect(controlsRows(S, { over }).find((r) => r.action === a.id).conflict).toBe(true);
    expect(() => remap(S, null, { action: 'fly-away', family: 'keyboard', control: 'KeyQ' })).toThrow(/has no action/);
  });
});
