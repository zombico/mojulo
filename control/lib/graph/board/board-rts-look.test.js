import { describe, it, expect, beforeAll } from 'vitest';
import { readGameworld } from '../gameworld/world.js';
import { HALDEN_REACH } from '../gameworld/examples.js';
import { rtsRoster } from './board-rts-tech.js';
import { rtsLooks, lookOf, rtsSides, RTS_LOOK_CEILING } from './board-rts-look.js';
import { TEAM_COLOURS } from '../gameworld/tech-direction.js';
import { blockPaint } from '../era/blocks.js';

// one civilization (its machines have body plans: walkers, tracks, hover, a tower, a turret), its looks made once
const G = readGameworld(HALDEN_REACH), kit = HALDEN_REACH.style.kit;
let roster, looks;
beforeAll(() => { roster = rtsRoster(G, 'survey-corps'); looks = rtsLooks(G, 'survey-corps', roster, { kit }); }, 60000);
const extent = (L) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < L.p.length; i++) { lo[i % 3] = Math.min(lo[i % 3], L.p[i]); hi[i % 3] = Math.max(hi[i % 3], L.p[i]); } return { lo, hi }; };

describe('a civilization\'s skirmish drawn as its technology crafted it', () => {
  it('gives a look to what it crafted and fields, and none to what fills in for it', () => {
    const crafted = roster.ledger.filter((l) => l.of && l.as).map((l) => l.as).sort();
    expect(Object.keys(looks).sort()).toEqual(crafted);
    for (const k of ['base', 'barracks']) expect(looks[k]).toBeUndefined();
  });

  it('reads from the RTS camera: within its ceiling, a hand weapon a hand\'s, the rest on their spot', () => {
    for (const [id, L] of Object.entries(looks)) {
      const U = roster.units[id], cap = L.hand ? RTS_LOOK_CEILING.hand : U ? RTS_LOOK_CEILING.unit : RTS_LOOK_CEILING.building;
      expect(L.t.length).toBeLessThanOrEqual(cap);
      expect(L.p.length).toBe(L.t.length * 9);
      expect(L.t.every((k) => k >= 0 && k < L.pal.length)).toBe(true);
      // the main mass takes the side's colour
      expect(L.team.length).toBeGreaterThan(0);
      const { lo, hi } = extent(L);
      expect(lo[2]).toBe(0);
      expect(Math.max(hi[0] - lo[0], hi[1] - lo[1]) / 100).toBeLessThanOrEqual(L.hand ? 0.71 : 1.81);
      expect((hi[2] - lo[2]) / 100).toBeLessThanOrEqual(3.21);
    }
    // infantry carries its weapon; the machines and buildings stand
    expect([looks.carbine.hand, looks.walker.hand, looks.mast.hand]).toEqual([true, undefined, undefined]);
  });

  it('keeps the largest faces when it must cut, and is the same look for the same faces', () => {
    const paint = blockPaint(kit, 'alloy'), sq = (s, z) => ({ corners: [[0, 0, z], [s, 0, z], [s, s, z], [0, s, z]], group: 'tech:body', value: 0.5 });
    const faces = [sq(0.1, 0), sq(2, 1), sq(0.5, 2)];
    const L = lookOf(faces, paint, { ceiling: 4, foot: 1 });
    // two triangles a square: the 2 m and the 0.5 m squares kept, the smallest cut
    expect(L.t).toHaveLength(4);
    expect(lookOf(faces, paint, { ceiling: 4, foot: 1 })).toEqual(L);
    expect(rtsLooks(G, 'survey-corps', roster, { kit }).skimmer).toEqual(looks.skimmer);
  }, 60000);
});

describe('a manifest\'s sides: civilizations in their own words', () => {
  it('reads each side on its own, a roster and its looks, in its colour; refuses what is not a side', () => {
    const S = rtsSides({ enemy: { civ: { name: 'Raiders', technology: { vehicles: { gunship: 'an armed attack helicopter' }, weapons: { sword: 'a sword' } } }, kit: 'trail-valley' } });
    expect(Object.keys(S)).toEqual(['enemy']);
    expect([S.enemy.units.gunship.fly, S.enemy.team, Object.keys(S.enemy.looks).sort()]).toEqual([true, TEAM_COLOURS[1], ['gunship', 'sword']]);
    expect(() => rtsSides({ neutral: {} })).toThrow(/sides.neutral: the sides are player and enemy/);
    expect(() => rtsSides({ player: { civ: {}, flag: 1 } })).toThrow(/sides.player.flag is not part of a side/);
    expect(() => rtsSides({ player: { civ: {}, team: 'red' } })).toThrow(/sides.player.team is a colour/);
  }, 60000);
});
