// The contest's stats: a fold over the calls a sim keeps, the kernel's word counted and nothing judged. Each shape on a
// small call log written out (what each row counts), then one real game whose stats agree with the kernel's score.
import { describe, it, expect } from 'vitest';
import { contestStats, statLine, statFormat, statPanel, statCompact, STAT_ROWS } from './contest-stats.js';
import { newTeam, stepTeam, teamContext } from './team-sim.js';
import { teamArenaData } from './team-arena.js';

const val = (st, id) => st.rows.find((r) => r.id === id).values;
const log = (...calls) => ({ calls: calls.map((c, i) => ({ f: i * 10, ...c })) });

describe('the stats of a net game', () => {
  it('counts the server\'s untouched points as aces, a double fault against the server, winners and errors by the last hit', () => {
    // (in the sim's order: the serve's stroke, then the kernel's serve call)
    const S = log(
      { kind: 'hit', who: 'a1', verb: 'serve', speed: 50 }, { kind: 'serve', who: 'a1', faults: 0 }, { kind: 'point', side: 'a', why: 'double-bounce' },   // an ace
      { kind: 'serve', who: 'a1', faults: 0 }, { kind: 'fault', side: 'a', faults: 1 }, { kind: 'serve', who: 'a1', faults: 1 }, { kind: 'point', side: 'b', why: 'double-fault' },
      { kind: 'hit', who: 'a1', verb: 'serve', speed: 40 }, { kind: 'serve', who: 'a1', faults: 0 }, { kind: 'hit', who: 'b1', verb: 'forehand', speed: 30 }, { kind: 'hit', who: 'a1', verb: 'volley', speed: 30 }, { kind: 'point', side: 'a', why: 'double-bounce' },   // a's winner
      { kind: 'hit', who: 'b1', verb: 'serve', speed: 30 }, { kind: 'serve', who: 'b1', faults: 0 }, { kind: 'hit', who: 'a1', verb: 'forehand', speed: 30 }, { kind: 'point', side: 'b', why: 'out' },   // a's error
    );
    const st = contestStats(S, 'match');
    expect(st).toMatchObject({ shape: 'match', by: 'side', ids: ['a', 'b'] });
    expect(st.rows.map((r) => r.id)).toEqual(STAT_ROWS.match.map((r) => r.id));
    expect(val(st, 'points')).toEqual({ a: 2, b: 2 });
    expect(val(st, 'aces')).toEqual({ a: 1, b: 0 }); expect(val(st, 'doubles')).toEqual({ a: 1, b: 0 });
    expect(val(st, 'winners')).toEqual({ a: 1, b: 0 }); expect(val(st, 'errors')).toEqual({ a: 1, b: 0 });
    expect(val(st, 'firstIn')).toEqual({ a: 67, b: 100 });   // a's three first serves, one faulted
    expect(val(st, 'rally').a).toBe(3); expect(val(st, 'serve')).toEqual({ a: 180, b: 108 });
    // an arcade card's serve stroke has its own name (a drop, an underhand): its speed is the serve's all the same
    expect(val(contestStats(log({ kind: 'hit', who: 'a1', verb: 'drop', speed: 20 }, { kind: 'serve', who: 'a1', faults: 0 }), 'match'), 'serve')).toEqual({ a: 72, b: 0 });
    expect(statLine(st, 'a', ['aces', 'firstIn'])).toBe('aces 1 · 1st serve in 67%');
    // the panel: the rows asked that the sport has, formatted, the one best value lit by the row's lean; a tie lit none
    const P = statPanel(st, ['aces', 'doubles', 'points', 'saves'], [{ name: 'P1', color: 0 }, { name: 'CPU', color: 1 }], 'changeover');
    expect(P.rows.map((r) => r.words)).toEqual(['aces', 'double faults', 'points won']);
    expect(P.rows.map((r) => r.lead)).toEqual([0, 1, null]);
    expect(statPanel(st, ['firstIn'], [], 't').rows[0].cells).toEqual(['67%', '100%']);
    expect(contestStats(log({ kind: 'serve', who: 'a1', faults: 0 }), 'match').rows.find((r) => r.id === 'firstIn').values).toEqual({ a: 100, b: null });   // b has not served
    expect(statFormat(STAT_ROWS.match.find((r) => r.id === 'firstIn'), null)).toBe('–');
    expect(statCompact(st)).toMatchObject({ aces: { a: 1, b: 0 }, firstIn: { a: 67, b: 100 } });
  });
});

describe('the stats of a goal game', () => {
  it('counts goalward kicks as shots, goals and saves on target, passes to a team-mate, possession by the last kick', () => {
    const S = log(
      { kind: 'live' }, { kind: 'kick', who: 'a1', power: 0.5 }, { kind: 'kick', who: 'a2', power: 0.5 }, { kind: 'kick', who: 'a2', power: 0.9, goalward: true }, { kind: 'save', who: 'b1' },
      { kind: 'kick', who: 'b2', power: 0.5 }, { kind: 'out', side: 'a', restart: { kind: 'corner', side: 'a' } },
      { kind: 'live' }, { kind: 'kick', who: 'a3', power: 0.4 }, { kind: 'score', side: 'a' },   // a goal off a soft touch is still a shot
      { kind: 'live' }, { kind: 'foul', foul: 'offside', side: 'b', who: 'b3' },
    );
    const st = contestStats(S, 'team');
    expect(val(st, 'goals')).toEqual({ a: 1, b: 0 });
    expect(val(st, 'shots')).toEqual({ a: 2, b: 0 }); expect(val(st, 'onTarget')).toEqual({ a: 2, b: 0 });
    expect(val(st, 'saves')).toEqual({ a: 0, b: 1 }); expect(val(st, 'passes')).toEqual({ a: 1, b: 0 });
    expect(val(st, 'corners')).toEqual({ a: 1, b: 0 }); expect(val(st, 'offsides')).toEqual({ a: 0, b: 1 }); expect(val(st, 'fouls')).toEqual({ a: 0, b: 1 });
    expect(val(st, 'possession').a + val(st, 'possession').b).toBe(100);
  });

  it('agrees with the kernel on a real game: the goals its score, a shot for every goal and save', () => {
    const ctx = teamContext(teamArenaData({ sport: 'soccer', players: 0, seed: 4, periods: 1, seconds: 60 }));
    const S = newTeam(ctx);
    for (let i = 0; i < 20000 && S.K.phase !== 'over'; i++) stepTeam(S, [], ctx);
    const st = contestStats(S, 'team');
    expect(val(st, 'goals')).toEqual({ a: S.K.score.a[0], b: S.K.score.b[0] });
    for (const id of ['a', 'b']) {
      expect(val(st, 'shots')[id]).toBeGreaterThanOrEqual(val(st, 'onTarget')[id]);
      expect(val(st, 'onTarget')[id]).toBe(val(st, 'goals')[id] + val(st, 'saves')[id === 'a' ? 'b' : 'a']);   // (the other keeper's saves)
    }
    expect(contestStats(S, 'team')).toEqual(st);
  });
});

describe('the stats of a turn sport and a meet', () => {
  it('golf: strokes and par from the holes, putts, the tee shot on the fairway, the green in regulation', () => {
    const S = log(
      { kind: 'shot', who: 'p1', shot: 1, round: 1 }, { kind: 'lie', who: 'p1', region: 'green' }, { kind: 'shot', who: 'p1', shot: 2, round: 1 }, { kind: 'hit', who: 'p1', verb: 'putt' },
      { kind: 'holed', who: 'p1', round: 1, strokes: 2, par: 3, toPar: -1 },
      { kind: 'shot', who: 'p1', shot: 1, round: 2 }, { kind: 'lie', who: 'p1', region: 'fairway' }, { kind: 'penalty', who: 'p1' }, { kind: 'holed', who: 'p1', round: 2, strokes: 5, par: 4, toPar: 1 },
    );
    const st = contestStats(S, 'turns');
    expect(st.by).toBe('seat'); expect(st.rows.map((r) => r.id)).toEqual(STAT_ROWS.strokes.map((r) => r.id));
    expect(val(st, 'strokes')).toEqual({ p1: 7 }); expect(val(st, 'toPar')).toEqual({ p1: 0 }); expect(statFormat(st.rows[1], 0)).toBe('E');
    expect(val(st, 'putts')).toEqual({ p1: 1 }); expect(val(st, 'fairways')).toEqual({ p1: 1 }); expect(val(st, 'greens')).toEqual({ p1: 1 }); expect(val(st, 'penalties')).toEqual({ p1: 1 });
  });
  it('bowling: the pinfall, the marks, the open frames, the ball\'s speed', () => {
    const S = log(
      { kind: 'hit', who: 'p1', verb: 'roll', speed: 10 }, { kind: 'roll', who: 'p1', round: 1, down: 10, mark: 'strike' },
      { kind: 'hit', who: 'p1', verb: 'roll', speed: 12 }, { kind: 'roll', who: 'p1', round: 2, down: 6, mark: null }, { kind: 'roll', who: 'p1', round: 2, down: 2, mark: null },
    );
    const st = contestStats(S, 'turns');
    expect(st.rows.map((r) => r.id)).toEqual(STAT_ROWS.pins.map((r) => r.id));
    expect(val(st, 'pinfall')).toEqual({ p1: 18 }); expect(val(st, 'strikes')).toEqual({ p1: 1 }); expect(val(st, 'opens')).toEqual({ p1: 1 }); expect(val(st, 'speed')).toEqual({ p1: 40 });
  });
  it('a meet: a race\'s times and places (its hurdles hit when it has hurdles); a jump\'s best, fouls and run-up', () => {
    const race = { r: [{ id: 'r1' }, { id: 'r2' }], ...log({ kind: 'gun' }, { kind: 'finish', who: 'r2', t: 10.123 }, { kind: 'finish', who: 'r1', t: 10.5 }, { kind: 'over', placings: [{ who: 'r2', place: 1 }, { who: 'r1', place: 2 }] }) };
    const st = contestStats(race, 'meet');
    expect(st.rows.map((r) => r.id)).toEqual(['time', 'place']);
    expect(val(st, 'time')).toEqual({ r1: 10.5, r2: 10.12 }); expect(val(st, 'place')).toEqual({ r1: 2, r2: 1 });
    expect(contestStats({ ...race, calls: [...race.calls, { kind: 'clip', who: 'r1', f: 1 }] }, 'meet').rows.map((r) => r.id)).toContain('clips');
    const jump = { r: [{ id: 'r1' }], ...log({ kind: 'takeoff', who: 'r1', v: 9 }, { kind: 'mark', who: 'r1', value: 6.1, foul: false }, { kind: 'mark', who: 'r1', value: 7, foul: true }) };
    const sj = contestStats(jump, 'meet');
    expect(val(sj, 'best')).toEqual({ r1: 6.1 }); expect(val(sj, 'fouls')).toEqual({ r1: 1 }); expect(val(sj, 'runup')).toEqual({ r1: 32 });
    expect(() => contestStats(race, 'chess')).toThrow(/no shape 'chess'/);
  });
});
