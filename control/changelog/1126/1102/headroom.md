### Headroom: awnings clear the hero

- **Every shade walked under now clears the base model by half a body.** The base model is 1.70 m, so an awning's
  lowest edge stands at least 2.55 m over the ground under it (`era/headroom.js`: `BODY_HEIGHT`, `AWNING_CLEAR`). This
  applies to:
  - **A town's shopfronts** (`geotown/fronts.js`). The flat and round awnings are lifted whole. The sloped one is lifted
    toward its storey's top, and where the storey has no room for its fall, its slope and valance are flattened.
  - **The plaza's striped door awnings** (`era/plaza-dress.js`). Each is lifted off the door's head where its hem hung
    lower.
  - **A city's facade awnings and shopfront canopies** (`architecture/building-facade.js`). The clearance is in the
    city's 3.66 m units, so a short storey lifts them.
  - **A town square's market stalls** (`era/out-town-dress.js`), **the Qin market's cloth stalls** and **the Egyptian
    house's reed roof shelter** (`historic/assets/`).
  - **The cafe and patio parasols** (`geotown/sites.js`, `geotown/yards.js`).

  An awning that already cleared hangs where it did. This is an emission change: the worlds that carry one re-render
  with it lifted, and their byte pins were re-pinned for it.
