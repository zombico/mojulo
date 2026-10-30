// A geocube's trail (era/geocube.js show 'trail') draws its own seed at mint, as a new house does, so no two mints show
// the same island; a seed given, and the cube's other specimens, are left as written.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-trail-'));

import { describe, expect, it } from 'vitest';
import { createSketchHandler } from './sketch-mint.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';

const mint = async (ref, m) => SketchRepository.getByRef((await createSketchHandler({ title: ref, ref, manifest: { kind: 'geocube', cube: 'island-noon', ...m } })).ref).manifest;

describe('a geocube trail at mint', () => {
  it('draws its seed from its ref; a seed given and the land are kept as written', async () => {
    const a = await mint('sk_trail_a', { show: 'trail' });
    const b = await mint('sk_trail_b', { show: 'trail' });
    expect(Number.isInteger(a.seed) && a.seed > 0).toBe(true);
    expect(a.seed).not.toBe(b.seed);
    expect((await mint('sk_trail_given', { show: 'trail', seed: 7 })).seed).toBe(7);
    expect((await mint('sk_trail_land', { show: 'land' })).seed).toBeUndefined();
    // a micro-town draws its own too: a new street every mint, and a path a new way through the land
    expect(Number.isInteger((await mint('sk_town_a', { show: 'town' })).seed)).toBe(true);
    expect(Number.isInteger((await mint('sk_path_a', { show: 'path' })).seed)).toBe(true);
  }, 120_000);
});

describe('a scene asked in words, at mint', () => {
  const scene = async (ref, m) => SketchRepository.getByRef((await createSketchHandler({ title: ref, ref, manifest: { kind: 'geocube', ...m } })).ref).manifest;
  it('reads the words into the keys; a key written beside them is kept', async () => {
    const m = await scene('sk_scene_field', { words: 'A colorful grassy field in the daytime' });
    expect(m).toMatchObject({ show: 'path', hour: 'noon', cube: { from: 'island-noon', outside: { cliff: false }, biocube: { from: 'meadow', flora: { flowers: { share: 0.4 } } } } });
    expect(m.brief.unread).toEqual([]);
    // the color theorist stamps the cube the words named
    expect(Number.isInteger(m.cube.palette.seed)).toBe(true);
    expect((await scene('sk_scene_dawn', { words: 'a grassy field in the daytime', hour: 'dawn' })).hour).toBe('dawn');
  }, 120_000);

  it('new words read again; a key the edit changed stands; the same cube keeps its colours', async () => {
    const before = await scene('sk_scene_edit', { words: 'a grassy field' });
    const { updateSketchHandler } = await import('./sketch-mint.js');
    await updateSketchHandler({ ref: 'sk_scene_edit', manifest: { ...before, words: 'a grassy field at dusk, snowy' } });
    const after = SketchRepository.getByRef('sk_scene_edit').manifest;
    expect(after).toMatchObject({ hour: 'dusk', cube: { snow: true } });
    expect(after.cube.palette.seed).toBe(before.cube.palette.seed);
  }, 120_000);

  it('is drawn in the seventh generation when new: its cube\'s era gen-7, unless the cube names one; an edit keeps the row\'s', async () => {
    expect((await scene('sk_scene_g7', { words: 'a meadow path in the morning' })).cube.era).toBe('gen-7');
    expect((await scene('sk_scene_preset', { cube: 'island-noon', show: 'path' })).cube).toMatchObject({ from: 'island-noon', era: 'gen-7' });
    // (a cube that names its era keeps it; a room is not a scene's show)
    expect((await scene('sk_scene_g6', { cube: { from: 'island-noon', era: 'gen-6' }, show: 'path' })).cube.era).toBe('gen-6');
    expect((await scene('sk_scene_room', { cube: 'island-noon', show: 'room' })).cube.era).toBeUndefined();
    // (a scene restored from its export carries its seed: it comes back in the era it was drawn in)
    expect((await scene('sk_scene_restored', { cube: 'island-noon', show: 'path', seed: 41 })).cube.era).toBeUndefined();
    const { updateSketchHandler } = await import('./sketch-mint.js');
    const g6 = await scene('sk_scene_keep', { cube: { from: 'island-noon', era: 'gen-6' }, show: 'path' });
    await updateSketchHandler({ ref: 'sk_scene_keep', manifest: { ...g6, hour: 'dusk' } });
    expect(SketchRepository.getByRef('sk_scene_keep').manifest.cube.era).toBe('gen-6');
  }, 120_000);
});
