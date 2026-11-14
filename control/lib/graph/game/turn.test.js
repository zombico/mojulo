import { describe, it, expect } from 'vitest';
import { readTurn, turnOf, beginTurn, stepTurn, walkTurn, pickErrors, turnParams, buildTurnKernel, TURN_PHASES } from './turn.js';
import { readFlow } from './flow.js';

// A GAME'S TURN: one level session in phases (untap, upkeep, main, cleanup, end), the pause an interrupt in play only.
// One case per procedure: the reader's faults, the picks, the load, main's triggers, the interrupt, the exits.

const STEP = {
  kind: 'level', level: 'vale', on: { won: 'result', lost: 'result' },
  picks: [{ id: 'difficulty', from: { options: ['easy', 'normal', 'hard'] } }, { id: 'squad', from: { slice: 'party' }, max: 2 }],
  start: { scene: 'arrival' },
  end: { scene: 'farewell', when: 'won' },
};
const T = turnOf(STEP);
// the store's answer for the squad: three members, one locked
const ctx = { rows: (p) => (p.id === 'squad' ? [{ id: 'ash' }, { id: 'bryn' }, { id: 'cole', locked: true, why: 'Cole joins after the keep' }] : null) };
const phases = (states) => states.map((s) => s.stuck ? `stuck:${s.stuck}` : s.phase + (s.sub ? `:${s.sub}` : '') + (s.paused ? ':paused' : ''));

describe('a turn, read', () => {
  it('a level step that says no turn has nothing to pick and no trigger', () => {
    expect(readTurn({ kind: 'level', level: 'vale', on: { won: 'result' } })).toEqual([]);
    expect(turnOf({ kind: 'level', level: 'vale' })).toEqual({ picks: [], start: null, end: null });
  });
  it('a turn as written reads clean, defaulted', () => {
    expect(readTurn(STEP, { consumes: ['party'], scenes: ['arrival', 'farewell'] })).toEqual([]);
    expect(T.picks[0]).toMatchObject({ id: 'difficulty', min: 1, max: 1 });
    expect(T.start).toEqual({ scene: 'arrival', skip: true, once: true });
    expect(T.end).toEqual({ scene: 'farewell', skip: true, when: ['won'] });
  });
  it('an option may say its name and what it means; a pick its question and a line under it', () => {
    const step = { kind: 'level', picks: [{ id: 'difficulty', ask: 'Choose a difficulty', hint: 'It can be changed.', from: { options: ['easy', { id: 'hard', name: 'Hard', about: 'Two at a time.' }] } }] };
    expect(readTurn(step)).toEqual([]);
    expect(turnOf(step).picks[0]).toMatchObject({ ask: 'Choose a difficulty', hint: 'It can be changed.', from: { options: [{ id: 'easy', name: 'easy' }, { id: 'hard', name: 'Hard', about: 'Two at a time.' }] } });
    expect(pickErrors(turnOf(step).picks[0], 'hard')).toEqual([]);
    expect(readTurn({ kind: 'level', picks: [{ id: 'a', from: { options: ['x', { id: 'x' }] } }] }).join('\n')).toMatch(/each once/);
    expect(readTurn({ kind: 'level', picks: [{ id: 'a', ask: 3, from: { options: ['x', 'y'] } }] }).join('\n')).toMatch(/ask is words/);
  });
  it('each fault is taught', () => {
    const bad = (step, opts) => readTurn({ kind: 'level', ...step }, opts).join('\n');
    expect(bad({ picks: [] })).toMatch(/at least one/);
    expect(bad({ picks: [{ id: 'a', from: { slice: 'bag' } }] }, { consumes: ['party'] })).toMatch(/not a slice the level consumes \(party\)/);
    expect(bad({ picks: [{ id: 'a', from: { options: ['one'] } }] })).toMatch(/two or more/);
    expect(bad({ picks: [{ id: 'a', from: { options: ['x', 'y'] } }, { id: 'a', from: { options: ['x', 'y'] } }] })).toMatch(/said twice/);
    expect(bad({ picks: [{ id: 'a', from: { options: ['x', 'y'] }, min: 2 }] })).toMatch(/min 2 is over max 1/);
    expect(bad({ picks: [{ id: 'a', from: { options: ['x', 'y'] }, seats: 2 }] })).toMatch(/a pick takes/);
    expect(bad({ start: { scene: 'a', video: 'b.mp4' } })).toMatch(/one or the other/);
    expect(bad({ start: {} })).toMatch(/a scene the level has \(scene\) or a video/);
    expect(bad({ start: { scene: 'nope' } }, { scenes: ['arrival'] })).toMatch(/no scene 'nope' \(arrival\)/);
    expect(bad({ end: { video: 'v.mp4', when: 'drawn' } })).toMatch(/won, lost, left/);
    expect(bad({ start: { video: 'v.mp4', when: 'won' } })).toMatch(/start trigger takes/);
  });
  it('the flow reads a level step\'s turn, a pick\'s slice against what the level consumes', () => {
    const flow = { start: 'play', steps: { play: { ...STEP, on: { won: 'play', lost: 'play' } } } };
    expect(readFlow(flow, { levels: ['vale'], consumes: { vale: ['party'] } })).toEqual([]);
    expect(readFlow(flow, { levels: ['vale'], consumes: { vale: [] } }).join('\n')).toMatch(/flow\.steps\.play\.picks\[1\]\.from\.slice 'party'/);
  });
});

describe('a turn, stepped', () => {
  it('the whole turn: the picks, the load, the start trigger, play, the end trigger, cleanup, the results', () => {
    const run = walkTurn(T, [{ pick: 'hard' }, { pick: ['ash', 'bryn'] }, 'ready', 'scene-end', { outcome: 'won' }, 'scene-end', { applied: true }, 'next'], { level: 'vale' }, ctx);
    expect(phases(run)).toEqual(['untap', 'untap', 'upkeep', 'main:start', 'main:play', 'main:end', 'cleanup', 'end', 'out']);
    expect(run.at(-1)).toMatchObject({ exit: 'next', outcome: 'won', picks: { difficulty: 'hard', squad: ['ash', 'bryn'] } });
    expect(new Set(run.slice(0, -1).map((s) => s.phase))).toEqual(new Set(TURN_PHASES));
  });
  it('a choice that cannot stand keeps the pick and says why; back unwinds one pick, then leaves', () => {
    let s = stepTurn(T, beginTurn(T, { level: 'vale' }), { pick: 'hard' }, ctx);
    const locked = stepTurn(T, s, { pick: ['ash', 'cole'] }, ctx);
    expect(locked).toMatchObject({ phase: 'untap', at: 1, why: 'Cole joins after the keep' });
    expect(pickErrors(T.picks[1], ['ash', 'bryn', 'ash'], ctx)).toEqual(['pick 2 at most', 'ash is picked twice']);
    expect(pickErrors(T.picks[0], 'brutal')).toEqual(['no brutal to pick']);
    s = stepTurn(T, locked, 'back', ctx);
    expect(s).toEqual({ level: 'vale', picks: {}, phase: 'untap', at: 0 });
    expect(stepTurn(T, s, 'back', ctx)).toMatchObject({ phase: 'out', exit: 'back' });
  });
  it('nothing to pick: the turn starts at the load, and with no trigger goes straight to play and to cleanup', () => {
    const bare = turnOf({ kind: 'level', level: 'vale' });
    expect(phases(walkTurn(bare, ['ready', { outcome: 'lost' }, { applied: true }], { level: 'vale' }))).toEqual(['upkeep', 'main:play', 'cleanup', 'end']);
    expect(walkTurn(bare, [{ fail: 'no such level' }]).at(-1)).toMatchObject({ phase: 'out', exit: 'failed', why: 'no such level' });
  });
  it('a load that fails goes back to the last pick, with its reason', () => {
    const run = walkTurn(T, [{ pick: 'easy' }, { pick: 'ash' }, { fail: 'the level speaks a newer contract' }], {}, ctx);
    expect(run.at(-1)).toMatchObject({ phase: 'untap', at: 1, why: 'the level speaks a newer contract', picks: { difficulty: 'easy', squad: ['ash'] } });
  });
  it('a retry loads again with the same picks and never replays the start trigger; a save that has seen it does not either', () => {
    const run = walkTurn(T, [{ pick: 'easy' }, { pick: 'ash' }, 'ready', 'scene-end', { outcome: 'lost' }, { applied: true }, 'retry', 'ready'], {}, ctx);
    expect(phases(run).slice(-3)).toEqual(['end', 'upkeep', 'main:play']);
    expect(run.at(-1).picks).toEqual({ difficulty: 'easy', squad: ['ash'] });
    expect(phases(walkTurn(T, ['ready'], { picks: { difficulty: 'easy' } }, { seen: () => true }))).toEqual(['upkeep', 'main:play']);
    const always = turnOf({ ...STEP, start: { scene: 'arrival', once: false } });
    expect(phases(walkTurn(always, ['ready'], { picks: {}, again: true }))).toEqual(['upkeep', 'main:start']);
  });
  it('the end trigger plays on the outcomes it names: a loss here goes straight to cleanup', () => {
    expect(phases(walkTurn(T, ['ready', 'scene-end', { outcome: 'lost' }], { picks: {} }))).toEqual(['upkeep', 'main:start', 'main:play', 'cleanup']);
  });
  it('the interrupt is legal in play only: no pause during a trigger, no outcome while paused; a quit is a level left, through cleanup', () => {
    const run = walkTurn(T, ['ready', 'interrupt'], { picks: {} });
    expect(run.at(-1)).toEqual({ stuck: 'interrupt', at: 'main' });
    const play = walkTurn(T, ['ready', 'scene-end', 'interrupt'], { picks: {} }).at(-1);
    expect(play.paused).toBe(true);
    expect(stepTurn(T, play, { outcome: 'won' })).toBe(null);
    expect(stepTurn(T, play, 'resume')).toMatchObject({ phase: 'main', sub: 'play' });
    expect(stepTurn(T, play, 'resume').paused).toBeUndefined();
    expect(stepTurn(T, play, 'quit')).toMatchObject({ phase: 'cleanup', outcome: 'left' });
    expect(stepTurn(T, { ...play, picks: { difficulty: 'hard' } }, 'restart')).toEqual({ phase: 'upkeep', level: null, picks: { difficulty: 'hard' }, again: true });
    expect(stepTurn(T, { ...play, paused: undefined }, 'restart')).toBe(null);
    const farewell = turnOf({ ...STEP, end: { scene: 'farewell', when: ['won', 'left'] } });
    expect(stepTurn(farewell, play, 'quit')).toMatchObject({ phase: 'main', sub: 'end', outcome: 'left' });
  });
  it('the picks hand the level its own words, and which members of a consumed slice go in', () => {
    const s = walkTurn(T, [{ pick: 'hard' }, { pick: 'bryn' }], {}, ctx).at(-1);
    expect(turnParams(T, s)).toEqual({ picks: { difficulty: 'hard' }, slices: { party: ['bryn'] } });
  });
  it('the kernel is self-contained: a shell inlines it by toString()', () => {
    const K = new Function(`return (${buildTurnKernel.toString()})()`)();
    expect(phases(K.walkTurn(T, [{ pick: 'easy' }, { pick: 'ash' }, 'ready'], {}, ctx))).toEqual(['untap', 'untap', 'upkeep', 'main:start']);
  });
});
