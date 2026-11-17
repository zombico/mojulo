### Cinematic action game: guards that keep their eyes on you and fight with the gun they carry

- **Once seen, it keeps you** (`rule.alert`, worlds/controllable/alert.js, opt-in): a watcher that sees the pilot is
  alerted. Alerted, its sight is wider and longer (`cone`, `range`), so a body that steps out of a patrol's narrow beam
  is still followed; it remembers where it last saw the pilot for `hold` seconds, goes there at a quicker pace (`pace`)
  when the line is broken and searches round it for `search` seconds before it lets go and takes up its round. It
  follows farther from its post (`leash`). A fresh sighting calls the watchers of its team within `call` metres, who
  come to where it was seen and look there with their own eyes. The weapon comes up before its first round (`raise`
  seconds), so the first shot is never from the hip. A watcher whose way to the spot is walled off searches from where
  it stands rather than walking into the wall. Its state is `e.alert` ({ level: calm | combat | search, up }), read by
  the page. It only changes what the rule says and holds the trigger until the gun is up: what is seen, chased and shot
  is the mind's own, so a pilot behind cover is still not seen. It wraps the world's step: every other page keeps every
  byte.
- **The gun in a watcher's hands** (`rule.armHeld`, scene/channels/controllable/gunplay-view.js, opt-in): a body with a
  mind carries the arm its slot's `gunplay` view draws, its hands closed on it as the hero's are, its posture read off
  its alert: on its round the patrol carry (the butt in the shoulder, the muzzle down and across the body, the chest
  little turned, over the walk); searching a high ready; in combat the attack stance, shouldered, the chest side-on, the
  gun on the mind's own aim and kicking with each round, which leaves from its muzzle. A body without an alert raises
  it while it fires. Emitted only into a page that has such a body.
- **The fan says it is looking** (sight-view.js): amber while its watcher is alerted and does not see the pilot (its
  search, or a call it came to), and the fan it draws is the alerted one, wider and longer.
- **The infiltration yard's guard** carries its carbine (the arms library's, as the hero's kit draws it), keeps the
  hero once it has seen it (`alert`: a 1.3 rad cone, 1.6 times its reach, 12 s of memory, 6 s of search, its pace 1.8
  times, called guards within 14 m, the gun up in 0.45 s) and fires its carbine in bursts of three, a round 6 of the
  hero's 100, where it fired one round a pull. The level-1 yard and hangar stand the same guard. Played headless:
  patrol carry on the round, the gun up and the first burst half a second after the sighting, the hero followed as it
  stepped aside, searched for where it slipped away; nobody has played it.
- **A world without a watcher steps as the engine does** (startle.js): the pilot's pace over the ground was written on
  every world's pilot by the startle step, so a world without one no longer stepped byte for byte as the engine
  without it (foe, knock and vayo-move's opt-in pins were red). It is written only where some body has `startle`.
