### Blaze Gunner: a scrolling shooter in space, left to right

Blaze Gunner is an original horizontal scrolling shooter: a small, agile ship over a screen that scrolls on its own,
waves of foes, a hull flown along and a capital-ship boss. Its game is its weapons:
- pods taken from the foes that carry them, each giving the ship a different hurtbox, a shape in time;
- two pods at once, switched with a press;
- a held eject that launches the live pod as a timed bomb that never harms the ship.

Offence and dodging matter more than shielding. The ship moves on an eight-way d-pad, and damage comes off its HP.

It is a rail (`blaze-gunner`). Its words are a shmup, a shoot 'em up, bullet hell or a scrolling shooter, and its
starter lays the first stage as a designed game's level. A "side-scrolling shooter" stays the run and gun's.

**The scroll stage.** A stage is an airspace's `scroll`, built and played by `gameworld/scroll-stage/`:
- **The frame.** Play is written in screen axes, so a vertical stage seen from above is the same stage turned. The
  screen is set from the ship's own length.
- **The runtime.** The screen is carried down a track: legs, holds, and a hold until a boss is down. The ship moves on
  the d-pad. Its lives respawn it at home on the screen. Pods are hurtboxes in time, and foes fly their paths and fire
  told patterns.
- **Space in layers.** Dust lies in front of the play, stars at three depths behind it, and plated fleet hulls hazed by
  depth, all under the space map's sky. They parallax under the perspective camera, as a side map's layers do.
- **The ship.** The hero gunship is a new row on the craft shelf and in the vehicle registry: a classic hero fighter
  in profile, with a keel blade and a gun rail.
- **A hull on the play plane.** Rebel Storm's procedural enemy is broken by its systems and blown apart in rupa's chain
  in zero g. Its guns become turrets, and its outline is terrain.
- **Effects.** Rebel Storm's space blast plays where a craft dies. What is fired lights the hulls it passes, through
  the side map's shot light with an opt-in hook. Rounds are drawn in the shot look, and muzzle flashes, impacts and a
  guard ring show.

**The HUD.** The stage's HUD runs on mana-ui. It is drawn as a ship's console in the `orbit` look, which is now Blaze
Gunner's look for its menus too: hairlines, dark glass and a soft glow, with nothing drawn across the play. It speaks
in pictures and leaves the play clear between its corners:
- a star and the score, a ship for each life left, a heart and the hull as ticks, and the speed as lit chevrons at the
  top left;
- a card for each pod at the bottom left: the pod's own picture in its hue, its ammo as a count and a bar, and the
  eject's hold filling under the live one;
- a skull and the boss's systems at the top right while its hull is on the screen, its name said as it comes in;
- READY at the start and after a life is lost, then GAME OVER or STAGE CLEAR with the score;
- hints with the controls at the bottom right, as key caps or as the pad's own buttons. They show for the first
  seconds and again when a pad or the keyboard is picked up, then fade out.

A pod scores its kills.

**The menu.** Enter opens the stage's menu over the held stage, and so do Esc and the pad's start on their own page.
In a game, the shell's pause keeps Esc and start, and the stage's menu is on select. It is mana-ui's pause:
- resume;
- a controls sheet, with the keys and the pad side by side;
- the control hints on or off, remembered.

**A controller.** A pad plays the stage as a shooter's pad does: the d-pad or the stick flies, A or RT fires, X or LB
switches the pod, B or LT held ejects, and Y or RB changes speed. Each pad's buttons are printed as that pad names them
(Xbox, PlayStation or Nintendo), and the HUD's controls follow the device in hand. The game shell's controls panel
lists the same layout.

**Laws.** The arsenal and the bullet patterns are held to laws:
- no pod is better on every measure, and every pod is worth taking over the base gun;
- a bullet is seen coming, a volley always leaves a way through, and every volley is told;
- a stage stays under a density of bullets on the screen.

**Checks.** A bot plays a stage to its end on the shipped rules. Stage 1 is cleared as an end-to-end gate.

`node scripts/scroll-stage.mjs` shoots a stage on its page.
