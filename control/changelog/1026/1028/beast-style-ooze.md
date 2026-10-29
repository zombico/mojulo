### Beast style: the cover's qualities, and oozes on the beast-kin

The seventh generation's cover had one look per kind, while the older generations gave a coat style qualities: the
egocube creature's cell sizes, scutes and feather rows; the fauna's coats. The animal door's oozes (frost, venom, dire,
transmetal …) styled only a species' ring plan. This theme carries both onto the beast-kin.

- **The cover's qualities** (`beast/cover.js` `COVER_STYLE`; `beast.cover: { kind, length?, size?, shape?, sheen?,
  tipped? }`):
  - fur: `length` short, plush (the default) or shaggy;
  - scales: `size` fine, medium or large, and `shape` round or keeled (a ridge down each scale); chitin and feathers:
    `size` small, medium or large;
  - any cover: `sheen` matte, satin (the kind's own), glossy or metal (the material's metal channel full), and
    `tipped` 0 … 1 (the coat darkened toward its roots, its crests light: frosted or banded tips).

  Each word moves its tile; a cover named by its kind alone is the tile as it was, byte for byte. The door refuses a
  quality its kind does not take, by name.
- **Oozes on the beast-kin** (`beast/ooze.js`, `beast/style.js`; `beast.ooze`, `beast.seed`). The animal door's word
  and its composition law: a word, or a list of words and `{ id, strength }`, composed by `mutagen/compose.js` and
  `push.js` as for an animal, then lowered onto the beast's anatomy:
  - its growth onto the masses (bulk, legBulk, the wedge's fore and hind, the neck, the limbs, the paws), each
    multiplier read at half its strength on an upright body (`UPRIGHT_MASS`: a dire animal's chest ×1.45 swelled an
    upright trunk into a barrel); its `headScale` onto the head;
  - its colour layers (darken, desaturate, saturate, tints) onto the coat, before the head is dressed in it;
  - hackles, plates or tail spikes as a crest of spines in a group of its own (`Spines`), in the hackles' or the
    motif's colour, glowing and of the motif's material as the row says; a ruff as the ruff;
  - the motif onto the claws' tone, glow and material; the eyes' colour onto the head's iris, a glow lighting it;
    the head's skull and muzzle pushes as the designed head's row moves, its eye grown; its expression added;
  - a recoloured group where the body or its head has it (transmetal's chrome faceplate on the library head's
    `Skull` and `Snout`), its surfaces; a colour word (`accent`, `suit` …) against the coat, as for an animal;
  - a new `cover` push on the rows (frost's rimed glossy tips, crystal's glass, transmetal's metal, venom's wet gloss,
    shadow's and zombie's matte, dire's shagginess) onto the cover's qualities, the ones its kind takes. An animal
    reads none of it: its oozes emit as before.

  A word the hero names itself stands over the ooze's. What the tiered body does not carry yet is named in the
  lowering's `pending`: the ooze's `scale` (the tiered body's size is its tune's stature), horns, fangs, ears, pistons,
  armour, and the marks.
- **The marks are not painted on the biped.** The fauna's markings (band, belly, stripes, patch, spots) are windows in
  a quadruped's frame: `t` from the spine down to the belly, `run` from the rump to the chest. Painted onto the upright
  body's rings they read inside out (a glowing belly became a bib over the whole front, flank stripes hoops), and the
  rings are too coarse for a pattern finer than a ring. They wait for a biped's own pattern solver.

Machine gate (`beast/ooze.test.js`): each cover word moves its tile and the default does not; an ooze tones the coat,
raises a glowing crest in its own group, lights the eyes and styles the cover, deterministic, the hero's word standing;
a composition grows the masses at the upright power, its pending named; a recoloured head group lands; the door's
refusals; an oozed beast binds and rigs whole. The presets' pin is unchanged (`beast/composer.char.test.js`). Eyes: one
wolf-kin through frost, fire, venom, dire with half venom, shadow, transmetal and zombie (the operator's to judge).
