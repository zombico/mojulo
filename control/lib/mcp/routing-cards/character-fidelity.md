---
{
  "id": "character-fidelity",
  "name": "Draw a character for its target screen and in its level's light (the polygons a resolution needs; baked in the geocube's light)",
  "summary": "A character's rings are set by what it is drawn for: the resolution and how the camera frames it say how many pixels each part covers, and each body part gets the sides its outline needs within a pixel error. A geocube lends its light (the key, a tinted shade, a rim from its air), its era's look and its target.",
  "when": "\"my hero looks faceted on a 4k screen\", \"a higher-detail version of my character\", \"more polygons on my hero\", \"my game is 1080p third-person\", \"a close-up hero for cutscenes\", \"a top-down game, keep the characters light\", \"make my character match the level's look\", \"light my knight like the gothic night level\", \"update my character\", \"revise my hero without JSON pointers\"",
  "entry": "update_character",
  "form": "character"
}
---
→ `update_character({ ref, target: '1080p' })` or `{ resolution: '4k', framing: 'close', error: 1 }`: each body part (trunk, neck, limbs, feet) whose outline misses by more than `error` pixels there takes one split, twice the sides. Framing words: close, third-person (default), wide, top-down. Today's hero holds 720p third-person within a pixel. `update_character({ ref, geocube: 'gothic-night' })` bakes it in the cube's light and takes the cube's target unless `target` is named. `spec` merges a hero's words key by key (null removes one); `patch` takes update_sketch ops for a creature or an animal. The readout's `density` gives each part's radius in pixels, sides, the sides it wants and its error, and the era's conventions still planned. Advice, never a refusal. Mint first with `create_character`; the level's cube is card `geocube`. Family: `get_creative_toolset({ form: 'character' })`.
