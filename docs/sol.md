# The children of Sol

The solar system's bodies as a reference shelf (`control/lib/graph/sol/`), so a game, an exhibit or a space level that
wants one gets the real body rather than making it again. One row per body in `sol/roster.js` (`SOL_BODIES`), under
the words people say for it, with its real figures and a handle into each place that draws it:

| handle    | what it is                                          | where it is drawn                                          |
|-----------|-----------------------------------------------------|------------------------------------------------------------|
| `model`   | the body whole: globe, close pass, pass through its rings | `saturn-view` (`planet`, `scenario: classic | close | rings`, `gallery: 'sol'`) |
| `world`   | the body in a space level's sky, far off or held in orbit | `skyscape/planet-gen.js` rows from `sol/worlds.js`; `space.backdrop.worlds` |
| `geocube` | the body under foot (the ones with ground, not the Earth) | `era/geocube.js` presets from `sol/geocubes.js`; a cube's `light.heavens` (`era/heavens.js`) |
| `flight`  | a giant, flown over its cloud tops                  | an airspace's `sky: { world }`, `sol/skies.js`; rings in `channels/flight-sky.js` |

`solHandles(word, { view })` returns all of them for one body: the model recipe, the backdrop's `worlds`, the geocube
id, and a giant's flight recipe.

Rules the shelf keeps:

- A body is the real one. Its knobs are fixed and the dice never draw it (`weight: 0`). A new body is a row in the
  roster first, then in each table it has a look in.
- A body with ground is walked (a geocube); a giant is flown. The Earth has no geocube of its own: every other cube is
  an Earth.
- What hangs in a world's sky (no air, the sun's width, a companion world) is said in `light.heavens`, never by a new
  style card. A ringed giant's rings belong to its flight sky.
- Close detail is opt-in. A view or a page that doesn't ask for it carries none of its code, so recipes minted before
  keep their bytes.
