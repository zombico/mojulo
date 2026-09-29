---
{
  "id": "armor",
  "name": "Dress a hero in armour composed from intent and art direction (plate or samurai lamellar)",
  "summary": "Worn armour on the hero from a style and a few dials: plate from one pauldron to full harness, or samurai lamellar with laced rows, shoulder boards, a hip skirt and a crested kabuto. The laws size every piece to the body; the hero stores the words and re-derives the suit on every read.",
  "when": "\"put my hero in a suit of armour\", \"a knight in full plate\", \"just one big pauldron and a breastplate\", \"samurai armour with a crescent crest\", \"red lacquered samurai armour with horns\", \"more stylized / chunkier armour\", \"less armour, leave the legs bare\", \"armour for my character in a style\"",
  "entry": "mint_solid",
  "form": "object"
}
---
→ `mint_solid({ kind: 'layered', via: 'hero', spec: { cast, …, adorn: { type: 'armor', style, dials } } })`. `style`: `knight` (plate) or the samurai `kuro-kon` (a crescent), `aka` (red, horns), `shiro` (a sun disc), or an inline card. `dials`: `stylize` 0 realistic → 1 stylized (the focal piece grows fastest), `coverage` 0 (the focal piece alone) → 1 (the whole harness), `mass`, `ornament`. Under a kabuto set `hair: 'none'`. Restyle in place with `update_sketch` on `/hero/adorn/dials/<dial>` or `/hero/adorn/style`, never a re-mint. Manual: `get_solid_vocab({ id: 'layered' })` (Armour). Held arms (a sword, a shield) are card `equipment`; the hero itself is card `hero`. Family: `get_creative_toolset({ form: 'object' })`.
