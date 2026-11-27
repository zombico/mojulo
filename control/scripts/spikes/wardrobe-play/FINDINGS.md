# The wardrobe on the page, with its real bodies

`node scripts/spikes/wardrobe-play/run.mjs <out dir> [town|wilds]` composes the party RPG starter with
`battles.wardrobe: true`, makes what one level's party stands on as `design_game`'s run makes it (the casting, the hero
and its equipped figure, each cast member, each look), and plays the first wilds block with a pack in headless
Chromium. The folk and the foes are stood in. About 16 minutes, most of it the making (the casting alone is ~110 s).

## What it found

- **The looks play.** Loaded, each member shows what its starting gear names (two of the party begin in leather, the
  hero and the cleric in their robes, which are cloth and change nothing). Taken off, each is in its own clothes; put on,
  each swaps to its look, the fighter's to its mail. Begun, the fight is fought by all four in what they wear (the battle
  is played by the map's figures). No page error.
- **Mail was refused on the anime head.** The cast member with the anime head could not be made in chain mail: the
  coif's cranium pieces are not fitted to that head (the hero door refuses a helm there). Fixed: on the anime head the
  mail family leaves its coif off the head and keeps the drape over the shoulders (`polygonizer/hero-dress.js`
  dressPlan; `lib/mcp/tools/layered-armor.test.js`). A plate helm is still refused there, as it was.
- **A run could not record a hero's look.** Found in step 3 and fixed then (`gameworld/made.js` `MADE_KEY`).
- **What the looks cost the page.** The level's page is 51.7 MB with its five looks and 47.6 MB without: about 4 MB, a
  look ~0.8 MB (its own skinned body; the clips are the library's). Mind it on a host with a page limit
  (docs/workshop.md).
- **What the hero wears under leather is its own.** The look keeps the member's top and bottom (here a tan knit top and
  trousers) and leaves off only its outer layer, which the armour stands for.

## Not the wardrobe's

- The fight's camera on this block stands behind a broad canopy, which fills half the frame (`4-battle.png`).
- A member joins on its flag (`flag-<joins>` in the bus's vars) or `rpg-join:<member>`; `window.__mojBus` has no
  `press`: events go through `__mojBus.bus.processEvents(__mojBus.state, [{ type }])`.
