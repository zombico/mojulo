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

export const MEET_PAGE_MODULES = Object.freeze(['contest-kernel.js', 'meet-sim.js', 'meet-arena.client.js']);

// A sport whose arena carries its athletes' bodies (contest/athletes.js) inlines the figure that poses them before the
// arena's client: the versus rig and figure (the segments a bone rides), the athlete's pose and its meshes. Without
// bodies none of it is added, and the arena draws its stick figures.
export const ATHLETE_PAGE_MODULES = Object.freeze(['versus/versus-rig.js', 'versus/versus-figure.js', 'contest/athlete-pose.js', 'contest/athlete.client.js']);
const athleteLib = (cfg) => (cfg && cfg.bodies ? `${ATHLETE_PAGE_MODULES.map(graphSource).join('\n')}\n` : '');
// the page's modules with the athletes' just before the client (the last)
const withAthletes = (mods, source, cfg) => `${mods.slice(0, -1).map(source).join('\n')}\n${athleteLib(cfg)}${source(mods[mods.length - 1])}`;

export function meetChannelScript(cfg) {
  const lib = withAthletes(MEET_PAGE_MODULES, contestSource, cfg);
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
  const lib = withAthletes(COURT_PAGE_MODULES, graphSource, cfg);
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
  const lib = withAthletes(TURNS_PAGE_MODULES, graphSource, cfg);
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
  const lib = withAthletes(PITCH_PAGE_MODULES, graphSource, cfg);
  return `
// ── pitch: the team goal game on this pitch ──
{
const PITCH_ARENA = ${safeJson(cfg)};
${lib}
stepPitch = stepPitchArena;
}`;
}
