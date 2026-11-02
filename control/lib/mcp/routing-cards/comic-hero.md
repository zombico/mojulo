---
{
  "id": "comic-hero",
  "name": "Make a comic-book character by name (a superhero, a villain, a henchman) and give any hero a mask, cowl or helmet",
  "summary": "The comic hero pack's cast and crews, made by name as heroes the door keeps editable by word; and the headgear library, worn by any hero by word: masks, cowls, eyegear, mouthpieces, helmets, respirators, visors.",
  "when": "\"a superhero for my game\", \"a comic book villain and his henchmen\", \"the hero, his sidekick and his rival\", \"a supervillain mastermind\", \"a crew of street thugs to fight\", \"a masked vigilante\", \"put a cowl with bat ears on my hero\", \"give her a gas mask\", \"swap his helmet for a space helmet\", \"a ninja mask\", \"goggles pushed up on the forehead\", \"which masks and helmets can a hero wear\"",
  "entry": "create_character",
  "form": "character"
}
---
→ `create_character({ pack: { id: 'comic-hero', member: 'hero' | 'sidekick' | 'rival' | 'mastermind' | 'brute' | 'thug', look?, era?, headgear?, items?: 'signature' } })` makes one of the cast; `{ pack: { id: 'comic-hero', grunt: '<crew>', kind?, colourway?, index? } }` one of a crew's grunts (`streetGang` …). Looks: `anime-day`, `dcau-golden` (the default), `realistic-night`; eras `silver`, `modern`, `movie`. Any hero wears headgear by word: `spec: { headgear: '<word>' }` at mint, `update_character({ ref, spec: { headgear } })` to swap it, `null` to take it off; its colours under `palette`. The game body wears every word; the realistic body the domino and the cowl. Manuals: `get_solid_vocab({ id: 'comic-hero' })`, `({ id: 'headgear' })`. A hero from scratch: card `hero`. Family: `get_creative_toolset({ form: 'character' })`.
