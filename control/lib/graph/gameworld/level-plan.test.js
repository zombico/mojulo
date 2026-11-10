import { describe, it, expect } from 'vitest';
import { beatPlan, stagePlan, unwalked, walkReport } from './level-plan.js';

// The level's plan (level-plan.js): a level checked on paper before anything walks it. A beat that is one boss alone is
// a duel; a beat that fields foes is played on a level that stands them; a stage lays a win that can be reached; a win
// the walk does not play is said, not judged. One case per procedure, the smallest world that shows it.

const trail = { walk: { nodes: { a: { trail: true } } } };
const FOES = { ronin: { class: 'patrol' }, warlord: { class: 'stalker', rank: 'boss' } };
const quest = (beats) => ({ acts: [{ id: 'one', goal: 'cross and end it', beats }] });
const world = (levels, beats) => ({ id: 'w', levels, foes: FOES, mainQuest: quest(beats) });

describe("a beat's plan", () => {
  it('is clean when the level lays what the beat says, and for a world with no quest', () => {
    expect(beatPlan({ id: 'w', levels: { yard: trail } })).toEqual([]);
    const W = world({ street: { ...trail, foes: { from: ['ronin'] } }, roof: { ...trail, foes: { from: ['warlord'], count: 1, win: 'clear' } } },
      [{ id: 'the-street', goal: 'cross the street', as: { level: 'street' }, foes: ['ronin'] }, { id: 'the-roof', goal: 'duel the warlord', as: { level: 'roof' }, foes: ['warlord'] }]);
    expect(beatPlan(W)).toEqual([]);
  });

  it('says a beat that is one boss alone is a duel: one stood, won by clearing it, and offers the write', () => {
    // (the level a quest laid by itself: its boss on every free beat, won at its exit)
    const W = world({ roof: { ...trail, foes: { from: ['warlord'] } } }, [{ id: 'the-roof', goal: 'duel the warlord', as: { level: 'roof' }, foes: ['warlord'] }]);
    const [found, ...rest] = beatPlan(W);
    expect(rest).toEqual([]);
    expect(found).toMatchObject({ beat: 'the-roof', level: 'roof' });
    expect(found.says).toMatch(/one boss alone \('warlord'\).*one on each free beat.*won by its exit.*a duel stands one and is won by clearing it/);
    expect(found.patch).toEqual([{ op: 'set', path: '/levels/roof/foes', value: { from: ['warlord'], count: 1, win: 'clear' } }]);
  });

  it('says a beat that fields foes on a level that stands none of them, and offers them kept beside what stands', () => {
    const bare = world({ gate: trail }, [{ id: 'the-gate', goal: 'cross the gate', as: { level: 'gate' }, foes: ['ronin'] }]);
    expect(beatPlan(bare)).toEqual([{ beat: 'the-gate', level: 'gate', says: "beat 'the-gate' fields ronin: level 'gate' stands no foes", patch: [{ op: 'set', path: '/levels/gate/foes', value: { from: ['ronin'] } }] }]);
    const other = world({ gate: { ...trail, foes: { from: ['warlord'], count: 2 } } }, [{ id: 'the-gate', goal: 'cross the gate', as: { level: 'gate' }, foes: ['ronin'] }]);
    expect(beatPlan(other)[0].patch[0].value).toEqual({ from: ['warlord', 'ronin'], count: 2 });
    // the whole bestiary stood (`foes: true`) fields every beat's
    expect(beatPlan(world({ gate: { ...trail, foes: true } }, [{ id: 'the-gate', goal: 'cross the gate', as: { level: 'gate' }, foes: ['ronin'] }]))).toEqual([]);
  });

  it('leaves alone a beat planned, a beat with no foes, and a beat whose level a run has yet to lay', () => {
    expect(beatPlan(world({ gate: trail }, [{ id: 'the-gate', goal: 'cross the gate', as: { level: 'gate' } }]))).toEqual([]);
    expect(beatPlan(world({ gate: trail }, [{ id: 'later', goal: 'duel the warlord', foes: ['warlord'], built: false }]))).toEqual([]);
    expect(beatPlan(world({ gate: trail }, [{ id: 'unlaid', goal: 'duel the warlord', foes: ['warlord'] }]))).toEqual([]);
  });
});

const stage = (key, mechanics, entities = []) => ({ key, ref: `w-${key}`, order: { manifest: { kind: 'stage', entities, ...(mechanics ? { game: { mechanics: mechanics.map((kind) => ({ kind })) } } : {}) } } });

describe("a stage's plan", () => {
  it('is clean for a stage with a win it can reach, and for a place with no contract', () => {
    expect(stagePlan([stage('level-yard-0', ['fail-on-death', 'reach-exit']), stage('level-roof-0', ['defeat-all'], [{ id: 'foe-warlord-1' }]), stage('level-square-0', null), { key: 'game', ref: 'w-game' }])).toEqual([]);
  });

  it('says a stage that lays no win, and one won by clearing it with nothing stood', () => {
    expect(stagePlan([stage('level-yard-0', ['fail-on-death'])])).toEqual([{ level: 'yard', step: 'level-yard-0', says: "stage 'level-yard-0' lays no win: nothing ends it (fail-on-death)" }]);
    expect(stagePlan([stage('level-roof-0', ['defeat-all'], [{ id: 'hero' }])])).toEqual([{ level: 'roof', step: 'level-roof-0', says: "stage 'level-roof-0' is won by clearing it, with nothing stood to clear" }]);
  });
});

describe('what the walk cannot prove', () => {
  it('is said with its reason, and is not a fault of the plan', () => {
    const steps = [stage('level-yard-0', ['fail-on-death', 'reach-exit']), stage('level-roof-0', ['fail-on-death', 'defeat-all'], [{ id: 'foe-warlord-1' }])];
    expect(stagePlan(steps)).toEqual([]);
    const not = unwalked(steps);
    expect(not.map((x) => x.step)).toEqual(['level-yard-0', 'level-roof-0']);
    expect(not[1]).toMatchObject({ level: 'roof' });
    expect(not[1].why).toMatch(/it carries fail-on-death, defeat-all: the walk proves a level of reach-exit.*alone; this one is the creator's to play/);
    expect(unwalked([stage('level-yard-0', ['reach-exit'])])).toEqual([]);
  });
});

describe('why no level is walked', () => {
  it('is nothing when the plan is clean and every stage can be walked', () => {
    expect(walkReport({ id: 'w', levels: { yard: trail } }, [stage('level-yard-0', ['reach-exit'])])).toBeNull();
  });

  it('is the plan (its patches left out) and the stages the walk cannot prove', () => {
    const W = world({ roof: { ...trail, foes: { from: ['warlord'] } } }, [{ id: 'the-roof', goal: 'duel the warlord', as: { level: 'roof' }, foes: ['warlord'] }]);
    const R = walkReport(W, [stage('level-roof-0', ['fail-on-death', 'reach-exit'], [{ id: 'foe-warlord-1' }])]);
    expect(R.plan).toHaveLength(1);
    expect(R.plan[0]).toEqual({ beat: 'the-roof', level: 'roof', says: expect.stringMatching(/a duel stands one/) });
    expect(R.unwalked).toHaveLength(1);
  });
});
