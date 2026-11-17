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
      // (a mark stands nothing: a rift)
      expect(B.length > 0).toBe(!PRIMITIVES[kind].mark);
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

// A FIGHT (fight.js): what the kit asks, the place composed for it, its laws. One kit that asks (a template with a
// launcher, a dash and a sidearm), one that asks less, chosen in code from the templates' kits.
import { kitAsks } from './needs.js';
import { FIGHT_KINDS, FIGHT_KIND_IDS, composeFight } from './fight.js';
import { fightLaws, askedBy } from './laws.js';
import { TEMPLATE_ARSENALS } from '../gameworld/combos.js';

const movesOf = (id) => TEMPLATE_ARSENALS[id].weapons.flatMap((W) => Object.values(W.moves));
const LAUNCHES = Object.keys(TEMPLATE_ARSENALS).find((id) => movesOf(id).some((m) => m.launch > 0));
const GROUNDED = Object.keys(TEMPLATE_ARSENALS).find((id) => !movesOf(id).some((m) => m.launch > 0));

describe('what the kit asks', () => {
  it('each move asks something of the space and says why; a kit without the move asks nothing of it', () => {
    const a = roomNeeds({ feel: LAUNCHES }).asks, g = roomNeeds({ feel: GROUNDED }).asks;
    expect(a.air.headroom).toBeGreaterThan(1.8);
    expect(a.ring.r).toBeGreaterThanOrEqual(3);
    for (const ask of Object.values(a)) { expect(ask.by.length).toBeGreaterThan(0); expect(ask.why).toBeTruthy(); }
    expect(g.air).toBeUndefined();
    expect(g.ring).toBeTruthy();
    // more foes, a wider ring
    expect(kitAsks({ feel: LAUNCHES }, { foes: 8 }).ring.r).toBeGreaterThanOrEqual(kitAsks({ feel: LAUNCHES }, { foes: 1 }).ring.r);
  });
  it('a world that does not fight, and a shift, are asked nothing: the brief they had', () => {
    expect(roomNeeds({ feel: CALM }).asks).toBeUndefined();
    expect(roomNeeds({ quick: { goal: 'work' } }).asks).toBeUndefined();
    expect(Object.keys(roomNeeds({ feel: CALM }))).not.toContain('asks');
  });
});

describe('a fight', () => {
  const N = roomNeeds({ feel: LAUNCHES });
  it('is seeded, and every kind holds its laws on the kit that asks the most', () => {
    for (const kind of FIGHT_KIND_IDS) {
      const F = composeFight(N, { kind, seed: 3 });
      expect(F, kind).toEqual(composeFight(N, { kind, seed: 3 }));
      expect(fightLaws(F, N).filter((l) => !l.holds), kind).toEqual([]);
      expect(F.anchors.ways.length).toBeGreaterThan(1);
      expect(F.anchors.foes.length).toBeGreaterThan(0);
    }
    expect(() => composeFight(N, { kind: 'siege' })).toThrow(/no fight 'siege'/);
  });
  it('lays what its kind is for: rifts round a melee, perches and a lane in a gallery, a dais for a boss', () => {
    const m = composeFight(N, { kind: 'melee' }), g = composeFight(N, { kind: 'gallery' }), b = composeFight(N, { kind: 'boss' }), d = composeFight(N, { kind: 'duel' });
    expect(m.anchors.rifts.length).toBeGreaterThan(1);
    expect(g.primitives.filter((p) => p.kind === 'perch').length).toBeGreaterThan(1);
    expect(g.reserves.runUp.y[1] - g.reserves.runUp.y[0]).toBeGreaterThanOrEqual(N.asks['run-up'].length);
    // a shooter stands on its perch, above the blade's reach
    expect(g.anchors.foes.some((s) => s[2] >= N.asks.perch.h)).toBe(true);
    expect(b.anchors.boss).toBeTruthy();
    expect(b.reserves.ring.r).toBeGreaterThan(m.reserves.ring.r);
    expect(d.size).toBeLessThan(m.size);
    // a mark stands nothing
    expect(blocksOf(m.primitives.find((p) => p.kind === 'rift'))).toEqual([]);
  });
  it('is advised, never refused: a crate in the ring, a wall before a rift, a way put back onto a block', () => {
    const F = composeFight(N, { kind: 'melee' }), r = F.anchors.rifts[0], c = F.reserves.ring.at;
    const mid = [(r.at[0] + c[0]) / 2, (r.at[1] + c[1]) / 2, 0], back = F.anchors.ways[1].back;
    const L = fightLaws({ ...F, primitives: [...F.primitives, { kind: 'crate', id: 'x', at: c, rot: 0 }, { kind: 'cover-tall', id: 'w', at: mid, rot: 0 }, { kind: 'crate', id: 'y', at: back, rot: 0 }] }, N);
    for (const law of ['ring', 'seen', 'put-back']) expect(L.find((l) => l.law === law).holds, law).toBe(false);
    expect(fightLaws({ ...F, headroom: 2 }, N).find((l) => l.law === 'headroom').holds).toBe(false);
  });
  it('every ask of the kit is answered by some kind of fight, and one kind alone leaves some unanswered', () => {
    const all = FIGHT_KIND_IDS.map((kind) => composeFight(N, { kind }));
    expect(askedBy(all, N).holds).toBe(true);
    expect(askedBy([composeFight(N, { kind: 'duel' })], N).holds).toBe(false);
    for (const K of Object.values(FIGHT_KINDS)) expect(K.waves.length).toBeGreaterThan(0);
  });
});
