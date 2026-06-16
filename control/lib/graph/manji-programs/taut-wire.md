---
{
  "id": "taut-wire",
  "label": "Taut wire (straight line)",
  "family": "line-rigid",
  "aliases": ["wire", "straight line", "taut cable", "laser", "sight line", "rigid link", "beam", "rod", "tether"],
  "intents": ["line", "rigid", "two-point-narrative", "structural-link"],
  "topology": {
    "primitive": "connection",
    "shape": "straight",
    "sag-direction": "none"
  },
  "reasoningUse": [
    "a straight rigid line between two named points — wire, beam, sight-line, laser, taut cable",
    "no sag, no oscillation — the line reads as a rigid structural link or visual axis",
    "use when the relation between A and B is rigid and direct; for sags use 'slack-rope', for arcs use 'arc-shot'"
  ],
  "boundaryContract": {
    "slots": ["start", "end"],
    "displacement": "none"
  },
  "manjiProgram": {
    "children": [
      {
        "kind": "connection",
        "from": "self/slot/start",
        "to": "self/slot/end",
        "sag": 0,
        "wavelengths": 0.5,
        "samples": 8,
        "style": { "stroke": "#3a3a3a", "width": 1.0 }
      }
    ]
  }
}
---

# Taut wire (straight line)

A straight rigid line between two named points. Sag is exactly zero;
no oscillation. The sampler still renders a polyline (8 segments) so
the line participates in depth-sorting like every other connection,
but visually it reads as a pure straight stroke.

## Use when

Reach for `taut-wire` when the line should feel rigid or
diagrammatically pure. Specific intents:

- **Architecture** — beams, rods, struts, taut suspension cables
  pulled tight against tension towers.
- **Diagrams** — sight-lines, optical paths, laser beams, vector
  indicators, axis markers.
- **Networks** — wired connections, electrical traces, signal paths
  where the rigidity itself is the diagrammatic message.

When the line should sag under gravity, use `slack-rope`. When it
should arc upward against gravity, use `arc-shot`. When it should
oscillate, use `vibrating-string`.

## Slot contract

Two slot names on the host: `start` and `end`. Use `pathBindings`
to alias if the host's natural slot names differ.

## Composition example

Two taut tension rods between four tower corners:

```json
{
  "tree": {
    "id": "frame",
    "spine": { "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.3 } },
    "slots": [
      { "id": "NW-top", "position": { "x": -8, "y": -4, "z": 6 } },
      { "id": "NE-top", "position": { "x":  8, "y": -4, "z": 6 } },
      { "id": "SW-bot", "position": { "x": -8, "y":  4, "z": 0 } },
      { "id": "SE-bot", "position": { "x":  8, "y":  4, "z": 0 } },
      { "id": "fill", "position": { "x": 0, "y": 0, "z": 0 } }
    ],
    "children": [
      { "slot": "fill", "node": { "programRef": "taut-wire",
        "pathBindings": { "self/slot/start": "frame/slot/NW-top", "self/slot/end": "frame/slot/SE-bot" } } },
      { "slot": "fill", "node": { "programRef": "taut-wire",
        "pathBindings": { "self/slot/start": "frame/slot/NE-top", "self/slot/end": "frame/slot/SW-bot" } } }
    ]
  }
}
```

## Stays bespoke when

- The line needs **arrowheads** or **terminator marks**. The
  connection primitive renders pure polylines; markers/heads are a
  future terminal-vocabulary item.
- The line needs **labels** along its length. Connection leaves carry
  no text; labels live at the manji-node level or as separate marks.
- The wire is **broken** or **dashed**. The current connection style
  is solid; dashed styling could be added to the style spec if a
  card family needs it.
