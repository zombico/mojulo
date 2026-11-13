// The room primitives, the brief, the composition and the room laws: one case per procedure (a template that fights
// hand to hand, one that shoots, one that platforms, a shift), chosen from the catalog in code.
import { describe, it, expect } from 'vitest';
import { PRIMITIVES, blocksOf, footprint } from './primitives.js';
import { roomNeeds } from './needs.js';
import { composeRoom } from './compose.js';
import { roomLaws, floorGrid } from './laws.js';
import { POLES, POLE_IDS } from '../gameworld/feel/cards.js';

const FIGHTER = POLE_IDS.find((id) => POLES[id].demo.includes('attack') && POLES[id].base === 'action');
const CALM = POLE_IDS.find((id) => !POLES[id].demo.includes('attack'));

describe('the room primitives', () => {
  it('each is its blocks, its plan and what it affords; a platform too high to step stands a step', () => {
    for (const kind of Object.keys(PRIMITIVES)) {
      const p = { kind, id: kind, at: [0, 0, 0], rot: 0, h: kind === 'platform' ? 1.2 : undefined };
      const B = blocksOf(p);
      expect(B.length).toBeGreaterThan(0);
      expect(PRIMITIVES[kind].affords.length).toBeGreaterThan(0);
      const f = footprint(p);
      for (const b of B) { expect(b.x[0]).toBeGreaterThanOrEqual(f.x[0] - 1e-9); expect(b.y[0]).toBeGreaterThanOrEqual(f.y[0] - 1e-9); }
    }
    expect(blocksOf({ kind: 'platform', id: 'p', at: [0, 0, 0], h: 1.2 }).length).toBe(2);
    expect(blocksOf({ kind: 'platform', id: 'p', at: [0, 0, 0], h: 0.5 }).length).toBe(1);
    expect(() => blocksOf({ kind: 'sofa', id: 's', at: [0, 0, 0] })).toThrow(/no primitive 'sofa'/);
  });
});

describe('the brief', () => {
  it('reads the room from the game: its run sizes it, a fight asks for cover and pillars, its jump for decks, a shift for its line', () => {
    const f = roomNeeds({ feel: FIGHTER }), c = roomNeeds({ feel: CALM }), w = roomNeeds({ quick: { goal: 'work' } });
    expect(f.fights && !c.fights).toBe(true);
    expect(f.cover).toBeGreaterThan(c.cover);
    expect(f.platforms > 0).toBe(f.jump >= 1.2);
    expect(f.lift).toBeLessThan(f.jump);
    expect(w.work.card.stations).toBeTruthy();
    expect(w.foes).toBe(0);
    // a quicker hero, a bigger room
    expect(Math.sign(f.size - c.size)).toBe(Math.sign(f.run - c.run) || 0);
  });
});

describe('the composition', () => {
  const N = roomNeeds({ feel: FIGHTER });
  it('is seeded: the same brief and seed, the same room', () => {
    expect(composeRoom(N, { seed: 4 })).toEqual(composeRoom(N, { seed: 4 }));
  });
  it('stands its pairs mirrored across the spine, keeps them apart, and leaves the spawn and the goal clear', () => {
    const R = composeRoom(N);
    const pairs = R.primitives.filter((p) => /a$/.test(p.id));
    expect(pairs.length).toBeGreaterThan(0);
    for (const a of pairs) {
      const b = R.primitives.find((q) => q.id === a.id.replace(/a$/, 'b'));
      expect(b.at[0]).toBeCloseTo(-a.at[0], 6);
      expect(b.at[1]).toBeCloseTo(a.at[1], 6);
    }
    for (const p of R.primitives) for (const at of [R.anchors.spawn, R.anchors.goal]) {
      const f = footprint(p);
      expect(at[0] < f.x[0] - 0.5 || at[0] > f.x[1] + 0.5 || at[1] < f.y[0] - 0.5 || at[1] > f.y[1] + 0.5).toBe(true);
    }
    expect(R.anchors.foes.length).toBe(N.foes);
  });
  it('lays a shift down the middle as counters, bins, shelves and the pass, the goal the pass', () => {
    const W = roomNeeds({ quick: { goal: 'work' } }), R = composeRoom(W);
    const kinds = new Set(R.primitives.map((p) => p.kind));
    for (const k of ['counter', 'bin', 'shelf', 'pass']) expect(kinds.has(k)).toBe(true);
    expect(R.anchors.goal).toEqual(R.work.layout.serve);
  });
});

describe('the room laws', () => {
  it('a composed room holds them, for each kind of game', () => {
    for (const G of [{ feel: FIGHTER }, { feel: CALM }, { quick: { goal: 'work' } }]) {
      const N = roomNeeds(G), L = roomLaws(composeRoom(N), N);
      expect(L.filter((l) => !l.holds), JSON.stringify(G)).toEqual([]);
    }
  });
  it('a room walled across is advised, never refused: the goal not reached, no walkway', () => {
    const N = roomNeeds({ feel: FIGHTER }), R = composeRoom(N);
    const wall = Array.from({ length: Math.ceil(R.size / 1.6) + 1 }, (_, k) => ({ kind: 'cover-low', id: `w${k}`, at: [-R.half + 0.8 + k * 1.6, 0, 0], rot: 0 }));
    const L = roomLaws({ ...R, primitives: [...R.primitives, ...wall] }, N);
    expect(L.find((l) => l.law === 'reachable').holds).toBe(false);
    expect(L.find((l) => l.law === 'clearance').holds).toBe(false);
    expect(floorGrid(R).free).toBeGreaterThan(floorGrid({ ...R, primitives: [...R.primitives, ...wall] }).free);
  });
  it('a pillar under an overhead camera is said', () => {
    const R = composeRoom(roomNeeds({ feel: FIGHTER })), N = { ...roomNeeds({ feel: FIGHTER }), camera: 'top-down' };
    expect(R.primitives.some((p) => p.kind === 'pillar')).toBe(true);
    expect(roomLaws(R, N).find((l) => l.law === 'camera').holds).toBe(false);
    expect(composeRoom(N).primitives.some((p) => p.kind === 'pillar')).toBe(false);
  });
});
