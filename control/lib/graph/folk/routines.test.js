import { describe, it, expect } from 'vitest';
import { readDay, folkDay, DAY } from './routines.js';
import { folkOfTown } from './folk.js';
import { readRoutines } from '../playscape/ui/routines.js';

// a street of five houses along y = 0, their doors facing +y; each person stands where folk-cast would put them
const lot = (use, s) => ({ use, route: 'lane', side: 'left', s, band: [2, 3] });
const LOTS = [lot('dwelling', 0), lot('shop', 10), lot('dwelling', 20), lot('tower', 30), lot('workshop', 40)];
const F = folkOfTown({ seed: 8, lots: LOTS }, { folk: { domicile: 'D of F (P + C1)' } });
const house = (p) => `town-${p.use}-${LOTS.findIndex((l) => p.lot === `lane:left:${l.s}`) + 1}`;
const doors = new Map(LOTS.map((l, n) => [`town-${l.use}-${n + 1}`, { at: [l.s, 0, 0], N: [0, 1, 0] }]));
const stood = new Map(F.people.map((p, i) => [p.path, { id: `folk-${i}`, at: [doors.get(house(p)).at[0] + i * 0.1, 1.4, 0], heading: Math.PI / 2, house: house(p) }]));
const keep = new Set(F.people.filter((p) => !p.parent && p.service).map((p) => p.path));
const D = folkDay(F, { stood, doors, keep });
const byId = new Map(F.people.map((p) => [stood.get(p.path).id, p]));

describe('folk day: the words', () => {
  it('reads true as the clock\'s defaults, and teaches the rest', () => {
    expect(readDay(true)).toEqual(DAY);
    expect(readDay({ start: 6 })).toEqual({ start: 6, rate: DAY.rate });
    expect(() => readDay({ dawn: 6 })).toThrow(/day.dawn is not a day word/);
    expect(() => readDay({ start: 24 })).toThrow(/0 to 23/);
  });
});

describe('folk day: who keeps one, and where it takes them', () => {
  it('keeps the people the player comes looking for where they are', () => {
    for (const path of keep) expect(D.walkers).not.toContain(path);
    expect(D.walkers.length).toBeGreaterThan(0);
  });

  it('gives each walker a day the routines read, home at its end, and the places they stop at, home first', () => {
    expect(() => readRoutines({ routines: D.routines })).not.toThrow();
    const spots = new Set(D.spots.map((x) => x.id));
    expect(spots.size).toBe(D.spots.length);
    for (const r of D.routines) {
      expect(r.plan[r.plan.length - 1].to).toBe(`${r.who}-home`);
      for (const s of r.plan) expect(spots.has(s.to)).toBe(true);
      expect(D.posts[r.who][0]).toBe(`${r.who}-home`);
    }
  });

  it('sends a child out before their own house, a grown one to another\'s, the watch round three', () => {
    for (const r of D.routines) {
      const p = byId.get(r.who), mine = stood.get(p.path).house, outs = r.plan.slice(0, -1).map((s) => s.to.split('-at-')[1]);
      if (p.sheet.facets.age === 'child') expect(outs).toEqual([mine]);
      else if (p.service === 'watch') { expect(r.plan.map((s) => s.hour)).toEqual([8, 12, 16, 20]); expect(new Set(outs).size).toBe(3); }
      else for (const h of outs) expect(h).not.toBe(mine);
    }
    expect(D.routines.some((r) => byId.get(r.who).sheet.facets.age === 'child')).toBe(true);
    expect(D.routines.some((r) => byId.get(r.who).service === 'watch')).toBe(true);
  });

  it('stops several at one house side by side, out on the street', () => {
    for (const s of D.spots.filter((x) => x.id.includes('-at-'))) expect(s.at[1]).toBeCloseTo(3.2);
    const at = D.spots.filter((x) => x.id.includes('-at-')).map((x) => x.at.join());
    expect(new Set(at).size).toBe(at.length);
  });

  it('is the same day for the same town', () => {
    expect(JSON.stringify(folkDay(F, { stood, doors, keep }))).toBe(JSON.stringify(D));
  });
});
