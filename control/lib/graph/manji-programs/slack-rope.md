---
{
  "id": "slack-rope",
  "label": "Slack rope (gravity-hung)",
  "family": "line-hanging",
  "aliases": ["rope", "hanging rope", "slack cable", "swag", "banner string", "garland string", "draped chain", "catenary line"],
  "intents": ["line", "hanging", "two-point-narrative", "structural-decoration"],
  "topology": {
    "primitive": "connection",
    "shape": "single-catenary",
    "sag-direction": "with-gravity"
  },
  "reasoningUse": [
    "a soft hanging curve between two named points — rope, banner, swag, garland",
    "the line sags downward (gravity-default direction) at a moderate fraction of the span",
    "use when the line should feel slack/hung; for taut wires use 'taut-wire', for trajectories use 'arc-shot'"
  ],
  "boundaryContract": {
    "slots": ["start", "end"],
    "displacement": "with-gravity"
  },
  "manjiProgram": {
    "children": [
      {
        "kind": "connection",
        "from": "self/slot/start",
        "to": "self/slot/end",
        "relativeSag": 0.18,
        "wavelengths": 0.5,
        "style": { "stroke": "#85603a", "width": 1.6 }
      }
    ]
  }
}
---

# Slack rope (gravity-hung)

A half-cycle curve between two named points, sagging WITH gravity at
18% of the span. Same shape regardless of endpoint distance — a tight
rope between close anchors looks slack the same way a long swag does.
Used for ropes, banners, swag chains, draped garlands, holiday lights,
power-line-style cable runs at moderate tension.

## Use when

Reach for `slack-rope` when the diagram needs a hanging line. Specific
intents:

- **Decoration / staging** — banners across a doorway, swag between
  two trees, garlands along an arch.
- **Architecture context** — power lines between poles, ropes between
  pier posts, chains between bollards.
- **Soft links** — diagrammatic connections that should feel loose
  rather than rigid.

When the line should be straight and taut, use `taut-wire`. When it
should arc upward against gravity (trajectory), use `arc-shot`. For
extremely heavy cable (deep catenary) author an inline connection with
a larger `relativeSag` instead of using this card.

## Slot contract

Two slot names on the host: `start` and `end`. Use `pathBindings` to
alias if the host's natural slot names differ.

## Composition example

Three banners strung between four pole anchors:

```json
{
  "tree": {
    "id": "plaza",
    "spine": { "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.3 } },
    "slots": [
      { "id": "pole-a-top", "position": { "x": -9, "y": -5, "z": 4 } },
      { "id": "pole-b-top", "position": { "x": -3, "y": -5, "z": 4 } },
      { "id": "pole-c-top", "position": { "x":  3, "y": -5, "z": 4 } },
      { "id": "pole-d-top", "position": { "x":  9, "y": -5, "z": 4 } },
      { "id": "fill", "position": { "x": 0, "y": 0, "z": 0 } }
    ],
    "children": [
      { "slot": "fill", "node": { "programRef": "slack-rope",
        "pathBindings": { "self/slot/start": "plaza/slot/pole-a-top", "self/slot/end": "plaza/slot/pole-b-top" } } },
      { "slot": "fill", "node": { "programRef": "slack-rope",
        "pathBindings": { "self/slot/start": "plaza/slot/pole-b-top", "self/slot/end": "plaza/slot/pole-c-top" } } },
      { "slot": "fill", "node": { "programRef": "slack-rope",
        "pathBindings": { "self/slot/start": "plaza/slot/pole-c-top", "self/slot/end": "plaza/slot/pole-d-top" } } }
    ]
  }
}
```

## Stays bespoke when

- The cable is **under significant tension** (suspension-bridge main
  cable). Author with `relativeSag` ~0.10 or lower inline.
- The rope is **swinging** or **knotted** along its length. The
  substrate's connection primitive is a smooth sine; for non-smooth
  rope structure (knots, kinks, hangs) compose multiple connections.
- The line needs **two clear catenary segments** with a peak in the
  middle (e.g. a clothesline with a heavy bird in the middle).
  Currently inexpressible as a single line-between; two segments
  glued at a middle point is the workaround.
