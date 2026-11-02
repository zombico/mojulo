// THE CONCOURSES DRESSED (`geocity.under`): shopfronts along a concourse's walls but where a way out or the stair
// stands, a sign in its route's colour over each way out, a food court in the hub clear of every walk through it; and
// the light below grade: on a page taking the live sun, nothing under the city takes a share of it, and no sky card
// stands in it.
import { describe, it, expect } from 'vitest';
import { dressUnder, ROUTES, SHOP } from './dress.js';
import { podiumInside } from './podium.js';
import { assembleGeocityScene } from './scene.js';

describe('a concourse dressed', () => {
  const lot = { id: 'X1.0.0:podium', x0: 100, y0: 200, x1: 140, y1: 236, z0: 5, h: 14, front: '-y' };
  const I = podiumInside(lot, { padZ: 5, ports: [{ id: 'X1.0.0-X1.1.0', side: '+y', u: 120 }, { id: 'X1.0.0-X2.0.0', side: '+x', u: 210 }] });
  const tunnel = { id: 'X1.0.0-X1.1.0', line: [[120, 216.5, 0.5], [120, 240, 0.5]] };
  const D = dressUnder({ podia: [{ block: 'X1.0.0', I }], tunnels: [tunnel], seed: 3 });
  const of = (g) => D.faces.filter((f) => f.group === g);
  const span = (f, ax) => [Math.min(...f.corners.map((c) => c[ax])), Math.max(...f.corners.map((c) => c[ax]))];

  it('lays shopfronts along its walls, none across a way out or against its stair', () => {
    expect(D.readout.shops['X1.0.0']).toBeGreaterThan(3);
    expect(of('geocity:shop-glass')).toHaveLength(D.readout.shops['X1.0.0']);
    for (const q of I.ports) {
      const ax = q.side.endsWith('y') ? 0 : 1, on = of('geocity:shop-glass').filter((f) => Math.abs(f.corners[0][1 - ax] - (q.plane - q.N[1 - ax] * 0.5)) < 0.2);
      for (const f of on) { const [a, b] = span(f, ax); expect(b <= q.lo - SHOP.clear + 1e-6 || a >= q.hi + SHOP.clear - 1e-6).toBe(true); }
    }
    const F = I.flight;
    for (const f of of('geocity:shop-glass')) {
      const [x0, x1] = span(f, 0), [y0, y1] = span(f, 1);
      expect(x1 < F[0] - 0.5 || x0 > F[2] + 0.5 || y1 < F[1] - 0.5 || y0 > F[3] + 0.5).toBe(true);
    }
  });

  it('signs each way out in its route\'s colour, a north-south passage\'s apart from an east-west one\'s', () => {
    expect(ROUTES.ns).not.toBe(ROUTES.ew);
    const signs = of('geocity:under-sign').filter((f) => f.fill !== '#f2f2ee');
    expect(signs).toHaveLength(I.ports.length);
    expect(new Set(signs.map((f) => f.fill)).size).toBe(2);
  });

  it('seats its food court in the hub, every table a body\'s width and more clear of every walk through it', () => {
    expect(D.readout.court).toMatchObject({ podium: 'X1.0.0' });
    expect(D.readout.court.tables).toBeGreaterThan(0);
    const walks = [I.through, I.down, ...I.ports.map((q) => q.reach)];
    for (const c of D.colliders) {
      const mid = [(c.min[0] + c.max[0]) / 2, (c.min[1] + c.max[1]) / 2];
      for (const w of walks) for (let k = 0; k + 1 < w.length; k++) {
        const a = w[k], b = w[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((mid[0] - a[0]) * dx + (mid[1] - a[1]) * dy) / l2)) : 0;
        expect(Math.hypot(mid[0] - a[0] - t * dx, mid[1] - a[1] - t * dy)).toBeGreaterThan(0.95 + 1);
      }
    }
  });

  it('is the same concourse for the same seed, its signs by its dice', () => {
    expect(dressUnder({ podia: [{ block: 'X1.0.0', I }], tunnels: [tunnel], seed: 3 }).faces).toEqual(D.faces);
    const other = dressUnder({ podia: [{ block: 'X1.0.0', I }], tunnels: [tunnel], seed: 4 });
    expect(other.faces.filter((f) => f.group === 'geocity:shop-sign').map((f) => f.fill)).not.toEqual(of('geocity:shop-sign').map((f) => f.fill));
  });
});

describe('the light below grade', () => {
  const geocity = { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2] };
  const N = assembleGeocityScene({ kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, hour: 'noon', geocity: { ...geocity, evoke: 'neighbourhood', under: true } }, { liveSun: true });
  const below = N.faces.filter((f) => /^(stage:|geocity:(tunnel|shop|under-sign|food-court))/.test(f.group));

  it('takes none of the live sun under the city, and stands no sky card in it', () => {
    expect(below.length).toBeGreaterThan(1000);
    expect(below.every((f) => f.sunShare === 0)).toBe(true);
    expect(below.some((f) => f.group === 'stage:sky' || f.group === 'stage:sunpatch')).toBe(false);
    // (and the street over it still takes its share)
    expect(N.faces.filter((f) => f.group === 'geocity:road').some((f) => f.sunShare > 0)).toBe(true);
    expect(N.geocity.under.dress.shops).toBeDefined();
    expect(Object.keys(N.geocity.under.dress.shops)).toEqual(N.geocity.under.podia.map((p) => p.id));
  });
});
