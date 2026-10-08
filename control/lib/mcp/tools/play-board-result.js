/**
 * The UI board in a tool's answer: when create_sketch / update_sketch leaves a world whose play block carries a UI
 * direction, the answer carries the board as an image and the gate's next move — show the operator, take each item's
 * approval or send the guide or the motion back (art-board-result.js is the model). The board is the HTML page
 * (playscape/ui/board-html.js) laid out by a browser already on the machine; without one, the readout in words. It
 * never fails the mint. Any other result passes through untouched.
 */
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { uiBoardPagePng, boardPieceIds } from '@/lib/graph/playscape/ui/board-html.js';
import { uiPending } from '@/lib/graph/playscape/ui/direction.js';
import { uiAdvice } from '@/lib/graph/playscape/ui/laws.js';
import { withoutChromiumFetch } from '@/lib/graph/scene/chromium-consent';

const patchFor = (path, value) => `{ op: 'set', path: '${path}', value: ${JSON.stringify(value)} }`;

export function playReadout(manifest) {
  const u = manifest.play.ui, pending = uiPending(u), g = u.guide;
  const advice = uiAdvice(manifest.play, u, { entities: Array.isArray(manifest.entities) ? manifest.entities : null });
  return {
    play_ui: {
      register: g.register, stop: g.stop, dials: g.dials, font: g.font, tokens: g.tokens, sources: g.sources,
      status: u.status, pieces: boardPieceIds(manifest),
      ...(pending.length ? { pending } : {}), ...(advice.length ? { advice } : {}),
    },
    next: pending.length
      ? `UI direction gate: show the operator the board (the image) and ask, item by item (${pending.join(', ')}). `
        + `Approve one: update_sketch({ ref, patch: [${patchFor('/play/ui/status/<item>', 'approved')}] }). `
        + `Send the guide or the motion back: ${patchFor('/play/ui/<item>', 'reroll')}; parts, layout and wireframes follow play.parts and play.phases. `
        + 'Until every item is approved the page draws this UI in greybox; hands off is play.ui: \'auto\'.'
      : 'UI direction settled: the page draws the UI from this guide; open the url to see it.',
  };
}

/** Wrap a sketch handler so a world with a UI direction answers with its board. */
export function withPlayBoard(handler) {
  return async (input) => {
    const result = await handler(input);
    if (!result || !result.ref) return result;
    const row = SketchRepository.getByRef(result.ref), m = row && row.manifest;
    if (!m || !m.play || !m.play.ui || typeof m.play.ui !== 'object' || !m.play.ui.guide) return result;
    const body = { ...result, ...playReadout(m) };
    try {
      const png = await withoutChromiumFetch(() => uiBoardPagePng({ ...m, title: row.title }));
      return { content: [{ type: 'text', text: JSON.stringify(body) }, { type: 'image', data: png.toString('base64'), mimeType: 'image/png' }] };
    } catch {
      return { ...body, board: 'not drawn: no browser on this machine; describe the direction from play_ui in words instead' };
    }
  };
}
