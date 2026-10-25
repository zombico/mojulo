// The contest kernel: the game state of a sport as a pure function of facts. One fixture per procedure, never a
// sweep of sports: tennis (a ladder with names, the diagonal serve, faults and the let, one bounce a side), volleyball
// (no bounce, three touches, side-out), a sprint (the gun, the false start, placings by time), the long jump
// (attempts, the foul, the best), a goal game (the clock's periods, a draw or overtime, a free restart).
import { describe, it, expect } from 'vitest';
import { buildContest, contestRead, contestStart, contestLegal, contestApply, contestDisplay, contestRegion, contestInside, contestSideOf, contestPlayers } from './contest-kernel.js';
import { tennis } from './fixtures/tennis.js';
import { volleyball } from './fixtures/volleyball.js';
import { sprint } from './fixtures/sprint.js';
import { longJump } from './fixtures/long-jump.js';
import { periods } from './fixtures/periods.js';

// play facts in order, collecting every call; a fact may be a function of the state (to read who serves)
function play(C, S, facts) {
  const calls = [];
  for (const f of facts) { const r = contestApply(C, S, typeof f === 'function' ? f(S) : f); S = r.S; calls.push(...r.calls); }
  return { S, calls };
}
const kinds = (calls) => calls.map((c) => c.kind);
// a point in tennis: the server serves into the right box, the receiver lets it bounce, hits it back, the server misses (out)
const T = contestRead(tennis());
const Y = (side, y) => (side === 'a' ? -y : y);   // a point `y` metres from the net on `side`
const serveIn = (S) => ({ kind: 'touch', who: S.restart.who, at: [0, Y(S.server, 11)] });
const landsIn = (S) => {   // the serve lands in the right box for the receiver: diagonal, so on a's right (+x) from b's view it is b's right mirrored
  const rec = S.server === 'a' ? 'b' : 'a', box = S.played % 2 === 0 ? 'service-right' : 'service-left';
  const r = contestRegion(T, box, rec).rect;
  return { kind: 'bounce', at: [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2] };
};
const returned = (S) => { const rec = S.server === 'a' ? 'b' : 'a'; return { kind: 'touch', who: `${rec}1`, at: [0, Y(rec, 4)] }; };
const backIn = (S) => ({ kind: 'bounce', at: [0, Y(S.server, 8)] });   // the return lands in the server's backcourt
const serverHits = (S) => ({ kind: 'touch', who: `${S.server}1`, at: [0, Y(S.server, 9)] });
const longOut = (S) => ({ kind: 'bounce', at: [0, Y(S.server === 'a' ? 'b' : 'a', 13)] });   // past the receiver's baseline: out
const pointToReceiver = [serveIn, landsIn, returned, backIn, serverHits, longOut];
const pointToServer = [serveIn, landsIn, (S) => ({ kind: 'bounce', at: [1, Y(S.server === 'a' ? 'b' : 'a', 8)] })];   // the receiver lets it bounce twice

describe('reading a contest', () => {
  it('teaches the shape', () => {
    expect(() => contestRead('tennis')).toThrow(/a contest is an object/);
    expect(() => contestRead({ shape: 'duel' })).toThrow(/shape is match \| meet/);
    expect(() => contestRead({ shape: 'match', scoring: { ladder: [{ unit: 'point', to: 11 }] } })).toThrow(/a match has a court/);
    expect(() => contestRead({ ...tennis(), rally: { in: 'pitch' } })).toThrow(/rally.in is a region of the court \(half, service-right/);
    expect(() => contestRead({ ...tennis(), serve: { into: 'baseline' } })).toThrow(/serve.into is a region/);
    expect(() => contestRead({ ...tennis(), scoring: { ladder: [{ unit: 'game' }, { unit: 'set', to: 6 }] } })).toThrow(/only the top unit may be won by the clock/);
    expect(() => contestRead({ ...tennis(), fouls: { shove: 'jail' } })).toThrow(/fouls.shove is fault \| point \| free \| warn/);
    expect(() => contestRead({ ...periods(), fouls: { late: 'fault' } })).toThrow(/costs a serve fault, and this match has no serve/);
    expect(() => contestRead({ shape: 'meet', event: { kind: 'sprint', lanes: 4, measure: 'laps' } })).toThrow(/event.measure is time \| distance \| height/);
    expect(() => contestRead({ ...sprint(), event: { ...sprint().event, attempts: 3 } })).toThrow(/a timed event is one attempt/);
    expect(() => contestRead({ ...tennis(), roles: { one: { home: 'half' }, two: { home: 'half' } } })).toThrow(/names 2 roles for 1 players/);
    for (const spec of [tennis(), volleyball(), sprint(), longJump(), periods()]) expect(() => contestRead(spec), spec.title).not.toThrow();
  });
  it('names the players by side and lane', () => {
    expect(contestPlayers(T)).toEqual(['a1', 'b1']);
    expect(contestPlayers(contestRead(volleyball())).length).toBe(12);
    expect(contestPlayers(contestRead(sprint({ lanes: 3 })))).toEqual(['r1', 'r2', 'r3']);
  });
});

describe('the court', () => {
  it('mirrors a region for the other side: half-turn puts a\'s right box diagonal from b\'s, reflect keeps the side', () => {
    const a = contestRegion(T, 'service-right', 'a').rect, b = contestRegion(T, 'service-right', 'b').rect;
    expect(a).toEqual([0, -6.4, 4.115, 0]);
    expect(b).toEqual([-4.115, 0, 0, 6.4]);
    // every point of a's box, turned half round, is in b's; the law, on a grid
    for (let x = 0.1; x < 4.1; x += 0.8) for (let y = -6.3; y < 0; y += 1.3) expect(contestInside(T, 'service-right', 'b', [-x, -y]), `${x},${y}`).toBe(true);
    const P = contestRead(periods());
    expect(contestRegion(P, 'box', 'b').rect).toEqual([-9, 24, 9, 30]);
    expect(contestRegion(P, 'pitch', 'b').rect).toEqual(contestRegion(P, 'pitch', 'a').rect);   // shared
    expect(contestSideOf(T, [0, -1])).toBe('a'); expect(contestSideOf(T, [0, 2])).toBe('b'); expect(contestSideOf(T, [1, 0])).toBe(null);
    expect(() => contestRegion(T, 'tramlines', 'a')).toThrow(/no region 'tramlines'/);
  });
});

describe('tennis: a served match with a named ladder', () => {
  it('the toss serves first, the serve goes diagonally into the box called by the point, and a point is 15 30 40 game', () => {
    const S0 = contestStart(T, 7);
    expect(S0.phase).toBe('serve');
    expect(S0.restart).toEqual({ kind: 'serve', side: S0.server, who: `${S0.server}1` });
    expect(contestLegal(T, S0, S0.restart.who).serve).toBe(true);
    expect(contestLegal(T, S0, `${S0.server === 'a' ? 'b' : 'a'}1`).may).toEqual(['move']);
    const srv = S0.server, rec = srv === 'a' ? 'b' : 'a';
    let r = play(T, S0, pointToServer);
    expect(kinds(r.calls)).toEqual(['serve', 'point']);
    expect(r.calls[0]).toMatchObject({ into: 'service-right' });
    expect(r.calls[1]).toMatchObject({ side: srv, why: 'double-bounce', scored: true });
    expect(contestDisplay(T, r.S).score[srv]).toEqual(['15', '0', '0']);
    expect(r.S.phase).toBe('serve'); expect(r.S.server).toBe(srv);
    r = play(T, r.S, pointToReceiver);
    expect(r.calls[0]).toMatchObject({ into: 'service-left' });
    expect(r.calls.at(-1)).toMatchObject({ kind: 'point', side: rec, why: 'out' });
    expect(contestDisplay(T, r.S).score).toEqual({ [srv]: ['15', '0', '0'], [rec]: ['15', '0', '0'] });
    r = play(T, r.S, [...pointToServer, ...pointToServer, ...pointToServer]);
    expect(kinds(r.calls).filter((k) => k === 'game')).toEqual(['game']);
    expect(r.S.score[srv]).toEqual([0, 1, 0]);
    expect(r.S.server).toBe(rec);   // the serve changed hands with the game
  });
  it('deuce and advantage: four by two, named', () => {
    let S = contestStart(T, 7);
    const srv = S.server, rec = srv === 'a' ? 'b' : 'a';
    S = play(T, S, [...pointToServer, ...pointToServer, ...pointToServer, ...pointToReceiver, ...pointToReceiver, ...pointToReceiver]).S;
    expect(contestDisplay(T, S).score[srv][0]).toBe('deuce');
    S = play(T, S, pointToServer).S;
    expect(contestDisplay(T, S).score).toMatchObject({ [srv]: ['advantage', '0', '0'], [rec]: ['-', '0', '0'] });
    S = play(T, S, pointToReceiver).S;
    expect(contestDisplay(T, S).score[rec][0]).toBe('deuce');
    const r = play(T, S, [...pointToReceiver, ...pointToReceiver]);
    expect(kinds(r.calls)).toContain('game');
    expect(r.S.score[rec][1]).toBe(1);
  });
  it('a fault, a double fault, a let, a volleyed serve and a foot fault', () => {
    const S0 = contestStart(T, 7), srv = S0.server, rec = srv === 'a' ? 'b' : 'a';
    let r = play(T, S0, [serveIn, (S) => ({ kind: 'bounce', at: [0, Y(rec, 8)] })]);   // long: past the service line
    expect(r.calls.at(-1)).toMatchObject({ kind: 'fault', faults: 1, why: 'out' });
    expect(r.S.phase).toBe('serve');
    r = play(T, r.S, [serveIn, { kind: 'net' }, (S) => ({ kind: 'bounce', at: [0, Y(srv, 1)] })]);   // into the net, onto its own side
    expect(r.calls.at(-1)).toMatchObject({ kind: 'point', side: rec, why: 'double-fault' });
    r = play(T, r.S, [serveIn, { kind: 'net' }, landsIn]);   // off the cord, into the box: a let, the fault count kept
    expect(kinds(r.calls)).toEqual(['serve', 'let']);
    expect(r.S.phase).toBe('serve'); expect(r.S.faults).toBe(0);
    r = play(T, r.S, [serveIn, returned]);   // the receiver hits the serve before it bounces
    expect(r.calls.at(-1)).toMatchObject({ kind: 'point', side: srv, why: 'volleyed-serve' });
    r = play(T, r.S, [{ kind: 'foul', foul: 'foot-fault', who: `${srv}1` }]);
    expect(r.calls.at(-1)).toMatchObject({ kind: 'fault', why: 'foot-fault' });
    r = play(T, r.S, [serveIn, landsIn, returned, { kind: 'foul', foul: 'net-touch', who: `${srv}1` }]);
    expect(r.calls.at(-1)).toMatchObject({ kind: 'point', side: rec, why: 'net-touch' });
  });
  it('a rally: reaching over, touching twice, the ball into the net, and a fact the rules ignore', () => {
    const S0 = contestStart(T, 7), srv = S0.server, rec = srv === 'a' ? 'b' : 'a';
    let r = play(T, S0, [serveIn, landsIn, (S) => ({ kind: 'touch', who: `${rec}1`, at: [0, Y(srv, 0.5)] })]);   // over the net
    expect(r.calls.at(-1)).toMatchObject({ kind: 'point', side: srv, why: 'reach-over' });
    r = play(T, r.S, [serveIn, landsIn, returned, returned]);
    expect(r.calls.at(-1)).toMatchObject({ kind: 'point', side: srv, why: 'touches' });
    r = play(T, r.S, [serveIn, landsIn, returned, { kind: 'bounce', at: [0, 0] }]);
    expect(r.calls.at(-1)).toMatchObject({ kind: 'point', side: srv, why: 'net' });
    const before = JSON.stringify(r.S);
    const q = contestApply(T, r.S, { kind: 'bounce', at: [0, 3] });   // a bounce before any serve: nothing
    expect(q.calls).toEqual([]);
    expect(JSON.stringify({ ...q.S, n: r.S.n })).toBe(before);
    expect(() => contestApply(T, r.S, { kind: 'gun' })).toThrow(/no fact 'gun' in a match/);
  });
  it('a set is six games by two, the match two sets; legal is never empty while it runs; the end is final', () => {
    let S = contestStart(T, 3);
    const srv0 = S.server;
    let games = 0, sets = 0, n = 0;
    while (S.phase !== 'over' && n++ < 400) {
      const srv = S.server;
      const r = play(T, S, srv === srv0 ? [...pointToServer, ...pointToServer, ...pointToServer, ...pointToServer] : [...pointToReceiver, ...pointToReceiver, ...pointToReceiver, ...pointToReceiver]);
      games += kinds(r.calls).filter((k) => k === 'game').length; sets += kinds(r.calls).filter((k) => k === 'set').length;
      for (const p of contestPlayers(T)) if (r.S.phase !== 'over') expect(contestLegal(T, r.S, p).may.length, p).toBeGreaterThan(0);
      S = r.S;
    }
    expect(S.phase).toBe('over'); expect(S.winner).toBe(srv0);
    expect([games, sets]).toEqual([12, 2]);
    expect(contestLegal(T, S, 'a1').may).toEqual([]);
    expect(contestApply(T, S, serveIn(contestStart(T, 3))).calls).toEqual([]);
  });
});

describe('volleyball: no bounce, three touches, side-out', () => {
  const V = contestRead(volleyball());
  const srvTouch = (S) => ({ kind: 'touch', who: S.restart.who, at: [0, Y(S.server, 9)] });
  it('three touches a side, never the same player twice, any bounce the point; the serve passes with the rally and rotates', () => {
    const S0 = contestStart(V, 11), srv = S0.server, rec = srv === 'a' ? 'b' : 'a';
    expect(S0.restart.who).toBe(`${srv}1`);
    let r = play(V, S0, [srvTouch, { kind: 'touch', who: `${rec}1`, at: [0, Y(rec, 3)] }, { kind: 'touch', who: `${rec}2`, at: [0, Y(rec, 2)] }, { kind: 'touch', who: `${rec}3`, at: [0, Y(rec, 1)] }, { kind: 'touch', who: `${rec}4`, at: [0, Y(rec, 1)] }]);
    expect(r.calls.at(-1)).toMatchObject({ kind: 'point', side: srv, why: 'touches' });
    expect(r.S.server).toBe(srv); expect(r.S.restart.who).toBe(`${srv}1`);   // the server kept the serve
    r = play(V, r.S, [srvTouch, { kind: 'touch', who: `${rec}1`, at: [0, Y(rec, 3)] }, { kind: 'touch', who: `${rec}1`, at: [0, Y(rec, 2)] }]);
    expect(r.calls.at(-1)).toMatchObject({ side: srv, why: 'double-touch' });
    r = play(V, r.S, [srvTouch, { kind: 'touch', who: `${rec}1`, at: [0, Y(rec, 3)] }, { kind: 'touch', who: `${rec}2`, at: [0, Y(rec, 2)] }, { kind: 'bounce', at: [0, Y(srv, 4)] }]);
    expect(r.calls.at(-1)).toMatchObject({ kind: 'point', side: rec, why: 'double-bounce' });
    expect(r.S.server).toBe(rec); expect(r.S.restart.who).toBe(`${rec}2`);   // side-out: the receivers serve, rotated one
    expect(r.S.score[rec][0]).toBe(1); expect(r.S.score[srv][0]).toBe(2);
    r = play(V, r.S, [srvTouch, { kind: 'bounce', at: [0, Y(srv, 20)] }]);   // the serve long: one fault is the point
    expect(r.calls.at(-1)).toMatchObject({ kind: 'point', side: srv, why: 'double-fault' });
  });
});

describe('a goal game on the clock', () => {
  const P = contestRead(periods({ seconds: 60 }));
  it('kickoff, a goal, the conceding side restarts, a free for a foul, the periods, and a draw', () => {
    let S = contestStart(P, 5);
    expect(S.phase).toBe('dead'); expect(S.restart.kind).toBe('kickoff');
    const kick = S.restart.side;
    expect(contestLegal(P, S, `${kick}1`).may).toEqual(['resume']);
    expect(contestLegal(P, S, 'a1').regions).toEqual(['box', 'pitch']);
    expect(contestLegal(P, S, 'a2').regions).toEqual(['pitch']);
    let r = play(P, S, [{ kind: 'tick', dt: 10 }]);   // the clock does not run before the restart
    expect(r.S.clock.t).toBe(0);
    r = play(P, r.S, [{ kind: 'resume' }, { kind: 'tick', dt: 10 }, { kind: 'score', side: 'a' }]);
    expect(kinds(r.calls)).toEqual(['live', 'score']);
    expect(r.S.restart).toEqual({ kind: 'kickoff', side: 'b' }); expect(r.S.score.a).toEqual([1]);
    r = play(P, r.S, [{ kind: 'resume' }, { kind: 'foul', foul: 'contact', who: 'a2', at: [3, 4] }]);
    expect(r.S.restart).toEqual({ kind: 'free', side: 'b', at: [3, 4] }); expect(r.S.phase).toBe('dead');
    r = play(P, r.S, [{ kind: 'foul', foul: 'dissent', who: 'b1' }, { kind: 'resume' }, { kind: 'tick', dt: 55 }]);
    expect(kinds(r.calls)).toEqual(['foul', 'live', 'period']);
    expect(r.S.phase).toBe('between'); expect(r.S.clock).toMatchObject({ period: 2, t: 0 });
    r = play(P, r.S, [{ kind: 'resume' }, { kind: 'tick', dt: 30 }, { kind: 'score', side: 'b' }, { kind: 'resume' }, { kind: 'tick', dt: 30 }]);
    expect(r.calls.at(-1)).toMatchObject({ kind: 'over', winner: null });
    expect(r.S.phase).toBe('over'); expect(r.S.winner).toBe(null);
  });
  it('overtime when the game names it, and the clock decides the top unit', () => {
    const O = contestRead(periods({ periods: 1, seconds: 10, overtime: 5 }));
    let r = play(O, contestStart(O, 1), [{ kind: 'resume' }, { kind: 'tick', dt: 10 }]);
    expect(kinds(r.calls)).toEqual(['live', 'period', 'overtime']);
    r = play(O, r.S, [{ kind: 'resume' }, { kind: 'tick', dt: 2 }, { kind: 'score', side: 'b' }, { kind: 'resume' }, { kind: 'tick', dt: 3 }]);
    expect(r.calls.at(-1)).toMatchObject({ kind: 'over', winner: 'b' });
  });
});

describe('a meet', () => {
  const R = contestRead(sprint({ lanes: 3 }));
  it('the sprint: set, the gun on the seeded delay, a false start disqualifies, placings by time', () => {
    let S = contestStart(R, 2);
    expect(contestLegal(R, S, 'r1')).toMatchObject({ lane: 1, may: ['wait'] });
    let r = play(R, S, [{ kind: 'press', who: 'r1' }, { kind: 'set' }]);   // a press before the set is nothing
    expect(kinds(r.calls)).toEqual(['set']);
    expect(r.S.gunAt).toBeGreaterThanOrEqual(1.5); expect(r.S.gunAt).toBeLessThan(3);
    r = play(R, r.S, [{ kind: 'tick', dt: 0.5 }, { kind: 'press', who: 'r2' }]);
    expect(r.calls.at(-1)).toEqual({ kind: 'false-start', who: 'r2', warned: false });
    expect(contestLegal(R, r.S, 'r2').may).toEqual([]);
    const gunAt = r.S.gunAt;
    r = play(R, r.S, [{ kind: 'tick', dt: 1 }, { kind: 'tick', dt: 1 }, { kind: 'tick', dt: 1 }]);
    expect(kinds(r.calls)).toEqual(['gun']);
    expect(r.S.phase).toBe('live'); expect(r.S.t).toBeCloseTo(3.5 - gunAt, 9);   // the clock runs from the gun, not from the tick
    r = play(R, r.S, [{ kind: 'tick', dt: 10 }, { kind: 'finish', who: 'r3' }, { kind: 'tick', dt: 0.2 }, { kind: 'finish', who: 'r1' }]);
    expect(kinds(r.calls)).toEqual(['finish', 'finish', 'over']);
    expect(r.S.placings.map((p) => [p.who, p.place, p.dq])).toEqual([['r3', 1, false], ['r1', 2, false], ['r2', null, true]]);
    expect(r.S.placings[1].value - r.S.placings[0].value).toBeCloseTo(0.2, 9);
  });
  it('a warned false start: the first a warning, the second out', () => {
    const W = contestRead(sprint({ lanes: 2, falseStart: 'warn' }));
    const r = play(W, contestStart(W, 2), [{ kind: 'set' }, { kind: 'press', who: 'r1' }, { kind: 'press', who: 'r1' }]);
    expect(kinds(r.calls)).toEqual(['set', 'false-start', 'false-start']);
    expect(r.calls[1].warned).toBe(true); expect(r.calls[2].warned).toBe(false);
    expect(r.S.lanes.r1.state).toBe('dq');
  });
  it('the long jump: attempts, a foul has no mark, the best counts, the gun opens the runway', () => {
    const J = contestRead(longJump({ athletes: 2, attempts: 3 }));
    let r = play(J, contestStart(J, 4), [{ kind: 'set' }, { kind: 'tick', dt: 3 }]);
    expect(kinds(r.calls)).toEqual(['set', 'gun']);
    expect(contestLegal(J, r.S, 'r1')).toMatchObject({ may: ['attempt'], attemptsLeft: 3 });
    r = play(J, r.S, [{ kind: 'mark', who: 'r1', value: 6.1 }, { kind: 'mark', who: 'r2', foul: true }, { kind: 'mark', who: 'r1', value: 7.2 }, { kind: 'mark', who: 'r2', value: 6.9 }, { kind: 'mark', who: 'r1', foul: true }, { kind: 'mark', who: 'r1', value: 9 }]);
    expect(kinds(r.calls).filter((k) => k === 'mark').length).toBe(5);   // the fourth attempt is nothing
    expect(contestLegal(J, r.S, 'r1').may).toEqual([]);
    r = play(J, r.S, [{ kind: 'mark', who: 'r2', value: 7.0 }]);
    expect(r.calls.at(-1).kind).toBe('over');
    expect(r.S.placings.map((p) => [p.who, p.place, p.value])).toEqual([['r1', 1, 7.2], ['r2', 2, 7.0]]);
    expect(r.S.lanes.r2.marks).toEqual([null, 6.9, 7.0]);
  });
});

describe('the kernel is pure, seeded and self-contained', () => {
  it('the same seed and facts are the same contest to the byte; another seed may toss the other way', () => {
    const facts = [...pointToServer, ...pointToReceiver, ...pointToServer];
    const a = play(T, contestStart(T, 9), facts), b = play(T, contestStart(T, 9), facts);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const servers = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => contestStart(T, s).server));
    expect(servers.size).toBe(2);
    const S = contestStart(T, 9), before = JSON.stringify(S);
    contestApply(T, S, serveIn(S));
    expect(JSON.stringify(S)).toBe(before);   // apply never mutates
  });
  it('the closure stands alone: its source runs with no imports and gives the same kernel', () => {
    const src = buildContest.toString();
    expect(src).not.toMatch(/\bimport\b|\brequire\(/);
    const K = new Function(`return (${src})()`)();
    const C = K.read(tennis()), S = K.start(C, 7);
    expect(JSON.stringify(S)).toBe(JSON.stringify(contestStart(T, 7)));
    expect(K.SIDES).toEqual(['a', 'b']);
  });
});
