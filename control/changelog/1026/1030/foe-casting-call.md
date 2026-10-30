### Foe casting call: the cast sheet

A world's foes had no page. The bestiary, the resolver and the Mind facet already said everything about each foe: its
class, rank, numbers, mind, modes, states, death and relations. No book showed it. This theme adds the cast sheet, a
fourth book beside the world, character and feel books, and a casting call that proposes a cast for a world that fights
and keeps none.

- **The cast sheet** (`/api/sketches/<ref>/bible?book=foes`, `gameworld/foe-cast-html.js`). It reads the world's foes
  through `gameworld/foe-cast.js` `foeCastOf`, which only reads what the shelves already say.
  - The lineup plate: every foe at the stature it reads at in the game, beside the hero, on a metre rule.
  - A tile per foe by tier. Its portrait is the figure a run made (the sketch's PNG while served, none in a download),
    else its silhouette.
  - A card per foe: the lesson it teaches the player, its numbers, its attack's timing, its mind as the Mind facet
    resolves it on its body, its shelves, and what each engine keeps.
  - The game's flavor sets the stat words (`STAT_WORDS`: a platformer counts bops and hearts, a realistic game shows
    health). The register sets the sheet's title and tier names (`REGISTER_WORDS`: anime or western).
  - It is a gate like the other books: `foes:cast` and `foes:<id>` are parts with prints, approved or sent back
    through `design_game`. They never hold a run back.
- **The casting call** (`gameworld/foe-casting.js` `castingCall`). It proposes a cast of four roles (grunt, harrier,
  elite, boss) from the intent cube's Mind values and combat, the flavor, the era's people and the target engine, with
  every choice's reasons.
  - A class the cube's `mind.foes` names is cast first.
  - One people, rolled from the era for the whole cast, wears every class that stands on two legs. A platformer keeps
    the stand-in beasts.
  - It is proposed and never written. `design_game`'s readout carries it as a `foes` step with the patch that writes
    it, and the sheet shows it until a bestiary is written.
- `node scripts/out-sheet.mjs foes [--genre <id>] [--propose]` writes the sheet for the example world.
- `docs/foes.md` has the sheet and the casting call. The `gameworld-foes` and `gameworld-next` cards name them.

Machine gate: `gameworld/foe-cast.test.js` passes. It covers one case per procedure (a beast, a people, a model, a mode
chain, a summoner, a counting flavor and a health flavor, the gate going stale), plus the casting call adopted as
written, the intent's classes first, a people's era and a platformer's beasts, and absence. Eyes gate: not run. The
operator looks at a platformer world's sheet and a shooter world's.
