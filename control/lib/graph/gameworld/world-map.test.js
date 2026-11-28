// THE WORLD MAP (world-map.js): what the sentence door lays for a genre whose cube asks for one (the action RPG): one
// planned map that starts as a game starts (the opening a page of its own: the controls, then an enemy trail held as its
// way out), its first zone after it, a zone a block after that, travelled zone to zone. The concept on two cases, one
// per path: the smallest world (its last block the goal) and one with zones after its first.
import { describe, it, expect } from 'vitest';
import { worldMapLevel, wildsLevel, WILDS, WORLD_MAP, PLACE_LIGHT, approachLevel, APPROACH } from './world-map.js';
import { composeGameworld, MAP_FLORA } from './compose.js';
import { readGeocube } from '../era/geocube.js';
import { castingCall } from './foe-casting.js';
import { gameworldBibleHtml, readMade } from './index.js';
import { readGrid } from '../level/grid.js';
import { readSketch, sketchLaws, levelGrid } from '../level/map-sketch.js';
import { mapWay, mapItems } from '../level/map-items.js';
import { walkFrom } from '../level/grid.js';
import { FOE_CLASSES } from '../foes/index.js';
import { SIGHTS } from '../mind/vocab.js';
import { FLOW_IN_PLAY, readFlow, walkFlow } from '../game/flow.js';
import { runSteps } from './runner.js';
import { gameworldMapHtml, plannedMaps } from './map-designer.js';
import { soundSheet } from './sound-sheet.js';
import { cueSheet } from './cue-sheet.js';
import { readGameworld } from './world.js';

const lawsOf = (level) => {
  const g = level.glyphs, G = readGrid({ tile: g.tile, plan: g.plan, ...(g.segments ? { segments: g.segments } : {}) }, 'grid');
  return sketchLaws(G, readSketch(g.sketch, G.plan));
};

describe('the world map', () => {
  it('starts as a game starts: the opening a page of its own, the controls first, then an enemy trail held as its way out', () => {
    const { level, zoned } = worldMapLevel({ n: 3 });
    const P = level.glyphs.plan, beats = level.glyphs.sketch.scenario.beats, [A, B, C] = P.route;
    expect(P.route.length).toBe(WORLD_MAP.first + 2);
    // (the opening block is named by no page, so it is a page of its own; the first zone the two after it)
    expect(zoned).toEqual([[B, C]]);
    expect(level.glyphs.zoned).toEqual(zoned);
    const opening = beats.filter((b) => b.at === A);
    expect(opening.map((b) => [b.id, b.kind])).toEqual([['controls', 'arrival'], ['lone', 'fight'], ['pair', 'fight']]);
    // (the body's controls explained first, with the hero in hand: no first look, the camera is the hero's)
    expect(opening[0]).toMatchObject({ teach: ['move', 'look', 'jump', 'sprint'] });
    expect(opening[0].faces).toBeUndefined();
    // (the enemy trail: one foe then two, each on a tile of the way in the walk's order, each where a fight's controls are taught)
    expect(opening.slice(1).map((b) => [Object.values(b.foes), [].concat(b.teach)])).toEqual([[[1], ['strike']], [[2], ['lock', 'dodge']]]);
    const way = level.glyphs.segments[A].rows.map((r) => r.replace(/\s+/g, ''));
    for (const b of opening.slice(1)) expect(way[b.tile[0]][b.tile[1]], b.id).toBe('#');
    // (its foes come: the lone one posted at the far end of the way, the start out of its sight so the controls have
    // their room; the pair from the same way out, only once it has fallen)
    const far = Math.max(...way.flatMap((r, i) => [...r].map((g, j) => (g === '#' ? j : -1))));
    expect(opening[1].tile[1]).toBe(far);
    expect(opening[2]).toMatchObject({ tile: opening[1].tile, after: 'lone' });
    expect(opening[1].after).toBeUndefined();
    const spawnTo = (far + 0.5 - 0.5) * WORLD_MAP.tile, sees = SIGHTS[FOE_CLASSES.pursuer.mind.sight].knobs.sightRange;
    expect(spawnTo).toBeGreaterThan(sees + 10);
    // (a fight comes after an earlier fight of its own segment, or the sketch says so)
    const bad = (after) => () => readSketch({ ...level.glyphs.sketch, scenario: { beats: beats.map((x) => (x.id === 'pair' ? { ...x, after } : x)) } }, readGrid({ tile: level.glyphs.tile, plan: P, segments: level.glyphs.segments }, 'grid').plan);
    expect(bad('nobody')).toThrow(/after is an earlier fight of its segment/);
    expect(bad('controls')).toThrow(/after is an earlier fight of its segment/);
    expect(bad('lone')).not.toThrow();
    // (forced: the last fight of the trail holds the opening's way out)
    expect(opening.at(-1).opens).toBe(true);
    // (the first zone tests what the opening taught and teaches nothing new; no bigger than its tasks: the opening holds
    // fewer foes than the zone after it)
    const zone = beats.filter((b) => [B, C].includes(b.at)), foes = (bs) => bs.reduce((t, b) => t + Object.values(b.foes ?? {}).reduce((x, y) => x + y, 0), 0);
    expect(zone.flatMap((b) => [].concat(b.teach ?? []))).toEqual([]);
    expect(foes(opening)).toBeLessThan(foes(zone));
    // (each zone's fight holds its way out; the last is the climax, the boss)
    expect(beats.filter((b) => b.opens).map((b) => b.at)).toEqual([A, ...P.route.slice(WORLD_MAP.first - 1, -1)]);
    expect(beats.at(-1)).toMatchObject({ kind: 'climax', at: P.route.at(-1), foes: { boss: 1 } });
    for (const l of lawsOf(level)) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
  });

  it('the smallest world: the opening, then a first zone whose last block is the goal and the climax', () => {
    const { level, zoned } = worldMapLevel({ n: 1 }), P = level.glyphs.plan;
    expect(P.route.length).toBe(WORLD_MAP.first);
    expect(zoned).toEqual([P.route.slice(WORLD_MAP.opening)]);
    expect(level.glyphs.sketch.scenario.beats.filter((b) => b.at === P.route[0]).map((b) => b.id)).toEqual(['controls', 'lone', 'pair']);
    expect(level.glyphs.sketch.scenario.beats.at(-1)).toMatchObject({ kind: 'climax', foes: { boss: 1 } });
    for (const l of lawsOf(level)) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
  });

  it('is an open world: blocks laid by the trail library, side ways that close loops, the opening\'s one way out kept', () => {
    const { level } = worldMapLevel({ n: 3 }), g = level.glyphs, P = g.plan, [A, B, , D, E] = P.route;
    const G = readGrid({ tile: g.tile, plan: P, segments: g.segments }, 'grid'), id = (x) => `${x.r},${x.c}`;
    // (a side way wherever two blocks lie side by side off the walk; none out of the opening)
    expect(P.joins).toEqual([[B, E]]);
    expect(G.plan.gates.filter((x) => x.from === A || x.to === A)).toHaveLength(1);
    // (each block past the opening names a template; never one line from gate to gate through every block)
    for (const S of P.route.slice(1)) expect(Object.keys(WORLD_MAP.fills).some((k) => [].concat(WORLD_MAP.fills[k]).includes(P.key[S].fill)), S).toBe(true);
    expect(new Set(P.route.slice(1).map((S) => P.key[S].fill)).size).toBeGreaterThan(1);
    // (a loop: with the walk's own gate from the town to the goal shut, the goal is still reached, by the side way)
    const goal = G.cells.find((x) => x.kind === 'place' && x.place.goal), start = mapWay(G).start;
    const shut = (a, b) => ({ ...G, cells: G.cells.map((x) => (x.open ? { ...x, open: x.open.filter((s) => { const y = G.at(x.r + { n: -1, s: 1, e: 0, w: 0 }[s], x.c + { n: 0, s: 0, e: 1, w: -1 }[s]); return !(y && ((x.region === a && y.region === b) || (x.region === b && y.region === a))); }) } : x)) });
    expect(walkFrom(shut(D, E), start).dist.has(id(goal))).toBe(true);
    expect(walkFrom(shut(B, E), start).dist.has(id(goal))).toBe(true);
    // (the walk itself keeps to its route: the side way is never the way on, so every block of the walk is on it)
    const way = mapWay(G).way;
    expect(new Set(way.map((x) => x.region))).toEqual(new Set(P.route));
    for (let i = 1; i < way.length; i++) expect(Math.abs(P.route.indexOf(way[i].region) - P.route.indexOf(way[i - 1].region))).toBeLessThanOrEqual(1);
  });

  it('a shortcut costs more: a band holds each side way at its gate, off the walk, more of them than any block\'s own fight', () => {
    const { level } = worldMapLevel({ n: 3 }), g = level.glyphs, P = g.plan, beats = g.sketch.scenario.beats;
    const G = readGrid({ tile: g.tile, plan: P, segments: g.segments }, 'grid'), count = (b) => Object.values(b.foes ?? {}).reduce((a, c) => a + c, 0);
    const guards = beats.filter((b) => /-shortcut$/.test(b.id));
    expect(guards).toHaveLength(P.joins.length);
    for (const [i, [X, Y]] of P.joins.entries()) {
      const b = guards[i], gate = G.plan.gates.find((x) => x.join && x.from === X && x.to === Y), [r0, c0] = G.plan.segments[Y].at;
      expect(b.at).toBe(Y);
      // (at the side way's gate in the block it comes out in, and never on the walk's own way)
      expect([r0 + b.tile[0], c0 + b.tile[1]]).toEqual(gate.tiles[1]);
      expect(mapWay(G).way.some((x) => x.r === gate.tiles[1][0] && x.c === gate.tiles[1][1])).toBe(false);
      // (significantly more: twice any other fight short of the climax, at the least)
      const most = Math.max(...beats.filter((x) => x.kind === 'fight' && !guards.includes(x)).map(count));
      expect(count(b)).toBeGreaterThanOrEqual(2 * most);
      expect(count(b)).toBe(WORLD_MAP.shortcut.grunt + WORLD_MAP.shortcut.elite);
    }
    for (const l of lawsOf(level)) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
    for (const l of lawsOf(worldMapLevel({ n: 6 }).level)) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
  });

  it('its cliffs make sense: terraces that climb to the goal, a way a step a tile at most, a cliff only where no way crosses', () => {
    const { level } = worldMapLevel({ n: 3 }), g = level.glyphs, P = g.plan;
    const G = levelGrid({ grid: { tile: g.tile, plan: P, segments: g.segments }, sketch: g.sketch }), z = (x) => G.rise.z[x.r * G.cols + x.c];
    const SIDE = { e: [0, 1], s: [1, 0] }, S = G.rise.scarps;
    // (the goal's block stands highest, the opening's on the low ground)
    const top = (seg) => Math.max(...G.cells.filter((x) => x.region === seg).map(z));
    expect(top(P.route.at(-1))).toBeGreaterThan(top(P.route[0]));
    expect(top(P.route.at(-1))).toBe(Math.max(...P.route.map(top)));
    expect(G.sketch.laid.cliffs).toBeGreaterThan(0);
    let crossed = 0, cliffs = 0;
    for (const x of G.cells) for (const [s, [dr, dc]] of Object.entries(SIDE)) {
      const y = G.at(x.r + dr, x.c + dc); if (!y) continue;
      const way = (x.open ?? []).includes(s) || (y.open ?? []).includes(s === 'e' ? 'w' : 'n'), scarp = S[s][x.r * G.cols + x.c] === 1;
      // (no cliff across a way; a way climbs a step at most; a cliff is a real step)
      if (way) { crossed++; expect(scarp, `${x.r},${x.c} ${s}`).toBe(false); expect(Math.abs(z(x) - z(y))).toBeLessThanOrEqual(3); }
      if (scarp) { cliffs++; expect(Math.abs(z(x) - z(y))).toBeGreaterThanOrEqual(6); }
    }
    expect(crossed).toBeGreaterThan(0);
    expect(cliffs).toBe(G.sketch.laid.cliffs);
  });

  it('the sentence door lays the action RPG as a world map travelled zone to zone, and the casting call fields it', () => {
    const W = composeGameworld({ prompt: 'an anime action rpg like zelda: a swordsman crosses a kingdom of forests and ruins', seed: 1 });
    const ids = Object.keys(W.levels);
    expect(ids).toHaveLength(1);
    expect(W.topology).toBe('interconnected');
    expect(W.start).toBe(ids[0]);
    expect(W.levels[ids[0]].walk).toBeUndefined();
    expect(W.levels[ids[0]].glyphs.plan.route.length).toBe(WORLD_MAP.first + 2);
    expect(W.brief.worldMap.level).toBe(ids[0]);
    // (it GROWS: its cube names no flora, so the map takes the meadow kit's own, and the brief says so; a sentence that
    // names what grows keeps its own)
    const plain = composeGameworld({ prompt: 'an anime action rpg like zelda', seed: 1 });
    expect(readGeocube(plain.style.geocube).biocube).toBe(MAP_FLORA.biocube);
    expect(plain.brief.worldMap.grows).toMatch(/meadow/);
    // (this one's forests are its sentence's: its cube's flora is theirs, and the brief claims nothing)
    expect(readGeocube(W.style.geocube).biocube).toBeTruthy();
    expect(readGeocube(W.style.geocube).biocube).not.toBe(MAP_FLORA.biocube);
    expect(W.brief.worldMap.grows).toBeUndefined();
    // (each place its own light: home's blocks unmoved, every place with a row the world's palette moved by it)
    for (const r of Object.values(W.levels[ids[0]].glyphs.plan.key)) expect(r.palette, r.name).toEqual(PLACE_LIGHT[r.name] ? { shift: PLACE_LIGHT[r.name].shift } : undefined);
    expect(Object.values(W.levels[ids[0]].glyphs.plan.key).some((r) => r.palette)).toBe(true);
    // (it is HEARD: on the sound sheet and scored, both empty words the game's own to fill; the sheet solves its sword and
    // its ground, the cue sheet asks for its level, and the brief says so. A game with no map is laid silent as before)
    expect(W.sound).toEqual({});
    expect(W.music).toEqual({});
    expect(W.brief.audio).toMatch(/sound sheet.*cue sheet/);
    const sheet = soundSheet(readGameworld(W));
    expect(sheet.slots.swing && sheet.slots.strike && sheet.slots.step).toBeTruthy();
    expect(cueSheet(W, { ref: 'gw' }).requests.some((r) => r.id.startsWith('level:'))).toBe(true);
    expect(composeGameworld({ prompt: 'a haunted forest of misty hills', seed: 2 }).sound).toBeUndefined();
    // (it starts in play: its opening a cutscene's slot, then straight into the game; the brief says so)
    expect(W.flow).toBe(FLOW_IN_PLAY);
    expect(W.brief.start).toMatch(/cutscene.*straight into play/);
    // (its brief says how it starts: the opening block, then the first zone)
    const route = W.levels[ids[0]].glyphs.plan.route;
    expect(W.brief.worldMap).toMatchObject({ opening: route.slice(0, WORLD_MAP.opening), firstZone: route.slice(WORLD_MAP.opening, WORLD_MAP.first) });
    const call = castingCall(W);
    expect(call.levels[ids[0]].from).toEqual(expect.arrayContaining(['grunt', 'elite', 'boss']));
    // (a genre whose cube asks no world map walks its levels as before)
    const D = composeGameworld({ prompt: 'a stylish action game like devil may cry in a gothic castle', seed: 1 });
    expect(D.topology).toBeUndefined();
    expect(Object.values(D.levels).every((l) => l.walk || l.building)).toBe(true);
  });
  it('is looked at before it is built: the map designer draws it in miniature from its recipe, side ways and all', () => {
    const W = composeGameworld({ prompt: 'an anime action rpg like zelda: a swordsman crosses a kingdom of forests and ruins', seed: 1 });
    const [id] = plannedMaps(W), html = gameworldMapHtml(W), P = W.levels[id].glyphs.plan;
    expect(Object.keys(W.levels)).toEqual([id]);
    for (const S of P.route) expect(html, S).toContain(P.key[S].name);
    expect(html).toContain('A band holds the short way');
    expect(() => gameworldMapHtml(W, { level: 'nowhere' })).toThrow(/no planned map of this world/);
    expect(() => gameworldMapHtml({ levels: { a: { walk: {} } } })).toThrow(/no level of this world is a planned map/);
  });

  it('the game made of it starts in play: its flow an opening cutscene\'s empty slot, then its first page, no screen before', () => {
    const W = composeGameworld({ prompt: 'an anime action rpg like zelda: a swordsman crosses a kingdom of forests and ruins', seed: 1 });
    const game = runSteps(W, { ref: 'gw' }).find((s) => s.key === 'game').order, refs = game.levels.map((l) => l.ref);
    expect(readFlow(game.flow, { levels: refs })).toEqual([]);
    expect(game.flow.start).toBe('opening');
    expect(game.flow.steps.opening).toEqual({ kind: 'cutscene', next: ['$continue', '$first'] });
    // walked from a first boot: the slot is passed at once and the player is on the opening page
    expect(walkFlow(game.flow, ['next'], { resolve: (sp) => (sp === '$first' ? refs[0] : null) })).toEqual([{ step: 'opening', level: null }, { step: 'play', level: refs[0] }]);
    // a world that says no such word is made as it was: no flow of its own
    const { flow: _f, ...plain } = W;
    expect(runSteps(plain, { ref: 'gw' }).find((s) => s.key === 'game').order.flow).toBeUndefined();
  });
  it('the world\'s bible draws it: its blocks in their places by name, the walk through them, who each block\'s fights stand', () => {
    const W = composeGameworld({ prompt: 'an anime action rpg like zelda: a swordsman crosses a kingdom of forests and ruins', seed: 1 });
    const id = Object.keys(W.levels)[0], P = W.levels[id].glyphs.plan;
    const html = gameworldBibleHtml(W);
    expect(html).toContain('<h4>The map</h4>');
    for (const S of P.route) expect(html, S).toContain(`>${P.key[S].name}</text>`);
    // (a block's fights, from its scenario's beats; the goal's block marked)
    const fought = W.levels[id].glyphs.sketch.scenario.beats.find((b) => b.foes), role = Object.keys(fought.foes)[0];
    expect(html).toMatch(new RegExp(`font-size="8">[^<]*${role}`));
    expect(html).toContain(' ★</text>');
    // (how its fights played, once a check has played them: a line a stage, kept in the run's record; none before)
    expect(html).not.toContain('Played · machine gate');
    const print = 'abcd1234', rec = { ref: 'gw-level', order: print, stored: print };
    const made = { [`level-${id}-0`]: { ...rec, play: { stored: print, pass: true, says: ['basic: won at 78 s', 'still: not ended in 180 s'] } }, [`level-${id}-1`]: { ...rec, play: { stored: print, pass: false, says: ['basic: the hero went down at 12 s', 'still: not ended'] } } };
    expect(readMade(made)).toBeTruthy();
    const played = gameworldBibleHtml({ ...W, made });
    expect(played).toContain('Played · machine gate');
    expect(played).toMatch(/<b>stage 1<\/b> won by a player who fights, not by one who stands still<span>basic: won at 78 s · still: not ended in 180 s<\/span>/);
    expect(played).toMatch(/<b>stage 2<\/b> not yet won by a player who fights/);
    // (the record refuses a verdict it cannot read, and one on a record that is no level's)
    expect(() => readMade({ [`level-${id}-0`]: { ...rec, play: { stored: print, pass: 'yes', says: [] } } })).toThrow(/play is \{ stored, pass/);
    expect(() => readMade({ hero: { ...rec, play: { stored: print, pass: true, says: [] } } })).toThrow(/play is not part/);
  });
});

// A PARTY RPG'S WILDS (wildsLevel): the world map's blocks walked out from the town, one page; a pack on each block's way
// past the first, none where the town opens on them, and no boss (the round's core holds it)
describe('a party RPG\'s wilds', () => {
  it('a stretch of the world map\'s blocks, each by its template, a pack on every way but the first block\'s', () => {
    const { glyphs } = wildsLevel({ landscape: 'pine' }), P = glyphs.plan, G = readGrid({ tile: glyphs.tile, plan: P }, 'grid');
    expect(P.route).toHaveLength(WILDS.length);
    expect(P.size).toBe(WORLD_MAP.size);
    // (a block a page, as the world map's zones after its first)
    expect(glyphs.zoned).toEqual([]);
    expect(P.route.map((S) => P.key[S].fill)).toEqual(WILDS.map((b) => b.fill));
    expect(P.key[P.route[0]].name).toBe('the pine road');
    // (the arrival from the town, then passages: the far block's way goes on to the next ring)
    expect(Object.values(G.plan.segments).map((x) => x.role)).toEqual(['arrival', 'passage', 'passage']);
    const items = mapItems(G);
    expect(items.filter((x) => x.kind === 'pack').map((x) => x.segment)).toEqual(P.route.slice(1));
    expect(items.some((x) => x.kind === 'boss')).toBe(false);
    // (a second stretch reads as its own place: other names on the same blocks)
    const next = wildsLevel({ landscape: 'pine', at: 1 }).glyphs.plan;
    expect(next.route.map((S) => next.key[S].name)).not.toEqual(P.route.map((S) => P.key[S].name));
    expect(next.route.map((S) => next.key[S].fill)).toEqual(P.route.map((S) => P.key[S].fill));
  });
});


// THE SETTLEMENTS' LOOK (`town`, era/village-look.js): a world map asked for it marks its village's block and its town's
// as a town, and no other; absent, no block says it
describe('the world map\'s settlements', () => {
  it('its village and its town are a town\'s region; the wilds are not', () => {
    const K = worldMapLevel({ n: 3, town: 'storybook' }).level.glyphs.plan.key, seg = worldMapLevel({ n: 3, town: 'storybook' }).level.glyphs.segments;
    const towned = Object.keys(K).filter((S) => K[S].town === 'storybook');
    expect(towned.sort()).toEqual(Object.keys(seg).sort());
    expect(towned.length).toBeGreaterThanOrEqual(2);
    expect(Object.values(worldMapLevel({ n: 3 }).level.glyphs.plan.key).some((k) => k.town !== undefined)).toBe(false);
  });
});

describe('a region of a chain (`names`, `climax`, `opening`)', () => {
  it('its blocks named as given, its climax its own foes, come into with nothing taught; absent, the map as it was', () => {
    const base = worldMapLevel({ n: 3 }).level;
    expect(worldMapLevel({ n: 3, names: null, climax: null, opening: true }).level).toEqual(base);
    const { level } = worldMapLevel({ n: 3, names: ['the shore', 'the dunes'], climax: { 'dragon-storm': 1 }, opening: false }), g = level.glyphs;
    expect(g.plan.key.A.name).toBe('the shore'); expect(g.plan.key.B.name).toBe('the dunes'); expect(g.plan.key.C.name).toBe(base.glyphs.plan.key.C.name);
    const beats = g.sketch.scenario.beats;
    expect(beats.find((b) => b.kind === 'climax').foes).toEqual({ 'dragon-storm': 1 });
    expect(beats.some((b) => b.teach)).toBe(false);
    expect(beats.find((b) => b.at === 'A' && b.kind === 'arrival').say).toMatch(/the shore/);
  });
});

import { PLAINS } from './world-map.js';
describe('a region\'s plains (`plains`)', () => {
  it('open blocks between the first zone and the town, a road straight across, a band beside it that holds nothing shut; none asked, as before', () => {
    expect(worldMapLevel({ n: 3, plains: 0 }).level).toEqual(worldMapLevel({ n: 3 }).level);
    const base = worldMapLevel({ n: 3 }).level.glyphs, g = worldMapLevel({ n: 3, plains: 2 }).level.glyphs, P = g.plan;
    expect(P.route.length).toBe(base.plan.route.length + 2);
    const [, , , F1, F2, T] = P.route;
    for (const S of [F1, F2]) { expect(P.key[S].fill).toBe(PLAINS.fill); expect(P.key[S].name).toMatch(/plains|fields|downs/); }
    // (the town after them, its tavern laid)
    expect(P.key[T].fill).toBe(base.plan.key[base.plan.route[3]].fill);
    expect(Object.values(g.segments[T].key).map((k) => k.use)).toContain('tavern');
    const beats = g.sketch.scenario.beats, band = beats.find((b) => b.id === `${F1.toLowerCase()}-band`);
    expect(band).toMatchObject({ kind: 'fight', at: F1 }); expect(band.opens).toBeUndefined();
    // (beside the road, off it)
    const rows = g.segments[F1]?.rows ?? null;
    if (rows) expect(rows[band.tile[0]].replace(/\s+/g, '')[band.tile[1]]).not.toBe('#');
    for (const l of lawsOf(worldMapLevel({ n: 3, plains: 2 }).level)) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
  });
});

// AN APPROACH (approachLevel): one block crossed west to east, the controls taught, an ambush up the road short of the way
// on, the road on; ridden onto, getting down taught first (the ridden one: artesia.test.js)
describe('an approach', () => {
  it('one block: the controls, then a fight and the one that comes after it holding the way on, then the road on', () => {
    const { level, ambush, tile } = approachLevel({ name: 'the old road' });
    expect(level.glyphs.plan).toMatchObject({ rows: ['A'], route: ['A'] });
    expect(level.glyphs.plan.key.A.ride).toBeUndefined();
    const beats = level.glyphs.sketch.scenario.beats;
    expect(beats.map((b) => b.id)).toEqual(['controls', APPROACH.ambush, APPROACH.rest, APPROACH.road]);
    expect(beats[0].teach).toEqual(['move', 'look', 'jump', 'sprint']);
    expect(beats.find((b) => b.id === APPROACH.rest)).toMatchObject({ after: ambush, opens: true, tile });
    expect(approachLevel({ name: 'the old road', ridden: true }).level.glyphs.sketch.scenario.beats[0].teach[0]).toBe('dismount');
    expect(() => readSketch(level.glyphs.sketch, readGrid({ tile: level.glyphs.tile, plan: level.glyphs.plan }).plan)).not.toThrow();
  });
});
