process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';

import { createPixelizerGameHandler } from './pixelizer-game.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { emitPixelizerGame } from '@/lib/graph/pixelizer/pixelizer-games.js';

describe('create_pixelizer_game', () => {
  it('mints a brickster row in the game bucket with play + arcade URLs', async () => {
    const res = await createPixelizerGameHandler({ reducer: 'brickster' });
    expect(res.ok).toBe(true);
    expect(res.reducer).toBe('brickster');
    expect(res.playUrl).toBe(`/api/sketches/${res.ref}/game`);
    expect(res.arcadeUrl).toBe(`/arcade/${res.ref}`);
    const row = SketchRepository.getByRef(res.ref);
    expect(row.bucket).toBe('game'); // → arcade feed + Maker gallery
    expect(row.manifest).toMatchObject({ kind: 'game', engine: 'pixelizer', reducer: 'brickster', music: true });
    expect(row.manifest.menu.tagline).toBeTruthy();
  });

  it('rejects an unknown reducer with a teaching error', async () => {
    await expect(createPixelizerGameHandler({ reducer: 'nope' })).rejects.toThrow(/must be one of/);
    await expect(createPixelizerGameHandler({})).rejects.toThrow(/must be one of/);
  });

  it('honors title / tagline / music overrides and a stable ref', async () => {
    const res = await createPixelizerGameHandler({
      reducer: 'brickster', title: 'Blocks', tagline: 'stack em', music: false, ref: 'sk_test_bk',
    });
    expect(res.ref).toBe('sk_test_bk');
    const m = SketchRepository.getByRef('sk_test_bk').manifest;
    expect(m.title).toBe('Blocks');
    expect(m.menu.tagline).toBe('stack em');
    expect(m.music).toBe(false);
  });

  it('the minted manifest resolves to a served shell via emitPixelizerGame', () => {
    const html = emitPixelizerGame({ kind: 'game', engine: 'pixelizer', reducer: 'brickster', music: true });
    expect(html).toContain('<title>');
    expect(html).toContain('id="game"'); // the world-raster mount
  });

  it('emitPixelizerGame refuses a reducer with no served shell', () => {
    expect(() => emitPixelizerGame({ reducer: 'ghost' })).toThrow(/no served shell/);
  });

  it('mints philosophers-stone (the match-3) into the arcade and serves its shell', async () => {
    const res = await createPixelizerGameHandler({ reducer: 'philosophers-stone' });
    expect(res.ok).toBe(true);
    const row = SketchRepository.getByRef(res.ref);
    expect(row.bucket).toBe('game');
    expect(row.manifest).toMatchObject({ kind: 'game', engine: 'pixelizer', reducer: 'philosophers-stone', register: '32bit' });
    const html = emitPixelizerGame(row.manifest);
    expect(html).toContain('id="game"');
    expect(html).toContain('Alchemist'); // the timed-mode toggle is present
  });
});
