import { describe, it, expect } from 'vitest';
import { readCityPlan, inferCity } from './card.js';
import { designCity } from './design.js';
import { grammarAtPlay, CITY_GRAMMARS, GRAMMAR_IDS } from './grammar.js';
import { readCity, cityReadout } from './read.js';
import { assembleCityScene } from './scene.js';
import { cityBookHtml } from './book-html.js';
import { CITY_LAW_IDS } from './laws.js';
import { cityPlanCard } from './entries.js';
import { getViewVocabCatalog } from '../../views/view-vocab/loader.js';

const city = (rec = {}) => designCity(inferCity({ seed: 3, ...rec }).recipe);
const lotsOf = (d, block) => JSON.stringify(d.lots.filter((l) => l.block === block));

describe('the city card refuses what is off it, by name', () => {
  it.each([
    [{ shape: 'round' }, /'shape' is not a city setting/],
    [{ grammar: 'atlantis' }, /grammar is one of north-american, new-york/],
    [{ play: 'arcade' }, /play is real or game/],
    [{ board: { cell: 5 } }, /board.cell is metres a side, 20–200/],
    [{ board: { cols: 27 } }, /board.cols is a whole number 2–26/],
    [{ spine: [{ path: 'A1' }] }, /spine\[0\].path is two or more cells/],
    [{ spine: [{ path: 'A1>Z1' }] }, /spine\[0\].path: 'Z1' is off the board/],
    [{ districts: [{ at: 'B2', use: 'slum' }] }, /districts\[0\].use is one of core, commercial/],
    [{ districts: [{ at: 'B2', use: 'core', grammar: 'paris' }] }, /not laid yet/],
    [{ sites: [{ at: 'B2', use: 'plaza', height: 30 }] }, /only a landmark or a civic building stands to a height/],
    [{ sites: [{ at: 'B2', use: 'park', from: 'sk_x' }] }, /from stands an edifice on a landmark or civic site/],
    [{ sites: [{ at: 'B2', use: 'landmark', landmark: 'big-tower' }] }, /landmark is one of the library's: .*mint_solid\(\{ kind: 'edifice' \}\)/],
    [{ sites: [{ at: 'B2', use: 'civic', building: 'church', variant: 'gothic' }] }, /a church is basilica, orthodox, chapel/],
    [{ transit: [{ path: 'A2>H2', mode: 'maglev' }] }, /mode is one the grammar runs: tram, bus/],
    [{ lots: { 'b0-0.1': { storeys: 0 } } }, /storeys is a whole number 1–160/],
  ])('%j', (rec, msg) => expect(() => readCityPlan(rec)).toThrow(msg));

  it('lets the channels every world wears through to the world, untouched', () => {
    expect(() => readCityPlan({ audio: { wind: true }, weather: 'rain' })).not.toThrow();
  });
});

describe('the mint\'s laws fill only what the recipe left out, and say why', () => {
  it('gives play, a board and a crossing spine to an empty plan', () => {
    const { recipe, inferred } = inferCity({ seed: 1 });
    expect(inferred.map((i) => i.field)).toEqual(['play', 'board', 'spine']);
    expect(recipe.spine).toEqual([{ path: 'A3>J3' }, { path: 'E1>E6' }]);
    expect(inferred.every((i) => i.reason.length > 20)).toBe(true);
  });
  it('never lays the inferred spine through a site', () => {
    const { recipe } = inferCity({ seed: 1, sites: [{ at: 'E3', use: 'plaza' }] });
    expect(recipe.spine).toEqual([{ path: 'A2>J2' }, { path: 'D1>D6' }]);   // the middle row and column hold the plaza: the nearest clear ones
    expect(designCity(recipe).laws.find((l) => l.id === 'reserved').ok).toBe(true);
  });
  it('fills nothing the recipe gave', () => {
    const { inferred } = inferCity({ seed: 1, play: 'real', board: { cols: 6, rows: 4 }, spine: [{ path: 'A2>F2' }] });
    expect(inferred).toEqual([]);
  });
});

describe('the designer is pure, layered, and keeps its dice per layer', () => {
  it('is the same city twice', () => {
    const a = city({ grammar: 'tokyo' }), b = city({ grammar: 'tokyo' });
    expect(JSON.stringify(b.lots)).toBe(JSON.stringify(a.lots));
    expect(b.stats).toEqual(a.stats);
  });
  it('lays the spine first: the grid meets every straight run of it', () => {
    const d = city({ spine: [{ path: 'A3>J3' }, { path: 'C1>C6', rank: 'minor' }] });
    expect(d.streets.filter((s) => s.source === 'spine').map((s) => s.id)).toEqual(['spine-2', 'spine-1']);
    expect(d.laws.find((l) => l.id === 'spine-first').ok).toBe(true);
  });
  it('a lot by hand changes that lot and no other', () => {
    const a = city(), lot = a.lots.find((l) => l.use === 'mixed');
    const b = city({ lots: { [lot.id]: { storeys: 30 } } });
    const changed = b.lots.filter((l, i) => JSON.stringify(l) !== JSON.stringify(a.lots[i]));
    expect(changed.map((l) => l.id)).toEqual([lot.id]);
    expect(changed[0]).toMatchObject({ floors: 30, byHand: true });
  });
  it('a transit line moves no lot', () => {
    const a = city(), b = city({ transit: [{ path: 'A3>J3' }] });
    expect(JSON.stringify(b.lots)).toBe(JSON.stringify(a.lots));
    expect(b.transit[0].stops.length).toBeGreaterThanOrEqual(2);
  });
  it('a site moves only the streets its edges land on: every block that keeps its ground keeps its lots', () => {
    const big = { play: 'real', board: { cols: 14, rows: 9 }, spine: [{ path: 'A5>N5' }, { path: 'G1>G9' }] };
    const a = city(big), b = city({ ...big, sites: [{ at: 'K7', use: 'plaza' }] });
    const before = new Map(a.blocks.map((k) => [k.id, JSON.stringify(k.rect)]));
    const kept = b.blocks.filter((k) => before.get(k.id) === JSON.stringify(k.rect));
    // a moved grid line is a whole street: the blocks along it change, the rest keep their ground and their dice
    expect(kept.length).toBeGreaterThan(b.blocks.length * 0.5);
    for (const k of kept) expect(lotsOf(b, k.id)).toBe(lotsOf(a, k.id));
  });
  it('reserves a site before the grid: no street runs through it, and it builds a landmark to its height', () => {
    const d = city({ sites: [{ at: 'G2:H2', use: 'landmark', height: 240, name: 'the needle' }] });
    const s = d.sites[0];
    expect(s.mass.h).toBe(240);
    for (const st of d.streets.filter((x) => x.source !== 'spine')) for (const [x, y] of st.pts) expect(x > s.rect.x0 + 1 && x < s.rect.x1 - 1 && y > s.rect.y0 + 1 && y < s.rect.y1 - 1).toBe(false);
  });
  it('builds nothing in water or a park, and only the spine crosses them', () => {
    const d = city({ districts: [{ at: 'A5:J6', use: 'water' }] });
    const water = d.districts[0].rect;
    expect(d.lots.some((l) => l.y1 > water.y0 + 1)).toBe(false);
    expect(d.streets.filter((s) => s.source === 'spine' && s.pts.some(([, y]) => y > water.y0)).length).toBe(1);
  });
  it('reads what a district is for: residential builds no towers, the core raises them', () => {
    const d = city({ grammar: 'new-york', districts: [{ at: 'A1:J6', use: 'residential' }] });
    expect(d.stats.towers).toBe(0);
    const c = city({ grammar: 'new-york', districts: [{ at: 'A1:J6', use: 'core' }] });
    expect(c.stats.towers).toBeGreaterThan(3);
  });
});

describe('play scale compresses what a walker covers, never what they measure themselves by', () => {
  // one scaling for every grammar: the first stands for the rest
  it.each(GRAMMAR_IDS.slice(0, 1))('%s', (id) => {
    const G = CITY_GRAMMARS[id], g = grammarAtPlay(G, 'game'), r = grammarAtPlay(G, 'real');
    expect(g.block.pitch[1]).toBeLessThan(r.block.pitch[1]);
    expect(g.walk.beat).toBeLessThan(r.walk.beat);
    expect(g.floorH).toEqual(r.floorH);
    expect(g.lot.front).toEqual(r.lot.front);
    expect(g.tower.h).toEqual(r.tower.h);
  });
});

describe('the laws advise, and a waiver accepts a finding', () => {
  it('evaluates every law', () => expect(city().laws.map((l) => l.id)).toEqual(CITY_LAW_IDS));
  it('a door on every built lot, one walk network, slender towers', () => {
    for (const grammar of ['new-york', 'paris', 'tokyo']) {
      const d = city({ grammar, play: 'real' });
      for (const id of ['fronts', 'connected', 'slender']) expect(d.laws.find((l) => l.id === id).findings, `${grammar} ${id}`).toEqual([]);
    }
  });
  it('a line laid across the blocks is found off the street', () => {
    const d = city({ transit: [{ path: 'A1>J6' }] });
    expect(d.laws.find((l) => l.id === 'transit-on-street').ok).toBe(false);
  });
  it('a quiet street is found, and waived by name', () => {
    const d = city({ grammar: 'paris' }), beat = d.laws.find((l) => l.id === 'beat-every');
    expect(beat.ok).toBe(false);
    const at = beat.findings[0].at, w = city({ grammar: 'paris', waive: [`beat-every:${at}`] }).laws.find((l) => l.id === 'beat-every');
    expect(w.findings.map((f) => f.at)).not.toContain(at);
    expect(w.waived).toBe(1);
    expect(city({ grammar: 'paris', waive: ['beat-every'] }).laws.find((l) => l.id === 'beat-every').ok).toBe(true);
  });
});

describe('one read model for the reply, the book and next', () => {
  const m = { kind: 'city', ...inferCity({ seed: 5, grammar: 'tokyo' }).recipe, notes: { inferred: inferCity({ seed: 5, grammar: 'tokyo' }).inferred } };
  it('the reply names its census, every law and what is open, in outcome order', () => {
    const r = cityReadout(m);
    expect(r.city).toMatchObject({ grammar: 'tokyo', play: 'game' });
    expect(r.laws).toHaveLength(CITY_LAW_IDS.length);
    const ids = r.next.map((n) => n.id);
    expect(ids).toEqual(expect.arrayContaining(['spine', 'districts', 'sites', 'segments']));
    expect(ids.indexOf('spine')).toBeLessThan(ids.indexOf('segments'));
    expect(r.next.find((n) => n.id === 'segments').add).toMatch(/^segments: \{ levels: true \}/);
  });
  it('a district laid by hand closes its concern', () => {
    const r = cityReadout({ ...m, districts: [{ at: 'D2:F4', use: 'core' }] });
    expect(r.next.map((n) => n.id)).not.toContain('districts');
  });
  it('the book is the same read: the plan sheet, every law, the lots by id', () => {
    const html = cityBookHtml(m, { ref: 'sk_test' });
    expect(html).toMatch(/<svg[^>]+class="sheet"/);
    for (const id of CITY_LAW_IDS) expect(html).toContain(`<b>${id}</b>`);
    const { design } = readCity(m);
    const tallest = design.lots.slice().sort((a, b) => b.h - a.h)[0];
    expect(html).toContain(`<code>${tallest.id}</code>`);
    expect(html).not.toMatch(/<script/);
  });
});

describe('the city world kind', () => {
  it('masses the plan, walkable, from the core', () => {
    // no street trees: the massing and the walk are the claim, and growing tree variants is most of a first scene's time
    const m = { kind: 'city', ...inferCity({ seed: 2, grammar: 'paris', green: 0 }).recipe };
    const s = assembleCityScene(m);
    expect(s.faces.length).toBeGreaterThan(1000);
    expect(s.metersPerUnit).toBe(3.66);
    expect(s.walk.spawn[2] * s.metersPerUnit).toBeCloseTo(1.7, 2);   // a person's eye, in the legacy city's units
    expect(s.cameras.map((c) => c.name)).toEqual(['over', 'street']);
    expect(JSON.stringify(assembleCityScene(m).faces)).toBe(JSON.stringify(s.faces));
  });
});

describe('the city-plan card is generated from the rails', () => {
  it('names every grammar, district use and law, and loads into the world catalog', () => {
    const card = cityPlanCard();
    for (const id of [...GRAMMAR_IDS, ...CITY_LAW_IDS, 'core', 'water', 'landmark']) expect(card.body).toContain(id);
    expect(getViewVocabCatalog().get('city-plan')).toMatchObject({ family: 'world', entry: 'compose_world', generated: true });
  });
});
