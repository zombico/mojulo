---
{
  "id": "arc-shot",
  "label": "Arc shot (trajectory)",
  "family": "line-trajectory",
  "aliases": ["arc", "trajectory", "ball arc", "basketball arc", "throw arc", "flight path", "parabolic path", "projectile arc"],
  "intents": ["line", "trajectory", "diagrammatic-motion", "two-point-narrative"],
  "topology": {
    "primitive": "connection",
    "shape": "single-arc",
    "sag-direction": "against-gravity"
  },
  "reasoningUse": [
    "a curved trajectory between two named points — basketball shot, thrown object, jumped path",
    "use when the diagram needs to show 'something moved from A to B along an arc', not a static link",
    "for purely structural straight links use 'taut-wire'; for hanging cables use 'slack-rope'"
  ],
  "boundaryContract": {
    "slots": ["start", "end"],
    "displacement": "against-gravity"
  },
  "manjiProgram": {
    "children": [
      {
        "kind": "connection",
        "from": "self/slot/start",
        "to": "self/slot/end",
        "relativeSag": -0.25,
        "wavelengths": 0.5,
        "style": { "stroke": "#a05a3a", "width": 1.4 }
      }
    ]
  }
}
---

# Arc shot (trajectory)

A single half-cycle curve between two named points, bulging UP against
gravity. The sag is a fixed fraction of the span (25%), so the same
recipe reads as an arc whether the two endpoints are 5 units apart or
500. Used in diagrams where the line itself signals motion or
trajectory — a basketball shot, a thrown object, a jump path, a signal
arc, a missile track.

## Use when

Reach for `arc-shot` when the diagram needs the line to mean "moved
from A to B along a curve." Specific intents:

- **Sports diagrams** — basketball shot from passer to hoop, soccer
  pass arc, golf swing path.
- **Physics / motion diagrams** — projectile flight, jump trajectory,
  ballistic path.
- **Process diagrams** — anything where the link between two nodes
  implies motion or transmission rather than static structure.

When the link is static (a wire, beam, sight-line), use `taut-wire`.
When the link hangs under gravity (rope, cable, banner), use
`slack-rope`.

## Slot contract

Two slot names on the host: `start` and `end`. If the host's natural
slot names differ, attach `pathBindings` on the calling node:

```json
{
  "slot": "fill",
  "node": {
    "programRef": "arc-shot",
    "pathBindings": {
      "self/slot/start": "scene/slot/passer-hand",
      "self/slot/end":   "scene/slot/hoop"
    }
  }
}
```

## Composition example

```json
{
  "tree": {
    "id": "court",
    "spine": { "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.3 } },
    "slots": [
      { "id": "start", "position": { "x": -8, "y": -10, "z": 1.5 } },
      { "id": "end",   "position": { "x":  8, "y": -10, "z": 3.0 } },
      { "id": "fill",  "position": { "x":  0, "y":   0, "z": 0   } }
    ],
    "children": [
      { "slot": "fill", "node": { "programRef": "arc-shot" } }
    ]
  }
}
```

## Stays bespoke when

- The arc needs **non-default sag magnitude** (a low line drive, a
  high lob). Pass `sag` or `relativeSag` directly on an inline
  `kind: 'connection'` leaf instead of using the card.
- The arc needs to **bulge sideways instead of up** (e.g. a curveball
  trajectory). Override `plane` on an inline connection.
- The shot needs **decay or animation** semantics. The substrate's
  connection primitive is a still curve; animated diagrams need a
  different mark family.
