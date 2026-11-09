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
