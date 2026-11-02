// The errand in a world (errand.js; a world's `errands`). The laws: it reads and refuses like the WCD (a map world only,
// levels and items known, no cycle, a bounty's foe fielded where it falls); its laws advise (solvable through the links
// and their keys, varied, survivable); each level's last stage lays its legs on beats of their own beside the bag, the
// giver's the hand-in for the list's roots, every level the cargo; they compose against the game's store; and the errand
// walked level by level, the bag carried between them as the store carries it, is won at the giver.
import { describe, it, expect } from 'vitest';
import { MEADOWMARK_HERO } from './examples.js';
import { readGameworld } from './world.js';
import { gameStages, stageLevelOrder, gameStore, mapPlan } from './levels.js';
import { composeMechanics } from '../game/mechanics.js';
import { buildBus } from '../worlds/event-bus.js';

const { review, ...base } = MEADOWMARK_HERO;
const lv = (name, extra = {}) => ({ name, seed: 8, walk: { nodes: { path: { trail: true } } }, ...extra });
const EGGS = { id: 'eggs-run', giver: 'home', reward: [{ item: 'gold', n: 5 }], list: [
  { item: 'coin', at: 'farm', count: 3 },
  { item: 'eggs', at: 'market', count: 12, min: 6, needs: ['coin'], cargo: { fragile: true } },
  { item: 'pelt', at: 'woods', from: { foe: 'walker' } },
] };
const MAP = {
  ...base, topology: 'interconnected',
  levels: { home: lv('Home'), farm: lv('The farm'), market: lv('The market'), woods: lv('The woods', { foes: { from: ['walker'], count: 1 } }) },
  links: [{ from: 'home', to: 'farm' }, { from: 'farm', to: 'market' }, { from: 'market', to: 'woods' }],
  errands: [EGGS],
};
const G = readGameworld(MAP), stages = gameStages(MAP), refs = stages.map((s) => `e-${s.level}`);
const plan = mapPlan(G, stages, refs);
const made = Object.fromEntries(stages.map((s, i) => [s.level, stageLevelOrder(G, s, { ref: refs[i], heroRef: 'h', map: plan[i] })]));
const mech = (level) => made[level].args.manifest.game.mechanics;
const withErrands = (errands, extra = {}) => ({ ...MAP, errands, ...extra });

describe('an errand read', () => {
  it('its tree in order, its roots the giver\'s asking, its laws holding', () => {
    const [E] = G.errands;
    expect(E.order).toEqual(['coin', 'eggs', 'pelt']);
    expect(E.roots).toEqual(['eggs', 'pelt']);
    for (const l of E.laws) expect(l.holds, `${l.law}: ${l.says}`).toBe(true);
    expect(E.laws.find((l) => l.law === 'solvable').says).toBe('coin → eggs → pelt → home');
  });

  it('refuses what it cannot be', () => {
    const bad = (errands, re, extra) => expect(() => readGameworld(withErrands(errands, extra))).toThrow(re);
    bad([EGGS], /a map world's/, { topology: undefined });
    bad([{ ...EGGS, giver: 'moon' }], /giver is the level/);
    bad([{ ...EGGS, list: [...EGGS.list, { item: 'coin', at: 'home' }] }], /on the list twice/);
    bad([{ ...EGGS, list: [{ item: 'eggs', at: 'market', needs: ['salt'] }] }], /needs 'salt', which is on no list/);
    bad([{ ...EGGS, list: [{ item: 'a', at: 'farm', needs: ['b'] }, { item: 'b', at: 'farm', needs: ['a'] }] }], /the needs go round/);
    bad([{ ...EGGS, list: [{ item: 'pelt', at: 'farm', from: { foe: 'walker' } }] }], /fields no 'walker'/);
    bad([{ ...EGGS, list: [{ item: 'eggs', at: 'market', count: 2, min: 3 }] }], /min is how many/);
    bad([EGGS, { ...EGGS, id: 'other' }], /one item, one errand/);
  });

  it('advises: a leg out of reach behind a key never found, two legs in one level, a cargo with nothing to lose', () => {
    const keyed = readGameworld(withErrands([EGGS], { links: [{ from: 'home', to: 'farm' }, { from: 'farm', to: 'market', key: 'pass', keyAt: 'woods' }, { from: 'market', to: 'woods' }] }));
    expect(keyed.errands[0].laws.find((l) => l.law === 'solvable')).toMatchObject({ holds: false });
    const found = readGameworld(withErrands([EGGS], { links: [{ from: 'home', to: 'farm' }, { from: 'farm', to: 'market', key: 'pass', keyAt: 'home' }, { from: 'market', to: 'woods' }] }));
    expect(found.errands[0].laws.find((l) => l.law === 'solvable').holds).toBe(true);
    const one = readGameworld(withErrands([{ ...EGGS, list: [{ item: 'coin', at: 'market', count: 3 }, { ...EGGS.list[1], min: 12 }] }]));
    expect(one.errands[0].laws.filter((l) => !l.holds).map((l) => l.law)).toEqual(['varied', 'survivable']);
  });
});

describe('an errand laid on the map', () => {
  it('each level\'s last stage its legs on beats of their own, the giver\'s the hand-in, every level the cargo, beside the bag', () => {
    const kinds = (level) => mech(level).filter((m) => ['bag', 'trade', 'bounty', 'deliver', 'cargo'].includes(m.kind)).map((m) => m.kind);
    expect(kinds('home')).toEqual(['bag', 'deliver', 'cargo']);
    expect(kinds('farm')).toEqual(['bag', 'trade', 'cargo']);
    expect(kinds('market')).toEqual(['bag', 'trade', 'cargo']);
    expect(kinds('woods')).toEqual(['bag', 'bounty', 'cargo']);
    expect(mech('market').find((m) => m.kind === 'trade')).toMatchObject({ item: 'eggs', count: 12, needs: [{ item: 'coin', n: 3 }] });
    expect(mech('woods').find((m) => m.kind === 'bounty')).toEqual({ kind: 'bounty', item: 'pelt', who: 'foe-walker-*', n: 1 });
    expect(mech('home').find((m) => m.kind === 'deliver')).toMatchObject({ id: 'eggs-run', wants: [{ item: 'eggs', min: 6 }, { item: 'pelt', min: 1 }], reward: [{ item: 'gold', n: 5 }] });
    // a place of its own: never a way's spot or the exit
    for (const level of ['home', 'farm', 'market']) {
      const M = mech(level), spot = M.find((m) => m.kind === 'trade' || m.kind === 'deliver').at;
      for (const w of M.filter((m) => m.kind === 'reach-exit')) expect(Math.hypot(w.at[0] - spot[0], w.at[1] - spot[1])).toBeGreaterThan(2);
    }
    // the game carries the bag; each level composes against its store
    const store = gameStore(MAP, null);
    expect(store.slices).toContainEqual({ name: 'bag', kind: 'inventory' });
    for (const level of Object.keys(made)) expect(() => composeMechanics(mech(level), { storeSchema: store, player: 'h' })).not.toThrow();
  });

  it('a world without errands lays its map as before', () => {
    const { errands: _e, ...plain } = MAP;
    const P = mapPlan(readGameworld(plain), stages, refs);
    expect(P.every((p) => !p.errand?.length)).toBe(true);
  });
});

describe('an errand played level by level', () => {
  const B = buildBus();
  // a level's bus, its bag seeded from what the store carried in; a walker to each spot; events between; the bag out
  const visit = (level, bag, steps) => {
    const c = composeMechanics(mech(level), { storeSchema: gameStore(MAP, null), player: 'h', fall: 'none' }), ev = c.events;
    const s = B.createBusState(ev, ev.entities);
    for (const [k, v] of Object.entries(bag)) s.vars[k] = v;
    let prev;
    const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } };
    pump([]);
    for (const st of steps) {
      if (st.at) for (let f = 0; f < 2; f++) { const z = B.deriveZoneEvents([{ id: 'h', position: st.at }], prev, ev.sources); prev = z.prev; pump(z.events); }
      if (st.event) pump([st.event]);
    }
    const out = Object.fromEntries(Object.entries(s.vars).filter(([k]) => k.startsWith('held:bag:')));
    return { bag: out, log: s.log.map((r) => r.type) };
  };
  const spotOf = (level, kind) => mech(level).find((m) => m.kind === kind).at;

  it('turned away empty-handed; coin, eggs for the coin, a hit breaks one, a pelt off a fallen walker; delivered for gold', () => {
    const first = visit('home', {}, [{ at: spotOf('home', 'deliver') }]);
    expect(first.log).toContain('errand:short:eggs-run');
    const farm = visit('farm', first.bag, [{ at: spotOf('farm', 'trade') }]);
    const market = visit('market', farm.bag, [{ at: spotOf('market', 'trade') }, { event: { type: 'hit:h' } }]);
    expect([market.bag['held:bag:coin'], market.bag['held:bag:eggs']]).toEqual([0, 11]);
    const woods = visit('woods', market.bag, [{ event: { type: 'down', entity: 'foe-walker-1' } }]);
    expect(woods.bag['held:bag:pelt']).toBe(1);
    const home = visit('home', woods.bag, [{ at: spotOf('home', 'deliver') }]);
    expect(home.log).toContain('errand:done:eggs-run');
    expect(home.bag).toMatchObject({ 'held:bag:eggs': 5, 'held:bag:pelt': 0, 'held:bag:gold': 5 });
  });
});
