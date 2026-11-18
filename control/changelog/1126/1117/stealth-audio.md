### A stealth level's sound: music that follows the alarm, the garrison and the mission heard

- **The alarm on the bus** (worlds/controllable/alarm.js, castFacts wrapped): `alarm:detected`, `alarm:found` and
  `alarm:clear` as its phase turns, `alarm:call` as a guard starts the radio call, `alarm:cut` as the caller is put down
  first, `alarm:sweep` each time the searchers spread again, `alarm:backup` as backup is sent. A bus that has not yet
  heard an alarm hears it from rest, so its first turn is never lost.
- **The mission on the bus** (worlds/controllable/mission.js, castFacts wrapped): `mission:item`, `mission:clue`,
  `mission:reveal`, `mission:ride`, `mission:hint`, `mission:exit`, `mission:done`.
- **Any bus event voiced by a shelf word** (beats-world.js, the sound sheet's `events: { '<event glob>': '<shelf word>' }`):
  each word a cue of the level's (`ev-<word>`), over the mechanics' own.
- **A page whose audio listens carries the bus** (scene-three.js): where its sfx's `on` or its tension's `on` names an
  event, the events channel is emitted to carry the cast's happenings, even on a page with no reaction of its own; until
  now such a page's music never heard a sighting. Never on a capture run. Every other page byte for byte.
- **Level 0 scored** (the spike's `audio`): the field's `tension` while sneaking and its `battle` once the garrison has
  found the player, the alarm's turns and sweeps raising the score's tension and a glimpse a little, the gorge's wind and
  a low forest bed; a guard's glimpse the alert's sting, a threat detected the dread, the radio's call a click, a threat
  found the siren, a guard put down a thud, a thing taken the pickup, an exit the door, the steps on grass, the pistol.
  Proved on the page: spotted, the combat score comes in on the bar; hidden, the alarm falls to detected and the
  tension leaks back toward the explore score.
- **The first sighting, once** (`alarm:spotted`, alarm.js): said as the garrison leaves calm because a watcher saw the
  intruder, never at each glimpse after; level 0's sting plays on it (a glimpse still raises the score's tension a
  little).
- **Less of the land, more of the game**: level 0's wind at -40 dB (the default's -30) and the forest's birds at 0.12 (they
  were 0.35), so the score and the game's own sounds lead.
