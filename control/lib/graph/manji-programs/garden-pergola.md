---
{
  "id": "garden-pergola",
  "label": "Garden pergola (open lattice walk)",
  "family": "garden-architecture",
  "aliases": ["pergola", "garden pergola", "arbor", "arbour", "vine arbor", "trellis walk", "covered garden walk", "rose pergola", "open lattice walk", "garden trellis", "vine-covered walkway"],
  "intents": ["architecture", "garden-architecture", "covered-path", "open-lattice"],
  "topology": {
    "primitive": "structure-manji",
    "shape": "linear-walk-with-canopy",
    "postRows": "2-parallel-rows",
    "enclosure": "open-sided-with-overhead-lattice"
  },
  "reasoningUse": [
    "an open lattice walkway with two parallel rows of posts supporting a slatted canopy above",
    "garden pergola, vine arbor, rose-covered walk, or any extended covered garden path",
    "6 post positions (3 per side) along a linear path with a canopy plane overhead",
    "use when the scene needs a long covered walk through a garden, vineyard, or formal landscape"
  ],
  "boundaryContract": {
    "slots": ["post-W-far", "post-W-mid", "post-W-near", "post-E-far", "post-E-mid", "post-E-near", "path-anchor", "canopy-anchor", "start-arch", "end-arch"],
    "collisionGroups": ["post-rows", "walking-path", "overhead-lattice"],
    "depthBands": ["far-end", "walk-mid", "near-end"]
  },
  "manjiProgram": {
    "spine": {
      "bar1": { "axis": "N-S", "tails": { "N": "open", "S": "open" }, "lengthScale": 0.5 },
      "bar2": { "axis": "E-W", "tails": { "W": "closed", "E": "closed" }, "lengthScale": 0.3 },
      "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.35 }
    },
    "slots": [
      { "id": "post-W-far",     "position": { "x": -2, "y": -6, "z":  0   } },
      { "id": "post-W-mid",     "position": { "x": -2, "y":  0, "z":  0   } },
      { "id": "post-W-near",    "position": { "x": -2, "y":  6, "z":  0   } },
      { "id": "post-E-far",     "position": { "x":  2, "y": -6, "z":  0   } },
      { "id": "post-E-mid",     "position": { "x":  2, "y":  0, "z":  0   } },
      { "id": "post-E-near",    "position": { "x":  2, "y":  6, "z":  0   } },
      { "id": "path-anchor",    "position": { "x":  0, "y":  0, "z":  0   } },
      { "id": "canopy-anchor",  "position": { "x":  0, "y":  0, "z":  3.5 } },
      { "id": "start-arch",     "position": { "x":  0, "y":  6, "z":  3   } },
      { "id": "end-arch",       "position": { "x":  0, "y": -6, "z":  3   } }
    ]
  }
}
---

# Garden pergola (open lattice walk)

An **open lattice walkway** with two parallel rows of three posts each
running along a linear path, with a slatted canopy spanning overhead.
The `start-arch` and `end-arch` slots define the entry and far end of
the walk, where a cross-beam or arched header marks the transition
from "outside" to "under the pergola." Open on both long sides — vines,
roses, and wisteria climb the posts and spread across the overhead
lattice in classical garden use.

This is **the linear covered garden walk** — narrower and longer than
[[gazebo-six-column]] (which is a single point), more open than
[[cloister-square]] (which encloses a courtyard). The card's direction
is the N-S axis (extended via open spine tails), so the pergola can
visually "continue forever" beyond the modeled endpoints.

## Use when

Reach for `garden-pergola` when the scene wants **a long open lattice
walk**:

- **Formal garden walk** — a rose-covered or wisteria-covered pergola
  in a Mediterranean, Italian, or English garden. The 6-post linear
  pattern frames the path without enclosing it.
- **Vineyard or fruit walk** — a grape arbor over a path between
  vineyard rows. Adjust the canopy mark to read as vines or fruit.
- **Architectural transition** — a covered walkway connecting two
  buildings (a Renaissance villa's garden link, a Japanese garden's
  *roji* passage). Use as a child of a wider architectural composition.
- **Wedding / ceremonial arch** — a single end of the pergola can read
  as a ceremonial passage if the start-arch is heavily marked (a
  floral arch, a torii-like gate).

When the structure should **enclose** (four-sided), use
[[cloister-square]]. When it's a **single point pavilion** (rest spot
in a garden), use [[gazebo-six-column]]. When the focus is the
**entrance** as a single architectural moment, use
[[portico-three-bay]].

## Slot semantics

- **post-W-far / post-W-mid / post-W-near** — the three posts along
  the west side of the path at z=0. Each pair (far/mid/near) shares a
  y-coordinate with the matching east post, so the cross-beams between
  W and E run perpendicular to the path.
- **post-E-far / post-E-mid / post-E-near** — the matching three posts
  along the east side. Drop [[fluted-column]] or a simpler post mark
  at each. For a casual pergola, plain wooden post marks read better
  than fluted columns.
- **path-anchor** — the center of the walk at origin. Default empty
  reads as flat path; bind a paving mark, a runner of stepping stones,
  or a centerline for the walk.
- **canopy-anchor** — the overhead lattice center at z=3.5. Bind a flat
  rectangular mark here for the canopy / lattice / pergola roof. For
  vines or roses growing over, a soft organic mark works well.
- **start-arch** — the near (entry) end of the pergola at y=6, z=3.
  Bind an arch, a gate, a wisteria-laden header here for the
  "entrance to the walk" reading.
- **end-arch** — the far (exit) end at y=-6, z=3. The terminal moment
  of the walk. Often where the walk leads to: a fountain, a statue,
  another garden zone. Bind a small focal mark here for "where the
  walk leads."

## Composition example

### Six-post rose pergola with arched ends

```json
{
  "programRef": "garden-pergola",
  "children": [
    { "slot": "post-W-far",  "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/post-W-far",  "self/slot/base": "self/slot/path-anchor" } } },
    { "slot": "post-W-mid",  "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/post-W-mid",  "self/slot/base": "self/slot/path-anchor" } } },
    { "slot": "post-W-near", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/post-W-near", "self/slot/base": "self/slot/path-anchor" } } },
    { "slot": "post-E-far",  "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/post-E-far",  "self/slot/base": "self/slot/path-anchor" } } },
    { "slot": "post-E-mid",  "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/post-E-mid",  "self/slot/base": "self/slot/path-anchor" } } },
    { "slot": "post-E-near", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/post-E-near", "self/slot/base": "self/slot/path-anchor" } } }
  ]
}
```

Six columnar posts in two parallel rows. The canopy is implicit between
the post-tops at z=4 (each column's top at z=5 minus the offset). The
overhead lattice and arched ends are absent in this minimal binding;
add them at `canopy-anchor`, `start-arch`, `end-arch` when needed.

### Pergola with figure walking through

```json
{
  "programRef": "garden-pergola",
  "children": [
    { "slot": "post-W-far",  "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/post-W-far",  "self/slot/base": "self/slot/path-anchor" } } },
    { "slot": "post-E-far",  "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/post-E-far",  "self/slot/base": "self/slot/path-anchor" } } },
    { "slot": "post-W-mid",  "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/post-W-mid",  "self/slot/base": "self/slot/path-anchor" } } },
    { "slot": "post-E-mid",  "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/post-E-mid",  "self/slot/base": "self/slot/path-anchor" } } },
    { "slot": "post-W-near", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/post-W-near", "self/slot/base": "self/slot/path-anchor" } } },
    { "slot": "post-E-near", "node": { "programRef": "fluted-column", "pathBindings": { "self/slot/top": "self/slot/post-E-near", "self/slot/base": "self/slot/path-anchor" } } },
    { "slot": "path-anchor", "node": { "programRef": "standing-figure-canonical" } }
  ]
}
```

Six posts plus a figure on the path — reads as a person walking under
the pergola. The posts compress visually in the projection toward the
distant end, giving the depth-recession that makes a pergola feel
deep.

## Provenance and influences

The pergola has lineages across multiple garden traditions:

- **Roman *pergula*** — extended garden structures of vine-covered
  trellises. Pliny the Younger described them in his villa letters.
- **Renaissance Italian garden** — Villa d'Este, Villa Lante. Pergolas
  as connectives between garden zones, often heavily planted with
  grapes or roses.
- **Arts & Crafts movement** — Gertrude Jekyll, William Robinson
  popularized the cottage-garden pergola. The "rose pergola" became a
  defining motif of English Edwardian garden design.
- **Japanese *fujidana*** — wisteria pergola, often a flat trellis
  over a viewing platform with the wisteria's vertical racemes hanging
  down. Same architectural shape, different cultural reading.

The pergola's defining tension is between **architecture and plant**:
the structure is geometric and rigid; the climbing vegetation is
organic and growing. A pergola reads correctly only when both are
present; pure architecture without plants reads as scaffold, pure
vegetation without architecture reads as wild.

## Stays bespoke when

- The walk is **non-linear** (curves around a garden, zigzags). The
  card hard-codes a straight path; curved or zigzag pergolas need
  bespoke slot positioning.
- The pergola is **enclosed on the sides** (a lath house with side
  panels, a glassed orangery walk). The open-sided property is
  defining; for enclosed variants use a different topology.
- The structure is **freestanding** with no walking path (a vine
  arbor as a decorative element, not a covered walk). The card's
  path-anchor slot encodes the walking intent; for decoration-only,
  the slot vocabulary fights you.
- The pergola has **distinctive cross-beam ornament** (carved Roman
  marble beams, Japanese tatami-mat texture). The canopy-anchor slot
  accepts any mark, but the iconic pergola reading wants moderate
  ornament — heavy detail competes with the planting.
