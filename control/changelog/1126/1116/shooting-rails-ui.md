### A shooter's HUD that reads as a game, not an app

The first mission's HUD tracked every value it needed, but it read as a dashboard: a box per readout, "HP" and
"Ammo" written beside the numbers, a checklist of tasks, and the radar in a square frame. It is now drawn as modern
shooters draw theirs. The game UI's design notes gain the principles behind this, so other games' HUDs can follow them
([docs/mana-ui.md](../../../../docs/mana-ui.md), "A HUD that reads as a game"). This work is UI only: nothing about how
a mission plays has changed.

- **The gun in hand** (bottom right): the rounds in the magazine are the big figure, the reserve is small beside it,
  and the magazine is drawn as a belt of rounds that empties as you fire. The gun's name and fire mode (auto, burst,
  semi, launcher) sit small above it. Low on rounds, the figure and the belt turn red and say "Low ammo"; empty, they
  say "Reload"; while reloading, the belt refills. A shot kicks the figure instead of flashing it, because firing is
  not news. A gun with an endless reload shows ∞ for its reserve.
- **The gun at a glance.** Over the figure, the gun in hand is drawn as a wireframe of its side: its stock, grip,
  magazine, barrel and sights, and the few lines that tell one gun from another (a rifle's rail, a shotgun's pump, a
  marksman rifle's scope and bipod). A rifle, carbine, bullpup, submachine gun, shotgun, marksman rifle, sniper rifle,
  pistol, revolver, rocket launcher and knife each have one, and the other words for them (a handgun, a PDW, a DMR) draw
  the same. A gun with none shows its name alone.
- **Ammunition you can see.** The belt is a row of cartridges, the round the gun feeds: a rifle's bottle-necked round,
  a pistol's short round-nosed one, a shotgun's shell, a rocket. A spent round is its empty outline. A knife counts
  nothing and says nothing about reloading.
- **Health** (bottom left) is one long bar in cells, read by its length, with no label and no number.
- **No boxes over the world.** Both corners sit on a soft shade that fades out before any edge shows, and each one
  fades back while it has nothing new to say (a full magazine, full health). It comes forward the moment that changes.
- **Danger is felt.** Below half health the screen's own edges close in, tinted red, and near the end they beat slowly.
  They beat less than three times a second and stay still for players who turn down motion or flashing.
- **One order, not a checklist** (top): a mark, the task in hand, which of how many it is, and how far away it is (in
  metres to a place, or how many foes still stand in a room to clear). A place you have to hold drains its clock under
  the order. The full list of tasks, ticked as you meet them, is on the map screen.
- **The radar is an instrument** (top left): round, with a bezel of ticks, the wedge you are looking down, and north
  riding the bezel as you turn. Its face fades into the world.
- **Hits come from somewhere.** The damage ring's marks are arcs round the aim that taper at their ends and fade as
  they age.
- **For every game, not only the mission.** These are new parts of the shared game UI: a magazine readout, the screen's
  danger edge, a radar scope, arcs for the damage ring, a soft shade behind a corner's readout, and a readout that
  rests while it holds no news. The shooter HUD idioms (weapon readout, health strip, objective order, radar scope,
  danger edge) are built from them. The wireframe board's shooter HUD now lays these out together.
- **What is next on this road** is listed in the notes: a compass strip, a waypoint over the objective in the world, a
  kill confirm and a feed of icons, and grenades as counted slots.
