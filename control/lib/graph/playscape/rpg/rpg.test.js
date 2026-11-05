import { describe, it, expect } from 'vitest';
import { readRpg, rpgCues, withRpg, lowerRpg } from './rpg.js';
import { buildRpg } from './kernel.js';
import { CLASS_PRESETS } from './presets.js';
import { lowerPlay } from '../ui/direction.js';
import { createBusState, processEvents, watchEvents } from '../../worlds/event-bus.js';
import { eventsChannelScript } from '../../scene/channels/events.js';
import { rpgScript, rpgPage, RPG_CSS } from '../../scene/channels/rpg-channel.js';
import { juiceKeys } from './juice.js';
import { menuControls } from '../../scene/channels/interact-channel.js';
import { buildGameStoreKernel } from '../../game/store-kernel.js';
import { composeMechanics } from '../../game/mechanics.js';
import { rpgInit, rpgSave, rpgLoad, rpgSwitchClass, rpgBuy } from './kernel.js';

const ENTITIES = [{ id: 'hero', rule: { type: 'walk' }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } }];
const PARTY = [{ id: 'ayla', class: 'fighter' }, { id: 'bram', name: 'Bram the Wise', class: 'mage', level: 2 }];
const PLAY = { rpg: { party: PARTY, encounters: [{ id: 'wolves', foes: ['wolf', 'wolf'], at: [8, 0], who: 'wolf-1' }, { id: 'drake', foes: ['drake'] }] } };

function level(play) {
  const ev = lowerPlay({ entities: ENTITIES, play }, { player: 'hero' });
  const bus = createBusState(ev, []);
  const fire = (type) => { processEvents(bus, [{ type }]); for (let k = 0; k < 6; k++) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); } };
  return { ev, bus, fire };
}

describe('play.rpg: read and lowered', () => {
  it('fills what a world names from the presets, and keeps its own over them', () => {
    const cfg = readRpg({ rpg: { party: PARTY, classes: ['fighter', 'mage'], foes: { wolf: { name: 'Dire Wolf', hp: 40, atk: 12, def: 5, mag: 1, spd: 10, xp: 9 } }, encounters: [{ id: 'a', foes: ['wolf', 'slime'] }] } });
    expect(Object.keys(cfg.classes)).toEqual(['fighter', 'mage']);
    expect(cfg.foes.wolf).toMatchObject({ name: 'Dire Wolf', base: { hp: 40, mp: 99 }, gold: 0, cp: 1 });
    expect(cfg.foes.slime.weak).toEqual(['fire']);
    expect(cfg.party[1]).toMatchObject({ name: 'Bram the Wise', cls: 'mage', level: 2 });
    // every class skill and foe skill is present, read
    expect(cfg.skills['power-strike']).toMatchObject({ harm: true, stat: 'atk', target: 'foe' });
    expect(cfg.skills.heal).toBeUndefined();
    // a boss encounter has no escape; without classes named, every preset class is the world's
    expect(readRpg(PLAY).encounters.drake.flee).toBe(false);
    expect(Object.keys(readRpg(PLAY).classes)).toEqual(Object.keys(CLASS_PRESETS));
  });

  it('teaches what is wrong', () => {
    const bad = (rpg) => () => readRpg({ rpg });
    expect(bad({})).toThrow(/party is a list of 1 to 8 members/);
    expect(bad({ party: [{ id: 'a', class: 'bard' }] })).toThrow(/'bard' is no preset class/);
    expect(bad({ party: [{ id: 'a', class: 'fighter', joins: 'x' }] })).toThrow(/someone is in from the start/);
    expect(bad({ party: PARTY, encounters: [{ id: 'a', foes: ['dragonlord'] }] })).toThrow(/'dragonlord' is no preset foe/);
    expect(bad({ party: PARTY, skills: { zap: { mp: 2 } }, classes: { fighter: { skills: [{ skill: 'zap' }] } } })).toThrow(/zap does nothing/);
    expect(bad({ party: PARTY, classes: { fighter: { skills: [{ skill: 'fire', cost: 1, requires: ['ice'] }] }, mage: true } })).toThrow(/requires 'ice', which is not on that class's tree/);
    expect(bad({ party: PARTY, rules: { defeat: 'cry' } })).toThrow(/rules\.defeat is fail or retry/);
    expect(bad({ party: PARTY, encounters: [{ id: 'a', foes: ['slime'], who: 'x' }] })).toThrow(/who stands somewhere/);
  });

  it('absent: no cues, no vars, no page bytes', () => {
    expect(withRpg({ cues: [] })).toEqual({ cues: [] });
    expect(lowerRpg({})).toBeNull();
    const ev = lowerPlay({ entities: ENTITIES, play: { cues: [{ id: 'hi', when: { start: true }, then: { say: 'hi' } }] } }, { player: 'hero' });
    expect(ev.rpg).toBeUndefined();
    expect(eventsChannelScript(ev)).not.toContain('__stepRpg');
  });

  it('where a fight is fought: on the map as it stands, or on its own arena before a backdrop of the map', () => {
    expect(readRpg({ rpg: { ...PLAY.rpg, rules: { stage: 'backdrop' } } }).rules.stage).toBe('backdrop');
    expect(readRpg({ rpg: { ...PLAY.rpg, rules: { stage: 'live' } } }).rules.stage).toBe('live');
    expect(() => readRpg({ rpg: { ...PLAY.rpg, rules: { stage: 'arena' } } })).toThrow(/rules\.stage is live or backdrop/);
  });

  it('on the bus: walking up starts it once; a win sends the foe off the map in smoke; a loss fails the level', () => {
    const cues = rpgCues(PLAY);
    expect(cues.find((c) => c.id === 'rpg-meet-wolves')).toEqual({ id: 'rpg-meet-wolves', when: { enter: { at: [8, 0], r: 2.2 } }, if: [{ var: 'rpg.battle', eq: 0 }, { var: 'rpg-done-wolves', eq: 0 }], then: { emit: 'rpg-battle:wolves' } });
    const L = level(PLAY);
    expect(L.ev.rpg.party.map((p) => p.id)).toEqual(['ayla', 'bram']);
    expect(L.ev.vars).toMatchObject({ 'rpg.battle': 0, 'rpg-done-wolves': 0, 'rpg.ayla.level': 1, 'rpg.bram.class': 'mage', gold: 0 });
    L.fire('rpg-won:wolves');
    expect(L.bus.vars['rpg-done-wolves']).toBe(1);
    expect(L.ev.reactions.some((r) => r.on === 'rpg-won:wolves' || (r.do === 'ctrl' && r.op === 'kill'))).toBe(true);
    // the beaten pack leaves the map (vanish, in smoke), never left lying where it fell
    expect(cues.find((c) => c.id === 'rpg-beaten-wolves').then.slice(1)).toEqual([].concat(PLAY.rpg.encounters.find((e) => e.id === 'wolves').who ?? []).map((w) => ({ vanish: { who: w, with: 'smoke' } })));
    L.bus.vars.hp = 50;
    L.fire('rpg-lost:drake');
    expect(L.bus.vars.hp).toBe(50);
    L.fire('rpg-lost');
    expect(L.bus.vars.hp).toBe(0);
    expect(rpgCues({ rpg: { ...PLAY.rpg, rules: { defeat: 'retry' } } }).some((c) => c.id === 'rpg-defeat')).toBe(false);
  });
});

// the page function, run headless: a DOM just big enough (elements with class lists and innerHTML, key listeners)
function page(play, vars = {}, game = null, more = {}) {
  const ev = lowerPlay({ entities: ENTITIES, play }, { player: 'hero' });
  const bus = createBusState(ev, []);
  Object.assign(bus.vars, vars);
  // (an element just big enough: its class list edits its className, as the page's own does)
  const el = () => { const o = { className: '', innerHTML: '', textContent: '', style: { setProperty() {} }, offsetWidth: 0, appendChild() {}, addEventListener() {} }; o.classList = { add: (c) => { if (!o.className.split(' ').includes(c)) o.className = (o.className + ' ' + c).trim(); }, remove: (c) => { o.className = o.className.split(' ').filter((x) => x !== c).join(' '); } }; return o; };
  const keys = [], appended = [];
  const document = { createElement: el, head: el(), body: { ...el(), appendChild: (x) => appended.push(x) } };
  const window = { addEventListener: (_, f) => keys.push(f), ...(game ? { __mojGame: game } : {}), ...more };
  const queue = [];
  const ctl = { ...menuControls(), layout: () => 'xbox', select: 8 };
  const api = new Function('document', 'window', '__busState', '__inputQueue', 'RPG_CSS_TEXT', 'cfg', 'K', 'ctl', `return (${rpgPage.toString()})(cfg, K, ctl, ${juiceKeys.toString()});`)(document, window, bus, queue, RPG_CSS, ev.rpg, new Function(`return (${buildRpg.toString()})();`)(), ctl);
  let t = 0;
  const frames = (n = 1) => { for (let i = 0; i < n; i++) { t += 100; api.step(t); } };
  const press = (code) => { for (const f of keys) f({ code, repeat: false, preventDefault() {}, stopImmediatePropagation() {} }); };
  // what the page said on the bus, less the juice's happenings (rpg-on:<key>)
  const said = () => queue.filter((e) => !e.type.startsWith('rpg-on:'));
  return { api, bus, queue, said, frames, press, window, appended };
}

describe('the page: the battle window and the party menu', () => {
  it('a cue\'s rpg-battle opens the fight and holds the world; picks then a played-back round; the close says how it went', () => {
    const P = page(PLAY, { 'held:bag:potion': 1 });
    processEvents(P.bus, [{ type: 'rpg-battle:wolves' }]);
    P.frames();
    expect(P.api.state()).toMatchObject({ mode: 'battle', phase: 'intro', msg: 'Wolf A and Wolf B appear!' });
    expect(P.window.__mojFreeze).toBe(true);
    P.frames(8);
    expect(P.api.state()).toMatchObject({ phase: 'command', member: 'ayla', level: 'cmd' });
    expect(P.api.state().options.map((o) => o.label)).toEqual(['Attack', 'Skill', 'Item', 'Guard', 'Flee']);
    // Ayla: Attack → the first wolf; Bram: back to Ayla, then Guard for both
    P.press('Enter');
    expect(P.api.state().level).toBe('target');
    P.press('Enter');
    expect(P.api.state().member).toBe('bram');
    P.press('Escape');
    expect(P.api.state().member).toBe('ayla');
    for (let i = 0; i < 3; i++) P.press('ArrowDown');
    P.press('Enter');
    for (let i = 0; i < 3; i++) P.press('ArrowDown');
    P.press('Enter');
    expect(P.api.state().phase).toBe('play');
    expect(P.api.state().msg).toMatch(/guards|attacks|Wolf/);
    // play it out: guard every round, then accept the end
    for (let r = 0; r < 60 && P.api.state().mode; r++) {
      P.frames(10);
      const s = P.api.state();
      if (s.phase === 'command') { P.press('Enter'); P.press('Enter'); }
      else if (s.phase === 'end') P.press('Enter');
    }
    expect(P.api.state().mode).toBeNull();
    expect(P.window.__mojFreeze).toBe(false);
    const said = P.said();
    expect(said.map((e) => e.type)).toHaveLength(2);
    expect(said[0].type).toMatch(/^rpg-(won|lost|fled):wolves$/);
    expect(said[1].type).toBe(said[0].type.split(':')[0]);
  });

  it('a join and a fight that arrive together: the one who joins fights', () => {
    const P = page({ rpg: { party: [...PARTY, { id: 'mira', class: 'cleric', joins: 'met-mira' }], encounters: PLAY.rpg.encounters } });
    processEvents(P.bus, [{ type: 'rpg-join:mira' }, { type: 'rpg-battle:wolves' }]);
    P.frames();
    expect(P.api.R.b.ids).toEqual(['ayla', 'bram', 'mira']);
  });

  it('on the timeline the window asks only the one whose turn it is, and shows who comes next', () => {
    const P = page({ rpg: { ...PLAY.rpg, rules: { turns: 'timeline' } } });
    processEvents(P.bus, [{ type: 'rpg-battle:wolves' }]);
    P.frames(12);
    const s = P.api.state();
    expect(s.phase).toBe('command');
    expect(s.member).toBe(P.api.R.b.turn);
    P.press('Enter'); P.press('Enter');   // attack the first: the turn is spent at once
    expect(P.api.state().phase).toBe('play');
  });

  it('the party menu on P: a class switched, a skill bought, nothing during a fight', () => {
    const P = page(PLAY);
    P.press('KeyP');
    P.frames();
    expect(P.api.state().mode).toBe('field');
    P.press('ArrowRight');   // the Class tab
    P.press('Enter');        // into its list: fighter (current) first
    P.press('ArrowDown');    // knight
    P.press('Enter');
    expect(P.api.R.m.ayla.cls).toBe('knight');
    expect(P.bus.vars['rpg.ayla.class']).toBe('knight');
    expect(P.said()).toEqual([{ type: 'rpg-class:ayla:knight' }]);
    P.press('Escape'); P.press('Escape');
    expect(P.api.state().mode).toBeNull();
  });

  it('a pad: its select opens the party menu, its confirm (wherever its layout prints it) acts in it', () => {
    const P = page(PLAY), pads = [], buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    const accept = Number(Object.entries(menuControls().pad.xbox.b).find(([, a]) => a === 'accept')[0]);
    const was = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => pads }, configurable: true });
    try {
      pads.push({ connected: true, id: 'Xbox Wireless Controller', buttons, axes: [0, 0, 0, 0] });
      const press = (i) => { buttons[i].pressed = true; P.frames(); buttons[i].pressed = false; P.frames(); };
      press(8);   // select
      expect(P.api.state().mode).toBe('field');
      press(15);  // the d-pad's right: the Class tab
      press(accept);
      expect(P.api.state().mode).toBe('field');
      press(8);
      expect(P.api.state().mode).toBeNull();
    } finally { if (was) Object.defineProperty(globalThis, 'navigator', was); else delete globalThis.navigator; }
  });

  it('a shop: its wares bought with the gold into the bag, the bag sold back at half, a night at the inn; short of gold, nothing', () => {
    const shops = { merchant: { wares: ['potion', 'bronze-sword'] }, inn: { inn: 10 } };
    const P = page({ rpg: { ...PLAY.rpg, shops } }, { gold: 20 });
    processEvents(P.bus, [{ type: 'rpg-shop:merchant' }]);
    P.frames();
    expect(P.api.state().shop).toMatchObject({ id: 'merchant', tab: 'Buy', rows: [{ label: 'Potion', right: '8 G', ok: true }, { label: 'Bronze Sword', right: '25 G', ok: false }] });
    expect(P.window.__mojFreeze).toBe(true);
    P.press('Enter');
    expect(P.bus.vars.gold).toBe(12);
    expect(P.bus.vars['held:bag:potion']).toBe(1);
    expect(P.said()).toContainEqual({ type: 'rpg-bought:merchant:potion' });
    // (the sword is dearer than the purse: nothing changes hands)
    P.press('ArrowDown'); P.press('Enter');
    expect(P.bus.vars.gold).toBe(12);
    expect(P.api.state().shop.said).toBe('Not enough gold.');
    // Sell: the potion back at half
    P.press('ArrowRight');
    expect(P.api.state().shop).toMatchObject({ tab: 'Sell', rows: [{ label: 'Potion', right: '4 G' }] });
    P.press('Enter');
    expect([P.bus.vars.gold, P.bus.vars['held:bag:potion']]).toEqual([16, 0]);
    P.press('Escape');
    expect(P.api.state().mode).toBeNull();
    // the inn: the party hurt, a night for its price, all well again
    P.api.R.m.ayla.hp = 1;
    processEvents(P.bus, [{ type: 'rpg-shop:inn' }]);
    P.frames();
    expect(P.api.state().shop).toMatchObject({ tab: 'Stay', rows: [{ right: '10 G', ok: true }] });
    P.press('Enter');
    expect(P.bus.vars.gold).toBe(6);
    expect(P.api.R.m.ayla.hp).toBeGreaterThan(1);
    expect(P.said()).toContainEqual({ type: 'rpg-stayed:inn' });
  });

  it('a shop is read: its wares the world\'s and priced, an inn a price; a ware it cannot sell is refused', () => {
    const cfg = readRpg({ rpg: { party: PARTY, shops: { m: { wares: ['potion'] }, i: { inn: 5 } } } });
    expect(cfg.shops).toEqual({ m: { name: 'Shop', wares: [{ item: 'potion', kind: 'item', price: 8 }], buys: true, inn: null }, i: { name: 'Inn', wares: [], buys: false, inn: 5 } });
    expect(readRpg({ rpg: { party: PARTY } }).shops).toBeUndefined();
    expect(() => readRpg({ rpg: { party: PARTY, shops: { m: { wares: ['nope'] } } } })).toThrow(/none of the world's items or gear/);
    expect(() => readRpg({ rpg: { party: PARTY, items: { tonic: { heal: 5 } }, shops: { m: { wares: ['tonic'] } } } })).toThrow(/no price/);
    expect(() => readRpg({ rpg: { party: PARTY, shops: { m: {} } } })).toThrow(/sells nothing/);
  });

  it('the page carries the channel only when the events have rpg, and its script parses', () => {
    const L = level(PLAY);
    expect(eventsChannelScript(L.ev)).toContain('__stepRpg(t)');
    expect(() => new Function(rpgScript())).not.toThrow();
    expect(() => new Function(eventsChannelScript(L.ev))).not.toThrow();
  });
});

describe('the juice on the page', () => {
  // a controllable world just big enough: the figures, the clock, the cast ops it is handed
  const ctrl = () => { const ops = []; return { ops, world: { pilotId: 'hero', time: 0, byId: { hero: {}, 'wolf-1': {} } }, cast: (o) => ops.push(...o) }; };

  it('each beat says its happenings and plays its binding: the start shakes, a blow puffs at the foe\'s figure; the clock runs', () => {
    const C = ctrl(), P = page(PLAY, {}, null, { __mojCtrl: C });
    processEvents(P.bus, [{ type: 'rpg-battle:wolves' }]);
    P.frames();
    expect(P.queue.map((e) => e.type)).toContain('rpg-on:start');
    expect(C.ops).toContainEqual({ op: 'shake', k: 0.25, for: 0.4 });
    P.frames(8);
    P.press('Enter'); P.press('Enter');                       // Ayla attacks the first wolf
    for (let i = 0; i < 3; i++) P.press('ArrowDown');
    P.press('Enter');                                        // Bram guards
    P.frames(80);   // the whole round played back
    expect(P.queue.map((e) => e.type)).toEqual(expect.arrayContaining(['rpg-on:skill:attack', 'rpg-on:hit']));
    // a blow on a wolf puffs at the pack's figure; one on a member who has none, at the pilot's
    const hits = C.ops.filter((o) => o.op === 'puff').map((o) => o.who);
    expect(hits).toContain('wolf-1');
    expect(hits.every((w) => w === 'wolf-1' || w === 'hero')).toBe(true);
    expect(C.world.time).toBeGreaterThan(1);
  });

  it('extended in-game: a juice\'s emit and the beat\'s happenings reach the world\'s own cues', () => {
    const play = { ...PLAY, rpg: { ...PLAY.rpg, juice: { on: { start: [{ emit: 'drums' }] }, also: { start: [{ emit: 'horns' }] } } }, cues: [{ id: 'drums', when: { on: 'drums' }, then: { set: 'tense', to: 1 } }, { id: 'counted', when: { on: 'rpg-on:start' }, then: { add: 'fights', by: 1 } }] };
    const P = page(play, { tense: 0, fights: 0 }, null, { __mojCtrl: ctrl() });
    processEvents(P.bus, [{ type: 'rpg-battle:wolves' }]);
    P.frames();
    processEvents(P.bus, P.queue.splice(0));
    expect([P.bus.vars.tense, P.bus.vars.fights]).toEqual([1, 1]);
    // the winning juice and the layer over it both play
    expect(P.bus.log.map((e) => e.type)).toEqual(expect.arrayContaining(['drums', 'horns']));
  });
});

describe('the party menu: Equip', () => {
  it('a slot, then what the bag holds for it: worn, the old one back in the bag, both said on the bus and kept', () => {
    const out = [], g = { contract: { party: { slice: 'party' } }, onStart: (cb) => cb({}, 1), emit: (e) => out.push(e) };
    const P = page(PLAY, { 'held:bag:iron-sword': 1 }, g);
    P.frames();
    P.press('KeyP'); P.press('ArrowRight'); P.press('ArrowRight');   // Equip
    P.press('Enter');   // into its slots: Weapon first
    P.press('Enter');   // its choices: — (take off), Iron Sword
    P.press('ArrowDown'); P.press('Enter');
    expect(P.api.R.m.ayla.gear.weapon).toBe('iron-sword');
    expect(P.said()).toEqual([{ type: 'out:bag:iron-sword:1' }, { type: 'in:bag:bronze-sword:1' }]);
    expect(out.map((e) => [e.stat, e.value])).toEqual([['gear.weapon.iron-sword', 1], ['gear.weapon.bronze-sword', 0]]);
  });
});

describe('the party carried between levels (the party mechanic)', () => {
  const S = buildGameStoreKernel();
  // a game channel just big enough: the contract's party slice, the params it starts with, what is emitted
  const game = (params) => { const out = []; return { contract: { party: { slice: 'party' } }, onStart: (cb) => cb(params, 1), emit: (e) => out.push(e), out }; };

  it('the kernel saves a run as numbers and loads it back the same', () => {
    const cfg = readRpg(PLAY), R = rpgInit(cfg);
    R.m.ayla.level = 4; R.m.ayla.xp = 50; R.m.ayla.cl.fighter = { cp: 12, lv: 3, sp: 2 };
    rpgSwitchClass(cfg, R, 'ayla', 'mage', {});
    R.m.ayla.cl.mage.sp = 1;
    expect(rpgBuy(cfg, R, 'ayla', 'sleep')).toBe('');
    R.opened.knight = 1;
    const saved = rpgSave(cfg, R);
    expect(Object.values(saved.ayla).every((v) => typeof v === 'number')).toBe(true);
    expect(saved.ayla).toMatchObject({ lv: 4, xp: 50, 'cls.mage': 1, 'cls.fighter': 0, 'cp.fighter': 12, 'sp.fighter': 2, 'skill.sleep': 1, 'skill.fire': 1, 'open.knight': 1 });
    const R2 = rpgInit(cfg);
    rpgLoad(cfg, R2, { ayla: { stats: saved.ayla } });
    expect(rpgSave(cfg, R2).ayla).toEqual(saved.ayla);
    expect(R2.m.ayla.cl.fighter.lv).toBe(3);
  });

  it('the mechanic: consumes the party slice, produces setStat into it, names it for the page', () => {
    const schema = { slices: [{ name: 'party', kind: 'party' }, { name: 'campaign', kind: 'progression' }] };
    const c = composeMechanics([{ kind: 'reach-exit', at: [1, 0, 0] }, { kind: 'party' }], { storeSchema: schema });
    expect(c).toMatchObject({ party: { slice: 'party' }, consumes: [{ slice: 'party' }], produces: [{ type: 'setStat', slice: 'party' }] });
    expect(() => composeMechanics([{ kind: 'reach-exit', at: [1, 0, 0] }, { kind: 'party' }], { storeSchema: { slices: [{ name: 'campaign', kind: 'progression' }] } })).toThrow(/party/);
  });

  it('a level loads the roster, keeps what changed, and the next level starts where it was left', () => {
    const cfg = readRpg(PLAY), roster = Object.fromEntries(Object.entries(rpgSave(cfg, rpgInit(cfg))).map(([id, stats]) => [id, { name: id, stats }]));
    const schema = { slices: [{ name: 'party', kind: 'party', init: { roster } }] };
    let store = S.createStore(schema);
    // level one: Ayla becomes a knight
    const g1 = game({ party: store.party });
    const P1 = page(PLAY, {}, g1);
    P1.frames();
    P1.press('KeyP'); P1.press('ArrowRight'); P1.press('Enter'); P1.press('ArrowDown'); P1.press('Enter');
    expect(P1.api.R.m.ayla.cls).toBe('knight');
    expect(g1.out.map((e) => e.stat).sort()).toEqual(['cls.fighter', 'cls.knight', 'cp.knight', 'sp.knight', 'skill.guard-up'].sort());
    expect(g1.out.every((e) => e.type === 'setStat' && e.slice === 'party' && e.id === 'ayla')).toBe(true);
    const r = S.applyEvents(schema, store, g1.out);
    expect(r.ok).toBe(true);
    store = r.state;
    // level two: carried in
    const g2 = game({ party: store.party });
    const P2 = page(PLAY, {}, g2);
    P2.frames();
    expect(P2.api.R.m.ayla.cls).toBe('knight');
    expect(P2.bus.vars['rpg.ayla.class']).toBe('knight');
    expect(g2.out).toEqual([]);
  });
});

describe('the staging: a fight lines its sides up and frames them, and puts them back', () => {
  // (a world with its figures where they stand on the field: the hero, a member, the pack's figure, the follow camera)
  const world = () => {
    const E = [{ id: 'hero', transform: { pos: [0, 0, 0], heading: 0 }, rule: { type: 'platform' } }, { id: 'ayla', transform: { pos: [-1, 1, 0], heading: 0 }, rule: { type: 'ai' } }, { id: 'wolf-1', transform: { pos: [8, 0, 0], heading: Math.PI }, rule: { type: 'static' } }];
    const camera = { transform: { pos: [-5, 0, 2], heading: 0, pitch: 0 }, lookAt: null, rule: { type: 'follow', target: 'hero' } };
    return { pilotId: 'hero', time: 0, entities: E, byId: Object.fromEntries(E.map((e) => [e.id, e])), camera };
  };
  it('the party in a wedge a few metres from the pack, facing it; the camera off to the side, fitted to the fight; all put back at the close', () => {
    const w = world(), before = JSON.parse(JSON.stringify({ at: w.entities.map((e) => e.transform), cam: w.camera }));
    const P = page(PLAY, {}, null, { __mojCtrl: { world: w, cast() {}, ground: () => 0 } });
    processEvents(P.bus, [{ type: 'rpg-battle:wolves' }]);
    P.frames();
    expect(P.api.state().mode).toBe('battle');
    const [hero, ayla, wolf] = w.entities, d = (e) => Math.hypot(e.transform.pos[0] - 8, e.transform.pos[1]);
    // (the party's first at the wedge's point nearest the pack, the next a rank back and aside (bram, who has no figure,
    // stood for by the pilot), each turned to it; the pack turned to them)
    expect(d(ayla)).toBeLessThan(d(hero));
    for (const e of [hero, ayla]) { expect(d(e)).toBeGreaterThan(3.5); expect(d(e)).toBeLessThan(7); expect(e.staged).toBe(true); expect(Math.cos(Math.atan2(-e.transform.pos[1], 8 - e.transform.pos[0]) - e.transform.heading)).toBeCloseTo(1, 5); }
    expect(Math.hypot(hero.transform.pos[0] - ayla.transform.pos[0], hero.transform.pos[1] - ayla.transform.pos[1])).toBeGreaterThan(1);
    expect(Math.cos(wolf.transform.heading - Math.PI)).toBeGreaterThan(0.9);
    // (the camera taken off its follow, off to the side of the fight, looking at it)
    expect(w.camera.rule).toBeNull();
    expect(Array.isArray(w.camera.lookAt)).toBe(true);
    const cd = Math.hypot(w.camera.transform.pos[0] - w.camera.lookAt[0], w.camera.transform.pos[1] - w.camera.lookAt[1]);
    expect(cd).toBeGreaterThanOrEqual(4.5); expect(cd).toBeLessThanOrEqual(12.5);
    expect(Math.abs(w.camera.transform.pos[1])).toBeGreaterThan(3.5);
    // the fight played out: everything back where it stood, the camera following again
    for (let k = 0; k < 400 && P.api.state().mode === 'battle'; k++) { P.api.act('accept'); P.frames(); }
    expect(P.api.state().mode).toBeNull();
    expect(w.entities.map((e) => e.transform)).toEqual(before.at);
    expect(w.camera).toEqual(before.cam);
    expect(w.entities.some((e) => e.staged || e.act)).toBe(false);
  });
});

describe('the battle window is dressed by the world\'s UI guide', () => {
  it('its register and border on the window\'s panels where the world has a guide; its own defaults where none', () => {
    const L = level(PLAY), plain = eventsChannelScript(L.ev);
    const dressed = eventsChannelScript({ ...L.ev, style: { panel: '#203040', accent: '#e0a040', ink: '#f0f0e0' }, register: 0.75 });
    expect(plain).not.toMatch(/\.moj-rpg \.moj-w\{/);
    expect(dressed).toMatch(/\.moj-rpg \.moj-w\{/);
    expect(dressed).toContain('--moj-panel:#203040');
    expect(() => new Function(dressed)).not.toThrow();
  });
});

describe('the bars over the fighters\' heads', () => {
  const world = () => {
    const E = [{ id: 'hero', transform: { pos: [0, 0, 0], heading: 0 }, rule: { type: 'platform' } }, { id: 'ayla', transform: { pos: [-1, 1, 0], heading: 0 }, rule: { type: 'ai' } }, { id: 'wolf-1', transform: { pos: [8, 0, 0], heading: Math.PI }, rule: { type: 'static' } }];
    return { pilotId: 'hero', time: 0, entities: E, byId: Object.fromEntries(E.map((e) => [e.id, e])), camera: { transform: { pos: [-5, 0, 2], heading: 0, pitch: 0 }, lookAt: null, rule: { type: 'follow' } } };
  };
  it('each member a bar over its head, no name; the one picking marked; a status said; the window steps aside as a round plays', () => {
    const P = page(PLAY, {}, null, { __mojCtrl: { world: world(), cast() {}, ground: () => 0 } });
    processEvents(P.bus, [{ type: 'rpg-battle:wolves' }]);
    P.frames(); P.api.advance(); P.frames();
    const heads = P.appended.find((x) => x.className.split(' ').includes('moj-rpg-heads')), root = P.appended.find((x) => x.className.split(' ').includes('moj-rpg'));
    expect(heads.innerHTML).toMatch(/class="moj-rpg-head turn"[^>]*data-aim="ayla"/);
    expect(heads.innerHTML).not.toMatch(/class="n">Ayla/);
    // (a member poisoned: its head says so)
    P.api.R.m.ayla.poison = true; P.api.act('down'); P.frames();
    expect(heads.innerHTML).toMatch(/class="st">poison/);
    // (the picks made, the round plays out: the window and the bars step aside)
    const H = P.api;
    expect(H.state().mode).toBe('battle');
    for (let k = 0; k < 400 && H.state().mode === 'battle'; k++) { H.act('accept'); P.frames(); if (/acting/.test(root.className)) break; }
    expect(String(root.className)).toMatch(/acting/);
  });
});

describe('the cinema: a blow played as a short film, skippable, the view given back', () => {
  const world = () => {
    const E = [{ id: 'hero', transform: { pos: [0, 0, 0], heading: 0 }, rule: { type: 'platform' } }, { id: 'ayla', transform: { pos: [-1, 1, 0], heading: 0 }, rule: { type: 'ai' } }, { id: 'wolf-1', transform: { pos: [8, 0, 0], heading: Math.PI }, rule: { type: 'static' } }];
    return { pilotId: 'hero', time: 0, entities: E, byId: Object.fromEntries(E.map((e) => [e.id, e])), camera: { transform: { pos: [-5, 0, 2], heading: 0, pitch: 0 }, lookAt: null, rule: { type: 'follow' } } };
  };
  it('the camera cuts to the blow and back; the screen as the book keeps it; accept cuts a long film short', () => {
    const play = { rpg: { ...PLAY.rpg, rules: { cinema: { on: 'all', ui: 'none', skip: 0 } } } }, w = world();
    const P = page(play, {}, null, { __mojCtrl: { world: w, cast() {}, ground: () => 0 } });
    processEvents(P.bus, [{ type: 'rpg-battle:wolves' }]);
    P.frames(); P.api.advance(); P.frames();
    const viewAt = w.camera.transform.pos.slice(), root = P.appended.find((x) => x.className.split(' ').includes('moj-rpg'));
    // (the picks made: the round plays, the first blow filmed)
    let filmed = false, cut = false;
    for (let k = 0; k < 60 && P.api.state().mode === 'battle'; k++) {
      if (P.api.state().phase === 'play') {
        P.frames();
        if (JSON.stringify(w.camera.transform.pos) !== JSON.stringify(viewAt)) filmed = true;
        if (filmed && /cine-none/.test(root.className) && /Skip/.test(root.innerHTML)) { cut = true; P.api.act('accept'); P.frames(); break; }
      } else { P.api.act('accept'); P.frames(); }
    }
    expect(filmed).toBe(true);
    expect(cut).toBe(true);
    // (cut short: the view given back)
    expect(w.camera.transform.pos).toEqual(viewAt);
    for (let k = 0; k < 400 && P.api.state().mode === 'battle'; k++) { P.api.act('accept'); P.frames(); }
    expect(P.api.state().mode).toBeNull();
  });

  it('a book writes its cinema in the battles\' rules; a wrong one is refused, saying what it takes', () => {
    expect(() => lowerPlay({ entities: ENTITIES, play: { rpg: { ...PLAY.rpg, rules: { cinema: { on: 'skills', ui: 'numbers', skip: 3 } } } } }, { player: 'hero' })).not.toThrow();
    expect(() => lowerPlay({ entities: ENTITIES, play: { rpg: { ...PLAY.rpg, rules: { cinema: { on: 'always' } } } } }, { player: 'hero' })).toThrow(/cinema.on is 'skills'/);
    expect(() => lowerPlay({ entities: ENTITIES, play: { rpg: { ...PLAY.rpg, rules: { view: 'diagonal' } } } }, { player: 'hero' })).toThrow(/view is side or front or left or right or overhead/);
  });
});
