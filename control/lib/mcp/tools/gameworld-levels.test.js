// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createSketchHandler } from './sketches.js';
import { mintSolidHandler } from './mint-solid.js';
import { createGameHandler } from './create-game.js';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { MEADOWMARK_HERO, readGameworld, heroOrders, resolveBook } from '@/lib/graph/gameworld/index';
import { gameStages, stageEnds, stageLevelOrder, gameStore, gameLevels } from '@/lib/graph/gameworld/levels.js';

// The levels made playable: each stage a world the hero pilots, with an exit at the stage's own end; the book's store;
// a create_game over them, beatability not audited (walkable by construction, said so).
beforeEach(() => { closeDb(); });

describe('a gameworld\'s stages as game levels', () => {
  it('every stage spawns on its ground facing its end; a trail ends at its exit beat, a climb at its top, in volume', () => {
    const S = gameStages(MEADOWMARK_HERO);
    expect(S.map((s) => `${s.level}/${s.node}`)).toEqual(['meadow-ascent/trailhead', 'meadow-ascent/approach', 'meadow-ascent/lookout', 'shell-shore/landing', 'shell-shore/terrace']);
    const trail = stageEnds(S[0].manifest), climb = stageEnds(S[2].manifest);
    expect(trail).toMatchObject({ exitFrom: "the trail's exit beat", planar: true });
    expect(climb).toMatchObject({ exitFrom: expect.stringMatching(/^the climb's top tier/), planar: false });
    expect(climb.exit[2]).toBeGreaterThan(climb.spawn[2] + 10);
  });

  it('a stage mints as a level the hero pilots, carrying the systems and a game channel; the book compiles to a game', async () => {
    const G = readGameworld(MEADOWMARK_HERO), B = resolveBook(MEADOWMARK_HERO);
    await mintSolidHandler({ ...heroOrders(G).mint.args, ref: 'gw-hero' });
    const S = gameStages(MEADOWMARK_HERO).slice(0, 3), refs = S.map((s) => `gw-level-${s.level}-${s.index}`);
    for (const [i, s] of S.entries()) {
      const O = stageLevelOrder(G, s, { ref: refs[i], heroRef: 'gw-hero', mechanics: B.mechanics });
      expect((await createSketchHandler({ ...O.args, ref: refs[i] })).ok).toBe(true);
    }
    const row = SketchRepository.getByRef(refs[0]);
    expect(row.manifest.kind).toBe('stage');
    const { payload } = await resolveWorldScene(row);
    expect(payload.entities[0]).toMatchObject({ id: 'hero', pilotable: true, rule: { type: 'platform' } });
    expect(payload.faces.length).toBeGreaterThan(1000);
    expect(payload.events.inputs.map((x) => x.key)).toEqual(expect.arrayContaining(['1', 'i']));
    const game = await createGameHandler({ title: 'Meadowmark', store: gameStore(MEADOWMARK_HERO, B), levels: gameLevels(S, refs), allow_unaudited: true, ref: 'gw-game' });
    expect(game.ok).toBe(true);
    const stored = SketchRepository.getByRef('gw-game').manifest;
    expect(stored.kind).toBe('game');
    expect(stored.levels.map((l) => l.ref ?? l)).toEqual(refs);
  }, 240_000);
});
