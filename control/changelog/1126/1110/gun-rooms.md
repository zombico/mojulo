### The gun rooms: a shooter's practice before its levels

- The practice door now opens the gun rooms for a game that shoots, the way it opens the action room for one that
  fights hand to hand: the firing range (its guns tried on a range, measured) and the artillery range (a big gun on its
  base). Each is its own page, controls and HUD; nothing of the melee room's model is forced onto them.
- A world's guns are read from what it already carries (`gameworld/loadout.js` `loadoutOf`): a quick shooter's `arms`,
  the guns its hero holds, else its feel template's own loadout (Conscription a rifle, a handgun and a knife; Cogs of
  Combat a rifle, a shotgun and a handgun; Infinity Crisis a rifle and a launcher; Steel Serpents a handgun and a
  knife). No new recipe key.
- The door routes by how a game fights. A shooter's template (Conscription, Cogs of Combat, Infinity Crisis) has the
  firing range; so does any world whose hero carries a gun. Steel Serpents has the range (its pistol and its knife on V)
  and no longer the action room, which taught launchers and juggles its stealth game does not have. Galaxy Boy keeps
  the platform room: its buster is a platformer's.
- Mech Battle Kai owns its machine: a transforming biped of the mecha shelf, the rover walker (`TEMPLATE_FRAMES`). Its
  room is the artillery range on that frame: it walks on the walker's own gait, folds its legs into its wheeled form and
  drives, and fires its own mounts.
- Served at `bible?book=practice&room=range|artillery`, listed by design_game's readout and the rail, each with its
  icon (a crosshair, a shell).
- The firing range is measured before any level, on the world's own guns: each gun's laws from the combat book's
  measure (its cone widening on the move and tightening aimed, a spray blooming and climbing, the rounds to drop a body
  at each band), tallied in design_game's readout as `practice.measured.range` beside the feel's own measure. A law
  lost is advised as a `feel` step, never a refusal. The measures are kept by the guns they were taken on, so a
  readout does not measure the same guns twice. The readout's `practice` now lists its rooms under `rooms`.
- The run & gun joins the cube: a probe of its own (a street the game scrolls, guns in eight directions, slow rounds
  stepped off, friends dropping in), its gunplay a value of its own (`arcade`: rounds that fly, lobs and bursts, poise),
  both local until the brawler's door makes one from a gameworld; that door now says it opens the run & gun too. A
  brief that names it ("run & gun", "contra-style", "metal slug") reads as this genre; "run and gun" alone, which also
  says a platformer that shoots, only leans toward it.
