---
{
  "id": "peristyle-colonnade",
  "label": "Peristyle colonnade",
  "family": "civic-architecture",
  "aliases": ["peristyle", "colonnade", "columned courtyard", "temple peristyle", "stoa", "columned portico ring", "ring of columns", "rectangular peristyle", "atrium colonnade"],
  "intents": ["architecture", "classical-architecture", "open-courtyard", "column-ring"],
  "topology": {
    "primitive": "structure-manji",
    "shape": "rectangular-ring",
    "columnCount": "8-position-peristyle",
    "enclosure": "open-air-interior"
  },
  "reasoningUse": [
    "a rectangular ring of columns surrounding an open interior court",
    "classical Greek or Roman peristyle — temple cella surround, palace atrium, monastic peristyle",
    "8 column positions (4 corners + 4 mid-edges) with a central court and an entablature overhead",
    "use when an architectural scene needs symmetrical columned enclosure around an open space"
  ],
  "boundaryContract": {
    "slots": ["column-NW", "column-N", "column-NE", "column-W", "column-E", "column-SW", "column-S", "column-SE", "center-court", "entablature-anchor", "floor-anchor"],
    "collisionGroups": ["column-ring", "interior-court", "roof-band"],
    "depthBands": ["far-row", "side-mid-row", "near-row"]
  },
  "manjiProgram": {
    "spine": {
      "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.5 },
      "bar2": { "axis": "E-W", "tails": { "W": "closed", "E": "closed" }, "lengthScale": 0.4 },
      "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.5 }
    },
    "slots": [
      { "id": "column-NW",         "position": { "x": -5, "y": -8, "z":  0 } },
      { "id": "column-N",          "position": { "x":  0, "y": -8, "z":  0 } },
      { "id": "column-NE",         "position": { "x":  5, "y": -8, "z":  0 } },
      { "id": "column-W",          "position": { "x": -5, "y":  0, "z":  0 } },
      { "id": "column-E",          "position": { "x":  5, "y":  0, "z":  0 } },
      { "id": "column-SW",         "position": { "x": -5, "y":  8, "z":  0 } },
      { "id": "column-S",          "position": { "x":  0, "y":  8, "z":  0 } },
      { "id": "column-SE",         "position": { "x":  5, "y":  8, "z":  0 } },
      { "id": "center-court",      "position": { "x":  0, "y":  0, "z":  0 } },
      { "id": "entablature-anchor","position": { "x":  0, "y":  0, "z":  5 } },
      { "id": "floor-anchor",      "position": { "x":  0, "y":  0, "z":  0 } }
    ]
  }
}
---

# Peristyle colonnade

A **rectangular ring of columns** around an open interior court. Eight
column positions (four corners + four mid-edges) bracket a central
court, with an `entablature-anchor` above the column tops for the roof
beam and a `floor-anchor` for the stylobate platform beneath. The
composition is symmetrical along both axes, which is the peristyle's
defining property — the eye finds a clear center wherever it lands.

This is the **classical open-air enclosure** archetype: a Greek temple's
cella surround, a Roman villa's atrium, a Hellenistic stoa wrapping a
public space. The slots align with `fluted-column`'s `top` / `base`
contract, so dropping a column card at any of the eight column slots
composes naturally.

## Use when

Reach for `peristyle-colonnade` when the scene wants **symmetric columned
enclosure** around an open space:

- **Classical temple exterior** — the cella surround with columns on
  all four sides. Drop [[fluted-column]] at the eight column slots and
  leave the center-court open for the temple's inner sanctum.
- **Roman atrium / impluvium** — the columned interior of a Roman
  domus, where the impluvium (a small pool) sits in the center-court.
  Place a small reflective mark at the center for a pool.
- **Palace courtyard** — a renaissance or baroque courtyard with
  columned cloistering on all four sides.
- **Pictorial framing** — the eight columns + entablature read as a
  frame for whatever sits at center-court (a statue, a figure, an
  altar).

When the enclosure is **continuous arcading** (no open corners), use
[[cloister-square]] — that card models the four-walk pattern with a
more enclosed feel. When the structure is **open on three sides** with
a single arched facade, use [[portico-three-bay]].

## Slot semantics

- **column-NW / NE / SW / SE** — the four corner columns. These are
  load-bearing in the architectural reading; they carry the heaviest
  visual weight in the projected frame.
- **column-N / S / E / W** — the four mid-edge columns. These split the
  long sides of the rectangle into two bays. With a heavier corner
  column and lighter mid-edge ones, the structure reads as more
  classically balanced.
- **center-court** — the open interior at the origin. Default empty
  reads as an open court. A statue or altar here reads as the cult
  object of a temple.
- **entablature-anchor** — the overhead horizontal band (z=5). Bind a
  long horizontal mark here for the entablature / architrave / cornice
  band that sits on the column tops.
- **floor-anchor** — the platform / stylobate (z=0). Bind a wide flat
  mark here for the stepped base the peristyle sits on.

## Composition example

### Greek temple with corner + mid-edge columns

```json
{
  "programRef": "peristyle-colonnade",
  "children": [
    { "slot": "column-NW", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-NW", "self/slot/base": "self/slot/floor-anchor" } } },
    { "slot": "column-N",  "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-N",  "self/slot/base": "self/slot/floor-anchor" } } },
    { "slot": "column-NE", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-NE", "self/slot/base": "self/slot/floor-anchor" } } },
    { "slot": "column-W",  "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-W",  "self/slot/base": "self/slot/floor-anchor" } } },
    { "slot": "column-E",  "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-E",  "self/slot/base": "self/slot/floor-anchor" } } },
    { "slot": "column-SW", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-SW", "self/slot/base": "self/slot/floor-anchor" } } },
    { "slot": "column-S",  "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-S",  "self/slot/base": "self/slot/floor-anchor" } } },
    { "slot": "column-SE", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-SE", "self/slot/base": "self/slot/floor-anchor" } } }
  ]
}
```

Each column's `top` slot binds to the corresponding column position;
each column's `base` slot binds to the shared `floor-anchor`. The
result reads as a Greek temple's peristyle in plan + elevation.

### Peristyle with central statue

```json
{
  "programRef": "peristyle-colonnade",
  "children": [
    { "slot": "column-NW", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-NW", "self/slot/base": "self/slot/floor-anchor" } } },
    { "slot": "column-NE", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-NE", "self/slot/base": "self/slot/floor-anchor" } } },
    { "slot": "column-SW", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-SW", "self/slot/base": "self/slot/floor-anchor" } } },
    { "slot": "column-SE", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/column-SE", "self/slot/base": "self/slot/floor-anchor" } } },
    { "slot": "center-court", "node": { "programRef": "standing-figure-canonical" } }
  ]
}
```

Four corner columns and a figure at center-court — reads as a small
columned monument with a central figure (a votive shrine, a hero
memorial). The empty mid-edge slots let the corners breathe.

## Provenance and influences

The peristyle is the **defining structure of classical architecture** —
a Greek temple's plan IS its peristyle, and Hellenistic/Roman builders
extended it into civic and domestic contexts. Specific lineages:

- **Greek temple peristyle** — the Parthenon's 8x17 columns, smaller
  temples' 6x13 or 4x6 arrangements. The peristyle column count
  encodes the temple's pretension.
- **Roman atrium** — the inward-facing courtyard of a Pompeian domus.
  Smaller scale, often 4-column, with an impluvium pool at center.
- **Hellenistic stoa** — a long single-row colonnade fronting a public
  space. Single-row stoas are a *side* of this card; for a single row
  use the card with only column-N / N-edge slots bound.
- **Renaissance + Baroque revival** — Bramante's Tempietto, Palladio's
  villas, Christopher Wren's churches. The peristyle reappears
  whenever classical authority is the affect.

The eight-position model is a **deliberate simplification** — real
peristyles have more columns per side (often 6-8 along the long sides).
Use this card for the *iconic* peristyle reading; for a denser
colonnade, layer a `replicate` band between the corner columns.

## Stays bespoke when

- The peristyle is **non-rectangular** (circular, elliptical, polygonal).
  Tholos temples (round peristyles) need their own card. The cardinal
  rectangular grid hard-codes the 4-corner symmetry.
- The peristyle is **asymmetric** (different column counts on different
  sides — a corner stoa, a U-shaped stoa). Asymmetric arrangements
  need bespoke slot positioning.
- The columns are **engaged** (half-columns attached to a solid wall
  rather than freestanding). This card models freestanding columns;
  engaged columns need a different topology.
- The intent is **interior** view from one side rather than overview.
  For a deep interior shot through the peristyle, compose
  [[cathedral-nave-deep-perspective]] instead and let the camera be
  the carrying axis.
