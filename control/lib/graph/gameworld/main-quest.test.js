import { describe, it, expect } from 'vitest';
import { readMainQuest, mainQuestContext, mainQuestLaws, mainQuestReport, stageOfAct, LAWS } from './main-quest.js';
import { readLoop, loopOf, loopLaws, BODY_VERBS } from './core-loop.js';
import { readGameworld, MEADOWMARK_HERO } from './index.js';
import { FOE_CLASSES } from '../foes/index.js';

// The main quest: a game's acts of beats, each played as one of the book's structures, its laws mapping it into the book
// (the hero's progression stages, the bestiary's ranks). One sound quest over the reference book with a hero, a beat
// played as each kind of structure it can name now, then each law and each refusal one at a time.

const H = MEADOWMARK_HERO, [L1, L2] = Object.keys(H.levels);
const P = H.characters.hero.actions.powers.map((p) => p.id);   // gained early, mid, late in its progression
const FOE = Object.values(FOE_CLASSES)[0].id;
const W = { ...H, foes: { grunt: { class: FOE }, warden: { class: FOE, rank: 'boss' } } };
const C = mainQuestContext(W);
const QUEST = {
  length: 'long',
  periods: [{ id: 'now' }, { id: 'after-the-storm', passage: 'overlay' }],
  acts: [
    { id: 'awakening', goal: 'the hero leaves the meadow', beats: [{ id: 'first-climb', goal: 'climb out of the valley', as: { level: L1 }, gains: [P[0]], foes: ['grunt'] }] },
    { id: 'the-coast', goal: 'the shore and its keep', beats: [
      { id: 'shore', goal: 'cross the shore', as: { level: L2 }, gains: [P[1]], foes: ['grunt'] },
      { id: 'the-keep', goal: 'into the keep', as: { wcd: 'keep' }, built: false },
    ] },
    { id: 'the-storm', period: 'after-the-storm', goal: 'the storm\'s eye', beats: [{ id: 'eye', goal: 'hold the eye', as: { gauntlet: 'storm-arena' }, gains: [P[2]], foes: ['warden'], built: false }] },
  ],
  ending: { beat: 'eye', stakes: 'the valley' },
  sides: { looseness: 'loose' },
};
const laws = (Q, ctx = C) => Object.fromEntries(mainQuestLaws(readMainQuest(Q, ctx), ctx).map((l) => [l.law, l]));
const act = (Q, i, f) => ({ ...Q, acts: Q.acts.map((A, k) => (k === i ? f(structuredClone(A)) : A)) });

describe('the main quest', () => {
  it('a sound quest holds every law: an arc, its powers on the path in their stages, foes rising, acts that vary', () => {
    const L = laws(QUEST);
    // (every law but the chapters' own: this quest is shaped as acts)
    expect(Object.keys(L).sort()).toEqual(LAWS.map((l) => l.law).filter((l) => l !== 'chaptered' && l !== 'turns').sort());
    for (const l of Object.values(L)) expect(l.holds, `${l.law}: ${l.says}`).toBe(true);
    // the report: its acts as stages of the hero's progression, its beats built and planned
    expect(mainQuestReport(readMainQuest(QUEST, C), C)).toMatchObject({ shape: 'acts', beats: 4, built: 2, planned: 2, length: 'long', ending: 'eye', laws: [],
      acts: [{ id: 'awakening', stage: 'early' }, { id: 'the-coast', stage: 'mid', planned: 1 }, { id: 'the-storm', stage: 'late' }] });
  });

  it('an act is a stage of the hero\'s progression by its place among the acts', () => {
    expect([0, 1, 2].map((i) => stageOfAct(i, 3))).toEqual(['early', 'mid', 'late']);
    expect([0, 1, 2, 3].map((i) => stageOfAct(i, 4))).toEqual(['early', 'mid', 'mid', 'late']);
    expect([0, 1, 2, 3, 4].map((i) => stageOfAct(i, 5))).toEqual(['early', 'early', 'mid', 'late', 'late']);
    // the first act is the early game and the last the late, however many there are
    expect([stageOfAct(0, 2), stageOfAct(1, 2)]).toEqual(['early', 'late']);
    expect(stageOfAct(0, 1)).toBe('early');
  });

  it('says each law that does not hold, and why, never refusing', () => {
    // two acts: no middle
    expect(laws({ ...QUEST, acts: QUEST.acts.slice(0, 2), ending: undefined }).arc).toMatchObject({ holds: false, says: expect.stringMatching(/2 acts$/) });
    // a power gained in the wrong act, and one gained nowhere
    const swapped = act(act(QUEST, 0, (A) => { A.beats[0].gains = [P[1]]; return A; }), 1, (A) => { A.beats[0].gains = [P[0]]; return A; });
    expect(laws(swapped)['stage-matches']).toMatchObject({ holds: false, says: expect.stringContaining(`${P[1]} on 'first-climb' (act 1 of 3, early) but its stage is mid`) });
    expect(laws(act(QUEST, 2, (A) => { A.beats[0].gains = []; return A; }))['gained-on-path']).toMatchObject({ holds: false, says: expect.stringContaining(`${P[2]} is gained on no beat`) });
    // the boss before the grunts
    expect(laws(act(QUEST, 0, (A) => { A.beats[0].foes = ['warden']; return A; })).escalates).toMatchObject({ holds: false, says: expect.stringContaining('act 2 fields minions after an act of bosss') });
    // the first beat not made yet; an ending that is not the last beat; an era; two acts played alike
    expect(laws(act(QUEST, 0, (A) => { A.beats[0].built = false; return A; }))['buildable-first'].holds).toBe(false);
    expect(laws({ ...QUEST, ending: { beat: 'shore' } })['ends-last']).toMatchObject({ holds: false, says: expect.stringContaining("the ending is 'shore', the last beat is 'eye'") });
    expect(laws({ ...QUEST, periods: [{ id: 'now' }, { id: 'after-the-storm', passage: 'eras' }] })['periods-drawn']).toMatchObject({ holds: false, says: expect.stringContaining('time.passage=eras') });
    const alike = { ...QUEST, acts: [QUEST.acts[0], { ...QUEST.acts[0], id: 'again', beats: [{ ...QUEST.acts[0].beats[0], id: 'again-climb' }] }, QUEST.acts[2]] };
    expect(laws(alike).varied).toMatchObject({ holds: false, says: expect.stringContaining("'awakening' and 'again'") });
    // a quest written before its powers and its foes: named, said, not refused
    const early = laws(QUEST, mainQuestContext({ ...H, foes: undefined, characters: { ...H.characters, hero: { ...H.characters.hero, actions: undefined } } }));
    expect(early.held).toMatchObject({ holds: false, says: expect.stringContaining(`power ${P[0]}`) });
    // an open quest (no ending) is a quest being built: nothing asks it for one
    expect(laws({ ...QUEST, ending: undefined })['ends-last']).toBeUndefined();
  });

  it('refuses a malformed quest, teaching; a planned beat may name what the world does not hold yet', () => {
    expect(() => readMainQuest({ acts: [] }, C)).toThrow(/acts is .*at least one act/);
    expect(() => readMainQuest({ ...QUEST, plot: 'x' }, C)).toThrow(/mainQuest\.plot is not a setting/);
    expect(() => readMainQuest(act(QUEST, 1, (A) => { A.beats[1].id = 'shore'; return A; }), C)).toThrow(/'shore' twice/);
    expect(() => readMainQuest(act(QUEST, 0, (A) => { A.beats[0].as = { level: 'nowhere' }; return A; }), C)).toThrow(/as\.level 'nowhere' is not one of the world's .*built: false/);
    expect(() => readMainQuest(act(QUEST, 0, (A) => { A.beats[0].as = { dungeon: 'x' }; return A; }), C)).toThrow(/as is one of \{ level \}/);
    expect(() => readMainQuest({ ...QUEST, ending: { beat: 'nope' } }, C)).toThrow(/ending\.beat 'nope' is none of the beats/);
    expect(() => readMainQuest({ ...QUEST, length: 'epic' }, C)).toThrow(/length is short/);
    // (the planned keep and arena name what is not there yet: read)
    expect(readMainQuest(QUEST, C).acts[1].beats[1]).toMatchObject({ as: { kind: 'wcd', at: 'keep' }, built: false });
  });

  it('is the gameworld\'s: read with the world, a malformed one refused there', () => {
    expect(readGameworld({ ...W, mainQuest: QUEST }).mainQuest.acts).toHaveLength(3);
    expect(() => readGameworld({ ...W, mainQuest: { acts: 'all of them' } })).toThrow(/^gameworld: mainQuest\.acts/);
    expect(readGameworld(W).mainQuest).toBeUndefined();
  });
});

describe('the main quest in chapters', () => {
  // the same quest told chapter on chapter: a long game past an arc, each chapter turning the world
  const CHAPTERED = {
    chapters: [
      { id: 'meadow', goal: 'leave the meadow', beats: [{ id: 'first-climb', goal: 'climb out', as: { level: L1 }, gains: [P[0]], foes: ['grunt'] }] },
      { id: 'shore', goal: 'the shore', turn: 'the tide has gone out', beats: [{ id: 'shore-cross', goal: 'cross it', as: { level: L2 }, foes: ['grunt'] }] },
      { id: 'keep', goal: 'the keep', turn: 'the keep\'s gate stands open', beats: [{ id: 'the-keep', goal: 'into the keep', as: { wcd: 'keep' }, gains: [P[1]], built: false }] },
      { id: 'storm', goal: 'the storm', period: 'after', beats: [{ id: 'eye', goal: 'hold the eye', as: { gauntlet: 'storm-arena' }, gains: [P[2]], foes: ['warden'], built: false }] },
    ],
    periods: [{ id: 'before' }, { id: 'after' }],
  };

  it('an alternate progression: read as chapters, held to the same laws and to a chapter\'s own', () => {
    const Q = readMainQuest(CHAPTERED, C);
    expect(Q.shape).toBe('chapters');
    const L = laws(CHAPTERED);
    expect(L.arc).toBeUndefined();
    for (const l of Object.values(L)) expect(l.holds, `${l.law}: ${l.says}`).toBe(true);
    expect(Object.keys(L)).toEqual(expect.arrayContaining(['chaptered', 'turns', 'stage-matches', 'escalates', 'buildable-first']));
    // its chapters are stages of the hero's progression by place, as acts are: the first early, the last late
    expect(mainQuestReport(Q, C)).toMatchObject({ shape: 'chapters', chapters: [{ id: 'meadow', stage: 'early' }, { id: 'shore', stage: 'mid', turn: 'the tide has gone out' }, { id: 'keep', stage: 'mid' }, { id: 'storm', stage: 'late' }] });
  });

  it('says a chaptered quest that is only an arc, and a chapter that turns nothing', () => {
    expect(laws({ ...CHAPTERED, chapters: CHAPTERED.chapters.slice(0, 3) }).chaptered).toMatchObject({ holds: false, says: expect.stringMatching(/3 chapters$/) });
    const still = { ...CHAPTERED, chapters: CHAPTERED.chapters.map((c) => (c.id === 'keep' ? (({ turn: _t, ...x }) => x)(c) : c)) };
    expect(laws(still).turns).toMatchObject({ holds: false, says: expect.stringContaining("'keep' turns nothing in the world") });
    // a new period is a turn
    expect(laws(CHAPTERED).turns.holds).toBe(true);
  });

  it('is one shape or the other', () => {
    expect(() => readMainQuest({ ...CHAPTERED, acts: QUEST.acts }, C)).toThrow(/acts or as chapters, not both/);
    expect(() => readMainQuest({ chapters: [] }, C)).toThrow(/chapters is .*at least one chapter/);
    expect(loopOf({ ...W, mainQuest: CHAPTERED })).toMatchObject({ reward: expect.stringContaining('power'), session: 'a beat of the main quest' });
  });
});

describe('the core loop', () => {
  it('read from the book when not written: the hero\'s verbs, the levels\' goals, the quest\'s gains, a beat a sitting', () => {
    const L = loopOf({ ...W, mainQuest: QUEST });
    expect(L.moment).toEqual(expect.arrayContaining(['move', 'jump', ...H.characters.hero.actions.powers.map((p) => p.verb.split(' ')[0])]));
    expect(L).toMatchObject({ reward: expect.stringContaining('power'), session: 'a beat of the main quest', from: { moment: expect.stringContaining('powers'), session: 'the main quest' } });
    // with nothing to read, a body's loop: move and jump to a level's exit, a level a sitting
    expect(loopOf({ id: 'w', levels: { a: { walk: { nodes: { a: { trail: {} } } } } } })).toMatchObject({ moment: ['move', 'jump'], encounter: 'reach the level\'s exit', session: 'a level' });
  });

  it('written, it is held to what the hero can do; a malformed one is refused', () => {
    const verb = H.characters.hero.actions.powers[0].verb.split(' ')[0];
    expect(loopLaws({ ...W, loop: { moment: [verb, 'jump'] } })).toEqual([expect.objectContaining({ law: 'grounded', holds: true })]);
    expect(loopLaws({ ...W, loop: { moment: [verb, 'shoot'] } })[0]).toMatchObject({ holds: false, says: expect.stringContaining('asks for shoot') });
    expect(loopOf({ ...W, loop: { moment: 'dash and climb', session: 'an evening' } })).toMatchObject({ moment: ['dash', 'climb'], session: 'an evening', from: { moment: 'written' } });
    expect(() => readLoop({ verbs: ['x'] })).toThrow(/loop\.verbs is not a layer/);
    expect(() => readGameworld({ ...W, loop: { moment: [] } })).toThrow(/^gameworld: loop\.moment/);
    expect(BODY_VERBS).toContain('jump');
  });
});
