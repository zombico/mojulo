// SPIKE roll (shared): one small collectathon (design_game's quick `collect`, in memory) with five walls stood across
// the straight way from its start to its exit, and a roll over them, both written in its recipe (`blocks`, `roll`).
// Phase 0 ran this with a kernel and breakable walls of its own; since the roll landed it is the product's path whole.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { designGameHandler } = await import('../../../lib/mcp/tools/design-game.js');
const { SketchRepository } = await import('../../../lib/db/repositories/sketches.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { faceGround, pageGroundFaces } = await import('../../../lib/graph/game/level-equivalence.js');

export async function spikeLevel({ walls = 5, length = 9, height = 2 } = {}) {
  await designGameHandler({ quick: { goal: 'collect', world: { id: 'rl' } }, ref: 'r' });
  const row = SketchRepository.getByRef('r-level-run-0'), M = row.manifest;
  const bare = (await resolveWorldScene(row)).payload, ground = faceGround(pageGroundFaces(bare.faces || []));
  const spawn = M.entities.find((e) => e.id === 'player').transform.pos, exit = M.game.mechanics.find((m) => m.kind === 'reach-exit').at;
  const blocks = Array.from({ length: walls }, (_, k) => {
    const u = (k + 1) / (walls + 1.5), x = spawn[0] + (exit[0] - spawn[0]) * u, y = spawn[1] + (exit[1] - spawn[1]) * u;
    return { id: `wall-${k}`, form: 'wall', at: [x, y, Math.round((ground([x, y, 60]) ?? 0) * 100) / 100], N: [0, -1], length, height, thick: 0.5 };
  });
  // (the quick level's first-person walker has no collide radius, so no collider stops it: a body is given here)
  const entities = M.entities.map((e) => (e.id === 'player' ? { ...e, rule: { ...e.rule, collideRadius: 0.3, collideHeight: 1.7, step: 0.3 } } : e));
  const manifest = { ...M, entities, blocks, roll: { cover: [{ of: blocks.map((b) => b.id), stand: [1, walls - 1] }] } };
  const { payload } = await resolveWorldScene({ ...row, manifest });
  return { manifest, payload, bare, blocks, spawn, exit };
}
