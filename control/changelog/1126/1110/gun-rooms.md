### The gun rooms: a shooter's practice before its levels

- The practice door now opens the gun rooms for a game that shoots, the way it opens the action room for one that
  fights hand to hand: the firing range (its guns tried on a range, measured) and the artillery range (a big gun on its
  base). Each is its own page, controls and HUD; nothing of the melee room's model is forced onto them.
- A world's guns are read from what it already carries (`gameworld/loadout.js` `loadoutOf`): a quick shooter's `arms`,
  the guns its hero holds, else its feel template's own loadout (Conscription a rifle, a handgun and a knife; Cogs of
  Combat a rifle, a shotgun and a handgun; Infinity Crisis a rifle and a launcher; Steel Serpents a handgun and a
  knife). No new recipe key.
