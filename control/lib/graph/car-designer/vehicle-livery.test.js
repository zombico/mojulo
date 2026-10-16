// A supercar's livery: paint as any colour, a pattern cut into its painted panels. The concepts: absent, nothing
// changes, and a hex is its name's paint; junk is refused; each pattern paints only paint, only where it says, and
// nothing grows; a cut point is shared by the faces either side of its edge; within the livery's allowance; a field
// solved by the color theorist dresses a car; deterministic. One card at the game quality, chosen from the library.
import { describe, it, expect } from 'vitest';
import { compileSupercarSurface, LIVERY_ALLOWANCE, SUPERCAR_LODS } from './vehicle-odm-surface.js';
import { SUPERCAR_LIBRARY } from './vehicle-library.js';
import { PAINTS, applyLivery } from './vehicle-livery.js';
import { solveLiveries } from '../color-theorist/livery.js';

const card = SUPERCAR_LIBRARY[Object.keys(SUPERCAR_LIBRARY)[0]];
const build = (surface = {}) => compileSupercarSurface(card.brief, { ...card.surface, quality: 'game', ...surface });
const plain = build();
const all = (c) => Object.values(c.faces).flat();
const box = (fs) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (const f of fs) for (const p of f.corners) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); } return { lo, hi }; };
const mid = (f) => [0, 1, 2].map((k) => f.corners.reduce((s, p) => s + p[k], 0) / f.corners.length);
const name = Object.keys(PAINTS).find((k) => k !== card.surface.paint);

describe('a supercar\'s livery', () => {
  it('absent, nothing changes; a hex is its name\'s paint; mono is no livery', () => {
    const named = build({ paint: name });
    expect(JSON.stringify(build({ paint: PAINTS[name] }))).toBe(JSON.stringify(named));
    expect(JSON.stringify(build({ livery: { pattern: 'mono' } }))).toBe(JSON.stringify(plain));
    expect(plain.livery).toBeUndefined();
    expect(plain.census.triangleBudget).toBe(SUPERCAR_LODS.game.triangleBudget);
  });

  it('refuses what is not a paint or a livery', () => {
    expect(() => build({ paint: 'chartreuse' })).toThrow(/unknown paint/);
    expect(() => build({ livery: { pattern: 'plaid' } })).toThrow(/pattern is one of/);
    expect(() => build({ livery: { pattern: 'stripes', logo: 'x' } })).toThrow(/logo is not one of/);
    expect(() => build({ livery: { pattern: 'stripes', secondary: 'nope' } })).toThrow(/unknown paint/);
  });

  for (const pattern of ['stripes', 'split']) {
    it(`${pattern}: the secondary on paint only, where the pattern says, nothing grown, within its allowance`, () => {
      const c = build({ livery: { pattern, secondary: '#eef0f2' } }), paint = PAINTS[card.surface.paint];
      const second = all(c).filter((f) => f.albedo === '#eef0f2');
      expect(c.livery).toEqual({ pattern, secondary: '#eef0f2' });
      expect(second.length).toBeGreaterThan(20);
      expect(second.every((f) => f.material === 'paint')).toBe(true);
      const W = c.design.frame.W, H = c.design.frame.H, g = c.design.frame.groundClearance;
      for (const f of second) {
        const m = mid(f);
        if (pattern === 'stripes') { expect(Math.abs(m[0])).toBeGreaterThan(0.0175 * W); expect(Math.abs(m[0])).toBeLessThan(0.1175 * W); }
        else expect(m[2]).toBeLessThan(g + 0.3 * (H - g));
      }
      // the paint keeps the rest; nothing not painted is touched; nothing grows
      expect(all(c).some((f) => f.albedo === paint)).toBe(true);
      for (const m of ['glass', 'rubber', 'alloy', 'lamp']) expect(all(c).filter((f) => f.material === m).length, m).toBe(all(plain).filter((f) => f.material === m).length);
      const [p, q] = [box(all(plain)), box(all(c))];
      for (let i = 0; i < 3; i++) { expect(q.lo[i]).toBeGreaterThanOrEqual(p.lo[i] - 1e-4); expect(q.hi[i]).toBeLessThanOrEqual(p.hi[i] + 1e-4); }
      expect(c.census.triangles).toBeGreaterThan(plain.census.triangles);
      expect(c.census.triangles).toBeLessThanOrEqual(c.census.triangleBudget);
      expect(c.census.triangleBudget).toBe(Math.round(SUPERCAR_LODS.game.triangleBudget * (1 + LIVERY_ALLOWANCE)));
      expect(JSON.stringify(build({ livery: { pattern, secondary: '#eef0f2' } }))).toBe(JSON.stringify(c));
    });
  }

  it('cuts an edge at one point, whichever face lists it', () => {
    // two upward quads sharing the edge x 0 → 1 at y = 0, listed in opposite directions, across a stripe's plane
    const a = { corners: [[0, -1, 1], [1, -1, 1], [1, 0, 1], [0, 0, 1]], fill: '#af2632', part: 'body.deck' };
    const b = { corners: [[1, 0, 1], [1, 1, 1.2], [0, 1, 1.2], [0, 0, 1]], fill: '#af2632', part: 'body.deck' };
    const dress = (f) => applyLivery([f], { paint: '#af2632', livery: { pattern: 'stripes', secondary: '#ffffff' }, frame: { W: 4, H: 1, groundClearance: 0.1 }, isPaint: () => true });
    const onEdge = (fs) => new Set(fs.flatMap((f) => f.corners.filter((p) => p[1] === 0 && p[2] === 1 && p[0] > 0 && p[0] < 1).map((p) => p.join())));
    const [A, B] = [dress(a), dress(b)];
    expect(onEdge(A).size).toBeGreaterThan(0);
    expect([...onEdge(A)].sort()).toEqual([...onEdge(B)].sort());
    expect([...A, ...B].every((f) => f.corners.length <= 4)).toBe(true);
  });

  it('wears a field the color theorist solved', () => {
    const { liveries } = solveLiveries({ n: 3, seed: 2 });
    const cars = liveries.map((l) => build({ paint: l.paint, livery: { pattern: l.pattern, secondary: l.secondary } }));
    cars.forEach((c, i) => expect(all(c).some((f) => f.albedo === liveries[i].paint)).toBe(true));
  });
});
