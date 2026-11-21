// damage ring channel: where the fire is coming from, on a level whose HUD is the page's own (gameworld/damage-ring.js):
// each hit the pilot takes marks a ring round the aim at its attacker's bearing from where the pilot faces, for a
// moment. Opt-in on a world's `damageRing` (a quick shooter's level and a deathmatch carry it: gameworld/levels.js);
// absent, it adds nothing to the page. A mission draws the same ring on mana-ui in its own HUD (the mission channel), so
// a mission's page carries no block of this one.
//
// One block in a scope of its own. It steps nothing in the world: it reads the pilot's hits off the scene's probe each
// frame and draws a few bars in a fixed square round the aim. It publishes `window.__mojDamageRing` for probes.

import { damageRingSource } from '../../gameworld/damage-ring.js';

export function damageRingChannelScript(cfg) {
  return `
// ── damage ring: where each hit came from, round the aim ──
${damageRingSource(cfg)}`;
}
