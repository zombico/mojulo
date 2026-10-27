// Isolate to an in-memory SQLite, and the outcomes base to a disposable dir — before any import that pulls in the db.
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
const OUT = mkdtempSync(path.join(tmpdir(), 'table-rpg-game-test-'));
process.env.MOJULO_OUTCOMES_DIR = OUT;

import { describe, it, expect, afterAll } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createGameHandler, getGameVocabHandler } from './create-game.js';
import { updateSketchHandler } from './sketches.js';
import { exportGameHandler } from './export-game.js';
import { emitTableRpgGame, tableRpgBookOf } from '@/lib/graph/table-rpg/table-rpg-manifest';
import { SUNKEN_CHAPEL } from '@/lib/graph/table-rpg/fixtures/sunken-chapel';
import { STARTER_PARTY } from '@/lib/graph/table-rpg/table-rpg-starter';
import { TABLE_RPG_SYSTEM_IDS } from '@/lib/graph/table-rpg/table-rpg-systems';

afterAll(() => { rmSync(OUT, { recursive: true, force: true }); closeDb(); });

// The door: create_game with `table_rpg` mints a pen-and-paper game played in text, its own page and its own book.
describe('create_game — a table game (table_rpg)', () => {
  it('mints a game from a starter, its party rolled: the answer says every sheet as character creation made it', async () => {
    const out = await createGameHandler({ title: 'The Dry Well', table_rpg: { starter: { use: 'crypt' }, system: 'bands', characters: false }, ref: 'tr_well' });
    expect(out).toMatchObject({ ok: true, ref: 'tr_well', engine: 'table-rpg', rules: 'bands', playUrl: '/api/sketches/tr_well/game', bookUrl: '/api/sketches/tr_well/bible', charactersUrl: '/api/sketches/tr_well/bible?parts=party' });
    expect(out.party).toHaveLength(STARTER_PARTY.length);
    for (const p of out.party) {
      expect(p.sheet).toMatch(new RegExp(`^${p.name}, the \\w+ — `));
      expect(p.made).toMatch(/^array: placed best first/);
      expect(typeof p.persona).toBe('string');
    }
    const row = SketchRepository.getByRef('tr_well');
    expect(row.manifest).toEqual({ kind: 'game', engine: 'table-rpg', title: 'The Dry Well', tableRpg: { starter: { use: 'crypt' }, system: 'bands', characters: false } });
  });

  it('the page and the book regenerate from the recipe: the kernel in the page, the sheets in the book', async () => {
    const m = SketchRepository.getByRef('tr_well').manifest;
    const page = emitTableRpgGame(m, { title: 'The Dry Well', bookHref: '/book' });
    expect(page).toBe(emitTableRpgGame(m, { title: 'The Dry Well', bookHref: '/book' }));
    expect(page).toContain('<title>The Dry Well</title>');
    expect(page).toContain('var buildTableRpg = (function buildTableRpg()');
    expect(page).toContain('<a href="/book">the book</a>');
    const sheets = tableRpgBookOf(m, { parts: ['party'] }).html;
    expect((sheets.match(/<section class="page">/g) ?? []).length).toBe(STARTER_PARTY.length);
    expect(sheets).not.toContain('id="running"');
    expect(tableRpgBookOf(m).html).toContain('id="running"');
  });

  it('a module written out keeps its own party; a game it cannot play is refused, teaching', async () => {
    const { title, ...module } = SUNKEN_CHAPEL;
    const out = await createGameHandler({ title, table_rpg: { ...module, book: 'zine', characters: false } });
    expect(out.party.map((p) => p.name)).toEqual(SUNKEN_CHAPEL.party.map((p) => p.name));
    expect(out.findings).toBeUndefined();
    await expect(createGameHandler({ title: 'x', table_rpg: { starter: { use: 'castle' } } })).rejects.toThrow(/no program 'castle'/);
    await expect(createGameHandler({ title: 'x', table_rpg: { starter: { use: 'crypt' }, system: 'gurps' } })).rejects.toThrow(/no starter 'gurps'.*written out as a card/);
    await expect(createGameHandler({ title: 'x', table_rpg: { starter: { use: 'crypt' }, book: 'glossy' } })).rejects.toThrow(/no style 'glossy'/);
    await expect(createGameHandler({ title: 'x', table_rpg: { starter: { use: 'crypt' } }, levels: [] })).rejects.toThrow(/has no levels/);
    await expect(createGameHandler({ title: 'x', table_rpg: 'crypt' })).rejects.toThrow(/table_rpg is \{/);
    await expect(createGameHandler({ title: 'x', table_rpg: { starter: { use: 'crypt' }, characters: 'yes' } })).rejects.toThrow(/characters is true/);
  });

  it('the checks advise: a broken dungeon is minted with what was found, never refused', async () => {
    const { title, ...module } = JSON.parse(JSON.stringify(SUNKEN_CHAPEL));
    module.dungeons.chapel.rooms.find((r) => r.id === 'vestry').items = ['tonic'];
    const out = await createGameHandler({ title, table_rpg: { ...module, characters: false } });
    expect(out.ok).toBe(true);
    expect(out.findings).toContainEqual({ where: 'chapel', level: 'advice', text: 'the lock between crypt stair and crypt wants iron key, which lies in no room (it can be forced)' });
  });

  it('update_sketch keeps a table game a table game: an edit is played by the kernel first', async () => {
    const m = SketchRepository.getByRef('tr_well').manifest;
    await updateSketchHandler({ ref: 'tr_well', manifest: { ...m, tableRpg: { ...m.tableRpg, system: 'target' } } });
    expect(SketchRepository.getByRef('tr_well').manifest.tableRpg.system).toBe('target');
    await expect(updateSketchHandler({ ref: 'tr_well', manifest: { ...m, tableRpg: { ...m.tableRpg, party: [] } } })).rejects.toThrow(/Invalid table game: .*party is 1 to 6/);
  });

  it('export_game writes the page, the book, the characters and their PDFs, and their recipe', async () => {
    const printed = [];
    const shots = { 'pc-1': { figure: 'data:image/jpeg;base64,AAAA', bust: 'data:image/jpeg;base64,BBBB' } };
    const out = await exportGameHandler({ ref: 'tr_well' }, {}, { printPdf: async (html) => { printed.push(html); return Buffer.from('%PDF-stub'); }, portraits: async () => ({ portraits: shots, missing: [{ id: 'pc-2', why: 'no browser' }] }) });
    expect(out).toMatchObject({ ok: true, engine: 'table-rpg' });
    expect(out.files.map((f) => f.file).sort()).toEqual(['README.md', 'book.html', 'book.pdf', 'characters.html', 'characters.pdf', 'game.html', 'recipe/game.json']);
    expect(out.book_url).toMatch(/book\.pdf$/);
    expect(printed).toHaveLength(2);
    expect(printed[1]).toContain('<img class="bust" src="data:image/jpeg;base64,BBBB"');
    expect(out.portraits_missing).toEqual([{ id: 'pc-2', why: 'no browser' }]);
    expect(readFileSync(path.join(out.dir, 'game.html'), 'utf8')).toContain('<a href="book.html">the book</a>');
    expect(readFileSync(path.join(out.dir, 'README.md'), 'utf8')).toContain('engine: table-rpg');
    // no browser: the pages are written and the note says how to print them
    const none = await exportGameHandler({ ref: 'tr_well' }, {}, { printPdf: async () => { throw new Error('no browser here'); }, portraits: async () => ({ portraits: {}, missing: [] }) });
    expect(none.files.map((f) => f.file)).not.toContain('book.pdf');
    expect(none.book_url).toMatch(/book\.html$/);
    expect(none.note).toMatch(/No PDF was printed \(no browser here\)/);
    await expect(exportGameHandler({ ref: 'tr_well', era: 'gen-6' })).rejects.toThrow(/era is read by a game's World pages/);
  });

  it('the party made real characters through the character loop: a sheet and a body each, recorded on the member', async () => {
    const out = await createGameHandler({ title: 'Solo', table_rpg: { starter: { use: 'crypt' }, party: [{ id: 'hero', egocube: { facets: { role: 'frontline' } } }] }, ref: 'tr_solo' });
    expect(out.party).toEqual([expect.objectContaining({ id: 'hero', character: 'tr_solo-hero' })]);
    expect(SketchRepository.getByRef('tr_solo-hero-sheet').manifest.kind).toBe('egocube');
    expect(SketchRepository.getByRef('tr_solo-hero').manifest.kind).toBe('layered');
    const stored = SketchRepository.getByRef('tr_solo').manifest.tableRpg.party[0];
    expect(stored).toMatchObject({ id: 'hero', character: 'tr_solo-hero', egocube: { roll: { facets: { role: 'frontline' } } } });
    // the stored roll reads back the same persona the character was made from
    const { readTableRpg } = await import('@/lib/graph/table-rpg/table-rpg-manifest');
    expect(readTableRpg(SketchRepository.getByRef('tr_solo').manifest.tableRpg).K.party[0].name).toBe(out.party[0].name);
  }, 120000);

  it('get_game_vocab serves the table games\' card: the keys, every starter, character creation, the book', async () => {
    const { card } = await getGameVocabHandler({ id: 'table-rpg' });
    expect(card.body).toContain('table_rpg: {');
    for (const id of TABLE_RPG_SYSTEM_IDS) expect(card.body).toContain(`${id} (`);
    expect(card.body).toContain('CHARACTER CREATION is the party');
    expect(card.body).toContain('never guessed');
    await expect(getGameVocabHandler({ id: 'table-rpgs' })).rejects.toThrow(/Known: .*table-rpg/);
  });
});
