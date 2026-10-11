process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

// A building as a game level, at game depth: `level: { goal }` on any rail building, and create_game promotes it with
// its completability proved by the audit walking in at the door, up the stairs, into the goal room.

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { mintBuilding } from '@/lib/mcp/tools/building';
import { mintGame } from '@/lib/mcp/tools/create-game';

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

  it('a building without `level` is still refused as a level, saying why', async () => {
    mintBuilding({ title: 'Plain', ref: 'lv_plain', manifest: { kind: 'office', title: 'Plain' } });
    await expect(mintGame({ title: 'x', store: STORE, levels: [{ ref: 'lv_plain' }], ref: 'gm_plain', autoAudit: true })).rejects.toThrow(/no `game` channel/);
  }, 120_000);
});
