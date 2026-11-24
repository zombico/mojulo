### XenoJager: a dangerous planet in the metroidvania box's idioms

- A new visual library for the metroidvania box: `xeno`, a dangerous planet explored down through its crust
  (`docs/metroidvania-map.md` "XenoJager: the planet"). The box, its rings, gates, pockets, climbs and two-screen towers
  are the castle's own. The planet draws them in a new library:
  - **The crust.** Its walk is open under a ringed planet, a second moon and spires of rock, a crag behind the walk, and
    the explorer's lander in the room she enters by.
  - **The caverns.** A cave's walls in rough beds of rock with wandering seams, stalactites, stalagmites near the lane,
    and crevices glowing with a deeper cavern.
  - **Its pieces.** Boulders, crystals, giant fungi, tendrils, waterfalls and lava falls, the ruins and monoliths of a
    people before, a fossil, a great bloom, egg pods and the nest at the core.
  - **Its light.** Lamps are glowing pods. The water, the lava, the glowing life and the tendrils move on the page's
    ambient channel.
- Nothing on the planet is laid in courses. Its rock breaks as rock does: boulders of every shape with dark cracks
  between them, on the cave's wall, the fabric's floors, walls and roofs, and the walk's top.
- Its boulders and crystals are mojulo's own materials:
  - **Boulders** are real rocks, fractured and grained by their minerals, of each look's rock (basalt, slate, marble,
    granite).
  - **Crystals** are real stones of each look's gem (amethyst, sapphire, tourmaline, ruby, quartz), shaded live by the
    page. Grown out of a wall, they throw no print onto the room below.
  - A boulder or a druse counts as one piece of detail in the backdrop's laws, however many faces it has.
- The fabric builds a rock look's closed parts as rock, where the castle builds masonry: stairs and landings as
  boulders, doorways as cave mouths, a tower's wall cracked through each storey, metal ladders, and the crust's crags
  along the top.
- `xenoJager()` gives the planet's map words: the crust, the fungal caverns, the flooded depths and the magma core, with
  three powers opening the castle's three gates. Every law the castle holds, the planet holds.
- There is no XenoJager game yet. `XENOJAGER_HANDLE` says what the next builder wires: the hero (an explorer in a suit,
  her arm a cannon), the feel (the run and gun's, its wall kept) and the hazards. The looks' water and lava are recorded
  in each room's plan for a suit's power and a gate kind to come. Its HUD card is wired already: `nocturne-xeno`, a
  re-key of the castle's Nocturne.
- The backdrop shots take `--xeno` to review the planet.
- A look may name a `first` focal piece, the one the box's entry room shows in place of its ring's.
