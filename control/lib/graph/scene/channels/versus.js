// versus channel: a side-view fight on the world (lib/graph/versus). Opt-in on a world's `versus` key (an arena:
// versus/versus-arena.js); absent, it adds nothing to the page.
//
// One block, so none of the fight's names reach the page's scope: the pure modules (rig, library, compile, input,
// core, cpu, and the skin that poses a character's own body) inlined by stripping their imports and exports, the
// browser runtime (input, the CPU's pads, the match step, the overlay), and the arena adapter (bodies in the scene,
// the camera, the level wire). It hands the page its frame step through `stepFight` (a let the page declares when the
// block is present) and publishes `window.__mojVersus` for probes. It owns the camera (`__ctrlOwnsCamera`), so an arena carries no pilot.
//
// cfg: { plane, half, floor?, roster: [{ id, name, color, archetype, recipe, character? }], rules?, wire: { ready, init,
//        outcome, version }, bodies?: { <character ref>: { bones, parts } } } (versus-page.js versusArenaData)

import { safeJson } from '../emit-util.js';
import { versusSource, VERSUS_PAGE_MODULES } from '../../versus/versus-page.js';

export function versusChannelScript(cfg) {
  const lib = [...VERSUS_PAGE_MODULES, 'versus-skin.js', 'versus-runtime.client.js', 'versus-arena.client.js'].map(versusSource).join('\n');
  return `
// ── versus: the fight on this arena ──
{
const VERSUS_ARENA = ${safeJson(cfg)};
${lib}
stepFight = stepArenaFight;
}`;
}
