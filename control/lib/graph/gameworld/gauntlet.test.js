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
import { gauntletPlacements } from './gauntlet.js';
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
