// briefing channel: a space mission's holo briefing over its level's page (lib/graph/campaign/briefing-page.js): the
// table and the mission told a step at a time on mana-ui as the level loads, the mission held behind it on the pause
// sidecar the shell's pause uses; Launch lets it go (its frames stopped, its GL context given back) and the mission
// flies. Opt-in on a world's `briefing` key (a cockpit level's: a mission's design, compiled by campaign/mission.js);
// absent, it adds nothing to the page.
//
// One block in a scope of its own, so none of its names reach the page's. It publishes `window.__mojBriefing` for probes.

import { briefingChannelSource } from '../../campaign/briefing-page.js';

export function briefingChannelScript(cfg) {
  return `
// ── briefing: the mission told on the holo table before it is flown ──
${briefingChannelSource(cfg)}`;
}
