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
- **Built: the lens, mana-ui's screen layer, for turn-based fights.** A spec's `lens` is a second part of the runtime
  (`rt.lens()`, mounted apart with `part: 'lens'`), laid beside the world's canvas and under the UI, its root never its
  own stacking context (`lensCss`), so its regions act on the world's own pixels.
  - **Its first effect, the `strike`:** the air round a figure on the screen bent and lit (`ring`), lit (`lift`),
    darkened (`shade`) or turned to its negative for a beat (`ink`; a lift under less flash). Each row may name its own
    kind. Each strike is a region the band's size, at most a few at once, held with a held clock, and fading in place
    under less motion.
  - **For still figures, so never in an action game.** A region is drawn where the figure was last projected: a figure
    that stands while the round plays is where it says, and one that runs outruns it. An action level's hits are
    answered by the world already, so the level HUD carries no lens.
  - **In the RPG's battles, a juice step:** `{ lens: ring | lift | shade | ink, at?: target | actor }` draws round the
    figure for the beat. By default a miss bends the air round its target and a cast lights the air round its caster.
  - **It never overlaps the world's own effects:** its mask's hole is the figure's body, and a lens step yields where
    the beat's world answers (a flash over the field, a puff on the same figure, a beam landing on it).
  - **Proved in Chrome** in a party fight (`scripts/spikes/reactive-layer/lens-proof.mjs`): each kind round the struck
    figure, and nothing on a hit that flashes the field.
