### Hijack City: the open city's crime game as a rail and a starter for a GTA-like

The open city this branch built (a district of a metro, cars to take, a contact's missions, the law, the shops, the
street's health, the sidearm, crews, the phone's fares, a title, a save and a score) is now a game type an agent can
start a person's own from, named for it and offered by the producer.

- **The rail** `hijack-city` (gameworld/rails.js): Hijack City, an open city crime game; designed; seen in the round;
  its first level a district. Found by a brief's words (a GTA-like, steal cars, a wanted level, police chases).
- **The genre** `open-city-crime` (cosmos/fixtures.js, gameworld/intent.js): the city as a sandbox on foot and at the
  wheel, the law answering what is done in it; makeable today. It joins the tables a genre is read by: the interface's
  look (downtown), the sound shelf's city group, the feel's action flavour, and the sentence door's forms, which lay it as
  a district (gameworld/genre-forms.js).
- **The starter** (gameworld/hijack-city.js): `design_game({ world: { name, rail: { from: 'hijack-city', locked: true } } })`
  lays it whole under the person's own words (gameworld/pitch-start.js, `laid.by: 'hijack-city'`); `HIJACK_GROWS` names
  what is changed first. Built in gen 7 by default.
- **Its card** `gameworld-hijack-city` and the game-design routing card's word for it; [docs/hijack-city.md](../../../../docs/hijack-city.md).
- **The game's interface on the candidate's mana-ui** (merged from 1116-rc): the health in cells under the radar, corners
  on scrims, the rc's pause. The gun's readout stands only while the sidearm is drawn (scene/channels/mana-hud.js), and a
  gun empty with nothing in reserve says "No ammo", not "Reload" (mana-ui kernel.js). A district's level is titled by its
  own name (the pause said "district · district").
