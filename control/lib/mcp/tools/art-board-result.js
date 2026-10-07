/**
 * The art board in a tool's answer: when create_sketch / update_sketch leaves a room stage carrying an art direction,
 * the answer carries the board as an image (era/art-board.js, rasterized by sharp) and the gate's next move — show
 * the operator, take each item's approval or send it back. Without sharp the answer says so and still carries the
 * readout; it never fails the mint. Any other result passes through untouched.
 */
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { artBoardPng } from '@/lib/graph/era/art-board.js';
import { ART_ITEMS } from '@/lib/graph/era/art-direction.js';

const patchFor = (path, value) => `{ op: 'set', path: '${path}', value: ${JSON.stringify(value)} }`;

export function artReadout(manifest) {
  const a = manifest.art, status = a.status || {};
  const pending = ART_ITEMS.filter((k) => status[k] === 'proposed');
  return {
    art: { stone: a.palette && a.palette.family, status, ...(pending.length ? { pending } : {}) },
    next: pending.length
      ? `Art direction gate: show the operator the board (the image) and ask, item by item (${pending.join(', ')}). `
        + `Approve one: update_sketch({ ref, patch: [${patchFor('/art/status/<item>', 'approved')}] }). `
        + `Send one back: ${patchFor('/art/<item>', 'reroll')} rolls it afresh (plan: edit rooms/links instead), or set its numbers. `
        + 'The level is already built from this direction and follows every edit; hands off is art: \'auto\'.'
      : 'Art direction settled: the level is built from it; open the url to walk it.',
  };
}

/** Wrap a sketch handler so a stage with `art` answers with its board. */
export function withArtBoard(handler) {
  return async (input) => {
    const result = await handler(input);
    if (!result || !result.ref) return result;
    const row = SketchRepository.getByRef(result.ref), m = row && row.manifest;
    if (!m || m.kind !== 'stage' || !m.art || typeof m.art !== 'object') return result;
    const body = { ...result, ...artReadout(m) };
    try {
      const png = await artBoardPng({ ...m, title: row.title });
      return { content: [{ type: 'text', text: JSON.stringify(body) }, { type: 'image', data: png.toString('base64'), mimeType: 'image/png' }] };
    } catch (err) {
      if (err && err.code !== 'SHARP_UNAVAILABLE') throw err;
      return { ...body, board: 'not drawn: the image library (sharp) is not installed; describe the direction from `art` in words instead' };
    }
  };
}
