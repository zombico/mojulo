// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchRevisionRepository, REVISIONED_KINDS } from '@/lib/db/repositories/sketch-revisions';
import { createLayeredHandler } from './layered.js';
import { updateSketchHandler } from './sketches.js';
import { pinBase, verifyBase, revisionLookup } from '@/lib/graph/gameworld/index';

// The character book pins the hero's bare base as a revision: motion and adornment branch from it and never overwrite
// it. That needs the layered kind to keep history, as the other solid kinds do; it changes no render bytes.
beforeEach(() => { closeDb(); });

const body = {
  layer: 1, closure: 'closed', slots: ['top', 'sideR', 'bottom', 'sideL'], group: 'Body',
  stations: [
    { id: 'st0', points: { top: [0, 0, 1], sideR: [1, 0, 0.5], bottom: [0, 0, 0], sideL: [-1, 0, 0.5] } },
    { id: 'st1', points: { top: [0, 1, 1], sideR: [1, 1, 0.5], bottom: [0, 1, 0], sideL: [-1, 1, 0.5] } },
  ],
  caps: { back: [0, -0.5, 0.5], tip: [0, 1.5, 0.5] },
};
const recipe = {
  frame: { up: '+z', front: '+y' },
  dials: { lift: { min: 0, max: 1, rest: 0, op: 'offset', axis: 'z', slots: ['top'], parts: ['body'], blend: { st0: 1, st1: 1 } } },
  parts: { body },
};

describe('a layered row keeps its history', () => {
  it('the layered kind is revisioned', () => {
    expect(REVISIONED_KINDS.has('layered')).toBe(true);
  });

  it('a hero patch writes rev+1, and the base revision still reads its pinned manifest', async () => {
    await createLayeredHandler({ recipe, ref: 'lay-base' });
    const base = SketchRepository.getByRef('lay-base').manifest;
    expect(SketchRevisionRepository.list('lay-base')).toEqual([]); // rev 1 is written lazily, at the first edit

    const r1 = await updateSketchHandler({ ref: 'lay-base', patch: [{ op: 'set', path: '/dials/lift', value: 0.2 }] });
    expect(r1.revision).toEqual({ archived_rev: 1, head_rev: 2 });
    const r2 = await updateSketchHandler({ ref: 'lay-base', patch: [{ op: 'set', path: '/dials/lift', value: 0.4 }] });
    expect(r2.revision).toEqual({ archived_rev: 2, head_rev: 3 });

    // the pinned base is the mint manifest, untouched by either edit; the row is HEAD
    expect(SketchRevisionRepository.get('lay-base', 1).manifest).toEqual(base);
    expect(SketchRevisionRepository.get('lay-base', 2).manifest.dials.lift).toBeDefined();
    expect(SketchRepository.getByRef('lay-base').manifest).not.toEqual(base);
  });

  it('a pinned base verifies against the real archive across edits, and a hand-edited head reads as drifted when pinned', async () => {
    await createLayeredHandler({ recipe, ref: 'lay-pin' });
    const pin = pinBase({ ref: 'lay-pin', rev: 1, manifest: SketchRepository.getByRef('lay-pin').manifest });
    const lookup = () => {
      const head = SketchRevisionRepository.list('lay-pin').length + 1;
      return revisionLookup({ ref: 'lay-pin', headRev: head, head: SketchRepository.getByRef('lay-pin').manifest, get: (r, rev) => SketchRevisionRepository.get(r, rev)?.manifest ?? null });
    };
    expect(verifyBase(pin, lookup()).status).toBe('pinned'); // rev 1 is HEAD: the row itself
    await updateSketchHandler({ ref: 'lay-pin', patch: [{ op: 'set', path: '/dials/lift', value: 0.3 }] });
    expect(verifyBase(pin, lookup()).status).toBe('pinned'); // rev 1 is now archived, and unchanged
    expect(verifyBase({ ...pin, rev: 2 }, lookup()).status).toBe('drifted'); // HEAD is not the base
  });

  it('a title-only edit writes no revision', async () => {
    await createLayeredHandler({ recipe, ref: 'lay-title' });
    const r = await updateSketchHandler({ ref: 'lay-title', title: 'renamed' });
    expect(r.revision).toBeUndefined();
    expect(SketchRevisionRepository.list('lay-title')).toEqual([]);
  });
});
