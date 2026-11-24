// THE CLIMBS: going up is going across. Each figure laid on one screen is held to the body (nothing over her head),
// the jump (no rise over one, no gap a jump cannot cross) and the screen (it spreads across it); the deal varies them.
import { describe, it, expect } from 'vitest';
import { layClimb, climbFaults, climbDeal, CLIMB_IDS, CLIMB, layStructure, structFaults, STRUCT } from './climbs.js';
import { layBox } from './box.js';
import { greyboxOf, LEDGE, WALL } from './rooms.js';
import { GREYBOX_HERO, LEDGE_SHARE } from './gates.js';
import { vampireSonata } from './vampire-sonata.js';

const hero = GREYBOX_HERO, step = LEDGE_SHARE * hero.jump;
// (one screen's room, a storey or three tall, its door above at the middle or toward a wall)
const room = (storeys, top) => { const rise = storeys * 11.27 - step, n = Math.ceil(rise / step); return { a: WALL + 0.2, b: 20.03 - WALL - 0.2, floor: 1, rise, n, top, hero, ledge: LEDGE, existing: [] }; };

describe('the climbs', () => {
  it('lays every figure across a screen, a jump at a time, nothing over her head', () => {
    for (const f of CLIMB_IDS.filter((x) => x !== 'zigzag')) {
      const ctx = f === 'stair' ? room(1, 3) : room(f === 'switchback' ? 3 : 1, 10);
      const S = layClimb(f, ctx);
      expect(S, f).not.toBeNull();
      expect(climbFaults(S, ctx)).toEqual([]);
      const cs = S.map((p) => (p.s0 + p.s1) / 2);
      expect(Math.max(...cs) - Math.min(...cs), `${f} spreads across`).toBeGreaterThan(0.4 * 20.03);
      expect(S.every((p) => p.s0 >= ctx.a - 1e-6 && p.s1 <= ctx.b + 1e-6)).toBe(true);
      expect(layClimb(f, ctx)).toEqual(S);
    }
  });

  it('runs a switchback\'s galleries most of the screen\'s length, joined by steps at both walls', () => {
    const ctx = room(2, 10), S = layClimb('switchback', ctx), G = S.filter((p) => p.kind === 'gallery' && p.s1 - p.s0 > LEDGE + 1);
    expect(G.length).toBeGreaterThan(3);
    for (const g of G.slice(0, -1)) expect(g.s1 - g.s0).toBeGreaterThan(0.5 * (ctx.b - ctx.a));   // (all but the top one, beside its door)
    const steps = S.filter((p) => p.kind === 'step');
    expect(new Set(steps.map((p) => p.s0 < 10 ? 'left' : 'right')).size).toBe(2);
  });

  it('says what makes a figure unplayable: a ledge over a head, a gap or a rise past a jump', () => {
    const ctx = { hero, floor: 0 };
    expect(climbFaults([{ s0: 0, s1: 3, z: 1.5, kind: 'tread' }, { s0: 1, s1: 4, z: 3, kind: 'tread' }], ctx)[0]).toMatch(/over a tread/);
    expect(climbFaults([{ s0: 0, s1: 2, z: 1.5, kind: 'tread' }, { s0: 2 + CLIMB.reach * hero.jump + 0.5, s1: 9, z: 3, kind: 'tread' }], ctx)[0]).toMatch(/a gap/);
    expect(climbFaults([{ s0: 0, s1: 2, z: hero.jump + 0.5, kind: 'tread' }], ctx)[0]).toMatch(/a rise/);
    // (a figure with no room for itself is not laid)
    expect(layClimb('stair', room(3, 10))).toBeNull();
  });

  it('deals the figures by the room, never two shafts alike in a row, the zigzag last; and the castle climbs across', () => {
    expect(climbDeal('shaft', 0)[0]).not.toBe(climbDeal('shaft', 1)[0]);
    expect(climbDeal('sill', 3)).toEqual(['zigzag']);
    for (const as of ['shaft', 'storey']) expect(climbDeal(as, 2).at(-1)).toBe('zigzag');
    const G = greyboxOf(layBox(vampireSonata()));
    // (the castle is climbed by its structure, but its sill's room)
    const shafts = G.chains.filter((c) => c.figure !== 'zigzag');
    expect(new Set(shafts.map((c) => c.figure))).toEqual(new Set(['stair-tower', 'great-stair']));
    // (each climb says where its stands are: one span a stand above the floor, a hole's last stand under it)
    for (const c of G.chains) expect(c.spans.length).toBe(c.stands.length - (G.holes.some((h) => h.door === c.door) ? 2 : 1));
  });

  it('climbs a tower by its structure: solid pieces, a ladder at each turn, the way woven through its pier', () => {
    const W = 20.03, floor = 1, top = 3 * 11.27 - LEDGE_SHARE * hero.jump, ctx = { a: 0.6, b: 2 * W - 0.6, pier: [W - 0.8, W + 0.8], floor, top, exit: { bay: 1, end: 'hi' }, hero, door: 4.3, ceiling: 3 * 11.27 - 0.6 };
    const T = layStructure('stair-tower', ctx);
    expect(T).not.toBeNull();
    expect(structFaults(T.pieces, ctx)).toEqual([]);
    // (stands on both screens, a ladder where the way doubles back, a pier with an archway at each crossing)
    expect(T.stands.some((p) => p.s1 < W - 0.8) && T.stands.some((p) => p.s0 > W + 0.8)).toBe(true);
    expect(new Set(T.stands.map((p) => p.way))).toEqual(new Set(['walk', 'ladder']));
    expect(T.ladders.every((l) => l.z1 - l.z0 <= STRUCT.ladder + 1e-6)).toBe(true);
    expect(T.openings.length).toBeGreaterThan(0);
    expect(T.pieces.filter((p) => p.kind === 'pier').length).toBe(T.openings.length + 1);
    // (the flight that rises from the floor is built up from it; the rest hang on their stringers)
    expect(T.pieces.some((p) => p.kind === 'stair' && p.z0 === floor && p.z1 > floor + 1)).toBe(true);
    // (a great stair leaps every other flight; on the castle's rock, what rises from the floor is the rock)
    const G = layStructure('great-stair', { ...ctx, terrain: true });
    expect(new Set(G.stands.map((p) => p.way))).toContain('jump');
    expect(G.pieces.filter((p) => p.terrain).every((p) => p.z0 === floor)).toBe(true);
    // (a hole in the floor she comes up through, under where the way starts, is never covered: the structure is not laid)
    const low = T.pieces.filter((p) => p.kind !== 'pier' && p.z0 <= floor + 1e-6);
    expect(layStructure('stair-tower', { ...ctx, floorHoles: low.map((p) => [p.s0, p.s1]) })).toBeNull();
    expect(layStructure('stair-tower', ctx)).toEqual(T);
  });
});
