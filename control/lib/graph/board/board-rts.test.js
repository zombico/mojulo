import { describe, it, expect } from 'vitest';
import { buildBoardRts, readBoardRts, rtsStart, rtsOrder, rtsTrain, rtsBuild, rtsRally, rtsMind, rtsTick, rtsPath, rtsResearch, rtsLockOf, RTS_UNITS, RTS_BUILDINGS } from './board-rts.js';
import { rtsRoster } from './board-rts-tech.js';
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
    // (boards long enough to keep out of reach of the enemy's base, which shoots)
    const B = flat(7, 16), cfg = quiet(B, { workers: 1 });
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
    const B = flat(5, 16), cfg = quiet(B, { workers: 0 });
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
    const B = flat(7, 14), cfg = readBoardRts(B, { nodes: ['B4', 'F11'], ai: { workers: 0, wave: 30 } });
    let R = rtsStart(B, cfg);
    const w = mine(R)[0];
    R = rtsOrder(B, cfg, R, [w.id], { kind: 'gather', node: at(B, 'B4') });
    const { R: E, ev } = run(B, cfg, R, 40);
    const got = ev.filter((e) => e.kind === 'gathered' && e.side === 'player');
    expect(got.length).toBeGreaterThan(2);
    expect(E.gold.player).toBe(100 + got.reduce((n, e) => n + e.amount, 0));
    // (the enemy's workers mine the node by their base: what the player's gave is what they carried home, and carry now)
    expect(E.nodes[0].left).toBe(cfg.nodes[0].amount - got.reduce((n, e) => n + e.amount, 0) - mine(E).reduce((n, u) => n + u.carry, 0));
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

  it('raises a barracks only while a worker builds it, and never one that shuts the bases apart', () => {
    // with no worker to build it, a foundation stands as it was laid
    const B0 = flat(5, 10), c0 = quiet(B0);
    const F = run(B0, c0, rtsBuild(B0, c0, { ...rtsStart(B0, c0), gold: { player: 999, enemy: 0 } }, 'player', 'barracks', at(B0, 'C4')), 30).R;
    expect(F.buildings.find((b) => b.kind === 'barracks').raising).toBe(RTS_BUILDINGS.barracks.time);
    const B = flat(3, 8), cfg = quiet(B, { bases: { player: 'B1', enemy: 'B8' }, workers: 2, enemy: { workers: 0 } });
    let R = { ...rtsStart(B, cfg), gold: { player: 999, enemy: 0 } };
    R = rtsBuild(B, cfg, R, 'player', 'barracks', at(B, 'A4'));
    R = rtsBuild(B, cfg, R, 'player', 'barracks', at(B, 'C4'));
    expect(() => rtsBuild(B, cfg, R, 'player', 'barracks', at(B, 'B4'))).toThrow(/would shut the way between the bases/);
    const bar = R.buildings.find((b) => b.kind === 'barracks');
    expect(() => rtsTrain(B, cfg, R, bar.id, 'soldier')).toThrow(/still going up/);
    // the nearest free worker builds each, and goes back to what it did
    expect(R.units.filter((u) => u.side === 'player').map((u) => u.order.kind)).toEqual(['build', 'build']);
    const { R: E } = run(B, cfg, R, RTS_BUILDINGS.barracks.time + 6);
    expect(E.buildings.find((b) => b.id === bar.id)).toMatchObject({ raising: expect.any(Number), hp: RTS_BUILDINGS.barracks.hp });
    expect(() => rtsTrain(B, cfg, E, bar.id, 'soldier')).not.toThrow();
  });
});

// a side's own roster (as board-rts-tech.js reads one from a civilization): a flyer and siege at its works, a defence
// and a depot to raise
const OWN = {
  units: { ...RTS_UNITS,
    gunship: { name: 'Gunship', role: 'flyer', hp: 110, atk: 9, range: 3, rate: 1.2, speed: 2.4, fly: true, cost: 200, time: 30 },
    crew: { name: 'Cannon crew', role: 'siege', hp: 90, atk: 24, range: 6, rate: 3, speed: 1.2, siege: 3, cost: 180, time: 30, machine: true } },
  buildings: { ...RTS_BUILDINGS,
    works: { name: 'Works', role: 'works', hp: 400, cost: 200, time: 25, needs: 'barracks', trains: ['gunship', 'crew'] },
    tower: { name: 'Tower', role: 'defence', hp: 300, cost: 120, time: 15, atk: 10, range: 4.5, rate: 1.2 },
    depot: { name: 'Depot', role: 'depot', hp: 250, cost: 100, time: 15, depot: true } },
  worker: 'worker', base: 'base', army: ['soldier', 'archer'], builds: ['barracks', 'works'],
};
const own = (B, extra = {}, sides = { player: OWN }) => ({ ...quiet(B, { workers: 2, ...extra }), sides });
// raised: laid, then built by the nearest worker until it stands
const raise = (B, cfg, R, kind, n) => {
  R = rtsBuild(B, cfg, { ...R, gold: { ...R.gold, player: 999 } }, 'player', kind, at(B, n));
  const id = R.buildings[R.buildings.length - 1].id;
  for (let k = 0; k < 1500 && R.buildings.find((b) => b.id === id).raising > 0; k++) R = rtsTick(B, cfg, R, 0.1).R;
  return R;
};

describe('a side\'s own roster', () => {
  it('flies a flyer straight over what walkers go round, out of reach of what strikes from close in', () => {
    // holes across the board but at its edge: a walker goes round by E, a flyer over
    const B = boardOf(Array.from({ length: 12 }, (_, r) => Array.from({ length: 5 }, (_, c) => (r === 5 && c < 4 ? null : 0))));
    const cfg = own(B, { workers: 0 }, { player: OWN, enemy: OWN });
    let R = rtsStart(B, cfg);
    R = { ...R, units: [] };
    const put = (side, kind, n) => { const i = at(B, n), u = { id: 'x' + n, side, kind, hp: OWN.units[kind].hp, x: (i % 5) + 0.5, y: Math.floor(i / 5) + 0.5, at: i, path: [], order: { kind: 'stop' }, cd: 0, carry: 0, mine: 0, again: 0 }; R.units.push(u); };
    put('player', 'gunship', 'A4'); put('player', 'soldier', 'B4');
    R = rtsOrder(B, cfg, R, ['xA4', 'xB4'], { kind: 'move', to: at(B, 'A8') });
    expect(R.units.find((u) => u.id === 'xA4').path).toHaveLength(4);
    expect(R.units.find((u) => u.id === 'xB4').path.length).toBeGreaterThan(8);
    // a soldier told to strike a flyer stands down, and the soldier is not what the flyer is struck by; an archer is
    R = { ...R, units: R.units.slice(0, 1).map((u) => ({ ...u, side: 'enemy', path: [], order: { kind: 'stop' } })) };
    put('player', 'soldier', 'A3'); put('player', 'archer', 'B3');
    const S = run(B, cfg, rtsOrder(B, cfg, R, ['xA3'], { kind: 'attack', target: 'xA4' }), 1);
    expect(S.R.units.find((u) => u.id === 'xA3').order.kind).toBe('stop');
    expect(S.ev.filter((e) => e.kind === 'shot' && e.to === 'xA4').map((e) => e.from)).not.toContain('xA3');
    const A = run(B, cfg, rtsOrder(B, cfg, R, ['xB3'], { kind: 'attack', target: 'xA4' }), 3).ev;
    expect(A.some((e) => e.kind === 'shot' && e.from === 'xB3' && e.to === 'xA4')).toBe(true);
  });

  it('raises its works only after a barracks; siege strikes a building three times as hard', () => {
    const B = flat(5, 12), cfg = own(B);
    let R = { ...rtsStart(B, cfg), gold: { player: 999, enemy: 0 } };
    expect(() => rtsBuild(B, cfg, R, 'player', 'works', at(B, 'A4'))).toThrow(/a Works needs a Barracks standing first/);
    R = raise(B, cfg, R, 'barracks', 'A4');
    expect(() => rtsBuild(B, cfg, R, 'player', 'works', at(B, 'E4'))).not.toThrow();
    const base = R.buildings.find((b) => b.side === 'enemy');
    const p = [(base.at % 5) + 0.5, Math.floor(base.at / 5) - 3.5];
    R.units.push({ id: 'xc', side: 'player', kind: 'crew', hp: 90, x: p[0], y: p[1], at: base.at - 20, path: [], order: { kind: 'stop' }, cd: 0, carry: 0, mine: 0, again: 0 });
    const { ev } = run(B, cfg, rtsOrder(B, cfg, R, ['xc'], { kind: 'attack', target: base.id }), 0.2);
    expect(ev.filter((e) => e.kind === 'shot' && e.from === 'xc')).toHaveLength(1);
    expect(run(B, cfg, rtsOrder(B, cfg, R, ['xc'], { kind: 'attack', target: base.id }), 0.2).R.buildings.find((b) => b.id === base.id).hp).toBe(RTS_BUILDINGS.base.hp - 24 * 3);
  });

  it('shoots from a defence at what comes in range; drops what is mined at the nearer depot', () => {
    const B = flat(7, 18), cfg = own(B, { nodes: ['B10'], workers: 1 });
    let R = raise(B, cfg, rtsStart(B, cfg), 'tower', 'D5');
    // (it holds: idle, its mind would send it off to mine)
    R.units.push({ id: 'xe', side: 'enemy', kind: 'worker', hp: 40, x: 3.5, y: 7.5, at: at(B, 'D8'), path: [], order: { kind: 'hold' }, cd: 0, carry: 0, mine: 0, again: 0 });
    const T = run(B, cfg, R, 20);
    expect(T.ev.some((e) => e.kind === 'shot' && e.to === 'xe')).toBe(true);
    expect(T.R.units.find((u) => u.id === 'xe')).toBeUndefined();
    // a depot beside the node: the worker carries home there, never back to the base
    let D = raise(B, cfg, rtsStart(B, cfg), 'depot', 'D10');
    const w = D.units.find((u) => u.side === 'player');
    D = rtsOrder(B, cfg, D, [w.id], { kind: 'gather', node: at(B, 'B10') });
    let near = Infinity, got = 0;
    for (let k = 0; k < 400; k++) { const o = rtsTick(B, cfg, D, 0.1); D = o.R; got += o.events.filter((e) => e.kind === 'gathered' && e.side === 'player').length; const u = D.units.find((x) => x.id === w.id); if (got) near = Math.min(near, Math.abs(u.y - 1.5)); }
    expect(got).toBeGreaterThan(2);
    expect(near).toBeGreaterThan(5);
  });

  it('composes a building of capabilities: one keep trains, researches and shoots, each of them locked as it says', () => {
    // a keep that is a factory (a guard it trains once Drill is known), a research site (Drill, which waits on a
    // barracks standing) and a stationary unit; a depot besides
    const KEEP = { ...OWN,
      units: { ...OWN.units, guard: { name: 'Guard', role: 'guard', hp: 130, atk: 5, range: 1.2, rate: 1, speed: 1.6, cost: 55, time: 9, needs: 'drill' } },
      buildings: { ...OWN.buildings, keep: { name: 'Keep', role: 'keep', hp: 500, cost: 200, time: 10, trains: ['guard'], studies: ['drill'], atk: 8, range: 4, rate: 1 } },
      research: { drill: { name: 'Drill', cost: 50, time: 5, needs: 'barracks', gives: {} } } };
    const B = flat(7, 18), cfg = own(B, {}, { player: KEEP });
    let R = raise(B, cfg, rtsStart(B, cfg), 'keep', 'D6');
    const keep = R.buildings.find((b) => b.kind === 'keep').id;
    expect(() => rtsTrain(B, cfg, R, keep, 'guard')).toThrow(/a Guard needs Drill researched first/);
    expect(() => rtsResearch(B, cfg, R, keep, 'drill')).toThrow(/Drill needs a Barracks standing first/);
    expect(rtsLockOf(cfg, R, 'player', KEEP.research.drill)).toBe('a Barracks standing');
    R = raise(B, cfg, R, 'barracks', 'A6');
    R = rtsResearch(B, cfg, { ...R, gold: { ...R.gold, player: 999 } }, keep, 'drill');
    expect(() => rtsResearch(B, cfg, R, R.buildings.find((b) => b.kind === 'barracks').id, 'drill')).toThrow(/Drill is researched at the Keep, not the Barracks/);
    R = run(B, cfg, R, 5.2).R;
    expect(() => rtsTrain(B, cfg, R, keep, 'guard')).not.toThrow();
    // and it shoots what comes in its range
    R.units.push({ id: 'xe', side: 'enemy', kind: 'worker', hp: 40, x: 3.5, y: 8.5, at: at(B, 'D9'), path: [], order: { kind: 'hold' }, cd: 0, carry: 0, mine: 0, again: 0 });
    expect(run(B, cfg, R, 3).ev.some((e) => e.kind === 'shot' && e.from === keep && e.to === 'xe')).toBe(true);
  });

  it('builds faster with more workers at it; repairs a building or a machine for gold, then back to mining', () => {
    const B = flat(7, 18), cfg = own(B, { workers: 3, nodes: ['B5'] });
    const lay = (n) => { let R = rtsStart(B, cfg); R = { ...R, gold: { ...R.gold, player: 999 } }; const ws = R.units.filter((u) => u.side === 'player').slice(0, n).map((u) => u.id); R = rtsBuild(B, cfg, R, 'player', 'barracks', at(B, 'E5'), ws); let t = 0; while (R.buildings.find((b) => b.kind === 'barracks').raising > 0 && t < 120) { R = rtsTick(B, cfg, R, 0.1).R; t += 0.1; } return t; };
    const one = lay(1), three = lay(3);
    expect(three).toBeLessThan(one * 0.6);
    // a worker mining, sent to mend the base: it pays a gold each ten hp, and goes back to the node
    let R = rtsStart(B, cfg);
    const w = R.units.find((u) => u.side === 'player').id, base = R.buildings.find((b) => b.side === 'player');
    R = rtsOrder(B, cfg, R, [w], { kind: 'gather', node: at(B, 'B5') });
    R = { ...R, buildings: R.buildings.map((b) => (b.id === base.id ? { ...b, hp: b.hp - 100 } : b)), gold: { ...R.gold, player: 50 } };
    R = rtsOrder(B, cfg, R, [w], { kind: 'repair', target: base.id });
    const E = run(B, cfg, R, 60);
    expect(E.R.buildings.find((b) => b.id === base.id).hp).toBe(base.hpMax);
    expect(E.ev.some((e) => e.kind === 'repaired' && e.id === base.id)).toBe(true);
    expect(E.R.units.find((u) => u.id === w).order.kind).toBe('gather');
    // a machine is mended too; a soldier is not
    R = rtsStart(B, cfg);
    R.units.push({ id: 'xc', side: 'player', kind: 'crew', hp: 40, x: 3.5, y: 4.5, at: at(B, 'D5'), path: [], order: { kind: 'hold' }, cd: 0, carry: 0, mine: 0, again: 0 });
    R.units.push({ id: 'xs', side: 'player', kind: 'soldier', hp: 40, x: 4.5, y: 4.5, at: at(B, 'E5'), path: [], order: { kind: 'hold' }, cd: 0, carry: 0, mine: 0, again: 0 });
    const ws = R.units.filter((u) => u.side === 'player' && u.kind === 'worker').map((u) => u.id);
    const C = run(B, cfg, rtsOrder(B, cfg, rtsOrder(B, cfg, R, ws.slice(0, 1), { kind: 'repair', target: 'xc' }), ws.slice(1, 2), { kind: 'repair', target: 'xs' }), 40).R;
    expect([C.units.find((u) => u.id === 'xc').hp, C.units.find((u) => u.id === 'xs').hp]).toEqual([90, 40]);
  });

  it('is a draw when the gold is gone and nobody stands on either side', () => {
    const B = flat(5, 10), cfg = readBoardRts(B, { nodes: 0, gold: 0, workers: 0, ai: { workers: 0, wave: 30 } });
    expect(rtsTick(B, cfg, rtsStart(B, cfg), 0.1).R.over).toEqual({ won: false, draw: true });
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
