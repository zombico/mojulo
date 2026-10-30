// THE GEOCITY'S MAP: its card and reader, its land's fall, its arterials stepped out from the seat, the neighbourhoods
// they carve and their rings, the green budget, the region graph's laws (a Quest Open World's: open, sideways), the
// ledger. One case per procedure: the default metro (a shore, a land edge to the beyond) and the island (water all round).
import { describe, it, expect } from 'vitest';
import { designGeocity, columnName } from './design.js';
import { readGeocity, METROS, METRO_IDS } from './metro.js';
import { bridgesOf, partsOf, geotownLeast } from './laws.js';
import { geocitySheet } from './sheet.js';
import { PATTERNS } from '../geotown/pattern.js';

const plain = (d) => JSON.stringify({ ...d, land: { ...d.land, N: undefined, S: undefined } });
const law = (d, id) => d.laws.find((l) => l.law === id);
// the case whose water is all round it, chosen from the cards
const ISLAND = METRO_IDS.find((id) => METROS[id].water.sides.length === 4);
const SHORE = METRO_IDS.find((id) => METROS[id].water.sides.length === 1);

describe('the card and its reader', () => {
  it('refuses what is off the card by name, and lays a recipe\'s settings over its metro\'s', () => {
    expect(() => readGeocity({ towers: 3 })).toThrow(/'towers' is not a setting/);
    expect(() => readGeocity({ metro: 'atlantis' })).toThrow(/is not a metro/);
    expect(() => readGeocity({ metro: { from: SHORE, spires: 1 } })).toThrow(/metro.spires is not a setting/);
    expect(() => readGeocity({ fall: { toward: 'up' } })).toThrow(/fall is/);
    const T = readGeocity({ metro: SHORE, fall: { drop: 10 }, hills: false });
    expect(T.metro.fall).toEqual({ ...METROS[SHORE].fall, drop: 10 });
    expect(T.hills).toBeNull();
    expect(T.pattern.id).toBe(METROS[SHORE].outskirts);
  });
  it('names columns past Z', () => { expect([0, 25, 26, 27].map(columnName)).toEqual(['A', 'Z', 'AA', 'AB']); });
});

describe('a metro\'s map', () => {
  const d = designGeocity({ metro: SHORE }, { seed: 3 });

  it('is the same map for the same recipe and seed, another for another seed', () => {
    expect(plain(designGeocity({ metro: SHORE }, { seed: 3 }))).toBe(plain(d));
    expect(designGeocity({ metro: SHORE }, { seed: 4 }).lines.map((l) => l.at)).not.toEqual(d.lines.map((l) => l.at));
  });

  it('closes: every square metre once', () => {
    expect(law(d, 'closes').ok).toBe(true);
    const L = d.ledger;
    expect(L.water + L.arterials + L.parks + L.neighbourhoods).toBeCloseTo(L.total, 0);
  });

  it('lays its spine through the seat each way, its arterials tighter there than far out', () => {
    for (const axis of ['ns', 'ew']) {
      const ls = d.lines.filter((l) => l.axis === axis), spine = ls.find((l) => l.rank === 'spine');
      expect(spine.at).toBe(d.seat[axis === 'ns' ? 0 : 1]);
      expect(ls.filter((l) => l.rank === 'spine')).toHaveLength(1);
    }
    // steps from the seat northward (away from the shore): the first under the last
    const ys = d.lines.filter((l) => l.axis === 'ew' && l.at >= d.seat[1]).map((l) => l.at), steps = ys.slice(1).map((y, k) => y - ys[k]);
    expect(steps.length).toBeGreaterThan(2);
    expect(steps[0]).toBeLessThan(steps[steps.length - 1]);
  });

  it('falls toward its water: the spine across the shore rises away from it', () => {
    const toward = d.metro.fall.toward, spine = d.lines.find((l) => l.rank === 'spine' && l.axis === (toward === 's' || toward === 'n' ? 'ns' : 'ew'));
    const [a, b] = spine.ends, nearEnd = toward === 's' || toward === 'w' ? a : b, farEnd = toward === 's' || toward === 'w' ? b : a;
    expect(farEnd - nearEnd).toBeGreaterThan(d.metro.fall.drop * 0.6);
  });

  it('rings its neighbourhoods out from the seat: the four round it the core, the frame inside the outskirts', () => {
    const atSeat = d.regions.filter((r) => [r.sides.w, r.sides.e].some((s) => s.rank === 'spine') && [r.sides.s, r.sides.n].some((s) => s.rank === 'spine'));
    expect(atSeat.length).toBeGreaterThanOrEqual(2);
    expect(atSeat.every((r) => r.ring === 'core')).toBe(true);
    expect(law(d, 'rings').ok).toBe(true);
  });

  it('gives out its green share: the park reserved whole in the frame, the rest as quotas', () => {
    const parks = d.regions.filter((r) => r.park);
    expect(parks).toHaveLength(d.metro.green.parks);
    expect(parks.every((r) => r.ring === 'frame' && !r.waterfront && !r.beyond.length)).toBe(true);
    expect(d.ledger.green.reserved + d.ledger.green.quotas).toBeGreaterThanOrEqual(d.ledger.green.budget - 1);
    expect(law(d, 'green').ok).toBe(true);
  });

  it('carries a region graph: an edge across every shared arterial, its portal on that arterial', () => {
    const cols = Math.max(...d.regions.map((r) => r.i)) + 1, rows = Math.max(...d.regions.map((r) => r.j)) + 1;
    expect(d.graph.edges).toHaveLength((cols - 1) * rows + cols * (rows - 1));
    const line = new Map(d.lines.map((l) => [l.id, l]));
    for (const e of d.graph.edges) expect(e.portal[line.get(e.street).axis === 'ns' ? 0 : 1]).toBe(line.get(e.street).at);
    expect(law(d, 'open').ok && law(d, 'sideways').ok).toBe(true);
  });

  it('opens to the beyond on its land edges, never on its shore', () => {
    const shore = d.metro.water.sides[0];
    expect(d.graph.beyond.length).toBeGreaterThan(0);
    expect(d.regions.every((r) => !r.beyond.includes(shore))).toBe(true);
    expect(d.regions.filter((r) => r.sides[shore].kind === 'water').every((r) => r.waterfront)).toBe(true);
  });

  it('draws its sheet', () => {
    const svg = geocitySheet(d);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain(d.regions[0].id);
  });
});

describe('an island', () => {
  const d = designGeocity({ metro: ISLAND }, { seed: 1 });
  it('has water all round it, nothing beyond, and its graph open and sideways', () => {
    expect(d.water).toHaveLength(4);
    expect(d.graph.beyond).toHaveLength(0);
    expect(d.regions.filter((r) => r.waterfront).length).toBeGreaterThan(0);
    expect(law(d, 'open').ok).toBe(true);
    expect(law(d, 'sideways').ok).toBe(true);
    expect(law(d, 'closes').ok).toBe(true);
  });
});

describe('the laws advise, never refuse', () => {
  it('a metro too steep for its grade is still laid, the grade law saying so', () => {
    const d = designGeocity({ metro: SHORE, fall: { drop: 200 }, extent: [1400, 1200], water: { sides: [], depth: 0 } }, { seed: 1 });
    expect(d.regions.length).toBeGreaterThan(0);
    expect(law(d, 'grade').ok).toBe(false);
  });
  it('finds a region graph\'s bridges and parts', () => {
    const g = { nodes: ['a', 'b', 'c', 'd'], edges: [{ id: 'ab', a: 'a', b: 'b' }, { id: 'bc', a: 'b', b: 'c' }, { id: 'ca', a: 'c', b: 'a' }, { id: 'cd', a: 'c', b: 'd' }] };
    expect(bridgesOf(g)).toEqual(['cd']);
    expect(partsOf({ nodes: ['a', 'b', 'c'], edges: [{ id: 'ab', a: 'a', b: 'b' }] })).toHaveLength(2);
  });
  it('measures a geotown neighbourhood\'s least by its pattern', () => {
    const P = PATTERNS[METROS[SHORE].outskirts], [a, b] = geotownLeast(P);
    expect(a).toBeGreaterThan(2 * P.block.long[0]);
    expect(b).toBeGreaterThan(4 * P.block.depth[0]);
  });
});
