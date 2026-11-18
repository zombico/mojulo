---
{
  "id": "revise-character",
  "name": "Change a character you already made (body, face, hair, outfit, armour), same ref",
  "summary": "Any change to a made character goes to one door: its words merged into the recipe at any depth, a revision archived, never a re-mint.",
  "when": "\"change the character I already made\", \"make him taller and thinner\", \"swap her hairstyle for braids\", \"give him a beard\", \"put armour on my existing hero\", \"make the jerkin red instead\", \"an older look on the same character\", \"turn the armour's stylize dial up\", \"fix the eyes on my hero\", \"tweak my dragon's tail\", \"less armour on her legs\", \"put my logo on my hero's chest\", \"name my hero so my other games can use it\", \"swap her helmet for a mask\", \"put a hood on her\", \"give him a wizard's hat\", \"dress my hero as a rogue instead\"",
  "entry": "update_character",
  "form": "character"
}
---
→ `update_character({ ref, spec })` on a made character, whatever part changes. `spec` merges a hero's words at any depth: `tune` and `face` in percentages (moves `athletic`, `broad-jaw`), `hair` (a word with `length`, `volume`), `detail`, `outfit` (a ready card by `style`, fantasy `ranger` … `rogue`; `pieces: [{ kind: 'cloak', hood: { worn: 'up' } }]` adds a hooded cloak), `adorn` (an armour's `dials` turn in place; a new `style` replaces the build), `headgear` (a mask, a helmet, `circlet`, `wizardHat`, `travelerHat`); `null` removes one. A creature or an animal: `patch` ops on `/dials/<name>` or `/plan/...`. Same ref, a revision archived; never re-mint. Its screen and its level's light: `target`, `geocube` (card `character-fidelity`). A drawn outline: card `stroke`. Name and mark it: `spec: { name, emblem: { layers: [{ path: an SVG d, role?, color? }], at: 'chest' } }` (a game adopts it by name). A NEW character is `create_character` (cards `hero`, `creature`, `animal`, `armor`). Manual: `get_solid_vocab({ id: 'layered' })`. Family: `get_creative_toolset({ form: 'character' })`.
