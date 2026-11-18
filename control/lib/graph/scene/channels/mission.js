// mission channel: a mission launched end to end on mana-ui (lib/graph/gameworld/mission-mana.js): its briefing over the
// held scene, its HUD while it plays (the level's hp, the gun in hand, the objective tracker, the yard's clock), the
// pilot's pause and, on a page played alone, the debrief. Opt-in on a world's `mission` key (the plan and the tasks a
// mission level carries: gameworld/mission-level.js); absent, it adds nothing to the page.
//
// One block in a scope of its own, so none of mana-ui's names reach the page's: the kernel, the controls host and the
// runtime. It steps nothing in the world: it reads the scene's own probes each frame (the bus's vars, the pilot's weapon,
// the level's outcome envelope) and holds the scene on the pause sidecar the shell's pause uses. It publishes
// `window.__mojMission` for probes.

import { missionChannelSource } from '../../gameworld/mission-mana.js';

export function missionChannelScript(ui) {
  return `
// ── mission: its briefing, HUD, pause and debrief on mana-ui ──
${missionChannelSource(ui)}`;
}
