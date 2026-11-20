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
- **A rifle on the cheek** (gunplay-view.js, a long gun aimed): its butt stays in the shoulder's pocket and rises only a
  quarter of the way to the eye's line; the head comes down and over onto the stock for the rest (to a limit), so the eye
  looks down the sights. Brought up to the eye whole, the rifle floated before the face with its stock through the head.
- **The crosshair climbs with a spray, and a ring is its cone** (controllable/index.js, the aim held's pages): a round
  leaves up the crosshair's ray raised by the climb, and the view rises only part of it, so the crosshair is drawn where
  the climbed ray points and settles back as the climb does; round it, a ring is the cone the next round leaves in (its
  base as the sights have scaled it, the move's share, the bloom). An aimed rifle's spray stays inside what is drawn.
  Before, the crosshair stayed small and still while a spray's rounds climbed 2.6° over it and opened to 4°.
- **An aimed spray opens less** (worlds/controllable/gunplay.js, arms-kit.js `ADS.bloom`): a held trigger's bloom, a
  round's and its most, is the sights' share of the hip's (half); the hip's is as it was. An assault rifle's aimed spray
  opens to 2°.
- **The scope carries the whole climb** (gunplay-view.js): through a scope the view rises with all of a round's climb,
  so its crosshair is where the next round goes while the rifle settles; neither the drawn crosshair nor its ring is laid
  over the scope's picture. A bolt rifle's climb settles in a second (arms-kit.js, its `recover` 2.5 to 4 a second),
  inside its 1.3 s cycle: the scope is back on the mark as the next round is chambered, where it drifted back over 1.6 s
  and the next round left 0.75° over the scope's crosshair.
- **A kit in the yard** (`scripts/spikes/mission/room.mjs --arms rifle,sniper`): the arms kit's words carried in place of
  the feel template's, to try a gun there.
- **The launchers in the arms library** (equipment/arms/launchers.js, item `launcher`): the GRENADE LAUNCHER (`grenade`,
  the default), a 40 mm revolving launcher: a fat barrel out of a breech block over a six-chamber cylinder on its axis
  (its chambers' mouths dark in its front face, bands along it), a strap over it carrying the rail and the sight, a
  raked grip and its guard behind, a stock, a vertical grip under the barrel; and the ROCKET LAUNCHER (`rocket`), a
  bazooka: one tube flared to a venturi at its back, a pad under it where the shoulder takes it, a raked grip ahead of the
  pad, a vertical grip forward, and the sight on a bracket off the tube's left side, where the eye is beside the tube on
  the right shoulder. Both held to the arms' laws in each line (the future's conduit, the near's seam and counter), their
  stations and handling read off them (handling.js: a sight off the bore's side carries its `x`), a hero's long gun
  (hero-gear.js). `render-arms.mjs launcher,launcher-od` draws them.
- **A grenade launcher and a bazooka in the kit** (gameworld/arms-kit.js `launcher`, `bazooka`): their rounds travel
  (combat-ranged.js the lob). The grenade launcher six a load at 45 m/s under gravity, bursting 3 m round for four base
  rounds; the bazooka one a load at 38 m/s and straight, bursting 4 m round for six, its tube reloaded in three seconds.
- **Launched through the crosshair** (combat-ranged.js `lobAim`; a converging lob's): over the shoulder a travelling
  round is launched from the muzzle on the flight that passes the point under the crosshair (a grenade's low arc, a
  rocket's straight line; past its reach, the farthest arc toward it), its cone and climb round that. Where it was
  launched along the look, a rocket flew beside the crosshair by the hand's offset all the way.
- **The arc and the landing ring before the trigger** (combat-ranged.js `lobPath`; the aim held's reticle): while a
  launcher is aimed, its round's flight as it would go now is drawn, a dashed line from the muzzle, and where it goes
  off a ring the size of its burst laid there, red where the flight ends on a body. Not while it reloads or is drawn.
- **The crosshair stops at the ground** (combat-ranged.js `crosshairPoint`): the crosshair's ray ends on the ground
  plane a travelling round bursts on, where it ran on under the floor to its range; a grenade aimed at open ground came
  down 3 m short at 90 m. A rifle's round is unchanged by it (it flies the ray either way).
- **What a launcher's round looks like** (a round's `look`, gameworld/rounds.js `grenade`, `rocket`; the controllable
  page): a 40 mm shell a hand long, dull, no glow, eased out of the drawn gun's muzzle onto its flight; a rocket finned
  on a flickering flame, dropping smoke behind it, the tube's backblast thrown a few metres back at the launch. Its burst:
  a white flash, a ball of fire billowing and gone in a third of a second, grey smoke rising and spreading for two, chips
  thrown out and falling, a ring of dust running out along the ground to the burst's reach and a scorch left there for
  nine seconds, sized by the reach, every scatter golden-angle. Soft sprites, each born at its first size. Before, a
  travelling round was the mecha's glowing cone and its burst a translucent sphere. The explosion library
  (playscape/elements/explosions.js) draws on the moment channel, which a page without events does not carry: not yet.
