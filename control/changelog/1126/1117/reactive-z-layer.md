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
