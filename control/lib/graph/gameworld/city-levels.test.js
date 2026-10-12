// A gameworld level that is a city: `city: { … }` in place of `walk`, a planned city (city/plan/) built in its
// civilization's language and painted by the level's geocube, played by its segments. In a line of levels, the segments
// along the fewest portals from its way in to its way out, each a level of the line; in a map, every segment, joined at
// its portals, the world's links at its way in and its way out. The laws: it reads and refuses like any level setting;
// its civilization's language becomes its grammar; the runner makes a level per segment; the game's exits are
// answered both ways; the bible and the graph draw it.

import { describe, it, expect } from 'vitest';
import { readGameworld, resolveLevel, runSteps, MEADOWMARK, MEADOWMARK_HERO } from './index.js';
import { gameStages, stageLevelOrder, gameLevels, mapPlan } from './levels.js';
import { gameworldBibleHtml } from './bible-html.js';
import { gameworldGraph } from './graph.js';
import { withBuildingLevel } from '../structure/level.js';
import { resolveGrammar } from '../city/plan/grammars.js';
import '../city/plan/level.js';
import { assembleCityScene } from '../city/plan/scene.js';
import { inferCity } from '../city/plan/card.js';

const CITY = { board: { cols: 12, rows: 9 }, seed: 4 };
const withCity = (W, city = CITY, extra = {}) => ({ ...W, ...extra, levels: { ...W.levels, downtown: { name: 'Downtown', city } } });

describe('a city level reads like any level', () => {
  it('its plan held to the city card, its civilization known, never a walk or a town beside it', () => {
    expect(() => readGameworld(withCity(MEADOWMARK))).not.toThrow();
    expect(() => readGameworld(withCity(MEADOWMARK, { ...CITY, height: 3 }))).toThrow(/city.height is not a city level setting/);
    expect(() => gameStages(withCity(MEADOWMARK, { ...CITY, cars: 'busy' }))).toThrow(/levels.downtown.city: cars is true/);
    expect(() => readGameworld(withCity(MEADOWMARK, { ...CITY, civilization: 'elves' }))).toThrow(/not a civilization/);
    const both = { ...MEADOWMARK, levels: { ...MEADOWMARK.levels, x: { city: CITY, walk: { nodes: { a: { trail: true } } } } } };
    expect(() => readGameworld(both)).toThrow(/a walk, a building or a city/);
    expect(() => gameStages(withCity(MEADOWMARK, { ...CITY, to: 'r9c9' }))).toThrow(/city.to 'r9c9' is not one of the city's segments/);
  });

  it('is built in its civilization\'s language: the kit\'s own by default, a shell people\'s swelling into organic masses', () => {
    const R = resolveLevel(withCity(MEADOWMARK), 'downtown');
    expect(R.level).toBeNull();
    expect(R.built.city).toBe(R.style.civilization);
    expect(R.city.plan.grammar).toMatchObject({ from: 'london', facade: { roof: { form: 'hip', chimneys: true } } });   // the meadow's timber hall
    const shell = { ...withCity(MEADOWMARK, { ...CITY, civilization: 'shellers' }), civilizations: { ...MEADOWMARK.civilizations, shellers: { anchor: 'shell' } } };
    const g = resolveGrammar(resolveLevel(shell, 'downtown').city.plan.grammar);
    expect(g.shapes.undulate).toBeGreaterThan(g.shapes.box);
    expect(g.facade.roof.p).toBe(0);
    // a grammar named is the base the language is spoken over; a grammar document is the level's own, as written
    expect(resolveLevel(withCity(MEADOWMARK, { ...CITY, grammar: 'paris' }), 'downtown').city.plan.grammar.from).toBe('paris');
    expect(resolveLevel(withCity(MEADOWMARK, { ...CITY, grammar: { from: 'tokyo' } }), 'downtown').city.plan.grammar).toEqual({ from: 'tokyo' });
  });

  it.each(['timber-hall', 'tiered', 'shell'])('a %s language\'s city is built: every lot wears its facade', (anchor) => {
    const W = { ...withCity(MEADOWMARK, { board: { cols: 6, rows: 5 }, seed: 4, civilization: 'folk' }), civilizations: { ...MEADOWMARK.civilizations, folk: { anchor } } };
    const s = assembleCityScene({ kind: 'city', ...inferCity(resolveLevel(W, 'downtown').city.plan).recipe, cars: false });
    expect(s.faces.length).toBeGreaterThan(1000);
  });

  it('is walked into, never entered by a door that leads nowhere', () => {
    for (const s of gameStages(withCity(MEADOWMARK)).filter((x) => x.level === 'downtown')) expect(withBuildingLevel(s.manifest, 'x').game.mechanics.some((m) => m.kind === 'door')).toBe(false);
  });

  it('is painted by the level\'s geocube', () => {
    const W = withCity(MEADOWMARK);
    W.levels.downtown.style = { geocube: 'jungle-haze' };
    expect(resolveLevel(W, 'downtown').city.plan.paint).toEqual({ geocube: 'jungle-haze' });
  });
});

describe('in a line of levels: the city is a route of its segments', () => {
  const W = withCity(MEADOWMARK), G = readGameworld(W), stages = gameStages(W), mine = stages.filter((s) => s.level === 'downtown');
  it('from the core\'s segment to the one the most portals away, each opening only toward the one before and after', () => {
    expect(mine.length).toBeGreaterThan(1);
    expect(mine[0].manifest.level.route.from).toBeUndefined();
    expect(mine.at(-1).manifest.level.route.to).toBeUndefined();
    mine.forEach((s, i) => { if (i) expect(s.manifest.level.route.from).toBe(mine[i - 1].node); });
  });
  it('lowers each to one way on (no exit named: the line\'s gates go on), the last to its farthest crossing', () => {
    const lv = mine.map((s, i) => withBuildingLevel(stageLevelOrder(G, s, { ref: `gw-${i}` }).args.manifest, `gw-${i}`));
    for (const L of lv) {
      const ends = L.game.mechanics.filter((x) => x.kind === 'reach-exit');
      expect(ends).toHaveLength(1);
      expect(ends[0].exit).toBeUndefined();
      expect(L.events.reactions).toEqual([]);
    }
    // entered by the portal it came in at: the second segment's walker stands near the first's way on
    const way = lv[0].game.mechanics.find((x) => x.kind === 'reach-exit').at, P = lv[1].entities[0].transform.pos;
    expect(Math.hypot(P[0] - way[0], P[1] - way[1]) * 3.66).toBeLessThan(30);
    const refs = stages.map((s, i) => `r${i}`), levels = gameLevels(stages, refs);
    const first = stages.indexOf(mine[0]);
    expect(levels[first].gate).toEqual({ completed: refs[first - 1] });
    expect(levels[first + 1].gate).toEqual({ completed: refs[first] });
  });
  it('the runner makes a level per segment, its neighbours\' levels by ref, and the game over them', () => {
    const S = runSteps(withCity(MEADOWMARK_HERO), { ref: 'gw' });
    const made = S.filter((s) => s.key.startsWith('level-downtown-'));
    expect(made.length).toBe(mine.length);
    expect(made[0].order.manifest).toMatchObject({ kind: 'city', level: { segment: mine[0].node } });
    expect(made[0].order.manifest.level.refs[mine[1].node]).toBe(made[1].ref);
    expect(S.at(-1).order.levels.map((l) => l.ref)).toEqual(expect.arrayContaining(made.map((s) => s.ref)));
  });
});

describe('in a map: every segment, joined at its portals, the world\'s links at its way in and out', () => {
  const { review: _r, ...base } = MEADOWMARK_HERO;
  const MAP = { ...base, topology: 'interconnected', levels: { hub: { name: 'The hub', seed: 8, walk: { nodes: { gate: { trail: true } } } }, downtown: { name: 'Downtown', city: CITY } }, links: [{ from: 'hub', to: 'downtown' }] };
  const G = readGameworld(MAP), stages = gameStages(MAP), refs = stages.map((s) => `m-${s.level}-${s.node}`), plan = mapPlan(G, stages, refs), levels = gameLevels(stages, refs, plan);
  const city = stages.map((s, i) => i).filter((i) => stages[i].level === 'downtown');
  it('enters the city at its first segment from the hub, and every exit is answered from the other side', () => {
    expect(levels[stages.findIndex((s) => s.level === 'hub')].exits.map((x) => x.to)).toEqual([refs[city[0]]]);
    for (const lv of levels) for (const x of lv.exits ?? []) expect(levels.find((l) => l.ref === x.to).exits.map((y) => y.to)).toContain(lv.ref);
  });
  it('lowers a segment with its portals named for its neighbours and the world\'s way back at its start', () => {
    const i = city[0], L = withBuildingLevel(stageLevelOrder(G, stages[i], { ref: refs[i], map: plan[i], cityRefs: Object.fromEntries(city.map((j) => [stages[j].node, refs[j]])) }).args.manifest, refs[i]);
    const ids = L.game.mechanics.filter((x) => x.kind === 'reach-exit').map((x) => x.exit).sort();
    expect(ids).toEqual(levels[i].exits.map((x) => x.id).sort());
    expect(L.game.arrive).toContain(refs[stages.findIndex((s) => s.level === 'hub')]);
  });
});

describe('the bible and the graph draw it', () => {
  it('its plan sheet, and who built it', () => {
    const W = withCity(MEADOWMARK), html = gameworldBibleHtml(W);
    expect(html).toContain('The city');
    expect(html).toMatch(/<svg[^>]*>[\s\S]*Downtown/);
    const g = gameworldGraph(W);
    expect(g.nodes.some((n) => n.id === 'section:downtown/city')).toBe(true);
  });
});
