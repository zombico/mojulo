// A level held as a wave gauntlet (gauntlet.js, gauntlet-cast.js; a level goal's `gauntlet`). The laws: it reads and
// refuses like any level goal (the bestiary's foes, counts from 1, never beside a boss or health, a walk's for now);
// on the level's last stage it lays the wave-gauntlet mechanic in place of the exit, its waves the foes the cast stands
// asleep at the same places under the same names; those foes are fielded, so the run makes them; played on the bus,
// each wave wakes after the last is down and the way out opens after the last.
import { describe, it, expect } from 'vitest';
import { MEADOWMARK } from './examples.js';
import { readGameworld } from './world.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { levelGoalMechanics } from './quick.js';
import { gauntletPlacements, gauntletLaws, GAUNTLET_LAWS, readGauntletGoal, DEFAULT_GAUNTLET, DEFAULT_HOLDOUT } from './gauntlet.js';
import { gauntletPage } from './gauntlet-page.js';
import { proveGauntlets, lastStageManifests } from './gauntlet-proof.js';
import { esc } from './bible-html.js';
import { composeGameworld } from './compose.js';
import { gauntletCast } from './gauntlet-cast.js';
import { fieldedIds } from './foes.js';
import { runSteps } from './runner.js';
import { composeMechanics } from '../game/mechanics.js';
import { buildBus } from '../worlds/event-bus.js';

const { review, ...base } = MEADOWMARK;
const GOAL = { arenas: [{ waves: [{ walker: 2 }, { walker: 1, hunter: 1 }] }, { waves: [{ hunter: 2 }] }], checkpoint: 1 };
const W = { ...base, links: [], levels: { lift: { name: 'The lift', seed: 8, walk: { nodes: { shaft: { trail: true } } }, goal: { gauntlet: GOAL } } } };
const G = readGameworld(W), [stage] = gameStages(W);
const L = stageLevelOrder(G, stage, { ref: 'lv_lift', goal: (ends) => levelGoalMechanics(G.levels.lift.goal, ends, { last: true }), extra: (ends) => gauntletCast(G, 'lift', ends, { refs: { walker: 'r-walker', hunter: 'r-hunter' }, hero: false }) });
const M = L.args.manifest, mech = M.game.mechanics.find((m) => m.kind === 'wave-gauntlet');

describe('a level goal held as a wave gauntlet', () => {
  it('reads to its arenas and its room, and refuses what it cannot be', () => {
    expect(G.levels.lift.goal.gauntlet).toEqual({ ...GOAL, room: 'lift' });
    const withGoal = (goal, extra = {}) => ({ ...W, levels: { lift: { ...W.levels.lift, goal, ...extra } } });
    expect(() => readGameworld(withGoal({ gauntlet: { arenas: [{ waves: [{ dragon: 1 }] }] } }))).toThrow(/'dragon' is not in the bestiary/);
    expect(() => readGameworld(withGoal({ gauntlet: { arenas: [{ waves: [{ walker: 0 }] }] } }))).toThrow(/walker is how many/);
    expect(() => readGameworld(withGoal({ gauntlet: GOAL, health: true }))).toThrow(/no boss or health beside it/);
    expect(() => readGameworld(withGoal({ gauntlet: GOAL, escape: true }))).toThrow(/escape room's way out ends the level, and so does a gauntlet's last wave/);
    expect(() => readGameworld({ ...W, levels: { lift: { name: 'Inn', building: { use: 'tavern' }, goal: { gauntlet: GOAL } } } })).toThrow(/a building's arena is to come/);
  });

  it('on its last stage: the mechanic in place of the exit, its waves the foes the cast stands asleep', () => {
    expect(M.game.mechanics.map((m) => m.kind)).not.toContain('reach-exit');
    expect(mech).toMatchObject({ id: 'lift', at: L.ends.exit, checkpoint: 1 });
    expect(mech.arenas.map((A) => A.waves.map((w) => w.foes.map((f) => f.id)))).toEqual([
      [['foe-walker-g1', 'foe-walker-g2'], ['foe-walker-g3', 'foe-hunter-g1']],
      [['foe-hunter-g2', 'foe-hunter-g3']],
    ]);
    const asleep = M.entities.filter((e) => /^foe-.*-g\d+$/.test(e.id));
    expect(asleep).toHaveLength(6);
    expect(asleep.every((e) => e.dormant === true && e.body.hittable)).toBe(true);
    // the same places the mechanic wakes them at
    const at = Object.fromEntries(mech.arenas.flatMap((A) => A.waves.flatMap((w) => w.foes)).map((f) => [f.id, f.at]));
    for (const e of asleep) expect(e.transform.pos).toEqual(at[e.id]);
    expect(gauntletPlacements(G.levels.lift.goal.gauntlet, L.ends).waves.flat().map((p) => p.id).sort()).toEqual(asleep.map((e) => e.id).sort());
    // the gauntlet's foes are fielded: the run makes their figures
    expect(fieldedIds(G)).toEqual(expect.arrayContaining(['walker', 'hunter']));
  });

  it('played on the bus: each wave after the last is down, the way out opened after the last', () => {
    const B = buildBus(), c = composeMechanics(M.game.mechanics, { player: 'player', spawn: L.ends.spawn, fall: 'none' }), ev = c.events;
    const s = B.createBusState(ev, ev.entities), woke = [];
    const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } for (const o of s._ctrlOps ?? []) if (o.op === 'spawn') woke.push(o.who); s._ctrlOps = []; };
    const wait = (secs) => { for (let k = 0; k < secs * 10; k++) { pump(B.tickTimers(s, 0.1)); pump(B.stepTime(s, 0.1)); } };
    const down = (...ids) => pump(ids.map((id) => ({ type: 'down', entity: id })));
    pump(ev.initial); wait(1.5);
    expect(woke).toEqual(['foe-walker-g1', 'foe-walker-g2']);
    down('foe-walker-g1', 'foe-walker-g2'); wait(2.5);
    down('foe-walker-g3', 'foe-hunter-g1'); wait(4.5);
    down('foe-hunter-g2', 'foe-hunter-g3');
    expect(woke).toHaveLength(6);
    expect(s.log.map((r) => r.type)).toContain('gauntlet:clear:lift');
    expect(s.byId['lift-seal'].on).toBe(false);
  });

  it('the run makes it: the foes\' figures first, the level with its gauntlet asleep', () => {
    const S = runSteps(W, { ref: 'gw' });
    expect(S.map((s) => s.key)).toEqual(expect.arrayContaining(['foes-walker', 'foes-hunter', 'level-lift-0']));
    const lv = S.find((s) => s.key === 'level-lift-0').order.manifest;
    expect(lv.game.mechanics.some((m) => m.kind === 'wave-gauntlet')).toBe(true);
    expect(lv.entities.filter((e) => e.dormant && /-g\d+$/.test(e.id))).toHaveLength(6);
  }, 300000);
});

describe('its laws, its book and its word', () => {
  it('laws: escalates, breathes, varied, checkpointed — each holding, each advising when it fails', () => {
    const read = (g) => readGauntletGoal(g, 'x', null);
    // (this file's own lift advises: its second arena wakes 2 after the first's 4)
    expect(gauntletLaws(G.levels.lift.goal.gauntlet).find((l) => l.law === 'escalates')).toMatchObject({ holds: false, says: 'arena 2 (2 after 4): lighter than before' });
    const ok = gauntletLaws(read(DEFAULT_GAUNTLET));
    expect(ok.map((l) => l.law)).toEqual(Object.keys(GAUNTLET_LAWS));
    for (const l of ok) expect(l.holds, `${l.law}: ${l.says}`).toBe(true);
    const fail = (g, law) => expect(gauntletLaws(read(g)).find((l) => l.law === law)).toMatchObject({ holds: false });
    fail({ arenas: [{ waves: [{ walker: 3 }, { walker: 1 }] }] }, 'escalates');
    fail({ arenas: [{ waves: [{ walker: 3 }] }, { waves: [{ walker: 1 }] }] }, 'escalates');
    fail({ arenas: [{ waves: [{ walker: 1 }] }, { waves: [{ walker: 1 }], after: 0.5 }] }, 'breathes');
    fail({ arenas: Array.from({ length: 3 }, () => ({ waves: [{ walker: 2 }] })) }, 'varied');
    fail({ arenas: Array.from({ length: 11 }, (_, i) => ({ waves: [{ walker: 1 + i }] })) }, 'checkpointed');
    expect(gauntletLaws(read({ arenas: Array.from({ length: 11 }, (_, i) => ({ waves: [{ walker: 1 + i }] })), checkpoint: 10 })).find((l) => l.law === 'checkpointed').holds).toBe(true);
  });

  it('the book draws its grid, arenas by waves, each cell its mix, the checkpoints marked, its laws; none, nothing', () => {
    const html = gauntletPage(G, esc);
    expect(html).toMatch(/The wave gauntlets/);
    expect(html).toMatch(/2 arenas × 3 waves/);
    expect(html).toMatch(/1 walker \+ 1 hunter/);
    expect((html.match(/checkpoint<\/span>/g) ?? []).length).toBe(2);
    expect(html).toMatch(/escalates/);
    expect(gauntletPage(readGameworld(MEADOWMARK), esc)).toBe('');
  });

  it("a horde in the prompt holds the last level a boss does not end, a trail with no climb and no health beside it", () => {
    const w = composeGameworld({ prompt: 'a horde in a haunted forest with health', seed: 1 });
    const ids = Object.keys(w.levels), last = w.levels[ids.at(-1)];
    expect(w.brief.read.find((r) => r.word === 'horde').decides).toEqual(['goal.gauntlet']);
    expect(last.goal.gauntlet).toEqual({ arenas: DEFAULT_GAUNTLET.arenas });
    expect(last.goal.health).toBeUndefined();
    expect(Object.values(last.walk.nodes).every((n) => !n.meru)).toBe(true);
    for (const id of ids.slice(0, -1)) expect(w.levels[id].goal).toEqual({ health: true });
    for (const l of gauntletLaws(readGameworld(w).levels[ids.at(-1)].goal.gauntlet)) expect(l.holds, l.law).toBe(true);
    const bossed = composeGameworld({ prompt: 'a horde and a boss in a haunted forest', seed: 1 });
    expect(Object.values(bossed.levels).some((l) => l.goal?.gauntlet)).toBe(false);
  });
});

describe('the gauntlet proved on the bus (machine gate)', () => {
  it('every wave woke in order, each after the last was down, the seal lifted and the level won; the falls given', () => {
    const [P] = proveGauntlets(W, { lift: M });
    expect(P).toMatchObject({ level: 'lift', proved: true, assumed: ["every foe's fall is given as it wakes (the proof cannot fight)"] });
    expect(P.woke).toEqual([['foe-walker-g1', 'foe-walker-g2'], ['foe-walker-g3', 'foe-hunter-g1'], ['foe-hunter-g2', 'foe-hunter-g3']]);
    expect(proveGauntlets(W, {})[0]).toMatchObject({ proved: false, says: 'no stage made for it' });
    expect(proveGauntlets(MEADOWMARK, {})).toBeNull();
    expect(lastStageManifests([{ key: 'level-lift-0', order: { manifest: M } }, { key: 'game', order: {} }])).toEqual({ lift: M });
  });
});

describe('a gauntlet to endure, as a level goal', () => {
  const HOLD = { arenas: [{ waves: [{ walker: 3 }, { walker: 3, charger: 1 }, { walker: 4, charger: 1 }] }], pace: 'timed', every: 15, outlast: 60 };
  const W2 = { ...W, levels: { lift: { ...W.levels.lift, goal: { gauntlet: HOLD } } } };
  const G2 = readGameworld(W2);
  const L2 = stageLevelOrder(G2, gameStages(W2)[0], { ref: 'lv_lift', goal: (ends) => levelGoalMechanics(G2.levels.lift.goal, ends, { last: true }), extra: (ends) => gauntletCast(G2, 'lift', ends, { refs: {}, hero: false }) });
  it('reads its pace, clock and outlast; lays them on the mechanic; refuses checkpoints on it', () => {
    expect(G2.levels.lift.goal.gauntlet).toMatchObject({ pace: 'timed', every: 15, outlast: 60 });
    expect(L2.args.manifest.game.mechanics.find((m) => m.kind === 'wave-gauntlet')).toMatchObject({ pace: 'timed', every: 15, win: { outlast: 60 } });
    expect(() => readGameworld({ ...W, levels: { lift: { ...W.levels.lift, goal: { gauntlet: { ...HOLD, checkpoint: 2 } } } } })).toThrow(/no checkpoints/);
    expect(() => readGameworld({ ...W, levels: { lift: { ...W.levels.lift, goal: { gauntlet: { ...HOLD, pace: 'slow' } } } } })).toThrow(/pace is/);
  });

  it('its laws: bounded advises when timed waves stack past the cap; the book says when each wave comes', () => {
    expect(gauntletLaws(G2.levels.lift.goal.gauntlet).find((l) => l.law === 'bounded')).toMatchObject({ holds: true });
    const crowded = readGauntletGoal({ arenas: [{ waves: [{ walker: 9 }, { walker: 9 }] }], pace: 'timed', every: 10 }, 'x', null);
    expect(gauntletLaws(crowded).find((l) => l.law === 'bounded')).toMatchObject({ holds: false, says: expect.stringMatching(/^18 woken within thirty seconds/) });
    const html = gauntletPage(G2, esc);
    expect(html).toMatch(/To endure: sealed in its last stage until 60 s have passed; a wave every 15 s/);
    expect(html).toMatch(/@16 s/);
  });

  it('proved on the bus: each wave on the clock, the falls given, the clock outlasted, the way out won', () => {
    const [P] = proveGauntlets(W2, { lift: L2.args.manifest });
    expect(P).toMatchObject({ level: 'lift', proved: true });
    expect(P.woke).toHaveLength(3);
  });

  it("a holdout in the prompt: the default to endure on the last level", () => {
    const w = composeGameworld({ prompt: 'a holdout in a haunted forest', seed: 1 });
    expect(w.levels[Object.keys(w.levels).at(-1)].goal.gauntlet).toEqual({ ...DEFAULT_HOLDOUT });
    for (const l of gauntletLaws(readGauntletGoal(DEFAULT_HOLDOUT, 'x', null))) expect(l.holds, l.law).toBe(true);
  });
});
