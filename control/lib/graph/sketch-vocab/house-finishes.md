---
{ "id": "house-finishes", "name": "House finishes — doors, windows, floors and walls with a look of their own", "summary": "a house's fixed finishes, rolled with its style: door leaves (Shaker, six-panel, glazed, French, plank, fluted…), window divisions (crittall, prairie, cottage, six-over-six…), floor patterns (herringbone, chevron, basketweave, checkerboard, hex, terrazzo…) and wall treatments and papers, drawn by the house style's roll for every new house", "when": "a house's doors, windows, floors or wallpaper should look a particular way, or differently from the last house; choosing a floor pattern or a wallpaper for a house or an interior", "tier": "render-primitive", "marks": ["boxNet"], "phase": "p1" }
---

A house's finishes are knobs like `windowStyle` and `entryDoorTint`, drawn by the same roll. A new house is minted
with `finishes: 'auto'`, and its style (cottage, brick, modern, tofu or mission, itself drawn when `style` is
`'auto'`) picks them along with its siding, roof and paints, each from its own seeded list. So two houses are not made
alike, and the same house always re-renders the same. Name any knob in the manifest, at mint or with `update_sketch`,
and it wins over the roll. `finishes: null` at mint leaves a house with the old finishes, and a house minted before
keeps its look.

```json
{ "doorStyle": "six-panel", "doorLeafTint": "#2e3b55",
  "windowStyle": "crittall", "windowFrameTint": "#22252a",
  "livingFloor": { "pattern": "herringbone", "colours": ["#b08a5e", "#8a6a48"] },
  "bedroomFloor": { "pattern": "wide-plank", "colours": ["#c29a64", "#9a7444"] },
  "wetFloor": { "pattern": "hex-tile", "colours": ["#efeae0", "#8a8f86", "#5d7a73"] },
  "wallTreatment": "board-and-batten",
  "wallpaper": { "pattern": "botanical", "colours": ["#efe6d6", "#5d7a5a", "#c99a6a"] } }
```

- **Doors:** `doorStyle` is the leaf, and the house's interior doors wear `doorLeafTint`.
  - two-panel (the house's own), shaker (one tall flat panel), five-panel (the craftsman door), six-panel (the
    colonial door), flush;
  - glazed (a glass light over a panel), french (glass the leaf's height);
  - plank (boards on ledgers), fluted (fine vertical reeds).
- **Windows:** `windowStyle` is the division.
  - The house's own: picture, casement, double-hung, colonial, transom, french, german.
  - New: crittall (a fine black steel grid), prairie (a border of narrow lights), cottage (the top third divided),
    six-over-six.
  - `windowFrameTint` colours the frames.
- **Floors:** each room kind's pattern in its colours: `livingFloor` (lounges, dining, studies, entries, halls),
  `bedroomFloor`, `wetFloor` (kitchens, baths, laundries).
  - Woods: straight-plank, wide-plank, herringbone (45°), chevron, basketweave (parquet). The first colour is the wood,
    the second its darker grain.
  - Tiles and stone: checkerboard (two colours), hex-tile (a third colour for the odd tile), terrazzo (a ground and its
    chips), large-format (one stone with hairline joints).
- **Walls:** a house's interior walls are mostly painted (in the style's paints), some dressed with the
  `wallTreatment` and some papered with the `wallpaper`. `interiorWallStyle` forces one of them on every wall.
  - Treatments: wainscot, board-and-batten, shiplap, picture-frame, beadboard.
  - Papers: stripe, pinstripe, gingham, trellis, scallop, polka, grasscloth, botanical, damask. The first colour is
    the ground, the second the figure, the third a second figure where the paper has one.

The patterns are drawn procedurally in any colours, so a herringbone can be in any wood and a paper in any colours. An
interior's `surface` takes the same patterns and treatments for its own room
(`get_sketch_vocab({ id: "interior" })`).
