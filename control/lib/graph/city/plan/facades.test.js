import { describe, it, expect } from 'vitest';
import { resolveGrammar, WORLD_GRAMMARS, GRAMMAR_IDS } from './grammars.js';
import { CITY_GRAMMARS } from './grammar.js';
import { readCityPlan, inferCity } from './card.js';
import { designCity } from './design.js';
import { skinLot, readFacade } from './facades.js';
import { cityBoxes, assembleCityScene } from './scene.js';

const city = (rec = {}) => designCity(inferCity({ seed: 3, ...rec }).recipe);
const skins = (d) => d.lots.filter((l) => l.use !== 'parking').map((l) => skinLot(l, d.grammar, d.plan.seed));

describe('a grammar is an id or a document over one', () => {
  it.each([
    [{ from: 'atlantis' }, /grammar.from is the grammar it starts from/],
    [{ from: 'paris', colour: 'red' }, /grammar.colour is not a grammar field/],
    [{ from: 'paris', height: { core: 2 } }, /grammar.height.core is a number 3–600/],
    [{ from: 'paris', height: { spire: 4 } }, /grammar.height.spire is not a grammar field/],
    [{ from: 'paris', skin: { stone: [['#fff', '#000']] } }, /grammar.skin.stone is a list of \['#rrggbb', '#rrggbb'\] pairs/],
    [{ from: 'paris', wear: { rhythm: 'zigzag' } }, /grammar.wear.rhythm is 'curtain' \| 'grid'/],
    [{ from: 'paris', transit: { modes: ['teleport'] } }, /grammar.transit.modes is a list of tram, bus, maglev/],
    [{ from: 'paris', height: { edge: 30 } }, /height.edge \(30 m\) stands over its core/],
  ])('%j is refused by name', (g, msg) => expect(() => readCityPlan({ grammar: g })).toThrow(msg));

  it('merges objects and replaces lists', () => {
    const G = resolveGrammar({ from: 'paris', height: { core: 30 }, skin: { roof: ['#112233'] } });
    expect(G.height).toMatchObject({ core: 30, edge: CITY_GRAMMARS.paris.height.edge, cap: CITY_GRAMMARS.paris.height.cap });
    expect(G.skin.roof).toEqual(['#112233']);
    expect(G.skin.stone).toEqual(CITY_GRAMMARS.paris.skin.stone);
  });
  it('ships world grammars written as documents, and chains from them', () => {
    expect(GRAMMAR_IDS).toEqual(expect.arrayContaining(['neon-sprawl', 'xeno-garden']));
    expect(WORLD_GRAMMARS['neon-sprawl'].transit.modes).toContain('maglev');
    expect(resolveGrammar({ from: 'xeno-garden', label: 'mine' })).toMatchObject({ label: 'mine', shapes: WORLD_GRAMMARS['xeno-garden'].shapes });
  });
});

describe('the facade layer is laid over the plan, never into it', () => {
  it('a grammar\'s wear, affectations and shapes move no street, lot or storey', () => {
    const a = city({ grammar: 'paris' });
    const b = city({ grammar: { from: 'paris', wear: { crown: 'screen' }, shapes: { cylinder: 1, minFloors: 2 }, facade: { awning: { p: 1, tints: ['#ff0000'] } } } });
    expect(JSON.stringify(b.lots)).toBe(JSON.stringify(a.lots));
    expect(JSON.stringify(b.streets)).toBe(JSON.stringify(a.streets));
  });
  it('is the same facade twice, and a lot\'s own dice', () => {
    const d = city({ grammar: 'new-york' });
    expect(JSON.stringify(skins(d))).toBe(JSON.stringify(skins(d)));
  });
  it('wears the grammar\'s affectations as the legacy flavour does: Paris mansards and balconies, New York fire escapes, Tokyo blades', () => {
    const share = (xs, f) => xs.filter(f).length / xs.length;
    const paris = skins(city({ grammar: 'paris', play: 'real' }));
    expect(share(paris, (s) => s.skin.roofCap?.form === 'mansard')).toBeGreaterThan(0.6);
    expect(share(paris, (s) => s.skin.balcony)).toBeGreaterThan(0.6);
    const ny = skins(city({ grammar: 'new-york', play: 'real' })).filter((s) => s.skin.material === 'brick');
    expect(share(ny, (s) => s.skin.fireEscape)).toBeGreaterThan(0.6);
    expect(share(skins(city({ grammar: 'tokyo', play: 'real' })), (s) => s.skin.blades)).toBeGreaterThan(0.3);
  });
  it('wears what the plan counted: a shopfront exactly where the walk has a beat', () => {
    const d = city({ grammar: 'tokyo' }), s = skins(d), built = d.lots.filter((l) => l.use !== 'parking');
    built.forEach((l, i) => expect(s[i].skin.storefront).toBe(!!l.shopfront));
  });
  it('a lot by hand wears its own facade over everything, and a bad field is refused by name', () => {
    const a = city({ grammar: 'paris' }), lot = a.lots.find((l) => l.use === 'mixed');
    const b = city({ grammar: 'paris', lots: { [lot.id]: { facade: { material: 'glass', rhythm: 'curtain', glass: '#3a6ea5', frame: '#20242a' } } } });
    const mine = skinLot(b.lots.find((l) => l.id === lot.id), b.grammar, b.plan.seed);
    expect(mine.skin).toMatchObject({ material: 'glass', rhythm: 'curtain', glass: '#3a6ea5' });
    expect(() => readCityPlan({ lots: { [lot.id]: { facade: { windows: 3 } } } })).toThrow(/lots\['.+'\].facade.windows is not a facade field/);
    expect(() => readFacade({ glass: 'blue' }, 'x')).toThrow(/x.glass is '#rrggbb'/);
  });
  it('a grammar\'s shapes stand its masses round: the xeno garden\'s cylinders', () => {
    const s = skins(city({ grammar: 'xeno-garden' }));
    expect(s.filter((x) => x.shape === 'cylinder').length).toBeGreaterThan(s.length * 0.2);
    expect(skins(city({ grammar: 'paris' })).every((x) => x.shape === 'box')).toBe(true);
  });
});

describe('the world hands the lots to the legacy facade pipeline', () => {
  it('one box per built lot and site mass, in units, fronting the street the plan put its door on', () => {
    const d = city({ grammar: 'new-york', sites: [{ at: 'F2', use: 'landmark', height: 200 }] });
    const boxes = cityBoxes(d);
    expect(boxes.length).toBe(d.lots.filter((l) => l.use !== 'parking').length + 1);
    const b = boxes.find((x) => x.lot), lot = d.lots.find((l) => l.id === b.lot);
    expect(b.z1 * 3.66).toBeCloseTo(lot.h, 1);
    expect(b.front).toBe({ n: '-y', s: '+y', w: '-x', e: '+x' }[lot.face]);
  });
  it('draws facades by default, the massing on asking', () => {
    const m = { kind: 'city', ...inferCity({ seed: 2, grammar: 'paris' }).recipe };
    const facade = assembleCityScene(m), massing = assembleCityScene({ ...m, fidelity: 'massing' });
    expect(facade.faces.length).toBeGreaterThan(massing.faces.length * 3);
    expect(facade.city.fidelity).toBe('facade');
  });
  it('lays a maglev on its guideway, over the street', () => {
    const m = { kind: 'city', ...inferCity({ seed: 2, grammar: 'neon-sprawl', transit: [{ path: 'A3>J3', mode: 'maglev' }] }).recipe, fidelity: 'massing' };
    const s = assembleCityScene(m), deck = s.faces.filter((f) => f.group === 'city:guideway');
    expect(deck.length).toBe(4);   // one straight run: its deck, underside and two sides
    expect(Math.min(...deck.flatMap((f) => f.corners.map((p) => p[2]))) * 3.66).toBeGreaterThan(7);
    expect(() => readCityPlan({ grammar: 'paris', transit: [{ path: 'A3>J3', mode: 'maglev' }] })).toThrow(/mode is one the grammar runs: tram, bus/);
  });
});
