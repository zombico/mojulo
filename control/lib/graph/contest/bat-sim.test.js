// The bat sim: a bat-and-ball game as a pure function of two pads, the kernel its referee. The concepts: the same pads
// are the same game; the swing is timed (a press in its window strikes the ball, early or late misses it); a ball let go
// is a strike in the zone, pitched again out of it, a dot or bowled in a game of runs; every struck ball ends in exactly
// one fact the kernel rules (read ahead the moment it is struck); an exhibition plays to its end.
import { describe, it, expect } from 'vitest';
import { inningsArenaData } from './innings-arena.js';
import { batContext, newBat, stepBat, cloneBat, batDisplay, BPAD, BAT_REGISTER_IDS } from './bat-sim.js';

const ctxOf = (v) => batContext(inningsArenaData({ register: 'action', seed: 2, ...v }));
const RULED = ['strike', 'dot', 'out', 'base-hit', 'runs'];
// both sides held: the fielding side lets the ball go, then the batter presses `at` frames into the pitch (never: null)
function ball(ctx, at) {
  let S = newBat(ctx);
  const field = S.K.batting === 'a' ? 1 : 0;
  for (let i = 0; i < 200 && S.phase === 'ready'; i++) { const p = [{ x: 0, y: 0, b: 0 }, { x: 0, y: 0, b: 0 }]; p[field].b = BPAD.SWING; stepBat(S, p, ctx); }
  const n0 = S.calls.length;
  for (let k = 0; k < 400 && S.dead === 0 && !S.calls.slice(n0).some((c) => RULED.includes(c.kind) || c.kind === 'ball'); k++) {
    const p = [{ x: 0, y: 0, b: 0 }, { x: 0, y: 0, b: 0 }];
    if (at !== null && k === at) p[1 - field].b = BPAD.SWING;
    stepBat(S, p, ctx);
  }
  return S.calls.slice(n0);
}

describe('the bat sim', () => {
  it('reads its context and names its registers', () => {
    expect(BAT_REGISTER_IDS).toContain('realistic');
    expect(() => batContext({})).toThrow(/a context is/);
    expect(() => batContext({ ...inningsArenaData({}), register: 'mosh' })).toThrow(/register/);
  });

  it('the same pads are the same game: an exhibition replays to the byte', () => {
    const ctx = ctxOf({ sport: 'baseball', players: 0, innings: 1 });
    const A = newBat(ctx), B = newBat(ctx);
    for (let i = 0; i < 1200; i++) { stepBat(A, [], ctx); stepBat(B, [], ctx); }
    expect(JSON.stringify(A)).toBe(JSON.stringify(B));
    const C = cloneBat(A);
    for (let i = 0; i < 300; i++) { stepBat(A, [], ctx); stepBat(C, [], ctx); }
    expect(JSON.stringify(C)).toBe(JSON.stringify(A));
  });

  it('the swing is timed: a press in its window strikes the ball, early or late a strike', () => {
    const ctx = ctxOf({ sport: 'baseball', players: 2 });
    const struck = [];
    for (let at = 0; at < 60; at++) if (ball(ctx, at).some((c) => c.kind === 'hit-ball')) struck.push(at);
    expect(struck.length).toBeGreaterThan(0);
    expect(struck.at(-1) - struck[0]).toBe(struck.length - 1);   // one window, unbroken
    expect(struck.length).toBeLessThan(12);
    expect(ball(ctx, 0).find((c) => c.kind === 'strike')).toMatchObject({ why: 'missed' });
    const let_ = ball(ctx, null);
    expect(let_.some((c) => (c.kind === 'strike' && c.why === 'looking') || c.kind === 'ball')).toBe(true);
  });

  it('a game of runs: a ball let go is a dot or bowled, never a strike', () => {
    const ctx = ctxOf({ sport: 'cricket', players: 2, overs: 1 });
    const calls = ball(ctx, null);
    expect(calls.some((c) => c.kind === 'dot' || (c.kind === 'out' && c.why === 'bowled'))).toBe(true);
    expect(calls.some((c) => c.kind === 'strike')).toBe(false);
  });

  for (const [sport, words] of [['baseball', { innings: 1 }], ['cricket', { overs: 1 }]]) {
    it(`${sport}: an exhibition plays to its end, every struck ball ruled once`, () => {
      const ctx = ctxOf({ sport, players: 0, ...words });
      const S = newBat(ctx);
      for (let i = 0; i < 60 * 240 && !S.over; i++) stepBat(S, [], ctx);
      expect(S.over).toBe(true);
      expect(S.calls.at(-1).kind).toBe('over');
      const seq = S.calls.filter((c) => c.kind === 'hit-ball' || RULED.includes(c.kind));
      seq.forEach((c, i) => { if (c.kind === 'hit-ball') expect(RULED).toContain(seq[i + 1].kind); });
      expect(seq.some((c) => c.kind === 'hit-ball')).toBe(true);
      const d = batDisplay(S, ctx);
      expect(d.innings.runs[d.innings.first].length).toBe(1);
      expect(Number(d.score.a[0]) + Number(d.score.b[0])).toBe(S.K.total.a + S.K.total.b);
    });
  }
});
