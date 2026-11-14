### Side-scroll action starter: the beat 'em up

A beat 'em up as a game, on the brawl library's own kit (`lib/graph/brawl`, over the fighting game's fighters: the
chain and its finisher, the strong blows, grabs and throws, the running blow, the desperation, weapon arts, thugs
from the fight's archetypes). The library's street (screens held by a gate until their wave is beaten, a boss's
screen) is now played on a page; before, only its practice yard was.

- A street fought down on the World page. A brawl level's `street` (`{ players?, roster?, waves: [{ screen, crowd,
  boss? }], things? }`, `brawlLevel(level, { street })`) is played by the brawl channel in the yard's place: the room
  a street (`brawl-crowd.js` streetOf / stepStreet), the players' buttons read by the brawler's own reader, the camera
  scrolled on and held at each uncleared gate by the belt. A level is a yard or a street, not both.
- Its screen (`brawl-street.js`, on mana-ui in the brawler's look): the player's name and health, the held screens as
  pips, the crowd left on this one or the boss's bar while it stands, GO as a screen is beaten and the boss's name as
  it comes in, and the two ends (the street cleared, the player down) with the time, the health left and a button
  that fights it again. What it reads is `brawl-street-read.js` streetRead, pure off the street's state.
- Measured with no page: `scripts/spikes/brawler/street-sim.mjs` plays a street on the brawl's sim with a bot on the
  native kit. On the page: `scripts/spikes/brawler/street.mjs` (a virtual clock, the keyboard): a lighter street is
  cleared through its boss to its end screen, a full one beats a button-masher on its second screen; fight it again
  returns to the start; no page errors.
- `brawl` re-pinned: the one fixture whose page inlines the brawl's client.
- Not yet: a world that is a brawler in `design_game` (a level kind, the shell and its result, export), characters
  of the world's own in place of the stick figures, the street's dress, lives and continues, two players checked on
  a page.
