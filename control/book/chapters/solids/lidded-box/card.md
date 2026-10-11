---
{
  "id": "lidded-box",
  "name": "Box with a lid (a part by name)",
  "entry": "mint_solid",
  "family": "object",
  "summary": "A rounded box and a drop-in lid printed at true size, sized by the space inside; the lid's lip slips into the opening at a printed fit. Two parts laid out as they print. Name it and get one; give the inside to fit what it holds.",
  "when": "a box with a lid; a small storage box; a lidded container for screws / SD cards / jewellery; a box that holds a deck of cards; a box sized to fit my thing inside; a pill box; a trinket box"
}
---

A recipe-book part: name it and the part's builder writes the OpenSCAD program from its params. Mint with
`kind: 'scad'` and `spec: { part: 'lidded-box', params? }`; every param has a default. The row has two parts,
`base` and `lid`, side by side as they print, the lid upside down. Patch `/params` to change it; a hand edit under
`/source` detaches it.

## Params

| param | default | range | what it sets |
|---|---|---|---|
| `inside_w`, `inside_d`, `inside_h` | 80, 50, 35 | 10–250, 10–250, 5–200 mm | the space inside, floor to rim: size it to what it holds plus a little air |
| `wall` | 2 | 1.2–6 mm | walls, floor and lid |
| `corner` | 5 | 0–30 mm | outside corner radius |
| `lid_lip` | 6 | 2–30 mm | how deep the lid's lip reaches in |
| `fit` | `slip` | tight, slip, loose | the gap between lip and wall each side, from the printed fits (`mj_fit`): tight holds, loose lifts off |

## Sizing the ask

- **A look:** `{ part: 'lidded-box' }`.
- **A fit:** the inside, from the thing it holds; a deck of cards is about 64 × 89 × 20 mm, so ask `inside_w: 66, inside_d: 91, inside_h: 21`.
- **A printer that runs tight or loose:** `fit`. To shift every fit in the program by a few hundredths, detach the row and add `$mj_fit_add` (the scad card).

A box needing screws, a hinge or a seal is a different ask. That is `fabricate_solid` (its needs: `enclose`,
`hinge`, `seal`) or the scad library's `mj_enclosure`.
