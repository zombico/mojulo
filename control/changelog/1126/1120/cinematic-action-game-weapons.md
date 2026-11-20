### Cinematic action game: the weapons in hand, and the round where the crosshair is

Tuning what it is to use a gun over the shoulder, found by playing the infiltration yard headless with the operative
(the hero door's words, `scripts/spikes/mission/operative.json`) and photographing the aim from behind, beside and in
front, a tick at a time.

- **The sights at the eye** (scene/channels/controllable/gunplay-view.js, the gun in the hero's hands): aimed, the gun's
  rear sight is brought onto the strong eye's line along the look. A pistol is pushed out along it to the arms' reach
  (the sights 0.6 m from the eye, nearer only where the strong arm would not reach), both hands on it; a long gun is
  lifted from its shoulder pocket to the line, its depth kept. Before, aiming held the pistol at the belly with the
  elbows bent, so over the shoulder no gun was in the frame. The raise follows the sights' own `aimTime` (a service
  pistol's is 0.16 s from the low ready); a round flips the muzzle up as well as back (a pistol's more), settling as the
  kick does. It is every carried gun's hold off the eye (a quick shooter's over the shoulder too); the first person's
  viewmodel is its own and unchanged.
- **The arm itself in the yard's hands** (gameworld/infiltration-room.js): the hero's kit asks for each gun as the arms
  library builds it (arms-kit.js `armDetailed`), as the mission and the firing range do, where it drew the parts'
  boxes (a pistol read as a dark slab). About 55 kB a pistol on the page. The guards' carbines keep their boxes: each
  guard would carry its own copy of the mesh (140 kB).
- **What is seen is hit** (worlds/controllable/combat-ranged.js, a converging round's: `weapon.converge`, an
  over-the-shoulder camera): the round is resolved along the crosshair's own ray, from the shooter's depth on it, its
  cone and climb round that ray; the muzzle's line to what that ray meets is still what cover is read on, and a round
  that misses stops where the ray meets a wall, or short of it where the muzzle's line meets cover first. Down the
  muzzle's own line to the crosshair's point, a body half a metre beside the crosshair at 5 m was hit (the camera stands
  that far off the hand), and the round struck it low and to one side of where the crosshair was.
- **The shot blocked, said before the trigger** (combat-ranged.js `shotBlocked`; the reticle, controllable/index.js, the
  aim held's pages only): the camera sees past what the gun does not (a low wall under its eye, a corner beside it).
  While the muzzle's line to the point under the crosshair meets cover first, the crosshair dims and a small cross marks
  where the round would stop. Before, the crosshair sat on a guard behind a low wall and the round went into the wall,
  with nothing said.
