---
{ "id": "house-storeys", "name": "House storeys — stacking floors, and the walkway check", "summary": "a house more than one floor high: storeys: N, or an authored levels[] stack with a basement and per-level plans, stairs through the slabs, and the design check that every door and stair connects through a walkable passage", "when": "a two-storey house, a basement, an upper floor that differs from the ground, placing stairs, exploding a cutaway's levels, or checking / repairing walkways and stair widths by tradition", "tier": "render-primitive", "marks": [], "phase": "p1" }
---

Absent, the plan is the single floor it always was. Two ways to say "a two-storey house":

- `storeys: N` (alias `floors`) — the one-field shorthand. The plate stacks N high on one core
  (ground, second, third, upper…), each level's rooms generated from `seed + index`, a stair
  between consecutive floors through the slabs; `exterior` roofs the top, `cutaway` leaves every
  storey open. `stairs` places the flights yourself (`stairs: false` for none). A non-integer or
  `0` refuses at mint.
- `levels: [{ role | index, seed?, rooms?, halls?, doors?, height? }, …]` — the authored stack,
  when floors differ: roles `basement` (-1) / `ground` (0) / `second` / `third` / `upper`,
  per-level plan or seed, per-level ceiling height. `stairs: true` joins every level from the
  ground (a flight down to each basement, up to each floor); `stairs: [{ from, to, switchback? }]` places each. Without
  `stairs`, an authored stack has no flight: nothing reaches its upper floors. `tier: 'cottage' | 'house' |
  'villa'` (or `{ base, beds, study, core }`) bounds the room program and supplies a default
  footprint. Its core is open: living, kitchen and dining share one room, which the book names
  `living / kitchen / dining`. Upstairs, a study takes the last bedroom of three or more
  (`study: false` keeps them), and a footprint too small builds fewer bedrooms: the readout's
  `next` names a shortfall; `terrace: true` cuts the
  deck door; `explode: <feet>` pulls a cutaway's levels apart (exterior is never exploded).
  `levels[]` wins over `storeys` when both are set.

```json
{ "seed": 5, "storeys": 2, "view": "exterior" }
```

```json
{ "seed": 5, "levels": [{ "role": "basement" }, { "role": "ground" }, { "role": "second" }], "stairs": true, "view": "cutaway", "explode": 6 }
```

## Design — walkways and stairs, checked

A house with storeys is checked the way you would walk it, and `mint_building` / `update_sketch`
return what they found as `design` (advisory: the house is minted either way). On each storey the
free floor between the walls, the stair's well and its flight is measured, and every door and
both ends of each stair must connect through a passage at least the tradition's width; a finding
says how wide the narrowest point is, where, what it lies between, and which doors lie beyond.
Doors are measured against a clear width, stairs against a width, riser and going.

- `design: { tradition?, passage?, door?, stair?: { width?, riser?, going? }, repair?, clearance?, waive? }` — the
  rules, in feet. They are what the house is checked against: a wider flight is built by
  `stairs: [{ from, to, width }]`, and the book's stair schedule shows the width built. The tradition defaults from the framing, else `north-american` (passage 36 in,
  door 30 in, stair 36 in with 7¾ in risers and 10 in goings); `british` (900 mm, Part K-like),
  `japanese` (780 mm), `metric` (900 mm).
- `repair: true` builds the plan to keep the passage: the upstairs hall takes the stair's zone and
  a walkway past it, doors on the well's side step off its span, the ground floor keeps the
  passage round the flight, and where a U-return and its walkway would cost the upper floor a row
  of rooms the stair becomes a straight flight climbing toward the middle. Without it the house is
  exactly as it was.
- `clearance` keeps furniture off the stair: `true` for the passage, feet for your own, `false` (the
  default) for the flight's footprint only. It clears the flight and its landing on the floor it
  climbs in and the well's edge on the floor it reaches; a piece in that room within it is left out.
- `waive: ['stair-clearance:101', 'walkway']` accepts a finding as built (a rule, or `rule:at`):
  the structure book shows it waived instead of advising. The checks run on every stack either way.

A livability pass is the two together:

```json
{ "storeys": 2, "seed": 4, "design": { "repair": true, "clearance": true } }
```

A new house is minted with `windows: true`, a new stack with the livability pass, and a `levels[]`
stack with `stairs: true`, when the recipe leaves them out. Each inferred value is written into the recipe with its reason in
`notes.inferred` (the book's Cover lists them), so `update_sketch` changes it like any other; set
`design.clearance: false` or `design.repair: false` to build it the old way. A framed single floor
is minted as `levels: [{ index: 0 }]`, and a roof style that names a form (`gable`) as that form
on the bungalow style.

Next steps: the structure `house-construction` (framing needs a stack) · BIM and export
`house-bim`.
