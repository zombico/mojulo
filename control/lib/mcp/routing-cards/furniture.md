---
{
  "id": "furniture",
  "name": "A piece of furniture from a style and a few swaps",
  "summary": "A sofa, chair, table or piece of casework named by style, one form per slot, a finish and a size; a display asset by default, the jointed build on request.",
  "when": "\"a green velvet couch with rolled arms\", \"a mid-century armchair on tapered legs\", \"a farmhouse dining table\", \"a painted dresser\", \"the same sofa in linen with turned legs\", \"a sideboard for my living room\", \"furniture I can drop into my house\", \"a bookcase I could actually build, with a cut list\"",
  "entry": "mint_solid",
  "form": "object"
}
---
→ `mint_solid({ kind: 'furniture', spec: { like?, piece?, forms?, finish?, size?, buildable? } })`: a piece named by intent, not modelled part by part. `like` starts from a style (a chesterfield, a tuxedo sofa, a club chair); `forms` swaps one slot (arms, back, seat, legs, front); `finish` picks fabric, timber, board or paint; `size` is millimetres. By default a display piece for furnishing a house (place it with the house card's `rooms[i].items`). `buildable: true` stores the jointed build, which the furniture report (tip-over, racking, sag), the cut list and the bill of materials read. Restyle in place with `update_sketch`, never a re-mint. Manual: `get_solid_vocab({ id: 'furniture' })`. (A whole furnished room or house → `mint_building`; standard hardware for a build → `fabricate_solid`.) Full family → `get_creative_toolset({ form: 'object' })`.
