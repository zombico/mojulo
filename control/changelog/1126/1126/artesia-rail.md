### Fable of Artesia, its new game: the world of Ceres as a chain of regions, each in its own light

Fable of Artesia's game, made new: an action RPG in the Link to the Past and Link's Awakening mould, its heroine
silent, a fixed chain of regions each opened by the dragon freed in the one before.

- **A village under the hour** (`era/village-look.js` `villageHour`, `VILLAGE_HOUR`): a storybook town's houses take the
  level's hour as its land does. Toward night they are dimmed to a third and drawn toward the night sky's hue, so a
  night town reads as night and its lit windows are the warm things in it. By day (the sky's `day` at 1) every byte is
  as it was. Before, the houses stood at noon's brightness under a night sky.
- **A world map laid as a region** (`gameworld/world-map.js` `worldMapLevel`): three opt-in words, each absent as
  before.
  - `names`: its blocks' names, by their place on the walk.
  - `climax`: the foes its climax stands (a region's dragon).
  - `opening: false`: a region come into later, nothing taught. A breath, then a pair on its way out.
- **Ceres, the rail's world** (`gameworld/artesia.js`, the `fable-of-artesia` rail's starter).
  - **The story:** Artesia, chief of the royal guard and second in line to the throne of Ceres, is cast out by a
    facsimile of her brother, the prince, whom the wizard Olric holds in a crystal prison. Olric dominates the
    dragons through the Royal Amber. She frees them region by region and reforms the Amber from their shards.
  - **The regions** (`REGIONS`, a row each, in order):
    - Lagoona, a lagoon coast at noon (the storm dragon);
    - Athlan, highland terraces in the afternoon (venom);
    - Letzo, cold peaks in a pale morning (rime);
    - Khabar, desert badlands at golden hour (ember);
    - Imperial City, the capital at night (the hydra, Olric's last).

    Each is a world map (`regionLevel`): its blocks named, its storybook town, lit at its hour, on its own cube
    (`regionCube`). That cube is the world's, with the region's land (a biocube: coast, upland, alpine, desert, bare;
    Letzo's snow) and the world's palette moved by the region's shift. The level's land is read whole from its cube,
    so a block's own shift never reached the ground. Every region shares the world's palette seed (the one stamped,
    else settled from the world's seed), so each is one palette moved, never a palette of its own. Only the first
    region teaches the controls.
  - **The chain:** the regions are a megaworld chain. Each way in is shut until the shard freed in the region
    before is held.
  - **Laid from the rail:** a locked Fable of Artesia pitch composes Artesia as before (hero, feel, arsenal, style,
    interface, sound) and lays the regions in place of its one map (`pitch-start.js`).
- **A dragon named on a map** (`gameworld/foe-casting.js`): a beat that names `dragon-<id>` is cast as that dragon
  of the boss shelf, standing as the boss stands, on that map beside its roles. A map that names none casts as
  before.
- **A lair grants its keys** (`gameworld/levels.js`): a boss's lair grants the keys its world's ways keep there into
  the bag as the boss is brought down (the game channel's `wins`). A freed dragon's shard is the next region's way
  in. A lair that keeps none, as before.
- **Snow on a map** (`era/geocube.js`, `era/stage-buildings.js`): a glyph map's tile under a snowy cube carries the
  cube's snow onto its polygon land, as a trail does, so a region's cover lies on every tile of it (Letzo's). A
  building stands on the snow as on the ground it covers. A cube with no snow, as before.
- **The atlas of a world of world maps** (`gameworld/atlas.js`, `atlas-illustrated.js`): a world whose levels are
  world maps now draws as one map. Before, it was refused.
  - **Each region:** its blocks are stops along its walk, and its towns and its keep stand at theirs.
  - **Its boss's lair:** stands at the walk's end where its climax calls one, drawn on the painted map as a cave's
    mouth in a crag and named for its boss ("the Storm Drake's lair").
  - **The regions** are joined by their gates.
  - **Its trees by its biocube:** a coast's palms, an alpine land's conifers, a desert's or a bare land's few trees
    and more stones.
- **The plains between the towns** (`gameworld/world-map.js` `plains`, `PLAINS`): a world map may lay open blocks
  between its first zone and its town.
  - **The ground:** a road runs straight across each. A band camps beside the road, off it, and holds no way shut:
    fought, or ridden past.
  - **In Ceres:** each region lays two (Lagoona's dune plains and reed flats; Letzo's white plains and frost fields;
    Khabar's salt flats and red steppe), so its towns stand further apart. None asked, the map as it was.
- **Seimos on the plains** (`level/grid.js` region word `ride`, `gameworld/levels.js`, `worlds/world-scene.js`,
  `worlds/mount-units.js`).
  - **A ridden land:** a region that says `ride: true` is open country. The world's horses stand on a map's pages
    only where their blocks are ridden (the plains), and a map's page now lowers them as a controllable world's
    does. Ceres's world keeps one: Seimos, grey, who comes when called.
  - **Fighting on foot:** riding hands the stick to the horse, so a band is engaged only on foot, Seimos left
    standing.
- **A horse called** (`worlds/controllable/mount.js`, `scene/channels/mount-ride.js`).
  - **The rule:** a mount may say its `name` and `call: true`. H whistles (`mountCall`): the nearest free horse
    comes to its rider on foot on its own stick, turned toward them, checked by its stopping distance, and stands
    inside its reach to be got on.
  - **The prompt** offers the call by name ("H call Seimos") when no horse is in reach. A page with no horse that
    comes when called emits as it did.
- **A rider's cloth on any body** (`polygonizer/hero-flow.js`): the cape's cloth replays a clip the body plays
  clamped, a rider's legs stretched to the irons, never refusing it. A clip that reached as solved is replayed as it
  was.
