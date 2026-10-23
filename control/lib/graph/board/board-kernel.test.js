import { describe, it, expect } from 'vitest';
import {
  buildBoard, boardOf, boardParse, boardSpotName, boardCentre, boardStart, boardReach, boardPath, boardAim, boardArea, boardHits,
  boardLegal, boardApply, boardFacing, boardPreview, boardOccupant, boardLiving,
} from './board-kernel.js';

// the test's own dice, apart from the kernel's
function dice(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const flat = (cols, rows, h = 0) => Array.from({ length: rows }, () => Array(cols).fill(h));

// a small rough board: heights 0 to 3, some holes, a cliff or two
function rough(seed, cols = 6, rows = 6) {
  const d = dice(seed), heights = [], types = [];
  for (let r = 0; r < rows; r++) {
    heights.push([]); types.push([]);
    for (let c = 0; c < cols; c++) { const x = d(); heights[r].push(x < 0.08 ? null : Math.floor(d() * 4)); types[r].push(x > 0.95 ? 'cliff' : 'ground'); }
  }
  return boardOf(heights, { types });
}
// units scattered on free walkable spots, two sides
function scatter(B, seed, n = 4, extra = {}) {
  const d = dice(seed), free = B.spots.map((s, i) => (s && s.walk ? i : -1)).filter((i) => i >= 0), units = [];
  for (let k = 0; k < n && free.length; k++) {
    const i = free.splice(Math.floor(d() * free.length), 1)[0];
    units.push({ id: `u${k}`, side: k % 2 ? 'foe' : 'party', at: i, move: 2 + Math.floor(d() * 3), jump: 1 + Math.floor(d() * 2), spd: 4 + Math.floor(d() * 5), hp: 20, atk: 12, def: 4, ...extra });
  }
  return units;
}
// every walk of up to `move` steps by the same rules, the long way: the spots a unit could end on
function bruteReach(B, S, id) {
  const U = S.u[id], occ = {};
  for (const k of S.order) if (S.u[k].hp > 0) occ[S.u[k].at] = k;
  const ends = new Set();
  const nb = (i) => { const c = i % B.cols, r = (i - c) / B.cols; return [[c, r + 1], [c + 1, r], [c, r - 1], [c - 1, r]].filter(([x, y]) => x >= 0 && y >= 0 && x < B.cols && y < B.rows).map(([x, y]) => y * B.cols + x); };
  const go = (i, left) => {
    if (i !== U.at && occ[i] === undefined) ends.add(i);
    if (!left) return;
    for (const j of nb(i)) {
      const s = B.spots[j];
      if (!s || !s.walk || Math.abs(s.h - B.spots[i].h) > U.jump) continue;
      if (occ[j] !== undefined && S.u[occ[j]].side !== U.side) continue;
      go(j, left - 1);
    }
  };
  go(U.at, U.move);
  return [...ends].sort((a, b) => a - b);
}
// a plain mind: hit a foe if it can, else walk toward the nearest one, then end facing it
function greedy(B, cfg, S) {
  const L = boardLegal(B, cfg, S), U = S.u[S.turn.who];
  const act = L.find((a) => a.kind === 'act');
  if (act) return act;
  const foes = boardLiving(S).filter((id) => S.u[id].side !== U.side).map((id) => S.u[id].at);
  const far = (i) => Math.min(...foes.map((f) => Math.abs((f % B.cols) - (i % B.cols)) + Math.abs(Math.floor(f / B.cols) - Math.floor(i / B.cols))));
  const moves = L.filter((a) => a.kind === 'move');
  if (moves.length) { const best = moves.reduce((m, a) => (far(a.to) < far(m.to) ? a : m)); if (far(best.to) < far(U.at)) return best; }
  return L.find((a) => a.kind === 'end');
}
function play(B, cfg, S, pick, limit = 4000) {
  const log = [];
  for (let k = 0; k < limit && !S.over; k++) {
    const a = pick(B, cfg, S);
    const out = boardApply(B, cfg, S, a);
    log.push(a, out.beats);
    S = out.S;
  }
  return { S, log };
}
const randomMind = (seed) => { const d = dice(seed); return (B, cfg, S) => { const L = boardLegal(B, cfg, S); return L[Math.floor(d() * L.length)]; }; };

describe('the board kernel: spots, one unit a spot, and the turns played on them', () => {
  it('is pure: the same start and the same moves give the same battle, and its source runs alone (the page emits it)', () => {
    const B = rough(11), cfg = { seed: 'duel' }, units = scatter(B, 5);
    const once = () => play(B, cfg, boardStart(B, cfg, units), randomMind(9), 300);
    expect(JSON.stringify(once())).toBe(JSON.stringify(once()));
    const page = new Function(`return (${buildBoard.toString()})();`)();
    let S = page.start(B, cfg, units), P = boardStart(B, cfg, units);
    const mind = randomMind(9);
    for (let k = 0; k < 120 && !S.over; k++) {
      const a = mind(B, cfg, P), x = page.apply(B, cfg, S, a), y = boardApply(B, cfg, P, a);
      expect(x).toEqual(y);
      S = x.S; P = y.S;
    }
  });

  it('names its spots as a board does: columns east, rows north', () => {
    const B = boardOf(flat(5, 4));
    expect(boardParse(B, 'C4')).toBe(3 * 5 + 2);
    expect(boardSpotName(B, boardParse(B, 'e1'))).toBe('E1');
    expect(boardParse(B, 'F1')).toBe(-1);
    expect(boardCentre(boardOf([[0, 3]], { cell: 2, step: 0.5 }), 1)).toEqual([3, 1, 1.5]);
  });

  it('reaches exactly the spots a walk within move and jump can end on: through allies, never foes, never onto anyone', () => {
    for (const seed of [1, 2, 3]) {
      const B = rough(seed), S = boardStart(B, { seed }, scatter(B, seed + 50, 6));
      for (const id of S.order) {
        expect(boardReach(B, S, id), `${seed}:${id}`).toEqual(bruteReach(B, S, id));
        for (const to of boardReach(B, S, id)) {
          const p = boardPath(B, S, id, to);
          expect(p[0]).toBe(S.u[id].at);
          expect(p.length - 1).toBeLessThanOrEqual(S.u[id].move);
          for (let k = 1; k < p.length; k++) expect(Math.abs(B.spots[p[k]].h - B.spots[p[k - 1]].h)).toBeLessThanOrEqual(S.u[id].jump);
        }
      }
    }
    // a corridor: an ally is walked through, a foe is a wall
    const B = boardOf([[0, 0, 0, 0]]), beside = (side) => boardStart(B, {}, [{ id: 'a', side: 'p', at: 'A1', move: 3 }, { id: 'b', side, at: 'B1' }]);
    expect(boardReach(B, beside('p'), 'a').map((i) => boardSpotName(B, i))).toEqual(['C1', 'D1']);
    expect(boardReach(B, beside('q'), 'a')).toEqual([]);
  });

  it('never holds two units on a spot, and is never out of moves while the battle runs', () => {
    for (const seed of [4, 5]) {
      const B = rough(seed, 5, 5), cfg = { seed, rules: { cap: 120 } };
      let S = boardStart(B, cfg, scatter(B, seed, 6));
      const mind = randomMind(seed);
      while (!S.over) {
        const L = boardLegal(B, cfg, S);
        expect(L.length).toBeGreaterThan(0);
        expect(L.some((a) => a.kind === 'end')).toBe(true);
        S = boardApply(B, cfg, S, mind(B, cfg, S)).S;
        const at = boardLiving(S).map((id) => S.u[id].at);
        expect(new Set(at).size).toBe(at.length);
        for (const i of at) expect(B.spots[i].walk).toBe(true);
      }
    }
  });

  it('ends: a battle fought to win finishes with one side standing, and a stalemate stops at the cap', () => {
    const B = boardOf(flat(6, 6)), cfg = { seed: 'skirmish' };
    const units = [
      { id: 'a', side: 'party', at: 'A1', spd: 7 }, { id: 'b', side: 'party', at: 'B1', spd: 5 },
      { id: 'x', side: 'foe', at: 'F6', spd: 6 }, { id: 'y', side: 'foe', at: 'E6', spd: 6 },
    ];
    const { S } = play(B, cfg, boardStart(B, cfg, units), greedy);
    expect(S.over.reason).toBe('fallen');
    expect(boardLiving(S).every((id) => S.u[id].side === S.over.winner)).toBe(true);
    const idle = play(B, { rules: { cap: 10 } }, boardStart(B, { rules: { cap: 10 } }, units), (b, c, s) => boardLegal(b, c, s).find((a) => a.kind === 'end'));
    expect(idle.S.over).toEqual({ winner: null, reason: 'cap' });
  });

  it('plays the FFT turn: move once and act once in either order, then end facing; idling brings the next turn sooner', () => {
    const B = boardOf(flat(4, 4)), cfg = {};
    let S = boardStart(B, cfg, [{ id: 'a', side: 'p', at: 'A1' }, { id: 'b', side: 'q', at: 'D4' }]);
    expect(S.turn).toEqual({ who: 'a', moved: false, acted: false });
    // a ends without moving or acting: it pays 60, and b (full) goes
    S = boardApply(B, cfg, S, { kind: 'end', face: 'e' }).S;
    expect(S.u.a.ct).toBe(40);
    expect(S.u.a.face).toBe(1);
    expect(S.turn.who).toBe('b');
    // b moves (no second move offered), then ends: it pays 80, and a needs less time to fill
    S = boardApply(B, cfg, S, { kind: 'move', to: boardParse(B, 'B2') }).S;
    expect(boardLegal(B, cfg, S).some((x) => x.kind === 'move')).toBe(false);
    expect(boardLegal(B, cfg, S).some((x) => x.kind === 'act')).toBe(false);
    expect(boardPreview(B, S, 3).map((x) => x.who)).toEqual(['b', 'a', 'b']);
    S = boardApply(B, cfg, S, { kind: 'end', face: 's' }).S;
    expect(S.turn.who).toBe('a');
    expect([S.u.a.ct, S.u.b.ct]).toEqual([100, 80]);
    // a acts first (on b, next to it after a move), then may still move; not act again
    S = boardApply(B, cfg, S, { kind: 'move', to: boardParse(B, 'B1') }).S;
    S = boardApply(B, cfg, S, { kind: 'act', skill: 'attack', at: boardParse(B, 'B2') }).S;
    const L = boardLegal(B, cfg, S);
    expect(L.some((x) => x.kind === 'act')).toBe(false);
    expect(L.every((x) => x.kind === 'end')).toBe(true);
    expect(() => boardApply(B, cfg, S, { kind: 'move', to: boardParse(B, 'C1') })).toThrow(/not a legal action/);
  });

  it('faces where it walks and where it strikes, and a blow from behind or the side hits harder', () => {
    const B = boardOf(flat(4, 4)), cfg = { seed: 7 };
    const strike = (face) => {
      const S = boardStart(B, cfg, [{ id: 'a', side: 'p', at: 'B2', atk: 20, spd: 9 }, { id: 't', side: 'q', at: 'B3', face, hp: 99, def: 4 }]);
      expect(boardFacing(B, S, 'a', 't')).toBe({ s: 'front', n: 'back', e: 'side', w: 'side' }[face]);
      const out = boardApply(B, cfg, S, { kind: 'act', skill: 'attack', at: boardParse(B, 'B3') });
      expect(out.S.u.a.face).toBe(0);
      return out.beats.find((b) => b.kind === 'hurt');
    };
    const front = strike('s'), side = strike('e'), back = strike('n');
    expect([front.rel, side.rel, back.rel]).toEqual(['front', 'side', 'back']);
    expect(side.amount).toBeGreaterThan(front.amount);
    expect(back.amount).toBeGreaterThan(side.amount);
    expect(Math.abs(back.amount - front.amount * 1.5)).toBeLessThanOrEqual(1);
    const walk = boardApply(B, cfg, boardStart(B, cfg, [{ id: 'a', side: 'p', at: 'A1', spd: 9 }, { id: 't', side: 'q', at: 'D4' }]), { kind: 'move', to: boardParse(B, 'C1') });
    expect(walk.S.u.a.face).toBe(1);
    expect(walk.beats[0]).toEqual({ kind: 'move', who: 'a', path: [0, 1, 2] });
  });

  it('gives the high ground its share, within the cap', () => {
    const cfg = { seed: 7 };
    const blow = (h) => {
      const B = boardOf([[0, 0], [h, 0]]);
      const S = boardStart(B, cfg, [{ id: 'a', side: 'p', at: 'A2', atk: 20, spd: 9, jump: 9 }, { id: 't', side: 'q', at: 'A1', face: 'n', hp: 99 }]);
      return boardApply(B, { ...cfg, skills: { attack: { v: 9 } } }, S, { kind: 'act', skill: 'attack', at: 0 }).beats.find((b) => b.kind === 'hurt').amount;
    };
    expect(blow(2)).toBeGreaterThan(blow(0));
    expect(blow(9)).toBe(blow(5));
  });

  it('aims in shapes: a diamond or a line, between its reach, within its height, and hits an area round the aim', () => {
    const H = flat(7, 7);
    H[4][3] = 3;
    const B = boardOf(H), S = boardStart(B, {}, [{ id: 'a', side: 'p', at: 'D4' }, { id: 'b', side: 'q', at: 'A1' }]);
    const sk = (o) => ({ min: 1, max: 2, kind: 'diamond', area: 0, v: 2, target: 'foe', ...o });
    expect(boardAim(B, {}, S, 'a', sk({})).length).toBe(11);          // 4 + 8, less the raised spot north of it
    expect(boardAim(B, {}, S, 'a', sk({ v: 3 })).length).toBe(12);
    expect(boardAim(B, {}, S, 'a', sk({ kind: 'line', v: 3 })).length).toBe(8);
    expect(boardAim(B, {}, S, 'a', sk({ min: 2, v: 3 })).length).toBe(8);
    expect(boardArea(B, boardParse(B, 'D3'), sk({ area: 1 })).length).toBe(5);
    expect(boardArea(B, boardParse(B, 'D4'), sk({ area: 1 })).length).toBe(4);   // the raised spot is out of its height
    const cfg = { skills: { blast: { mp: 0, target: 'foes', stat: 'mag', power: 10, min: 0, max: 4, area: 1, v: 2 } } };
    const T = boardStart(B, cfg, [{ id: 'a', side: 'p', at: 'D2', skills: ['blast'] }, { id: 'b', side: 'q', at: 'C1' }, { id: 'c', side: 'q', at: 'B1' }, { id: 'd', side: 'p', at: 'D1' }]);
    expect(boardHits(B, cfg, T, 'a', 'blast', boardParse(B, 'C1'))).toEqual(['c', 'b']);   // foes only, in spot order (B1, C1)
  });

  it('frees a fallen unit\'s spot', () => {
    const B = boardOf([[0, 0, 0]]), cfg = { seed: 3 };
    let S = boardStart(B, cfg, [{ id: 'a', side: 'p', at: 'A1', atk: 40, spd: 9 }, { id: 'b', side: 'q', at: 'B1', hp: 1 }, { id: 'c', side: 'q', at: 'C1', hp: 99 }]);
    expect(boardReach(B, S, 'a')).toEqual([]);
    const out = boardApply(B, cfg, S, { kind: 'act', skill: 'attack', at: 1 });
    expect(out.beats.map((b) => b.kind)).toEqual(['act', 'hurt', 'ko']);
    S = out.S;
    expect(boardOccupant(S, 1)).toBe(null);
    expect(boardReach(B, S, 'a')).toEqual([1]);
  });

  it('parts two spots where a wall stands across the step: no walk crosses it, no blow reaches over it', () => {
    const B = boardOf(flat(3, 2), { cut: [[0, 1], [3, 4]] });
    const S = boardStart(B, {}, [{ id: 'a', side: 'p', at: 'A1', move: 4 }, { id: 'b', side: 'q', at: 'B1' }]);
    expect(boardReach(B, S, 'a').map((i) => boardSpotName(B, i))).toEqual(['A2']);
    expect(boardLegal(B, {}, S).some((x) => x.kind === 'act')).toBe(false);
    const C = boardOf(flat(3, 2), { cut: [[0, 1]] }), T = boardStart(C, {}, [{ id: 'a', side: 'p', at: 'A1', move: 4 }]);
    expect(boardPath(C, T, 'a', 1).map((i) => boardSpotName(C, i))).toEqual(['A1', 'A2', 'B2', 'B1']);
    expect(() => boardOf(flat(3, 2), { cut: [[0, 2]] })).toThrow(/neighbouring spots/);
  });

  it('refuses what cannot stand: a unit off the board, on a cliff, or on another', () => {
    const B = boardOf([[0, null], [0, 0]], { types: [['ground', 'ground'], ['cliff', 'ground']] });
    expect(() => boardStart(B, {}, [{ id: 'a', side: 'p', at: 'B1' }])).toThrow(/not a spot/);
    expect(() => boardStart(B, {}, [{ id: 'a', side: 'p', at: 'A2' }])).toThrow(/where nothing can stand \(cliff\)/);
    expect(() => boardStart(B, {}, [{ id: 'a', side: 'p', at: 'A1' }, { id: 'b', side: 'q', at: 'A1' }])).toThrow(/one unit a spot/);
    expect(() => boardOf([[0.5]])).toThrow(/whole steps/);
    expect(() => boardOf(flat(25, 2))).toThrow(/24 × 24 at most/);
  });
});
