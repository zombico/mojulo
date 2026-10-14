import { describe, it, expect } from 'vitest';
import { quickWorld, goalMechanics, farmCast, shootCast, raceCast, RACE } from './quick.js';
import { resolveLevel, readGameworld } from './world.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { concernLaws, SPACING, DRIVABLE, LOOP, LOOP_TUNE, ARENA, beatPosts, coverBlocks, blindSpots, askBoxes, jumpHeight, arenaLayout } from './lay-concerns.js';
import { guardPosts, defendCast, QUICK_GUARD } from './quick.js';
import { stageEnds } from './levels.js';
import { standBlocks } from '../playscape/terrain.js';
import { composeLive } from '../worlds/controllable/compose.js';
import { simLevel } from '../game/level-sim.js';
import { composeMechanics } from '../game/mechanics.js';
import { rideRule } from './ride.js';

// THE CONCERNS LAID: the world is laid for what game it is, before any goal reads it. The ground first (a field made
// level beside the start; a vehicle's ground eased), then the stage (the field where the plots go; a race's checkpoints
// spaced; cover by the fighting posts), and the laws measure what was laid.

const quick = (q, extra = {}) => quickWorld({ id: 'w', quick: { ...q }, ...extra });
const order = (W, q, extra, more = {}) => {
  const G = readGameworld(W), s = gameStages(W)[0];
  return stageLevelOrder(G, s, { ref: 'x', goal: (ends) => goalMechanics(q, ends), ...(extra ? { extra } : {}), ...more });
};

describe('the ground laid for the game', () => {
  it('a farm\'s field is flattened beside the start, after the creator\'s own edits; its stage carries where', () => {
    const W = quick({ goal: 'farm' });
    const R = resolveLevel(W, 'run');
    expect(R.laid).toEqual(['fields']);
    expect(R.level.ground.edits).toEqual([{ op: 'flatten', at: expect.stringMatching(/^[A-Z]2:[A-Z]3$/), id: 'intent-fields' }]);
    const own = quick({ goal: 'farm' }), ownEdit = { op: 'raise', at: 'A9', height: 2 };
    own.levels.run.ground = { edits: [ownEdit] };
    expect(resolveLevel(own, 'run').level.ground.edits[0]).toEqual(ownEdit);
    expect(gameStages(W)[0].field).toEqual(R.field);
  });
  it('a car\'s ground is eased under the level\'s own dials', () => {
    const W = quick({ goal: 'race', ride: 'car' });
    expect(resolveLevel(W, 'run').level.ground.tune).toEqual(DRIVABLE);
    W.levels.run.ground = { tune: { amplitude: 5 } };
    expect(resolveLevel(W, 'run').level.ground.tune.amplitude).toBe(5);
  });
  it('a race against rivals lays a loop on the longest trail: the land flattened under it, its walk laid flat', () => {
    const W = quick({ goal: 'race', ride: 'coupe', rivals: 3 }), R = resolveLevel(W, 'run');
    expect(W.levels.run.walk.nodes.path.trail).toEqual({ run: RACE.run, beats: RACE.beats });
    expect(R.laid).toEqual(['drivable', 'loop']);
    expect(R.level.ground.tune).toEqual({ ...DRIVABLE, ...LOOP_TUNE });
    expect(R.level.ground.edits).toEqual([{ op: 'flatten', at: expect.stringMatching(/^[A-Z]1:[A-Z]\d+$/), id: 'intent-loop' }]);
    expect(R.loop.line[0]).toEqual(R.loop.start);
    expect(R.loop.length).toBeGreaterThan(250);
    expect(gameStages(W)[0].loop).toEqual(R.loop);
    // a trail race, or a loop asked for by name
    expect(resolveLevel(quick({ goal: 'race', ride: 'coupe', rivals: 3, track: 'trail' }), 'run').laid).toEqual(['drivable']);
    expect(resolveLevel(quick({ goal: 'race', track: 'loop' }), 'run').laid).toEqual(['drivable', 'loop']);
  });
  it('a world whose game lays nothing on the ground is as it was', () => {
    for (const W of [quick({ goal: 'reach' }), quick({ goal: 'shoot' }), quickWorld({ id: 'w', quick: { goal: 'collect' } })]) {
      const R = resolveLevel(W, 'run');
      expect(R.laid).toBeUndefined();
      expect(R.level.ground).toBeUndefined();
    }
  });
});

describe('the stage laid for the game, and its laws', () => {
  it('the farm\'s plots lie on the field the ground was made level for: the law holds', () => {
    const q = { goal: 'farm' }, W = quick(q), L = order(W, q, (ends) => farmCast(q, ends, 'fig'));
    expect(L.laws).toEqual([{ concern: 'fields', law: 'plots-level', holds: true, says: expect.any(String) }]);
    const crops = L.args.manifest.game.mechanics.find((m) => m.kind === 'crops');
    const field = resolveLevel(W, 'run').field, mid = crops.plots.reduce((a, p) => [a[0] + p.at[0] / crops.plots.length, a[1] + p.at[1] / crops.plots.length], [0, 0]);
    expect(Math.hypot(mid[0] - field[0], mid[1] - field[1])).toBeLessThan(4);
  });
  it('a race\'s checkpoints keep their spacing; with a car, its grade is drivable', () => {
    const q = { goal: 'race', ride: 'car' }, L = order(quick(q), q);
    const laws = Object.fromEntries(L.laws.map((l) => [l.law, l.holds]));
    expect(laws).toEqual({ 'checkpoints-spaced': true, 'grade-drivable': true });
  });
  it('a race round a loop: checkpoints come round to its start, the rivals on the grid ahead, the laws hold', () => {
    const q = { goal: 'race', ride: 'coupe', rivals: 3 }, ride = { ref: 'r', rule: rideRule('coupe', 1) };
    const L = order(quick(q), q, (ends) => raceCast(q, ends, ride), { ride });
    expect(L.laws.filter((l) => !l.holds)).toEqual([]);
    expect(L.laws.filter((l) => l.concern === 'loop').map((l) => l.law)).toEqual(['loop-on-the-land', 'loop-grade', 'loop-clear', 'finish-at-the-start']);
    const m = L.args.manifest, laps = m.game.mechanics[0];
    expect(laps).toMatchObject({ kind: 'laps', laps: RACE.laps, rivals: ['rival-1', 'rival-2', 'rival-3'], win: 2 });
    expect(laps.checkpoints.length).toBeGreaterThanOrEqual(8);
    expect(m.entities.map((e) => [e.id, e.rule.type])).toEqual([['car', 'drive'], ['rival-1', 'racer'], ['rival-2', 'racer'], ['rival-3', 'racer']]);
    // the player last on the grid; the wall down the middle
    const start = L.ends.loop.start, back = (e) => start[1] - e.transform.pos[1];
    expect(back(m.entities[0])).toBeGreaterThan(Math.max(...m.entities.slice(1).map(back)) - 1e-9);
    expect(m.blocks).toEqual([expect.objectContaining({ form: 'wall', length: L.ends.loop.median.length })]);
    expect(LOOP.width).toBe(8);
  });
  it('the rivals drive the loop on the stage\'s own land, lap after lap, and the race is placed', () => {
    const q = { goal: 'race', ride: 'coupe', rivals: 2, laps: 1 }, ride = { ref: 'r', rule: rideRule('coupe', 1) };
    const W = quick(q), st = gameStages(W)[0], ends = stageEnds(st.manifest);
    const L = stageLevelOrder(readGameworld(W), st, { ref: 'x', goal: (e) => goalMechanics(q, e), ride, extra: (e) => raceCast(q, e, ride) });
    const m = L.args.manifest, mech = composeMechanics(m.game.mechanics, { player: 'car' });
    const S = simLevel({ entities: m.entities.map((e) => ({ ...e, body: { type: 'none' } })), events: mech.events, colliders: [...ends.colliders, ...standBlocks(m.blocks).colliders] }, { ground: (p) => ends.surface(p[0], p[1]) ?? 0 });
    S.run(30);
    // the player sat still: both rivals over the line, round, and over it again; the player third
    expect(S.world.byId['rival-1'].laps).toBeGreaterThanOrEqual(2);
    expect(S.world.byId['rival-2'].laps).toBeGreaterThanOrEqual(2);
    expect(S.bus.vars.__place_0).toBe(3);
    expect(S.bus.log.some((r) => r.type === 'laps:done')).toBe(false);
  });
  it('a shooter\'s foes each have cover by them, from the world\'s cover concern', () => {
    const q = { goal: 'shoot', foes: 3 }, L = order(quick(q), q, (ends) => shootCast(q, ends, 'fig'));
    // the shooter's foes see (mind.perception): their approaches get a place out of sight too
    expect(L.laws).toEqual([
      { concern: 'watchers', law: 'a-blind-spot-on-every-approach', holds: true, says: 'a place out of sight on the way to each of 3' },
      { concern: 'cover', law: 'cover-by-every-post', holds: true, says: 'cover by all 3 posts' },
    ]);
    expect(L.args.manifest.blocks.filter((b) => b.form === 'wall').length).toBe(3 * 2 + 3);
  });
  it('a ranged game without a shooter\'s goal gets cover at its beats too (raised by the value, not the goal)', () => {
    const W = quick({ goal: 'reach' }, { intent: { cube: { power: { combat: ['ranged'] } } } });
    const L = order(W, { goal: 'reach' });
    expect(L.args.manifest.blocks.length).toBeGreaterThan(0);
    expect(L.laws[0]).toMatchObject({ concern: 'cover', holds: true });
  });
  it('a sneak\'s guards each have a place out of sight on their approach, and a walker waiting there is not seen', () => {
    const q = { goal: 'sneak', guards: 2 }, W = quick(q), G = readGameworld(W), st = gameStages(W)[0];
    const L = stageLevelOrder(G, st, { ref: 'x', goal: (ends) => goalMechanics(q, ends), guards: { ref: 'fig', posts: (ends) => guardPosts(q, ends) } });
    expect(L.laws).toEqual([{ concern: 'watchers', law: 'a-blind-spot-on-every-approach', holds: true, says: 'a place out of sight on the way to each of 2' }]);
    // in the world: the first guard, looking down its approach, and a walker standing in its blind spot
    const ends = stageEnds(st.manifest), post = guardPosts(q, ends)[0], blocks = L.args.manifest.blocks;
    const spot = blindSpots(post, ends, askBoxes(blocks))[0], E = composeLive(), guard = L.args.manifest.entities.find((e) => e.id === 'guard-1');
    const world = (at) => E.createWorld({ colliders: standBlocks(blocks).colliders, entities: [
      { id: 'p', pilotable: true, rule: { type: 'walk', speed: 0, eye: 0, collideHeight: 1.7 }, body: { type: 'none', hittable: true }, transform: { pos: at, heading: 0 } },
      { ...guard, body: { type: 'mesh' } },
    ] });
    const seen = (at) => { const w = world(at); for (let i = 0; i < 90; i++) E.stepWorld(w, {}, 1 / 30, { ground: (p) => ends.ground(p[0], p[1]) ?? 0 }); return w.byId['guard-1'].sightings || 0; };
    const z = (p) => [p[0], p[1], ends.ground(p[0], p[1]) ?? p[2]];
    expect(seen(z(spot))).toBe(0);
    expect(seen(z([post.at[0] - post.from[0] * 6, post.at[1] - post.from[1] * 6]))).toBeGreaterThan(0);
  });
  it('a defence\'s pads stand beside its road on land level with it; the road is long enough to fight along', () => {
    const q = { goal: 'defend', waves: 1 }, L = order(quick(q), q, (ends) => defendCast(q, ends, { foe: 'f', tower: 't' }));
    expect(Object.fromEntries(L.laws.map((l) => [l.law, l.holds]))).toEqual({ 'road-long-enough': true, 'pads-beside-the-road': true });
  });
  it('a puzzle\'s board is flattened further on, its grid laid on it, level', () => {
    const W = quick({ goal: 'puzzle' }), R = resolveLevel(W, 'run');
    expect(R.laid).toEqual(['board']);
    expect(R.level.ground.edits).toEqual([{ op: 'flatten', at: expect.stringMatching(/^[A-Z]5:[A-Z]7$/), id: 'intent-board' }]);
    const L = order(W, { goal: 'puzzle' }), push = L.args.manifest.game.mechanics.find((m) => m.kind === 'push');
    expect(L.laws).toEqual([{ concern: 'board', law: 'board-level', holds: true, says: expect.any(String) }]);
    const mid = [push.origin[0] + 6.25, push.origin[1] + 6.25];
    expect(Math.hypot(mid[0] - R.board[0], mid[1] - R.board[1])).toBeLessThan(1);
  });
  it('a hero that jumps finds every other pickup on steps within its jump, and climbs to it', () => {
    const q = { goal: 'collect', hero: { cast: 'female' } }, L = order(quick(q), q, null, { heroRef: 'h' });
    const pk = L.args.manifest.game.mechanics.find((m) => m.kind === 'collect').pickups;
    expect(pk.filter((p) => p.planar === false).length).toBe(Math.floor(pk.length / 2));
    expect(L.laws).toEqual([{ concern: 'reachable', law: 'within-a-jump', holds: true, says: expect.stringMatching(/^all \d+ raised pickups within a 1\.06 m jump$/) }]);
    // a first-person walker does not jump: nothing is raised for it
    const flat = order(quick({ goal: 'collect' }), { goal: 'collect' });
    expect(flat.args.manifest.game.mechanics[0].pickups.every((p) => p.planar !== false)).toBe(true);
    // in the world: the hero jumps onto the low crate, then the stack, and stands within the pickup's reach
    const E = composeLive(), hero = L.args.manifest.entities[0], blocks = L.args.manifest.blocks, target = pk.find((p) => p.planar === false);
    const ends = stageEnds(gameStages(quick(q))[0].manifest), ground = (p) => ends.ground(p[0], p[1]) ?? 0;
    const low = blocks.find((b) => b.form === 'crate' && !b.stack && Math.hypot(b.at[0] - target.at[0], b.at[1] - target.at[1]) < 2);
    const back = [low.at[0] * 2 - target.at[0], low.at[1] * 2 - target.at[1]];
    const w = E.createWorld({ colliders: standBlocks(blocks).colliders, entities: [{ ...hero, body: { type: 'none' }, transform: { pos: [back[0], back[1], ground(back) + 0.05], heading: Math.atan2(target.at[1] - back[1], target.at[0] - back[0]) } }] });
    let top = 0;
    for (let i = 0; i < 150; i++) { E.stepWorld(w, { forward: 1, strafe: 0, turn: 0, lookDX: 0, lookDY: 0, jump: i % 20 < 2 ? 1 : 0, jumpHeld: i % 20 < 8 ? 1 : 0 }, 1 / 30, { ground }); top = Math.max(top, w.byId.hero.transform.pos[2] - ground(target.at)); }
    expect(top).toBeGreaterThan(1.2);
    expect(jumpHeight(hero.rule)).toBeCloseTo(1.056, 2);
  });
  it('the laws break on a level laid against them, and say where', () => {
    const ends = { spawn: [0, 0, 0], exit: [0, 60, 0], beats: [{ beat: 'reveal', at: [0, 20, 0] }, { beat: 'pocket', at: [0, 40, 12] }], ground: () => 0 };
    const posts = beatPosts(ends);
    expect(concernLaws(['cover'], { ends, blocks: [], posts })[0]).toMatchObject({ holds: false, says: 'no cover within 4.5 m of post-1, post-2' });
    expect(concernLaws(['reachable'], { ends, raised: [{ at: [0, 0, 3], rises: [1.4, 0.8], above: 0.8 }], jump: 1.06 })[0]).toMatchObject({ holds: false, says: '1 of 1 raised pickups need more than a 1.06 m jump' });
    expect(concernLaws(['road-to-base'], { ends, pads: [[0, 20, 0]], mechanics: [{ kind: 'waves', path: [[0, 0], [0, 20]] }] }).map((l) => l.holds)).toEqual([false, false]);
    expect(concernLaws(['watchers'], { ends, blocks: [], watchers: posts })[0]).toMatchObject({ holds: false, says: 'nowhere on the way to post-1, post-2 is out of its sight' });
    expect(concernLaws(['cover'], { ends, blocks: coverBlocks(posts, ends), posts })[0].holds).toBe(true);
    const laps = { kind: 'laps', checkpoints: [{ at: [0, 5, 0] }, { at: [0, 60, 0] }] };
    expect(concernLaws(['circuit'], { ends, mechanics: [laps] })[0]).toMatchObject({ holds: false, says: `the shortest leg is 5.0 m (${SPACING} wanted)` });
    expect(concernLaws(['drivable'], { ends })[0]).toMatchObject({ holds: false, says: 'the steepest leg climbs 60% (25% at most)' });
    expect(concernLaws(['fields'], { ends, mechanics: [{ kind: 'crops', plots: [{ at: [0, 0, 0] }, { at: [2, 0, 1.2] }] }] })[0].holds).toBe(false);
  });
});

// ── the arena (a match's ground): laid on its square, and its laws ─────────────────────────────────────────────────
describe('an arena', () => {
  const A = { centre: [0, 0], half: ARENA.half, z: 0 }, ends = { spawn: [0, 0, 0] };
  const laid = (n = 8) => ({ ...A, ...arenaLayout(A, ends, n) });

  it('stands the same turned half round its centre, each piece one collider, its spawns out of each other\'s sight', () => {
    const L = laid();
    // every piece has its partner at (-u, -v) (the centre wall is its own)
    for (const b of L.blocks) expect(L.blocks.some((o) => o.form === b.form && Math.abs(o.at[0] + b.at[0]) < 1e-6 && Math.abs(o.at[1] + b.at[1]) < 1e-6), JSON.stringify(b.at)).toBe(true);
    expect(standBlocks(L.blocks).colliders).toHaveLength(L.blocks.length);
    expect(L.spawns).toHaveLength(8);
    for (let k = 0; k < 8; k += 2) expect([L.spawns[k][0] + L.spawns[k + 1][0], L.spawns[k][1] + L.spawns[k + 1][1]]).toEqual([0, 0]);
    expect(L.drops.map((d) => d.gives).sort()).toEqual(['ammo', 'ammo', 'health', 'health']);
  });

  it('every law holds on the arena as laid', () => {
    const L = laid();
    const laws = concernLaws(['arena'], { ends, blocks: L.blocks, arena: L });
    expect(laws.map((l) => l.law)).toEqual(['routes-loop', 'spawns-unseen', 'cover-near', 'no-line-across', 'floor-clear']);
    for (const l of laws) expect(l.holds, `${l.law}: ${l.says}`).toBe(true);
  });

  it('says what is wrong with one stripped bare, or walled into halves', () => {
    const L = laid();
    const walls = L.blocks.slice(0, 4);   // the wall round it alone
    const bare = concernLaws(['arena'], { ends, blocks: walls, arena: L });
    expect(bare.find((l) => l.law === 'spawns-unseen').holds).toBe(false);
    expect(bare.find((l) => l.law === 'no-line-across').holds).toBe(false);
    expect(bare.find((l) => l.law === 'cover-near').holds).toBe(false);
    // a wall straight across: the two halves cannot reach each other
    const split = concernLaws(['arena'], { ends, blocks: [...walls, { form: 'wall', at: [0, 0, 0], N: [0, 1], length: 2 * ARENA.half, height: 3, thick: 0.5 }], arena: L });
    expect(split.find((l) => l.law === 'routes-loop')).toMatchObject({ holds: false, says: expect.stringMatching(/cannot reach/) });
    // the stage's own rock on the floor
    const rocky = concernLaws(['arena'], { ends: { ...ends, colliders: [{ min: [3, 3, 0], max: [4, 4, 2], of: 'rock:1' }] }, blocks: L.blocks, arena: L });
    expect(rocky.find((l) => l.law === 'floor-clear').holds).toBe(false);
  });
});
