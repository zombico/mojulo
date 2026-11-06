### A blast's air fans a fire, or blows it out (rupa-vayo)

- **On the flow (`fxStyle: { flow: true }`), a blast's air reaches the world's fires.** Its wind at a fire is the blast
  wave's (its overpressure at the distance scaled by its charge, Kinney–Graham, and the air behind the front,
  Rankine–Hugoniot), sheltered by a wall between them. What it does depends on the fire's size: a bigger flame takes
  more air to strip (a candle goes out at about 3 m/s, a torch at 10, a campfire at 43).
  - **Fanned** (under half that): the flame leans away from the blast and flares, and with destructible physics it
    burns faster for a couple of seconds, so it spreads sooner.
  - **Straining** (half to all of it): the flame lifts off its bed and gutters, the sign it is about to go.
  - **Blown out**: the flame goes in a fifth of a second, a wisp of smoke rises off the hot bed, and the bed glows dull
    red while it cools. A burning block blown out stops burning (`blowout` on its hits), cooled to just under its
    ignition, so a neighbour still burning relights it within a second or two, and a lone one stays out. A torch, a
    candle or a brazier blown out stays out.
  - Inside the blast's own fireball the heat wins: what it reaches catches, and only what lies beyond feels its air.
- The world's own wind fans and strains a block's fire the same way, and a gale past a fire's limit blows it out.
- A world not on the flow, or with no fires, changes no byte.
