---
{
  "id": "palette",
  "name": "Colours solved for what a world is",
  "summary": "A palette by colour theory, not a stock kit: the key, a chroma budget, hue relations by scheme, warm-light and cool-shadow ramps, checked; one spec recolours a gameworld's land, its game's HUD and a cover.",
  "when": "\"what colours should this world be\", \"make it feel colder and heavier\", \"give my game its own look\", \"every game looks like the same meadow\", \"a palette for a desert at noon\", \"a grey world with one red accent\", \"show me a few colour options\", \"the HUD doesn't match the world\", \"pick colours for the cover\"",
  "entry": "pick_palette",
  "form": "game"
}
---
→ Read the world's words into `heat` (cool −1 … warm 1), `weight` (light −1 … heavy 1), `activity` (calm −1 … active 1), then `pick_palette({ intent, heat, weight, activity, scheme?, key?, hue?, variants: 3 })`: each palette's spec, role ramps, HUD tokens and checks. Pass the chosen spec as `palette`: `design_game` world `style.palette` (recolours the land from its kit or look, and the game's HUD), `create_game`, `create_cover`, `design_interior`, a stage's `art.palette.from` or `tone.from`, a world's `look.palette`. Schemes: analogous, complementary, split-complementary, triad, tetrad, mono-accent (a grey world, one accent), duotone. Keep a colour exactly: `lock: { ground: '#8a5a38' }`. A new gameworld naming no kit or look gets a palette rolled for it; `palette: false` keeps a kit's own. (Contrast: a look in words, shapes and colour together → `style.look`.) Full family → `get_creative_toolset({ form: 'game' })`.