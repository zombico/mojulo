import { describe, it, expect } from 'vitest';
import { FLEETS, YARDS, fleetOf, pickOf, assignYards } from './fleets.js';
import { designGeocity } from './design.js';
import { mulberry32 } from '../city/plan/dice.js';

describe('the metro\'s fleets and their yards', () => {
  it('reads each fleet\'s rows through the registry to the body each stands as, a stand-in named where there is none yet', () => {
    // (one role a path: a car shelf card, a loft, a stand-in, a construction shelf machine)
    expect(fleetOf('civilian').every((f) => !f.model.includes(':'))).toBe(true);
    expect(fleetOf('bus')[0].model).toBe('loft:bus');
    const fire = fleetOf('fire')[0];
    expect(fire).toMatchObject({ vehicle: 'fire-engine', stand: 'box-truck', model: 'loft:straightTruck', extra: 'lightbar-r' });
    expect(fleetOf('construction').every((f) => f.model.startsWith('site:'))).toBe(true);
    expect(() => fleetOf('spaceship')).toThrow(/no role a metro keeps/);
    // (every yard keeps fleets there are)
    for (const Y of Object.values(YARDS)) for (const role of Object.keys(Y.roles)) expect(FLEETS[role]).toBeDefined();
    // (a pick is a row of the fleet in one of its paints, by its dice)
    const p = pickOf(fleetOf('utility'), mulberry32(3));
    expect(fleetOf('utility').some((f) => f.model === p.model && f.paints.includes(p.paint))).toBe(true);
  });

  it('gives each parking block a yard by the metro\'s dice: a depot, a works yard, an emergency station, the rest car parks', () => {
    const d = designGeocity({}, { seed: 2 }), Y = d.yards, n = {};
    for (const y of Object.values(Y)) n[y] = (n[y] ?? 0) + 1;
    for (const y of ['depot', 'works', 'emergency', 'lot']) expect(n[y]).toBeGreaterThan(0);
    expect(d.laws.find((l) => l.law === 'yards').ok).toBe(true);
    const blocks = d.regions.flatMap((r) => (r.blocks ?? []).map((b) => [b, r]));
    for (const [id, y] of Object.entries(Y)) {
      const [b, r] = blocks.find(([x]) => x.id === id);
      // (a contractor's yard a vacant block in a neighbourhood with sites; the others its parking blocks)
      if (y === 'contractor') { expect(b.kind).toBe('vacant'); expect(r.blocks.some((x) => x.kind === 'construction')).toBe(true); }
      else expect(b.kind).toBe('parking');
    }
    expect(JSON.stringify(assignYards(d.regions, 2))).toBe(JSON.stringify(Y));
  });
});
