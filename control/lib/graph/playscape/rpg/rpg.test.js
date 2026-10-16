import { describe, it, expect } from 'vitest';
import { readRpg, rpgCues, withRpg, lowerRpg } from './rpg.js';
import { buildRpg } from './kernel.js';
import { CLASS_PRESETS } from './presets.js';
import { lowerPlay } from '../ui/direction.js';
import { createBusState, processEvents, watchEvents } from '../../worlds/event-bus.js';
import { eventsChannelScript } from '../../scene/channels/events.js';
import { rpgScript, rpgPage, RPG_CSS } from '../../scene/channels/rpg-channel.js';

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

  it('on the bus: walking up starts it once; a win fells the foe on the map; a loss fails the level', () => {
    const cues = rpgCues(PLAY);
    expect(cues.find((c) => c.id === 'rpg-meet-wolves')).toEqual({ id: 'rpg-meet-wolves', when: { enter: { at: [8, 0], r: 2.2 } }, if: [{ var: 'rpg.battle', eq: 0 }, { var: 'rpg-done-wolves', eq: 0 }], then: { emit: 'rpg-battle:wolves' } });
    const L = level(PLAY);
    expect(L.ev.rpg.party.map((p) => p.id)).toEqual(['ayla', 'bram']);
    expect(L.ev.vars).toMatchObject({ 'rpg.battle': 0, 'rpg-done-wolves': 0, 'rpg.ayla.level': 1, 'rpg.bram.class': 'mage', gold: 0 });
    L.fire('rpg-won:wolves');
    expect(L.bus.vars['rpg-done-wolves']).toBe(1);
    expect(L.ev.reactions.some((r) => r.on === 'rpg-won:wolves' || (r.do === 'ctrl' && r.op === 'kill'))).toBe(true);
    L.bus.vars.hp = 50;
    L.fire('rpg-lost:drake');
    expect(L.bus.vars.hp).toBe(50);
    L.fire('rpg-lost');
    expect(L.bus.vars.hp).toBe(0);
    expect(rpgCues({ rpg: { ...PLAY.rpg, rules: { defeat: 'retry' } } }).some((c) => c.id === 'rpg-defeat')).toBe(false);
  });
});

// the page function, run headless: a DOM just big enough (elements with class lists and innerHTML, key listeners)
function page(play, vars = {}) {
  const ev = lowerPlay({ entities: ENTITIES, play }, { player: 'hero' });
  const bus = createBusState(ev, []);
  Object.assign(bus.vars, vars);
  const el = () => ({ className: '', innerHTML: '', textContent: '', classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {} });
  const keys = [];
  const document = { createElement: el, head: el(), body: el() };
  const window = { addEventListener: (_, f) => keys.push(f) };
  const queue = [];
  const api = new Function('document', 'window', '__busState', '__inputQueue', 'RPG_CSS_TEXT', 'cfg', 'K', `return (${rpgPage.toString()})(cfg, K);`)(document, window, bus, queue, RPG_CSS, ev.rpg, new Function(`return (${buildRpg.toString()})();`)());
  let t = 0;
  const frames = (n = 1) => { for (let i = 0; i < n; i++) { t += 100; api.step(t); } };
  const press = (code) => { for (const f of keys) f({ code, repeat: false, preventDefault() {}, stopImmediatePropagation() {} }); };
  return { api, bus, queue, frames, press, window };
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
    expect(P.queue.map((e) => e.type)).toHaveLength(2);
    expect(P.queue[0].type).toMatch(/^rpg-(won|lost|fled):wolves$/);
    expect(P.queue[1].type).toBe(P.queue[0].type.split(':')[0]);
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
    expect(P.queue).toEqual([{ type: 'rpg-class:ayla:knight' }]);
    P.press('Escape'); P.press('Escape');
    expect(P.api.state().mode).toBeNull();
  });

  it('the page carries the channel only when the events have rpg, and its script parses', () => {
    const L = level(PLAY);
    expect(eventsChannelScript(L.ev)).toContain('__stepRpg(t)');
    expect(() => new Function(rpgScript())).not.toThrow();
    expect(() => new Function(eventsChannelScript(L.ev))).not.toThrow();
  });
});
