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
    for (const k of ['city-wall', 'wall-tower', 'gate-tower', 'terrace', 'platform', 'stair', 'temple', 'house', 'palm', 'bridge-deck', 'bridge-corbel', 'revetment']) expect(kinds, k).toContain(k);
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

describe('historic city: walkable between the houses', () => {
  it('every house fronts a lane, and stands apart from its neighbours', () => {
    for (const seed of [7, 11, 23]) {
      const p = planHistoricCity({ seed });
      const lanes = p.grounds.filter((g) => g.kind === 'lane');
      const houses = p.slots.filter((q) => /^house|granary/.test(q.asset));
      // a lane strip within the house's set-back of one of its edges
      const fronts = (r) => lanes.some((g) => g.x < r.x + r.w + 0.5 && g.x + g.w > r.x - 0.5 && g.y < r.y + r.d + 0.5 && g.y + g.d > r.y - 0.5);
      expect(houses.filter((q) => !fronts(q.rect))).toEqual([]);
      for (let i = 0; i < houses.length; i++) for (let j = i + 1; j < houses.length; j++) {
        const a = houses[i].rect, b = houses[j].rect;
        const gap = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.d), a.y - (b.y + b.d));
        expect(gap).toBeGreaterThan(0.8);
      }
    }
  });
});

describe('historic city: the precinct has room', () => {
  it('the temples keep open court from the ziggurat and its stair, and the precinct stays inside the wall', () => {
    for (let seed = 1; seed <= 24; seed++) {
      const p = planHistoricCity({ seed }), at = (id) => p.slots.find((q) => q.asset === id).rect;
      const z = at('ziggurat'), reach = { ...z, d: z.d * 1.5 };   // the central flight runs out half the depth again
      const gap = (a, b) => Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.d), a.y - (b.y + b.d));
      expect(gap(reach, at('white-temple'))).toBeGreaterThan(8);
      expect(gap(reach, at('pillar-hall'))).toBeGreaterThan(8);
      const pc = p.stats.precinct;
      for (const w of p.slots.filter((q) => q.asset === 'wall-run' || q.asset === 'wall-tower')) expect(gap(pc, w.rect)).toBeGreaterThan(0);
    }
  });
});

import { SUMER_ASSETS } from './assets/sumer.js';
describe('historic city: the canal', () => {
  it('each main-street crossing gets a humped bridge whose corbelled opening a reed boat passes, horns and all', () => {
    const p = planHistoricCity({ seed: 7 }), bridges = p.slots.filter((q) => q.asset === 'canal-bridge');
    expect(bridges.length).toBeGreaterThan(0);
    const boat = SUMER_ASSETS['reed-boat'].build({ W: 10, D: 2.2, slot: {} }, { palette: SUMER.palette, rng: () => 0.5 });
    for (const b of bridges) {
      const open = SUMER_ASSETS['canal-bridge'].profile(b.span, b.waterZ), base = b.waterZ + 0.05;
      for (const part of boat) {
        const need = Math.max(Math.abs(part.y - 1.1), Math.abs(part.y + part.d - 1.1));   // off the boat's centreline
        expect(open(base + part.z1 - 1e-6), part.kind).toBeGreaterThanOrEqual(need);
      }
    }
  });
  it('the water lies below the quays, and no lane is laid over a quay', () => {
    const p = planHistoricCity({ seed: 7 });
    expect(p.grounds.filter((g) => g.kind === 'water').every((g) => g.z < -1)).toBe(true);
    const quays = p.grounds.filter((g) => g.kind === 'quay'), lanes = p.grounds.filter((g) => g.kind === 'lane');
    const over = (a, b) => a.x < b.x + b.w - 0.4 && b.x < a.x + a.w - 0.4 && a.y < b.y + b.d - 0.4 && b.y < a.y + a.d - 0.4;   // hairline seam overlaps allowed
    expect(lanes.filter((l) => quays.some((q) => over(l, q)))).toEqual([]);
  });
});
