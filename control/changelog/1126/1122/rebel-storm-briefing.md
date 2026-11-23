### Rebel Storm's briefing: a mission designed on a holo table before it is built

In progress. A space campaign's mission is now designed as one thing before its level is built: where it is, who is
in it, and what is asked, step by step. The person sees it as the pilot will, on a hologram table, and approves it; only
then is the level compiled and built.

- **The place** (`campaign/theatre.js`). A mission's place is named from widest to narrowest, "Kessa System | Varn
  Cluster | Vigil Station | Moon IV": the system, the cluster in it, the station the fight is round, and the numbered
  moon it holds orbit over. The system is drawn as an orrery (the star, its planets on their orbits, the planet whose
  moons are numbered, the cluster's belt); the theatre is the fight's own space, at the sortie's metres.
- **The mission's design** (`campaign/mission.js`). `readMission` reads a design and teaches each fault: the place, the
  theatre (the moon's kind, the station's, the cluster's rocks, the nav points), the cast (flight groups off the craft
  shelf, capital ships and stations off the fleet, each at a nav point or at metres, arriving as a sortie's groups do),
  the goals over the cast, and the briefing's steps (what each shows, what it says, the routes it draws). `missionLaws`
  is its machine gate: every step shows something that exists, every goal's group is shown before Launch, every foe
  group is introduced, everything sits inside the field. `compileMission` lowers it onto a sortie level and says what
  the build lays beyond it (the capital ships, the station, the moon as the sky's large world, the cluster's rocks).
- **The holo briefing** (`campaign/briefing-page.js`). A self-contained page: the theatre as a miniature in hologram
  light on a table (the board games' hologram arena's shader and edges), the capital ships and the station built from
  the fleet's own pieces, each flight group a formation of its craft's miniature, the moon a lit globe at its edge. It
  opens on the orrery and closes in on the moon, then goes through the mission one step at a time: the camera frames
  what the step is about, what it names is lit and the rest dimmed, the routes are drawn, a group that jumps in arrives
  in a streak. The words are mana-ui's: the place along the top, the step and its line, the steps so far, the roster.
  `node scripts/briefing.mjs rebel-storm mission-1 --out <dir>` writes it.
- **The campaign's idioms** (`mana-ui/idioms-campaign.js`, a new shelf): `place-banner`, `briefing-steps`,
  `flight-roster`, `campaign-tour` and `mission-debrief`.
- **Rebel Storm on mana-ui.** The rail's starter dresses its game in the `orbit` theme, so its title, its missions and
  its pause are drawn by mana-ui; mission 1 carries its design, waiting for approval.
