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

  it('the cast\'s leaders, human and not: a beast-kin, a beast made a creature, a mascot, and a beast foe, each photographed', async () => {
    if (!browser) return;
    // in a crypt: the wolf that leads is mythical and of bone (its part's fantasy and the building's), the rat a zombie
    const people = { mastermind: { body: 'beast', species: 'wolf' }, lieutenant: { body: 'beastkin' }, rival: { body: 'mascot' } };
    const rat = { name: 'Grave Rat', rank: 1, beast: { species: 'rat', ooze: 'zombie' } };
    const out = await createGameHandler({ title: 'Held', table_rpg: { starter: { use: 'crypt' }, cast: { people }, foes: { rat }, party: [{ id: 'x', role: 'frontline' }] }, ref: 'pt_cast' });
    expect(SketchRepository.getByRef('pt_cast-cast').manifest.cast.cast.mastermind.ooze).toEqual(['mythical', 'skeletal']);
    expect(out.findings?.filter((f) => f.where === 'characters') ?? []).toEqual([]);
    const m = SketchRepository.getByRef('pt_cast').manifest;
    const { foes, missing } = await tableRpgPortraits(m, { paper: '#f0e6d2' });
    expect(missing.filter((x) => x.foe)).toEqual([]);
    expect(Object.keys(foes).sort()).toEqual(['barrow-lord', 'lieutenant', 'rat', 'rival']);
    for (const shot of Object.values(foes)) for (const k of ['figure', 'bust']) expect(shot[k].length).toBeGreaterThan(8000);
    if (process.env.TABLE_RPG_SHOTS) {
      const { writeFileSync } = await import('node:fs');
      for (const [id, shot] of Object.entries(foes)) for (const k of ['figure', 'bust']) writeFileSync(`${process.env.TABLE_RPG_SHOTS}/${id}-${k}.jpg`, Buffer.from(shot[k].split(',')[1], 'base64'));
    }
  }, 300000);

  it('arms and artifacts: the member photographed holding its weapon, the relic photographed as an object', async () => {
    if (!browser) return;
    await createGameHandler({ title: 'Armed', table_rpg: { starter: { use: 'temple' }, party: [{ id: 'hero', egocube: { facets: { role: 'frontline' } } }] }, ref: 'pt_arms' });
    const m = SketchRepository.getByRef('pt_arms').manifest;
    const { portraits, items, missing } = await tableRpgPortraits(m, { paper: '#f0e6d2' });
    expect(missing).toEqual([]);
    expect(items.relic.figure.length).toBeGreaterThan(8000);
    if (process.env.TABLE_RPG_SHOTS) {
      const { writeFileSync } = await import('node:fs');
      writeFileSync(`${process.env.TABLE_RPG_SHOTS}/relic.jpg`, Buffer.from(items.relic.figure.split(',')[1], 'base64'));
      writeFileSync(`${process.env.TABLE_RPG_SHOTS}/armed-hero.jpg`, Buffer.from(portraits.hero.figure.split(',')[1], 'base64'));
    }
  }, 300000);
});
