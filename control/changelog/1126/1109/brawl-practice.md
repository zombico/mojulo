### The brawler's practice room

- A practice room for brawler-style games (`brawl/brawl-practice.js`), the street's own blocks under a practice mind and
  apart from the fighting game's training: a yard with one to four players and up to eight dummies, each a thug of the
  street's types (or any fighter) in a mode: stand, walk back and forth across the street (lining up on a moving body),
  swing on a slow beat (reading a blow), crowd (the street's own crowd mind, its tokens and its ring) or grab (walks in
  to take hold, knees and throws). A player never dies; a felled dummy is back on its spot three seconds later (its
  health a few of the player's chains), or never falls under refill; a reset puts everyone and every thing back.
- Every press has its verdict: taken (how late) or dropped, and why (the blow before missed, too late, reeling, the
  hitstop, landing); the room reads the line to each dummy (how far across, lined up or not, in reach or not), the chain
  (its blows landed, the finisher or dropped and why), the clinch (knees left, the hold's time, from behind), the last
  combo, the attack tokens, a power-up and a weapon held; and a brawler's move list by kind (the chain by its style, the
  air, the clinch, the desperation and its price, the special, the street's things).
- The yard (`brawlPreset('yard')`): one long open screen ruled a metre along and every half metre across the street,
  its band's edges and middle bold, a back wall and a rack.
- Found by the press log: a press made during a blow's hitstop ran out before the freeze ended, so a chain only carried
  by mashing; the brawler's press is now kept through the freeze, as the fight's is. And a chain's next press made
  while the blow before missed starts a fresh chain once the body is free, never the chain's second blow from a stand.
- The brawler's readouts in mana-ui (`mana-ui/idioms-brawl.js`, a shelf of its own beside the fight's): marks at each
  body's feet saying how far across the street it stands and whether a blow can land, marks over the heads of the crowd
  that may close in next, the chain's blows lit as they land and how the last chain ended, the clinch's time and knees,
  and the press log; the yard's screen over them (`brawl/brawl-yard.js`: the HUD, the move list, the practice settings)
  in a brawler's look (the `brawl-yard` theme card); the board draws them as the brawler practice HUD.
- The brawler's page, its first the practice yard: a world's `brawl` block with its `practice` (`brawlLevel(level, {
  practice })`) is played by the page's brawl channel (`scene/channels/brawl.js`, `brawl/brawl-page.js`,
  `brawl/brawl-yard.client.js`): the room stepped at 60 a second from four seats (the controls layer's new `brawl`
  scheme: the stick, attack, jump and special; a second controller drops in), each body drawn in the round as the fight
  draws its fighters (its move's or its reaction's pose, `brawl/brawl-pose.js`, jointed by the fight's rig), each
  player's line on the floor, the street's things, a flash where a blow lands and the fight's sounds by event, under the
  belt's locked camera; the yard's screen in mana-ui (start the practice settings: the fighter, the dummies' mode, type,
  number and health, the marks and the log; back the move list; R a reset). Absent, a page carries none of it.
- The spike `scripts/spikes/brawler/practice.mjs` plays the yard on a virtual clock as a person would and shoots it.
