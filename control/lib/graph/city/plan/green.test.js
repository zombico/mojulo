import { describe, it, expect } from 'vitest';
import { readCityPlan, inferCity } from './card.js';
import { designCity } from './design.js';
import { cityGreen, greenPlan, greenGround, readGreen, GREEN_IDS, MEDIAN } from './green.js';
import { assembleCityScene } from './scene.js';
import { cityPlanSvg } from './book-html.js';
import { resolveGrammar } from './grammars.js';

const recipe = (rec = {}) => ({ kind: 'city', ...inferCity({ seed: 6, grammar: 'paris', board: { cols: 8, rows: 6 }, cars: false, sites: [{ at: 'C3:D4', use: 'park' }, { at: 'F5', use: 'plaza' }], ...rec }).recipe });
const along = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy, t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / L2)); return Math.hypot(p.x - a[0] - t * dx, p.y - a[1] - t * dy); };

describe('the green: an interceptor grown on the laid city', () => {
  const d = designCity(recipe()), G = cityGreen(d);
  it('reads its aggressiveness over the grammar\'s, and refuses what is off it by name', () => {
    expect(readGreen(undefined, d.grammar)).toEqual(Object.fromEntries(GREEN_IDS.map((k) => [k, d.grammar.green[k]])));
    expect(readGreen(0.3, d.grammar).park).toBe(0.3);
    expect(readGreen({ street: 0 }, d.grammar)).toMatchObject({ street: 0, park: d.grammar.green.park });
    expect(() => readCityPlan({ green: 2 })).toThrow(/green is a number from 0/);
    expect(() => readCityPlan({ green: { hedges: 1 } })).toThrow(/green.hedges is not a kind of green \(street, median, park, plaza, court\)/);
    expect(() => readCityPlan({ grammar: { from: 'paris', green: { trees: ['baobab'] } } })).toThrow(/green.trees is a list of tree species/);
  });
  it('stands each street tree a metre in from its kerb, clear of the crossings, the doors and the lots', () => {
    const street = G.filter((g) => g.kind === 'street');
    expect(street.length).toBeGreaterThan(50);
    for (const t of street) {
      const near = d.streets.map((s) => ({ s, dist: Math.min(...s.pts.slice(1).map((b, k) => along(t, s.pts[k], b))) })).sort((a, b) => a.dist - b.dist)[0];
      // off every carriageway, in some street's walk
      for (const st of d.streets) expect(Math.min(...st.pts.slice(1).map((b, k) => along(t, st.pts[k], b)))).toBeGreaterThan(st.road / 2);
      expect(near.dist).toBeLessThanOrEqual(near.s.road / 2 + near.s.walk);
      expect(d.walk.nodes.filter((n) => n.degree >= 3).every((n) => Math.hypot(n.x - t.x, n.y - t.y) >= 11)).toBe(true);
      expect(d.lots.filter((l) => l.door).every((l) => Math.hypot(l.door[0] - t.x, l.door[1] - t.y) >= 3.5)).toBe(true);
      expect(d.lots.some((l) => l.use !== 'parking' && t.x > l.x0 + 0.3 && t.x < l.x1 - 0.3 && t.y > l.y0 + 0.3 && t.y < l.y1 - 0.3)).toBe(false);
    }
  });
  it('grows the park loose inside it, and rings the plaza', () => {
    const park = d.sites.find((s) => s.use === 'park'), plaza = d.sites.find((s) => s.use === 'plaza');
    const inR = (g, r) => g.x > r.x0 && g.x < r.x1 && g.y > r.y0 && g.y < r.y1;
    expect(G.filter((g) => g.kind === 'park').length).toBeGreaterThan(5);
    expect(G.filter((g) => g.kind === 'park').every((g) => inR(g, park.rect))).toBe(true);
    expect(G.filter((g) => g.kind === 'park').some((g) => g.plant === 'shrub')).toBe(true);
    expect(G.filter((g) => g.kind === 'plaza').every((g) => inR(g, plaza.rect))).toBe(true);
  });
  it('takes as many sites as its aggressiveness says, none at 0, its caps held at 1', () => {
    expect(cityGreen(designCity(recipe({ green: 0 })))).toEqual([]);
    const all = cityGreen(designCity(recipe({ green: 1 }))), few = cityGreen(designCity(recipe({ green: 0.3 })));
    expect(all.filter((g) => g.kind === 'street').length).toBeGreaterThan(few.filter((g) => g.kind === 'street').length * 2);
    expect(all.filter((g) => g.kind === 'street').length).toBeLessThanOrEqual(700);
  });
  it('rolls each street\'s and site\'s own dice: a lot by hand moves no tree', () => {
    const lot = d.lots.find((l) => l.use !== 'parking');
    expect(cityGreen(designCity(recipe({ lots: { [lot.id]: { storeys: lot.floors + 6 } } })))).toEqual(G);
  });
  it('grows the grammar\'s species: palms in the Gulf, its own trees from a document', () => {
    const gulf = greenPlan(designCity(recipe({ grammar: 'gulf' })));
    expect((gulf.items.date || []).length).toBeGreaterThan((gulf.items.schefflera || []).length);
    const own = greenPlan(designCity(recipe({ grammar: { from: 'paris', green: { trees: ['schefflera'] } } })));
    expect(Object.keys(own.items)).toEqual(['schefflera']);
    expect(resolveGrammar('xeno-garden').green.palm).toBe('treefern');
  });
});

describe('the green, drawn', () => {
  it('trees stamped from a few grown variants per species, shrubs as plant boxes, none in a massing', () => {
    const s = assembleCityScene(recipe());
    expect(s.repeats.length).toBeGreaterThan(0);
    expect(s.repeats.reduce((a, r) => a + r.transforms.length, 0)).toBeGreaterThan(50);
    expect(s.repeats.every((r) => /^(beech|cherry)-L[0-3]$/.test(r.group))).toBe(true);   // Paris's species, each at its levels
    expect(assembleCityScene(recipe({ fidelity: 'massing' })).repeats).toBeUndefined();
    expect(assembleCityScene(recipe({ green: 0 })).repeats ?? []).toEqual([]);
  });
  it('on the plan sheet, a dot per plant', () => {
    const d = designCity(recipe()), svg = cityPlanSvg(d);
    expect((svg.match(/<circle [^>]*fill-opacity="0.85"/g) || []).length).toBe(cityGreen(d).filter((g) => !g.strip).length);
  });
});

describe('the green\'s ground: a tree in its pit, a planter on a narrow walk, a median down an avenue', () => {
  it('lays a grate under every street tree and a planter (its shrub on top) where a walk is too narrow for a tree', () => {
    const d = designCity(recipe({ grammar: { from: 'paris', green: { walk: 3.5 } } })), g = cityGreen(d);
    const planters = g.filter((x) => x.plant === 'planter'), trees = g.filter((x) => x.kind === 'street' && x.plant !== 'planter');
    expect(planters.length).toBeGreaterThan(5);
    for (const p of planters) {
      const st = d.streets.find((s) => s.pts.slice(1).some((b, k) => Math.abs(along(p, s.pts[k], b) - (s.road / 2 + 0.6)) < 0.05));
      expect(st && st.walk < 3.5).toBe(true);
    }
    const ground = greenGround(g);
    expect(ground.filter((x) => x.kind === 'pit').length).toBe(trees.length);
    expect(ground.filter((x) => x.kind === 'planter').length).toBe(planters.length);
    expect(greenPlan(d, g).boxes.filter((b) => b.z0 > 0).length).toBe(planters.length);   // each planter's shrub stands in its box
  });
  it('runs a median down an avenue wide enough, broken short of every crossing street, its trees down its middle', () => {
    const d = designCity(recipe({ board: { cols: 10, rows: 8 }, green: { median: 1 } })), g = cityGreen(d);
    const strips = g.filter((x) => x.strip);
    expect(strips.length).toBeGreaterThan(1);
    for (const m of strips) {
      const own = d.streets.find((s) => m.key.startsWith(`${s.id}:`));
      expect(own.road).toBeGreaterThanOrEqual(MEDIAN.road);
      // no other street's carriageway reaches its ends
      for (const st of d.streets.filter((s) => s.id !== own.id)) for (const end of [m.a, m.b]) {
        const dist = Math.min(...st.pts.slice(1).map((b, k) => along({ x: end[0], y: end[1] }, st.pts[k], b)));
        expect(dist).toBeGreaterThan(st.road / 2);
      }
    }
    expect(g.filter((x) => x.kind === 'median' && !x.strip).length).toBeGreaterThan(5);
    expect(cityGreen(designCity(recipe({ board: { cols: 10, rows: 8 }, green: { median: 0 } }))).some((x) => x.kind === 'median')).toBe(false);
  });
});
