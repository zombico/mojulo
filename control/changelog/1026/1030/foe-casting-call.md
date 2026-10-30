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
- **A person dressed as a crew** (`foes/dress.js`). `skin: { people: 'human', dress: { faction, kind?, colourway?,
  body? } }` dresses a soldier, a guard or a cultist from the comic hero pack's grunt factions: the kind's build,
  clothes, headgear and gear, and the crew's colours.
  - Made through the hero door (`foes-<id>`, its reactions on it) and stood on the library as any made person. The
    pack's baked golden light is left off, so a foe stands in its world's light. `body: 'realistic'` draws it on the
    realistic body.
  - Only a person is dressed, and the dress names its build and age; its facets name only its pole.
  - The casting call dresses a cast of people as one crew (`ERA_DRESS`): its faction by era, a soldier's for a shooter
    or a stealth game, its colourway rolled, each role a kind of it and the boss the heaviest. A modern stealth world
    is cast as private military in one colourway.
- **Foes in a building's rooms.** `levels.<id>.foes` now stands on a building level, each room between the way in and
  the goal a beat. Without a count a building stands `ROOM_FOES` of its rooms, spread from the way in to the goal (an
  office has dozens of rooms). The walker or the hero in it takes their hits as on a trail: a building level now lays
  its extra's `pilot` as a trail level does, and no building cast carried one before, so no building level moves. A
  building made by ref still takes none. The casting call places foes in buildings too, its boss one of it.
- **The patrol** (`foes/classes/patrol.js`, the `patrol` move in `foes/vocab.js` and `worlds/controllable/foe.js`). It
  walks its round between two posts and back, watching ahead. A hero in its sight (the mind's range and cone, and a
  clear line past the colliders) hands it to the mind that same step, which perceives the hero and engages. Once the
  mind has seen no one for `calm` seconds, it walks its round again. Web only: Godot and Roblox are marked absent. The
  regenerated hill-climb page moves by its lift (Godot 46 → 48 of 500 rolled worlds).
- **Oozes as variants.** A beast grown by oozes is a variant of the same class on the same species grown by none.
  - The cast sheet reads each ooze at its strength and its stylism, draws a variant in its ooze's own colour (the ooze
    row's tint) outlined in its tier's, names the two to each other, and says that an ooze grows a beast's shape, never
    its stature.
  - The casting call grows a beast cast by the world's oozes: its character book's elements (`ELEMENT_OOZE`) and its
    era's (`ERA_OOZES`), at most `MAX_VARIANTS`. It makes a variant of each beast role per ooze, met from the second
    level on, and grows the boss itself (`BOSS_OOZE`, dire, with the world's first). A growth that no longer fits its
    class is left off and said.
- **The sheet in its world's colours.** The cast sheet is drawn as the world's bible is:
  - The lineup stands on the world's own sky and ground (its kit's colour key), and the page's accent is the kit's
    paint.
  - The cover takes the lineup as its plate, with the strip of levels in the order they are played, each showing who
    stands on it.
  - The casting call is the bible's own blocks: the ledger of what it read, a civilization's article for each role (its
    plate beside the hero, why this class, its variants, its dress), and the strip of who would stand where.
  - The play order moved from the world bible into `gameworld/graph.js` (`playOrder`), shared by both.
- The `gameworld-foes` card names the dress and a building's rooms and gains the patrol's row. Its ceiling is re-pinned
  at 5120 bytes (4916), with the reason beside the pin.
- `node scripts/out-sheet.mjs foes [--genre <id>] [--propose]` writes the sheet for the example world.
- `docs/foes.md` has the sheet and the casting call. The `gameworld-foes` and `gameworld-next` cards name them.

Machine gate: `gameworld/foe-cast.test.js`, `foes/dress.test.js`, the building and dressed cases in
`gameworld/foes.test.js` and the patrol in `worlds/controllable/foe.test.js` pass. They cover one case per procedure (a
beast, a people, a model, a mode chain, a summoner, a counting flavor and a health flavor, the gate going stale, a
dressed person, a building's rooms, a patrol seen and unseen, a variant and its oozes), plus the casting call adopted
as written, the intent's classes first, a people's era, a platformer's beasts, a dressed crew, ooze variants met deeper
in, the sheet in its world's colours, and absence. Eyes gate: not run. The operator
looks at a platformer world's sheet and a shooter world's, and at a dressed soldier made through the door.
