### The game UI in a headset: mana-ui's screens and the controllers as game controllers

- **A snapshot of a mana-ui view, as the screen draws it** (`mana-ui/snapshot.js`). A headset shows no DOM, so what a
  view looks like this instant is made an image another surface can draw: the view's own elements under the sheet they
  were drawn with, rendered by the browser into an SVG image. Layout, theme, the focus's words, ornaments and
  pseudo-elements carry over by construction, never drawn a second time. Whatever is moving (an entrance, a change's
  flash, a moment's slam, a turn breathing) is baked at the value it holds this instant, so a snapshot each frame plays
  the screen's motion. It is a data: URL, which Chromium (the Quest's browser) lets a WebGL texture take; Safari does
  not, so a headset on Safari draws none of it.
- **The transfer gate** (`mana-ui/snapshot.chrome.test.js`, the e2e tier): a view's screenshot against its snapshot,
  pixel by pixel, on a screen in a theme that leans on every feature of the sheet, on a frame caught mid-motion, and on
  one box alone. They agree to within the half pixel a centred box is anti-aliased across (the screen's compositor
  snaps it); the same view snapped without its theme is far outside it.
- **mana-ui's screens on a panel in the headset** (`scene/channels/xr.js`). Every mounted mana-ui view registers on the
  page; in a session, while one has a screen up (a fight's commands, the party menu, a shop), its snapshot is drawn on
  a panel at eye height ahead of the player, set where they look as it opens and left there, never riding the head. It
  is drawn again as the view changes, and up to thirty times a second while something on it moves, so its motion plays
  in the headset as on the screen. The HUD panel no longer mirrors a level's HUD that a fight has set aside.
- **The controllers work a menu as a game's controllers do.** Either stick moves, A or the trigger accepts, B backs
  out, the grips turn the tabs (the menu scheme's new headset rows), read through the view's own input owner like any
  pad, so the legends print the controller's buttons. While a screen is up the world, the walk and the turn hold, and
  the player's body stays on the hero (a fight that stages its party takes the player with it). No laser pointer.
  mana-host takes a device that arrives after it connected (`drive()`), and lets it go with the session.
- **A fight's marks stand in the world.** An anchor's row may name its point in the world (mana-ui's `world`); in the
  headset each such anchor is drawn as a card over that point, square to the eye and as large to the eye as on the
  screen, instead of where the screen's camera would put it: the RPG's bar over each fighter's head, the target
  marker, and the numbers rising where blows land. On the screen nothing changes.
- A page without a headset, or without a mana-ui surface, is unchanged byte for byte. Gates: machine (the transfer gate;
  the headset block against a fake session: the panel, the controllers on a real runtime and mana-host, the world held,
  the cards). Eyes: the operator's Quest, not yet run.
