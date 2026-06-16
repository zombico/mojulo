---
{
  "id": "cathedral-nave-deep-perspective",
  "label": "Cathedral nave deep perspective",
  "family": "civic-interior-shot-glyph",
  "aliases": ["cathedral nave", "church nave", "gothic interior", "deep nave perspective", "vaulted hall"],
  "intents": ["depth-staging", "awe-and-scale", "sacred-space"],
  "topology": {
    "cameraVector": "central-one-point",
    "vanishingHub": "apse-axis",
    "lightEntry": "high-clerestory",
    "support": "floor-depth-grid",
    "staging": "central-aisle-to-altar"
  },
  "reasoningUse": [
    "long one-point perspective into a sacred interior space",
    "tall vaulted ceiling drawing the eye upward, central aisle drawing it back",
    "cathedral or church interior with altar at the receding terminus"
  ],
  "boundaryContract": {
    "slots": ["central-nave", "left-aisle", "right-aisle", "apse", "altar-anchor", "transept-left", "transept-right", "ceiling-vault"],
    "collisionGroups": ["nave-axis", "aisle-bands", "transept-cross", "vault-overhead"],
    "depthBands": ["nave-front", "nave-mid", "apse-back", "vault-above"]
  },
  "manjiProgram": {
    "spine": {
      "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.4 },
      "bar2": { "axis": "E-W", "tails": { "W": "open", "E": "open" }, "lengthScale": 0.4 },
      "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "open", "Nadir": "open" }, "lengthScale": 0.5 }
    },
    "slots": [
      { "id": "central-nave",   "position": { "x":   0,  "y": -10, "z":  0   } },
      { "id": "left-aisle",     "position": { "x":  -8,  "y": -10, "z":  0   } },
      { "id": "right-aisle",    "position": { "x":   8,  "y": -10, "z":  0   } },
      { "id": "apse",           "position": { "x":   0,  "y": -25, "z":  1   } },
      { "id": "altar-anchor",   "position": { "x":   0,  "y": -25, "z":  0.5 } },
      { "id": "transept-left",  "position": { "x": -10,  "y": -16, "z":  0   } },
      { "id": "transept-right", "position": { "x":  10,  "y": -16, "z":  0   } },
      { "id": "ceiling-vault",  "position": { "x":   0,  "y": -15, "z":  6   } }
    ]
  }
}
---

# Cathedral nave deep perspective

A deep one-point interior shot: a long central aisle recedes toward an
altar at the back, side aisles flank it, transepts cross at the midpoint,
and a vaulted ceiling arches overhead. This is the **sacred-space
archetype** — the spatial composition Raphael, Piranesi, and a thousand
ecclesiastical engravings reach for when they want awe, scale, and a
focal point at the receding terminus.

## Use when

Reach for this card when the illustration's intent is one of:

- A figure (or small group) approaching, kneeling at, or contemplating
  something at the back of a long sacred interior. The card's natural
  vanishing point lands on the apse / altar-anchor.
- Architectural scale as subject — the building dominates and the
  figures, if any, are minor staffage establishing scale.
- A processional, ritual, or contemplative scene where the depth
  recession itself is the emotional load.
- A teaching scene set inside the hall (philosophers, scholars,
  preachers) where the back-arch reads as the symbolic "destination" of
  the inquiry.

This card is a sibling of `school-of-athens-central-hall` — both are
central-one-point civic interiors, but School of Athens emphasizes a
shallower hub-and-cluster composition (figures arranged around a
central axis-mundi), while this card emphasizes the **deep linear
recession** to a single focal point.

## Slot semantics

- **central-nave** — the camera-axis floor band where processions,
  central figures, or central architectural elements (carpet runner,
  floor pattern) belong. Whatever you place here will appear on the
  primary axis of attention.
- **left-aisle**, **right-aisle** — secondary architectural columns
  or repeating side bays. Place pillars, columns, or `standing-figure-canonical`
  occupants for a colonnade effect. Symmetrical placement reads as
  classical; asymmetric placement reads as more naturalistic.
- **transept-left**, **transept-right** — the cross-arms of the hall,
  meeting the nave at the midpoint. Use for side altars, statues, or
  secondary figure groups that should read as "off the main path."
- **apse** — the curved/squared terminus at the back. Most-receded slot;
  whatever sits here will be small in the projected image. Good for
  architectural detail (back-wall arch, far window) rather than figures.
- **altar-anchor** — the focal point. The thing the camera is "looking
  at." A small cube or a `triangular-figure-stack` here gives the
  composition its destination.
- **ceiling-vault** — the overhead anchor. Use for a vaulted ribcage,
  a chandelier, or an overhead light feature. Most readers' eyes won't
  travel here first, but the vault's presence lends "tallness" to the
  whole space even when minimally rendered.

## Composition examples

### Solitary figure approaching the altar

```json
{
  "programRef": "cathedral-nave-deep-perspective",
  "children": [
    { "slot": "central-nave", "node": { "programRef": "standing-figure-canonical" } },
    { "slot": "altar-anchor", "node": { "inlineProgram": {
        "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.5 },
        "bar2": { "axis": "E-W", "tails": { "W": "closed", "E": "closed" }, "lengthScale": 0.5 },
        "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "open", "Nadir": "closed" }, "lengthScale": 1.2 }
    } } },
    { "slot": "left-aisle", "node": { "programRef": "standing-figure-canonical" } },
    { "slot": "right-aisle", "node": { "programRef": "standing-figure-canonical" } }
  ]
}
```

A pilgrim approaching the altar with pillar-figures on either aisle.
The depth recession does the emotional work; the pilgrim's position on
the central-nave slot puts them on the camera axis.

### Three philosophers in classical hall

```json
{
  "programRef": "cathedral-nave-deep-perspective",
  "children": [
    { "slot": "central-nave", "node": { "programRef": "triangular-figure-stack" } },
    { "slot": "altar-anchor", "node": { "programRef": "standing-figure-canonical" } }
  ]
}
```

The triangular-figure-stack at central-nave gives you three figures
arranged classically; a fourth figure at the altar-anchor reads as the
"target" or "teacher" they are oriented toward. School-of-Athens-like
composition with deeper recession than the school-of-athens card itself.

## Provenance and influences

The geometry is canonical Renaissance / Baroque ecclesiastical perspective
— one-point projection into a basilica plan, with the vanishing point
landing on the apse. Specific influences:

- Raphael, *The Disputation of the Sacrament* (1509-1510) — same deep
  one-point hall with figures clustered in the foreground bands.
- Piranesi's *Carceri* engravings — though those subvert the hall into
  prison architecture, the underlying perspective grammar is the same.
- Gothic cathedral plans (Chartres, Notre-Dame) — the slot positions
  for transepts and the vault overhead trace the basilica layout
  rather than a specific historical building.

For chapel / smaller-sacred-interior compositions, the apse slot may
read as too far back. Consider authoring an inline shorter variant or
adding `cathedral-nave-shallow-perspective` as a sibling card.

## Stays bespoke when

Reach for inline cardinal authoring (NOT this card) when:

- The interior is asymmetric (off-center altar, irregular floor plan).
  This card hard-codes bilateral symmetry through the cardinal grid;
  asymmetric basilicas need explicit slot positioning.
- The camera is at a **non-central** position (looking across the nave
  from a side aisle, looking down from the choir loft). The card
  assumes central-one-point. Off-axis views need their own card
  (`cathedral-side-aisle-view`, `cathedral-choir-loft-down`).
- The shot is exterior or aerial. This card is interior-only.
- The "cathedral" is more architectural fantasy than religious building
  (Piranesi prison, Escher staircase, dream architecture). The
  symmetrical bias here will fight that intent; use bespoke geometry.

When in doubt, render through this card first and see whether the
result reads as the intended scene. If it doesn't, the discipline of
the card is telling you the geometry wants to be elsewhere.
