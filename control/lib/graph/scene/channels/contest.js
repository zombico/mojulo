// meet channel: an athletic meet on the world (lib/graph/contest). Opt-in on a world's `meet` key (a track stage:
// contest/meet-arena.js); absent, it adds nothing to the page.
//
// One block, so none of the meet's names reach the page's scope: the pure modules (the contest kernel, the meet sim)
// inlined by stripping their imports and exports, then the browser runtime (the pads, the step at 60 Hz, the runners
// drawn, the camera, the overlay, the hosted wire). It hands the page its frame step through `stepContest` (a let the
// page declares when the block is present) and publishes `window.__mojMeet` for probes. It owns the camera
// (`__ctrlOwnsCamera`), so a track carries no pilot.
//
// cfg: meetArenaData's (contest/meet-arena.js): { event, lanes, players, register, track, C, wire, … }

import { safeJson } from '../emit-util.js';
import { contestSource } from '../../contest/meet-arena.js';

export const MEET_PAGE_MODULES = Object.freeze(['contest-kernel.js', 'meet-sim.js', 'meet-arena.client.js']);

export function meetChannelScript(cfg) {
  const lib = MEET_PAGE_MODULES.map(contestSource).join('\n');
  return `
// ── meet: the athletic event on this track ──
{
const MEET_ARENA = ${safeJson(cfg)};
${lib}
stepContest = stepMeetArena;
}`;
}
