---
{
  "id": "revise-character",
  "name": "Change a character you already made (body, face, hair, outfit, armour), same ref",
  "summary": "Any change to a made character goes to one door: its words merged into the recipe at any depth, a revision archived, never a re-mint.",
  "when": "\"change the character I already made\", \"make him taller and thinner\", \"swap her hairstyle for braids\", \"give him a beard\", \"put armour on my existing hero\", \"make the jerkin red instead\", \"an older look on the same character\", \"turn the armour's stylize dial up\", \"fix the eyes on my hero\", \"tweak my dragon's tail\", \"less armour on her legs\", \"put my logo on my hero's chest\", \"name my hero so my other games can use it\", \"swap her helmet for a mask\"",
  "entry": "update_character",
  "form": "character"
}
---
→ `update_character({ ref, spec })` on a character you already made, whatever part changes. `spec` merges a hero's words at any depth: `tune` and `face` as percentages of the cast and the fitted head (moves like `athletic`, `broad-jaw`), `hair` (a library word with `length`, `volume`), `detail`, `adorn` (an armour's `dials: { stylize, coverage, mass, ornament }` turn in place; a new `style` replaces the build), `headgear` (a mask or helmet word); `null` removes one. A creature or an animal changes by `patch` ops on `/dials/<name>` or `/plan/...`. Same ref, a revision archived; never re-mint to change a thing. Its screen and its level's light: `target`, `geocube` (card `character-fidelity`). A drawn outline on it: card `stroke`. Name it and mark it: `spec: { name, emblem: { layers: [{ path: an SVG d, role?, color? }], at: 'chest' } }` (a name its own on this machine; a game adopts it by name). A NEW character is `create_character` (cards `hero`, `creature`, `animal`, `armor`). Manual: `get_solid_vocab({ id: 'layered' })`. Family: `get_creative_toolset({ form: 'character' })`.
