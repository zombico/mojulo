---
{
  "id": "revise-character",
  "name": "Change a character you already made (body, face, hair, outfit, armour), same ref",
  "summary": "Any change to a made character goes to one door: its words merged into the recipe at any depth, a revision archived, never a re-mint.",
  "when": "\"change the character I already made\", \"make him taller and thinner\", \"swap her hairstyle for braids\", \"give him a beard\", \"put armour on my existing hero\", \"make the jerkin red instead\", \"an older look on the same character\", \"turn the armour's stylize dial up\", \"fix the eyes on my hero\", \"tweak my dragon's tail\", \"less armour on her legs\"",
  "entry": "update_character",
  "form": "character"
}
---
→ `update_character({ ref, spec })` on a character you already made, whatever part changes. `spec` merges a hero's words at any depth: `tune` and `face` as percentages of the cast and the fitted head (moves like `athletic`, `broad-jaw`), `hair` (a library word with `length`, `volume`), `detail`, `adorn` (an armour's `dials: { stylize, coverage, mass, ornament }` turn in place; a new `style` replaces the build); `null` removes one. A creature or an animal changes by `patch` ops on `/dials/<name>` or `/plan/...`. Same ref, a revision archived; never re-mint to change a thing. Its screen and its level's light: `target`, `geocube` (card `character-fidelity`). A drawn outline on it: card `stroke`. A NEW character is `create_character` (cards `hero`, `creature`, `animal`, `armor`). Manual: `get_solid_vocab({ id: 'layered' })`. Family: `get_creative_toolset({ form: 'character' })`.
