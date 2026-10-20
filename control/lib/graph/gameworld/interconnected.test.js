import { describe, it, expect } from 'vitest';

import { MEADOWMARK_HERO } from './examples.js';
import { readGameworld } from './world.js';
import { gameStages, stageLevelOrder, gameLevels, gameStore, mapPlan, powerKeys } from './levels.js';
import { readActions } from './actions.js';
import { validateLevelContract } from '../game/level-contract.js';
import { gameChannelScript } from '../scene/channels/game.js';
import { controllableChannelScript } from '../scene/channels/controllable/index.js';
import { validateGameManifest } from '../game/game-manifest.js';
import { buildGameStoreKernel } from '../game/store-kernel.js';
import { composeMechanics } from '../game/mechanics.js';

// An INTERCONNECTED world (cosmos space.topology): a map, not a list. A two-stage hub, a cave and a keep off it; the
// keep's door is locked by a rune that lies in the cave. Every link runs both ways, a level is left by one of its
// exits, the game travels on and arrives at the matching end; a key opens a door found earlier.
const K = buildGameStoreKernel();
const { review, ...base } = MEADOWMARK_HERO;
const MAP = {
  ...base,
  topology: 'interconnected',
  levels: {
    hub: { name: 'The hub', seed: 8, walk: { nodes: { gate: { trail: true }, yard: { trail: true } } } },
    cave: { name: 'The cave', seed: 8, walk: { nodes: { mouth: { trail: true } } } },
    keep: { name: 'The keep', seed: 8, walk: { nodes: { door: { trail: true } } } },
  },
  links: [{ from: 'hub', to: 'cave' }, { from: 'hub', to: 'keep', kind: 'gate', key: 'rune', keyAt: 'cave' }],
};
const G = readGameworld(MAP), stages = gameStages(MAP), refs = stages.map((s) => `m-${s.level}-${s.node}`);
const plan = mapPlan(G, stages, refs);
const at = (lvl, node) => stages.findIndex((s) => s.level === lvl && s.node === node);
const orders = stages.map((s, i) => stageLevelOrder(G, s, { ref: refs[i], heroRef: 'h', map: plan[i] }));

describe('an interconnected world, planned', () => {
  it('joins a level\'s stages both ways, and each link both ways, from the last stage of one to the first of the other', () => {
    const ways = (lvl, node) => { const p = plan[at(lvl, node)]; return [...p.on, ...p.back].map((w) => `${w.id}→${w.to}${w.gate ? ` (${w.gate.has})` : ''}`); };
    expect(ways('hub', 'gate')).toEqual(['on→m-hub-yard']);
    expect(ways('hub', 'yard')).toEqual(['on→m-cave-mouth', 'on-2→m-keep-door (rune)', 'back→m-hub-gate']);
    expect(ways('cave', 'mouth')).toEqual(['back→m-hub-yard']);
    expect(ways('keep', 'door')).toEqual(['back→m-hub-yard']);   // never locked from inside
    expect(plan[at('cave', 'mouth')].keys).toEqual(['rune']);
  });

  it('a stage is left by each of its ways: a named reach-exit for each, and it arrives at the matching end', () => {
    const yard = orders[at('hub', 'yard')].args.manifest, ends = orders[at('hub', 'yard')].ends;
    const exits = yard.game.mechanics.filter((m) => m.kind === 'reach-exit');
    expect(exits.map((m) => m.exit)).toEqual(['on', 'on-2', 'back']);
    expect(exits[0].at).toEqual(ends.exit);                                  // the first way on: the trail's end
    expect(Math.hypot(exits[2].at[0] - ends.spawn[0], exits[2].at[1] - ends.spawn[1])).toBeCloseTo(2.4, 2);   // the way back: behind the spawn
    // coming back from the cave or the keep lands a few metres inside the exit taken, not at the spawn
    expect(yard.game.arrive).toEqual(['m-cave-mouth', 'm-keep-door']);
    const moves = yard.events.reactions.filter((r) => r.do === 'move');
    expect(moves.map((r) => r.on)).toEqual(['arrive:m-cave-mouth', 'arrive:m-keep-door']);
    expect(moves.every((r) => r.target === 'hero')).toBe(true);
    const d = Math.hypot(moves[0].to[0] - ends.exit[0], moves[0].to[1] - ends.exit[1]);
    expect(d).toBeGreaterThan(2.5);                                        // outside the exit's own zone
    expect(d).toBeLessThan(4.5);
    // the cave carries the rune, collected into the bag
    const cave = orders[at('cave', 'mouth')].args.manifest;
    expect(cave.game.mechanics.find((m) => m.kind === 'collect')).toMatchObject({ into: 'bag', pickups: [{ item: 'rune' }] });
  }, 120_000);

  it('the ways lower: one exit-named on-map row each, the envelope saying which', () => {
    const yard = orders[at('hub', 'yard')].args.manifest;
    const c = composeMechanics(yard.game.mechanics, { player: 'hero', spawn: [0, 0, 0] });
    expect(c.on).toMatchObject({
      'goal:reached:on': { end: 'success', exit: 'on' },
      'goal:reached:on-2': { end: 'success', exit: 'on-2' },
      'goal:reached:back': { end: 'success', exit: 'back' },
    });
  });

  it('the game is a map: levels list their exits, no chain of gates; the store carries a bag for the rune', () => {
    const levels = gameLevels(stages, refs, plan), store = gameStore(MAP, null);
    expect(levels.every((l) => !l.gate)).toBe(true);
    expect(levels[at('hub', 'yard')].exits).toEqual([
      { id: 'on', to: 'm-cave-mouth' }, { id: 'on-2', to: 'm-keep-door', gate: { has: 'rune', slice: 'bag' } }, { id: 'back', to: 'm-hub-gate' },
    ]);
    expect(store.slices.map((s) => `${s.name}:${s.kind}`)).toEqual(['hero:character', 'gear:inventory', 'campaign:progression', 'bag:inventory']);
    expect(validateGameManifest({ kind: 'game', title: 'map', store, levels }).errors).toEqual([]);
  });
});

describe('an interconnected world, played (the kernel)', () => {
  const store = gameStore(MAP, null), levels = gameLevels(stages, refs, plan);
  const won = (state, ref) => K.applyEvents(store, state, [{ type: 'promote', slice: 'campaign', ref, result: 'success' }]).state;

  it('the start is found; a level is found through an open exit of a level beaten; the keep waits on the rune', () => {
    let s = K.createStore(store);
    expect(K.reachable(store, s, levels)).toMatchObject({ 'm-hub-gate': true, 'm-hub-yard': false, 'm-cave-mouth': false, 'm-keep-door': false });
    s = won(s, 'm-hub-gate');
    expect(K.travel(store, s, levels, 'm-hub-gate', 'on')).toBe('m-hub-yard');
    s = won(s, 'm-hub-yard');
    expect(K.reachable(store, s, levels)).toMatchObject({ 'm-cave-mouth': true, 'm-keep-door': false });
    expect(K.travel(store, s, levels, 'm-hub-yard', 'on-2')).toBeNull();    // locked: no rune yet
    expect(K.travel(store, s, levels, 'm-hub-yard', 'on')).toBe('m-cave-mouth');
    // the cave: the rune picked up, left by the way back; then the yard again, and the keep opens
    s = K.applyEvents(store, s, [{ type: 'grant', slice: 'bag', item: 'rune', count: 1 }]).state;
    s = won(s, 'm-cave-mouth');
    expect(K.travel(store, s, levels, 'm-cave-mouth', 'back')).toBe('m-hub-yard');
    expect(K.travel(store, s, levels, 'm-hub-yard', 'on-2')).toBe('m-keep-door');
    expect(K.reachable(store, s, levels)['m-keep-door']).toBe(true);
  });

  it('a list game is untouched: no exits, the gates alone', () => {
    const list = [{ ref: 'a' }, { ref: 'b', gate: { completed: 'a' } }], sc = { slices: [{ name: 'p', kind: 'progression' }] };
    expect(K.isMap(list)).toBe(false);
    expect(K.reachable(sc, K.createStore(sc), list)).toEqual({ a: true, b: false });
    expect(K.travel(sc, K.createStore(sc), list, 'a', 'on')).toBeNull();
  });
});

describe('teaching', () => {
  it('a key outside a map, a key behind its own door, and a climb in a map say what is wrong', () => {
    expect(() => readGameworld({ ...MAP, topology: undefined })).toThrow(/key locks a door in a map world/);
    expect(() => readGameworld({ ...MAP, links: [{ from: 'hub', to: 'keep', key: 'rune', keyAt: 'keep' }] })).toThrow(/behind its own door/);
    expect(() => readGameworld({ ...MAP, topology: 'tangled' })).toThrow(/topology is one of linear .*interconnected/);
    const climb = { ...MAP, levels: { ...MAP.levels, keep: { name: 'The keep', seed: 8, walk: { nodes: { top: { meru: true } } } } } };
    const CG = readGameworld(climb), cs = gameStages(climb), cr = cs.map((s) => `c-${s.node}`), cp = mapPlan(CG, cs, cr);
    const i = cs.findIndex((s) => s.node === 'top');
    expect(() => stageLevelOrder(CG, cs[i], { ref: cr[i], heroRef: 'h', map: cp[i] })).toThrow(/a map world's stages are trails/);
  }, 120_000);

  it('the manifest teaches a bad exit, a has gate on no inventory, and a map with no progression', () => {
    const errs = (levels, slices = [{ name: 'p', kind: 'progression' }]) => validateGameManifest({ kind: 'game', title: 't', store: { slices }, levels }).errors.join(' | ');
    expect(errs([{ ref: 'a', exits: [{ id: 'on', to: 'zz' }] }])).toMatch(/exits\[0\]\.to 'zz' is not a level of this game/);
    expect(errs([{ ref: 'a', exits: [{ id: 'on', to: 'a' }] }])).toMatch(/leads back into its own level/);
    expect(errs([{ ref: 'a', exits: [{ id: 'on', to: 'b', gate: { has: 'rune' } }] }, { ref: 'b' }])).toMatch(/needs a inventory slice/);
    expect(errs([{ ref: 'a', exits: [{ id: 'on', to: 'b' }] }, { ref: 'b' }], [])).toMatch(/store needs a progression slice/);
  });
});

// POWER KEYS: a link keyed by one of the hero's powers. The power lies in the cave; picking it up opens the keep and,
// as the power names a move, gives the hero a second jump in every level after (and the moment it is picked up).
describe('an interconnected world, keyed by a power', () => {
  const hero = base.characters.hero;
  const withMove = (move) => ({
    ...MAP,
    characters: { ...base.characters, hero: { ...hero, actions: { ...hero.actions, powers: hero.actions.powers.map((p) => (p.id === 'gust-step' ? { ...p, move } : p)) } } },
    links: [{ from: 'hub', to: 'cave' }, { from: 'hub', to: 'keep', kind: 'gate', key: 'gust-step', keyAt: 'cave' }],
  });
  const P = withMove('double-jump'), PG = readGameworld(P), ps = gameStages(P), pr = ps.map((s) => `p-${s.level}-${s.node}`), pp = mapPlan(PG, ps, pr);
  const po = ps.map((s, i) => stageLevelOrder(PG, s, { ref: pr[i], heroRef: 'h', map: pp[i] }));
  const pat = (lvl, node) => ps.findIndex((s) => s.level === lvl && s.node === node);

  it('the power is found in the cave, held in powers, and locks the keep by that slice; there is no bag', () => {
    expect(powerKeys(PG)).toEqual([{ id: 'gust-step', move: 'double-jump' }]);
    expect(pp[pat('cave', 'mouth')]).toMatchObject({ keys: [], powers: ['gust-step'] });
    expect(pp[pat('hub', 'yard')].on[1].gate).toEqual({ has: 'gust-step', slice: 'powers' });
    expect(gameStore(P, null).slices.map((s) => s.name)).toEqual(['hero', 'gear', 'campaign', 'powers']);
    const cave = po[pat('cave', 'mouth')].args.manifest;
    expect(cave.game.mechanics.find((m) => m.kind === 'collect')).toMatchObject({ into: 'powers', pickups: [{ item: 'gust-step' }] });
  }, 120_000);

  it('every stage hears what is held and carries the move as a change to the hero\'s rule; the contract holds', () => {
    for (const o of po) {
      const g = o.args.manifest.game;
      expect(g.consumes).toEqual([{ slice: 'powers' }]);
      expect(g.powers).toEqual({ slice: 'powers', target: 'hero', grants: { 'gust-step': { airJumps: 1 } } });
    }
    const store = gameStore(P, null);
    const yard = po[pat('hub', 'yard')].args.manifest;
    const contract = { ...yard.game, produces: { events: [] } };
    expect(validateLevelContract(contract, store).errors).toEqual([]);
    expect(validateLevelContract({ ...contract, consumes: [] }, store).errors.join(' ')).toMatch(/powers\.slice 'powers' is not consumed/);
  }, 120_000);

  it('high-jump is made from the level\'s own jump; a power with no move locks the door and changes nothing', () => {
    const H = withMove('high-jump'), HG = readGameworld(H), hs = gameStages(H), hr = hs.map((s) => `h-${s.node}`), hp = mapPlan(HG, hs, hr);
    const o = stageLevelOrder(HG, hs[0], { ref: hr[0], heroRef: 'h', map: hp[0] });
    const jump = o.args.manifest.entities[0].rule.jumpSpeed;
    expect(o.args.manifest.game.powers.grants['gust-step'].jumpSpeed).toBeCloseTo(jump * Math.sqrt(1.5), 3);
    const N = withMove(undefined), NG = readGameworld(N), ns = gameStages(N), nr = ns.map((s) => `n-${s.node}`), np = mapPlan(NG, ns, nr);
    const n = stageLevelOrder(NG, ns[0], { ref: nr[0], heroRef: 'h', map: np[0] });
    expect(n.args.manifest.game.consumes).toEqual([{ slice: 'powers' }]);
    expect(n.args.manifest.game.powers).toBeUndefined();
  }, 120_000);

  it('the keep opens on the power, not on a bag item of the same name', () => {
    const store = gameStore(P, null), levels = gameLevels(ps, pr, pp);
    let s = K.createStore(store);
    s = K.applyEvents(store, s, [{ type: 'promote', slice: 'campaign', ref: pr[pat('hub', 'gate')], result: 'success' }, { type: 'promote', slice: 'campaign', ref: pr[pat('hub', 'yard')], result: 'success' }]).state;
    expect(K.travel(store, s, levels, pr[pat('hub', 'yard')], 'on-2')).toBeNull();
    s = K.applyEvents(store, s, [{ type: 'grant', slice: 'powers', item: 'gust-step', count: 1 }]).state;
    expect(K.travel(store, s, levels, pr[pat('hub', 'yard')], 'on-2')).toBe(pr[pat('keep', 'door')]);
  }, 120_000);

  it('the page carries the powers block only when the level has powers', () => {
    const yard = po[pat('hub', 'yard')].args.manifest.game;
    expect(gameChannelScript(yard)).toContain('function __grant(id)');
    expect(gameChannelScript({ ...yard, powers: undefined })).not.toContain('__grant');
  }, 120_000);

  it('the wall and the line are moves a power gives too: the grant the contract takes, the pilot\'s clips falling back, the line drawn', () => {
    for (const [move, grant] of [['wall', { wall: true }], ['swinger', { gear: 'swinger' }]]) {
      const W = withMove(move), WG = readGameworld(W), ws = gameStages(W), wr = ws.map((s) => `w-${s.level}-${s.node}`), wp = mapPlan(WG, ws, wr);
      const yard = stageLevelOrder(WG, ws[pat('hub', 'yard')], { ref: wr[pat('hub', 'yard')], heroRef: 'h', map: wp[pat('hub', 'yard')] }).args.manifest;
      expect(yard.game.powers.grants['gust-step']).toEqual(grant);
      expect(validateLevelContract({ ...yard.game, produces: { events: [] } }, gameStore(W, null)).errors).toEqual([]);
      expect(yard.figures.hero.clips.wall_crawl).toBeTruthy();
    }
    expect(validateLevelContract({ levelRef: 'x', mechanics: [], consumes: [{ slice: 'powers' }], powers: { slice: 'powers', target: 'hero', grants: { g: { wall: 'yes', airJumps: false } } }, produces: { events: [] } }, gameStore(P, null)).errors.join(' ')).toMatch(/number \| true \| word/);
    const pilot = [{ id: 'hero', pilotable: true, rule: { type: 'platform' }, body: { type: 'mesh', shape: 'box' } }];
    expect(controllableChannelScript(pilot, { rule: 'follow', target: 'hero' }, {}, { gearGranted: true })).toContain('__updateGearLines();');
    expect(controllableChannelScript(pilot, { rule: 'follow', target: 'hero' }, {}, {})).not.toContain('__updateGearLines');
  }, 120_000);

  it('a power\'s move is one the hero can be given', () => {
    expect(() => readActions({ powers: [{ id: 'gust-step', verb: 'dash', move: 'teleport' }] })).toThrow(/move is one of 'double-jump', 'glide', 'high-jump'/);
    expect(readActions({ powers: [{ id: 'gust-step', verb: 'dash', move: 'glide' }] }).powers[0].move).toBe('glide');
  });
});
