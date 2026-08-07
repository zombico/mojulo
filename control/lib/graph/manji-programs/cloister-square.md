---
{
  "id": "cloister-square",
  "label": "Cloister square (four-walk garth)",
  "family": "monastic-architecture",
  "aliases": ["cloister", "monastery cloister", "arcaded courtyard", "covered courtyard", "monastic courtyard", "abbey cloister", "garth", "enclosed garden walk", "four-sided arcade"],
  "intents": ["architecture", "monastic-architecture", "enclosed-courtyard", "contemplative-space"],
  "topology": {
    "primitive": "structure-manji",
    "shape": "square-arcade",
    "enclosure": "four-sided-continuous",
    "center": "open-garth-with-well"
  },
  "reasoningUse": [
    "a square arcaded courtyard with covered walkways on all four sides and an open garden at the center",
    "medieval monastic cloister around a central garth, often with a well or fountain at the middle",
    "the contemplative inward-facing architectural pattern — abbey, monastery, convent, charterhouse",
    "use when the scene needs an enclosed quiet space wrapped in arcades, oriented around a central feature"
  ],
  "boundaryContract": {
    "slots": ["arcade-N", "arcade-S", "arcade-E", "arcade-W", "corner-NW", "corner-NE", "corner-SW", "corner-SE", "center-garth", "well-anchor", "vault-overhead"],
    "collisionGroups": ["arcade-walk", "central-garth", "corner-pier"],
    "depthBands": ["far-walk", "side-walks", "near-walk"]
  },
  "manjiProgram": {
    "spine": {
      "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.5 },
      "bar2": { "axis": "E-W", "tails": { "W": "closed", "E": "closed" }, "lengthScale": 0.5 },
      "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.35 }
    },
    "slots": [
      { "id": "arcade-N",       "position": { "x":  0, "y": -5, "z":  1.5 } },
      { "id": "arcade-S",       "position": { "x":  0, "y":  5, "z":  1.5 } },
      { "id": "arcade-E",       "position": { "x":  5, "y":  0, "z":  1.5 } },
      { "id": "arcade-W",       "position": { "x": -5, "y":  0, "z":  1.5 } },
      { "id": "corner-NW",      "position": { "x": -5, "y": -5, "z":  0   } },
      { "id": "corner-NE",      "position": { "x":  5, "y": -5, "z":  0   } },
      { "id": "corner-SW",      "position": { "x": -5, "y":  5, "z":  0   } },
      { "id": "corner-SE",      "position": { "x":  5, "y":  5, "z":  0   } },
      { "id": "center-garth",   "position": { "x":  0, "y":  0, "z":  0   } },
      { "id": "well-anchor",    "position": { "x":  0, "y":  0, "z":  0.4 } },
      { "id": "vault-overhead", "position": { "x":  0, "y":  0, "z":  3.5 } }
    ]
  }
}
---

# Cloister square (four-walk garth)

A **square arcaded courtyard** with covered walkways on all four sides
and an open garden (the *garth*) at the center. Four `corner-*` slots
anchor load-bearing piers at the cardinal corners; four `arcade-*`
slots sit mid-side at z=1.5 to anchor each walkway's arcading; the
`center-garth` and `well-anchor` define the open middle.

This is the **monastic enclosure** archetype — a Benedictine,
Cistercian, or Carthusian cloister wrapping a garth, sometimes with a
well, fountain, or sundial at the center. Unlike a peristyle (open
outward through the columns), the cloister reads as **inward-facing**:
the walks are roofed and enclosed on the outer wall, so the procession
of arches all face inward toward the garth.

## Use when

Reach for `cloister-square` when the scene wants **contemplative
enclosed space** wrapped in continuous arcading:

- **Monastery / abbey** — the architectural heart of a religious
  community. Drop figures in the arcades (reading, walking, praying)
  and a well or fountain at center.
- **Quiet courtyard** — secular variants exist (university quads,
  hospital courts, college cloisters). The card's enclosed feeling
  serves any "interior square" pattern.
- **Procession / circumambulation** — when figures walk the perimeter
  in a ritual orbit. The four `arcade-*` slots define the procession
  route.
- **Hortus conclusus** — the medieval "enclosed garden" symbolic
  motif. The center-garth becomes a flowered or fruited mark with
  symbolic weight.

When the structure is **outward-facing** (a peristyle around a temple
cella), use [[peristyle-colonnade]]. When the enclosure is **open on
one side** (a portico opening to a forecourt), use
[[portico-three-bay]]. When the cloister sits inside a larger
cathedral plan, this card can be a child of
[[cathedral-nave-deep-perspective]]'s transept-area slot.

## Slot semantics

- **arcade-N / S / E / W** — the mid-point of each covered walkway, at
  arcade-spring height (z=1.5). Bind a series of arches or a horizontal
  arcade mark here. Each walkway is the same length (10 units),
  reinforcing the square's symmetry.
- **corner-NW / NE / SW / SE** — the four corner piers at floor level.
  Heavier than a typical column; these read as the load-bearing
  masonry that holds the four arcades together. Drop a thick column
  or pier mark here.
- **center-garth** — the open garden at the center (z=0). Default empty
  reads as flat lawn / paving; drop a small floral or planted mark here
  for a hortus conclusus reading.
- **well-anchor** — a slightly elevated central point (z=0.4) for the
  well, fountain, or sundial that traditionally marks the cloister's
  center. The slight z offset reads as "raised stone curb."
- **vault-overhead** — the high anchor (z=3.5) for the open sky above
  the garth or, in covered variants, a glass / lantern roof. Most
  cloisters are open to the sky; leave this slot empty for the open
  reading.

## Composition example

### Standard Cistercian cloister with central well

```json
{
  "programRef": "cloister-square",
  "children": [
    { "slot": "corner-NW", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/corner-NW", "self/slot/base": "self/slot/center-garth" } } },
    { "slot": "corner-NE", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/corner-NE", "self/slot/base": "self/slot/center-garth" } } },
    { "slot": "corner-SW", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/corner-SW", "self/slot/base": "self/slot/center-garth" } } },
    { "slot": "corner-SE", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/corner-SE", "self/slot/base": "self/slot/center-garth" } } },
    { "slot": "well-anchor", "node": { "inlineProgram": {
        "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.4 },
        "bar2": { "axis": "E-W", "tails": { "W": "closed", "E": "closed" }, "lengthScale": 0.4 },
        "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.5 }
    } } }
  ]
}
```

Four corner piers and a small well at center — the minimal cloister
reading. The walkways are implicit between the corners; the empty
arcade slots leave room for the operator to add arcade marks
explicitly when needed.

### Cloister with walking monk

```json
{
  "programRef": "cloister-square",
  "children": [
    { "slot": "corner-NW", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/corner-NW", "self/slot/base": "self/slot/center-garth" } } },
    { "slot": "corner-NE", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/corner-NE", "self/slot/base": "self/slot/center-garth" } } },
    { "slot": "corner-SW", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/corner-SW", "self/slot/base": "self/slot/center-garth" } } },
    { "slot": "corner-SE", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/corner-SE", "self/slot/base": "self/slot/center-garth" } } },
    { "slot": "arcade-W",  "node": { "programRef": "standing-figure-canonical" } }
  ]
}
```

A figure placed on the west walkway reads as a monk pacing the
cloister. The figure-in-the-arcade composition is iconic in medieval
illumination and Renaissance painting of religious life.

## Provenance and influences

The cloister emerged in early monasticism (4th-6th century) as a
practical answer to "where do monks read and walk between offices."
By the high middle ages it had become the **defining heart of
monastic architecture**. Specific lineages:

- **Cistercian cloisters** (Fontenay, Fountains Abbey) — austere,
  unornamented arcading. The card's restrained corner-and-walk
  pattern matches this register.
- **Romanesque cloisters** (Moissac, Silos) — sculpted capitals with
  narrative scenes; the arcades are otherwise simple. Add capital
  marks if needed.
- **Late-Gothic cloisters** (Westminster, Mont-Saint-Michel) — rib-
  vaulted walks, tracery-filled arcades. The card's symmetric base
  supports these but doesn't model the vault details.
- **Renaissance secular adaptations** — Brunelleschi's Ospedale degli
  Innocenti, Italian university quads. The pattern translates to
  secular contemplative space.

The cloister's **enclosure** is its meaning: the world is shut out at
the perimeter, the sky is open above the garth, and the procession
walks the four sides clockwise (or counter-clockwise, in some
liturgical orders). This card encodes that symmetry without taking a
position on procession direction.

## Stays bespoke when

- The cloister is **non-square** (rectangular, trapezoidal). Many real
  cloisters are slightly off-square due to site constraints; this card
  models the ideal square. Author bespoke slot positions for irregular
  plans.
- The cloister has **multiple stories** (an upper gallery, a
  triforium). The card models a single-story arcade; multi-story
  cloisters need a second card layered above.
- The intent is **architectural elevation** of one walk seen straight
  on. For a flat elevation view, [[portico-three-bay]] or a bespoke
  facade is closer to the right shape.
- The "cloister" is a **secular fortified courtyard** (a castle keep's
  inner court). The monastic register of this card will fight a
  military or domestic intent; author bespoke for those.
