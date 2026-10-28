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
import { SUNKEN_CHAPEL } from '@/lib/graph/table-rpg/fixtures/sunken-chapel';

let browser = false;
beforeAll(async () => { try { await resolveChromium({ allowFetch: false }); browser = true; } catch { browser = false; } }, 60000);
afterAll(() => closeDb());

// the chapel bare of what the game makes besides its characters (the bone knife, the zombie rat): each test adds only what
// it photographs, since every photograph is seconds of a browser's work
const { 'bone-knife': KNIFE, ...ITEMS } = SUNKEN_CHAPEL.items;
const BARE = {
  ...SUNKEN_CHAPEL, items: ITEMS,
  foes: { ...SUNKEN_CHAPEL.foes, 'grave-rat': { name: 'Grave Rat', rank: 1, text: 'fat, pale and bold' } },
  dungeons: { chapel: { ...SUNKEN_CHAPEL.dungeons.chapel, rooms: SUNKEN_CHAPEL.dungeons.chapel.rooms.map((r) => (r.id === 'ossuary' ? { ...r, items: [{ item: 'silver-ring', hidden: true }] } : r)) } },
};

describe('the party photographed', () => {
  it('a figure and a bust of each made character, on the book\'s paper, the second read from memory', async () => {
    if (!browser) return;
    await createGameHandler({ title: 'Solo', table_rpg: { ...BARE, party: [{ id: 'hero', egocube: { facets: { role: 'flanker' } } }] }, ref: 'pt_solo' });
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
    // the wolf that leads is mythical and of bone (its part's fantasy and the cast's theme), the grave rat a zombie
    const people = { mastermind: { body: 'beast', species: 'wolf' }, lieutenant: { body: 'beastkin' }, rival: { body: 'mascot' } };
    const foes = { ...BARE.foes, 'grave-rat': { ...BARE.foes['grave-rat'], beast: { species: 'rat', ooze: 'zombie' } } };
    const out = await createGameHandler({ title: 'Held', table_rpg: { ...BARE, foes, cast: { ooze: 'skeletal', as: { mastermind: 'barrow-wight', troop: 'ghoul', hand: 'footpad' }, people } }, ref: 'pt_cast' });
    expect(SketchRepository.getByRef('pt_cast-cast').manifest.cast.cast.mastermind.ooze).toEqual(['mythical', 'skeletal']);
    expect(out.findings?.filter((f) => f.where === 'characters') ?? []).toEqual([]);
    const m = SketchRepository.getByRef('pt_cast').manifest;
    const { foes: shots, missing } = await tableRpgPortraits(m, { paper: '#f0e6d2' });
    expect(missing.filter((x) => x.foe)).toEqual([]);
    expect(Object.keys(shots).sort()).toEqual(['barrow-wight', 'grave-rat', 'lieutenant', 'rival']);
    for (const shot of Object.values(shots)) for (const k of ['figure', 'bust']) expect(shot[k].length).toBeGreaterThan(8000);
    if (process.env.TABLE_RPG_SHOTS) {
      const { writeFileSync } = await import('node:fs');
      for (const [id, shot] of Object.entries(shots)) for (const k of ['figure', 'bust']) writeFileSync(`${process.env.TABLE_RPG_SHOTS}/${id}-${k}.jpg`, Buffer.from(shot[k].split(',')[1], 'base64'));
    }
  }, 300000);

  it('arms and artifacts: the member photographed holding its weapon, an artifact photographed as an object', async () => {
    if (!browser) return;
    await createGameHandler({ title: 'Armed', table_rpg: { ...BARE, gear: { style: 'celestial' }, items: { ...BARE.items, 'bone-knife': KNIFE }, party: [{ id: 'hero', egocube: { facets: { role: 'frontline' } } }] }, ref: 'pt_arms' });
    const m = SketchRepository.getByRef('pt_arms').manifest;
    const { portraits, items, missing } = await tableRpgPortraits(m, { paper: '#f0e6d2' });
    expect(missing).toEqual([]);
    expect(Object.keys(items)).toEqual(['bone-knife']);
    expect(items['bone-knife'].figure.length).toBeGreaterThan(8000);
    if (process.env.TABLE_RPG_SHOTS) {
      const { writeFileSync } = await import('node:fs');
      writeFileSync(`${process.env.TABLE_RPG_SHOTS}/bone-knife.jpg`, Buffer.from(items['bone-knife'].figure.split(',')[1], 'base64'));
      writeFileSync(`${process.env.TABLE_RPG_SHOTS}/armed-hero.jpg`, Buffer.from(portraits.hero.figure.split(',')[1], 'base64'));
    }
  }, 300000);

  it('loot: a hoard of arms of every kind photographed, and a mender holding its mace on a haft', async () => {
    if (!browser) return;
    const foes = { ...BARE.foes, 'barrow-wight': { ...BARE.foes['barrow-wight'], loot: 'hoard' } };
    const tables = { ...BARE.tables, hoard: { name: 'The wight\'s hoard', loot: { n: 4, rank: 3 } } };
    await createGameHandler({ title: 'Hoard', table_rpg: { ...BARE, foes, tables, party: [{ id: 'mender', egocube: { facets: { role: 'support' } } }] }, ref: 'pt_loot' });
    const m = SketchRepository.getByRef('pt_loot').manifest;
    const { portraits, items, missing } = await tableRpgPortraits(m, { paper: '#f0e6d2' });
    expect(missing).toEqual([]);
    const hoard = Object.keys(items).filter((id) => /^hoard-/.test(id));
    expect(hoard).toHaveLength(4);
    for (const id of hoard) expect(items[id].figure.length).toBeGreaterThan(6000);
    if (process.env.TABLE_RPG_SHOTS) {
      const { writeFileSync } = await import('node:fs');
      for (const id of hoard) writeFileSync(`${process.env.TABLE_RPG_SHOTS}/${id}.jpg`, Buffer.from(items[id].figure.split(',')[1], 'base64'));
      writeFileSync(`${process.env.TABLE_RPG_SHOTS}/mender.jpg`, Buffer.from(portraits.mender.figure.split(',')[1], 'base64'));
    }
  }, 300000);
});
