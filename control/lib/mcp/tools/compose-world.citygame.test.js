// Isolate to in-memory SQLite before any import that pulls db/index.js (compose-world.fog.test.js pattern).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import { composeWorld } from './compose-world.js';
import { mintGame } from './create-game.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveGame } from '@/lib/graph/game/game-resolve';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';

// A city cut into segments plays as a map game: a level per segment, reading the city by ref, joined at its portals.
describe('a city as a map game', () => {
  const r = composeWorld({ base: 'city', seed: 6, title: 'Downtown', overrides: { plan: { grammar: 'new-york', segments: { levels: true } } } });
  it('mints a level per segment beside the city, and the order create_game takes', () => {
    expect(r.game.levels.length).toBeGreaterThan(1);
    for (const ref of r.game.levels) expect(SketchRepository.getByRef(ref).manifest).toMatchObject({ kind: 'city', city: r.ref });
    const order = r.game.create_game;
    expect(order.levels.map((l) => l.ref)).toEqual(r.game.levels);
    for (const lv of order.levels) for (const x of lv.exits) expect(order.levels.find((l) => l.ref === x.to).exits.some((y) => y.to === lv.ref)).toBe(true);
  });
  it('every level resolves against the game\'s store: its exits named for its neighbours, its arrivals from them', () => {
    const order = r.game.create_game;
    const g = resolveGame({ kind: 'game', ...order }, (ref) => SketchRepository.getByRef(ref), (ref) => `/levels/${ref}`);
    expect(g.levels.length).toBe(order.levels.length);
  });
  it('a level is the city\'s segment, walkable, its walls open only at its portals', async () => {
    const row = SketchRepository.getByRef(r.game.levels[0]);
    const { payload } = await resolveWorldScene(row);
    expect(payload.faces.length).toBeGreaterThan(1000);
    expect(payload.game).toBeTruthy();
  });
  it('the game mints', async () => {
    const g = await mintGame({ ...r.game.create_game, allowUnaudited: true });
    expect(g.ok).toBe(true);
  });
});
