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
  per-level plan or seed, per-level ceiling height. `stairs: true` runs one flight from the
  ground; `stairs: [{ from, to, switchback? }]` places each. `tier: 'cottage' | 'house' |
  'villa'` bounds the room program and supplies a default footprint; `terrace: true` cuts the
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

- `design: { tradition?, passage?, door?, stair?: { width?, riser?, going? }, repair? }` — the
  rules, in feet. The tradition defaults from the framing, else `north-american` (passage 36 in,
  door 30 in, stair 36 in with 7¾ in risers and 10 in goings); `british` (900 mm, Part K-like),
  `japanese` (780 mm), `metric` (900 mm).
- `repair: true` builds the plan to keep the passage: the upstairs hall takes the stair's zone and
  a walkway past it, doors on the well's side step off its span, the ground floor keeps the
  passage round the flight, and where a U-return and its walkway would cost the upper floor a row
  of rooms the stair becomes a straight flight climbing toward the middle. Without it the house is
  exactly as it was.

```json
{ "storeys": 2, "seed": 4, "design": { "repair": true } }
```

Next steps: the structure `house-construction` (framing needs a stack) · BIM and export
`house-bim`.
