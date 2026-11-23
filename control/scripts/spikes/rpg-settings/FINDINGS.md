# RPG settings: one colour relationship, many places

`node scripts/spikes/rpg-settings/run.mjs <out dir> [id,…]` composes fourteen fantasy settings from the words a person
would say of each (gameworld/compose.js LEXICON, CUBE_WORDS), colours each one's trail level with ONE relationship
(the home valley's character, `GEOCUBE_PALETTES['valley-morning']`, one seed) moved by `palette.shift` (turn, warm,
chroma, light), sets its hour, and shoots it in headless Chromium. ~90 s a setting.

## The colour: it works

- **The relationship holds.** Every setting keeps the valley's roles (sky over ground over foliage, the accent apart,
  the key and value groups) while its hues move. Mood reads from the turn and warmth alone (Harvest's amber, Whisperwood's
  violet hush, Mire's sickly cyan, Crystal's deep blue, Emberreach's rust); intensity from chroma and value (calm 1.0 and
  0, dire 1.2–1.5 and −0.35 to −0.45).
- **The dire end is too dark to play.** Blighted Reach and Shadowkeep at −0.4/−0.45 under night and storm lose the
  figures: intensity needs a value FLOOR on the fighters' ground and a rim, not only a lower key.
- **A turn moves the sky with the land.** A whole-palette turn makes Frostmere's ground blue and Stormbreak's sky
  purple; most settings want a role kept (a natural sky, a readable path): `lock` per role, or a turn per role group.

## The places: they do not change enough (the gap)

Every setting stands on the same trail, the same boulder, the same trees, recoloured. What the words compose:

| Reaches the geocube | Dropped on a geocube level |
|---|---|
| water: `river`, `lake`, `coast` (`outside.water`) | canyon strata, butte, mesa (`land.strata`, `land.landmark`) |
| dunes (`outside.dunes`), snow (`snow`) | spires, arches, monoliths, falls (`land.landmark`) |
| a biome's flora (`biocube`: desert, alpine, coast, seabed) | basalt columns, crags, cliffs (`land.face`) |
| crystals (only as a cube change, no word) | sea stacks, hoodoos, boulders (`land.rock`) |
| a preset by word (gothic, swamp, jungle, limestone) | clouds (`land.cloud`) |

The `land.*` words are the polygon land's (the terrain kinds'); a trail the geocube paints never reads them. That is
why "a sandstone canyon with spires, arches and a waterfall" is a valley.

## Failures

- **A world does not compose on snow or on the seabed.** "snowy alpine heights", "an underwater coral reef" and "the
  abyss": the hub street's own shop finds no place on the land beside its trail (`stage: buildings[0] (town-shop-1)`).
  The hub keeps the setting's land; it should keep a town's.
- **"forest" is bamboo** (`LEXICON.forest: { kit: 'isekai-bamboo' }`); a broadleaf wood is only reached through
  "pine" (alpine trees).
- **The opening line covers the view** on every first level (the round's story): expected; the spike skips it.

## Not in the geocube at all

Volcanic ground and lava (glow is only `emissive`, outside the cube); corrupted or blighted land; sky islands; a swamp
biocube (standing water, reeds, dead trees: the word only picks jungle-haze); mushroom or giant-tree woods; glowing
magic flora on open land; ruins on open land (`condition` is rooms'); a coast seen from the trail (it composes, it is
not in view).

## What a preset is, then

A setting = the words' cube + a hue shift on the shared relationship + an hour + weather + its intensity. Ready now
(colour and dressing both read): Verdant Vale, Harvest March, Whisperwood, Sunscar Dunes, Mire of Sorrows, Crystal
Hollows. Ready in colour, waiting on landforms: Redrock Canyon, Stormbreak Coast, Emberreach. Waiting on the composer:
Frostmere, Sunken Reef, Abyssal Trench. Waiting on a value floor: Blighted Reach, Shadowkeep.
