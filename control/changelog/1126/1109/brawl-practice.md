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
