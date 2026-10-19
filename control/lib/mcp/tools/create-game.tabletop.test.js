// Isolate to an in-memory SQLite, and the outcomes base to a disposable dir — before any import that pulls in the db.
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
const OUT = mkdtempSync(path.join(tmpdir(), 'tabletop-game-test-'));
process.env.MOJULO_OUTCOMES_DIR = OUT;

import { describe, it, expect, afterAll } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createGameHandler, getGameVocabHandler } from './create-game.js';
import { updateSketchHandler } from './sketches.js';
import { exportGameHandler } from './export-game.js';
import { emitTabletopGame } from '@/lib/graph/tabletop/tabletop-manifest';

afterAll(() => { rmSync(OUT, { recursive: true, force: true }); closeDb(); });

// The door: create_game with `tabletop` mints a board game against the computer, its own page, no store or levels.
describe('create_game — a board game (tabletop)', () => {
  it('mints chess from the book as a game row its page regenerates from', async () => {
    const out = await createGameHandler({ title: 'Chess', tabletop: { game: 'chess', level: 'hard', clock: { base: 300, inc: 2 } }, ref: 'tt_chess' });
    expect(out).toMatchObject({ ok: true, ref: 'tt_chess', engine: 'tabletop', game: 'chess', playUrl: '/api/sketches/tt_chess/game' });
    const row = SketchRepository.getByRef('tt_chess');
    expect(row.manifest).toEqual({ kind: 'game', engine: 'tabletop', title: 'Chess', tabletop: { game: 'chess', level: 'hard', clock: { base: 300, inc: 2 } } });
    const html = emitTabletopGame(row.manifest, { title: row.title });
    expect(html).toContain('<title>Chess</title>');
    expect(html).toBe(emitTabletopGame(row.manifest, { title: row.title }));
  });

  it('a published game is not in the book; a game written out is', async () => {
    await expect(createGameHandler({ title: 'Island', tabletop: { game: 'settlers' } })).rejects.toThrow(/no game 'settlers'/);
    const tiny = {
      board: { shape: 'hex', radius: 2 },
      players: [{ id: 'a', facing: 'N' }, { id: 'b', facing: 'S' }],
      pieces: { R: { value: 1, glyph: 'R', rules: [{ vec: 'E', range: 'any' }] } },
      setup: { a: { R: ['C1'] }, b: { R: ['C5'] } },
    };
    const w = await createGameHandler({ title: 'Hex rooks', tabletop: { game: tiny } });
    expect(w.game).toBe('written out');
  });

  it('refuses a mix with a level game, and a game it cannot play', async () => {
    await expect(createGameHandler({ title: 'x', tabletop: { game: 'chess' }, levels: [] })).rejects.toThrow(/has no levels/);
    await expect(createGameHandler({ title: 'x', tabletop: { game: 'go' } })).rejects.toThrow(/no game 'go'/);
    await expect(createGameHandler({ title: 'x', tabletop: 'chess' })).rejects.toThrow(/tabletop is \{ game/);
  });

  it('update_sketch keeps a board game a board game: an edit is checked by the kernel', async () => {
    await createGameHandler({ title: 'Checkers', tabletop: { game: 'checkers' }, ref: 'tt_checkers' });
    const m = SketchRepository.getByRef('tt_checkers').manifest;
    await updateSketchHandler({ ref: 'tt_checkers', manifest: { ...m, tabletop: { ...m.tabletop, level: 'easy' } } });
    expect(SketchRepository.getByRef('tt_checkers').manifest.tabletop.level).toBe('easy');
    await expect(updateSketchHandler({ ref: 'tt_checkers', manifest: { ...m, tabletop: { game: 'checkers', human: 'green' } } })).rejects.toThrow(/Invalid board game/);
  });

  it('export_game writes the one page and its recipe', async () => {
    const out = await exportGameHandler({ ref: 'tt_chess' });
    expect(out).toMatchObject({ ok: true, engine: 'tabletop' });
    expect(out.files.map((f) => f.file).sort()).toEqual(['README.md', 'game.html', 'recipe/game.json']);
    expect(readFileSync(path.join(out.dir, 'README.md'), 'utf8')).toContain('engine: tabletop');
  });

  it('get_game_vocab serves the board games\' card: the keys, the grammar, the book\'s own pieces', async () => {
    const { card } = await getGameVocabHandler({ id: 'tabletop' });
    expect(card.body).toContain('tabletop: { game');
    expect(card.body).toContain('ask the person to explain its rules');
    expect(card.body).toContain('trade: { offers?, shapes? }');
    expect(card.body).toContain('"N":[{"vec":[1,2]}]');
    await expect(getGameVocabHandler({ id: 'tabletops' })).rejects.toThrow(/Known: .*tabletop/);
  });
});
