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
- **The transforming walkers drive in their tank form.** The rover walker, the siege walkers and the brood walker are
  one body with two forms on the range: they walk, and B folds them into their tank form and they drive on their wheels
  (the runtime's forms: a beat, then the tank form's rule), B again unfolding them. The fold is solved by their chain,
  their joints and their pelvis carried from standing to rolled in even steps, so the legs stay joined as they fold; the
  tank form's bodies are a pose of the same rig, its wheels turning a full turn every 2πr driven. Its drive from its
  structure and size as its walk is: a wheeled machine's off-road pace at Froude 4 on its wheelbase (the rover walker
  6.1 m/s, the siege walker 9.2, its Mk 1 11.9, the brood walker 16.1), its turn no quicker than keeps its grip within
  half of what would roll it over. Its gun fires from where its mount is in each form, and its sight carries each form's
  range marks. A base transforming on the range stays solid (the beat's shimmer is a game's tell).
- **A four-legged frame's feet pass clear.** The brood walker's legs aim their hips at their ankles, so each foot (its
  bay, its petals, its wheels) turns as it reaches, and in a lateral sequence a hind foot swung into the fore foot still
  planted ahead of it. A four-legged frame's gait now takes the order of the six that keeps a side's two feet farthest
  apart, sets its feet as much wider fore and aft as lets it walk fastest, and shortens its stride until each foot's
  outline in plan, turned with its leg, passes its neighbour's clear: a new law. The brood walker walks a diagonal
  sequence, its feet 15% wider, a 2.6 m stride at 1.1 m/s (from 5 m at 2.1, its bays meeting); no two of its legs'
  bodies touch at any key.
- **Steered wheels** (`worlds/controllable/steer.js`, opt-in; emitted only into a page with a steered body). A
  transforming walker's tank form steers its front wheels: A / D steer them toward their lock at their rate, and it
  turns as a wheeled machine turns, about a point on its fixed axles' line, at v · tan(δ) / its steering wheelbase:
  standing it does not turn (its wheels do), reversing it turns the other way. At speed its lock is what its grip allows,
  so its wheels point along the circle it drives and never scrub; slow or standing, its full lock (30°, steered more
  slowly the bigger the machine). Each steered wheel is drawn at its own angle, the inner one more (Ackermann: the rover
  walker's inner wheel 52° at full lock, its outer 20°); the brood walker steers its front bays' wheels. Held to laws on
  the runtime: the circle at full lock, no turn standing, the other way reversing, the steering rate, the lock at speed.
- **A chase view to drive from.** O now steps through the gunner's sight, a chase view behind the hull (a driver's
  third-person view: behind and over the base by its size, following its heading eased so a steered curve swings the world
  and not the camera, the gun's aim a pip on the glass), the view behind the gun and the view beside the base. The mouse
  lays the gun in every view; W / S / A / D drive in every view.
- **The walkers heard.** A frame's footfalls sound as each of its feet is planted (its legs' phases in its gait, four a
  cycle for the brood walker), weighted by its mass (a heavy footstep, a mech's, a giant's), never in its tank form; its
  hydraulics follow its walking pace and its diesel power pack its speed, idling as it stands. A light tank or a tracked
  carrier rumbles on its tracked engine, a truck on its diesel. The SFX shelf gains the rows: `diesel-engine` and
  `tank-engine` (the engine family's new `diesel` and `tracked` kinds: a slow knock and a sub-rumble, the turbo; the
  tracks' links clanking faster with speed) and `walker-hydraulics` (the servo family's `walker`: a pump whining up, the
  valves chuffing with the steps). A world's own held voices are an opt-in `audio.sustains`.
- **The other military vehicles drivable.** Every field vehicle of the library is a base: the utility vehicle, the heavy
  utility vehicle, the cargo truck, the armoured personnel carrier, the tracked carrier and the missile launcher, each
  driven on its own class's physics (W throttle, A / D steer). One with no turret is fitted a remote weapon station (the
  shelf's ring, cradle and autocannon, stabilized, all round) on the ring it has for one (the carriers' mount rings, the
  heavy utility vehicle's roof ring, the truck's and the launcher's cab hatch ring) or else on its roof. A wheeled one
  steers its front axle (an eight-wheeler its front two), each wheel drawn at its own angle from the drive rule's own
  steering. The views stand back by a vehicle's size (its height, or a long one's share of its length).
- **The aircraft.** The craft shelf's armed aircraft fly the range (`base: { aircraft }`: the warbird, the naval
  warbird, the jet fighter, the delta interceptor, the carrier fighter, the attack jet) on the fly rule the civilian
  trainer and jet already flew, each at its class's envelope in the skyscape's `CRAFT` from its type's published figures
  (stall, cruise, top speed, ceiling, bank, sink, mass and thrust: a P-51D's, an F4U-4's, an F-16's, a Mirage III's, an
  F/A-18C's, an A-10's; a transport's and a stealth jet's beside them). Each is drawn as its shelf rig, gear up, banked
  and pitched as it flies, its propeller spinning. Its gun is fixed along its nose (the turret's new `fixed` mount: the
  mouse flies it, the gun pitches with the airframe), fired at its calibre's rate from its load: a heavy machine gun, a
  20 mm rotary cannon, a 30 mm revolver or rotary cannon (`AIR_GUNS`, with their rounds), a pair of wing guns from
  between them. Its rounds leave at the gun's speed plus the craft's. It starts aloft behind the firing line at its
  cruise, its lever set where its cruise holds, kept to the range by the rule's bound; mouse pitch, A / D bank, W / S
  throttle, a chase view with an aim pip, a prop or jet engine heard by its throttle. Each envelope is its registry row's `sky` handle, so the
  flight door's `craft` word flies them too. An aircraft with no gun on the range (the transport, the stealth jet) is
  refused by name. Not yet: bombs, landing, a crash.
- **Helicopters and drones.** A rotorcraft is a base by its word too (`base: { aircraft: 'attack helicopter' }`, `'camera
  drone'`, `'fpv drone'`), flown on a new opt-in `hover` rule (`worlds/controllable/rules-hover.js`): its rotors' thrust
  along its disc, the disc tilted to move it, quadratic drag; the collective (Space / Shift) asks a climb or holds its
  height, the cyclic (W / S, Q / E) a helicopter's disc's tilt (let go it levels and coasts) or a drone's speed (its flight
  controller: let go it brakes to a hover), the pedals (A / D) its turn, at speed a coordinated, banked turn that holds its
  height. Each flies at its type's published figures (`skyscape/rotor.js` ROTOR, a registry row's new `rotor` handle: a
  Bell 206's, a UH-60's, an AH-64's, a CH-47's; a Mavic-class camera quad's, a five-inch racing quad's, an enterprise
  quad's, the heavy lifters'), so full cyclic comes to its top speed holding its height and the collective to its best
  climb. Armed as such machines are: the attack helicopter's chin chain gun on its turret, aimed by the hand and
  stabilized (a 30 mm dual-purpose round, `hedp30`), its rocket pods and missile rails fired along its nose; a utility or
  heavy-lift helicopter's door gun on its pintle in the right door (a 12.7 mm door gun); a light helicopter's gun pod
  along its nose; a multirotor drone lets go below it what it lifts (a 30 mm grenade, a 60 mm mortar bomb, a
  shaped-charge bomblet on its drogue: rounds that are released, `drop`, measured falling from 10 to 100 m to the speed
  their drag allows), its chase view's ring where it will land; a racing quad is itself the munition, an RPG warhead
  released on its path when it is flown into the ground or on the click, and the next one launched where the first
  started. Two fixed-wing drones join the aircraft: the long-endurance drone (MQ-9 class) with its missiles along its
  nose, the loitering munition (Switchblade 300 class) flown into what it strikes. A helicopter's weapons and a drone's
  stores are each a store of its own (the turret's `store`): switched to at once, its count kept. Every round fired from
  a rotorcraft carries its velocity. The rotors turn on the rig, the helicopter's chin gun turns with its turret, and
  the engine heard is the helicopter's or a new multirotor buzz (`drone-motors`). Every rotorcraft is armed; the
  fixed-wing recon drones (hand-launched, twin-boom, quadplane, flying wing) are refused by name. Not yet: a model for
  the door gun and the pod, bombs from the fixed wings, landing on a pad, a crash.
- **Boats driven on the water.** A boat of the craft shelf is a base (`base: { boat: 'combat rhib' }`, `'center
  console'`, `'patrol boat'`, `'navy patrol boat'`, `'landing craft'`, `'destroyer'`, `'aircraft carrier'`,
  `'submarine'` on the surface), driven on a new opt-in `boat` rule (`worlds/controllable/rules-boat.js`) at its class's
  figures (`craft-shelf/boat-drive.js`: its shaft power, its top speed, its turning circle, a 20 hp skiff's to a
  carrier's 260,000 shp): its throttle a lever that stays where it is set; its thrust its power over its speed, capped
  standing at its bollard pull (a ship's big screws pull less a watt than an outboard); its hull's resistance set so its
  power holds it at its top speed, a planing hull's hump below its planing speed (it climbs onto the plane bow up and runs
  flatter on it) and a displacing hull's wall past its hull speed; its helm on its turning circle slow and no tighter
  than its hull's grip fast (about 0.6 g planing, far less for a ship), an outboard's or a jet's thrust turned so it
  turns standing, a rudder needing way; it slides out of a fast turn; it floats at its waterline on the swell, heaving,
  pitching and rolling with the water under its ends and sides, banking into a turn on the plane, heeling out of it
  displacing; the bottom within its draft runs it aground. The range is laid at sea for it: the water up to a shore 150 m
  out, its bottom 8 m down, a beach to the land, the stands inland. The water is drawn live about it
  (`scene/channels/controllable/boat-water.js`): one sheet fine near the hull and widening to the horizon, its swell the
  rule's own, its Kelvin wake at its speed now (its wake's numbers at a ladder of its speeds, `boat-wake.js`), the white
  water near the hull, a trail of foam where its stern has been (so a turn leaves its curve), spray off its chines and its
  rooster tails on the plane. Its gun is its own, turned on its mount's bone (the RHIB's and the riverine boat's bow
  machine gun, the landing craft's ring mount, the navy patrol boat's 30 mm cannon, the destroyer's 127 mm gun with its
  high-explosive shell and its high arc onto the far field, the carrier's close-in gun) or a heavy machine gun fitted at
  the bow of a boat built unarmed (the submarine's on its sail); its rounds carry the boat's way, and a round that comes
  down on the sea short of the shore splashes, its column by its calibre and its charge. A gun stood high on a ship is
  measured laid down onto its near targets. Not yet: a model for a fitted gun, the boat's wake felt by another boat,
  rowing and sail, a submarine under the water.
- **Cars and motorcycles on the land.** A car or a machine ridden astride is a vehicle base too (`base: { vehicle:
  'sports car' }`, `'sedan'`, `'pickup'`, `'motocross bike'`, `'sport bike'`), driven on the drive rule at its class's own
  row (`roads/vehicles.js`: its power, mass, drag, grip and turning radius, a 911's, a Camry's, an F-150's, a 450
  motocross bike's, a litre sport bike's). A car is the car shelf's own build when the row names a card (its body, its
  language, its trim and paint), else its class's realistic loft; its front axle steers, each wheel at its own angle, and
  it is fitted the weapon station a truck is, on its roof. A motorcycle is the cycle shelf's machine ridden: its rider
  astride (the realistic hero, built once a process: `artilleryReady(spec)` awaits it before the range is laid, or
  `rider: false` rides it riderless), its front turned about its steering axis, the machine and its rider leaning into a
  turn by the drive rule's own lean; its rider aims a 12.7 mm light gun fitted for the range, all round but behind, held
  on its aim while the machine turns under it (`gameworld/combat/roadsters.js`; the shelf's ridden figure built at once
  from a rider already solved, `cycle-figure.js` `riderOf` and `rideFigureOf`). Both start in the chase view; a car is
  heard by its engine, a motorcycle by its own. A site machine is refused by name.
