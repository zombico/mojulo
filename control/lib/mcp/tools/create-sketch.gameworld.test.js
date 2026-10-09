// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createSketchHandler, updateSketchHandler } from './sketches.js';
import { MEADOWMARK_HERO, approveCharacter, characterReady, gameworldOf, characterBibleHtml } from '@/lib/graph/gameworld/index';
import { sketchRenderMode, classifyBucket } from '@/lib/graph/sketch/sketch-manifest';

// A gameworld is a sketch: stored as written, read by the gameworld reader on every mint and update, iterated in
// place; an approval is a patch on its review.
beforeEach(() => { closeDb(); });

const manifest = { kind: 'gameworld', ...MEADOWMARK_HERO };

describe('the gameworld kind', () => {
  it('mints as written and round-trips byte-identical; read as a bible, never the Arcade', async () => {
    const r = await createSketchHandler({ title: 'Meadowmark', manifest, ref: 'gw-meadow' });
    expect(r.ok).toBe(true);
    const stored = SketchRepository.getByRef('gw-meadow').manifest;
    expect(JSON.stringify(stored)).toBe(JSON.stringify(manifest));
    await updateSketchHandler({ ref: 'gw-meadow', manifest: stored });
    expect(JSON.stringify(SketchRepository.getByRef('gw-meadow').manifest)).toBe(JSON.stringify(manifest));
    expect(sketchRenderMode(stored)).toBe('bible');
    expect(classifyBucket(stored)).not.toBe('game');
    expect(gameworldOf(stored)).not.toHaveProperty('kind');
    expect(characterBibleHtml(gameworldOf(stored))).toBe(characterBibleHtml(MEADOWMARK_HERO));
  });

  it('a bad recipe is refused with the reader\'s own teaching message, at mint and at update', async () => {
    await expect(createSketchHandler({ title: 'x', manifest: { ...manifest, weather: 'rain' }, ref: 'gw-bad' }))
      .rejects.toThrow(/Invalid manifest: gameworld: 'weather' is not a world setting/);
    await createSketchHandler({ title: 'Meadowmark', manifest, ref: 'gw-meadow' });
    await expect(updateSketchHandler({ ref: 'gw-meadow', patch: [{ op: 'set', path: '/equipment/classes/lance', value: null }] }))
      .rejects.toThrow(/'lance' is not a class of gear/);
  });

  it('an approval is a patch on the review, and the next step opens', async () => {
    await createSketchHandler({ title: 'Meadowmark', manifest, ref: 'gw-meadow' });
    expect(characterReady(MEADOWMARK_HERO).adornment.ready).toBe(false);
    let world = MEADOWMARK_HERO;
    for (const part of ['hero:base', 'hero:actions']) {
      const review = approveCharacter(world, part);
      await updateSketchHandler({ ref: 'gw-meadow', patch: [{ op: 'set', path: '/review', value: review }] });
      world = gameworldOf(SketchRepository.getByRef('gw-meadow').manifest);
    }
    expect(world.review['hero:base'].status).toBe('approved');
    expect(characterReady(world).adornment.ready).toBe(true);
  });
});
