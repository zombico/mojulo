### Cinematic action game: the brood walker, beaten with its own drones

- **A carrier phase for the boss** (worlds/controllable/boss.js, `kind: 'carrier'`): a boss that fights through what
  it carries and is beaten through it too. Its CREW are spots of their own kind (`part: 'crew'`): a gunner on a mount,
  carried on the body, facing out over its arc, laying a burst on the pilot in its arc and in sight (cover from it as
  from a burst; a burst on the pilot shakes the RF gun's beam off) or on a hacked drone near it. A gunner is a person:
  the pilot's rounds kill it and its dart knocks it out (knockout.js, as the guards), and once down it stays down. Its
  DRONES (`rule.bossDrone`) are endless: launched from their bays, shot down and reprinted. Hunters patrol round it; one
  that sees the pilot flies over it and drops a grenade, its ring on the ground first (a roof is cover). Couriers have a
  weak link: a loadout slot whose weapon says `jam: true` (the RF gun), held on one, HACKS it (the beam let go, the hack
  drains). Hacked, it flies to the nearest package, picks it up and carries it home "for repair", by the hangar door
  whose gunner is down (one whose gunner stands shoots it), and goes off inside: the core takes the delivery. From the
  second delivery its hunters chase the hacked courier and shoot at it: shot down, its package is lost and comes back
  to its pallet. Its core worn through, it is destroyed and its drones fall. A dart in a drone does nothing.
- **The brood walker as the boss** (gameworld/combat/boss-fight.js `broodWalkerBoss`): the mecha shelf's brood walker
  standing on its hung eggs, a gunner on its roof (facing ahead) and one in each hangar door (each facing out of its
  side), its eight drones two to an egg's bay (two of them couriers), its doors read off its hull's inventory row.
  Tuned as an on-ramp: slow bursts, rare drops, two chasers at most and two rounds of the handgun each, a courier every
  twelve seconds, a two-second hack, three deliveries.
- **The fight shown** (boss-view.js): the drones flown with their rotors spun and shown only out of their bays, a mark
  on each (a courier's green, the hacked one's blue with its health, a chaser's red), the packages on their pallets and
  under the drone that carries one, the RF gun's beam and the hack's ring filling round the courier, each gunner's gun
  turned on what it fires at and drooped when it is down, the bursts' tracers; the HUD's gunners and deliveries.
- **Played with the operative** (scripts/spikes/mission/brood.mjs, brood.json): the drone yard, an apron with cover and
  shelters (lib.mjs `apron`, the siege walker's page's too), three pallets, and the operative's kit with the RF gun as a
  third slot.
- What lifting it onto the rail would take: the siege walker's list, and the drones as a foe of the foes shelf in their
  own right (a hunter is a flying guard: its patrol, its sight and its drop would serve a stealth level's sky as well).
