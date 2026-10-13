process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

// A world bible's city level, at game depth: the runner's steps made (a level per segment), create_game promoting
// them, its audit walking each segment from the portal it came in at to its way on, in a line and in a map.

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { mintGame } from '@/lib/mcp/tools/create-game';
import { createSketchHandler } from '@/lib/mcp/tools/sketch-mint';
import { readGameworld } from '@/lib/graph/gameworld/index';
import { gameStages, stageLevelOrder, gameLevels, mapPlan } from '@/lib/graph/gameworld/levels';

beforeEach(() => closeDb());

const world = (extra = {}) => ({ id: 'harbour', name: 'Harbour', seed: 5, levels: { downtown: { name: 'Downtown', city: { board: { cols: 10, rows: 8 }, seed: 4, cars: false } } }, ...extra });
// the runner's own calls (runner.js), less the book it waits on: a level per stage, the game over them
async function play(W, ref) {
  const G = readGameworld(W), stages = gameStages(W), refs = stages.map((s) => `${ref}-level-${s.level}-${s.index}`);
  const map = G.topology === 'interconnected' ? mapPlan(G, stages, refs) : null;
  const cityRefs = Object.fromEntries(stages.map((s, i) => [s.node, refs[i]]));
  for (const [i, s] of stages.entries()) {
    const L = stageLevelOrder(G, s, { ref: refs[i], cityRefs, ...(map ? { map: map[i] } : {}) });
    await createSketchHandler({ title: L.args.title, ref: refs[i], manifest: L.args.manifest });
  }
  const game = { title: G.name, store: { slices: [{ name: 'campaign', kind: 'progression' }] }, levels: gameLevels(stages, refs, map) };
  return { stages, game: await mintGame({ ...game, ref: `${ref}-game`, autoAudit: true }) };
}

describe('a world bible\'s city level, played', () => {
  it('in a line: each segment of the route walked to its way on, the last to its farthest crossing', async () => {
    const { stages, game } = await play(world(), 'gwc');
    expect(stages.length).toBeGreaterThan(1);
    expect(game.ok, JSON.stringify(game.error ?? game.audits)).toBe(true);
  }, 600_000);
  it('in a map: every segment, each walked out by one of its portals', async () => {
    const { game } = await play(world({ topology: 'interconnected' }), 'gwm');
    expect(game.ok, JSON.stringify(game.error ?? game.audits)).toBe(true);
  }, 600_000);
});
