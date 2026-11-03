### Destructible physics: dust and smoke drift on the wind, each by its own script

Under destructible physics, the dust a break raises and the smoke a burning block gives off are carried by the level's
wind, rise or settle by their own physics, spread as they mix and fade as they thin.

- **Their own scripts**: a puff's path is a formula of time, as a leaf's is: it moves at the wind of its height with
  the gusts' sums, smoke rises on its heat by Briggs' plume rise to its final height, and dust settles at the speed of
  its grains (Stokes for the fine, Newton's drag for the coarse). It spreads by the wind's turbulence, rougher terrain
  mixing faster, and it fades as the same mass spreads thinner, so a fire's smoke is as thick as the fire is big.
- **A solver decides each source**: a fire is a plume, a break's dust or a burst of steam a puff, and each size of dust
  hangs on the air or falls out at once by whether it settles slower than the air's own stirring, every decision with its
  reason in numbers.
- **On the page**: dust in the colour of what broke, soot-dark smoke over what burns, white steam where water meets fire.
