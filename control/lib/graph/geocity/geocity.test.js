// THE GEOCITY'S MAP: its card and reader, its land's fall, its arterials stepped out from the seat, the neighbourhoods
// they carve and their rings, the green budget, the region graph's laws (a Quest Open World's: open, sideways), the
// ledger, the heights (rings, nodes, corridors) and the neighbourhoods' parks. One case per procedure: the default metro
// (a shore, a land edge to the beyond) and the island (water all round).
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

describe('its heights', () => {
  const d = designGeocity({ metro: SHORE }, { seed: 3 }), H = d.metro.heights;
  const atRing = (k) => d.regions.filter((r) => !r.park && r.builds === k);

  it('falls outward: the seat over the frame\'s reach over the outskirts, where no node reaches', () => {
    const quiet = { metro: SHORE, heights: { nodes: { every: 0 } } }, q = designGeocity(quiet, { seed: 3 }), [sx, sy] = q.seat;
    const away = q.metro.fall.toward === 's' ? [0, 1] : q.metro.fall.toward === 'n' ? [0, -1] : q.metro.fall.toward === 'w' ? [1, 0] : [-1, 0];
    const at = (m) => q.heights.storeysAt(sx + away[0] * m, sy + away[1] * m);
    const ms = [0, q.metro.rings.core + 50, q.metro.rings.frame + 50].map((m) => at(m).median);
    expect(ms[0]).toBeGreaterThan(ms[1]);
    expect(ms[1]).toBeGreaterThan(ms[2]);
    expect(q.heights.nodes).toHaveLength(0);
    expect(law(d, 'skyline').ok).toBe(true);
  });

  it('builds every neighbourhood inside its ring\'s rail, the outskirts at their storeys and lower', () => {
    expect(law(d, 'caps').ok).toBe(true);
    for (const r of atRing('outskirts')) expect(r.storeys.median).toBeLessThanOrEqual(H.outskirts.rail[1]);
    for (const r of atRing('core')) expect(r.storeys.rail).toEqual(H.core.rail);
  });

  it('raises secondary nodes on the spines past the core, the neighbourhoods round them a ring inward', () => {
    expect(d.heights.nodes.length).toBeGreaterThan(0);
    const spines = new Set(d.lines.filter((l) => l.rank === 'spine').map((l) => l.id));
    for (const n of d.heights.nodes) {
      expect(spines.has(n.street)).toBe(true);
      expect(Math.hypot(n.at[0] - d.seat[0], n.at[1] - d.seat[1])).toBeGreaterThan(d.metro.rings.core);
      const round = d.regions.filter((r) => r.node === n.id);
      expect(round.length).toBeGreaterThan(0);
      const inward = { outskirts: 'frame', frame: 'core', core: 'core' };
      for (const r of round) expect(r.builds).toBe(inward[r.ring]);
    }
  });

  it('lifts an arterial frontage past its ring\'s rail to its corridor\'s storeys, the spine\'s more', () => {
    const r = atRing('outskirts').find((x) => Object.values(x.frontage).some((f) => f.rank === 'spine')), f = Object.values(r.frontage).find((x) => x.rank === 'spine');
    expect(f.rail[1]).toBe(H.corridor.spine);
    expect(f.median).toBeGreaterThan(r.storeys.median);
    const a = atRing('outskirts').flatMap((x) => Object.values(x.frontage)).find((x) => x.rank === 'arterial');
    expect(a.rail[1]).toBe(Math.max(H.outskirts.rail[1], H.corridor.arterial));
    expect(law(d, 'interior').ok).toBe(true);
  });
});

describe('its neighbourhoods\' parks', () => {
  const d = designGeocity({ metro: SHORE }, { seed: 3 });
  it('places each park out of its quota: along the shore on the water, inside the interior inland', () => {
    expect(law(d, 'parks').ok).toBe(true);
    const shore = d.metro.water.sides[0], edge = { s: 1, n: 3, w: 0, e: 2 }[shore];
    const onWater = d.regions.filter((r) => r.parkRect?.along === 'water');
    expect(onWater.length).toBeGreaterThan(0);
    for (const r of onWater) expect(r.parkRect.rect[edge]).toBe(r.rect[edge]);
    expect(d.regions.some((r) => r.parkRect?.along === 'inland')).toBe(true);
    expect(d.ledger.green.placed).toBeGreaterThan(0);
  });
  it('lays none under the least, leaving the quota to its segments', () => {
    const q = designGeocity({ metro: SHORE, green: { park: { least: 1e6 } } }, { seed: 3 });
    expect(q.regions.filter((r) => r.parkRect)).toHaveLength(0);
    expect(law(q, 'parks').ok).toBe(true);
  });
});

describe('the heights\' reader', () => {
  it('merges a recipe\'s heights all the way down, and refuses rails that do not nest', () => {
    const T = readGeocity({ metro: SHORE, heights: { corridor: { spine: 10 } } });
    expect(T.metro.heights.corridor).toEqual({ ...METROS[SHORE].heights.corridor, spine: 10 });
    expect(() => readGeocity({ heights: { outskirts: { rail: [1, 30], median: [2, 3] } } })).toThrow(/no higher than the ring inside it/);
    expect(() => readGeocity({ heights: { frame: { median: [2, 3] } } })).toThrow(/inside its rail/);
  });
});

describe('its blocks', () => {
  const d = designGeocity({ metro: SHORE }, { seed: 3 }), M = d.metro;
  const lots = d.regions.flatMap((r) => r.blocks).filter((b) => b.kind !== 'park');

  it('shares out each neighbourhood once (its streets, blocks and park) and each block\'s ground once', () => {
    expect(law(d, 'blocks').ok).toBe(true);
    for (const r of d.regions) expect(r.ledger.streets + r.ledger.blocks + r.ledger.park).toBeCloseTo(r.area, 0);
    for (const b of lots) expect(Object.values(b.surfaces).reduce((a, v) => a + v, 0)).toBeCloseTo(b.area, 2);
  });

  it('gives every block a segment of its ring, an edge and a main street their street along their long side', () => {
    const OF = { core: ['tower', 'podium', 'square'], frame: ['midrise', 'slab'], outskirts: ['houses', 'main-street', 'edge', 'lowrise', 'apartments', 'school'] };
    for (const b of lots) expect(OF[b.ring]).toContain(b.kind);
    const longSides = (b) => (b.rect[3] - b.rect[1] >= b.rect[2] - b.rect[0] ? ['w', 'e'] : ['s', 'n']);
    for (const b of lots.filter((x) => x.kind === 'edge')) expect(longSides(b).some((k) => b.sides[k].kind === 'arterial')).toBe(true);
    for (const b of lots.filter((x) => x.kind === 'main-street')) expect(longSides(b).some((k) => b.sides[k].rank === 'collector')).toBe(true);
    expect(law(d, 'segments').ok).toBe(true);
  });

  it('lays its outskirts\' ground as the geotown does: a houses block its houses, yards and paths, no street', () => {
    const b = lots.find((x) => x.kind === 'houses');
    for (const s of ['house', 'front', 'back']) expect(b.surfaces[s]).toBeGreaterThan(0);
    for (const s of ['road', 'verge', 'walk', 'parking']) expect(b.surfaces[s]).toBeUndefined();
    expect(b.surfaces.back).toBeGreaterThan(b.surfaces.front);
  });

  it('runs collectors across a wide neighbourhood and none across a narrow one', () => {
    const wide = d.regions.find((r) => !r.park && r.rect[2] - r.rect[0] > M.streets.collector + 200 && r.rect[3] - r.rect[1] > M.streets.collector + 200);
    expect(wide.streets.filter((s) => s.rank === 'collector').map((s) => s.axis).sort()).toEqual(['ew', 'ns']);
    const narrow = d.regions.find((r) => !r.park && r.rect[2] - r.rect[0] < M.streets.collector && r.rect[3] - r.rect[1] < M.streets.collector);
    expect(narrow.streets.filter((s) => s.rank === 'collector')).toHaveLength(0);
  });

  it('takes its streets round its park, never through it', () => {
    const r = d.regions.find((x) => x.parkRect?.along === 'inland'), pk = r.parkRect.rect;
    expect(r.blocks.find((b) => b.kind === 'park').rect).toEqual(pk);
    for (const s of r.streets) for (const [a, b] of s.runs) {
      const seg = s.axis === 'ns' ? [s.at - s.w / 2, a, s.at + s.w / 2, b] : [a, s.at - s.w / 2, b, s.at + s.w / 2];
      const overlap = Math.max(0, Math.min(seg[2], pk[2]) - Math.max(seg[0], pk[0])) * Math.max(0, Math.min(seg[3], pk[3]) - Math.max(seg[1], pk[1]));
      expect(overlap).toBeLessThan(1e-6);
    }
  });

  it('stands its towers past their podiums, inside their rail, only on tower blocks, the tallest in the core', () => {
    const towered = lots.filter((b) => b.towers);
    expect(towered.length).toBeGreaterThan(0);
    expect(towered.every((b) => b.kind === 'tower' && b.ring === 'core')).toBe(true);
    for (const b of towered) for (const t of b.towers) { expect(t.storeys).toBeGreaterThan(b.podium); expect(t.storeys).toBeLessThanOrEqual(b.storeys.rail[1]); }
    expect(law(d, 'towers').ok).toBe(true);
  });

  it('grows its green ground: a neighbourhood\'s soft ground its park and more', () => {
    expect(law(d, 'soft').ok).toBe(true);
    for (const r of d.regions.filter((x) => x.parkRect)) expect(r.soft).toBeGreaterThanOrEqual(r.parkRect.area);
  });

  it('rolls a neighbourhood\'s blocks on its own dice: the outskirts\' weights moved, the core stands as it was', () => {
    const q = designGeocity({ metro: SHORE, segments: { outskirts: { houses: 1, apartments: 5, lowrise: 5 } } }, { seed: 3 });
    const core = (x) => JSON.stringify(x.regions.filter((r) => r.builds === 'core').map((r) => r.blocks));
    expect(core(q)).toBe(core(d));
    const kinds = (x) => x.regions.filter((r) => r.builds === 'outskirts').flatMap((r) => r.blocks.map((b) => b.kind)).join();
    expect(kinds(q)).not.toBe(kinds(d));
  });

  it('draws its blocks, cropped round a focus', () => {
    const svg = geocitySheet(d, { view: 'blocks', focus: [d.regions[0].id], px: 1 });
    expect(svg).toContain('tower');
    expect(Number(/width="(\d+)"/.exec(svg)[1])).toBeLessThan(d.frame.W);
  });
});
