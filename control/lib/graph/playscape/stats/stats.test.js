import { describe, it, expect } from 'vitest';
import { createBusState, processEvents, watchEvents, syncToCtrl } from '../../worlds/event-bus.js';
import { composeLive } from '../../worlds/controllable/compose.js';
import { buildStats, stepStats, initStatVars, resolveScaling, evalFormula, applyStatBodies } from './kernel.js';
import { readStats, lowerStats } from './stats.js';
import { lowerPlay } from '../ui/direction.js';
import { eventsChannelScript } from '../../scene/channels/events.js';

// a hero with strength, skill points from levels, gold, three epochs and a tree with ranks and a subtree
const STATS = {
  holders: ['hero'],
  stats: [{ id: 'strength', base: 5, min: 0, max: 20 }, { id: 'vitality', base: 3 }],
  resources: [{ id: 'points' }, { id: 'gold', start: 10, cap: 500 }],
  level: { start: 1, max: 10, xp: { base: 100, growth: 2 }, each: { grant: { points: 1 }, raise: { vitality: 1 } }, at: { 3: { grant: { gold: 50 } } } },
  epochs: [{ id: 'hatchery' }, { id: 'lair', level: 3 }, { id: 'hive', cost: { gold: 100 }, requires: { level: 4 } }],
  tree: [
    { id: 'fireball', cost: { points: 1 }, ranks: 3, growth: 2, tree: [{ id: 'inferno', opens: 2, cost: { points: 1 } }] },
    { id: 'burrow', epoch: 'lair', cost: { points: 1 } },
    { id: 'carapace', epoch: 'hive', requires: { all: [{ has: 'burrow' }, { stat: 'strength', gte: 6 }] }, cost: { points: 1, gold: 20 } },
  ],
  offers: [{ id: 'train', cost: { points: 1 }, gives: { raise: { strength: 1 } } }],
};

const cfg = () => readStats({ stats: STATS });
const fresh = () => { const c = cfg(); return { c, S: { vars: initStatVars(c), _ctrlOps: [] } }; };
const run = (c, S, ...ops) => { S._ctrlOps.push(...ops); return stepStats(c, S); };

describe('stats: reading', () => {
  it('lowers xp thresholds as running totals and starts every holder', () => {
    const c = cfg();
    expect(c.level.xp.slice(0, 4)).toEqual([100, 300, 700, 1500]);
    expect(c.level.xp.length).toBe(9);
    const v = initStatVars(c);
    expect(v).toMatchObject({ 'hero.strength': 5, 'hero.gold': 10, 'hero.points': 0, 'hero.level': 1, 'hero.xp': 0, 'hero.epoch': 'hatchery', 'hero.fireball': 0, 'hero.fireball.open': 1, 'hero.inferno.open': 0, 'hero.burrow.open': 0 });
  });
  it('teaches: one namespace, known names, reachable subtrees', () => {
    expect(() => readStats({ stats: { stats: [{ id: 'level' }] } })).toThrow(/track's own/);
    expect(() => readStats({ stats: { stats: [{ id: 'a' }], resources: [{ id: 'a' }] } })).toThrow(/share one set of names/);
    expect(() => readStats({ stats: { stats: [{ id: 'a' }], offers: [{ id: 'o', cost: { mana: 1 }, gives: { raise: { a: 1 } } }] } })).toThrow(/no resource/);
    expect(() => readStats({ stats: { stats: [], tree: [{ id: 'x', epoch: 'lair' }] } })).toThrow(/no epoch/);
    expect(() => readStats({ stats: { resources: [{ id: 'p' }], tree: [{ id: 'a', ranks: 1, tree: [{ id: 'b', opens: 2 }] }] } })).toThrow(/could never open/);
    expect(() => readStats({ stats: { stats: [], epochs: [{ id: 'one' }, { id: 'two' }] } })).toThrow(/reached by a level, bought/);
    expect(lowerStats({})).toBeNull();
  });
});

describe('stats: the kernel', () => {
  it('xp crossing several thresholds levels each time and gives each level its gives; an epoch comes by level', () => {
    const { c, S } = fresh();
    const out = run(c, S, { op: 'xp', by: 350 });
    expect(S.vars['hero.level']).toBe(3);
    expect(S.vars['hero.points']).toBe(2);
    expect(S.vars['hero.vitality']).toBe(5);
    expect(S.vars['hero.gold']).toBe(60);          // the at-3 gift
    expect(S.vars['hero.epoch']).toBe('lair');
    expect(out.map((e) => e.type)).toEqual(['level-up', 'level-up', 'epoch', 'opened']);
    expect(out.find((e) => e.type === 'opened').id).toBe('burrow');
  });
  it('a purchase is atomic: denied changes nothing and says why', () => {
    const { c, S } = fresh();
    const before = JSON.stringify(S.vars);
    expect(run(c, S, { op: 'buy', id: 'fireball' })).toEqual([{ type: 'denied', of: 'hero', id: 'fireball', why: 'cost' }]);
    expect(run(c, S, { op: 'buy', id: 'burrow' })[0].why).toBe('requires');
    expect(run(c, S, { op: 'buy', id: 'nothing' })[0].why).toBe('unknown');
    expect(JSON.stringify(S.vars)).toBe(before);
  });
  it('ranks cost more by growth; a subtree opens at its parent rank; max refuses', () => {
    const { c, S } = fresh();
    run(c, S, { op: 'grant', res: 'points', by: 10 });
    expect(run(c, S, { op: 'buy', id: 'inferno' })[0].why).toBe('requires');
    run(c, S, { op: 'buy', id: 'fireball' });                 // rank 1 costs 1
    const out = run(c, S, { op: 'buy', id: 'fireball' });     // rank 2 costs 2, opens inferno
    expect(out).toEqual([{ type: 'bought', of: 'hero', id: 'fireball', rank: 2 }, { type: 'opened', of: 'hero', id: 'inferno' }]);
    expect(S.vars['hero.points']).toBe(7);
    run(c, S, { op: 'buy', id: 'fireball' });                 // rank 3 costs 4
    expect(S.vars['hero.points']).toBe(3);
    expect(S.vars['hero.fireball.open']).toBe(0);             // maxed
    expect(run(c, S, { op: 'buy', id: 'fireball' })[0].why).toBe('max');
  });
  it('an epoch with a cost is bought in order, after its level; it opens the nodes that wait on it', () => {
    const { c, S } = fresh();
    run(c, S, { op: 'grant', res: 'gold', by: 200 }, { op: 'grant', res: 'points', by: 5 });
    expect(run(c, S, { op: 'buy', id: 'hive' })[0].why).toBe('requires');   // still hatchery
    run(c, S, { op: 'level', by: 3 });                                       // level 4: lair by level
    run(c, S, { op: 'buy', id: 'burrow' }, { op: 'buy', id: 'train' });
    const out = run(c, S, { op: 'buy', id: 'hive' });
    expect(out.map((e) => e.type)).toEqual(['bought', 'epoch', 'opened']);
    expect(S.vars['hero.epoch']).toBe('hive');
    expect(run(c, S, { op: 'buy', id: 'carapace' })[0]).toMatchObject({ type: 'bought', id: 'carapace' });
  });
  it('stats hold to min / max and resources to cap', () => {
    const { c, S } = fresh();
    run(c, S, { op: 'raise', stat: 'strength', by: 100 }, { op: 'grant', res: 'gold', by: 9999 });
    expect(S.vars['hero.strength']).toBe(20);
    expect(S.vars['hero.gold']).toBe(500);
    run(c, S, { op: 'raise', stat: 'strength', by: -100 });
    expect(S.vars['hero.strength']).toBe(0);
  });
  it('a stat-affected phenomenon: the cast op keeps its place with its scaling read now and held to the field', () => {
    const { c, S } = fresh();
    S._ctrlOps.push({ op: 'hurt', who: 'ogre', by: { stat: 'strength', base: 4, per: 2 } }, { op: 'raise', stat: 'strength', by: 3 }, { op: 'hurt', who: 'ogre', by: { stat: 'strength', base: 4, per: 2 } }, { op: 'shake', k: { stat: 'fireball', per: 10 } });
    stepStats(c, S);
    expect(S._ctrlOps).toEqual([{ op: 'hurt', who: 'ogre', by: 14 }, { op: 'hurt', who: 'ogre', by: 20 }, { op: 'shake', k: 0 }]);
    expect(resolveScaling(c, S.vars, { stat: 'epoch', per: 1 })).toBe(0);
    expect(resolveScaling(c, S.vars, { stat: 'strength', per: 1, max: 5 })).toBe(5);
  });
  it('is one self-contained source', () => {
    const k = new Function(`return (${buildStats.toString()})();`)();
    const { c, S } = fresh();
    S._ctrlOps.push({ op: 'xp', by: 100 });
    expect(k.step(c, S).map((e) => e.type)).toEqual(['level-up']);
  });
});

describe('stats: cues and the cast', () => {
  const CW = composeLive();
  const ENTITIES = [
    { id: 'hero', rule: { type: 'walk' }, transform: { pos: [0, -6, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } },
    { id: 'ogre', rule: { type: 'patrol', speed: 0, turn: 0 }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.8, 0.8, 2], hp: 100, hittable: true } },
  ];
  // the page's loop in node: the stats kernel runs inside the watch fixed point, before the cast takes its ops
  function level(play) {
    const ev = lowerPlay({ entities: ENTITIES, play }, { player: 'hero' });
    const world = CW.createWorld({ entities: ENTITIES.map((e) => JSON.parse(JSON.stringify(e))) });
    const bus = createBusState(ev, []);
    const fix = () => { for (let g = 0; g < 8; g++) { const st = stepStats(ev.stats, bus); if (st.length) processEvents(bus, st); const w = watchEvents(bus); if (!w.length && !st.length) break; processEvents(bus, w); } };
    const send = (...evs) => { processEvents(bus, evs.map((type) => ({ type }))); fix(); syncToCtrl(bus, world.entities, (ops) => CW.castOps(world, ops)); };
    return { ev, bus, world, send, hp: () => world.byId.ogre.body.hp, fired: (t) => bus.log.filter((r) => r.type === t).length };
  }
  const play = {
    stats: { holders: ['hero'], stats: [{ id: 'strength', base: 5 }], resources: [{ id: 'points' }], level: { xp: [100, 250], each: { grant: { points: 1 } } }, offers: [{ id: 'train', cost: { points: 1 }, gives: { raise: { strength: 5 } } }] },
    cues: [
      { id: 'swing', when: { on: 'swing' }, then: { hurt: { who: 'ogre', by: { stat: 'strength', per: 2 } } } },
      { id: 'kill-xp', when: { on: 'slay' }, then: { xp: { by: 120 } } },
      { id: 'train', when: { on: 'train' }, then: { buy: 'train' } },
      { id: 'ding', when: { levelled: 'hero' }, then: { say: 'Level {event.level}', as: 'toast' } },
      { id: 'broke', when: { denied: 'train' }, then: { say: 'Not enough points', as: 'toast' } },
    ],
  };

  it('strength has no register: it only makes the hit land harder', () => {
    const L = level(play);
    expect(L.ev.stats).toBeTruthy();
    expect(L.ev.vars['hero.strength']).toBe(5);
    L.send('swing');
    expect(L.hp()).toBe(90);              // 2 × 5
    L.send('train');                       // no points yet
    expect(L.fired('cue:broke')).toBe(1);
    L.send('slay');                        // level 2, a point
    expect(L.fired('cue:ding')).toBe(1);
    L.send('train');                       // strength 10
    expect(L.bus.vars['hero.strength']).toBe(10);
    L.send('swing');
    expect(L.hp()).toBe(70);              // 2 × 10
  });

  it('a world with stats only for buying needs no cast; one without stats carries none of it', () => {
    const shop = lowerPlay({ play: { stats: play.stats, cues: [{ id: 'b', when: { on: 'click' }, then: { buy: 'train' } }] } });
    expect(shop.cast).toBeUndefined();
    expect(eventsChannelScript(shop)).toContain('__STATS.step(EVENTS.stats, __busState)');
    const plain = lowerPlay({ play: { cues: [{ id: 'b', when: { on: 'click' }, then: { say: 'hi' } }] } });
    expect(plain.stats).toBeUndefined();
    expect(eventsChannelScript(plain)).not.toContain('__STATS');
  });

  it('a scaling teaches without play.stats and names what a holder carries', () => {
    expect(() => lowerPlay({ play: { cues: [{ id: 's', when: { on: 'x' }, then: { hurt: { who: 'ogre', by: { stat: 'strength' } } } }] } })).toThrow(/declare play.stats/);
    expect(() => lowerPlay({ play: { stats: play.stats, cues: [{ id: 's', when: { on: 'x' }, then: { hurt: { who: 'ogre', by: { stat: 'luck' } } } }] } })).toThrow(/nothing a holder carries/);
  });
});

describe('stats: formulas', () => {
  const F = {
    holders: ['hero', { id: 'ogre', stats: { armor: 100, strength: 12 } }],
    stats: [
      { id: 'strength', base: 5 }, { id: 'vitality', base: 4 }, { id: 'armor', base: 0 },
      { id: 'hp-max', from: { sum: [50, { stat: 'vitality', per: 10 }] } },
      { id: 'might', from: { sum: [{ stat: 'strength', per: 2 }, { stat: 'level', per: 1.5 }] } },
    ],
    resources: [{ id: 'points', start: 3 }],
    level: { xp: [100] },
    bodies: { hpMax: 'hp-max' },
  };
  const c = () => readStats({ stats: F });

  it('several terms, opposed by the target, through the armor curve', () => {
    const cfg = c(), vars = initStatVars(cfg);
    expect(vars['hero.might']).toBe(11.5);                                   // 5 × 2 + 1 × 1.5
    const hit = { mul: [{ stat: 'might' }, { sum: [{ stat: 'armor', of: 'target' }], curve: { mitigate: 100 } }] };
    const S = { vars, _ctrlOps: [{ op: 'hurt', who: 'ogre', by: hit }, { op: 'hurt', who: 'hero', by: hit }] };
    stepStats(cfg, S);
    expect(S._ctrlOps[0]).toEqual({ op: 'hurt', who: 'ogre', by: 5.75 });   // 11.5 × 100 / (100 + 100)
    expect(S._ctrlOps[1].by).toBe(11.5);                                     // the hero wears none
    expect(S._statBodyOps.find((o) => o.who === 'hero')).toEqual({ who: 'hero', hpMax: 90 });
    expect(S._ctrlOps.length).toBe(2);                                       // the cast's ops alone stay on its queue
  });
  it('curves: soft caps and roots', () => {
    const cfg = c(), vars = initStatVars(cfg);
    expect(evalFormula(cfg, vars, { stat: 'strength', per: 10, curve: { soft: 30, slope: 0.25 } }, { self: 'hero' })).toBe(35);
    expect(evalFormula(cfg, vars, { stat: 'strength', per: 10, curve: { soft: 30, slope: 0.25 } }, { self: 'ogre' })).toBe(52.5);
    expect(evalFormula(cfg, vars, { sum: [16], curve: 'sqrt', max: 3 }, {})).toBe(3);
  });
  it('modifier layers stack (base + add) × (1 + Σ pct) × Π mul, and come off by id', () => {
    const cfg = c(), S = { vars: initStatVars(cfg), _ctrlOps: [] };
    S._ctrlOps.push({ op: 'buff', id: 'blessed', mods: [{ stat: 'strength', add: 3 }] }, { op: 'buff', id: 'rage', mods: [{ stat: 'strength', pct: 0.5 }, { stat: 'strength', mul: 2 }] });
    stepStats(cfg, S);
    expect(S.vars['hero.strength']).toBe(24);          // (5 + 3) × 1.5 × 2
    expect(S.vars['hero.strength.base']).toBe(5);
    expect(S.vars['hero.might']).toBe(49.5);           // derived reads the effective value
    S._ctrlOps.push({ op: 'raise', stat: 'strength', by: 1 }, { op: 'unbuff', id: 'rage' });
    stepStats(cfg, S);
    expect(S.vars['hero.strength']).toBe(9);
    S._ctrlOps.push({ op: 'buff', id: 'status:poisoned', mods: [{ stat: 'vitality', add: -2 }] }, { op: 'buff', id: 'status:slow', mods: [{ stat: 'vitality', add: -1 }] });
    stepStats(cfg, S);
    expect(S.vars['hero.hp-max']).toBe(60);
    expect(S._statBodyOps.filter((o) => o.who === 'hero').pop()).toEqual({ who: 'hero', hpMax: 60 });
    S._ctrlOps = [{ op: 'unbuff', id: 'status:*' }];
    stepStats(cfg, S);
    expect(S.vars['hero.hp-max']).toBe(90);
  });
  it('derived stats follow levels; they are never raised; circles are refused', () => {
    const cfg = c(), S = { vars: initStatVars(cfg), _ctrlOps: [{ op: 'xp', by: 100 }] };
    stepStats(cfg, S);
    expect(S.vars['hero.might']).toBe(13);
    expect(() => readStats({ stats: { stats: [{ id: 'a', from: { stat: 'b' } }, { id: 'b', from: { stat: 'a' } }] } })).toThrow(/round in a circle/);
    expect(() => readStats({ stats: { stats: [{ id: 'a', from: { stat: 'a', of: 'target' } }] } })).toThrow(/no target here/);
    expect(() => lowerPlay({ play: { stats: F, cues: [{ id: 'r', when: { on: 'x' }, then: { raise: { stat: 'might', by: 1 } } }] } })).toThrow(/derived/);
    expect(() => readStats({ stats: { stats: [{ id: 'a' }], bodies: { mana: 'a' } } })).toThrow(/hpMax, speed/);
  });
  it('teaches the formula shapes', () => {
    const cfg = c();
    expect(() => readStats({ stats: { stats: [{ id: 'a', from: { sum: [{ stat: 'a2' }] } }] } })).toThrow(/nothing a holder carries/);
    expect(() => readStats({ stats: { stats: [{ id: 'a' }, { id: 'b', from: { stat: 'a', curve: { mitigate: -1 } } }] } })).toThrow(/armor curve/);
    expect(() => readStats({ stats: { stats: [{ id: 'a' }, { id: 'b', from: { add: [1] } }] } })).toThrow(/sum\?: \[\.\.\], mul\?/);
    expect(cfg.order.indexOf('might')).toBeGreaterThan(cfg.order.indexOf('strength'));
  });

  // the operator's loop, in node, with the cast taking the kernel's body ops
  const CW = composeLive();
  const ENTS = [
    { id: 'hero', rule: { type: 'walk' }, transform: { pos: [0, -6, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7], hp: 50, hittable: true } },
    { id: 'ogre', rule: { type: 'patrol', speed: 0, turn: 0 }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.8, 0.8, 2], hp: 100, hittable: true } },
  ];
  function level(play) {
    const ev = lowerPlay({ entities: ENTS, play }, { player: 'hero' });
    const world = CW.createWorld({ entities: ENTS.map((e) => JSON.parse(JSON.stringify(e))) });
    const bus = createBusState(ev, []);
    const fix = () => { for (let g = 0; g < 8; g++) { const st = stepStats(ev.stats, bus); if (st.length) processEvents(bus, st); const w = watchEvents(bus); if (!w.length && !st.length) break; processEvents(bus, w); } };
    const hand = () => { applyStatBodies(bus, world); syncToCtrl(bus, world.entities, (ops) => CW.castOps(world, ops)); };
    const send = (...evs) => { processEvents(bus, evs.map((type) => ({ type }))); fix(); hand(); };
    fix(); hand();
    return { ev, bus, world, send };
  }

  it('a status carries modifiers on a holder while it lasts; the bound hpMax follows; lifting takes them off', () => {
    const L = level({
      stats: F,
      cues: [
        { id: 'bless', when: { on: 'bless' }, then: { status: { who: 'hero', is: 'blessed', look: 'glow', mods: [{ stat: 'vitality', add: 2 }, { stat: 'strength', pct: 0.2 }] } } },
        { id: 'unbless', when: { on: 'unbless' }, then: { lift: { who: 'hero', is: 'blessed' } } },
        { id: 'swing', when: { on: 'swing' }, then: { hurt: { who: 'ogre', by: { mul: [{ stat: 'might', of: 'hero' }, { sum: [{ stat: 'armor', of: 'target' }], curve: { mitigate: 100 } }] } } } },
      ],
    });
    expect(L.world.byId.hero.hpMax).toBe(90);          // bound at the first pass
    expect(L.world.byId.hero.body.hp).toBe(90);        // a rise from its minted 50 adds the difference
    L.send('bless');
    expect(L.bus.vars['hero.strength']).toBe(6);
    expect(L.world.byId.hero.hpMax).toBe(110);
    L.send('swing');
    expect(L.world.byId.ogre.hpMax).toBe(90);          // the ogre is a holder too: its own bound hp-max
    expect(L.world.byId.ogre.body.hp).toBeCloseTo(90 - (12 + 1.5) / 2);    // might 13.5 through 100 armor
    L.send('unbless');
    expect(L.bus.vars['hero.strength']).toBe(5);
    expect(L.world.byId.hero.hpMax).toBe(90);
    expect(L.world.byId.hero.body.hp).toBe(90);
  });
  it('a buff for a while comes off by itself', () => {
    const L = level({ stats: F, cues: [{ id: 'war', when: { on: 'cry' }, then: { buff: { id: 'warcry', stat: 'strength', mul: 2, for: 5 } } }] });
    L.send('cry');
    expect(L.bus.vars['hero.strength']).toBe(10);
    expect(L.ev.sequences.length).toBe(1);
  });
});
