---
{
  "id": "equipment",
  "name": "Fantasy arms from intent and art direction",
  "summary": "Compose a sword, dagger, greatsword, staff, bow or shield from an item, a style and a few dials; the laws size every part.",
  "when": "\"a fantasy sword with a big gem\", \"an elven bow\", \"a druid's staff\", \"a wizard staff with a crystal\", \"a heater shield with a sunburst\", \"weapons for my hero\", \"make the sword more stylized / anime\", \"gear in a dwarven style\", \"a warlock's staff\", \"a style guide for our weapons\"",
  "entry": "mint_solid",
  "form": "object"
}
---
→ `mint_solid({ kind: 'equipment', spec: { item, style, dials?, parts?, gem? } })` — arms named by intent, not modelled part by part. `item`: dagger / sword / greatsword / staff / bow / shield. `style`: a sample (historical, elven, dwarven, brutal, eastern, anime-hero, druid, celestial) or an inline card. `dials.stylize` 0 realistic → 1 stylized grows the signature (the stone) fastest; `focus` says where it sits. Restyle in place with a patch on `/build/…`, never a re-mint. Read the laws and slots first via `get_solid_vocab({ id: 'equipment' })`. (Contrast: an arbitrary everyday object from primitives → kind `workbench`; composing finished parts → kind `assembler`.) Full family → `get_creative_toolset({ form: 'object' })`.
