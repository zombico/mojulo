process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

// A building as a game level, at game depth: `level: { goal }` on any rail building, and create_game promotes it with
// its completability proved by the audit walking in at the door, up the stairs, into the goal room.

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { mintBuilding } from '@/lib/mcp/tools/building';
import { mintGame } from '@/lib/mcp/tools/create-game';
import { createSketchHandler } from '@/lib/mcp/tools/sketch-mint';
import { gameStages, stageLevelOrder } from '@/lib/graph/gameworld/levels';
import { readGameworld, MEADOWMARK } from '@/lib/graph/gameworld/index';

beforeEach(() => closeDb());

const STORE = { slices: [{ name: 'campaign', kind: 'progression' }] };

describe('a building as a level', () => {
  it('a three-storey office: minted with a level, promoted, its audit walking up to the top floor', async () => {
    const res = mintBuilding({ title: 'Tower', ref: 'lv_office', manifest: { kind: 'office', title: 'Tower', storeys: 3, level: { goal: 'top' } } });
    expect(res.ok).toBe(true);
    expect(SketchRepository.getByRef('lv_office').manifest.game).toBeUndefined();   // the recipe keeps `level`; the channel is derived
    const game = await mintGame({ title: 'Climb the tower', store: STORE, levels: [{ ref: 'lv_office' }], ref: 'gm_office', autoAudit: true });
    expect(game.ok).toBe(true);
    expect(game.levels).toEqual(['lv_office']);
  }, 300_000);

  it('a store and a house become levels the same way', async () => {
    mintBuilding({ title: 'Shop', ref: 'lv_store', manifest: { kind: 'store', title: 'Shop', card: 'bookstore', level: {} } });
    mintBuilding({ title: 'Home', ref: 'lv_house', manifest: { title: 'Home', seed: 21, storeys: 2, furnish: true, windows: true, level: { goal: 'top' } } });
    const game = await mintGame({ title: 'Errands', store: STORE, levels: [{ ref: 'lv_store' }, { ref: 'lv_house' }], ref: 'gm_errands', autoAudit: true });
    expect(game.ok).toBe(true);
  }, 300_000);

  it('a room-kit stage: the crypt promoted, its audit walking five doorways to the sepulchre, the walls stopping it', async () => {
    const crypt = { kind: 'stage', kit: 'gothic-stone', title: 'Crypt', level: {},
      rooms: [{ id: 'nave', x: 0, y: 0, w: 12, d: 20, h: 9 }, { id: 'gallery', x: 12, y: 6, w: 10, d: 8, h: 5 }, { id: 'passage', x: 22, y: 8, w: 10, d: 4, h: 4 },
        { id: 'charnel', x: 32, y: 2, w: 10, d: 16, h: 6 }, { id: 'chapel', x: 26, y: 18, w: 16, d: 8, h: 5 }, { id: 'sepulchre', x: 14, y: 18, w: 12, d: 12, h: 7 }],
      links: [{ from: 'nave', to: 'gallery' }, { from: 'gallery', to: 'passage' }, { from: 'passage', to: 'charnel' }, { from: 'charnel', to: 'chapel' }, { from: 'chapel', to: 'sepulchre' }] };
    await createSketchHandler({ title: 'Crypt', ref: 'lv_crypt', manifest: crypt });
    const game = await mintGame({ title: 'Down the crypt', store: STORE, levels: [{ ref: 'lv_crypt' }], ref: 'gm_crypt', autoAudit: true });
    expect(game.ok).toBe(true);
  }, 300_000);

  it('a tavern from its program, on the gothic-night cube: promoted, its audit walking to the cellar', async () => {
    await createSketchHandler({ title: 'Tavern', ref: 'lv_tavern', manifest: { kind: 'stage', geocube: 'gothic-night', title: 'Tavern', program: { use: 'tavern', seed: 2 }, level: {} } });
    const game = await mintGame({ title: 'Last orders', store: STORE, levels: [{ ref: 'lv_tavern' }], ref: 'gm_tavern', autoAudit: true });
    expect(game.ok).toBe(true);
  }, 300_000);

  it('a tavern walked into off the meadow trail: the level ends in its cellar, the audit walking in at its door', async () => {
    const W = { ...MEADOWMARK, levels: { ...MEADOWMARK.levels, 'meadow-ascent': { ...MEADOWMARK.levels['meadow-ascent'], places: { ...MEADOWMARK.levels['meadow-ascent'].places, buildings: [{ use: 'tavern', seed: 2, goal: true }] } } } };
    const st = gameStages(W).find((s) => s.level === 'meadow-ascent' && s.manifest.buildings);
    expect(st.manifest.buildings[0]).toMatchObject({ use: 'tavern', goal: true });
    const order = stageLevelOrder(readGameworld(W), st, { ref: 'lv_meadow_inn' });
    expect(order.ends.exitFrom).toMatch(/tavern's cellar/);
    await createSketchHandler({ ...order.args, ref: 'lv_meadow_inn' });
    const game = await mintGame({ title: 'To the inn', store: STORE, levels: [{ ref: 'lv_meadow_inn' }], ref: 'gm_meadow_inn', autoAudit: true });
    expect(game.ok).toBe(true);
  }, 300_000);

  it('a building without `level` is still refused as a level, saying why', async () => {
    mintBuilding({ title: 'Plain', ref: 'lv_plain', manifest: { kind: 'office', title: 'Plain' } });
    await expect(mintGame({ title: 'x', store: STORE, levels: [{ ref: 'lv_plain' }], ref: 'gm_plain', autoAudit: true })).rejects.toThrow(/no `game` channel/);
  }, 120_000);
});
