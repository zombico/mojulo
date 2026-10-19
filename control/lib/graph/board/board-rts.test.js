import { describe, it, expect } from 'vitest';
import { buildBoardRts, readBoardRts, rtsStart, rtsOrder, rtsTrain, rtsBuild, rtsRally, rtsMind, rtsTick, rtsPath, RTS_UNITS, RTS_BUILDINGS } from './board-rts.js';
import { boardOf, boardParse } from './board-kernel.js';

const flat = (cols, rows) => boardOf(Array.from({ length: rows }, () => Array(cols).fill(0)));
const at = (B, n) => boardParse(B, n);
function run(B, cfg, R, secs, each) {
  const ev = [];
  for (let k = 0; k * 0.1 < secs - 1e-9 && !R.over; k++) { if (each) R = each(R, k); const o = rtsTick(B, cfg, R, 0.1); R = o.R; ev.push(...o.events); }
  return { R, ev };
}
// a quiet enemy: no workers, no army, its mind with nothing to do (a wave it never reaches)
const quiet = (B, extra = {}) => readBoardRts(B, { workers: 0, nodes: 0, ai: { workers: 0, wave: 30 }, ...extra });
const mine = (R, side = 'player') => R.units.filter((u) => u.side === side);

describe('a skirmish read from a board', () => {
  it('sets the player\'s base a row in on the near side and the enemy\'s on the far, nodes beside each, a purse and workers', () => {
    const B = flat(9, 12), cfg = readBoardRts(B, {});
    expect([cfg.bases.player, cfg.bases.enemy]).toEqual([at(B, 'E2'), at(B, 'E11')]);
    expect(cfg.nodes).toHaveLength(4);
    const R = rtsStart(B, cfg);
    expect(mine(R).map((u) => u.kind)).toEqual(['worker', 'worker', 'worker']);
    expect(R.buildings.map((b) => [b.side, b.kind])).toEqual([['player', 'base'], ['enemy', 'base']]);
  });

  it('refuses what it cannot play, saying why', () => {
    const B = flat(6, 8);
    expect(() => readBoardRts(B, { bases: { player: 'Z9' } })).toThrow(/bases.player 'Z9' is not a spot to stand on/);
    expect(() => readBoardRts(B, { bases: { player: 'C3', enemy: 'C3' } })).toThrow(/two bases are two spots/);
    expect(() => readBoardRts(B, { siege: 1 })).toThrow(/'siege' is not part of a skirmish/);
    expect(() => readBoardRts(B, { ai: { mood: 'angry' } })).toThrow(/ai.mood is not part of it/);
    expect(() => readBoardRts(B, { enemy: { lives: 3 } })).toThrow(/enemy.lives is not part of it/);
    // a handicap: the other side's own start
    const R = rtsStart(B, readBoardRts(B, { gold: 200, enemy: { gold: 50, workers: 1, army: 2 } }));
    expect([R.gold, mine(R, 'enemy').map((u) => u.kind)]).toEqual([{ player: 200, enemy: 50 }, ['worker', 'soldier', 'archer']]);
    const W = boardOf([[0, 0, 0], [null, null, null], [0, 0, 0]]);
    expect(() => readBoardRts(W, { bases: { player: 'B1', enemy: 'B3' } })).toThrow(/the bases have no way to each other/);
  });
});

describe('orders', () => {
  it('walks a move round buildings and nodes, never through, and stands idle at its end', () => {
    const B = flat(7, 9), cfg = quiet(B, { workers: 1 });
    let R = rtsStart(B, cfg);
    R = { ...R, gold: { player: 999, enemy: 0 } };
    for (const n of ['B5', 'C5', 'D5', 'E5', 'F5']) R = rtsBuild(B, cfg, R, 'player', 'barracks', at(B, n));
    const u = mine(R)[0], p = rtsPath(B, cfg, R, u.at, at(B, 'D7'));
    expect(p.some((i) => R.buildings.some((b) => b.at === i))).toBe(false);
    R = rtsOrder(B, cfg, R, [u.id], { kind: 'move', to: at(B, 'D7') });
    const { R: E } = run(B, cfg, R, 20);
    const w = mine(E)[0];
    expect([w.at, w.order.kind]).toEqual([at(B, 'D7'), 'stop']);
  });

  it('fights on an attack-move and goes on; holds its ground on hold; chases what it is told to attack', () => {
    const B = flat(5, 12), cfg = quiet(B, { workers: 0 });
    let R = rtsStart(B, cfg);
    R = { ...R, units: [], n: 50 };
    const put = (side, kind, n) => { const p = [ (at(B, n) % 5) + 0.5, Math.floor(at(B, n) / 5) + 0.5 ]; R.units.push({ id: 'x' + n, side, kind, hp: RTS_UNITS[kind].hp, x: p[0], y: p[1], at: at(B, n), path: [], order: { kind: 'stop' }, cd: 0, carry: 0, mine: 0, again: 0 }); };
    put('player', 'soldier', 'C3'); put('enemy', 'worker', 'C6');
    // attack-move past the worker: it is fought, then the soldier goes on to C9
    let A = rtsOrder(B, cfg, R, ['xC3'], { kind: 'amove', to: at(B, 'C9') });
    const a = run(B, cfg, A, 30).R;
    expect(a.units.find((u) => u.id === 'xC6')).toBeUndefined();
    expect(a.units.find((u) => u.id === 'xC3').at).toBe(at(B, 'C9'));
    // hold: the archer never moves, the worker out of its range never struck
    R.units = R.units.slice(0, 1).map((u) => ({ ...u, kind: 'archer', hp: 50 }));
    put('enemy', 'worker', 'C9');
    const H = run(B, cfg, rtsOrder(B, cfg, R, ['xC3'], { kind: 'hold' }), 10).R;
    expect([H.units.find((u) => u.id === 'xC3').at, H.units.find((u) => u.id === 'xC9').hp]).toEqual([at(B, 'C3'), RTS_UNITS.worker.hp]);
    // attack: it chases the worker down
    const K = run(B, cfg, rtsOrder(B, cfg, R, ['xC3'], { kind: 'attack', target: 'xC9' }), 30).R;
    expect(K.units.find((u) => u.id === 'xC9')).toBeUndefined();
  });

  it('gathers: a worker mines a node and carries it home into the purse, again and again', () => {
    const B = flat(7, 10), cfg = readBoardRts(B, { nodes: ['B4'], ai: { workers: 0, wave: 30 } });
    let R = rtsStart(B, cfg);
    const w = mine(R)[0];
    R = rtsOrder(B, cfg, R, [w.id], { kind: 'gather', node: at(B, 'B4') });
    const { R: E, ev } = run(B, cfg, R, 40);
    const got = ev.filter((e) => e.kind === 'gathered' && e.side === 'player');
    expect(got.length).toBeGreaterThan(2);
    expect(E.gold.player).toBe(100 + got.reduce((n, e) => n + e.amount, 0));
    // (the enemy's workers mine the same node: what it gave is what both carried home, and what they carry now)
    const all = ev.filter((e) => e.kind === 'gathered').reduce((n, e) => n + e.amount, 0);
    expect(E.nodes[0].left).toBe(400 - all - E.units.reduce((n, u) => n + u.carry, 0));
  });

  it('trains at a building for gold, out beside it, and on to its rally point', () => {
    // (a long board: the rally point out of sight of the enemy's base, so the new worker stays where it is sent)
    const B = flat(7, 16), cfg = quiet(B);
    let R = rtsStart(B, cfg);
    const base = R.buildings.find((b) => b.side === 'player');
    R = rtsRally(B, cfg, rtsTrain(B, cfg, R, base.id, 'worker'), base.id, at(B, 'D6'));
    expect(R.gold.player).toBe(100 - RTS_UNITS.worker.cost);
    expect(() => rtsTrain(B, cfg, R, base.id, 'soldier')).toThrow(/a Base does not train a soldier/);
    expect(() => rtsTrain(B, cfg, { ...R, gold: { player: 3, enemy: 0 } }, base.id, 'worker')).toThrow(/50 gold for a Worker, 3 in the purse/);
    const { R: E, ev } = run(B, cfg, R, RTS_UNITS.worker.time + 6);
    const id = ev.find((e) => e.kind === 'trained').id;
    expect(E.units.find((u) => u.id === id).at).toBe(at(B, 'D6'));
  });

  it('raises a barracks over time before it trains, and never one that shuts the bases apart', () => {
    const B = flat(3, 8), cfg = quiet(B, { bases: { player: 'B1', enemy: 'B8' } });
    let R = { ...rtsStart(B, cfg), gold: { player: 999, enemy: 0 } };
    R = rtsBuild(B, cfg, R, 'player', 'barracks', at(B, 'A4'));
    R = rtsBuild(B, cfg, R, 'player', 'barracks', at(B, 'C4'));
    expect(() => rtsBuild(B, cfg, R, 'player', 'barracks', at(B, 'B4'))).toThrow(/would shut the way between the bases/);
    const bar = R.buildings.find((b) => b.kind === 'barracks');
    expect(() => rtsTrain(B, cfg, R, bar.id, 'soldier')).toThrow(/still going up/);
    const { R: E } = run(B, cfg, R, RTS_BUILDINGS.barracks.time + 0.5);
    expect(E.buildings.find((b) => b.id === bar.id)).toMatchObject({ raising: expect.any(Number), hp: RTS_BUILDINGS.barracks.hp });
    expect(() => rtsTrain(B, cfg, E, bar.id, 'soldier')).not.toThrow();
  });
});

describe('the skirmish\'s laws', () => {
  it('is the same game for the same orders at the same times, however the time is cut', () => {
    const B = flat(9, 12), cfg = readBoardRts(B, { ai: { wave: 3 } });
    const play = (dt) => {
      let R = rtsStart(B, cfg);
      const ws = mine(R).map((u) => u.id), node = cfg.nodes[0].at;
      R = rtsOrder(B, cfg, R, ws, { kind: 'gather', node });
      for (let k = 0; k * dt < 200 && !R.over; k++) R = rtsTick(B, cfg, R, dt).R;
      return { over: R.over, gold: R.gold, n: R.n, units: R.units.length, t: Math.round(R.t * 1e6) / 1e6 };
    };
    const fine = play(0.1);
    expect(play(0.1)).toEqual(fine);
    expect(play(0.2)).toEqual(fine);
  });

  it('is a skirmish to play: the mind left alone takes the base; a plain player (the same mind for it) holds and wins', () => {
    const B = flat(9, 12), cfg = readBoardRts(B, { ai: { wave: 4 } });
    const alone = run(B, cfg, rtsStart(B, cfg), 900).R;
    expect(alone.over).toEqual({ won: false });
    // the player played by the plain mind too, with a head start of gold: it holds the waves and takes the base
    const head = { ...rtsStart(B, cfg), gold: { player: 250, enemy: 100 } };
    const both = run(B, cfg, head, 1500, (R, k) => (k % 10 === 0 ? rtsMind(B, cfg, R, 'player') : R)).R;
    expect(both.over).toEqual({ won: true });
  });

  it('runs from its own source, as the page runs it', () => {
    const page = new Function(`return (${buildBoardRts.toString()})();`)();
    const B = flat(9, 12), cfg = readBoardRts(B, {});
    let a = rtsStart(B, cfg), b = page.start(B, cfg);
    for (let k = 0; k < 600; k++) { a = rtsTick(B, cfg, a, 0.1).R; b = page.tick(B, cfg, b, 0.1).R; }
    expect(b).toEqual(a);
  });
});
