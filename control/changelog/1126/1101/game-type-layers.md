### Game type layers: from a sentence to a game that plays as its type

The sentence door (`design_game({ compose: { prompt } })`) reads a genre and lays the same walks for most of them, while
the kernels that play each type sit behind other doors (a `quick` goal, a kit, the pixelizer). This theme makes the
door reach them, one layer at a time, measured on the door people use.

- **The yardstick: the door probes** (`lib/graph/gameworld/door-probes.js`). One probe a kernel family (race, shoot,
  defend, battle, contest, tabletop, pixel, platform, sneak, fly, seats, and a blocked type), never one a genre: a
  sentence a person says, the hillclimb genre it stands for, and the concept the made game must hold, read from what
  the run would make (`runner.js` `runSteps`: each level's `compose_world` order, nothing minted). Each probe records
  what the door makes `now`; when the probes landed every family's was `not`.
  - `door-probes.e2e.test.js` (the e2e tier) runs each sentence through `design_game`'s own `composedWorld` (exported for
    it) and the run's steps, and holds each probe to its `now`: a door that starts making a family's game, or stops,
    fails until the table says so.
  - `door-probes.test.js` holds each concept to the door that makes its family's game today (its `reference`, a book
    world or a quick goal) and against a bare walk, so a concept that could never hold is caught.
  - The hillclimb page's genre probes gain a **from a sentence** column beside the registry's verdict, read from the
    table (`npm run tool-surface`).
- **The door lays a genre's levels in its book form** (`lib/graph/gameworld/genre-forms.js`, read by `compose.js`). The
  quick door stays the one-level outcome door; a game sentence is laid as a book world, its levels in the form its
  kernel plays.
  - **Flight:** a flight sim, air combat or a space shooter is laid as airspace levels: a runway and a gate course, in
    a trainer, a jet or a space fighter (an asteroid field). No walk, no town. The brief says so (`brief.levelForm`).
  - **Hand-off:** a match-3 saga is said to be the pixelizer's (`create_pixelizer_game({ reducer: 'stone-saga' })`),
    and nothing is laid.
  - **Refusal:** a genre the registry cannot make yet (the cosmos dry run's verdict: co-op kitchen, party mash,
    split-screen deathmatch, driver and gunner, the co-op scroller) is refused with the values it waits on and the
    makeable genres the same words point at. Nothing is laid in its place; it used to be laid as single-player walks.
  - Every other genre is laid as before.
  - **Racing waits on the vehicle registry's ride.** A runner, stealth and the seats wait on phase 2's hero.
- **A genre's own name is a clear read on its own** (`intent.js` `readGenre`): "metroidvania", "tennis" or "tower
  defence" said once writes the genre, ahead of another genre's plain words. Plain words still need two, and two
  genres' names said alike are a tie. "stealth guards and a race with cars" reads as stealth now.
- The fly, pixel and blocked probes hold (`now: 'type'`). The fly probe's reference is a book world. The hillclimb
  column says "refused" and "handed off" where that is the right answer.
