---
{
  "id": "portico-three-bay",
  "label": "Three-bay portico (tripartite entrance)",
  "family": "civic-architecture",
  "aliases": ["portico", "three-bay portico", "tripartite portico", "three-arch front", "classical entrance", "columned entrance", "temple front", "entry portico", "Palladian portico", "triumphal three-arch"],
  "intents": ["architecture", "entrance-facade", "classical-architecture", "tripartite-composition"],
  "topology": {
    "primitive": "structure-manji",
    "shape": "tripartite-facade",
    "bayCount": "3-bay",
    "openness": "open-front-closed-back"
  },
  "reasoningUse": [
    "a wide classical entrance front with three arches or bays separated by four piers or columns",
    "tripartite portico — temple front, palace entrance, Palladian villa, civic building facade",
    "4 supporting piers framing 3 bays, with an entablature above and an optional pediment apex",
    "use when the scene needs a formal entrance facade with bilateral symmetry around a central axis"
  ],
  "boundaryContract": {
    "slots": ["pier-far-W", "pier-near-W", "pier-near-E", "pier-far-E", "bay-W", "bay-center", "bay-E", "entablature-anchor", "pediment-apex", "floor-step"],
    "collisionGroups": ["pier-row", "bay-openings", "roof-pediment"],
    "depthBands": ["near-floor", "facade-mid", "pediment-high"]
  },
  "manjiProgram": {
    "spine": {
      "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.3 },
      "bar2": { "axis": "E-W", "tails": { "W": "closed", "E": "closed" }, "lengthScale": 0.6 },
      "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "open", "Nadir": "closed" }, "lengthScale": 0.55 }
    },
    "slots": [
      { "id": "pier-far-W",         "position": { "x": -7, "y": -3, "z":  0 } },
      { "id": "pier-near-W",        "position": { "x": -2.5, "y": -3, "z":  0 } },
      { "id": "pier-near-E",        "position": { "x":  2.5, "y": -3, "z":  0 } },
      { "id": "pier-far-E",         "position": { "x":  7, "y": -3, "z":  0 } },
      { "id": "bay-W",              "position": { "x": -4.75, "y": -3, "z":  2.5 } },
      { "id": "bay-center",         "position": { "x":  0, "y": -3, "z":  2.5 } },
      { "id": "bay-E",              "position": { "x":  4.75, "y": -3, "z":  2.5 } },
      { "id": "entablature-anchor", "position": { "x":  0, "y": -3, "z":  5 } },
      { "id": "pediment-apex",      "position": { "x":  0, "y": -3, "z":  7 } },
      { "id": "floor-step",         "position": { "x":  0, "y": -3, "z":  0 } }
    ]
  }
}
---

# Three-bay portico (tripartite entrance)

A **wide classical entrance facade** with three bays (arches or
columned openings) separated by four supporting piers, an entablature
spanning the full width above, and an open `pediment-apex` slot for an
optional triangular pediment. The center bay is the principal entrance
on axis; the flanking bays read as subordinate. This is the **tripartite
symmetry** that classical architecture reaches for whenever an entrance
needs to read as formal and authoritative.

Unlike [[peristyle-colonnade]] (an enclosure on all sides), the portico
is a **single facade** — the structure projects forward from a wall or
building mass that's implied behind. The slots all sit at y=-3 to read
as a flat plane facing the camera, with the four piers spaced
asymmetrically (outer bays narrower than the center) to emphasize the
central axis.

## Use when

Reach for `portico-three-bay` when the scene wants a **formal symmetric
entrance**:

- **Classical temple front** — the columned facade of a Greek temple
  (front view, not the side peristyle). Drop columns at the four pier
  slots and bind a triangular mass at `pediment-apex` for the
  pediment.
- **Palladian villa** — the central entrance of a Palladian or
  neoclassical country house. The "Palladian motif" (three openings
  with the center taller and arched) is exactly this card's
  proportions.
- **Triumphal arch** — Roman triumphal arches (Constantine, Septimius
  Severus) follow the three-bay tripartite pattern. The center bay is
  the principal arch; the flanking bays are smaller.
- **Civic building facade** — courthouses, banks, museums.
  19th-century neoclassical civic architecture leaned hard on this
  pattern as the visual grammar of authority.

When the scene wants **interior depth recession** rather than a front
facade, use [[cathedral-nave-deep-perspective]]. When the structure is
an open enclosure (no back wall), use [[peristyle-colonnade]]. When
the entrance is **single-bay** (one arch, one door), the card's
tripartite slot vocabulary is overkill — author a bespoke single-bay
facade.

## Slot semantics

- **pier-far-W / pier-far-E** — the outer piers at x=±7. These define
  the facade's outer width. Drop a column (e.g. [[fluted-column]]) or
  a thicker pier mark here. The outer piers can be **engaged** to a
  back wall (half-columns) or freestanding.
- **pier-near-W / pier-near-E** — the inner piers at x=±2.5. These
  separate the wider center bay from the narrower flanking bays. The
  3-bay asymmetry (center wider than flanks) is the **Palladian
  proportion**.
- **bay-W / bay-center / bay-E** — the three openings at z=2.5
  (mid-bay height, where an arch's keystone would sit). Bind arch
  marks here, or leave open for a columnar trabeated reading.
- **entablature-anchor** — the long horizontal band at z=5 spanning
  the full width of the facade. The architrave / frieze / cornice
  triplet sits here.
- **pediment-apex** — the top of the optional triangular pediment at
  z=7. Leave empty for a flat-roof facade (Roman attic-style); bind a
  triangular mass here for a Greek temple-front read.
- **floor-step** — the stepped base at z=0. Bind a wide stepped
  rectangular mass here for the **stylobate** (Greek) or **podium**
  (Roman).

## Composition example

### Classical Greek temple front

```json
{
  "programRef": "portico-three-bay",
  "children": [
    { "slot": "pier-far-W",  "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/pier-far-W",  "self/slot/base": "self/slot/floor-step" } } },
    { "slot": "pier-near-W", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/pier-near-W", "self/slot/base": "self/slot/floor-step" } } },
    { "slot": "pier-near-E", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/pier-near-E", "self/slot/base": "self/slot/floor-step" } } },
    { "slot": "pier-far-E",  "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/pier-far-E",  "self/slot/base": "self/slot/floor-step" } } },
    { "slot": "pediment-apex", "node": { "inlineProgram": {
        "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.3 },
        "bar2": { "axis": "E-W", "tails": { "W": "closed", "E": "closed" }, "lengthScale": 1.4 },
        "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.3 }
    } } }
  ]
}
```

Four columns, an entablature implied between the column tops, and a
triangular pediment mass at the apex — the Parthenon-style temple
front. The asymmetric column spacing (outer narrow, center wide)
gives the composition its tripartite rhythm.

### Triumphal arch with figure passing through

```json
{
  "programRef": "portico-three-bay",
  "children": [
    { "slot": "pier-far-W",  "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/pier-far-W",  "self/slot/base": "self/slot/floor-step" } } },
    { "slot": "pier-near-W", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/pier-near-W", "self/slot/base": "self/slot/floor-step" } } },
    { "slot": "pier-near-E", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/pier-near-E", "self/slot/base": "self/slot/floor-step" } } },
    { "slot": "pier-far-E",  "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/pier-far-E",  "self/slot/base": "self/slot/floor-step" } } },
    { "slot": "bay-center",  "node": { "programRef": "standing-figure-canonical" } }
  ]
}
```

Four piers and a figure framed by the center bay — the heroic
"passing through the arch" reading. The flanking bays are empty,
emphasizing that the figure occupies the central axis.

## Provenance and influences

The tripartite portico is **the canonical formal-entrance pattern** in
classical and post-classical architecture. Specific lineages:

- **Greek temple front** — the Parthenon, the Temple of Hephaestus. The
  three-bay reading is a simplification (real temples are hexastyle or
  octostyle); this card models the *iconic* simplification.
- **Roman triumphal arch** — Arch of Constantine (315 CE) is the
  archetypal three-bay arch: large central arch flanked by smaller
  side arches.
- **Renaissance basilica facade** — Alberti's Sant'Andrea in Mantua,
  Palladio's San Giorgio Maggiore. The triumphal-arch pattern adapted
  to church facades.
- **Palladian villa** — the "Palladian motif" (three-light window or
  doorway with center arched). Inigo Jones's Banqueting House,
  Hawksmoor's churches.
- **19th-century civic neoclassicism** — the British Museum's portico,
  the U.S. Capitol's wings, countless courthouses. The card's pattern
  is the substrate of 19th-century institutional architecture.

The tripartite proportion is **culturally near-universal** for "formal
entrance" — Mughal architecture's *iwan* trios, Japanese gates with
three openings, Chinese ceremonial *pailou*. The specific Greek/Roman
flavor of this card comes from the column-based pier slots; for
non-classical traditions, override the pier nodes accordingly.

## Stays bespoke when

- The entrance is **single-bay** (one arch, one door). The card's
  tripartite slot vocabulary is overkill for a single opening.
- The entrance is **five-bay** or more (a long colonnaded loggia, a
  Roman aqueduct's repeated arches). Use [[peristyle-colonnade]] as a
  starting point or author a bespoke multi-bay card.
- The pediment is **highly ornamental** (Baroque broken pediments,
  segmental pediments). The card's pediment-apex slot accepts any
  mass but the iconic triangular read comes from a simple triangle
  mass.
- The portico is **deep** (multiple column rows in depth, a
  hexastyle-deep porch). This card models a single-row facade; for a
  deep porch, layer another portico-three-bay or compose with
  [[peristyle-colonnade]].
