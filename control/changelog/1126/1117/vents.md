### Vents: crawl spaces through a building

A building's `vents` (`era/vents.js`, opt-in: a program's, a level's building's, a geocube's or a complex's) lays a duct
along the back wall of each row of rooms off a corridor: through a hole in each wall the rooms share, under a lid a body
lying passes beneath and one standing does not, with a hatch into each room. A body goes in at one room's hatch and comes
out at another's, never in the corridor the guards walk; a guard cannot follow it, nor see it from over the lid.

- **The stage** cuts the holes, draws the ducts in the services' finish, makes their walls and lids colliders, keeps every
  piece off their floors and their hatches (`compose-dress.js keepOuts`), and gives the page their insides as crawl
  spaces (`veil.js` `under`). A building with vents rings its rooms by doorways at the corridor's end and the middle of
  their shared walls, by turns, so the back walls stay the ducts'.
- **Headroom** (`worlds/controllable/stance.js`): a body lying rises only where nothing hangs lower than it would stand:
  under a lid, a truck's chassis or through a hole in a wall it stays down, whatever the key says.
- **The route search** (`gameworld/stealth-routes.js`) passes a cell under something higher than a body lying, lying
  only, so a level's laws read a crawl as a way.
- **Facilities** have vents; the holding block's operative starts on the processing room's row, and its law
  `a-vent-to-the-kit` holds: with the corridors shut, the duct is a way from the cell to the kit (a 20 m crawl, never
  nearer a guard than 9.5 m). The facility maps draw each duct's floor and its hatches.
