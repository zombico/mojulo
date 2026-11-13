// THE WORLD MAP (world-map.js): what the sentence door lays for a genre whose cube asks for one (the action RPG): one
// planned map that starts as a game starts (the opening a page of its own: the controls, then an enemy trail held as its
// way out), its first zone after it, a zone a block after that, travelled zone to zone. The concept on two cases, one
// per path: the smallest world (its last block the goal) and one with zones after its first.
import { describe, it, expect } from 'vitest';
import { worldMapLevel, WORLD_MAP } from './world-map.js';
import { composeGameworld } from './compose.js';
import { castingCall } from './foe-casting.js';
import { gameworldBibleHtml, readMade } from './index.js';
import { readGrid } from '../level/grid.js';
import { readSketch, sketchLaws } from '../level/map-sketch.js';
import { FOE_CLASSES } from '../foes/index.js';
import { SIGHTS } from '../mind/vocab.js';
import { FLOW_IN_PLAY, readFlow, walkFlow } from '../game/flow.js';
import { runSteps } from './runner.js';

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

  it('the sentence door lays the action RPG as a world map travelled zone to zone, and the casting call fields it', () => {
    const W = composeGameworld({ prompt: 'an anime action rpg like zelda: a swordsman crosses a kingdom of forests and ruins', seed: 1 });
    const ids = Object.keys(W.levels);
    expect(ids).toHaveLength(1);
    expect(W.topology).toBe('interconnected');
    expect(W.start).toBe(ids[0]);
    expect(W.levels[ids[0]].walk).toBeUndefined();
    expect(W.levels[ids[0]].glyphs.plan.route.length).toBe(WORLD_MAP.first + 2);
    expect(W.brief.worldMap.level).toBe(ids[0]);
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
