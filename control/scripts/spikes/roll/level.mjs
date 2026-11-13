// SPIKE roll (shared): one small collectathon (design_game's quick `collect`, in memory) with breakable walls stood
// across the straight way from its start to its exit, and the roll kernel under test. Not product code.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { designGameHandler } = await import('../../../lib/mcp/tools/design-game.js');
const { SketchRepository } = await import('../../../lib/db/repositories/sketches.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { breakableTerrain } = await import('../../../lib/graph/playscape/terrain.js');
const { piecesOf } = await import('../../../lib/graph/playscape/destruct/breakability.js');
const { faceGround, pageGroundFaces } = await import('../../../lib/graph/game/level-equivalence.js');

// THE ROLL KERNEL under test: integers only (imul, shifts, %), so Chrome and Node roll alike. Import-free: the page
// runs this source by toString().
export function buildRoll() {
  const dice = (seed) => {
    let a = (Math.imul(seed | 0, 0x9e3779b1) ^ 0x85ebca6b) >>> 0;
    return (n) => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) % n; };
  };
  // roll: { cover: [{ of: [ids], stand: n | [min, max] }], start?: [[x, y, z], …] } → { stand: [ids], gone: [ids], start }
  function rollOf(roll, seed) {
    const below = dice(seed), stand = [], gone = [];
    for (const g of roll.cover || []) {
      const lo = Array.isArray(g.stand) ? g.stand[0] : g.stand, hi = Array.isArray(g.stand) ? g.stand[1] : g.stand;
      const n = lo + below(hi - lo + 1), ids = g.of.slice();
      for (let i = ids.length - 1; i > 0; i--) { const j = below(i + 1), x = ids[i]; ids[i] = ids[j]; ids[j] = x; }
      ids.forEach((id, k) => (k < n ? stand : gone).push(id));
    }
    const start = Array.isArray(roll.start) && roll.start.length ? roll.start[below(roll.start.length)] : null;
    return { stand: stand.sort(), gone: gone.sort(), start };
  }
  return { rollOf };
}

export async function spikeLevel({ walls = 5, length = 9, height = 2 } = {}) {
  await designGameHandler({ quick: { goal: 'collect', world: { id: 'rl' } }, ref: 'r' });
  const row = SketchRepository.getByRef('r-level-run-0'), M = row.manifest;
  const { payload } = await resolveWorldScene(row);
  const ground = faceGround(pageGroundFaces(payload.faces || []));
  const spawn = M.entities.find((e) => e.id === 'player').transform.pos, exit = M.game.mechanics.find((m) => m.kind === 'reach-exit').at;
  const asks = [], footings = [], faces = [], breakables = [];
  for (let k = 0; k < walls; k++) {
    const u = (k + 1) / (walls + 1.5), x = spawn[0] + (exit[0] - spawn[0]) * u, y = spawn[1] + (exit[1] - spawn[1]) * u;
    const z = Math.round((ground([x, y, 60]) ?? 0) * 100) / 100, id = `wall-${k}`;
    const T = breakableTerrain({ id, form: 'wall', at: [x, y, z], N: [0, -1], length, height, thick: 0.5 }, { seed: 7 + k });
    asks.push({ id, at: [x, y, z], blocks: T.blocks.map((b) => b.id) });
    footings.push({ min: [x - length / 2, y - 0.25, z - 1], max: [x + length / 2, y + 0.25, z], of: `footing:${id}` });
    // (a block's faces in their own render group, break:<id>, as breakablesOf moves them: the group the page hides)
    for (const f of T.faces) faces.push({ ...f, group: f.node });
    for (const b of T.world.breakables) breakables.push(b);
  }
  // (the quick level's first-person walker has no collide radius, so no collider stops it: a body is given here)
  const entities = payload.entities.map((e) => (e.id === 'player' ? { ...e, rule: { ...e.rule, collideRadius: 0.3, collideHeight: 1.7, step: 0.3 } } : e));
  const P = { ...payload, entities, faces: [...payload.faces, ...faces], colliders: [...(payload.colliders || []), ...footings], breakables };
  P.breakPieces = piecesOf(breakables, P.faces, { share: true });
  const roll = { cover: [{ of: asks.map((a) => a.id), stand: [1, walls - 1] }] };
  return { row, manifest: M, payload: P, bare: payload, asks, roll, spawn, exit, ground };
}
