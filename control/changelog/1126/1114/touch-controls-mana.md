### The touch controller drawn by mana-ui

In progress. A game that moves on W A S D already plays on a phone: the touch layer is a virtual gamepad read through
the same bindings as a real pad. It drew its own stick and buttons, though, beside a HUD that is mana-ui's. The plan:
mana-ui draws them, the controls layer keeps reading the thumbs.

- **Built: the view half.** On a level made for a screen whose HUD is mana-ui's, the HUD draws the virtual pad and
  the touch layer draws nothing (`touchScript(L, { view: 'mana' })`): the same zones, the same pad arithmetic, the
  pads found from the view's own elements, what it knows said as `window.__mojTouch.view()` and copied into the
  HUD's state each frame.
- mana-ui's `touchpad` takes `lane`, `held` (where the stick rose and where its nub is) and `down` (the controls
  pressed). A stick at rest is seen through, a held one stands out where the thumb landed, a pressed pad is filled.
  The pad is as wide as its frame allows (it ran off a tall frame's side).
- A level with no mana-ui HUD, and a runner's or a course's swipe layouts, emit the touch layer they did.
- **Built: its look.** A pad named for what it does wears its pictogram inside its round where the theme draws
  icons (`use`, `interact` and `talk` are the tap's). The pads fill from the screen's edge inward. The HUD's bottom
  corners stand over the pad while it is drawn. A level's hint line says the thumbs while the pad is up
  (`hudToMana({ touch })`), its keys otherwise. The board draws `touch-controls` with a held stick and a pressed pad.
- **Fixed in mana-ui, seen on a phone frame:** a glass theme blurred the world behind every HUD region, the bare
  ones too (a slab behind the pad); bare regions and the ones that are their own frame are no longer blurred. A
  region whose every part is gated off left an empty plate; it draws nothing now.
- Played in headless Chrome on a phone-sized touch screen, a made game in the toybox look: the stick rose under the
  thumb and the hero walked; a touch on the jump pad pressed the pad's control and the hero jumped.
- Not yet: a game's own extra buttons reaching the level (the HUD host drops a HUD part's effect), the pad's size
  and place tuned by hand on a real phone, a world with no `ui` and no course (it keeps the driver's own drawing).
