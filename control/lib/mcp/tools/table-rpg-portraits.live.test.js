// The table game's portraits in a real browser (an e2e suite: skipped when none is installed): a member made a character
// through the character loop is photographed from its World page, a figure and a bust, kept per revision.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createGameHandler } from './create-game.js';
import { tableRpgPortraits } from './table-rpg-portraits.js';
import { resolveChromium } from '@/lib/graph/scene/chromium';

let browser = false;
beforeAll(async () => { try { await resolveChromium({ allowFetch: false }); browser = true; } catch { browser = false; } }, 60000);
afterAll(() => closeDb());

describe('the party photographed', () => {
  it('a figure and a bust of each made character, on the book\'s paper, the second read from memory', async () => {
    if (!browser) return;
    await createGameHandler({ title: 'Solo', table_rpg: { starter: { use: 'crypt' }, party: [{ id: 'hero', egocube: { facets: { role: 'flanker' } } }] }, ref: 'pt_solo' });
    const m = SketchRepository.getByRef('pt_solo').manifest;
    const { portraits, missing } = await tableRpgPortraits(m, { paper: '#f0e6d2' });
    expect(missing).toEqual([]);
    for (const k of ['figure', 'bust']) {
      expect(portraits.hero[k]).toMatch(/^data:image\/jpeg;base64,/);
      expect(portraits.hero[k].length).toBeGreaterThan(8000);
    }
    const t = Date.now();
    expect((await tableRpgPortraits(m, { paper: '#f0e6d2' })).portraits.hero).toBe(portraits.hero);
    expect(Date.now() - t).toBeLessThan(2000);
    // a member with no character has no photograph, and says why
    const bare = { ...m, tableRpg: { ...m.tableRpg, party: [{ id: 'x', role: 'caster' }] } };
    expect((await tableRpgPortraits(bare)).missing[0]).toMatchObject({ id: 'x' });
  }, 300000);
});
