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
import { graphSource, COURT_PAGE_MODULES } from '../../contest/match-arena.js';
import { TURNS_PAGE_MODULES } from '../../contest/turn-arena.js';
import { PITCH_PAGE_MODULES } from '../../contest/team-arena.js';

export const MEET_PAGE_MODULES = Object.freeze(['contest-kernel.js', 'meet-sim.js', '../broadcast/broadcast.client.js', 'meet-arena.client.js']);

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

// court channel: a net game on the world (lib/graph/contest match-sim.js). Opt-in on a world's `court` key (a court
// stage: contest/match-arena.js); absent, it adds nothing. One block: the ball's flight, the ball card, the swing
// system, the hit, the physics integrator, the contest kernel, the court mind and the match sim inlined by source, then
// the browser runtime; it hands the page `stepCourt` and publishes `window.__mojCourt`. It owns the camera.
export function courtChannelScript(cfg) {
  const lib = COURT_PAGE_MODULES.map(graphSource).join('\n');
  return `
// ── court: the net game on this court ──
{
const COURT_ARENA = ${safeJson(cfg)};
${lib}
stepCourt = stepCourtArena;
}`;
}

// turns channel: a turn sport on the world (lib/graph/contest turn-sim.js: golf, bowling). Opt-in on a world's `turns`
// key (a course stage: contest/turn-arena.js); absent, it adds nothing. One block as the court's: the same physics and
// hit modules, the kernel, the minds and the turn sim inlined by source, then the browser runtime; it hands the page
// `stepTurnSport` and publishes `window.__mojTurns`. It owns the camera.
export function turnsChannelScript(cfg) {
  const lib = TURNS_PAGE_MODULES.map(graphSource).join('\n');
  return `
// ── turns: the turn sport on this course ──
{
const TURNS_ARENA = ${safeJson(cfg)};
${lib}
stepTurnSport = stepTurnsArena;
}`;
}

// pitch channel: a team goal game on the world (lib/graph/contest team-sim.js: soccer, hockey). Opt-in on a world's
// `pitch` key (a pitch stage: contest/team-arena.js); absent, it adds nothing. One block as the court's: the same
// physics and hit modules, the kernel, the minds and the team sim inlined by source, then the browser runtime; it hands
// the page `stepPitch` and publishes `window.__mojPitch`. It owns the camera.
export function pitchChannelScript(cfg) {
  const lib = PITCH_PAGE_MODULES.map(graphSource).join('\n');
  return `
// ── pitch: the team goal game on this pitch ──
{
const PITCH_ARENA = ${safeJson(cfg)};
${lib}
stepPitch = stepPitchArena;
}`;
}
