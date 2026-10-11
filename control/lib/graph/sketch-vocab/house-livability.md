---
{ "id": "house-livability", "name": "House layout — does it live well", "summary": "the Layout outcome of a house: rooms, circulation and egress, its grade, the stair and the furniture around it, and a furnished walkthrough; the questions from zero, the livability laws, and the fields that open the Plan, Rooms and Objects tabs", "when": "planning how a house lives: its rooms and program, a stair that is reached and not crowded, walkways, egress windows, furniture, a showroom of pieces; or a mint_building `next` names outcome 'layout'", "tier": "render-primitive", "marks": [], "phase": "p1" }
---

**Layout** answers *does it live well*: a plan that works, rooms, circulation and egress, its
grade and a furnished walkthrough. A showroom is a layout whose subject is its objects. The
structure book's tabs: Plan, Rooms, Objects.

## From zero, ask

1. **Who lives here?** Bedrooms, a study, a dining room (`tier: { base, beds, study, core }`),
   or rooms drawn by hand (`rooms[]`, `levels[i].rooms`; card `house-layout`).
2. **How do they move?** One floor or a stack (`storeys`, `levels[]`), and its stair (`stairs`;
   card `house-storeys`).
3. **What is in each room?** `furnish: true`, or pieces by name or by `ref` in `rooms[].items`
   (card `house-dwelling`). A custom piece is `mint_solid` or `fabricate_solid` first, placed by
   its ref.

## The livability laws

The book checks every house; each check advises, none refuses. A room (one space) is not a
house, and none of these is read for it.

- **A home**: a house is livable only with a kitchen (its own `K` room or the open core's), a
  bathroom (`W`) and a bedroom (`B`). Without one, the book says "a house, not yet a home", the
  readout carries `notAHome` and `design.ok: false`, and no `waive` makes it pass.

- **Reach**: a stair reaches every floor. `stairs: true` chains each level from the ground.
- **Walkway**: every door and stair connects through a passage at least the tradition's width
  (36 in north-american). `design: { repair: true }` builds the plan to keep it.
- **Stair clearance**: no piece in the stair's room stands within the clearance of the flight,
  its landing or the well. `design: { clearance: true }` (the passage) or feet.
- **Egress and daylight**: every bedroom has a window to the outside (`windows: true`).
- **Fixture clearance** (a fitted house, `furnishing: 'fitted'`): 21 in clear before the water closet and the basin,
  15 in from the WC's centre to each side, 21 in to step into the tub, 24 in before the shower; a bathroom that holds
  no basin, or no tub or shower, says so. Waivable as `fixture-clearance:<room>`.
- **Override**: `design.waive: ['stair-clearance:101', 'walkway']` accepts a finding as built;
  the book shows it waived. `clearance: false` keeps furniture off the flight's footprint only.

A new house is minted with `windows: true`, and a new stack with
`design: { repair: true, clearance: true }` and a stair, when the recipe leaves them out.

```json
{ "seed": 4, "tier": { "base": "house", "beds": 3, "study": true, "core": ["L", "K", "D"] }, "storeys": 2, "furnish": true, "design": { "repair": true, "clearance": true } }
```

## The fields that open each tab

- **Plan** (A-10x per storey) and **Rooms**: any house; the checks read on the Plan's
  Livability card.
- **Objects** (the FF&E schedule): `furnish: true`, `view: 'cutaway'`, or `rooms[].items`.

Next outcome: a drawing set, `house-drawings`.
