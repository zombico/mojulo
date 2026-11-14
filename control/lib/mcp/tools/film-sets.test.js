// Isolate to an in-memory SQLite and a scratch outcomes folder — before any import that pulls in db/index.js.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
process.env.MOJULO_OUTCOMES_DIR = path.join(mkdtempSync(path.join(tmpdir(), 'film-sets-')), 'outcomes');

import { describe, it, expect, vi } from 'vitest';
import { SketchRepository } from '@/lib/db/repositories/sketches';

// (the geocube's own mint makes a whole world: here it is a stub that keeps the recipe and what its words read, so the
//  film's side of a location in words is tested without one)
const minted = [];
vi.mock('@/lib/mcp/tools/sketch-mint.js', () => {
  const brief = (m) => (m.words !== undefined ? { brief: { read: m.words.split(' ').filter((w) => w !== 'dragon').map((word) => ({ word, decides: [] })), unread: m.words.split(' ').filter((w) => w === 'dragon') } } : {});
  return {
    createSketchHandler: async ({ title, manifest }) => { const row = SketchRepository.create({ title, manifest: { ...manifest, ...brief(manifest) } }); minted.push(['made', row.ref]); return { ok: true, ref: row.ref }; },
    updateSketchHandler: async ({ ref, manifest }) => { SketchRepository.update({ ref, manifest: { ...manifest, ...brief(manifest) } }); minted.push(['remade', ref]); return { ok: true, ref }; },
  };
});
const { forgeMotionHandler } = await import('./motion.js');
const { filmErrors, sceneScreenplay, setRef } = await import('@/lib/graph/film/film.js');
const { filmOfOrder, orderErrors } = await import('@/lib/graph/film/order.js');

const film = (arg) => forgeMotionHandler({ film: arg });
const FILM = (sets) => ({ title: 'By the lake', cast: { ana: {}, ben: {} }, sets, scenes: [{ id: 'meet', set: Object.keys(sets)[0], cast: { ana: {}, ben: {} }, script: 'ANA: Ready?\nBEN: Ready.' }] });

describe('a set asked for', () => {
  it('is a sentence, or a geocube preset and how it is laid; a ref is as it was', () => {
    expect(filmErrors(FILM({ lake: { words: 'a field by a lake', seed: 3 } }))).toEqual([]);
    expect(filmErrors(FILM({ town: { cube: 'valley-morning', show: 'geotown' } }))).toEqual([]);
    expect(filmErrors(FILM({ here: 'sk_world' }))).toEqual([]);
    expect(filmErrors(FILM({ lake: {} })).join()).toMatch(/say the place in words/);
    expect(filmErrors(FILM({ lake: { words: 'x', colour: 'red' } })).join()).toMatch(/takes words, cube, show.*not colour/);
    expect(filmErrors(FILM({ lake: { words: 'x', seed: 1.5 } })).join()).toMatch(/seed: a whole number/);
    // a place not made yet plays on no world; made, on the place the film made of it
    expect(sceneScreenplay(FILM({ lake: { words: 'x' } }), 'meet').world_ref).toBeUndefined();
    expect(sceneScreenplay(FILM({ lake: { words: 'x', ref: 'sk_made' } }), 'meet').world_ref).toBe('sk_made');
    expect(setRef('sk_w')).toBe('sk_w');
  });

  it('is made once by the film, kept as the film is edited, and remade in place when it is asked for differently', async () => {
    const out = await film({ write: FILM({ lake: { words: 'a field by a lake with a dragon', seed: 3 } }) });
    expect(out.did).toEqual(['made the set lake', 'written']);
    const kept = SketchRepository.getByRef(out.ref).manifest.film.sets.lake;
    expect(kept).toMatchObject({ words: 'a field by a lake with a dragon', seed: 3 });
    expect(SketchRepository.getByRef(kept.ref).manifest).toMatchObject({ kind: 'geocube', words: 'a field by a lake with a dragon', seed: 3 });
    // the readout says what the words read, and advises the one nothing read, in the set department
    expect(out.sets).toEqual([expect.objectContaining({ id: 'lake', ref: kept.ref, asked: 'a field by a lake with a dragon', unread: ['dragon'] })]);
    expect(out.advice.find((a) => a.id === 'words-unread')).toMatchObject({ set: 'lake', department: 'set' });
    // an edit elsewhere makes nothing
    const edited = await film({ ref: out.ref, patch: [{ op: 'set', path: '/scenes/0/script', value: 'ANA: Now?\nBEN: Now.' }] });
    expect(edited.did).toEqual(['patched']);
    // the same film written again finds the place it made
    expect((await film({ ref: out.ref, write: FILM({ lake: { words: 'a field by a lake with a dragon', seed: 3 } }) })).did).toEqual(['rewritten']);
    // asked for differently: the same world, changed in place
    const again = await film({ ref: out.ref, patch: [{ op: 'set', path: '/sets/lake/words', value: 'a field by a lake' }] });
    expect(again.did).toEqual(['remade the set lake', 'patched']);
    expect(again.sets[0]).toMatchObject({ ref: kept.ref, unread: [] });
    expect(again.advice.some((a) => a.id === 'words-unread')).toBe(false);
    expect(minted).toEqual([['made', kept.ref], ['remade', kept.ref]]);
  });

  it('an order\'s place may be asked for the same way', () => {
    const O = { cast: { ana: {} }, places: { lake: { words: 'a field by a lake' }, town: 'sk_town' }, events: [{ id: 'one', place: 'lake', notes: 'Ana waits.' }] };
    expect(orderErrors(O)).toEqual([]);
    const F = filmOfOrder(O);
    expect(F.sets).toEqual(O.places);
    expect(filmErrors(F)).toEqual([]);
    expect(orderErrors({ ...O, places: { lake: 7 } }).join()).toMatch(/a place asked for/);
  });
});
