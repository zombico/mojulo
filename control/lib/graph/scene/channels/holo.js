// holo channel: a board game lifted into a hologram arena on the world (lib/graph/tabletop holo-arena.js). Opt-in on a
// world's `holo` key (an arena stage: tabletop/holo-arena.js); absent, it adds nothing to the page.
//
// One block, so none of the arena's names reach the page's scope: the tabletop kernel and its mind, each built from its
// closure's source (the referee and the computer across the table, the same code Node plays), then the arena's client
// (the projected board, the holograms, the beats, the life points, the pads, the hosted wire). It hands the page its
// frame step through `stepHolo` (a let the page declares when the block is present) and publishes `window.__mojHolo`
// for probes. It owns the camera (`__ctrlOwnsCamera`), so an arena carries no pilot.
//
// cfg: holoArenaData's (tabletop/holo-arena.js): { game, players, level, seed, G, L, board, kinds, duelists, wire, … }

import { safeJson } from '../emit-util.js';
import { buildTabletop } from '../../tabletop/tabletop-kernel.js';
import { buildTabletopMind } from '../../tabletop/tabletop-mind.js';
import { holoClientSource } from '../../tabletop/holo-arena.js';

export function holoChannelScript(cfg) {
  return `
// ── holo: the board game in its hologram arena ──
{
const HOLO_ARENA = ${safeJson(cfg)};
const HOLO_T = (${buildTabletop.toString()})();
const HOLO_M = (${buildTabletopMind.toString()})(HOLO_T);
${holoClientSource()}
stepHolo = stepHoloArena;
}`;
}
