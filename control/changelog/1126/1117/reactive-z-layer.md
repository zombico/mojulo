### The reactive top layer: screen effects that act on the picture (spike)

In progress. Built so far:

- **Spike: what a layer of CSS can do to a game's own picture** (`scripts/spikes/reactive-layer/`, not shipped). Over
  a world drawn by the World page's own emitter, sixteen screen effects are laid by CSS alone, after the page draws:
  - harm: hurt
  - impact: a blow at a point, chroma, a shock ring, lightning
  - power: gather, level up
  - state: a blackout iris
  - status: poison, frozen
  - place: under water
  - time: slow motion
  - focus: a scope, an x-ray lens, night vision

  There are four ways to reach the world's pixels: a blend, a backdrop region, the canvas filtered or moved, and a
  point the game projects. Each was probed in Chrome, with its relative cost measured. The finding that decides the
  design: a layer that blends with the world must not be its own stacking context (the HUD's root and the confetti's
  are), or every blend mixes with nothing. `FINDINGS.md` says what works, what does not (refraction round a point
  through an SVG image map), what each costs, and the primitive it argues for: a screen layer beside the HUD.
- **Built: the lens, mana-ui's screen layer.** A spec's `lens` is a second part of the runtime (`rt.lens()`, mounted
  apart with `part: 'lens'`), laid by the HUD host beside the world's canvas and under the HUD, its root never its own
  stacking context (`lensCss`), so its regions act on the world's own pixels.
  - **Its first effect, the `strike`:** the foe just struck, at its place on the screen, the air round its body bent and
    lit (`ring`), lit (`lift`), darkened (`shade`) or turned to its negative for a beat (`ink`; a lift under less
    flash). Each strike is a region the band's size, at most a few at once, held with a held clock, and fading in place
    under less motion.
  - **It never overlaps the world's own effects:** its mask's hole is the foe's body (the world flashes the body and
    throws its sparks there), and it stands down while a world moment plays (a tempo look's own flash, invert, zoom and
    shake). The pilot's hurt stays the HUD's.
  - **Fed by the host** (`scene/channels/lens-feed.js`): each foe's hits counted once, its power from the hit's damage,
    its body projected on the page's camera.
  - **On by default** where a level HUD carries the pilot's parts.
  - **Proved in Chrome** through the real host (`scripts/spikes/reactive-layer/lens-proof.mjs`): each kind round a
    struck foe, nothing during a world moment.
