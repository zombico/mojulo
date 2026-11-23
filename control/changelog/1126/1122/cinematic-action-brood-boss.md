### Cinematic action game: the brood walker, beaten with its own drones

- **A carrier on the boss director** (boss.js, a vehicle row's `carrier`): a boss that fights through what it carries and
  is beaten through it too. Its GUNNERS (bodies of their own, `rule.bossCrew`, carried at their places on it) each lay a
  burst on the pilot in their arc and in sight (cover as a burst's: the line to its chest and to its head), or on a
  hacked drone near them; a gunner is a person, killed by rounds or knocked out by the dart (knockout.js), and down for
  good. Its DRONES (`rule.bossDrone`) are endless: launched from its bays, shot down, reprinted. A hunter patrols round it
  and drops a grenade on a pilot it sees (a hazard disc marked from the drone: a roof between them is cover); a courier
  laps round it and goes home. The RF gun (a loadout slot whose weapon says `jam`) held on a courier HACKS it (let go, the
  hack drains; a gunner's burst on the pilot shakes it off): it fetches the nearest package, carries it home into a door
  whose gunner is down (one whose gunner stands shoots it) and goes off inside, an explosive hit on its hangar. From the
  second delivery its hunters chase the hacked courier and shoot it: shot down, its package is lost and comes back to its
  pallet. A dart in a drone does nothing. `state.bosses[id].carrier` says its gunners, drones, packages, deliveries and
  hack; a state that holds its ground and its heading says `turn: false`.
- **The brood walker as the boss** (boss/vehicles.js `brood-walker`, boss/stand.js `carrierEntities`): the mecha shelf's
  brood walker standing on its hung eggs, a gunner on its roof facing ahead and one in each hangar door facing out of its
  side, eight drones two to an egg's bay (two of them couriers), its hangar the weak spot what goes off in its doors hits.
  Tuned as an on-ramp: slow bursts, rare drops, two chasers at most and two pistol rounds each, a courier every twelve
  seconds, a two-second hack, three deliveries. The vehicle laws read a carrier as won by what it carries home.
- **The page shows it** (boss-view.js): the drones flown with their rotors spun, shown only out of their bays, a mark over
  each (a courier's green, the hacked one's blue with its health, a chaser's red), its packages on their pallets and under
  the drone that carries one, the RF gun's beam and the hack's ring filling round the courier, each gunner's gun turned on
  what it fires at and drooped once its gunner is down, the bursts' tracers; under the boss bar its gunners and its
  deliveries, and what it last said.
- **Played with the operative** (scripts/spikes/mission/boss.mjs `--boss brood-walker`): the drone yard, barriers,
  containers and roofed shelters, three pallets; the dart, the pistol and the RF gun in the kit.
- What lifting it onto the rail would take: the siege walker's list, and the drones as a foe of the foes shelf in their own
  right (a hunter is a flying guard: its patrol, its sight and its drop would serve a stealth level's sky as well).
