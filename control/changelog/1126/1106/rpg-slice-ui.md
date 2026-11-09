### The RPG's battles, party menu and shops on the shared game UI

- **A party battle, the party menu and a shop are drawn by the game UI runtime (internal name mana-ui), the first
  surface to move onto it.** The RPG channel drew each of them its own way: its own sheet of about fifty rules, seven
  cursors of its own (the command, the member, the tab, the row, the shop's tab and row, the slot), its own keyboard and
  pad handling, and markup written by hand. Now the screens are a spec of mana-ui's components (`playscape/rpg/rpg-ui.js`)
  and the page is their host: it reads the battle kernel's state to them each frame and answers what they emit (a
  command, a skill, a target, a class, a slot, a ware), and the kernel still says yes or no. Which list a member is on,
  its row, the open tab and the way back are the runtime's; the look is the theme's.
- **The stack is the menu's depth.** A member's commands, then the skill or the item it chose, then whom: each is a
  screen, so back steps out of each one as it does everywhere else, and back from the commands is the member before. A
  round playing out is a screen too, so accept skips ahead, and cuts a long film short, from the keys, a pad or a tap.
- **Fights wear the world's look.** A world with a settled UI guide lowers it into the battles as a mana-ui theme (its
  colours, frame, plate, border, motion and stop: a console stop keeps the ▶ cursor), the greybox until the guide is
  settled, and the console RPG's look where a world has no guide. The guide's old CSS for the battle window is gone.
- **The controls layer drives the menus.** The keyboard and every connected pad in its printed layout come in through
  mana-host from the menu scheme, so the RPG reads no key or pad of its own beyond P and a pad's select, which open the
  party menu. Legends print the control in hand ("Enter", "A", "✕"). The tabs of the party menu and a shop now turn
  with `[` `]` or the bumpers, as on every mana-ui screen; left and right cross between a list and its detail.
- **What a fighter shows, in the runtime's motion.** Each fighter's bar over its head, the one picking marked, the
  target in focus marked where it stands (over a member's head, or over the pack's figure and in the foes' box). A blow's
  number rises once over whoever it lands on, each its own, told by its word (crit, weak, resist, heal) and sized by
  the juice's `pop` (its colour now the theme's). A change in a bar flashes and pops as mana-ui marks every change,
  which is what a row's `jolt` now does; the window's jolt and the screen's flash are the channel's as before. A foe's
  health in the foes' box is a bar without numbers, as it was.
- **mana-ui grew what the RPG needed, for every game:** an anchor whose row has an id is its own element and a
  passing anchor rises and fades once (the damage numbers idiom replays each number now); a HUD region's place may be
  bound, so a game moves a box to the corner its scene leaves clear; a bar can be drawn without its numbers; and the
  runtime's state says which tab is open.
- A page with party battles is larger by mana-ui's runtime and sheet (a page without them carries none of it), and the
  phone layout's rules for the old battle markup are gone: mana-ui lays its screens out for a narrow screen itself.
