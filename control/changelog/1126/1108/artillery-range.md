### The artillery range: one turret, every big gun

- **Planned.** The firing range's sibling at a big gun's scale: cannons aimed by hand, ordnance of each kind fired into
  matter of each kind. Its primitive is the turret: one mount, stepped by one piece of the runtime, so a tank's, a
  tower's and a field gun's are the same thing on a different base, stationary or rolling.
- **The turret.** A gun on a mount, aimed by hand on any base: an entity's opt-in `turret: { mount, gun }`, stepped by
  `worlds/controllable/turret.js`. The hand (the mouse's look) moves where the gunner asks the gun to point; the mount
  slews to it at its traverse and elevation rates, accelerating and braking onto it, within its stops; a hand slower
  than the mount is tracked, a quicker one lagged (the mount's weight, the feel). A stabilized mount holds its line in
  the world while its base turns (a gyro loop, up to its rate); an unstabilized one is carried, as a crank-laid gun is.
  The weapon fires from the muzzle along the barrel. A page without a turret is as it was.
- **The mounts** (`gameworld/combat/mount.js`): a battle tank's turret, a light tank's, a field gun laid by hand, a
  self-propelled howitzer's and a fortress tower's, by class; measured on the runtime (a quarter turn, the elevation's
  whole range, a flick's settle, the lag behind a sweeping hand, the drift on a turning base) and held to their laws.
- **The ordnance and its flight** (`gameworld/combat/ordnance.js`): a tank gun's long rod (APFSDS), its shaped charge
  (HEAT) and its high-explosive shell, and an indirect shell for the high arc, by class: caliber, mass, muzzle velocity,
  drag, dispersion, fuse, filler. Each lowers onto a travelling round; measured from a turret on the runtime: at 250,
  500, 1000 and 2000 m the elevation to hit (° and mils), the time of flight, the speed it arrives at, its drop below
  the bore; the indirect shell's high arc onto 2 to 5 km, its apex and its long flight; a dozen rounds' scatter. At 2 km
  the long rod flies 1.24 s and keeps 93% of its speed, the HE shell 2.44 s laid 13 mils up; the indirect shell lands
  at 4 km on a 69° arc after 47 s.
- **A shell's drag and its gun's dispersion on the runtime.** A travelling round takes `projectileDrag` (quadratic: it
  sheds speed as e^(−k·x)), and a weapon's seeded cone scatters its shells as it does its bullets. Absent, a round
  flies as it did.
