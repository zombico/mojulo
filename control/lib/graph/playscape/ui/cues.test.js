import { describe, it, expect } from 'vitest';
import { createBusState, processEvents, watchEvents, stepTime, tickTimers } from '../../worlds/event-bus.js';
import { normalizeHud } from '../../game/hud-widgets.js';
import { readCues, lowerCues, cueVar, PHASE_VAR } from './cues.js';
import { lowerPlay, resolvePlayUi } from './direction.js';
import { uiAdvice } from './laws.js';
import { UI_STATES } from './parts.js';
import { uiBoardHtml, boardPieceIds } from './board-html.js';

// a small level's UI: what the game does, and what the UI does back
const PLAY = {
  phases: ['playing', 'won'],
  parts: [
    { part: 'readout', id: 'hp-bar', variant: 'bar', bind: { var: 'hp' }, max: 100, at: 'bottom-left', label: 'HP' },
    { part: 'readout', id: 'keys', bind: { var: 'keys' }, at: 'top-right', label: 'Keys' },
  ],
  cues: [
    { id: 'hall', when: { enter: { at: [4, 3], r: 3 } }, then: { say: 'The Hall' }, once: true },
    { id: 'door', when: { near: { at: [8, 3], r: 1.2 } }, then: { say: 'Press E to open', as: 'prompt' } },
    { id: 'key', when: { take: 'rune-key' }, then: [{ say: 'Rune key', as: 'toast' }, { show: 'keys' }], until: { ttl: 3 } },
    { id: 'low', when: { var: 'hp', lte: 25 }, then: { state: 'hp-bar', to: 'alert' }, until: { var: 'hp', gt: 25 } },
    { id: 'clear', when: { on: 'level-complete' }, then: { phase: 'won' } },
  ],
};

// run events through the bus as the page does: process, then settle the watches
const run = (s, evs) => { processEvents(s, evs); for (let k = 0; k < 4; k++) { const w = watchEvents(s); if (!w.length) break; processEvents(s, w); } };
const fired = (s, type) => s.log.filter((r) => r.type === type).length;

describe('reading cues', () => {
  it('reads each happening and effect, and a near ends when the figure walks away', () => {
    const cues = readCues(PLAY);
    expect(cues.map((c) => [c.id, c.when.kind, c.then.map((t) => t.kind).join('+'), c.until ? c.until.kind : null, c.page])).toEqual([
      ['hall', 'enter', 'say', null, true], ['door', 'near', 'say', 'leave', true], ['key', 'take', 'say+show', 'ttl', false],
      ['low', 'var', 'state', 'var', false], ['clear', 'on', 'phase', null, false],
    ]);
  });
  it('teaches: one happening, one effect, a known part and phase', () => {
    const bad = (cue, parts = PLAY.parts) => () => readCues({ ...PLAY, parts, cues: [cue] });
    expect(bad({ id: 'a', when: { enter: 'x', use: 'y' }, then: { say: 'hi' } })).toThrow(/one happening/);
    expect(bad({ id: 'a', when: { use: 'lever' }, then: { show: 'map' } })).toThrow(/no part's id/);
    expect(bad({ id: 'a', when: { use: 'lever' }, then: { phase: 'lost' } })).toThrow(/not a phase/);
    expect(bad({ id: 'a', when: { var: 'hp' }, then: { say: 'hi' } })).toThrow(/names its line/);
    expect(bad({ id: 'a', when: { use: 'lever' }, then: { state: 'keys', to: 'glowing' } })).toThrow(/UI state/);
    expect(() => readCues({ parts: [{ part: 'legend', id: 'a', text: 'x' }, { part: 'legend', id: 'a', text: 'y' }], cues: [] })).toThrow(/two parts called 'a'/);
  });
});

describe('lowering onto the bus', () => {
  it('every cue fires cue:<id>; words become hud rows the page draws', () => {
    const f = lowerCues(PLAY);
    expect(f.sources.map((s) => s.zone)).toEqual(['cue-hall', 'cue-door']);
    expect(f.hud).toEqual([
      { on: 'cue:hall', text: 'The Hall', slot: 'center' },
      { on: 'cue:door', text: 'Press E to open', slot: 'bottom', ttl: 4 },
      { on: 'cue:key', as: 'toast', text: 'Rune key', slot: 'center', ttl: 3 },
    ]);
    expect(normalizeHud(f.hud).errors).toEqual([]);
    expect(lowerCues({ parts: [] })).toBeNull();
  });
  it('runs: once fires once, a value crossing sets a state and its until clears it, a time ends a show', () => {
    const s = createBusState(lowerCues(PLAY), []);
    run(s, [{ type: 'enter', zone: 'cue-hall', entity: 'hero' }]);
    run(s, [{ type: 'exit', zone: 'cue-hall', entity: 'hero' }]);
    run(s, [{ type: 'enter', zone: 'cue-hall', entity: 'hero' }]);
    expect(fired(s, 'cue:hall')).toBe(1);
    // the key: shown, then gone three seconds on
    run(s, [{ type: 'contact', a: 'rune-key', b: 'hero' }]);
    expect(s.vars[cueVar('keys')]).toBe(1);
    for (let t = 0; t < 4; t += 0.5) run(s, stepTime(s, 0.5));
    expect(s.vars[cueVar('keys')]).toBe(0);
    // low health: alert below the line, shown again above it
    s.vars.hp = 20; run(s, []);
    expect(s.vars[cueVar('hp-bar', true)]).toBe(UI_STATES.indexOf('alert'));
    s.vars.hp = 60; run(s, []);
    expect(s.vars[cueVar('hp-bar', true)]).toBe(UI_STATES.indexOf('shown'));
    run(s, [{ type: 'level-complete' }]);
    expect(s.vars[PHASE_VAR]).toBe(1);
  });
  it('lowerPlay carries the cues beside the parts; a play without cues lowers as it did', () => {
    const out = lowerPlay({ play: PLAY });
    expect(out.hud.map((r) => r.var || r.on)).toEqual(['hp', 'keys', 'cue:hall', 'cue:door', 'cue:key']);
    expect(Object.keys(out).sort()).toEqual(['hud', 'reactions', 'sequences', 'sources', 'vars', 'watches']);
    const { cues, ...bare } = PLAY;
    expect(Object.keys(lowerPlay({ play: bare }))).toEqual(['hud']);
  });
});

describe('the laws and the board', () => {
  it('advises a cue that puts something up and never takes it down, and lists what only the board draws', () => {
    const adv = uiAdvice({ ...PLAY, cues: [...PLAY.cues, { id: 'map', when: { use: 'atlas' }, then: { show: 'keys' } }] });
    expect(adv.filter((a) => a.law === 'cue-ends').map((a) => a.at)).toEqual(['cue map']);
    expect(adv.find((a) => a.law === 'board-only' && a.at === 'cues').advice).toContain('key (show keys)');
  });
  it('draws the cues as when → then → until', () => {
    const m = resolvePlayUi({ kind: 'room', title: 'Cue test', play: { ...PLAY, ui: 'propose' } }, () => 7);
    expect(boardPieceIds(m)).toContain('ui:cues');
    const html = uiBoardHtml(m);
    expect(html).toContain('comes near 1.2 m round 8, 3');
    expect(html).toContain('hp ≤ 25');
    expect(html).toContain('until it walks away');
  });
});

// ── menus, opened from anything a map carries ─────────────────────────────────────────────────────────────────────
import { readMenus, lowerMenus, openers, MENU_KINDS, MENU_IDS } from './menus.js';
import { menuVar } from './cues.js';
import { readFloormap, floormapAnchors } from '../../era/floormap.js';

const MAP = readFloormap({ kind: 'floormap', regions: [{ id: 'hall', rect: [0, 0, 9, 7] }], items: [
  { id: 'start', kind: 'spawn', at: [4.5, 1] }, { id: 'counter', kind: 'block', at: [2, 5], size: [2, 0.6] }, { id: 'bed', kind: 'block', at: [7, 5.5], size: [1, 2] }] });
const ANCHORS = floormapAnchors(MAP).anchors;
const SHOPPE = {
  phases: ['playing'],
  parts: [{ part: 'readout', id: 'purse', bind: { var: 'gold' }, at: 'top-right', label: 'Gold' }],
  menus: [
    { id: 'shop', kind: 'shop', title: 'Apothecary', currency: 'gold', stock: [{ item: 'tonic', price: 12 }] },
    { id: 'keeper', kind: 'talk', who: 'Keeper', lines: ['Buying?'], choices: [{ say: 'Show me', then: { open: 'shop' } }, { say: 'Not today' }] },
    { id: 'rest', kind: 'confirm', ask: 'Rest until dawn?', yes: [{ set: 'hp', to: 100 }, { emit: 'rested' }] },
  ],
  cues: [
    { id: 'at-counter', when: { near: { anchor: 'counter' } }, then: { open: 'keeper' } },
    { id: 'at-bed', when: { near: { anchor: 'bed', r: 1 } }, then: { open: 'rest' } },
  ],
};

describe('menus from any map', () => {
  it('reads each kind, and refuses a menu that brings its own look', () => {
    expect(readMenus({ menus: MENU_IDS.map((k) => MENU_KINDS[k].example) }).map((m) => m.kind)).toEqual(MENU_IDS);
    expect(() => readMenus({ menus: [{ ...MENU_KINDS.read.example, color: '#f00' }] })).toThrow(/UI guide dresses it/);
    expect(() => readMenus({ menus: [{ id: 'x', kind: 'vending' }] })).toThrow(/read, talk, confirm/);
    expect(() => readCues({ ...SHOPPE, cues: [{ id: 'a', when: { start: true }, then: { open: 'nowhere' } }] })).toThrow(/no menu's id/);
  });
  it('a cue named by an anchor finds it on the built map; an unplaced one fires nothing and is advised', () => {
    const out = lowerPlay({ play: SHOPPE }, { anchors: ANCHORS });
    const counter = ANCHORS.find((a) => a.id === 'counter');
    expect(out.sources).toEqual([
      { type: 'zone', zone: 'cue-at-counter', at: [counter.at[0], counter.at[1], counter.at[2] ?? 0], radius: 1.5, planar: true },
      expect.objectContaining({ zone: 'cue-at-bed', radius: 1 }),
    ]);
    const lost = { ...SHOPPE, cues: [{ id: 'x', when: { near: { anchor: 'altar' } }, then: { open: 'rest' } }] };
    expect(lowerPlay({ play: lost }, { anchors: ANCHORS }).sources).toBeUndefined();
    expect(uiAdvice(lost, undefined, { anchors: ANCHORS }).find((a) => a.law === 'cue-anchor').at).toBe('altar');
  });
  it('runs: walking up opens the talk, a choice opens the shop and closes the talk, walking away closes it; a yes sets and emits', () => {
    const s = createBusState(lowerPlay({ play: SHOPPE }, { anchors: ANCHORS }), []);
    run(s, [{ type: 'enter', zone: 'cue-at-counter', entity: 'hero' }]);
    expect(s.vars[menuVar('keeper')]).toBe(1);
    run(s, [{ type: 'menu-pick:keeper:0' }]);
    expect([s.vars[menuVar('keeper')], s.vars[menuVar('shop')]]).toEqual([0, 1]);
    run(s, [{ type: 'menu-pick:rest:0' }]);
    expect(s.vars.hp).toBe(100);
    expect(fired(s, 'rested')).toBe(1);
    run(s, [{ type: 'enter', zone: 'cue-at-counter', entity: 'hero' }]);
    run(s, [{ type: 'exit', zone: 'cue-at-counter', entity: 'hero' }]);
    expect(s.vars[menuVar('keeper')]).toBe(0);
  });
  it('the laws: a menu nothing opens, a talk with no way back; the board draws each menu, dressed by the guide', () => {
    const adv = uiAdvice({ ...SHOPPE, menus: [...SHOPPE.menus, { id: 'loop', kind: 'talk', lines: ['…'], choices: [{ say: 'Again', then: { open: 'loop' } }] }] });
    expect(adv.filter((a) => a.law === 'menu-reached').map((a) => a.at)).toEqual(['menu loop']);
    expect(adv.filter((a) => a.law === 'menu-closes').map((a) => a.at)).toEqual(['menu loop']);
    expect([...openers(SHOPPE)]).toEqual([['shop', ['keeper · Show me']], ['keeper', ['cue at-counter']], ['rest', ['cue at-bed']]]);
    const m = resolvePlayUi({ kind: 'room', title: 'Shoppe', play: { ...SHOPPE, ui: 'propose' } }, () => 5);
    expect(boardPieceIds(m)).toEqual(expect.arrayContaining(['ui:menu:shop', 'ui:menu:keeper', 'ui:menu:rest']));
    const html = uiBoardHtml(m);
    expect(html).toContain('opened by cue at-counter');
    expect(html).toContain('Rest until dawn?');
    expect(lowerMenus({ menus: [] })).toBeNull();
  });
});

describe('the page draws the menus', () => {
  it('a world with menus carries the menu runtime and the board\'s own markup; without, not a byte of it', async () => {
    const { eventsChannelScript } = await import('../../scene/channels/events.js');
    const { menuHtml, menuPages } = await import('./menus.js');
    const ev = lowerPlay({ play: SHOPPE }, { anchors: ANCHORS, player: 'hero' });
    expect(ev.menus.map((m) => [m.id, m.var, m.picks || null])).toEqual([['shop', 'ui-menu-shop', null], ['keeper', 'ui-menu-keeper', ['Show me', 'Not today']], ['rest', 'ui-menu-rest', ['Yes', 'No']]]);
    expect(ev.sources.every((s) => s.watch === 'hero')).toBe(true);
    const js = eventsChannelScript(ev);
    expect(js).toContain('function __syncMenus()');
    expect(js).toContain(menuHtml.toString());
    expect(js).toContain(' __syncMenus();');
    const { menus, ...bare } = ev;
    expect(eventsChannelScript(bare)).not.toContain('__syncMenus');
    expect(menuHtml(menuPages(SHOPPE)[2], 1)).toContain('<span class="pu-ch on" data-pick="1">No</span>');
  });
});

describe('weather cues', () => {
  const play = (cues) => ({ cues });
  it('reads a forced state, a timed one, and a heartbeat', () => {
    const c = readCues(play([{ id: 'pass', when: { enter: { at: [0, 0], r: 5 } }, then: { weather: { is: 'blizzard', for: 90, blend: 6 } } }, { id: 'roll', when: { every: 300 }, then: { weather: 'fog' } }]));
    expect(c[0].then[0]).toMatchObject({ kind: 'weather', is: 'blizzard', for: 90, blend: 6 });
    expect(c[1].when).toEqual({ kind: 'every', every: 300 });
  });
  it('lowers onto the bus: a var set, a sequence that clears it, a timer for the heartbeat', () => {
    const f = lowerCues(play([{ id: 'pass', when: { enter: { at: [0, 0], r: 5 } }, then: { weather: { is: 'blizzard', for: 90 } } }, { id: 'roll', when: { every: 300 }, then: { weather: 'fog' }, until: { ttl: 60 } }]));
    expect(f.vars).toMatchObject({ 'weather-force': '' });
    expect(f.reactions).toContainEqual({ on: 'cue:pass', do: 'set', var: 'weather-force', to: 'blizzard' });
    expect(f.sequences.find((q) => q.id === 'weather-cue:pass').steps).toEqual([{ await: { timer: 90 } }, { do: 'set', var: 'weather-force', to: '' }]);
    expect(f.timers).toEqual([{ every: 300, emit: { type: 'cue:roll' } }]);
    expect(f.reactions).toContainEqual({ on: 'cue-end:roll', do: 'set', var: 'weather-force', to: '' });
  });
  it('says what is wrong', () => {
    const bad = (c, re) => expect(() => readCues(play([c]))).toThrow(re);
    bad({ id: 'a', when: { start: true }, then: { weather: 'sleet' } }, /not a state/);
    bad({ id: 'a', when: { start: true }, then: { weather: { is: 'fog', for: 0 } } }, /1 or more/);
    bad({ id: 'a', when: { every: 0.2 }, then: { say: 'x' } }, /seconds, 1 or more/);
  });
});

describe('weather cues on a running bus', () => {
  it('a heartbeat forces the state, and the sequence frees the sky again', () => {
    const f = lowerCues({ cues: [{ id: 'roll', when: { every: 300 }, then: { weather: { is: 'fog', for: 60 } } }] });
    const bus = createBusState(f, []);
    for (let t = 0; t < 301; t++) { const k = tickTimers(bus, 1); if (k.length) processEvents(bus, k); }
    expect(bus.vars['weather-force']).toBe('fog');
    for (let t = 0; t < 61; t++) { const k = stepTime(bus, 1); if (k.length) processEvents(bus, k); }
    expect(bus.vars['weather-force']).toBe('');
  });
});
