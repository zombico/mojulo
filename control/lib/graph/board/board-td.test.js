import { describe, it, expect } from 'vitest';
import { buildBoardTd, readBoardTd, tdStart, tdLegal, tdPlace, tdSell, tdCall, tdTick, tdRoute, tdField, TD_TOWERS, TD_FOES, TD_WAVES } from './board-td.js';
import { boardOf, boardParse } from './board-kernel.js';

const flat = (cols, rows) => boardOf(Array.from({ length: rows }, () => Array(cols).fill(0)));
const at = (B, n) => boardParse(B, n);
// run the defence `secs` seconds in frames of `dt`, gathering its events
function run(B, cfg, T, secs, dt = 0.05) {
  const ev = [];
  for (let t = 0; t < secs - 1e-9 && !T.over; t += dt) { const o = tdTick(B, cfg, T, dt); T = o.T; ev.push(...o.events); }
  return { T, ev };
}
const one = (kind, n, extra = {}) => [{ foes: Array(n).fill(kind), every: 1, after: 0, ...extra }];

describe('a defence read from a board', () => {
  it('spawns in the far row and guards a base in the near one by default, the ladder\'s waves, a purse and lives', () => {
    const B = flat(5, 6), cfg = readBoardTd(B, {});
    expect([cfg.spawns, cfg.base]).toEqual([[at(B, 'C6')], at(B, 'C1')]);
    expect(cfg.waves.length).toBe(TD_WAVES.length);
    expect(cfg.waves[cfg.waves.length - 1].after).toBe(0);
    expect([cfg.gold, cfg.lives, cfg.towers]).toEqual([40, 10, Object.keys(TD_TOWERS)]);
    expect(readBoardTd(B, { waves: 2, spawns: ['A6', 'E6'], base: 'C2', waves: [{ foes: { grunt: 2, runner: 1 } }] }).waves).toEqual([{ foes: ['grunt', 'grunt', 'runner'], every: 1, after: 0 }]);
  });

  it('refuses what it cannot defend, saying why', () => {
    const B = flat(4, 4);
    expect(() => readBoardTd(B, { base: 'Z9' })).toThrow(/base 'Z9' is not a spot a foe can stand on/);
    expect(() => readBoardTd(B, { spawns: ['B4'], base: 'B4' })).toThrow(/the base is not a spawn/);
    expect(() => readBoardTd(B, { waves: [{ foes: { dragon: 2 } }] })).toThrow(/'dragon' is no foe/);
    expect(() => readBoardTd(B, { towers: ['laser'] })).toThrow(/towers are some of/);
    expect(() => readBoardTd(B, { siege: true })).toThrow(/'siege' is not part of a defence/);
    // a wall across the board: the spawn shut off from the base
    const W = boardOf([[0, 0, 0], [null, null, null], [0, 0, 0]]);
    expect(() => readBoardTd(W, {})).toThrow(/a spawn has no way to the base/);
  });
});

describe('the defence\'s laws', () => {
  it('lets a tower stand only where the road stays open: the last gap in a wall is never offered, and refused', () => {
    const B = flat(5, 5), cfg = readBoardTd(B, { spawns: ['C5'], base: 'C1' });
    let T = { ...tdStart(B, cfg), gold: 999 };
    for (const n of ['A3', 'B3', 'C3', 'D3']) T = tdPlace(B, cfg, T, at(B, n), 'arrow');
    expect(tdLegal(B, cfg, T)).not.toContain(at(B, 'E3'));
    expect(() => tdPlace(B, cfg, T, at(B, 'E3'), 'arrow')).toThrow(/would shut the road/);
    // never the base, a spawn or a tower's own spot
    for (const n of ['C1', 'C5', 'A3']) expect(tdLegal(B, cfg, T)).not.toContain(at(B, n));
  });

  it('bends the road round the towers: a maze a longer walk, and the foes walk it', () => {
    const B = flat(5, 7), cfg = readBoardTd(B, { spawns: ['C7'], base: 'C1', waves: one('grunt', 1), first: 0 });
    const T0 = { ...tdStart(B, cfg), gold: 999 };
    const straight = tdRoute(B, cfg, T0, at(B, 'C7')).length;
    let T = T0;
    for (const n of ['A5', 'B5', 'C5', 'D5', 'B3', 'C3', 'D3', 'E3']) T = tdPlace(B, cfg, T, at(B, n), 'frost');
    const maze = tdRoute(B, cfg, T, at(B, 'C7'));
    expect(maze.length).toBeGreaterThan(straight + 4);
    expect(maze.some((i) => T.towers[i])).toBe(false);
    expect(tdField(B, cfg, T)[at(B, 'C7')]).toBe(maze.length - 1);
  });

  it('loses lives as foes reach the base, and is lost with none left; won when every wave is out and down', () => {
    const B = flat(3, 6), lose = readBoardTd(B, { waves: one('runner', 3), lives: 2, first: 0 });
    const L = run(B, lose, tdStart(B, lose), 60);
    expect(L.T.over).toEqual({ won: false });
    expect(L.ev.filter((e) => e.kind === 'leak').map((e) => e.lives)).toEqual([1, 0]);
    const win = readBoardTd(B, { waves: one('runner', 3), first: 2 });
    let T = tdStart(B, win);
    for (const n of ['A3', 'C3', 'A4']) T = tdPlace(B, win, T, at(B, n), 'arrow');
    const W = run(B, win, T, 90);
    expect(W.T.over).toEqual({ won: true });
    expect(W.T.lives).toBe(10);
    expect(W.T.gold).toBe(40 - 3 * TD_TOWERS.arrow.cost + 3 * TD_FOES.runner.bounty);
  });

  it('is the same game for the same builds at the same times, however the time is cut', () => {
    const B = flat(5, 7), cfg = readBoardTd(B, { waves: 2, first: 3 });
    // builds at whole seconds, played in frames of dt: each before the frame that starts at its time
    const builds = [[0, 'B4', 'arrow'], [1, 'D4', 'cannon'], [20, 'C3', 'frost']];
    const play = (dt) => {
      let T = tdStart(B, cfg);
      const ev = [];
      for (let k = 0; k * dt < 120 && !T.over; k++) {
        const t = Math.round(k * dt * 1e6) / 1e6;
        for (const [bt, n, kind] of builds) if (bt === t) T = tdPlace(B, cfg, T, at(B, n), kind);
        const o = tdTick(B, cfg, T, dt);
        T = o.T;
        ev.push(...o.events);
      }
      return { over: T.over, lives: T.lives, gold: T.gold, t: Math.round(T.t * 1e6) / 1e6, events: ev.map((e) => e.kind).join(',') };
    };
    const fine = play(0.05);
    expect(fine.over).not.toBeNull();
    expect(play(0.05)).toEqual(fine);
    expect(play(0.1)).toEqual(fine);
  });

  it('splashes a cannon\'s blow on everyone near, and a frost tower slows who it hits', () => {
    const B = flat(3, 8), cfg = readBoardTd(B, { waves: [{ foes: ['brute', 'brute'], every: 0.2, after: 0 }], first: 0, lives: 99 });
    let T = { ...tdStart(B, cfg), gold: 999 };
    T = tdPlace(B, cfg, T, at(B, 'A5'), 'cannon');
    const { ev } = run(B, cfg, T, 6);
    const first = ev.find((e) => e.kind === 'shot'), hits = ev.filter((e) => e.kind === 'hit' && ev.indexOf(e) > ev.indexOf(first) && ev.indexOf(e) <= ev.indexOf(first) + 2);
    expect(new Set(hits.map((e) => e.target)).size).toBe(2);
    // the same brute, chilled or not: the chilled one reaches the base later
    const reach = (towers) => {
      const c = readBoardTd(B, { waves: one('brute', 1), first: 0, lives: 99 });
      let S = { ...tdStart(B, c), gold: 999 };
      for (const [n, k] of towers) S = tdPlace(B, c, S, at(B, n), k);
      const o = run(B, c, S, 60);
      return o.T.t;
    };
    expect(reach([['A6', 'frost']])).toBeGreaterThan(reach([]));
  });

  it('sells a tower for half and frees its spot; calls the next wave early for its waiting time\'s gold', () => {
    const B = flat(4, 5), cfg = readBoardTd(B, { first: 10 });
    let T = tdPlace(B, cfg, tdStart(B, cfg), at(B, 'A2'), 'cannon');
    T = tdSell(B, cfg, T, at(B, 'A2'));
    expect([T.gold, T.towers]).toEqual([40 - 18 + 9, {}]);
    expect(() => tdSell(B, cfg, T, at(B, 'A2'))).toThrow(/no tower there/);
    const C = tdCall(B, cfg, T);
    expect([C.gold, C.clock]).toEqual([T.gold + 5, 0]);
    expect(tdTick(B, cfg, C, 0.05).events[0]).toEqual({ kind: 'wave', n: 1 });
    expect(() => tdPlace(B, cfg, { ...T, gold: 3 }, at(B, 'A2'), 'arrow')).toThrow(/10 gold for a Arrow tower, 3 in the purse/);
  });

  it('never builds on a foe, nor on the spot it is stepping onto', () => {
    const B = flat(3, 6), cfg = readBoardTd(B, { waves: one('grunt', 1), first: 0 });
    const { T } = run(B, cfg, tdStart(B, cfg), 1.2);
    const f = T.foes[0];
    expect(tdLegal(B, cfg, T)).not.toContain(f.at);
    expect(tdLegal(B, cfg, T)).not.toContain(f.to);
  });

  it('is a defence to play: standing by loses the ladder, a plain builder (a tower beside the road when it can) holds it', () => {
    const B = flat(8, 10), cfg = readBoardTd(B, {});
    const play = (build) => {
      let T = tdStart(B, cfg);
      for (let s = 0; s < 3000 && !T.over; s++) {
        if (build && T.gold >= TD_TOWERS.arrow.cost) {
          const road = tdRoute(B, cfg, T, cfg.spawns[0]), beside = (i) => road.some((r) => Math.abs((r % 8) - (i % 8)) + Math.abs(Math.floor(r / 8) - Math.floor(i / 8)) === 1);
          const L = tdLegal(B, cfg, T).filter((i) => !road.includes(i) && beside(i));
          if (L.length) T = tdPlace(B, cfg, T, L[0], 'arrow');
        }
        T = tdTick(B, cfg, T, 0.1).T;
      }
      return T.over;
    };
    expect(play(false)).toEqual({ won: false });
    expect(play(true)).toEqual({ won: true });
  });

  it('runs from its own source, as the page runs it', () => {
    const page = new Function(`return (${buildBoardTd.toString()})();`)();
    const B = flat(4, 6), cfg = readBoardTd(B, { waves: 1, first: 1 });
    let a = tdPlace(B, cfg, tdStart(B, cfg), at(B, 'B3'), 'arrow'), b = page.place(B, cfg, page.start(B, cfg), at(B, 'B3'), 'arrow');
    for (let k = 0; k < 400; k++) { a = tdTick(B, cfg, a, 0.05).T; b = page.tick(B, cfg, b, 0.05).T; }
    expect(b).toEqual(a);
  });
});
