---
{
  "id": "gazebo-six-column",
  "label": "Gazebo (six-column hexagonal pavilion)",
  "family": "garden-architecture",
  "aliases": ["gazebo", "garden pavilion", "hexagonal pavilion", "open pavilion", "garden gazebo", "park gazebo", "rotunda", "six-column pavilion", "bandstand", "monopteros"],
  "intents": ["architecture", "garden-architecture", "open-pavilion", "hexagonal-structure"],
  "topology": {
    "primitive": "structure-manji",
    "shape": "hexagonal-pavilion",
    "columnCount": "6-fold-radial",
    "enclosure": "open-on-all-sides"
  },
  "reasoningUse": [
    "a small open hexagonal pavilion with six columns supporting a domed or pointed roof",
    "garden gazebo, park bandstand, classical monopteros, or rotunda-style folly",
    "6 column positions at 60° intervals around an open center, with a high roof apex",
    "use for small ornamental architecture in a garden, park, or formal landscape"
  ],
  "boundaryContract": {
    "slots": ["column-N", "column-NE", "column-SE", "column-S", "column-SW", "column-NW", "center", "roof-apex", "floor", "entablature-ring"],
    "collisionGroups": ["column-ring", "interior-open", "roof-cone"],
    "depthBands": ["far-arc", "side-arc", "near-arc"]
  },
  "manjiProgram": {
    "spine": {
      "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.3 },
      "bar2": { "axis": "E-W", "tails": { "W": "closed", "E": "closed" }, "lengthScale": 0.3 },
      "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "open", "Nadir": "closed" }, "lengthScale": 0.45 }
    },
    "slots": [
      { "id": "column-N",          "position": { "x":   0,    "y": -3,    "z":  0   } },
      { "id": "column-NE",         "position": { "x":   2.6,  "y": -1.5,  "z":  0   } },
      { "id": "column-SE",         "position": { "x":   2.6,  "y":  1.5,  "z":  0   } },
      { "id": "column-S",          "position": { "x":   0,    "y":  3,    "z":  0   } },
      { "id": "column-SW",         "position": { "x":  -2.6,  "y":  1.5,  "z":  0   } },
      { "id": "column-NW",         "position": { "x":  -2.6,  "y": -1.5,  "z":  0   } },
      { "id": "center",            "position": { "x":   0,    "y":  0,    "z":  0   } },
      { "id": "roof-apex",         "position": { "x":   0,    "y":  0,    "z":  5   } },
      { "id": "floor",             "position": { "x":   0,    "y":  0,    "z":  0   } },
      { "id": "entablature-ring",  "position": { "x":   0,    "y":  0,    "z":  3   } }
    ]
  }
}
---

# Gazebo (six-column hexagonal pavilion)

A **small open hexagonal pavilion** with six columns at 60° intervals
around an open center, a roof rising to a high apex, and a continuous
entablature ring at the column tops binding the six columns together
as one structure. The plan is the classical **monopteros** form — a
circular Greek temple-like structure with no inner cella, open on all
sides — adapted into the cardinal hexagonal grid the substrate
supports.

This is the **ornamental small architecture** archetype: a garden
folly, a park bandstand, a tholos in a sacred grove, a tea pavilion in
an oriental garden. The card's six-column model preserves the rotational
symmetry that makes the form read as "round" in projection while
staying compatible with the cardinal-grammar discipline.

## Use when

Reach for `gazebo-six-column` when the scene wants **small ornamental
open architecture**:

- **Garden folly** — a classical pavilion as a romantic ruin or
  ornamental focal point in a landscape. Pair with
  [[wide-shot-landscape]] and place this card at midground for a
  Capability Brown / 18th-century English garden composition.
- **Park bandstand** — the open hexagonal stage in a 19th-century
  Victorian park. Drop a figure or small group at center for
  "musicians performing" reading.
- **Classical monopteros / tholos** — a circular Greek temple-like
  structure. The Delphi Tholos, the Temple of Vesta in Rome — open
  on all sides, columns ringing a central altar or statue.
- **Tea pavilion** — adapt the open-pavilion pattern to East-Asian
  garden architecture. The card's slot vocabulary translates; the
  roof and decorative profile change.

When the structure is **fully enclosed** (a tholos with cella walls),
the open-air reading of this card fights the intent — bespoke a
walled variant instead. When the plan is **square** (a four-column
chinoiserie pavilion, a tetrastyle aedicule), use a four-corner
peristyle pattern from [[peristyle-colonnade]] scaled down.

## Slot semantics

- **column-N / NE / SE / S / SW / NW** — the six columns at radius 3
  from center, 60° apart. Column-N is at the back (negative y),
  column-S is at the front (positive y); the four inter-cardinals fill
  the diagonals. Drop [[fluted-column]] or a simpler post at each.
- **center** — the open interior at origin. Default empty reads as the
  open pavilion floor. Drop a small statue, an altar, a bench, or a
  figure here for a focal element.
- **roof-apex** — the top of the conical / domed roof at z=5. Bind a
  pointed or rounded mass here for the roof. The open `Zenith` tail
  of the spine lets the apex "breathe" — no ceiling encloses it.
- **floor** — the platform at z=0. Bind a hexagonal stepped base mark
  here for the platform / stylobate the gazebo sits on.
- **entablature-ring** — a horizontal ring at z=3 binding the column
  tops. Bind a hexagonal beam ring here for the structural
  architrave / cornice that holds the six columns together.

## Composition example

### Park bandstand with central figure

```json
{
  "programRef": "gazebo-six-column",
  "children": [
    { "slot": "column-N",  "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-N",  "self/slot/base": "self/slot/floor" } } },
    { "slot": "column-NE", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-NE", "self/slot/base": "self/slot/floor" } } },
    { "slot": "column-SE", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-SE", "self/slot/base": "self/slot/floor" } } },
    { "slot": "column-S",  "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-S",  "self/slot/base": "self/slot/floor" } } },
    { "slot": "column-SW", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-SW", "self/slot/base": "self/slot/floor" } } },
    { "slot": "column-NW", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-NW", "self/slot/base": "self/slot/floor" } } },
    { "slot": "center",    "node": { "programRef": "standing-figure-canonical" } }
  ]
}
```

Six columns ringing a central figure — a soloist, a conductor, an
orator addressing a crowd. The hexagonal column ring frames the figure
without enclosing them.

### Empty garden folly (no center occupant)

```json
{
  "programRef": "gazebo-six-column",
  "children": [
    { "slot": "column-N",  "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-N",  "self/slot/base": "self/slot/floor" } } },
    { "slot": "column-NE", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-NE", "self/slot/base": "self/slot/floor" } } },
    { "slot": "column-SE", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-SE", "self/slot/base": "self/slot/floor" } } },
    { "slot": "column-S",  "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-S",  "self/slot/base": "self/slot/floor" } } },
    { "slot": "column-SW", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-SW", "self/slot/base": "self/slot/floor" } } },
    { "slot": "column-NW", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-NW", "self/slot/base": "self/slot/floor" } } }
  ]
}
```

Six columns and no center occupant — the open garden folly. The empty
center invites the viewer's eye through; the gazebo reads as a frame
for whatever lies behind it.

## Provenance and influences

The hexagonal open pavilion has parallel lineages in several traditions:

- **Greek monopteros / tholos** — round columned structures with no
  cella. Delphi's Tholos, the Temple of Athena Nike (closer to a
  small temple), the Choragic Monument of Lysicrates.
- **Roman tempietto** — Bramante's *Tempietto* at San Pietro in
  Montorio (1502) revived the form for the Renaissance. A widely
  imitated design.
- **18th-century English garden** — William Kent, Capability Brown,
  Humphry Repton dotted gazebos through landscapes as eye-catchers.
  The "ornamental folly" tradition is this card's primary register.
- **Victorian bandstand** — public parks acquired hexagonal or
  octagonal bandstands in the 19th century. The same form, civic
  rather than aristocratic.
- **East-Asian garden pavilion** — Chinese *ting*, Japanese *azumaya*.
  Different roof profile (curved eaves, pagoda elements), same open
  plan logic.

The **six-column** count is one of several valid choices (4, 6, 8 are
all common). Six is the smallest count that reads unambiguously as
"round" in projection — four reads as square, eight reads as round
but is denser. Six is the **iconic sweet spot**.

## Stays bespoke when

- The roof shape is **distinctive** (a Chinese curved roof, a pagoda
  superposition, a domed onion). The card's roof-apex slot can
  receive any shape, but the projected reading of "gazebo" depends on
  a moderately classical roof. East-Asian or Islamic variants need
  bespoke roof marks.
- The column count is **not six** (a four-column tetrastyle, an
  eight-column octastyle). Use [[peristyle-colonnade]] for 4-corner
  patterns; for 8-column variants, author a sibling card.
- The pavilion is **enclosed** (a walled tholos with a cella, a
  glassed orangery). This card encodes open-on-all-sides; enclosed
  variants need a different topology.
- The intent is **not ornamental** — a real load-bearing rotunda, a
  functional bandstand with railings and seating. The card's slot
  vocabulary biases toward "open ornament"; functional buildings need
  bespoke detail.
