### Artesia's rail: the kingdom of Ceres as a chain of regions, each in its own light

The ground for a rail of Artesia's own: an action RPG in the Link to the Past and Link's Awakening mould, a fixed
chain of regions each opened by the dragon freed in the one before.

- **A village under the hour** (`era/village-look.js` `villageHour`, `VILLAGE_HOUR`): a storybook town's houses take the
  level's hour as its land does. Toward night they are dimmed to a third and drawn toward the night sky's hue, so a
  night town reads as night and its lit windows are the warm things in it. By day (the sky's `day` at 1) every byte is
  as it was. Before, the houses stood at noon's brightness under a night sky.
- **A world map laid as a region** (`gameworld/world-map.js` `worldMapLevel`): three opt-in words, each absent as
  before.
  - `names`: its blocks' names, by their place on the walk.
  - `climax`: the foes its climax stands (a region's dragon).
  - `opening: false`: a region come into later, nothing taught. A breath, then a pair on its way out.
- **Ceres: Artesia's own game** (`gameworld/artesia.js`, `fable-of-artesia`'s variant `ceres`).
  - **The story:** Artesia, chief of the royal guard and second in line to the throne of Ceres, is cast out by a
    facsimile of her brother, the prince, whom the wizard Olric holds in a crystal prison. Olric dominates the
    dragons through the Royal Amber. She frees them region by region and reforms the Amber from their shards.
  - **The regions** (`REGIONS`, a row each, in order):
    - Lagoona, a lagoon coast at noon (the storm dragon);
    - Athlan, highland terraces in the afternoon (venom);
    - Letzo, cold peaks in a pale morning (rime);
    - Khabar, desert badlands at golden hour (ember);
    - Imperial City, the capital at night (the hydra, Olric's last).

    Each is a world map (`regionLevel`): its blocks named, its storybook town, lit at its hour, every block moved
    off the world's palette by its own shift. Only the first teaches the controls.
  - **The chain:** the regions are a megaworld chain. Each way in is shut until the shard freed in the region
    before is held.
  - **Laid from the rail:** a locked pitch from the variant composes Artesia as before (hero, feel, arsenal, style,
    interface, sound) and lays the regions in place of its one map (`pitch-start.js`).
- **A dragon named on a map** (`gameworld/foe-casting.js`): a beat that names `dragon-<id>` is cast as that dragon
  of the boss shelf, standing as the boss stands, on that map beside its roles. A map that names none casts as
  before.
- **A lair grants its keys** (`gameworld/levels.js`): a boss's lair grants the keys its world's ways keep there into
  the bag as the boss is brought down (the game channel's `wins`). A freed dragon's shard is the next region's way
  in. A lair that keeps none, as before.
