# Qin: design language

Xianyang and the Lishan works, read at **c. 212 BCE**: the year Epang Palace was begun, two years before the First Emperor died. Qin is the earliest Chinese city that still reads as Chinese: grey tile roofs, red columns, raised earth terraces, walled axial compounds. It is also early enough that the honest roof is **straight**. Upswept eaves come centuries later, and this town does not have them.

The numbers below are the kit's design language. The machine copy, checked once per principle, is the style card [`control/lib/graph/historic/style/qin.js`](../../../control/lib/graph/historic/style/qin.js). When the two disagree, the card wins.

## Reference drawings

The drawings were generated as orthographic references and are kept in `refs/`. They are references for proportion, not sources. Facts belong in the record (`record/qin.js`), which carries their citations.

| File | Gives the kit | Corrected while tracing |
|---|---|---|
| `qin-hall-front.webp` | **Master hall**: 7 bays on a two-tier terrace, central double stair, hip roof | Scale bar ignored; scaled from the 1.7 m figure. Extra brackets between the columns dropped |
| `qin-hall-section.webp` | Frame and roof build-up (column, beam, purlin, rafter, tiles); lower-tier corridor | Its stair and one-sided corridor do not match the front view; the front view wins |
| `qin-terrace-plan.webp` | **Layout pattern only**: hall on the top tier, courtyards of rooms on the lower tier, corridors, drains | Drawn about 210 m across, rescaled to the excavated 60 × 45 m. More symmetrical than the real Palace No. 1, so it is labelled conjecture |
| `qin-que-city-wall.webp` | Palace gate towers (earth pylon with a pavilion on top); wall with a timber-framed gate passage | Scale from the figure. The timber ties in the wall section are not attested and are dropped. The slim gate tower is derived from the stone que at Gaoyi, not drawn here |
| `qin-tiles-wadang-column.webp` | Tile system, six eave-end tile designs, column 3.2 × 0.5 m, the bracket | None; the sheet's measurements agree with each other |
| `qin-town.webp` | Courtyard house (about 12 × 16 m), ward street, market with drum tower, three-storey tower | Corner flicks on the eaves are ignored, since the kit roof is straight by construction. Ward walls 5 m elite, 3 m common. Market and tower are **Han analogues** |
| `qin-lishan-plan.webp` | Mausoleum layout: mound in the south half of the inner enclosure, side halls in the north half, four axial gates | Drawn near-square, so it is laid out from the measurements instead (2,165 × 940 m outer, 1,355 × 580 m inner). Moat removed (not attested). East–west cross wall added. The triple gate towers move to **between** the inner and outer gates, on both the east and west axes |
| `qin-army-pit.webp` | Painted figures, brick floors, posts and beams, reed matting, ramps; a corridor under construction | The plan's cross walls are wrong: the partitions run east–west, making about 11 long corridors. Chariots are spread through the corridors, with archers across the east end |
| `qin-lishan-pit-palette.webp` | **Palette swatches** (sampled into the card) | Its mound and pit drawings are superseded by the two sheets above |

## Kit constants

| Element | Value |
|---|---|
| Earth faces | Batter 1 : 4.5 (about 77°) on terrace, gate tower and city wall alike; pounded courses 6–10 cm (the record: Lishan 6–8, Epang 7–8, the pits about 10) |
| Column | 0.5 m across, 3.2–3.6 m tall, dark red lacquer, on a square stone base 0.8 m on a side. Red columns and the base size are the standard reading, not attested (see the record) |
| Bracket | One block with short crossing arms per column; never stacked |
| Roof | Hip (halls, gate pavilions) or gable (corridors, lesser rooms); pitch about 30°; overhang 2.5–2.9 m; **eave curve 0** |
| Tiles | Grey cover-and-pan; rows 0.25 m apart; round eave-end tiles 0.16 m across, default design cloud scroll A. Imperial halls may carry the giant half-round kui tile (about 52–61 cm) |
| Walls | Ward walls 5 m elite, 3 m common, capped with tiles; city wall 8 m high on a 10 m base, **for enclosures only**: no outer wall at Xianyang has been found, so a town wall is drawn only as labelled conjecture |

## Pieces

Every Qin building is one of these, put together from the constants above:

1. **Hall on a terrace**: stepped earth platform, then the colonnade with plaster panels, then the hip roof. *Hall front, hall section*
2. **Corridor**: one row of columns under a gable or lean-to roof, on the edge of a terrace tier. *Hall section, terrace plan*
3. **Pavilion on an earth platform**: the palace gate towers, the gatehouse on the wall. *Gate-tower sheet*
4. **Wall with a gate passage**: city, ward and enclosure walls. *Gate-tower sheet, town sheet*
5. **Courtyard house**: a tiled main room on the north side, thatched side rooms, gate on the street axis. *Town sheet*
6. **Market stall and drum tower**: a Han analogue. *Town sheet*
7. **Multi-storey tower**: a Han analogue, used sparingly. *Town sheet*
8. **Stepped earth mound** with work ramps and spoil heaps. *Lishan plan*
9. **Pit with corridors**: partitions, posts, beams and matting over painted figures. *Army pit*

## Palette

Sampled from the swatch sheet. The ochre plaster is pushed warmer and lighter so that it reads against the loess.

| | | | |
|---|---|---|---|
| Loess `#d7b589` | Rammed earth `#b79065` | Ochre plaster `#e6c9a0` | White plaster `#ede6d8` |
| Tile `#7f796f` | Lacquer red `#9a3d2a` | Lacquer black `#363635` | Wei river `#879f95` |
| Millet `#c1994f` | Wheat `#d8b575` | Poplar `#6f7958` | Sky `#d0d9da` |

The figures in the army pit are painted (pink flesh; red, green, purple and blue robes; lacquered armour). These colours will be sampled from the detail panel of the pit sheet when the figure kit is built.

## Not this town

These never appear, because the record will hold each one with its real date so that `inUseAt` excludes it:

- Upswept or curved eaves, flying corners
- Glazed tiles, ridge beasts
- Stacked bracket sets
- Brick-faced city walls, crenellations
- Stone balustrades
- Pagodas and anything Buddhist
- A moat at Lishan
- Xianyang drawn inside a continuous outer wall, as fact
- Epang Palace finished (at 212 BCE it is a terrace rising; it never was finished)

The **Han analogues** (pottery tower models, the Gaoyi stone gate tower, the market scene on the Sichuan pictorial brick) may be used, but always labelled as close-dated analogues, never as Qin evidence.
