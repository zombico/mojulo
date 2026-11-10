/**
 * A FIGHT'S CAST RIG: the one light a fight game's bodies are drawn under (color-theorist/cast-rig.js), as the page
 * carries it (scene/channels/cast-rig.js castRigInput). A fight's levels are a stage or a greybox, neither painted by a
 * cube, so the rig is the card (the fight rig's own numbers) in the game's register; a level a cube paints passes it.
 *
 *   fightCast(register, cube?) → the arena's `cast`, or null where the fight has no register (an arena made before
 *   it lights its bodies as it always did, and carries none)
 */
import { castRig, CAST_REGISTERS } from '../color-theorist/cast-rig.js';
import { castRigInput } from '../scene/channels/cast-rig.js';

export function fightCast(register, cube = null) {
  if (!CAST_REGISTERS.includes(register)) return null;
  return castRigInput(castRig(cube, { register }));
}
