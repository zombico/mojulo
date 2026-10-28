### Juice fidelity: the venue's and the era's drawing, and the platformer's and pinball's movement juice

A game's effects were composed from a register (how they look) and a game type (how they play). They now also have a
FIDELITY: how finely they are drawn, read from the venue and the era. A voxel stadium's blast is a heap of tumbling
blocks; the sixth generation paints a flash's light on the ground; the seventh throws it on the lit world and blooms
round the hot core. The platformer and pinball also gain movement juice on the hero: what the world shows round a jump,
a landing and a run at speed. No fidelity word: every effect as it was.

- **The floor's fidelity** (`scene/juice-style.js` `JUICE_FIDELITIES`, an `fxStyle`'s `fidelity`):
  - **`voxel`:** every particle a cube, drawn on twos. No thrown light: the flash is a flat square of light on the
    ground.
  - **`paint`, the sixth generation:** the flash's light laid on the ground as a soft pool, because a paint world takes
    no lamp.
  - **`form`, the seventh generation:** more light thrown on the lit world, a bloom halo round every hot core, more
    sparks.
  - **`era`:** drawn at the read's era (gen-6 paint, gen-7 form), so the same recipe renders at either.
  - An explosion carries its `pool` and its `bloom`, and its length covers them.
  - The page's events channel emits the cube glyph, the pool and the bloom only when a floor uses them, beams' sparks
    included.
- **A machine's juice at its fidelity** (`car-designer/juice.js` `rigFidelity`, `bakeJuice`'s `fidelity`):
  - Racers' and supercars' smoke, dust and sparks are drawn as:
    - tumbling blocks at a voxel kit or a voxel stadium;
    - flat cel discs at an anime stadium (banded);
    - hot cores in a wide bloom when read in the seventh generation.
  - The paint tier is the page's own soft sprite, written as no key. A world's composed floor wins over the venue.
- **The hero's movement juice** (`gameworld/feel/hero-juice.js`):
  - Rows for the page's rig juice (the racer's engine), at the body's feet, middle and head. They are baked onto a hero
    resolved under a composed floor of that game type.
  - **The platformer:** a puff at the take-off; dust and a squash ring on a landing, more the harder the fall; a ring of
    air under an air jump; skid dust on a hard stop; stars from a stomp or a boop; the buster's charge in its three
    colours; a white flash on a hit and the mercy's flicker after it.
  - **Pinball:** a trail of light at the feet past running pace; the air streaking past near the top speed; speed lines
    on the screen in a surge; a ring of air thrown back as a boost starts; the spin dash's sparks revving in its
    colours; ricochet stars off a bumper; the body glowing while it revs.
  - **Realistic and action:** no movement juice; their effects are the floor's.
  - **Facts:** the page reads the platform rule's facts for a hero's juice only. Its speed comes from how far it went,
    because the rule moves a body directly. The facts are a jump's frame, an air jump's, the landing and its speed, a
    hard stop, the charge, a blow taken and a bump.
- **A gameworld stamps its fidelity** (`gameworld/juice.js`): `voxel` for a voxel stadium (its quick words' venue) or a
  voxel kit, else `era`. The operator's word wins over both, and the readout says where it came from.
- **Held:**
  - `juice-fidelity.test.js`:
    - the word read and refused;
    - each fidelity's composition, and none without one;
    - the pool and the bloom;
    - the page's emission;
    - a machine's fidelity from the floor, the venue and the era;
    - the hero's rows by game type at the body's anchors;
    - the hero's facts emitted only with its juice;
    - the gameworld's stamp.
  - `hero-juice.live.test.js` (e2e, real browser): a platform body runs, jumps, air-jumps and lands. The platformer's
    take-off puff and landing dust fire, pinball's trail runs at speed, and no fidelity raises a page error.
- **Seen:** the proving ground's blast at each fidelity (`proving-ground.mjs --juice material:action:<fidelity>`).
  Voxel reads as blocks with a square pool; paint and form differ at the flash (its pool, its bloom). The hero's juice
  was checked by the live test's numbers, not by eye. The eyes gate is open.
- **Not built, said:**
  - Juice inside the sports pages (the contest channel's ball, its hits and its points).
  - Smoke lit by the key, soft particles, heat haze.
  - The voxel tier's particles stepped on twos in the rig juice: its blocks tumble but move every frame.
