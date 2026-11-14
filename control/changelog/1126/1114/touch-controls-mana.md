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
- Not yet: pictograms on the pads, the pad clear of the HUD's bottom parts, the legend's line said for thumbs on
  such a level, a game's own extra buttons.
