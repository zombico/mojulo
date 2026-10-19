import { describe, it, expect } from 'vitest';
import { buildBoardRts, readBoardRts, rtsStart, rtsOrder, rtsTrain, rtsBuild, rtsRally, rtsMind, rtsTick, rtsPath, rtsResearch, rtsUpgrade, rtsLockOf, rtsAct, rtsReplay, rtsApm, rtsStepOf, RTS_LEVELS, RTS_UNITS, RTS_BUILDINGS, RTS_VICTORY, rtsView } from './board-rts.js';
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
    expect(() => rtsTrain(B, cfg, { ...R, gold: { player: 3, enemy: 0 } }, base.id, 'worker')).toThrow(/50 gold for a Worker, 3 gold in the purse/);
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
    crew: { name: 'Cannon crew', role: 'siege', hp: 90, atk: 24, range: 6, rate: 3, speed: 1.2, siege: 3, cost: 180, time: 30, machine: true },
    lifter: { name: 'Lifter', role: 'transport', hp: 150, atk: 0, range: 0, rate: 1, speed: 2.6, fly: true, carries: 2, cost: 90, time: 15, machine: true },
    medic: { name: 'Medic', role: 'medic', hp: 60, atk: 0, range: 3, rate: 1, speed: 2, heals: 4, cost: 50, time: 9 } },
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

  it('carries units without a weapon: a flying transport boards them, crosses what they cannot, unloads; they fall with it', () => {
    // a row of holes across the whole board but one spot at its edge (far round); the flyer goes straight over
    const B = boardOf(Array.from({ length: 16 }, (_, r) => Array.from({ length: 5 }, (_, c) => (r === 7 && c < 4 ? null : 0))));
    const cfg = own(B, { workers: 0 });
    let R = { ...rtsStart(B, cfg), units: [] };
    const put = (side, kind, n, hp) => { const i = at(B, n); R.units.push({ id: 'x' + n, side, kind, hp: hp ?? OWN.units[kind].hp, x: (i % 5) + 0.5, y: Math.floor(i / 5) + 0.5, at: i, path: [], order: { kind: 'hold' }, cd: 0, carry: 0, mine: 0, again: 0 }); };
    put('player', 'lifter', 'B5'); put('player', 'soldier', 'B4'); put('player', 'archer', 'C4'); put('player', 'soldier', 'A4');
    // two board (it carries two); the third finds no room
    R = rtsOrder(B, cfg, rtsOrder(B, cfg, R, ['xB4', 'xC4'], { kind: 'board', target: 'xB5' }), ['xA4'], { kind: 'board', target: 'xB5' });
    expect(() => rtsOrder(B, cfg, R, ['xB5'], { kind: 'attack', target: 'xA4' })).not.toThrow();
    let E = run(B, cfg, R, 4).R;
    expect(E.units.find((u) => u.id === 'xB5').cargo).toEqual(['xB4', 'xC4']);
    expect(E.units.find((u) => u.id === 'xA4').inside).toBeUndefined();
    // over the holes, out on the far side
    const T = run(B, cfg, rtsOrder(B, cfg, E, ['xB5'], { kind: 'unload', to: at(B, 'B10') }), 10);
    E = T.R;
    expect(T.ev.filter((e) => e.kind === 'unloaded').map((e) => e.id)).toEqual(['xB4', 'xC4']);
    expect(E.units.filter((u) => ['xB4', 'xC4'].includes(u.id)).every((u) => !u.inside && Math.floor(u.y) >= 8)).toBe(true);
    // loaded again and shot down: what it carried falls with it, and nothing struck at them inside
    E = run(B, cfg, rtsOrder(B, cfg, E, ['xB4'], { kind: 'board', target: 'xB5' }), 4).R;
    const shot = run(B, cfg, { ...E, units: E.units.map((u) => (u.id === 'xB5' ? { ...u, hp: 0 } : u)) }, 0.1);
    expect(shot.ev.filter((e) => e.kind === 'down').map((e) => e.id).sort()).toEqual(['xB4', 'xB5']);
  });

  it('mends its own with a medic, never a machine, and strikes at nothing', () => {
    const B = flat(5, 16), cfg = own(B, { workers: 0 });
    let R = { ...rtsStart(B, cfg), units: [] };
    const put = (side, kind, n, hp) => { const i = at(B, n); R.units.push({ id: 'x' + n, side, kind, hp, x: (i % 5) + 0.5, y: Math.floor(i / 5) + 0.5, at: i, path: [], order: { kind: 'hold' }, cd: 0, carry: 0, mine: 0, again: 0 }); };
    put('player', 'medic', 'C5', 60); put('player', 'soldier', 'C6', 20); put('player', 'crew', 'D5', 30); put('enemy', 'worker', 'C7', 40);
    const E = run(B, cfg, rtsOrder(B, cfg, R, ['xC5'], { kind: 'stop' }), 20);
    expect([E.R.units.find((u) => u.id === 'xC6').hp, E.R.units.find((u) => u.id === 'xD5').hp]).toEqual([80, 30]);
    expect(E.ev.some((e) => e.kind === 'shot' && e.from === 'xC5')).toBe(false);
    expect(E.ev.some((e) => e.kind === 'healed' && e.from === 'xC5' && e.to === 'xC6')).toBe(true);
  });

  it('transforms: siege deploys to fire farther and stands still; a base grows into its fort; what comes folded is set up', () => {
    const SHIFT = { ...OWN,
      units: { ...OWN.units, crew: { ...OWN.units.crew, modes: { deployed: { range: 8, atk: 30, still: true, time: 3 } } },
        kit: { name: 'Tower (folded)', role: 'deploy', hp: 100, atk: 0, range: 0, rate: 1, speed: 1.6, cost: 120, time: 20, machine: true, deploys: 'tower' } },
      buildings: { ...OWN.buildings, base: { ...OWN.buildings.base, upgrades: { to: 'fort', cost: 200, time: 10, needs: 'drill' } }, fort: { ...OWN.buildings.base, name: 'Fort', hp: 1600, atk: 10, range: 5 }, tower: { ...OWN.buildings.tower, time: 8 } },
      research: { drill: { name: 'Drill', cost: 0, time: 1, gives: {} } } };
    const B = flat(5, 20), cfg = own(B, { workers: 0 }, { player: SHIFT });
    let R = { ...rtsStart(B, cfg), units: [] };
    const put = (side, kind, n) => { const i = at(B, n); R.units.push({ id: 'x' + n, side, kind, hp: (side === 'player' ? SHIFT : { units: RTS_UNITS }).units[kind].hp, x: (i % 5) + 0.5, y: Math.floor(i / 5) + 0.5, at: i, path: [], order: { kind: 'hold' }, cd: 0, carry: 0, mine: 0, again: 0 }); };
    put('player', 'crew', 'C5'); put('enemy', 'soldier', 'C12');
    // packed: the soldier, seven away, is out of its reach; deployed (3 s), it is struck, and a move goes nowhere
    expect(run(B, cfg, R, 2).ev.some((e) => e.kind === 'shot' && e.from === 'xC5')).toBe(false);
    let D = run(B, cfg, rtsOrder(B, cfg, R, ['xC5'], { kind: 'mode', to: 'deployed' }), 4);
    expect(D.ev.some((e) => e.kind === 'mode' && e.mode === 'deployed')).toBe(true);
    D = run(B, cfg, rtsOrder(B, cfg, D.R, ['xC5'], { kind: 'move', to: at(B, 'A3') }), 3);
    expect(D.ev.some((e) => e.kind === 'shot' && e.from === 'xC5' && e.to === 'xC12')).toBe(true);
    expect(D.R.units.find((u) => u.id === 'xC5').at).toBe(at(B, 'C5'));
    // packed again, it walks
    D = run(B, cfg, rtsOrder(B, cfg, D.R, ['xC5'], { kind: 'mode', to: null }), 3.5);
    expect(run(B, cfg, rtsOrder(B, cfg, D.R, ['xC5'], { kind: 'move', to: at(B, 'A3') }), 6).R.units.find((u) => u.id === 'xC5').at).toBe(at(B, 'A3'));
    // the base into its fort, once Drill is known; its hp in proportion, still the side's base
    let F = { ...rtsStart(B, cfg), gold: { player: 999, enemy: 0 } };
    const base = F.buildings.find((b) => b.side === 'player').id;
    expect(() => rtsUpgrade(B, cfg, F, base)).toThrow(/a Fort needs Drill researched first/);
    F = { ...F, known: { player: { drill: true }, enemy: {} } };
    F = run(B, cfg, rtsUpgrade(B, cfg, F, base), 10.2).R;
    expect(F.buildings.find((b) => b.id === base)).toMatchObject({ kind: 'fort', hp: 1600, hpMax: 1600 });
    // folded, then set up where it stopped: raised on its own, and the unit gone without a fall
    let K = { ...rtsStart(B, cfg), units: [] };
    K.units.push({ id: 'xk', side: 'player', kind: 'kit', hp: 100, x: 2.5, y: 6.5, at: at(B, 'C7'), path: [], order: { kind: 'stop' }, cd: 0, carry: 0, mine: 0, again: 0 });
    const S = run(B, cfg, rtsOrder(B, cfg, K, ['xk'], { kind: 'deploy' }), 9);
    expect(S.ev.filter((e) => e.kind === 'down')).toEqual([]);
    expect(S.R.units.find((u) => u.id === 'xk')).toBeUndefined();
    expect(S.R.buildings.find((b) => b.kind === 'tower')).toMatchObject({ at: at(B, 'C7'), raising: 0, hp: OWN.buildings.tower.hp });
  });

  it('strikes by class and bursts: a lance pierces machines, a blade cuts the unarmoured, a shell splashes round what it hits', () => {
    const FX = { ...OWN, units: { ...OWN.units,
      lance: { name: 'Lance', role: 'melee', hp: 80, atk: 10, range: 1.2, rate: 1, speed: 1.8, cost: 60, time: 9, bonus: { armoured: 1.5 } },
      shell: { name: 'Shell', role: 'siege', hp: 90, atk: 20, range: 6, rate: 3, speed: 1.2, cost: 180, time: 30, machine: true, splash: 1.2 } } };
    const B = flat(5, 20), cfg = own(B, { workers: 0 }, { player: FX, enemy: FX });
    const at3 = (n) => { const i = at(B, n); return { x: (i % 5) + 0.5, y: Math.floor(i / 5) + 0.5, at: i }; };
    const mk = (id, side, kind, n, hp) => ({ id, side, kind, hp, ...at3(n), path: [], order: { kind: 'hold' }, cd: 0, carry: 0, mine: 0, again: 0 });
    // a lance on a machine (the crew), and on a soldier: 15 and 10
    let R = { ...rtsStart(B, cfg), units: [mk('l', 'player', 'lance', 'C6', 80), mk('c', 'enemy', 'crew', 'C7', 90)] };
    expect(run(B, cfg, R, 0.1).R.units.find((u) => u.id === 'c').hp).toBe(75);
    R = { ...R, units: [mk('l', 'player', 'lance', 'C6', 80), mk('s', 'enemy', 'soldier', 'C7', 80)] };
    expect(run(B, cfg, R, 0.1).R.units.find((u) => u.id === 's').hp).toBe(70);
    // a shell on one of three soldiers in a knot: 20 on it, 10 on each beside it, none on one two spots off
    R = { ...R, units: [mk('h', 'player', 'shell', 'C3', 90), mk('a', 'enemy', 'soldier', 'C8', 80), mk('b', 'enemy', 'soldier', 'D8', 80), mk('d', 'enemy', 'soldier', 'C9', 80), mk('e', 'enemy', 'soldier', 'A8', 80)] };
    const S = run(B, cfg, R, 0.1).R;
    expect(['a', 'b', 'd', 'e'].map((id) => S.units.find((u) => u.id === id).hp)).toEqual([60, 70, 70, 80]);
  });

  it('puts statuses on: every fourth energy hit stuns (it does nothing), poison bites on, frost slows; a stim and a shield cast', () => {
    const FX = { ...OWN, units: { ...OWN.units,
      zap: { name: 'Zap', role: 'ranged', hp: 50, atk: 1, range: 4, rate: 1, speed: 1.8, cost: 70, time: 12, onHit: { status: 'stun', time: 2.5, every: 4 } },
      sting: { name: 'Sting', role: 'ranged', hp: 50, atk: 1, range: 4, rate: 1, speed: 1.8, cost: 70, time: 12, onHit: { status: 'poison', time: 4, every: 1 } },
      ice: { name: 'Ice', role: 'ranged', hp: 50, atk: 1, range: 4, rate: 1, speed: 1.8, cost: 70, time: 12, onHit: { status: 'slow', time: 2, every: 1 } },
      ranger: { name: 'Ranger', role: 'ranged', hp: 60, atk: 6, range: 4, rate: 1.2, speed: 1.8, cost: 70, time: 12, abilities: { stim: { status: 'stim', time: 6, hp: 10, cooldown: 15 }, shield: { shield: 40, time: 8, cooldown: 20 } } } } };
    const B = flat(5, 20), cfg = own(B, { workers: 0 }, { player: FX, enemy: FX });
    const mk = (id, side, kind, n, hp, order = { kind: 'hold' }) => { const i = at(B, n); return { id, side, kind, hp, x: (i % 5) + 0.5, y: Math.floor(i / 5) + 0.5, at: i, path: [], order, cd: 0, carry: 0, mine: 0, again: 0 }; };
    // stunned on the fourth hit: an archer that was shooting stops
    let R = { ...rtsStart(B, cfg), units: [mk('z', 'player', 'zap', 'C5', 50), mk('a', 'enemy', 'archer', 'C8', 50)] };
    let E = run(B, cfg, R, 3.45);
    expect(E.ev.some((e) => e.kind === 'status' && e.id === 'a' && e.status === 'stun')).toBe(true);
    const shots = run(B, cfg, E.R, 2).ev.filter((e) => e.kind === 'shot' && e.from === 'a');
    expect(shots).toEqual([]);
    // poison bites on after the hit, about 4 hp a second for 4 s
    R = { ...R, units: [mk('p', 'player', 'sting', 'C5', 50), mk('b', 'enemy', 'worker', 'C8', 40)] };
    E = run(B, cfg, R, 0.1);
    expect(E.R.units.find((u) => u.id === 'b').st.poison).toBeGreaterThan(3.8);
    // frost: a walker slowed to half
    R = { ...R, units: [mk('i', 'player', 'ice', 'C5', 50), mk('w', 'enemy', 'soldier', 'C8', 80, { kind: 'move', to: at(B, 'C16') })] };
    R = rtsOrder(B, cfg, R, ['w'], { kind: 'move', to: at(B, 'C16') });
    const slow = run(B, cfg, R, 1).R.units.find((u) => u.id === 'w'), free = run(B, cfg, { ...R, units: R.units.filter((u) => u.id !== 'i') }, 1).R.units.find((u) => u.id === 'w');
    expect(slow.y - 7.5).toBeLessThan((free.y - 7.5) * 0.7);
    // stim: paid in hp, faster; again only after its cooldown; a shield takes the blows first
    R = { ...R, units: [mk('r', 'player', 'ranger', 'C5', 60)] };
    R = rtsOrder(B, cfg, R, ['r'], { kind: 'cast', ability: 'stim' });
    expect([R.units[0].hp, R.units[0].st.stim, R.units[0].cool.stim]).toEqual([50, 6, 15]);
    expect(rtsOrder(B, cfg, R, ['r'], { kind: 'cast', ability: 'stim' }).units[0].hp).toBe(50);
    R = rtsOrder(B, cfg, R, ['r'], { kind: 'cast', ability: 'shield' });
    R = { ...R, units: R.units.concat([mk('x', 'enemy', 'soldier', 'C6', 80)]) };
    expect(run(B, cfg, R, 0.1).R.units.find((u) => u.id === 'r')).toMatchObject({ hp: 50, shield: 32 });
  });

  it('hides the cloaked from all but a detector; lifts its own with upgrades and banners, and slows foes with a jammer', () => {
    const FX = { ...OWN, units: { ...OWN.units,
      ghost: { name: 'Ghost', role: 'ranged', hp: 50, atk: 6, range: 4, rate: 1.2, speed: 1.8, cost: 90, time: 12, cloak: true },
      eye: { name: 'Eye', role: 'scout', hp: 70, atk: 0, range: 0, rate: 1, speed: 3, cost: 60, time: 10, detects: 6 },
      flag: { name: 'Flag', role: 'melee', hp: 80, atk: 8, range: 1.2, rate: 1, speed: 1.8, cost: 70, time: 10, aura: { r: 3, who: 'own', atk: 1.5 } },
      jam: { name: 'Jam', role: 'melee', hp: 80, atk: 0, range: 0, rate: 1, speed: 1.8, cost: 70, time: 10, aura: { r: 3, who: 'foe', speed: 0.5 } } },
      research: { arms: { name: 'Arms', cost: 0, time: 1, gives: { buff: { who: 'fighters', atk: 2 } } }, plate: { name: 'Plate', cost: 0, time: 1, gives: { buff: { who: 'all', ward: 0.5 } } } } };
    const B = flat(5, 20), cfg = own(B, { workers: 0 }, { player: FX, enemy: FX });
    const mk = (id, side, kind, n, hp, order = { kind: 'hold' }) => { const i = at(B, n); return { id, side, kind, hp, x: (i % 5) + 0.5, y: Math.floor(i / 5) + 0.5, at: i, path: [], order, cd: 0, carry: 0, mine: 0, again: 0 }; };
    // the ghost shoots, unseen; an archer beside it shoots back only once an eye comes near
    let R = { ...rtsStart(B, cfg), units: [mk('g', 'enemy', 'ghost', 'C8', 50), mk('a', 'player', 'archer', 'C5', 50)] };
    expect(run(B, cfg, R, 3).ev.some((e) => e.kind === 'shot' && e.from === 'a')).toBe(false);
    R = { ...R, units: R.units.concat([mk('e', 'player', 'eye', 'C4', 70)]) };
    expect(run(B, cfg, R, 3).ev.some((e) => e.kind === 'shot' && e.from === 'a' && e.to === 'g')).toBe(true);
    // upgrades: twice the blow known; half the harm known
    R = { ...rtsStart(B, cfg), units: [mk('s', 'player', 'soldier', 'C6', 80), mk('t', 'enemy', 'soldier', 'C7', 80)], known: { player: { arms: true, plate: true }, enemy: {} } };
    const U = run(B, cfg, R, 0.1).R;
    expect([U.units.find((u) => u.id === 't').hp, U.units.find((u) => u.id === 's').hp]).toEqual([64, 76]);
    // a banner lifts its own within 3; a jammer halves a foe's pace
    R = { ...rtsStart(B, cfg), units: [mk('f', 'player', 'flag', 'B6', 80), mk('s', 'player', 'soldier', 'C6', 80), mk('t', 'enemy', 'soldier', 'C7', 80)] };
    expect(run(B, cfg, R, 0.1).R.units.find((u) => u.id === 't').hp).toBe(80 - 12 - 0);
    R = { ...rtsStart(B, cfg), units: [mk('j', 'enemy', 'jam', 'D9', 80), mk('w', 'player', 'soldier', 'C8', 80)] };
    R = rtsOrder(B, cfg, R, ['w'], { kind: 'move', to: at(B, 'C16') });
    const jammed = run(B, cfg, R, 1).R.units.find((u) => u.id === 'w'), free = run(B, cfg, { ...R, units: R.units.filter((u) => u.id !== 'j') }, 1).R.units.find((u) => u.id === 'w');
    expect(jammed.y - 7.5).toBeLessThan((free.y - 7.5) * 0.7);
  });

  it('plays as each side chose: economy, aggression, fortress, science, each said, refused when not a doctrine', () => {
    const B = flat(7, 18), base = quiet(B, { workers: 2, nodes: ['B5'] });
    const as = (d) => ({ ...base, doctrine: { player: d } });
    // economy: two more workers, a trip pays a tenth more
    let R = rtsStart(B, as('economy'));
    expect(R.units.filter((u) => u.side === 'player')).toHaveLength(4);
    const w = R.units.find((u) => u.side === 'player').id;
    const trip = run(B, as('economy'), rtsOrder(B, as('economy'), R, [w], { kind: 'gather', node: at(B, 'B5') }), 20).ev.find((e) => e.kind === 'gathered');
    expect(trip).toMatchObject({ amount: 5, paid: 5 + Math.floor(5 * 0.1 + 1e-9) });
    // fortress: its buildings a quarter sturdier; science: research cheaper
    const F = rtsBuild(B, as('fortress'), { ...rtsStart(B, as('fortress')), gold: { player: 999, enemy: 0 } }, 'player', 'barracks', at(B, 'E5'));
    expect(F.buildings.find((b) => b.kind === 'barracks').hpMax).toBe(Math.round(RTS_BUILDINGS.barracks.hp * 1.25));
    expect(rtsStart(B, as('fortress')).buildings.find((b) => b.side === 'player').hpMax).toBe(Math.round(RTS_BUILDINGS.base.hp * 1.25));
    // aggression: its soldiers strike a tenth harder
    const A = { ...rtsStart(B, as('aggression')), units: [] };
    const put = (side, n) => { const i = at(B, n); A.units.push({ id: 'x' + n, side, kind: 'soldier', hp: 80, x: (i % 7) + 0.5, y: Math.floor(i / 7) + 0.5, at: i, path: [], order: { kind: 'hold' }, cd: 0, carry: 0, mine: 0, again: 0 }); };
    put('player', 'C8'); put('enemy', 'C9');
    const hit = run(B, as('aggression'), A, 0.1).R;
    expect([hit.units.find((u) => u.id === 'xC9').hp, hit.units.find((u) => u.id === 'xC8').hp]).toEqual([80 - 8.8, 72]);
    expect(() => readBoardRts(B, { doctrine: { player: 'chaos' } })).toThrow(/doctrine.player 'chaos' is not a doctrine \(economy: two more workers/);
    expect(() => readBoardRts(B, { doctrine: { neutral: 'economy' } })).toThrow(/doctrine.neutral: the sides are player and enemy/);
  });

  it('runs an economy of two resources and a supply cap: ore mined and spent, refusals saying which, quarters to hold more', () => {
    const ECO = { ...OWN, res2: 'Power',
      units: { ...OWN.units, worker: { ...OWN.units.worker, supply: 1 }, soldier: { ...OWN.units.soldier, supply: 1 }, archer: { ...OWN.units.archer, supply: 1 }, crew: { ...OWN.units.crew, supply: 3, cost2: 60, tier: undefined } },
      buildings: { ...OWN.buildings, base: { ...OWN.buildings.base, supplies: 4, trains: ['worker'] }, barracks: { ...OWN.buildings.barracks, trains: ['soldier', 'archer', 'crew'] }, quarters: { name: 'Quarters', role: 'supply', hp: 300, cost: 100, time: 15, supplies: 8 } } };
    const B = flat(7, 18), cfg = own(B, { workers: 2, nodes: ['B5'], nodes2: ['F5'] }, { player: ECO, enemy: ECO });
    let R = rtsStart(B, cfg);
    expect(R.nodes.map((n) => n.res || 1)).toEqual([1, 2]);
    // a worker on the power node: what it carries home is power
    const w = R.units.find((u) => u.side === 'player').id;
    const E = run(B, cfg, rtsOrder(B, cfg, R, [w], { kind: 'gather', node: at(B, 'F5') }), 25);
    expect(E.ev.find((e) => e.kind === 'gathered')).toMatchObject({ res: 2, amount: 5 });
    expect(E.R.ore.player).toBeGreaterThan(0);
    // a crew costs gold and power, said when either is short
    R = raise(B, cfg, { ...rtsStart(B, cfg), gold: { player: 999, enemy: 0 } }, 'barracks', 'E5');
    const bar = R.buildings.find((b) => b.kind === 'barracks').id;
    expect(() => rtsTrain(B, cfg, { ...R, ore: { player: 10, enemy: 0 } }, bar, 'crew')).toThrow(/180 gold and 60 power for a Cannon crew, \d+ gold and 10 power in the purse/);
    // the base holds 4: two workers and a soldier, a fourth fits, a fifth does not; quarters hold 8 more
    R = rtsTrain(B, cfg, { ...R, gold: { player: 999, enemy: 0 } }, bar, 'soldier');
    R = rtsTrain(B, cfg, R, bar, 'soldier');
    expect(() => rtsTrain(B, cfg, R, bar, 'archer')).toThrow(/needs more supply \(4 \/ 4\): raise a Quarters/);
    R = raise(B, cfg, { ...R, gold: { player: 999, enemy: 0 } }, 'quarters', 'B9');
    expect(() => rtsTrain(B, cfg, R, bar, 'archer')).not.toThrow();
  });

  it('is a mind that holds its supply and mines its second resource when its things cost it', () => {
    const ECO = { ...OWN, res2: 'Power',
      units: { ...OWN.units, worker: { ...OWN.units.worker, supply: 1 }, soldier: { ...OWN.units.soldier, supply: 1 }, archer: { ...OWN.units.archer, supply: 1 } },
      buildings: { ...OWN.buildings, base: { ...OWN.buildings.base, supplies: 6 }, quarters: { name: 'Quarters', role: 'supply', hp: 300, cost: 100, time: 15, supplies: 8 } } };
    const B = flat(9, 16), cfg = { ...readBoardRts(B, { workers: 3, nodes2: 1, ai: { workers: 6, wave: 30 } }), sides: { player: ECO, enemy: ECO } };
    let R = rtsStart(B, cfg);
    for (let k = 0; k < 2400; k++) { if (k % 10 === 0) R = rtsMind(B, cfg, R, 'player'); R = rtsTick(B, cfg, R, 0.1).R; }
    expect(R.buildings.some((b) => b.side === 'player' && b.kind === 'quarters')).toBe(true);
    expect(R.ore.player).toBeGreaterThan(0);
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

describe('the clock and the hand', () => {
  it('takes every action one way in, logged by its step: the log plays the same game again', () => {
    const B = flat(9, 12), cfg = readBoardRts(B, { ai: { wave: 3 } });
    let R = rtsStart(B, cfg);
    const log = [], hand = (a) => { const s = rtsStepOf(R); R = rtsAct(B, cfg, R, a); log.push({ s, a }); };
    const base = R.buildings.find((b) => b.side === 'player').id, ws = mine(R).map((u) => u.id);
    for (let k = 0; k < 1800 && !R.over; k++) {
      if (k === 0) hand({ k: 'order', ids: ws, o: { kind: 'gather', node: cfg.nodes[0].at } });
      if (k === 37) hand({ k: 'train', id: base, kind: 'worker' });
      if (k === 400) hand({ k: 'build', kind: 'barracks', at: at(B, 'B4') });
      if (k === 401) hand({ k: 'idle', kind: 'worker', rule: 'gather' });
      // the page's time is cut as its frames fall: the log keeps the steps, not the frames
      R = rtsTick(B, cfg, R, k % 3 ? 0.1 : 0.2).R;
    }
    const again = rtsReplay(B, cfg, log, rtsStepOf(R));
    expect({ ...again, acc: 0 }).toEqual({ ...R, acc: 0 });
    // a side's actions a minute over the game: the player's four, the mind's as it played
    expect(R.acts.player).toBe(4);
    expect(rtsApm(R, 'player')).toBe(Math.round((4 * 60) / R.t));
    expect(rtsApm(R, 'enemy')).toBeGreaterThan(0);
  });

  it('plays a mind at a level: an easy one held to its actions a minute and slower to think, a hard one sooner at the gate', () => {
    const B = flat(9, 12), firstWave = (level) => {
      const cfg = readBoardRts(B, { level });
      let R = rtsStart(B, cfg), k = 0;
      for (; k < 3000 && !(R.sent && R.sent.enemy); k++) R = rtsTick(B, cfg, R, 0.1).R;
      return { t: k / 10, acts: R.acts.enemy };
    };
    const easy = firstWave('easy'), normal = firstWave('normal'), hard = firstWave('hard');
    expect(hard.t).toBeLessThan(normal.t);
    expect(normal.t).toBeLessThan(easy.t);
    // (held to 40 a minute, five seconds' worth in hand at most)
    expect(easy.acts).toBeLessThanOrEqual(Math.ceil((RTS_LEVELS.easy.apm * easy.t) / 60) + 1);
    expect(() => readBoardRts(B, { level: 'brutal' })).toThrow(/level 'brutal' is not a level \(easy, normal, hard\)/);
    expect(() => readBoardRts(B, { level: { neutral: 'easy' } })).toThrow(/level.neutral: the sides are player and enemy/);
    expect(readBoardRts(B, { level: { player: 'hard', enemy: 'easy' } }).ais).toEqual({ player: RTS_LEVELS.hard, enemy: RTS_LEVELS.easy });
  });

  it('leaves standing orders: idle workers gather or repair, idle fighters hold; a factory repeats; a kind casts on its own', () => {
    const B = flat(9, 14), cfg = own(B, { nodes: 1 });
    let R = rtsStart(B, cfg);
    const [w1, w2] = mine(R).map((u) => u.id);
    // a worker set to gather goes to the nearest node with something left once it has nothing to do
    R = rtsAct(B, cfg, R, { k: 'idle', kind: 'worker', rule: 'gather' });
    R = rtsTick(B, cfg, R, 0.1).R;
    expect(R.units.filter((u) => u.id === w1 || u.id === w2).map((u) => u.order.kind)).toEqual(['gather', 'gather']);
    // set to repair: to its side's hurt base, the gold a mend
    const hurt = { ...R, buildings: R.buildings.map((b) => (b.side === 'player' ? { ...b, hp: b.hpMax - 100 } : b)), units: R.units.map((u) => ({ ...u, order: { kind: 'stop' }, path: [] })) };
    R = rtsTick(B, cfg, rtsAct(B, cfg, hurt, { k: 'idle', kind: 'worker', rule: 'repair' }), 0.1).R;
    expect(R.units.find((u) => u.id === w1).order).toMatchObject({ kind: 'repair', target: R.buildings.find((b) => b.side === 'player').id });
    // (mended whole, the workers waiting again: a mend costs gold)
    R = rtsAct(B, cfg, { ...R, buildings: R.buildings.map((b) => ({ ...b, hp: b.hpMax })), units: R.units.map((u) => ({ ...u, order: { kind: 'stop' }, path: [] })) }, { k: 'idle', kind: 'worker', rule: 'stop' });
    // a fighter idles by holding (never gathering)
    expect(() => rtsAct(B, cfg, R, { k: 'idle', kind: 'soldier', rule: 'gather' })).toThrow(/a Soldier idles by stop, hold/);
    R = raise(B, cfg, R, 'barracks', 'B5');
    const bar = R.buildings.find((b) => b.kind === 'barracks').id;
    R = rtsAct(B, cfg, { ...R, gold: { ...R.gold, player: 240 } }, { k: 'idle', kind: 'soldier', rule: 'hold' });
    // a barracks set to repeat trains soldier after soldier while the purse holds (four at 60), then waits
    R = rtsAct(B, cfg, R, { k: 'repeat', id: bar, kind: 'soldier' });
    R = run(B, cfg, R, 80).R;
    const soldiers = mine(R).filter((u) => u.kind === 'soldier');
    expect(soldiers.length).toBe(4);
    expect(soldiers.every((u) => u.order.kind === 'hold')).toBe(true);
    // auto-cast: a kind that casts its abilities as soon as a foe is in sight
    const FX = { ...OWN, units: { ...OWN.units, ranger: { name: 'Ranger', role: 'ranged', hp: 60, atk: 6, range: 4, rate: 1.2, speed: 1.8, cost: 70, time: 12, abilities: { shield: { shield: 40, time: 8, cooldown: 20 } } } } };
    const C2 = own(B, { workers: 0 }, { player: FX, enemy: FX }), mk = (id, side, kind, n) => { const i = at(B, n); return { id, side, kind, hp: 60, x: (i % 9) + 0.5, y: Math.floor(i / 9) + 0.5, at: i, path: [], order: { kind: 'hold' }, cd: 0, carry: 0, mine: 0, again: 0 }; };
    let F = { ...rtsStart(B, C2), units: [mk('r', 'player', 'ranger', 'C5'), mk('x', 'enemy', 'soldier', 'C9')] };
    expect(run(B, C2, F, 0.2).R.units.find((u) => u.id === 'r').shield || 0).toBe(0);
    F = rtsAct(B, C2, F, { k: 'auto', kind: 'ranger', on: true });
    expect(run(B, C2, F, 0.2).R.units.find((u) => u.id === 'r').shield).toBe(40);
    expect(() => rtsAct(B, C2, F, { k: 'auto', kind: 'soldier', on: true })).toThrow(/a Soldier has no ability to cast/);
  });
});

describe('the match', () => {
  it('lays expansions: the same fields for both sides, mirrored, the same for the same seed', () => {
    const B = flat(11, 18), cfg = readBoardRts(B, { expansions: 1, seed: 'north' });
    const mirror = (i) => (B.rows - 1 - Math.floor(i / B.cols)) * B.cols + (B.cols - 1 - (i % B.cols));
    const [f, g] = cfg.fields;
    expect([g.at, g.nodes]).toEqual([mirror(f.at), f.nodes.map(mirror)]);
    // a field nearer its side's base, its nodes laid with the rest
    const d = (a, b) => Math.max(Math.abs((a % 11) - (b % 11)), Math.abs(Math.floor(a / 11) - Math.floor(b / 11)));
    expect(d(f.at, cfg.bases.player)).toBeLessThan(d(f.at, cfg.bases.enemy));
    for (const at of [...f.nodes, ...g.nodes]) expect(cfg.nodes.some((n) => n.at === at)).toBe(true);
    expect(readBoardRts(B, { expansions: 1, seed: 'north' }).fields).toEqual(cfg.fields);
    expect(() => readBoardRts(flat(7, 9), { expansions: 3 })).toThrow(/the board has room for \d expansions? a side, not 3/);
    expect(() => readBoardRts(B, { victory: 'regicide' })).toThrow(/victory 'regicide' is not a rule \(base: its base falls; melee: every building it has falls\)/);
    expect(Object.keys(RTS_VICTORY)).toEqual(['base', 'melee']);
  });

  it('is lost when the base falls, or (melee) only when the last building does; a side may give up', () => {
    const B = flat(9, 14), play = (victory) => {
      const cfg = readBoardRts(B, { workers: 0, nodes: 0, ai: { workers: 0, wave: 30 }, ...(victory ? { victory } : {}) });
      let R = raise(B, cfg, { ...rtsStart(B, cfg), units: [] }, 'barracks', 'E4');
      // (the enemy's own barracks, standing)
      R = { ...R, buildings: R.buildings.map((b) => (b.kind === 'barracks' ? { ...b, side: 'enemy', at: at(B, 'E11') } : b)) };
      const fall = (R, pick) => rtsTick(B, cfg, { ...R, buildings: R.buildings.map((b) => (pick(b) ? { ...b, hp: 0 } : b)) }, 0.1).R;
      const once = fall(R, (b) => b.side === 'enemy' && b.kind === 'base');
      return [once.over, once.over ? null : fall(once, (b) => b.side === 'enemy').over];
    };
    expect(play()).toEqual([{ won: true }, null]);
    expect(play('melee')).toEqual([null, { won: true }]);
    const B2 = flat(9, 12), cfg = readBoardRts(B2, {});
    const R = rtsAct(B2, cfg, rtsStart(B2, cfg), { k: 'surrender' });
    expect([R.over, R.acts.player]).toEqual([{ won: false, surrender: 'player' }, 1]);
    expect(() => rtsAct(B2, cfg, R, { k: 'order', ids: [], o: { kind: 'stop' } })).toThrow(/the game is over/);
  });

  it('counts the match per side: trained, lost, raised, mined, research, and its army\'s worth every ten seconds', () => {
    const B = flat(9, 12), cfg = readBoardRts(B, { ai: { wave: 3 } });
    let R = rtsStart(B, cfg);
    const down = { player: [0, 0], enemy: [0, 0] };
    for (let k = 0; k < 2400 && !R.over; k++) {
      if (k % 10 === 0) R = rtsMind(B, cfg, R, 'player');
      const o = rtsTick(B, cfg, R, 0.1);
      R = o.R;
      for (const e of o.events) if (e.kind === 'down') down[e.side][RTS_UNITS[e.kind2] ? 0 : 1]++;
    }
    for (const side of ['player', 'enemy']) {
      const S = R.stats[side];
      expect([S.lost, S.fell]).toEqual(down[side]);
      expect(S.trained).toBeGreaterThan(0);
      expect(S.mined).toBeGreaterThan(0);
      expect(S.army).toHaveLength(Math.floor(R.t / 10 + 1e-9) + 1);
    }
    expect(R.stats.enemy.built).toBeGreaterThan(0);
  });

  it('is a mind that claims a field with a hall once its own nodes run low', () => {
    const B = flat(11, 18), cfg = readBoardRts(B, { nodes: 1, expansions: 1, gold: 400, ai: { wave: 30 } });
    let R = rtsStart(B, cfg);
    for (let k = 0; k < 6000 && !R.buildings.some((b) => b.side === 'enemy' && b.kind === 'hall' && b.raising <= 0); k++) R = rtsTick(B, cfg, R, 0.1).R;
    const hall = R.buildings.find((b) => b.side === 'enemy' && b.kind === 'hall');
    expect(hall && hall.raising).toBe(0);
    expect(cfg.fields.map((f) => f.at)).toContain(hall.at);
  });
});

describe('the fog', () => {
  const mk = (B, id, side, kind, n, extra = {}) => { const i = at(B, n); return { id, side, kind, hp: (RTS_UNITS[kind] || OWN.units[kind]).hp, x: (i % B.cols) + 0.5, y: Math.floor(i / B.cols) + 0.5, at: i, path: [], order: { kind: 'hold' }, cd: 0, carry: 0, mine: 0, again: 0, ...extra }; };
  it('shows a side only what its units and buildings see, the ground it explored, the foe\'s buildings where it last saw them', () => {
    // (a node, so an empty field is no draw)
    const B = flat(9, 20), cfg = readBoardRts(B, { fog: true, workers: 0, nodes: ['A10'], ai: { workers: 0, wave: 30 } });
    let R = rtsStart(B, cfg);
    let V = rtsView(B, cfg, R, 'player');
    // its own base's ground, not the far one; the foe's base not in its view
    expect([V.seen[cfg.bases.player], V.seen[cfg.bases.enemy]]).toEqual([1, 0]);
    expect(V.buildings.map((b) => b.side)).toEqual(['player']);
    // a scout walks up to the foe's base and back: the base remembered where it stood, the ground explored
    R = { ...R, units: [mk(B, 's', 'player', 'soldier', 'E15', { order: { kind: 'stop' } })] };
    R = rtsTick(B, cfg, R, 0.1).R;
    expect(rtsView(B, cfg, R, 'player').buildings.some((b) => b.side === 'enemy')).toBe(true);
    R = { ...R, units: [mk(B, 's', 'player', 'soldier', 'E8', { order: { kind: 'stop' } })] };
    R = rtsTick(B, cfg, R, 0.1).R;
    V = rtsView(B, cfg, R, 'player');
    expect(V.buildings.some((b) => b.side === 'enemy')).toBe(false);
    expect(V.ghosts).toEqual([{ id: R.buildings.find((b) => b.side === 'enemy').id, kind: 'base', at: cfg.bases.enemy }]);
    expect([V.explored[at(B, 'E17')], V.seen[at(B, 'E17')]]).toEqual([1, 0]);
    // without the fog, all of it
    const open = readBoardRts(B, { workers: 0, nodes: 0 });
    expect(rtsView(B, open, rtsStart(B, open), 'player').ghosts).toEqual([]);
    expect(() => readBoardRts(B, { fog: 'thick' })).toThrow(/fog is true/);
  });

  it('strikes only what its side sees: a siege out of sight needs a spotter', () => {
    const SG = { ...OWN, units: { ...OWN.units, crew: { ...OWN.units.crew, range: 8, sight: 4 } } };
    const B = flat(5, 22), cfg = { ...own(B, { workers: 0, fog: true }, { player: SG, enemy: SG }) };
    const R = { ...rtsStart(B, cfg), units: [mk(B, 'c', 'player', 'crew', 'C3'), mk(B, 'x', 'enemy', 'soldier', 'C11')] };
    const shots = (R) => run(B, cfg, R, 3).ev.filter((e) => e.kind === 'shot' && e.from === 'c').length;
    expect(shots(R)).toBe(0);
    expect(shots({ ...R, units: R.units.concat([mk(B, 'p', 'player', 'soldier', 'C8')]) })).toBeGreaterThan(0);
  });

  it('plays the mind under the same fog: what it does reads only what its side sees', () => {
    const B = flat(9, 20), cfg = readBoardRts(B, { fog: true, ai: { wave: 2 } });
    let R = rtsStart(B, cfg);
    for (let k = 0; k < 300; k++) R = rtsTick(B, cfg, R, 0.1).R;
    // the player's side as it is, or with more out of the enemy's sight: the enemy's mind does the same
    const far = { ...R, units: R.units.concat([mk(B, 'q1', 'player', 'archer', 'B2'), mk(B, 'q2', 'player', 'archer', 'H2')]), gold: { ...R.gold, player: 5000 } };
    expect(rtsView(B, cfg, far, 'enemy').units.some((u) => u.id === 'q1' || u.id === 'q2')).toBe(false);
    const theirs = (S) => JSON.stringify({ u: S.units.filter((u) => u.side === 'enemy'), b: S.buildings.filter((b) => b.side === 'enemy'), g: S.gold.enemy, w: S.wave.enemy, s: S.sent });
    expect(theirs(rtsMind(B, cfg, far, 'enemy'))).toBe(theirs(rtsMind(B, cfg, R, 'enemy')));
    // its waves go where the player started, which it knows, without having seen it
    const armed = readBoardRts(B, { fog: true, ai: { wave: 2 }, enemy: { army: 3 } });
    let W = rtsStart(B, armed);
    for (let k = 0; k < 40; k++) W = rtsTick(B, armed, W, 0.1).R;
    expect(W.units.filter((u) => u.side === 'enemy' && u.order.kind === 'amove').map((u) => u.order.to)).toContain(armed.bases.player);
  });
});
