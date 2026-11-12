// THE WORLD MAP (world-map.js): what the sentence door lays for a genre whose cube asks for one (the action RPG): one
// planned map, its first zone in teaching order on one page, a zone a block after it, travelled zone to zone. The
// concept on two cases, one per path: a first zone alone (its last block the goal) and a first zone with zones after it.
import { describe, it, expect } from 'vitest';
import { worldMapLevel, WORLD_MAP } from './world-map.js';
import { composeGameworld } from './compose.js';
import { castingCall } from './foe-casting.js';
import { readGrid } from '../level/grid.js';
import { readSketch, sketchLaws } from '../level/map-sketch.js';

const lawsOf = (level) => {
  const g = level.glyphs, G = readGrid({ tile: g.tile, plan: g.plan, ...(g.segments ? { segments: g.segments } : {}) }, 'grid');
  return sketchLaws(G, readSketch(g.sketch, G.plan));
};

describe('the world map', () => {
  it('a first zone with zones after it: one page for its first three blocks, its beats in teaching order, its laws held', () => {
    const { level, zoned } = worldMapLevel({ n: 3 });
    const P = level.glyphs.plan, beats = level.glyphs.sketch.scenario.beats;
    expect(P.route.length).toBe(WORLD_MAP.first + 2);
    expect(zoned).toEqual([P.route.slice(0, WORLD_MAP.first)]);
    expect(P.key[P.route.at(-1)].goal).toEqual({ use: 'keep' });
    // (teaching order: the look, the lone foe and the blow, the sprint, the pack with the lock and the dodge)
    const taught = beats.flatMap((b) => [].concat(b.teach ?? []));
    expect(taught).toEqual(['look', 'strike', 'sprint', 'lock', 'dodge']);
    expect(Object.values(beats.find((b) => b.id === 'lone').foes)).toEqual([1]);
    // (each zone's fight holds its way out; the last is the climax, the boss)
    expect(beats.filter((b) => b.opens).map((b) => b.at)).toEqual(P.route.slice(WORLD_MAP.first - 1, -1));
    expect(beats.at(-1)).toMatchObject({ kind: 'climax', at: P.route.at(-1), foes: { boss: 1 } });
    for (const l of lawsOf(level)) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
  });

  it('a first zone alone: its last block the goal and the climax, no zones', () => {
    const { level, zoned } = worldMapLevel({ n: 1 });
    expect(level.glyphs.plan.route.length).toBe(WORLD_MAP.first);
    expect(zoned).toBeNull();
    expect(level.glyphs.zoned).toBeUndefined();
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
    const call = castingCall(W);
    expect(call.levels[ids[0]].from).toEqual(expect.arrayContaining(['grunt', 'elite', 'boss']));
    // (a genre whose cube asks no world map walks its levels as before)
    const D = composeGameworld({ prompt: 'a stylish action game like devil may cry in a gothic castle', seed: 1 });
    expect(D.topology).toBeUndefined();
    expect(Object.values(D.levels).every((l) => l.walk || l.building)).toBe(true);
  });
});
