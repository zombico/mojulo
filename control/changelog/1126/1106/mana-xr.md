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
