---
{
  "id": "armor",
  "name": "Dress a hero in armour composed from intent and art direction (plate, samurai lamellar or hard-suit), optionally themed",
  "summary": "Worn armour on the hero from a style and a few dials: plate from one pauldron to full harness, or samurai lamellar with laced rows, shoulder boards, a hip skirt and a crested kabuto. The laws size every piece to the body; the hero stores the words and re-derives the suit on every read.",
  "when": "\"put my hero in a suit of armour\", \"a knight in full plate\", \"just one big pauldron and a breastplate\", \"samurai armour with a crescent crest\", \"red lacquered samurai armour with horns\", \"more stylized / chunkier armour\", \"less armour, leave the legs bare\", \"armour for my character in a style\", \"power armour with glowing lenses\", \"an undead knight covered in skulls\", \"holy paladin armour with wings\"",
  "entry": "mint_solid",
  "form": "object"
}
---
→ `mint_solid({ kind: 'layered', via: 'hero', spec: { cast, …, adorn: { type: 'armor', style, dials } } })`. `style`: `knight` (plate), the samurai `kuro-kon`, `aka`, `shiro`, the hard-suits `grim-scifi`, `fantasy-space`, `armored-hero`, or an inline card. `theme` (plate): `death-knight`, `radiant` or an inline card carries motifs down the suit. `dials`: `stylize` 0 realistic → 1 stylized (the focal piece grows fastest), `coverage` 0 (the focal piece alone) → 1 (the whole harness), `mass`, `ornament`. Under a kabuto set `hair: 'none'`. Restyle in place with `update_sketch` on `/hero/adorn/dials/<dial>`, `/hero/adorn/style` or `/hero/adorn/theme`, never a re-mint. Manual: `get_solid_vocab({ id: 'layered' })` (Armour). Held arms (a sword, a shield) are card `equipment`; the hero itself is card `hero`. Family: `get_creative_toolset({ form: 'object' })`.
