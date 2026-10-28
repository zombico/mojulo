### Home windows: a house wears a home's windows from its tradition, the steel grid kept for other buildings

A new house is stamped `houseLook: 2` (`polygonizer/floorplan-styles.js` HOME_WINDOWS): its windows are drawn from its
`design.tradition` and its style family, never the steel `crittall` grid of a workshop, which stays in the catalog for
the buildings that want it and for a house that names it. A house minted before keeps its windows, byte for byte.

- **North American**: double-hung, six-over-six, cottage, colonial, casement, picture and prairie, in the trim's paint
  or a modern black.
- **European** (`british`, `metric`): casement, German tilt-turn, transom, six-over-six and French, in the trim's paint,
  anthracite or a dark timber.
- **Asian** (`japanese`): the new `slider` (the hikichigai: two sashes sliding past each other, the meeting stiles side
  by side), and casement or picture, in aluminium.
- A home's glazing bars are slim, not the frame's own width.
- **Placed as an architect places them** (`polygonizer/home-windows.js`, `houseLook: 2`): each facade a grid of axes
  every storey keeps, so windows stack (void over void, solid over solid), 2 ft clear of the corners, the entry
  facade laid round the front door. Each room takes the axes its use asks: glazing to floor area by room (a living
  room ~15%, a bedroom ~11%), a bedroom a window it can be left by (a sash on a 2.5 ft sill, a fixed pane turned to a
  casement), a bathroom the standard window (smaller, over the fixtures, frosted), a kitchen over the counter, a hall
  on the facade lit, a store or laundry blind; a big room short of light a mulled pair on its axes.
- **A house knows its north** (`compass: { north, hemisphere }`), apart from the plan's N/S/E/W; absent, it orients
  itself, its living room's longest outside wall to the sun, and the day rooms take their windows sun side first.
- **The window laws** (`polygonizer/window-laws.js`), in the structure read as `windows`: daylight (the code's 8%),
  egress, blind service rooms, stacking, one head line a storey, corners, rhythm, and each facade's share of glass.
