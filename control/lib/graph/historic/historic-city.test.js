import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { planHistoricCity, assembleHistoricCityScene } from './historic-city.js';
import { PATTERNS } from './patterns.js';
import { SUMER } from './cultures/sumer.js';
import { HISTORIC_CULTURES } from './historic-city.js';

const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const overlaps = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.d - 1e-6 && b.y < a.y + a.d - 1e-6;

describe('historic city: Sumer, the big read', () => {
  const p = planHistoricCity({ seed: 7 });
  it('is deterministic, and a different seed is a different town', () => {
    expect(hash(planHistoricCity({ seed: 7 }))).toBe(hash(p));
    expect(hash(planHistoricCity({ seed: 8 }))).not.toBe(hash(p));
  });
  it('a culture is built only from patterns in the shared vocabulary', () => {
    for (const k of Object.values(HISTORIC_CULTURES)) for (const id of k.patterns) expect(PATTERNS[id], id).toBeTruthy();
  });
  it('has every part of the composition: wall + towers + gates, precinct with a stepped platform and temple, houses, courtyards, canal, palms', () => {
    const kinds = new Set(p.boxes.map((b) => b.kind));
    for (const k of ['city-wall', 'wall-tower', 'gate-tower', 'terrace', 'platform', 'stair', 'temple', 'house', 'palm', 'bridge']) expect(kinds, k).toContain(k);
    expect(p.stats.gates).toBeGreaterThanOrEqual(3);
    expect(p.stats.courtyards).toBeGreaterThan(0);
    expect(p.grounds.some((g) => g.kind === 'water')).toBe(true);
  });
  it('houses keep off lanes, water, the wall and the precinct (each cell claimed once)', () => {
    const { cols, cell, data, codes } = p.grid;
    const bad = p.boxes.filter((b) => b.kind === 'house').filter((b) => {
      for (let y = b.y + cell / 2; y < b.y + b.d; y += cell) for (let x = b.x + cell / 2; x < b.x + b.w; x += cell) {
        if (data[Math.floor(y / cell) * cols + Math.floor(x / cell)] !== codes.HOUSE) return true;
      }
      return false;
    });
    expect(bad).toEqual([]);
    const precinct = p.stats.precinct;
    expect(p.boxes.filter((b) => b.kind === 'house' && overlaps(b, precinct))).toEqual([]);
  });
  it('layout and dressing draw on separate streams: a dressing dial never moves a lane, the wall or the precinct', () => {
    const lanes = (q) => hash(q.grounds.filter((g) => g.kind === 'lane' || g.kind === 'water'));
    const layout = (q) => hash(q.boxes.filter((b) => ['city-wall', 'terrace', 'platform', 'gate-tower'].includes(b.kind)));
    const saved = SUMER.house.whitewash;
    try {
      SUMER.house.whitewash = 0.5;
      const q = planHistoricCity({ seed: 7 });
      expect(layout(q)).toBe(layout(p));
      expect(q.boxes.filter((b) => b.kind === 'house').length).toBe(p.boxes.filter((b) => b.kind === 'house').length);
      expect(lanes(q)).toBe(lanes(p));
    } finally { SUMER.house.whitewash = saved; }
  });
  it('assembles a scene of plain lit masses in scene units', () => {
    const s = assembleHistoricCityScene({ seed: 7 });
    expect(s.faces.length).toBeGreaterThan(1000);
    expect(s.stats.culture).toBe('sumer');
  });
});
