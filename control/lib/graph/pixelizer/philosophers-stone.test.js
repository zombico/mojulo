import { describe, it, expect } from 'vitest';

import { newGame, step, matchedKeys, hasValidMove, fromRows, levelTargetFor, levelTimeMsFor } from './philosophers-stone-core.js';

const dimsOf = (s) => ({ W: s.W, H: s.H, reagents: s.reagents });
const full = (s) => s.grid.flat().every(Boolean);
const findKind = (s, kind) => s.grid.flat().some((c) => c && c.kind === kind);

/** Scan for any legal swap (a matching swap or a stone), for the soak test. */
function findMove(s) {
  const dims = dimsOf(s);
  for (let y = 0; y < s.H; y++) {
    for (let x = 0; x < s.W; x++) {
      if (s.grid[y][x] && s.grid[y][x].kind === 'stone') {
        if (x + 1 < s.W) return { type: 'swap', a: { x, y }, b: { x: x + 1, y } };
        if (y + 1 < s.H) return { type: 'swap', a: { x, y }, b: { x, y: y + 1 } };
      }
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= s.W || ny >= s.H) continue;
        const g = s.grid.map((r) => r.slice());
        const t = g[y][x];
        g[y][x] = g[ny][nx];
        g[ny][nx] = t;
        if (matchedKeys(g, dims).size) return { type: 'swap', a: { x, y }, b: { x: nx, y: ny } };
      }
    }
  }
  return null;
}

describe('philosophers stone — PS0 core (swap / match / cascade / refill)', () => {
  it('spawns deterministically, match-free, with a legal move', () => {
    for (const seed of [1, 7, 42, 99, 2024]) {
      const a = newGame(seed);
      const b = newGame(seed);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(full(a)).toBe(true);
      expect(matchedKeys(a.grid, dimsOf(a)).size).toBe(0); // no pre-existing match at spawn
      expect(hasValidMove(a.grid, dimsOf(a))).toBe(true); // never a dead board
    }
  });

  it('reverts a swap that makes no match (returns the same state)', () => {
    const s = newGame(7);
    const dims = dimsOf(s);
    // find an adjacent pair whose swap creates nothing, then assert it no-ops
    let pair = null;
    for (let y = 0; y < s.H && !pair; y++) {
      for (let x = 0; x < s.W - 1 && !pair; x++) {
        const g = s.grid.map((r) => r.slice());
        [g[y][x], g[y][x + 1]] = [g[y][x + 1], g[y][x]];
        if (matchedKeys(g, dims).size === 0) pair = { a: { x, y }, b: { x: x + 1, y } };
      }
    }
    expect(pair).not.toBeNull();
    expect(step(s, { type: 'swap', ...pair })).toBe(s); // identical reference — the swap reverts
  });

  it('a swap that lines up three DISSOLVES them and refills full', () => {
    const s = fromRows([
      '00345',
      '12051', // the 0 at (2,1) swaps up to complete 0 0 0 in the top row
      '23142',
      '34253',
      '45314',
    ]);
    expect(matchedKeys(s.grid, dimsOf(s)).size).toBe(0);
    const after = step(s, { type: 'swap', a: { x: 2, y: 0 }, b: { x: 2, y: 1 } });
    expect(after.lastTrace[0]).toMatchObject({ cleared: 3, mints: [] }); // a plain 3, no product
    expect(after.score).toBeGreaterThanOrEqual(30);
    expect(after.moves).toBe(1);
    expect(full(after)).toBe(true); // the column refilled
    expect(matchedKeys(after.grid, dimsOf(after)).size).toBe(0); // settled clean
  });

  it('replays byte-identically from seed + a swap script', () => {
    const SCRIPT = [
      { type: 'swap', a: { x: 0, y: 0 }, b: { x: 1, y: 0 } },
      { type: 'swap', a: { x: 3, y: 4 }, b: { x: 3, y: 3 } },
      { type: 'swap', a: { x: 5, y: 2 }, b: { x: 5, y: 3 } },
      { type: 'swap', a: { x: 6, y: 6 }, b: { x: 7, y: 6 } },
      { type: 'swap', a: { x: 2, y: 5 }, b: { x: 2, y: 6 } },
    ];
    const a = SCRIPT.reduce(step, newGame(2024));
    const b = SCRIPT.reduce(step, newGame(2024));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('soak: 150 real moves keep the board full, settled, and never deadlocked', () => {
    let s = newGame(12345);
    for (let i = 0; i < 150; i++) {
      const dims = dimsOf(s);
      expect(full(s)).toBe(true);
      expect(matchedKeys(s.grid, dims).size).toBe(0);
      expect(hasValidMove(s.grid, dims)).toBe(true);
      const mv = findMove(s);
      expect(mv).not.toBeNull();
      const prev = s.score;
      s = step(s, mv);
      expect(s.score).toBeGreaterThanOrEqual(prev); // score only climbs
    }
    expect(s.moves).toBe(150);
  });
});

describe('philosophers stone — PS1 alchemy promotions', () => {
  it('a straight 4 distils an Aqua Vitae (line tile)', () => {
    const s = fromRows([
      '00304', // 0 0 3 0 : swapping (2,0)3 with (2,1)0 makes 0 0 0 0 → a straight 4
      '12051',
      '23142',
      '34253',
      '45314',
    ]);
    const after = step(s, { type: 'swap', a: { x: 2, y: 0 }, b: { x: 2, y: 1 } });
    expect(after.lastTrace[0].mints).toEqual(['line']);
    expect(after.lastTrace[0].cleared).toBe(3); // 4 matched − 1 promoted survivor
  });

  it('an L/T of five fires up an Athanor (area tile)', () => {
    const s = fromRows([
      '12345',
      '21451',
      '00305', // left arm 0 0 _ ; the corner (2,2)=3 gets a 0 swapped in from (3,2)
      '45012', // down arm at (2,3)=0, (2,4)=0
      '51023',
    ]);
    const after = step(s, { type: 'swap', a: { x: 2, y: 2 }, b: { x: 3, y: 2 } });
    expect(after.lastTrace[0].mints).toEqual(['area']);
    expect(after.lastTrace[0].cleared).toBe(4); // 5 matched − 1 survivor
  });

  it('a straight 5 brews the Philosopher\'s Stone', () => {
    const s = fromRows([
      '00300', // 0 0 3 0 0 : swap (2,0)3 with (2,1)0 → 0 0 0 0 0 → the Stone
      '12045',
      '23151',
      '34212',
      '45323',
    ]);
    const after = step(s, { type: 'swap', a: { x: 2, y: 0 }, b: { x: 2, y: 1 } });
    expect(after.lastTrace[0].mints).toEqual(['stone']);
    expect(after.stones).toBe(1);
    expect(findKind(after, 'stone') || after.lastTrace.some((p) => p.mints.includes('stone'))).toBe(true);
  });

  it('a line tile caught in a later match DETONATES its whole row', () => {
    const s = fromRows([
      '12345',
      '24451',
      '03015', // (2,2) becomes a horizontal line tile below; (1,2)=3 swaps with (1,3)=0 for a plain 3-run
      '20123',
      '51234',
    ]);
    s.grid[2][2] = { c: 0, kind: 'line', axis: 'h' };
    expect(matchedKeys(s.grid, dimsOf(s)).size).toBe(0);
    const after = step(s, { type: 'swap', a: { x: 1, y: 2 }, b: { x: 1, y: 3 } });
    // 0 0 <line0> forms a 3-run through the line → it detonates the full row (W=5)
    expect(after.lastTrace[0].cleared).toBeGreaterThanOrEqual(5);
  });

  it('swapping the Stone onto a reagent transmutes that whole color off the board', () => {
    const s = fromRows([
      '21345',
      '13452',
      '34S21'.replace('S', '0'), // (2,2) becomes the Stone; swap it onto (3,2)=2
      '45132',
      '51234',
    ]);
    s.grid[2][2] = { c: 0, kind: 'stone' };
    // colour 2 appears at (0,0),(4,1),(3,2),(4,3),(2,4) → 5 tiles + the Stone cell = 6 cleared
    const after = step(s, { type: 'swap', a: { x: 2, y: 2 }, b: { x: 3, y: 2 } });
    expect(after.lastTrace[0].cleared).toBe(6);
    expect(after.moves).toBe(1);
  });
});

describe('philosophers stone — timed mode (Alchemist\'s Trial)', () => {
  it('free mode ignores the clock; timed mode arms level 1', () => {
    const free = newGame(7);
    expect(free.mode).toBe('free');
    expect(free.timeLeft).toBe(null);
    expect(step(free, { type: 'tick', dt: 5000 })).toBe(free); // no clock in free play

    const timed = newGame(7, { mode: 'timed' });
    expect(timed.mode).toBe('timed');
    expect(timed.level).toBe(1);
    expect(timed.target).toBe(levelTargetFor(1));
    expect(timed.timeLeft).toBe(levelTimeMsFor(1));
  });

  it('a tick burns the clock; running it out is a loss that blocks play', () => {
    const t = newGame(7, { mode: 'timed' });
    const ticked = step(t, { type: 'tick', dt: 4000 });
    expect(ticked.timeLeft).toBe(t.timeLeft - 4000);
    expect(ticked.over).toBe(false);

    const dead = step(t, { type: 'tick', dt: t.timeLeft + 1 });
    expect(dead.over).toBe(true);
    expect(dead.timeLeft).toBe(0);
    // over blocks swaps but restart re-arms in the same mode
    expect(step(dead, { type: 'swap', a: { x: 0, y: 0 }, b: { x: 1, y: 0 } })).toBe(dead);
    const fresh = step(dead, 'restart');
    expect(fresh.mode).toBe('timed');
    expect(fresh.over).toBe(false);
    expect(fresh.level).toBe(1);
  });

  it('crossing the level target advances to a shorter, harder level and refills the clock', () => {
    // a scoring swap on a timed board parked just under level 1's target
    const s = {
      ...fromRows(['00345', '12051', '23142', '34253', '45314']),
      mode: 'timed', level: 1, target: levelTargetFor(1), levelStartScore: 0,
      timeCap: levelTimeMsFor(1), timeLeft: 3000, score: levelTargetFor(1) - 10,
    };
    const after = step(s, { type: 'swap', a: { x: 2, y: 0 }, b: { x: 2, y: 1 } });
    expect(after.level).toBeGreaterThanOrEqual(2); // crossed the target → level up
    expect(after.target).toBe(levelTargetFor(after.level));
    expect(after.timeLeft).toBe(levelTimeMsFor(after.level)); // clock refilled at the new cap
    expect(levelTimeMsFor(2)).toBeLessThan(levelTimeMsFor(1)); // higher level = less time
  });
});

describe('philosophers stone — cascade animation frames', () => {
  it('a swap emits presentational frames that end on the settled board', () => {
    const s = fromRows(['00345', '12051', '23142', '34253', '45314']);
    const after = step(s, { type: 'swap', a: { x: 2, y: 0 }, b: { x: 2, y: 1 } });
    // frame 0 = the just-swapped board: the match is present, not yet popped
    expect(after.cascade[0].grid[0][2]).toEqual({ c: 0, kind: 'gem' });
    expect(matchedKeys(after.cascade[0].grid, dimsOf(after)).size).toBeGreaterThan(0);
    // per pass we get a pop frame + a settled frame → at least swap + pop + settle
    expect(after.cascade.length).toBeGreaterThanOrEqual(3);
    // the last frame IS the settled board (frames are pure presentation, no drift)
    expect(JSON.stringify(after.cascade.at(-1).grid)).toBe(JSON.stringify(after.grid));
    // a mid-cascade "pop" frame carries holes (cells cleared, not yet refilled)
    expect(after.cascade.some((f) => f.grid.flat().some((c) => c === null))).toBe(true);
    // score only climbs across frames
    for (let i = 1; i < after.cascade.length; i++) {
      expect(after.cascade[i].score).toBeGreaterThanOrEqual(after.cascade[i - 1].score);
    }
  });

  it('non-resolving moves carry no stale frames (no phantom re-animation)', () => {
    const s = fromRows(['00345', '12051', '23142', '34253', '45314']);
    const after = step(s, { type: 'swap', a: { x: 2, y: 0 }, b: { x: 2, y: 1 } });
    expect(after.cascade.length).toBeGreaterThan(1);
    const armed = step(after, { type: 'select', x: 0, y: 4 }); // just arm a cell
    expect(armed.cascade).toEqual([]); // the previous cascade's frames are cleared
  });
});

describe('philosophers stone — audio through the beats mint gate', () => {
  it('the theme and the sfx cues are valid beats manifests', async () => {
    const { validateBeatsManifest } = await import('../beats/beats-manifest.js');
    const { PS_THEME, PS_SFX } = await import('./philosophers-stone-beats.js');
    expect(validateBeatsManifest(PS_THEME)).toEqual({ ok: true, errors: [] });
    expect(validateBeatsManifest(PS_SFX)).toEqual({ ok: true, errors: [] });
  });
});
