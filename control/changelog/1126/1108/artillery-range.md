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
- **The matter answering** (`gameworld/combat/terminal.js`): what each round does to what it strikes, seen as it is (a
  hole, a breach, a spall, a dent, a crater, a scorch), computed from the round's numbers and the matter's, drawn
  plausibly and never broken physically. A long rod by a simplified Lanz–Odermatt law (calibrated to about 650 mm of
  rolled armour at the muzzle and 600 at 2 km; a plate at an angle its thickness over the cosine); a shaped charge's jet
  the same at any range, scaled by density; a blast holing only thin steel, breaching a wall when its filler is the
  engineers' breaching charge for it (by its thickness cubed and its material, untamped) and spalling it otherwise,
  cratering earth by its dig energy. The range's stands: armour plates at 100 to 700 mm and one sloped at 60°, mild
  steel, reinforced and plain concrete, brick, granite, timber, sandbags, earth. Held to laws: a thicker plate stops what
  a thinner one stopped, the rod slows and cuts less, a jet does not, a shell holes no thick armour and breaches no
  metre of reinforced concrete, more filler digs a wider crater.
- **The artillery range, played** (`gameworld/combat/artillery.js`, `artilleryOf` / `artilleryHtml`; the spike
  `scripts/spikes/combat-tester/artillery.mjs`). A game's big gun given as its mount (a class, or its fields over one),
  its rounds (up to four, keys 1 to 4), its base (a concrete plinth, or a hull on the range's track: W / S drive, A / D
  turn, the stabilizer holding the aim), its reload and its sounds. The range: the gun on the firing line, a row of each
  stand at 250, 500, 1000 and 2000 m on its own bearing so no near row hides a far one, the sloped plate laid back at its
  angle, white posts taller the farther; with the indirect shell (a mount that elevates past 45°), a bunker's roof and a
  ring of sandbags at 3, 4 and 5 km. The gunner looks through the sight beside the barrel (right click zooms it wide, 4×
  and 10×; O steps outside behind the gun): the bore's cross and, under it, a mark for each band of the loaded round,
  from that round's own flight measured on the runtime, where the target must sit for the round to drop onto it. The
  indirect shell's chart (its elevation in mils and its flight for each range) is on the gunner's readout. Each round
  that bursts on a stand or the ground is marked by the same law the measures run: a hole (and its exit through), a
  breach and its rubble, a spall, a dent, a scorch, a crater and its rim. It sounds from the SFX shelf: a cannon, the
  breech worked over the reload, a large blast where the shell went off. In the browser: a long rod laid by its 1000 m
  mark goes through 300 mm of armour, the HE shell breaches a brick wall at 500 m, the indirect shell laid off the chart
  lands 12 m from 4 km after 47 s.
- **The turret's rounds by key and its view on the page.** A turret's opt-in `rounds` are loaded by the slot keys, the
  breech empty until the reload is done. A page whose world has a turret draws its gun in graybox, its sight, its marks
  and its readout (`channels/controllable/turret-view.js`); every other page keeps every byte.
- **A mix heard farther.** The SFX mixer's opt-in `reach` (metres, with its distance): a cue as far off as the arena's
  distances times its reach is heard as one at them, so a shell bursting 4 km off still sounds. Absent, as it was.
- **The turret on its bases.** The range's `base` takes a vehicle of the library (`{ vehicle: 'light tank', livery?,
  wear?, seed? }`, any word the vehicle registry knows): its realistic build drawn as itself (its camo, its wear), driven
  on its own class's rule (W / S, A / D steer), the mount laid where its gun is (the trunnion, the barrel's length) at
  its class's rates; its turret bone turned by the mount's traverse and its gun bone by its elevation, the stabilizer
  holding the gun's line in the world while the hull steers. A road car, or a field vehicle with no turret, is refused by
  name. The graybox bases gained their own looks: a fortress tower (its shaft and parapet, the gun on its roof) and a
  field gun's carriage (its wheels on their axle, its split trails spread to their spades, its shield on the top
  carriage). In the browser: the light tank's turret laid 40° left and its gun 8° up turn its bones; steered through
  45° the gun's world aim is held within a degree; back on the line, its long rod holes the 100 mm plate at 500 m.
- **A field vehicle's gun on a bone of its own** (`car-designer/military.js`, opt-in `gun`, also through
  `compileRealistic`): a turret's gun and mantlet split off onto a `gun` bone, its head the trunnion (the mantlet's back
  on the barrel's axis), and `gun: { trunnion, muzzle }` said, so a turret runtime can elevate it. Absent, the figure is
  as it was, byte for byte.
- **The mecha shelf's frames on the range** (`gameworld/combat/frames.js`). The range's `base` takes a frame of the mecha
  shelf by its library word (`{ frame: 'rover walker', stance?, palette? }`): the work frames (utility, heavy and
  giant-arm walkers), the walkers (all-terrain, field), the transforming walkers (the rover walker, the siege walkers,
  the brood walker) and the big walkers, standing at a stance (braced to fire where it braces, else standing; `roll`
  its tank form, its legs folded onto its wheels). None walks on a page yet: no frame's gait is built. A frame with
  guns fires from its own backpack mounts (the rover walker's autocannon and rocket pod, the siege walkers' howitzer and
  missiles); one that takes a gun backpack is given it (the field walker's rocket pod); one with none is fitted the
  shelf's own traverse ring, cradle and autocannon on its roof, a field conversion. The frame is lowered body by body
  into a rig: each mount's ring and its cradle with its weapon a bone, turned by the one turret, both mounts following
  the gunner's aim and the loaded round's mount firing (a round's own trunnion and reach, opt-in in the turret runtime).
  The mounts slew at a backpack's rates, a siege backpack's slower and high enough for the indirect arc. The outside
  view stands back by the base's size.
- **A walker's rounds.** A 30 mm armour-piercing core and a 30 mm high-explosive shell for the autocannon, an unguided
  70 mm rocket for the pods, a launcher's missile fired unguided; the howitzer fires the HE and indirect shells. Held to
  the same laws: the 30 mm core goes through about 120 mm of armour at a kilometre; its HE shell spalls a brick wall and
  does not breach it, where a rocket's or a missile's warhead does. Two laws were found too narrow and restated: the
  long rod's 650 mm calibration is the 120 mm round's own (a round that carries a calibration is held to it), and at the
  far band it is the round that arrives sooner, not the one that leaves faster, that is laid lower (a blunt 30 mm shell
  leaves faster than a 120 mm one and arrives later). A wide cone's scatter is measured from a gun stood high, so its
  low rounds are not lost to the ground short of the band.
- **The frames walk** (`mecha-shelf/mecha-gait.js`). Each frame of the mecha shelf now walks, its gait read from its
  structure and scaled to its size. Its structure: two legs step in alternation, four in a lateral sequence (hind then
  fore on a side, three feet always down); the farthest each foot reaches ahead and behind within its joints' ranges,
  through the shelf's own IK, at the height its knees bend to for the longest reach. Its size: dynamic similarity, a walk
  at Froude number 0.25 on its hip's height, its stride by Alexander's relative-stride law, so a bigger frame strides
  longer and steps slower (its cadence as 1/√L) and goes faster over the ground; where its legs reach less, the stride
  is theirs at the same cadence. The swing is shaped to the leg: a knee-forward work frame's flat foot cannot lift from
  behind within its ankle's stop, so its foot comes forward before it rises. From the utility walker's 1.7 m stride at
  112 steps a minute to the siege walker's 7.4 m at 56 and the brood walker's four legs at 51. Held to laws: every key
  within its joints' ranges, a planted foot still on the ground, a swinging foot clear, a foot (a biped) or three (a
  four-legged frame) always down, a walk and not a run. On the range a frame walks at its gait's pace (W / S, A / D
  turn), each body a bone keyed at each step by the IK, its gun laid as it goes; in its tank form it stands. O steps
  through the sight, the view behind the gun and a view beside the base, watching it walk.
