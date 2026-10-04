import { describe, it, expect } from 'vitest';
import { planHistoricCity, assembleHistoricCityScene, assetCall } from './historic-city.js';
import { placeAsset } from './assets/kit.js';
import { EGYPT_ASSETS } from './assets/egypt.js';
import { THEBES } from './cultures/thebes.js';
import { PATTERNS } from './patterns.js';

const gap = (a, b) => Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.d), a.y - (b.y + b.d));

describe('historic city: New Kingdom Thebes', () => {
  it('every Thebes asset is built from shared patterns and stays on its slot (only a front reach may leave it)', () => {
    for (const A of Object.values(EGYPT_ASSETS)) {
      for (const id of A.patterns) expect(PATTERNS[id], `${A.id}: ${id}`).toBeTruthy();
      const w = (A.envelope.w[0] + A.envelope.w[1]) / 2, d = (A.envelope.d[0] + A.envelope.d[1]) / 2;
      const { boxes } = placeAsset(A, { asset: A.id, rect: { x: 0, y: 0, w, d }, facing: 'n', exposed: true }, { palette: THEBES.palette, culture: THEBES, rng: () => 0.5 });
      expect(boxes.length, A.id).toBeGreaterThan(0);
      for (const b of boxes) {
        expect(b.x, `${A.id} ${b.kind}`).toBeGreaterThanOrEqual(-1e-6); expect(b.x + b.w, `${A.id} ${b.kind}`).toBeLessThanOrEqual(w + 1e-6);
        expect(b.y + b.d, `${A.id} ${b.kind}`).toBeLessThanOrEqual(d + 1e-6);
      }
    }
  });
  it('the temple runs in order along its axis from the river: quay, avenue, pylon, court, second pylon, hypostyle, sanctuary', () => {
    for (const seed of [3, 7, 11]) {
      const p = planHistoricCity({ seed, culture: 'thebes' }), a = p.stats.axis;
      expect(a.quay).toBeLessThan(a.pylon); expect(a.pylon).toBeLessThan(a.court); expect(a.court).toBeLessThan(a.pylon2);
      expect(a.pylon2).toBeLessThan(a.hypostyle); expect(a.hypostyle).toBeLessThan(a.sanctuary);
      // the lake and the storerooms keep clear of the temple
      const temple = p.slots.filter((q) => ['eg-court', 'eg-hypostyle', 'eg-sanctuary'].includes(q.asset)).map((q) => q.rect);
      for (const q of p.slots.filter((s) => ['eg-sacred-lake', 'granary'].includes(s.asset))) for (const t of temple) expect(gap(q.rect, t), q.asset).toBeGreaterThan(6);
    }
  });
  it('every slot is in the kit; every house fronts a lane; the river lies below the plain', () => {
    const p = planHistoricCity({ seed: 7, culture: 'thebes' });
    for (const q of p.slots) expect(EGYPT_ASSETS[q.asset], q.asset).toBeTruthy();
    expect(assetCall(p, EGYPT_ASSETS).find((e) => e.asset === 'eg-house').count).toBeGreaterThan(40);
    const lanes = p.grounds.filter((g) => g.kind === 'lane');
    const fronts = (r) => lanes.some((g) => g.x < r.x + r.w + 0.5 && g.x + g.w > r.x - 0.5 && g.y < r.y + r.d + 0.5 && g.y + g.d > r.y - 0.5);
    expect(p.slots.filter((q) => /^eg-(house|villa)$/.test(q.asset) && !fronts(q.rect))).toEqual([]);
    expect(p.grounds.filter((g) => g.kind === 'water').every((g) => g.z < -2)).toBe(true);
  });
  it('builds a scene, opening on any of its views', () => {
    const s = assembleHistoricCityScene({ seed: 7, culture: 'thebes', view: 'avenue' });
    expect(s.cameras[0].name).toBe('avenue');
    expect(s.faces.length).toBeGreaterThan(5000);
  });
});

import { decollideFaces } from '../figures/face-mesh.js';
describe('historic city: the ground stays on the ground in the World', () => {
  it('the de-overlap pass lifts no ground face more than a hair (overlapping strips must not chain)', () => {
    for (const culture of ['sumer', 'thebes']) {
      const s = assembleHistoricCityScene({ seed: 7, culture });
      const ground = s.faces.filter((f) => f.corners.length === 4 && f.corners.every((c) => Math.abs(c[2]) < 0.05));
      const lifted = decollideFaces(ground).map((f) => Math.max(...f.corners.map((c) => c[2])));
      expect(Math.max(...lifted), culture).toBeLessThan(0.06);
    }
  });
});
