### House forms: a townhouse and a modern block beside the detached house

A house carries `form: 'detached' | 'townhouse' | 'block'` (`polygonizer/house-forms.js`), beside its size (`tier`) and
its finish (`style`); absent, the detached house the generator always drew. A form plans every storey as it is lived
in, in the house kernel's own plan contract, so the stack, the stair, the windows and the read build it as any house.

- **Townhouse**: narrow and deep, three or four storeys; the stair hall along a party wall holds a straight flight
  and a passage beside its well, the same zone on every floor; the rooms stacked front to back: kitchen and dining to
  the garden (a glazed door at the end of the kitchen's back wall), the living room to the street, bedrooms and baths
  above. `attached: 'both'` by default (mid-terrace); `'left'` / `'right'` an end unit. Party walls take no window.
- **Block**: the modern block, compact and near square, two or three storeys, a hall down its middle holding the
  stair, rooms either side; an open living floor below.
- **Windows** (`houseLook: 2`): a narrow facade is laid from its plan (the stair hall's bay, the door below and the
  window over it; a main room's two bays), a townhouse's sashes tall on a low sill; a tall storey (a block's) raises
  the window head with its ceiling and a block aims for more light; a glazed garden door lights its room.
- **The draw** gives a form its own storeys and footprint (a townhouse three or four on a narrow deep lot, a block two
  or three on a compact one) and lets it plan its own front door; a footprint that cannot hold its stair or its rooms
  is refused at mint, naming the size it needs. No new tool or kind: one knob on `mint_building`'s recipe.
