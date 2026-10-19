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
    expect(res.arcadeUrl).toBe('/play');
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

  it('mints stone-saga: its map on the recipe (seeded by its title unless named), served as the map and the levels', async () => {
    const res = await createPixelizerGameHandler({ reducer: 'stone-saga', title: 'Mercury Run' });
    const m = SketchRepository.getByRef(res.ref).manifest;
    expect(m).toMatchObject({ engine: 'pixelizer', reducer: 'stone-saga', saga: { levels: 30 } });
    expect(Number.isInteger(m.saga.seed)).toBe(true);
    const other = SketchRepository.getByRef((await createPixelizerGameHandler({ reducer: 'stone-saga', title: 'Lead Road' })).ref).manifest;
    expect(other.saga.seed).not.toBe(m.saga.seed);   // two names, two maps
    const named = SketchRepository.getByRef((await createPixelizerGameHandler({ reducer: 'stone-saga', saga: { seed: 7, levels: 12 } })).ref).manifest;
    expect(named.saga).toEqual({ seed: 7, levels: 12 });
    const html = emitPixelizerGame(m);
    expect(html).toContain('<div id="map">');
    expect(html).toContain('function sagaStep(state, action)');
    expect(html).toContain('function swipeOf(dx, dy, ms, opts)');
    await expect(createPixelizerGameHandler({ reducer: 'brickster', saga: { levels: 3 } })).rejects.toThrow(/saga is the map of a saga reducer/);
    await expect(createPixelizerGameHandler({ reducer: 'stone-saga', saga: { levels: 0 } })).rejects.toThrow(/levels is 1 to 99/);
  });

  it('philosophers-stone without a saga carries none of it', async () => {
    const res = await createPixelizerGameHandler({ reducer: 'philosophers-stone' });
    const html = emitPixelizerGame(SketchRepository.getByRef(res.ref).manifest);
    expect(html).not.toMatch(/sagaStep|swipeOf|id="map"/);
  });
});
