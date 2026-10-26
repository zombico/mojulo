/**
 * The `stadium` world base — reached through compose_world({ base: 'stadium' }), no tool of its own. A sport's venue
 * from a few words (stadium/stadium.js): a Mojulo Olympics preset and any word over it, the field the preset's or the
 * given one. A game's arena stands in one by its own `venue` word instead (stadium/venue.js). The manual is the
 * view-vocab card `stadium` (family world).
 */
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { readStadium } from '@/lib/graph/stadium/stadium-words.js';

const WORDS = ['field', 'preset', 'palette', 'look', 'time', 'ground', 'livery', 'colours', 'bowl', 'masts', 'skyline', 'camera', 'seed'];

export function mintStadium({ title = 'mojulo stadium', ref, folderRef, ...params } = {}) {
  const manifest = { kind: 'stadium', ...Object.fromEntries(WORDS.filter((k) => params[k] !== undefined).map((k) => [k, params[k]])), ...(title ? { title } : {}) };
  try { readStadium(manifest); } catch (e) { throw new Error(`${e.message}. Manual: get_view_vocab({ id: 'stadium' }).`); }
  const sketch = SketchRepository.create({ title, manifest, ref, folderRef: folderRef ?? null });
  const enc = encodeURIComponent(sketch.ref);
  return { ok: true, ref: sketch.ref, url: `/sketches/${enc}`, worldUrl: `/api/sketches/${enc}/world`, recipe: manifest };
}
